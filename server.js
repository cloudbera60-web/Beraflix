const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

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

// API Proxy endpoints
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = '1' } = req.query;
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}`);
        const data = await response.json();
        
        // Transform data to match our expected format
        if (data.results && data.results.items) {
            const items = data.results.items.map(item => ({
                id: item.subjectId,
                title: item.title,
                description: item.description,
                year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
                type: item.subjectType === 1 ? 'movie' : 'tv',
                cover: item.cover?.url || item.thumbnail,
                poster: item.cover?.url || item.thumbnail,
                genre: item.genre ? item.genre.split(',').map(g => g.trim()) : [],
                duration: item.duration,
                rating: item.imdbRatingValue,
                releaseDate: item.releaseDate
            }));
            
            res.json({
                success: true,
                results: items,
                pagination: data.results.pager || {
                    page: parseInt(page),
                    totalPages: Math.ceil((data.results.pager?.totalCount || 0) / 24),
                    hasMore: data.results.pager?.hasMore || false
                }
            });
        } else {
            res.json({ success: true, results: [], pagination: { page: 1, totalPages: 1, hasMore: false } });
        }
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Info endpoint
app.get('/api/info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const response = await fetch(`${API_BASE}/info/${id}`);
        const data = await response.json();
        
        if (data.results && data.results.subject) {
            const subject = data.results.subject;
            const stars = data.results.stars || [];
            const resource = data.results.resource || {};
            
            // Extract episodes if it's a TV series
            let episodes = [];
            if (resource.seasons && Array.isArray(resource.seasons)) {
                resource.seasons.forEach(season => {
                    if (season.se !== undefined && season.resolutions) {
                        const maxEp = season.maxEp || season.resolutions[0]?.epNum || 1;
                        for (let i = 1; i <= maxEp; i++) {
                            episodes.push({
                                season: season.se,
                                episode: i
                            });
                        }
                    }
                });
            }
            
            res.json({
                success: true,
                data: {
                    id: subject.subjectId,
                    title: subject.title,
                    description: subject.description,
                    type: subject.subjectType === 1 ? 'movie' : 'tv',
                    cover: subject.cover?.url || subject.thumbnail,
                    poster: subject.cover?.url || subject.thumbnail,
                    trailer: subject.trailer?.videoAddress?.url,
                    genre: subject.genre ? subject.genre.split(',').map(g => g.trim()) : [],
                    releaseDate: subject.releaseDate,
                    duration: subject.duration,
                    rating: subject.imdbRatingValue,
                    country: subject.countryName,
                    cast: stars.map(star => ({
                        name: star.name,
                        character: star.character,
                        avatar: star.avatarUrl
                    })),
                    episodes: episodes,
                    seasons: resource.seasons || [],
                    hasResource: subject.hasResource
                }
            });
        } else {
            res.status(404).json({ success: false, error: 'Content not found' });
        }
    } catch (error) {
        console.error('Info error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch info' });
    }
});

// Sources endpoint
app.get('/api/sources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode } = req.query;
        
        let apiUrl = `${API_BASE}/sources/${id}`;
        if (season) apiUrl += `?season=${season}`;
        if (episode) apiUrl += `${season ? '&' : '?'}episode=${episode}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.results && Array.isArray(data.results)) {
            res.json({
                success: true,
                sources: data.results.map(source => ({
                    id: source.id,
                    quality: source.quality,
                    download_url: source.download_url,
                    size: source.size,
                    format: source.format
                }))
            });
        } else {
            res.json({ success: true, sources: [] });
        }
    } catch (error) {
        console.error('Sources error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch sources' });
    }
});

// Stream endpoint - using the direct download URL from API
app.get('/api/stream/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode, quality = '720p' } = req.query;
        
        // First get sources
        let sourcesUrl = `${API_BASE}/sources/${id}`;
        if (season) sourcesUrl += `?season=${season}`;
        if (episode) sourcesUrl += `${season ? '&' : '?'}episode=${episode}`;
        
        const sourcesResponse = await fetch(sourcesUrl);
        const sourcesData = await sourcesResponse.json();
        
        if (!sourcesData.results || sourcesData.results.length === 0) {
            return res.status(404).json({ error: 'No sources available' });
        }
        
        // Find the requested quality
        const source = sourcesData.results.find(s => s.quality === quality);
        if (!source) {
            // Fallback to first available quality
            const fallbackSource = sourcesData.results[0];
            res.redirect(fallbackSource.download_url);
        } else {
            res.redirect(source.download_url);
        }
    } catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ error: 'Streaming failed' });
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
        
        <!-- Font Awesome -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        
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
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 10px;
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
                background: rgba(0, 0, 0, 0.95);
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
            .video-container {
                width: 100%;
                max-width: 800px;
                margin: 0 auto 2rem;
                background: #000;
                border-radius: 10px;
                overflow: hidden;
                position: relative;
            }
            
            #video-player {
                width: 100%;
                height: 450px;
                background: #000;
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
                flex-wrap: wrap;
            }
            
            .stream-btn, .download-btn, .trailer-btn {
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
            
            .trailer-btn {
                background: linear-gradient(45deg, var(--neon-pink), #ff0080);
                color: white;
            }
            
            .stream-btn:hover, .download-btn:hover, .trailer-btn:hover {
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
                
                #video-player {
                    height: 300px;
                }
                
                .logo-text {
                    font-size: 3rem;
                }
                
                .modal-content {
                    margin: 0;
                    border-radius: 0;
                    min-height: 100vh;
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
                
                .modal-body {
                    padding: 1rem;
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
            
            /* Loading state */
            .loading {
                opacity: 0.7;
                pointer-events: none;
            }
            
            /* Error message */
            .error-message {
                grid-column: 1 / -1;
                text-align: center;
                padding: 3rem;
                color: var(--neon-pink);
                font-size: 1.2rem;
            }
            
            /* Cast section */
            .cast-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 1rem;
                margin: 1.5rem 0;
            }
            
            .cast-card {
                background: rgba(0, 243, 255, 0.05);
                border-radius: 10px;
                padding: 1rem;
                text-align: center;
            }
            
            .cast-avatar {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                object-fit: cover;
                margin-bottom: 0.5rem;
                border: 2px solid var(--neon-blue);
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
                <a href="/" class="site-logo">
                    <i class="fas fa-film"></i>
                    CLOUD.MOVIES
                </a>
                <div class="search-container">
                    <input type="text" id="search-input" placeholder="Search movies and TV series...">
                    <button class="search-btn" id="search-btn">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main>
            <section class="hero-section">
                <h1 class="hero-title">Stream Unlimited Movies & Series</h1>
                <p class="hero-subtitle">Neon-powered entertainment at your fingertips</p>
                <div style="margin-top: 2rem;">
                    <input type="text" id="home-search" placeholder="Try 'Avatar', 'Stranger Things', 'Black Panther'..." 
                           style="width: 100%; max-width: 500px; padding: 15px; border-radius: 30px; border: 2px solid var(--neon-blue); background: rgba(0,0,0,0.3); color: white; font-size: 1.1rem;">
                </div>
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
                <div class="footer-brand">
                    <i class="fas fa-cloud"></i> CLOUD.MOVIES
                </div>
                <p>Professional Neon Streaming Platform by Bera Tech</p>
                <p class="footer-contact">
                    Developed by <strong>Bruce Bera</strong><br>
                    Contact: <a href="https://wa.me/254743983206" class="contact-link" target="_blank">
                        <i class="fab fa-whatsapp"></i> wa.me/254743983206
                    </a>
                </p>
                <p style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
                    Powered by Gifted Movies API
                </p>
            </div>
        </footer>

        <!-- JavaScript -->
        <script>
            // API Configuration
            let currentPage = 1;
            let totalPages = 1;
            let currentSearch = '';
            let currentGenre = 'all';
            let currentContent = [];
            let deferredPrompt;
            let selectedMovieId = null;
            let selectedSeason = null;
            let selectedEpisode = null;
            let selectedQuality = '720p';

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
                
                // Initialize search functionality
                initializeSearch();
                
                // Load trending content
                await loadTrendingContent();
                
                // Initialize PWA
                initializePWA();
                
                // Setup home search
                document.getElementById('home-search').addEventListener('keypress', async (e) => {
                    if (e.key === 'Enter') {
                        const query = e.target.value.trim();
                        if (query) {
                            document.getElementById('search-input').value = query;
                            await performSearch(query);
                        }
                    }
                });
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
            function filterByGenre(genre) {
                currentGenre = genre.toLowerCase();
                
                // Update active genre button
                document.querySelectorAll('.genre-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.textContent === genre) btn.classList.add('active');
                });
                
                if (currentGenre === 'all') {
                    displayContent(currentContent);
                } else {
                    const filtered = currentContent.filter(item => 
                        item.genre && item.genre.some(g => 
                            g.toLowerCase().includes(currentGenre)
                        )
                    );
                    displayContent(filtered);
                }
            }

            // Initialize search functionality
            function initializeSearch() {
                const searchInput = document.getElementById('search-input');
                const searchBtn = document.getElementById('search-btn');
                
                searchBtn.addEventListener('click', async () => {
                    const query = searchInput.value.trim();
                    if (query) {
                        await performSearch(query);
                    }
                });
                
                searchInput.addEventListener('keypress', async (e) => {
                    if (e.key === 'Enter') {
                        const query = e.target.value.trim();
                        if (query) {
                            await performSearch(query);
                        }
                    }
                });
            }

            // Load trending content
            async function loadTrendingContent() {
                showLoading();
                try {
                    // Search for popular movies to show initially
                    const response = await fetch('/api/search/avengers');
                    const data = await response.json();
                    
                    if (data.success && data.results.length > 0) {
                        currentContent = data.results;
                        displayContent(data.results);
                        updatePagination(data.pagination);
                    } else {
                        // Fallback search
                        await performSearch('movie');
                    }
                } catch (error) {
                    console.error('Error loading content:', error);
                    showError('Failed to load content. Please try again.');
                }
            }

            // Perform search
            async function performSearch(query) {
                showLoading();
                currentSearch = query;
                currentPage = 1;
                
                try {
                    const response = await fetch(\`/api/search/\${encodeURIComponent(query)}\`);
                    const data = await response.json();
                    
                    if (data.success) {
                        currentContent = data.results;
                        displayContent(data.results);
                        updatePagination(data.pagination);
                        
                        // Scroll to content
                        document.querySelector('.content-grid').scrollIntoView({ 
                            behavior: 'smooth' 
                        });
                    } else {
                        showError('No results found. Try another search.');
                    }
                } catch (error) {
                    console.error('Search error:', error);
                    showError('Search failed. Please try again.');
                }
            }

            // Display content in grid
            function displayContent(items) {
                const grid = document.getElementById('content-grid');
                
                if (!items || items.length === 0) {
                    grid.innerHTML = '<div class="error-message">No content found</div>';
                    return;
                }
                
                grid.innerHTML = items.map(item => \`
                    <div class="content-card" data-id="\${item.id}">
                        <img src="\${item.cover || item.poster || 'https://via.placeholder.com/300x450?text=No+Image'}" 
                             alt="\${item.title}" 
                             class="card-poster"
                             onerror="this.src='https://via.placeholder.com/300x450?text=No+Image'">
                        <div class="card-info">
                            <h3 class="card-title" title="\${item.title}">\${item.title}</h3>
                            <div class="card-meta">
                                <span>\${item.year || 'N/A'}</span>
                                <span>\${item.type === 'tv' ? 'TV' : 'Movie'}</span>
                            </div>
                            \${item.rating ? \`<div style="color: gold; margin-top: 5px;">⭐ \${item.rating}</div>\` : ''}
                        </div>
                    </div>
                \`).join('');
                
                // Add click event listeners
                grid.querySelectorAll('.content-card').forEach(card => {
                    card.addEventListener('click', async () => {
                        const id = card.dataset.id;
                        await showDetails(id);
                    });
                });
            }

            // Show content details
            async function showDetails(id) {
                showLoading();
                selectedMovieId = id;
                
                try {
                    const response = await fetch(\`/api/info/\${id}\`);
                    const data = await response.json();
                    
                    if (data.success) {
                        displayDetails(data.data);
                    } else {
                        showError('Failed to load details.');
                    }
                } catch (error) {
                    console.error('Details error:', error);
                    showError('Failed to load details.');
                }
            }

            // Display details in modal
            function displayDetails(movie) {
                const modal = document.getElementById('detail-modal');
                const modalBody = document.getElementById('modal-body');
                const modalTitle = document.getElementById('modal-title');
                
                modalTitle.textContent = movie.title;
                
                // Reset selections
                selectedSeason = null;
                selectedEpisode = null;
                selectedQuality = '720p';
                
                // Check if it's a TV series
                const isTV = movie.type === 'tv';
                const hasEpisodes = movie.episodes && movie.episodes.length > 0;
                
                // Build episodes HTML if available
                let episodesHtml = '';
                if (hasEpisodes) {
                    const seasons = [...new Set(movie.episodes.map(ep => ep.season))];
                    
                    episodesHtml = \`
                        <div class="episode-selector">
                            <h3><i class="fas fa-tv"></i> Seasons & Episodes</h3>
                            <div style="margin-bottom: 1rem;">
                                <strong>Select Season:</strong>
                                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                                    \${seasons.map(season => \`
                                        <button class="season-btn" data-season="\${season}">
                                            Season \${season}
                                        </button>
                                    \`).join('')}
                                </div>
                            </div>
                            <div id="episodes-container" style="display: none;">
                                <strong>Select Episode:</strong>
                                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;" id="episodes-list">
                                </div>
                            </div>
                        </div>
                    \`;
                }
                
                // Build cast HTML if available
                let castHtml = '';
                if (movie.cast && movie.cast.length > 0) {
                    castHtml = \`
                        <div style="margin: 2rem 0;">
                            <h3><i class="fas fa-users"></i> Cast</h3>
                            <div class="cast-grid">
                                \${movie.cast.slice(0, 6).map(person => \`
                                    <div class="cast-card">
                                        <img src="\${person.avatar || 'https://via.placeholder.com/80?text=No+Image'}" 
                                             alt="\${person.name}" 
                                             class="cast-avatar"
                                             onerror="this.src='https://via.placeholder.com/80?text=No+Image'">
                                        <div>
                                            <strong>\${person.name}</strong>
                                            <div style="font-size: 0.9rem; color: var(--text-secondary);">
                                                \${person.character || 'Actor'}
                                            </div>
                                        </div>
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`;
                }
                
                modalBody.innerHTML = \`
                    <div class="detail-content">
                        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; margin-bottom: 2rem;">
                            <div>
                                <img src="\${movie.poster || movie.cover || 'https://via.placeholder.com/300x450?text=No+Image'}" 
                                     alt="\${movie.title}" 
                                     style="width: 100%; border-radius: 10px; border: 2px solid var(--neon-blue);"
                                     onerror="this.src='https://via.placeholder.com/300x450?text=No+Image'">
                            </div>
                            <div>
                                <h2 style="font-size: 2rem; margin-bottom: 1rem; color: var(--neon-blue);">\${movie.title}</h2>
                                <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
                                    \${movie.genre && movie.genre.length > 0 ? movie.genre.map(g => \`
                                        <span style="background: rgba(0, 243, 255, 0.1); padding: 5px 15px; border-radius: 20px; border: 1px solid var(--neon-blue);">
                                            \${g}
                                        </span>
                                    \`).join('') : ''}
                                </div>
                                <p style="margin-bottom: 1.5rem; line-height: 1.6; color: var(--text-secondary);">
                                    \${movie.description || 'No description available.'}
                                </p>
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                                    <div><strong><i class="fas fa-calendar"></i> Release:</strong> \${movie.releaseDate || 'N/A'}</div>
                                    <div><strong><i class="fas fa-clock"></i> Duration:</strong> \${movie.duration ? Math.floor(movie.duration / 60) + ' min' : 'N/A'}</div>
                                    <div><strong><i class="fas fa-star"></i> Rating:</strong> \${movie.rating || 'N/A'}</div>
                                    <div><strong><i class="fas fa-globe"></i> Country:</strong> \${movie.country || 'N/A'}</div>
                                    <div><strong><i class="fas fa-film"></i> Type:</strong> \${isTV ? 'TV Series' : 'Movie'}</div>
                                    \${movie.hasResource ? '<div><strong><i class="fas fa-check-circle"></i> Available:</strong> Yes</div>' : ''}
                                </div>
                            </div>
                        </div>
                        
                        \${castHtml}
                        
                        \${episodesHtml}
                        
                        <div class="quality-selector">
                            <h3><i class="fas fa-hd"></i> Select Quality</h3>
                            <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                                <button class="quality-btn active" data-quality="360p">360p</button>
                                <button class="quality-btn" data-quality="480p">480p</button>
                                <button class="quality-btn" data-quality="720p">720p</button>
                            </div>
                        </div>
                        
                        <div class="action-buttons">
                            <button class="stream-btn" id="play-stream">
                                <i class="fas fa-play"></i> Stream Now
                            </button>
                            <button class="download-btn" id="download-movie">
                                <i class="fas fa-download"></i> Download
                            </button>
                            \${movie.trailer ? \`
                                <button class="trailer-btn" id="play-trailer">
                                    <i class="fas fa-play-circle"></i> Watch Trailer
                                </button>
                            \` : ''}
                        </div>
                        
                        <div id="video-container" class="video-container" style="display: none;">
                            <video id="video-player" controls>
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>
                \`;
                
                // Setup season/episode selectors for TV shows
                if (hasEpisodes) {
                    modalBody.querySelectorAll('.season-btn').forEach(btn => {
                        btn.addEventListener('click', function() {
                            selectedSeason = this.dataset.season;
                            
                            // Update active season
                            modalBody.querySelectorAll('.season-btn').forEach(b => 
                                b.classList.remove('active')
                            );
                            this.classList.add('active');
                            
                            // Show episodes for this season
                            const episodesContainer = modalBody.querySelector('#episodes-container');
                            const episodesList = modalBody.querySelector('#episodes-list');
                            
                            const seasonEpisodes = movie.episodes.filter(ep => ep.season == selectedSeason);
                            
                            episodesList.innerHTML = seasonEpisodes.map(ep => \`
                                <button class="episode-btn" data-episode="\${ep.episode}">
                                    Episode \${ep.episode}
                                </button>
                            \`).join('');
                            
                            episodesContainer.style.display = 'block';
                            
                            // Setup episode click
                            episodesList.querySelectorAll('.episode-btn').forEach(epBtn => {
                                epBtn.addEventListener('click', function() {
                                    selectedEpisode = this.dataset.episode;
                                    
                                    // Update active episode
                                    episodesList.querySelectorAll('.episode-btn').forEach(b => 
                                        b.classList.remove('active')
                                    );
                                    this.classList.add('active');
                                });
                            });
                        });
                    });
                }
                
                // Setup quality selector
                modalBody.querySelectorAll('.quality-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        selectedQuality = this.dataset.quality;
                        
                        modalBody.querySelectorAll('.quality-btn').forEach(b => 
                            b.classList.remove('active')
                        );
                        this.classList.add('active');
                    });
                });
                
                // Setup play stream button
                modalBody.querySelector('#play-stream').addEventListener('click', async () => {
                    await playStream();
                });
                
                // Setup download button
                modalBody.querySelector('#download-movie').addEventListener('click', async () => {
                    await downloadMovie();
                });
                
                // Setup trailer button
                if (movie.trailer) {
                    modalBody.querySelector('#play-trailer').addEventListener('click', () => {
                        const videoContainer = modalBody.querySelector('#video-container');
                        const videoPlayer = modalBody.querySelector('#video-player');
                        
                        videoPlayer.src = movie.trailer;
                        videoContainer.style.display = 'block';
                        videoPlayer.play();
                    });
                }
                
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden';
                
                // Close modal
                document.getElementById('close-modal').addEventListener('click', closeModal);
                
                // Close modal on outside click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        closeModal();
                    }
                });
            }

            // Play stream
            async function playStream() {
                if (!selectedMovieId) return;
                
                try {
                    const videoContainer = document.querySelector('#video-container');
                    const videoPlayer = document.querySelector('#video-player');
                    
                    // Build URL with parameters
                    let streamUrl = \`/api/stream/\${selectedMovieId}?quality=\${selectedQuality}\`;
                    if (selectedSeason) streamUrl += \`&season=\${selectedSeason}\`;
                    if (selectedEpisode) streamUrl += \`&episode=\${selectedEpisode}\`;
                    
                    videoPlayer.src = streamUrl;
                    videoContainer.style.display = 'block';
                    videoPlayer.play();
                    
                    // Scroll to video
                    videoContainer.scrollIntoView({ behavior: 'smooth' });
                } catch (error) {
                    console.error('Stream error:', error);
                    showError('Failed to start stream. Please try again.');
                }
            }

            // Download movie
            async function downloadMovie() {
                if (!selectedMovieId) return;
                
                try {
                    // First get sources to get the direct download URL
                    let sourcesUrl = \`/api/sources/\${selectedMovieId}\`;
                    if (selectedSeason) sourcesUrl += \`?season=\${selectedSeason}\`;
                    if (selectedEpisode) sourcesUrl += \`\${selectedSeason ? '&' : '?'}episode=\${selectedEpisode}\`;
                    
                    const response = await fetch(sourcesUrl);
                    const data = await response.json();
                    
                    if (data.success && data.sources.length > 0) {
                        // Find the selected quality or fallback to first available
                        const source = data.sources.find(s => s.quality === selectedQuality) || data.sources[0];
                        
                        if (source && source.download_url) {
                            // Create a temporary link to trigger download
                            const link = document.createElement('a');
                            link.href = source.download_url;
                            link.download = \`\${document.getElementById('modal-title').textContent} - \${selectedQuality}.mp4\`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } else {
                            showError('Download not available for this quality.');
                        }
                    } else {
                        showError('Download sources not available.');
                    }
                } catch (error) {
                    console.error('Download error:', error);
                    showError('Download failed. Please try again.');
                }
            }

            // Update pagination
            function updatePagination(pagination) {
                const paginationDiv = document.getElementById('pagination');
                
                if (!pagination || pagination.totalPages <= 1) {
                    paginationDiv.innerHTML = '';
                    return;
                }
                
                totalPages = pagination.totalPages;
                
                let html = '<div style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin: 2rem 0;">';
                
                if (currentPage > 1) {
                    html += \`<button onclick="changePage(\${currentPage - 1})" 
                                    style="padding: 10px 20px; background: var(--neon-blue); border: none; border-radius: 5px; color: white; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                <i class="fas fa-chevron-left"></i> Previous
                            </button>\`;
                }
                
                html += \`<span style="padding: 10px 20px; background: rgba(0, 243, 255, 0.1); border-radius: 5px;">
                            Page \${currentPage} of \${totalPages}
                         </span>\`;
                
                if (currentPage < totalPages) {
                    html += \`<button onclick="changePage(\${currentPage + 1})" 
                                    style="padding: 10px 20px; background: var(--neon-blue); border: none; border-radius: 5px; color: white; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                                Next <i class="fas fa-chevron-right"></i>
                            </button>\`;
                }
                
                html += '</div>';
                paginationDiv.innerHTML = html;
            }

            // Change page
            window.changePage = async function(page) {
                if (page < 1 || page > totalPages) return;
                
                currentPage = page;
                showLoading();
                
                try {
                    const response = await fetch(\`/api/search/\${encodeURIComponent(currentSearch)}?page=\${page}\`);
                    const data = await response.json();
                    
                    if (data.success) {
                        currentContent = data.results;
                        displayContent(data.results);
                        updatePagination(data.pagination);
                        
                        // Scroll to top
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                } catch (error) {
                    console.error('Page change error:', error);
                    showError('Failed to load page.');
                }
            }

            // Show loading state
            function showLoading() {
                const grid = document.getElementById('content-grid');
                grid.innerHTML = \`
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                        <div style="display: inline-block; padding: 20px; border-radius: 10px; background: rgba(0, 243, 255, 0.1);">
                            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--neon-blue);"></i>
                            <div style="margin-top: 10px; color: var(--neon-blue);">Loading...</div>
                        </div>
                    </div>
                \`;
            }

            // Show error message
            function showError(message) {
                const grid = document.getElementById('content-grid');
                grid.innerHTML = \`
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <div>\${message}</div>
                    </div>
                \`;
            }

            // Close modal
            function closeModal() {
                const modal = document.getElementById('detail-modal');
                const videoPlayer = document.querySelector('#video-player');
                
                if (videoPlayer) {
                    videoPlayer.pause();
                    videoPlayer.src = '';
                }
                
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }

            // PWA Initialization
            function initializePWA() {
                // Service Worker Registration
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.register('/sw.js')
                        .then(registration => {
                            console.log('Service Worker registered:', registration);
                        })
                        .catch(error => {
                            console.error('Service Worker registration failed:', error);
                        });
                }
                
                // Install Prompt
                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    deferredPrompt = e;
                    
                    // Show install prompt after 5 seconds
                    setTimeout(() => {
                        const installPrompt = document.getElementById('install-prompt');
                        if (installPrompt) {
                            installPrompt.style.display = 'flex';
                        }
                    }, 5000);
                });
                
                // Install button
                const installBtn = document.getElementById('install-btn');
                if (installBtn) {
                    installBtn.addEventListener('click', async () => {
                        if (deferredPrompt) {
                            deferredPrompt.prompt();
                            const { outcome } = await deferredPrompt.userChoice;
                            if (outcome === 'accepted') {
                                document.getElementById('install-prompt').style.display = 'none';
                            }
                            deferredPrompt = null;
                        }
                    });
                }
                
                // Close install prompt
                const closeInstall = document.getElementById('close-install');
                if (closeInstall) {
                    closeInstall.addEventListener('click', () => {
                        document.getElementById('install-prompt').style.display = 'none';
                    });
                }
                
                // Detect if app is running as PWA
                if (window.matchMedia('(display-mode: standalone)').matches) {
                    console.log('Running as PWA');
                }
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
        
        // Assets to cache on install
        const urlsToCache = [
            '/',
            '/manifest.json'
        ];
        
        // Install event
        self.addEventListener('install', event => {
            event.waitUntil(
                caches.open(CACHE_NAME)
                    .then(cache => {
                        console.log('Opened cache');
                        return cache.addAll(urlsToCache);
                    })
            );
        });
        
        // Activate event
        self.addEventListener('activate', event => {
            event.waitUntil(
                caches.keys().then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => {
                            if (cacheName !== CACHE_NAME) {
                                console.log('Deleting old cache:', cacheName);
                                return caches.delete(cacheName);
                            }
                        })
                    );
                })
            );
        });
        
        // Fetch event
        self.addEventListener('fetch', event => {
            // Skip non-GET requests and chrome-extension requests
            if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
                return;
            }
            
            event.respondWith(
                caches.match(event.request)
                    .then(response => {
                        // Return cached response if found
                        if (response) {
                            return response;
                        }
                        
                        // Clone the request
                        const fetchRequest = event.request.clone();
                        
                        return fetch(fetchRequest).then(response => {
                            // Check if valid response
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            
                            // Clone the response
                            const responseToCache = response.clone();
                            
                            // Cache the response
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            
                            return response;
                        }).catch(error => {
                            console.error('Fetch failed:', error);
                            // Return offline page or cached response
                            return caches.match('/');
                        });
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
        "orientation": "portrait",
        "icons": [
            {
                "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%2300f3ff'>🎬</text></svg>",
                "sizes": "any",
                "type": "image/svg+xml",
                "purpose": "any maskable"
            },
            {
                "src": "https://api.dicebear.com/7.x/icons/svg?seed=cloudmovies&backgroundType=gradientLinear&backgroundRotation=45&backgroundColor=00f3ff,bc13fe",
                "sizes": "192x192",
                "type": "image/svg+xml"
            },
            {
                "src": "https://api.dicebear.com/7.x/icons/svg?seed=cloudmovies&backgroundType=gradientLinear&backgroundRotation=45&backgroundColor=00f3ff,bc13fe",
                "sizes": "512x512",
                "type": "image/svg+xml"
            }
        ],
        "categories": ["entertainment", "movies", "video"],
        "shortcuts": [
            {
                "name": "Search Movies",
                "short_name": "Search",
                "description": "Search for movies and TV series",
                "url": "/?search",
                "icons": [{ "src": "https://api.dicebear.com/7.x/icons/svg?seed=search&backgroundColor=00f3ff", "sizes": "96x96" }]
            },
            {
                "name": "Trending Now",
                "short_name": "Trending",
                "description": "Browse trending content",
                "url": "/?trending",
                "icons": [{ "src": "https://api.dicebear.com/7.x/icons/svg?seed=trending&backgroundColor=bc13fe", "sizes": "96x96" }]
            }
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 CLOUD.MOVIES server running on port ${PORT}`);
    console.log(`📱 Developed by Bruce Bera - Bera Tech`);
    console.log(`📞 Contact: wa.me/254743983206`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});
