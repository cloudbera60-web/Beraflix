const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Base URL from documentation
const API_BASE = 'https://movieapi.giftedtech.co.ke/api';

// Working API Fetch Function
async function fetchAPI(endpoint) {
    try {
        console.log(`Fetching: ${API_BASE}${endpoint}`);
        
        const response = await axios.get(`${API_BASE}${endpoint}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://h5.aoneroom.com/',
                'Origin': 'https://h5.aoneroom.com'
            },
            timeout: 15000
        });
        
        console.log(`API Response Status: ${response.status}`);
        return response.data;
    } catch (error) {
        console.error(`API Error for ${endpoint}:`, error.message);
        
        // For development, let's test with a different approach
        // Try without custom headers
        try {
            console.log('Trying without custom headers...');
            const simpleResponse = await axios.get(`${API_BASE}${endpoint}`, {
                timeout: 10000
            });
            return simpleResponse.data;
        } catch (simpleError) {
            console.error('Simple fetch also failed:', simpleError.message);
            return null;
        }
    }
}

// HTML Template
function generateHTML(content, title = 'Beraflix') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: #0a0a0a; 
            color: white; 
            font-family: Arial, sans-serif;
            padding-bottom: 70px;
        }
        .header {
            background: #141414;
            padding: 15px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
        }
        .logo { 
            color: #e50914; 
            font-size: 24px; 
            font-weight: bold; 
        }
        .search-box {
            padding: 8px 15px;
            background: #333;
            border: none;
            border-radius: 4px;
            color: white;
            width: 300px;
        }
        .container {
            margin-top: 70px;
            padding: 20px;
        }
        .section-title {
            margin: 20px 0 10px 0;
            color: #fff;
        }
        .movies-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .movie-card {
            background: #181818;
            border-radius: 8px;
            overflow: hidden;
            transition: transform 0.3s;
            cursor: pointer;
        }
        .movie-card:hover {
            transform: scale(1.05);
        }
        .movie-poster {
            width: 100%;
            height: 225px;
            object-fit: cover;
        }
        .movie-info {
            padding: 10px;
        }
        .movie-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 5px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .movie-year {
            color: #aaa;
            font-size: 12px;
        }
        .nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #141414;
            display: flex;
            justify-content: space-around;
            padding: 10px;
            border-top: 1px solid #333;
        }
        .nav-item {
            color: #aaa;
            text-decoration: none;
            text-align: center;
            padding: 5px;
        }
        .nav-item.active {
            color: #e50914;
        }
        .loading {
            text-align: center;
            padding: 50px;
            color: #666;
        }
        .error {
            color: #e50914;
            text-align: center;
            padding: 50px;
        }
        .btn {
            background: #e50914;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">BERAFLIX</div>
        <input type="text" class="search-box" placeholder="Search movies..." 
               oninput="searchMovies(this.value)">
    </div>
    
    <div class="container" id="content">${content}</div>
    
    <div class="nav">
        <a href="/" class="nav-item active">Home</a>
        <a href="/movies" class="nav-item">Movies</a>
        <a href="/series" class="nav-item">Series</a>
        <a href="/trending" class="nav-item">Trending</a>
    </div>
    
    <script>
        async function searchMovies(query) {
            if (query.length < 2) return;
            
            document.getElementById('content').innerHTML = '<div class="loading">Searching...</div>';
            
            try {
                const response = await fetch('/api/search?q=' + encodeURIComponent(query));
                const data = await response.json();
                
                if (data && data.results && data.results.items) {
                    let html = '<h2 class="section-title">Search Results</h2>';
                    html += '<div class="movies-grid">';
                    
                    data.results.items.forEach(movie => {
                        html += \`
                            <div class="movie-card" onclick="viewMovie('${movie.subjectId}', ${movie.subjectType})">
                                <img src="${movie.cover?.url || ''}" 
                                     class="movie-poster" 
                                     onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=NO+IMAGE'">
                                <div class="movie-info">
                                    <div class="movie-title">${movie.title}</div>
                                    <div class="movie-year">${movie.releaseDate?.split('-')[0] || ''}</div>
                                </div>
                            </div>
                        \`;
                    });
                    
                    html += '</div>';
                    document.getElementById('content').innerHTML = html;
                }
            } catch (error) {
                document.getElementById('content').innerHTML = '<div class="error">Search failed</div>';
            }
        }
        
        async function viewMovie(id, type) {
            const url = type === 2 ? '/series/' + id : '/movie/' + id;
            window.location.href = url;
        }
    </script>
</body>
</html>`;
}

// ROUTES

// Home page
app.get('/', async (req, res) => {
    try {
        // Try to fetch trending movies
        const trending = await fetchAPI('/search/avatar');
        
        let content = '<h2 class="section-title">Featured Movies</h2>';
        
        if (trending && trending.results && trending.results.items) {
            content += '<div class="movies-grid">';
            
            trending.results.items.slice(0, 12).forEach(movie => {
                content += `
                    <div class="movie-card" onclick="viewMovie('${movie.subjectId}', ${movie.subjectType})">
                        <img src="${movie.cover?.url || ''}" 
                             class="movie-poster" 
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=NO+IMAGE'">
                        <div class="movie-info">
                            <div class="movie-title">${movie.title}</div>
                            <div class="movie-year">${movie.releaseDate?.split('-')[0] || ''}</div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 50px;">
                    <h3>Welcome to Beraflix</h3>
                    <p>Search for movies using the search bar above</p>
                    <p style="color: #666; margin-top: 20px;">
                        Using Gifted Movies API: ${API_BASE}
                    </p>
                </div>
            `;
        }
        
        res.send(generateHTML(content, 'Beraflix - Home'));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 50px;">
                <h3>Welcome to Beraflix</h3>
                <p>Search for movies using the search bar above</p>
                <div style="margin-top: 30px;">
                    <button class="btn" onclick="searchMovies('avatar')">Test Search: Avatar</button>
                    <button class="btn" onclick="searchMovies('spider')">Test Search: Spider-Man</button>
                </div>
            </div>
        `, 'Beraflix - Home'));
    }
});

// Movie detail page
app.get('/movie/:id', async (req, res) => {
    const movieId = req.params.id;
    
    try {
        // Fetch movie info
        const info = await fetchAPI(`/info/${movieId}`);
        
        if (!info || !info.results || !info.results.subject) {
            throw new Error('Movie not found');
        }
        
        const movie = info.results.subject;
        
        // Fetch download sources
        const sources = await fetchAPI(`/sources/${movieId}`);
        
        let content = `
            <div style="max-width: 1000px; margin: 0 auto;">
                <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px;">
                    <div style="flex: 0 0 300px;">
                        <img src="${movie.cover?.url || ''}" 
                             style="width: 100%; border-radius: 8px;"
                             onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=NO+IMAGE'">
                    </div>
                    <div style="flex: 1; min-width: 300px;">
                        <h1 style="margin-bottom: 10px;">${movie.title}</h1>
                        <div style="color: #aaa; margin-bottom: 20px;">
                            ${movie.releaseDate ? movie.releaseDate.split('-')[0] + ' • ' : ''}
                            ${movie.duration ? Math.floor(movie.duration / 60) + ' min • ' : ''}
                            ${movie.imdbRatingValue ? '⭐ ' + movie.imdbRatingValue : ''}
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            ${movie.genre ? movie.genre.split(',').map(g => 
                                `<span style="background: #333; padding: 5px 10px; border-radius: 4px; margin-right: 5px;">${g.trim()}</span>`
                            ).join('') : ''}
                        </div>
                        
                        <p style="line-height: 1.6; margin-bottom: 30px;">${movie.description || 'No description available.'}</p>
                        
                        ${sources && sources.results && sources.results.length > 0 ? `
                            <h3 style="margin-bottom: 10px;">Download Options</h3>
                            <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
                                ${sources.results.map(source => `
                                    <div style="background: #222; padding: 10px; border-radius: 4px;">
                                        <div style="font-weight: bold;">${source.quality}</div>
                                        <div style="font-size: 12px; color: #aaa;">${source.size ? (source.size / 1000000).toFixed(1) + ' MB' : ''}</div>
                                        <button class="btn" style="margin-top: 5px; width: 100%;"
                                                onclick="downloadFile('${source.download_url}', '${movie.title.replace(/[^a-z0-9]/gi, '_')}_${source.quality}.mp4')">
                                            Download
                                        </button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : `
                            <div style="background: #222; padding: 20px; border-radius: 4px; text-align: center;">
                                <p>No download sources available for this movie.</p>
                                <button class="btn" onclick="window.history.back()">Go Back</button>
                            </div>
                        `}
                    </div>
                </div>
                
                ${info.results.stars && info.results.stars.length > 0 ? `
                    <h3>Cast</h3>
                    <div style="display: flex; overflow-x: auto; gap: 15px; padding: 10px 0;">
                        ${info.results.stars.slice(0, 10).map(star => `
                            <div style="text-align: center; min-width: 100px;">
                                <img src="${star.avatarUrl || ''}" 
                                     style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;"
                                     onerror="this.src='https://via.placeholder.com/80/333/fff?text=NO+PHOTO'">
                                <div style="margin-top: 5px; font-size: 12px;">
                                    <div>${star.name}</div>
                                    <div style="color: #aaa;">${star.character}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <script>
                function downloadFile(url, filename) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            </script>
        `;
        
        res.send(generateHTML(content, `${movie.title} - Beraflix`));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h2>Movie Not Found</h2>
                <p style="color: #666; margin: 20px 0;">The movie could not be loaded.</p>
                <button class="btn" onclick="window.history.back()">Go Back</button>
            </div>
        `, 'Movie Not Found - Beraflix'));
    }
});

// Series detail page
app.get('/series/:id', async (req, res) => {
    const seriesId = req.params.id;
    const season = req.query.season || 1;
    
    try {
        // Fetch series info
        const info = await fetchAPI(`/info/${seriesId}`);
        
        if (!info || !info.results || !info.results.subject) {
            throw new Error('Series not found');
        }
        
        const series = info.results.subject;
        
        // Fetch episodes for season
        const episodes = await fetchAPI(`/sources/${seriesId}?season=${season}`);
        
        let content = `
            <div style="max-width: 1000px; margin: 0 auto;">
                <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 30px;">
                    <div style="flex: 0 0 300px;">
                        <img src="${series.cover?.url || ''}" 
                             style="width: 100%; border-radius: 8px;"
                             onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=NO+IMAGE'">
                    </div>
                    <div style="flex: 1; min-width: 300px;">
                        <h1 style="margin-bottom: 10px;">${series.title}</h1>
                        <div style="color: #aaa; margin-bottom: 20px;">
                            ${series.releaseDate ? series.releaseDate.split('-')[0] + ' • ' : ''}
                            TV Series • 
                            ${series.imdbRatingValue ? '⭐ ' + series.imdbRatingValue : ''}
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            ${series.genre ? series.genre.split(',').map(g => 
                                `<span style="background: #333; padding: 5px 10px; border-radius: 4px; margin-right: 5px;">${g.trim()}</span>`
                            ).join('') : ''}
                        </div>
                        
                        <p style="line-height: 1.6; margin-bottom: 30px;">${series.description || 'No description available.'}</p>
                        
                        <!-- Season Selector -->
                        <h3>Season ${season}</h3>
                        <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                            ${[1, 2, 3, 4, 5].map(s => `
                                <button class="btn ${s == season ? '' : 'secondary'}" 
                                        onclick="loadSeason(${s})"
                                        style="${s == season ? '' : 'background: #333; color: #aaa;'}">
                                    Season ${s}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                <!-- Episodes -->
                <div id="episodes">
                    ${episodes && episodes.results && episodes.results.length > 0 ? `
                        <h3>Episodes</h3>
                        <div style="display: grid; gap: 10px;">
                            ${episodes.results.map((episode, index) => `
                                <div style="background: #222; padding: 15px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <div style="font-weight: bold;">Episode ${index + 1}</div>
                                        <div style="color: #aaa; font-size: 12px; margin-top: 5px;">
                                            ${episode.quality} • ${episode.size ? (episode.size / 1000000).toFixed(1) + ' MB' : ''}
                                        </div>
                                    </div>
                                    <button class="btn" 
                                            onclick="downloadFile('${episode.download_url}', 
                                                '${series.title.replace(/[^a-z0-9]/gi, '_')}_S${season}E${index + 1}_${episode.quality}.mp4')">
                                        Download
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div style="background: #222; padding: 40px; border-radius: 4px; text-align: center;">
                            <p>No episodes available for this season.</p>
                        </div>
                    `}
                </div>
            </div>
            
            <script>
                async function loadSeason(seasonNum) {
                    document.getElementById('episodes').innerHTML = '<div class="loading">Loading episodes...</div>';
                    
                    try {
                        const response = await fetch('/api/series/${seriesId}/season/' + seasonNum);
                        const data = await response.json();
                        
                        if (data && data.results && data.results.length > 0) {
                            let html = '<h3>Episodes</h3><div style="display: grid; gap: 10px;">';
                            
                            data.results.forEach((episode, index) => {
                                html += \`
                                    <div style="background: #222; padding: 15px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <div style="font-weight: bold;">Episode \${index + 1}</div>
                                            <div style="color: #aaa; font-size: 12px; margin-top: 5px;">
                                                \${episode.quality} • \${episode.size ? (episode.size / 1000000).toFixed(1) + ' MB' : ''}
                                            </div>
                                        </div>
                                        <button class="btn" 
                                                onclick="downloadFile('\${episode.download_url}', 
                                                    '${series.title.replace(/[^a-z0-9]/gi, '_')}_S\${seasonNum}E\${index + 1}_\${episode.quality}.mp4')">
                                            Download
                                        </button>
                                    </div>
                                \`;
                            });
                            
                            html += '</div>';
                            document.getElementById('episodes').innerHTML = html;
                        } else {
                            document.getElementById('episodes').innerHTML = \`
                                <div style="background: #222; padding: 40px; border-radius: 4px; text-align: center;">
                                    <p>No episodes available for season \${seasonNum}.</p>
                                </div>
                            \`;
                        }
                    } catch (error) {
                        document.getElementById('episodes').innerHTML = '<div class="error">Failed to load episodes</div>';
                    }
                }
                
                function downloadFile(url, filename) {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
            </script>
        `;
        
        res.send(generateHTML(content, `${series.title} - Beraflix`));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h2>Series Not Found</h2>
                <p style="color: #666; margin: 20px 0;">The series could not be loaded.</p>
                <button class="btn" onclick="window.history.back()">Go Back</button>
            </div>
        `, 'Series Not Found - Beraflix'));
    }
});

// Search page
app.get('/search', async (req, res) => {
    const query = req.query.q;
    
    if (!query) {
        return res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h2>Search Movies & TV Series</h2>
                <p style="color: #666; margin: 20px 0;">Enter a search term in the search bar above.</p>
            </div>
        `, 'Search - Beraflix'));
    }
    
    try {
        const results = await fetchAPI(`/search/${encodeURIComponent(query)}`);
        
        let content = `<h2 class="section-title">Search Results for "${query}"</h2>`;
        
        if (results && results.results && results.results.items) {
            content += '<div class="movies-grid">';
            
            results.results.items.forEach(item => {
                content += `
                    <div class="movie-card" onclick="viewMovie('${item.subjectId}', ${item.subjectType})">
                        <img src="${item.cover?.url || ''}" 
                             class="movie-poster" 
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=NO+IMAGE'">
                        <div class="movie-info">
                            <div class="movie-title">${item.title}</div>
                            <div class="movie-year">
                                ${item.releaseDate ? item.releaseDate.split('-')[0] : ''}
                                ${item.subjectType === 2 ? ' • Series' : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 50px;">
                    <p>No results found for "${query}"</p>
                </div>
            `;
        }
        
        res.send(generateHTML(content, `"${query}" - Search - Beraflix`));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h2>Search Failed</h2>
                <p style="color: #666; margin: 20px 0;">Could not perform search. Please try again.</p>
                <button class="btn" onclick="window.history.back()">Go Back</button>
            </div>
        `, 'Search Error - Beraflix'));
    }
});

// API Proxy Endpoints
app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.json({ results: { items: [] } });
    }
    
    try {
        const data = await fetchAPI(`/search/${encodeURIComponent(query)}`);
        res.json(data || { results: { items: [] } });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/info/:id', async (req, res) => {
    try {
        const data = await fetchAPI(`/info/${req.params.id}`);
        res.json(data || { results: {} });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/sources/:id', async (req, res) => {
    try {
        const { season, episode } = req.query;
        let endpoint = `/sources/${req.params.id}`;
        if (season) endpoint += `?season=${season}`;
        if (episode) endpoint += `&episode=${episode}`;
        
        const data = await fetchAPI(endpoint);
        res.json(data || { results: [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/series/:id/season/:season', async (req, res) => {
    try {
        const data = await fetchAPI(`/sources/${req.params.id}?season=${req.params.season}`);
        res.json(data || { results: [] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Movies list page
app.get('/movies', async (req, res) => {
    try {
        const popular = await fetchAPI('/search/popular');
        
        let content = '<h2 class="section-title">Popular Movies</h2>';
        
        if (popular && popular.results && popular.results.items) {
            const movies = popular.results.items.filter(item => item.subjectType === 1);
            
            content += '<div class="movies-grid">';
            
            movies.slice(0, 20).forEach(movie => {
                content += `
                    <div class="movie-card" onclick="viewMovie('${movie.subjectId}', ${movie.subjectType})">
                        <img src="${movie.cover?.url || ''}" 
                             class="movie-poster" 
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=NO+IMAGE'">
                        <div class="movie-info">
                            <div class="movie-title">${movie.title}</div>
                            <div class="movie-year">${movie.releaseDate?.split('-')[0] || ''}</div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 50px;">
                    <p>No movies available at the moment.</p>
                    <button class="btn" onclick="searchMovies('movie')">Search Movies</button>
                </div>
            `;
        }
        
        res.send(generateHTML(content, 'Movies - Beraflix'));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h2>Movies</h2>
                <p style="color: #666; margin: 20px 0;">Browse our movie collection.</p>
                <button class="btn" onclick="searchMovies('action')">Search Action Movies</button>
            </div>
        `, 'Movies - Beraflix'));
    }
});

// Series list page
app.get('/series', async (req, res) => {
    try {
        const series = await fetchAPI('/search/series');
        
        let content = '<h2 class="section-title">TV Series</h2>';
        
        if (series && series.results && series.results.items) {
            const tvSeries = series.results.items.filter(item => item.subjectType === 2);
            
            content += '<div class="movies-grid">';
            
            tvSeries.slice(0, 20).forEach(show => {
                content += `
                    <div class="movie-card" onclick="viewMovie('${show.subjectId}', ${show.subjectType})">
                        <img src="${show.cover?.url || ''}" 
                             class="movie-poster" 
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=NO+IMAGE'">
                        <div class="movie-info">
                            <div class="movie-title">${show.title}</div>
                            <div class="movie-year">${show.releaseDate?.split('-')[0] || ''} • Series</div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 50px;">
                    <p>No TV series available at the moment.</p>
                    <button class="btn" onclick="searchMovies('series')">Search Series</button>
                </div>
            `;
        }
        
        res.send(generateHTML(content, 'TV Series - Beraflix'));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h2>TV Series</h2>
                <p style="color: #666; margin: 20px 0;">Browse our TV series collection.</p>
                <button class="btn" onclick="searchMovies('drama')">Search Drama Series</button>
            </div>
        `, 'TV Series - Beraflix'));
    }
});

// Trending page
app.get('/trending', async (req, res) => {
    try {
        const trending = await fetchAPI('/search/trending');
        
        let content = '<h2 class="section-title">Trending Now</h2>';
        
        if (trending && trending.results && trending.results.items) {
            content += '<div class="movies-grid">';
            
            trending.results.items.slice(0, 20).forEach(item => {
                content += `
                    <div class="movie-card" onclick="viewMovie('${item.subjectId}', ${item.subjectType})">
                        <img src="${item.cover?.url || ''}" 
                             class="movie-poster" 
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=NO+IMAGE'">
                        <div class="movie-info">
                            <div class="movie-title">${item.title}</div>
                            <div class="movie-year">
                                ${item.releaseDate?.split('-')[0] || ''}
                                ${item.subjectType === 2 ? ' • Series' : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 50px;">
                    <p>No trending content available.</p>
                    <button class="btn" onclick="searchMovies('popular')">Search Popular</button>
                </div>
            `;
        }
        
        res.send(generateHTML(content, 'Trending - Beraflix'));
    } catch (error) {
        res.send(generateHTML(`
            <div style="text-align: center; padding: 100px 20px;">
                <h2>Trending</h2>
                <p style="color: #666; margin: 20px 0;">Currently trending movies and series.</p>
            </div>
        `, 'Trending - Beraflix'));
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
    ============================================
    BERAFLIX STREAMING PLATFORM
    Server running on: http://localhost:${PORT}
    API Base: ${API_BASE}
    ============================================
    
    Available Routes:
    • Home: http://localhost:${PORT}/
    • Movies: http://localhost:${PORT}/movies
    • Series: http://localhost:${PORT}/series
    • Trending: http://localhost:${PORT}/trending
    • Search: Use the search bar
    
    API Endpoints:
    • Search: http://localhost:${PORT}/api/search?q=query
    • Movie Info: http://localhost:${PORT}/api/info/{id}
    • Sources: http://localhost:${PORT}/api/sources/{id}
    `);
});
