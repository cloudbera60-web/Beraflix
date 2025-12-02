const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// API Configuration
const API_BASE = 'https://movieapi.giftedtech.co.ke/api';

// Enhanced API fetch function
async function fetchAPI(endpoint) {
    try {
        console.log(`Fetching: ${API_BASE}${endpoint}`);
        
        const response = await axios.get(`${API_BASE}${endpoint}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
                'Referer': 'https://h5.aoneroom.com/'
            },
            timeout: 15000
        });
        
        console.log(`Response status: ${response.status}`);
        return response.data;
    } catch (error) {
        console.error(`API Error for ${endpoint}:`, error.message);
        return { status: 500, message: error.message };
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

// HTML Template with video streaming
function generateHTML(content, title = 'Beraflix', hasVideoPlayer = false) {
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
            text-decoration: none;
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
            padding-bottom: 70px;
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
            position: relative;
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
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            text-decoration: none;
        }
        
        .btn:hover {
            background: #f40612;
        }
        
        .btn-secondary {
            background: #333;
        }
        
        .btn-secondary:hover {
            background: #444;
        }
        
        /* Video Player Overlay */
        .video-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.95);
            z-index: 2000;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 1rem;
        }
        
        .video-container {
            width: 100%;
            max-width: 1200px;
            position: relative;
        }
        
        #videoPlayer {
            width: 100%;
            border-radius: 8px;
            background: #000;
        }
        
        .close-video {
            position: absolute;
            top: -40px;
            right: 0;
            background: var(--accent);
            color: white;
            border: none;
            border-radius: 50%;
            width: 35px;
            height: 35px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        /* Quality Grid */
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
            transition: all 0.3s;
        }
        
        .quality-card:hover {
            border-color: var(--accent);
            transform: translateY(-3px);
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
            z-index: 1000;
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
        
        /* Episode List */
        .episode-list {
            display: grid;
            gap: 1rem;
            margin: 1rem 0;
        }
        
        .episode-card {
            background: #222;
            padding: 1rem;
            border-radius: 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.3s;
        }
        
        .episode-card:hover {
            background: #333;
            transform: translateX(5px);
        }
        
        .episode-info {
            flex: 1;
        }
        
        .episode-title {
            font-weight: 600;
            margin-bottom: 0.25rem;
        }
        
        .episode-meta {
            font-size: 0.85rem;
            color: var(--text-secondary);
        }
        
        /* Search Results */
        .search-info {
            color: var(--text-secondary);
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            .grid {
                grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            }
            .search-box {
                width: 200px;
            }
            .quality-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <a href="/" class="logo">BERAFLIX</a>
        <input type="text" 
               class="search-box" 
               placeholder="Search movies..." 
               id="searchInput"
               onkeyup="searchMovies(this.value)">
    </div>
    
    <div class="main-content" id="content">
        ${content}
    </div>
    
    <!-- Video Player Overlay -->
    <div class="video-overlay" id="videoOverlay">
        <div class="video-container">
            <button class="close-video" onclick="closeVideo()">
                <i class="fas fa-times"></i>
            </button>
            <video id="videoPlayer" controls playsinline>
                Your browser does not support the video tag.
            </video>
        </div>
    </div>
    
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
        <a href="/trending" class="nav-item">
            <i class="fas fa-fire"></i><br>
            <span>Trending</span>
        </a>
    </div>
    
    <script>
        // Video player functions
        function playVideo(videoUrl, title) {
            const videoPlayer = document.getElementById('videoPlayer');
            const videoOverlay = document.getElementById('videoOverlay');
            
            videoPlayer.src = videoUrl;
            videoPlayer.load();
            videoOverlay.style.display = 'flex';
            
            // Try to play
            videoPlayer.play().catch(e => {
                console.log('Auto-play failed:', e);
            });
            
            // Update page title
            document.title = title + ' - Beraflix';
        }
        
        function closeVideo() {
            const videoPlayer = document.getElementById('videoPlayer');
            const videoOverlay = document.getElementById('videoOverlay');
            
            videoPlayer.pause();
            videoPlayer.src = '';
            videoOverlay.style.display = 'none';
        }
        
        // Close video when pressing ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeVideo();
            }
        });
        
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
                    
                    if (data && data.status === 200 && data.results && data.results.items && data.results.items.length > 0) {
                        let html = \`
                            <h2 class="section-title">Search Results</h2>
                            <div class="search-info">
                                Found \${data.results.items.length} results for "\${query}"
                            </div>
                            <div class="grid">
                        \`;
                        
                        data.results.items.forEach(item => {
                            const type = item.subjectType === 2 ? 'series' : 'movie';
                            html += \`
                                <div class="movie-card" onclick="viewDetail('\${item.subjectId}', '\${type}')">
                                    <img src="\${item.cover?.url || ''}" 
                                         class="movie-poster"
                                         onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=Image'">
                                    <div class="movie-info">
                                        <div class="movie-title">\${item.title || 'Untitled'}</div>
                                        <div class="movie-meta">
                                            \${item.releaseDate ? item.releaseDate.split('-')[0] : ''}
                                            \${item.subjectType === 2 ? ' • Series' : ''}
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
        
        // Load season episodes with retry logic
        async function loadSeason(season, seriesId, title, maxRetries = 3) {
            const episodesDiv = document.getElementById('episodes');
            episodesDiv.innerHTML = \`
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i> 
                    Loading Season \${season} episodes...
                </div>
            \`;
            
            // Try multiple season variations
            const seasonVariations = [
                season,
                season.toString().padStart(2, '0'),
                `S\${season.toString().padStart(2, '0')}`,
                `season\${season}`,
                `Season\${season}`
            ];
            
            for (let i = 0; i < seasonVariations.length; i++) {
                try {
                    const response = await fetch('/api/sources/' + seriesId + '?season=' + encodeURIComponent(seasonVariations[i]));
                    const data = await response.json();
                    
                    if (data && data.status === 200 && data.results && data.results.length > 0) {
                        let html = \`
                            <h3 style="margin-bottom: 1rem;">Season \${season} Episodes</h3>
                            <div class="episode-list">
                        \`;
                        
                        data.results.forEach((episode, index) => {
                            const episodeNumber = index + 1;
                            const size = episode.size ? (episode.size / 1000000).toFixed(1) + ' MB' : '';
                            const filename = title.replace(/[^a-z0-9]/gi, '_') + '_S' + season + 'E' + episodeNumber + '_' + episode.quality + '.mp4';
                            
                            html += \`
                                <div class="episode-card">
                                    <div class="episode-info">
                                        <div class="episode-title">Episode \${episodeNumber}</div>
                                        <div class="episode-meta">
                                            \${episode.quality} • \${size} • \${episode.format || 'mp4'}
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 0.5rem;">
                                        <button class="btn" onclick="playVideo('\${episode.download_url}', '\${title} - Episode \${episodeNumber}')">
                                            <i class="fas fa-play"></i> Play
                                        </button>
                                        <button class="btn btn-secondary" onclick="downloadFile('\${episode.download_url}', '\${filename}')">
                                            <i class="fas fa-download"></i>
                                        </button>
                                    </div>
                                </div>
                            \`;
                        });
                        
                        html += '</div>';
                        episodesDiv.innerHTML = html;
                        return; // Success - exit function
                    }
                } catch (error) {
                    console.log('Trying next season format...');
                }
            }
            
            // If no episodes found
            episodesDiv.innerHTML = \`
                <div class="loading">
                    <h4>No episodes found for Season \${season}</h4>
                    <p style="margin-top: 1rem;">Try:</p>
                    <div style="margin-top: 1rem;">
                        \${[1, 2, 3, 4, 5].map(s => \`
                            <button class="btn \${s === season ? '' : 'btn-secondary'}" 
                                    onclick="loadSeason(\${s}, '\${seriesId}', '\${title}')"
                                    style="margin: 0.25rem;">
                                Season \${s}
                            </button>
                        \`).join('')}
                    </div>
                </div>
            \`;
        }
        
        // Auto-play preview for movies
        async function autoPlayPreview(movieId, title) {
            try {
                const response = await fetch('/api/sources/' + movieId);
                const data = await response.json();
                
                if (data && data.status === 200 && data.results && data.results.length > 0) {
                    // Get the highest quality source for preview
                    const bestQuality = data.results.find(s => s.quality === '720p') || 
                                      data.results.find(s => s.quality === '480p') || 
                                      data.results[0];
                    
                    if (bestQuality && bestQuality.download_url) {
                        // Add preview button
                        const previewBtn = document.createElement('button');
                        previewBtn.className = 'btn';
                        previewBtn.innerHTML = '<i class="fas fa-play"></i> Preview';
                        previewBtn.onclick = () => playVideo(bestQuality.download_url, title + ' Preview');
                        
                        const actionDiv = document.querySelector('.detail-actions');
                        if (actionDiv) {
                            actionDiv.insertBefore(previewBtn, actionDiv.firstChild);
                        }
                    }
                }
            } catch (error) {
                console.log('Could not load preview');
            }
        }
    </script>
</body>
</html>`;
}

// Routes
app.get('/', async (req, res) => {
    try {
        // Fetch trending content
        const response = await fetchAPI('/search/trending');
        
        let content = '<h2 class="section-title">Welcome to Beraflix</h2>';
        
        if (response && response.status === 200 && response.results && response.results.items) {
            content += '<h3 class="section-title">Trending Now</h3><div class="grid">';
            
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
            
            // Add search section
            content += `
                <h3 class="section-title">Search Movies & Series</h3>
                <div style="text-align: center; padding: 2rem;">
                    <input type="text" 
                           class="search-box" 
                           placeholder="Try: Siren, Avatar, Breaking Bad..." 
                           style="width: 300px; margin-bottom: 1rem;"
                           onkeyup="searchMovies(this.value)">
                    <p style="color: var(--text-secondary);">
                        Watch previews and download your favorite content
                    </p>
                </div>
            `;
        } else {
            content += `
                <div style="text-align: center; padding: 3rem;">
                    <h3>Stream Movies & Series</h3>
                    <p style="color: var(--text-secondary); margin: 1rem 0;">Search for your favorite movies and TV shows</p>
                    <div style="margin-top: 1rem;">
                        <input type="text" 
                               class="search-box" 
                               placeholder="Try: Siren, Spider-Man, Game of Thrones..." 
                               style="width: 300px;"
                               onkeyup="searchMovies(this.value)">
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
                <p style="color: var(--text-secondary); margin: 1rem 0;">Professional Streaming Platform</p>
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
        const rating = movie.imdbRatingValue ? escapeHTML(movie.imdbRatingValue) : '';
        const duration = movie.duration ? Math.floor(movie.duration / 60) + ' min' : '';
        
        let content = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="display: flex; flex-wrap: wrap; gap: 2rem; margin-bottom: 2rem;">
                    <div style="flex: 0 0 300px;">
                        <img src="${imageUrl}" 
                             style="width: 100%; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);"
                             onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=Poster'">
                    </div>
                    
                    <div style="flex: 1; min-width: 300px;">
                        <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${title}</h1>
                        
                        <div style="color: var(--text-secondary); margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                            ${year ? `<span><i class="fas fa-calendar"></i> ${year}</span>` : ''}
                            ${duration ? `<span><i class="fas fa-clock"></i> ${duration}</span>` : ''}
                            ${rating ? `<span><i class="fas fa-star" style="color: #ffd700;"></i> ${rating}/10</span>` : ''}
                        </div>
                        
                        ${genre ? `
                            <div style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${genre.split(',').map(g => 
                                    `<span style="background: #333; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.9rem;">
                                        ${escapeHTML(g.trim())}
                                    </span>`
                                ).join('')}
                            </div>
                        ` : ''}
                        
                        <p style="line-height: 1.6; margin-bottom: 2rem; font-size: 1.1rem;">${description}</p>
                        
                        <div class="detail-actions" style="margin-bottom: 2rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                            <button class="btn" onclick="loadSources('${movieId}', '${title}')">
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
                
                ${info.results.stars && info.results.stars.length > 0 ? `
                    <h3 class="section-title">Cast</h3>
                    <div style="display: flex; overflow-x: auto; gap: 1.5rem; padding: 1rem 0; scrollbar-width: thin;">
                        ${info.results.stars.slice(0, 10).map(star => `
                            <div style="text-align: center; min-width: 120px;">
                                <img src="${star.avatarUrl || ''}" 
                                     style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #333;"
                                     onerror="this.src='https://via.placeholder.com/100/333/fff?text=Actor'">
                                <div style="margin-top: 0.5rem;">
                                    <div style="font-weight: 600;">${escapeHTML(star.name || '')}</div>
                                    <div style="font-size: 0.85rem; color: #888;">${escapeHTML(star.character || '')}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <script>
                    async function loadSources(movieId, title) {
                        const sourcesDiv = document.getElementById('sources');
                        sourcesDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
                        
                        try {
                            const response = await fetch('/api/sources/' + movieId);
                            const data = await response.json();
                            
                            if (data && data.status === 200 && data.results && data.results.length > 0) {
                                let html = '<h3 class="section-title">Download & Stream Options</h3>';
                                html += '<div class="quality-grid">';
                                
                                data.results.forEach(source => {
                                    const size = source.size ? (source.size / 1000000).toFixed(1) + ' MB' : '';
                                    const filename = title.replace(/[^a-z0-9]/gi, '_') + '_' + source.quality + '.mp4';
                                    html += \`
                                        <div class="quality-card">
                                            <div style="font-weight: bold; margin-bottom: 0.5rem; font-size: 1.1rem;">\${source.quality}</div>
                                            <div style="color: #888; font-size: 0.9rem; margin-bottom: 1rem;">
                                                \${source.format || 'mp4'} • \${size}
                                            </div>
                                            <div style="display: flex; gap: 0.5rem;">
                                                <button class="btn" onclick="playVideo('\${source.download_url}', '\${title} - \${source.quality}')"
                                                        style="flex: 1;">
                                                    <i class="fas fa-play"></i> Stream
                                                </button>
                                                <button class="btn btn-secondary" onclick="downloadFile('\${source.download_url}', '\${filename}')">
                                                    <i class="fas fa-download"></i>
                                                </button>
                                            </div>
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
                    
                    // Load sources and auto-play preview on page load
                    window.onload = function() {
                        loadSources('${movieId}', '${title}');
                        autoPlayPreview('${movieId}', '${title}');
                    }
                </script>
            </div>
        `;
        
        res.send(generateHTML(content, `${title} - Beraflix`, true));
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
        const rating = series.imdbRatingValue ? escapeHTML(series.imdbRatingValue) : '';
        
        // Try to get seasons info
        let seasons = [1, 2, 3, 4, 5]; // Default seasons
        if (info.results.resource && info.results.resource.seasons) {
            seasons = info.results.resource.seasons.map(s => s.se || s.season || 1);
        }
        
        let content = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="display: flex; flex-wrap: wrap; gap: 2rem; margin-bottom: 2rem;">
                    <div style="flex: 0 0 300px;">
                        <img src="${imageUrl}" 
                             style="width: 100%; border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);"
                             onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=Poster'">
                    </div>
                    
                    <div style="flex: 1; min-width: 300px;">
                        <h1 style="font-size: 2.5rem; margin-bottom: 0.5rem;">${title}</h1>
                        
                        <div style="color: var(--text-secondary); margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap;">
                            ${year ? `<span><i class="fas fa-calendar"></i> ${year}</span>` : ''}
                            <span><i class="fas fa-tv"></i> TV Series</span>
                            ${rating ? `<span><i class="fas fa-star" style="color: #ffd700;"></i> ${rating}/10</span>` : ''}
                        </div>
                        
                        ${genre ? `
                            <div style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
                                ${genre.split(',').map(g => 
                                    `<span style="background: #333; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.9rem;">
                                        ${escapeHTML(g.trim())}
                                    </span>`
                                ).join('')}
                            </div>
                        ` : ''}
                        
                        <p style="line-height: 1.6; margin-bottom: 2rem; font-size: 1.1rem;">${description}</p>
                        
                        <div style="margin-bottom: 2rem;">
                            <h3 style="margin-bottom: 1rem;">Seasons</h3>
                            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                                ${seasons.slice(0, 10).map(season => `
                                    <button class="btn ${season === 1 ? '' : 'btn-secondary'}" 
                                            onclick="loadSeason(${season}, '${seriesId}', '${title}')"
                                            style="min-width: 80px;">
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
                // Load first season on page load
                window.onload = function() {
                    loadSeason(1, '${seriesId}', '${title}');
                }
            </script>
        `;
        
        res.send(generateHTML(content, `${title} - Beraflix`, true));
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

// Other routes remain similar but with improved search
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
        const results = await fetchAPI(`/search/${encodeURIComponent(query)}`);
        
        let content = `<h2 class="section-title">Search Results for "${escapeHTML(query)}"</h2>`;
        
        if (results && results.status === 200 && results.results && results.results.items && results.results.items.length > 0) {
            content += `<div class="search-info">Found ${results.results.items.length} results</div><div class="grid">`;
            
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
                        Try searching for: <span style="color: var(--accent); cursor: pointer;" onclick="searchMovies('siren')">Siren</span>, 
                        <span style="color: var(--accent); cursor: pointer;" onclick="searchMovies('avatar')">Avatar</span>, 
                        <span style="color: var(--accent); cursor: pointer;" onclick="searchMovies('breaking bad')">Breaking Bad</span>
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
        const movies = await fetchAPI('/search/movie?limit=20');
        
        let content = '<h2 class="section-title">Movies</h2>';
        
        if (movies && movies.status === 200 && movies.results && movies.results.items) {
            const movieItems = movies.results.items.filter(item => item.subjectType === 1).slice(0, 20);
            
            if (movieItems.length > 0) {
                content += '<div class="grid">';
                
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
                content += '<div class="loading">No movies found</div>';
            }
        } else {
            content += '<div class="loading">Failed to load movies</div>';
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
                <button class="btn" onclick="searchMovies('action')">Search Action Movies</button>
            </div>
        `, 'Movies - Beraflix'));
    }
});

// Series page
app.get('/series', async (req, res) => {
    try {
        const series = await fetchAPI('/search/series?limit=20');
        
        let content = '<h2 class="section-title">TV Series</h2>';
        
        if (series && series.status === 200 && series.results && series.results.items) {
            const seriesItems = series.results.items.filter(item => item.subjectType === 2).slice(0, 20);
            
            if (seriesItems.length > 0) {
                content += '<div class="grid">';
                
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
                content += '<div class="loading">No series found</div>';
            }
        } else {
            content += '<div class="loading">Failed to load series</div>';
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
                <button class="btn" onclick="searchMovies('drama')">Search Drama Series</button>
            </div>
        `, 'TV Series - Beraflix'));
    }
});

// Trending page
app.get('/trending', async (req, res) => {
    try {
        const trending = await fetchAPI('/search/trending?limit=20');
        
        let content = '<h2 class="section-title">Trending Now</h2>';
        
        if (trending && trending.status === 200 && trending.results && trending.results.items) {
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
            content += '<div class="loading">No trending content</div>';
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

// API Proxy Endpoints
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
        const { season } = req.query;
        let endpoint = `/sources/${req.params.id}`;
        if (season) endpoint += `?season=${season}`;
        
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
BERAFLIX STREAMING PLATFORM v2.0
============================================
🚀 Server running: http://localhost:${PORT}
🎬 Live Preview: Enabled
📺 Streaming: HTML5 Video Player
📱 Mobile Optimized: Yes
🔍 Search: Real-time API search
============================================
Features:
• Live video preview/streaming
• Download with quality options
• TV series with episode support
• Netflix-like interface
• Mobile responsive
• Real API data only
============================================
    `);
});
