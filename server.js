const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// API Base URL
const API_BASE = 'https://movieapi.giftedtech.co.ke/api';

// Middleware
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// Proxy API requests to avoid CORS issues
app.get('/api/proxy/:endpoint/*', async (req, res) => {
    try {
        const endpoint = req.params.endpoint;
        const path = req.params[0];
        const query = req.query.query || '';
        
        let apiUrl = `${API_BASE}/${endpoint}/${path}`;
        
        // Handle query parameters
        if (req.query.season) apiUrl += `?season=${req.query.season}`;
        if (req.query.episode) {
            apiUrl += req.query.season ? `&episode=${req.query.episode}` : `?episode=${req.query.episode}`;
        }
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'API request failed' });
    }
});

// Stream video
app.get('/stream/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode, quality = '720p' } = req.query;
        
        // Get sources from API
        let sourcesUrl = `${API_BASE}/sources/${id}`;
        if (season) sourcesUrl += `?season=${season}`;
        if (episode) sourcesUrl += `${season ? '&' : '?'}episode=${episode}`;
        
        const response = await fetch(sourcesUrl);
        const data = await response.json();
        
        // Find the requested quality
        const source = data.sources?.find(s => s.quality === quality);
        
        if (!source || !source.download_url) {
            return res.status(404).json({ error: 'Stream not found' });
        }
        
        // Forward to actual video URL
        const videoResponse = await fetch(source.download_url);
        
        // Set appropriate headers for streaming
        res.set({
            'Content-Type': 'video/mp4',
            'Content-Length': videoResponse.headers.get('content-length'),
            'Accept-Ranges': 'bytes'
        });
        
        videoResponse.body.pipe(res);
    } catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ error: 'Streaming failed' });
    }
});

// Download endpoint
app.get('/download/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode, quality = '720p' } = req.query;
        
        let sourcesUrl = `${API_BASE}/sources/${id}`;
        if (season) sourcesUrl += `?season=${season}`;
        if (episode) sourcesUrl += `${season ? '&' : '?'}episode=${episode}`;
        
        const response = await fetch(sourcesUrl);
        const data = await response.json();
        
        const source = data.sources?.find(s => s.quality === quality);
        
        if (!source || !source.download_url) {
            return res.status(404).json({ error: 'Download not available' });
        }
        
        // Redirect to direct download URL
        res.redirect(source.download_url);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Download failed' });
    }
});

// Main HTML page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CLOUD.MOVIES - Neon Streaming Platform</title>
        <meta name="description" content="Professional neon-themed movie and series streaming platform">
        <meta name="author" content="Bruce Bera - Bera Tech">
        
        <!-- PWA Manifest -->
        <link rel="manifest" href="/manifest.json">
        <meta name="theme-color" content="#0a0a1a">
        
        <!-- Icons -->
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>">
        
        <!-- Styles -->
        <style>
            :root {
                --neon-blue: #00f3ff;
                --neon-purple: #bc13fe;
                --neon-pink: #ff00ff;
                --neon-green: #39ff14;
                --dark-bg: #0a0a1a;
                --darker-bg: #050511;
                --card-bg: rgba(10, 10, 26, 0.9);
                --text-primary: #ffffff;
                --text-secondary: #b0b0d0;
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                background: var(--dark-bg);
                color: var(--text-primary);
                min-height: 100vh;
                overflow-x: hidden;
            }
            
            /* Loading Animation */
            #loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--darker-bg);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                transition: opacity 0.5s ease;
            }
            
            .logo-container {
                position: relative;
                margin-bottom: 2rem;
            }
            
            .logo-text {
                font-size: 4rem;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 5px;
                background: linear-gradient(45deg, var(--neon-blue), var(--neon-purple), var(--neon-pink));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                animation: neonGlow 2s ease-in-out infinite alternate;
                text-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
            }
            
            .loading-dots {
                display: flex;
                gap: 10px;
                margin-top: 20px;
            }
            
            .dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: var(--neon-blue);
                animation: bounce 1.4s infinite ease-in-out both;
                box-shadow: 0 0 10px var(--neon-blue);
            }
            
            .dot:nth-child(1) { animation-delay: -0.32s; }
            .dot:nth-child(2) { animation-delay: -0.16s; }
            
            @keyframes neonGlow {
                0% { filter: hue-rotate(0deg); }
                100% { filter: hue-rotate(360deg); }
            }
            
            @keyframes bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
            
            /* Header */
            header {
                background: linear-gradient(180deg, rgba(10, 10, 26, 0.95) 0%, rgba(5, 5, 17, 0.8) 100%);
                backdrop-filter: blur(10px);
                padding: 1rem 2rem;
                position: sticky;
                top: 0;
                z-index: 100;
                border-bottom: 2px solid rgba(0, 243, 255, 0.2);
            }
            
            .header-content {
                max-width: 1400px;
                margin: 0 auto;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 2rem;
            }
            
            .site-logo {
                font-size: 1.8rem;
                font-weight: 900;
                background: linear-gradient(45deg, var(--neon-blue), var(--neon-purple));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-shadow: 0 0 15px rgba(0, 243, 255, 0.3);
            }
            
            .search-container {
                flex: 1;
                max-width: 600px;
                position: relative;
            }
            
            #search-input {
                width: 100%;
                padding: 12px 20px;
                background: rgba(0, 243, 255, 0.1);
                border: 2px solid var(--neon-blue);
                border-radius: 30px;
                color: white;
                font-size: 1rem;
                outline: none;
                transition: all 0.3s ease;
            }
            
            #search-input:focus {
                box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);
                background: rgba(0, 243, 255, 0.15);
            }
            
            .search-btn {
                position: absolute;
                right: 5px;
                top: 50%;
                transform: translateY(-50%);
                background: linear-gradient(45deg, var(--neon-blue), var(--neon-purple));
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .search-btn:hover {
                transform: translateY(-50%) scale(1.1);
                box-shadow: 0 0 15px rgba(0, 243, 255, 0.5);
            }
            
            /* Main Content */
            main {
                max-width: 1400px;
                margin: 0 auto;
                padding: 2rem;
            }
            
            .hero-section {
                text-align: center;
                padding: 4rem 2rem;
                background: linear-gradient(135deg, rgba(0, 243, 255, 0.1) 0%, rgba(188, 19, 254, 0.1) 100%);
                border-radius: 20px;
                margin-bottom: 3rem;
                border: 1px solid rgba(0, 243, 255, 0.2);
                position: relative;
                overflow: hidden;
            }
            
            .hero-section::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(0, 243, 255, 0.1) 0%, transparent 70%);
                animation: pulse 10s infinite linear;
            }
            
            .hero-title {
                font-size: 3.5rem;
                margin-bottom: 1rem;
                background: linear-gradient(45deg, var(--neon-blue), var(--neon-purple), var(--neon-pink));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                position: relative;
            }
            
            /* Genre Navigation */
            .genre-nav {
                display: flex;
                gap: 1rem;
                margin-bottom: 2rem;
                overflow-x: auto;
                padding: 1rem 0;
                scrollbar-width: thin;
                scrollbar-color: var(--neon-blue) transparent;
            }
            
            .genre-btn {
                padding: 10px 20px;
                background: rgba(0, 243, 255, 0.1);
                border: 2px solid transparent;
                border-radius: 25px;
                color: var(--text-primary);
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.3s ease;
            }
            
            .genre-btn:hover, .genre-btn.active {
                background: linear-gradient(45deg, var(--neon-blue), var(--neon-purple));
                border-color: var(--neon-blue);
                box-shadow: 0 0 15px rgba(0, 243, 255, 0.3);
                transform: translateY(-2px);
            }
            
            /* Content Grid */
            .content-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                gap: 2rem;
                margin-bottom: 3rem;
            }
            
            .content-card {
                background: var(--card-bg);
                border-radius: 15px;
                overflow: hidden;
                transition: all 0.3s ease;
                border: 1px solid rgba(0, 243, 255, 0.1);
                cursor: pointer;
                position: relative;
            }
            
            .content-card:hover {
                transform: translateY(-10px) scale(1.03);
                border-color: var(--neon-blue);
                box-shadow: 0 10px 30px rgba(0, 243, 255, 0.2);
            }
            
            .card-poster {
                width: 100%;
                height: 300px;
                object-fit: cover;
                display: block;
            }
            
            .card-info {
                padding: 1rem;
            }
            
            .card-title {
                font-size: 1.1rem;
                margin-bottom: 0.5rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .card-meta {
                display: flex;
                justify-content: space-between;
                font-size: 0.9rem;
                color: var(--text-secondary);
            }
            
            /* Modal Styles */
            .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                z-index: 1000;
                overflow-y: auto;
            }
            
            .modal-content {
                max-width: 1200px;
                margin: 2rem auto;
                background: var(--card-bg);
                border-radius: 20px;
                overflow: hidden;
                border: 2px solid var(--neon-blue);
                box-shadow: 0 0 50px rgba(0, 243, 255, 0.3);
            }
            
            .modal-header {
                padding: 1.5rem;
                background: linear-gradient(90deg, var(--neon-blue), var(--neon-purple));
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .close-modal {
                background: none;
                border: none;
                color: white;
                font-size: 2rem;
                cursor: pointer;
                transition: transform 0.3s ease;
            }
            
            .close-modal:hover {
                transform: scale(1.2);
            }
            
            .modal-body {
                padding: 2rem;
            }
            
            /* Player */
            .video-player {
                width: 100%;
                height: 500px;
                background: #000;
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 2rem;
            }
            
            .quality-selector, .episode-selector {
                display: flex;
                gap: 1rem;
                margin-bottom: 1.5rem;
                flex-wrap: wrap;
            }
            
            .quality-btn, .episode-btn {
                padding: 8px 16px;
                background: rgba(0, 243, 255, 0.1);
                border: 1px solid var(--neon-blue);
                border-radius: 5px;
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .quality-btn:hover, .episode-btn:hover,
            .quality-btn.active, .episode-btn.active {
                background: var(--neon-blue);
                color: var(--dark-bg);
                box-shadow: 0 0 10px var(--neon-blue);
            }
            
            .action-buttons {
                display: flex;
                gap: 1rem;
                margin-top: 2rem;
            }
            
            .stream-btn, .download-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 25px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .stream-btn {
                background: linear-gradient(45deg, var(--neon-blue), var(--neon-purple));
                color: white;
            }
            
            .download-btn {
                background: linear-gradient(45deg, var(--neon-green), #00ff88);
                color: var(--dark-bg);
            }
            
            .stream-btn:hover, .download-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 20px rgba(0, 243, 255, 0.4);
            }
            
            /* Footer */
            footer {
                background: var(--darker-bg);
                padding: 3rem 2rem;
                margin-top: 4rem;
                border-top: 2px solid rgba(0, 243, 255, 0.2);
            }
            
            .footer-content {
                max-width: 1400px;
                margin: 0 auto;
                text-align: center;
            }
            
            .footer-brand {
                font-size: 2rem;
                font-weight: 900;
                background: linear-gradient(45deg, var(--neon-blue), var(--neon-purple));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 1rem;
            }
            
            .footer-contact {
                margin-top: 1.5rem;
                color: var(--text-secondary);
            }
            
            .contact-link {
                color: var(--neon-blue);
                text-decoration: none;
                transition: all 0.3s ease;
            }
            
            .contact-link:hover {
                text-shadow: 0 0 10px var(--neon-blue);
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .header-content {
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .hero-title {
                    font-size: 2.5rem;
                }
                
                .content-grid {
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 1rem;
                }
                
                .video-player {
                    height: 300px;
                }
                
                .logo-text {
                    font-size: 3rem;
                }
            }
            
            @media (max-width: 480px) {
                .hero-title {
                    font-size: 2rem;
                }
                
                .content-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .action-buttons {
                    flex-direction: column;
                }
            }
            
            /* Install Prompt */
            #install-prompt {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(45deg, var(--neon-blue), var(--neon-purple));
                color: white;
                padding: 15px 20px;
                border-radius: 10px;
                display: none;
                align-items: center;
                gap: 15px;
                z-index: 1000;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
                animation: slideIn 0.5s ease;
            }
            
            .install-btn {
                background: white;
                color: var(--dark-bg);
                border: none;
                padding: 8px 16px;
                border-radius: 5px;
                cursor: pointer;
                font-weight: 600;
            }
            
            .close-install {
                background: none;
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            /* Scrollbar */
            ::-webkit-scrollbar {
                width: 10px;
            }
            
            ::-webkit-scrollbar-track {
                background: var(--darker-bg);
            }
            
            ::-webkit-scrollbar-thumb {
                background: linear-gradient(var(--neon-blue), var(--neon-purple));
                border-radius: 5px;
            }
            
            ::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(var(--neon-purple), var(--neon-pink));
            }
        </style>
    </head>
    <body>
        <!-- Loading Screen -->
        <div id="loading-screen">
            <div class="logo-container">
                <div class="logo-text">CLOUD.MOVIES</div>
            </div>
            <div class="loading-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>

        <!-- Header -->
        <header>
            <div class="header-content">
                <div class="site-logo">CLOUD.MOVIES</div>
                <div class="search-container">
                    <input type="text" id="search-input" placeholder="Search movies and TV series...">
                    <button class="search-btn" id="search-btn">🔍</button>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main>
            <section class="hero-section">
                <h1 class="hero-title">Stream Unlimited Movies & Series</h1>
                <p class="hero-subtitle">Neon-powered entertainment at your fingertips</p>
            </section>

            <!-- Genre Navigation -->
            <nav class="genre-nav" id="genre-nav">
                <!-- Genres will be populated by JavaScript -->
            </nav>

            <!-- Content Grid -->
            <div class="content-grid" id="content-grid">
                <!-- Content will be populated by JavaScript -->
            </div>

            <!-- Pagination -->
            <div class="pagination" id="pagination">
                <!-- Pagination will be populated by JavaScript -->
            </div>
        </main>

        <!-- Detail Modal -->
        <div class="modal" id="detail-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="modal-title">Movie Details</h2>
                    <button class="close-modal" id="close-modal">&times;</button>
                </div>
                <div class="modal-body" id="modal-body">
                    <!-- Modal content will be populated by JavaScript -->
                </div>
            </div>
        </div>

        <!-- Install Prompt -->
        <div id="install-prompt">
            <span>Install CLOUD.MOVIES for better experience</span>
            <button class="install-btn" id="install-btn">Install</button>
            <button class="close-install" id="close-install">&times;</button>
        </div>

        <!-- Footer -->
        <footer>
            <div class="footer-content">
                <div class="footer-brand">CLOUD.MOVIES</div>
                <p>Professional Neon Streaming Platform</p>
                <p class="footer-contact">
                    Developed by <strong>Bruce Bera</strong> - Bera Tech<br>
                    Contact: <a href="https://wa.me/254743983206" class="contact-link" target="_blank">wa.me/254743983206</a>
                </p>
            </div>
        </footer>

        <!-- JavaScript -->
        <script>
            // API Configuration
            const API_BASE = '/api/proxy';
            let currentPage = 1;
            let totalPages = 1;
            let currentSearch = '';
            let currentGenre = 'all';
            let deferredPrompt;

            // Genres
            const genres = [
                'All', 'Action', 'Comedy', 'Thriller', 'Sci-Fi', 'Horror',
                'Adult', 'Cartoon', 'Anime', 'Animation', 'Romance',
                'Drama', 'Mystery', 'Fantasy', 'Adventure'
            ];

            // Initialize
            document.addEventListener('DOMContentLoaded', async () => {
                // Hide loading screen after 2 seconds
                setTimeout(() => {
                    document.getElementById('loading-screen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('loading-screen').style.display = 'none';
                    }, 500);
                }, 2000);

                // Initialize genres
                initializeGenres();
                
                // Load initial content
                await loadTrendingContent();
                
                // Initialize search
                initializeSearch();
                
                // Initialize PWA
                initializePWA();
            });

            // Initialize genres navigation
            function initializeGenres() {
                const genreNav = document.getElementById('genre-nav');
                genres.forEach(genre => {
                    const button = document.createElement('button');
                    button.className = 'genre-btn';
                    if (genre === 'All') button.classList.add('active');
                    button.textContent = genre;
                    button.addEventListener('click', () => filterByGenre(genre));
                    genreNav.appendChild(button);
                });
            }

            // Filter content by genre
            async function filterByGenre(genre) {
                currentGenre = genre.toLowerCase();
                currentPage = 1;
                
                // Update active genre button
                document.querySelectorAll('.genre-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.textContent === genre) btn.classList.add('active');
                });
                
                if (currentSearch) {
                    await performSearch(currentSearch);
                } else {
                    await loadTrendingContent();
                }
            }

            // Initialize search functionality
            function initializeSearch() {
                const searchInput = document.getElementById('search-input');
                const searchBtn = document.getElementById('search-btn');
                
                // Search on button click
                searchBtn.addEventListener('click', async () => {
                    currentSearch = searchInput.value.trim();
                    if (currentSearch) {
                        currentPage = 1;
                        await performSearch(currentSearch);
                    }
                });
                
                // Search on Enter key
                searchInput.addEventListener('keypress', async (e) => {
                    if (e.key === 'Enter') {
                        currentSearch = searchInput.value.trim();
                        if (currentSearch) {
                            currentPage = 1;
                            await performSearch(currentSearch);
                        }
                    }
                });
            }

            // Load trending content
            async function loadTrendingContent() {
                showLoading();
                try {
                    const response = await fetch(\`\${API_BASE}/search/trending\`);
                    const data = await response.json();
                    displayContent(data.results || []);
                } catch (error) {
                    console.error('Error loading content:', error);
                    displayError('Failed to load content');
                }
            }

            // Perform search
            async function performSearch(query) {
                showLoading();
                try {
                    const response = await fetch(\`\${API_BASE}/search/\${encodeURIComponent(query)}?page=\${currentPage}\`);
                    const data = await response.json();
                    displayContent(data.results || []);
                    updatePagination(data);
                } catch (error) {
                    console.error('Search error:', error);
                    displayError('Search failed');
                }
            }

            // Display content in grid
            function displayContent(items) {
                const grid = document.getElementById('content-grid');
                grid.innerHTML = '';
                
                if (items.length === 0) {
                    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 3rem;">No content found</p>';
                    return;
                }
                
                items.forEach(item => {
                    const card = createContentCard(item);
                    grid.appendChild(card);
                });
            }

            // Create content card
            function createContentCard(item) {
                const card = document.createElement('div');
                card.className = 'content-card';
                card.innerHTML = \`
                    <img src="\${item.cover || item.poster}" alt="\${item.title}" class="card-poster" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23000%22/><text x=%2250%22 y=%2250%22 font-size=%2214%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%2300f3ff%22>\${item.title.substring(0, 10)}</text></svg>'">
                    <div class="card-info">
                        <h3 class="card-title" title="\${item.title}">\${item.title}</h3>
                        <div class="card-meta">
                            <span>\${item.year || 'N/A'}</span>
                            <span>\${item.type === 'tv' ? 'TV Series' : 'Movie'}</span>
                        </div>
                    </div>
                \`;
                
                card.addEventListener('click', () => showDetails(item.id));
                return card;
            }

            // Show content details
            async function showDetails(id) {
                showLoading();
                try {
                    const response = await fetch(\`\${API_BASE}/info/\${id}\`);
                    const data = await response.json();
                    displayDetails(data);
                } catch (error) {
                    console.error('Details error:', error);
                    displayError('Failed to load details');
                }
            }

            // Display details in modal
            function displayDetails(data) {
                const modal = document.getElementById('detail-modal');
                const modalBody = document.getElementById('modal-body');
                const modalTitle = document.getElementById('modal-title');
                
                modalTitle.textContent = data.title || 'Details';
                
                let episodesHtml = '';
                if (data.episodes && data.episodes.length > 0) {
                    episodesHtml = \`
                        <div class="episode-selector">
                            <h4>Episodes</h4>
                            \${data.episodes.map(ep => 
                                \`<button class="episode-btn" data-season="\${ep.season}" data-episode="\${ep.episode}">
                                    S\${ep.season}E\${ep.episode}
                                </button>\`
                            ).join('')}
                        </div>
                    \`;
                }
                
                modalBody.innerHTML = \`
                    <div class="detail-content">
                        <div style="display: grid; grid-template-columns: 300px 1fr; gap: 2rem; margin-bottom: 2rem;">
                            <img src="\${data.cover || data.poster}" alt="\${data.title}" 
                                 style="width: 100%; border-radius: 10px; border: 2px solid var(--neon-blue);">
                            <div>
                                <h3 style="font-size: 2rem; margin-bottom: 1rem;">\${data.title}</h3>
                                <p style="margin-bottom: 1rem; color: var(--text-secondary);">\${data.description || 'No description available'}</p>
                                <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
                                    \${data.genre ? data.genre.map(g => \`<span style="background: rgba(0, 243, 255, 0.1); padding: 5px 10px; border-radius: 15px;">\${g}</span>\`).join('') : ''}
                                </div>
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                                    <div><strong>Release:</strong> \${data.releaseDate || 'N/A'}</div>
                                    <div><strong>Duration:</strong> \${data.duration || 'N/A'}</div>
                                    <div><strong>Rating:</strong> \${data.rating || 'N/A'}</div>
                                    <div><strong>Type:</strong> \${data.type === 'tv' ? 'TV Series' : 'Movie'}</div>
                                </div>
                            </div>
                        </div>
                        
                        \${episodesHtml}
                        
                        <div class="quality-selector">
                            <h4>Quality</h4>
                            <button class="quality-btn active" data-quality="360p">360p</button>
                            <button class="quality-btn" data-quality="480p">480p</button>
                            <button class="quality-btn" data-quality="720p">720p</button>
                            <button class="quality-btn" data-quality="1080p">1080p</button>
                        </div>
                        
                        <div class="action-buttons">
                            <button class="stream-btn" id="stream-btn">
                                <span>🎬</span> Stream Now
                            </button>
                            <button class="download-btn" id="download-btn">
                                <span>⬇️</span> Download
                            </button>
                        </div>
                    </div>
                \`;
                
                // Setup quality selector
                modalBody.querySelectorAll('.quality-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        modalBody.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                    });
                });
                
                // Setup episode selector
                modalBody.querySelectorAll('.episode-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        modalBody.querySelectorAll('.episode-btn').forEach(b => b.classList.remove('active'));
                        this.classList.add('active');
                    });
                });
                
                // Setup stream button
                modalBody.querySelector('#stream-btn').addEventListener('click', () => {
                    const quality = modalBody.querySelector('.quality-btn.active').dataset.quality;
                    const episodeBtn = modalBody.querySelector('.episode-btn.active');
                    
                    let streamUrl = \`/stream/\${data.id}?quality=\${quality}\`;
                    if (episodeBtn) {
                        streamUrl += \`&season=\${episodeBtn.dataset.season}&episode=\${episodeBtn.dataset.episode}\`;
                    }
                    
                    // Create video player
                    const videoPlayer = document.createElement('div');
                    videoPlayer.className = 'video-player';
                    videoPlayer.innerHTML = \`
                        <video controls autoplay style="width: 100%; height: 100%;">
                            <source src="\${streamUrl}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    \`;
                    
                    modalBody.insertBefore(videoPlayer, modalBody.firstChild);
                });
                
                // Setup download button
                modalBody.querySelector('#download-btn').addEventListener('click', () => {
                    const quality = modalBody.querySelector('.quality-btn.active').dataset.quality;
                    const episodeBtn = modalBody.querySelector('.episode-btn.active');
                    
                    let downloadUrl = \`/download/\${data.id}?quality=\${quality}\`;
                    if (episodeBtn) {
                        downloadUrl += \`&season=\${episodeBtn.dataset.season}&episode=\${episodeBtn.dataset.episode}\`;
                    }
                    
                    window.open(downloadUrl, '_blank');
                });
                
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden';
                
                // Close modal
                document.getElementById('close-modal').addEventListener('click', () => {
                    modal.style.display = 'none';
                    document.body.style.overflow = 'auto';
                });
                
                // Close modal on outside click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                        document.body.style.overflow = 'auto';
                    }
                });
            }

            // Update pagination
            function updatePagination(data) {
                const pagination = document.getElementById('pagination');
                if (!data.totalPages || data.totalPages <= 1) {
                    pagination.innerHTML = '';
                    return;
                }
                
                totalPages = data.totalPages;
                
                let paginationHtml = '<div style="display: flex; justify-content: center; gap: 1rem; margin-top: 2rem;">';
                
                if (currentPage > 1) {
                    paginationHtml += \`<button onclick="changePage(\${currentPage - 1})" style="padding: 10px 20px; background: var(--neon-blue); border: none; border-radius: 5px; color: white; cursor: pointer;">Previous</button>\`;
                }
                
                paginationHtml += \`<span style="display: flex; align-items: center;">Page \${currentPage} of \${totalPages}</span>\`;
                
                if (currentPage < totalPages) {
                    paginationHtml += \`<button onclick="changePage(\${currentPage + 1})" style="padding: 10px 20px; background: var(--neon-blue); border: none; border-radius: 5px; color: white; cursor: pointer;">Next</button>\`;
                }
                
                paginationHtml += '</div>';
                pagination.innerHTML = paginationHtml;
            }

            // Change page
            window.changePage = async function(page) {
                currentPage = page;
                if (currentSearch) {
                    await performSearch(currentSearch);
                } else {
                    await loadTrendingContent();
                }
                window.scrollTo(0, 0);
            }

            // Show loading indicator
            function showLoading() {
                const grid = document.getElementById('content-grid');
                grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 3rem;">Loading...</p>';
            }

            // Display error
            function displayError(message) {
                const grid = document.getElementById('content-grid');
                grid.innerHTML = \`<p style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--neon-pink);">\${message}</p>\`;
            }

            // PWA Initialization
            function initializePWA() {
                // Service Worker Registration
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register('/sw.js').then(() => {
                        console.log('Service Worker registered');
                    }).catch(err => {
                        console.error('Service Worker registration failed:', err);
                    });
                }
                
                // Install Prompt
                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    deferredPrompt = e;
                    
                    // Show install prompt after 5 seconds
                    setTimeout(() => {
                        const installPrompt = document.getElementById('install-prompt');
                        installPrompt.style.display = 'flex';
                    }, 5000);
                });
                
                // Install button
                document.getElementById('install-btn').addEventListener('click', async () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        const { outcome } = await deferredPrompt.userChoice;
                        if (outcome === 'accepted') {
                            document.getElementById('install-prompt').style.display = 'none';
                        }
                        deferredPrompt = null;
                    }
                });
                
                // Close install prompt
                document.getElementById('close-install').addEventListener('click', () => {
                    document.getElementById('install-prompt').style.display = 'none';
                });
            }
        </script>
    </body>
    </html>
    `);
});

// Service Worker
app.get('/sw.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`
        const CACHE_NAME = 'cloud-movies-v1';
        const urlsToCache = [
            '/',
            '/styles.css',
            '/app.js'
        ];

        self.addEventListener('install', event => {
            event.waitUntil(
                caches.open(CACHE_NAME)
                    .then(cache => cache.addAll(urlsToCache))
            );
        });

        self.addEventListener('fetch', event => {
            event.respondWith(
                caches.match(event.request)
                    .then(response => {
                        if (response) {
                            return response;
                        }
                        return fetch(event.request).then(response => {
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            return response;
                        });
                    })
            );
        });

        self.addEventListener('activate', event => {
            const cacheWhitelist = [CACHE_NAME];
            event.waitUntil(
                caches.keys().then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => {
                            if (!cacheWhitelist.includes(cacheName)) {
                                return caches.delete(cacheName);
                            }
                        })
                    );
                })
            );
        });
    `);
});

// Manifest
app.get('/manifest.json', (req, res) => {
    res.json({
        "name": "CLOUD.MOVIES",
        "short_name": "CloudMovies",
        "description": "Neon-themed movie streaming platform",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0a0a1a",
        "theme_color": "#00f3ff",
        "icons": [
            {
                "src": "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22 fill=%22%2300f3ff%22>🎬</text></svg>",
                "sizes": "any",
                "type": "image/svg+xml"
            }
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 CLOUD.MOVIES server running on port ${PORT}`);
    console.log(`📱 Developed by Bruce Bera - Bera Tech`);
    console.log(`📞 Contact: wa.me/254743983206`);
});
