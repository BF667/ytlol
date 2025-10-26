// index.js

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Extracts the video ID from a YouTube URL.
 * @param {string} url The full YouTube URL.
 * @returns {string|null} The video ID or null if not found.
 */
function getYouTubeVideoId(url) {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
}

/**
 * Main API endpoint to get the MP3 download link.
 * Query Parameter: ?url=<YOUTUBE_URL>
 */
app.get('/api/download', async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing "url" query parameter. Example: /api/download?url=https://www.youtube.com/watch?v=...' });
    }

    const videoId = getYouTubeVideoId(videoUrl);
    if (!videoId) {
        return res.status(400).json({ error: 'Invalid YouTube URL provided.' });
    }

    const targetUrl = `https://ytmp3.cx/${videoId}/`;

    try {
        // Step 1: Fetch the initial page to get the hidden token
        const { data: html } = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        const $ = cheerio.load(html);

        // Step 2: Parse the HTML to find the token and other form data
        const token = $('input[name="token"]').val();
        const videoTitle = $('#title').val();

        if (!token) {
            return res.status(500).json({ error: 'Could not find the security token. The website structure may have changed.' });
        }

        // Step 3: Make the POST request to get the download link
        const postData = new URLSearchParams();
        postData.append('id', videoId);
        postData.append('token', token);

        const response = await axios.post('https://ytmp3.cx/api/', postData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': targetUrl,
            }
        });

        // Step 4: Process the response and send it back
        if (response.data && response.data.status === 'success') {
            return res.json({
                title: videoTitle || response.data.title,
                downloadUrl: response.data.download_link,
            });
        } else {
            return res.status(500).json({ error: 'Failed to retrieve download link from the target site.', details: response.data });
        }

    } catch (error) {
        console.error('Scraping Error:', error.message);
        return res.status(500).json({ error: 'An internal error occurred during the scraping process.' });
    }
});

app.listen(PORT, () => {
    console.log(`ytlol API server is running on http://localhost:${PORT}`);
    console.log(`Usage: http://localhost:${PORT}/api/download?url=<YOUTUBE_VIDEO_URL>`);
});
