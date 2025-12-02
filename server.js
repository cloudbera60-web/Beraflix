const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// API Configuration - Using CORRECT endpoints from documentation
const API_BASE = 'https://movieapi.giftedtech.co.ke/api';

// Simple API fetch function with correct endpoints
async function fetchAPI(endpoint) {
    try {
        console.log(`Fetching: ${API_BASE}${endpoint}`);
        
        const response = await axios.get(`${API_BASE}${endpoint}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            timeout: 10000
        });
        
        console.log(`Response status: ${response.status}`);
        console.log('Response data:', JSON.stringify(response.data).substring(0, 200) + '...');
        return response.data;
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
        }
        return null;
    }
}

// Helper function to escape HTML
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// HTML Template
function generateHTML(content, title = 'Beraflix') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHTML(title)}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --primary: #0a0a0a;
            --secondary: #141414;
            --accent: #e50914;
            --text: #ffffff;
            --text-secondary: #b3b3b3;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            background: var(--primary);
            color: var(--text);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100vh;
            padding-bottom: 60px;
        }
        
        /* Header */
        .header {
            background: var(--secondary);
            padding: 1rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            border-bottom: 1px solid #333;
        }
        
        .logo {
            font-size: 1.8rem;
            font-weight: bold;
            color: var(--accent);
        }
        
        .search-box {
            padding: 0.5rem 1rem;
            background: #333;
            border: none;
            border-radius: 4px;
            color: white;
            width: 250px;
        }
        
        /* Main Content */
        .main-content {
            margin-top: 70px;
            padding: 1rem;
        }
        
        .section-title {
            margin: 1.5rem 0 1rem 0;
            font-size: 1.4rem;
            color: white;
        }
        
        /* Grid */
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        
        /* Movie Card */
        .movie-card {
            background: var(--secondary);
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
            background: #333;
        }
        
        .movie-info {
            padding: 0.75rem;
        }
        
        .movie-title {
            font-size: 0.9rem;
            font-weight: 600;
            margin-bottom: 0.25rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        
        .movie-meta {
            font-size: 0.8rem;
            color: var(--text-secondary);
        }
        
        /* Buttons */
        .btn {
            background: var(--accent);
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
        }
        
        .btn-secondary {
            background: #333;
        }
        
        /* Navigation */
        .bottom-nav {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--secondary);
            display: flex;
            justify-content: space-around;
            padding: 0.75rem;
            border-top: 1px solid #333;
        }
        
        .nav-item {
            color: var(--text-secondary);
            text-decoration: none;
            text-align: center;
            font-size: 0.8rem;
        }
        
        .nav-item.active {
            color: var(--accent);
        }
        
        /* Loading */
        .loading {
            text-align: center;
            padding: 3rem;
            color: var(--text-secondary);
        }
        
        /* Quality Selector */
        .quality-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 1rem;
            margin: 1rem 0;
        }
        
        .quality-card {
            background: #222;
            padding: 1rem;
            border-radius: 6px;
            border: 2px solid transparent;
            cursor: pointer;
        }
        
        .quality-card:hover {
            border-color: var(--accent);
        }
        
        @media (max-width: 768px) {
            .grid {
                grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            }
            .search-box {
                width: 200px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">BERAFLIX</div>
        <input type="text" 
               class="search-box" 
               placeholder="Search movies..." 
               id="searchInput"
               onkeyup="searchMovies(this.value)">
    </div>
    
    <div class="main-content" id="content">${content}</div>
    
    <div class="bottom-nav">
        <a href="/" class="nav-item active">
            <i class="fas fa-home"></i><br>
            <span>Home</span>
        </a>
        <a href="/movies" class="nav-item">
            <i class="fas fa-film"></i><br>
            <span>Movies</span>
        </a>
        <a href="/series" class="nav-item">
            <i class="fas fa-tv"></i><br>
            <span>Series</span>
        </a>
    </div>
    
    <script>
        // Search function
        let searchTimeout;
        async function searchMovies(query) {
            clearTimeout(searchTimeout);
            
            if (query.length < 2) return;
            
            searchTimeout = setTimeout(async () => {
                document.getElementById('content').innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
                
                try {
                    const response = await fetch('/api/search/' + encodeURIComponent(query));
                    const data = await response.json();
                    
                    if (data && data.results && data.results.items && data.results.items.length > 0) {
                        let html = '<h2 class="section-title">Search Results</h2><div class="grid">';
                        
                        data.results.items.forEach(movie => {
                            const type = movie.subjectType === 2 ? 'series' : 'movie';
                            html += \`
                                <div class="movie-card" onclick="viewDetail('\${movie.subjectId}', '\${type}')">
                                    <img src="\${movie.cover?.url || ''}" 
                                         class="movie-poster"
                                         onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=Image'">
                                    <div class="movie-info">
                                        <div class="movie-title">\${movie.title}</div>
                                        <div class="movie-meta">
                                            \${movie.releaseDate ? movie.releaseDate.split('-')[0] : ''}
                                            \${movie.subjectType === 2 ? ' • Series' : ''}
                                        </div>
                                    </div>
                                </div>
                            \`;
                        });
                        
                        html += '</div>';
                        document.getElementById('content').innerHTML = html;
                    } else {
                        document.getElementById('content').innerHTML = \`
                            <div class="loading">
                                <h3>No results found for "\${query}"</h3>
                                <p>Try a different search term</p>
                            </div>
                        \`;
                    }
                } catch (error) {
                    document.getElementById('content').innerHTML = \`
                        <div class="loading">
                            <h3>Search failed</h3>
                            <p>Please try again</p>
                        </div>
                    \`;
                }
            }, 500);
        }
        
        // View movie/series detail
        function viewDetail(id, type) {
            window.location.href = '/' + type + '/' + id;
        }
        
        // Download file
        function downloadFile(url, filename) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        
        // Load season episodes
        async function loadSeason(season, seriesId, title) {
            const episodesDiv = document.getElementById('episodes');
            episodesDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading episodes...</div>';
            
            try {
                const response = await fetch('/api/sources/' + seriesId + '?season=' + season);
                const data = await response.json();
                
                if (data && data.results && data.results.length > 0) {
                    let html = '<h3>Season ' + season + ' Episodes</h3><div class="quality-grid">';
                    
                    data.results.forEach((episode, index) => {
                        const episodeNumber = index + 1;
                        const size = episode.size ? (episode.size/1000000).toFixed(1) + ' MB' : '';
                        const filename = title.replace(/[^a-z0-9]/gi, '_') + '_S' + season + 'E' + episodeNumber + '_' + episode.quality + '.mp4';
                        
                        html += \`
                            <div class="quality-card" onclick="downloadFile('\${episode.download_url}', '\${filename}')">
                                <strong>Episode \${episodeNumber}</strong>
                                <div style="margin-top: 0.5rem; font-size: 0.9rem;">
                                    <div>\${episode.quality}</div>
                                    <div style="color: #888;">\${size}</div>
                                </div>
                            </div>
                        \`;
                    });
                    
                    html += '</div>';
                    episodesDiv.innerHTML = html;
                } else {
                    episodesDiv.innerHTML = '<div class="loading">No episodes available for this season</div>';
                }
            } catch (error) {
                episodesDiv.innerHTML = '<div class="loading">Failed to load episodes</div>';
            }
        }
    </script>
</body>
</html>`;
}

// Routes
app.get('/', async (req, res) => {
    try {
        // Test the API with a simple search
        const response = await fetchAPI('/search/avatar');
        
        let content = '<h2 class="section-title">Welcome to Beraflix</h2>';
        
        if (response && response.status === 200 && response.results && response.results.items) {
            content += '<h3 class="section-title">Popular Movies</h3><div class="grid">';
            
            // Take first 12 items
            const items = response.results.items.slice(0, 12);
            
            items.forEach(item => {
                const type = item.subjectType === 2 ? 'series' : 'movie';
                const title = escapeHTML(item.title || 'Unknown');
                const year = item.releaseDate ? escapeHTML(item.releaseDate.split('-')[0]) : '';
                const imageUrl = item.cover?.url || '';
                const subjectId = escapeHTML(item.subjectId || '');
                
                content += `
                    <div class="movie-card" onclick="viewDetail('${subjectId}', '${type}')">
                        <img src="${imageUrl}" 
                             class="movie-poster"
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=Image'">
                        <div class="movie-info">
                            <div class="movie-title">${title}</div>
                            <div class="movie-meta">
                                ${year}
                                ${item.subjectType === 2 ? ' • Series' : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 3rem;">
                    <h3>Stream Movies & Series</h3>
                    <p style="color: var(--text-secondary); margin: 1rem 0;">Search for your favorite movies and TV shows</p>
                    <div style="margin-top: 1rem;">
                        <input type="text" 
                               class="search-box" 
                               placeholder="Try: Avatar, Spider-Man, Breaking Bad..." 
                               style="width: 300px;"
                               onkeyup="searchMovies(this.value)">
                    </div>
                    <div style="margin-top: 2rem; color: #666; font-size: 0.9rem;">
                        <p>Using Gifted Movies API</p>
                        <p>Base URL: ${API_BASE}</p>
                    </div>
                </div>
            `;
        }
        
        res.send(generateHTML(content, 'Beraflix - Home'));
    } catch (error) {
        console.error('Home page error:', error);
        res.send(generateHTML(`
            <div style="text-align: center; padding: 3rem;">
                <h2>Welcome to Beraflix</h2>
                <p style="color: var(--text-secondary); margin: 1rem 0;">Professional Movie Streaming Platform</p>
                <div style="margin-top: 2rem;">
                    <input type="text" 
                           class="search-box" 
                           placeholder="Search movies and series..." 
                           style="width: 300px;"
                           onkeyup="searchMovies(this.value)">
                </div>
            </div>
        `, 'Beraflix - Home'));
    }
});

app.get('/movie/:id', async (req, res) => {
    try {
        const movieId = req.params.id;
        
        // Fetch movie info using CORRECT endpoint
        const info = await fetchAPI(`/info/${movieId}`);
        
        if (!info || info.status !== 200 || !info.results || !info.results.subject) {
            throw new Error('Movie not found');
        }
        
        const movie = info.results.subject;
        const title = escapeHTML(movie.title || 'Unknown');
        const description = escapeHTML(movie.description || 'No description available.');
        const year = movie.releaseDate ? escapeHTML(movie.releaseDate.split('-')[0]) : '';
        const genre = movie.genre ? escapeHTML(movie.genre) : '';
        const imageUrl = movie.cover?.url || '';
        
        let content = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="display: flex; flex-wrap: wrap; gap: 2rem; margin-bottom: 2rem;">
                    <div style="flex: 0 0 300px;">
                        <img src="${imageUrl}" 
                             style="width: 100%; border-radius: 8px;"
                             onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=Poster'">
                    </div>
                    
                    <div style="flex: 1; min-width: 300px;">
                        <h1 style="font-size: 2rem; margin-bottom: 0.5rem;">${title}</h1>
                        
                        <div style="color: var(--text-secondary); margin-bottom: 1rem;">
                            ${year ? year + ' • ' : ''}
                            ${movie.duration ? Math.floor(movie.duration / 60) + ' min • ' : ''}
                            ${movie.imdbRatingValue ? '⭐ ' + escapeHTML(movie.imdbRatingValue) : ''}
                        </div>
                        
                        ${genre ? `
                            <div style="margin-bottom: 1rem;">
                                ${genre.split(',').map(g => 
                                    `<span style="background: #333; padding: 0.25rem 0.5rem; border-radius: 4px; margin-right: 0.5rem; font-size: 0.9rem;">
                                        ${escapeHTML(g.trim())}
                                    </span>`
                                ).join('')}
                            </div>
                        ` : ''}
                        
                        <p style="line-height: 1.6; margin-bottom: 2rem;">${description}</p>
                        
                        <div style="margin-bottom: 2rem;">
                            <button class="btn" onclick="loadSources('${movieId}', '${title}')" style="margin-right: 1rem;">
                                <i class="fas fa-download"></i> View Download Options
                            </button>
                            <button class="btn btn-secondary" onclick="window.history.back()">
                                <i class="fas fa-arrow-left"></i> Go Back
                            </button>
                        </div>
                        
                        <div id="sources">
                            <div class="loading">
                                <i class="fas fa-spinner fa-spin"></i> Loading download options...
                            </div>
                        </div>
                    </div>
                </div>
                
                <script>
                    async function loadSources(movieId, title) {
                        const sourcesDiv = document.getElementById('sources');
                        sourcesDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
                        
                        try {
                            const response = await fetch('/api/sources/' + movieId);
                            const data = await response.json();
                            
                            if (data && data.status === 200 && data.results && data.results.length > 0) {
                                let html = '<h3 style="margin-bottom: 1rem;">Download Options</h3>';
                                html += '<div class="quality-grid">';
                                
                                data.results.forEach(source => {
                                    const size = source.size ? (source.size / 1000000).toFixed(1) + ' MB' : '';
                                    const filename = title.replace(/[^a-z0-9]/gi, '_') + '_' + source.quality + '.mp4';
                                    html += \`
                                        <div class="quality-card" onclick="downloadFile('\${source.download_url}', '\${filename}')">
                                            <div style="font-weight: bold; margin-bottom: 0.5rem;">\${source.quality}</div>
                                            <div style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">
                                                \${source.format || 'mp4'} • \${size}
                                            </div>
                                            <button class="btn" style="width: 100%; padding: 0.5rem;">
                                                <i class="fas fa-download"></i> Download
                                            </button>
                                        </div>
                                    \`;
                                });
                                
                                html += '</div>';
                                sourcesDiv.innerHTML = html;
                            } else {
                                sourcesDiv.innerHTML = '<div class="loading">No download sources available</div>';
                            }
                        } catch (error) {
                            sourcesDiv.innerHTML = '<div class="loading">Failed to load download options</div>';
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
                    
                    // Load sources on page load
                    window.onload = function() {
                        loadSources('${movieId}', '${title}');
                    }
                </script>
            </div>
        `;
        
        res.send(generateHTML(content, `${title} - Beraflix`));
    } catch (error) {
        console.error('Movie detail error:', error);
        res.send(generateHTML(`
            <div style="text-align: center; padding: 3rem;">
                <h3>Movie Not Found</h3>
                <p style="color: var(--text-secondary); margin: 1rem 0;">The movie could not be loaded.</p>
                <button class="btn" onclick="window.history.back()">Go Back</button>
            </div>
        `, 'Movie Not Found - Beraflix'));
    }
});

app.get('/series/:id', async (req, res) => {
    try {
        const seriesId = req.params.id;
        
        // Fetch series info using CORRECT endpoint
        const info = await fetchAPI(`/info/${seriesId}`);
        
        if (!info || info.status !== 200 || !info.results || !info.results.subject) {
            throw new Error('Series not found');
        }
        
        const series = info.results.subject;
        const title = escapeHTML(series.title || 'Unknown');
        const description = escapeHTML(series.description || 'No description available.');
        const year = series.releaseDate ? escapeHTML(series.releaseDate.split('-')[0]) : '';
        const genre = series.genre ? escapeHTML(series.genre) : '';
        const imageUrl = series.cover?.url || '';
        
        let content = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="display: flex; flex-wrap: wrap; gap: 2rem; margin-bottom: 2rem;">
                    <div style="flex: 0 0 300px;">
                        <img src="${imageUrl}" 
                             style="width: 100%; border-radius: 8px;"
                             onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=Poster'">
                    </div>
                    
                    <div style="flex: 1; min-width: 300px;">
                        <h1 style="font-size: 2rem; margin-bottom: 0.5rem;">${title}</h1>
                        
                        <div style="color: var(--text-secondary); margin-bottom: 1rem;">
                            ${year ? year + ' • ' : ''}
                            TV Series • 
                            ${series.imdbRatingValue ? '⭐ ' + escapeHTML(series.imdbRatingValue) : ''}
                        </div>
                        
                        ${genre ? `
                            <div style="margin-bottom: 1rem;">
                                ${genre.split(',').map(g => 
                                    `<span style="background: #333; padding: 0.25rem 0.5rem; border-radius: 4px; margin-right: 0.5rem; font-size: 0.9rem;">
                                        ${escapeHTML(g.trim())}
                                    </span>`
                                ).join('')}
                            </div>
                        ` : ''}
                        
                        <p style="line-height: 1.6; margin-bottom: 2rem;">${description}</p>
                        
                        <div style="margin-bottom: 2rem;">
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
                                ${[1, 2, 3, 4, 5].map(season => `
                                    <button class="btn ${season === 1 ? '' : 'btn-secondary'}" 
                                            onclick="loadSeason(${season}, '${seriesId}', '${title}')">
                                        Season ${season}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                        
                        <div id="episodes">
                            <div class="loading">
                                <i class="fas fa-spinner fa-spin"></i> Loading Season 1 episodes...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                async function loadSeason(season, seriesId, title) {
                    const episodesDiv = document.getElementById('episodes');
                    episodesDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading episodes...</div>';
                    
                    try {
                        const response = await fetch('/api/sources/' + seriesId + '?season=' + season);
                        const data = await response.json();
                        
                        if (data && data.status === 200 && data.results && data.results.length > 0) {
                            let html = '<h3 style="margin-bottom: 1rem;">Season ' + season + ' Episodes</h3>';
                            html += '<div class="quality-grid">';
                            
                            data.results.forEach((episode, index) => {
                                const episodeNumber = index + 1;
                                const size = episode.size ? (episode.size / 1000000).toFixed(1) + ' MB' : '';
                                const filename = title.replace(/[^a-z0-9]/gi, '_') + '_S' + season + 'E' + episodeNumber + '_' + episode.quality + '.mp4';
                                html += \`
                                    <div class="quality-card" onclick="downloadFile('\${episode.download_url}', '\${filename}')">
                                        <div style="font-weight: bold; margin-bottom: 0.5rem;">Episode \${episodeNumber}</div>
                                        <div style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">
                                            \${episode.quality} • \${size}
                                        </div>
                                        <button class="btn" style="width: 100%; padding: 0.5rem;">
                                            <i class="fas fa-download"></i> Download
                                        </button>
                                    </div>
                                \`;
                            });
                            
                            html += '</div>';
                            episodesDiv.innerHTML = html;
                        } else {
                            episodesDiv.innerHTML = '<div class="loading">No episodes available for this season</div>';
                        }
                    } catch (error) {
                        episodesDiv.innerHTML = '<div class="loading">Failed to load episodes</div>';
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
                
                // Load first season on page load
                window.onload = function() {
                    loadSeason(1, '${seriesId}', '${title}');
                }
            </script>
        `;
        
        res.send(generateHTML(content, `${title} - Beraflix`));
    } catch (error) {
        console.error('Series detail error:', error);
        res.send(generateHTML(`
            <div style="text-align: center; padding: 3rem;">
                <h3>Series Not Found</h3>
                <p style="color: var(--text-secondary); margin: 1rem 0;">The series could not be loaded.</p>
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
            <div style="text-align: center; padding: 3rem;">
                <h2>Search Movies & TV Series</h2>
                <p style="color: var(--text-secondary); margin: 1rem 0;">
                    Enter a search term in the search bar above.
                </p>
            </div>
        `, 'Search - Beraflix'));
    }
    
    try {
        // Using CORRECT search endpoint: /api/search/{query}
        const results = await fetchAPI(`/search/${encodeURIComponent(query)}`);
        
        let content = `<h2 class="section-title">Search Results for "${escapeHTML(query)}"</h2>`;
        
        if (results && results.status === 200 && results.results && results.results.items && results.results.items.length > 0) {
            content += '<div class="grid">';
            
            results.results.items.forEach(item => {
                const type = item.subjectType === 2 ? 'series' : 'movie';
                const title = escapeHTML(item.title || 'Unknown');
                const year = item.releaseDate ? escapeHTML(item.releaseDate.split('-')[0]) : '';
                const imageUrl = item.cover?.url || '';
                const subjectId = escapeHTML(item.subjectId || '');
                
                content += `
                    <div class="movie-card" onclick="viewDetail('${subjectId}', '${type}')">
                        <img src="${imageUrl}" 
                             class="movie-poster"
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=Image'">
                        <div class="movie-info">
                            <div class="movie-title">${title}</div>
                            <div class="movie-meta">
                                ${year}
                                ${item.subjectType === 2 ? ' • Series' : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 3rem;">
                    <h3>No Results Found</h3>
                    <p style="color: var(--text-secondary); margin: 1rem 0;">
                        No movies or series found for "${escapeHTML(query)}"
                    </p>
                </div>
            `;
        }
        
        res.send(generateHTML(content, `"${escapeHTML(query)}" - Beraflix`));
    } catch (error) {
        console.error('Search error:', error);
        res.send(generateHTML(`
            <div style="text-align: center; padding: 3rem;">
                <h3>Search Failed</h3>
                <p style="color: var(--text-secondary); margin: 1rem 0;">
                    Could not perform search. Please try again.
                </p>
                <button class="btn" onclick="window.history.back()">Go Back</button>
            </div>
        `, 'Search Error - Beraflix'));
    }
});

// Movies page
app.get('/movies', async (req, res) => {
    try {
        // Search for movies
        const movies = await fetchAPI('/search/movie');
        
        let content = '<h2 class="section-title">Movies</h2>';
        
        if (movies && movies.status === 200 && movies.results && movies.results.items && movies.results.items.length > 0) {
            content += '<div class="grid">';
            
            // Filter movies (subjectType === 1) and take first 20
            const movieItems = movies.results.items.filter(item => item.subjectType === 1).slice(0, 20);
            
            movieItems.forEach(item => {
                const title = escapeHTML(item.title || 'Unknown');
                const year = item.releaseDate ? escapeHTML(item.releaseDate.split('-')[0]) : '';
                const imageUrl = item.cover?.url || '';
                const subjectId = escapeHTML(item.subjectId || '');
                
                content += `
                    <div class="movie-card" onclick="viewDetail('${subjectId}', 'movie')">
                        <img src="${imageUrl}" 
                             class="movie-poster"
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=Image'">
                        <div class="movie-info">
                            <div class="movie-title">${title}</div>
                            <div class="movie-meta">${year}</div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 3rem;">
                    <h3>No Movies Available</h3>
                    <p style="color: var(--text-secondary); margin: 1rem 0;">
                        Try searching for movies using the search bar.
                    </p>
                </div>
            `;
        }
        
        res.send(generateHTML(content, 'Movies - Beraflix'));
    } catch (error) {
        console.error('Movies page error:', error);
        res.send(generateHTML(`
            <div style="text-align: center; padding: 3rem;">
                <h2>Movies</h2>
                <p style="color: var(--text-secondary); margin: 1rem 0;">
                    Browse our movie collection.
                </p>
            </div>
        `, 'Movies - Beraflix'));
    }
});

// Series page
app.get('/series', async (req, res) => {
    try {
        // Search for series
        const series = await fetchAPI('/search/series');
        
        let content = '<h2 class="section-title">TV Series</h2>';
        
        if (series && series.status === 200 && series.results && series.results.items && series.results.items.length > 0) {
            content += '<div class="grid">';
            
            // Filter series (subjectType === 2) and take first 20
            const seriesItems = series.results.items.filter(item => item.subjectType === 2).slice(0, 20);
            
            seriesItems.forEach(item => {
                const title = escapeHTML(item.title || 'Unknown');
                const year = item.releaseDate ? escapeHTML(item.releaseDate.split('-')[0]) : '';
                const imageUrl = item.cover?.url || '';
                const subjectId = escapeHTML(item.subjectId || '');
                
                content += `
                    <div class="movie-card" onclick="viewDetail('${subjectId}', 'series')">
                        <img src="${imageUrl}" 
                             class="movie-poster"
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=Image'">
                        <div class="movie-info">
                            <div class="movie-title">${title}</div>
                            <div class="movie-meta">${year} • Series</div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 3rem;">
                    <h3>No Series Available</h3>
                    <p style="color: var(--text-secondary); margin: 1rem 0;">
                        Try searching for series using the search bar.
                    </p>
                </div>
            `;
        }
        
        res.send(generateHTML(content, 'TV Series - Beraflix'));
    } catch (error) {
        console.error('Series page error:', error);
        res.send(generateHTML(`
            <div style="text-align: center; padding: 3rem;">
                <h2>TV Series</h2>
                <p style="color: var(--text-secondary); margin: 1rem 0;">
                    Browse our TV series collection.
                </p>
            </div>
        `, 'TV Series - Beraflix'));
    }
});

// Trending page
app.get('/trending', async (req, res) => {
    try {
        // Search for trending content
        const trending = await fetchAPI('/search/trending');
        
        let content = '<h2 class="section-title">Trending Now</h2>';
        
        if (trending && trending.status === 200 && trending.results && trending.results.items && trending.results.items.length > 0) {
            content += '<div class="grid">';
            
            trending.results.items.slice(0, 20).forEach(item => {
                const type = item.subjectType === 2 ? 'series' : 'movie';
                const title = escapeHTML(item.title || 'Unknown');
                const year = item.releaseDate ? escapeHTML(item.releaseDate.split('-')[0]) : '';
                const imageUrl = item.cover?.url || '';
                const subjectId = escapeHTML(item.subjectId || '');
                
                content += `
                    <div class="movie-card" onclick="viewDetail('${subjectId}', '${type}')">
                        <img src="${imageUrl}" 
                             class="movie-poster"
                             onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=Image'">
                        <div class="movie-info">
                            <div class="movie-title">${title}</div>
                            <div class="movie-meta">
                                ${year}
                                ${item.subjectType === 2 ? ' • Series' : ''}
                            </div>
                        </div>
                    </div>
                `;
            });
            
            content += '</div>';
        } else {
            content += `
                <div style="text-align: center; padding: 3rem;">
                    <h3>No Trending Content</h3>
                    <p style="color: var(--text-secondary); margin: 1rem 0;">
                        Check back later for trending movies and series.
                    </p>
                </div>
            `;
        }
        
        res.send(generateHTML(content, 'Trending - Beraflix'));
    } catch (error) {
        console.error('Trending page error:', error);
        res.send(generateHTML(`
            <div style="text-align: center; padding: 3rem;">
                <h2>Trending</h2>
                <p style="color: var(--text-secondary); margin: 1rem 0;">
                    Currently trending movies and series.
                </p>
            </div>
        `, 'Trending - Beraflix'));
    }
});

// CORRECT API Proxy Endpoints (matching documentation)
app.get('/api/search/:query', async (req, res) => {
    const query = req.params.query;
    try {
        const data = await fetchAPI(`/search/${query}`);
        res.json(data || { status: 500, results: { items: [] } });
    } catch (error) {
        console.error('API search error:', error);
        res.json({ status: 500, results: { items: [] } });
    }
});

app.get('/api/info/:id', async (req, res) => {
    try {
        const data = await fetchAPI(`/info/${req.params.id}`);
        res.json(data || { status: 500, results: {} });
    } catch (error) {
        console.error('API info error:', error);
        res.json({ status: 500, results: {} });
    }
});

app.get('/api/sources/:id', async (req, res) => {
    try {
        const { season, episode } = req.query;
        let endpoint = `/sources/${req.params.id}`;
        if (season) endpoint += `?season=${season}`;
        if (episode) endpoint += `&episode=${episode}`;
        
        const data = await fetchAPI(endpoint);
        res.json(data || { status: 500, results: [] });
    } catch (error) {
        console.error('API sources error:', error);
        res.json({ status: 500, results: [] });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`
============================================
BERAFLIX STREAMING PLATFORM
Server running on: http://localhost:${PORT}
API Base: https://movieapi.giftedtech.co.ke/api
============================================

Correct API Endpoints Being Used:
• Search: GET ${API_BASE}/search/{query}
• Info:   GET ${API_BASE}/info/{id}
• Sources: GET ${API_BASE}/sources/{id}?season=1&episode=1

Available Routes:
• Home: http://localhost:${PORT}/
• Movies: http://localhost:${PORT}/movies
• Series: http://localhost:${PORT}/series
• Trending: http://localhost:${PORT}/trending
• Search: Use the search bar
    `);
});
