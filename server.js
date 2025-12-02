const express = require('express');
const path = require('path');
const axios = require('axios');
const cors = require('cors');
const mime = require('mime-types');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const chromium = require('chrome-aws-lambda');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Constants
const GIFTED_API_BASE = 'https://movies.giftedtech.co.ke/api';
const IMG_BASE = 'https://img.giftedtech.co.ke';
const FILES_BASE = 'https://files.giftedtech.co.ke';
const DOWNLOAD_BASE = 'https://download.giftedtech.co.ke';

// Cache for API responses
const cache = new Map();
const CACHE_DURATION = 300000; // 5 minutes

// Utility functions
function cacheData(key, data) {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
}

function getCachedData(key) {
    const cached = cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

// Puppeteer fallback for Cloudflare protection
async function fetchWithPuppeteer(url) {
    let browser = null;
    try {
        const executablePath = await chromium.executablePath;
        
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: executablePath || process.env.CHROME_PATH,
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        
        // Set user agent to mimic a real browser
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Get page content
        const content = await page.content();
        const $ = cheerio.load(content);
        
        // Try to find JSON data in script tags
        let jsonData = null;
        $('script').each((i, el) => {
            const scriptContent = $(el).html();
            if (scriptContent && scriptContent.includes('window.__NUXT__') || 
                scriptContent && scriptContent.includes('window.__INITIAL_STATE__')) {
                try {
                    const match = scriptContent.match(/window\.__NUXT__\s*=\s*(.*?});/s) ||
                                 scriptContent.match(/window\.__INITIAL_STATE__\s*=\s*(.*?});/s);
                    if (match) {
                        jsonData = JSON.parse(match[1]);
                    }
                } catch (e) {
                    console.log('Failed to parse script data');
                }
            }
        });

        // If no JSON found, try to extract from body
        if (!jsonData) {
            const bodyText = await page.evaluate(() => document.body.innerText);
            try {
                jsonData = JSON.parse(bodyText);
            } catch (e) {
                // If not JSON, return HTML
                return { html: content };
            }
        }

        return jsonData || { html: content };
    } catch (error) {
        console.error('Puppeteer fetch error:', error.message);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// API Proxy with fallback
async function fetchAPI(endpoint, usePuppeteer = false) {
    const url = `${GIFTED_API_BASE}${endpoint}`;
    const cacheKey = `api_${endpoint}_${usePuppeteer}`;
    
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    
    try {
        let response;
        
        if (usePuppeteer) {
            response = await fetchWithPuppeteer(url);
        } else {
            response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/html, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://movies.giftedtech.co.ke/'
                },
                timeout: 10000
            });
            response = response.data;
        }
        
        cacheData(cacheKey, response);
        return response;
    } catch (error) {
        console.log(`API fetch failed for ${endpoint}, trying puppeteer...`);
        
        if (!usePuppeteer) {
            try {
                const puppeteerResponse = await fetchWithPuppeteer(url);
                cacheData(cacheKey, puppeteerResponse);
                return puppeteerResponse;
            } catch (puppeteerError) {
                console.error('Puppeteer fallback also failed:', puppeteerError.message);
                throw new Error(`Failed to fetch ${endpoint} after retries`);
            }
        }
        throw error;
    }
}

// Generate neon-themed HTML
function generateHTML(content, title = 'Beraflix') {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>${title} | Neon Streaming</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@9/swiper-bundle.min.css" />
        <style>
            :root {
                --neon-cyan: #00eaff;
                --neon-purple: #b300ff;
                --neon-pink: #ff0099;
                --jet-black: #050505;
                --dark-gray: #111111;
                --medium-gray: #222222;
                --light-gray: #444444;
                --white: #ffffff;
                --glow-cyan: 0 0 15px #00eaff, 0 0 30px #00eaff;
                --glow-purple: 0 0 15px #b300ff, 0 0 30px #b300ff;
                --glow-pink: 0 0 15px #ff0099, 0 0 30px #ff0099;
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                -webkit-tap-highlight-color: transparent;
            }

            body {
                background-color: var(--jet-black);
                color: var(--white);
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                overflow-x: hidden;
                min-height: 100vh;
                padding-bottom: 80px;
            }

            /* Neon Header */
            .header {
                background: linear-gradient(135deg, rgba(5, 5, 5, 0.95) 0%, rgba(11, 1, 20, 0.95) 100%);
                backdrop-filter: blur(10px);
                padding: 15px 20px;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 1000;
                border-bottom: 1px solid rgba(0, 234, 255, 0.3);
                box-shadow: var(--glow-cyan);
            }

            .logo {
                font-size: 28px;
                font-weight: 900;
                background: linear-gradient(45deg, var(--neon-cyan), var(--neon-purple));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                text-shadow: 0 0 10px rgba(0, 234, 255, 0.5);
            }

            /* Search Bar */
            .search-container {
                position: relative;
                margin: 20px 15px;
                margin-top: 80px;
            }

            .search-bar {
                width: 100%;
                padding: 15px 20px;
                background: rgba(17, 17, 17, 0.8);
                border: 2px solid var(--neon-cyan);
                border-radius: 50px;
                color: white;
                font-size: 16px;
                outline: none;
                transition: all 0.3s ease;
                box-shadow: 0 0 10px rgba(0, 234, 255, 0.3);
            }

            .search-bar:focus {
                box-shadow: var(--glow-cyan);
                border-color: var(--neon-purple);
            }

            /* Content Sections */
            .section {
                margin: 25px 15px;
            }

            .section-title {
                font-size: 22px;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .section-title::before {
                content: '';
                width: 4px;
                height: 22px;
                background: linear-gradient(to bottom, var(--neon-cyan), var(--neon-purple));
                border-radius: 2px;
            }

            /* Cards Grid */
            .cards-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }

            @media (min-width: 768px) {
                .cards-grid {
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 20px;
                }
            }

            /* Movie Card */
            .movie-card {
                background: var(--dark-gray);
                border-radius: 12px;
                overflow: hidden;
                transition: all 0.3s ease;
                position: relative;
                border: 1px solid rgba(0, 234, 255, 0.1);
                cursor: pointer;
            }

            .movie-card:hover {
                transform: translateY(-5px);
                border-color: var(--neon-cyan);
                box-shadow: var(--glow-cyan);
            }

            .movie-card img {
                width: 100%;
                height: 200px;
                object-fit: cover;
                display: block;
            }

            .movie-info {
                padding: 12px;
            }

            .movie-title {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 5px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .movie-meta {
                font-size: 12px;
                color: #aaa;
                display: flex;
                justify-content: space-between;
            }

            /* Quality Badge */
            .quality-badge {
                position: absolute;
                top: 10px;
                right: 10px;
                background: linear-gradient(45deg, var(--neon-pink), var(--neon-purple));
                color: white;
                padding: 3px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: bold;
                box-shadow: 0 0 10px rgba(255, 0, 153, 0.5);
            }

            /* Bottom Navigation */
            .bottom-nav {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: rgba(5, 5, 5, 0.95);
                backdrop-filter: blur(20px);
                display: flex;
                justify-content: space-around;
                padding: 15px 10px;
                border-top: 1px solid rgba(0, 234, 255, 0.3);
                z-index: 1000;
            }

            .nav-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                color: #888;
                text-decoration: none;
                transition: all 0.3s ease;
                padding: 8px 15px;
                border-radius: 10px;
            }

            .nav-item.active {
                color: var(--neon-cyan);
                background: rgba(0, 234, 255, 0.1);
                box-shadow: 0 0 15px rgba(0, 234, 255, 0.3);
            }

            .nav-item i {
                font-size: 22px;
                margin-bottom: 5px;
            }

            .nav-item span {
                font-size: 12px;
                font-weight: 500;
            }

            /* Detail Page */
            .detail-hero {
                position: relative;
                height: 60vh;
                overflow: hidden;
                margin-top: 60px;
            }

            .detail-hero::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(to bottom, transparent 0%, var(--jet-black) 100%);
                z-index: 1;
            }

            .detail-hero img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .detail-content {
                position: relative;
                z-index: 2;
                padding: 20px;
                margin-top: -100px;
            }

            .detail-title {
                font-size: 28px;
                font-weight: 900;
                margin-bottom: 10px;
                background: linear-gradient(45deg, var(--neon-cyan), var(--neon-pink));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }

            .detail-meta {
                display: flex;
                gap: 15px;
                margin-bottom: 15px;
                color: #aaa;
                font-size: 14px;
            }

            .detail-genres {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-bottom: 20px;
            }

            .genre-tag {
                background: rgba(0, 234, 255, 0.1);
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 12px;
                border: 1px solid rgba(0, 234, 255, 0.3);
            }

            /* Action Buttons */
            .action-buttons {
                display: flex;
                gap: 15px;
                margin: 25px 0;
            }

            .btn {
                flex: 1;
                padding: 15px;
                border: none;
                border-radius: 10px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                transition: all 0.3s ease;
                text-decoration: none;
            }

            .btn-play {
                background: linear-gradient(45deg, var(--neon-cyan), var(--neon-purple));
                color: white;
                box-shadow: 0 0 20px rgba(0, 234, 255, 0.4);
            }

            .btn-download {
                background: rgba(255, 0, 153, 0.1);
                color: var(--neon-pink);
                border: 2px solid var(--neon-pink);
            }

            .btn:hover {
                transform: scale(1.05);
                box-shadow: var(--glow-cyan);
            }

            /* Season/Episode Selector */
            .season-selector {
                margin: 20px 0;
            }

            .season-buttons {
                display: flex;
                gap: 10px;
                overflow-x: auto;
                padding: 10px 0;
            }

            .season-btn {
                padding: 10px 20px;
                background: rgba(17, 17, 17, 0.8);
                border: 2px solid var(--neon-purple);
                border-radius: 25px;
                color: white;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.3s ease;
            }

            .season-btn.active {
                background: var(--neon-purple);
                box-shadow: var(--glow-purple);
            }

            /* Episode List */
            .episode-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .episode-card {
                background: rgba(17, 17, 17, 0.8);
                border-radius: 10px;
                padding: 15px;
                display: flex;
                gap: 15px;
                align-items: center;
                border: 1px solid rgba(0, 234, 255, 0.1);
                transition: all 0.3s ease;
            }

            .episode-card:hover {
                border-color: var(--neon-cyan);
                box-shadow: 0 0 15px rgba(0, 234, 255, 0.3);
            }

            .episode-number {
                font-size: 24px;
                font-weight: 900;
                color: var(--neon-cyan);
                min-width: 40px;
            }

            .episode-info {
                flex: 1;
            }

            .episode-title {
                font-weight: 600;
                margin-bottom: 5px;
            }

            .episode-desc {
                font-size: 12px;
                color: #aaa;
            }

            /* Video Player */
            .video-player {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: black;
                z-index: 2000;
                display: none;
            }

            .video-player video {
                width: 100%;
                height: 100%;
            }

            .close-player {
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                font-size: 20px;
                cursor: pointer;
                z-index: 2001;
            }

            /* NEON SHIMMER LOADING ANIMATIONS */
            .skeleton-loader {
                background: linear-gradient(90deg, 
                    rgba(34, 34, 34, 0.2) 25%, 
                    rgba(0, 234, 255, 0.1) 50%, 
                    rgba(34, 34, 34, 0.2) 75%);
                background-size: 200% 100%;
                animation: shimmer 2s infinite;
                border-radius: 8px;
            }

            @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }

            .skeleton-card {
                height: 280px;
                border-radius: 12px;
            }

            .skeleton-title {
                height: 20px;
                width: 80%;
                margin: 10px 0;
            }

            .skeleton-text {
                height: 15px;
                width: 60%;
                margin: 5px 0;
            }

            .skeleton-button {
                height: 50px;
                border-radius: 10px;
                margin: 10px 0;
            }

            /* Trending Banner */
            .trending-banner {
                height: 300px;
                border-radius: 20px;
                margin: 20px 15px;
                overflow: hidden;
                position: relative;
            }

            .trending-banner::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(45deg, rgba(179, 0, 255, 0.3), rgba(255, 0, 153, 0.3));
                z-index: 1;
                animation: pulse 3s infinite alternate;
            }

            @keyframes pulse {
                0% { opacity: 0.3; }
                100% { opacity: 0.7; }
            }

            /* Notification */
            .notification {
                position: fixed;
                top: 100px;
                right: 20px;
                background: linear-gradient(45deg, var(--neon-purple), var(--neon-pink));
                color: white;
                padding: 15px 25px;
                border-radius: 10px;
                box-shadow: var(--glow-purple);
                z-index: 3000;
                display: none;
                animation: slideIn 0.3s ease;
            }

            @keyframes slideIn {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }

            /* Scrollbar */
            ::-webkit-scrollbar {
                width: 8px;
                height: 8px;
            }

            ::-webkit-scrollbar-track {
                background: var(--dark-gray);
            }

            ::-webkit-scrollbar-thumb {
                background: linear-gradient(var(--neon-cyan), var(--neon-purple));
                border-radius: 4px;
            }

            /* Loading Spinner */
            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 3px solid transparent;
                border-top: 3px solid var(--neon-cyan);
                border-right: 3px solid var(--neon-purple);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 50px auto;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="logo">BERAFLIX</div>
        </div>

        <div class="notification" id="notification"></div>

        <div class="video-player" id="videoPlayer">
            <button class="close-player" onclick="closeVideoPlayer()">
                <i class="fas fa-times"></i>
            </button>
            <video id="mainVideo" controls autoplay>
                Your browser does not support the video tag.
            </video>
        </div>

        <div id="content">${content}</div>

        <div class="bottom-nav">
            <a href="/" class="nav-item active" onclick="navigate(event, '/')">
                <i class="fas fa-home"></i>
                <span>Home</span>
            </a>
            <a href="/movies" class="nav-item" onclick="navigate(event, '/movies')">
                <i class="fas fa-film"></i>
                <span>Movies</span>
            </a>
            <a href="/series" class="nav-item" onclick="navigate(event, '/series')">
                <i class="fas fa-tv"></i>
                <span>Series</span>
            </a>
            <a href="/trending" class="nav-item" onclick="navigate(event, '/trending')">
                <i class="fas fa-fire"></i>
                <span>Trending</span>
            </a>
            <a href="/downloads" class="nav-item" onclick="navigate(event, '/downloads')">
                <i class="fas fa-download"></i>
                <span>Downloads</span>
            </a>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/swiper@9/swiper-bundle.min.js"></script>
        <script>
            // Global state
            let currentPage = '/';
            let isLoading = false;
            let continueWatching = JSON.parse(localStorage.getItem('continueWatching') || '[]');

            // Navigation
            async function navigate(e, path) {
                e.preventDefault();
                if (currentPage === path || isLoading) return;
                
                currentPage = path;
                isLoading = true;
                
                // Update active nav
                document.querySelectorAll('.nav-item').forEach(item => {
                    item.classList.remove('active');
                });
                e.target.closest('.nav-item').classList.add('active');
                
                // Show loading
                document.getElementById('content').innerHTML = \`
                    <div class="section">
                        <div class="skeleton-loader trending-banner"></div>
                        <div class="section-title"></div>
                        <div class="cards-grid">
                            \${Array(6).fill().map(() => \`
                                <div class="skeleton-loader skeleton-card"></div>
                            \`).join('')}
                        </div>
                    </div>
                \`;
                
                try {
                    const response = await fetch(path);
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const newContent = doc.getElementById('content')?.innerHTML || html;
                    document.getElementById('content').innerHTML = newContent;
                    initializePage();
                } catch (error) {
                    showNotification('Error loading page', 'error');
                } finally {
                    isLoading = false;
                }
            }

            // Search
            let searchTimeout;
            async function performSearch(query) {
                if (!query.trim()) return;
                
                showLoading();
                try {
                    const response = await fetch(\`/search?q=\${encodeURIComponent(query)}\`);
                    const html = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    document.getElementById('content').innerHTML = doc.getElementById('content')?.innerHTML || html;
                } catch (error) {
                    showNotification('Search failed', 'error');
                }
            }

            function searchMovies() {
                clearTimeout(searchTimeout);
                const query = document.getElementById('searchInput').value;
                searchTimeout = setTimeout(() => performSearch(query), 500);
            }

            // Video Player
            function playVideo(videoUrl, title) {
                const player = document.getElementById('videoPlayer');
                const video = document.getElementById('mainVideo');
                
                video.src = videoUrl;
                video.play();
                player.style.display = 'block';
                
                // Track continue watching
                const item = continueWatching.find(item => item.url === videoUrl);
                if (item) {
                    item.lastPosition = video.currentTime;
                    item.lastWatched = new Date().toISOString();
                } else {
                    continueWatching.unshift({
                        url: videoUrl,
                        title: title,
                        lastPosition: 0,
                        lastWatched: new Date().toISOString()
                    });
                }
                
                // Keep only last 10 items
                continueWatching = continueWatching.slice(0, 10);
                localStorage.setItem('continueWatching', JSON.stringify(continueWatching));
            }

            function closeVideoPlayer() {
                const player = document.getElementById('videoPlayer');
                const video = document.getElementById('mainVideo');
                
                video.pause();
                video.src = '';
                player.style.display = 'none';
            }

            // Download
            async function downloadFile(url, filename) {
                try {
                    showNotification('Starting download...');
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename || 'beraflix-download';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    showNotification('Download started!');
                } catch (error) {
                    showNotification('Download failed', 'error');
                }
            }

            // Notifications
            function showNotification(message, type = 'info') {
                const notification = document.getElementById('notification');
                notification.textContent = message;
                notification.style.display = 'block';
                
                setTimeout(() => {
                    notification.style.display = 'none';
                }, 3000);
            }

            // Loading
            function showLoading() {
                document.getElementById('content').innerHTML = \`
                    <div style="text-align: center; padding: 50px;">
                        <div class="loading-spinner"></div>
                        <p style="margin-top: 20px; color: var(--neon-cyan);">Loading...</p>
                    </div>
                \`;
            }

            // Initialize page
            function initializePage() {
                // Initialize Swiper for banners
                if (document.querySelector('.swiper')) {
                    new Swiper('.swiper', {
                        slidesPerView: 1,
                        spaceBetween: 10,
                        autoplay: {
                            delay: 5000,
                            disableOnInteraction: false,
                        },
                        pagination: {
                            el: '.swiper-pagination',
                            clickable: true,
                        },
                        navigation: {
                            nextEl: '.swiper-button-next',
                            prevEl: '.swiper-button-prev',
                        },
                    });
                }
                
                // Add click handlers
                document.querySelectorAll('.movie-card').forEach(card => {
                    card.addEventListener('click', function() {
                        const id = this.dataset.id;
                        const type = this.dataset.type;
                        if (id && type) {
                            navigate(new Event('click'), \`/\${type}/\${id}\`);
                        }
                    });
                });
                
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
            }

            // Initialize on load
            document.addEventListener('DOMContentLoaded', () => {
                initializePage();
                
                // Handle back button
                window.addEventListener('popstate', () => {
                    navigate(new Event('popstate'), window.location.pathname);
                });
            });
        </script>
    </body>
    </html>
    `;
}

// Routes
app.get('/', async (req, res) => {
    try {
        // Fetch multiple data sources in parallel
        const [trending, movies, series, latest] = await Promise.allSettled([
            fetchAPI('/trending'),
            fetchAPI('/movies?limit=10'),
            fetchAPI('/series?limit=10'),
            fetchAPI('/latest?limit=10')
        ]);

        const content = `
        <div class="search-container">
            <input type="text" 
                   class="search-bar" 
                   placeholder="Search movies and series..." 
                   id="searchInput"
                   oninput="searchMovies()">
        </div>

        <div class="section">
            <h2 class="section-title">Trending Now</h2>
            <div class="cards-grid">
                ${trending.status === 'fulfilled' && trending.value?.data ? 
                    trending.value.data.slice(0, 6).map(item => `
                        <div class="movie-card" data-id="${item.id}" data-type="${item.type || 'movie'}">
                            <img src="${IMG_BASE}${item.poster}" alt="${item.title}" 
                                 onerror="this.src='https://via.placeholder.com/150x225/111111/00eaff?text=NO+IMAGE'">
                            <div class="quality-badge">${item.quality || 'HD'}</div>
                            <div class="movie-info">
                                <div class="movie-title">${item.title}</div>
                                <div class="movie-meta">
                                    <span>${item.year || 'N/A'}</span>
                                    <span>${item.type === 'series' ? 'Series' : 'Movie'}</span>
                                </div>
                            </div>
                        </div>
                    `).join('') :
                    Array(6).fill().map(() => `
                        <div class="skeleton-loader skeleton-card"></div>
                    `).join('')
                }
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Popular Movies</h2>
            <div class="cards-grid">
                ${movies.status === 'fulfilled' && movies.value?.data ? 
                    movies.value.data.slice(0, 6).map(item => `
                        <div class="movie-card" data-id="${item.id}" data-type="movie">
                            <img src="${IMG_BASE}${item.poster}" alt="${item.title}"
                                 onerror="this.src='https://via.placeholder.com/150x225/111111/00eaff?text=NO+IMAGE'">
                            <div class="quality-badge">${item.quality || 'HD'}</div>
                            <div class="movie-info">
                                <div class="movie-title">${item.title}</div>
                                <div class="movie-meta">
                                    <span>${item.year || 'N/A'}</span>
                                    <span>${item.duration || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    `).join('') :
                    Array(6).fill().map(() => `
                        <div class="skeleton-loader skeleton-card"></div>
                    `).join('')
                }
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Popular Series</h2>
            <div class="cards-grid">
                ${series.status === 'fulfilled' && series.value?.data ? 
                    series.value.data.slice(0, 6).map(item => `
                        <div class="movie-card" data-id="${item.id}" data-type="series">
                            <img src="${IMG_BASE}${item.poster}" alt="${item.title}"
                                 onerror="this.src='https://via.placeholder.com/150x225/111111/00eaff?text=NO+IMAGE'">
                            <div class="quality-badge">Series</div>
                            <div class="movie-info">
                                <div class="movie-title">${item.title}</div>
                                <div class="movie-meta">
                                    <span>${item.year || 'N/A'}</span>
                                    <span>${item.seasons || '1'} Season(s)</span>
                                </div>
                            </div>
                        </div>
                    `).join('') :
                    Array(6).fill().map(() => `
                        <div class="skeleton-loader skeleton-card"></div>
                    `).join('')
                }
            </div>
        </div>

        <div class="section">
            <h2 class="section-title">Latest Releases</h2>
            <div class="cards-grid">
                ${latest.status === 'fulfilled' && latest.value?.data ? 
                    latest.value.data.slice(0, 6).map(item => `
                        <div class="movie-card" data-id="${item.id}" data-type="${item.type || 'movie'}">
                            <img src="${IMG_BASE}${item.poster}" alt="${item.title}"
                                 onerror="this.src='https://via.placeholder.com/150x225/111111/00eaff?text=NO+IMAGE'">
                            <div class="quality-badge">NEW</div>
                            <div class="movie-info">
                                <div class="movie-title">${item.title}</div>
                                <div class="movie-meta">
                                    <span>${item.year || 'N/A'}</span>
                                    <span>${item.type === 'series' ? 'Series' : 'Movie'}</span>
                                </div>
                            </div>
                        </div>
                    `).join('') :
                    Array(6).fill().map(() => `
                        <div class="skeleton-loader skeleton-card"></div>
                    `).join('')
                }
            </div>
        </div>
        `;

        res.send(generateHTML(content, 'Beraflix - Home'));
    } catch (error) {
        res.status(500).send(generateHTML(`
            <div style="text-align: center; padding: 50px;">
                <h2 style="color: var(--neon-pink);">Failed to load content</h2>
                <p style="color: #aaa; margin: 20px 0;">${error.message}</p>
                <button onclick="window.location.reload()" 
                        style="background: var(--neon-cyan); color: black; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer;">
                    Retry
                </button>
            </div>
        `, 'Error - Beraflix'));
    }
});

app.get('/movie/:id', async (req, res) => {
    try {
        const movie = await fetchAPI(`/movie/${req.params.id}`);
        
        if (!movie || !movie.data) {
            throw new Error('Movie not found');
        }

        const content = `
        <div class="detail-hero">
            <img src="${IMG_BASE}${movie.data.backdrop || movie.data.poster}" 
                 alt="${movie.data.title}"
                 onerror="this.src='https://via.placeholder.com/1200x600/111111/00eaff?text=NO+IMAGE'">
        </div>
        
        <div class="detail-content">
            <h1 class="detail-title">${movie.data.title}</h1>
            
            <div class="detail-meta">
                <span><i class="fas fa-star" style="color: #ffd700;"></i> ${movie.data.rating || 'N/A'}</span>
                <span><i class="fas fa-calendar"></i> ${movie.data.year || 'N/A'}</span>
                <span><i class="fas fa-clock"></i> ${movie.data.duration || 'N/A'}</span>
                <span class="quality-badge" style="display: inline-block;">${movie.data.quality || 'HD'}</span>
            </div>
            
            <div class="detail-genres">
                ${(movie.data.genres || []).map(genre => `
                    <span class="genre-tag">${genre}</span>
                `).join('')}
            </div>
            
            <p style="line-height: 1.6; margin-bottom: 25px; color: #ccc;">
                ${movie.data.description || 'No description available.'}
            </p>
            
            <div class="action-buttons">
                <button class="btn btn-play" 
                        data-url="${movie.data.stream_url || FILES_BASE + '/movies/' + encodeURIComponent(movie.data.slug || movie.data.title) + '.mp4'}"
                        data-title="${movie.data.title}">
                    <i class="fas fa-play"></i> Play Now
                </button>
                
                <button class="btn btn-download"
                        data-url="${movie.data.download_url || DOWNLOAD_BASE + '/' + encodeURIComponent(movie.data.slug || movie.data.title) + '.mp4'}"
                        data-filename="${movie.data.title.replace(/[^a-z0-9]/gi, '_')}.mp4">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
            
            ${movie.data.cast ? `
                <div class="section">
                    <h2 class="section-title">Cast</h2>
                    <div style="display: flex; overflow-x: auto; gap: 15px; padding: 10px 0;">
                        ${movie.data.cast.slice(0, 10).map(actor => `
                            <div style="text-align: center; min-width: 80px;">
                                <div style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(45deg, var(--neon-cyan), var(--neon-purple)); margin: 0 auto 10px;"></div>
                                <span style="font-size: 12px;">${actor}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            <div class="section">
                <h2 class="section-title">Similar Movies</h2>
                <div class="cards-grid">
                    ${Array(4).fill().map(() => `
                        <div class="skeleton-loader skeleton-card"></div>
                    `).join('')}
                </div>
            </div>
        </div>
        `;

        res.send(generateHTML(content, `${movie.data.title} - Beraflix`));
    } catch (error) {
        res.status(404).send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h2 style="color: var(--neon-pink); margin-bottom: 20px;">Movie Not Found</h2>
                <p style="color: #aaa; margin-bottom: 30px;">The movie you're looking for doesn't exist or is unavailable.</p>
                <a href="/" style="display: inline-block; background: linear-gradient(45deg, var(--neon-cyan), var(--neon-purple)); color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">
                    Back to Home
                </a>
            </div>
        `, 'Not Found - Beraflix'));
    }
});

app.get('/series/:id', async (req, res) => {
    try {
        const series = await fetchAPI(`/series/${req.params.id}`);
        
        if (!series || !series.data) {
            throw new Error('Series not found');
        }

        const seasons = series.data.seasons || [];
        const firstSeason = seasons[0] || { number: 1 };
        
        let episodes = [];
        if (firstSeason.number) {
            try {
                const seasonData = await fetchAPI(`/series/${req.params.id}/season/${firstSeason.number}`);
                episodes = seasonData.data?.episodes || [];
            } catch (e) {
                console.log('Could not fetch episodes:', e.message);
            }
        }

        const content = `
        <div class="detail-hero">
            <img src="${IMG_BASE}${series.data.backdrop || series.data.poster}" 
                 alt="${series.data.title}"
                 onerror="this.src='https://via.placeholder.com/1200x600/111111/00eaff?text=NO+IMAGE'">
        </div>
        
        <div class="detail-content">
            <h1 class="detail-title">${series.data.title}</h1>
            
            <div class="detail-meta">
                <span><i class="fas fa-star" style="color: #ffd700;"></i> ${series.data.rating || 'N/A'}</span>
                <span><i class="fas fa-calendar"></i> ${series.data.year || 'N/A'}</span>
                <span><i class="fas fa-tv"></i> ${seasons.length} Season(s)</span>
                <span class="quality-badge" style="display: inline-block;">Series</span>
            </div>
            
            <div class="detail-genres">
                ${(series.data.genres || []).map(genre => `
                    <span class="genre-tag">${genre}</span>
                `).join('')}
            </div>
            
            <p style="line-height: 1.6; margin-bottom: 25px; color: #ccc;">
                ${series.data.description || 'No description available.'}
            </p>
            
            <div class="season-selector">
                <div class="season-buttons">
                    ${seasons.map(season => `
                        <button class="season-btn ${season.number === 1 ? 'active' : ''}" 
                                onclick="loadSeason(${season.number})">
                            Season ${season.number}
                        </button>
                    `).join('')}
                </div>
            </div>
            
            <div class="episode-list" id="episodeList">
                ${episodes.map(episode => `
                    <div class="episode-card">
                        <div class="episode-number">${episode.episode_number}</div>
                        <div class="episode-info">
                            <div class="episode-title">${episode.title || 'Episode ' + episode.episode_number}</div>
                            <div class="episode-desc">${episode.description || 'No description available'}</div>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn-play" 
                                    data-url="${FILES_BASE}/series/${encodeURIComponent(series.data.slug || series.data.title)}/S${String(firstSeason.number).padStart(2, '0')}/E${String(episode.episode_number).padStart(2, '0')}.mp4"
                                    data-title="${series.data.title} - S${firstSeason.number}E${episode.episode_number}"
                                    style="background: var(--neon-cyan); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer;">
                                <i class="fas fa-play"></i>
                            </button>
                            <button class="btn-download"
                                    data-url="${DOWNLOAD_BASE}/series/${encodeURIComponent(series.data.slug || series.data.title)}/S${String(firstSeason.number).padStart(2, '0')}/E${String(episode.episode_number).padStart(2, '0')}.mp4"
                                    data-filename="${series.data.title.replace(/[^a-z0-9]/gi, '_')}_S${firstSeason.number}E${episode.episode_number}.mp4"
                                    style="background: transparent; color: var(--neon-pink); border: 2px solid var(--neon-pink); width: 40px; height: 40px; border-radius: 50%; cursor: pointer;">
                                <i class="fas fa-download"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
                
                ${episodes.length === 0 ? `
                    <div style="text-align: center; padding: 40px; color: #aaa;">
                        <i class="fas fa-exclamation-circle" style="font-size: 48px; margin-bottom: 20px; color: var(--neon-pink);"></i>
                        <p>No episodes available for this season.</p>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <script>
            async function loadSeason(seasonNumber) {
                document.querySelectorAll('.season-btn').forEach(btn => {
                    btn.classList.remove('active');
                });
                event.target.classList.add('active');
                
                showLoading();
                try {
                    const response = await fetch(\`/api/series/${req.params.id}/season/\${seasonNumber}\`);
                    const episodes = await response.json();
                    
                    document.getElementById('episodeList').innerHTML = episodes.map(episode => \`
                        <div class="episode-card">
                            <div class="episode-number">\${episode.episode_number}</div>
                            <div class="episode-info">
                                <div class="episode-title">\${episode.title || 'Episode ' + episode.episode_number}</div>
                                <div class="episode-desc">\${episode.description || 'No description available'}</div>
                            </div>
                            <div style="display: flex; gap: 10px;">
                                <button class="btn-play" 
                                        data-url="${FILES_BASE}/series/${encodeURIComponent(series.data.slug || series.data.title)}/S\${String(seasonNumber).padStart(2, '0')}/E\${String(episode.episode_number).padStart(2, '0')}.mp4"
                                        data-title="${series.data.title} - S\${seasonNumber}E\${episode.episode_number}"
                                        style="background: var(--neon-cyan); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer;">
                                    <i class="fas fa-play"></i>
                                </button>
                                <button class="btn-download"
                                        data-url="${DOWNLOAD_BASE}/series/${encodeURIComponent(series.data.slug || series.data.title)}/S\${String(seasonNumber).padStart(2, '0')}/E\${String(episode.episode_number).padStart(2, '0')}.mp4"
                                        data-filename="${series.data.title.replace(/[^a-z0-9]/gi, '_')}_S\${seasonNumber}E\${episode.episode_number}.mp4"
                                        style="background: transparent; color: var(--neon-pink); border: 2px solid var(--neon-pink); width: 40px; height: 40px; border-radius: 50%; cursor: pointer;">
                                    <i class="fas fa-download"></i>
                                </button>
                            </div>
                        </div>
                    \`).join('') || '<p style="text-align: center; color: #aaa;">No episodes found for this season.</p>';
                    
                    // Re-attach event listeners
                    initializePage();
                } catch (error) {
                    showNotification('Failed to load season', 'error');
                }
            }
        </script>
        `;

        res.send(generateHTML(content, `${series.data.title} - Beraflix`));
    } catch (error) {
        res.status(404).send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h2 style="color: var(--neon-pink); margin-bottom: 20px;">Series Not Found</h2>
                <p style="color: #aaa; margin-bottom: 30px;">The series you're looking for doesn't exist or is unavailable.</p>
                <a href="/" style="display: inline-block; background: linear-gradient(45deg, var(--neon-cyan), var(--neon-purple)); color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold;">
                    Back to Home
                </a>
            </div>
        `, 'Not Found - Beraflix'));
    }
});

app.get('/search', async (req, res) => {
    const query = req.query.q;
    
    if (!query) {
        const content = `
        <div class="search-container">
            <input type="text" 
                   class="search-bar" 
                   placeholder="Search movies and series..." 
                   id="searchInput"
                   value=""
                   oninput="searchMovies()">
        </div>
        
        <div style="text-align: center; padding: 100px 20px;">
            <i class="fas fa-search" style="font-size: 48px; color: var(--neon-cyan); margin-bottom: 20px;"></i>
            <h2 style="margin-bottom: 15px;">Search Movies & Series</h2>
            <p style="color: #aaa;">Enter a title in the search bar above to find content.</p>
        </div>
        `;
        
        return res.send(generateHTML(content, 'Search - Beraflix'));
    }
    
    try {
        const results = await fetchAPI(`/search?q=${encodeURIComponent(query)}`);
        
        const content = `
        <div class="search-container">
            <input type="text" 
                   class="search-bar" 
                   placeholder="Search movies and series..." 
                   id="searchInput"
                   value="${query.replace(/"/g, '&quot;')}"
                   oninput="searchMovies()">
        </div>
        
        <div class="section">
            <h2 class="section-title">Search Results for "${query}"</h2>
            
            ${results && results.data && results.data.length > 0 ? `
                <div class="cards-grid">
                    ${results.data.map(item => `
                        <div class="movie-card" data-id="${item.id}" data-type="${item.type || 'movie'}">
                            <img src="${IMG_BASE}${item.poster}" alt="${item.title}"
                                 onerror="this.src='https://via.placeholder.com/150x225/111111/00eaff?text=NO+IMAGE'">
                            <div class="quality-badge">${item.type === 'series' ? 'Series' : (item.quality || 'HD')}</div>
                            <div class="movie-info">
                                <div class="movie-title">${item.title}</div>
                                <div class="movie-meta">
                                    <span>${item.year || 'N/A'}</span>
                                    <span>${item.type === 'series' ? 'Series' : 'Movie'}</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div style="text-align: center; padding: 50px 20px;">
                    <i class="fas fa-search-minus" style="font-size: 48px; color: var(--neon-pink); margin-bottom: 20px;"></i>
                    <h3 style="margin-bottom: 15px;">No Results Found</h3>
                    <p style="color: #aaa;">Try a different search term or browse our collections.</p>
                </div>
            `}
        </div>
        `;
        
        res.send(generateHTML(content, `"${query}" - Search - Beraflix`));
    } catch (error) {
        res.send(generateHTML(`
            <div class="search-container">
                <input type="text" 
                       class="search-bar" 
                       placeholder="Search movies and series..." 
                       id="searchInput"
                       value="${query.replace(/"/g, '&quot;')}"
                       oninput="searchMovies()">
            </div>
            
            <div style="text-align: center; padding: 100px 20px;">
                <h2 style="color: var(--neon-pink); margin-bottom: 20px;">Search Failed</h2>
                <p style="color: #aaa; margin-bottom: 30px;">There was an error performing your search.</p>
                <button onclick="window.location.reload()" 
                        style="background: linear-gradient(45deg, var(--neon-cyan), var(--neon-purple)); color: white; border: none; padding: 12px 24px; border-radius: 25px; cursor: pointer;">
                    Try Again
                </button>
            </div>
        `, 'Search Error - Beraflix'));
    }
});

// API Routes
app.get('/api/movies', async (req, res) => {
    try {
        const data = await fetchAPI('/movies');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/series', async (req, res) => {
    try {
        const data = await fetchAPI('/series');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/trending', async (req, res) => {
    try {
        const data = await fetchAPI('/trending');
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json({ data: [] });
        }
        
        const data = await fetchAPI(`/search?q=${encodeURIComponent(query)}`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/movie/:id', async (req, res) => {
    try {
        const data = await fetchAPI(`/movie/${req.params.id}`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/series/:id', async (req, res) => {
    try {
        const data = await fetchAPI(`/series/${req.params.id}`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/series/:id/season/:season', async (req, res) => {
    try {
        const data = await fetchAPI(`/series/${req.params.id}/season/${req.params.season}`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Static files fallback
app.use(express.static('public'));

// 404 handler
app.use((req, res) => {
    res.status(404).send(generateHTML(`
        <div style="text-align: center; padding: 100px 20px;">
            <h1 style="font-size: 72px; color: var(--neon-cyan); margin-bottom: 20px;">404</h1>
            <h2 style="margin-bottom: 20px;">Page Not Found</h2>
            <p style="color: #aaa; margin-bottom: 30px; max-width: 500px; margin-left: auto; margin-right: auto;">
                The page you're looking for doesn't exist or has been moved.
            </p>
            <a href="/" style="display: inline-block; background: linear-gradient(45deg, var(--neon-cyan), var(--neon-purple)); color: white; padding: 15px 35px; border-radius: 25px; text-decoration: none; font-weight: bold; font-size: 16px;">
                Back to Home
            </a>
        </div>
    `, '404 - Beraflix'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║      BERAFLIX STREAMING SERVER        ║
    ║            v1.0 - Production          ║
    ║                                       ║
    ║  🔗 Local: http://localhost:${PORT}      ║
    ║  🌐 Neon UI: BWM + MovieBox Inspired  ║
    ║  📱 Mobile Optimized                  ║
    ║  ⚡ Puppeteer Fallback Enabled        ║
    ║  🎬 Real API Integration              ║
    ║  💾 Download Support                  ║
    ╚═══════════════════════════════════════╝
    `);
});
