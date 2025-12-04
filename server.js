/**
 * server.js
 * Single-file PWA Movie Streaming + Download platform "CLOUD. MOVIES" for Bera Tech
 *
 * Requirements implemented:
 * - Single server.js serves all static assets (HTML/CSS/JS), manifest, service-worker.
 * - Proxies Gifted Movies API endpoints.
 * - Streaming with Range support and direct download (Content-Disposition).
 * - Age verification modal (18+).
 * - PWA install prompt + offline caching + caching previously viewed movies.
 * - Mobile-first responsive UI, dark/light toggle, favorites in localStorage, realtime search.
 *
 * Dependencies:
 *   npm i express axios cookie-parser mime
 *
 * Launch: node server.js
 */

const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const mime = require('mime');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 3000;

// Gifted Movies API base
const GIFTED_BASE = 'https://movieapi.giftedtech.co.ke';

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Simple logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

/* -----------------------------
   Helper: Proxy functions
   ----------------------------- */
async function proxyGiftedJson(req, res, targetPath) {
  try {
    const url = new URL(`${GIFTED_BASE}${targetPath}`);
    // forward any query params from incoming request
    Object.keys(req.query || {}).forEach(k => url.searchParams.set(k, req.query[k]));
    const r = await axios.get(url.toString(), { timeout: 15000 });
    res.setHeader('Content-Type', 'application/json');
    res.status(r.status).send(r.data);
  } catch (err) {
    console.error('proxyGiftedJson error', err.message || err);
    if (err.response && err.response.data) {
      return res.status(err.response.status || 500).json(err.response.data);
    }
    res.status(500).json({ error: 'Failed to fetch from Gifted API', message: err.message });
  }
}

/* -----------------------------
   API Proxy endpoints
   - /api/search/:query
   - /api/info/:id
   - /api/sources/:id
   ----------------------------- */
app.get('/api/search/:query', async (req, res) => {
  const q = encodeURIComponent(req.params.query);
  const path = `/api/search/${q}`;
  await proxyGiftedJson(req, res, path);
});

app.get('/api/info/:id', async (req, res) => {
  const id = req.params.id;
  const path = `/api/info/${encodeURIComponent(id)}`;
  await proxyGiftedJson(req, res, path);
});

app.get('/api/sources/:id', async (req, res) => {
  const id = req.params.id;
  // accept optional season and episode query params
  let path = `/api/sources/${encodeURIComponent(id)}`;
  await proxyGiftedJson(req, res, path);
});

/* -----------------------------
   Age verification middleware
   - requires cookie 'age_verified' == '1'
   - endpoints that serve streaming or downloading check this
   ----------------------------- */
function requireAgeVerified(req, res, next) {
  const val = req.cookies && req.cookies.age_verified;
  if (val === '1') return next();
  return res.status(403).json({ error: 'Age verification required' });
}

/* -----------------------------
   Helper: stream proxy with range support
   - streams remote content to client while supporting Range header
   - used for /stream/:id and /download/:id
   ----------------------------- */
async function proxyStream(req, res, remoteUrl, opts = {}) {
  try {
    // Validate remoteUrl is a real http(s) url
    const allowed = remoteUrl && (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://'));
    if (!allowed) return res.status(400).send('Invalid remote URL');

    // Build headers for upstream request (pass Range if present)
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    // Some servers require user-agent
    headers['User-Agent'] = req.headers['user-agent'] || 'CLOUD.MOVIES-Agent';

    const upstream = await axios({
      url: remoteUrl,
      method: 'GET',
      responseType: 'stream',
      headers,
      timeout: 30000,
    });

    // Propagate essential headers
    const contentType = upstream.headers['content-type'] || mime.getType(remoteUrl) || 'application/octet-stream';
    const contentLength = upstream.headers['content-length'];
    const acceptRanges = upstream.headers['accept-ranges'] || (req.headers.range ? 'bytes' : undefined);
    const statusCode = upstream.status === 206 ? 206 : (req.headers.range ? 206 : 200);

    res.status(statusCode);
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
    if (upstream.headers['content-range']) res.setHeader('Content-Range', upstream.headers['content-range']);
    if (opts.asAttachment && opts.filename) {
      res.setHeader('Content-Disposition', `attachment; filename="${opts.filename}"`);
    }
    // Pipe stream
    upstream.data.pipe(res);
    upstream.data.on('end', () => {
      // finished
    });
    upstream.data.on('error', (e) => {
      console.error('upstream stream error', e && e.message);
      try { res.end(); } catch (e) {}
    });
  } catch (err) {
    console.error('proxyStream error', err.message || err);
    if (err.response && err.response.status === 416) {
      return res.status(416).send('Range not satisfiable');
    }
    res.status(500).send('Failed to stream media');
  }
}

/* -----------------------------
   Endpoint: /stream/:id
   - query: quality=360|480|720
   - proxies a chosen file URL from the /api/sources/{id} endpoint
   ----------------------------- */
app.get('/stream/:id', requireAgeVerified, async (req, res) => {
  const id = req.params.id;
  const quality = req.query.quality || '720';
  try {
    const srcRes = await axios.get(`${GIFTED_BASE}/api/sources/${encodeURIComponent(id)}`, { timeout: 15000 });
    const sources = srcRes.data && srcRes.data.sources ? srcRes.data.sources : srcRes.data || [];
    // attempt to find a matching quality by label or resolution
    let chosen = null;
    if (Array.isArray(sources)) {
      // try label or url containing quality string
      chosen = sources.find(s => (s.label && s.label.includes(quality)) || (s.file && s.file.includes(`${quality}`)));
      if (!chosen) {
        // fallback to first source
        chosen = sources[0];
      }
    } else if (typeof sources === 'string') {
      chosen = { file: sources };
    } else {
      // If structure unknown, respond with entire sources
      return res.json({ error: 'Unexpected sources structure', sources: srcRes.data });
    }
    if (!chosen || !chosen.file) return res.status(404).json({ error: 'No source file found' });

    // prepare filename based on title if present
    const filename = (srcRes.data && srcRes.data.title ? `${srcRes.data.title.replace(/[^a-z0-9_\-\.]/gi,'_')}_${quality}.mp4` : `movie_${id}_${quality}.mp4`);

    await proxyStream(req, res, chosen.file, { asAttachment: false, filename });
  } catch (err) {
    console.error('stream endpoint error', err.message || err);
    res.status(500).json({ error: 'Failed to fetch stream source', message: err.message });
  }
});

/* -----------------------------
   Endpoint: /download/:id
   - proxies remote file and forces download attachment
   - query: quality=360|480|720
   ----------------------------- */
app.get('/download/:id', requireAgeVerified, async (req, res) => {
  const id = req.params.id;
  const quality = req.query.quality || '720';
  try {
    const srcRes = await axios.get(`${GIFTED_BASE}/api/sources/${encodeURIComponent(id)}`, { timeout: 15000 });
    const sources = srcRes.data && srcRes.data.sources ? srcRes.data.sources : srcRes.data || [];
    let chosen = null;
    if (Array.isArray(sources)) {
      chosen = sources.find(s => (s.label && s.label.includes(quality)) || (s.file && s.file.includes(`${quality}`)));
      if (!chosen) chosen = sources[0];
    } else if (typeof sources === 'string') {
      chosen = { file: sources };
    } else {
      return res.json({ error: 'Unexpected sources structure', sources: srcRes.data });
    }
    if (!chosen || !chosen.file) return res.status(404).json({ error: 'No source file found' });

    const filename = (srcRes.data && srcRes.data.title ? `${srcRes.data.title.replace(/[^a-z0-9_\-\.]/gi,'_')}_${quality}.mp4` : `movie_${id}_${quality}.mp4`);
    await proxyStream(req, res, chosen.file, { asAttachment: true, filename });
  } catch (err) {
    console.error('download endpoint error', err.message || err);
    res.status(500).json({ error: 'Failed to download source', message: err.message });
  }
});

/* -----------------------------
   Optional: Download helper endpoints for provided gifted download APIs
   (these are optional endpoints referenced by the user; included for completeness)
   ----------------------------- */
app.get('/util/download/ytmp4', requireAgeVerified, async (req, res) => {
  // expects ?url={VIDEO_URL}&quality=720
  const videoUrl = req.query.url;
  const quality = req.query.quality || '720';
  if (!videoUrl) return res.status(400).json({ error: 'url query required' });
  // Construct gifted api url
  const apiUrl = `https://api.giftedtech.co.ke/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(videoUrl)}&quality=${encodeURIComponent(quality)}`;
  // proxy
  await proxyStream(req, res, apiUrl, { asAttachment: true, filename: `yt_${Date.now()}.mp4` });
});

/* -----------------------------
   Serve PWA assets (manifest, sw, front-end)
   All front-end code (HTML/CSS/JS) embedded below as templates
   ----------------------------- */

/* manifest.json */
app.get('/manifest.json', (req, res) => {
  const manifest = {
    name: "CLOUD. MOVIES",
    short_name: "CLOUDMOV",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1020",
    theme_color: "#ff4b3a",
    icons: [
      { src: "/assets/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/assets/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
  res.json(manifest);
});

/* Minimal icons endpoints (SVG/PNG placeholders) */
app.get('/assets/icons/:name', (req, res) => {
  const name = req.params.name;
  // return a simple SVG/PNG placeholder for icons so PWA install works
  if (name.endsWith('.png')) {
    // 1x1 transparent png (tiny placeholder) - but better to serve data: uri? We'll serve SVG as PNG fallback
    res.setHeader('Content-Type', 'image/png');
    // small 512x512 PNG placeholder generated on-the-fly would require binary; for brevity serve SVG as PNG-like content-type
    res.send(Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
         <rect width="100%" height="100%" rx="48" fill="#0b1020"/>
         <text x="50%" y="50%" fill="#ff4b3a" font-size="64" text-anchor="middle" dy="0.35em">CLOUD</text>
       </svg>`
    ));
    return;
  }
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><rect width="100%" height="100%" rx="24" fill="#0b1020"/><text x="50%" y="50%" fill="#ff4b3a" font-size="28" text-anchor="middle" dy="0.35em">CLOUD</text></svg>`);
});

/* Service Worker */
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
// Service Worker for CLOUD. MOVIES - caching assets + previously viewed media
const CACHE_NAME = 'cloudmovies-v1';
const ASSETS = [
  '/',
  '/manifest.json'
  // dynamic caching for assets will be used
];

// install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

// activate
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// fetch handler: network-first for API & streaming, cache-first for app shell, and special handling to cache
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Don't interfere with non-GET
  if (req.method !== 'GET') return;

  // PWA assets -> cache-first
  const isAppShell = req.mode === 'navigate' || url.pathname === '/' || url.pathname.startsWith('/assets') || url.pathname === '/manifest.json';
  if (isAppShell) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(fetchRes => {
          caches.open(CACHE_NAME).then(c => c.put(req, fetchRes.clone()));
          return fetchRes;
        }).catch(() => caches.match('/'));
      })
    );
    return;
  }

  // For streaming media and API calls, use network-first and cache successful responses for offline playback
  const isMedia = url.pathname.startsWith('/stream/') || url.pathname.startsWith('/download/') || url.pathname.includes('/api/sources/') || req.headers.get('accept') && req.headers.get('accept').includes('video');
  if (isMedia) {
    event.respondWith(
      fetch(req).then(networkRes => {
        // don't cache if response is not ok
        if (networkRes && networkRes.ok) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then(cache => {
            // limit size: optionally we can prune old entries; for brevity, just put
            cache.put(req, clone);
          });
        }
        return networkRes;
      }).catch(() => caches.match(req).then(cached => cached || new Response('Offline', { status: 503 })))
    );
    return;
  }

  // default: try network then fallback to cache
  event.respondWith(
    fetch(req).then(r => {
      if (r && r.ok) {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
      }
      return r;
    }).catch(() => caches.match(req))
  );
});
`);
});

/* -----------------------------
   Main HTML app (single page)
   - Contains inline CSS & JS for a compact one-file deployment
   ----------------------------- */
app.get('/', (req, res) => {
  const html = `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover,user-scalable=no"/>
<title>CLOUD. MOVIES — Bera Tech</title>
<meta name="theme-color" content="#0b1020"/>
<link rel="manifest" href="/manifest.json"/>
<style>
  /* Mobile-first modern styling */
  :root{
    --bg:#0b1020; --card:#0f1724; --muted:#9aa4b2; --accent:#ff4b3a; --glass: rgba(255,255,255,0.03);
    --text:#e6eef6; --radius:14px; --gap:14px; font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  }
  *{box-sizing:border-box}
  html,body,#app{height:100%}
  body{margin:0;background:linear-gradient(180deg,#071025 0%, #081426 60%);color:var(--text);-webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale;}
  header{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 8px;border-bottom:1px solid rgba(255,255,255,0.03);backdrop-filter: blur(6px);position:sticky;top:0;z-index:40}
  .brand{display:flex;align-items:center;gap:12px}
  .logo{width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#ff7a6a);display:flex;align-items:center;justify-content:center;font-weight:700}
  .brand h1{font-size:16px;margin:0}
  .search{flex:1;margin:0 12px;position:relative}
  .search input{width:100%;padding:10px 12px;border-radius:12px;background:var(--card);border:0;color:var(--text)}
  .actions{display:flex;gap:8px}
  .btn{background:var(--glass);padding:8px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.03);cursor:pointer}
  main{padding:16px;display:grid;grid-template-columns:1fr;gap:18px}
  .section{background:linear-gradient(180deg,rgba(255,255,255,0.02), rgba(255,255,255,0.01));padding:12px;border-radius:12px}
  .section h2{margin:0 0 8px;font-size:14px}
  .carousel{display:flex;gap:10px;overflow:auto;padding-bottom:8px}
  .card{min-width:140px;background:linear-gradient(180deg, rgba(255,255,255,0.02), transparent);border-radius:10px;padding:8px;flex:0 0 140px;cursor:pointer;transition:transform .18s ease;display:flex;flex-direction:column;gap:8px}
  .card:hover{transform:translateY(-6px)}
  .poster{width:100%;height:200px;border-radius:8px;background:#081426;object-fit:cover}
  .meta{font-size:12px;color:var(--muted)}
  .controls{display:flex;gap:8px;align-items:center}
  .play{background:var(--accent);color:#fff;padding:8px 10px;border-radius:8px;border:0}
  .fav{background:transparent;border:1px solid rgba(255,255,255,0.06);padding:8px;border-radius:8px}
  footer{padding:16px;text-align:center;color:var(--muted);font-size:12px}
  /* Movie modal */
  .modal{position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center;padding:18px;pointer-events:none}
  .sheet{width:100%;max-width:980px;background:linear-gradient(180deg,#071025,#061122);border-radius:18px;padding:16px;pointer-events:auto;box-shadow:0 10px 40px rgba(2,3,20,0.6)}
  .sheet .top{display:flex;gap:12px}
  .sheet .poster{width:160px;height:240px;flex:0 0 160px}
  .sheet .info{flex:1}
  .qualities{display:flex;gap:8px;margin-top:8px}
  .pill{padding:8px 10px;border-radius:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.03);cursor:pointer}
  /* age modal */
  .age-modal{position:fixed;inset:0;background:linear-gradient(90deg, rgba(3,6,18,0.85), rgba(4,6,10,0.85));display:flex;align-items:center;justify-content:center;z-index:999}
  .age-box{background:linear-gradient(180deg,#071025,#081426);padding:22px;border-radius:12px;text-align:center;max-width:420px}
  .small{font-size:13px;color:var(--muted)}
  /* responsive */
  @media(min-width:720px){
    main{grid-template-columns:1fr}
    .carousel .card{min-width:180px}
  }
  /* animations */
  .fade-in{animation:fadeIn .35s both}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none}}
</style>
</head>
<body>
<header>
  <div class="brand">
    <div class="logo">CT</div>
    <div>
      <h1>CLOUD. MOVIES</h1>
      <div class="small">by Bera Tech — Stream & download</div>
    </div>
  </div>

  <div class="search">
    <input id="searchInput" placeholder="Search movies, shows, actors..." aria-label="Search"/>
    <div id="searchResults" style="position:absolute;left:0;right:0;top:44px;background:var(--card);border-radius:8px;display:none;z-index:60;padding:8px"></div>
  </div>

  <div class="actions">
    <button id="themeToggle" class="btn" title="Toggle dark/light">🌗</button>
    <button id="installBtn" class="btn" style="display:none">Install</button>
    <button id="favoritesBtn" class="btn">Favorites</button>
  </div>
</header>

<main id="app" class="fade-in">
  <section class="section" id="featured">
    <h2>Featured</h2>
    <div class="carousel" id="featuredList">Loading...</div>
  </section>

  <section class="section" id="trending">
    <h2>Trending</h2>
    <div class="carousel" id="trendingList">Loading...</div>
  </section>

  <section class="section" id="latest">
    <h2>Latest</h2>
    <div class="carousel" id="latestList">Loading...</div>
  </section>

  <section class="section" id="toprated">
    <h2>Top Rated</h2>
    <div class="carousel" id="topratedList">Loading...</div>
  </section>

</main>

<!-- movie sheet modal -->
<div id="modalRoot" style="display:none" class="modal">
  <div class="sheet" role="dialog" aria-modal="true">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:700" id="modalTitle">Movie Title</div>
      <div><button id="closeModal" class="btn">Close</button></div>
    </div>
    <div class="top" style="margin-top:8px">
      <img id="modalPoster" class="poster" src="" alt="poster"/>
      <div class="info">
        <div id="modalDesc" style="font-size:13px;color:var(--muted);margin-bottom:8px"></div>
        <div id="modalMeta" class="meta"></div>
        <div style="margin-top:10px">
          <div class="qualities" id="qualityBtns"></div>
          <div style="margin-top:10px" class="controls">
            <button id="playBtn" class="play">Play</button>
            <button id="downloadBtn" class="fav">Download</button>
            <button id="favBtn" class="fav">♡ Favorite</button>
          </div>
        </div>
      </div>
    </div>

    <div id="playerArea" style="margin-top:12px;display:none">
      <video id="player" controls playsinline style="width:100%;max-height:480px;border-radius:8px;background:#000"></video>
    </div>
  </div>
</div>

<!-- age verification modal -->
<div id="ageModal" class="age-modal" style="display:none">
  <div class="age-box">
    <h2>Age Verification</h2>
    <p class="small">This site contains films and content intended for adults (18+). Please confirm you are 18 years or older to continue.</p>
    <div style="margin-top:12px;display:flex;gap:8px;justify-content:center">
      <button id="ageYes" class="play">I am 18+</button>
      <button id="ageNo" class="btn">I am under 18</button>
    </div>
  </div>
</div>

<footer>
  <div>Bera Tech — CLOUD. MOVIES • © <span id="year"></span></div>
  <div class="small">Powered by Gifted Movies API</div>
</footer>

<script>
/* -------------------------
  Client-side app script
   - Realtime search
   - Fetch home sections
   - Open modal, stream, download
   - Age verification using cookie
   - PWA install prompt
   - Favorites via localStorage
   - Dark/light toggle
   ------------------------- */

const API_BASE = window.location.origin; // server proxies
const yearEl = document.getElementById('year'); yearEl.textContent = new Date().getFullYear();

// Age verification: check cookie
function getCookie(name) {
  const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return v ? v.pop() : '';
}
function setCookie(name, value, days=365) {
  const d = new Date(); d.setTime(d.getTime() + (days*24*60*60*1000));
  document.cookie = name + "=" + value + ";path=/;expires=" + d.toUTCString();
}

const ageVerified = getCookie('age_verified') === '1';
const ageModal = document.getElementById('ageModal');
if (!ageVerified) {
  ageModal.style.display = 'flex';
}
document.getElementById('ageYes').addEventListener('click', () => {
  setCookie('age_verified','1');
  ageModal.style.display = 'none';
});
document.getElementById('ageNo').addEventListener('click', () => {
  alert('You must be 18+ to use CLOUD. MOVIES. Returning to safe page.');
  window.location.href = 'https://www.google.com';
});

/* Fetch and render helper */
async function fetchJSON(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error('Failed');
    return await r.json();
  } catch (e) {
    console.error('fetchJSON error', e);
    return null;
  }
}

// minimal render card
function makeCard(item) {
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.id = item.id || item._id || item.imdb_id || item.tmdb_id || item.title;
  el.innerHTML = \`
    <img class="poster" src="\${item.cover || item.poster || item.image || ''}" alt="\${item.title || 'poster'}" onerror="this.style.opacity=.6"/>
    <div style="font-weight:600;font-size:13px">\${item.title || item.name || 'Untitled'}</div>
    <div class="meta">\${item.genre ? item.genre.join(', ') : ''} • \${item.year || item.release_date || ''}</div>
  \`;
  el.addEventListener('click', () => openModal(el.dataset.id));
  return el;
}

/* Populate home sections by running some searches as proxies for Featured/Trending/Latest/TopRated
   Since Gifted API provides only search/info/sources, we'll use generic queries that commonly return results.
*/
async function loadHome() {
  const featuredQueries = ['Avengers', 'Inception', 'Interstellar', 'Matrix'];
  const trendingQueries = ['Action', 'Drama', 'Comedy', 'Crime'];
  const latestQueries = ['2024', '2023', '2022'];
  const topQueries = ['Oscar', 'Top Rated', 'IMDB Top'];

  const [featured, trending, latest, top] = await Promise.all([
    multiSearch(featuredQueries),
    multiSearch(trendingQueries),
    multiSearch(latestQueries),
    multiSearch(topQueries)
  ]);

  renderList('featuredList', featured);
  renderList('trendingList', trending);
  renderList('latestList', latest);
  renderList('topratedList', top);
}

async function multiSearch(arr) {
  let out = [];
  for (let q of arr) {
    const res = await fetchJSON(\`\${API_BASE}/api/search/\${encodeURIComponent(q)}\`);
    if (res && Array.isArray(res)) out = out.concat(res.slice(0,6));
    else if (res && res.results) out = out.concat(res.results.slice(0,6));
    if (out.length >= 12) break;
  }
  // dedupe by title
  const map = {};
  const uniq = [];
  for (let it of out) {
    const id = it.id || it._id || (it.title && it.title.toLowerCase());
    if (!id) continue;
    if (!map[id]) { map[id]=true; uniq.push(it); }
  }
  return uniq.slice(0,12);
}

function renderList(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="small">No items</div>'; return;
  }
  items.forEach(it => container.appendChild(makeCard(it)));
}

/* Realtime search */
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
let searchTimer = null;
searchInput.addEventListener('input', (e) => {
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  if (!q) { searchResults.style.display = 'none'; return; }
  searchTimer = setTimeout(async () => {
    const res = await fetchJSON(\`\${API_BASE}/api/search/\${encodeURIComponent(q)}\`);
    searchResults.innerHTML = '';
    if (!res || res.length === 0) {
      searchResults.innerHTML = '<div class="small" style="padding:6px">No results</div>';
      searchResults.style.display = 'block';
      return;
    }
    const list = (Array.isArray(res) ? res : (res.results || []));
    for (let it of list.slice(0,8)) {
      const row = document.createElement('div');
      row.style.padding='8px'; row.style.borderBottom='1px solid rgba(255,255,255,0.02)'; row.style.display='flex'; row.style.gap='10px';
      row.innerHTML = \`<img src="\${it.cover||it.poster||it.image||''}" style="width:48px;height:64px;border-radius:6px;object-fit:cover"/><div style="flex:1"><div style="font-weight:600">\${it.title||it.name}</div><div class="small">\${it.year||it.release_date||''}</div></div>\`;
      row.addEventListener('click', ()=> { searchResults.style.display='none'; searchInput.value=''; openModal(it.id||it._id||it.title); });
      searchResults.appendChild(row);
    }
    searchResults.style.display = 'block';
  }, 300);
});

/* Modal + streaming */
const modalRoot = document.getElementById('modalRoot');
const closeModalBtn = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const modalPoster = document.getElementById('modalPoster');
const modalDesc = document.getElementById('modalDesc');
const modalMeta = document.getElementById('modalMeta');
const qualityBtns = document.getElementById('qualityBtns');
const playBtn = document.getElementById('playBtn');
const downloadBtn = document.getElementById('downloadBtn');
const favBtn = document.getElementById('favBtn');
const playerArea = document.getElementById('playerArea');
const player = document.getElementById('player');

let currentItem = null;
let currentSources = [];
let selectedQuality = '';

closeModalBtn.addEventListener('click', () => { modalRoot.style.display='none'; player.pause(); player.src=''; playerArea.style.display='none'; });

async function openModal(id) {
  // simple guard for id missing: allow search results where id may be title
  if (!id) { alert('Item has no id'); return; }
  // If id looks like a long numeric from Gifted, call /api/info/:id
  const info = await fetchJSON(\`\${API_BASE}/api/info/\${encodeURIComponent(id)}\`);
  if (!info) {
    alert('Failed to load info');
    return;
  }
  currentItem = info;
  modalTitle.textContent = info.title || info.name || 'Untitled';
  modalPoster.src = info.cover || info.poster || info.image || '';
  modalDesc.textContent = info.description || info.overview || info.plot || '';
  modalMeta.innerHTML = \`<div class="small">Release: \${info.release_date || info.year || ''} • Genre: \${(info.genre && info.genre.join ? info.genre.join(', ') : info.genre) || ''} • IMDB: \${info.imdb || info.imdb_rating || info.rating || 'N/A'}</div>\`;
  // get sources
  const src = await fetchJSON(\`\${API_BASE}/api/sources/\${encodeURIComponent(id)}\`);
  // normalize sources
  if (!src) currentSources = [];
  else if (Array.isArray(src)) currentSources = src;
  else if (src.sources) currentSources = src.sources;
  else if (typeof src === 'string') currentSources = [{file:src}];
  else currentSources = [];

  // build quality buttons
  qualityBtns.innerHTML = '';
  const qualities = [...new Set((currentSources.map(s=> s.label || s.quality || (s.file && (s.file.match(/(360|480|720|1080)/) || [''])[0]))).filter(Boolean))];
  // default fallback qualities
  const fallbacks = qualities.length ? qualities : ['720','480','360'];
  for (let q of fallbacks) {
    const b = document.createElement('button');
    b.className='pill';
    b.textContent = q;
    b.addEventListener('click', ()=> { selectedQuality=q; highlightQualityButtons(q); });
    qualityBtns.appendChild(b);
  }
  selectedQuality = fallbacks[0];
  highlightQualityButtons(selectedQuality);

  // set up play/download/fav
  playBtn.onclick = () => startStream(id, selectedQuality);
  downloadBtn.onclick = () => startDownload(id, selectedQuality);
  favBtn.onclick = () => toggleFavorite(info);

  // open
  modalRoot.style.display='flex';
  playerArea.style.display='none';
}

function highlightQualityButtons(q) {
  for (let b of qualityBtns.children) {
    if (b.textContent===q) { b.style.borderColor='var(--accent)'; b.style.transform='scale(1.03)'; }
    else { b.style.borderColor='rgba(255,255,255,0.03)'; b.style.transform='none'; }
  }
}

/* stream: sets video src to /stream/:id?quality=... which the server proxies with Range support */
function startStream(id, quality) {
  if (!getCookie('age_verified') || getCookie('age_verified') !== '1') {
    alert('Please confirm age first.');
    document.getElementById('ageModal').style.display = 'flex';
    return;
  }
  const url = \`\${API_BASE}/stream/\${encodeURIComponent(id)}?quality=\${encodeURIComponent(quality)}\`;
  playerArea.style.display = 'block';
  player.src = url;
  player.play().catch(e => console.warn('autoplay prevented', e));
  // register this media for offline caching by trying to fetch it (service worker will cache it)
  try {
    fetch(url).then(r => {
      // success will be cached by service worker
    });
  } catch (e) {}
}

/* download: redirects to /download/:id which forces attachment via proxy */
function startDownload(id, quality) {
  if (!getCookie('age_verified') || getCookie('age_verified') !== '1') {
    alert('Please confirm age first.');
    document.getElementById('ageModal').style.display = 'flex';
    return;
  }
  const url = \`\${API_BASE}/download/\${encodeURIComponent(id)}?quality=\${encodeURIComponent(quality)}\`;
  // open in new tab so browser handles download
  window.open(url, '_blank');
  // save as favorite optional, etc.
}

/* favorites: localStorage */
function toggleFavorite(item) {
  const key = 'cloud_favs_v1';
  let favs = JSON.parse(localStorage.getItem(key) || '[]');
  const id = item.id || item._id || item.title;
  const idx = favs.findIndex(x=> x.id === id);
  if (idx >= 0) {
    favs.splice(idx,1);
    favBtn.textContent = '♡ Favorite';
  } else {
    favs.push({ id, title: item.title, poster: item.cover || item.poster || item.image });
    favBtn.textContent = '♥ Favorited';
  }
  localStorage.setItem(key, JSON.stringify(favs));
}
document.getElementById('favoritesBtn').addEventListener('click', () => {
  const favs = JSON.parse(localStorage.getItem('cloud_favs_v1') || '[]');
  if (favs.length === 0) return alert('No favorites yet');
  // show a simple list
  const list = favs.map(f => \`\${f.title}\`).join('\\n');
  alert('Favorites:\\n' + list);
});

/* theme toggle (light/dark) */
const themeToggle = document.getElementById('themeToggle');
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const themeKey = 'cloud_theme_v1';
let theme = localStorage.getItem(themeKey) || (prefersDark ? 'dark' : 'dark'); // default dark
applyTheme(theme);
themeToggle.addEventListener('click', () => {
  theme = (theme === 'dark') ? 'light' : 'dark';
  localStorage.setItem(themeKey, theme);
  applyTheme(theme);
});
function applyTheme(t) {
  if (t === 'light') {
    document.documentElement.style.setProperty('--bg','#f7f8fa');
    document.documentElement.style.setProperty('--card','#ffffff');
    document.documentElement.style.setProperty('--text','#0b1020');
    document.documentElement.style.setProperty('--muted','#556176');
    document.documentElement.style.setProperty('--accent','#ff4b3a');
  } else {
    document.documentElement.style.removeProperty('--bg');
    document.documentElement.style.removeProperty('--card');
    document.documentElement.style.removeProperty('--text');
    document.documentElement.style.removeProperty('--muted');
    document.documentElement.style.removeProperty('--accent');
  }
}

/* PWA install prompt handling */
let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
});
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    console.log('User accepted install');
  } else {
    console.log('User dismissed install');
  }
  deferredPrompt = null;
  installBtn.style.display = 'none';
});

/* register service worker */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    console.log('SW registered', reg);
  }).catch(err => console.warn('SW failed', err));
}

/* auto-load home */
loadHome();
</script>
</body>
</html>
`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

/* -----------------------------
   Start server
   ----------------------------- */
app.listen(PORT, () => {
  console.log(`CLOUD. MOVIES (Bera Tech) running on http://localhost:${PORT}`);
  console.log('Serving single-file PWA + Gifted Movies API proxy');
});
