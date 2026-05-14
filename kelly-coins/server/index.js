const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db/database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// PWA: serve the service worker from the *root* scope so it can control
// both `/` and `/child/*` navigations. The Service-Worker-Allowed header
// lets the browser register `/child/sw.js` with scope `/`.
const swPath = path.join(__dirname, '..', 'client', 'child', 'sw.js');
app.get('/child/sw.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Service-Worker-Allowed', '/');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(swPath);
});
// Also expose at /sw.js for browsers that look there.
app.get('/sw.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  res.set('Service-Worker-Allowed', '/');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(swPath);
});

// PWA: ensure the manifest is served with the correct MIME type.
const manifestPath = path.join(__dirname, '..', 'client', 'child', 'manifest.json');
app.get('/child/manifest.json', (_req, res) => {
  res.set('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(manifestPath);
});

// Parent PWA: separate manifest + service worker so iOS treats it as a
// completely independent PWA (its own icon, own notification permission,
// own push subscription endpoint).
const parentSwPath = path.join(__dirname, '..', 'client', 'parent', 'sw.js');
app.get('/parent/sw.js', (_req, res) => {
  res.set('Content-Type', 'application/javascript; charset=utf-8');
  // Scope limited to /parent/ so it can't control the child app.
  res.set('Service-Worker-Allowed', '/parent/');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(parentSwPath);
});
const parentManifestPath = path.join(__dirname, '..', 'client', 'parent', 'manifest.json');
app.get('/parent/manifest.json', (_req, res) => {
  res.set('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(parentManifestPath);
});

// Serve static client files (CSS, JS modules, assets)
app.use('/child', express.static(path.join(__dirname, '..', 'client', 'child')));
app.use('/parent', express.static(path.join(__dirname, '..', 'client', 'parent')));

// HTML entry points
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'child', 'index.html'));
});
app.get('/parent', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'parent', 'index.html'));
});

// Mount API routers
const childRouter = require('./routes/child');
const parentRouter = require('./routes/parent');
const approvalsRouter = require('./routes/approvals');
const ttsRouter = require('./routes/tts');
const weatherRouter = require('./routes/weather');
const featuresRouter = require('./routes/features');
const voiceVerifyRouter = require('./routes/voice-verify');

// Approvals router contains both unauthenticated routes (/api/parent/auth/*
// and /api/request-*) and authenticated ones (using its own middleware).
// It must be mounted BEFORE parentRouter so the auth/status endpoint wins
// even if parentRouter is later blanket-protected.
app.use(approvalsRouter);
app.use(childRouter);
app.use(parentRouter);
app.use(ttsRouter);
app.use(weatherRouter);
app.use(featuresRouter);
app.use(voiceVerifyRouter);

// Auto-backup once a day on first request
app.use((_req, _res, next) => {
  try { db.maybeAutoBackup(); } catch (e) { /* silent */ }
  next();
});

// Schedule weekly email report (Sundays at 8pm local time)
const weeklyReport = require('./jobs/weekly-report');
weeklyReport.start();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Kelly Coins server running on http://localhost:${PORT}`);
  console.log(`Parent dashboard: http://localhost:${PORT}/parent`);
});
