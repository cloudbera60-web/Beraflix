const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://ellyongiro8:QwXDXE6tyrGpUTNb@cluster0.tyxcmm9.mongodb.net/movie-streaming?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// MongoDB Models
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    profile: {
        name: String,
        avatar: String,
        preferredGenres: [String],
        language: { type: String, default: 'en' },
        maturityRating: { type: String, default: 'PG-13' }
    },
    watchHistory: [{
        contentId: String,
        title: String,
        poster: String,
        type: String,
        season: Number,
        episode: Number,
        progress: Number, // percentage
        duration: Number,
        lastWatched: { type: Date, default: Date.now },
        watchedAt: Date
    }],
    watchlist: [{
        contentId: String,
        title: String,
        poster: String,
        type: String,
        addedAt: { type: Date, default: Date.now }
    }],
    favorites: [{
        contentId: String,
        title: String,
        poster: String,
        type: String,
        addedAt: { type: Date, default: Date.now }
    }],
    downloadQueue: [{
        contentId: String,
        title: String,
        quality: String,
        status: { type: String, enum: ['pending', 'downloading', 'completed', 'failed'], default: 'pending' },
        progress: Number,
        addedAt: { type: Date, default: Date.now }
    }],
    preferences: {
        autoPlayNext: { type: Boolean, default: true },
        defaultQuality: { type: String, default: '720p' },
        subtitleLanguage: { type: String, default: 'en' },
        notificationEnabled: { type: Boolean, default: true }
    },
    devices: [{
        deviceId: String,
        deviceName: String,
        lastActive: Date,
        ipAddress: String
    }],
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date
});

const User = mongoose.model('User', userSchema);

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '30d';

// API Base URL
const API_BASE = 'https://movieapi.giftedtech.co.ke/api';

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Invalid token' });
    }
};

// Serve static files
app.use(express.static('public'));

// Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                error: 'User with this email or username already exists' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const user = new User({
            username,
            email,
            password: hashedPassword,
            profile: {
                name: username
            }
        });

        await user.save();

        // Generate JWT
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profile: user.profile
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profile: user.profile
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// User Profile Routes
app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            user: req.user
        });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { name, avatar, preferredGenres, language, maturityRating } = req.body;
        
        const updates = {};
        if (name) updates['profile.name'] = name;
        if (avatar) updates['profile.avatar'] = avatar;
        if (preferredGenres) updates['profile.preferredGenres'] = preferredGenres;
        if (language) updates['profile.language'] = language;
        if (maturityRating) updates['profile.maturityRating'] = maturityRating;

        const user = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updates },
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            user
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

// Watch History Routes
app.post('/api/user/watch-history', authenticateToken, async (req, res) => {
    try {
        const { contentId, title, poster, type, season, episode, progress, duration } = req.body;
        
        const user = await User.findById(req.user._id);
        
        // Remove existing entry for same content if exists
        user.watchHistory = user.watchHistory.filter(
            item => !(item.contentId === contentId && 
                     (type === 'movie' || (item.season === season && item.episode === episode)))
        );
        
        // Add new entry
        user.watchHistory.push({
            contentId,
            title,
            poster,
            type,
            season,
            episode,
            progress: Math.min(progress, 100),
            duration,
            lastWatched: new Date(),
            watchedAt: new Date()
        });
        
        // Keep only last 50 items
        if (user.watchHistory.length > 50) {
            user.watchHistory = user.watchHistory.slice(-50);
        }
        
        await user.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Watch history error:', error);
        res.status(500).json({ success: false, error: 'Failed to update watch history' });
    }
});

app.get('/api/user/watch-history', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('watchHistory');
        res.json({
            success: true,
            watchHistory: user.watchHistory.sort((a, b) => b.lastWatched - a.lastWatched)
        });
    } catch (error) {
        console.error('Get watch history error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch watch history' });
    }
});

// Watchlist Routes
app.post('/api/user/watchlist', authenticateToken, async (req, res) => {
    try {
        const { contentId, title, poster, type } = req.body;
        
        const user = await User.findById(req.user._id);
        
        // Check if already in watchlist
        const exists = user.watchlist.some(item => item.contentId === contentId);
        if (exists) {
            return res.json({ success: true, message: 'Already in watchlist' });
        }
        
        user.watchlist.push({
            contentId,
            title,
            poster,
            type,
            addedAt: new Date()
        });
        
        await user.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Watchlist error:', error);
        res.status(500).json({ success: false, error: 'Failed to add to watchlist' });
    }
});

app.delete('/api/user/watchlist/:contentId', authenticateToken, async (req, res) => {
    try {
        const { contentId } = req.params;
        
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { watchlist: { contentId } }
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Remove from watchlist error:', error);
        res.status(500).json({ success: false, error: 'Failed to remove from watchlist' });
    }
});

// Favorites Routes
app.post('/api/user/favorites', authenticateToken, async (req, res) => {
    try {
        const { contentId, title, poster, type } = req.body;
        
        const user = await User.findById(req.user._id);
        
        // Check if already in favorites
        const exists = user.favorites.some(item => item.contentId === contentId);
        if (exists) {
            return res.json({ success: true, message: 'Already in favorites' });
        }
        
        user.favorites.push({
            contentId,
            title,
            poster,
            type,
            addedAt: new Date()
        });
        
        await user.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Favorites error:', error);
        res.status(500).json({ success: false, error: 'Failed to add to favorites' });
    }
});

// Download Queue Routes
app.post('/api/user/downloads', authenticateToken, async (req, res) => {
    try {
        const { contentId, title, quality } = req.body;
        
        const user = await User.findById(req.user._id);
        
        // Check if already in queue
        const exists = user.downloadQueue.some(
            item => item.contentId === contentId && item.quality === quality && item.status !== 'completed'
        );
        
        if (exists) {
            return res.json({ success: true, message: 'Already in download queue' });
        }
        
        user.downloadQueue.push({
            contentId,
            title,
            quality,
            status: 'pending',
            progress: 0,
            addedAt: new Date()
        });
        
        await user.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Download queue error:', error);
        res.status(500).json({ success: false, error: 'Failed to add to download queue' });
    }
});

// Recommendations based on watch history
app.get('/api/user/recommendations', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const watchHistory = user.watchHistory;
        
        if (watchHistory.length === 0) {
            // Return trending content for new users
            const trendingQueries = [
                'movie', '2024', 'action', 'comedy', 'drama',
                'sci-fi', 'horror', 'romance', 'animation'
            ];
            const randomQuery = trendingQueries[Math.floor(Math.random() * trendingQueries.length)];
            
            const response = await fetch(`${API_BASE}/search/${encodeURIComponent(randomQuery)}`);
            const data = await response.json();
            
            const recommendations = data.results?.items?.slice(0, 10) || [];
            return res.json({ success: true, recommendations });
        }
        
        // Get most watched genres
        const genreCount = {};
        const contentIds = watchHistory.map(item => item.contentId);
        
        // For now, return content similar to recently watched
        const recentWatched = watchHistory.sort((a, b) => b.lastWatched - a.lastWatched)[0];
        
        // Search for similar content
        const response = await fetch(`${API_BASE}/info/${recentWatched.contentId}`);
        const data = await response.json();
        
        if (data.results?.subject?.genre) {
            const genres = data.results.subject.genre.split(',').map(g => g.trim());
            const randomGenre = genres[Math.floor(Math.random() * genres.length)];
            
            const searchResponse = await fetch(`${API_BASE}/search/${encodeURIComponent(randomGenre)}`);
            const searchData = await searchResponse.json();
            
            const recommendations = searchData.results?.items?.slice(0, 15) || [];
            return res.json({ success: true, recommendations });
        }
        
        res.json({ success: true, recommendations: [] });
    } catch (error) {
        console.error('Recommendations error:', error);
        res.json({ success: true, recommendations: [] });
    }
});

// Continue Watching
app.get('/api/user/continue-watching', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        // Get items with progress between 5% and 95%
        const continueWatching = user.watchHistory
            .filter(item => item.progress > 5 && item.progress < 95)
            .sort((a, b) => b.lastWatched - a.lastWatched)
            .slice(0, 10);
        
        res.json({
            success: true,
            continueWatching
        });
    } catch (error) {
        console.error('Continue watching error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch continue watching' });
    }
});

// Original API Proxy endpoints (enhanced with caching)
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 minute cache

// Enhanced search with trending algorithm
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = '1', genre } = req.query;
        
        // Check cache
        const cacheKey = `search_${query}_${page}_${genre || ''}`;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(query)}`);
        const data = await response.json();
        
        // Transform data to match our expected format
        if (data.results && data.results.items) {
            let items = data.results.items.map(item => ({
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
                popularity: item.viewCount || 0
            }));
            
            // Filter by genre if specified
            if (genre) {
                items = items.filter(item => 
                    item.genre.some(g => g.toLowerCase().includes(genre.toLowerCase()))
                );
            }
            
            const result = {
                success: true,
                results: items,
                pagination: data.results.pager || {
                    page: parseInt(page),
                    totalPages: Math.ceil((data.results.pager?.totalCount || 0) / 24),
                    hasMore: data.results.pager?.hasMore || false
                }
            };
            
            // Cache the result
            cache.set(cacheKey, result);
            
            res.json(result);
        } else {
            res.json({ success: true, results: [], pagination: { page: 1, totalPages: 1, hasMore: false } });
        }
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Smart trending endpoint
app.get('/api/trending', async (req, res) => {
    try {
        const { type = 'all' } = req.query;
        
        // Check cache
        const cacheKey = `trending_${type}`;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        // Smart trending queries based on type
        const trendingQueries = {
            all: ['movie', '2024', 'action', 'comedy', 'sci-fi'],
            movies: ['action movie 2024', 'comedy movie', 'drama movie'],
            tv: ['series 2024', 'tv show', 'netflix series']
        };
        
        const queries = trendingQueries[type] || trendingQueries.all;
        const randomQuery = queries[Math.floor(Math.random() * queries.length)];
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(randomQuery)}`);
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
                releaseDate: item.releaseDate
            })).slice(0, 20); // Limit to 20 items
            
            const result = {
                success: true,
                results: items
            };
            
            // Cache for 5 minutes
            cache.set(cacheKey, result, 300);
            
            res.json(result);
        } else {
            res.json({ success: true, results: [] });
        }
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch trending' });
    }
});

// Genres endpoint
app.get('/api/genres', async (req, res) => {
    try {
        const genres = [
            { id: 'action', name: 'Action', icon: 'fa-explosion' },
            { id: 'comedy', name: 'Comedy', icon: 'fa-face-laugh' },
            { id: 'drama', name: 'Drama', icon: 'fa-masks-theater' },
            { id: 'sci-fi', name: 'Sci-Fi', icon: 'fa-ufo' },
            { id: 'horror', name: 'Horror', icon: 'fa-ghost' },
            { id: 'romance', name: 'Romance', icon: 'fa-heart' },
            { id: 'animation', name: 'Animation', icon: 'fa-film' },
            { id: 'thriller', name: 'Thriller', icon: 'fa-user-secret' },
            { id: 'fantasy', name: 'Fantasy', icon: 'fa-wand-sparkles' },
            { id: 'adventure', name: 'Adventure', icon: 'fa-mountain' },
            { id: 'mystery', name: 'Mystery', icon: 'fa-magnifying-glass' },
            { id: 'crime', name: 'Crime', icon: 'fa-handcuffs' }
        ];
        
        res.json({ success: true, genres });
    } catch (error) {
        console.error('Genres error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch genres' });
    }
});

// Enhanced info endpoint with caching
app.get('/api/info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check cache
        const cacheKey = `info_${id}`;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
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
                                episode: i,
                                title: `Episode ${i}`,
                                description: '',
                                thumbnail: subject.thumbnail
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
                    hasResource: subject.hasResource,
                    similarContent: [] // Will be populated by recommendations
                }
            };
            
            // Cache for 1 hour
            cache.set(cacheKey, result, 3600);
            
            res.json(result);
        } else {
            res.status(404).json({ success: false, error: 'Content not found' });
        }
    } catch (error) {
        console.error('Info error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch info' });
    }
});

// Batch episodes endpoint for TV series
app.get('/api/series/:id/seasons/:season/episodes', async (req, res) => {
    try {
        const { id, season } = req.params;
        
        const response = await fetch(`${API_BASE}/info/${id}`);
        const data = await response.json();
        
        if (data.results?.subject && data.results.resource?.seasons) {
            const seasonData = data.results.resource.seasons.find(s => s.se == season);
            
            if (seasonData && seasonData.resolutions) {
                const maxEp = seasonData.maxEp || seasonData.resolutions[0]?.epNum || 1;
                const episodes = [];
                
                for (let i = 1; i <= maxEp; i++) {
                    episodes.push({
                        season: parseInt(season),
                        episode: i,
                        title: `Episode ${i}`,
                        thumbnail: data.results.subject.thumbnail
                    });
                }
                
                res.json({
                    success: true,
                    episodes
                });
            } else {
                res.json({ success: true, episodes: [] });
            }
        } else {
            res.json({ success: true, episodes: [] });
        }
    } catch (error) {
        console.error('Episodes error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch episodes' });
    }
});

// Batch download endpoint
app.post('/api/download/batch', authenticateToken, async (req, res) => {
    try {
        const { contentId, episodes, quality } = req.body;
        
        if (!Array.isArray(episodes) || episodes.length === 0) {
            return res.status(400).json({ success: false, error: 'No episodes specified' });
        }
        
        const user = await User.findById(req.user._id);
        
        // Add each episode to download queue
        for (const episode of episodes) {
            const exists = user.downloadQueue.some(
                item => item.contentId === contentId && 
                       item.quality === quality && 
                       item.status !== 'completed' &&
                       item.season === episode.season &&
                       item.episode === episode.episode
            );
            
            if (!exists) {
                user.downloadQueue.push({
                    contentId,
                    title: `${contentId} - S${episode.season}E${episode.episode}`,
                    quality,
                    season: episode.season,
                    episode: episode.episode,
                    status: 'pending',
                    progress: 0,
                    addedAt: new Date()
                });
            }
        }
        
        await user.save();
        
        res.json({ 
            success: true, 
            message: `Added ${episodes.length} episodes to download queue` 
        });
    } catch (error) {
        console.error('Batch download error:', error);
        res.status(500).json({ success: false, error: 'Failed to add batch download' });
    }
});

// Advanced search with filters
app.get('/api/advanced-search', async (req, res) => {
    try {
        const { query, genre, year, type, rating } = req.query;
        
        // Build search parameters
        let searchQuery = query || 'movie';
        if (genre) searchQuery += ` ${genre}`;
        if (year) searchQuery += ` ${year}`;
        
        const response = await fetch(`${API_BASE}/search/${encodeURIComponent(searchQuery)}`);
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
                genre: item.genre ? item.genre.split(',').map(g => g.trim()) : [],
                duration: item.duration,
                rating: item.imdbRatingValue,
                releaseDate: item.releaseDate
            }));
            
            // Apply filters
            if (type && type !== 'all') {
                items = items.filter(item => item.type === type);
            }
            
            if (rating) {
                const minRating = parseFloat(rating);
                items = items.filter(item => item.rating >= minRating);
            }
            
            res.json({
                success: true,
                results: items,
                filters: { query, genre, year, type, rating }
            });
        } else {
            res.json({ success: true, results: [] });
        }
    } catch (error) {
        console.error('Advanced search error:', error);
        res.status(500).json({ success: false, error: 'Advanced search failed' });
    }
});

// Sources endpoint (cached)
app.get('/api/sources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode } = req.query;
        
        // Check cache
        const cacheKey = `sources_${id}_${season || ''}_${episode || ''}`;
        const cachedData = cache.get(cacheKey);
        
        if (cachedData) {
            return res.json(cachedData);
        }
        
        let apiUrl = `${API_BASE}/sources/${id}`;
        if (season) apiUrl += `?season=${season}`;
        if (episode) apiUrl += `${season ? '&' : '?'}episode=${episode}`;
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.results && Array.isArray(data.results)) {
            const sources = data.results.map(source => ({
                id: source.id,
                quality: source.quality,
                download_url: source.download_url,
                size: source.size,
                format: source.format,
                resolution: source.resolution || source.quality
            }));
            
            const result = {
                success: true,
                sources
            };
            
            // Cache for 30 minutes
            cache.set(cacheKey, result, 1800);
            
            res.json(result);
        } else {
            res.json({ success: true, sources: [] });
        }
    } catch (error) {
        console.error('Sources error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch sources' });
    }
});

// Stream endpoint with quality selection
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
            // Fallback to highest quality
            const qualities = ['1080p', '720p', '480p', '360p'];
            const fallbackSource = qualities.reduce((found, q) => {
                return found || sourcesData.results.find(s => s.quality === q);
            }, null) || sourcesData.results[0];
            
            res.redirect(fallbackSource.download_url);
        } else {
            res.redirect(source.download_url);
        }
    } catch (error) {
        console.error('Stream error:', error);
        res.status(500).json({ error: 'Streaming failed' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Serve main HTML page with enhanced UI
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CLOUD.MOVIES - Professional Streaming Platform</title>
        <meta name="description" content="Professional movie and series streaming platform with Netflix-like experience">
        <meta name="author" content="Bruce Bera - Bera Tech">
        
        <!-- PWA Manifest -->
        <link rel="manifest" href="/manifest.json">
        <meta name="theme-color" content="#0a0a1a">
        
        <!-- Icons -->
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        
        <!-- Font Awesome -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        
        <!-- Styles -->
        <link rel="stylesheet" href="/css/style.css">
    </head>
    <body>
        <!-- Loading Screen -->
        <div id="loading-screen" class="loading-screen">
            <div class="logo-container">
                <div class="logo-text">CLOUD.MOVIES</div>
            </div>
            <div class="loading-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>
        </div>

        <!-- Auth Modal -->
        <div id="auth-modal" class="modal auth-modal">
            <div class="modal-content">
                <button class="close-modal" id="close-auth-modal">&times;</button>
                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="login">Login</button>
                    <button class="auth-tab" data-tab="register">Register</button>
                </div>
                <div class="auth-forms">
                    <form id="login-form" class="auth-form active">
                        <h3>Welcome Back</h3>
                        <div class="form-group">
                            <input type="email" id="login-email" placeholder="Email" required>
                        </div>
                        <div class="form-group">
                            <input type="password" id="login-password" placeholder="Password" required>
                        </div>
                        <button type="submit" class="btn-primary">Login</button>
                    </form>
                    <form id="register-form" class="auth-form">
                        <h3>Create Account</h3>
                        <div class="form-group">
                            <input type="text" id="register-username" placeholder="Username" required>
                        </div>
                        <div class="form-group">
                            <input type="email" id="register-email" placeholder="Email" required>
                        </div>
                        <div class="form-group">
                            <input type="password" id="register-password" placeholder="Password" required>
                        </div>
                        <button type="submit" class="btn-primary">Register</button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Header -->
        <header class="header">
            <div class="header-container">
                <a href="/" class="logo">
                    <i class="fas fa-film"></i>
                    <span>CLOUD.MOVIES</span>
                </a>
                
                <nav class="nav-menu">
                    <a href="/" class="nav-link active"><i class="fas fa-home"></i> Home</a>
                    <a href="#" class="nav-link"><i class="fas fa-fire"></i> Trending</a>
                    <a href="#" class="nav-link"><i class="fas fa-tv"></i> TV Series</a>
                    <a href="#" class="nav-link"><i class="fas fa-film"></i> Movies</a>
                    <a href="#" class="nav-link"><i class="fas fa-heart"></i> My List</a>
                </nav>
                
                <div class="header-actions">
                    <div class="search-container">
                        <input type="text" id="search-input" class="search-input" placeholder="Search movies, series...">
                        <button class="search-btn" id="search-btn"><i class="fas fa-search"></i></button>
                    </div>
                    
                    <div class="user-menu">
                        <button class="user-btn" id="user-btn">
                            <i class="fas fa-user"></i>
                            <span id="user-name">Profile</span>
                            <i class="fas fa-chevron-down"></i>
                        </button>
                        <div class="user-dropdown" id="user-dropdown">
                            <a href="#" class="dropdown-item" id="profile-link"><i class="fas fa-user-circle"></i> Profile</a>
                            <a href="#" class="dropdown-item" id="watchlist-link"><i class="fas fa-bookmark"></i> Watchlist</a>
                            <a href="#" class="dropdown-item" id="downloads-link"><i class="fas fa-download"></i> Downloads</a>
                            <div class="dropdown-divider"></div>
                            <a href="#" class="dropdown-item" id="logout-link"><i class="fas fa-sign-out-alt"></i> Logout</a>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main class="main-content">
            <!-- Hero Section -->
            <section class="hero-section">
                <div class="hero-background"></div>
                <div class="hero-content">
                    <h1 class="hero-title">Unlimited Movies, TV Shows, and More</h1>
                    <p class="hero-subtitle">Watch anywhere. Cancel anytime.</p>
                    <div class="hero-search">
                        <input type="text" id="hero-search" placeholder="Search for movies or TV series...">
                        <button class="btn-hero-search"><i class="fas fa-search"></i> Search</button>
                    </div>
                </div>
            </section>

            <!-- Content Sections -->
            <section class="content-sections">
                <!-- Continue Watching -->
                <div class="section-row" id="continue-watching-section">
                    <h2 class="section-title"><i class="fas fa-play-circle"></i> Continue Watching</h2>
                    <div class="content-row" id="continue-watching-row"></div>
                </div>

                <!-- Trending Now -->
                <div class="section-row" id="trending-section">
                    <h2 class="section-title"><i class="fas fa-fire"></i> Trending Now</h2>
                    <div class="content-row" id="trending-row"></div>
                </div>

                <!-- Genres -->
                <div class="section-row" id="genres-section">
                    <h2 class="section-title"><i class="fas fa-layer-group"></i> Browse by Genre</h2>
                    <div class="genres-grid" id="genres-grid"></div>
                </div>

                <!-- Popular Movies -->
                <div class="section-row" id="movies-section">
                    <h2 class="section-title"><i class="fas fa-film"></i> Popular Movies</h2>
                    <div class="content-row" id="movies-row"></div>
                </div>

                <!-- TV Series -->
                <div class="section-row" id="series-section">
                    <h2 class="section-title"><i class="fas fa-tv"></i> TV Series</h2>
                    <div class="content-row" id="series-row"></div>
                </div>

                <!-- Recommendations -->
                <div class="section-row" id="recommendations-section">
                    <h2 class="section-title"><i class="fas fa-star"></i> Recommended For You</h2>
                    <div class="content-row" id="recommendations-row"></div>
                </div>
            </section>
        </main>

        <!-- Detail Modal -->
        <div id="detail-modal" class="modal detail-modal">
            <div class="modal-content">
                <div class="modal-header">
                    <button class="close-modal" id="close-detail-modal">&times;</button>
                </div>
                <div class="modal-body" id="detail-modal-body"></div>
            </div>
        </div>

        <!-- Player Modal -->
        <div id="player-modal" class="modal player-modal">
            <div class="modal-content">
                <div class="player-header">
                    <button class="close-modal" id="close-player">&times;</button>
                    <div class="player-title" id="player-title"></div>
                </div>
                <div class="player-body">
                    <video id="video-player" controls crossorigin="anonymous">
                        Your browser does not support the video tag.
                    </video>
                    <div class="player-controls">
                        <div class="quality-selector">
                            <select id="quality-select">
                                <option value="360p">360p</option>
                                <option value="480p">480p</option>
                                <option value="720p" selected>720p</option>
                                <option value="1080p">1080p</option>
                            </select>
                        </div>
                        <div class="player-actions">
                            <button class="player-action-btn" id="download-btn">
                                <i class="fas fa-download"></i> Download
                            </button>
                            <button class="player-action-btn" id="add-to-list-btn">
                                <i class="fas fa-plus"></i> Add to List
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <footer class="footer">
            <div class="footer-content">
                <div class="footer-section">
                    <h3><i class="fas fa-film"></i> CLOUD.MOVIES</h3>
                    <p>Professional Streaming Platform</p>
                    <p class="footer-contact">
                        Developed by <strong>Bruce Bera</strong><br>
                        Contact: <a href="https://wa.me/254743983206" target="_blank">
                            <i class="fab fa-whatsapp"></i> +254 743 983 206
                        </a>
                    </p>
                </div>
                <div class="footer-section">
                    <h4>Quick Links</h4>
                    <a href="#">Home</a>
                    <a href="#">Trending</a>
                    <a href="#">Movies</a>
                    <a href="#">TV Series</a>
                </div>
                <div class="footer-section">
                    <h4>Legal</h4>
                    <a href="#">Privacy Policy</a>
                    <a href="#">Terms of Service</a>
                    <a href="#">Cookie Policy</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2024 CLOUD.MOVIES. All rights reserved. Powered by Gifted Movies API</p>
            </div>
        </footer>

        <!-- JavaScript -->
        <script src="/js/app.js"></script>
    </body>
    </html>
    `);
});

// Serve enhanced CSS
app.get('/css/style.css', (req, res) => {
    res.set('Content-Type', 'text/css');
    res.send(`
    /* Enhanced Netflix-like Styles */
    :root {
        --primary-bg: #0a0a1a;
        --secondary-bg: #141428;
        --accent-blue: #667eea;
        --accent-purple: #764ba2;
        --gradient-primary: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
        --text-primary: #ffffff;
        --text-secondary: #b3b3b3;
        --text-muted: #6c757d;
        --card-bg: rgba(20, 20, 40, 0.8);
        --card-hover-bg: rgba(30, 30, 50, 0.9);
        --overlay-bg: rgba(0, 0, 0, 0.75);
        --success: #28a745;
        --warning: #ffc107;
        --danger: #dc3545;
        --border-radius: 8px;
        --transition-speed: 0.3s;
    }

    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
        background: var(--primary-bg);
        color: var(--text-primary);
        min-height: 100vh;
        overflow-x: hidden;
    }

    /* Loading Screen */
    .loading-screen {
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
        position: relative;
        margin-bottom: 2rem;
    }

    .logo-text {
        font-size: 4rem;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 4px;
        background: var(--gradient-primary);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: glow 2s ease-in-out infinite alternate;
    }

    .loading-dots {
        display: flex;
        gap: 12px;
        margin-top: 30px;
    }

    .dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--accent-blue);
        animation: bounce 1.4s infinite ease-in-out both;
    }

    .dot:nth-child(1) { animation-delay: -0.32s; }
    .dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes glow {
        0% { filter: hue-rotate(0deg); }
        100% { filter: hue-rotate(360deg); }
    }

    @keyframes bounce {
        0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
        40% { transform: scale(1); opacity: 1; }
    }

    /* Header */
    .header {
        background: linear-gradient(180deg, rgba(10, 10, 26, 0.95) 0%, rgba(20, 20, 40, 0.9) 100%);
        backdrop-filter: blur(10px);
        padding: 1rem 0;
        position: sticky;
        top: 0;
        z-index: 1000;
        border-bottom: 1px solid rgba(102, 126, 234, 0.2);
    }

    .header-container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 2rem;
    }

    .logo {
        font-size: 1.8rem;
        font-weight: 900;
        color: var(--text-primary);
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all var(--transition-speed);
    }

    .logo:hover {
        color: var(--accent-blue);
    }

    .logo i {
        color: var(--accent-blue);
    }

    .nav-menu {
        display: flex;
        gap: 2rem;
        align-items: center;
    }

    .nav-link {
        color: var(--text-secondary);
        text-decoration: none;
        font-weight: 500;
        transition: all var(--transition-speed);
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .nav-link:hover,
    .nav-link.active {
        color: var(--text-primary);
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 1.5rem;
    }

    .search-container {
        position: relative;
        width: 300px;
    }

    .search-input {
        width: 100%;
        padding: 0.75rem 1rem;
        padding-right: 3rem;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: var(--border-radius);
        color: var(--text-primary);
        font-size: 0.9rem;
        transition: all var(--transition-speed);
    }

    .search-input:focus {
        outline: none;
        border-color: var(--accent-blue);
        background: rgba(255, 255, 255, 0.15);
    }

    .search-btn {
        position: absolute;
        right: 0.5rem;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 0.5rem;
        transition: color var(--transition-speed);
    }

    .search-btn:hover {
        color: var(--accent-blue);
    }

    .user-menu {
        position: relative;
    }

    .user-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: var(--border-radius);
        padding: 0.5rem 1rem;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        transition: all var(--transition-speed);
    }

    .user-btn:hover {
        background: rgba(255, 255, 255, 0.15);
    }

    .user-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        width: 200px;
        background: var(--secondary-bg);
        border-radius: var(--border-radius);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        display: none;
        z-index: 1001;
        overflow: hidden;
    }

    .user-menu:hover .user-dropdown {
        display: block;
    }

    .dropdown-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0.75rem 1rem;
        color: var(--text-primary);
        text-decoration: none;
        transition: background var(--transition-speed);
    }

    .dropdown-item:hover {
        background: rgba(255, 255, 255, 0.1);
    }

    .dropdown-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.1);
        margin: 0.5rem 0;
    }

    /* Hero Section */
    .hero-section {
        position: relative;
        height: 70vh;
        min-height: 500px;
        display: flex;
        align-items: center;
        overflow: hidden;
    }

    .hero-background {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(rgba(10, 10, 26, 0.7), rgba(10, 10, 26, 0.9)),
                    url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1925&q=80');
        background-size: cover;
        background-position: center;
        filter: blur(2px);
    }

    .hero-content {
        position: relative;
        z-index: 1;
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        text-align: center;
    }

    .hero-title {
        font-size: 3.5rem;
        font-weight: 900;
        margin-bottom: 1rem;
        background: var(--gradient-primary);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .hero-subtitle {
        font-size: 1.5rem;
        color: var(--text-secondary);
        margin-bottom: 2rem;
    }

    .hero-search {
        display: flex;
        gap: 1rem;
        max-width: 600px;
        margin: 0 auto;
    }

    .hero-search input {
        flex: 1;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.1);
        border: 2px solid rgba(102, 126, 234, 0.3);
        border-radius: var(--border-radius);
        color: var(--text-primary);
        font-size: 1rem;
    }

    .btn-hero-search {
        padding: 1rem 2rem;
        background: var(--gradient-primary);
        border: none;
        border-radius: var(--border-radius);
        color: var(--text-primary);
        font-weight: 600;
        cursor: pointer;
        transition: transform var(--transition-speed);
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .btn-hero-search:hover {
        transform: translateY(-2px);
    }

    /* Content Sections */
    .content-sections {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
    }

    .section-row {
        margin-bottom: 3rem;
    }

    .section-title {
        font-size: 1.5rem;
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .content-row {
        display: flex;
        gap: 1rem;
        overflow-x: auto;
        padding: 1rem 0;
        scrollbar-width: thin;
        scrollbar-color: var(--accent-blue) transparent;
    }

    .content-row::-webkit-scrollbar {
        height: 8px;
    }

    .content-row::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
    }

    .content-row::-webkit-scrollbar-thumb {
        background: var(--gradient-primary);
        border-radius: 4px;
    }

    .content-card {
        min-width: 220px;
        background: var(--card-bg);
        border-radius: var(--border-radius);
        overflow: hidden;
        transition: all var(--transition-speed);
        cursor: pointer;
        position: relative;
    }

    .content-card:hover {
        transform: translateY(-8px) scale(1.05);
        background: var(--card-hover-bg);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        z-index: 10;
    }

    .card-poster {
        width: 100%;
        height: 330px;
        object-fit: cover;
    }

    .card-info {
        padding: 1rem;
    }

    .card-title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.5rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .card-meta {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        color: var(--text-secondary);
    }

    .card-badge {
        position: absolute;
        top: 10px;
        left: 10px;
        background: var(--gradient-primary);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
    }

    /* Genres Grid */
    .genres-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;
    }

    .genre-card {
        background: var(--gradient-primary);
        padding: 2rem 1rem;
        border-radius: var(--border-radius);
        text-align: center;
        color: white;
        text-decoration: none;
        transition: transform var(--transition-speed);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }

    .genre-card:hover {
        transform: translateY(-5px);
    }

    .genre-card i {
        font-size: 2rem;
    }

    /* Modal */
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--overlay-bg);
        z-index: 2000;
        overflow-y: auto;
    }

    .modal-content {
        background: var(--secondary-bg);
        border-radius: var(--border-radius);
        max-width: 900px;
        margin: 2rem auto;
        position: relative;
        animation: modalSlideIn 0.3s ease;
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

    .close-modal {
        position: absolute;
        right: 1rem;
        top: 1rem;
        background: none;
        border: none;
        color: var(--text-primary);
        font-size: 2rem;
        cursor: pointer;
        z-index: 10;
    }

    .modal-header {
        padding: 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .modal-body {
        padding: 2rem;
    }

    /* Player Modal */
    .player-modal .modal-content {
        max-width: 1000px;
        background: #000;
    }

    .player-body {
        position: relative;
        padding-top: 56.25%; /* 16:9 Aspect Ratio */
    }

    #video-player {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: #000;
    }

    .player-controls {
        padding: 1rem;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .quality-selector select {
        background: var(--secondary-bg);
        color: var(--text-primary);
        border: 1px solid var(--accent-blue);
        padding: 0.5rem;
        border-radius: 4px;
    }

    .player-actions {
        display: flex;
        gap: 1rem;
    }

    .player-action-btn {
        background: var(--gradient-primary);
        border: none;
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    /* Auth Modal */
    .auth-modal .modal-content {
        max-width: 400px;
    }

    .auth-tabs {
        display: flex;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .auth-tab {
        flex: 1;
        padding: 1rem;
        background: none;
        border: none;
        color: var(--text-secondary);
        font-weight: 600;
        cursor: pointer;
        transition: all var(--transition-speed);
    }

    .auth-tab.active {
        color: var(--accent-blue);
        border-bottom: 2px solid var(--accent-blue);
    }

    .auth-forms {
        padding: 2rem;
    }

    .auth-form {
        display: none;
    }

    .auth-form.active {
        display: block;
    }

    .auth-form h3 {
        margin-bottom: 1.5rem;
        text-align: center;
    }

    .form-group {
        margin-bottom: 1rem;
    }

    .form-group input {
        width: 100%;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: var(--border-radius);
        color: var(--text-primary);
    }

    .btn-primary {
        width: 100%;
        padding: 0.75rem;
        background: var(--gradient-primary);
        border: none;
        border-radius: var(--border-radius);
        color: var(--text-primary);
        font-weight: 600;
        cursor: pointer;
        transition: transform var(--transition-speed);
    }

    .btn-primary:hover {
        transform: translateY(-2px);
    }

    /* Footer */
    .footer {
        background: var(--secondary-bg);
        padding: 3rem 2rem 1rem;
        margin-top: 4rem;
    }

    .footer-content {
        max-width: 1400px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 2rem;
        margin-bottom: 2rem;
    }

    .footer-section h3,
    .footer-section h4 {
        margin-bottom: 1rem;
        color: var(--accent-blue);
    }

    .footer-section a {
        display: block;
        color: var(--text-secondary);
        text-decoration: none;
        margin-bottom: 0.5rem;
        transition: color var(--transition-speed);
    }

    .footer-section a:hover {
        color: var(--accent-blue);
    }

    .footer-bottom {
        text-align: center;
        padding-top: 2rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        color: var(--text-muted);
    }

    /* Responsive Design */
    @media (max-width: 1024px) {
        .header-container {
            flex-wrap: wrap;
        }
        
        .nav-menu {
            order: 3;
            width: 100%;
            justify-content: center;
            margin-top: 1rem;
        }
        
        .hero-title {
            font-size: 2.5rem;
        }
        
        .content-card {
            min-width: 180px;
        }
    }

    @media (max-width: 768px) {
        .header-container {
            padding: 0 1rem;
        }
        
        .search-container {
            width: 200px;
        }
        
        .hero-section {
            height: 60vh;
        }
        
        .hero-title {
            font-size: 2rem;
        }
        
        .hero-search {
            flex-direction: column;
        }
        
        .content-sections {
            padding: 1rem;
        }
        
        .modal-content {
            margin: 1rem;
        }
    }

    @media (max-width: 480px) {
        .logo span {
            display: none;
        }
        
        .nav-menu {
            font-size: 0.9rem;
            gap: 1rem;
        }
        
        .search-container {
            width: 150px;
        }
        
        .hero-title {
            font-size: 1.75rem;
        }
        
        .content-card {
            min-width: 150px;
        }
        
        .genres-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    /* Utility Classes */
    .hidden {
        display: none !important;
    }

    .loading {
        opacity: 0.7;
        pointer-events: none;
    }

    .error {
        color: var(--danger);
        background: rgba(220, 53, 69, 0.1);
        padding: 1rem;
        border-radius: var(--border-radius);
        margin: 1rem 0;
    }

    .success {
        color: var(--success);
        background: rgba(40, 167, 69, 0.1);
        padding: 1rem;
        border-radius: var(--border-radius);
        margin: 1rem 0;
    }

    /* Hover Effects */
    .hover-lift {
        transition: transform var(--transition-speed);
    }

    .hover-lift:hover {
        transform: translateY(-4px);
    }

    /* Gradient Text */
    .gradient-text {
        background: var(--gradient-primary);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    /* Glass Effect */
    .glass {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    /* Custom Scrollbar */
    ::-webkit-scrollbar {
        width: 10px;
    }

    ::-webkit-scrollbar-track {
        background: var(--secondary-bg);
    }

    ::-webkit-scrollbar-thumb {
        background: var(--gradient-primary);
        border-radius: 5px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(135deg, var(--accent-purple), var(--accent-blue));
    }
    `);
});

// Serve JavaScript
app.get('/js/app.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`
    // Enhanced Application JavaScript
    class MovieStreamingApp {
        constructor() {
            this.apiBase = '/api';
            this.currentUser = null;
            this.token = localStorage.getItem('token');
            this.currentContent = [];
            this.selectedMovie = null;
            this.currentPage = 1;
            this.totalPages = 1;
            this.currentSearch = '';
            this.currentGenre = 'all';
            
            this.init();
        }

        async init() {
            // Initialize loading screen
            this.hideLoading();
            
            // Initialize event listeners
            this.initEventListeners();
            
            // Check authentication
            await this.checkAuth();
            
            // Load initial content
            await this.loadHomeContent();
            
            // Initialize PWA
            this.initPWA();
        }

        hideLoading() {
            setTimeout(() => {
                const loadingScreen = document.getElementById('loading-screen');
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                }, 500);
            }, 1500);
        }

        async checkAuth() {
            if (this.token) {
                try {
                    const response = await fetch(this.apiBase + '/user/profile', {
                        headers: { 'Authorization': 'Bearer ' + this.token }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        this.currentUser = data.user;
                        this.updateUserUI();
                    } else {
                        this.clearAuth();
                    }
                } catch (error) {
                    console.error('Auth check failed:', error);
                    this.clearAuth();
                }
            }
        }

        updateUserUI() {
            if (this.currentUser) {
                const userName = document.getElementById('user-name');
                if (userName) {
                    userName.textContent = this.currentUser.username;
                }
                // Show user-specific sections
                document.getElementById('continue-watching-section').classList.remove('hidden');
            } else {
                // Hide user-specific sections
                document.getElementById('continue-watching-section').classList.add('hidden');
            }
        }

        clearAuth() {
            localStorage.removeItem('token');
            this.token = null;
            this.currentUser = null;
            this.updateUserUI();
        }

        async loadHomeContent() {
            try {
                // Load trending content
                await this.loadTrending();
                
                // Load genres
                await this.loadGenres();
                
                // Load continue watching if logged in
                if (this.currentUser) {
                    await this.loadContinueWatching();
                }
                
                // Load recommendations
                await this.loadRecommendations();
                
                // Load movies and series
                await this.loadContentByType('movie', 'movies-row');
                await this.loadContentByType('tv', 'series-row');
            } catch (error) {
                console.error('Error loading home content:', error);
                this.showError('Failed to load content');
            }
        }

        async loadTrending() {
            const response = await fetch(this.apiBase + '/trending');
            const data = await response.json();
            
            if (data.success) {
                this.displayContentRow(data.results, 'trending-row');
            }
        }

        async loadGenres() {
            const response = await fetch(this.apiBase + '/genres');
            const data = await response.json();
            
            if (data.success) {
                const grid = document.getElementById('genres-grid');
                grid.innerHTML = data.genres.map(genre => \`
                    <a href="#" class="genre-card" data-genre="\${genre.id}">
                        <i class="fas \${genre.icon}"></i>
                        <span>\${genre.name}</span>
                    </a>
                \`).join('');
                
                // Add click listeners
                grid.querySelectorAll('.genre-card').forEach(card => {
                    card.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.filterByGenre(card.dataset.genre);
                    });
                });
            }
        }

        async loadContinueWatching() {
            const response = await fetch(this.apiBase + '/user/continue-watching', {
                headers: { 'Authorization': 'Bearer ' + this.token }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.continueWatching.length > 0) {
                    this.displayContinueWatching(data.continueWatching);
                }
            }
        }

        async loadRecommendations() {
            if (this.currentUser) {
                const response = await fetch(this.apiBase + '/user/recommendations', {
                    headers: { 'Authorization': 'Bearer ' + this.token }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        this.displayContentRow(data.recommendations, 'recommendations-row');
                    }
                }
            }
        }

        async loadContentByType(type, containerId) {
            const response = await fetch(\`\${this.apiBase}/search/\${type}\`);
            const data = await response.json();
            
            if (data.success) {
                this.displayContentRow(data.results, containerId);
            }
        }

        displayContentRow(items, containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            if (!items || items.length === 0) {
                container.innerHTML = '<div class="error">No content available</div>';
                return;
            }
            
            container.innerHTML = items.slice(0, 10).map(item => \`
                <div class="content-card" data-id="\${item.id}">
                    \${item.type === 'tv' ? '<span class="card-badge">TV</span>' : ''}
                    <img src="\${item.poster || item.cover || '/images/placeholder.jpg'}" 
                         alt="\${item.title}" 
                         class="card-poster"
                         onerror="this.src='/images/placeholder.jpg'">
                    <div class="card-info">
                        <h3 class="card-title" title="\${item.title}">\${item.title}</h3>
                        <div class="card-meta">
                            <span>\${item.year || 'N/A'}</span>
                            <span>\${item.rating ? '⭐ ' + item.rating : ''}</span>
                        </div>
                    </div>
                </div>
            \`).join('');
            
            // Add click listeners
            container.querySelectorAll('.content-card').forEach(card => {
                card.addEventListener('click', () => {
                    this.showDetails(card.dataset.id);
                });
            });
        }

        displayContinueWatching(items) {
            const container = document.getElementById('continue-watching-row');
            if (!container || items.length === 0) return;
            
            container.innerHTML = items.map(item => \`
                <div class="content-card" data-id="\${item.contentId}" 
                     data-season="\${item.season || ''}" 
                     data-episode="\${item.episode || ''}">
                    <div class="progress-bar" style="position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: rgba(255,255,255,0.3);">
                        <div style="width: \${item.progress || 0}%; height: 100%; background: var(--accent-blue);"></div>
                    </div>
                    <img src="\${item.poster || '/images/placeholder.jpg'}" 
                         alt="\${item.title}" 
                         class="card-poster">
                    <div class="card-info">
                        <h3 class="card-title">\${item.title}</h3>
                        <div class="card-meta">
                            <span>Continue watching</span>
                        </div>
                    </div>
                </div>
            \`).join('');
            
            // Add click listeners
            container.querySelectorAll('.content-card').forEach(card => {
                card.addEventListener('click', () => {
                    const contentId = card.dataset.id;
                    const season = card.dataset.season;
                    const episode = card.dataset.episode;
                    
                    this.showDetails(contentId, { season, episode });
                });
            });
        }

        async showDetails(contentId, options = {}) {
            try {
                const response = await fetch(\`\${this.apiBase}/info/\${contentId}\`);
                const data = await response.json();
                
                if (data.success) {
                    this.selectedMovie = data.data;
                    this.displayDetailsModal(options);
                } else {
                    this.showError('Failed to load details');
                }
            } catch (error) {
                console.error('Error loading details:', error);
                this.showError('Failed to load details');
            }
        }

        displayDetailsModal(options = {}) {
            const modal = document.getElementById('detail-modal');
            const body = document.getElementById('detail-modal-body');
            const movie = this.selectedMovie;
            
            const isTV = movie.type === 'tv';
            const hasEpisodes = movie.episodes && movie.episodes.length > 0;
            
            // Build episodes section for TV shows
            let episodesHtml = '';
            if (hasEpisodes) {
                const seasons = [...new Set(movie.episodes.map(ep => ep.season))];
                
                episodesHtml = \`
                    <div class="episodes-section">
                        <h3><i class="fas fa-tv"></i> Episodes</h3>
                        <div class="season-selector">
                            \${seasons.map(season => \`
                                <button class="season-btn" data-season="\${season}">Season \${season}</button>
                            \`).join('')}
                        </div>
                        <div id="episodes-list" class="episodes-list"></div>
                    </div>
                \`;
            }
            
            body.innerHTML = \`
                <div class="detail-header">
                    <img src="\${movie.poster || movie.cover || '/images/placeholder.jpg'}" 
                         alt="\${movie.title}" 
                         class="detail-poster">
                    <div class="detail-info">
                        <h2 class="detail-title">\${movie.title}</h2>
                        <div class="detail-meta">
                            \${movie.year ? \`<span>\${movie.year}</span>\` : ''}
                            \${movie.duration ? \`<span>\${Math.floor(movie.duration / 60)} min</span>\` : ''}
                            \${movie.rating ? \`<span>⭐ \${movie.rating}</span>\` : ''}
                            <span>\${isTV ? 'TV Series' : 'Movie'}</span>
                        </div>
                        <div class="detail-genres">
                            \${movie.genre ? movie.genre.map(g => \`<span class="genre-tag">\${g}</span>\`).join('') : ''}
                        </div>
                        <p class="detail-description">\${movie.description || 'No description available.'}</p>
                        
                        <div class="detail-actions">
                            <button class="btn-primary" id="play-btn">
                                <i class="fas fa-play"></i> Play
                            </button>
                            \${this.currentUser ? \`
                                <button class="btn-secondary" id="add-to-watchlist-btn">
                                    <i class="fas fa-bookmark"></i> Add to Watchlist
                                </button>
                                <button class="btn-secondary" id="add-to-favorites-btn">
                                    <i class="fas fa-heart"></i> Add to Favorites
                                </button>
                            \` : ''}
                        </div>
                    </div>
                </div>
                
                \${hasEpisodes ? episodesHtml : ''}
                
                \${movie.cast && movie.cast.length > 0 ? \`
                    <div class="cast-section">
                        <h3><i class="fas fa-users"></i> Cast</h3>
                        <div class="cast-grid">
                            \${movie.cast.slice(0, 6).map(person => \`
                                <div class="cast-card">
                                    <img src="\${person.avatar || '/images/avatar-placeholder.jpg'}" 
                                         alt="\${person.name}"
                                         class="cast-avatar">
                                    <div class="cast-info">
                                        <strong>\${person.name}</strong>
                                        <small>\${person.character || 'Actor'}</small>
                                    </div>
                                </div>
                            \`).join('')}
                        </div>
                    </div>
                \` : ''}
            \`;
            
            modal.style.display = 'block';
            
            // Add event listeners
            document.getElementById('play-btn').addEventListener('click', () => {
                this.playContent(options);
            });
            
            if (this.currentUser) {
                document.getElementById('add-to-watchlist-btn').addEventListener('click', () => {
                    this.addToWatchlist();
                });
                
                document.getElementById('add-to-favorites-btn').addEventListener('click', () => {
                    this.addToFavorites();
                });
            }
            
            // Setup episode selection for TV shows
            if (hasEpisodes) {
                this.setupEpisodeSelection(options);
            }
            
            // Close modal
            document.getElementById('close-detail-modal').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        async playContent(options = {}) {
            if (!this.selectedMovie) return;
            
            const quality = document.getElementById('quality-select').value;
            const season = options.season || null;
            const episode = options.episode || null;
            
            // Update watch history if logged in
            if (this.currentUser) {
                await this.updateWatchHistory(options);
            }
            
            // Build stream URL
            let streamUrl = \`\${this.apiBase}/stream/\${this.selectedMovie.id}?quality=\${quality}\`;
            if (season) streamUrl += \`&season=\${season}\`;
            if (episode) streamUrl += \`&episode=\${episode}\`;
            
            // Show player
            const playerModal = document.getElementById('player-modal');
            const videoPlayer = document.getElementById('video-player');
            const playerTitle = document.getElementById('player-title');
            
            playerTitle.textContent = this.selectedMovie.title;
            videoPlayer.src = streamUrl;
            
            playerModal.style.display = 'block';
            videoPlayer.play();
            
            // Setup player controls
            document.getElementById('close-player').addEventListener('click', () => {
                videoPlayer.pause();
                playerModal.style.display = 'none';
            });
            
            document.getElementById('download-btn').addEventListener('click', () => {
                this.downloadContent(quality, season, episode);
            });
            
            playerModal.addEventListener('click', (e) => {
                if (e.target === playerModal) {
                    videoPlayer.pause();
                    playerModal.style.display = 'none';
                }
            });
        }

        async updateWatchHistory(options = {}) {
            try {
                const response = await fetch(this.apiBase + '/user/watch-history', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contentId: this.selectedMovie.id,
                        title: this.selectedMovie.title,
                        poster: this.selectedMovie.poster,
                        type: this.selectedMovie.type,
                        season: options.season || null,
                        episode: options.episode || null,
                        progress: 0,
                        duration: this.selectedMovie.duration || 0
                    })
                });
            } catch (error) {
                console.error('Error updating watch history:', error);
            }
        }

        async downloadContent(quality, season = null, episode = null) {
            try {
                const response = await fetch(this.apiBase + '/user/downloads', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contentId: this.selectedMovie.id,
                        title: this.selectedMovie.title,
                        quality: quality
                    })
                });
                
                if (response.ok) {
                    this.showSuccess('Added to download queue');
                }
            } catch (error) {
                console.error('Error adding to download queue:', error);
                this.showError('Failed to add to download queue');
            }
        }

        async addToWatchlist() {
            if (!this.currentUser || !this.selectedMovie) return;
            
            try {
                const response = await fetch(this.apiBase + '/user/watchlist', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contentId: this.selectedMovie.id,
                        title: this.selectedMovie.title,
                        poster: this.selectedMovie.poster,
                        type: this.selectedMovie.type
                    })
                });
                
                if (response.ok) {
                    this.showSuccess('Added to watchlist');
                }
            } catch (error) {
                console.error('Error adding to watchlist:', error);
                this.showError('Failed to add to watchlist');
            }
        }

        async addToFavorites() {
            if (!this.currentUser || !this.selectedMovie) return;
            
            try {
                const response = await fetch(this.apiBase + '/user/favorites', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contentId: this.selectedMovie.id,
                        title: this.selectedMovie.title,
                        poster: this.selectedMovie.poster,
                        type: this.selectedMovie.type
                    })
                });
                
                if (response.ok) {
                    this.showSuccess('Added to favorites');
                }
            } catch (error) {
                console.error('Error adding to favorites:', error);
                this.showError('Failed to add to favorites');
            }
        }

        setupEpisodeSelection(options) {
            const seasonBtns = document.querySelectorAll('.season-btn');
            const episodesList = document.getElementById('episodes-list');
            
            seasonBtns.forEach(btn => {
                btn.addEventListener('click', async () => {
                    const season = btn.dataset.season;
                    
                    // Update active season
                    seasonBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    // Load episodes
                    const response = await fetch(\`\${this.apiBase}/series/\${this.selectedMovie.id}/seasons/\${season}/episodes\`);
                    const data = await response.json();
                    
                    if (data.success) {
                        episodesList.innerHTML = data.episodes.map(ep => \`
                            <div class="episode-card" data-season="\${season}" data-episode="\${ep.episode}">
                                <img src="\${ep.thumbnail || this.selectedMovie.poster}" 
                                     alt="\${ep.title}"
                                     class="episode-thumbnail">
                                <div class="episode-info">
                                    <h4>\${ep.title}</h4>
                                    <p>\${ep.description || ''}</p>
                                </div>
                                <button class="play-episode-btn" 
                                        data-season="\${season}" 
                                        data-episode="\${ep.episode}">
                                    <i class="fas fa-play"></i>
                                </button>
                            </div>
                        \`).join('');
                        
                        // Add click listeners to episode play buttons
                        episodesList.querySelectorAll('.play-episode-btn').forEach(btn => {
                            btn.addEventListener('click', (e) => {
                                e.stopPropagation();
                                const season = btn.dataset.season;
                                const episode = btn.dataset.episode;
                                this.playContent({ season, episode });
                            });
                        });
                    }
                });
            });
            
            // Select initial season if specified
            if (options.season) {
                const initialSeason = Array.from(seasonBtns).find(btn => btn.dataset.season === options.season);
                if (initialSeason) {
                    initialSeason.click();
                } else if (seasonBtns.length > 0) {
                    seasonBtns[0].click();
                }
            } else if (seasonBtns.length > 0) {
                seasonBtns[0].click();
            }
        }

        filterByGenre(genre) {
            this.currentGenre = genre;
            this.performSearch(genre);
        }

        async performSearch(query) {
            try {
                const response = await fetch(\`\${this.apiBase}/search/\${encodeURIComponent(query)}\`);
                const data = await response.json();
                
                if (data.success) {
                    this.currentContent = data.results;
                    // Display search results
                    // You can implement a dedicated search results page
                }
            } catch (error) {
                console.error('Search error:', error);
                this.showError('Search failed');
            }
        }

        showAuthModal() {
            const modal = document.getElementById('auth-modal');
            modal.style.display = 'block';
            
            // Setup tab switching
            const tabs = modal.querySelectorAll('.auth-tab');
            const forms = modal.querySelectorAll('.auth-form');
            
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    forms.forEach(f => f.classList.remove('active'));
                    
                    tab.classList.add('active');
                    modal.querySelector(\`#\${tab.dataset.tab}-form\`).classList.add('active');
                });
            });
            
            // Setup form submissions
            document.getElementById('login-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.login(
                    document.getElementById('login-email').value,
                    document.getElementById('login-password').value
                );
            });
            
            document.getElementById('register-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.register(
                    document.getElementById('register-username').value,
                    document.getElementById('register-email').value,
                    document.getElementById('register-password').value
                );
            });
            
            // Close modal
            document.getElementById('close-auth-modal').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }

        async login(email, password) {
            try {
                const response = await fetch(this.apiBase + '/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.token = data.token;
                    this.currentUser = data.user;
                    localStorage.setItem('token', this.token);
                    this.updateUserUI();
                    this.showSuccess('Login successful');
                    document.getElementById('auth-modal').style.display = 'none';
                    await this.loadHomeContent();
                } else {
                    this.showError(data.error || 'Login failed');
                }
            } catch (error) {
                console.error('Login error:', error);
                this.showError('Login failed');
            }
        }

        async register(username, email, password) {
            try {
                const response = await fetch(this.apiBase + '/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    this.showSuccess('Registration successful. Please login.');
                    // Switch to login tab
                    document.querySelector('.auth-tab[data-tab="login"]').click();
                } else {
                    this.showError(data.error || 'Registration failed');
                }
            } catch (error) {
                console.error('Registration error:', error);
                this.showError('Registration failed');
            }
        }

        async logout() {
            this.clearAuth();
            this.showSuccess('Logged out successfully');
            await this.loadHomeContent();
        }

        initEventListeners() {
            // Search functionality
            const searchInput = document.getElementById('search-input');
            const searchBtn = document.getElementById('search-btn');
            const heroSearch = document.getElementById('hero-search');
            const heroSearchBtn = document.querySelector('.btn-hero-search');
            
            const performSearch = (query) => {
                if (query.trim()) {
                    this.performSearch(query);
                }
            };
            
            searchBtn.addEventListener('click', () => performSearch(searchInput.value));
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performSearch(searchInput.value);
            });
            
            heroSearchBtn.addEventListener('click', () => performSearch(heroSearch.value));
            heroSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performSearch(heroSearch.value);
            });
            
            // User menu
            const logoutLink = document.getElementById('logout-link');
            if (logoutLink) {
                logoutLink.addEventListener('click', async (e) => {
                    e.preventDefault();
                    await this.logout();
                });
            }
            
            // Auth modal trigger
            const userBtn = document.getElementById('user-btn');
            if (userBtn) {
                userBtn.addEventListener('click', (e) => {
                    if (!this.currentUser) {
                        e.preventDefault();
                        this.showAuthModal();
                    }
                });
            }
        }

        initPWA() {
            // Service Worker Registration
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js')
                    .then(() => console.log('Service Worker registered'))
                    .catch(error => console.error('Service Worker registration failed:', error));
            }
            
            // Install Prompt
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredPrompt = e;
                
                // Show install prompt after delay
                setTimeout(() => {
                    this.showInstallPrompt();
                }, 10000);
            });
        }

        showInstallPrompt() {
            // You can implement an install prompt UI
            console.log('PWA install available');
        }

        showError(message) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            errorDiv.textContent = message;
            
            document.body.appendChild(errorDiv);
            
            setTimeout(() => {
                errorDiv.remove();
            }, 5000);
        }

        showSuccess(message) {
            const successDiv = document.createElement('div');
            successDiv.className = 'success';
            successDiv.textContent = message;
            
            document.body.appendChild(successDiv);
            
            setTimeout(() => {
                successDiv.remove();
            }, 5000);
        }
    }

    // Initialize the app when DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new MovieStreamingApp();
    });
    `);
});

// Enhanced Service Worker
app.get('/sw.js', (req, res) => {
    res.set('Content-Type', 'application/javascript');
    res.send(`
    const CACHE_NAME = 'cloud-movies-v2';
    const API_CACHE_NAME = 'cloud-movies-api-v1';
    
    // Assets to cache
    const ASSETS_TO_CACHE = [
        '/',
        '/css/style.css',
        '/js/app.js',
        '/images/placeholder.jpg',
        '/images/avatar-placeholder.jpg',
        '/manifest.json'
    ];
    
    // Install event
    self.addEventListener('install', event => {
        event.waitUntil(
            caches.open(CACHE_NAME)
                .then(cache => {
                    console.log('Caching assets');
                    return cache.addAll(ASSETS_TO_CACHE);
                })
                .then(() => self.skipWaiting())
        );
    });
    
    // Activate event
    self.addEventListener('activate', event => {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }).then(() => self.clients.claim())
        );
    });
    
    // Fetch event with strategic caching
    self.addEventListener('fetch', event => {
        const url = new URL(event.request.url);
        
        // Skip non-GET requests
        if (event.request.method !== 'GET') return;
        
        // Handle API requests with cache-first strategy
        if (url.pathname.startsWith('/api/')) {
            event.respondWith(
                caches.open(API_CACHE_NAME).then(cache => {
                    return cache.match(event.request).then(response => {
                        // Return cached API response if available and fresh
                        if (response) {
                            // Check if cache is stale (older than 5 minutes for trending, 30 minutes for others)
                            const cacheTime = parseInt(response.headers.get('sw-cache-time') || '0');
                            const isTrending = url.pathname.includes('/trending');
                            const cacheAge = Date.now() - cacheTime;
                            const maxAge = isTrending ? 5 * 60 * 1000 : 30 * 60 * 1000;
                            
                            if (cacheAge < maxAge) {
                                return response;
                            }
                        }
                        
                        // Fetch from network
                        return fetch(event.request).then(networkResponse => {
                            // Clone the response to cache it
                            const responseToCache = networkResponse.clone();
                            
                            // Add cache timestamp header
                            const headers = new Headers(responseToCache.headers);
                            headers.append('sw-cache-time', Date.now().toString());
                            
                            const cachedResponse = new Response(responseToCache.body, {
                                status: responseToCache.status,
                                statusText: responseToCache.statusText,
                                headers: headers
                            });
                            
                            // Cache the response
                            cache.put(event.request, cachedResponse);
                            
                            return networkResponse;
                        }).catch(() => {
                            // If network fails and we have a cached response, return it
                            if (response) {
                                return response;
                            }
                            
                            // Return offline response for API
                            return new Response(
                                JSON.stringify({ success: false, error: 'You are offline' }),
                                { headers: { 'Content-Type': 'application/json' } }
                            );
                        });
                    });
                })
            );
        } else {
            // Handle static assets with cache-first, network fallback strategy
            event.respondWith(
                caches.match(event.request).then(response => {
                    return response || fetch(event.request).then(networkResponse => {
                        // Don't cache non-successful responses
                        if (!networkResponse || networkResponse.status !== 200) {
                            return networkResponse;
                        }
                        
                        // Cache static assets
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                        
                        return networkResponse;
                    }).catch(() => {
                        // Return offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/');
                        }
                        
                        // Return placeholder for images
                        if (event.request.destination === 'image') {
                            return caches.match('/images/placeholder.jpg');
                        }
                        
                        return new Response('You are offline', { 
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
                })
            );
        }
    });
    
    // Background sync for watch history updates
    self.addEventListener('sync', event => {
        if (event.tag === 'sync-watch-history') {
            event.waitUntil(syncWatchHistory());
        }
    });
    
    async function syncWatchHistory() {
        // Implement background sync for watch history
        // This would sync pending watch history updates when online
    }
    
    // Push notifications
    self.addEventListener('push', event => {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/images/icon-192x192.png',
            badge: '/images/badge-72x72.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                primaryKey: 1
            },
            actions: [
                {
                    action: 'explore',
                    title: 'Explore',
                    icon: '/images/checkmark.png'
                },
                {
                    action: 'close',
                    title: 'Close',
                    icon: '/images/xmark.png'
                }
            ]
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
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
    `);
});

// Enhanced Manifest
app.get('/manifest.json', (req, res) => {
    res.json({
        "name": "CLOUD.MOVIES",
        "short_name": "CloudMovies",
        "description": "Professional movie and series streaming platform",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0a0a1a",
        "theme_color": "#667eea",
        "orientation": "portrait",
        "categories": ["entertainment", "movies", "video"],
        "icons": [
            {
                "src": "/images/icon-72x72.png",
                "sizes": "72x72",
                "type": "image/png"
            },
            {
                "src": "/images/icon-96x96.png",
                "sizes": "96x96",
                "type": "image/png"
            },
            {
                "src": "/images/icon-128x128.png",
                "sizes": "128x128",
                "type": "image/png"
            },
            {
                "src": "/images/icon-144x144.png",
                "sizes": "144x144",
                "type": "image/png"
            },
            {
                "src": "/images/icon-152x152.png",
                "sizes": "152x152",
                "type": "image/png"
            },
            {
                "src": "/images/icon-192x192.png",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any maskable"
            },
            {
                "src": "/images/icon-384x384.png",
                "sizes": "384x384",
                "type": "image/png"
            },
            {
                "src": "/images/icon-512x512.png",
                "sizes": "512x512",
                "type": "image/png"
            }
        ],
        "shortcuts": [
            {
                "name": "Continue Watching",
                "short_name": "Continue",
                "description": "Pick up where you left off",
                "url": "/?continue",
                "icons": [{ "src": "/images/shortcut-continue.png", "sizes": "96x96" }]
            },
            {
                "name": "Trending Now",
                "short_name": "Trending",
                "description": "See what's popular",
                "url": "/?trending",
                "icons": [{ "src": "/images/shortcut-trending.png", "sizes": "96x96" }]
            },
            {
                "name": "My Watchlist",
                "short_name": "Watchlist",
                "description": "Your saved content",
                "url": "/?watchlist",
                "icons": [{ "src": "/images/shortcut-watchlist.png", "sizes": "96x96" }]
            }
        ],
        "screenshots": [
            {
                "src": "/images/screenshot-desktop.png",
                "sizes": "1280x720",
                "type": "image/png",
                "form_factor": "wide",
                "label": "CLOUD.MOVIES Desktop View"
            },
            {
                "src": "/images/screenshot-mobile.png",
                "sizes": "750x1334",
                "type": "image/png",
                "form_factor": "narrow",
                "label": "CLOUD.MOVIES Mobile View"
            }
        ],
        "related_applications": [],
        "prefer_related_applications": false
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 CLOUD.MOVIES Professional Streaming Platform`);
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🔗 MongoDB: Connected`);
    console.log(`👤 User features: Authentication, Watch History, Watchlist, Profiles`);
    console.log(`🎥 Enhanced: Smart Discovery, TV Series, Batch Downloads, PWA`);
    console.log(`💻 Developed by Bruce Bera - Bera Tech`);
    console.log(`📞 Contact: wa.me/254743983206`);
    console.log(`🌐 Open http://localhost:${PORT} in your browser`);
});
