// server.js - Complete Movie Streaming PWA for Bera Tech's CLOUD.MOVIES
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// API Configuration
const GIFTED_API_BASE = 'https://movieapi.giftedtech.co.ke';
const DOWNLOAD_API_BASE = 'https://api.giftedtech.co.ke/api/download';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/assets', express.static(path.join(__dirname, 'public')));

// Serve static files from memory
const staticFiles = {
  '/': `
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0f172a">
    <meta name="description" content="CLOUD.MOVIES - Premium streaming platform by Bera Tech">
    <title>CLOUD.MOVIES - Bera Tech</title>
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" type="image/png" href="/assets/favicon.png">
    <style>
        :root {
            --primary: #3b82f6;
            --secondary: #1e293b;
            --accent: #8b5cf6;
            --dark: #0f172a;
            --light: #f8fafc;
            --gray: #64748b;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: var(--dark);
            color: var(--light);
            min-height: 100vh;
            overflow-x: hidden;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
        }

        /* Header */
        header {
            background: linear-gradient(135deg, var(--dark), var(--secondary));
            padding: 1rem 0;
            position: sticky;
            top: 0;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
        }

        .header-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1rem;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 1.8rem;
            font-weight: bold;
            color: var(--primary);
            text-decoration: none;
        }

        .logo i {
            font-size: 2rem;
        }

        .brand {
            font-size: 0.9rem;
            color: var(--gray);
            font-weight: normal;
        }

        .search-container {
            flex: 1;
            max-width: 500px;
            position: relative;
        }

        .search-input {
            width: 100%;
            padding: 0.8rem 1rem 0.8rem 2.5rem;
            border-radius: 25px;
            border: 2px solid var(--secondary);
            background: rgba(30,41,59,0.8);
            color: var(--light);
            font-size: 1rem;
            transition: all 0.3s;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(59,130,246,0.3);
        }

        .search-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--gray);
        }

        .nav-buttons {
            display: flex;
            gap: 1rem;
            align-items: center;
        }

        .btn {
            padding: 0.6rem 1.2rem;
            border-radius: 8px;
            border: none;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
        }

        .btn-primary:hover {
            background: #2563eb;
            transform: translateY(-2px);
        }

        .btn-secondary {
            background: var(--secondary);
            color: var(--light);
        }

        .btn-secondary:hover {
            background: #334155;
        }

        /* Age Verification Modal */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.95);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            backdrop-filter: blur(10px);
        }

        .age-modal {
            background: linear-gradient(135deg, var(--dark), var(--secondary));
            padding: 2.5rem;
            border-radius: 20px;
            text-align: center;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            border: 2px solid var(--primary);
            animation: modalAppear 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        @keyframes modalAppear {
            from { opacity: 0; transform: scale(0.8) rotate(-5deg); }
            to { opacity: 1; transform: scale(1) rotate(0); }
        }

        .age-modal i {
            font-size: 4rem;
            color: var(--primary);
            margin-bottom: 1.5rem;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }

        .age-modal h2 {
            font-size: 2rem;
            margin-bottom: 1rem;
            color: var(--light);
        }

        .age-modal p {
            color: var(--gray);
            margin-bottom: 2rem;
            line-height: 1.6;
        }

        .age-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
        }

        .btn-lg {
            padding: 1rem 2rem;
            font-size: 1.1rem;
            min-width: 140px;
        }

        /* Hero Section */
        .hero {
            background: linear-gradient(rgba(15,23,42,0.9), rgba(15,23,42,0.9)), url('/api/placeholder/1200/400');
            background-size: cover;
            background-position: center;
            padding: 4rem 0;
            text-align: center;
            border-bottom: 2px solid var(--secondary);
        }

        .hero h1 {
            font-size: 3rem;
            margin-bottom: 1rem;
            background: linear-gradient(45deg, var(--primary), var(--accent));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: gradientShift 3s infinite;
        }

        @keyframes gradientShift {
            0%, 100% { filter: hue-rotate(0deg); }
            50% { filter: hue-rotate(20deg); }
        }

        .hero p {
            font-size: 1.2rem;
            color: var(--gray);
            max-width: 600px;
            margin: 0 auto 2rem;
        }

        /* Movie Sections */
        .section {
            padding: 3rem 0;
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 2px solid var(--secondary);
        }

        .section-title {
            font-size: 1.8rem;
            color: var(--light);
            display: flex;
            align-items: center;
            gap: 0.8rem;
        }

        .movie-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1.5rem;
            padding: 1rem 0;
        }

        .movie-card {
            background: var(--secondary);
            border-radius: 12px;
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            cursor: pointer;
        }

        .movie-card:hover {
            transform: translateY(-10px) scale(1.03);
            box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }

        .movie-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--primary), var(--accent));
            transform: scaleX(0);
            transition: transform 0.3s;
        }

        .movie-card:hover::before {
            transform: scaleX(1);
        }

        .movie-poster {
            width: 100%;
            height: 300px;
            object-fit: cover;
            transition: transform 0.5s;
        }

        .movie-card:hover .movie-poster {
            transform: scale(1.1);
        }

        .movie-info {
            padding: 1rem;
        }

        .movie-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            color: var(--light);
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
            font-weight: bold;
        }

        /* Movie Detail Page */
        .movie-detail {
            padding: 2rem 0;
        }

        .detail-header {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 3rem;
            margin-bottom: 3rem;
        }

        @media (max-width: 768px) {
            .detail-header {
                grid-template-columns: 1fr;
            }
        }

        .detail-poster {
            width: 100%;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }

        .detail-info h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            color: var(--light);
        }

        .detail-meta {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
            margin-bottom: 1.5rem;
        }

        .tag {
            background: rgba(59,130,246,0.2);
            padding: 0.3rem 0.8rem;
            border-radius: 20px;
            font-size: 0.9rem;
            color: var(--primary);
            border: 1px solid var(--primary);
        }

        .description {
            color: var(--gray);
            line-height: 1.7;
            margin-bottom: 2rem;
            font-size: 1.1rem;
        }

        .cast-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .cast-card {
            text-align: center;
        }

        .cast-avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            object-fit: cover;
            margin-bottom: 0.5rem;
            border: 2px solid var(--primary);
        }

        .quality-selector {
            display: flex;
            gap: 1rem;
            margin: 2rem 0;
            flex-wrap: wrap;
        }

        .quality-btn {
            padding: 0.8rem 1.5rem;
            border: 2px solid var(--primary);
            background: transparent;
            color: var(--primary);
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.3s;
            font-weight: 600;
        }

        .quality-btn:hover, .quality-btn.active {
            background: var(--primary);
            color: white;
            transform: translateY(-3px);
        }

        .video-player {
            width: 100%;
            background: black;
            border-radius: 12px;
            overflow: hidden;
            margin: 2rem 0;
        }

        .video-player video {
            width: 100%;
            max-height: 70vh;
        }

        /* Search Results */
        .search-results {
            padding: 2rem 0;
        }

        .results-count {
            color: var(--gray);
            margin-bottom: 2rem;
        }

        /* Footer */
        footer {
            background: var(--secondary);
            padding: 3rem 0 1.5rem;
            margin-top: 4rem;
            border-top: 2px solid var(--primary);
        }

        .footer-content {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin-bottom: 2rem;
        }

        .footer-section h3 {
            color: var(--primary);
            margin-bottom: 1.5rem;
            font-size: 1.2rem;
        }

        .footer-links {
            list-style: none;
        }

        .footer-links li {
            margin-bottom: 0.8rem;
        }

        .footer-links a {
            color: var(--gray);
            text-decoration: none;
            transition: color 0.3s;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .footer-links a:hover {
            color: var(--primary);
        }

        .copyright {
            text-align: center;
            padding-top: 2rem;
            border-top: 1px solid rgba(100,116,139,0.3);
            color: var(--gray);
            font-size: 0.9rem;
        }

        /* Loading */
        .loading {
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 4rem;
        }

        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid var(--secondary);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Toast */
        .toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: var(--secondary);
            color: var(--light);
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            border-left: 4px solid var(--primary);
            transform: translateX(100%);
            opacity: 0;
            transition: all 0.3s;
            z-index: 1001;
        }

        .toast.show {
            transform: translateX(0);
            opacity: 1;
        }

        /* Dark/Light Mode */
        body.light {
            background: var(--light);
            color: var(--dark);
        }

        body.light .movie-card,
        body.light header,
        body.light footer,
        body.light .age-modal {
            background: white;
            color: var(--dark);
        }

        body.light .movie-title,
        body.light .section-title {
            color: var(--dark);
        }

        /* Install Prompt */
        .install-prompt {
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: var(--secondary);
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 1rem;
            z-index: 1000;
            border: 2px solid var(--primary);
            animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
            from { bottom: -100px; opacity: 0; }
            to { bottom: 2rem; opacity: 1; }
        }

        .install-prompt button {
            padding: 0.5rem 1rem;
            border-radius: 6px;
            border: none;
            background: var(--primary);
            color: white;
            cursor: pointer;
            font-weight: 600;
        }

        .close-install {
            background: transparent !important;
            color: var(--gray);
            font-size: 1.5rem;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
            }
            
            .search-container {
                max-width: 100%;
                order: 3;
            }
            
            .hero h1 {
                font-size: 2.2rem;
            }
            
            .movie-grid {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            }
            
            .age-buttons {
                flex-direction: column;
            }
            
            .btn-lg {
                width: 100%;
            }
        }

        /* Favorites */
        .favorite-btn {
            background: transparent;
            border: 2px solid var(--danger);
            color: var(--danger);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s;
            position: absolute;
            top: 1rem;
            right: 1rem;
            z-index: 10;
        }

        .favorite-btn.active {
            background: var(--danger);
            color: white;
        }

        .favorite-btn:hover {
            transform: scale(1.1);
        }
    </style>
</head>
<body>
    <!-- Age Verification Modal -->
    <div id="ageModal" class="modal-overlay" style="display: none;">
        <div class="age-modal">
            <i class="fas fa-film"></i>
            <h2>Age Verification Required</h2>
            <p>CLOUD.MOVIES contains content intended for mature audiences (18+). By entering this site, you confirm that you are at least 18 years old and agree to our Terms of Service.</p>
            <div class="age-buttons">
                <button onclick="verifyAge(true)" class="btn btn-primary btn-lg">
                    <i class="fas fa-check"></i> I'm 18+
                </button>
                <button onclick="verifyAge(false)" class="btn btn-secondary btn-lg">
                    <i class="fas fa-times"></i> Exit
                </button>
            </div>
            <p style="margin-top: 1rem; font-size: 0.9rem; color: #64748b;">
                By Bera Tech &copy; ${new Date().getFullYear()}
            </p>
        </div>
    </div>

    <!-- Install Prompt -->
    <div id="installPrompt" class="install-prompt" style="display: none;">
        <i class="fas fa-download" style="color: #3b82f6; font-size: 1.5rem;"></i>
        <div style="flex: 1;">
            <strong>Install CLOUD.MOVIES</strong>
            <p style="font-size: 0.9rem; color: #94a3b8; margin-top: 0.2rem;">Watch offline, faster access</p>
        </div>
        <button onclick="installApp()">Install</button>
        <button onclick="closeInstallPrompt()" class="close-install">&times;</button>
    </div>

    <!-- Toast -->
    <div id="toast" class="toast"></div>

    <!-- Main Content -->
    <div id="content">
        <header>
            <div class="container">
                <div class="header-content">
                    <a href="/" class="logo">
                        <i class="fas fa-cloud"></i>
                        <div>
                            CLOUD.MOVIES
                            <div class="brand">by Bera Tech</div>
                        </div>
                    </a>
                    
                    <div class="search-container">
                        <i class="fas fa-search search-icon"></i>
                        <input type="text" 
                               id="searchInput" 
                               class="search-input" 
                               placeholder="Search movies and series..."
                               onkeyup="debouncedSearch(this.value)">
                    </div>
                    
                    <div class="nav-buttons">
                        <button onclick="toggleTheme()" class="btn btn-secondary">
                            <i class="fas fa-moon"></i>
                        </button>
                        <a href="/favorites" class="btn btn-secondary">
                            <i class="fas fa-heart"></i>
                            Favorites
                        </a>
                    </div>
                </div>
            </div>
        </header>

        <!-- Dynamic Content Area -->
        <div id="mainContent">
            <!-- Home content will be loaded here -->
        </div>

        <footer>
            <div class="container">
                <div class="footer-content">
                    <div class="footer-section">
                        <h3>CLOUD.MOVIES</h3>
                        <p style="color: #94a3b8; line-height: 1.6;">
                            Premium streaming platform powered by Gifted Movies API.
                            Experience cinema-quality entertainment anywhere.
                        </p>
                    </div>
                    
                    <div class="footer-section">
                        <h3>Quick Links</h3>
                        <ul class="footer-links">
                            <li><a href="/"><i class="fas fa-home"></i> Home</a></li>
                            <li><a href="#" onclick="loadSection('trending')"><i class="fas fa-fire"></i> Trending</a></li>
                            <li><a href="#" onclick="loadSection('latest')"><i class="fas fa-clock"></i> Latest</a></li>
                            <li><a href="/favorites"><i class="fas fa-heart"></i> Favorites</a></li>
                        </ul>
                    </div>
                    
                    <div class="footer-section">
                        <h3>Support</h3>
                        <ul class="footer-links">
                            <li><a href="#"><i class="fas fa-question-circle"></i> Help Center</a></li>
                            <li><a href="#"><i class="fas fa-file-alt"></i> Terms of Service</a></li>
                            <li><a href="#"><i class="fas fa-shield-alt"></i> Privacy Policy</a></li>
                            <li><a href="#"><i class="fas fa-envelope"></i> Contact Us</a></li>
                        </ul>
                    </div>
                    
                    <div class="footer-section">
                        <h3>Connect</h3>
                        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                            <a href="#" style="color: #3b82f6; font-size: 1.5rem;"><i class="fab fa-twitter"></i></a>
                            <a href="#" style="color: #3b82f6; font-size: 1.5rem;"><i class="fab fa-facebook"></i></a>
                            <a href="#" style="color: #3b82f6; font-size: 1.5rem;"><i class="fab fa-instagram"></i></a>
                            <a href="#" style="color: #3b82f6; font-size: 1.5rem;"><i class="fab fa-telegram"></i></a>
                        </div>
                    </div>
                </div>
                
                <div class="copyright">
                    &copy; ${new Date().getFullYear()} Bera Tech - CLOUD.MOVIES. All rights reserved.<br>
                    Powered by Gifted Movies API. Content is for personal use only.
                </div>
            </div>
        </footer>
    </div>

    <script>
        // State Management
        let currentPage = 'home';
        let currentMovie = null;
        let deferredPrompt = null;
        let favorites = JSON.parse(localStorage.getItem('cloud_movies_favorites') || '[]');

        // Age Verification
        function checkAgeVerification() {
            const verified = localStorage.getItem('age_verified');
            if (!verified) {
                document.getElementById('ageModal').style.display = 'flex';
                document.body.style.overflow = 'hidden';
            } else {
                loadHome();
            }
        }

        function verifyAge(confirmed) {
            if (confirmed) {
                localStorage.setItem('age_verified', 'true');
                document.getElementById('ageModal').style.display = 'none';
                document.body.style.overflow = 'auto';
                loadHome();
                showToast('Age verified successfully!', 'success');
            } else {
                window.location.href = 'https://www.google.com';
            }
        }

        // Toast System
        function showToast(message, type = 'info') {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = 'toast';
            
            // Add type-based styling
            if (type === 'success') {
                toast.style.borderLeftColor = '#10b981';
            } else if (type === 'error') {
                toast.style.borderLeftColor = '#ef4444';
            } else if (type === 'warning') {
                toast.style.borderLeftColor = '#f59e0b';
            }
            
            toast.classList.add('show');
            
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }

        // Debounced Search
        let searchTimeout;
        function debouncedSearch(query) {
            clearTimeout(searchTimeout);
            if (query.length < 2) return;
            
            searchTimeout = setTimeout(() => {
                searchMovies(query);
            }, 500);
        }

        // API Functions
        async function searchMovies(query) {
            showLoading();
            try {
                const response = await fetch(\`/api/search/\${encodeURIComponent(query)}\`);
                const data = await response.json();
                displaySearchResults(data);
            } catch (error) {
                showToast('Failed to search movies', 'error');
                console.error('Search error:', error);
            } finally {
                hideLoading();
            }
        }

        async function getMovieInfo(id) {
            showLoading();
            try {
                const response = await fetch(\`/api/info/\${id}\`);
                const data = await response.json();
                displayMovieDetail(data);
            } catch (error) {
                showToast('Failed to load movie details', 'error');
                console.error('Movie info error:', error);
            } finally {
                hideLoading();
            }
        }

        async function getMovieSources(id, quality = null) {
            showLoading();
            try {
                const response = await fetch(\`/api/sources/\${id}\`);
                const data = await response.json();
                
                if (quality) {
                    const source = data.results.find(s => s.quality === quality);
                    if (source) {
                        return source.download_url;
                    }
                }
                
                return data.results;
            } catch (error) {
                showToast('Failed to load sources', 'error');
                console.error('Sources error:', error);
            } finally {
                hideLoading();
            }
        }

        // Display Functions
        function displaySearchResults(data) {
            const mainContent = document.getElementById('mainContent');
            const items = data.results?.items || [];
            
            let html = \`
                <div class="container search-results">
                    <h2 class="section-title">
                        <i class="fas fa-search"></i>
                        Search Results
                    </h2>
                    <div class="results-count">
                        Found \${items.length} results
                    </div>
                    <div class="movie-grid">
            \`;
            
            items.forEach(movie => {
                const isFavorite = favorites.includes(movie.subjectId);
                html += \`
                    <div class="movie-card" onclick="getMovieInfo('\${movie.subjectId}')">
                        <button class="favorite-btn \${isFavorite ? 'active' : ''}" 
                                onclick="event.stopPropagation(); toggleFavorite('\${movie.subjectId}')">
                            <i class="fas fa-heart"></i>
                        </button>
                        <img src="\${movie.cover?.url || '/api/placeholder/200/300'}" 
                             alt="\${movie.title}" 
                             class="movie-poster"
                             onerror="this.src='/api/placeholder/200/300'">
                        <div class="movie-info">
                            <h3 class="movie-title">\${movie.title}</h3>
                            <div class="movie-meta">
                                <span>\${movie.releaseDate || 'N/A'}</span>
                                <span class="rating">
                                    <i class="fas fa-star"></i> \${movie.imdbRatingValue || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                \`;
            });
            
            html += \`
                    </div>
                </div>
            \`;
            
            mainContent.innerHTML = html;
        }

        function displayMovieDetail(data) {
            const movie = data.results?.subject;
            const stars = data.results?.stars || [];
            const trailer = movie?.trailer;
            
            let html = \`
                <div class="container movie-detail">
                    <div class="detail-header">
                        <div>
                            <img src="\${movie.cover?.url || '/api/placeholder/300/450'}" 
                                 alt="\${movie.title}" 
                                 class="detail-poster"
                                 onerror="this.src='/api/placeholder/300/450'">
                        </div>
                        
                        <div class="detail-info">
                            <h1>\${movie.title}</h1>
                            
                            <div class="detail-meta">
                                <span class="tag">
                                    <i class="fas fa-calendar"></i> \${movie.releaseDate || 'N/A'}
                                </span>
                                <span class="tag">
                                    <i class="fas fa-clock"></i> \${Math.floor(movie.duration / 60)} min
                                </span>
                                <span class="tag">
                                    <i class="fas fa-star"></i> IMDB: \${movie.imdbRatingValue || 'N/A'}
                                </span>
                                <span class="tag">
                                    <i class="fas fa-globe"></i> \${movie.countryName || 'N/A'}
                                </span>
                            </div>
                            
                            <div class="description">
                                \${movie.description || 'No description available.'}
                            </div>
                            
                            <div>
                                <h3 style="margin-bottom: 1rem; color: #e2e8f0;">
                                    <i class="fas fa-film"></i> Genre
                                </h3>
                                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            \`;
            
            if (movie.genre) {
                movie.genre.split(',').forEach(genre => {
                    html += \`<span class="tag" style="background: rgba(139,92,246,0.2); border-color: #8b5cf6;">\${genre.trim()}</span>\`;
                });
            }
            
            html += \`
                                </div>
                            </div>
                            
                            \${stars.length > 0 ? \`
                            <div style="margin-top: 2rem;">
                                <h3 style="margin-bottom: 1rem; color: #e2e8f0;">
                                    <i class="fas fa-users"></i> Cast
                                </h3>
                                <div class="cast-grid">
                            \` : ''}
            \`;
            
            stars.slice(0, 6).forEach(star => {
                html += \`
                    <div class="cast-card">
                        <img src="\${star.avatarUrl || '/api/placeholder/80/80'}" 
                             alt="\${star.name}" 
                             class="cast-avatar"
                             onerror="this.src='/api/placeholder/80/80'">
                        <div>
                            <strong style="color: #e2e8f0; font-size: 0.9rem;">\${star.name}</strong>
                            <div style="color: #94a3b8; font-size: 0.8rem;">\${star.character}</div>
                        </div>
                    </div>
                \`;
            });
            
            html += stars.length > 0 ? \`</div></div>\` : '';
            
            // Action buttons
            html += \`
                <div style="margin-top: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button onclick="streamMovie('\${movie.subjectId}')" class="btn btn-primary">
                        <i class="fas fa-play"></i> Stream Now
                    </button>
                    <button onclick="showQualitySelector('\${movie.subjectId}')" class="btn btn-secondary">
                        <i class="fas fa-download"></i> Download
                    </button>
                    \${trailer ? \`
                    <button onclick="playTrailer('\${trailer.videoAddress.url}')" class="btn btn-secondary">
                        <i class="fas fa-play-circle"></i> Watch Trailer
                    </button>
                    \` : ''}
                </div>
            \`;
            
            html += \`
                        </div>
                    </div>
                </div>
            \`;
            
            document.getElementById('mainContent').innerHTML = html;
            currentMovie = movie;
        }

        function showQualitySelector(movieId) {
            const html = \`
                <div class="quality-selector">
                    <h3 style="color: #e2e8f0; margin-bottom: 1rem; width: 100%;">
                        <i class="fas fa-download"></i> Select Quality
                    </h3>
                    <button onclick="downloadMovie('\${movieId}', '360p')" class="quality-btn">
                        360p
                    </button>
                    <button onclick="downloadMovie('\${movieId}', '480p')" class="quality-btn">
                        480p
                    </button>
                    <button onclick="downloadMovie('\${movieId}', '720p')" class="quality-btn">
                        720p (HD)
                    </button>
                </div>
            \`;
            
            // Inject into detail page
            const detailInfo = document.querySelector('.detail-info');
            const existingSelector = document.querySelector('.quality-selector');
            if (existingSelector) {
                existingSelector.remove();
            }
            
            const actionButtons = detailInfo.querySelector('.btn');
            if (actionButtons) {
                actionButtons.parentNode.insertAdjacentHTML('afterend', html);
            }
        }

        async function streamMovie(movieId) {
            showLoading();
            try {
                const sources = await getMovieSources(movieId);
                if (sources && sources.length > 0) {
                    // Use the highest quality for streaming
                    const bestQuality = sources.find(s => s.quality === '720p') || 
                                       sources.find(s => s.quality === '480p') || 
                                       sources[0];
                    
                    const html = \`
                        <div class="container" style="padding: 2rem 0;">
                            <button onclick="goBack()" class="btn btn-secondary" style="margin-bottom: 1rem;">
                                <i class="fas fa-arrow-left"></i> Back
                            </button>
                            <div class="video-player">
                                <video controls autoplay style="width: 100%;">
                                    <source src="\${bestQuality.download_url}" type="video/mp4">
                                    Your browser does not support the video tag.
                                </video>
                            </div>
                            <div style="margin-top: 1rem; color: #94a3b8;">
                                Streaming: \${currentMovie?.title || 'Movie'} in \${bestQuality.quality}
                            </div>
                        </div>
                    \`;
                    
                    document.getElementById('mainContent').innerHTML = html;
                    
                    // Cache for offline viewing
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({
                            type: 'CACHE_VIDEO',
                            url: bestQuality.download_url,
                            movieId: movieId
                        });
                    }
                }
            } catch (error) {
                showToast('Failed to start streaming', 'error');
                console.error('Stream error:', error);
            } finally {
                hideLoading();
            }
        }

        function downloadMovie(movieId, quality) {
            showLoading();
            getMovieSources(movieId)
                .then(sources => {
                    const source = sources.find(s => s.quality === quality);
                    if (source) {
                        const link = document.createElement('a');
                        link.href = \`/api/download/\${movieId}?quality=\${quality}\`;
                        link.download = \`\${currentMovie?.title || 'movie'}.\${quality}.\${source.format}\`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        showToast(\`Downloading \${quality} version...\`, 'success');
                    } else {
                        showToast('Selected quality not available', 'error');
                    }
                })
                .catch(error => {
                    showToast('Download failed', 'error');
                    console.error('Download error:', error);
                })
                .finally(() => hideLoading());
        }

        function playTrailer(trailerUrl) {
            const html = \`
                <div class="container" style="padding: 2rem 0;">
                    <button onclick="goBack()" class="btn btn-secondary" style="margin-bottom: 1rem;">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                    <div class="video-player">
                        <video controls autoplay style="width: 100%;">
                            <source src="\${trailerUrl}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                </div>
            \`;
            
            document.getElementById('mainContent').innerHTML = html;
        }

        function loadHome() {
            currentPage = 'home';
            const html = \`
                <div class="hero">
                    <div class="container">
                        <h1>CLOUD.MOVIES</h1>
                        <p>Stream thousands of movies and TV shows in stunning quality. Anytime, anywhere.</p>
                        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                            <button onclick="loadSection('featured')" class="btn btn-primary">
                                <i class="fas fa-play"></i> Start Watching
                            </button>
                            <button onclick="showHowToInstall()" class="btn btn-secondary">
                                <i class="fas fa-download"></i> Install App
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="container">
                    <div class="section">
                        <div class="section-header">
                            <h2 class="section-title">
                                <i class="fas fa-fire"></i>
                                Trending Now
                            </h2>
                            <button onclick="loadSection('trending')" class="btn btn-secondary">
                                View All
                            </button>
                        </div>
                        <div id="trendingMovies" class="movie-grid">
                            <div class="loading">
                                <div class="spinner"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-header">
                            <h2 class="section-title">
                                <i class="fas fa-star"></i>
                                Top Rated
                            </h2>
                            <button onclick="loadSection('toprated')" class="btn btn-secondary">
                                View All
                            </button>
                        </div>
                        <div id="topRatedMovies" class="movie-grid">
                            <div class="loading">
                                <div class="spinner"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-header">
                            <h2 class="section-title">
                                <i class="fas fa-clock"></i>
                                Latest Releases
                            </h2>
                            <button onclick="loadSection('latest')" class="btn btn-secondary">
                                View All
                            </button>
                        </div>
                        <div id="latestMovies" class="movie-grid">
                            <div class="loading">
                                <div class="spinner"></div>
                            </div>
                        </div>
                    </div>
                </div>
            \`;
            
            document.getElementById('mainContent').innerHTML = html;
            
            // Load initial content
            loadInitialContent();
        }

        async function loadInitialContent() {
            try {
                // Load trending
                const trendingRes = await fetch('/api/trending');
                const trendingData = await trendingRes.json();
                displayMovies('trendingMovies', trendingData.results?.items?.slice(0, 8) || []);
                
                // Load top rated
                const topRes = await fetch('/api/toprated');
                const topData = await topRes.json();
                displayMovies('topRatedMovies', topData.results?.items?.slice(0, 8) || []);
                
                // Load latest
                const latestRes = await fetch('/api/latest');
                const latestData = await latestRes.json();
                displayMovies('latestMovies', latestData.results?.items?.slice(0, 8) || []);
            } catch (error) {
                console.error('Failed to load initial content:', error);
            }
        }

        function displayMovies(containerId, movies) {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            let html = '';
            movies.forEach(movie => {
                const isFavorite = favorites.includes(movie.subjectId);
                html += \`
                    <div class="movie-card" onclick="getMovieInfo('\${movie.subjectId}')">
                        <button class="favorite-btn \${isFavorite ? 'active' : ''}" 
                                onclick="event.stopPropagation(); toggleFavorite('\${movie.subjectId}')">
                            <i class="fas fa-heart"></i>
                        </button>
                        <img src="\${movie.cover?.url || '/api/placeholder/200/300'}" 
                             alt="\${movie.title}" 
                             class="movie-poster"
                             onerror="this.src='/api/placeholder/200/300'">
                        <div class="movie-info">
                            <h3 class="movie-title">\${movie.title}</h3>
                            <div class="movie-meta">
                                <span>\${movie.releaseDate?.split('-')[0] || 'N/A'}</span>
                                <span class="rating">
                                    <i class="fas fa-star"></i> \${movie.imdbRatingValue || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                \`;
            });
            
            container.innerHTML = html;
        }

        function loadSection(section) {
            showLoading();
            
            let url = '/api/trending';
            let title = 'Trending';
            let icon = 'fas fa-fire';
            
            switch(section) {
                case 'trending':
                    url = '/api/trending';
                    title = 'Trending Movies';
                    icon = 'fas fa-fire';
                    break;
                case 'toprated':
                    url = '/api/toprated';
                    title = 'Top Rated';
                    icon = 'fas fa-star';
                    break;
                case 'latest':
                    url = '/api/latest';
                    title = 'Latest Releases';
                    icon = 'fas fa-clock';
                    break;
                case 'featured':
                    url = '/api/featured';
                    title = 'Featured Movies';
                    icon = 'fas fa-film';
                    break;
            }
            
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    const movies = data.results?.items || [];
                    const html = \`
                        <div class="container" style="padding: 2rem 0;">
                            <button onclick="loadHome()" class="btn btn-secondary" style="margin-bottom: 2rem;">
                                <i class="fas fa-arrow-left"></i> Back to Home
                            </button>
                            
                            <h2 class="section-title">
                                <i class="\${icon}"></i>
                                \${title}
                            </h2>
                            
                            <div class="movie-grid">
                    \`;
                    
                    const movieCards = movies.map(movie => {
                        const isFavorite = favorites.includes(movie.subjectId);
                        return \`
                            <div class="movie-card" onclick="getMovieInfo('\${movie.subjectId}')">
                                <button class="favorite-btn \${isFavorite ? 'active' : ''}" 
                                        onclick="event.stopPropagation(); toggleFavorite('\${movie.subjectId}')">
                                    <i class="fas fa-heart"></i>
                                </button>
                                <img src="\${movie.cover?.url || '/api/placeholder/200/300'}" 
                                     alt="\${movie.title}" 
                                     class="movie-poster"
                                     onerror="this.src='/api/placeholder/200/300'">
                                <div class="movie-info">
                                    <h3 class="movie-title">\${movie.title}</h3>
                                    <div class="movie-meta">
                                        <span>\${movie.releaseDate?.split('-')[0] || 'N/A'}</span>
                                        <span class="rating">
                                            <i class="fas fa-star"></i> \${movie.imdbRatingValue || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                    const fullHtml = html + movieCards + \`
                            </div>
                        </div>
                    \`;
                    
                    document.getElementById('mainContent').innerHTML = fullHtml;
                })
                .catch(error => {
                    showToast('Failed to load section', 'error');
                    console.error('Section load error:', error);
                })
                .finally(() => hideLoading());
        }

        function toggleFavorite(movieId) {
            const index = favorites.indexOf(movieId);
            if (index > -1) {
                favorites.splice(index, 1);
                showToast('Removed from favorites', 'info');
            } else {
                favorites.push(movieId);
                showToast('Added to favorites', 'success');
            }
            
            localStorage.setItem('cloud_movies_favorites', JSON.stringify(favorites));
            
            // Update UI
            const favoriteBtns = document.querySelectorAll(\`.favorite-btn[onclick*="'\${movieId}'"]\`);
            favoriteBtns.forEach(btn => {
                btn.classList.toggle('active');
            });
        }

        function loadFavorites() {
            const html = \`
                <div class="container" style="padding: 2rem 0;">
                    <button onclick="loadHome()" class="btn btn-secondary" style="margin-bottom: 2rem;">
                        <i class="fas fa-arrow-left"></i> Back to Home
                    </button>
                    
                    <h2 class="section-title">
                        <i class="fas fa-heart"></i>
                        My Favorites
                    </h2>
                    
                    \${favorites.length === 0 ? \`
                        <div style="text-align: center; padding: 4rem; color: #94a3b8;">
                            <i class="fas fa-heart-broken" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                            <h3>No favorites yet</h3>
                            <p>Start adding movies to your favorites list!</p>
                        </div>
                    \` : \`
                        <div id="favoritesGrid" class="movie-grid">
                            <div class="loading">
                                <div class="spinner"></div>
                            </div>
                        </div>
                    \`}
                </div>
            \`;
            
            document.getElementById('mainContent').innerHTML = html;
            
            if (favorites.length > 0) {
                loadFavoriteMovies();
            }
        }

        async function loadFavoriteMovies() {
            const container = document.getElementById('favoritesGrid');
            if (!container) return;
            
            let html = '';
            
            for (const movieId of favorites.slice(0, 20)) {
                try {
                    const response = await fetch(\`/api/info/\${movieId}\`);
                    const data = await response.json();
                    const movie = data.results?.subject;
                    
                    if (movie) {
                        html += \`
                            <div class="movie-card" onclick="getMovieInfo('\${movie.subjectId}')">
                                <button class="favorite-btn active" 
                                        onclick="event.stopPropagation(); toggleFavorite('\${movie.subjectId}')">
                                    <i class="fas fa-heart"></i>
                                </button>
                                <img src="\${movie.cover?.url || '/api/placeholder/200/300'}" 
                                     alt="\${movie.title}" 
                                     class="movie-poster"
                                     onerror="this.src='/api/placeholder/200/300'">
                                <div class="movie-info">
                                    <h3 class="movie-title">\${movie.title}</h3>
                                    <div class="movie-meta">
                                        <span>\${movie.releaseDate?.split('-')[0] || 'N/A'}</span>
                                        <span class="rating">
                                            <i class="fas fa-star"></i> \${movie.imdbRatingValue || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        \`;
                    }
                } catch (error) {
                    console.error('Failed to load favorite movie:', error);
                }
            }
            
            container.innerHTML = html || '<div style="color: #94a3b8;">Failed to load favorites</div>';
        }

        function toggleTheme() {
            const body = document.body;
            const isDark = body.classList.contains('dark');
            
            if (isDark) {
                body.classList.remove('dark');
                body.classList.add('light');
                localStorage.setItem('theme', 'light');
                showToast('Light mode activated', 'info');
            } else {
                body.classList.remove('light');
                body.classList.add('dark');
                localStorage.setItem('theme', 'dark');
                showToast('Dark mode activated', 'info');
            }
        }

        function goBack() {
            if (currentMovie) {
                getMovieInfo(currentMovie.subjectId);
            } else {
                loadHome();
            }
        }

        function showHowToInstall() {
            showToast('Click the install button or use your browser\'s install option', 'info');
            
            // Trigger install prompt if available
            if (deferredPrompt) {
                installApp();
            }
        }

        // PWA Installation
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            // Show install prompt after 5 seconds
            setTimeout(() => {
                if (deferredPrompt) {
                    document.getElementById('installPrompt').style.display = 'flex';
                }
            }, 5000);
        });

        function installApp() {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                
                deferredPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        showToast('App installed successfully!', 'success');
                    } else {
                        showToast('App installation cancelled', 'info');
                    }
                    deferredPrompt = null;
                    document.getElementById('installPrompt').style.display = 'none';
                });
            }
        }

        function closeInstallPrompt() {
            document.getElementById('installPrompt').style.display = 'none';
        }

        // Loading indicators
        function showLoading() {
            const loading = document.createElement('div');
            loading.id = 'globalLoading';
            loading.innerHTML = \`
                <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15,23,42,0.9); display: flex; justify-content: center; align-items: center; z-index: 1000;">
                    <div class="spinner"></div>
                </div>
            \`;
            document.body.appendChild(loading);
        }

        function hideLoading() {
            const loading = document.getElementById('globalLoading');
            if (loading) {
                loading.remove();
            }
        }

        // Service Worker Registration
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('ServiceWorker registered:', registration);
                    })
                    .catch(error => {
                        console.log('ServiceWorker registration failed:', error);
                    });
            });
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', () => {
            // Load saved theme
            const savedTheme = localStorage.getItem('theme') || 'dark';
            document.body.classList.add(savedTheme);
            
            // Check age verification
            checkAgeVerification();
            
            // Setup routing
            window.addEventListener('popstate', () => {
                const path = window.location.pathname;
                if (path === '/favorites') {
                    loadFavorites();
                } else if (path === '/') {
                    loadHome();
                }
            });
            
            // Handle /favorites route
            if (window.location.pathname === '/favorites') {
                loadFavorites();
            }
        });
    </script>
</body>
</html>
`,
  '/styles.css': `
/* Additional styles for CLOUD.MOVIES PWA */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}

body {
    background: #0f172a;
    color: #f8fafc;
    min-height: 100vh;
    overflow-x: hidden;
}

/* Custom scrollbar */
::-webkit-scrollbar {
    width: 10px;
}

::-webkit-scrollbar-track {
    background: #1e293b;
}

::-webkit-scrollbar-thumb {
    background: #3b82f6;
    border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
    background: #2563eb;
}

/* Selection */
::selection {
    background: rgba(59, 130, 246, 0.5);
    color: white;
}

/* Focus styles */
:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
}

/* Print styles */
@media print {
    .no-print {
        display: none !important;
    }
    
    body {
        background: white !important;
        color: black !important;
    }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
`,
  '/manifest.json': JSON.stringify({
    "name": "CLOUD.MOVIES",
    "short_name": "CloudMovies",
    "description": "Premium movie streaming platform by Bera Tech",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0f172a",
    "theme_color": "#3b82f6",
    "orientation": "portrait-primary",
    "categories": ["entertainment", "movies", "video"],
    "icons": [
      {
        "src": "/assets/icon-72x72.png",
        "sizes": "72x72",
        "type": "image/png",
        "purpose": "any maskable"
      },
      {
        "src": "/assets/icon-96x96.png",
        "sizes": "96x96",
        "type": "image/png"
      },
      {
        "src": "/assets/icon-128x128.png",
        "sizes": "128x128",
        "type": "image/png"
      },
      {
        "src": "/assets/icon-144x144.png",
        "sizes": "144x144",
        "type": "image/png"
      },
      {
        "src": "/assets/icon-152x152.png",
        "sizes": "152x152",
        "type": "image/png"
      },
      {
        "src": "/assets/icon-192x192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any maskable"
      },
      {
        "src": "/assets/icon-384x384.png",
        "sizes": "384x384",
        "type": "image/png"
      },
      {
        "src": "/assets/icon-512x512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      }
    ],
    "shortcuts": [
      {
        "name": "Trending Movies",
        "short_name": "Trending",
        "description": "View trending movies",
        "url": "/trending",
        "icons": [{ "src": "/assets/trending-icon.png", "sizes": "96x96" }]
      },
      {
        "name": "My Favorites",
        "short_name": "Favorites",
        "description": "View your favorite movies",
        "url": "/favorites",
        "icons": [{ "src": "/assets/fav-icon.png", "sizes": "96x96" }]
      }
    ],
    "screenshots": [
      {
        "src": "/assets/screenshot1.png",
        "sizes": "1280x720",
        "type": "image/png",
        "form_factor": "wide"
      },
      {
        "src": "/assets/screenshot2.png",
        "sizes": "750x1334",
        "type": "image/png",
        "form_factor": "narrow"
      }
    ]
  }, null, 2),
  '/sw.js': `
// Service Worker for CLOUD.MOVIES PWA
const CACHE_NAME = 'cloud-movies-v1.0.0';
const STATIC_CACHE = 'cloud-movies-static-v1.0.0';
const DYNAMIC_CACHE = 'cloud-movies-dynamic-v1.0.0';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/styles.css',
  '/manifest.json',
  '/assets/favicon.png'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - cache then network strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone response for caching
          const responseClone = response.clone();
          
          // Cache API responses for movies
          if (url.pathname.startsWith('/api/info/') || 
              url.pathname.startsWith('/api/sources/')) {
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request);
        })
    );
    return;
  }

  // For static assets, cache first
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          return cachedResponse || fetch(request);
        })
    );
    return;
  }

  // For other requests, network first
  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE)
            .then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache
        return caches.match(request);
      })
  );
});

// Message event for caching videos
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_VIDEO') {
    const { url, movieId } = event.data;
    
    caches.open(DYNAMIC_CACHE)
      .then(cache => {
        fetch(url)
          .then(response => {
            if (response.ok) {
              cache.put(new Request(\`/video/\${movieId}\`), response);
              console.log('Video cached for offline:', movieId);
            }
          })
          .catch(console.error);
      });
  }
});

// Background sync for failed requests
self.addEventListener('sync', event => {
  if (event.tag === 'sync-movies') {
    console.log('Background sync for movies');
  }
});

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'New content available!',
    icon: '/assets/icon-192x192.png',
    badge: '/assets/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Explore',
        icon: '/assets/explore-icon.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/close-icon.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('CLOUD.MOVIES', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
`
};

// API Proxy Functions
const api = axios.create({
  baseURL: GIFTED_API_BASE,
  timeout: 10000,
  headers: {
    'User-Agent': 'CLOUD.MOVIES/1.0 (Bera Tech)'
  },
  httpsAgent: new https.Agent({ keepAlive: true })
});

// Cache for API responses
const apiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Search endpoint
app.get('/api/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const cacheKey = `search:${query}`;
    
    if (apiCache.has(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json(cached.data);
      }
    }
    
    const response = await api.get(`/api/search/${encodeURIComponent(query)}`);
    apiCache.set(cacheKey, {
      timestamp: Date.now(),
      data: response.data
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Search API error:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: 'Failed to fetch search results'
    });
  }
});

// Movie info endpoint
app.get('/api/info/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cacheKey = `info:${id}`;
    
    if (apiCache.has(cacheKey)) {
      const cached = apiCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json(cached.data);
      }
    }
    
    const response = await api.get(`/api/info/${id}`);
    apiCache.set(cacheKey, {
      timestamp: Date.now(),
      data: response.data
    });
    
    res.json(response.data);
  } catch (error) {
    console.error('Info API error:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: 'Failed to fetch movie info'
    });
  }
});

// Download sources endpoint
app.get('/api/sources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { season, episode } = req.query;
    let url = `/api/sources/${id}`;
    
    if (season && episode) {
      url += `?season=${season}&episode=${episode}`;
    }
    
    const response = await api.get(url);
    res.json(response.data);
  } catch (error) {
    console.error('Sources API error:', error.message);
    res.status(500).json({
      status: 500,
      success: false,
      error: 'Failed to fetch download sources'
    });
  }
});

// Download proxy endpoint
app.get('/api/download/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quality } = req.query;
    
    // Get sources first
    const sourcesRes = await api.get(`/api/sources/${id}`);
    const sources = sourcesRes.data.results || [];
    
    let downloadUrl;
    if (quality) {
      const source = sources.find(s => s.quality === quality);
      if (!source) {
        return res.status(404).json({ error: 'Quality not available' });
      }
      downloadUrl = source.download_url;
    } else {
      // Default to highest quality
      downloadUrl = sources[0]?.download_url;
    }
    
    if (!downloadUrl) {
      return res.status(404).json({ error: 'No download source found' });
    }
    
    // Parse the encoded URL
    const decodedUrl = decodeURIComponent(downloadUrl.split('/api/download/')[1]);
    
    // Stream the file to user
    const fileResponse = await axios({
      method: 'GET',
      url: decodedUrl,
      responseType: 'stream'
    });
    
    // Set headers for download
    res.setHeader('Content-Disposition', `attachment; filename="movie-${id}-${quality || 'default'}.mp4"`);
    res.setHeader('Content-Type', fileResponse.headers['content-type']);
    res.setHeader('Content-Length', fileResponse.headers['content-length']);
    
    // Pipe the stream
    fileResponse.data.pipe(res);
  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Trending movies (using popular search terms)
app.get('/api/trending', async (req, res) => {
  try {
    const searchTerms = ['Avengers', 'Spider-Man', 'Batman', 'Superhero', 'Action', '2024'];
    const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
    
    const response = await api.get(`/api/search/${encodeURIComponent(randomTerm)}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      error: 'Failed to fetch trending movies'
    });
  }
});

// Top rated movies (filter by rating)
app.get('/api/toprated', async (req, res) => {
  try {
    const response = await api.get('/api/search/2024');
    const items = response.data.results?.items || [];
    
    // Sort by IMDB rating (descending)
    const sorted = items
      .filter(item => item.imdbRatingValue && parseFloat(item.imdbRatingValue) >= 7.0)
      .sort((a, b) => parseFloat(b.imdbRatingValue) - parseFloat(a.imdbRatingValue));
    
    res.json({
      ...response.data,
      results: { ...response.data.results, items: sorted }
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      error: 'Failed to fetch top rated movies'
    });
  }
});

// Latest movies (sort by release date)
app.get('/api/latest', async (req, res) => {
  try {
    const response = await api.get('/api/search/2024');
    const items = response.data.results?.items || [];
    
    // Sort by release date (descending)
    const sorted = items.sort((a, b) => {
      const dateA = new Date(a.releaseDate || 0);
      const dateB = new Date(b.releaseDate || 0);
      return dateB - dateA;
    });
    
    res.json({
      ...response.data,
      results: { ...response.data.results, items: sorted }
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      error: 'Failed to fetch latest movies'
    });
  }
});

// Featured movies
app.get('/api/featured', async (req, res) => {
  try {
    const featured = ['Marvel', 'Disney', 'Netflix', 'Blockbuster'];
    const random = featured[Math.floor(Math.random() * featured.length)];
    
    const response = await api.get(`/api/search/${encodeURIComponent(random)}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      status: 500,
      success: false,
      error: 'Failed to fetch featured movies'
    });
  }
});

// Placeholder images
app.get('/api/placeholder/:width/:height', (req, res) => {
  const { width, height } = req.params;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1e293b"/>
      <text x="50%" y="50%" font-family="Arial" font-size="20" fill="#64748b" text-anchor="middle" dy=".3em">
        CLOUD.MOVIES
      </text>
      <text x="50%" y="60%" font-family="Arial" font-size="12" fill="#475569" text-anchor="middle" dy=".3em">
        ${width}x${height}
      </text>
    </svg>
  `;
  
  res.setHeader('Content-Type', 'image/svg+xml');
  res.send(svg);
});

// Serve static files
app.get('*', (req, res) => {
  const path = req.path === '/' ? '/' : req.path;
  
  if (staticFiles[path]) {
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (path.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else {
      res.setHeader('Content-Type', 'text/html');
    }
    res.send(staticFiles[path]);
  } else if (path.startsWith('/assets/')) {
    // Serve placeholder for missing assets
    if (path.includes('icon-')) {
      const size = path.match(/(\d+)x(\d+)/);
      if (size) {
        const svg = `
          <svg width="${size[1]}" height="${size[2]}" xmlns="http://www.w3.org/2000/svg">
            <circle cx="${size[1]/2}" cy="${size[2]/2}" r="${Math.min(size[1], size[2])/2}" fill="#3b82f6"/>
            <text x="50%" y="50%" font-family="Arial" font-size="${size[1]/4}" fill="white" text-anchor="middle" dy=".3em">
              CM
            </text>
          </svg>
        `;
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(svg);
      }
    }
    res.status(404).send('Asset not found');
  } else {
    // Default to home page for SPA routing
    res.setHeader('Content-Type', 'text/html');
    res.send(staticFiles['/']);
  }
});

// Clear cache endpoint (for development)
app.post('/api/clear-cache', (req, res) => {
  apiCache.clear();
  res.json({ success: true, message: 'Cache cleared' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'CLOUD.MOVIES',
    version: '1.0.0',
    brand: 'Bera Tech',
    api: 'Gifted Movies API',
    uptime: process.uptime()
  });
});

// Start server
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   CLOUD.MOVIES - Bera Tech Streaming Platform           ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║   🌐 Server running on: http://localhost:${PORT}           ║
║   📱 PWA-ready with offline support                     ║
║   🎬 Powered by Gifted Movies API                       ║
║   🚀 Production ready                                   ║
║                                                          ║
║   Features:                                             ║
║   ✓ Age Verification System                            ║
║   ✓ Mobile-first Responsive Design                     ║
║   ✓ Dark/Light Mode                                    ║
║   ✓ Favorites System                                   ║
║   ✓ Streaming & Download                               ║
║   ✓ Multiple Quality Options                           ║
║   ✓ Service Worker Caching                             ║
║   ✓ Install as App Prompt                              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
