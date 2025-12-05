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

// Test the API connection
async function testAPI() {
    try {
        console.log('Testing API connection...');
        const response = await fetch(`${API_BASE}/search/movie`);
        const data = await response.json();
        console.log('API Test Result:', data.status || 'Connected');
        return true;
    } catch (error) {
        console.error('API Test Failed:', error.message);
        return false;
    }
}

// API Proxy endpoints
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        console.log('Searching for:', query);
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results && data.results.items) {
            const items = data.results.items.map(item => ({
                id: item.subjectId,
                title: item.title || 'Untitled',
                description: item.description || '',
                year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
                type: item.subjectType === 1 ? 'movie' : 'tv',
                cover: item.cover?.url || item.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80',
                poster: item.cover?.url || item.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80',
                genre: item.genre ? item.genre.split(',').map(g => g.trim()) : [],
                duration: item.duration,
                rating: item.imdbRatingValue || 'N/A',
                releaseDate: item.releaseDate || 'N/A',
                country: item.countryName || 'N/A'
            }));
            
            console.log(`Found ${items.length} items for "${query}"`);
            res.json({
                success: true,
                results: items,
                pagination: {
                    page: 1,
                    totalPages: Math.ceil((data.results.pager?.totalCount || 0) / 24),
                    hasMore: data.results.pager?.hasMore || false
                }
            });
        } else {
            console.log('No items found for:', query);
            res.json({ 
                success: true, 
                results: [],
                pagination: { page: 1, totalPages: 1, hasMore: false }
            });
        }
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Search failed',
            message: error.message 
        });
    }
});

// Get initial movies (trending)
app.get('/api/trending', async (req, res) => {
    try {
        console.log('Fetching trending content...');
        
        // Try multiple search terms to get variety
        const searchTerms = ['movie', '2024', 'action', 'comedy', 'drama'];
        const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        
        const response = await fetch(`${API_BASE}/search/${randomTerm}`);
        const data = await response.json();
        
        if (data.results && data.results.items) {
            const items = data.results.items.slice(0, 20).map(item => ({
                id: item.subjectId,
                title: item.title || 'Untitled',
                description: item.description || '',
                year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
                type: item.subjectType === 1 ? 'movie' : 'tv',
                cover: item.cover?.url || item.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80',
                poster: item.cover?.url || item.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80',
                genre: item.genre ? item.genre.split(',').map(g => g.trim()) : [],
                duration: item.duration,
                rating: item.imdbRatingValue || 'N/A',
                releaseDate: item.releaseDate || 'N/A'
            }));
            
            console.log(`Found ${items.length} trending items`);
            res.json({
                success: true,
                results: items
            });
        } else {
            console.log('No trending items found');
            res.json({ success: true, results: [] });
        }
    } catch (error) {
        console.error('Trending error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch trending content',
            message: error.message 
        });
    }
});

// Info endpoint
app.get('/api/info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Fetching info for ID:', id);
        
        const response = await fetch(`${API_BASE}/info/${id}`);
        const data = await response.json();
        
        if (data.results && data.results.subject) {
            const subject = data.results.subject;
            const stars = data.results.stars || [];
            const resource = data.results.resource || {};
            
            // Extract episodes if it's a TV series
            let episodes = [];
            let seasonsData = [];
            if (resource.seasons && Array.isArray(resource.seasons)) {
                resource.seasons.forEach(season => {
                    if (season.se !== undefined && season.resolutions) {
                        const maxEp = season.maxEp || season.resolutions[0]?.epNum || 1;
                        seasonsData.push({
                            season: season.se,
                            episodeCount: maxEp
                        });
                        for (let i = 1; i <= maxEp; i++) {
                            episodes.push({
                                season: season.se,
                                episode: i,
                                resolutions: season.resolutions.map(r => r.resolution)
                            });
                        }
                    }
                });
            }
            
            const result = {
                success: true,
                data: {
                    id: subject.subjectId,
                    title: subject.title || 'Untitled',
                    description: subject.description || 'No description available',
                    type: subject.subjectType === 1 ? 'movie' : 'tv',
                    cover: subject.cover?.url || subject.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80',
                    poster: subject.cover?.url || subject.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80',
                    trailer: subject.trailer?.videoAddress?.url,
                    genre: subject.genre ? subject.genre.split(',').map(g => g.trim()) : [],
                    releaseDate: subject.releaseDate || 'N/A',
                    duration: subject.duration,
                    rating: subject.imdbRatingValue || 'N/A',
                    country: subject.countryName || 'N/A',
                    cast: stars.map(star => ({
                        name: star.name || 'Unknown',
                        character: star.character || 'Actor',
                        avatar: star.avatarUrl || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=200&q=80'
                    })),
                    episodes: episodes,
                    seasons: seasonsData,
                    hasResource: subject.hasResource || false,
                    subtitles: subject.subtitles || 'None'
                }
            };
            
            console.log('Info fetched successfully for:', subject.title);
            res.json(result);
        } else {
            console.log('Info not found for ID:', id);
            res.status(404).json({ 
                success: false, 
                error: 'Content not found' 
            });
        }
    } catch (error) {
        console.error('Info error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch info',
            message: error.message 
        });
    }
});

// Sources endpoint
app.get('/api/sources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode } = req.query;
        
        console.log('Fetching sources for ID:', id, 'Season:', season, 'Episode:', episode);
        
        let apiUrl = `${API_BASE}/sources/${id}`;
        if (season) apiUrl += `?season=${season}`;
        if (episode) apiUrl += `${season ? '&' : '?'}episode=${episode}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.results && Array.isArray(data.results)) {
            console.log('Found sources:', data.results.length);
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
            console.log('No sources found');
            res.json({ 
                success: true, 
                sources: [] 
            });
        }
    } catch (error) {
        console.error('Sources error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch sources',
            message: error.message 
        });
    }
});

// Stream endpoint - redirect to direct download URL
app.get('/api/stream/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode, quality = '720p' } = req.query;
        
        console.log('Stream request for:', { id, season, episode, quality });
        
        // First get sources
        let sourcesUrl = `${API_BASE}/sources/${id}`;
        if (season) sourcesUrl += `?season=${season}`;
        if (episode) sourcesUrl += `${season ? '&' : '?'}episode=${episode}`;
        
        const sourcesResponse = await fetch(sourcesUrl);
        const sourcesData = await sourcesResponse.json();
        
        if (!sourcesData.results || sourcesData.results.length === 0) {
            return res.status(404).json({ 
                error: 'No sources available' 
            });
        }
        
        // Find the requested quality or fallback
        let source = sourcesData.results.find(s => s.quality === quality);
        if (!source && sourcesData.results.length > 0) {
            source = sourcesData.results[0];
            console.log('Quality not found, using:', source.quality);
        }
        
        if (source && source.download_url) {
            console.log('Redirecting to stream URL');
            res.redirect(source.download_url);
        } else {
            res.status(404).json({ 
                error: 'Stream not available' 
            });
        }
    } catch (error) {
        console.error('Stream error:', error.message);
        res.status(500).json({ 
            error: 'Streaming failed',
            message: error.message 
        });
    }
});

// Simple static HTML page
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CLOUD.MOVIES | Premium Streaming</title>
        <meta name="description" content="Premium movie and series streaming platform">
        <meta name="theme-color" content="#0a0a1a">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Poppins', sans-serif; 
                background: #0a0a1a; 
                color: white; 
                min-height: 100vh;
                overflow-x: hidden;
            }
            
            /* Loading Screen */
            #loading-screen {
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: #050511;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                transition: opacity 0.5s ease;
            }
            
            .logo-text {
                font-size: 3.5rem;
                font-weight: 900;
                background: linear-gradient(45deg, #667eea, #764ba2, #f093fb);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                margin-bottom: 2rem;
                text-align: center;
            }
            
            .loading-ring {
                width: 60px;
                height: 60px;
                border: 4px solid #667eea;
                border-top: 4px solid transparent;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            /* Header */
            header {
                background: rgba(10, 10, 26, 0.9);
                backdrop-filter: blur(10px);
                padding: 1rem 2rem;
                position: sticky;
                top: 0;
                z-index: 100;
                border-bottom: 1px solid rgba(102, 126, 234, 0.3);
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
                font-weight: 700;
                background: linear-gradient(45deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
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
                padding: 12px 50px 12px 20px;
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid transparent;
                border-radius: 25px;
                color: white;
                font-size: 1rem;
                outline: none;
                transition: all 0.3s ease;
            }
            
            #search-input:focus {
                border-color: #667eea;
                box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
            }
            
            .search-btn {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                background: linear-gradient(45deg, #667eea, #764ba2);
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            /* Main Content */
            main {
                max-width: 1400px;
                margin: 0 auto;
                padding: 2rem;
            }
            
            .hero-section {
                text-align: center;
                padding: 3rem 2rem;
                background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
                border-radius: 20px;
                margin-bottom: 3rem;
            }
            
            .hero-title {
                font-size: 3rem;
                margin-bottom: 1rem;
                background: linear-gradient(45deg, #fff, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            
            .content-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 1.5rem;
                margin-bottom: 3rem;
            }
            
            .content-card {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 15px;
                overflow: hidden;
                transition: all 0.3s ease;
                cursor: pointer;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .content-card:hover {
                transform: translateY(-10px);
                box-shadow: 0 15px 30px rgba(102, 126, 234, 0.3);
                border-color: #667eea;
            }
            
            .card-poster {
                width: 100%;
                height: 280px;
                object-fit: cover;
            }
            
            .card-info {
                padding: 1rem;
            }
            
            .card-title {
                font-size: 1rem;
                margin-bottom: 0.5rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .card-meta {
                display: flex;
                justify-content: space-between;
                font-size: 0.9rem;
                color: #b8c1ec;
            }
            
            /* Quick Categories */
            .quick-categories {
                display: flex;
                gap: 1rem;
                margin-bottom: 2rem;
                overflow-x: auto;
                padding: 1rem 0;
            }
            
            .quick-category {
                padding: 10px 20px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 25px;
                color: white;
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.3s ease;
                border: 1px solid transparent;
            }
            
            .quick-category:hover {
                background: linear-gradient(45deg, #667eea, #764ba2);
                transform: translateY(-3px);
            }
            
            /* Footer */
            footer {
                background: #050511;
                padding: 3rem 2rem;
                margin-top: 4rem;
                text-align: center;
                border-top: 1px solid rgba(102, 126, 234, 0.3);
            }
            
            .footer-brand {
                font-size: 2rem;
                font-weight: 700;
                background: linear-gradient(45deg, #667eea, #764ba2);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 1rem;
            }
            
            .contact-link {
                color: #667eea;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                margin-top: 1rem;
                padding: 8px 16px;
                background: rgba(102, 126, 234, 0.1);
                border-radius: 20px;
            }
            
            /* Modal */
            .modal {
                display: none;
                position: fixed;
                top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.9);
                z-index: 1000;
                overflow-y: auto;
            }
            
            .modal-content {
                max-width: 1000px;
                margin: 2rem auto;
                background: rgba(10, 10, 26, 0.95);
                border-radius: 20px;
                overflow: hidden;
                border: 2px solid #667eea;
            }
            
            .modal-header {
                padding: 1.5rem;
                background: linear-gradient(90deg, #667eea, #764ba2);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .close-modal {
                background: none;
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
            }
            
            .modal-body {
                padding: 2rem;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .header-content {
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .hero-title {
                    font-size: 2rem;
                }
                
                .content-grid {
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                }
                
                .logo-text {
                    font-size: 2.5rem;
                }
            }
        </style>
    </head>
    <body>
        <!-- Loading Screen -->
        <div id="loading-screen">
            <div class="logo-text">CLOUD.MOVIES</div>
            <div class="loading-ring"></div>
            <div style="margin-top: 1rem; color: #b8c1ec;">Loading content...</div>
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
                <p style="color: #b8c1ec; margin-bottom: 2rem;">Premium streaming experience with thousands of titles</p>
                
                <!-- Quick Categories -->
                <div class="quick-categories" id="quick-categories">
                    <div class="quick-category" data-search="movie">🎬 Movies</div>
                    <div class="quick-category" data-search="2024">🔥 2024</div>
                    <div class="quick-category" data-search="action">💥 Action</div>
                    <div class="quick-category" data-search="comedy">😂 Comedy</div>
                    <div class="quick-category" data-search="drama">🎭 Drama</div>
                    <div class="quick-category" data-search="sci-fi">🚀 Sci-Fi</div>
                    <div class="quick-category" data-search="horror">👻 Horror</div>
                    <div class="quick-category" data-search="animation">🐉 Animation</div>
                </div>
            </section>

            <!-- Content Grid -->
            <div class="content-grid" id="content-grid">
                <!-- Content will be loaded here -->
            </div>

            <!-- Loading State -->
            <div id="loading-state" style="text-align: center; padding: 2rem; display: none;">
                <div class="loading-ring" style="margin: 0 auto 1rem;"></div>
                <div style="color: #b8c1ec;">Loading more content...</div>
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
                    <!-- Modal content will be loaded here -->
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer>
            <div class="footer-brand">CLOUD.MOVIES</div>
            <p style="color: #b8c1ec; margin-bottom: 1rem;">Premium Streaming Experience</p>
            <p style="color: #b8c1ec; margin-bottom: 1rem;">
                Developed by <strong>Bruce Bera</strong> | Bera Tech Solutions
            </p>
            <a href="https://wa.me/254743983206" class="contact-link" target="_blank">
                <i class="fab fa-whatsapp"></i>
                Contact: wa.me/254743983206
            </a>
            <p style="color: #667eea; margin-top: 2rem; font-size: 0.9rem;">
                Powered by Gifted Movies API
            </p>
        </footer>

        <script>
            // Global variables
            let currentPage = 1;
            let currentSearch = '';
            let selectedMovieId = null;
            let selectedQuality = '720p';

            // Initialize the app
            document.addEventListener('DOMContentLoaded', async () => {
                console.log('App initialized');
                
                // Hide loading screen after 2 seconds
                setTimeout(() => {
                    document.getElementById('loading-screen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('loading-screen').style.display = 'none';
                        // Load initial content
                        loadInitialContent();
                    }, 500);
                }, 2000);
                
                // Initialize search
                initializeSearch();
                
                // Initialize quick categories
                initializeQuickCategories();
            });

            // Load initial content
            async function loadInitialContent() {
                console.log('Loading initial content...');
                showLoadingState();
                
                try {
                    const response = await fetch('/api/trending');
                    const data = await response.json();
                    
                    hideLoadingState();
                    
                    if (data.success && data.results.length > 0) {
                        console.log('Displaying', data.results.length, 'items');
                        displayContent(data.results);
                    } else {
                        // Fallback: search for movies
                        await performSearch('movie');
                    }
                } catch (error) {
                    console.error('Error loading initial content:', error);
                    hideLoadingState();
                    // Try a direct search as fallback
                    await performSearch('movie');
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

            // Initialize quick categories
            function initializeQuickCategories() {
                document.querySelectorAll('.quick-category').forEach(category => {
                    category.addEventListener('click', async () => {
                        const search = category.dataset.search;
                        await performSearch(search);
                    });
                });
            }

            // Perform search
            async function performSearch(query) {
                console.log('Searching for:', query);
                showLoadingState();
                currentSearch = query;
                
                try {
                    const response = await fetch('/api/search/' + encodeURIComponent(query));
                    const data = await response.json();
                    
                    hideLoadingState();
                    
                    if (data.success) {
                        displayContent(data.results);
                        
                        // Scroll to content
                        document.getElementById('content-grid').scrollIntoView({ 
                            behavior: 'smooth' 
                        });
                    } else {
                        showError('Search failed. Please try again.');
                    }
                } catch (error) {
                    console.error('Search error:', error);
                    hideLoadingState();
                    showError('Network error. Please check your connection.');
                }
            }

            // Display content in grid
            function displayContent(items) {
                const grid = document.getElementById('content-grid');
                
                if (!items || items.length === 0) {
                    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #b8c1ec;">No content found. Try another search.</div>';
                    return;
                }
                
                grid.innerHTML = items.map(item => {
                    const posterUrl = item.cover || item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80';
                    const year = item.year || 'N/A';
                    const type = item.type === 'tv' ? 'Series' : 'Movie';
                    
                    return '<div class="content-card" data-id="' + item.id + '">' +
                           '<img src="' + posterUrl + '" alt="' + item.title + '" class="card-poster" ' +
                           'onerror="this.src=\'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80\'">' +
                           '<div class="card-info">' +
                           '<h3 class="card-title" title="' + item.title + '">' + item.title + '</h3>' +
                           '<div class="card-meta">' +
                           '<span>' + year + '</span>' +
                           '<span>' + type + '</span>' +
                           '</div>' +
                           '</div>' +
                           '</div>';
                }).join('');
                
                // Add click event listeners
                grid.querySelectorAll('.content-card').forEach(card => {
                    card.addEventListener('click', async () => {
                        const id = card.dataset.id;
                        await showDetails(id);
                    });
                });
            }

            // Show details modal
            async function showDetails(id) {
                console.log('Showing details for ID:', id);
                selectedMovieId = id;
                
                // Show modal with loading state
                const modal = document.getElementById('detail-modal');
                const modalBody = document.getElementById('modal-body');
                const modalTitle = document.getElementById('modal-title');
                
                modalTitle.textContent = 'Loading...';
                modalBody.innerHTML = '<div style="text-align: center; padding: 3rem;"><div class="loading-ring" style="margin: 0 auto 1rem;"></div><div style="color: #b8c1ec;">Loading details...</div></div>';
                modal.style.display = 'block';
                
                try {
                    const response = await fetch('/api/info/' + id);
                    const data = await response.json();
                    
                    if (data.success) {
                        displayDetails(data.data);
                    } else {
                        modalBody.innerHTML = '<div style="text-align: center; padding: 3rem; color: #b8c1ec;">Failed to load details. Please try again.</div>';
                    }
                } catch (error) {
                    console.error('Error loading details:', error);
                    modalBody.innerHTML = '<div style="text-align: center; padding: 3rem; color: #b8c1ec;">Network error. Please try again.</div>';
                }
            }

            // Display details in modal
            function displayDetails(movie) {
                const modal = document.getElementById('detail-modal');
                const modalBody = document.getElementById('modal-body');
                const modalTitle = document.getElementById('modal-title');
                
                modalTitle.textContent = movie.title;
                
                // Check if it's a TV series
                const isTV = movie.type === 'tv';
                const hasEpisodes = movie.episodes && movie.episodes.length > 0;
                
                // Build episodes HTML if available
                let episodesHtml = '';
                if (hasEpisodes) {
                    episodesHtml = '<div style="margin: 2rem 0; padding: 1.5rem; background: rgba(255,255,255,0.05); border-radius: 10px;">' +
                                   '<h3 style="margin-bottom: 1rem; color: #667eea;"><i class="fas fa-tv"></i> Episodes</h3>' +
                                   '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem;">';
                    
                    // Group by season
                    const seasons = {};
                    movie.episodes.forEach(ep => {
                        if (!seasons[ep.season]) seasons[ep.season] = [];
                        seasons[ep.season].push(ep);
                    });
                    
                    for (const season in seasons) {
                        episodesHtml += '<div style="grid-column: 1/-1; margin-top: 1rem;"><strong>Season ' + season + '</strong></div>';
                        seasons[season].forEach(ep => {
                            episodesHtml += '<button class="episode-btn" data-season="' + season + '" data-episode="' + ep.episode + '" ' +
                                          'style="padding: 8px; background: rgba(102,126,234,0.1); border: 1px solid #667eea; border-radius: 5px; color: white; cursor: pointer;">' +
                                          'E' + ep.episode + '</button>';
                        });
                    }
                    
                    episodesHtml += '</div></div>';
                }
                
                modalBody.innerHTML = '<div style="display: grid; grid-template-columns: 300px 1fr; gap: 2rem; margin-bottom: 2rem;">' +
                                    '<div><img src="' + (movie.poster || movie.cover || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80') + '" ' +
                                    'style="width: 100%; border-radius: 10px; border: 2px solid #667eea;" ' +
                                    'onerror="this.src=\'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80\'"></div>' +
                                    '<div>' +
                                    '<h2 style="font-size: 2rem; margin-bottom: 1rem;">' + movie.title + '</h2>' +
                                    '<div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">' +
                                    (movie.genre && movie.genre.length > 0 ? movie.genre.map(g => 
                                        '<span style="background: rgba(102,126,234,0.1); padding: 5px 10px; border-radius: 15px; border: 1px solid #667eea; color: #667eea;">' + g + '</span>'
                                    ).join('') : '') +
                                    '</div>' +
                                    '<p style="margin-bottom: 1.5rem; color: #b8c1ec; line-height: 1.6;">' + (movie.description || 'No description available.') + '</p>' +
                                    '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">' +
                                    '<div><strong>Release Date:</strong> ' + (movie.releaseDate || 'N/A') + '</div>' +
                                    '<div><strong>Rating:</strong> ' + (movie.rating || 'N/A') + '</div>' +
                                    '<div><strong>Type:</strong> ' + (isTV ? 'TV Series' : 'Movie') + '</div>' +
                                    '<div><strong>Country:</strong> ' + (movie.country || 'N/A') + '</div>' +
                                    '</div>' +
                                    '</div>' +
                                    '</div>' +
                                    episodesHtml +
                                    '<div style="margin: 2rem 0; padding: 1.5rem; background: rgba(255,255,255,0.05); border-radius: 10px;">' +
                                    '<h3 style="margin-bottom: 1rem; color: #667eea;"><i class="fas fa-hd"></i> Select Quality</h3>' +
                                    '<div style="display: flex; gap: 1rem; margin-top: 1rem;">' +
                                    '<button class="quality-btn" data-quality="360p" style="padding: 10px 20px; background: rgba(102,126,234,0.1); border: 1px solid #667eea; border-radius: 5px; color: white; cursor: pointer;">360p</button>' +
                                    '<button class="quality-btn" data-quality="480p" style="padding: 10px 20px; background: rgba(102,126,234,0.1); border: 1px solid #667eea; border-radius: 5px; color: white; cursor: pointer;">480p</button>' +
                                    '<button class="quality-btn active" data-quality="720p" style="padding: 10px 20px; background: #667eea; border: 1px solid #667eea; border-radius: 5px; color: white; cursor: pointer;">720p</button>' +
                                    '</div>' +
                                    '</div>' +
                                    '<div style="display: flex; gap: 1rem; margin-top: 2rem;">' +
                                    '<button id="play-btn" style="padding: 12px 24px; background: linear-gradient(45deg, #667eea, #764ba2); border: none; border-radius: 10px; color: white; cursor: pointer; font-weight: 600; flex: 1;">' +
                                    '<i class="fas fa-play"></i> Stream Now' +
                                    '</button>' +
                                    '<button id="download-btn" style="padding: 12px 24px; background: rgba(255,255,255,0.1); border: 1px solid #667eea; border-radius: 10px; color: white; cursor: pointer; font-weight: 600; flex: 1;">' +
                                    '<i class="fas fa-download"></i> Download' +
                                    '</button>' +
                                    '</div>';
                
                // Setup quality selection
                modalBody.querySelectorAll('.quality-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        modalBody.querySelectorAll('.quality-btn').forEach(b => {
                            b.style.background = 'rgba(102,126,234,0.1)';
                            b.classList.remove('active');
                        });
                        this.style.background = '#667eea';
                        this.classList.add('active');
                        selectedQuality = this.dataset.quality;
                    });
                });
                
                // Setup episode buttons for TV shows
                if (hasEpisodes) {
                    modalBody.querySelectorAll('.episode-btn').forEach(btn => {
                        btn.addEventListener('click', function() {
                            const season = this.dataset.season;
                            const episode = this.dataset.episode;
                            
                            // Update play button
                            const playBtn = document.getElementById('play-btn');
                            const downloadBtn = document.getElementById('download-btn');
                            
                            playBtn.innerHTML = '<i class="fas fa-play"></i> Play S' + season + 'E' + episode;
                            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download S' + season + 'E' + episode;
                            
                            // Store episode info
                            playBtn.dataset.season = season;
                            playBtn.dataset.episode = episode;
                            downloadBtn.dataset.season = season;
                            downloadBtn.dataset.episode = episode;
                            
                            // Highlight selected episode
                            modalBody.querySelectorAll('.episode-btn').forEach(b => {
                                b.style.background = 'rgba(102,126,234,0.1)';
                            });
                            this.style.background = '#667eea';
                        });
                    });
                }
                
                // Setup play button
                modalBody.querySelector('#play-btn').addEventListener('click', async function() {
                    let streamUrl = '/api/stream/' + selectedMovieId + '?quality=' + selectedQuality;
                    
                    if (this.dataset.season && this.dataset.episode) {
                        streamUrl += '&season=' + this.dataset.season + '&episode=' + this.dataset.episode;
                    }
                    
                    // Open stream in new tab
                    window.open(streamUrl, '_blank');
                });
                
                // Setup download button
                modalBody.querySelector('#download-btn').addEventListener('click', async function() {
                    let sourcesUrl = '/api/sources/' + selectedMovieId;
                    
                    if (this.dataset.season && this.dataset.episode) {
                        sourcesUrl += '?season=' + this.dataset.season + '&episode=' + this.dataset.episode;
                    }
                    
                    try {
                        const response = await fetch(sourcesUrl);
                        const data = await response.json();
                        
                        if (data.success && data.sources.length > 0) {
                            const source = data.sources.find(s => s.quality === selectedQuality) || data.sources[0];
                            
                            if (source && source.download_url) {
                                // Open download in new tab
                                window.open(source.download_url, '_blank');
                            }
                        }
                    } catch (error) {
                        console.error('Download error:', error);
                        alert('Download failed. Please try again.');
                    }
                });
                
                // Setup modal close
                document.getElementById('close-modal').addEventListener('click', () => {
                    modal.style.display = 'none';
                });
                
                // Close modal when clicking outside
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.style.display = 'none';
                    }
                });
            }

            // Show loading state
            function showLoadingState() {
                document.getElementById('loading-state').style.display = 'block';
            }

            // Hide loading state
            function hideLoadingState() {
                document.getElementById('loading-state').style.display = 'none';
            }

            // Show error message
            function showError(message) {
                const grid = document.getElementById('content-grid');
                grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">' +
                               '<div style="font-size: 3rem; color: #667eea; margin-bottom: 1rem;"><i class="fas fa-exclamation-triangle"></i></div>' +
                               '<h3 style="margin-bottom: 1rem; color: white;">Something went wrong</h3>' +
                               '<p style="color: #b8c1ec;">' + message + '</p>' +
                               '<button onclick="loadInitialContent()" style="margin-top: 1.5rem; padding: 10px 20px; background: #667eea; border: none; border-radius: 5px; color: white; cursor: pointer;">Try Again</button>' +
                               '</div>';
            }
        </script>
    </body>
    </html>
    `);
});

// Service Worker
app.get('/sw.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`self.addEventListener('install', event => {
        event.waitUntil(
            caches.open('cloud-movies-v1').then(cache => {
                return cache.addAll(['/']);
            })
        );
    });
    
    self.addEventListener('fetch', event => {
        event.respondWith(
            caches.match(event.request).then(response => {
                return response || fetch(event.request);
            })
        );
    });`);
});

// Start server
app.listen(PORT, async () => {
    console.log(`🚀 CLOUD.MOVIES server running on port ${PORT}`);
    console.log(`📱 Developed by Bruce Bera - Bera Tech Solutions`);
    console.log(`📞 Contact: wa.me/254743983206`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
    
    // Test API connection
    const apiConnected = await testAPI();
    if (apiConnected) {
        console.log('✅ API Connection: SUCCESS');
    } else {
        console.log('⚠️ API Connection: FAILED - Using fallback mode');
    }
});
