/**
 * CLOUD.MOVIES - Bera Tech Movie Streaming Platform
 * Complete PWA Movie Streaming & Download Platform
 * Single server.js implementation
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Gifted Movies API configuration
const GIFTED_API_BASE = 'https://movieapi.giftedtech.co.ke';
const DOWNLOAD_API_BASE = 'https://api.giftedtech.co.ke/api/download';

// Cache for API responses (in-memory)
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper function to fetch from API with caching
async function fetchFromAPI(endpoint) {
    const cacheKey = crypto.createHash('md5').update(endpoint).digest('hex');
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    
    try {
        const response = await axios.get(endpoint, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
        });
        
        return response.data;
    } catch (error) {
        console.error('API Error:', error.message);
        throw new Error('Failed to fetch data from API');
    }
}

// Serve static files from memory
const staticFiles = {};

// Generate HTML for the frontend
function generateFrontend() {
    return `
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CLOUD.MOVIES - Bera Tech Premium Streaming</title>
    <meta name="description" content="Stream and download movies in HD. Bera Tech's premium movie streaming platform.">
    <meta name="theme-color" content="#1a1a2e">
    
    <!-- PWA Manifest -->
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>">
    <link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>">
    
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <style>
        :root {
            --primary: #6C63FF;
            --primary-dark: #554fd8;
            --secondary: #FF6584;
            --dark-bg: #0f0f23;
            --dark-card: #1a1a2e;
            --dark-text: #ffffff;
            --light-bg: #f5f5f7;
            --light-card: #ffffff;
            --light-text: #333333;
            --gray: #8a8a9e;
            --success: #4CAF50;
            --warning: #FF9800;
            --radius: 12px;
            --shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            --transition: all 0.3s ease;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--dark-bg);
            color: var(--dark-text);
            line-height: 1.6;
            overflow-x: hidden;
            transition: var(--transition);
        }

        body.light-mode {
            background: var(--light-bg);
            color: var(--light-text);
        }

        /* Age Verification Modal */
        #ageModal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(10px);
        }

        .modal-content {
            background: var(--dark-card);
            padding: 40px;
            border-radius: var(--radius);
            text-align: center;
            max-width: 500px;
            width: 90%;
            box-shadow: var(--shadow);
            border: 2px solid var(--primary);
            animation: modalSlideIn 0.5s ease;
        }

        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: translateY(-50px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .modal-content h2 {
            font-family: 'Poppins', sans-serif;
            font-size: 2rem;
            margin-bottom: 20px;
            color: var(--primary);
        }

        .modal-buttons {
            display: flex;
            gap: 20px;
            justify-content: center;
            margin-top: 30px;
        }

        .btn {
            padding: 12px 30px;
            border: none;
            border-radius: var(--radius);
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            font-size: 1rem;
            min-width: 120px;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
        }

        .btn-secondary {
            background: transparent;
            color: var(--gray);
            border: 2px solid var(--gray);
        }

        .btn-secondary:hover {
            border-color: var(--primary);
            color: var(--primary);
        }

        /* Header & Navigation */
        header {
            background: rgba(26, 26, 46, 0.95);
            backdrop-filter: blur(10px);
            position: fixed;
            top: 0;
            width: 100%;
            z-index: 1000;
            border-bottom: 1px solid rgba(108, 99, 255, 0.2);
        }

        body.light-mode header {
            background: rgba(255, 255, 255, 0.95);
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .nav-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Poppins', sans-serif;
            font-size: 1.8rem;
            font-weight: 700;
            color: var(--primary);
            text-decoration: none;
        }

        .logo span {
            color: var(--secondary);
        }

        .search-container {
            flex: 1;
            max-width: 600px;
            margin: 0 30px;
            position: relative;
        }

        #searchInput {
            width: 100%;
            padding: 12px 20px;
            padding-right: 50px;
            background: rgba(255, 255, 255, 0.1);
            border: 2px solid rgba(108, 99, 255, 0.3);
            border-radius: var(--radius);
            color: var(--dark-text);
            font-size: 1rem;
            transition: var(--transition);
        }

        body.light-mode #searchInput {
            background: rgba(0, 0, 0, 0.05);
            border-color: rgba(0, 0, 0, 0.1);
            color: var(--light-text);
        }

        #searchInput:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.2);
        }

        #searchResults {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--dark-card);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            margin-top: 5px;
            max-height: 400px;
            overflow-y: auto;
            display: none;
            z-index: 1001;
        }

        body.light-mode #searchResults {
            background: var(--light-card);
        }

        .search-result-item {
            padding: 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            align-items: center;
            gap: 15px;
        }

        body.light-mode .search-result-item {
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        }

        .search-result-item:hover {
            background: rgba(108, 99, 255, 0.1);
        }

        .search-result-item img {
            width: 50px;
            height: 70px;
            object-fit: cover;
            border-radius: 8px;
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .theme-toggle {
            background: none;
            border: none;
            color: var(--dark-text);
            cursor: pointer;
            font-size: 1.5rem;
            padding: 5px;
            transition: var(--transition);
        }

        body.light-mode .theme-toggle {
            color: var(--light-text);
        }

        .install-btn {
            background: var(--primary);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: var(--radius);
            cursor: pointer;
            display: none;
            font-weight: 500;
            transition: var(--transition);
        }

        .install-btn:hover {
            background: var(--primary-dark);
        }

        /* Main Content */
        main {
            margin-top: 80px;
            padding: 20px;
            max-width: 1400px;
            margin-left: auto;
            margin-right: auto;
        }

        .hero {
            text-align: center;
            padding: 60px 20px;
            background: linear-gradient(135deg, rgba(108, 99, 255, 0.1), rgba(255, 101, 132, 0.1));
            border-radius: var(--radius);
            margin-bottom: 40px;
            animation: fadeIn 1s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .hero h1 {
            font-family: 'Poppins', sans-serif;
            font-size: 3.5rem;
            margin-bottom: 20px;
            background: linear-gradient(45deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .hero p {
            font-size: 1.2rem;
            color: var(--gray);
            max-width: 600px;
            margin: 0 auto 30px;
        }

        /* Movie Sections */
        .section-title {
            font-family: 'Poppins', sans-serif;
            font-size: 1.8rem;
            margin: 40px 0 20px;
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .movies-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        }

        .movie-card {
            background: var(--dark-card);
            border-radius: var(--radius);
            overflow: hidden;
            transition: var(--transition);
            cursor: pointer;
            animation: cardSlideUp 0.5s ease;
            animation-fill-mode: both;
        }

        body.light-mode .movie-card {
            background: var(--light-card);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }

        @keyframes cardSlideUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .movie-card:hover {
            transform: translateY(-10px);
            box-shadow: var(--shadow);
        }

        .movie-card img {
            width: 100%;
            height: 300px;
            object-fit: cover;
            transition: var(--transition);
        }

        .movie-card:hover img {
            transform: scale(1.05);
        }

        .movie-info {
            padding: 15px;
        }

        .movie-title {
            font-weight: 600;
            margin-bottom: 5px;
            font-size: 1.1rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .movie-meta {
            display: flex;
            justify-content: space-between;
            color: var(--gray);
            font-size: 0.9rem;
        }

        .rating {
            color: var(--warning);
            font-weight: 500;
        }

        /* Movie Details Modal */
        .details-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            padding: 20px;
            overflow-y: auto;
        }

        .details-content {
            background: var(--dark-card);
            border-radius: var(--radius);
            max-width: 1200px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            position: relative;
            animation: modalScaleIn 0.3s ease;
        }

        body.light-mode .details-content {
            background: var(--light-card);
        }

        @keyframes modalScaleIn {
            from {
                opacity: 0;
                transform: scale(0.9);
            }
            to {
                opacity: 1;
                transform: scale(1);
            }
        }

        .close-modal {
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            font-size: 1.5rem;
            cursor: pointer;
            z-index: 2001;
            transition: var(--transition);
        }

        .close-modal:hover {
            background: var(--primary);
        }

        .movie-hero {
            position: relative;
            height: 400px;
            overflow: hidden;
        }

        .movie-hero img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: brightness(0.6);
        }

        .movie-hero-content {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            padding: 40px;
            background: linear-gradient(transparent, rgba(0, 0, 0, 0.9));
        }

        .movie-details-grid {
            display: grid;
            grid-template-columns: 1fr 300px;
            gap: 40px;
            padding: 40px;
        }

        @media (max-width: 768px) {
            .movie-details-grid {
                grid-template-columns: 1fr;
            }
        }

        .quality-selector {
            display: flex;
            gap: 10px;
            margin: 20px 0;
        }

        .quality-btn {
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid var(--primary);
            color: var(--dark-text);
            border-radius: var(--radius);
            cursor: pointer;
            transition: var(--transition);
        }

        .quality-btn.active {
            background: var(--primary);
            color: white;
        }

        /* Loading Animation */
        .loader {
            display: inline-block;
            width: 50px;
            height: 50px;
            border: 3px solid rgba(108, 99, 255, 0.3);
            border-radius: 50%;
            border-top-color: var(--primary);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Footer */
        footer {
            background: var(--dark-card);
            padding: 40px 20px;
            margin-top: 60px;
            text-align: center;
            border-top: 1px solid rgba(108, 99, 255, 0.2);
        }

        body.light-mode footer {
            background: var(--light-card);
            border-top: 1px solid rgba(0, 0, 0, 0.1);
        }

        .footer-content {
            max-width: 1200px;
            margin: 0 auto;
        }

        .footer-logo {
            font-family: 'Poppins', sans-serif;
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 20px;
        }

        .footer-links {
            display: flex;
            justify-content: center;
            gap: 30px;
            margin: 20px 0;
            flex-wrap: wrap;
        }

        .footer-links a {
            color: var(--gray);
            text-decoration: none;
            transition: var(--transition);
        }

        .footer-links a:hover {
            color: var(--primary);
        }

        .copyright {
            color: var(--gray);
            margin-top: 30px;
            font-size: 0.9rem;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .nav-container {
                flex-direction: column;
                gap: 15px;
            }
            
            .search-container {
                margin: 10px 0;
                width: 100%;
            }
            
            .hero h1 {
                font-size: 2.5rem;
            }
            
            .movies-grid {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
            }
            
            main {
                margin-top: 140px;
            }
        }

        /* PWA Install Banner */
        .install-banner {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--dark-card);
            padding: 15px 20px;
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            display: none;
            align-items: center;
            gap: 15px;
            z-index: 1000;
            animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        body.light-mode .install-banner {
            background: var(--light-card);
        }

        /* Toast Notifications */
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--dark-card);
            color: var(--dark-text);
            padding: 15px 25px;
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            display: none;
            align-items: center;
            gap: 10px;
            z-index: 1000;
            animation: slideInRight 0.3s ease;
        }

        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        body.light-mode .toast {
            background: var(--light-card);
            color: var(--light-text);
        }

        /* Progress Bar for Streaming */
        .progress-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: rgba(255, 255, 255, 0.1);
            z-index: 9999;
            display: none;
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
            width: 0%;
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <!-- Age Verification Modal -->
    <div id="ageModal">
        <div class="modal-content">
            <h2>🔞 Age Verification</h2>
            <p>CLOUD.MOVIES contains content suitable for viewers aged 18 and above. By entering, you confirm that you are at least 18 years old.</p>
            <div class="modal-buttons">
                <button class="btn btn-primary" id="confirmAge">I'm 18 or older</button>
                <button class="btn btn-secondary" id="denyAge">I'm under 18</button>
            </div>
            <p style="margin-top: 20px; font-size: 0.9rem; color: var(--gray);">© 2024 Bera Tech - CLOUD.MOVIES</p>
        </div>
    </div>

    <!-- Progress Bar -->
    <div class="progress-container">
        <div class="progress-bar"></div>
    </div>

    <!-- Install Banner -->
    <div class="install-banner" id="installBanner">
        <span>Install CLOUD.MOVIES for better experience</span>
        <button class="btn btn-primary" id="installBtn">Install</button>
        <button class="btn btn-secondary" id="dismissInstall">Not Now</button>
    </div>

    <!-- Toast Notification -->
    <div class="toast" id="toast"></div>

    <!-- Header -->
    <header>
        <div class="nav-container">
            <a href="#" class="logo">
                🎬 CLOUD.<span>MOVIES</span>
            </a>
            
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search movies, TV series...">
                <div id="searchResults"></div>
            </div>
            
            <div class="header-actions">
                <button class="theme-toggle" id="themeToggle">🌙</button>
                <button class="install-btn" id="headerInstallBtn">📱 Install App</button>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main>
        <section class="hero">
            <h1>Stream Unlimited Movies & TV Shows</h1>
            <p>Bera Tech's premium streaming platform. Watch in HD, download offline, and enjoy exclusive content.</p>
            <div class="search-container" style="max-width: 500px; margin: 30px auto;">
                <input type="text" id="heroSearch" placeholder="What do you want to watch today?">
            </div>
        </section>

        <!-- Movie Sections -->
        <section id="featuredSection">
            <h2 class="section-title">⭐ Featured Movies</h2>
            <div class="movies-grid" id="featuredMovies">
                <!-- Featured movies will be loaded here -->
            </div>
        </section>

        <section id="trendingSection">
            <h2 class="section-title">🔥 Trending Now</h2>
            <div class="movies-grid" id="trendingMovies">
                <!-- Trending movies will be loaded here -->
            </div>
        </section>

        <section id="latestSection">
            <h2 class="section-title">🆕 Latest Releases</h2>
            <div class="movies-grid" id="latestMovies">
                <!-- Latest movies will be loaded here -->
            </div>
        </section>

        <section id="topRatedSection">
            <h2 class="section-title">🏆 Top Rated</h2>
            <div class="movies-grid" id="topRatedMovies">
                <!-- Top rated movies will be loaded here -->
            </div>
        </section>
    </main>

    <!-- Movie Details Modal -->
    <div class="details-modal" id="movieDetailsModal">
        <div class="details-content">
            <button class="close-modal" id="closeDetails">×</button>
            <div class="movie-hero">
                <img id="detailHeroImg" src="" alt="">
                <div class="movie-hero-content">
                    <h1 id="detailTitle"></h1>
                    <div id="detailMeta"></div>
                </div>
            </div>
            <div class="movie-details-grid">
                <div>
                    <h3>Overview</h3>
                    <p id="detailDescription"></p>
                    
                    <h3 style="margin-top: 30px;">Cast</h3>
                    <div id="detailCast"></div>
                    
                    <h3 style="margin-top: 30px;">Stream & Download</h3>
                    <div class="quality-selector">
                        <button class="quality-btn active" data-quality="360p">360p</button>
                        <button class="quality-btn" data-quality="480p">480p</button>
                        <button class="quality-btn" data-quality="720p">720p</button>
                    </div>
                    <div style="display: flex; gap: 15px; margin-top: 20px;">
                        <button class="btn btn-primary" id="streamBtn">▶ Stream Now</button>
                        <button class="btn btn-secondary" id="downloadBtn">⬇ Download</button>
                    </div>
                </div>
                <div>
                    <h3>Details</h3>
                    <div id="detailInfo"></div>
                    
                    <div style="margin-top: 30px; padding: 20px; background: rgba(108, 99, 255, 0.1); border-radius: var(--radius);">
                        <h4>📱 Watch Offline</h4>
                        <p style="margin: 10px 0; font-size: 0.9rem;">Install CLOUD.MOVIES as PWA to watch movies offline!</p>
                        <button class="btn btn-primary" id="pwaInstallBtn" style="width: 100%;">Install App</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <footer>
        <div class="footer-content">
            <div class="footer-logo">CLOUD.MOVIES</div>
            <p>Bera Tech's Premium Streaming Platform</p>
            <div class="footer-links">
                <a href="#" data-section="featured">Home</a>
                <a href="#" data-section="trending">Trending</a>
                <a href="#" data-section="latest">Latest</a>
                <a href="#" data-section="topRated">Top Rated</a>
                <a href="#" id="aboutLink">About</a>
                <a href="#" id="contactLink">Contact</a>
            </div>
            <div class="copyright">
                © 2024 Bera Tech. All rights reserved. Movies provided by Gifted Movies API.
            </div>
        </div>
    </footer>

    <script>
        // Global State
        let currentMovieId = null;
        let currentQuality = '360p';
        let deferredPrompt = null;
        let isPWAInstalled = false;
        let ageVerified = localStorage.getItem('ageVerified') === 'true';

        // DOM Elements
        const ageModal = document.getElementById('ageModal');
        const confirmAgeBtn = document.getElementById('confirmAge');
        const denyAgeBtn = document.getElementById('denyAge');
        const themeToggle = document.getElementById('themeToggle');
        const searchInput = document.getElementById('searchInput');
        const heroSearch = document.getElementById('heroSearch');
        const searchResults = document.getElementById('searchResults');
        const installBanner = document.getElementById('installBanner');
        const installBtn = document.getElementById('installBtn');
        const headerInstallBtn = document.getElementById('headerInstallBtn');
        const pwaInstallBtn = document.getElementById('pwaInstallBtn');
        const dismissInstall = document.getElementById('dismissInstall');
        const movieDetailsModal = document.getElementById('movieDetailsModal');
        const closeDetails = document.getElementById('closeDetails');
        const streamBtn = document.getElementById('streamBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const toast = document.getElementById('toast');
        const progressContainer = document.querySelector('.progress-container');
        const progressBar = document.querySelector('.progress-bar');

        // Initialize
        document.addEventListener('DOMContentLoaded', async () => {
            // Age Verification
            if (!ageVerified) {
                ageModal.style.display = 'flex';
            } else {
                ageModal.style.display = 'none';
                await loadHomepageContent();
            }

            // Theme
            const savedTheme = localStorage.getItem('theme') || 'dark';
            setTheme(savedTheme);

            // Search functionality
            setupSearch();
            
            // PWA Installation
            setupPWA();
            
            // Event Listeners
            setupEventListeners();
        });

        // Age Verification
        confirmAgeBtn.addEventListener('click', () => {
            localStorage.setItem('ageVerified', 'true');
            ageModal.style.display = 'none';
            ageVerified = true;
            loadHomepageContent();
            showToast('Age verified successfully!', 'success');
        });

        denyAgeBtn.addEventListener('click', () => {
            document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center;"><div><h1 style="color: var(--primary);">Access Denied</h1><p>You must be 18 or older to access this content.</p><p>© 2024 Bera Tech - CLOUD.MOVIES</p></div></div>';
        });

        // Theme Toggle
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);
        });

        function setTheme(theme) {
            if (theme === 'light') {
                document.body.classList.add('light-mode');
                themeToggle.textContent = '☀️';
            } else {
                document.body.classList.remove('light-mode');
                themeToggle.textContent = '🌙';
            }
            localStorage.setItem('theme', theme);
        }

        // Search Functionality
        function setupSearch() {
            let searchTimeout;
            
            const performSearch = async (query) => {
                if (query.length < 2) {
                    searchResults.style.display = 'none';
                    return;
                }
                
                try {
                    const response = await fetch(\`/api/search/\${encodeURIComponent(query)}\`);
                    const data = await response.json();
                    
                    if (data.success && data.data) {
                        displaySearchResults(data.data);
                    } else {
                        searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
                        searchResults.style.display = 'block';
                    }
                } catch (error) {
                    console.error('Search error:', error);
                }
            };
            
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
            });
            
            heroSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
            });
            
            // Close search results when clicking outside
            document.addEventListener('click', (e) => {
                if (!searchResults.contains(e.target) && e.target !== searchInput && e.target !== heroSearch) {
                    searchResults.style.display = 'none';
                }
            });
        }

        function displaySearchResults(results) {
            searchResults.innerHTML = '';
            
            results.slice(0, 10).forEach(movie => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = \`
                    <img src="\${movie.image || 'https://via.placeholder.com/50x70/1a1a2e/ffffff?text=No+Image'}" alt="\${movie.title}">
                    <div>
                        <div style="font-weight: 500;">\${movie.title}</div>
                        <div style="font-size: 0.8rem; color: var(--gray);">\${movie.year || 'N/A'} • \${movie.type || 'Movie'}</div>
                    </div>
                \`;
                
                item.addEventListener('click', () => {
                    showMovieDetails(movie.id);
                    searchResults.style.display = 'none';
                    searchInput.value = '';
                    heroSearch.value = '';
                });
                
                searchResults.appendChild(item);
            });
            
            searchResults.style.display = 'block';
        }

        // Load Homepage Content
        async function loadHomepageContent() {
            const sections = ['featured', 'trending', 'latest', 'topRated'];
            
            for (const section of sections) {
                try {
                    const response = await fetch(\`/api/discover/\${section}\`);
                    const data = await response.json();
                    
                    if (data.success && data.data) {
                        displayMovies(section, data.data.slice(0, 12));
                    }
                } catch (error) {
                    console.error(\`Error loading \${section}:\`, error);
                    document.getElementById(\`\${section}Movies\`).innerHTML = 
                        '<div style="text-align: center; padding: 40px; color: var(--gray);">Failed to load movies</div>';
                }
            }
        }

        function displayMovies(sectionId, movies) {
            const container = document.getElementById(\`\${sectionId}Movies\`);
            container.innerHTML = '';
            
            movies.forEach((movie, index) => {
                const card = document.createElement('div');
                card.className = 'movie-card';
                card.style.animationDelay = \`\${index * 0.05}s\`;
                
                card.innerHTML = \`
                    <img src="\${movie.image || 'https://via.placeholder.com/200x300/1a1a2e/ffffff?text=No+Image'}" 
                         alt="\${movie.title}" 
                         onerror="this.src='https://via.placeholder.com/200x300/1a1a2e/ffffff?text=No+Image'">
                    <div class="movie-info">
                        <div class="movie-title">\${movie.title || 'Untitled'}</div>
                        <div class="movie-meta">
                            <span>\${movie.year || 'N/A'}</span>
                            <span class="rating">⭐ \${movie.rating || 'N/A'}</span>
                        </div>
                    </div>
                \`;
                
                card.addEventListener('click', () => showMovieDetails(movie.id));
                container.appendChild(card);
            });
        }

        // Movie Details
        async function showMovieDetails(movieId) {
            currentMovieId = movieId;
            showProgress();
            
            try {
                const response = await fetch(\`/api/info/\${movieId}\`);
                const data = await response.json();
                
                if (data.success && data.data) {
                    updateMovieDetailsUI(data.data);
                    movieDetailsModal.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                }
            } catch (error) {
                console.error('Error loading movie details:', error);
                showToast('Failed to load movie details', 'error');
            } finally {
                hideProgress();
            }
        }

        function updateMovieDetailsUI(movie) {
            document.getElementById('detailHeroImg').src = movie.image || '';
            document.getElementById('detailTitle').textContent = movie.title || 'Unknown Title';
            
            // Meta info
            const meta = document.getElementById('detailMeta');
            meta.innerHTML = \`
                <div style="display: flex; gap: 15px; margin: 10px 0;">
                    <span>⭐ \${movie.rating || 'N/A'}</span>
                    <span>📅 \${movie.releaseDate || 'N/A'}</span>
                    <span>🎭 \${movie.genre?.join(', ') || 'N/A'}</span>
                </div>
            \`;
            
            // Description
            document.getElementById('detailDescription').textContent = movie.description || 'No description available.';
            
            // Cast
            const castContainer = document.getElementById('detailCast');
            if (movie.cast && movie.cast.length > 0) {
                castContainer.innerHTML = movie.cast.slice(0, 6).map(actor => 
                    \`<div style="display: inline-block; background: rgba(108, 99, 255, 0.1); padding: 5px 10px; border-radius: 20px; margin: 5px;">\${actor}</div>\`
                ).join('');
            } else {
                castContainer.textContent = 'Cast information not available.';
            }
            
            // Details
            const infoContainer = document.getElementById('detailInfo');
            infoContainer.innerHTML = \`
                <p><strong>Type:</strong> \${movie.type || 'Movie'}</p>
                <p><strong>Duration:</strong> \${movie.duration || 'N/A'}</p>
                <p><strong>Country:</strong> \${movie.country || 'N/A'}</p>
                <p><strong>Director:</strong> \${movie.director || 'N/A'}</p>
                <p><strong>Production:</strong> \${movie.production || 'N/A'}</p>
            \`;
        }

        // Quality Selection
        document.querySelectorAll('.quality-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentQuality = btn.dataset.quality;
            });
        });

        // Stream Button
        streamBtn.addEventListener('click', async () => {
            if (!currentMovieId) return;
            
            showProgress();
            try {
                const response = await fetch(\`/api/stream/\${currentMovieId}?quality=\${currentQuality}\`);
                const data = await response.json();
                
                if (data.success && data.url) {
                    // Open video player in new modal or redirect
                    window.open(data.url, '_blank');
                    showToast('Streaming started in new tab', 'success');
                }
            } catch (error) {
                console.error('Stream error:', error);
                showToast('Failed to start streaming', 'error');
            } finally {
                hideProgress();
            }
        });

        // Download Button
        downloadBtn.addEventListener('click', async () => {
            if (!currentMovieId) return;
            
            showProgress();
            try {
                const response = await fetch(\`/api/download/\${currentMovieId}?quality=\${currentQuality}\`);
                const blob = await response.blob();
                
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`\${document.getElementById('detailTitle').textContent} - \${currentQuality}.mp4\`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                
                showToast('Download started!', 'success');
            } catch (error) {
                console.error('Download error:', error);
                showToast('Failed to download', 'error');
            } finally {
                hideProgress();
            }
        });

        // Close Modal
        closeDetails.addEventListener('click', () => {
            movieDetailsModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });

        movieDetailsModal.addEventListener('click', (e) => {
            if (e.target === movieDetailsModal) {
                movieDetailsModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });

        // PWA Installation
        function setupPWA() {
            // Check if PWA is already installed
            if (window.matchMedia('(display-mode: standalone)').matches) {
                isPWAInstalled = true;
                headerInstallBtn.style.display = 'none';
            }
            
            // Before install prompt
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                
                // Show install banner after 5 seconds
                setTimeout(() => {
                    if (!isPWAInstalled) {
                        installBanner.style.display = 'flex';
                    }
                }, 5000);
                
                headerInstallBtn.style.display = 'block';
            });
            
            // App installed
            window.addEventListener('appinstalled', () => {
                isPWAInstalled = true;
                installBanner.style.display = 'none';
                headerInstallBtn.style.display = 'none';
                showToast('App installed successfully!', 'success');
            });
        }

        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    installBanner.style.display = 'none';
                }
                
                deferredPrompt = null;
            }
        });

        headerInstallBtn.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
            }
        });

        pwaInstallBtn.addEventListener('click', () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
            }
        });

        dismissInstall.addEventListener('click', () => {
            installBanner.style.display = 'none';
        });

        // Service Worker Registration
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').then(registration => {
                    console.log('ServiceWorker registered:', registration);
                }).catch(error => {
                    console.log('ServiceWorker registration failed:', error);
                });
            });
        }

        // Helper Functions
        function showToast(message, type = 'info') {
            toast.textContent = message;
            toast.style.display = 'flex';
            
            setTimeout(() => {
                toast.style.display = 'none';
            }, 3000);
        }

        function showProgress() {
            progressContainer.style.display = 'block';
            let width = 0;
            const interval = setInterval(() => {
                if (width >= 90) {
                    clearInterval(interval);
                } else {
                    width += 10;
                    progressBar.style.width = width + '%';
                }
            }, 100);
        }

        function hideProgress() {
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
            }, 300);
        }

        // Event Listeners Setup
        function setupEventListeners() {
            // Footer links
            document.querySelectorAll('[data-section]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const section = e.target.dataset.section;
                    document.getElementById(\`\${section}Section\`).scrollIntoView({
                        behavior: 'smooth'
                    });
                });
            });
            
            // About and Contact links
            document.getElementById('aboutLink')?.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('CLOUD.MOVIES - Bera Tech Premium Streaming Platform', 'info');
            });
            
            document.getElementById('contactLink')?.addEventListener('click', (e) => {
                e.preventDefault();
                showToast('Contact: support@beratech.cloudmovies', 'info');
            });
        }
    </script>
</body>
</html>`;
}

// Generate Service Worker
function generateServiceWorker() {
    return `
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('cloud-movies-v1').then((cache) => {
            return cache.addAll([
                '/',
                '/manifest.json'
            ]);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((fetchResponse) => {
                // Cache movie data for offline viewing
                if (event.request.url.includes('/api/info/')) {
                    const cacheCopy = fetchResponse.clone();
                    caches.open('cloud-movies-data').then((cache) => {
                        cache.put(event.request, cacheCopy);
                    });
                }
                return fetchResponse;
            });
        }).catch(() => {
            // Return offline page for HTML requests
            if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/');
            }
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = ['cloud-movies-v1', 'cloud-movies-data'];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
`;
}

// Generate PWA Manifest
function generateManifest() {
    return JSON.stringify({
        "name": "CLOUD.MOVIES",
        "short_name": "CloudMovies",
        "description": "Bera Tech Premium Movie Streaming Platform",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0f0f23",
        "theme_color": "#6C63FF",
        "orientation": "portrait-primary",
        "icons": [
            {
                "src": "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22 fill=%22%236C63FF%22>🎬</text></svg>",
                "sizes": "any",
                "type": "image/svg+xml",
                "purpose": "any"
            }
        ],
        "categories": ["entertainment", "movies", "video"],
        "shortcuts": [
            {
                "name": "Trending Movies",
                "short_name": "Trending",
                "description": "Browse trending movies",
                "url": "/?section=trending"
            },
            {
                "name": "Latest Releases",
                "short_name": "Latest",
                "description": "Watch latest movies",
                "url": "/?section=latest"
            }
        ]
    });
}

// API Routes
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const apiUrl = `${GIFTED_API_BASE}/api/search/${encodeURIComponent(query)}`;
        const data = await fetchFromAPI(apiUrl);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const apiUrl = `${GIFTED_API_BASE}/api/info/${id}`;
        const data = await fetchFromAPI(apiUrl);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/sources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode } = req.query;
        let apiUrl = `${GIFTED_API_BASE}/api/sources/${id}`;
        
        if (season && episode) {
            apiUrl += `?season=${season}&episode=${episode}`;
        }
        
        const data = await fetchFromAPI(apiUrl);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/discover/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const searchTerms = {
            featured: 'avengers',
            trending: '2024',
            latest: 'movie',
            topRated: 'high'
        };
        
        const apiUrl = `${GIFTED_API_BASE}/api/search/${encodeURIComponent(searchTerms[type] || 'movie')}`;
        const data = await fetchFromAPI(apiUrl);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Streaming endpoint with quality selection
app.get('/api/stream/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quality = '360p' } = req.query;
        
        const sourcesUrl = `${GIFTED_API_BASE}/api/sources/${id}`;
        const sourcesData = await fetchFromAPI(sourcesUrl);
        
        // Find appropriate quality stream
        let streamUrl = null;
        if (sourcesData && sourcesData.sources) {
            // Sort by quality preference
            const qualityOrder = { '720p': 3, '480p': 2, '360p': 1 };
            const sortedSources = sourcesData.sources.sort((a, b) => 
                (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0)
            );
            
            streamUrl = sortedSources[0]?.url;
        }
        
        if (streamUrl) {
            res.json({ success: true, url: streamUrl, quality });
        } else {
            res.status(404).json({ success: false, error: 'No stream available' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Download endpoint
app.get('/api/download/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quality = '360p' } = req.query;
        
        const sourcesUrl = `${GIFTED_API_BASE}/api/sources/${id}`;
        const sourcesData = await fetchFromAPI(sourcesUrl);
        
        let downloadUrl = null;
        if (sourcesData && sourcesData.sources) {
            const source = sourcesData.sources.find(s => s.quality === quality) || sourcesData.sources[0];
            downloadUrl = source?.url;
        }
        
        if (downloadUrl) {
            // Proxy the download through our server
            const response = await axios({
                method: 'GET',
                url: downloadUrl,
                responseType: 'stream'
            });
            
            res.setHeader('Content-Disposition', `attachment; filename="cloud-movie-${id}-${quality}.mp4"`);
            res.setHeader('Content-Type', 'video/mp4');
            
            response.data.pipe(res);
        } else {
            res.status(404).json({ success: false, error: 'No download available' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve PWA files
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(generateManifest());
});

app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(generateServiceWorker());
});

// Serve the main application
app.get('*', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(generateFrontend());
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
    🚀 CLOUD.MOVIES Server Started!
    📍 Port: ${PORT}
    🌐 URL: http://localhost:${PORT}
    
    📱 PWA Enabled
    🎬 Gifted Movies API Integrated
    ⚡ Production Ready
    
    © 2024 Bera Tech - All rights reserved
    `);
});
