// Feature routes: achievements, goals, streaks, voice messages, photos,
// garden, holidays, backups, parent PIN, themes, notifications.
// Mounted alongside existing child/parent/tts/weather routers.

const express = require('express');
const router = express.Router();
const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function childId(req) { return req.query.child || 'kelly'; }

// ============================================================
// ACHIEVEMENTS
// ============================================================

router.get('/api/achievements', (req, res) => {
  res.json({ success: true, data: db.getChildAchievements(childId(req)) });
});

// Used by client after a coin earn to check for unlocks
router.post('/api/achievements/check', (req, res) => {
  const newly = db.checkAndUnlockAchievements(childId(req));
  res.json({ success: true, newly_unlocked: newly });
});

// ============================================================
// STREAKS
// ============================================================

router.get('/api/streak', (req, res) => {
  res.json({ success: true, data: db.getStreak(childId(req)) });
});

// ============================================================
// GOALS / WISHLIST
// ============================================================

router.get('/api/goal', (req, res) => {
  res.json({ success: true, data: db.getActiveGoal(childId(req)) });
});

router.post('/api/goal', (req, res) => {
  const id = db.setActiveGoal(childId(req), req.body.reward_id);
  res.json({ success: true, active_goal: id });
});

// ============================================================
// DAILY QUEST
// ============================================================

router.get('/api/daily-quest', (req, res) => {
  res.json({ success: true, data: db.getOrCreateDailyQuest(childId(req)) });
});

// ============================================================
// VOICE MESSAGES
// ============================================================

const VOICE_DIR = path.join(__dirname, '..', '..', 'server', 'voice-messages');
if (!fs.existsSync(VOICE_DIR)) fs.mkdirSync(VOICE_DIR, { recursive: true });

// Serve voice message files
router.use('/voice-files', express.static(VOICE_DIR));

// GET /api/voice-messages?child=kelly[&unplayed=1]
router.get('/api/voice-messages', (req, res) => {
  const unplayed = req.query.unplayed === '1';
  res.json({ success: true, data: db.getVoiceMessages(childId(req), unplayed) });
});

// POST /api/voice-messages  multipart with audio file
router.post('/api/voice-messages', express.raw({ type: 'audio/*', limit: '10mb' }), (req, res) => {
  const { child, category, label } = req.query;
  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ success: false, message: 'No audio data' });
  }
  const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webm`;
  const filePath = path.join(VOICE_DIR, filename);
  fs.writeFileSync(filePath, req.body);
  const msg = db.insertVoiceMessage({
    child_id: child || 'kelly',
    audio_path: `/voice-files/${filename}`,
    duration: parseFloat(req.query.duration) || 0,
    category: category || 'general',
    label: label || '',
  });
  res.json({ success: true, data: msg });
});

router.post('/api/voice-messages/:id/played', (req, res) => {
  const msg = db.markVoiceMessagePlayed(req.params.id);
  if (!msg) return res.status(404).json({ success: false });
  res.json({ success: true, data: msg });
});

router.delete('/api/voice-messages/:id', (req, res) => {
  const msg = db.deleteVoiceMessage(req.params.id);
  if (msg) {
    // Also remove the file
    try {
      const filename = path.basename(msg.audio_path);
      fs.unlinkSync(path.join(VOICE_DIR, filename));
    } catch {}
  }
  res.json({ success: true });
});

// ============================================================
// PHOTO EVIDENCE
// ============================================================

const PHOTO_DIR = path.join(__dirname, '..', '..', 'server', 'photos');
if (!fs.existsSync(PHOTO_DIR)) fs.mkdirSync(PHOTO_DIR, { recursive: true });

router.use('/photo-files', express.static(PHOTO_DIR));

router.get('/api/photos', (req, res) => {
  res.json({ success: true, data: db.getPhotos(req.query.child || null) });
});

// POST /api/photos  raw image upload
router.post('/api/photos', express.raw({ type: 'image/*', limit: '10mb' }), (req, res) => {
  const { child, task_id, task_name } = req.query;
  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ success: false, message: 'No image data' });
  }
  const ext = (req.headers['content-type'] || '').split('/')[1] || 'jpg';
  const filename = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext.split(';')[0]}`;
  const filePath = path.join(PHOTO_DIR, filename);
  fs.writeFileSync(filePath, req.body);
  const photo = db.insertPhoto({
    child_id: child || 'kelly',
    task_id: parseInt(task_id) || null,
    task_name: task_name || '未知任务',
    photo_path: `/photo-files/${filename}`,
  });
  res.json({ success: true, data: photo });
});

router.delete('/api/photos/:id', (req, res) => {
  const photo = db.deletePhoto(req.params.id);
  if (photo) {
    try {
      const filename = path.basename(photo.photo_path);
      fs.unlinkSync(path.join(PHOTO_DIR, filename));
    } catch {}
  }
  res.json({ success: true });
});

// ============================================================
// GARDEN
// ============================================================

router.get('/api/garden/types', (_req, res) => {
  res.json({ success: true, data: db.getPlantTypes() });
});

router.get('/api/garden', (req, res) => {
  res.json({ success: true, data: db.getGarden(childId(req)) });
});

router.post('/api/garden/plant', (req, res) => {
  const result = db.plantSeed(childId(req), req.body.plant_type);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json(result);
});

router.post('/api/garden/water/:id', (req, res) => {
  const result = db.waterPlant(childId(req), req.params.id);
  if (result.error) return res.status(404).json({ success: false, message: result.error });
  res.json(result);
});

router.post('/api/garden/harvest/:id', (req, res) => {
  const result = db.harvestPlant(childId(req), req.params.id);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json(result);
});

// ============================================================
// HOLIDAYS
// ============================================================

router.get('/api/holiday', (_req, res) => {
  res.json({ success: true, data: db.getActiveHoliday() });
});

// ============================================================
// THEMES
// ============================================================

router.get('/api/themes', (_req, res) => {
  res.json({ success: true, data: db.getThemesCatalog() });
});

router.post('/api/theme', (req, res) => {
  db.setChildTheme(childId(req), req.body.theme_id);
  res.json({ success: true });
});

// ============================================================
// NOTIFICATIONS
// ============================================================

router.get('/api/notifications', (req, res) => {
  res.json({ success: true, data: db.getNotifications(childId(req), req.query.unread === '1') });
});

router.post('/api/notifications/:id/read', (req, res) => {
  const n = db.markNotificationRead(req.params.id);
  if (!n) return res.status(404).json({ success: false });
  res.json({ success: true });
});

// ============================================================
// WEEKLY REPORT
// ============================================================

const weeklyReport = require('../jobs/weekly-report');
const REPORTS_DIR = path.join(__dirname, '..', '..', 'server', 'reports');
router.use('/parent/reports', express.static(REPORTS_DIR));

router.get('/api/parent/reports', (_req, res) => {
  res.json({ success: true, data: weeklyReport.listReports() });
});

router.post('/api/parent/reports/generate', (_req, res) => {
  try {
    const result = weeklyReport.generateReport();
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================================
// PARENT BACKUP / RESTORE
// ============================================================

router.post('/api/parent/backup', (_req, res) => {
  const result = db.createBackup();
  res.json({ success: true, data: result });
});

router.get('/api/parent/backups', (_req, res) => {
  res.json({ success: true, data: db.listBackups() });
});

router.post('/api/parent/restore', (req, res) => {
  const result = db.restoreBackup(req.body.filename);
  if (result.error) return res.status(400).json({ success: false, message: result.error });
  res.json({ success: true });
});

// ============================================================
// PARENT AUTH (PIN)
// ============================================================

// Parent auth / PIN / session routes moved to server/routes/approvals.js
// so login, push subscriptions, and pending-action authorization all share
// one persistent session store. features.js still exposes requireParentAuth
// as an alias for backwards compat with any code that imports it.

const parentAuth = require('../db/parent-auth');
router.requireParentAuth = parentAuth.requireParent;
router.isAuthorized = (req) => !!parentAuth.verifySession(
  req.headers['x-parent-token'] || (req.query && req.query.token) || null
);

module.exports = router;
