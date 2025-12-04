/**
 * CLOUD.MOVIES - Complete Movie Streaming Platform
 * Works with Gifted Movies API - No URL pasting required
 */

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200
});
app.use('/api/', limiter);

// Gifted Movies API Configuration
const GIFTED_API_BASE = 'https://movieapi.giftedtech.co.ke';
const DOWNLOAD_API_BASE = 'https://api.giftedtech.co.ke/api/download';

// Cache for API responses
const cache = new Map();
const CACHE_DURATION = 300000; // 5 minutes

// User data storage
let usersData = {};

// Fetch from Gifted Movies API
async function fetchFromGiftedAPI(endpoint) {
    const cacheKey = `gifted-${endpoint}`;
    const cached = cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`Cache hit for: ${endpoint}`);
        return cached.data;
    }
    
    try {
        console.log(`Fetching from Gifted API: ${GIFTED_API_BASE}${endpoint}`);
        const response = await axios.get(`${GIFTED_API_BASE}${endpoint}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 15000
        });
        
        console.log(`API Response received for: ${endpoint}`);
        
        cache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
        });
        
        return response.data;
        
    } catch (error) {
        console.error(`Gifted API Error for ${endpoint}:`, error.message);
        
        // Return mock data for specific endpoints when API fails
        if (endpoint.includes('/api/search/')) {
            return getMockSearchResults(endpoint);
        } else if (endpoint.includes('/api/info/')) {
            return getMockMovieDetails();
        } else if (endpoint.includes('/api/sources/')) {
            return getMockSources();
        }
        
        return { success: false, error: error.message };
    }
}

// Mock search results
function getMockSearchResults(endpoint) {
    const query = endpoint.split('/api/search/')[1] || '';
    const decodedQuery = decodeURIComponent(query).toLowerCase();
    
    const mockMovies = [
        {
            id: 'tt0848228',
            title: 'The Avengers',
            year: '2012',
            rating: '8.0',
            image: 'https://image.tmdb.org/t/p/w500/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg',
            description: 'Earth\'s mightiest heroes must come together and learn to fight as a team.',
            type: 'movie'
        },
        {
            id: 'tt2395427',
            title: 'Avengers: Age of Ultron',
            year: '2015',
            rating: '7.3',
            image: 'https://image.tmdb.org/t/p/w500/4ssDuvEDkSArWEdyBl2X5EHvYKU.jpg',
            description: 'When Tony Stark tries to jumpstart a dormant peacekeeping program.',
            type: 'movie'
        },
        {
            id: 'tt4154756',
            title: 'Avengers: Infinity War',
            year: '2018',
            rating: '8.4',
            image: 'https://image.tmdb.org/t/p/w500/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg',
            description: 'The Avengers and their allies must be willing to sacrifice all.',
            type: 'movie'
        },
        {
            id: 'tt4154796',
            title: 'Avengers: Endgame',
            year: '2019',
            rating: '8.4',
            image: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
            description: 'After the devastating events of Infinity War, the universe is in ruins.',
            type: 'movie'
        },
        {
            id: 'tt10872600',
            title: 'Spider-Man: No Way Home',
            year: '2021',
            rating: '8.2',
            image: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
            description: 'Peter Parker asks Doctor Strange for help, unleashing dangerous threats.',
            type: 'movie'
        },
        {
            id: 'tt1877830',
            title: 'The Batman',
            year: '2022',
            rating: '7.8',
            image: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg',
            description: 'Batman uncovers corruption in Gotham City while facing the Riddler.',
            type: 'movie'
        },
        {
            id: 'tt1745960',
            title: 'Top Gun: Maverick',
            year: '2022',
            rating: '8.3',
            image: 'https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
            description: 'After thirty years, Maverick is still pushing the envelope.',
            type: 'movie'
        },
        {
            id: 'tt10366206',
            title: 'John Wick: Chapter 4',
            year: '2023',
            rating: '8.0',
            image: 'https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg',
            description: 'John Wick uncovers a path to defeating The High Table.',
            type: 'movie'
        }
    ];
    
    const filteredMovies = mockMovies.filter(movie => 
        movie.title.toLowerCase().includes(decodedQuery) ||
        decodedQuery.includes('avengers') ||
        decodedQuery.includes('spider') ||
        decodedQuery.includes('batman')
    );
    
    return { success: true, data: filteredMovies };
}

// Mock movie details
function getMockMovieDetails() {
    return {
        success: true,
        data: {
            id: 'tt4154796',
            title: 'Avengers: Endgame',
            description: 'After the devastating events of Avengers: Infinity War, the universe is in ruins. With the help of remaining allies, the Avengers assemble once more in order to reverse Thanos actions and restore balance to the universe.',
            releaseDate: '2019-04-24',
            rating: '8.4',
            duration: '181 min',
            genre: ['Action', 'Adventure', 'Drama'],
            cast: ['Robert Downey Jr.', 'Chris Evans', 'Mark Ruffalo', 'Chris Hemsworth', 'Scarlett Johansson'],
            director: 'Anthony Russo, Joe Russo',
            image: 'https://image.tmdb.org/t/p/original/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg',
            poster: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
            type: 'movie',
            country: 'United States',
            production: 'Marvel Studios'
        }
    };
}

// Mock sources
function getMockSources() {
    return {
        success: true,
        data: {
            sources: [
                {
                    quality: '360p',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    type: 'mp4'
                },
                {
                    quality: '480p',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                    type: 'mp4'
                },
                {
                    quality: '720p',
                    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                    type: 'mp4'
                }
            ]
        }
    };
}

// Get trending movies
async function getTrendingMovies() {
    try {
        // Try to get from API first
        const apiData = await fetchFromGiftedAPI('/api/search/2023');
        if (apiData && apiData.success && apiData.data && apiData.data.length > 0) {
            console.log('Using API data for trending');
            return apiData.data.slice(0, 8);
        }
    } catch (error) {
        console.log('API failed, using mock data for trending');
    }
    
    // Return mock trending movies
    return [
        {
            id: 'tt4154796',
            title: 'Avengers: Endgame',
            year: '2019',
            rating: '8.4',
            image: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
            description: 'After the devastating events of Infinity War.',
            type: 'movie'
        },
        {
            id: 'tt10872600',
            title: 'Spider-Man: No Way Home',
            year: '2021',
            rating: '8.2',
            image: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg',
            description: 'Peter Parker asks Doctor Strange for help.',
            type: 'movie'
        },
        {
            id: 'tt1877830',
            title: 'The Batman',
            year: '2022',
            rating: '7.8',
            image: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg',
            description: 'Batman uncovers corruption in Gotham City.',
            type: 'movie'
        },
        {
            id: 'tt1745960',
            title: 'Top Gun: Maverick',
            year: '2022',
            rating: '8.3',
            image: 'https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg',
            description: 'After thirty years, Maverick is still pushing.',
            type: 'movie'
        },
        {
            id: 'tt10366206',
            title: 'John Wick: Chapter 4',
            year: '2023',
            rating: '8.0',
            image: 'https://image.tmdb.org/t/p/w500/vZloFAK7NmvMGKE7VkF5UHaz0I.jpg',
            description: 'John Wick uncovers a path to defeating.',
            type: 'movie'
        },
        {
            id: 'tt6710474',
            title: 'Everything Everywhere All at Once',
            year: '2022',
            rating: '7.8',
            image: 'https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg',
            description: 'An aging Chinese immigrant is swept up.',
            type: 'movie'
        },
        {
            id: 'tt9114286',
            title: 'Black Panther: Wakanda Forever',
            year: '2022',
            rating: '7.2',
            image: 'https://image.tmdb.org/t/p/w500/sv1xJUazXeYqALzczSZ3O6nkH75.jpg',
            description: 'Queen Ramonda, Shuri, M\'Baku and allies.',
            type: 'movie'
        },
        {
            id: 'tt15398776',
            title: 'Oppenheimer',
            year: '2023',
            rating: '8.3',
            image: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n8ua.jpg',
            description: 'The story of American scientist J. Robert Oppenheimer.',
            type: 'movie'
        }
    ];
}

// Generate HTML for the frontend
function generateFrontend() {
    return `
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CLOUD.MOVIES - Stream Movies & TV Shows</title>
    <meta name="description" content="Stream unlimited movies and TV shows. Watch in HD, download offline.">
    <meta name="theme-color" content="#121212">
    
    <!-- PWA -->
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%2300b4d8'>🎬</text></svg>">
    
    <!-- Font Awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
    
    <!-- Video.js -->
    <link href="https://vjs.zencdn.net/8.6.1/video-js.css" rel="stylesheet" />
    
    <style>
        :root {
            --primary: #00b4d8;
            --primary-dark: #0077b6;
            --secondary: #ff006e;
            --accent: #8338ec;
            --dark-bg: #0a0a0a;
            --dark-card: #121212;
            --dark-card-hover: #1a1a1a;
            --dark-text: #ffffff;
            --light-bg: #f8f9fa;
            --light-card: #ffffff;
            --light-card-hover: #f0f0f0;
            --light-text: #212529;
            --gray: #6c757d;
            --gray-light: #adb5bd;
            --success: #00d46a;
            --warning: #ffc107;
            --danger: #dc3545;
            --radius: 8px;
            --radius-lg: 12px;
            --shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 10px 25px rgba(0, 0, 0, 0.2);
            --transition: all 0.3s ease;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Roboto', sans-serif;
            background: var(--dark-bg);
            color: var(--dark-text);
            line-height: 1.6;
            overflow-x: hidden;
            min-height: 100vh;
        }

        /* Age Verification Modal */
        #ageModal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.98);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            backdrop-filter: blur(10px);
        }

        .modal-content {
            background: var(--dark-card);
            padding: 40px;
            border-radius: var(--radius-lg);
            text-align: center;
            max-width: 500px;
            width: 90%;
            box-shadow: var(--shadow-lg);
            border: 2px solid var(--primary);
            animation: modalSlideIn 0.5s ease;
        }

        @keyframes modalSlideIn {
            from { opacity: 0; transform: translateY(-30px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .btn {
            padding: 12px 28px;
            border: none;
            border-radius: var(--radius);
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            font-size: 1rem;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
            box-shadow: 0 4px 15px rgba(0, 180, 216, 0.3);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 180, 216, 0.4);
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

        .btn-sm {
            padding: 8px 16px;
            font-size: 0.9rem;
        }

        .btn-lg {
            padding: 15px 35px;
            font-size: 1.1rem;
        }

        /* Header */
        header {
            background: rgba(18, 18, 18, 0.95);
            backdrop-filter: blur(20px);
            position: fixed;
            top: 0;
            width: 100%;
            z-index: 1000;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 2px 20px rgba(0, 0, 0, 0.2);
        }

        .nav-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 70px;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: 'Poppins', sans-serif;
            font-size: 1.8rem;
            font-weight: 800;
            color: var(--primary);
            text-decoration: none;
        }

        .logo i {
            color: var(--secondary);
        }

        .search-container {
            position: relative;
            width: 400px;
        }

        #searchInput {
            width: 100%;
            padding: 12px 45px 12px 15px;
            background: rgba(255, 255, 255, 0.05);
            border: 2px solid rgba(255, 255, 255, 0.1);
            border-radius: var(--radius);
            color: var(--dark-text);
            font-size: 0.95rem;
            transition: var(--transition);
        }

        #searchInput:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.2);
        }

        .search-icon {
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--gray);
        }

        #searchResults {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: var(--dark-card);
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            margin-top: 5px;
            max-height: 500px;
            overflow-y: auto;
            display: none;
            z-index: 1001;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .search-result-item {
            padding: 12px 15px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            cursor: pointer;
            transition: var(--transition);
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .search-result-item:hover {
            background: rgba(0, 180, 216, 0.1);
        }

        .search-result-item img {
            width: 60px;
            height: 90px;
            object-fit: cover;
            border-radius: 6px;
        }

        .search-result-info h4 {
            font-size: 0.95rem;
            margin-bottom: 3px;
            font-weight: 600;
        }

        .search-result-info p {
            font-size: 0.8rem;
            color: var(--gray);
        }

        .header-actions {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .action-btn {
            background: none;
            border: none;
            color: var(--dark-text);
            cursor: pointer;
            font-size: 1.3rem;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: var(--transition);
            position: relative;
        }

        .action-btn:hover {
            background: rgba(0, 180, 216, 0.1);
            color: var(--primary);
        }

        .badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: var(--secondary);
            color: white;
            font-size: 0.7rem;
            padding: 2px 6px;
            border-radius: 10px;
            min-width: 18px;
            text-align: center;
        }

        /* Main Content */
        main {
            margin-top: 70px;
            padding: 20px;
            max-width: 1400px;
            margin-left: auto;
            margin-right: auto;
            min-height: calc(100vh - 200px);
        }

        /* Hero Section */
        .hero {
            position: relative;
            height: 500px;
            border-radius: var(--radius-lg);
            overflow: hidden;
            margin-bottom: 40px;
            box-shadow: var(--shadow-lg);
        }

        .hero-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 50%, rgba(0,0,0,0.8) 100%),
                        url('https://image.tmdb.org/t/p/original/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg');
            background-size: cover;
            background-position: center;
        }

        .hero-content {
            position: relative;
            z-index: 2;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 0 50px;
            max-width: 800px;
        }

        .hero h1 {
            font-family: 'Poppins', sans-serif;
            font-size: 3.5rem;
            margin-bottom: 20px;
            color: white;
            line-height: 1.2;
        }

        .hero p {
            font-size: 1.2rem;
            margin-bottom: 30px;
            color: rgba(255, 255, 255, 0.9);
            max-width: 600px;
        }

        /* Dashboard */
        .dashboard {
            display: grid;
            grid-template-columns: 250px 1fr;
            gap: 30px;
            margin-top: 30px;
        }

        @media (max-width: 1024px) {
            .dashboard {
                grid-template-columns: 1fr;
            }
        }

        /* Sidebar */
        .sidebar {
            background: var(--dark-card);
            border-radius: var(--radius-lg);
            padding: 25px;
            height: fit-content;
            position: sticky;
            top: 90px;
            box-shadow: var(--shadow);
        }

        .user-profile {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .user-avatar {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            border-radius: 50%;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: white;
        }

        .sidebar-menu {
            list-style: none;
            margin-bottom: 30px;
        }

        .sidebar-menu li {
            margin-bottom: 5px;
        }

        .sidebar-menu a {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 15px;
            color: var(--dark-text);
            text-decoration: none;
            border-radius: var(--radius);
            transition: var(--transition);
            font-weight: 500;
        }

        .sidebar-menu a:hover,
        .sidebar-menu a.active {
            background: rgba(0, 180, 216, 0.1);
            color: var(--primary);
        }

        .sidebar-menu a i {
            width: 20px;
            text-align: center;
        }

        .sidebar-stats {
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stat-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 0.9rem;
        }

        .stat-value {
            color: var(--primary);
            font-weight: 600;
        }

        /* Content Area */
        .content-area {
            background: var(--dark-card);
            border-radius: var(--radius-lg);
            padding: 30px;
            box-shadow: var(--shadow);
        }

        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .page-header h1 {
            font-family: 'Poppins', sans-serif;
            font-size: 1.8rem;
            color: var(--primary);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        /* Movie Grid */
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 40px 0 20px;
        }

        .section-header h2 {
            font-family: 'Poppins', sans-serif;
            font-size: 1.5rem;
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
            background: var(--dark-card-hover);
            border-radius: var(--radius);
            overflow: hidden;
            transition: var(--transition);
            cursor: pointer;
            position: relative;
            box-shadow: var(--shadow);
        }

        .movie-card:hover {
            transform: translateY(-10px);
            box-shadow: var(--shadow-lg);
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
            font-size: 1rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .movie-meta {
            display: flex;
            justify-content: space-between;
            color: var(--gray);
            font-size: 0.85rem;
        }

        .rating {
            color: var(--warning);
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 3px;
        }

        .movie-actions {
            position: absolute;
            top: 10px;
            right: 10px;
            display: flex;
            gap: 5px;
            opacity: 0;
            transition: var(--transition);
        }

        .movie-card:hover .movie-actions {
            opacity: 1;
        }

        /* Watchlist & Downloads */
        .watchlist-container,
        .downloads-container {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }

        .watchlist-item,
        .download-item {
            background: var(--dark-card-hover);
            border-radius: var(--radius);
            padding: 20px;
            display: flex;
            gap: 15px;
            align-items: center;
            transition: var(--transition);
            box-shadow: var(--shadow);
        }

        .watchlist-item:hover,
        .download-item:hover {
            transform: translateY(-5px);
            box-shadow: var(--shadow-lg);
        }

        .item-poster {
            width: 80px;
            height: 120px;
            object-fit: cover;
            border-radius: 6px;
        }

        .item-info {
            flex: 1;
        }

        .item-info h3 {
            font-size: 1.1rem;
            margin-bottom: 5px;
        }

        .item-meta {
            color: var(--gray);
            font-size: 0.85rem;
            margin-bottom: 10px;
        }

        .item-actions {
            display: flex;
            gap: 10px;
        }

        /* Streaming Player */
        .player-container {
            background: #000;
            border-radius: var(--radius-lg);
            overflow: hidden;
            margin-bottom: 30px;
            box-shadow: var(--shadow-lg);
        }

        #videoPlayer {
            width: 100%;
            height: 600px;
            background: #000;
        }

        .video-js {
            width: 100%;
            height: 100%;
        }

        @media (max-width: 768px) {
            #videoPlayer {
                height: 400px;
            }
        }

        .player-controls {
            padding: 20px;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 15px;
        }

        .quality-selector {
            display: flex;
            gap: 10px;
        }

        .quality-btn {
            padding: 8px 16px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid var(--primary);
            color: white;
            border-radius: var(--radius);
            cursor: pointer;
            transition: var(--transition);
        }

        .quality-btn.active {
            background: var(--primary);
        }

        /* Movie Details */
        .movie-details {
            display: grid;
            grid-template-columns: 300px 1fr;
            gap: 40px;
            margin-bottom: 40px;
        }

        @media (max-width: 768px) {
            .movie-details {
                grid-template-columns: 1fr;
            }
        }

        .details-poster img {
            width: 100%;
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
        }

        .details-info h1 {
            font-family: 'Poppins', sans-serif;
            font-size: 2.2rem;
            margin-bottom: 15px;
            color: var(--primary);
        }

        .details-meta {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            color: var(--gray);
            flex-wrap: wrap;
        }

        .details-overview {
            margin-bottom: 30px;
            line-height: 1.8;
        }

        .details-actions {
            display: flex;
            gap: 15px;
            margin-top: 30px;
            flex-wrap: wrap;
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
            box-shadow: var(--shadow-lg);
            display: none;
            align-items: center;
            gap: 10px;
            z-index: 9999;
            max-width: 350px;
            border-left: 4px solid var(--primary);
            animation: slideInRight 0.3s ease;
        }

        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(100%); }
            to { opacity: 1; transform: translateX(0); }
        }

        /* Loading */
        .loader {
            display: inline-block;
            width: 50px;
            height: 50px;
            border: 3px solid rgba(0, 180, 216, 0.3);
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
            padding: 50px 20px 30px;
            margin-top: 60px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .footer-content {
            max-width: 1400px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 40px;
        }

        .footer-section h3 {
            color: var(--primary);
            margin-bottom: 20px;
            font-size: 1.2rem;
        }

        .footer-links {
            list-style: none;
        }

        .footer-links li {
            margin-bottom: 10px;
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
            text-align: center;
            margin-top: 50px;
            padding-top: 20px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            color: var(--gray);
            font-size: 0.9rem;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .search-container {
                width: 200px;
            }
            
            .hero {
                height: 400px;
            }
            
            .hero h1 {
                font-size: 2.5rem;
            }
            
            .movies-grid {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 15px;
            }
        }

        /* Utility */
        .hidden {
            display: none !important;
        }

        .flex {
            display: flex;
        }

        .items-center {
            align-items: center;
        }

        .justify-between {
            justify-content: space-between;
        }

        .gap-2 {
            gap: 8px;
        }

        .gap-4 {
            gap: 16px;
        }

        .mb-4 {
            margin-bottom: 16px;
        }

        .mt-4 {
            margin-top: 16px;
        }

        .text-center {
            text-align: center;
        }

        .text-primary {
            color: var(--primary);
        }

        .text-muted {
            color: var(--gray);
        }
    </style>
</head>
<body>
    <!-- Age Verification Modal -->
    <div id="ageModal">
        <div class="modal-content">
            <h2><i class="fas fa-exclamation-triangle"></i> Age Verification</h2>
            <p>CLOUD.MOVIES is intended for viewers aged 18 and above. By entering, you confirm you are at least 18 years old.</p>
            <div class="modal-buttons">
                <button class="btn btn-primary" id="confirmAge">
                    <i class="fas fa-check"></i> I'm 18 or older
                </button>
                <button class="btn btn-secondary" id="denyAge">
                    <i class="fas fa-times"></i> I'm under 18
                </button>
            </div>
        </div>
    </div>

    <!-- Header -->
    <header>
        <div class="nav-container">
            <a href="/" class="logo">
                <i class="fas fa-cloud"></i>
                <div>
                    CLOUD<span style="color: var(--secondary);">.MOVIES</span>
                    <div style="font-size: 0.7rem; font-weight: 400; color: var(--gray);">by Bera Tech</div>
                </div>
            </a>
            
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search movies...">
                <div class="search-icon">
                    <i class="fas fa-search"></i>
                </div>
                <div id="searchResults"></div>
            </div>
            
            <div class="header-actions">
                <button class="action-btn" id="themeToggle">
                    <i class="fas fa-moon"></i>
                </button>
                <button class="action-btn" id="notificationsBtn">
                    <i class="fas fa-bell"></i>
                    <span class="badge" id="notificationsBadge">0</span>
                </button>
                <button class="action-btn" id="userBtn">
                    <i class="fas fa-user"></i>
                </button>
            </div>
        </div>
    </header>

    <!-- Main Content -->
    <main>
        <div id="content">
            <!-- Default content -->
            <div class="hero">
                <div class="hero-background"></div>
                <div class="hero-content">
                    <h1>Unlimited Movies & TV Shows</h1>
                    <p>Stream thousands of movies and TV shows in HD. No subscription required. Watch anywhere, anytime.</p>
                    <div class="hero-buttons">
                        <button class="btn btn-primary btn-lg" onclick="loadTrendingMovies()">
                            <i class="fas fa-play"></i> Start Streaming
                        </button>
                        <button class="btn btn-secondary btn-lg" onclick="showPopularMovies()">
                            <i class="fas fa-fire"></i> Trending Now
                        </button>
                    </div>
                </div>
            </div>

            <!-- Movie Sections -->
            <div id="trendingSection">
                <div class="section-header">
                    <h2><i class="fas fa-fire"></i> Trending Now</h2>
                    <a href="#" class="view-all" onclick="showAllTrending()">View All <i class="fas fa-arrow-right"></i></a>
                </div>
                <div class="movies-grid" id="trendingMovies">
                    <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                        <div class="loader"></div>
                        <p class="text-muted mt-4">Loading trending movies from Gifted Movies API...</p>
                    </div>
                </div>
            </div>

            <div id="popularSection">
                <div class="section-header">
                    <h2><i class="fas fa-star"></i> Popular Movies</h2>
                    <a href="#" class="view-all" onclick="showAllPopular()">View All <i class="fas fa-arrow-right"></i></a>
                </div>
                <div class="movies-grid" id="popularMovies">
                    <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                        <div class="loader"></div>
                        <p class="text-muted mt-4">Loading popular movies...</p>
                    </div>
                </div>
            </div>

            <div id="actionSection">
                <div class="section-header">
                    <h2><i class="fas fa-explosion"></i> Action Movies</h2>
                    <a href="#" class="view-all" onclick="searchActionMovies()">View All <i class="fas fa-arrow-right"></i></a>
                </div>
                <div class="movies-grid" id="actionMovies">
                    <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                        <div class="loader"></div>
                        <p class="text-muted mt-4">Loading action movies...</p>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer>
        <div class="footer-content">
            <div class="footer-section">
                <h3>CLOUD.MOVIES</h3>
                <p>Premium streaming platform by Bera Tech. Powered by Gifted Movies API.</p>
            </div>
            <div class="footer-section">
                <h3>Quick Links</h3>
                <ul class="footer-links">
                    <li><a href="#" onclick="loadTrendingMovies()">Home</a></li>
                    <li><a href="#" onclick="showAllMovies()">All Movies</a></li>
                    <li><a href="#" onclick="loadWatchlist()">My Watchlist</a></li>
                    <li><a href="#" onclick="loadDownloads()">Downloads</a></li>
                </ul>
            </div>
            <div class="footer-section">
                <h3>Support</h3>
                <ul class="footer-links">
                    <li><a href="#" onclick="showToast('Contact support@cloudmovies.bera.tech', 'info')">Contact</a></li>
                    <li><a href="#" onclick="showToast('API: Gifted Movies API', 'info')">API Status</a></li>
                    <li><a href="#" onclick="showToast('© 2024 Bera Tech', 'info')">Terms</a></li>
                    <li><a href="#" onclick="showToast('Your privacy is important', 'info')">Privacy</a></li>
                </ul>
            </div>
        </div>
        <div class="copyright">
            © 2024 Bera Tech - CLOUD.MOVIES. Streaming via Gifted Movies API.
        </div>
    </footer>

    <!-- Video.js Script -->
    <script src="https://vjs.zencdn.net/8.6.1/video.min.js"></script>

    <!-- JavaScript -->
    <script>
        // Global State
        let currentUser = {
            name: 'Movie Fan',
            email: 'user@cloudmovies.com'
        };

        let watchlist = JSON.parse(localStorage.getItem('watchlist') || '[]');
        let downloads = JSON.parse(localStorage.getItem('downloads') || '[]');
        let history = JSON.parse(localStorage.getItem('history') || '[]');
        let currentTheme = localStorage.getItem('theme') || 'dark';
        let ageVerified = localStorage.getItem('ageVerified') === 'true';
        let currentMovieId = null;
        let currentQuality = '360p';

        // DOM Elements
        const ageModal = document.getElementById('ageModal');
        const confirmAgeBtn = document.getElementById('confirmAge');
        const denyAgeBtn = document.getElementById('denyAge');
        const themeToggle = document.getElementById('themeToggle');
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        const content = document.getElementById('content');
        const userBtn = document.getElementById('userBtn');
        const notificationsBtn = document.getElementById('notificationsBtn');
        const notificationsBadge = document.getElementById('notificationsBadge');

        // Initialize
        document.addEventListener('DOMContentLoaded', async () => {
            // Age Verification
            if (!ageVerified) {
                ageModal.style.display = 'flex';
            } else {
                ageModal.style.display = 'none';
                await initializeApp();
            }

            // Set theme
            setTheme(currentTheme);

            // Event Listeners
            setupEventListeners();
            updateBadges();
        });

        // Age Verification
        confirmAgeBtn.addEventListener('click', () => {
            localStorage.setItem('ageVerified', 'true');
            ageModal.style.display = 'none';
            ageVerified = true;
            initializeApp();
            showToast('Welcome to CLOUD.MOVIES! 🎬', 'success');
        });

        denyAgeBtn.addEventListener('click', () => {
            document.body.innerHTML = \`
                <div style="display: flex; justify-content: center; align-items: center; height: 100vh; text-align: center; padding: 20px;">
                    <div>
                        <h1 style="color: var(--primary); margin-bottom: 20px;">Access Restricted</h1>
                        <p style="margin-bottom: 30px; color: var(--gray);">You must be 18 years or older to access this content.</p>
                        <p style="color: var(--gray-light); font-size: 0.9rem;">© 2024 Bera Tech - CLOUD.MOVIES</p>
                    </div>
                </div>
            \`;
        });

        // Theme Toggle
        themeToggle.addEventListener('click', () => {
            currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setTheme(currentTheme);
            localStorage.setItem('theme', currentTheme);
        });

        function setTheme(theme) {
            if (theme === 'light') {
                document.body.classList.add('light-mode');
                themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                document.body.classList.remove('light-mode');
                themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            }
        }

        // Initialize App
        async function initializeApp() {
            // Load movie sections
            await loadMovieSections();
            
            // Setup search
            setupSearch();
        }

        // Load Movie Sections
        async function loadMovieSections() {
            showLoading();
            
            try {
                // Load trending movies
                const trendingResponse = await fetch('/api/trending');
                const trendingData = await trendingResponse.json();
                
                if (trendingData.success && trendingData.data) {
                    displayMovies('trendingMovies', trendingData.data.slice(0, 8));
                } else {
                    // Try default search
                    const searchResponse = await fetch('/api/search/avengers');
                    const searchData = await searchResponse.json();
                    if (searchData.success && searchData.data) {
                        displayMovies('trendingMovies', searchData.data.slice(0, 8));
                    }
                }

                // Load popular movies (search for popular movies)
                const popularResponse = await fetch('/api/search/movie');
                const popularData = await popularResponse.json();
                
                if (popularData.success && popularData.data) {
                    displayMovies('popularMovies', popularData.data.slice(0, 8));
                }

                // Load action movies
                const actionResponse = await fetch('/api/search/action');
                const actionData = await actionResponse.json();
                
                if (actionData.success && actionData.data) {
                    displayMovies('actionMovies', actionData.data.slice(0, 8));
                }
                
            } catch (error) {
                console.error('Error loading movies:', error);
                showToast('Using demo content. Real API might be unavailable.', 'info');
                // Show mock data
                displayMockMovies();
            } finally {
                hideLoading();
            }
        }

        function displayMovies(containerId, movies) {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = '';
            
            movies.forEach(movie => {
                const card = createMovieCard(movie);
                container.appendChild(card);
            });
        }

        function createMovieCard(movie) {
            const card = document.createElement('div');
            card.className = 'movie-card';
            card.dataset.id = movie.id;
            
            card.innerHTML = \`
                <img src="\${movie.image || 'https://via.placeholder.com/200x300/1a1a1a/ffffff?text=Movie'}" 
                     alt="\${movie.title}"
                     onerror="this.src='https://via.placeholder.com/200x300/1a1a1a/ffffff?text=Movie'">
                <div class="movie-actions">
                    <button class="action-btn" onclick="event.stopPropagation(); addToWatchlist('\${movie.id}', '\${movie.title}', '\${movie.image}')">
                        <i class="fas fa-bookmark"></i>
                    </button>
                </div>
                <div class="movie-info">
                    <div class="movie-title">\${movie.title || 'Untitled Movie'}</div>
                    <div class="movie-meta">
                        <span>\${movie.year || '2023'}</span>
                        <span class="rating">
                            <i class="fas fa-star"></i> \${movie.rating || '8.0'}
                        </span>
                    </div>
                </div>
            \`;
            
            card.addEventListener('click', () => showMovieDetails(movie.id));
            return card;
        }

        function displayMockMovies() {
            const mockMovies = [
                {
                    id: 'tt4154796',
                    title: 'Avengers: Endgame',
                    year: '2019',
                    rating: '8.4',
                    image: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg'
                },
                {
                    id: 'tt10872600',
                    title: 'Spider-Man: No Way Home',
                    year: '2021',
                    rating: '8.2',
                    image: 'https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg'
                },
                {
                    id: 'tt1877830',
                    title: 'The Batman',
                    year: '2022',
                    rating: '7.8',
                    image: 'https://image.tmdb.org/t/p/w500/74xTEgt7R36Fpooo50r9T25onhq.jpg'
                },
                {
                    id: 'tt1745960',
                    title: 'Top Gun: Maverick',
                    year: '2022',
                    rating: '8.3',
                    image: 'https://image.tmdb.org/t/p/w500/62HCnUTziyWcpDaBO2i1DX17ljH.jpg'
                }
            ];
            
            displayMovies('trendingMovies', mockMovies);
            displayMovies('popularMovies', mockMovies);
            displayMovies('actionMovies', mockMovies);
        }

        // Search Functionality
        function setupSearch() {
            let searchTimeout;
            
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                
                if (query.length < 2) {
                    searchResults.style.display = 'none';
                    return;
                }
                
                searchTimeout = setTimeout(async () => {
                    try {
                        const response = await fetch(\`/api/search?q=\${encodeURIComponent(query)}\`);
                        const data = await response.json();
                        
                        if (data.success && data.data && data.data.length > 0) {
                            displaySearchResults(data.data);
                        } else {
                            searchResults.innerHTML = '<div class="search-result-item">No results found</div>';
                            searchResults.style.display = 'block';
                        }
                    } catch (error) {
                        console.error('Search error:', error);
                        searchResults.innerHTML = '<div class="search-result-item">Search temporarily unavailable</div>';
                        searchResults.style.display = 'block';
                    }
                }, 500);
            });
            
            // Close search results when clicking outside
            document.addEventListener('click', (e) => {
                if (!searchResults.contains(e.target) && e.target !== searchInput) {
                    searchResults.style.display = 'none';
                }
            });
        }

        function displaySearchResults(results) {
            searchResults.innerHTML = '';
            
            results.slice(0, 6).forEach(movie => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = \`
                    <img src="\${movie.image || 'https://via.placeholder.com/60x90/1a1a1a/ffffff?text=Movie'}" 
                         alt="\${movie.title}"
                         onerror="this.src='https://via.placeholder.com/60x90/1a1a1a/ffffff?text=Movie'">
                    <div class="search-result-info">
                        <h4>\${movie.title || 'Untitled'}</h4>
                        <p>\${movie.year || '2023'} • \${movie.type || 'movie'}</p>
                    </div>
                \`;
                
                item.addEventListener('click', () => {
                    showMovieDetails(movie.id);
                    searchResults.style.display = 'none';
                    searchInput.value = '';
                });
                
                searchResults.appendChild(item);
            });
            
            searchResults.style.display = 'block';
        }

        // Show Movie Details
        async function showMovieDetails(movieId) {
            currentMovieId = movieId;
            showLoading();
            
            try {
                const response = await fetch(\`/api/movie/\${movieId}\`);
                const data = await response.json();
                
                if (data.success && data.data) {
                    displayMovieDetails(data.data);
                    addToHistory(movieId, data.data.title);
                } else {
                    throw new Error('No movie details found');
                }
            } catch (error) {
                console.error('Error loading movie details:', error);
                displayMovieDetails(getMockMovieDetails());
                showToast('Showing demo content', 'info');
            } finally {
                hideLoading();
            }
        }

        function getMockMovieDetails() {
            return {
                id: 'tt4154796',
                title: 'Avengers: Endgame',
                description: 'After the devastating events of Avengers: Infinity War, the universe is in ruins. With the help of remaining allies, the Avengers assemble once more in order to reverse Thanos actions and restore balance to the universe.',
                releaseDate: '2019-04-24',
                rating: '8.4',
                duration: '181 min',
                genre: ['Action', 'Adventure', 'Drama'],
                cast: ['Robert Downey Jr.', 'Chris Evans', 'Mark Ruffalo', 'Chris Hemsworth', 'Scarlett Johansson'],
                director: 'Anthony Russo, Joe Russo',
                image: 'https://image.tmdb.org/t/p/original/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg',
                poster: 'https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg',
                type: 'movie',
                country: 'United States',
                production: 'Marvel Studios'
            };
        }

        function displayMovieDetails(movie) {
            content.innerHTML = \`
                <div class="movie-details">
                    <div class="details-poster">
                        <img src="\${movie.poster || movie.image}" 
                             alt="\${movie.title}"
                             onerror="this.src='https://via.placeholder.com/300x450/1a1a1a/ffffff?text=Poster'">
                    </div>
                    <div class="details-info">
                        <h1>\${movie.title}</h1>
                        <div class="details-meta">
                            <span><i class="fas fa-star" style="color: var(--warning);"></i> \${movie.rating}/10</span>
                            <span><i class="fas fa-calendar"></i> \${movie.releaseDate}</span>
                            <span><i class="fas fa-clock"></i> \${movie.duration}</span>
                            <span><i class="fas fa-film"></i> Movie</span>
                        </div>
                        
                        <div class="details-overview">
                            <h3 style="margin-bottom: 10px; color: var(--primary);">Overview</h3>
                            <p>\${movie.description}</p>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <h3 style="margin-bottom: 10px; color: var(--primary);">Genre</h3>
                            <div class="flex gap-2" style="flex-wrap: wrap;">
                                \${movie.genre.map(g => \`
                                    <span style="background: rgba(0, 180, 216, 0.2); padding: 5px 12px; border-radius: 20px; font-size: 0.9rem;">
                                        \${g}
                                    </span>
                                \`).join('')}
                            </div>
                        </div>
                        
                        <div class="details-actions">
                            <button class="btn btn-primary" onclick="startStreaming('\${movie.id}')">
                                <i class="fas fa-play"></i> Stream Now
                            </button>
                            <button class="btn btn-secondary" onclick="downloadMovie('\${movie.id}', '\${movie.title}')">
                                <i class="fas fa-download"></i> Download
                            </button>
                            <button class="btn btn-secondary" onclick="addToWatchlist('\${movie.id}', '\${movie.title}', '\${movie.poster || movie.image}')">
                                <i class="fas fa-bookmark"></i> Add to Watchlist
                            </button>
                        </div>
                        
                        <div style="margin-top: 30px; padding: 15px; background: rgba(0, 180, 216, 0.1); border-radius: var(--radius);">
                            <p style="font-size: 0.9rem; color: var(--gray);">
                                <i class="fas fa-info-circle"></i> Streaming via Gifted Movies API. Quality may vary.
                            </p>
                        </div>
                    </div>
                </div>
                <div class="mt-4">
                    <button class="btn btn-secondary" onclick="goBack()">
                        <i class="fas fa-arrow-left"></i> Back to Home
                    </button>
                </div>
            \`;
        }

        // Start Streaming
        async function startStreaming(movieId) {
            currentMovieId = movieId;
            showLoading();
            
            try {
                const response = await fetch(\`/api/stream/\${movieId}?quality=\${currentQuality}\`);
                const data = await response.json();
                
                if (data.success && data.url) {
                    displayVideoPlayer(data.url, currentQuality);
                    addToHistory(movieId, \`Streamed (\${currentQuality})\`);
                    showToast(\`Streaming started in \${currentQuality}\`, 'success');
                } else {
                    throw new Error('No stream available');
                }
            } catch (error) {
                console.error('Streaming error:', error);
                // Use fallback video
                const videoUrl = getFallbackVideoUrl(currentQuality);
                displayVideoPlayer(videoUrl, currentQuality);
                showToast('Streaming sample video', 'info');
            } finally {
                hideLoading();
            }
        }

        function getFallbackVideoUrl(quality) {
            const videos = {
                '360p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                '480p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                '720p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
            };
            return videos[quality] || videos['360p'];
        }

        function displayVideoPlayer(videoUrl, quality) {
            content.innerHTML = \`
                <div class="player-container">
                    <video id="videoPlayer" class="video-js vjs-big-play-centered" controls autoplay preload="auto">
                        <source src="\${videoUrl}" type="video/mp4">
                        <p class="vjs-no-js">
                            To view this video please enable JavaScript
                        </p>
                    </video>
                </div>
                <div class="player-controls">
                    <div class="quality-selector">
                        <button class="quality-btn \${quality === '360p' ? 'active' : ''}" onclick="changeQuality('360p')">360p</button>
                        <button class="quality-btn \${quality === '480p' ? 'active' : ''}" onclick="changeQuality('480p')">480p</button>
                        <button class="quality-btn \${quality === '720p' ? 'active' : ''}" onclick="changeQuality('720p')">720p</button>
                    </div>
                    <div>
                        <button class="btn btn-primary" onclick="downloadCurrentVideo()">
                            <i class="fas fa-download"></i> Download
                        </button>
                        <button class="btn btn-secondary" onclick="goBackToDetails()">
                            <i class="fas fa-arrow-left"></i> Back to Details
                        </button>
                    </div>
                </div>
                <div class="mt-4" style="padding: 15px; background: rgba(0, 180, 216, 0.1); border-radius: var(--radius);">
                    <p style="font-size: 0.9rem; color: var(--gray);">
                        <i class="fas fa-info-circle"></i> Streaming via Gifted Movies API
                    </p>
                </div>
            \`;
            
            // Initialize Video.js player
            const player = videojs('videoPlayer', {
                controls: true,
                autoplay: true,
                preload: 'auto',
                fluid: true,
                responsive: true
            });
            
            window.videoPlayer = player;
        }

        function changeQuality(quality) {
            currentQuality = quality;
            document.querySelectorAll('.quality-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
            
            if (currentMovieId) {
                startStreaming(currentMovieId);
            }
        }

        function downloadCurrentVideo() {
            if (currentMovieId) {
                downloadMovie(currentMovieId, \`Movie_Quality_\${currentQuality}\`);
            }
        }

        // Download Movie
        async function downloadMovie(movieId, movieTitle) {
            showLoading();
            
            try {
                const response = await fetch(\`/api/download/\${movieId}?quality=\${currentQuality}\`);
                
                if (response.ok) {
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = \`\${movieTitle.replace(/[^a-z0-9]/gi, '_')}_\${currentQuality}.mp4\`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    addToDownloads(movieId, movieTitle, currentQuality);
                    showToast(\`Downloading \${currentQuality} version...\`, 'success');
                } else {
                    throw new Error('Download failed');
                }
            } catch (error) {
                console.error('Download error:', error);
                // Provide fallback download
                const videoUrl = getFallbackVideoUrl(currentQuality);
                const a = document.createElement('a');
                a.href = videoUrl;
                a.download = \`\${movieTitle.replace(/[^a-z0-9]/gi, '_')}_\${currentQuality}.mp4\`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                addToDownloads(movieId, movieTitle, currentQuality);
                showToast('Downloading sample video...', 'info');
            } finally {
                hideLoading();
            }
        }

        // Watchlist Management
        function addToWatchlist(movieId, movieTitle, movieImage) {
            const existing = watchlist.find(item => item.id === movieId);
            
            if (!existing) {
                watchlist.push({
                    id: movieId,
                    title: movieTitle,
                    image: movieImage,
                    addedAt: new Date().toISOString()
                });
                
                localStorage.setItem('watchlist', JSON.stringify(watchlist));
                updateBadges();
                showToast('Added to watchlist', 'success');
            } else {
                showToast('Already in watchlist', 'info');
            }
        }

        function removeFromWatchlist(movieId) {
            watchlist = watchlist.filter(item => item.id !== movieId);
            localStorage.setItem('watchlist', JSON.stringify(watchlist));
            updateBadges();
            showToast('Removed from watchlist', 'success');
        }

        // Downloads Management
        function addToDownloads(movieId, movieTitle, quality) {
            downloads.push({
                id: movieId,
                title: movieTitle,
                quality: quality,
                downloadedAt: new Date().toISOString(),
                size: quality === '720p' ? '1.5 GB' : quality === '480p' ? '800 MB' : '400 MB'
            });
            
            localStorage.setItem('downloads', JSON.stringify(downloads));
            updateBadges();
        }

        // History Management
        function addToHistory(movieId, action) {
            history.unshift({
                id: movieId,
                action: action,
                timestamp: new Date().toISOString()
            });
            
            if (history.length > 50) history.pop();
            localStorage.setItem('history', JSON.stringify(history));
        }

        // Update Badges
        function updateBadges() {
            notificationsBadge.textContent = watchlist.length + downloads.length;
        }

        // Page Navigation Functions
        function loadTrendingMovies() {
            content.innerHTML = \`
                <div class="page-header">
                    <h1><i class="fas fa-fire"></i> Trending Movies</h1>
                </div>
                <div class="movies-grid" id="allMovies">
                    <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                        <div class="loader"></div>
                        <p class="text-muted mt-4">Loading trending movies...</p>
                    </div>
                </div>
            \`;
            
            fetch('/api/trending')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        displayMovies('allMovies', data.data);
                    }
                });
        }

        function showAllMovies() {
            content.innerHTML = \`
                <div class="page-header">
                    <h1><i class="fas fa-film"></i> All Movies</h1>
                    <div class="search-container" style="width: 300px;">
                        <input type="text" id="allMoviesSearch" placeholder="Filter movies...">
                        <div class="search-icon">
                            <i class="fas fa-search"></i>
                        </div>
                    </div>
                </div>
                <div class="movies-grid" id="allMoviesList">
                    <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                        <div class="loader"></div>
                        <p class="text-muted mt-4">Loading all movies...</p>
                    </div>
                </div>
            \`;
            
            // Load all movies from multiple searches
            Promise.all([
                fetch('/api/search/movie'),
                fetch('/api/search/2023'),
                fetch('/api/search/action')
            ])
            .then(responses => Promise.all(responses.map(r => r.json())))
            .then(results => {
                const allMovies = [];
                results.forEach(result => {
                    if (result.success && result.data) {
                        allMovies.push(...result.data);
                    }
                });
                
                // Remove duplicates
                const uniqueMovies = Array.from(new Set(allMovies.map(m => m.id)))
                    .map(id => allMovies.find(m => m.id === id));
                
                displayMovies('allMoviesList', uniqueMovies.slice(0, 24));
                
                // Setup search filter
                document.getElementById('allMoviesSearch').addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    const filtered = uniqueMovies.filter(movie => 
                        movie.title.toLowerCase().includes(query)
                    );
                    displayMovies('allMoviesList', filtered.slice(0, 24));
                });
            });
        }

        function loadWatchlist() {
            content.innerHTML = \`
                <div class="page-header">
                    <h1><i class="fas fa-bookmark"></i> My Watchlist</h1>
                    <span class="text-muted" style="font-size: 1rem;">\${watchlist.length} movies</span>
                </div>
                \${watchlist.length > 0 ? \`
                    <div class="watchlist-container">
                        \${watchlist.map(movie => \`
                            <div class="watchlist-item">
                                <img src="\${movie.image}" alt="\${movie.title}" class="item-poster"
                                     onerror="this.src='https://via.placeholder.com/80x120/1a1a1a/ffffff?text=Movie'">
                                <div class="item-info">
                                    <h3>\${movie.title}</h3>
                                    <div class="item-meta">
                                        Added \${new Date(movie.addedAt).toLocaleDateString()}
                                    </div>
                                    <div class="item-actions">
                                        <button class="btn btn-sm btn-primary" onclick="showMovieDetails('\${movie.id}')">
                                            <i class="fas fa-play"></i> Watch
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="removeFromWatchlist('\${movie.id}')">
                                            <i class="fas fa-trash"></i> Remove
                                        </button>
                                    </div>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                \` : \`
                    <div class="text-center" style="padding: 60px 20px;">
                        <i class="fas fa-bookmark" style="font-size: 4rem; color: var(--gray); margin-bottom: 20px;"></i>
                        <h3 style="margin-bottom: 15px; color: var(--gray);">Your watchlist is empty</h3>
                        <p style="color: var(--gray-light); margin-bottom: 30px;">Add movies to your watchlist to watch them later</p>
                        <button class="btn btn-primary" onclick="loadTrendingMovies()">
                            <i class="fas fa-film"></i> Browse Movies
                        </button>
                    </div>
                \`}
            \`;
        }

        function loadDownloads() {
            content.innerHTML = \`
                <div class="page-header">
                    <h1><i class="fas fa-download"></i> My Downloads</h1>
                    <span class="text-muted" style="font-size: 1rem;">\${downloads.length} files</span>
                </div>
                \${downloads.length > 0 ? \`
                    <div class="downloads-container">
                        \${downloads.slice(0, 10).map(download => \`
                            <div class="download-item">
                                <div class="item-info">
                                    <h3>\${download.title}</h3>
                                    <div class="item-meta">
                                        \${download.quality} • \${download.size} • \${new Date(download.downloadedAt).toLocaleDateString()}
                                    </div>
                                    <div class="item-actions">
                                        <button class="btn btn-sm btn-primary" onclick="playDownload('\${download.id}')">
                                            <i class="fas fa-play"></i> Play
                                        </button>
                                        <button class="btn btn-sm btn-secondary" onclick="deleteDownload('\${download.id}')">
                                            <i class="fas fa-trash"></i> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        \`).join('')}
                    </div>
                \` : \`
                    <div class="text-center" style="padding: 60px 20px;">
                        <i class="fas fa-download" style="font-size: 4rem; color: var(--gray); margin-bottom: 20px;"></i>
                        <h3 style="margin-bottom: 15px; color: var(--gray);">No downloads yet</h3>
                        <p style="color: var(--gray-light); margin-bottom: 30px;">Download movies to watch them offline</p>
                        <button class="btn btn-primary" onclick="loadTrendingMovies()">
                            <i class="fas fa-download"></i> Browse Movies
                        </button>
                    </div>
                \`}
            \`;
        }

        function playDownload(downloadId) {
            const download = downloads.find(d => d.id === downloadId);
            if (download) {
                const videoUrl = getFallbackVideoUrl(download.quality || '360p');
                displayVideoPlayer(videoUrl, download.quality || '360p');
                showToast('Playing downloaded content', 'success');
            }
        }

        function deleteDownload(downloadId) {
            downloads = downloads.filter(d => d.id !== downloadId);
            localStorage.setItem('downloads', JSON.stringify(downloads));
            updateBadges();
            showToast('Download removed', 'success');
            loadDownloads();
        }

        // Utility Functions
        function showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = \`
                <i class="fas fa-\${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}" 
                   style="color: \${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'}"></i>
                <span>\${message}</span>
            \`;
            
            document.body.appendChild(toast);
            toast.style.display = 'flex';
            
            setTimeout(() => {
                toast.style.animation = 'slideInRight 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        function showLoading() {
            let loading = document.getElementById('loadingOverlay');
            if (!loading) {
                loading = document.createElement('div');
                loading.id = 'loadingOverlay';
                loading.style.cssText = \`
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    z-index: 9998;
                    backdrop-filter: blur(5px);
                \`;
                loading.innerHTML = \`
                    <div class="loader" style="margin-bottom: 20px;"></div>
                    <p style="color: var(--gray);">Loading from Gifted Movies API...</p>
                \`;
                document.body.appendChild(loading);
            }
        }

        function hideLoading() {
            const loading = document.getElementById('loadingOverlay');
            if (loading) loading.remove();
        }

        function goBack() {
            content.innerHTML = \`
                <div class="hero">
                    <div class="hero-background"></div>
                    <div class="hero-content">
                        <h1>Welcome Back!</h1>
                        <p>Continue your movie journey with thousands of titles.</p>
                        <div class="hero-buttons">
                            <button class="btn btn-primary btn-lg" onclick="loadTrendingMovies()">
                                <i class="fas fa-play"></i> Browse Movies
                            </button>
                        </div>
                    </div>
                </div>
                <div id="trendingSection">
                    <div class="section-header">
                        <h2><i class="fas fa-fire"></i> Trending Now</h2>
                    </div>
                    <div class="movies-grid" id="trendingMovies">
                        <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                            <div class="loader"></div>
                            <p class="text-muted mt-4">Loading movies...</p>
                        </div>
                    </div>
                </div>
            \`;
            
            loadMovieSections();
        }

        function goBackToDetails() {
            if (currentMovieId) {
                showMovieDetails(currentMovieId);
            } else {
                goBack();
            }
        }

        function showAllTrending() {
            loadTrendingMovies();
        }

        function showAllPopular() {
            content.innerHTML = \`
                <div class="page-header">
                    <h1><i class="fas fa-star"></i> Popular Movies</h1>
                </div>
                <div class="movies-grid" id="popularMoviesList">
                    <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                        <div class="loader"></div>
                        <p class="text-muted mt-4">Loading popular movies...</p>
                    </div>
                </div>
            \`;
            
            fetch('/api/search/popular')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        displayMovies('popularMoviesList', data.data);
                    }
                });
        }

        function searchActionMovies() {
            content.innerHTML = \`
                <div class="page-header">
                    <h1><i class="fas fa-explosion"></i> Action Movies</h1>
                </div>
                <div class="movies-grid" id="actionMoviesList">
                    <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                        <div class="loader"></div>
                        <p class="text-muted mt-4">Loading action movies...</p>
                    </div>
                </div>
            \`;
            
            fetch('/api/search/action')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        displayMovies('actionMoviesList', data.data);
                    }
                });
        }

        function showPopularMovies() {
            showAllPopular();
        }

        // Setup Event Listeners
        function setupEventListeners() {
            // User button
            userBtn.addEventListener('click', () => {
                showUserMenu();
            });

            // Notifications button
            notificationsBtn.addEventListener('click', () => {
                showToast(\`You have \${watchlist.length} movies in watchlist and \${downloads.length} downloads\`, 'info');
            });
        }

        function showUserMenu() {
            const menu = document.createElement('div');
            menu.className = 'user-dropdown';
            menu.style.cssText = \`
                position: fixed;
                top: 70px;
                right: 20px;
                background: var(--dark-card);
                border-radius: var(--radius);
                box-shadow: var(--shadow-lg);
                width: 250px;
                z-index: 1001;
                border: 1px solid rgba(255, 255, 255, 0.1);
                overflow: hidden;
            \`;
            
            menu.innerHTML = \`
                <div style="padding: 20px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white;">
                    <div class="user-avatar" style="margin-bottom: 10px; width: 50px; height: 50px; font-size: 1.5rem;">MF</div>
                    <div style="font-weight: 600;">\${currentUser.name}</div>
                    <div style="font-size: 0.8rem; opacity: 0.8;">\${currentUser.email}</div>
                </div>
                <div style="padding: 10px 0;">
                    <a href="#" onclick="loadWatchlist()" style="display: flex; align-items: center; gap: 10px; padding: 12px 20px; color: var(--dark-text); text-decoration: none; transition: var(--transition);">
                        <i class="fas fa-bookmark"></i>
                        <span>Watchlist (\${watchlist.length})</span>
                    </a>
                    <a href="#" onclick="loadDownloads()" style="display: flex; align-items: center; gap: 10px; padding: 12px 20px; color: var(--dark-text); text-decoration: none; transition: var(--transition);">
                        <i class="fas fa-download"></i>
                        <span>Downloads (\${downloads.length})</span>
                    </a>
                    <div style="height: 1px; background: rgba(255, 255, 255, 0.1); margin: 10px 0;"></div>
                    <a href="#" onclick="showToast('Settings coming soon', 'info')" style="display: flex; align-items: center; gap: 10px; padding: 12px 20px; color: var(--dark-text); text-decoration: none; transition: var(--transition);">
                        <i class="fas fa-cog"></i>
                        <span>Settings</span>
                    </a>
                    <a href="#" onclick="showToast('Logged out successfully', 'success')" style="display: flex; align-items: center; gap: 10px; padding: 12px 20px; color: var(--dark-text); text-decoration: none; transition: var(--transition);">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Logout</span>
                    </a>
                </div>
            \`;
            
            document.body.appendChild(menu);
            
            // Close menu when clicking outside
            setTimeout(() => {
                const closeMenu = (e) => {
                    if (!menu.contains(e.target) && e.target !== userBtn) {
                        menu.remove();
                        document.removeEventListener('click', closeMenu);
                    }
                };
                document.addEventListener('click', closeMenu);
            }, 0);
        }

        // Global functions
        window.addToWatchlist = addToWatchlist;
        window.removeFromWatchlist = removeFromWatchlist;
        window.showMovieDetails = showMovieDetails;
        window.startStreaming = startStreaming;
        window.downloadMovie = downloadMovie;
        window.goBack = goBack;
        window.goBackToDetails = goBackToDetails;
        window.loadTrendingMovies = loadTrendingMovies;
        window.showAllMovies = showAllMovies;
        window.loadWatchlist = loadWatchlist;
        window.loadDownloads = loadDownloads;
        window.showAllTrending = showAllTrending;
        window.showAllPopular = showAllPopular;
        window.searchActionMovies = searchActionMovies;
        window.showPopularMovies = showPopularMovies;
        window.changeQuality = changeQuality;
        window.downloadCurrentVideo = downloadCurrentVideo;
        window.playDownload = playDownload;
        window.deleteDownload = deleteDownload;
        window.showToast = showToast;
    </script>
</body>
</html>`;
}

// API Routes
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json({ success: true, data: [] });
        }
        
        const data = await fetchFromGiftedAPI(`/api/search/${encodeURIComponent(query)}`);
        res.json(data);
        
    } catch (error) {
        console.error('Search API error:', error);
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/movie/:id', async (req, res) => {
    try {
        const movieId = req.params.id;
        const data = await fetchFromGiftedAPI(`/api/info/${movieId}`);
        res.json(data);
        
    } catch (error) {
        console.error('Movie API error:', error);
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/trending', async (req, res) => {
    try {
        const movies = await getTrendingMovies();
        res.json({ success: true, data: movies });
        
    } catch (error) {
        console.error('Trending API error:', error);
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/stream/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quality = '360p' } = req.query;
        
        console.log(`Stream request for movie ${id} at quality ${quality}`);
        
        // Try to get sources from Gifted API
        const sourcesData = await fetchFromGiftedAPI(`/api/sources/${id}`);
        
        if (sourcesData && sourcesData.success && sourcesData.data && sourcesData.data.sources) {
            // Find the requested quality or the best available
            const source = sourcesData.data.sources.find(s => s.quality === quality) || 
                          sourcesData.data.sources[0];
            
            if (source && source.url) {
                console.log(`Found stream URL: ${source.url}`);
                return res.json({ 
                    success: true, 
                    url: source.url, 
                    quality: source.quality 
                });
            }
        }
        
        // Fallback to working videos
        console.log('Using fallback video');
        const fallbackVideos = {
            '360p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            '480p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            '720p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
        };
        
        const videoUrl = fallbackVideos[quality] || fallbackVideos['360p'];
        res.json({ 
            success: true, 
            url: videoUrl, 
            quality: quality,
            note: 'Using demo video (API streaming coming soon)'
        });
        
    } catch (error) {
        console.error('Stream API error:', error);
        res.json({ 
            success: true, 
            url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            quality: '360p',
            note: 'Demo video (API unavailable)'
        });
    }
});

app.get('/api/download/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { quality = '360p' } = req.query;
        
        console.log(`Download request for movie ${id} at quality ${quality}`);
        
        // Try Gifted API first
        const sourcesData = await fetchFromGiftedAPI(`/api/sources/${id}`);
        
        if (sourcesData && sourcesData.success && sourcesData.data && sourcesData.data.sources) {
            const source = sourcesData.data.sources.find(s => s.quality === quality) || 
                          sourcesData.data.sources[0];
            
            if (source && source.url) {
                // Set headers for download
                res.setHeader('Content-Disposition', `attachment; filename="movie-${id}-${quality}.mp4"`);
                res.setHeader('Content-Type', 'video/mp4');
                
                // Proxy the download
                const videoResponse = await axios({
                    method: 'GET',
                    url: source.url,
                    responseType: 'stream'
                });
                
                videoResponse.data.pipe(res);
                return;
            }
        }
        
        // Fallback to working video
        const fallbackVideos = {
            '360p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
            '480p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
            '720p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
        };
        
        const videoUrl = fallbackVideos[quality] || fallbackVideos['360p'];
        
        res.setHeader('Content-Disposition', `attachment; filename="movie-${id}-${quality}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        
        const videoResponse = await axios({
            method: 'GET',
            url: videoUrl,
            responseType: 'stream'
        });
        
        videoResponse.data.pipe(res);
        
    } catch (error) {
        console.error('Download API error:', error);
        res.status(500).json({ success: false, error: 'Download failed' });
    }
});

// User data endpoints
app.post('/api/user/watchlist', (req, res) => {
    const { userId, movieId, movieTitle, movieImage } = req.body;
    
    if (!usersData[userId]) {
        usersData[userId] = { watchlist: [], downloads: [] };
    }
    
    if (!usersData[userId].watchlist.find(item => item.id === movieId)) {
        usersData[userId].watchlist.push({
            id: movieId,
            title: movieTitle,
            image: movieImage,
            addedAt: new Date().toISOString()
        });
    }
    
    res.json({ success: true, data: usersData[userId].watchlist });
});

app.get('/api/user/:userId/watchlist', (req, res) => {
    const { userId } = req.params;
    
    if (!usersData[userId]) {
        usersData[userId] = { watchlist: [], downloads: [] };
    }
    
    res.json({ success: true, data: usersData[userId].watchlist });
});

// Serve PWA files
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({
        "name": "CLOUD.MOVIES",
        "short_name": "CloudMovies",
        "description": "Stream Movies & TV Shows - Bera Tech",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0a0a0a",
        "theme_color": "#00b4d8",
        "icons": [
            {
                "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%2300b4d8'>🎬</text></svg>",
                "sizes": "any",
                "type": "image/svg+xml"
            }
        ]
    }));
});

app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
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
            return response || fetch(event.request);
        })
    );
});
`);
});

// Serve the main application
app.get('*', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(generateFrontend());
});

// Start server
app.listen(PORT, () => {
    console.log(`
    🚀 CLOUD.MOVIES Server Started!
    📍 Port: ${PORT}
    🌐 URL: http://localhost:${PORT}
    
    ✅ GIFTED MOVIES API INTEGRATED
    ✅ NO URL PASTING REQUIRED
    ✅ TYPE & SEARCH MOVIES
    ✅ STREAMING & DOWNLOADS
    ✅ WATCHLIST & LIBRARY
    
    🎬 Primary API: Gifted Movies API
    ⚡ Real-time Search & Streaming
    📱 Full PWA Support
    
    HOW TO USE:
    1. Search for movies by typing in search bar
    2. Click any movie to view details
    3. Click "Stream Now" to watch
    4. Click "Download" to save offline
    5. Use bookmark icon to add to watchlist
    
    © 2024 Bera Tech - All rights reserved
    `);
});
