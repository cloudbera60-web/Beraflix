const express = require("express");
const axios = require("axios");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// =========================
// STATIC FRONTEND ROUTE
// =========================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>BeraFix Movies</title>
<style>
    body {
        margin: 0;
        padding: 0;
        background: #0d0d0d;
        font-family: Arial, sans-serif;
        color: white;
    }
    header {
        background: #111;
        padding: 15px;
        text-align: center;
        font-size: 22px;
    }
    #search-box {
        display: flex;
        justify-content: center;
        margin: 20px 0;
    }
    input {
        width: 300px;
        padding: 10px;
        border-radius: 6px;
        border: none;
        outline: none;
        font-size: 16px;
    }
    button {
        padding: 10px 15px;
        margin-left: 10px;
        background: #ff3333;
        border: none;
        border-radius: 6px;
        color: white;
        cursor: pointer;
        font-size: 16px;
    }
    #results {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 15px;
        padding: 20px;
    }
    .movie-card {
        background: #1a1a1a;
        padding: 10px;
        border-radius: 8px;
        text-align: center;
        cursor: pointer;
        transition: 0.3s;
    }
    .movie-card:hover {
        transform: scale(1.05);
    }
    .movie-card img {
        width: 100%;
        border-radius: 6px;
    }
</style>
</head>
<body>

<header>BeraFix – Movie Search</header>

<div id="search-box">
    <input id="query" type="text" placeholder="Search Movies...">
    <button onclick="searchMovie()">Search</button>
</div>

<div id="results"></div>

<script>
async function searchMovie() {
    const q = document.getElementById("query").value;
    if (!q) return alert("Type a movie name!");

    const res = await fetch('/api/movies/search?q=' + encodeURIComponent(q));
    const data = await res.json();

    let html = "";
    if (data.results && data.results.items) {
        data.results.items.forEach(movie => {
            html += \`
                <div class="movie-card" onclick="openMovie('\${movie.subjectId}')">
                    <img src="\${movie.thumbnail}" />
                    <h4>\${movie.title}</h4>
                </div>
            \`;
        });
    }

    document.getElementById("results").innerHTML = html;
}

async function openMovie(id) {
    const info = await fetch('/api/movies/info/' + id);
    const movie = await info.json();

    let m = movie.results.subject;

    alert(
        "Title: " + m.title + 
        "\\nYear: " + m.releaseDate +
        "\\nRating: " + m.imdbRatingValue
    );
}
</script>

</body>
</html>
  `);
});

// =========================
// MOVIE API ROUTES
// =========================

// 🔍 Search Movies
app.get('/api/movies/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.status(400).json({ error: "Missing query" });

    const response = await axios.get(
      `https://movieapi.giftedtech.co.ke/api/search/${encodeURIComponent(q)}`
    );

    res.json(response.data);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// 📘 Movie Info
app.get('/api/movies/info/:id', async (req, res) => {
  try {
    const response = await axios.get(
      `https://movieapi.giftedtech.co.ke/api/info/${req.params.id}`
    );
    res.json(response.data);

  } catch (err) {
    res.status(500).json({ error: "Movie info failed" });
  }
});

// ⬇ Movie Download Links
app.get('/api/movies/sources/:id', async (req, res) => {
  try {
    let url = `https://movieapi.giftedtech.co.ke/api/sources/${req.params.id}`;

    const { season, episode } = req.query;

    if (season) url += `?season=${season}`;
    if (season && episode) url += `&episode=${episode}`;

    const response = await axios.get(url);

    res.json(response.data);

  } catch (err) {
    res.status(500).json({ error: "Sources failed" });
  }
});

// =========================
// START SERVER
// =========================
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
