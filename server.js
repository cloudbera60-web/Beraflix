const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect('mongodb+srv://ellyongiro8:QwXDXE6tyrGpUTNb@cluster0.tyxcmm9.mongodb.net/movie_streaming?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Database Models
const User = mongoose.model('User', new mongoose.Schema({
    username: { type: String, unique: true },
    email: { type: String, unique: true },
    password: String,
    profilePic: { type: String, default: '' },
    watchHistory: [{
        contentId: String,
        title: String,
        type: String,
        season: Number,
        episode: Number,
        position: Number,
        duration: Number,
        watchedAt: { type: Date, default: Date.now },
        thumbnail: String
    }],
    watchlist: [{
        contentId: String,
        title: String,
        type: String,
        thumbnail: String,
        addedAt: { type: Date, default: Date.now }
    }],
    preferences: {
        autoPlay: { type: Boolean, default: true },
        defaultQuality: { type: String, default: '720p' },
        language: { type: String, default: 'en' },
        notifications: { type: Boolean, default: true }
    },
    createdAt: { type: Date, default: Date.now }
}));

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

// Cache for trending content
let trendingCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Featured content (curated list)
const FEATURED_CONTENT = [
    { id: 'featured-action', query: 'action', title: 'Action Blockbusters' },
    { id: 'featured-comedy', query: 'comedy', title: 'Laugh Out Loud' },
    { id: 'featured-scifi', query: 'sci-fi', title: 'Sci-Fi Adventures' },
    { id: 'featured-drama', query: 'drama', title: 'Critically Acclaimed' },
    { id: 'featured-2024', query: '2024', title: 'New Releases' }
];

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return next();
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'movie-streaming-secret');
        req.user = await User.findById(decoded.userId);
        next();
    } catch (err) {
        next();
    }
};

// ====================
// USER ENDPOINTS
// ====================

// User registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already exists' 
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({
            username,
            email,
            password: hashedPassword,
            preferences: {
                autoPlay: true,
                defaultQuality: '720p',
                language: 'en',
                notifications: true
            }
        });
        
        await user.save();
        
        // Create token
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET || 'movie-streaming-secret',
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profilePic: user.profilePic,
                preferences: user.preferences
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// User login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Find user
        const user = await User.findOne({ 
            $or: [{ email: username }, { username: username }] 
        });
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        // Create token
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET || 'movie-streaming-secret',
            { expiresIn: '30d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profilePic: user.profilePic,
                preferences: user.preferences
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Get user profile
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    res.json({
        success: true,
        user: {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            profilePic: req.user.profilePic,
            preferences: req.user.preferences,
            watchlistCount: req.user.watchlist.length,
            historyCount: req.user.watchHistory.length
        }
    });
});

// Add to watch history
app.post('/api/user/history', authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        const { contentId, title, type, season, episode, position, duration, thumbnail } = req.body;
        
        // Remove existing entry if exists
        req.user.watchHistory = req.user.watchHistory.filter(
            item => !(item.contentId === contentId && 
                     item.season === season && 
                     item.episode === episode)
        );
        
        // Add new entry at beginning
        req.user.watchHistory.unshift({
            contentId,
            title,
            type,
            season: season || 0,
            episode: episode || 0,
            position,
            duration,
            thumbnail,
            watchedAt: new Date()
        });
        
        // Keep only last 50 items
        if (req.user.watchHistory.length > 50) {
            req.user.watchHistory = req.user.watchHistory.slice(0, 50);
        }
        
        await req.user.save();
        
        res.json({ success: true, message: 'History updated' });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ success: false, message: 'Failed to update history' });
    }
});

// Get watch history
app.get('/api/user/history', authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.json({ success: true, history: [] });
    }
    
    res.json({
        success: true,
        history: req.user.watchHistory.slice(0, 20)
    });
});

// Add/remove from watchlist
app.post('/api/user/watchlist', authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        const { contentId, title, type, thumbnail, action = 'add' } = req.body;
        
        if (action === 'add') {
            // Check if already in watchlist
            const exists = req.user.watchlist.some(item => item.contentId === contentId);
            if (!exists) {
                req.user.watchlist.unshift({
                    contentId,
                    title,
                    type,
                    thumbnail,
                    addedAt: new Date()
                });
            }
        } else if (action === 'remove') {
            req.user.watchlist = req.user.watchlist.filter(item => item.contentId !== contentId);
        }
        
        await req.user.save();
        
        res.json({ 
            success: true, 
            message: `Watchlist ${action === 'add' ? 'updated' : 'item removed'}`,
            inWatchlist: action === 'add'
        });
    } catch (error) {
        console.error('Watchlist error:', error);
        res.status(500).json({ success: false, message: 'Failed to update watchlist' });
    }
});

// Get watchlist
app.get('/api/user/watchlist', authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.json({ success: true, watchlist: [] });
    }
    
    res.json({
        success: true,
        watchlist: req.user.watchlist
    });
});

// Update preferences
app.put('/api/user/preferences', authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        const { preferences } = req.body;
        
        if (preferences) {
            req.user.preferences = { ...req.user.preferences, ...preferences };
            await req.user.save();
        }
        
        res.json({ success: true, preferences: req.user.preferences });
    } catch (error) {
        console.error('Preferences error:', error);
        res.status(500).json({ success: false, message: 'Failed to update preferences' });
    }
});

// ====================
// CONTENT ENDPOINTS
// ====================

// Featured content (curated)
app.get('/api/featured/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { limit = 20 } = req.query;
        
        const featured = FEATURED_CONTENT.find(f => f.id === category);
        if (!featured) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(featured.query)}`);
        const data = await response.json();
        
        if (data.results && data.results.items) {
            const items = data.results.items.slice(0, limit).map(item => ({
                id: item.subjectId,
                title: item.title,
                description: item.description,
                year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
                type: item.subjectType === 1 ? 'movie' : 'tv',
                cover: item.cover?.url || item.thumbnail,
                poster: item.cover?.url || item.thumbnail,
                backdrop: item.stills?.url || item.cover?.url,
                genre: item.genre ? item.genre.split(',').map(g => g.trim()) : [],
                duration: item.duration,
                rating: item.imdbRatingValue,
                releaseDate: item.releaseDate,
                country: item.countryName
            }));
            
            res.json({
                success: true,
                category: featured.title,
                results: items
            });
        } else {
            res.json({ success: true, category: featured.title, results: [] });
        }
    } catch (error) {
        console.error('Featured error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch featured content' });
    }
});

// Get all featured categories
app.get('/api/featured', async (req, res) => {
    try {
        const categories = await Promise.all(
            FEATURED_CONTENT.map(async (featured) => {
                try {
                    const response = await fetch(`${API_BASE}/search/${encodeURIComponent(featured.query)}`);
                    const data = await response.json();
                    
                    if (data.results && data.results.items) {
                        const items = data.results.items.slice(0, 10).map(item => ({
                            id: item.subjectId,
                            title: item.title,
                            type: item.subjectType === 1 ? 'movie' : 'tv',
                            cover: item.cover?.url || item.thumbnail,
                            rating: item.imdbRatingValue
                        }));
                        
                        return {
                            id: featured.id,
                            title: featured.title,
                            query: featured.query,
                            items: items
                        };
                    }
                } catch (err) {
                    console.error(`Error fetching ${featured.title}:`, err);
                }
                return {
                    id: featured.id,
                    title: featured.title,
                    query: featured.query,
                    items: []
                };
            })
        );
        
        res.json({
            success: true,
            categories: categories.filter(cat => cat.items.length > 0)
        });
    } catch (error) {
        console.error('Featured categories error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch featured categories' });
    }
});

// Search endpoint (enhanced)
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = '1', type, year, genre } = req.query;
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results && data.results.items) {
            let items = data.results.items.map(item => ({
                id: item.subjectId,
                title: item.title,
                description: item.description,
                year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
                type: item.subjectType === 1 ? 'movie' : 'tv',
                cover: item.cover?.url || item.thumbnail,
                poster: item.cover?.url || item.thumbnail,
                backdrop: item.stills?.url || item.cover?.url,
                genre: item.genre ? item.genre.split(',').map(g => g.trim()) : [],
                duration: item.duration,
                rating: item.imdbRatingValue,
                releaseDate: item.releaseDate,
                country: item.countryName,
                hasResource: item.hasResource
            }));
            
            // Apply filters
            if (type) {
                const targetType = type === 'movie' ? 1 : 2;
                items = items.filter(item => 
                    (type === 'movie' && item.type === 'movie') || 
                    (type === 'tv' && item.type === 'tv')
                );
            }
            
            if (year) {
                items = items.filter(item => item.year === year.toString());
            }
            
            if (genre) {
                items = items.filter(item => 
                    item.genre && item.genre.some(g => 
                        g.toLowerCase().includes(genre.toLowerCase())
                    )
                );
            }
            
            res.json({
                success: true,
                query: query,
                filters: { type, year, genre },
                results: items,
                pagination: data.results.pager || {
                    page: parseInt(page),
                    totalPages: Math.ceil((data.results.pager?.totalCount || 0) / 24),
                    hasMore: data.results.pager?.hasMore || false
                }
            });
        } else {
            res.json({ 
                success: true, 
                results: [], 
                pagination: { page: 1, totalPages: 1, hasMore: false } 
            });
        }
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Get trending content (improved)
app.get('/api/trending', async (req, res) => {
    try {
        const now = Date.now();
        if (trendingCache.data && (now - trendingCache.timestamp) < CACHE_DURATION) {
            return res.json(trendingCache.data);
        }
        
        // Better trending algorithm
        const trendingQueries = [
            '2024', 'new', 'latest', 'movie', 
            'series', 'action', 'comedy', 'drama'
        ];
        
        // Get current day of month for rotation
        const dayOfMonth = new Date().getDate();
        const queryIndex = dayOfMonth % trendingQueries.length;
        const trendingQuery = trendingQueries[queryIndex];
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(trendingQuery)}`);
        const data = await response.json();
        
        if (data.results && data.results.items) {
            // Sort by rating if available
            const sortedItems = data.results.items
                .filter(item => item.imdbRatingValue)
                .sort((a, b) => parseFloat(b.imdbRatingValue) - parseFloat(a.imdbRatingValue))
                .slice(0, 20);
            
            // Fallback to first 20 items if no ratings
            const items = sortedItems.length > 0 ? sortedItems : data.results.items.slice(0, 20);
            
            const processedItems = items.map(item => ({
                id: item.subjectId,
                title: item.title,
                description: item.description,
                year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
                type: item.subjectType === 1 ? 'movie' : 'tv',
                cover: item.cover?.url || item.thumbnail,
                poster: item.cover?.url || item.thumbnail,
                backdrop: item.stills?.url || item.cover?.url,
                genre: item.genre ? item.genre.split(',').map(g => g.trim()) : [],
                duration: item.duration,
                rating: item.imdbRatingValue,
                releaseDate: item.releaseDate,
                country: item.countryName,
                trendingScore: parseFloat(item.imdbRatingValue) || 0
            }));
            
            const result = {
                success: true,
                query: trendingQuery,
                results: processedItems,
                timestamp: now
            };
            
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

// Info endpoint (unchanged but optimized)
app.get('/api/info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const response = await fetch(`${API_BASE}/info/${id}`);
        const data = await response.json();
        
        if (data.results && data.results.subject) {
            const subject = data.results.subject;
            const stars = data.results.stars || [];
            const resource = data.results.resource || {};
            
            let episodes = [];
            let seasonsData = [];
            if (resource.seasons && Array.isArray(resource.seasons)) {
                resource.seasons.forEach(season => {
                    if (season.se !== undefined && season.resolutions) {
                        const maxEp = season.maxEp || season.resolutions[0]?.epNum || 1;
                        seasonsData.push({
                            season: season.se,
                            episodeCount: maxEp,
                            availableQualities: season.resolutions.map(r => ({
                                quality: r.resolution + 'p',
                                episodes: r.epNum
                            }))
                        });
                        
                        for (let i = 1; i <= maxEp; i++) {
                            episodes.push({
                                season: season.se,
                                episode: i,
                                available: season.resolutions.some(r => r.epNum >= i)
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
                    backdrop: subject.stills?.url || subject.cover?.url,
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

// Sources endpoint (unchanged)
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

// Stream endpoint (enhanced with quality fallback)
app.get('/api/stream/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode, quality = '720p' } = req.query;
        
        let sourcesUrl = `${API_BASE}/sources/${id}`;
        if (season) sourcesUrl += `?season=${season}`;
        if (episode) sourcesUrl += `${season ? '&' : '?'}episode=${episode}`;
        
        const sourcesResponse = await fetch(sourcesUrl);
        const sourcesData = await sourcesResponse.json();
        
        if (!sourcesData.results || sourcesData.results.length === 0) {
            return res.status(404).json({ error: 'No sources available' });
        }
        
        // Quality priority: requested → 720p → 480p → 360p → first available
        const qualityOrder = [quality, '720p', '480p', '360p'];
        let selectedSource = null;
        
        for (const q of qualityOrder) {
            const source = sourcesData.results.find(s => s.quality === q);
            if (source) {
                selectedSource = source;
                break;
            }
        }
        
        if (!selectedSource) {
            selectedSource = sourcesData.results[0];
        }
        
        res.redirect(selectedSource.download_url);
    } catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ error: 'Streaming failed' });
    }
});

// Get recommendations (based on watch history)
app.get('/api/recommendations', authenticateToken, async (req, res) => {
    try {
        if (!req.user || req.user.watchHistory.length === 0) {
            // Return popular content as fallback
            const response = await fetch(`${API_BASE}/search/movie`);
            const data = await response.json();
            
            if (data.results && data.results.items) {
                const items = data.results.items.slice(0, 10).map(item => ({
                    id: item.subjectId,
                    title: item.title,
                    type: item.subjectType === 1 ? 'movie' : 'tv',
                    cover: item.cover?.url || item.thumbnail,
                    rating: item.imdbRatingValue
                }));
                
                return res.json({ success: true, recommendations: items, source: 'popular' });
            }
        }
        
        // Get most watched genre
        const genreCount = {};
        req.user.watchHistory.forEach(item => {
            // We'd need genre info from content, for now use popular
        });
        
        // For now, return trending
        const trendingResponse = await fetch(`${API_BASE}/search/2024`);
        const trendingData = await trendingResponse.json();
        
        if (trendingData.results && trendingData.results.items) {
            const items = trendingData.results.items.slice(0, 10).map(item => ({
                id: item.subjectId,
                title: item.title,
                type: item.subjectType === 1 ? 'movie' : 'tv',
                cover: item.cover?.url || item.thumbnail,
                rating: item.imdbRatingValue
            }));
            
            res.json({ success: true, recommendations: items, source: 'trending' });
        } else {
            res.json({ success: true, recommendations: [] });
        }
    } catch (error) {
        console.error('Recommendations error:', error);
        res.json({ success: true, recommendations: [] });
    }
});

// ====================
// MAIN HTML PAGE
// ====================

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>STREAMFLIX | Premium Entertainment</title>
        <meta name="description" content="Stream movies and TV series in stunning quality">
        <meta name="author" content="Bruce Bera">
        
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
                /* Enhanced Color Scheme */
                --primary-bg: #0a0a1a;
                --secondary-bg: #0f0f23;
                --card-bg: #141430;
                --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                --accent-red: #e50914;
                --accent-blue: #667eea;
                --accent-purple: #764ba2;
                --accent-pink: #f093fb;
                --accent-cyan: #00f2fe;
                
                /* Text Colors */
                --text-primary: #ffffff;
                --text-secondary: #b8c1ec;
                --text-muted: #8a8d9e;
                
                /* Status Colors */
                --success: #00ff9d;
                --warning: #ffcc00;
                --danger: #ff416c;
                --info: #4facfe;
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Poppins', sans-serif;
                background: var(--primary-bg);
                color: var(--text-primary);
                min-height: 100vh;
                overflow-x: hidden;
            }
            
            /* Loading Screen - Enhanced */
            #loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--primary-bg);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                transition: opacity 0.5s ease;
            }
            
            .logo-container {
                text-align: center;
                margin-bottom: 3rem;
            }
            
            .logo-text {
                font-family: 'Orbitron', sans-serif;
                font-size: 4.5rem;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 4px;
                background: var(--accent-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-size: 300% 300%;
                animation: gradientShift 3s ease infinite;
                margin-bottom: 0.5rem;
            }
            
            .logo-tagline {
                font-size: 1.2rem;
                color: var(--text-secondary);
                letter-spacing: 2px;
                font-weight: 300;
            }
            
            .loading-animation {
                display: flex;
                gap: 10px;
                margin-top: 2rem;
            }
            
            .loading-dot {
                width: 15px;
                height: 15px;
                border-radius: 50%;
                background: var(--accent-gradient);
                animation: bounce 1.4s infinite ease-in-out both;
            }
            
            .loading-dot:nth-child(1) { animation-delay: -0.32s; }
            .loading-dot:nth-child(2) { animation-delay: -0.16s; }
            
            @keyframes gradientShift {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            
            @keyframes bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
            
            /* Header - Enhanced */
            header {
                background: linear-gradient(to bottom, rgba(10, 10, 26, 0.95), transparent);
                padding: 1.5rem 3rem;
                position: fixed;
                top: 0;
                width: 100%;
                z-index: 100;
                transition: all 0.3s ease;
            }
            
            header.scrolled {
                background: rgba(10, 10, 26, 0.95);
                backdrop-filter: blur(10px);
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
            }
            
            .header-container {
                max-width: 1400px;
                margin: 0 auto;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .logo {
                font-family: 'Orbitron', sans-serif;
                font-size: 2rem;
                font-weight: 700;
                background: var(--accent-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .nav-links {
                display: flex;
                gap: 2rem;
                align-items: center;
            }
            
            .nav-link {
                color: var(--text-secondary);
                text-decoration: none;
                font-weight: 500;
                transition: color 0.3s ease;
                font-size: 1rem;
            }
            
            .nav-link:hover, .nav-link.active {
                color: var(--text-primary);
            }
            
            .user-menu {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .auth-btn {
                padding: 8px 20px;
                border-radius: 25px;
                border: none;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .login-btn {
                background: transparent;
                color: var(--text-primary);
                border: 2px solid var(--accent-blue);
            }
            
            .signup-btn {
                background: var(--accent-gradient);
                color: white;
            }
            
            .auth-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
            }
            
            /* Hero Section */
            .hero {
                height: 80vh;
                min-height: 600px;
                position: relative;
                overflow: hidden;
                margin-bottom: 4rem;
            }
            
            .hero-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
                z-index: -1;
                opacity: 0.3;
            }
            
            .hero-content {
                position: relative;
                height: 100%;
                display: flex;
                align-items: center;
                padding: 0 4rem;
                background: linear-gradient(to right, var(--primary-bg) 20%, transparent 70%);
            }
            
            .hero-info {
                max-width: 600px;
            }
            
            .hero-title {
                font-family: 'Montserrat', sans-serif;
                font-size: 4rem;
                font-weight: 800;
                margin-bottom: 1.5rem;
                line-height: 1.1;
            }
            
            .hero-description {
                font-size: 1.2rem;
                line-height: 1.6;
                color: var(--text-secondary);
                margin-bottom: 2rem;
            }
            
            .hero-actions {
                display: flex;
                gap: 1rem;
                margin-bottom: 2rem;
            }
            
            .hero-btn {
                padding: 15px 35px;
                border: none;
                border-radius: 5px;
                font-size: 1.1rem;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: all 0.3s ease;
            }
            
            .play-btn {
                background: var(--accent-red);
                color: white;
            }
            
            .info-btn {
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                color: white;
            }
            
            .hero-btn:hover {
                transform: scale(1.05);
                box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);
            }
            
            /* Content Rows */
            .content-section {
                padding: 2rem 4rem;
                max-width: 1400px;
                margin: 0 auto;
            }
            
            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
            }
            
            .section-title {
                font-size: 1.8rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .section-link {
                color: var(--accent-blue);
                text-decoration: none;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            
            .content-row {
                display: flex;
                overflow-x: auto;
                gap: 1rem;
                padding: 1rem 0;
                scrollbar-width: thin;
                scrollbar-color: var(--accent-blue) transparent;
            }
            
            .content-row::-webkit-scrollbar {
                height: 6px;
            }
            
            .content-row::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
                border-radius: 3px;
            }
            
            .content-row::-webkit-scrollbar-thumb {
                background: var(--accent-gradient);
                border-radius: 3px;
            }
            
            /* Content Card - Enhanced */
            .content-card {
                flex: 0 0 auto;
                width: 220px;
                background: var(--card-bg);
                border-radius: 10px;
                overflow: hidden;
                transition: all 0.3s ease;
                cursor: pointer;
                position: relative;
            }
            
            .content-card:hover {
                transform: scale(1.05);
                z-index: 10;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            
            .card-image {
                width: 100%;
                height: 320px;
                object-fit: cover;
                transition: transform 0.3s ease;
            }
            
            .content-card:hover .card-image {
                transform: scale(1.1);
            }
            
            .card-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent 50%);
                opacity: 0;
                transition: opacity 0.3s ease;
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                padding: 1.5rem;
            }
            
            .content-card:hover .card-overlay {
                opacity: 1;
            }
            
            .card-title {
                font-size: 1.1rem;
                font-weight: 600;
                margin-bottom: 0.5rem;
            }
            
            .card-meta {
                display: flex;
                justify-content: space-between;
                font-size: 0.9rem;
                color: var(--text-secondary);
                margin-bottom: 1rem;
            }
            
            .card-actions {
                display: flex;
                gap: 0.5rem;
            }
            
            .card-btn {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                border: none;
                background: rgba(255, 255, 255, 0.2);
                backdrop-filter: blur(10px);
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .card-btn:hover {
                background: var(--accent-red);
                transform: scale(1.1);
            }
            
            /* Auth Modal */
            .auth-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 1000;
                backdrop-filter: blur(5px);
            }
            
            .auth-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--secondary-bg);
                border-radius: 15px;
                padding: 3rem;
                width: 90%;
                max-width: 400px;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            }
            
            .auth-tabs {
                display: flex;
                margin-bottom: 2rem;
                border-bottom: 2px solid rgba(255, 255, 255, 0.1);
            }
            
            .auth-tab {
                flex: 1;
                padding: 1rem;
                text-align: center;
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 1.1rem;
                font-weight: 600;
                cursor: pointer;
                transition: color 0.3s ease;
            }
            
            .auth-tab.active {
                color: var(--text-primary);
                border-bottom: 3px solid var(--accent-blue);
            }
            
            .auth-form {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
            }
            
            .form-group {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .form-label {
                color: var(--text-secondary);
                font-size: 0.9rem;
            }
            
            .form-input {
                padding: 12px 15px;
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                color: white;
                font-size: 1rem;
                transition: border-color 0.3s ease;
            }
            
            .form-input:focus {
                outline: none;
                border-color: var(--accent-blue);
            }
            
            .auth-submit {
                padding: 15px;
                background: var(--accent-gradient);
                border: none;
                border-radius: 8px;
                color: white;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                margin-top: 1rem;
            }
            
            .auth-submit:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
            }
            
            .auth-error {
                color: var(--danger);
                font-size: 0.9rem;
                text-align: center;
                margin-top: 1rem;
            }
            
            .close-auth {
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: none;
                border: none;
                color: var(--text-secondary);
                font-size: 1.5rem;
                cursor: pointer;
                transition: color 0.3s ease;
            }
            
            .close-auth:hover {
                color: var(--text-primary);
            }
            
            /* Responsive */
            @media (max-width: 1024px) {
                .hero-title {
                    font-size: 3rem;
                }
                
                .content-section {
                    padding: 2rem;
                }
            }
            
            @media (max-width: 768px) {
                .logo-text {
                    font-size: 3rem;
                }
                
                header {
                    padding: 1rem;
                }
                
                .nav-links {
                    display: none;
                }
                
                .hero {
                    height: 60vh;
                    min-height: 400px;
                }
                
                .hero-content {
                    padding: 0 2rem;
                }
                
                .hero-title {
                    font-size: 2.5rem;
                }
                
                .hero-description {
                    font-size: 1rem;
                }
                
                .content-section {
                    padding: 1rem;
                }
                
                .content-card {
                    width: 180px;
                }
                
                .card-image {
                    height: 250px;
                }
            }
            
            @media (max-width: 480px) {
                .logo-text {
                    font-size: 2.5rem;
                }
                
                .hero-title {
                    font-size: 2rem;
                }
                
                .hero-buttons {
                    flex-direction: column;
                }
                
                .content-card {
                    width: 150px;
                }
                
                .card-image {
                    height: 200px;
                }
            }
        </style>
    </head>
    <body>
        <!-- Loading Screen -->
        <div id="loading-screen">
            <div class="logo-container">
                <div class="logo-text">STREAMFLIX</div>
                <div class="logo-tagline">PREMIUM ENTERTAINMENT</div>
            </div>
            <div class="loading-animation">
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
                <div class="loading-dot"></div>
            </div>
        </div>

        <!-- Header -->
        <header id="main-header">
            <div class="header-container">
                <a href="/" class="logo">
                    <i class="fas fa-play-circle"></i>
                    STREAMFLIX
                </a>
                
                <div class="nav-links">
                    <a href="#" class="nav-link active"><i class="fas fa-home"></i> Home</a>
                    <a href="#movies" class="nav-link"><i class="fas fa-film"></i> Movies</a>
                    <a href="#series" class="nav-link"><i class="fas fa-tv"></i> Series</a>
                    <a href="#new" class="nav-link"><i class="fas fa-star"></i> New & Popular</a>
                    <a href="#watchlist" class="nav-link"><i class="fas fa-bookmark"></i> My List</a>
                </div>
                
                <div class="user-menu">
                    <div class="search-container" style="position: relative; margin-right: 1rem;">
                        <input type="text" id="search-input" placeholder="Search..." 
                               style="padding: 8px 15px; border-radius: 20px; 
                                      border: 2px solid rgba(255,255,255,0.2); 
                                      background: rgba(255,255,255,0.1); 
                                      color: white; width: 200px;">
                        <button id="search-btn" style="position: absolute; right: 5px; top: 50%; 
                                transform: translateY(-50%); background: none; border: none; 
                                color: white; cursor: pointer;">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                    
                    <div id="user-actions">
                        <!-- Will be populated by JavaScript -->
                        <button class="auth-btn login-btn" id="login-btn">Sign In</button>
                        <button class="auth-btn signup-btn" id="signup-btn">Sign Up</button>
                    </div>
                </div>
            </div>
        </header>

        <!-- Hero Section -->
        <section class="hero" id="hero-section">
            <!-- Hero content will be populated by JavaScript -->
        </section>

        <!-- Main Content -->
        <main id="main-content">
            <!-- Content rows will be populated by JavaScript -->
            <div id="content-rows"></div>
        </main>

        <!-- Auth Modal -->
        <div class="auth-modal" id="auth-modal">
            <div class="auth-content">
                <button class="close-auth" id="close-auth">&times;</button>
                
                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="login">Sign In</button>
                    <button class="auth-tab" data-tab="register">Sign Up</button>
                </div>
                
                <form class="auth-form" id="login-form" style="display: block;">
                    <div class="form-group">
                        <label class="form-label">Username or Email</label>
                        <input type="text" class="form-input" id="login-username" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-input" id="login-password" required>
                    </div>
                    
                    <button type="submit" class="auth-submit">Sign In</button>
                    <div class="auth-error" id="login-error"></div>
                </form>
                
                <form class="auth-form" id="register-form" style="display: none;">
                    <div class="form-group">
                        <label class="form-label">Username</label>
                        <input type="text" class="form-input" id="register-username" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" class="form-input" id="register-email" required>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" class="form-input" id="register-password" required>
                    </div>
                    
                    <button type="submit" class="auth-submit">Create Account</button>
                    <div class="auth-error" id="register-error"></div>
                </form>
            </div>
        </div>

        <!-- JavaScript -->
        <script>
            // Global state
            let currentUser = null;
            let authToken = localStorage.getItem('authToken');
            let featuredContent = [];
            let watchlist = [];
            let watchHistory = [];
            
            // DOM Elements
            const loadingScreen = document.getElementById('loading-screen');
            const mainHeader = document.getElementById('main-header');
            const heroSection = document.getElementById('hero-section');
            const contentRows = document.getElementById('content-rows');
            const searchInput = document.getElementById('search-input');
            const searchBtn = document.getElementById('search-btn');
            const userActions = document.getElementById('user-actions');
            const authModal = document.getElementById('auth-modal');
            const loginBtn = document.getElementById('login-btn');
            const signupBtn = document.getElementById('signup-btn');
            const closeAuth = document.getElementById('close-auth');
            const authTabs = document.querySelectorAll('.auth-tab');
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            const loginError = document.getElementById('login-error');
            const registerError = document.getElementById('register-error');
            
            // Initialize
            document.addEventListener('DOMContentLoaded', async () => {
                // Hide loading screen
                setTimeout(() => {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 500);
                }, 1500);
                
                // Setup header scroll effect
                window.addEventListener('scroll', () => {
                    if (window.scrollY > 50) {
                        mainHeader.classList.add('scrolled');
                    } else {
                        mainHeader.classList.remove('scrolled');
                    }
                });
                
                // Setup search
                searchBtn.addEventListener('click', performSearch);
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') performSearch();
                });
                
                // Setup auth
                setupAuth();
                
                // Load user if token exists
                if (authToken) {
                    await loadUserProfile();
                }
                
                // Load content
                await loadHomeContent();
            });
            
            // Setup authentication
            function setupAuth() {
                // Auth modal toggle
                loginBtn.addEventListener('click', () => {
                    authModal.style.display = 'block';
                    document.body.style.overflow = 'hidden';
                });
                
                signupBtn.addEventListener('click', () => {
                    authModal.style.display = 'block';
                    document.body.style.overflow = 'hidden';
                });
                
                closeAuth.addEventListener('click', closeAuthModal);
                authModal.addEventListener('click', (e) => {
                    if (e.target === authModal) closeAuthModal();
                });
                
                // Tab switching
                authTabs.forEach(tab => {
                    tab.addEventListener('click', () => {
                        const tabName = tab.dataset.tab;
                        
                        authTabs.forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        
                        if (tabName === 'login') {
                            loginForm.style.display = 'block';
                            registerForm.style.display = 'none';
                        } else {
                            loginForm.style.display = 'none';
                            registerForm.style.display = 'block';
                        }
                    });
                });
                
                // Form submission
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await loginUser();
                });
                
                registerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await registerUser();
                });
            }
            
            // Close auth modal
            function closeAuthModal() {
                authModal.style.display = 'none';
                document.body.style.overflow = 'auto';
                loginError.textContent = '';
                registerError.textContent = '';
            }
            
            // Login user
            async function loginUser() {
                const username = document.getElementById('login-username').value;
                const password = document.getElementById('login-password').value;
                
                try {
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, password })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        authToken = data.token;
                        localStorage.setItem('authToken', authToken);
                        currentUser = data.user;
                        
                        closeAuthModal();
                        updateUserUI();
                        loadUserData();
                    } else {
                        loginError.textContent = data.message || 'Login failed';
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    loginError.textContent = 'Login failed. Please try again.';
                }
            }
            
            // Register user
            async function registerUser() {
                const username = document.getElementById('register-username').value;
                const email = document.getElementById('register-email').value;
                const password = document.getElementById('register-password').value;
                
                try {
                    const response = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username, email, password })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        authToken = data.token;
                        localStorage.setItem('authToken', authToken);
                        currentUser = data.user;
                        
                        closeAuthModal();
                        updateUserUI();
                    } else {
                        registerError.textContent = data.message || 'Registration failed';
                    }
                } catch (error) {
                    console.error('Registration error:', error);
                    registerError.textContent = 'Registration failed. Please try again.';
                }
            }
            
            // Load user profile
            async function loadUserProfile() {
                try {
                    const response = await fetch('/api/user/profile', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        currentUser = data.user;
                        updateUserUI();
                        loadUserData();
                    } else {
                        localStorage.removeItem('authToken');
                        authToken = null;
                    }
                } catch (error) {
                    console.error('Profile load error:', error);
                    localStorage.removeItem('authToken');
                    authToken = null;
                }
            }
            
            // Load user data
            async function loadUserData() {
                try {
                    // Load watchlist
                    const watchlistRes = await fetch('/api/user/watchlist', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });
                    const watchlistData = await watchlistRes.json();
                    if (watchlistData.success) {
                        watchlist = watchlistData.watchlist;
                    }
                    
                    // Load history
                    const historyRes = await fetch('/api/user/history', {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });
                    const historyData = await historyRes.json();
                    if (historyData.success) {
                        watchHistory = historyData.history;
                    }
                } catch (error) {
                    console.error('User data load error:', error);
                }
            }
            
            // Update user UI
            function updateUserUI() {
                if (currentUser) {
                    userActions.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <div style="color: var(--text-primary);">
                                Welcome, <strong>${currentUser.username}</strong>
                            </div>
                            <button class="auth-btn login-btn" id="logout-btn">Logout</button>
                        </div>
                    `;
                    
                    document.getElementById('logout-btn').addEventListener('click', logoutUser);
                } else {
                    userActions.innerHTML = `
                        <button class="auth-btn login-btn" id="login-btn">Sign In</button>
                        <button class="auth-btn signup-btn" id="signup-btn">Sign Up</button>
                    `;
                    
                    // Re-attach event listeners
                    document.getElementById('login-btn').addEventListener('click', () => {
                        authModal.style.display = 'block';
                        document.body.style.overflow = 'hidden';
                    });
                    
                    document.getElementById('signup-btn').addEventListener('click', () => {
                        authModal.style.display = 'block';
                        document.body.style.overflow = 'hidden';
                    });
                }
            }
            
            // Logout user
            function logoutUser() {
                localStorage.removeItem('authToken');
                authToken = null;
                currentUser = null;
                watchlist = [];
                watchHistory = [];
                
                updateUserUI();
            }
            
            // Load home content
            async function loadHomeContent() {
                try {
                    // Load featured categories
                    const featuredRes = await fetch('/api/featured');
                    const featuredData = await featuredRes.json();
                    
                    if (featuredData.success) {
                        featuredContent = featuredData.categories;
                        
                        // Set hero with first featured item
                        if (featuredContent.length > 0 && featuredContent[0].items.length > 0) {
                            setHeroContent(featuredContent[0].items[0]);
                        }
                        
                        // Display content rows
                        displayContentRows();
                    }
                    
                    // Load trending
                    await loadTrendingRow();
                    
                    // Load continue watching if logged in
                    if (currentUser) {
                        await loadContinueWatchingRow();
                    }
                    
                    // Load recommendations
                    await loadRecommendationsRow();
                } catch (error) {
                    console.error('Home content error:', error);
                    showError('Failed to load content');
                }
            }
            
            // Set hero content
            function setHeroContent(content) {
                heroSection.innerHTML = `
                    <img src="${content.cover || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}" 
                         class="hero-backdrop" 
                         alt="${content.title}"
                         onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1'">
                    
                    <div class="hero-content">
                        <div class="hero-info">
                            <h1 class="hero-title">${content.title}</h1>
                            <p class="hero-description">
                                Discover amazing content in stunning quality. Stream your favorite movies and TV series anytime, anywhere.
                            </p>
                            <div class="hero-actions">
                                <button class="hero-btn play-btn" data-id="${content.id}">
                                    <i class="fas fa-play"></i> Play Now
                                </button>
                                <button class="hero-btn info-btn" data-id="${content.id}">
                                    <i class="fas fa-info-circle"></i> More Info
                                </button>
                            </div>
                            <div class="hero-meta">
                                <span><i class="fas fa-star"></i> ${content.rating || 'N/A'}/10</span>
                                <span><i class="fas fa-clock"></i> ${content.type === 'tv' ? 'Series' : 'Movie'}</span>
                                <span><i class="fas fa-calendar"></i> ${content.year || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add event listeners to hero buttons
                heroSection.querySelector('.play-btn').addEventListener('click', (e) => {
                    const id = e.target.closest('button').dataset.id;
                    playContent(id);
                });
                
                heroSection.querySelector('.info-btn').addEventListener('click', (e) => {
                    const id = e.target.closest('button').dataset.id;
                    showContentDetails(id);
                });
            }
            
            // Display content rows
            function displayContentRows() {
                let rowsHTML = '';
                
                featuredContent.forEach(category => {
                    if (category.items.length > 0) {
                        rowsHTML += `
                            <div class="content-section">
                                <div class="section-header">
                                    <h2 class="section-title">
                                        <i class="fas fa-${getCategoryIcon(category.id)}"></i>
                                        ${category.title}
                                    </h2>
                                    <a href="#" class="section-link" data-query="${category.query}">
                                        View All <i class="fas fa-chevron-right"></i>
                                    </a>
                                </div>
                                <div class="content-row">
                                    ${category.items.map(item => createContentCard(item)).join('')}
                                </div>
                            </div>
                        `;
                    }
                });
                
                contentRows.innerHTML = rowsHTML;
                
                // Add event listeners to view all links
                document.querySelectorAll('.section-link').forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        const query = e.target.closest('a').dataset.query;
                        performSearch(query);
                    });
                });
            }
            
            // Load trending row
            async function loadTrendingRow() {
                try {
                    const response = await fetch('/api/trending');
                    const data = await response.json();
                    
                    if (data.success && data.results.length > 0) {
                        const trendingHTML = `
                            <div class="content-section">
                                <div class="section-header">
                                    <h2 class="section-title">
                                        <i class="fas fa-fire"></i>
                                        Trending Now
                                    </h2>
                                </div>
                                <div class="content-row">
                                    ${data.results.map(item => createContentCard(item)).join('')}
                                </div>
                            </div>
                        `;
                        
                        contentRows.insertAdjacentHTML('beforeend', trendingHTML);
                    }
                } catch (error) {
                    console.error('Trending load error:', error);
                }
            }
            
            // Load continue watching row
            async function loadContinueWatchingRow() {
                if (watchHistory.length > 0) {
                    const continueHTML = `
                        <div class="content-section">
                            <div class="section-header">
                                <h2 class="section-title">
                                    <i class="fas fa-history"></i>
                                    Continue Watching
                                </h2>
                            </div>
                            <div class="content-row">
                                ${watchHistory.slice(0, 10).map(item => createContentCard(item, true)).join('')}
                            </div>
                        </div>
                    `;
                    
                    contentRows.insertAdjacentHTML('afterbegin', continueHTML);
                }
            }
            
            // Load recommendations row
            async function loadRecommendationsRow() {
                try {
                    const response = await fetch('/api/recommendations', {
                        headers: { 'Authorization': authToken ? `Bearer ${authToken}` : '' }
                    });
                    
                    const data = await response.json();
                    
                    if (data.success && data.recommendations.length > 0) {
                        const recsHTML = `
                            <div class="content-section">
                                <div class="section-header">
                                    <h2 class="section-title">
                                        <i class="fas fa-thumbs-up"></i>
                                        Recommended For You
                                    </h2>
                                </div>
                                <div class="content-row">
                                    ${data.recommendations.map(item => createContentCard(item)).join('')}
                                </div>
                            </div>
                        `;
                        
                        contentRows.insertAdjacentHTML('beforeend', recsHTML);
                    }
                } catch (error) {
                    console.error('Recommendations error:', error);
                }
            }
            
            // Create content card
            function createContentCard(item, isHistory = false) {
                const inWatchlist = watchlist.some(w => w.contentId === item.id);
                const progress = isHistory && item.position && item.duration 
                    ? Math.round((item.position / item.duration) * 100) 
                    : 0;
                
                return `
                    <div class="content-card" data-id="${item.id}">
                        <img src="${item.cover || item.thumbnail || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}" 
                             class="card-image" 
                             alt="${item.title}"
                             onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1'">
                        
                        ${isHistory && progress > 0 ? `
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: var(--accent-red); width: ${progress}%;"></div>
                        ` : ''}
                        
                        <div class="card-overlay">
                            <h3 class="card-title">${item.title}</h3>
                            <div class="card-meta">
                                <span>${item.rating ? `⭐ ${item.rating}` : ''}</span>
                                <span>${item.type === 'tv' ? '📺 Series' : '🎬 Movie'}</span>
                            </div>
                            <div class="card-actions">
                                <button class="card-btn play-btn" title="Play">
                                    <i class="fas fa-play"></i>
                                </button>
                                <button class="card-btn info-btn" title="More Info">
                                    <i class="fas fa-info-circle"></i>
                                </button>
                                <button class="card-btn watchlist-btn ${inWatchlist ? 'in-watchlist' : ''}" title="${inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}">
                                    <i class="fas ${inWatchlist ? 'fa-check' : 'fa-plus'}"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Get category icon
            function getCategoryIcon(categoryId) {
                const icons = {
                    'featured-action': 'explosion',
                    'featured-comedy': 'laugh',
                    'featured-scifi': 'robot',
                    'featured-drama': 'masks-theater',
                    'featured-2024': 'calendar-star'
                };
                
                return icons[categoryId] || 'film';
            }
            
            // Play content
            async function playContent(id) {
                // Implementation for playing content
                console.log('Play content:', id);
                // You would open your video player modal here
            }
            
            // Show content details
            async function showContentDetails(id) {
                // Implementation for showing details
                console.log('Show details for:', id);
                // You would open your details modal here
            }
            
            // Perform search
            async function performSearch() {
                const query = searchInput.value.trim();
                if (!query) return;
                
                // Redirect to search results
                window.location.href = `/search.html?q=${encodeURIComponent(query)}`;
            }
            
            // Show error
            function showError(message) {
                contentRows.innerHTML = `
                    <div style="text-align: center; padding: 4rem; color: var(--text-secondary);">
                        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <h3>${message}</h3>
                        <button onclick="window.location.reload()" 
                                style="margin-top: 2rem; padding: 10px 20px; 
                                       background: var(--accent-gradient); 
                                       border: none; border-radius: 5px; 
                                       color: white; cursor: pointer;">
                            Try Again
                        </button>
                    </div>
                `;
            }
        </script>
    </body>
    </html>
    `);
});

// ====================
// ADDITIONAL ROUTES
// ====================

// Search results page
app.get('/search.html', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Search Results - STREAMFLIX</title>
        <style>
            body { 
                background: #0a0a1a; 
                color: white; 
                font-family: 'Poppins', sans-serif;
                padding: 2rem;
            }
            .back-btn { 
                margin-bottom: 2rem; 
                padding: 10px 20px;
                background: #667eea;
                border: none;
                border-radius: 5px;
                color: white;
                cursor: pointer;
            }
        </style>
    </head>
    <body>
        <button class="back-btn" onclick="window.history.back()">← Back</button>
        <h1>Search Results</h1>
        <div id="results"></div>
        
        <script>
            const params = new URLSearchParams(window.location.search);
            const query = params.get('q');
            
            if (query) {
                document.title = 'Search: ' + query + ' - STREAMFLIX';
                document.querySelector('h1').textContent = 'Search: ' + query;
                
                // Load search results
                fetch('/api/search/' + encodeURIComponent(query))
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.results.length > 0) {
                            const resultsHTML = data.results.map(item => \`
                                <div style="margin: 1rem 0; padding: 1rem; background: #141430; border-radius: 10px;">
                                    <h3>\${item.title}</h3>
                                    <p>\${item.year} • \${item.type}</p>
                                </div>
                            \`).join('');
                            
                            document.getElementById('results').innerHTML = resultsHTML;
                        } else {
                            document.getElementById('results').innerHTML = '<p>No results found.</p>';
                        }
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
        const CACHE_NAME = 'streamflix-v1';
        
        self.addEventListener('install', event => {
            event.waitUntil(
                caches.open(CACHE_NAME)
                    .then(cache => cache.addAll(['/']))
            );
        });
        
        self.addEventListener('fetch', event => {
            event.respondWith(
                caches.match(event.request)
                    .then(response => response || fetch(event.request))
            );
        });
    `);
});

// Manifest
app.get('/manifest.json', (req, res) => {
    res.json({
        "name": "STREAMFLIX",
        "short_name": "Streamflix",
        "description": "Premium streaming service",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0a0a1a",
        "theme_color": "#667eea",
        "icons": []
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 STREAMFLIX server running on port ${PORT}`);
    console.log(`📱 Developed by Bruce Bera`);
    console.log(`📞 Contact: wa.me/254743983206`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});
