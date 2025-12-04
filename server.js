// =====================
// BERA TECH - CLOUD.MOVIES
// Single-file PWA Movie Streaming App
// Using Gifted Movies API
// =====================

const express = require("express");
const axios = require("axios");
const compression = require("compression");
const helmet = require("helmet");
const path = require("path");

const app = express();
app.use(helmet());
app.use(compression());
app.use(express.json());

// ---------------- API ROUTES ----------------

// SEARCH MOVIES
app.get("/api/search", async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing ?q=" });

    const url = `https://movieapi.giftedtech.co.ke/api/search/${encodeURIComponent(q)}`;
    const response = await axios.get(url);

    res.json(response.data);
  } catch (err) {
    console.error("Search Error:", err.message);
    res.status(500).json({ error: "Failed to fetch movies." });
  }
});

// MOVIE INFO
app.get("/api/info/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const url = `https://movieapi.giftedtech.co.ke/api/info/${id}`;
    const response = await axios.get(url);

    res.json(response.data);
  } catch (err) {
    console.error("Movie Info Error:", err.message);
    res.status(500).json({ error: "Failed to fetch movie info." });
  }
});

// SOURCES (STREAMING LINKS)
app.get("/api/sources/:id", async (req, res) => {
  try {
    const id = req.params.id;

    let url = `https://movieapi.giftedtech.co.ke/api/sources/${id}`;

    const response = await axios.get(url);

    res.json(response.data);
  } catch (err) {
    console.error("Sources Error:", err.message);
    res.status(500).json({ error: "Failed to fetch sources." });
  }
});

// ---------------- FRONTEND ----------------
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>CLOUD.MOVIES – Bera Tech</title>
<meta name="viewport" content="width=device-width, initial-scale=1">

<style>
  body { margin:0; background:#0b0b0b; color:white; font-family:Arial; }
  header { padding:15px; background:#111; position:sticky; top:0; z-index:10; display:flex; justify-content:space-between; align-items:center; }
  h1 { margin:0; color:#ff2a2a; font-size:24px; }
  #searchBox { width:90%; padding:12px; border-radius:8px; border:none; font-size:16px; margin:10px auto; display:block; }
  #results { padding:10px; display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .movie { background:#1a1a1a; padding:10px; border-radius:10px; text-align:center; cursor:pointer; transition:0.3s; }
  .movie:hover { transform:scale(1.03); }
  .movie img { width:100%; border-radius:8px; }

  #detailsPage { padding:20px; display:none; }
  #backBtn { background:#ff2a2a; padding:10px; border:none; color:white; border-radius:6px; margin-bottom:15px; }

  video { width:100%; margin-top:20px; border-radius:10px; }
</style>

</head>
<body>

<header>
  <h1>CLOUD.MOVIES</h1>
</header>

<input id="searchBox" placeholder="Search movies...">

<div id="results"></div>

<div id="detailsPage">
  <button id="backBtn">← Back</button>
  <div id="detailsContent"></div>
</div>

<script>
// SEARCH MOVIES LIVE
document.getElementById("searchBox").addEventListener("keyup", async function() {
  const q = this.value.trim();
  if (!q) return (document.getElementById("results").innerHTML = "");

  const res = await fetch("/api/search?q=" + q);
  const data = await res.json();

  const container = document.getElementById("results");
  container.innerHTML = "";

  if (!data.results || !data.results.items) return;

  data.results.items.forEach(movie => {
    const div = document.createElement("div");
    div.className = "movie";
    div.innerHTML = \`
      <img src="\${movie.poster}" />
      <h3>\${movie.title}</h3>
    \`;

    div.onclick = () => openDetails(movie.id);
    container.appendChild(div);
  });
});

// OPEN MOVIE DETAILS
async function openDetails(id) {
  document.getElementById("results").style.display = "none";
  document.getElementById("detailsPage").style.display = "block";

  const res = await fetch("/api/info/" + id);
  const info = await res.json();

  const srcRes = await fetch("/api/sources/" + id);
  const sources = await srcRes.json();

  let videoSources = "";

  if (sources.sources) {
    sources.sources.forEach(s => {
      videoSources += \`
        <p>
          <a href="\${s.url}" style="color:#ff2a2a" download>Download \${s.quality}</a>
        </p>
      \`;
    });
  }

  document.getElementById("detailsContent").innerHTML = \`
    <h2>\${info.title}</h2>
    <p>\${info.description}</p>
    <img src="\${info.poster}" style="width:100%; border-radius:10px; margin-top:10px;" />
    <h3 style="margin-top:20px;">Download Options:</h3>
    \${videoSources}
  \`;
}

document.getElementById("backBtn").onclick = () => {
  document.getElementById("detailsPage").style.display = "none";
  document.getElementById("results").style.display = "grid";
};
</script>

</body>
</html>
  `);
});

app.listen(PORT, () => console.log("CLOUD.MOVIES running on port " + PORT));
