const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const NodeCache = require('node-cache');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://ellyongiro8:QwXDXE6tyrGpUTNb@cluster0.tyxcmm9.mongodb.net/berafix?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Database Models
const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
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
        thumbnail: String,
        progress: Number // 0-100 percentage
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
        notifications: { type: Boolean, default: true },
        theme: { type: String, default: 'dark' }
    },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Cache for better performance
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// API Base URL
const API_BASE = 'https://movieapi.giftedtech.co.ke/api';

// Middleware
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return next();
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'berafix-secret-key-2024');
        req.user = await User.findById(decoded.userId).select('-password');
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
        
        if (!username || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields are required' 
            });
        }
        
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'User already exists' 
            });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({
            username,
            email,
            password: hashedPassword
        });
        
        await user.save();
        
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET || 'berafix-secret-key-2024',
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
        
        if (!username || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username and password are required' 
            });
        }
        
        const user = await User.findOne({ 
            $or: [{ email: username }, { username: username }] 
        });
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials' 
            });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET || 'berafix-secret-key-2024',
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
                preferences: user.preferences,
                watchlistCount: user.watchlist.length,
                historyCount: user.watchHistory.length
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
        user: req.user
    });
});

// Add to watch history
app.post('/api/user/history', authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        const { contentId, title, type, season, episode, position, duration, thumbnail } = req.body;
        
        if (!contentId || !title) {
            return res.status(400).json({ success: false, message: 'Content ID and title are required' });
        }
        
        const progress = duration ? Math.round((position / duration) * 100) : 0;
        
        // Remove existing entry if exists
        req.user.watchHistory = req.user.watchHistory.filter(
            item => !(item.contentId === contentId && 
                     item.season === (season || 0) && 
                     item.episode === (episode || 0))
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
            progress,
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
        return res.status(401).json({ success: false, message: 'Not authenticated' });
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
        
        if (!contentId || !title) {
            return res.status(400).json({ success: false, message: 'Content ID and title are required' });
        }
        
        if (action === 'add') {
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
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    res.json({
        success: true,
        watchlist: req.user.watchlist
    });
});

// Clear watch history
app.delete('/api/user/history', authenticateToken, async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    
    try {
        req.user.watchHistory = [];
        await req.user.save();
        
        res.json({ success: true, message: 'History cleared' });
    } catch (error) {
        console.error('Clear history error:', error);
        res.status(500).json({ success: false, message: 'Failed to clear history' });
    }
});

// ====================
// ENHANCED CONTENT ENDPOINTS
// ====================

// Enhanced search with caching and filters
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = '1', type, year, genre, sort = 'relevance' } = req.query;
        
        const cacheKey = `search_${query}_${page}_${type}_${year}_${genre}_${sort}`;
        const cached = cache.get(cacheKey);
        
        if (cached) {
            return res.json(cached);
        }
        
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
                rating: item.imdbRatingValue ? parseFloat(item.imdbRatingValue) : null,
                releaseDate: item.releaseDate,
                country: item.countryName,
                hasResource: item.hasResource,
                popularity: item.imdbRatingCount ? parseInt(item.imdbRatingCount) : 0
            }));
            
            // Apply filters
            if (type === 'movie') {
                items = items.filter(item => item.type === 'movie');
            } else if (type === 'tv') {
                items = items.filter(item => item.type === 'tv');
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
            
            // Apply sorting
            if (sort === 'rating') {
                items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            } else if (sort === 'year') {
                items.sort((a, b) => parseInt(b.year || 0) - parseInt(a.year || 0));
            } else if (sort === 'popularity') {
                items.sort((a, b) => b.popularity - a.popularity);
            }
            
            const result = {
                success: true,
                query: query,
                filters: { type, year, genre, sort },
                results: items,
                pagination: data.results.pager || {
                    page: parseInt(page),
                    totalPages: Math.ceil((data.results.pager?.totalCount || 0) / 24),
                    hasMore: data.results.pager?.hasMore || false,
                    totalResults: data.results.pager?.totalCount || items.length
                }
            };
            
            cache.set(cacheKey, result);
            res.json(result);
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

// Smart trending content (no more hardcoded Avengers)
app.get('/api/trending', async (req, res) => {
    try {
        const cacheKey = 'trending_content';
        const cached = cache.get(cacheKey);
        
        if (cached) {
            return res.json(cached);
        }
        
        // Smart trending queries based on current trends
        const trendingQueries = [
            '2024',
            'new',
            'popular',
            'netflix',
            'action',
            'comedy',
            'drama',
            'movie',
            'series'
        ];
        
        // Get random query for variety
        const randomQuery = trendingQueries[Math.floor(Math.random() * trendingQueries.length)];
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(randomQuery)}`);
        const data = await response.json();
        
        if (data.results && data.results.items) {
            // Sort by rating and filter quality content
            const items = data.results.items
                .filter(item => item.imdbRatingValue && parseFloat(item.imdbRatingValue) > 6.0)
                .sort((a, b) => parseFloat(b.imdbRatingValue) - parseFloat(a.imdbRatingValue))
                .slice(0, 20)
                .map(item => ({
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
                category: 'Trending Now',
                results: items,
                timestamp: Date.now()
            };
            
            cache.set(cacheKey, result, 300); // Cache for 5 minutes
            res.json(result);
        } else {
            res.json({ success: true, results: [] });
        }
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch trending content' });
    }
});

// Get content by genre/category
app.get('/api/category/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const { limit = 20 } = req.query;
        
        const cacheKey = `category_${category}_${limit}`;
        const cached = cache.get(cacheKey);
        
        if (cached) {
            return res.json(cached);
        }
        
        const categoryMap = {
            'action': ['action', 'adventure', 'thriller'],
            'comedy': ['comedy', 'romance'],
            'drama': ['drama', 'romance'],
            'horror': ['horror', 'thriller'],
            'scifi': ['sci-fi', 'fantasy'],
            'animation': ['animation', 'family'],
            'popular': ['2024', 'popular'],
            'new': ['2024', 'new']
        };
        
        const searchTerms = categoryMap[category] || [category];
        const randomTerm = searchTerms[Math.floor(Math.random() * searchTerms.length)];
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(randomTerm)}`);
        const data = await response.json();
        
        if (data.results && data.results.items) {
            const items = data.results.items.slice(0, limit).map(item => ({
                id: item.subjectId,
                title: item.title,
                year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
                type: item.subjectType === 1 ? 'movie' : 'tv',
                cover: item.cover?.url || item.thumbnail,
                poster: item.cover?.url || item.thumbnail,
                rating: item.imdbRatingValue,
                genre: item.genre ? item.genre.split(',').map(g => g.trim()) : []
            }));
            
            const result = {
                success: true,
                category: category.charAt(0).toUpperCase() + category.slice(1),
                results: items
            };
            
            cache.set(cacheKey, result, 600); // Cache for 10 minutes
            res.json(result);
        } else {
            res.json({ success: true, category: category, results: [] });
        }
    } catch (error) {
        console.error('Category error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch category content' });
    }
});

// Get multiple categories for Netflix-style homepage
app.get('/api/homepage', async (req, res) => {
    try {
        const cacheKey = 'homepage_data';
        const cached = cache.get(cacheKey);
        
        if (cached) {
            return res.json(cached);
        }
        
        const categories = [
            { id: 'trending', title: 'Trending Now', query: 'popular', icon: '🔥' },
            { id: 'action', title: 'Action & Adventure', query: 'action', icon: '💥' },
            { id: 'comedy', title: 'Comedies', query: 'comedy', icon: '😂' },
            { id: 'drama', title: 'Dramas', query: 'drama', icon: '🎭' },
            { id: 'scifi', title: 'Sci-Fi & Fantasy', query: 'sci-fi', icon: '🚀' },
            { id: 'new', title: 'New Releases', query: '2024', icon: '🆕' },
            { id: 'popular', title: 'Popular on BeraFix', query: 'movie', icon: '⭐' }
        ];
        
        const categoryPromises = categories.map(async (category) => {
            try {
                const response = await fetch(`${API_BASE}/search/${encodeURIComponent(category.query)}`);
                const data = await response.json();
                
                if (data.results && data.results.items) {
                    const items = data.results.items.slice(0, 12).map(item => ({
                        id: item.subjectId,
                        title: item.title,
                        type: item.subjectType === 1 ? 'movie' : 'tv',
                        cover: item.cover?.url || item.thumbnail,
                        backdrop: item.stills?.url || item.cover?.url,
                        rating: item.imdbRatingValue,
                        year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A'
                    }));
                    
                    return {
                        id: category.id,
                        title: category.title,
                        icon: category.icon,
                        items: items
                    };
                }
            } catch (err) {
                console.error(`Error fetching ${category.title}:`, err);
            }
            return {
                id: category.id,
                title: category.title,
                icon: category.icon,
                items: []
            };
        });
        
        const categoryResults = await Promise.all(categoryPromises);
        
        // Get featured/hero content (highest rated)
        const featuredRes = await fetch(`${API_BASE}/search/2024`);
        const featuredData = await featuredRes.json();
        
        let featuredContent = null;
        if (featuredData.results && featuredData.results.items.length > 0) {
            const featuredItems = featuredData.results.items
                .filter(item => item.imdbRatingValue && parseFloat(item.imdbRatingValue) > 7.0)
                .sort((a, b) => parseFloat(b.imdbRatingValue) - parseFloat(a.imdbRatingValue));
            
            if (featuredItems.length > 0) {
                featuredContent = {
                    id: featuredItems[0].subjectId,
                    title: featuredItems[0].title,
                    description: featuredItems[0].description,
                    backdrop: featuredItems[0].stills?.url || featuredItems[0].cover?.url,
                    rating: featuredItems[0].imdbRatingValue,
                    year: featuredItems[0].releaseDate ? featuredItems[0].releaseDate.split('-')[0] : 'N/A',
                    type: featuredItems[0].subjectType === 1 ? 'movie' : 'tv'
                };
            }
        }
        
        const result = {
            success: true,
            featured: featuredContent,
            categories: categoryResults.filter(cat => cat.items.length > 0),
            timestamp: Date.now()
        };
        
        cache.set(cacheKey, result, 300); // Cache for 5 minutes
        res.json(result);
    } catch (error) {
        console.error('Homepage error:', error);
        res.status(500).json({ success: false, error: 'Failed to load homepage' });
    }
});

// Get recommendations based on user history
app.get('/api/recommendations', authenticateToken, async (req, res) => {
    try {
        if (!req.user || req.user.watchHistory.length === 0) {
            // Return popular content for new users
            const response = await fetch(`${API_BASE}/search/popular`);
            const data = await response.json();
            
            if (data.results && data.results.items) {
                const items = data.results.items.slice(0, 12).map(item => ({
                    id: item.subjectId,
                    title: item.title,
                    type: item.subjectType === 1 ? 'movie' : 'tv',
                    cover: item.cover?.url || item.thumbnail,
                    rating: item.imdbRatingValue
                }));
                
                return res.json({ 
                    success: true, 
                    recommendations: items,
                    message: 'Based on popular content' 
                });
            }
        }
        
        // For users with history, recommend based on watched genres
        const userGenres = new Set();
        req.user.watchHistory.forEach(item => {
            // We could get genre from content info, but for now use popular
        });
        
        // For now, return trending content
        const response = await fetch(`${API_BASE}/search/2024`);
        const data = await response.json();
        
        if (data.results && data.results.items) {
            const items = data.results.items.slice(0, 12).map(item => ({
                id: item.subjectId,
                title: item.title,
                type: item.subjectType === 1 ? 'movie' : 'tv',
                cover: item.cover?.url || item.thumbnail,
                rating: item.imdbRatingValue
            }));
            
            res.json({ 
                success: true, 
                recommendations: items,
                message: 'Recommended for you' 
            });
        } else {
            res.json({ success: true, recommendations: [] });
        }
    } catch (error) {
        console.error('Recommendations error:', error);
        res.json({ success: true, recommendations: [] });
    }
});

// Original API endpoints (unchanged but enhanced)
app.get('/api/info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = `info_${id}`;
        const cached = cache.get(cacheKey);
        
        if (cached) {
            return res.json(cached);
        }
        
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
            
            const result = {
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
            };
            
            cache.set(cacheKey, result, 600); // Cache for 10 minutes
            res.json(result);
        } else {
            res.status(404).json({ success: false, error: 'Content not found' });
        }
    } catch (error) {
        console.error('Info error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch info' });
    }
});

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

// ====================
// ENHANCED FRONTEND
// ====================

app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>BeraFix | Premium Streaming</title>
        <meta name="description" content="Stream movies and TV series in stunning quality">
        
        <!-- PWA -->
        <link rel="manifest" href="/manifest.json">
        <meta name="theme-color" content="#0a0a1a">
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎬</text></svg>">
        
        <!-- Fonts & Icons -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Montserrat:wght@300;400;600;700&display=swap" rel="stylesheet">
        
        <style>
            :root {
                --primary-bg: #0a0a1a;
                --secondary-bg: #0f0f23;
                --card-bg: #141430;
                --accent-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                --accent-red: #e50914;
                --accent-blue: #667eea;
                --text-primary: #ffffff;
                --text-secondary: #b8c1ec;
            }
            
            * { margin: 0; padding: 0; box-sizing: border-box; }
            
            body {
                font-family: 'Poppins', sans-serif;
                background: var(--primary-bg);
                color: var(--text-primary);
                min-height: 100vh;
            }
            
            /* Loading Screen */
            #loading-screen {
                position: fixed; top: 0; left: 0;
                width: 100%; height: 100%;
                background: var(--primary-bg);
                display: flex; flex-direction: column;
                justify-content: center; align-items: center;
                z-index: 9999; transition: opacity 0.5s ease;
            }
            
            .logo { font-size: 4rem; font-weight: 700;
                background: var(--accent-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 2rem; }
            
            .loading-dots { display: flex; gap: 10px; }
            .dot { width: 15px; height: 15px; border-radius: 50%;
                background: #667eea; animation: bounce 1.4s infinite; }
            .dot:nth-child(1) { animation-delay: -0.32s; }
            .dot:nth-child(2) { animation-delay: -0.16s; }
            
            @keyframes bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
            
            /* Header */
            header {
                padding: 1.5rem 3rem;
                display: flex; justify-content: space-between;
                align-items: center;
                background: rgba(10, 10, 26, 0.95);
                backdrop-filter: blur(10px);
                position: sticky; top: 0; z-index: 100;
            }
            
            .site-logo {
                font-size: 1.8rem; font-weight: 700;
                background: var(--accent-gradient);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-decoration: none;
                display: flex; align-items: center; gap: 10px;
            }
            
            .search-container {
                flex: 1; max-width: 600px; margin: 0 2rem;
                position: relative;
            }
            
            #search-input {
                width: 100%; padding: 12px 45px 12px 20px;
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid transparent; border-radius: 25px;
                color: white; font-size: 1rem; outline: none;
                transition: all 0.3s ease;
            }
            
            #search-input:focus {
                border-color: var(--accent-blue);
                box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
            }
            
            #search-btn {
                position: absolute; right: 10px; top: 50%;
                transform: translateY(-50%); background: none;
                border: none; color: white; cursor: pointer;
            }
            
            /* Hero Section */
            .hero {
                height: 70vh; min-height: 500px;
                background: linear-gradient(to right, var(--primary-bg) 30%, transparent 70%),
                            var(--card-bg);
                display: flex; align-items: center;
                padding: 0 4rem; margin-bottom: 3rem;
                position: relative; overflow: hidden;
            }
            
            .hero-backdrop {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                object-fit: cover; z-index: -1; opacity: 0.4;
            }
            
            .hero-content { max-width: 600px; z-index: 2; }
            
            .hero-title {
                font-family: 'Montserrat', sans-serif;
                font-size: 3.5rem; font-weight: 800;
                margin-bottom: 1.5rem; line-height: 1.1;
            }
            
            .hero-description {
                font-size: 1.2rem; line-height: 1.6;
                color: var(--text-secondary);
                margin-bottom: 2rem;
            }
            
            .hero-actions {
                display: flex; gap: 1rem; margin-bottom: 2rem;
            }
            
            .hero-btn {
                padding: 15px 35px; border: none; border-radius: 5px;
                font-size: 1.1rem; font-weight: 600; cursor: pointer;
                display: flex; align-items: center; gap: 10px;
                transition: all 0.3s ease;
            }
            
            .play-btn { background: var(--accent-red); color: white; }
            .info-btn { background: rgba(255, 255, 255, 0.2); color: white; }
            
            .hero-btn:hover { transform: scale(1.05); }
            
            /* Content Rows */
            .content-section { padding: 2rem 3rem; }
            
            .section-header {
                display: flex; justify-content: space-between;
                align-items: center; margin-bottom: 1.5rem;
            }
            
            .section-title {
                font-size: 1.8rem; font-weight: 600;
                display: flex; align-items: center; gap: 10px;
            }
            
            .content-row {
                display: flex; overflow-x: auto; gap: 1rem;
                padding: 1rem 0; scrollbar-width: thin;
            }
            
            .content-row::-webkit-scrollbar { height: 6px; }
            .content-row::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
            .content-row::-webkit-scrollbar-thumb { background: var(--accent-gradient); }
            
            /* Content Cards */
            .content-card {
                flex: 0 0 auto; width: 220px;
                background: var(--card-bg); border-radius: 10px;
                overflow: hidden; cursor: pointer;
                transition: transform 0.3s ease; position: relative;
            }
            
            .content-card:hover { transform: scale(1.05); z-index: 10; }
            
            .card-image {
                width: 100%; height: 320px;
                object-fit: cover; transition: transform 0.3s ease;
            }
            
            .content-card:hover .card-image { transform: scale(1.1); }
            
            .card-overlay {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                background: linear-gradient(to top, rgba(0,0,0,0.9), transparent 50%);
                opacity: 0; transition: opacity 0.3s ease;
                display: flex; flex-direction: column;
                justify-content: flex-end; padding: 1.5rem;
            }
            
            .content-card:hover .card-overlay { opacity: 1; }
            
            .card-title { font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; }
            
            .card-meta {
                display: flex; justify-content: space-between;
                font-size: 0.9rem; color: var(--text-secondary);
            }
            
            /* Auth Modal */
            .auth-modal {
                display: none; position: fixed; top: 0; left: 0;
                width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); z-index: 1000;
                backdrop-filter: blur(5px);
            }
            
            .auth-content {
                position: absolute; top: 50%; left: 50%;
                transform: translate(-50%, -50%);
                background: var(--secondary-bg); border-radius: 15px;
                padding: 3rem; width: 90%; max-width: 400px;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                header { padding: 1rem; flex-direction: column; gap: 1rem; }
                .search-container { margin: 0; width: 100%; }
                .hero { padding: 0 2rem; height: 60vh; }
                .hero-title { font-size: 2.5rem; }
                .content-section { padding: 2rem 1rem; }
                .content-card { width: 180px; }
                .card-image { height: 250px; }
            }
            
            @media (max-width: 480px) {
                .hero-title { font-size: 2rem; }
                .hero-buttons { flex-direction: column; }
                .content-card { width: 150px; }
                .card-image { height: 200px; }
            }
        </style>
    </head>
    <body>
        <!-- Loading Screen -->
        <div id="loading-screen">
            <div class="logo">BeraFix</div>
            <div class="loading-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>

        <!-- Header -->
        <header>
            <a href="/" class="site-logo">
                <i class="fas fa-play-circle"></i> BeraFix
            </a>
            
            <div class="search-container">
                <input type="text" id="search-input" placeholder="Search movies and TV series...">
                <button id="search-btn">
                    <i class="fas fa-search"></i>
                </button>
            </div>
            
            <div id="user-actions">
                <button id="login-btn" style="padding: 8px 20px; background: #667eea; border: none; border-radius: 5px; color: white; cursor: pointer;">
                    Sign In
                </button>
            </div>
        </header>

        <!-- Hero Section -->
        <section class="hero" id="hero-section">
            <!-- Will be populated by JavaScript -->
        </section>

        <!-- Main Content -->
        <main id="main-content">
            <!-- Content rows will be loaded here -->
            <div id="content-rows"></div>
        </main>

        <!-- Auth Modal -->
        <div class="auth-modal" id="auth-modal">
            <div class="auth-content">
                <h2 style="margin-bottom: 2rem; text-align: center;">Welcome to BeraFix</h2>
                <div style="display: flex; gap: 1rem; margin-bottom: 2rem;">
                    <button id="show-login" style="flex: 1; padding: 12px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Sign In
                    </button>
                    <button id="show-register" style="flex: 1; padding: 12px; background: #764ba2; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Sign Up
                    </button>
                </div>
                
                <form id="login-form" style="display: none;">
                    <input type="text" id="login-username" placeholder="Username or Email" style="width: 100%; padding: 12px; margin-bottom: 1rem; border-radius: 5px; border: 1px solid #ccc;">
                    <input type="password" id="login-password" placeholder="Password" style="width: 100%; padding: 12px; margin-bottom: 1rem; border-radius: 5px; border: 1px solid #ccc;">
                    <button type="submit" style="width: 100%; padding: 12px; background: #e50914; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Sign In
                    </button>
                </form>
                
                <form id="register-form" style="display: none;">
                    <input type="text" id="register-username" placeholder="Username" style="width: 100%; padding: 12px; margin-bottom: 1rem; border-radius: 5px; border: 1px solid #ccc;">
                    <input type="email" id="register-email" placeholder="Email" style="width: 100%; padding: 12px; margin-bottom: 1rem; border-radius: 5px; border: 1px solid #ccc;">
                    <input type="password" id="register-password" placeholder="Password" style="width: 100%; padding: 12px; margin-bottom: 1rem; border-radius: 5px; border: 1px solid #ccc;">
                    <button type="submit" style="width: 100%; padding: 12px; background: #e50914; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Create Account
                    </button>
                </form>
                
                <button id="close-auth" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: white; font-size: 1.5rem; cursor: pointer;">
                    &times;
                </button>
            </div>
        </div>

        <script>
            // State management
            let currentUser = null;
            let authToken = localStorage.getItem('authToken');
            let homepageData = null;
            
            // DOM Elements
            const loadingScreen = document.getElementById('loading-screen');
            const heroSection = document.getElementById('hero-section');
            const contentRows = document.getElementById('content-rows');
            const searchInput = document.getElementById('search-input');
            const searchBtn = document.getElementById('search-btn');
            const userActions = document.getElementById('user-actions');
            const authModal = document.getElementById('auth-modal');
            const loginBtn = document.getElementById('login-btn');
            const closeAuth = document.getElementById('close-auth');
            const showLogin = document.getElementById('show-login');
            const showRegister = document.getElementById('show-register');
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');
            
            // Initialize
            document.addEventListener('DOMContentLoaded', async () => {
                // Hide loading screen
                setTimeout(() => {
                    loadingScreen.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreen.style.display = 'none';
                    }, 500);
                }, 1500);
                
                // Setup event listeners
                searchBtn.addEventListener('click', performSearch);
                searchInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') performSearch();
                });
                
                // Auth setup
                loginBtn.addEventListener('click', () => authModal.style.display = 'block');
                closeAuth.addEventListener('click', () => authModal.style.display = 'none');
                showLogin.addEventListener('click', () => {
                    loginForm.style.display = 'block';
                    registerForm.style.display = 'none';
                });
                showRegister.addEventListener('click', () => {
                    loginForm.style.display = 'none';
                    registerForm.style.display = 'block';
                });
                
                // Form submissions
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await loginUser();
                });
                
                registerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await registerUser();
                });
                
                // Load user if token exists
                if (authToken) {
                    await loadUserProfile();
                }
                
                // Load homepage content
                await loadHomepage();
            });
            
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
            
            // Update user UI
            function updateUserUI() {
                if (currentUser) {
                    userActions.innerHTML = \`
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <span>Welcome, <strong>\${currentUser.username}</strong></span>
                            <button onclick="logoutUser()" style="padding: 8px 20px; background: #e50914; border: none; border-radius: 5px; color: white; cursor: pointer;">
                                Logout
                            </button>
                        </div>
                    \`;
                }
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
                        
                        authModal.style.display = 'none';
                        updateUserUI();
                    } else {
                        alert(data.message || 'Login failed');
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    alert('Login failed. Please try again.');
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
                        
                        authModal.style.display = 'none';
                        updateUserUI();
                    } else {
                        alert(data.message || 'Registration failed');
                    }
                } catch (error) {
                    console.error('Registration error:', error);
                    alert('Registration failed. Please try again.');
                }
            }
            
            // Logout user
            function logoutUser() {
                localStorage.removeItem('authToken');
                authToken = null;
                currentUser = null;
                userActions.innerHTML = \`
                    <button id="login-btn" style="padding: 8px 20px; background: #667eea; border: none; border-radius: 5px; color: white; cursor: pointer;">
                        Sign In
                    </button>
                \`;
                
                // Re-attach event listener
                document.getElementById('login-btn').addEventListener('click', () => {
                    authModal.style.display = 'block';
                });
            }
            
            // Load homepage
            async function loadHomepage() {
                try {
                    const response = await fetch('/api/homepage');
                    const data = await response.json();
                    
                    if (data.success) {
                        homepageData = data;
                        
                        // Set hero section
                        if (data.featured) {
                            setHeroContent(data.featured);
                        }
                        
                        // Display categories
                        displayCategories(data.categories);
                    }
                } catch (error) {
                    console.error('Homepage error:', error);
                }
            }
            
            // Set hero content
            function setHeroContent(content) {
                heroSection.innerHTML = \`
                    <img src="\${content.backdrop || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}" 
                         class="hero-backdrop" 
                         alt="\${content.title}"
                         onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1'">
                    
                    <div class="hero-content">
                        <h1 class="hero-title">\${content.title}</h1>
                        <p class="hero-description">
                            \${content.description || 'Stream now on BeraFix in stunning quality.'}
                        </p>
                        <div class="hero-actions">
                            <button class="hero-btn play-btn" data-id="\${content.id}">
                                <i class="fas fa-play"></i> Play Now
                            </button>
                            <button class="hero-btn info-btn" data-id="\${content.id}">
                                <i class="fas fa-info-circle"></i> More Info
                            </button>
                        </div>
                    </div>
                \`;
            }
            
            // Display categories
            function displayCategories(categories) {
                let rowsHTML = '';
                
                categories.forEach(category => {
                    if (category.items && category.items.length > 0) {
                        rowsHTML += \`
                            <div class="content-section">
                                <div class="section-header">
                                    <h2 class="section-title">
                                        <span>\${category.icon}</span>
                                        \${category.title}
                                    </h2>
                                </div>
                                <div class="content-row">
                                    \${category.items.map(item => \`
                                        <div class="content-card" data-id="\${item.id}">
                                            <img src="\${item.cover || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}" 
                                                 class="card-image" 
                                                 alt="\${item.title}"
                                                 onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1'">
                                            <div class="card-overlay">
                                                <h3 class="card-title">\${item.title}</h3>
                                                <div class="card-meta">
                                                    <span>\${item.year || ''}</span>
                                                    <span>\${item.rating ? '⭐ ' + item.rating : ''}</span>
                                                </div>
                                            </div>
                                        </div>
                                    \`).join('')}
                                </div>
                            </div>
                        \`;
                    }
                });
                
                contentRows.innerHTML = rowsHTML;
            }
            
            // Search function
            function performSearch() {
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = \`/search.html?q=\${encodeURIComponent(query)}\`;
                }
            }
            
            // Global logout function
            window.logoutUser = logoutUser;
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
});

// Search page
app.get('/search.html', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Search - BeraFix</title>
        <style>
            body { background: #0a0a1a; color: white; font-family: 'Poppins', sans-serif; padding: 2rem; }
            .back-btn { margin-bottom: 2rem; padding: 10px 20px; background: #667eea; border: none; border-radius: 5px; color: white; cursor: pointer; }
            .search-results { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
            .result-card { background: #141430; border-radius: 10px; overflow: hidden; cursor: pointer; transition: transform 0.3s ease; }
            .result-card:hover { transform: scale(1.05); }
            .result-image { width: 100%; height: 280px; object-fit: cover; }
            .result-info { padding: 1rem; }
            .result-title { font-weight: 600; margin-bottom: 0.5rem; }
            .result-meta { display: flex; justify-content: space-between; font-size: 0.9rem; color: #8a8d9e; }
        </style>
    </head>
    <body>
        <button class="back-btn" onclick="window.history.back()">← Back</button>
        <h1>Search Results</h1>
        <div id="results" class="search-results"></div>
        
        <script>
            const params = new URLSearchParams(window.location.search);
            const query = params.get('q');
            
            if (query) {
                document.title = 'Search: ' + query + ' - BeraFix';
                document.querySelector('h1').textContent = 'Search Results: ' + query;
                
                fetch('/api/search/' + encodeURIComponent(query))
                    .then(res => res.json())
                    .then(data => {
                        if (data.success && data.results.length > 0) {
                            const resultsHTML = data.results.map(item => \`
                                <div class="result-card" data-id="\${item.id}" onclick="showDetails('\${item.id}')">
                                    <img src="\${item.cover || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'}" 
                                         class="result-image" 
                                         alt="\${item.title}"
                                         onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1'">
                                    <div class="result-info">
                                        <h3 class="result-title">\${item.title}</h3>
                                        <div class="result-meta">
                                            <span>\${item.year || 'N/A'}</span>
                                            <span>\${item.rating ? '⭐ ' + item.rating : ''}</span>
                                        </div>
                                    </div>
                                </div>
                            \`).join('');
                            
                            document.getElementById('results').innerHTML = resultsHTML;
                        } else {
                            document.getElementById('results').innerHTML = '<p>No results found.</p>';
                        }
                    });
            }
            
            function showDetails(id) {
                // You can implement a modal or redirect to details page
                console.log('Show details for:', id);
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
});

// Service Worker
app.get('/sw.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`
        const CACHE_NAME = 'berafix-v1';
        
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
        "name": "BeraFix",
        "short_name": "BeraFix",
        "description": "Premium movie and series streaming",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0a0a1a",
        "theme_color": "#667eea",
        "icons": []
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 BeraFix server running on port ${PORT}`);
    console.log(`📱 MongoDB connected`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});
