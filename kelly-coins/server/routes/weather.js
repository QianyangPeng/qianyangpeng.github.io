const express = require('express');
const router = express.Router();
const https = require('https');

// Kirkland, WA coordinates
const LAT = 47.6951;
const LON = -122.2460;
const URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code,is_day&timezone=America/Los_Angeles&temperature_unit=fahrenheit`;

// In-memory cache (10 minute TTL)
const CACHE_TTL = 10 * 60 * 1000;
let cache = { timestamp: 0, data: null };

// Map WMO weather codes to game conditions
function mapCondition(code) {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 95 && code <= 99) return 'rain'; // storm → rain
  return 'clear';
}

function fetchOpenMeteo() {
  return new Promise((resolve, reject) => {
    https.get(URL, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (!json.current) return reject(new Error('No current data'));
          resolve({
            condition: mapCondition(json.current.weather_code),
            is_day: json.current.is_day === 1,
            temperature: Math.round(json.current.temperature_2m),
            weather_code: json.current.weather_code,
            location: 'Kirkland, WA',
            updated_at: new Date().toISOString()
          });
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

// GET /api/weather
router.get('/api/weather', async (_req, res) => {
  const now = Date.now();

  // Serve from cache if fresh
  if (cache.data && now - cache.timestamp < CACHE_TTL) {
    return res.json({ ...cache.data, cached: true });
  }

  try {
    const data = await fetchOpenMeteo();
    cache = { timestamp: now, data };
    res.json({ ...data, cached: false });
  } catch (err) {
    // On failure, serve stale cache if available
    if (cache.data) {
      return res.json({ ...cache.data, cached: true, stale: true });
    }
    res.status(503).json({
      success: false,
      message: 'Weather service unavailable',
      condition: 'clear',
      is_day: true,
      temperature: 60,
      location: 'Kirkland, WA'
    });
  }
});

module.exports = router;
