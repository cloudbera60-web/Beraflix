const express = require('express');
const axios = require('axios');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');
const cheerio = require('cheerio');
const NodeCache = require('memory-cache');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      mediaSrc: ["'self'", "https:", "http:"],
      connectSrc: ["'self'", "https://movieapi.giftedtech.co.ke"]
    }
  }
}));

app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Constants from the official API documentation
const API_BASE = 'https://movieapi.giftedtech.co.ke/api';
const CDN_BASE = 'https://pacdn.aoneroom.com';

// Cache configuration
const cache = new NodeCache.Cache({ stdTTL: 300, checkperiod: 60 });

// Utility functions
async function fetchWithRetry(url, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://h5.aoneroom.com/'
        },
        timeout: 10000
      });
      return response.data;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
}

async function fetchWithPuppeteer(url) {
  let browser = null;
  try {
    const executablePath = await chromium.executablePath || process.env.CHROME_PATH;
    
    browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless ? 'new' : false,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept': 'application/json, text/html, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://h5.aoneroom.com/'
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const content = await page.content();
    const $ = cheerio.load(content);
    
    // Try to extract JSON from script tags or body
    let jsonData = null;
    const scripts = $('script');
    
    for (const script of scripts) {
      const scriptContent = $(script).html();
      if (scriptContent && (scriptContent.includes('window.__NUXT__') || scriptContent.includes('{"status":'))) {
        try {
          const jsonMatch = scriptContent.match(/({.*})/s);
          if (jsonMatch) {
            jsonData = JSON.parse(jsonMatch[1]);
            break;
          }
        } catch (e) {
          console.log('Failed to parse script content');
        }
      }
    }

    if (!jsonData) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      try {
        jsonData = JSON.parse(bodyText);
      } catch (e) {
        throw new Error('Could not extract JSON data');
      }
    }

    return jsonData;
  } finally {
    if (browser) await browser.close();
  }
}

async function fetchAPI(endpoint, useCache = true) {
  const cacheKey = `api_${endpoint}`;
  
  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  try {
    const url = `${API_BASE}${endpoint}`;
    let data = await fetchWithRetry(url);
    
    // Validate API response structure
    if (data && data.status === 200 && data.success === "true") {
      if (useCache) {
        cache.put(cacheKey, data);
      }
      return data;
    } else {
      throw new Error('Invalid API response');
    }
  } catch (error) {
    console.log(`Direct API call failed, trying puppeteer: ${error.message}`);
    
    try {
      const url = `${API_BASE}${endpoint}`;
      const data = await fetchWithPuppeteer(url);
      
      if (data && data.status === 200) {
        if (useCache) {
          cache.put(cacheKey, data);
        }
        return data;
      }
    } catch (puppeteerError) {
      console.error('Puppeteer also failed:', puppeteerError.message);
      throw new Error(`Failed to fetch ${endpoint}`);
    }
  }
}

// HTML Template with professional design
function generateHTML(content, title = 'Beraflix', currentPage = 'home') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta name="theme-color" content="#0a0a0a">
    <title>${title} | Professional Streaming</title>
    
    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        :root {
            --primary: #0a0a0a;
            --secondary: #1a1a1a;
            --accent: #e50914;
            --accent-hover: #f40612;
            --text-primary: #ffffff;
            --text-secondary: #b3b3b3;
            --text-tertiary: #808080;
            --success: #2ecc71;
            --warning: #f39c12;
            --card-bg: #181818;
            --card-hover: #282828;
            --border: #333333;
            --shadow: rgba(0, 0, 0, 0.5);
            --gradient: linear-gradient(135deg, #e50914 0%, #b00710 100%);
            --gradient-secondary: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
            --radius-sm: 4px;
            --radius-md: 8px;
            --radius-lg: 12px;
            --radius-xl: 20px;
            --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-tap-highlight-color: transparent;
        }

        body {
            background: var(--primary);
            color: var(--text-primary);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            overflow-x: hidden;
            min-height: 100vh;
            padding-bottom: 80px;
        }

        /* Header */
        .header {
            background: var(--gradient-secondary);
            padding: 1rem 1.5rem;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            display: flex;
            justify-content: space-between;
            align-items: center;
            backdrop-filter: blur(10px);
            border-bottom: 1px solid var(--border);
            box-shadow: 0 4px 20px var(--shadow);
        }

        .logo {
            font-family: 'Poppins', sans-serif;
            font-size: 2rem;
            font-weight: 800;
            background: var(--gradient);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            letter-spacing: -0.5px;
        }

        .logo-sub {
            font-size: 0.75rem;
            font-weight: 500;
            color: var(--text-secondary);
            margin-left: 0.5rem;
        }

        /* Main Container */
        .main-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 1rem;
        }

        /* Hero Section */
        .hero-section {
            margin-top: 80px;
            margin-bottom: 2rem;
            position: relative;
            overflow: hidden;
            border-radius: var(--radius-xl);
            min-height: 400px;
            background: linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%);
        }

        .hero-bg {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-size: cover;
            background-position: center;
            opacity: 0.4;
        }

        .hero-content {
            position: relative;
            z-index: 2;
            padding: 3rem;
            max-width: 600px;
        }

        .hero-title {
            font-size: 3rem;
            font-weight: 800;
            margin-bottom: 1rem;
            line-height: 1.1;
        }

        .hero-description {
            font-size: 1.1rem;
            color: var(--text-secondary);
            margin-bottom: 2rem;
        }

        .hero-actions {
            display: flex;
            gap: 1rem;
        }

        /* Buttons */
        .btn {
            padding: 0.875rem 1.5rem;
            border: none;
            border-radius: var(--radius-md);
            font-family: 'Inter', sans-serif;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: var(--transition);
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            text-decoration: none;
        }

        .btn-primary {
            background: var(--gradient);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(229, 9, 20, 0.3);
        }

        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            backdrop-filter: blur(10px);
        }

        .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
            transform: translateY(-2px);
        }

        .btn-play {
            background: var(--accent);
            color: white;
            border-radius: 50%;
            width: 56px;
            height: 56px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
        }

        .btn-play:hover {
            background: var(--accent-hover);
            transform: scale(1.1);
        }

        /* Section Headers */
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 2rem 0 1rem 0;
        }

        .section-title {
            font-size: 1.5rem;
            font-weight: 700;
        }

        .view-all {
            color: var(--accent);
            text-decoration: none;
            font-weight: 500;
            transition: var(--transition);
        }

        .view-all:hover {
            color: var(--accent-hover);
        }

        /* Grid Layout */
        .content-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        @media (max-width: 768px) {
            .content-grid {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 1rem;
            }
        }

        /* Movie Card */
        .movie-card {
            background: var(--card-bg);
            border-radius: var(--radius-lg);
            overflow: hidden;
            transition: var(--transition);
            position: relative;
            cursor: pointer;
            border: 1px solid transparent;
        }

        .movie-card:hover {
            transform: translateY(-8px);
            border-color: var(--border);
            box-shadow: 0 12px 30px var(--shadow);
        }

        .movie-card:hover .movie-poster {
            transform: scale(1.05);
        }

        .movie-poster {
            width: 100%;
            height: 300px;
            object-fit: cover;
            transition: var(--transition);
            background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
        }

        .movie-info {
            padding: 1rem;
        }

        .movie-title {
            font-weight: 600;
            font-size: 1rem;
            margin-bottom: 0.25rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .movie-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--text-tertiary);
            font-size: 0.875rem;
        }

        .movie-rating {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            color: var(--warning);
        }

        .quality-badge {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: var(--gradient);
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: var(--radius-sm);
            font-size: 0.75rem;
            font-weight: 600;
        }

        /* Detail View */
        .detail-container {
            margin-top: 80px;
            padding: 2rem 0;
        }

        .detail-hero {
            position: relative;
            min-height: 500px;
            border-radius: var(--radius-xl);
            overflow: hidden;
            margin-bottom: 2rem;
        }

        .detail-backdrop {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: brightness(0.3);
        }

        .detail-content {
            position: relative;
            z-index: 2;
            padding: 2rem;
        }

        .detail-header {
            display: flex;
            gap: 2rem;
            margin-bottom: 2rem;
        }

        @media (max-width: 768px) {
            .detail-header {
                flex-direction: column;
            }
        }

        .detail-poster {
            width: 300px;
            height: 450px;
            border-radius: var(--radius-lg);
            object-fit: cover;
            box-shadow: 0 20px 40px var(--shadow);
        }

        .detail-info {
            flex: 1;
        }

        .detail-title {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            line-height: 1.1;
        }

        .detail-tagline {
            font-size: 1.25rem;
            color: var(--text-secondary);
            margin-bottom: 1rem;
            font-style: italic;
        }

        .detail-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 2rem;
            align-items: center;
        }

        .meta-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: var(--text-tertiary);
        }

        .genre-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin: 1rem 0;
        }

        .genre-tag {
            background: rgba(255, 255, 255, 0.1);
            padding: 0.5rem 1rem;
            border-radius: var(--radius-md);
            font-size: 0.875rem;
            color: var(--text-secondary);
        }

        .detail-overview {
            font-size: 1.125rem;
            line-height: 1.7;
            color: var(--text-secondary);
            margin-bottom: 2rem;
        }

        /* Cast Section */
        .cast-scroll {
            display: flex;
            overflow-x: auto;
            gap: 1rem;
            padding: 1rem 0;
            scrollbar-width: thin;
        }

        .cast-card {
            min-width: 120px;
            text-align: center;
        }

        .cast-avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 0.5rem;
            border: 2px solid var(--border);
        }

        .cast-name {
            font-weight: 500;
            font-size: 0.875rem;
        }

        .cast-character {
            font-size: 0.75rem;
            color: var(--text-tertiary);
        }

        /* Quality Selector */
        .quality-selector {
            background: var(--card-bg);
            border-radius: var(--radius-lg);
            padding: 1.5rem;
            margin: 2rem 0;
        }

        .quality-options {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
        }

        .quality-option {
            background: var(--secondary);
            padding: 1rem;
            border-radius: var(--radius-md);
            border: 1px solid var(--border);
            cursor: pointer;
            transition: var(--transition);
        }

        .quality-option:hover {
            border-color: var(--accent);
            transform: translateY(-2px);
        }

        .quality-option.selected {
            border-color: var(--accent);
            background: rgba(229, 9, 20, 0.1);
        }

        .quality-label {
            font-weight: 600;
            margin-bottom: 0.5rem;
        }

        .quality-size {
            color: var(--text-tertiary);
            font-size: 0.875rem;
        }

        /* Bottom Navigation */
        .bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--gradient-secondary);
            backdrop-filter: blur(20px);
            display: flex;
            justify-content: space-around;
            padding: 0.75rem 0;
            border-top: 1px solid var(--border);
            z-index: 1000;
        }

        .nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            color: var(--text-tertiary);
            text-decoration: none;
            transition: var(--transition);
            padding: 0.5rem;
            border-radius: var(--radius-md);
            min-width: 70px;
        }

        .nav-item.active {
            color: var(--accent);
            background: rgba(229, 9, 20, 0.1);
        }

        .nav-icon {
            font-size: 1.25rem;
            margin-bottom: 0.25rem;
        }

        .nav-label {
            font-size: 0.75rem;
            font-weight: 500;
        }

        /* Search */
        .search-container {
            position: relative;
            margin: 1rem 0;
        }

        .search-input {
            width: 100%;
            padding: 0.875rem 1rem 0.875rem 3rem;
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: var(--radius-md);
            color: var(--text-primary);
            font-size: 1rem;
            transition: var(--transition);
        }

        .search-input:focus {
            outline: none;
            border-color: var(--accent);
            box-shadow: 0 0 0 2px rgba(229, 9, 20, 0.2);
        }

        .search-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-tertiary);
        }

        /* Loading States */
        .skeleton {
            background: linear-gradient(90deg, 
                var(--card-bg) 25%, 
                var(--secondary) 50%, 
                var(--card-bg) 75%);
            background-size: 200% 100%;
            animation: loading 1.5s infinite;
            border-radius: var(--radius-md);
        }

        @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }

        .skeleton-card {
            height: 300px;
        }

        .skeleton-title {
            height: 20px;
            width: 70%;
            margin: 1rem 0 0.5rem 0;
        }

        .skeleton-text {
            height: 15px;
            width: 50%;
        }

        /* Video Player */
        .video-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 2000;
            display: none;
            align-items: center;
            justify-content: center;
        }

        .video-container {
            width: 90%;
            max-width: 1200px;
            position: relative;
        }

        .video-player {
            width: 100%;
            border-radius: var(--radius-lg);
            overflow: hidden;
        }

        .close-video {
            position: absolute;
            top: -2.5rem;
            right: 0;
            background: var(--card-bg);
            color: white;
            border: none;
            border-radius: 50%;
            width: 2.5rem;
            height: 2.5rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.25rem;
            transition: var(--transition);
        }

        .close-video:hover {
            background: var(--accent);
        }

        /* Toast Notifications */
        .toast {
            position: fixed;
            top: 1rem;
            right: 1rem;
            background: var(--gradient);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: var(--radius-md);
            box-shadow: 0 4px 20px var(--shadow);
            z-index: 3000;
            display: none;
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        /* Responsive */
        @media (max-width: 768px) {
            .hero-title {
                font-size: 2rem;
            }
            
            .detail-title {
                font-size: 1.75rem;
            }
            
            .detail-poster {
                width: 100%;
                height: auto;
                max-height: 400px;
            }
        }

        /* Scrollbar */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        ::-webkit-scrollbar-track {
            background: var(--secondary);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--text-tertiary);
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="logo">BERAFLIX</div>
            <span class="logo-sub">Professional Streaming</span>
        </div>
        <div class="search-container" style="width: 300px;">
            <i class="fas fa-search search-icon"></i>
            <input type="text" 
                   class="search-input" 
                   placeholder="Search movies and series..." 
                   id="searchInput"
                   oninput="performSearch(this.value)">
        </div>
    </div>

    <div class="toast" id="toast"></div>

    <div class="video-overlay" id="videoOverlay">
        <div class="video-container">
            <button class="close-video" onclick="closeVideo()">
                <i class="fas fa-times"></i>
            </button>
            <video class="video-player" id="videoPlayer" controls>
                Your browser does not support the video tag.
            </video>
        </div>
    </div>

    <div class="main-container" id="content">
        ${content}
    </div>

    <div class="bottom-nav">
        <a href="/" class="nav-item ${currentPage === 'home' ? 'active' : ''}" onclick="navigate(event, '/')">
            <i class="fas fa-home nav-icon"></i>
            <span class="nav-label">Home</span>
        </a>
        <a href="/movies" class="nav-item ${currentPage === 'movies' ? 'active' : ''}" onclick="navigate(event, '/movies')">
            <i class="fas fa-film nav-icon"></i>
            <span class="nav-label">Movies</span>
        </a>
        <a href="/series" class="nav-item ${currentPage === 'series' ? 'active' : ''}" onclick="navigate(event, '/series')">
            <i class="fas fa-tv nav-icon"></i>
            <span class="nav-label">Series</span>
        </a>
        <a href="/trending" class="nav-item ${currentPage === 'trending' ? 'active' : ''}" onclick="navigate(event, '/trending')">
            <i class="fas fa-fire nav-icon"></i>
            <span class="nav-label">Trending</span>
        </a>
    </div>

    <script>
        // Global state
        let currentPage = '${currentPage}';
        let isLoading = false;
        let searchTimeout = null;
        
        // Navigation
        async function navigate(event, path) {
            event.preventDefault();
            if (isLoading) return;
            
            isLoading = true;
            showLoading();
            
            try {
                const response = await fetch(path);
                const html = await response.text();
                document.querySelector('html').innerHTML = html;
            } catch (error) {
                showToast('Error loading page', 'error');
            } finally {
                isLoading = false;
            }
        }
        
        // Search
        function performSearch(query) {
            clearTimeout(searchTimeout);
            if (query.trim().length < 2) return;
            
            searchTimeout = setTimeout(async () => {
                showLoading();
                try {
                    const response = await fetch(\`/search?q=\${encodeURIComponent(query)}\`);
                    const html = await response.text();
                    document.getElementById('content').innerHTML = html;
                    initPage();
                } catch (error) {
                    showToast('Search failed', 'error');
                }
            }, 500);
        }
        
        // Video Player
        function playVideo(videoUrl, title) {
            const player = document.getElementById('videoPlayer');
            const overlay = document.getElementById('videoOverlay');
            
            player.src = videoUrl;
            player.play();
            overlay.style.display = 'flex';
            document.title = \`\${title} - Beraflix\`;
        }
        
        function closeVideo() {
            const player = document.getElementById('videoPlayer');
            const overlay = document.getElementById('videoOverlay');
            
            player.pause();
            player.src = '';
            overlay.style.display = 'none';
        }
        
        // Download
        function downloadFile(url, filename) {
            showToast('Starting download...');
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'beraflix-download.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        
        // Toast Notifications
        function showToast(message, type = 'info') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.style.display = 'block';
            
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }
        
        // Loading
        function showLoading() {
            const content = document.getElementById('content');
            content.innerHTML = \`
                <div class="content-grid">
                    \${Array(12).fill().map(() => \`
                        <div class="skeleton skeleton-card"></div>
                    \`).join('')}
                </div>
            \`;
        }
        
        // Initialize quality selector
        function initQualitySelector() {
            document.querySelectorAll('.quality-option').forEach(option => {
                option.addEventListener('click', function() {
                    document.querySelectorAll('.quality-option').forEach(o => {
                        o.classList.remove('selected');
                    });
                    this.classList.add('selected');
                    
                    const url = this.dataset.url;
                    const size = this.dataset.size;
                    const title = this.dataset.title;
                    
                    // Update play button
                    const playBtn = document.querySelector('.btn-play');
                    if (playBtn) {
                        playBtn.dataset.url = url;
                        playBtn.dataset.title = title;
                    }
                    
                    // Update download button
                    const downloadBtn = document.querySelector('.btn-download');
                    if (downloadBtn) {
                        downloadBtn.dataset.url = url;
                        downloadBtn.dataset.filename = \`\${title.replace(/[^a-z0-9]/gi, '_')}_\${this.dataset.quality}.mp4\`;
                    }
                });
            });
        }
        
        // Initialize page
        function initPage() {
            // Add click handlers to movie cards
            document.querySelectorAll('.movie-card').forEach(card => {
                card.addEventListener('click', function() {
                    const id = this.dataset.id;
                    const type = this.dataset.type;
                    if (id && type) {
                        navigate(new Event('click'), \`/\${type}/\${id}\`);
                    }
                });
            });
            
            // Initialize quality selector
            initQualitySelector();
            
            // Add play button handlers
            document.querySelectorAll('.btn-play').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const url = this.dataset.url;
                    const title = this.dataset.title;
                    if (url) {
                        playVideo(url, title);
                    }
                });
            });
            
            // Add download button handlers
            document.querySelectorAll('.btn-download').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const url = this.dataset.url;
                    const filename = this.dataset.filename;
                    if (url) {
                        downloadFile(url, filename);
                    }
                });
            });
            
            // Add season selector handlers
            document.querySelectorAll('.season-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const season = this.dataset.season;
                    loadSeason(season);
                });
            });
        }
        
        // Initialize on load
        document.addEventListener('DOMContentLoaded', initPage);
    </script>
</body>
</html>`;
}

// Routes
app.get('/', async (req, res) => {
    try {
        // Fetch trending content
        const trendingData = await fetchAPI('/search/trending');
        
        // Fetch popular movies
        const popularMovies = await fetchAPI('/search/popular');
        
        // Fetch new releases
        const newReleases = await fetchAPI('/search/latest');

        let heroContent = '';
        if (trendingData?.results?.items?.[0]) {
            const heroItem = trendingData.results.items[0];
            heroContent = `
                <div class="hero-section">
                    <div class="hero-bg" style="background-image: url('${heroItem.cover?.url || ''}')"></div>
                    <div class="hero-content">
                        <h1 class="hero-title">${heroItem.title}</h1>
                        <p class="hero-description">${heroItem.description || 'Now streaming on Beraflix'}</p>
                        <div class="hero-actions">
                            <button class="btn btn-primary" onclick="navigate(event, '/movie/${heroItem.subjectId}')">
                                <i class="fas fa-play"></i> Play Now
                            </button>
                            <button class="btn btn-secondary" onclick="navigate(event, '/movie/${heroItem.subjectId}')">
                                <i class="fas fa-info-circle"></i> More Info
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        const renderSection = (title, items, type = 'movie') => {
            if (!items || items.length === 0) return '';
            
            return `
                <div class="section-header">
                    <h2 class="section-title">${title}</h2>
                    <a href="/${type}" class="view-all">View All</a>
                </div>
                <div class="content-grid">
                    ${items.slice(0, 12).map(item => `
                        <div class="movie-card" data-id="${item.subjectId}" data-type="${item.subjectType === 2 ? 'series' : 'movie'}">
                            ${item.cover?.url ? `
                                <img src="${item.cover.url}" 
                                     alt="${item.title}" 
                                     class="movie-poster"
                                     onerror="this.src='https://via.placeholder.com/300x450/181818/ffffff?text=NO+IMAGE'">
                            ` : `
                                <div class="movie-poster skeleton"></div>
                            `}
                            <div class="quality-badge">${item.subjectType === 2 ? 'SERIES' : 'HD'}</div>
                            <div class="movie-info">
                                <div class="movie-title">${item.title}</div>
                                <div class="movie-meta">
                                    <span>${item.releaseDate?.split('-')[0] || 'N/A'}</span>
                                    <div class="movie-rating">
                                        <i class="fas fa-star"></i>
                                        <span>${item.imdbRatingValue || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        const content = `
            ${heroContent}
            
            ${trendingData?.results?.items ? 
                renderSection('Trending Now', trendingData.results.items) : 
                '<div class="section-header"><h2 class="section-title">Trending Now</h2></div>' + 
                '<div class="content-grid">' + 
                Array(6).fill().map(() => `
                    <div class="skeleton skeleton-card"></div>
                `).join('') + '</div>'}
            
            ${popularMovies?.results?.items ? 
                renderSection('Popular Movies', popularMovies.results.items) : 
                '<div class="section-header"><h2 class="section-title">Popular Movies</h2></div>' + 
                '<div class="content-grid">' + 
                Array(6).fill().map(() => `
                    <div class="skeleton skeleton-card"></div>
                `).join('') + '</div>'}
            
            ${newReleases?.results?.items ? 
                renderSection('New Releases', newReleases.results.items) : 
                '<div class="section-header"><h2 class="section-title">New Releases</h2></div>' + 
                '<div class="content-grid">' + 
                Array(6).fill().map(() => `
                    <div class="skeleton skeleton-card"></div>
                `).join('') + '</div>'}
        `;

        res.send(generateHTML(content, 'Beraflix - Home', 'home'));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h1 style="color: var(--accent); margin-bottom: 20px;">Welcome to Beraflix</h1>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Professional streaming platform powered by Gifted Movies API
                </p>
                <div style="display: flex; gap: 1rem; justify-content: center;">
                    <button class="btn btn-primary" onclick="navigate(event, '/movies')">
                        Browse Movies
                    </button>
                    <button class="btn btn-secondary" onclick="navigate(event, '/series')">
                        Browse Series
                    </button>
                </div>
            </div>
        `, 'Beraflix - Home', 'home'));
    }
});

app.get('/movie/:id', async (req, res) => {
    try {
        const movieId = req.params.id;
        
        // Fetch movie info
        const infoData = await fetchAPI(`/info/${movieId}`);
        if (!infoData?.results?.subject) {
            throw new Error('Movie not found');
        }
        
        // Fetch download sources
        const sourcesData = await fetchAPI(`/sources/${movieId}`);
        
        const movie = infoData.results.subject;
        const sources = sourcesData?.results || [];
        
        const content = `
            <div class="detail-container">
                <div class="detail-hero">
                    <img src="${movie.cover?.url || ''}" 
                         alt="${movie.title}" 
                         class="detail-backdrop"
                         onerror="this.style.display='none'">
                    <div class="detail-content">
                        <div class="detail-header">
                            <img src="${movie.cover?.url || ''}" 
                                 alt="${movie.title}" 
                                 class="detail-poster"
                                 onerror="this.src='https://via.placeholder.com/300x450/181818/ffffff?text=NO+IMAGE'">
                            <div class="detail-info">
                                <h1 class="detail-title">${movie.title}</h1>
                                ${movie.postTitle ? `<p class="detail-tagline">${movie.postTitle}</p>` : ''}
                                
                                <div class="detail-meta">
                                    <span class="meta-item">
                                        <i class="fas fa-star" style="color: var(--warning);"></i>
                                        ${movie.imdbRatingValue || 'N/A'} (${movie.imdbRatingCount ? 
                                            (parseInt(movie.imdbRatingCount) / 1000).toFixed(1) + 'K' : '0'})
                                    </span>
                                    <span class="meta-item">
                                        <i class="fas fa-calendar"></i>
                                        ${movie.releaseDate || 'N/A'}
                                    </span>
                                    <span class="meta-item">
                                        <i class="fas fa-clock"></i>
                                        ${movie.duration ? Math.floor(movie.duration / 60) + ' min' : 'N/A'}
                                    </span>
                                    <span class="meta-item">
                                        <i class="fas fa-globe"></i>
                                        ${movie.countryName || 'N/A'}
                                    </span>
                                </div>
                                
                                <div class="genre-list">
                                    ${movie.genre ? movie.genre.split(',').map(genre => `
                                        <span class="genre-tag">${genre.trim()}</span>
                                    `).join('') : ''}
                                </div>
                                
                                <p class="detail-overview">
                                    ${movie.description || 'No description available.'}
                                </p>
                                
                                <div class="hero-actions">
                                    ${sources.length > 0 ? `
                                        <button class="btn btn-primary btn-play" 
                                                data-url="${sources[0].download_url}"
                                                data-title="${movie.title}">
                                            <i class="fas fa-play"></i> Play Now
                                        </button>
                                        <button class="btn btn-secondary btn-download"
                                                data-url="${sources[0].download_url}"
                                                data-filename="${movie.title.replace(/[^a-z0-9]/gi, '_')}.mp4">
                                            <i class="fas fa-download"></i> Download
                                        </button>
                                    ` : `
                                        <button class="btn btn-secondary" disabled>
                                            <i class="fas fa-info-circle"></i> No Sources Available
                                        </button>
                                    `}
                                </div>
                            </div>
                        </div>
                        
                        ${infoData.results.stars?.length > 0 ? `
                            <div class="section-header">
                                <h2 class="section-title">Cast</h2>
                            </div>
                            <div class="cast-scroll">
                                ${infoData.results.stars.slice(0, 10).map(star => `
                                    <div class="cast-card">
                                        <img src="${star.avatarUrl || ''}" 
                                             alt="${star.name}" 
                                             class="cast-avatar"
                                             onerror="this.src='https://via.placeholder.com/80/2a2a2a/ffffff?text=NO+IMAGE'">
                                        <div class="cast-name">${star.name}</div>
                                        <div class="cast-character">${star.character}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        
                        ${sources.length > 0 ? `
                            <div class="quality-selector">
                                <div class="section-header">
                                    <h2 class="section-title">Available Qualities</h2>
                                </div>
                                <div class="quality-options">
                                    ${sources.map(source => `
                                        <div class="quality-option ${source.quality === '720p' ? 'selected' : ''}"
                                             data-quality="${source.quality}"
                                             data-url="${source.download_url}"
                                             data-size="${formatFileSize(source.size)}"
                                             data-title="${movie.title}">
                                            <div class="quality-label">${source.quality}</div>
                                            <div class="quality-size">${formatFileSize(source.size)} • ${source.format}</div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <script>
                function formatFileSize(bytes) {
                    if (!bytes) return 'Unknown size';
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
                }
            </script>
        `;
        
        res.send(generateHTML(content, `${movie.title} - Beraflix`, 'movies'));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h1 style="color: var(--accent); margin-bottom: 20px;">Movie Not Found</h1>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    The requested movie could not be found or is currently unavailable.
                </p>
                <button class="btn btn-primary" onclick="navigate(event, '/')">
                    Back to Home
                </button>
            </div>
        `, 'Movie Not Found - Beraflix', 'movies'));
    }
});

app.get('/series/:id', async (req, res) => {
    try {
        const seriesId = req.params.id;
        const season = req.query.season || 1;
        
        // Fetch series info
        const infoData = await fetchAPI(`/info/${seriesId}`);
        if (!infoData?.results?.subject) {
            throw new Error('Series not found');
        }
        
        const series = infoData.results.subject;
        
        // Fetch episodes for the season
        let episodes = [];
        try {
            const sourcesData = await fetchAPI(`/sources/${seriesId}?season=${season}`);
            episodes = sourcesData?.results || [];
        } catch (error) {
            console.log('Could not fetch episodes:', error.message);
        }
        
        const content = `
            <div class="detail-container">
                <div class="detail-hero">
                    <img src="${series.cover?.url || ''}" 
                         alt="${series.title}" 
                         class="detail-backdrop"
                         onerror="this.style.display='none'">
                    <div class="detail-content">
                        <div class="detail-header">
                            <img src="${series.cover?.url || ''}" 
                                 alt="${series.title}" 
                                 class="detail-poster"
                                 onerror="this.src='https://via.placeholder.com/300x450/181818/ffffff?text=NO+IMAGE'">
                            <div class="detail-info">
                                <h1 class="detail-title">${series.title}</h1>
                                
                                <div class="detail-meta">
                                    <span class="meta-item">
                                        <i class="fas fa-star" style="color: var(--warning);"></i>
                                        ${series.imdbRatingValue || 'N/A'}
                                    </span>
                                    <span class="meta-item">
                                        <i class="fas fa-calendar"></i>
                                        ${series.releaseDate || 'N/A'}
                                    </span>
                                    <span class="meta-item">
                                        <i class="fas fa-tv"></i>
                                        ${infoData.results.resource?.seasons?.length || 1} Season(s)
                                    </span>
                                </div>
                                
                                <div class="genre-list">
                                    ${series.genre ? series.genre.split(',').map(genre => `
                                        <span class="genre-tag">${genre.trim()}</span>
                                    `).join('') : ''}
                                </div>
                                
                                <p class="detail-overview">
                                    ${series.description || 'No description available.'}
                                </p>
                            </div>
                        </div>
                        
                        <!-- Season Selector -->
                        <div class="section-header">
                            <h2 class="section-title">Season ${season}</h2>
                            <div class="season-buttons" style="display: flex; gap: 0.5rem;">
                                ${Array.from({length: infoData.results.resource?.seasons?.[0]?.maxEp || 1}, (_, i) => i + 1)
                                    .map(s => `
                                    <button class="btn ${s == season ? 'btn-primary' : 'btn-secondary'}"
                                            data-season="${s}"
                                            onclick="loadSeason(${s})">
                                        Season ${s}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        
                        <!-- Episodes List -->
                        <div class="content-grid" id="episodesList">
                            ${episodes.length > 0 ? episodes.map((episode, index) => `
                                <div class="movie-card">
                                    <div style="position: relative; height: 200px; background: var(--secondary); 
                                                display: flex; align-items: center; justify-content: center;">
                                        <div style="font-size: 3rem; color: var(--accent);">${index + 1}</div>
                                    </div>
                                    <div class="movie-info">
                                        <div class="movie-title">Episode ${index + 1}</div>
                                        <div class="movie-meta">
                                            <span>${episode.quality || 'HD'}</span>
                                            <span>${formatFileSize(episode.size)}</span>
                                        </div>
                                        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                                            <button class="btn btn-primary" 
                                                    style="padding: 0.5rem; flex: 1;"
                                                    onclick="playVideo('${episode.download_url}', '${series.title} - Episode ${index + 1}')">
                                                <i class="fas fa-play"></i> Play
                                            </button>
                                            <button class="btn btn-secondary"
                                                    style="padding: 0.5rem;"
                                                    onclick="downloadFile('${episode.download_url}', 
                                                                         '${series.title.replace(/[^a-z0-9]/gi, '_')}_S${season}E${index + 1}.mp4')">
                                                <i class="fas fa-download"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('') : `
                                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                                    <i class="fas fa-tv" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                                    <h3>No episodes available for this season</h3>
                                    <p>Try selecting a different season</p>
                                </div>
                            `}
                        </div>
                        
                        ${infoData.results.stars?.length > 0 ? `
                            <div class="section-header">
                                <h2 class="section-title">Cast</h2>
                            </div>
                            <div class="cast-scroll">
                                ${infoData.results.stars.slice(0, 10).map(star => `
                                    <div class="cast-card">
                                        <img src="${star.avatarUrl || ''}" 
                                             alt="${star.name}" 
                                             class="cast-avatar"
                                             onerror="this.src='https://via.placeholder.com/80/2a2a2a/ffffff?text=NO+IMAGE'">
                                        <div class="cast-name">${star.name}</div>
                                        <div class="cast-character">${star.character}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <script>
                function formatFileSize(bytes) {
                    if (!bytes) return 'Unknown size';
                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                    const i = Math.floor(Math.log(bytes) / Math.log(1024));
                    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
                }
                
                async function loadSeason(seasonNumber) {
                    showLoading();
                    try {
                        const response = await fetch(\`/api/series/${seriesId}/season/\${seasonNumber}\`);
                        const episodes = await response.json();
                        
                        const episodesList = document.getElementById('episodesList');
                        if (episodes?.results?.length > 0) {
                            episodesList.innerHTML = episodes.results.map((episode, index) => \`
                                <div class="movie-card">
                                    <div style="position: relative; height: 200px; background: var(--secondary); 
                                                display: flex; align-items: center; justify-content: center;">
                                        <div style="font-size: 3rem; color: var(--accent);">\${index + 1}</div>
                                    </div>
                                    <div class="movie-info">
                                        <div class="movie-title">Episode \${index + 1}</div>
                                        <div class="movie-meta">
                                            <span>\${episode.quality || 'HD'}</span>
                                            <span>\${formatFileSize(episode.size)}</span>
                                        </div>
                                        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                                            <button class="btn btn-primary" 
                                                    style="padding: 0.5rem; flex: 1;"
                                                    onclick="playVideo('\${episode.download_url}', '${series.title} - Episode \${index + 1}')">
                                                <i class="fas fa-play"></i> Play
                                            </button>
                                            <button class="btn btn-secondary"
                                                    style="padding: 0.5rem;"
                                                    onclick="downloadFile('\${episode.download_url}', 
                                                                         '${series.title.replace(/[^a-z0-9]/gi, '_')}_S\${seasonNumber}E\${index + 1}.mp4')">
                                                <i class="fas fa-download"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            \`).join('');
                        } else {
                            episodesList.innerHTML = \`
                                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                                    <i class="fas fa-tv" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                                    <h3>No episodes available for this season</h3>
                                </div>
                            \`;
                        }
                    } catch (error) {
                        showToast('Failed to load episodes', 'error');
                    }
                }
            </script>
        `;
        
        res.send(generateHTML(content, `${series.title} - Beraflix`, 'series'));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h1 style="color: var(--accent); margin-bottom: 20px;">Series Not Found</h1>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    The requested series could not be found or is currently unavailable.
                </p>
                <button class="btn btn-primary" onclick="navigate(event, '/')">
                    Back to Home
                </button>
            </div>
        `, 'Series Not Found - Beraflix', 'series'));
    }
});

app.get('/movies', async (req, res) => {
    try {
        const page = req.query.page || 1;
        const searchQuery = req.query.q || 'popular';
        
        let moviesData;
        if (searchQuery === 'popular') {
            moviesData = await fetchAPI(`/search/popular?page=${page}`);
        } else if (searchQuery === 'latest') {
            moviesData = await fetchAPI(`/search/latest?page=${page}`);
        } else {
            moviesData = await fetchAPI(`/search/${encodeURIComponent(searchQuery)}?page=${page}`);
        }
        
        const movies = moviesData?.results?.items || [];
        
        const content = `
            <div class="section-header">
                <h1 class="section-title" style="font-size: 2rem;">Movies</h1>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn ${searchQuery === 'popular' ? 'btn-primary' : 'btn-secondary'}"
                            onclick="navigate(event, '/movies?q=popular')">
                        Popular
                    </button>
                    <button class="btn ${searchQuery === 'latest' ? 'btn-primary' : 'btn-secondary'}"
                            onclick="navigate(event, '/movies?q=latest')">
                        New Releases
                    </button>
                </div>
            </div>
            
            <div class="content-grid">
                ${movies.length > 0 ? movies.map(movie => `
                    <div class="movie-card" data-id="${movie.subjectId}" data-type="movie">
                        <img src="${movie.cover?.url || ''}" 
                             alt="${movie.title}" 
                             class="movie-poster"
                             onerror="this.src='https://via.placeholder.com/300x450/181818/ffffff?text=NO+IMAGE'">
                        <div class="quality-badge">${movie.subjectType === 2 ? 'SERIES' : 'HD'}</div>
                        <div class="movie-info">
                            <div class="movie-title">${movie.title}</div>
                            <div class="movie-meta">
                                <span>${movie.releaseDate?.split('-')[0] || 'N/A'}</span>
                                <div class="movie-rating">
                                    <i class="fas fa-star"></i>
                                    <span>${movie.imdbRatingValue || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <i class="fas fa-film" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <h3>No movies found</h3>
                        <p>Try a different search or browse our collections</p>
                    </div>
                `}
            </div>
            
            ${moviesData?.results?.pager?.hasMore ? `
                <div style="text-align: center; margin: 3rem 0;">
                    <button class="btn btn-secondary" 
                            onclick="navigate(event, '/movies?q=${searchQuery}&page=${parseInt(page) + 1}')">
                        Load More
                    </button>
                </div>
            ` : ''}
        `;
        
        res.send(generateHTML(content, 'Movies - Beraflix', 'movies'));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h1 style="color: var(--accent); margin-bottom: 20px;">Movies</h1>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Browse our collection of movies
                </p>
                <div class="content-grid">
                    ${Array(12).fill().map(() => `
                        <div class="skeleton skeleton-card"></div>
                    `).join('')}
                </div>
            </div>
        `, 'Movies - Beraflix', 'movies'));
    }
});

app.get('/series', async (req, res) => {
    try {
        const page = req.query.page || 1;
        
        const seriesData = await fetchAPI(`/search/series?page=${page}`);
        const series = seriesData?.results?.items || [];
        
        const content = `
            <div class="section-header">
                <h1 class="section-title" style="font-size: 2rem;">TV Series</h1>
            </div>
            
            <div class="content-grid">
                ${series.length > 0 ? series.filter(s => s.subjectType === 2).map(show => `
                    <div class="movie-card" data-id="${show.subjectId}" data-type="series">
                        <img src="${show.cover?.url || ''}" 
                             alt="${show.title}" 
                             class="movie-poster"
                             onerror="this.src='https://via.placeholder.com/300x450/181818/ffffff?text=NO+IMAGE'">
                        <div class="quality-badge">SERIES</div>
                        <div class="movie-info">
                            <div class="movie-title">${show.title}</div>
                            <div class="movie-meta">
                                <span>${show.releaseDate?.split('-')[0] || 'N/A'}</span>
                                <div class="movie-rating">
                                    <i class="fas fa-star"></i>
                                    <span>${show.imdbRatingValue || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('') : `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
                        <i class="fas fa-tv" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <h3>No series found</h3>
                        <p>Try a different search or check back later</p>
                    </div>
                `}
            </div>
            
            ${seriesData?.results?.pager?.hasMore ? `
                <div style="text-align: center; margin: 3rem 0;">
                    <button class="btn btn-secondary" 
                            onclick="navigate(event, '/series?page=${parseInt(page) + 1}')">
                        Load More
                    </button>
                </div>
            ` : ''}
        `;
        
        res.send(generateHTML(content, 'TV Series - Beraflix', 'series'));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h1 style="color: var(--accent); margin-bottom: 20px;">TV Series</h1>
                <p style="color: var(--text-secondary); margin-bottom: 30px;">
                    Browse our collection of TV series
                </p>
                <div class="content-grid">
                    ${Array(12).fill().map(() => `
                        <div class="skeleton skeleton-card"></div>
                    `).join('')}
                </div>
            </div>
        `, 'TV Series - Beraflix', 'series'));
    }
});

app.get('/search', async (req, res) => {
    const query = req.query.q;
    
    if (!query || query.trim().length < 2) {
        const content = `
            <div class="section-header">
                <h1 class="section-title" style="font-size: 2rem;">Search</h1>
            </div>
            <div style="text-align: center; padding: 100px 20px;">
                <i class="fas fa-search" style="font-size: 3rem; color: var(--accent); margin-bottom: 1rem;"></i>
                <h2 style="margin-bottom: 1rem;">Search Movies & TV Series</h2>
                <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                    Enter a title in the search bar above to find movies and TV series.
                </p>
            </div>
        `;
        return res.send(generateHTML(content, 'Search - Beraflix', 'home'));
    }
    
    try {
        const searchData = await fetchAPI(`/search/${encodeURIComponent(query)}`);
        const results = searchData?.results?.items || [];
        
        const content = `
            <div class="section-header">
                <h1 class="section-title" style="font-size: 2rem;">
                    Search Results for "${query}"
                </h1>
                <span style="color: var(--text-tertiary);">
                    ${results.length} results found
                </span>
            </div>
            
            ${results.length > 0 ? `
                <div class="content-grid">
                    ${results.map(item => `
                        <div class="movie-card" data-id="${item.subjectId}" 
                             data-type="${item.subjectType === 2 ? 'series' : 'movie'}">
                            <img src="${item.cover?.url || ''}" 
                                 alt="${item.title}" 
                                 class="movie-poster"
                                 onerror="this.src='https://via.placeholder.com/300x450/181818/ffffff?text=NO+IMAGE'">
                            <div class="quality-badge">${item.subjectType === 2 ? 'SERIES' : 'HD'}</div>
                            <div class="movie-info">
                                <div class="movie-title">${item.title}</div>
                                <div class="movie-meta">
                                    <span>${item.releaseDate?.split('-')[0] || 'N/A'}</span>
                                    <div class="movie-rating">
                                        <i class="fas fa-star"></i>
                                        <span>${item.imdbRatingValue || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="text-align: center; padding: 100px 20px;">
                    <i class="fas fa-search-minus" style="font-size: 3rem; color: var(--text-tertiary); margin-bottom: 1rem;"></i>
                    <h2 style="margin-bottom: 1rem;">No Results Found</h2>
                    <p style="color: var(--text-secondary); max-width: 400px; margin: 0 auto;">
                        No movies or TV series found for "${query}". Try a different search term.
                    </p>
                </div>
            `}
        `;
        
        res.send(generateHTML(content, `"${query}" - Search - Beraflix`, 'home'));
    } catch (error) {
        res.send(generateHTML(`
            <div class="section-header">
                <h1 class="section-title" style="font-size: 2rem;">Search Error</h1>
            </div>
            <div style="text-align: center; padding: 100px 20px;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--accent); margin-bottom: 1rem;"></i>
                <h2 style="margin-bottom: 1rem;">Search Failed</h2>
                <p style="color: var(--text-secondary); margin-bottom: 2rem;">
                    There was an error performing your search. Please try again.
                </p>
                <button class="btn btn-primary" onclick="window.location.reload()">
                    Try Again
                </button>
            </div>
        `, 'Search Error - Beraflix', 'home'));
    }
});

// API Proxy Routes
app.get('/api/search/:query', async (req, res) => {
    try {
        const data = await fetchAPI(`/search/${req.params.query}`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/info/:id', async (req, res) => {
    try {
        const data = await fetchAPI(`/info/${req.params.id}`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sources/:id', async (req, res) => {
    try {
        const season = req.query.season;
        const episode = req.query.episode;
        
        let url = `/sources/${req.params.id}`;
        if (season) url += `?season=${season}`;
        if (episode) url += `&episode=${episode}`;
        
        const data = await fetchAPI(url);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════╗
    ║                  BERAFLIX STREAMING PLATFORM             ║
    ║                  Version 2.0 - Professional              ║
    ║                                                          ║
    ║  🔗 Local: http://localhost:${PORT}                        ║
    ║  🌐 API: https://movieapi.giftedtech.co.ke               ║
    ║  📱 Mobile Optimized                                     ║
    ║  ⚡ Puppeteer Fallback Enabled                           ║
    ║  🎬 Real API Integration (Official Documentation)        ║
    ║  💾 Direct Download Support                             ║
    ║  🎨 Professional Netflix-like UI                         ║
    ╚══════════════════════════════════════════════════════════╝
    `);
});
