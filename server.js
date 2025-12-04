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

// Cache for trending content
let trendingCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Serve static files
app.use(express.static('public'));

// API Proxy endpoints
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = '1' } = req.query;
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}`);
        const data = await response.json();
        
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
                releaseDate: item.releaseDate,
                country: item.countryName
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

// Get trending content with caching
app.get('/api/trending', async (req, res) => {
    try {
        // Check cache
        const now = Date.now();
        if (trendingCache.data && (now - trendingCache.timestamp) < CACHE_DURATION) {
            return res.json(trendingCache.data);
        }
        
        // Popular searches to get trending content
        const searches = ['movie', 'avengers', 'spider man', 'stranger things', 'fast and furious'];
        const randomSearch = searches[Math.floor(Math.random() * searches.length)];
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(randomSearch)}`);
        const data = await response.json();
        
        if (data.results && data.results.items) {
            const items = data.results.items.slice(0, 20).map(item => ({
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
            
            const result = {
                success: true,
                results: items,
                timestamp: now
            };
            
            // Update cache
            trendingCache = { data: result, timestamp: now };
            
            res.json(result);
        } else {
            res.json({ success: true, results: [] });
        }
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch trending content' });
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
                    seasons: seasonsData,
                    hasResource: subject.hasResource,
                    subtitles: subject.subtitles
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

// Batch sources endpoint for multiple episodes
app.get('/api/batch-sources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { episodes } = req.query; // Format: "s1e1,s1e2,s2e1"
        
        if (!episodes) {
            return res.status(400).json({ success: false, error: 'No episodes specified' });
        }
        
        const episodeList = episodes.split(',');
        const sourcesPromises = episodeList.map(async ep => {
            const [season, episode] = ep.replace('s', '').replace('e', '').split('e');
            const apiUrl = `${API_BASE}/sources/${id}?season=${season}&episode=${episode}`;
            
            try {
                const response = await fetch(apiUrl);
                const data = await response.json();
                
                if (data.results && Array.isArray(data.results)) {
                    return {
                        season,
                        episode,
                        sources: data.results.map(source => ({
                            quality: source.quality,
                            download_url: source.download_url,
                            size: source.size
                        }))
                    };
                }
            } catch (error) {
                console.error(`Error fetching sources for ${ep}:`, error);
            }
            return null;
        });
        
        const results = await Promise.all(sourcesPromises);
        res.json({
            success: true,
            results: results.filter(r => r !== null)
        });
    } catch (error) {
        console.error('Batch sources error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch batch sources' });
    }
});

// Stream endpoint
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
        <title>CLOUD.MOVIES | Premium Streaming</title>
        <meta name="description" content="Premium movie and series streaming platform">
        <meta name="author" content="Bruce Bera - Bera Tech">
        
        <!-- PWA Manifest -->
        <link rel="manifest" href="/manifest.json">
        <meta name="theme-color" content="#0a0a1a">
        
        <!-- Icons -->
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>">
        
        <!-- Font Awesome -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        
        <!-- Google Fonts -->
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@300;400;600;700&display=swap" rel="stylesheet">
        
        <!-- Styles -->
        <style>
            :root {
                --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                --secondary-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                --accent-gradient: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                --dark-bg: #0a0a1a;
                --darker-bg: #050511;
                --card-bg: rgba(255, 255, 255, 0.05);
                --glass-bg: rgba(255, 255, 255, 0.08);
                --text-primary: #ffffff;
                --text-secondary: #b8c1ec;
                --accent-blue: #667eea;
                --accent-purple: #764ba2;
                --accent-pink: #f093fb;
                --success: #00ff9d;
                --warning: #ffcc00;
                --danger: #ff416c;
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Poppins', sans-serif;
                background: var(--dark-bg);
                color: var(--text-primary);
                min-height: 100vh;
                overflow-x: hidden;
                background-image: 
                    radial-gradient(circle at 20% 80%, rgba(102, 126, 234, 0.15) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(118, 75, 162, 0.15) 0%, transparent 50%),
                    radial-gradient(circle at 40% 40%, rgba(240, 147, 251, 0.1) 0%, transparent 50%);
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
                font-family: 'Orbitron', sans-serif;
                font-size: 4.5rem;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 4px;
                background: linear-gradient(45deg, var(--accent-blue), var(--accent-pink), var(--accent-purple));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                background-size: 300% 300%;
                animation: gradientShift 3s ease infinite;
                position: relative;
            }
            
            .logo-text::after {
                content: 'PREMIUM STREAMING';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                font-size: 1rem;
                font-weight: 400;
                letter-spacing: 2px;
                color: var(--text-secondary);
                margin-top: 10px;
                opacity: 0.8;
            }
            
            .loading-ring {
                width: 80px;
                height: 80px;
                border-radius: 50%;
                border: 4px solid transparent;
                border-top: 4px solid var(--accent-blue);
                border-right: 4px solid var(--accent-pink);
                animation: spin 1s linear infinite;
                position: relative;
            }
            
            .loading-ring::after {
                content: '';
                position: absolute;
                top: -4px;
                left: -4px;
                right: -4px;
                bottom: -4px;
                border-radius: 50%;
                border: 4px solid transparent;
                border-top: 4px solid var(--accent-purple);
                animation: spin 1.5s linear infinite reverse;
            }
            
            .loading-text {
                margin-top: 2rem;
                font-size: 1.1rem;
                color: var(--text-secondary);
                font-family: 'Montserrat', sans-serif;
                letter-spacing: 1px;
            }
            
            @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            @keyframes float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            
            /* Header */
            header {
                background: var(--glass-bg);
                backdrop-filter: blur(20px);
                padding: 1rem 2rem;
                position: sticky;
                top: 0;
                z-index: 100;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 4px 30px rgba(0, 0, 0, 0.3);
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
                font-family: 'Orbitron', sans-serif;
                font-size: 1.8rem;
                font-weight: 700;
                background: linear-gradient(45deg, var(--accent-blue), var(--accent-pink));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 12px;
                letter-spacing: 1px;
                transition: all 0.3s ease;
            }
            
            .site-logo:hover {
                transform: scale(1.05);
                filter: drop-shadow(0 0 10px rgba(102, 126, 234, 0.5));
            }
            
            .logo-icon {
                font-size: 2rem;
                animation: float 3s ease-in-out infinite;
            }
            
            .search-container {
                flex: 1;
                max-width: 600px;
                position: relative;
            }
            
            #search-input {
                width: 100%;
                padding: 14px 50px 14px 25px;
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid transparent;
                border-radius: 50px;
                color: white;
                font-size: 1rem;
                font-family: 'Poppins', sans-serif;
                outline: none;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            }
            
            #search-input:focus {
                background: rgba(255, 255, 255, 0.15);
                border-color: var(--accent-blue);
                box-shadow: 0 0 30px rgba(102, 126, 234, 0.3);
                transform: translateY(-2px);
            }
            
            .search-btn {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                background: var(--primary-gradient);
                border: none;
                border-radius: 50%;
                width: 45px;
                height: 45px;
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
            }
            
            .search-btn:hover {
                transform: translateY(-50%) scale(1.1) rotate(10deg);
                box-shadow: 0 5px 20px rgba(102, 126, 234, 0.5);
            }
            
            /* Main Content */
            main {
                max-width: 1400px;
                margin: 0 auto;
                padding: 2rem;
            }
            
            .hero-section {
                text-align: center;
                padding: 5rem 2rem;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 25px;
                margin-bottom: 3rem;
                border: 1px solid rgba(255, 255, 255, 0.1);
                position: relative;
                overflow: hidden;
                backdrop-filter: blur(10px);
            }
            
            .hero-section::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%);
                animation: pulse 15s infinite linear;
                z-index: -1;
            }
            
            .hero-title {
                font-family: 'Montserrat', sans-serif;
                font-size: 4rem;
                margin-bottom: 1rem;
                background: linear-gradient(45deg, #fff, var(--accent-blue), var(--accent-pink));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-size: 300% 300%;
                animation: gradientShift 3s ease infinite;
                font-weight: 800;
                letter-spacing: 2px;
            }
            
            .hero-subtitle {
                font-size: 1.3rem;
                color: var(--text-secondary);
                margin-bottom: 2rem;
                font-weight: 300;
                letter-spacing: 1px;
            }
            
            /* Featured Tags */
            .featured-tags {
                display: flex;
                justify-content: center;
                gap: 1rem;
                flex-wrap: wrap;
                margin-top: 2rem;
            }
            
            .featured-tag {
                padding: 8px 20px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 25px;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 1px solid transparent;
                backdrop-filter: blur(10px);
            }
            
            .featured-tag:hover {
                background: var(--primary-gradient);
                transform: translateY(-3px);
                box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
            }
            
            /* Genre Navigation */
            .genre-nav {
                display: flex;
                gap: 1rem;
                margin-bottom: 3rem;
                overflow-x: auto;
                padding: 1.5rem;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                scrollbar-width: thin;
                scrollbar-color: var(--accent-blue) transparent;
            }
            
            .genre-nav::-webkit-scrollbar {
                height: 6px;
            }
            
            .genre-nav::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 3px;
            }
            
            .genre-nav::-webkit-scrollbar-thumb {
                background: var(--primary-gradient);
                border-radius: 3px;
            }
            
            .genre-btn {
                padding: 12px 28px;
                background: rgba(255, 255, 255, 0.08);
                border: 2px solid transparent;
                border-radius: 50px;
                color: var(--text-primary);
                cursor: pointer;
                white-space: nowrap;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                font-family: 'Poppins', sans-serif;
                font-weight: 500;
                letter-spacing: 0.5px;
                backdrop-filter: blur(10px);
                position: relative;
                overflow: hidden;
            }
            
            .genre-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                transition: left 0.5s ease;
            }
            
            .genre-btn:hover::before {
                left: 100%;
            }
            
            .genre-btn:hover, .genre-btn.active {
                background: var(--primary-gradient);
                border-color: var(--accent-blue);
                transform: translateY(-5px) scale(1.05);
                box-shadow: 0 15px 30px rgba(102, 126, 234, 0.4);
            }
            
            /* Content Grid */
            .content-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                gap: 2rem;
                margin-bottom: 3rem;
            }
            
            .content-card {
                background: var(--card-bg);
                border-radius: 20px;
                overflow: hidden;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: 1px solid rgba(255, 255, 255, 0.1);
                cursor: pointer;
                position: relative;
                backdrop-filter: blur(10px);
            }
            
            .content-card:hover {
                transform: translateY(-15px) scale(1.03);
                border-color: var(--accent-blue);
                box-shadow: 0 25px 50px rgba(102, 126, 234, 0.3);
            }
            
            .content-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: var(--primary-gradient);
                transform: scaleX(0);
                transform-origin: left;
                transition: transform 0.4s ease;
            }
            
            .content-card:hover::before {
                transform: scaleX(1);
            }
            
            .card-poster {
                width: 100%;
                height: 320px;
                object-fit: cover;
                display: block;
                transition: transform 0.5s ease;
            }
            
            .content-card:hover .card-poster {
                transform: scale(1.1);
            }
            
            .card-info {
                padding: 1.5rem;
                position: relative;
            }
            
            .card-title {
                font-size: 1.2rem;
                margin-bottom: 0.8rem;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            
            .card-meta {
                display: flex;
                justify-content: space-between;
                font-size: 0.9rem;
                color: var(--text-secondary);
                margin-bottom: 0.5rem;
            }
            
            .card-genres {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin-top: 0.8rem;
            }
            
            .genre-tag {
                padding: 3px 10px;
                background: rgba(102, 126, 234, 0.15);
                border-radius: 15px;
                font-size: 0.75rem;
                color: var(--accent-blue);
                border: 1px solid rgba(102, 126, 234, 0.3);
            }
            
            .rating-badge {
                position: absolute;
                top: -15px;
                right: 15px;
                background: var(--primary-gradient);
                color: white;
                padding: 5px 12px;
                border-radius: 15px;
                font-weight: 600;
                font-size: 0.9rem;
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
                display: flex;
                align-items: center;
                gap: 5px;
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
                backdrop-filter: blur(10px);
            }
            
            .modal-content {
                max-width: 1200px;
                margin: 2rem auto;
                background: rgba(10, 10, 26, 0.95);
                border-radius: 25px;
                overflow: hidden;
                border: 1px solid rgba(255, 255, 255, 0.15);
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(20px);
                animation: modalSlideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }
            
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-50px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            
            .modal-header {
                padding: 2rem;
                background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple));
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
                overflow: hidden;
            }
            
            .modal-header::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0,0 L100,0 L100,100" fill="rgba(255,255,255,0.1)"/></svg>');
                opacity: 0.3;
            }
            
            .close-modal {
                background: rgba(0, 0, 0, 0.3);
                border: 2px solid white;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                color: white;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.5rem;
                backdrop-filter: blur(10px);
            }
            
            .close-modal:hover {
                background: white;
                color: var(--dark-bg);
                transform: rotate(90deg);
            }
            
            .modal-body {
                padding: 2.5rem;
            }
            
            /* Player */
            .video-container {
                width: 100%;
                margin: 0 auto 3rem;
                background: #000;
                border-radius: 15px;
                overflow: hidden;
                position: relative;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            
            #video-player {
                width: 100%;
                height: 500px;
                background: #000;
            }
            
            /* Episode Selection */
            .episode-section {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 20px;
                padding: 2rem;
                margin: 2rem 0;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .season-selector {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            
            .season-card {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 15px;
                padding: 1.5rem;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 2px solid transparent;
            }
            
            .season-card:hover, .season-card.active {
                background: var(--primary-gradient);
                transform: translateY(-5px);
                border-color: var(--accent-blue);
                box-shadow: 0 15px 30px rgba(102, 126, 234, 0.3);
            }
            
            .episode-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 1rem;
                margin-top: 1.5rem;
            }
            
            .episode-checkbox {
                display: none;
            }
            
            .episode-label {
                background: rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                padding: 1rem;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 2px solid transparent;
                display: block;
            }
            
            .episode-checkbox:checked + .episode-label {
                background: var(--primary-gradient);
                border-color: var(--accent-blue);
                transform: scale(1.05);
                box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
            }
            
            .episode-label:hover {
                background: rgba(102, 126, 234, 0.2);
                transform: translateY(-3px);
            }
            
            .batch-actions {
                display: flex;
                gap: 1rem;
                margin-top: 2rem;
                flex-wrap: wrap;
            }
            
            .batch-btn {
                padding: 12px 24px;
                border: none;
                border-radius: 10px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 10px;
                font-family: 'Poppins', sans-serif;
            }
            
            .batch-play {
                background: var(--primary-gradient);
                color: white;
            }
            
            .batch-download {
                background: var(--secondary-gradient);
                color: white;
            }
            
            .batch-btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
            }
            
            /* Quality Selector */
            .quality-selector {
                background: rgba(255, 255, 255, 0.03);
                border-radius: 15px;
                padding: 1.5rem;
                margin: 2rem 0;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .quality-grid {
                display: flex;
                gap: 1rem;
                flex-wrap: wrap;
                margin-top: 1rem;
            }
            
            .quality-card {
                flex: 1;
                min-width: 120px;
                background: rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                padding: 1rem;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 2px solid transparent;
            }
            
            .quality-card:hover, .quality-card.active {
                background: var(--primary-gradient);
                transform: translateY(-5px);
                border-color: var(--accent-blue);
            }
            
            /* Action Buttons */
            .action-buttons {
                display: flex;
                gap: 1.5rem;
                margin-top: 3rem;
                flex-wrap: wrap;
            }
            
            .action-btn {
                padding: 16px 32px;
                border: none;
                border-radius: 15px;
                font-size: 1.1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                display: flex;
                align-items: center;
                gap: 12px;
                font-family: 'Poppins', sans-serif;
                min-width: 200px;
                justify-content: center;
                position: relative;
                overflow: hidden;
            }
            
            .action-btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                transition: left 0.5s ease;
            }
            
            .action-btn:hover::before {
                left: 100%;
            }
            
            .stream-btn {
                background: var(--primary-gradient);
                color: white;
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
            }
            
            .download-btn {
                background: var(--secondary-gradient);
                color: white;
                box-shadow: 0 10px 30px rgba(240, 147, 251, 0.4);
            }
            
            .trailer-btn {
                background: var(--accent-gradient);
                color: white;
                box-shadow: 0 10px 30px rgba(79, 172, 254, 0.4);
            }
            
            .action-btn:hover {
                transform: translateY(-8px) scale(1.05);
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            }
            
            /* Cast Section */
            .cast-section {
                margin: 3rem 0;
            }
            
            .cast-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 1.5rem;
                margin-top: 1.5rem;
            }
            
            .cast-card {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 15px;
                padding: 1.5rem;
                text-align: center;
                transition: all 0.3s ease;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .cast-card:hover {
                transform: translateY(-10px);
                background: rgba(102, 126, 234, 0.15);
                border-color: var(--accent-blue);
                box-shadow: 0 15px 30px rgba(102, 126, 234, 0.2);
            }
            
            .cast-avatar {
                width: 100px;
                height: 100px;
                border-radius: 50%;
                object-fit: cover;
                margin: 0 auto 1rem;
                border: 3px solid var(--accent-blue);
                box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
            }
            
            /* Footer */
            footer {
                background: rgba(5, 5, 17, 0.95);
                padding: 4rem 2rem;
                margin-top: 5rem;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                position: relative;
                overflow: hidden;
            }
            
            footer::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: var(--primary-gradient);
            }
            
            .footer-content {
                max-width: 1400px;
                margin: 0 auto;
                text-align: center;
            }
            
            .footer-brand {
                font-family: 'Orbitron', sans-serif;
                font-size: 2.5rem;
                font-weight: 700;
                background: linear-gradient(45deg, var(--accent-blue), var(--accent-pink));
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 1rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 15px;
            }
            
            .footer-tagline {
                font-size: 1.2rem;
                color: var(--text-secondary);
                margin-bottom: 2rem;
                font-weight: 300;
                letter-spacing: 1px;
            }
            
            .footer-contact {
                margin-top: 2rem;
                color: var(--text-secondary);
            }
            
            .contact-link {
                color: var(--accent-blue);
                text-decoration: none;
                transition: all 0.3s ease;
                font-weight: 500;
                display: inline-flex;
                align-items: center;
                gap: 10px;
                padding: 10px 20px;
                background: rgba(102, 126, 234, 0.1);
                border-radius: 25px;
                border: 1px solid rgba(102, 126, 234, 0.3);
            }
            
            .contact-link:hover {
                color: white;
                background: var(--primary-gradient);
                transform: translateY(-3px);
                box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
            }
            
            /* Install Prompt */
            #install-prompt {
                position: fixed;
                bottom: 30px;
                right: 30px;
                background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
                color: white;
                padding: 20px;
                border-radius: 20px;
                display: none;
                align-items: center;
                gap: 20px;
                z-index: 999;
                box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                animation: slideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                max-width: 400px;
            }
            
            .install-btn {
                background: white;
                color: var(--dark-bg);
                border: none;
                padding: 10px 20px;
                border-radius: 10px;
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s ease;
            }
            
            .install-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            }
            
            .close-install {
                background: rgba(0, 0, 0, 0.3);
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .close-install:hover {
                background: rgba(0, 0, 0, 0.5);
                transform: rotate(90deg);
            }
            
            /* Loading States */
            .skeleton {
                background: linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%);
                background-size: 200% 100%;
                animation: skeleton-loading 1.5s infinite;
                border-radius: 10px;
            }
            
            .skeleton-card {
                height: 400px;
                border-radius: 20px;
            }
            
            @keyframes skeleton-loading {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            
            /* Responsive */
            @media (max-width: 1024px) {
                .content-grid {
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                }
                
                .hero-title {
                    font-size: 3rem;
                }
            }
            
            @media (max-width: 768px) {
                .header-content {
                    flex-direction: column;
                    gap: 1.5rem;
                }
                
                .search-container {
                    width: 100%;
                }
                
                .hero-title {
                    font-size: 2.5rem;
                }
                
                .logo-text {
                    font-size: 3.5rem;
                }
                
                .content-grid {
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 1.5rem;
                }
                
                .modal-content {
                    margin: 0;
                    border-radius: 0;
                }
                
                .video-container {
                    height: 300px;
                }
                
                .action-buttons {
                    justify-content: center;
                }
                
                .action-btn {
                    min-width: 100%;
                }
            }
            
            @media (max-width: 480px) {
                .hero-title {
                    font-size: 2rem;
                }
                
                .logo-text {
                    font-size: 2.5rem;
                }
                
                .content-grid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1rem;
                }
                
                .genre-nav {
                    padding: 1rem;
                }
                
                .genre-btn {
                    padding: 10px 20px;
                    font-size: 0.9rem;
                }
                
                .modal-body {
                    padding: 1.5rem;
                }
                
                .episode-grid {
                    grid-template-columns: repeat(3, 1fr);
                }
            }
            
            /* Scrollbar */
            ::-webkit-scrollbar {
                width: 12px;
            }
            
            ::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 6px;
            }
            
            ::-webkit-scrollbar-thumb {
                background: var(--primary-gradient);
                border-radius: 6px;
                border: 2px solid var(--dark-bg);
            }
            
            ::-webkit-scrollbar-thumb:hover {
                background: var(--secondary-gradient);
            }
        </style>
    </head>
    <body>
        <!-- Loading Screen -->
        <div id="loading-screen">
            <div class="logo-container">
                <div class="logo-text">CLOUD.MOVIES</div>
            </div>
            <div class="loading-ring"></div>
            <div class="loading-text">Loading premium experience...</div>
        </div>

        <!-- Header -->
        <header>
            <div class="header-content">
                <a href="/" class="site-logo">
                    <i class="fas fa-cloud-moon logo-icon"></i>
                    <span>CLOUD.MOVIES</span>
                </a>
                <div class="search-container">
                    <input type="text" id="search-input" placeholder="Discover movies, series, and more...">
                    <button class="search-btn" id="search-btn">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main>
            <section class="hero-section">
                <h1 class="hero-title">Unlimited Entertainment</h1>
                <p class="hero-subtitle">Stream the latest movies and TV series in stunning quality</p>
                <div style="margin-top: 3rem;">
                    <input type="text" id="home-search" placeholder="Try 'Avengers', 'Stranger Things', 'The Matrix'..." 
                           style="width: 100%; max-width: 600px; padding: 18px 30px; border-radius: 50px; border: 2px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white; font-size: 1.1rem; backdrop-filter: blur(10px);">
                </div>
                <div class="featured-tags">
                    <div class="featured-tag" data-search="action">🔥 Action</div>
                    <div class="featured-tag" data-search="comedy">😄 Comedy</div>
                    <div class="featured-tag" data-search="sci-fi">🚀 Sci-Fi</div>
                    <div class="featured-tag" data-search="drama">🎭 Drama</div>
                    <div class="featured-tag" data-search="2024">🎬 2024 Releases</div>
                </div>
            </section>

            <!-- Genre Navigation -->
            <nav class="genre-nav" id="genre-nav">
                <!-- Genres will be populated by JavaScript -->
            </nav>

            <!-- Content Grid -->
            <div class="content-grid" id="content-grid">
                <!-- Skeleton loading -->
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
                <div class="skeleton skeleton-card"></div>
            </div>

            <!-- Pagination -->
            <div class="pagination" id="pagination"></div>
        </main>

        <!-- Detail Modal -->
        <div class="modal" id="detail-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="modal-title" style="font-size: 2rem; font-weight: 700; letter-spacing: 1px;"></h2>
                    <button class="close-modal" id="close-modal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" id="modal-body">
                    <!-- Modal content will be populated by JavaScript -->
                </div>
            </div>
        </div>

        <!-- Install Prompt -->
        <div id="install-prompt">
            <div style="flex: 1;">
                <strong>Install CLOUD.MOVIES</strong>
                <div style="font-size: 0.9rem; opacity: 0.9;">For faster access and offline viewing</div>
            </div>
            <button class="install-btn" id="install-btn">Add to Home Screen</button>
            <button class="close-install" id="close-install">&times;</button>
        </div>

        <!-- Footer -->
        <footer>
            <div class="footer-content">
                <div class="footer-brand">
                    <i class="fas fa-cloud-moon"></i>
                    CLOUD.MOVIES
                </div>
                <p class="footer-tagline">Premium Streaming Experience</p>
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                    Stream thousands of movies and TV series in stunning quality
                </p>
                <div class="footer-contact">
                    <p style="margin-bottom: 1rem;">
                        <strong>Developed by Bruce Bera</strong> | Bera Tech Solutions
                    </p>
                    <a href="https://wa.me/254743983206" class="contact-link" target="_blank">
                        <i class="fab fa-whatsapp"></i>
                        <span>Contact: wa.me/254743983206</span>
                    </a>
                </div>
                <p style="margin-top: 2rem; font-size: 0.9rem; color: var(--text-secondary); opacity: 0.7;">
                    Powered by Gifted Movies API • © 2024 CLOUD.MOVIES
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
            let selectedEpisodes = new Set();
            let selectedQuality = '720p';
            let movieDetails = null;

            // Working genres based on API data
            const genres = [
                { id: 'all', name: 'All', icon: 'fas fa-film' },
                { id: 'action', name: 'Action', icon: 'fas fa-explosion' },
                { id: 'comedy', name: 'Comedy', icon: 'fas fa-laugh' },
                { id: 'drama', name: 'Drama', icon: 'fas fa-masks-theater' },
                { id: 'sci-fi', name: 'Sci-Fi', icon: 'fas fa-robot' },
                { id: 'thriller', name: 'Thriller', icon: 'fas fa-heart-pulse' },
                { id: 'horror', name: 'Horror', icon: 'fas fa-ghost' },
                { id: 'romance', name: 'Romance', icon: 'fas fa-heart' },
                { id: 'adventure', name: 'Adventure', icon: 'fas fa-mountain' },
                { id: 'animation', name: 'Animation', icon: 'fas fa-dragon' },
                { id: 'fantasy', name: 'Fantasy', icon: 'fas fa-wand-sparkles' },
                { id: 'crime', name: 'Crime', icon: 'fas fa-user-secret' },
                { id: 'mystery', name: 'Mystery', icon: 'fas fa-magnifying-glass' },
                { id: 'family', name: 'Family', icon: 'fas fa-house' }
            ];

            // Initialize
            document.addEventListener('DOMContentLoaded', async () => {
                // Hide loading screen after animations
                setTimeout(() => {
                    document.getElementById('loading-screen').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('loading-screen').style.display = 'none';
                    }, 500);
                }, 1500);

                // Initialize genres
                initializeGenres();
                
                // Initialize search functionality
                initializeSearch();
                
                // Load trending content
                await loadTrendingContent();
                
                // Initialize PWA
                initializePWA();
                
                // Setup home search
                setupHomeSearch();
                
                // Setup featured tags
                setupFeaturedTags();
            });

            // Initialize genres navigation
            function initializeGenres() {
                const genreNav = document.getElementById('genre-nav');
                genres.forEach(genre => {
                    const button = document.createElement('button');
                    button.className = 'genre-btn';
                    if (genre.id === 'all') button.classList.add('active');
                    button.innerHTML = `<i class="${genre.icon}"></i> ${genre.name}`;
                    button.addEventListener('click', () => filterByGenre(genre.id));
                    genreNav.appendChild(button);
                });
            }

            // Filter content by genre
            function filterByGenre(genreId) {
                currentGenre = genreId;
                
                // Update active genre button
                document.querySelectorAll('.genre-btn').forEach(btn => {
                    btn.classList.remove('active');
                    if (btn.querySelector('i').className.includes(genreId) || genreId === 'all') {
                        btn.classList.add('active');
                    }
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

            // Setup home search
            function setupHomeSearch() {
                const homeSearch = document.getElementById('home-search');
                homeSearch.addEventListener('keypress', async (e) => {
                    if (e.key === 'Enter') {
                        const query = e.target.value.trim();
                        if (query) {
                            document.getElementById('search-input').value = query;
                            await performSearch(query);
                        }
                    }
                });
            }

            // Setup featured tags
            function setupFeaturedTags() {
                document.querySelectorAll('.featured-tag').forEach(tag => {
                    tag.addEventListener('click', async () => {
                        const search = tag.dataset.search;
                        document.getElementById('home-search').value = search;
                        document.getElementById('search-input').value = search;
                        await performSearch(search);
                    });
                });
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
                showSkeletonLoading();
                try {
                    const response = await fetch('/api/trending');
                    const data = await response.json();
                    
                    if (data.success && data.results.length > 0) {
                        currentContent = data.results;
                        displayContent(data.results);
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
                showSkeletonLoading();
                currentSearch = query;
                currentPage = 1;
                
                try {
                    const response = await fetch(`/api/search/${encodeURIComponent(query)}`);
                    const data = await response.json();
                    
                    if (data.success) {
                        currentContent = data.results;
                        displayContent(data.results);
                        updatePagination(data.pagination);
                        
                        // Scroll to content
                        document.querySelector('.content-grid').scrollIntoView({ 
                            behavior: 'smooth' 
                        });
                        
                        // Update home search field
                        document.getElementById('home-search').value = query;
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
                    grid.innerHTML = `
                        <div style="grid-column: 1/-1; text-align: center; padding: 4rem;">
                            <div style="font-size: 5rem; color: var(--text-secondary); opacity: 0.3; margin-bottom: 1rem;">
                                <i class="fas fa-film"></i>
                            </div>
                            <h3 style="color: var(--text-secondary); margin-bottom: 1rem;">No Content Found</h3>
                            <p style="color: var(--text-secondary); opacity: 0.7;">Try searching for something else</p>
                        </div>
                    `;
                    return;
                }
                
                grid.innerHTML = items.map(item => `
                    <div class="content-card" data-id="${item.id}">
                        ${item.rating ? `
                            <div class="rating-badge">
                                <i class="fas fa-star"></i>
                                <span>${item.rating}</span>
                            </div>
                        ` : ''}
                        <img src="${item.cover || item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80'}" 
                             alt="${item.title}" 
                             class="card-poster"
                             onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80'">
                        <div class="card-info">
                            <h3 class="card-title" title="${item.title}">${item.title}</h3>
                            <div class="card-meta">
                                <span>${item.year || 'N/A'}</span>
                                <span><i class="fas fa-${item.type === 'tv' ? 'tv' : 'film'}"></i> ${item.type === 'tv' ? 'Series' : 'Movie'}</span>
                            </div>
                            ${item.genre && item.genre.length > 0 ? `
                                <div class="card-genres">
                                    ${item.genre.slice(0, 2).map(g => `
                                        <span class="genre-tag">${g}</span>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('');
                
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
                showModalLoading();
                selectedMovieId = id;
                selectedEpisodes.clear();
                
                try {
                    const response = await fetch(`/api/info/${id}`);
                    const data = await response.json();
                    
                    if (data.success) {
                        movieDetails = data.data;
                        displayDetails(data.data);
                    } else {
                        showModalError('Failed to load details.');
                    }
                } catch (error) {
                    console.error('Details error:', error);
                    showModalError('Failed to load details.');
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
                    const seasons = [...new Set(movie.episodes.map(ep => ep.season))];
                    
                    episodesHtml = `
                        <div class="episode-section">
                            <h3><i class="fas fa-tv"></i> Seasons & Episodes</h3>
                            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Select multiple episodes for batch streaming or download</p>
                            
                            <div class="season-selector" id="season-selector">
                                ${seasons.map(season => {
                                    const seasonEpisodes = movie.episodes.filter(ep => ep.season === season);
                                    const episodeCount = seasonEpisodes.length;
                                    return `
                                        <div class="season-card" data-season="${season}">
                                            <div style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--accent-blue);">
                                                <i class="fas fa-play-circle"></i>
                                            </div>
                                            <div style="font-weight: 600;">Season ${season}</div>
                                            <div style="font-size: 0.9rem; color: var(--text-secondary);">
                                                ${episodeCount} episode${episodeCount !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            
                            <div id="episode-container" style="display: none;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                    <h4>Episodes</h4>
                                    <button id="select-all-btn" class="batch-btn batch-play" style="padding: 8px 16px; font-size: 0.9rem;">
                                        <i class="fas fa-check-double"></i> Select All
                                    </button>
                                </div>
                                <div class="episode-grid" id="episode-grid"></div>
                                
                                <div class="batch-actions">
                                    <button id="batch-play-btn" class="batch-btn batch-play" disabled>
                                        <i class="fas fa-play-circle"></i> Play Selected (0)
                                    </button>
                                    <button id="batch-download-btn" class="batch-btn batch-download" disabled>
                                        <i class="fas fa-download"></i> Download Selected (0)
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // Build cast HTML if available
                let castHtml = '';
                if (movie.cast && movie.cast.length > 0) {
                    castHtml = `
                        <div class="cast-section">
                            <h3><i class="fas fa-users"></i> Cast & Crew</h3>
                            <div class="cast-grid">
                                ${movie.cast.slice(0, 8).map(person => `
                                    <div class="cast-card">
                                        <img src="${person.avatar || 'https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=200&q=80'}" 
                                             alt="${person.name}" 
                                             class="cast-avatar"
                                             onerror="this.src='https://images.unsplash.com/photo-1494790108755-2616b612b786?auto=format&fit=crop&w=200&q=80'">
                                        <div style="margin-top: 0.5rem;">
                                            <strong>${person.name}</strong>
                                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                                ${person.character || 'Actor'}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                }
                
                modalBody.innerHTML = `
                    <div class="detail-content">
                        <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 3rem; margin-bottom: 3rem;">
                            <div>
                                <img src="${movie.poster || movie.cover || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80'}" 
                                     alt="${movie.title}" 
                                     style="width: 100%; border-radius: 20px; border: 2px solid var(--accent-blue); box-shadow: 0 20px 40px rgba(102, 126, 234, 0.3);"
                                     onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=500&q=80'">
                            </div>
                            <div>
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                                    ${movie.rating ? `
                                        <div style="background: var(--primary-gradient); color: white; padding: 8px 16px; border-radius: 25px; font-weight: 600; display: flex; align-items: center; gap: 5px;">
                                            <i class="fas fa-star"></i>
                                            <span>${movie.rating}/10</span>
                                        </div>
                                    ` : ''}
                                    <div style="background: rgba(255,255,255,0.1); color: white; padding: 8px 16px; border-radius: 25px; font-weight: 500;">
                                        <i class="fas fa-${isTV ? 'tv' : 'film'}"></i>
                                        <span>${isTV ? 'TV Series' : 'Movie'}</span>
                                    </div>
                                    ${movie.country ? `
                                        <div style="background: rgba(255,255,255,0.1); color: white; padding: 8px 16px; border-radius: 25px; font-weight: 500;">
                                            <i class="fas fa-globe"></i>
                                            <span>${movie.country}</span>
                                        </div>
                                    ` : ''}
                                </div>
                                
                                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                                    ${movie.genre && movie.genre.length > 0 ? movie.genre.map(g => `
                                        <span style="background: rgba(102, 126, 234, 0.15); padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(102, 126, 234, 0.3); color: var(--accent-blue); font-weight: 500;">
                                            ${g}
                                        </span>
                                    `).join('') : ''}
                                </div>
                                
                                <p style="margin-bottom: 2rem; line-height: 1.8; color: var(--text-secondary); font-size: 1.1rem;">
                                    ${movie.description || 'No description available.'}
                                </p>
                                
                                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
                                    ${movie.releaseDate ? `
                                        <div>
                                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Release Date</div>
                                            <div style="font-weight: 600; display: flex; align-items: center; gap: 10px;">
                                                <i class="fas fa-calendar"></i>
                                                <span>${movie.releaseDate}</span>
                                            </div>
                                        </div>
                                    ` : ''}
                                    
                                    ${movie.duration ? `
                                        <div>
                                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Duration</div>
                                            <div style="font-weight: 600; display: flex; align-items: center; gap: 10px;">
                                                <i class="fas fa-clock"></i>
                                                <span>${Math.floor(movie.duration / 60)} minutes</span>
                                            </div>
                                        </div>
                                    ` : ''}
                                    
                                    ${movie.subtitles ? `
                                        <div style="grid-column: span 2;">
                                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Subtitles</div>
                                            <div style="font-weight: 600; display: flex; align-items: center; gap: 10px;">
                                                <i class="fas fa-closed-captioning"></i>
                                                <span>${movie.subtitles.split(',').slice(0, 3).join(', ')}${movie.subtitles.split(',').length > 3 ? '...' : ''}</span>
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        
                        ${castHtml}
                        
                        ${episodesHtml}
                        
                        <div class="quality-selector">
                            <h3><i class="fas fa-hd"></i> Select Quality</h3>
                            <div class="quality-grid">
                                <div class="quality-card active" data-quality="360p">
                                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent-blue);">
                                        <i class="fas fa-tv"></i>
                                    </div>
                                    <div style="font-weight: 600;">360p</div>
                                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Good</div>
                                </div>
                                <div class="quality-card" data-quality="480p">
                                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent-blue);">
                                        <i class="fas fa-tv"></i>
                                    </div>
                                    <div style="font-weight: 600;">480p</div>
                                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Better</div>
                                </div>
                                <div class="quality-card" data-quality="720p">
                                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent-blue);">
                                        <i class="fas fa-hd"></i>
                                    </div>
                                    <div style="font-weight: 600;">720p</div>
                                    <div style="font-size: 0.9rem; color: var(--text-secondary);">HD</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="action-buttons">
                            <button class="action-btn stream-btn" id="play-single">
                                <i class="fas fa-play-circle"></i>
                                <span>Stream Now</span>
                            </button>
                            <button class="action-btn download-btn" id="download-single">
                                <i class="fas fa-download"></i>
                                <span>Download</span>
                            </button>
                            ${movie.trailer ? `
                                <button class="action-btn trailer-btn" id="play-trailer">
                                    <i class="fas fa-play"></i>
                                    <span>Watch Trailer</span>
                                </button>
                            ` : ''}
                        </div>
                        
                        <div id="video-container" class="video-container" style="display: none; margin-top: 3rem;">
                            <video id="video-player" controls style="width: 100%; height: 100%;">
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    </div>
                `;
                
                // Setup season selection for TV shows
                if (hasEpisodes) {
                    const seasonSelector = modalBody.querySelector('#season-selector');
                    seasonSelector.querySelectorAll('.season-card').forEach(card => {
                        card.addEventListener('click', function() {
                            selectedSeason = this.dataset.season;
                            
                            // Update active season
                            seasonSelector.querySelectorAll('.season-card').forEach(b => 
                                b.classList.remove('active')
                            );
                            this.classList.add('active');
                            
                            // Show episodes for this season
                            const episodeContainer = modalBody.querySelector('#episode-container');
                            const episodeGrid = modalBody.querySelector('#episode-grid');
                            
                            const seasonEpisodes = movie.episodes.filter(ep => ep.season == selectedSeason);
                            
                            episodeGrid.innerHTML = seasonEpisodes.map(ep => `
                                <div>
                                    <input type="checkbox" id="ep-${selectedSeason}-${ep.episode}" 
                                           class="episode-checkbox" 
                                           data-season="${selectedSeason}" 
                                           data-episode="${ep.episode}">
                                    <label for="ep-${selectedSeason}-${ep.episode}" class="episode-label">
                                        <div style="font-size: 1.2rem; margin-bottom: 0.5rem;">
                                            <i class="fas fa-play"></i>
                                        </div>
                                        <div style="font-weight: 600;">Episode ${ep.episode}</div>
                                    </label>
                                </div>
                            `).join('');
                            
                            episodeContainer.style.display = 'block';
                            
                            // Setup episode selection
                            setupEpisodeSelection();
                            
                            // Scroll to episodes
                            episodeContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        });
                    });
                    
                    // Setup select all button
                    const selectAllBtn = modalBody.querySelector('#select-all-btn');
                    selectAllBtn.addEventListener('click', () => {
                        const checkboxes = modalBody.querySelectorAll('.episode-checkbox');
                        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                        
                        checkboxes.forEach(cb => {
                            cb.checked = !allChecked;
                            if (cb.checked) {
                                selectedEpisodes.add(`s${cb.dataset.season}e${cb.dataset.episode}`);
                            } else {
                                selectedEpisodes.delete(`s${cb.dataset.season}e${cb.dataset.episode}`);
                            }
                        });
                        
                        updateBatchButtons();
                        selectAllBtn.innerHTML = `<i class="fas fa-${allChecked ? 'check' : 'check-double'}"></i> ${allChecked ? 'Select All' : 'Deselect All'}`;
                    });
                    
                    // Setup batch buttons
                    const batchPlayBtn = modalBody.querySelector('#batch-play-btn');
                    const batchDownloadBtn = modalBody.querySelector('#batch-download-btn');
                    
                    batchPlayBtn.addEventListener('click', () => playBatchEpisodes());
                    batchDownloadBtn.addEventListener('click', () => downloadBatchEpisodes());
                }
                
                // Setup quality selector
                modalBody.querySelectorAll('.quality-card').forEach(card => {
                    card.addEventListener('click', function() {
                        selectedQuality = this.dataset.quality;
                        
                        modalBody.querySelectorAll('.quality-card').forEach(b => 
                            b.classList.remove('active')
                        );
                        this.classList.add('active');
                    });
                });
                
                // Setup play button for single episode/movie
                modalBody.querySelector('#play-single').addEventListener('click', async () => {
                    if (isTV && selectedSeason && selectedEpisodes.size === 1) {
                        const episode = Array.from(selectedEpisodes)[0];
                        const [season, ep] = episode.replace('s', '').replace('e', '').split('e');
                        await playStream(season, ep);
                    } else {
                        await playStream();
                    }
                });
                
                // Setup download button for single episode/movie
                modalBody.querySelector('#download-single').addEventListener('click', async () => {
                    if (isTV && selectedSeason && selectedEpisodes.size === 1) {
                        const episode = Array.from(selectedEpisodes)[0];
                        const [season, ep] = episode.replace('s', '').replace('e', '').split('e');
                        await downloadMovie(season, ep);
                    } else {
                        await downloadMovie();
                    }
                });
                
                // Setup trailer button
                if (movie.trailer) {
                    modalBody.querySelector('#play-trailer').addEventListener('click', () => {
                        const videoContainer = modalBody.querySelector('#video-container');
                        const videoPlayer = modalBody.querySelector('#video-player');
                        
                        videoPlayer.src = movie.trailer;
                        videoContainer.style.display = 'block';
                        videoPlayer.play();
                        
                        // Scroll to video
                        videoContainer.scrollIntoView({ behavior: 'smooth' });
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

            // Setup episode selection
            function setupEpisodeSelection() {
                const checkboxes = document.querySelectorAll('.episode-checkbox');
                checkboxes.forEach(cb => {
                    cb.addEventListener('change', function() {
                        const episodeKey = `s${this.dataset.season}e${this.dataset.episode}`;
                        
                        if (this.checked) {
                            selectedEpisodes.add(episodeKey);
                        } else {
                            selectedEpisodes.delete(episodeKey);
                        }
                        
                        updateBatchButtons();
                    });
                });
            }

            // Update batch buttons
            function updateBatchButtons() {
                const batchPlayBtn = document.querySelector('#batch-play-btn');
                const batchDownloadBtn = document.querySelector('#batch-download-btn');
                const count = selectedEpisodes.size;
                
                if (count > 0) {
                    batchPlayBtn.disabled = false;
                    batchDownloadBtn.disabled = false;
                    batchPlayBtn.innerHTML = `<i class="fas fa-play-circle"></i> Play Selected (${count})`;
                    batchDownloadBtn.innerHTML = `<i class="fas fa-download"></i> Download Selected (${count})`;
                } else {
                    batchPlayBtn.disabled = true;
                    batchDownloadBtn.disabled = true;
                    batchPlayBtn.innerHTML = `<i class="fas fa-play-circle"></i> Play Selected (0)`;
                    batchDownloadBtn.innerHTML = `<i class="fas fa-download"></i> Download Selected (0)`;
                }
            }

            // Play single stream
            async function playStream(season = null, episode = null) {
                if (!selectedMovieId) return;
                
                try {
                    const videoContainer = document.querySelector('#video-container');
                    const videoPlayer = document.querySelector('#video-player');
                    
                    // Build URL with parameters
                    let streamUrl = `/api/stream/${selectedMovieId}?quality=${selectedQuality}`;
                    if (season) streamUrl += `&season=${season}`;
                    if (episode) streamUrl += `&episode=${episode}`;
                    
                    videoPlayer.src = streamUrl;
                    videoContainer.style.display = 'block';
                    videoPlayer.play();
                    
                    // Scroll to video
                    videoContainer.scrollIntoView({ behavior: 'smooth' });
                } catch (error) {
                    console.error('Stream error:', error);
                    showModalError('Failed to start stream. Please try again.');
                }
            }

            // Play batch episodes
            async function playBatchEpisodes() {
                if (selectedEpisodes.size === 0) return;
                
                // For now, play first episode in batch
                const firstEpisode = Array.from(selectedEpisodes)[0];
                const [season, episode] = firstEpisode.replace('s', '').replace('e', '').split('e');
                
                await playStream(season, episode);
                
                // Show notification
                showNotification(`Playing episode ${episode} of ${selectedEpisodes.size} selected`, 'info');
            }

            // Download single movie/episode
            async function downloadMovie(season = null, episode = null) {
                if (!selectedMovieId) return;
                
                try {
                    // First get sources to get the direct download URL
                    let sourcesUrl = `/api/sources/${selectedMovieId}`;
                    if (season) sourcesUrl += `?season=${season}`;
                    if (episode) sourcesUrl += `${season ? '&' : '?'}episode=${episode}`;
                    
                    const response = await fetch(sourcesUrl);
                    const data = await response.json();
                    
                    if (data.success && data.sources.length > 0) {
                        // Find the selected quality or fallback to first available
                        const source = data.sources.find(s => s.quality === selectedQuality) || data.sources[0];
                        
                        if (source && source.download_url) {
                            // Create a temporary link to trigger download
                            const link = document.createElement('a');
                            link.href = source.download_url;
                            const fileName = movieDetails ? 
                                `${movieDetails.title} ${season ? `S${season}E${episode}` : ''} - ${selectedQuality}.mp4` :
                                `download-${selectedQuality}.mp4`;
                            link.download = fileName;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            
                            showNotification('Download started!', 'success');
                        } else {
                            showModalError('Download not available for this quality.');
                        }
                    } else {
                        showModalError('Download sources not available.');
                    }
                } catch (error) {
                    console.error('Download error:', error);
                    showModalError('Download failed. Please try again.');
                }
            }

            // Download batch episodes
            async function downloadBatchEpisodes() {
                if (selectedEpisodes.size === 0) return;
                
                // For batch download, we'll download them one by one
                const episodesArray = Array.from(selectedEpisodes);
                let completed = 0;
                
                for (const episode of episodesArray) {
                    const [season, ep] = episode.replace('s', '').replace('e', '').split('e');
                    
                    // Add small delay between downloads
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    try {
                        const sourcesUrl = `/api/sources/${selectedMovieId}?season=${season}&episode=${ep}`;
                        const response = await fetch(sourcesUrl);
                        const data = await response.json();
                        
                        if (data.success && data.sources.length > 0) {
                            const source = data.sources.find(s => s.quality === selectedQuality) || data.sources[0];
                            
                            if (source && source.download_url) {
                                const link = document.createElement('a');
                                link.href = source.download_url;
                                link.download = `${movieDetails.title} S${season}E${ep} - ${selectedQuality}.mp4`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                completed++;
                                
                                // Update notification
                                showNotification(`Downloading ${completed}/${episodesArray.length}...`, 'info');
                            }
                        }
                    } catch (error) {
                        console.error(`Error downloading ${episode}:`, error);
                    }
                }
                
                showNotification(`Downloaded ${completed} of ${episodesArray.length} episodes`, 'success');
            }

            // Update pagination
            function updatePagination(pagination) {
                const paginationDiv = document.getElementById('pagination');
                
                if (!pagination || pagination.totalPages <= 1) {
                    paginationDiv.innerHTML = '';
                    return;
                }
                
                totalPages = pagination.totalPages;
                
                let html = '<div style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin: 3rem 0;">';
                
                if (currentPage > 1) {
                    html += `<button onclick="changePage(${currentPage - 1})" 
                                    style="padding: 12px 24px; background: var(--primary-gradient); border: none; border-radius: 10px; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; transition: all 0.3s ease;">
                                <i class="fas fa-chevron-left"></i> Previous
                            </button>`;
                }
                
                html += `<div style="padding: 12px 24px; background: rgba(255,255,255,0.1); border-radius: 10px; font-weight: 600; backdrop-filter: blur(10px);">
                            Page ${currentPage} of ${totalPages}
                         </div>`;
                
                if (currentPage < totalPages) {
                    html += `<button onclick="changePage(${currentPage + 1})" 
                                    style="padding: 12px 24px; background: var(--primary-gradient); border: none; border-radius: 10px; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 600; transition: all 0.3s ease;">
                                Next <i class="fas fa-chevron-right"></i>
                            </button>`;
                }
                
                html += '</div>';
                paginationDiv.innerHTML = html;
                
                // Add hover effects to pagination buttons
                paginationDiv.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('mouseenter', () => {
                        btn.style.transform = 'translateY(-3px)';
                        btn.style.boxShadow = '0 10px 20px rgba(102, 126, 234, 0.3)';
                    });
                    btn.addEventListener('mouseleave', () => {
                        btn.style.transform = 'translateY(0)';
                        btn.style.boxShadow = 'none';
                    });
                });
            }

            // Change page
            window.changePage = async function(page) {
                if (page < 1 || page > totalPages) return;
                
                currentPage = page;
                showSkeletonLoading();
                
                try {
                    const response = await fetch(`/api/search/${encodeURIComponent(currentSearch)}?page=${page}`);
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

            // Show skeleton loading
            function showSkeletonLoading() {
                const grid = document.getElementById('content-grid');
                grid.innerHTML = `
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                    <div class="skeleton skeleton-card"></div>
                `;
            }

            // Show modal loading
            function showModalLoading() {
                const modalBody = document.getElementById('modal-body');
                modalBody.innerHTML = `
                    <div style="text-align: center; padding: 4rem;">
                        <div class="loading-ring" style="margin: 0 auto 2rem;"></div>
                        <div style="color: var(--text-secondary); font-size: 1.1rem;">Loading details...</div>
                    </div>
                `;
            }

            // Show error message
            function showError(message) {
                const grid = document.getElementById('content-grid');
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 4rem;">
                        <div style="font-size: 4rem; color: var(--danger); margin-bottom: 1rem;">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Oops!</h3>
                        <p style="color: var(--text-secondary);">${message}</p>
                        <button onclick="window.location.reload()" 
                                style="margin-top: 2rem; padding: 12px 24px; background: var(--primary-gradient); border: none; border-radius: 10px; color: white; cursor: pointer; font-weight: 600; transition: all 0.3s ease;">
                            <i class="fas fa-redo"></i> Try Again
                        </button>
                    </div>
                `;
            }

            // Show modal error
            function showModalError(message) {
                const modalBody = document.getElementById('modal-body');
                modalBody.innerHTML = `
                    <div style="text-align: center; padding: 4rem;">
                        <div style="font-size: 4rem; color: var(--danger); margin-bottom: 1rem;">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3 style="color: var(--text-primary); margin-bottom: 1rem;">Something went wrong</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 2rem;">${message}</p>
                        <button onclick="closeModal()" 
                                style="padding: 12px 24px; background: var(--primary-gradient); border: none; border-radius: 10px; color: white; cursor: pointer; font-weight: 600;">
                            <i class="fas fa-times"></i> Close
                        </button>
                    </div>
                `;
            }

            // Show notification
            function showNotification(message, type = 'info') {
                // Create notification element
                const notification = document.createElement('div');
                notification.style.cssText = `
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 25px;
                    background: ${type === 'success' ? 'var(--primary-gradient)' : type === 'error' ? 'var(--secondary-gradient)' : 'var(--accent-gradient)'};
                    color: white;
                    border-radius: 10px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: slideInRight 0.3s ease;
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255,255,255,0.2);
                    max-width: 400px;
                `;
                
                notification.innerHTML = `
                    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                    <span>${message}</span>
                `;
                
                document.body.appendChild(notification);
                
                // Remove notification after 3 seconds
                setTimeout(() => {
                    notification.style.animation = 'slideOutRight 0.3s ease';
                    setTimeout(() => {
                        if (notification.parentNode) {
                            notification.parentNode.removeChild(notification);
                        }
                    }, 300);
                }, 3000);
                
                // Add CSS for animations
                if (!document.querySelector('#notification-styles')) {
                    const style = document.createElement('style');
                    style.id = 'notification-styles';
                    style.textContent = `
                        @keyframes slideInRight {
                            from { transform: translateX(100%); opacity: 0; }
                            to { transform: translateX(0); opacity: 1; }
                        }
                        @keyframes slideOutRight {
                            from { transform: translateX(0); opacity: 1; }
                            to { transform: translateX(100%); opacity: 0; }
                        }
                    `;
                    document.head.appendChild(style);
                }
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
                
                // Reset selections
                selectedEpisodes.clear();
                selectedSeason = null;
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
                    
                    // Show install prompt after 8 seconds
                    setTimeout(() => {
                        const installPrompt = document.getElementById('install-prompt');
                        if (installPrompt && !localStorage.getItem('installPromptDismissed')) {
                            installPrompt.style.display = 'flex';
                        }
                    }, 8000);
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
                        localStorage.setItem('installPromptDismissed', 'true');
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

// Service Worker (unchanged from previous version)
app.get('/sw.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`
        const CACHE_NAME = 'cloud-movies-v1';
        
        const urlsToCache = [
            '/',
            '/manifest.json'
        ];
        
        self.addEventListener('install', event => {
            event.waitUntil(
                caches.open(CACHE_NAME)
                    .then(cache => {
                        console.log('Opened cache');
                        return cache.addAll(urlsToCache);
                    })
            );
        });
        
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
        
        self.addEventListener('fetch', event => {
            if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
                return;
            }
            
            event.respondWith(
                caches.match(event.request)
                    .then(response => {
                        if (response) {
                            return response;
                        }
                        
                        const fetchRequest = event.request.clone();
                        
                        return fetch(fetchRequest).then(response => {
                            if (!response || response.status !== 200 || response.type !== 'basic') {
                                return response;
                            }
                            
                            const responseToCache = response.clone();
                            
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            
                            return response;
                        }).catch(error => {
                            console.error('Fetch failed:', error);
                            return caches.match('/');
                        });
                    })
            );
        });
    `);
});

// Manifest (updated)
app.get('/manifest.json', (req, res) => {
    res.json({
        "name": "CLOUD.MOVIES | Premium Streaming",
        "short_name": "CloudMovies",
        "description": "Premium movie and series streaming platform",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0a0a1a",
        "theme_color": "#667eea",
        "orientation": "portrait",
        "icons": [
            {
                "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%23667eea'>🎬</text></svg>",
                "sizes": "any",
                "type": "image/svg+xml",
                "purpose": "any maskable"
            }
        ],
        "categories": ["entertainment", "movies", "video"],
        "shortcuts": [
            {
                "name": "Search Content",
                "short_name": "Search",
                "description": "Search for movies and TV series",
                "url": "/?search",
                "icons": [{ "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%23667eea'>🔍</text></svg>", "sizes": "96x96" }]
            }
        ]
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 CLOUD.MOVIES server running on port ${PORT}`);
    console.log(`📱 Developed by Bruce Bera - Bera Tech Solutions`);
    console.log(`📞 Contact: wa.me/254743983206`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});
