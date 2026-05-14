const express = require('express');
const router = express.Router();
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'tts-cache');
// Voice presets by language. `zh` is the default (warm Chinese female,
// matches the rest of the app). `en` is an expressive American English
// voice used by the alphabet game for letter names.
const VOICES = {
  zh: { voice: 'zh-CN-XiaoxiaoNeural', rate: '-3%', pitch: '+20%' },
  en: { voice: 'en-US-AnaNeural',      rate: '-5%', pitch: '+15%' },
};
// Bump this version whenever voice settings change to invalidate all caches
const VOICE_VERSION = 'v3-multilang';

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function resolveVoice(lang) {
  if (!lang) return VOICES.zh;
  const prefix = String(lang).toLowerCase().slice(0, 2);
  return VOICES[prefix] || VOICES.zh;
}

// GET /api/tts?text=hello&lang=en
router.get('/api/tts', async (req, res) => {
  const text = req.query.text;
  const lang = req.query.lang || 'zh';
  const voicePreset = resolveVoice(lang);
  if (!text || text.length > 200) {
    return res.status(400).json({ success: false, message: 'text required (max 200 chars)' });
  }

  // Cache key includes voice version + selected voice so changing voice invalidates cache
  const hash = crypto.createHash('md5').update(`${VOICE_VERSION}:${voicePreset.voice}:${text}`).digest('hex');
  const cacheFile = path.join(CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(cacheFile)) {
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', hash);
    return fs.createReadStream(cacheFile).pipe(res);
  }

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voicePreset.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const tempDir = path.join(CACHE_DIR, hash);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    await tts.toFile(tempDir, text, { rate: voicePreset.rate, pitch: voicePreset.pitch });

    const tempFile = path.join(tempDir, 'audio.mp3');
    if (!fs.existsSync(tempFile)) throw new Error('Audio file not generated');

    fs.renameSync(tempFile, cacheFile);
    try { fs.rmdirSync(tempDir); } catch {}

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', hash);
    fs.createReadStream(cacheFile).pipe(res);
  } catch (err) {
    console.error('TTS error:', err.message);
    res.status(500).json({ success: false, message: 'TTS generation failed' });
  }
});

// GET /api/tts/version — frontend uses this to bust its own cache
router.get('/api/tts/version', (_req, res) => {
  res.json({ version: VOICE_VERSION });
});

module.exports = router;
