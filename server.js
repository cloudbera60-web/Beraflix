const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// API Configuration
const API_BASE = 'https://movieapi.giftedtech.co.ke/api';

async function fetchAPI(endpoint) {
    try {
        console.log(`Fetching: ${API_BASE}${endpoint}`);
        const response = await axios.get(`${API_BASE}${endpoint}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error(`Error: ${error.message}`);
        return null;
    }
}

// Generate HTML with video streaming
function generateHTML(content, title = 'Beraflix') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        /* === NEW: VIDEO PLAYER STYLES === */
        .video-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.95);
            z-index: 9999;
            justify-content: center;
            align-items: center;
        }
        
        .video-container {
            width: 90%;
            max-width: 1000px;
            position: relative;
        }
        
        #streamingVideo {
            width: 100%;
            border-radius: 10px;
            background: #000;
        }
        
        .close-video {
            position: absolute;
            top: -40px;
            right: 0;
            background: #e50914;
            color: white;
            border: none;
            width: 35px;
            height: 35px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
        }
        
        /* === ENHANCED EPISODE STYLES === */
        .episode-container {
            margin: 20px 0;
            padding: 20px;
            background: #1a1a1a;
            border-radius: 10px;
        }
        
        .season-buttons {
            display: flex;
            gap: 10px;
            margin: 15px 0;
            flex-wrap: wrap;
        }
        
        .season-btn {
            padding: 10px 20px;
            background: #333;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
        
        .season-btn.active {
            background: #e50914;
        }
        
        .episode-card {
            background: #222;
            margin: 10px 0;
            padding: 15px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .episode-info {
            flex: 1;
        }
        
        .episode-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        
        .episode-meta {
            color: #aaa;
            font-size: 14px;
        }
        
        .episode-actions {
            display: flex;
            gap: 10px;
        }
        
        /* === STREAM & DOWNLOAD BUTTONS === */
        .btn-stream {
            background: #e50914;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .btn-download {
            background: #00a8ff;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        /* === OTHER STYLES === */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #0a0a0a; color: white; font-family: Arial, sans-serif; }
        
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
            z-index: 100;
        }
        
        .logo { color: #e50914; font-size: 24px; font-weight: bold; }
        
        .search-box {
            padding: 10px 15px;
            background: #333;
            border: none;
            border-radius: 5px;
            color: white;
            width: 250px;
        }
        
        .main-content { margin-top: 80px; padding: 20px; }
        
        .section-title { margin: 20px 0 15px 0; font-size: 22px; }
        
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
            cursor: pointer;
            transition: transform 0.3s;
        }
        
        .movie-card:hover { transform: scale(1.05); }
        
        .movie-poster {
            width: 100%;
            height: 225px;
            object-fit: cover;
        }
        
        .movie-info { padding: 10px; }
        .movie-title { font-weight: bold; margin-bottom: 5px; }
        .movie-meta { color: #aaa; font-size: 14px; }
        
        .btn {
            background: #e50914;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            margin: 5px;
        }
        
        .loading { text-align: center; padding: 40px; color: #666; }
        
        .quality-options {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        
        .quality-card {
            background: #222;
            padding: 15px;
            border-radius: 8px;
            border: 2px solid transparent;
        }
        
        .quality-card:hover { border-color: #e50914; }
    </style>
</head>
<body>
    <!-- HEADER -->
    <div class="header">
        <div class="logo">BERAFLIX</div>
        <input type="text" class="search-box" placeholder="Search movies..." 
               id="searchInput" onkeyup="searchMovies(this.value)">
    </div>
    
    <!-- MAIN CONTENT -->
    <div class="main-content" id="content">${content}</div>
    
    <!-- === NEW: VIDEO PLAYER OVERLAY === -->
    <div class="video-overlay" id="videoOverlay">
        <div class="video-container">
            <button class="close-video" onclick="closeVideo()">✕</button>
            <video id="streamingVideo" controls autoplay>
                Your browser does not support video streaming.
            </video>
        </div>
    </div>
    
    <script>
        // === NEW: VIDEO STREAMING FUNCTIONS ===
        let currentVideoUrl = '';
        
        function playVideo(videoUrl, title) {
            console.log('Playing video:', videoUrl);
            const video = document.getElementById('streamingVideo');
            const overlay = document.getElementById('videoOverlay');
            
            video.src = videoUrl;
            currentVideoUrl = videoUrl;
            overlay.style.display = 'flex';
            
            // Try to play
            video.play().catch(e => {
                console.log('Auto-play prevented:', e);
                video.controls = true;
            });
            
            // Update page title
            document.title = 'Watching: ' + title + ' - Beraflix';
        }
        
        function closeVideo() {
            const video = document.getElementById('streamingVideo');
            const overlay = document.getElementById('videoOverlay');
            
            video.pause();
            video.src = '';
            overlay.style.display = 'none';
            document.title = 'Beraflix';
        }
        
        // Close with ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeVideo();
        });
        
        // === SEARCH FUNCTION ===
        let searchTimer;
        function searchMovies(query) {
            clearTimeout(searchTimer);
            if (query.length < 2) return;
            
            searchTimer = setTimeout(async () => {
                document.getElementById('content').innerHTML = '<div class="loading">Searching...</div>';
                try {
                    const response = await fetch('/api/search/' + encodeURIComponent(query));
                    const data = await response.json();
                    displaySearchResults(data, query);
                } catch (error) {
                    document.getElementById('content').innerHTML = '<div class="loading">Search failed</div>';
                }
            }, 500);
        }
        
        function displaySearchResults(data, query) {
            if (!data || !data.results || !data.results.items) {
                document.getElementById('content').innerHTML = \`
                    <div class="loading">
                        <h3>No results for "\${query}"</h3>
                        <p>Try: avatar, spider-man, breaking bad</p>
                    </div>
                \`;
                return;
            }
            
            let html = \`<h2 class="section-title">Results for "\${query}"</h2><div class="movies-grid">\`;
            
            data.results.items.forEach(item => {
                const type = item.subjectType === 2 ? 'series' : 'movie';
                html += \`
                    <div class="movie-card" onclick="viewDetail('\${item.subjectId}', '\${type}')">
                        <img src="\${item.cover?.url || ''}" class="movie-poster"
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
        }
        
        // === VIEW DETAIL ===
        function viewDetail(id, type) {
            window.location.href = '/' + type + '/' + id;
        }
        
        // === DOWNLOAD FUNCTION ===
        function downloadFile(url, filename) {
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'download.mp4';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
        
        // === ENHANCED SEASON LOADING ===
        async function loadSeason(seasonNum, seriesId, seriesTitle) {
            console.log('Loading season:', seasonNum, 'for series:', seriesId);
            const episodesDiv = document.getElementById('episodes');
            episodesDiv.innerHTML = \`
                <div class="loading">
                    <h4>Loading Season \${seasonNum} episodes...</h4>
                    <p>Trying different season formats...</p>
                </div>
            \`;
            
            // Try multiple season parameter formats
            const seasonFormats = [
                seasonNum,                         // 1
                seasonNum.toString().padStart(2, '0'), // 01
                \`S\${seasonNum.toString().padStart(2, '0')}\`, // S01
                \`season\${seasonNum}\`,           // season1
                \`Season \${seasonNum}\`           // Season 1
            ];
            
            for (let format of seasonFormats) {
                try {
                    console.log('Trying format:', format);
                    const response = await fetch('/api/sources/' + seriesId + '?season=' + format);
                    const data = await response.json();
                    
                    if (data && data.results && data.results.length > 0) {
                        displayEpisodes(data.results, seasonNum, seriesTitle);
                        return;
                    }
                } catch (error) {
                    console.log('Failed with format:', format);
                }
            }
            
            // If no episodes found
            episodesDiv.innerHTML = \`
                <div class="loading">
                    <h4>⚠️ No episodes found for Season \${seasonNum}</h4>
                    <p>Try another season:</p>
                    <div class="season-buttons" style="margin-top: 15px;">
                        \${[1,2,3,4,5].map(s => \`
                            <button class="season-btn \${s === seasonNum ? 'active' : ''}" 
                                    onclick="loadSeason(\${s}, '\${seriesId}', '\${seriesTitle}')">
                                Season \${s}
                            </button>
                        \`).join('')}
                    </div>
                </div>
            \`;
        }
        
        function displayEpisodes(episodes, seasonNum, seriesTitle) {
            let html = \`
                <h3 style="margin-bottom: 15px;">Season \${seasonNum} Episodes</h3>
                <div style="color: #aaa; margin-bottom: 15px;">
                    Found \${episodes.length} episodes
                </div>
            \`;
            
            episodes.forEach((episode, index) => {
                const episodeNum = index + 1;
                const size = episode.size ? (episode.size / 1000000).toFixed(1) + ' MB' : '';
                const filename = \`\${seriesTitle.replace(/[^a-z0-9]/gi, '_')}_S\${seasonNum}E\${episodeNum}_\${episode.quality}.mp4\`;
                
                html += \`
                    <div class="episode-card">
                        <div class="episode-info">
                            <div class="episode-title">Episode \${episodeNum}</div>
                            <div class="episode-meta">
                                \${episode.quality} • \${episode.format || 'mp4'} • \${size}
                            </div>
                        </div>
                        <div class="episode-actions">
                            <button class="btn-stream" onclick="playVideo('\${episode.download_url}', '\${seriesTitle} - S\${seasonNum}E\${episodeNum}')">
                                ▶ Play
                            </button>
                            <button class="btn-download" onclick="downloadFile('\${episode.download_url}', '\${filename}')">
                                ⬇ Download
                            </button>
                        </div>
                    </div>
                \`;
            });
            
            document.getElementById('episodes').innerHTML = html;
        }
        
        // === AUTO PLAY PREVIEW ===
        async function autoPlayPreview(movieId, movieTitle) {
            try {
                const response = await fetch('/api/sources/' + movieId);
                const data = await response.json();
                
                if (data && data.results && data.results.length > 0) {
                    // Add preview button
                    const firstSource = data.results[0];
                    const actionDiv = document.querySelector('.detail-actions');
                    
                    if (actionDiv) {
                        const previewBtn = document.createElement('button');
                        previewBtn.className = 'btn-stream';
                        previewBtn.style.marginRight = '10px';
                        previewBtn.innerHTML = '▶ Preview Movie';
                        previewBtn.onclick = () => playVideo(firstSource.download_url, movieTitle + ' Preview');
                        actionDiv.prepend(previewBtn);
                    }
                }
            } catch (error) {
                console.log('Preview not available');
            }
        }
    </script>
</body>
</html>`;
}

// ================== ROUTES ==================

// Home Page
app.get('/', async (req, res) => {
    const content = `
        <div style="text-align: center; padding: 40px 20px;">
            <h1 style="font-size: 36px; margin-bottom: 20px; color: #e50914;">BERAFLIX</h1>
            <p style="color: #aaa; font-size: 18px; margin-bottom: 30px;">
                Stream & Download Movies & TV Series
            </p>
            
            <div style="max-width: 400px; margin: 0 auto;">
                <input type="text" 
                       class="search-box" 
                       placeholder="Try: Siren, Avatar, Breaking Bad..." 
                       style="width: 100%; margin-bottom: 20px;"
                       onkeyup="searchMovies(this.value)">
                
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button class="btn" onclick="searchMovies('siren')">Siren</button>
                    <button class="btn" onclick="searchMovies('avatar')">Avatar</button>
                    <button class="btn" onclick="searchMovies('breaking bad')">Breaking Bad</button>
                </div>
            </div>
            
            <div style="margin-top: 40px; color: #666;">
                <p><strong>🎬 New Feature:</strong> Live Video Streaming!</p>
                <p><strong>📺 Enhanced:</strong> TV Series Episode Support</p>
                <p><strong>⬇ Fixed:</strong> Season Loading Issues</p>
            </div>
        </div>
    `;
    
    res.send(generateHTML(content, 'Beraflix - Home'));
});

// Movie Detail Page
app.get('/movie/:id', async (req, res) => {
    try {
        const movieId = req.params.id;
        const info = await fetchAPI(`/info/${movieId}`);
        
        if (!info || !info.results || !info.results.subject) {
            throw new Error('Movie not found');
        }
        
        const movie = info.results.subject;
        const title = movie.title || 'Unknown';
        const year = movie.releaseDate ? movie.releaseDate.split('-')[0] : '';
        const desc = movie.description || 'No description available.';
        const image = movie.cover?.url || '';
        const rating = movie.imdbRatingValue || '';
        
        const content = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 30px;">
                    <div style="flex: 0 0 300px;">
                        <img src="${image}" 
                             style="width: 100%; border-radius: 10px;"
                             onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=Poster'">
                    </div>
                    
                    <div style="flex: 1; min-width: 300px;">
                        <h1 style="font-size: 32px; margin-bottom: 10px;">${title}</h1>
                        
                        <div style="color: #aaa; margin-bottom: 20px; display: flex; gap: 15px;">
                            ${year ? `<span>📅 ${year}</span>` : ''}
                            ${rating ? `<span>⭐ ${rating}/10</span>` : ''}
                            <span>🎬 Movie</span>
                        </div>
                        
                        <p style="line-height: 1.6; margin-bottom: 25px; font-size: 16px;">${desc}</p>
                        
                        <div class="detail-actions" style="margin-bottom: 25px;">
                            <button class="btn" onclick="loadSources('${movieId}', '${title}')">
                                ⬇ View Download Options
                            </button>
                            <button class="btn" onclick="window.history.back()" style="background: #333;">
                                ← Go Back
                            </button>
                        </div>
                        
                        <div id="sources">
                            <div class="loading">
                                <p>🔄 Loading streaming & download options...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                async function loadSources(movieId, movieTitle) {
                    const sourcesDiv = document.getElementById('sources');
                    sourcesDiv.innerHTML = '<div class="loading">🔄 Loading options...</div>';
                    
                    try {
                        const response = await fetch('/api/sources/' + movieId);
                        const data = await response.json();
                        
                        if (data && data.results && data.results.length > 0) {
                            let html = '<h3 class="section-title">Stream & Download Options</h3>';
                            html += '<div class="quality-options">';
                            
                            data.results.forEach(source => {
                                const size = source.size ? (source.size / 1000000).toFixed(1) + ' MB' : '';
                                const filename = movieTitle.replace(/[^a-z0-9]/gi, '_') + '_' + source.quality + '.mp4';
                                
                                html += \`
                                    <div class="quality-card">
                                        <div style="font-size: 18px; font-weight: bold; color: #00a8ff; margin-bottom: 5px;">
                                            \${source.quality}
                                        </div>
                                        <div style="color: #aaa; margin-bottom: 15px;">
                                            \${source.format || 'mp4'} • \${size}
                                        </div>
                                        <div style="display: flex; gap: 10px;">
                                            <button class="btn-stream" style="flex: 1;" 
                                                    onclick="playVideo('\${source.download_url}', '\${movieTitle} - \${source.quality}')">
                                                ▶ Stream Now
                                            </button>
                                            <button class="btn-download" 
                                                    onclick="downloadFile('\${source.download_url}', '\${filename}')">
                                                ⬇
                                            </button>
                                        </div>
                                    </div>
                                \`;
                            });
                            
                            html += '</div>';
                            sourcesDiv.innerHTML = html;
                        } else {
                            sourcesDiv.innerHTML = '<div class="loading">❌ No sources available</div>';
                        }
                    } catch (error) {
                        sourcesDiv.innerHTML = '<div class="loading">⚠️ Failed to load options</div>';
                    }
                }
                
                // Load on page start
                window.onload = function() {
                    loadSources('${movieId}', '${title}');
                    autoPlayPreview('${movieId}', '${title}');
                }
            </script>
        `;
        
        res.send(generateHTML(content, `${title} - Beraflix`));
    } catch (error) {
        const content = `
            <div style="text-align: center; padding: 50px;">
                <h2>❌ Movie Not Found</h2>
                <p style="color: #aaa; margin: 20px 0;">The movie could not be loaded.</p>
                <button class="btn" onclick="window.history.back()">← Go Back</button>
            </div>
        `;
        res.send(generateHTML(content, 'Movie Not Found'));
    }
});

// Series Detail Page (WITH FIXED EPISODE LOADING)
app.get('/series/:id', async (req, res) => {
    try {
        const seriesId = req.params.id;
        const info = await fetchAPI(`/info/${seriesId}`);
        
        if (!info || !info.results || !info.results.subject) {
            throw new Error('Series not found');
        }
        
        const series = info.results.subject;
        const title = series.title || 'Unknown';
        const year = series.releaseDate ? series.releaseDate.split('-')[0] : '';
        const desc = series.description || 'No description available.';
        const image = series.cover?.url || '';
        const rating = series.imdbRatingValue || '';
        
        const content = `
            <div style="max-width: 1200px; margin: 0 auto;">
                <div style="display: flex; flex-wrap: wrap; gap: 30px; margin-bottom: 30px;">
                    <div style="flex: 0 0 300px;">
                        <img src="${image}" 
                             style="width: 100%; border-radius: 10px;"
                             onerror="this.src='https://via.placeholder.com/300x450/333/fff?text=Poster'">
                    </div>
                    
                    <div style="flex: 1; min-width: 300px;">
                        <h1 style="font-size: 32px; margin-bottom: 10px;">${title}</h1>
                        
                        <div style="color: #aaa; margin-bottom: 20px; display: flex; gap: 15px;">
                            ${year ? `<span>📅 ${year}</span>` : ''}
                            ${rating ? `<span>⭐ ${rating}/10</span>` : ''}
                            <span>📺 TV Series</span>
                        </div>
                        
                        <p style="line-height: 1.6; margin-bottom: 25px; font-size: 16px;">${desc}</p>
                        
                        <!-- SEASON SELECTION -->
                        <div style="margin-bottom: 25px;">
                            <h3 class="section-title">Select Season</h3>
                            <div class="season-buttons">
                                <button class="season-btn active" onclick="loadSeason(1, '${seriesId}', '${title}')">
                                    Season 1
                                </button>
                                <button class="season-btn" onclick="loadSeason(2, '${seriesId}', '${title}')">
                                    Season 2
                                </button>
                                <button class="season-btn" onclick="loadSeason(3, '${seriesId}', '${title}')">
                                    Season 3
                                </button>
                                <button class="season-btn" onclick="loadSeason(4, '${seriesId}', '${title}')">
                                    Season 4
                                </button>
                                <button class="season-btn" onclick="loadSeason(5, '${seriesId}', '${title}')">
                                    Season 5
                                </button>
                            </div>
                        </div>
                        
                        <!-- EPISODES WILL APPEAR HERE -->
                        <div id="episodes">
                            <div class="loading">
                                <p>🔄 Loading Season 1 episodes...</p>
                                <p style="color: #666; font-size: 14px; margin-top: 10px;">
                                    <strong>New:</strong> Trying multiple season formats to find episodes
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <script>
                // Update active season button
                function setActiveSeason(seasonNum) {
                    document.querySelectorAll('.season-btn').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    event.target.classList.add('active');
                }
                
                // Load first season on start
                window.onload = function() {
                    loadSeason(1, '${seriesId}', '${title}');
                }
            </script>
        `;
        
        res.send(generateHTML(content, `${title} - Beraflix`));
    } catch (error) {
        const content = `
            <div style="text-align: center; padding: 50px;">
                <h2>❌ Series Not Found</h2>
                <p style="color: #aaa; margin: 20px 0;">The series could not be loaded.</p>
                <button class="btn" onclick="window.history.back()">← Go Back</button>
            </div>
        `;
        res.send(generateHTML(content, 'Series Not Found'));
    }
});

// Search Page
app.get('/search', async (req, res) => {
    const query = req.query.q;
    
    if (!query) {
        const content = `
            <div style="text-align: center; padding: 40px;">
                <h2>🔍 Search Movies & TV Series</h2>
                <p style="color: #aaa; margin: 20px 0;">Enter a search term above</p>
                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                    <button class="btn" onclick="searchMovies('siren')">Search: Siren</button>
                    <button class="btn" onclick="searchMovies('avatar')">Search: Avatar</button>
                </div>
            </div>
        `;
        return res.send(generateHTML(content, 'Search'));
    }
    
    try {
        const results = await fetchAPI(`/search/${encodeURIComponent(query)}`);
        
        if (!results || !results.results || !results.results.items) {
            throw new Error('No results');
        }
        
        let content = `<h2 class="section-title">Results for "${query}"</h2>`;
        content += `<div class="movies-grid">`;
        
        results.results.items.forEach(item => {
            const type = item.subjectType === 2 ? 'series' : 'movie';
            content += `
                <div class="movie-card" onclick="viewDetail('${item.subjectId}', '${type}')">
                    <img src="${item.cover?.url || ''}" class="movie-poster"
                         onerror="this.src='https://via.placeholder.com/150x225/333/fff?text=Image'">
                    <div class="movie-info">
                        <div class="movie-title">${item.title || 'Untitled'}</div>
                        <div class="movie-meta">
                            ${item.releaseDate ? item.releaseDate.split('-')[0] : ''}
                            ${item.subjectType === 2 ? ' • Series' : ''}
                        </div>
                    </div>
                </div>
            `;
        });
        
        content += `</div>`;
        res.send(generateHTML(content, `Search: ${query}`));
    } catch (error) {
        const content = `
            <div style="text-align: center; padding: 40px;">
                <h2>❌ No Results</h2>
                <p style="color: #aaa; margin: 20px 0;">No results found for "${query}"</p>
                <button class="btn" onclick="window.history.back()">← Go Back</button>
            </div>
        `;
        res.send(generateHTML(content, 'No Results'));
    }
});

// API Endpoints
app.get('/api/search/:query', async (req, res) => {
    try {
        const data = await fetchAPI(`/search/${req.params.query}`);
        res.json(data || { results: { items: [] } });
    } catch (error) {
        res.json({ results: { items: [] } });
    }
});

app.get('/api/info/:id', async (req, res) => {
    try {
        const data = await fetchAPI(`/info/${req.params.id}`);
        res.json(data || { results: {} });
    } catch (error) {
        res.json({ results: {} });
    }
});

app.get('/api/sources/:id', async (req, res) => {
    try {
        const { season } = req.query;
        let endpoint = `/sources/${req.params.id}`;
        if (season) endpoint += `?season=${season}`;
        
        const data = await fetchAPI(endpoint);
        res.json(data || { results: [] });
    } catch (error) {
        res.json({ results: [] });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`
============================================
🎬 BERAFLIX STREAMING PLATFORM v3.0
============================================
🚀 Server: http://localhost:${PORT}

✨ NEW FEATURES:
1. 🎥 LIVE VIDEO STREAMING - Click "▶ Play" to stream
2. 📺 ENHANCED SERIES SUPPORT - Fixed episode loading
3. 🔄 MULTI-FORMAT SEASON LOADING - Auto-detects seasons
4. 📱 MOBILE OPTIMIZED - Works perfectly on phones
5. 🎨 MODERN UI - Netflix-like interface

🔍 TEST SEARCHES:
• Search "siren" for TV series with streaming
• Search "avatar" for movies with streaming
• Click any series → Select Season → Stream episodes

============================================
    `);
});
