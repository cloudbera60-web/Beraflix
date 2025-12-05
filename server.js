const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://ellyongiro8:QwXDXE6tyrGpUTNb@cluster0.tyxcmm9.mongodb.net/cloud-movies?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// API Configuration
const API_BASE = 'https://movieapi.giftedtech.co.ke/api';

// Cache Configuration
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// MongoDB Models
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    profile: {
        name: String,
        avatar: { type: String, default: '/images/default-avatar.png' },
        preferredGenres: [String],
        language: { type: String, default: 'en' },
        maturityRating: { type: String, default: 'PG-13' },
        theme: { type: String, default: 'dark' }
    },
    watchHistory: [{
        contentId: String,
        title: String,
        poster: String,
        type: String,
        season: Number,
        episode: Number,
        progress: Number,
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
        season: Number,
        episode: Number,
        status: { type: String, enum: ['pending', 'downloading', 'completed', 'failed'], default: 'pending' },
        progress: Number,
        addedAt: { type: Date, default: Date.now }
    }],
    preferences: {
        autoPlayNext: { type: Boolean, default: true },
        defaultQuality: { type: String, default: '720p' },
        subtitleLanguage: { type: String, default: 'en' },
        autoplayTrailers: { type: Boolean, default: false },
        videoPlayer: { type: String, default: 'html5' }
    },
    createdAt: { type: Date, default: Date.now },
    lastLogin: Date,
    isActive: { type: Boolean, default: true }
});

const User = mongoose.model('User', userSchema);

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'cloud-movies-secret-2024';
const JWT_EXPIRES_IN = '30d';

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https://*", "http://*"],
            mediaSrc: ["'self'", "https://*", "http://*"],
            connectSrc: ["'self'", "https://movieapi.giftedtech.co.ke"]
        }
    }
}));
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        
        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
};

// Serve static files
app.use(express.static('public'));

// API Routes

// Authentication
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ email: email.toLowerCase() }, { username }] 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                error: 'User with this email or username already exists' 
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = new User({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
            profile: { name: username }
        });

        await user.save();

        // Generate JWT
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
        });

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
        const user = await User.findOne({ email: email.toLowerCase() });
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

        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

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

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
});

// User Profile
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

// Gifted Movies API Integration
app.get('/api/search/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const { page = 1 } = req.query;
        
        // Check cache
        const cacheKey = `search_${query}_${page}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const response = await axios.get(`${API_BASE}/search/${encodeURIComponent(query)}`);
        const apiData = response.data;

        if (apiData.success === "true" && apiData.results?.items) {
            const items = apiData.results.items.map(item => ({
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
                hasResource: item.hasResource,
                country: item.countryName,
                isNew: Date.now() - new Date(item.releaseDate).getTime() < 30 * 24 * 60 * 60 * 1000 // Within 30 days
            }));

            const result = {
                success: true,
                results: items,
                pagination: apiData.results.pager || {
                    page: parseInt(page),
                    totalPages: Math.ceil((apiData.results.pager?.totalCount || 0) / 24),
                    hasMore: apiData.results.pager?.hasMore || false
                }
            };

            // Cache for 5 minutes
            cache.set(cacheKey, result, 300);
            res.json(result);
        } else {
            res.json({ success: true, results: [], pagination: { page: 1, totalPages: 1, hasMore: false } });
        }
    } catch (error) {
        console.error('Search API error:', error.message);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Get movie/TV series info
app.get('/api/info/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Check cache
        const cacheKey = `info_${id}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        const response = await axios.get(`${API_BASE}/info/${id}`);
        const apiData = response.data;

        if (apiData.success === "true" && apiData.results?.subject) {
            const subject = apiData.results.subject;
            const stars = apiData.results.stars || [];
            const resource = apiData.results.resource || {};

            // Extract seasons and episodes for TV series
            let seasons = [];
            let episodes = [];
            
            if (resource.seasons && Array.isArray(resource.seasons)) {
                seasons = resource.seasons.map(season => ({
                    season: season.se,
                    maxEpisodes: season.maxEp || 0,
                    resolutions: season.resolutions || []
                }));

                // Generate episode list
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
                    seasons: seasons,
                    episodes: episodes,
                    hasResource: subject.hasResource,
                    subtitles: subject.subtitles ? subject.subtitles.split(',') : []
                }
            };

            // Cache for 10 minutes
            cache.set(cacheKey, result, 600);
            res.json(result);
        } else {
            res.status(404).json({ success: false, error: 'Content not found' });
        }
    } catch (error) {
        console.error('Info API error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch info' });
    }
});

// Get download sources
app.get('/api/sources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode } = req.query;
        
        // Check cache
        const cacheKey = `sources_${id}_${season || ''}_${episode || ''}`;
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        let url = `${API_BASE}/sources/${id}`;
        if (season) url += `?season=${season}`;
        if (episode) url += `${season ? '&' : '?'}episode=${episode}`;

        const response = await axios.get(url);
        const apiData = response.data;

        if (apiData.success === "true" && Array.isArray(apiData.results)) {
            const sources = apiData.results.map(source => ({
                id: source.id,
                quality: source.quality,
                download_url: source.download_url,
                stream_url: source.download_url.replace('/download/', '/stream/'),
                size: source.size,
                format: source.format
            }));

            const result = {
                success: true,
                sources: sources
            };

            // Cache for 5 minutes
            cache.set(cacheKey, result, 300);
            res.json(result);
        } else {
            res.json({ success: true, sources: [] });
        }
    } catch (error) {
        console.error('Sources API error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch sources' });
    }
});

// Stream endpoint
app.get('/api/stream/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { season, episode, quality = '720p' } = req.query;

        let url = `${API_BASE}/sources/${id}`;
        if (season) url += `?season=${season}`;
        if (episode) url += `${season ? '&' : '?'}episode=${episode}`;

        const response = await axios.get(url);
        const apiData = response.data;

        if (apiData.success === "true" && Array.isArray(apiData.results)) {
            // Find requested quality or fallback
            let source = apiData.results.find(s => s.quality === quality);
            if (!source) {
                // Fallback to highest quality
                const qualities = ['1080p', '720p', '480p', '360p'];
                for (const q of qualities) {
                    source = apiData.results.find(s => s.quality === q);
                    if (source) break;
                }
                source = source || apiData.results[0];
            }

            if (source && source.download_url) {
                res.redirect(source.download_url);
            } else {
                res.status(404).json({ error: 'No stream available' });
            }
        } else {
            res.status(404).json({ error: 'No sources available' });
        }
    } catch (error) {
        console.error('Stream error:', error.message);
        res.status(500).json({ error: 'Streaming failed' });
    }
});

// Get TV series seasons and episodes
app.get('/api/tv/:id/seasons', async (req, res) => {
    try {
        const { id } = req.params;
        
        const response = await axios.get(`${API_BASE}/info/${id}`);
        const apiData = response.data;

        if (apiData.success === "true" && apiData.results?.resource?.seasons) {
            const seasons = apiData.results.resource.seasons.map(season => ({
                season: season.se,
                episodeCount: season.maxEp || season.resolutions?.[0]?.epNum || 0,
                resolutions: season.resolutions || []
            }));

            res.json({ success: true, seasons });
        } else {
            res.json({ success: true, seasons: [] });
        }
    } catch (error) {
        console.error('Seasons API error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch seasons' });
    }
});

// Get episodes for a specific season
app.get('/api/tv/:id/season/:seasonNumber/episodes', async (req, res) => {
    try {
        const { id, seasonNumber } = req.params;
        
        const response = await axios.get(`${API_BASE}/info/${id}`);
        const apiData = response.data;

        if (apiData.success === "true" && apiData.results?.resource?.seasons) {
            const season = apiData.results.resource.seasons.find(s => s.se == seasonNumber);
            
            if (season && season.resolutions) {
                const maxEp = season.maxEp || season.resolutions[0]?.epNum || 1;
                const episodes = [];
                
                for (let i = 1; i <= maxEp; i++) {
                    episodes.push({
                        season: parseInt(seasonNumber),
                        episode: i,
                        title: `Episode ${i}`,
                        thumbnail: apiData.results.subject.thumbnail
                    });
                }
                
                res.json({ success: true, episodes });
            } else {
                res.json({ success: true, episodes: [] });
            }
        } else {
            res.json({ success: true, episodes: [] });
        }
    } catch (error) {
        console.error('Episodes API error:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch episodes' });
    }
});

// Trending content
app.get('/api/trending', async (req, res) => {
    try {
        const cacheKey = 'trending_content';
        const cached = cache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }

        // Multiple trending queries for variety
        const trendingQueries = [
            '2024', 'action', 'comedy', 'drama', 'sci-fi', 
            'horror', 'animation', 'marvel', 'netflix', 'series'
        ];
        
        const randomQuery = trendingQueries[Math.floor(Math.random() * trendingQueries.length)];
        const response = await axios.get(`${API_BASE}/search/${randomQuery}`);
        const apiData = response.data;

        if (apiData.success === "true" && apiData.results?.items) {
            const items = apiData.results.items.slice(0, 20).map(item => ({
                id: item.subjectId,
                title: item.title,
                year: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
                type: item.subjectType === 1 ? 'movie' : 'tv',
                poster: item.cover?.url || item.thumbnail,
                rating: item.imdbRatingValue,
                genre: item.genre ? item.genre.split(',').map(g => g.trim()) : []
            }));

            const result = { success: true, results: items };
            cache.set(cacheKey, result, 300); // 5 minutes cache
            res.json(result);
        } else {
            res.json({ success: true, results: [] });
        }
    } catch (error) {
        console.error('Trending API error:', error.message);
        res.json({ success: true, results: [] });
    }
});

// User watch history
app.post('/api/user/history', authenticateToken, async (req, res) => {
    try {
        const { contentId, title, poster, type, season, episode, progress, duration } = req.body;
        
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { watchHistory: { contentId, season, episode } }
        });

        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                watchHistory: {
                    contentId,
                    title,
                    poster,
                    type,
                    season: season || null,
                    episode: episode || null,
                    progress: Math.min(progress, 95),
                    duration,
                    lastWatched: new Date()
                }
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ success: false, error: 'Failed to update history' });
    }
});

app.get('/api/user/history', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const history = user.watchHistory.sort((a, b) => b.lastWatched - a.lastWatched);
        res.json({ success: true, history });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
});

// Continue watching
app.get('/api/user/continue-watching', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const continueWatching = user.watchHistory
            .filter(item => item.progress > 5 && item.progress < 95)
            .sort((a, b) => b.lastWatched - a.lastWatched)
            .slice(0, 10);
        
        res.json({ success: true, continueWatching });
    } catch (error) {
        console.error('Continue watching error:', error);
        res.json({ success: true, continueWatching: [] });
    }
});

// Watchlist
app.post('/api/user/watchlist', authenticateToken, async (req, res) => {
    try {
        const { contentId, title, poster, type } = req.body;
        
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: {
                watchlist: {
                    contentId,
                    title,
                    poster,
                    type,
                    addedAt: new Date()
                }
            }
        });

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

// Favorites
app.post('/api/user/favorites', authenticateToken, async (req, res) => {
    try {
        const { contentId, title, poster, type } = req.body;
        
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: {
                favorites: {
                    contentId,
                    title,
                    poster,
                    type,
                    addedAt: new Date()
                }
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Favorites error:', error);
        res.status(500).json({ success: false, error: 'Failed to add to favorites' });
    }
});

// Batch download for TV series episodes
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memory: process.memoryUsage()
    });
});

// Main HTML page with Netflix-like UI
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>CLOUD.MOVIES - Unlimited Streaming</title>
        <meta name="description" content="Stream unlimited movies, TV shows, and more on CLOUD.MOVIES">
        
        <!-- PWA Meta -->
        <meta name="theme-color" content="#141414">
        <link rel="manifest" href="/manifest.json">
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
        
        <!-- Fonts -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        
        <!-- Styles -->
        <style>
            :root {
                --netflix-red: #e50914;
                --netflix-dark: #141414;
                --netflix-gray: #2d2d2d;
                --netflix-light-gray: #8c8c8c;
                --netflix-white: #ffffff;
                --netflix-blue: #0071eb;
                --gradient-red: linear-gradient(180deg, rgba(20,20,20,0) 0%, rgba(20,20,20,0.7) 60%, rgba(20,20,20,1) 100%);
                --card-width: 220px;
                --card-height: 330px;
                --header-height: 68px;
            }

            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: 'Netflix Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            }

            body {
                background-color: var(--netflix-dark);
                color: var(--netflix-white);
                overflow-x: hidden;
                min-height: 100vh;
            }

            /* Loading Screen */
            #loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: var(--netflix-dark);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                transition: opacity 0.5s ease;
            }

            .loading-logo {
                font-size: 4rem;
                font-weight: 900;
                color: var(--netflix-red);
                margin-bottom: 2rem;
                letter-spacing: 2px;
            }

            .loading-spinner {
                width: 50px;
                height: 50px;
                border: 3px solid var(--netflix-gray);
                border-top-color: var(--netflix-red);
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }

            /* Header */
            .header {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: var(--header-height);
                background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%);
                padding: 0 4%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                z-index: 1000;
                transition: background-color 0.3s;
            }

            .header.scrolled {
                background-color: var(--netflix-dark);
            }

            .logo {
                font-size: 1.8rem;
                font-weight: 900;
                color: var(--netflix-red);
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .logo i {
                font-size: 2rem;
            }

            .nav-links {
                display: flex;
                gap: 20px;
                margin-left: 40px;
            }

            .nav-link {
                color: var(--netflix-white);
                text-decoration: none;
                font-size: 0.9rem;
                transition: color 0.3s;
            }

            .nav-link:hover,
            .nav-link.active {
                color: var(--netflix-light-gray);
            }

            .header-actions {
                display: flex;
                align-items: center;
                gap: 20px;
            }

            .search-container {
                position: relative;
            }

            .search-input {
                background: rgba(0,0,0,0.7);
                border: 1px solid rgba(255,255,255,0.2);
                color: white;
                padding: 8px 35px 8px 15px;
                border-radius: 4px;
                width: 250px;
                font-size: 0.9rem;
                transition: width 0.3s, background-color 0.3s;
            }

            .search-input:focus {
                width: 300px;
                background: rgba(0,0,0,0.9);
                outline: none;
            }

            .search-btn {
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: var(--netflix-white);
                cursor: pointer;
            }

            .user-menu {
                position: relative;
            }

            .user-btn {
                background: var(--netflix-red);
                border: none;
                width: 32px;
                height: 32px;
                border-radius: 4px;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            /* Hero Section */
            .hero-section {
                position: relative;
                height: 80vh;
                min-height: 600px;
                background: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)),
                            url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?ixlib=rb-4.0.3&auto=format&fit=crop&w=1925&q=80');
                background-size: cover;
                background-position: center;
                display: flex;
                align-items: center;
                padding: 0 4%;
                margin-top: var(--header-height);
            }

            .hero-content {
                max-width: 800px;
                z-index: 2;
            }

            .hero-title {
                font-size: 3.5rem;
                font-weight: 900;
                margin-bottom: 1rem;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            }

            .hero-description {
                font-size: 1.2rem;
                margin-bottom: 2rem;
                line-height: 1.4;
                max-width: 600px;
            }

            .hero-actions {
                display: flex;
                gap: 15px;
                margin-bottom: 2rem;
            }

            .btn {
                padding: 12px 30px;
                border: none;
                border-radius: 4px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: all 0.3s;
            }

            .btn-primary {
                background-color: var(--netflix-white);
                color: var(--netflix-dark);
            }

            .btn-primary:hover {
                background-color: rgba(255,255,255,0.8);
            }

            .btn-secondary {
                background-color: rgba(109, 109, 110, 0.7);
                color: var(--netflix-white);
            }

            .btn-secondary:hover {
                background-color: rgba(109, 109, 110, 0.5);
            }

            /* Content Sections */
            .content-sections {
                padding: 2rem 4%;
            }

            .section {
                margin-bottom: 3rem;
            }

            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }

            .section-title {
                font-size: 1.5rem;
                font-weight: 700;
            }

            .view-all {
                color: var(--netflix-blue);
                text-decoration: none;
                font-size: 0.9rem;
            }

            .view-all:hover {
                text-decoration: underline;
            }

            /* Content Row */
            .content-row {
                position: relative;
                overflow: hidden;
            }

            .row-container {
                display: flex;
                gap: 10px;
                overflow-x: auto;
                padding: 10px 0;
                scroll-behavior: smooth;
                scrollbar-width: none;
            }

            .row-container::-webkit-scrollbar {
                display: none;
            }

            .row-nav {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(0,0,0,0.7);
                border: none;
                color: white;
                width: 40px;
                height: 100px;
                cursor: pointer;
                z-index: 100;
                opacity: 0;
                transition: opacity 0.3s;
            }

            .row-container:hover + .row-nav,
            .row-nav:hover {
                opacity: 1;
            }

            .row-nav.prev {
                left: 0;
                border-radius: 0 4px 4px 0;
            }

            .row-nav.next {
                right: 0;
                border-radius: 4px 0 0 4px;
            }

            /* Content Card */
            .content-card {
                position: relative;
                flex: 0 0 var(--card-width);
                height: var(--card-height);
                background: var(--netflix-gray);
                border-radius: 4px;
                overflow: hidden;
                transition: transform 0.3s, z-index 0.3s;
                cursor: pointer;
            }

            .content-card:hover {
                transform: scale(1.2);
                z-index: 10;
            }

            .card-poster {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .card-overlay {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(transparent, rgba(0,0,0,0.8));
                padding: 20px;
                opacity: 0;
                transition: opacity 0.3s;
            }

            .content-card:hover .card-overlay {
                opacity: 1;
            }

            .card-title {
                font-size: 1rem;
                font-weight: 600;
                margin-bottom: 5px;
            }

            .card-meta {
                display: flex;
                gap: 10px;
                font-size: 0.8rem;
                color: var(--netflix-light-gray);
            }

            .card-badge {
                position: absolute;
                top: 10px;
                left: 10px;
                background: var(--netflix-red);
                color: white;
                padding: 2px 8px;
                border-radius: 3px;
                font-size: 0.7rem;
                font-weight: 600;
            }

            /* Modal */
            .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                z-index: 2000;
                overflow-y: auto;
            }

            .modal-content {
                max-width: 900px;
                margin: 2rem auto;
                background: var(--netflix-dark);
                border-radius: 8px;
                overflow: hidden;
                position: relative;
            }

            .modal-close {
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(0,0,0,0.7);
                border: none;
                color: white;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                cursor: pointer;
                z-index: 10;
            }

            .modal-poster {
                width: 100%;
                height: 400px;
                object-fit: cover;
            }

            .modal-body {
                padding: 2rem;
            }

            .modal-title {
                font-size: 2.5rem;
                margin-bottom: 1rem;
            }

            .modal-meta {
                display: flex;
                gap: 20px;
                margin-bottom: 1.5rem;
                font-size: 0.9rem;
                color: var(--netflix-light-gray);
            }

            .modal-description {
                line-height: 1.6;
                margin-bottom: 2rem;
                font-size: 1.1rem;
            }

            .modal-actions {
                display: flex;
                gap: 15px;
                margin-bottom: 2rem;
            }

            /* Player */
            .player-modal .modal-content {
                max-width: 1000px;
            }

            .video-player {
                width: 100%;
                height: 500px;
                background: #000;
            }

            .player-controls {
                padding: 1rem;
                background: rgba(0,0,0,0.8);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            /* Auth Modal */
            .auth-modal {
                background: rgba(0,0,0,0.8);
            }

            .auth-content {
                max-width: 400px;
                background: rgba(0,0,0,0.7);
                padding: 3rem;
                border-radius: 8px;
            }

            .auth-title {
                font-size: 2rem;
                margin-bottom: 2rem;
                text-align: center;
            }

            .auth-form {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }

            .form-input {
                padding: 15px;
                background: #333;
                border: none;
                border-radius: 4px;
                color: white;
                font-size: 1rem;
            }

            .form-input:focus {
                outline: none;
                background: #454545;
            }

            /* Footer */
            .footer {
                padding: 3rem 4%;
                background: #000;
                margin-top: 4rem;
            }

            .footer-content {
                max-width: 1000px;
                margin: 0 auto;
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 2rem;
            }

            .footer-section h3 {
                color: var(--netflix-red);
                margin-bottom: 1rem;
            }

            .footer-links {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .footer-link {
                color: var(--netflix-light-gray);
                text-decoration: none;
                font-size: 0.9rem;
            }

            .footer-link:hover {
                text-decoration: underline;
            }

            .footer-bottom {
                text-align: center;
                padding-top: 2rem;
                margin-top: 2rem;
                border-top: 1px solid #333;
                color: var(--netflix-light-gray);
                font-size: 0.8rem;
            }

            /* Responsive */
            @media (max-width: 1024px) {
                .hero-title {
                    font-size: 2.5rem;
                }
                
                .nav-links {
                    display: none;
                }
                
                .search-input {
                    width: 200px;
                }
            }

            @media (max-width: 768px) {
                .hero-section {
                    height: 60vh;
                    min-height: 400px;
                }
                
                .hero-title {
                    font-size: 2rem;
                }
                
                .hero-description {
                    font-size: 1rem;
                }
                
                .content-card {
                    flex: 0 0 180px;
                    height: 270px;
                }
                
                .modal-content {
                    margin: 0;
                    border-radius: 0;
                }
            }

            @media (max-width: 480px) {
                .hero-actions {
                    flex-direction: column;
                }
                
                .btn {
                    width: 100%;
                    justify-content: center;
                }
                
                .search-input {
                    width: 150px;
                }
                
                .content-card {
                    flex: 0 0 140px;
                    height: 210px;
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
                color: var(--netflix-red);
                padding: 1rem;
                background: rgba(229, 9, 20, 0.1);
                border-radius: 4px;
                margin: 1rem 0;
            }

            .success {
                color: #46d369;
                padding: 1rem;
                background: rgba(70, 211, 105, 0.1);
                border-radius: 4px;
                margin: 1rem 0;
            }
        </style>
    </head>
    <body>
        <!-- Loading Screen -->
        <div id="loading-screen">
            <div class="loading-logo">
                <i class="fas fa-film"></i> CLOUD.MOVIES
            </div>
            <div class="loading-spinner"></div>
        </div>

        <!-- Header -->
        <header class="header" id="header">
            <div class="logo">
                <i class="fas fa-film"></i>
                <span>CLOUD.MOVIES</span>
            </div>
            
            <nav class="nav-links">
                <a href="#" class="nav-link active">Home</a>
                <a href="#" class="nav-link">TV Shows</a>
                <a href="#" class="nav-link">Movies</a>
                <a href="#" class="nav-link">New & Popular</a>
                <a href="#" class="nav-link">My List</a>
            </nav>
            
            <div class="header-actions">
                <div class="search-container">
                    <input type="text" class="search-input" id="search-input" placeholder="Search...">
                    <button class="search-btn" id="search-btn">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
                
                <div class="user-menu">
                    <button class="user-btn" id="user-btn">
                        <i class="fas fa-user"></i>
                    </button>
                    <div class="user-dropdown hidden" id="user-dropdown">
                        <a href="#" id="profile-link">Profile</a>
                        <a href="#" id="logout-link">Logout</a>
                    </div>
                </div>
            </div>
        </header>

        <!-- Main Content -->
        <main>
            <!-- Hero Section -->
            <section class="hero-section" id="hero-section">
                <div class="hero-content">
                    <h1 class="hero-title">Unlimited movies, TV shows, and more</h1>
                    <p class="hero-description">Watch anywhere. Cancel anytime. Ready to watch? Enter your email to create or restart your membership.</p>
                    <div class="hero-actions">
                        <button class="btn btn-primary" id="get-started">
                            <i class="fas fa-play"></i> Get Started
                        </button>
                        <button class="btn btn-secondary" id="learn-more">
                            <i class="fas fa-info-circle"></i> Learn More
                        </button>
                    </div>
                </div>
            </section>

            <!-- Content Sections -->
            <div class="content-sections" id="content-sections">
                <!-- Continue Watching -->
                <section class="section" id="continue-watching-section">
                    <div class="section-header">
                        <h2 class="section-title">Continue Watching</h2>
                        <a href="#" class="view-all">View All</a>
                    </div>
                    <div class="content-row">
                        <div class="row-container" id="continue-watching-row"></div>
                        <button class="row-nav prev"><i class="fas fa-chevron-left"></i></button>
                        <button class="row-nav next"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </section>

                <!-- Trending Now -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Trending Now</h2>
                        <a href="#" class="view-all">View All</a>
                    </div>
                    <div class="content-row">
                        <div class="row-container" id="trending-row"></div>
                        <button class="row-nav prev"><i class="fas fa-chevron-left"></i></button>
                        <button class="row-nav next"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </section>

                <!-- Popular Movies -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Popular Movies</h2>
                        <a href="#" class="view-all">View All</a>
                    </div>
                    <div class="content-row">
                        <div class="row-container" id="movies-row"></div>
                        <button class="row-nav prev"><i class="fas fa-chevron-left"></i></button>
                        <button class="row-nav next"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </section>

                <!-- TV Series -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">TV Series</h2>
                        <a href="#" class="view-all">View All</a>
                    </div>
                    <div class="content-row">
                        <div class="row-container" id="series-row"></div>
                        <button class="row-nav prev"><i class="fas fa-chevron-left"></i></button>
                        <button class="row-nav next"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </section>

                <!-- Recently Added -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Recently Added</h2>
                        <a href="#" class="view-all">View All</a>
                    </div>
                    <div class="content-row">
                        <div class="row-container" id="recent-row"></div>
                        <button class="row-nav prev"><i class="fas fa-chevron-left"></i></button>
                        <button class="row-nav next"><i class="fas fa-chevron-right"></i></button>
                    </div>
                </section>
            </div>
        </main>

        <!-- Detail Modal -->
        <div class="modal" id="detail-modal">
            <div class="modal-content">
                <button class="modal-close" id="close-detail-modal">
                    <i class="fas fa-times"></i>
                </button>
                <div id="detail-modal-body"></div>
            </div>
        </div>

        <!-- Player Modal -->
        <div class="modal player-modal" id="player-modal">
            <div class="modal-content">
                <button class="modal-close" id="close-player">
                    <i class="fas fa-times"></i>
                </button>
                <video class="video-player" id="video-player" controls></video>
                <div class="player-controls">
                    <select id="quality-select">
                        <option value="360p">360p</option>
                        <option value="480p">480p</option>
                        <option value="720p" selected>720p</option>
                    </select>
                    <button class="btn btn-primary" id="download-video">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            </div>
        </div>

        <!-- Auth Modal -->
        <div class="modal auth-modal" id="auth-modal">
            <div class="modal-content auth-content">
                <h2 class="auth-title" id="auth-title">Sign In</h2>
                <form class="auth-form" id="login-form">
                    <input type="email" class="form-input" id="login-email" placeholder="Email" required>
                    <input type="password" class="form-input" id="login-password" placeholder="Password" required>
                    <button type="submit" class="btn btn-primary">Sign In</button>
                    <p class="auth-switch">New to CLOUD.MOVIES? <a href="#" id="switch-to-register">Sign up now</a>.</p>
                </form>
                <form class="auth-form hidden" id="register-form">
                    <input type="text" class="form-input" id="register-username" placeholder="Username" required>
                    <input type="email" class="form-input" id="register-email" placeholder="Email" required>
                    <input type="password" class="form-input" id="register-password" placeholder="Password" required>
                    <button type="submit" class="btn btn-primary">Sign Up</button>
                    <p class="auth-switch">Already have an account? <a href="#" id="switch-to-login">Sign in</a>.</p>
                </form>
            </div>
        </div>

        <!-- Footer -->
        <footer class="footer">
            <div class="footer-content">
                <div class="footer-section">
                    <h3><i class="fas fa-film"></i> CLOUD.MOVIES</h3>
                    <p>Unlimited streaming platform</p>
                </div>
                <div class="footer-section">
                    <h4>Quick Links</h4>
                    <div class="footer-links">
                        <a href="#" class="footer-link">Home</a>
                        <a href="#" class="footer-link">TV Shows</a>
                        <a href="#" class="footer-link">Movies</a>
                        <a href="#" class="footer-link">New & Popular</a>
                        <a href="#" class="footer-link">My List</a>
                    </div>
                </div>
                <div class="footer-section">
                    <h4>Account</h4>
                    <div class="footer-links">
                        <a href="#" class="footer-link">Profile</a>
                        <a href="#" class="footer-link">Settings</a>
                        <a href="#" class="footer-link">Help Center</a>
                        <a href="#" class="footer-link">Contact Us</a>
                    </div>
                </div>
                <div class="footer-section">
                    <h4>Legal</h4>
                    <div class="footer-links">
                        <a href="#" class="footer-link">Privacy Policy</a>
                        <a href="#" class="footer-link">Terms of Service</a>
                        <a href="#" class="footer-link">Cookie Policy</a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; 2024 CLOUD.MOVIES. All rights reserved. Powered by Gifted Movies API</p>
                <p>Developed by Bruce Bera - Bera Tech | Contact: +254 743 983 206</p>
            </div>
        </footer>

        <!-- JavaScript -->
        <script>
            class CloudMoviesApp {
                constructor() {
                    this.apiBase = '/api';
                    this.currentUser = null;
                    this.token = localStorage.getItem('token');
                    this.currentContent = [];
                    this.selectedContent = null;
                    this.currentPage = 1;
                    this.init();
                }

                async init() {
                    this.hideLoading();
                    this.initEventListeners();
                    this.checkAuth();
                    await this.loadContent();
                    this.setupHeaderScroll();
                }

                hideLoading() {
                    setTimeout(() => {
                        const loadingScreen = document.getElementById('loading-screen');
                        loadingScreen.style.opacity = '0';
                        setTimeout(() => {
                            loadingScreen.style.display = 'none';
                        }, 500);
                    }, 1000);
                }

                setupHeaderScroll() {
                    const header = document.getElementById('header');
                    window.addEventListener('scroll', () => {
                        if (window.scrollY > 50) {
                            header.classList.add('scrolled');
                        } else {
                            header.classList.remove('scrolled');
                        }
                    });
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
                                this.updateUI();
                            }
                        } catch (error) {
                            console.error('Auth check failed:', error);
                        }
                    }
                }

                updateUI() {
                    const userBtn = document.getElementById('user-btn');
                    const continueWatching = document.getElementById('continue-watching-section');
                    
                    if (this.currentUser) {
                        userBtn.innerHTML = `<i class="fas fa-user-circle"></i>`;
                        continueWatching.style.display = 'block';
                        this.loadContinueWatching();
                    } else {
                        userBtn.innerHTML = `<i class="fas fa-user"></i>`;
                        continueWatching.style.display = 'none';
                    }
                }

                async loadContent() {
                    try {
                        // Load trending content
                        await this.loadSection('trending', '/api/trending');
                        
                        // Load movies
                        await this.loadSection('movies', '/api/search/movie');
                        
                        // Load TV series
                        await this.loadSection('series', '/api/search/series');
                        
                        // Load recent content
                        await this.loadSection('recent', '/api/search/2024');
                    } catch (error) {
                        console.error('Error loading content:', error);
                        this.showError('Failed to load content');
                    }
                }

                async loadSection(sectionId, endpoint) {
                    try {
                        const response = await fetch(endpoint);
                        const data = await response.json();
                        
                        if (data.success && data.results.length > 0) {
                            this.displayContentRow(data.results.slice(0, 10), sectionId + '-row');
                        }
                    } catch (error) {
                        console.error(`Error loading ${sectionId}:`, error);
                    }
                }

                async loadContinueWatching() {
                    if (!this.currentUser) return;
                    
                    try {
                        const response = await fetch(this.apiBase + '/user/continue-watching', {
                            headers: { 'Authorization': 'Bearer ' + this.token }
                        });
                        
                        if (response.ok) {
                            const data = await response.json();
                            if (data.success && data.continueWatching.length > 0) {
                                this.displayContinueWatching(data.continueWatching);
                            }
                        }
                    } catch (error) {
                        console.error('Error loading continue watching:', error);
                    }
                }

                displayContentRow(items, containerId) {
                    const container = document.getElementById(containerId);
                    if (!container) return;
                    
                    container.innerHTML = items.map(item => \`
                        <div class="content-card" data-id="\${item.id}" data-type="\${item.type}">
                            \${item.type === 'tv' ? '<span class="card-badge">TV</span>' : ''}
                            \${item.isNew ? '<span class="card-badge" style="background: #46d369;">NEW</span>' : ''}
                            <img src="\${item.poster || item.cover || 'https://via.placeholder.com/220x330?text=No+Image'}" 
                                 alt="\${item.title}" 
                                 class="card-poster"
                                 onerror="this.src='https://via.placeholder.com/220x330?text=No+Image'">
                            <div class="card-overlay">
                                <div class="card-title">\${item.title}</div>
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
                            this.showContentDetails(card.dataset.id);
                        });
                    });
                    
                    // Setup row navigation
                    this.setupRowNavigation(container.parentElement);
                }

                displayContinueWatching(items) {
                    const container = document.getElementById('continue-watching-row');
                    if (!container) return;
                    
                    container.innerHTML = items.map(item => \`
                        <div class="content-card" data-id="\${item.contentId}" 
                             data-season="\${item.season || ''}" 
                             data-episode="\${item.episode || ''}">
                            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: rgba(255,255,255,0.3);">
                                <div style="width: \${item.progress || 0}%; height: 100%; background: var(--netflix-red);"></div>
                            </div>
                            <img src="\${item.poster || 'https://via.placeholder.com/220x330?text=Continue+Watching'}" 
                                 alt="\${item.title}" 
                                 class="card-poster">
                            <div class="card-overlay">
                                <div class="card-title">\${item.title}</div>
                                <div class="card-meta">
                                    <span>Continue watching</span>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                    
                    container.querySelectorAll('.content-card').forEach(card => {
                        card.addEventListener('click', () => {
                            const contentId = card.dataset.id;
                            const season = card.dataset.season;
                            const episode = card.dataset.episode;
                            this.showContentDetails(contentId, { season, episode });
                        });
                    });
                    
                    this.setupRowNavigation(container.parentElement);
                }

                setupRowNavigation(rowElement) {
                    const container = rowElement.querySelector('.row-container');
                    const prevBtn = rowElement.querySelector('.row-nav.prev');
                    const nextBtn = rowElement.querySelector('.row-nav.next');
                    
                    if (prevBtn && nextBtn) {
                        prevBtn.addEventListener('click', () => {
                            container.scrollBy({ left: -400, behavior: 'smooth' });
                        });
                        
                        nextBtn.addEventListener('click', () => {
                            container.scrollBy({ left: 400, behavior: 'smooth' });
                        });
                    }
                }

                async showContentDetails(contentId, options = {}) {
                    try {
                        const response = await fetch(\`\${this.apiBase}/info/\${contentId}\`);
                        const data = await response.json();
                        
                        if (data.success) {
                            this.selectedContent = data.data;
                            this.displayDetailsModal(options);
                        } else {
                            this.showError('Failed to load content details');
                        }
                    } catch (error) {
                        console.error('Error loading details:', error);
                        this.showError('Failed to load content details');
                    }
                }

                displayDetailsModal(options = {}) {
                    const modal = document.getElementById('detail-modal');
                    const body = document.getElementById('detail-modal-body');
                    const content = this.selectedContent;
                    
                    const isTV = content.type === 'tv';
                    
                    // Build seasons/epsodes section for TV shows
                    let seasonsHtml = '';
                    if (isTV && content.seasons.length > 0) {
                        seasonsHtml = \`
                            <div class="seasons-section" style="margin: 2rem 0;">
                                <h3 style="margin-bottom: 1rem;">Seasons & Episodes</h3>
                                <div class="seasons-selector" style="display: flex; gap: 10px; margin-bottom: 1rem;">
                                    \${content.seasons.map(season => \`
                                        <button class="season-btn" data-season="\${season.season}" 
                                                style="padding: 8px 16px; background: #333; border: none; border-radius: 4px; color: white; cursor: pointer;">
                                            Season \${season.season}
                                        </button>
                                    \`).join('')}
                                </div>
                                <div id="episodes-list" style="display: grid; gap: 10px;"></div>
                            </div>
                        \`;
                    }
                    
                    body.innerHTML = \`
                        <img src="\${content.poster || content.cover || 'https://via.placeholder.com/900x400?text=No+Image'}" 
                             alt="\${content.title}" 
                             class="modal-poster">
                        <div class="modal-body">
                            <h1 class="modal-title">\${content.title}</h1>
                            <div class="modal-meta">
                                <span>\${content.year || 'N/A'}</span>
                                <span>\${content.duration ? Math.floor(content.duration / 60) + ' min' : 'N/A'}</span>
                                <span>\${content.rating ? '⭐ ' + content.rating : ''}</span>
                                <span>\${content.type === 'tv' ? 'TV Series' : 'Movie'}</span>
                            </div>
                            <div style="display: flex; gap: 10px; margin-bottom: 1rem;">
                                \${content.genre.map(g => \`
                                    <span style="background: #333; padding: 5px 10px; border-radius: 3px; font-size: 0.9rem;">\${g}</span>
                                \`).join('')}
                            </div>
                            <p class="modal-description">\${content.description || 'No description available.'}</p>
                            
                            <div class="modal-actions">
                                <button class="btn btn-primary" id="play-content">
                                    <i class="fas fa-play"></i> Play
                                </button>
                                \${this.currentUser ? \`
                                    <button class="btn btn-secondary" id="add-to-list">
                                        <i class="fas fa-plus"></i> My List
                                    </button>
                                \` : ''}
                                \${content.trailer ? \`
                                    <button class="btn btn-secondary" id="watch-trailer">
                                        <i class="fas fa-play-circle"></i> Trailer
                                    </button>
                                \` : ''}
                            </div>
                            
                            \${content.cast && content.cast.length > 0 ? \`
                                <div style="margin: 2rem 0;">
                                    <h3>Cast</h3>
                                    <div style="display: flex; gap: 20px; overflow-x: auto; padding: 1rem 0;">
                                        \${content.cast.slice(0, 10).map(person => \`
                                            <div style="text-align: center; min-width: 100px;">
                                                <img src="\${person.avatar || 'https://via.placeholder.com/100?text=Avatar'}" 
                                                     alt="\${person.name}"
                                                     style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
                                                <div style="margin-top: 10px;">
                                                    <strong>\${person.name}</strong>
                                                    <div style="font-size: 0.9rem; color: #999;">\${person.character || 'Actor'}</div>
                                                </div>
                                            </div>
                                        \`).join('')}
                                    </div>
                                </div>
                            \` : ''}
                            
                            \${seasonsHtml}
                        </div>
                    \`;
                    
                    modal.style.display = 'block';
                    
                    // Add event listeners
                    document.getElementById('play-content').addEventListener('click', () => {
                        this.playContent(options);
                    });
                    
                    if (this.currentUser) {
                        document.getElementById('add-to-list').addEventListener('click', () => {
                            this.addToWatchlist();
                        });
                    }
                    
                    if (content.trailer) {
                        document.getElementById('watch-trailer').addEventListener('click', () => {
                            this.playTrailer(content.trailer);
                        });
                    }
                    
                    // Setup seasons/episodes for TV shows
                    if (isTV && content.seasons.length > 0) {
                        this.setupSeasonsSelection(options);
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

                setupSeasonsSelection(options) {
                    const seasonBtns = document.querySelectorAll('.season-btn');
                    const episodesList = document.getElementById('episodes-list');
                    
                    seasonBtns.forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const season = btn.dataset.season;
                            
                            // Update active season
                            seasonBtns.forEach(b => b.style.background = '#333');
                            btn.style.background = 'var(--netflix-red)';
                            
                            // Load episodes
                            const response = await fetch(\`\${this.apiBase}/tv/\${this.selectedContent.id}/season/\${season}/episodes\`);
                            const data = await response.json();
                            
                            if (data.success && data.episodes.length > 0) {
                                episodesList.innerHTML = data.episodes.map(ep => \`
                                    <div style="background: #333; padding: 15px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <strong>Episode \${ep.episode}</strong>
                                            <div style="color: #999; font-size: 0.9rem;">\${ep.title}</div>
                                        </div>
                                        <button class="play-episode-btn" 
                                                data-season="\${season}" 
                                                data-episode="\${ep.episode}"
                                                style="background: var(--netflix-red); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                                            <i class="fas fa-play"></i> Play
                                        </button>
                                    </div>
                                \`).join('');
                                
                                // Add click listeners to episode play buttons
                                episodesList.querySelectorAll('.play-episode-btn').forEach(btn => {
                                    btn.addEventListener('click', () => {
                                        const season = btn.dataset.season;
                                        const episode = btn.dataset.episode;
                                        this.playContent({ season, episode });
                                    });
                                });
                            }
                        });
                    });
                    
                    // Click first season or specified season
                    if (options.season) {
                        const initialSeason = Array.from(seasonBtns).find(btn => btn.dataset.season === options.season);
                        if (initialSeason) {
                            initialSeason.click();
                        }
                    } else if (seasonBtns.length > 0) {
                        seasonBtns[0].click();
                    }
                }

                async playContent(options = {}) {
                    if (!this.selectedContent) return;
                    
                    const quality = document.getElementById('quality-select').value;
                    const season = options.season || null;
                    const episode = options.episode || null;
                    
                    // Update watch history if logged in
                    if (this.currentUser) {
                        await this.updateWatchHistory(options);
                    }
                    
                    // Show player
                    const playerModal = document.getElementById('player-modal');
                    const videoPlayer = document.getElementById('video-player');
                    
                    // Build stream URL
                    let streamUrl = \`\${this.apiBase}/stream/\${this.selectedContent.id}?quality=\${quality}\`;
                    if (season) streamUrl += \`&season=\${season}\`;
                    if (episode) streamUrl += \`&episode=\${episode}\`;
                    
                    videoPlayer.src = streamUrl;
                    playerModal.style.display = 'block';
                    
                    // Setup player controls
                    document.getElementById('close-player').addEventListener('click', () => {
                        videoPlayer.pause();
                        playerModal.style.display = 'none';
                    });
                    
                    document.getElementById('download-video').addEventListener('click', () => {
                        this.downloadContent(quality, season, episode);
                    });
                    
                    playerModal.addEventListener('click', (e) => {
                        if (e.target === playerModal) {
                            videoPlayer.pause();
                            playerModal.style.display = 'none';
                        }
                    });
                }

                playTrailer(trailerUrl) {
                    const playerModal = document.getElementById('player-modal');
                    const videoPlayer = document.getElementById('video-player');
                    
                    videoPlayer.src = trailerUrl;
                    playerModal.style.display = 'block';
                }

                async updateWatchHistory(options = {}) {
                    try {
                        const response = await fetch(this.apiBase + '/user/history', {
                            method: 'POST',
                            headers: {
                                'Authorization': 'Bearer ' + this.token,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                contentId: this.selectedContent.id,
                                title: this.selectedContent.title,
                                poster: this.selectedContent.poster,
                                type: this.selectedContent.type,
                                season: options.season || null,
                                episode: options.episode || null,
                                progress: 0,
                                duration: this.selectedContent.duration || 0
                            })
                        });
                    } catch (error) {
                        console.error('Error updating watch history:', error);
                    }
                }

                async addToWatchlist() {
                    if (!this.currentUser || !this.selectedContent) return;
                    
                    try {
                        const response = await fetch(this.apiBase + '/user/watchlist', {
                            method: 'POST',
                            headers: {
                                'Authorization': 'Bearer ' + this.token,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                contentId: this.selectedContent.id,
                                title: this.selectedContent.title,
                                poster: this.selectedContent.poster,
                                type: this.selectedContent.type
                            })
                        });
                        
                        if (response.ok) {
                            this.showSuccess('Added to My List');
                        }
                    } catch (error) {
                        console.error('Error adding to watchlist:', error);
                        this.showError('Failed to add to My List');
                    }
                }

                async downloadContent(quality, season = null, episode = null) {
                    if (!this.currentUser) {
                        this.showAuthModal();
                        return;
                    }
                    
                    try {
                        const response = await fetch(this.apiBase + '/user/downloads', {
                            method: 'POST',
                            headers: {
                                'Authorization': 'Bearer ' + this.token,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                contentId: this.selectedContent.id,
                                title: this.selectedContent.title,
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

                showAuthModal() {
                    const modal = document.getElementById('auth-modal');
                    const loginForm = document.getElementById('login-form');
                    const registerForm = document.getElementById('register-form');
                    const authTitle = document.getElementById('auth-title');
                    
                    modal.style.display = 'block';
                    
                    // Setup form switching
                    document.getElementById('switch-to-register').addEventListener('click', (e) => {
                        e.preventDefault();
                        loginForm.classList.add('hidden');
                        registerForm.classList.remove('hidden');
                        authTitle.textContent = 'Sign Up';
                    });
                    
                    document.getElementById('switch-to-login').addEventListener('click', (e) => {
                        e.preventDefault();
                        registerForm.classList.add('hidden');
                        loginForm.classList.remove('hidden');
                        authTitle.textContent = 'Sign In';
                    });
                    
                    // Login form
                    loginForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const email = document.getElementById('login-email').value;
                        const password = document.getElementById('login-password').value;
                        
                        await this.login(email, password);
                    });
                    
                    // Register form
                    registerForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const username = document.getElementById('register-username').value;
                        const email = document.getElementById('register-email').value;
                        const password = document.getElementById('register-password').value;
                        
                        await this.register(username, email, password);
                    });
                    
                    // Close modal
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
                            this.updateUI();
                            this.showSuccess('Login successful');
                            document.getElementById('auth-modal').style.display = 'none';
                            await this.loadContinueWatching();
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
                            // Switch to login form
                            document.getElementById('register-form').classList.add('hidden');
                            document.getElementById('login-form').classList.remove('hidden');
                            document.getElementById('auth-title').textContent = 'Sign In';
                        } else {
                            this.showError(data.error || 'Registration failed');
                        }
                    } catch (error) {
                        console.error('Registration error:', error);
                        this.showError('Registration failed');
                    }
                }

                async logout() {
                    try {
                        await fetch(this.apiBase + '/auth/logout', { method: 'POST' });
                        localStorage.removeItem('token');
                        this.token = null;
                        this.currentUser = null;
                        this.updateUI();
                        this.showSuccess('Logged out successfully');
                    } catch (error) {
                        console.error('Logout error:', error);
                    }
                }

                initEventListeners() {
                    // Search
                    const searchInput = document.getElementById('search-input');
                    const searchBtn = document.getElementById('search-btn');
                    
                    const performSearch = async () => {
                        const query = searchInput.value.trim();
                        if (query) {
                            try {
                                const response = await fetch(\`\${this.apiBase}/search/\${encodeURIComponent(query)}\`);
                                const data = await response.json();
                                
                                if (data.success) {
                                    // Create search results modal
                                    const modal = document.getElementById('detail-modal');
                                    const body = document.getElementById('detail-modal-body');
                                    
                                    body.innerHTML = \`
                                        <div class="modal-body">
                                            <h2 style="margin-bottom: 2rem;">Search Results for "\${query}"</h2>
                                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
                                                \${data.results.map(item => \`
                                                    <div class="content-card" data-id="\${item.id}" style="height: 300px;">
                                                        <img src="\${item.poster || item.cover || 'https://via.placeholder.com/200x300?text=No+Image'}" 
                                                             alt="\${item.title}" 
                                                             class="card-poster">
                                                        <div class="card-overlay">
                                                            <div class="card-title">\${item.title}</div>
                                                            <div class="card-meta">
                                                                <span>\${item.year || 'N/A'}</span>
                                                                <span>\${item.type === 'tv' ? 'TV' : 'Movie'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                \`).join('')}
                                            </div>
                                        </div>
                                    \`;
                                    
                                    modal.style.display = 'block';
                                    
                                    // Add click listeners to search results
                                    body.querySelectorAll('.content-card').forEach(card => {
                                        card.addEventListener('click', () => {
                                            this.showContentDetails(card.dataset.id);
                                        });
                                    });
                                    
                                    // Close modal
                                    document.getElementById('close-detail-modal').addEventListener('click', () => {
                                        modal.style.display = 'none';
                                    });
                                }
                            } catch (error) {
                                console.error('Search error:', error);
                                this.showError('Search failed');
                            }
                        }
                    };
                    
                    searchBtn.addEventListener('click', performSearch);
                    searchInput.addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') performSearch();
                    });
                    
                    // User menu
                    const userBtn = document.getElementById('user-btn');
                    const userDropdown = document.getElementById('user-dropdown');
                    
                    userBtn.addEventListener('click', () => {
                        if (this.currentUser) {
                            userDropdown.classList.toggle('hidden');
                        } else {
                            this.showAuthModal();
                        }
                    });
                    
                    // Logout
                    document.getElementById('logout-link')?.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await this.logout();
                        userDropdown.classList.add('hidden');
                    });
                    
                    // Profile
                    document.getElementById('profile-link')?.addEventListener('click', (e) => {
                        e.preventDefault();
                        // TODO: Show profile modal
                        this.showSuccess('Profile feature coming soon!');
                    });
                    
                    // Get started button
                    document.getElementById('get-started')?.addEventListener('click', () => {
                        this.showAuthModal();
                    });
                    
                    // Close modals when clicking outside
                    window.addEventListener('click', (e) => {
                        if (!e.target.closest('.user-menu') && !userDropdown.classList.contains('hidden')) {
                            userDropdown.classList.add('hidden');
                        }
                    });
                }

                showError(message) {
                    this.showNotification(message, 'error');
                }

                showSuccess(message) {
                    this.showNotification(message, 'success');
                }

                showNotification(message, type) {
                    const notification = document.createElement('div');
                    notification.className = type;
                    notification.textContent = message;
                    notification.style.position = 'fixed';
                    notification.style.top = '20px';
                    notification.style.right = '20px';
                    notification.style.zIndex = '9999';
                    notification.style.padding = '15px 20px';
                    notification.style.borderRadius = '4px';
                    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                    
                    document.body.appendChild(notification);
                    
                    setTimeout(() => {
                        notification.style.opacity = '0';
                        notification.style.transform = 'translateX(100%)';
                        setTimeout(() => {
                            document.body.removeChild(notification);
                        }, 300);
                    }, 3000);
                }
            }

            // Initialize the app
            document.addEventListener('DOMContentLoaded', () => {
                window.app = new CloudMoviesApp();
            });
        </script>
    </body>
    </html>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log(`🎬 CLOUD.MOVIES - Netflix-like Streaming Platform`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📡 MongoDB: Connected`);
    console.log(`🔗 API: ${API_BASE}`);
    console.log(`👤 Features: User auth, Watch history, Favorites, Downloads`);
    console.log(`💾 Storage: MongoDB with proper hashing`);
    console.log(`🎨 Design: Netflix-like dark theme`);
    console.log(`📞 Developer: Bruce Bera - Bera Tech (0743 983 206)`);
});
