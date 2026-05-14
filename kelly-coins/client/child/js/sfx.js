// Sound Effects — Web Audio API synthesized sounds
// No external audio files. All sounds are generated on the fly with oscillators + envelopes.
// This keeps the app small, works offline, and lets us match the watercolor aesthetic
// with soft, musical "pluck" sounds instead of arcade bleeps.
//
// Also provides light haptic feedback on mobile (navigator.vibrate).
//
// Usage:
//   import { sfx } from './sfx.js';
//   sfx.tap();        // soft tap — use on every button press
//   sfx.confirm();    // positive bloop — use on confirm/save
//   sfx.earn(n);      // coin chime rising with n — use on coin gain
//   sfx.complete();   // task-complete fanfare (3 notes)
//   sfx.unlock();     // achievement unlock — rising sparkle
//   sfx.error();      // gentle bonk for invalid action
//   sfx.setMuted(bool)
//   sfx.isMuted()

const MUTE_KEY = 'kelly-coins-sfx-muted';
const VOL_KEY  = 'kelly-coins-sfx-volume';

let ctx = null;
let masterGain = null;
let muted = localStorage.getItem(MUTE_KEY) === '1';
let volume = parseFloat(localStorage.getItem(VOL_KEY) || '0.35');

// Lazily create AudioContext on first user gesture (browsers require it)
function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : volume;
  masterGain.connect(ctx.destination);
  // Resume context if suspended (iOS Safari)
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Core building block: play a shaped sine/triangle tone
// freq: Hz | dur: seconds | type: osc type | attack/release: envelope
function tone({ freq, dur = 0.12, type = 'sine', attack = 0.005, release = 0.08, gain = 0.5, detune = 0, delay = 0 }) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  // ADSR-lite: attack up, hold briefly, exponential release down
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + attack + dur + release);
  osc.connect(g);
  g.connect(masterGain);
  osc.start(now);
  osc.stop(now + attack + dur + release + 0.02);
}

// Short noise burst — used for "tap" and "error" sounds
function noise({ dur = 0.05, gain = 0.2, filterFreq = 2000, delay = 0 }) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime + delay;
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    // Pink-ish noise: softer than white
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(masterGain);
  src.start(now);
  src.stop(now + dur + 0.02);
}

function vibrate(pattern) {
  if (muted) return; // mute also mutes haptics — one toggle for both
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch {}
  }
}

// ---------- Public sounds ----------

export const sfx = {
  /** Soft tap — every button press. Quiet pluck + 8ms haptic. */
  tap() {
    tone({ freq: 520, dur: 0.04, type: 'sine',     gain: 0.14, attack: 0.002, release: 0.04 });
    tone({ freq: 780, dur: 0.03, type: 'triangle', gain: 0.08, attack: 0.002, release: 0.03, delay: 0.005 });
    vibrate(8);
  },

  /** Positive confirm — save/submit/approve. Two-note ascending bloop. */
  confirm() {
    tone({ freq: 660, dur: 0.08, type: 'triangle', gain: 0.22, release: 0.10 });
    tone({ freq: 990, dur: 0.10, type: 'triangle', gain: 0.22, release: 0.12, delay: 0.08 });
    vibrate([12, 40, 12]);
  },

  /** Coin earn — rising sparkle, scales with count. */
  earn(count = 1) {
    const base = 740;
    const n = Math.min(6, Math.max(1, count));
    for (let i = 0; i < n; i++) {
      tone({
        freq: base + i * 220,
        dur: 0.06,
        type: 'sine',
        gain: 0.18,
        attack: 0.002,
        release: 0.10,
        delay: i * 0.06,
      });
    }
    vibrate(18);
  },

  /** Task complete — warm 3-note major chord arpeggio. */
  complete() {
    // C5 → E5 → G5 (C major)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((f, i) => {
      tone({ freq: f, dur: 0.12, type: 'triangle', gain: 0.24, release: 0.18, delay: i * 0.08 });
    });
    // Sparkle on top
    tone({ freq: 1760, dur: 0.08, type: 'sine', gain: 0.10, release: 0.12, delay: 0.28 });
    vibrate([16, 60, 16, 40, 20]);
  },

  /** Achievement unlock — bigger, sparklier complete. */
  unlock() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      tone({ freq: f, dur: 0.14, type: 'triangle', gain: 0.26, release: 0.22, delay: i * 0.09 });
    });
    tone({ freq: 2093, dur: 0.10, type: 'sine', gain: 0.14, release: 0.18, delay: 0.42 });
    tone({ freq: 2637, dur: 0.10, type: 'sine', gain: 0.12, release: 0.18, delay: 0.50 });
    vibrate([20, 40, 20, 40, 30, 60, 40]);
  },

  /** Page nav — whoosh-ish short sweep. */
  swipe() {
    if (muted) return;
    const c = ensureCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    const now = c.currentTime;
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.10, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  },

  /** Invalid/error — gentle bonk, no harsh buzzer. */
  error() {
    tone({ freq: 220, dur: 0.10, type: 'triangle', gain: 0.22, release: 0.14 });
    tone({ freq: 180, dur: 0.08, type: 'sine',     gain: 0.12, release: 0.10, delay: 0.08 });
    vibrate([25, 30, 25]);
  },

  /** Highlight — first tap in two-tap pattern. */
  highlight() {
    tone({ freq: 880, dur: 0.05, type: 'sine', gain: 0.15, release: 0.06 });
    vibrate(5);
  },

  // ---------- Controls ----------

  setMuted(m) {
    muted = !!m;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (masterGain) masterGain.gain.value = muted ? 0 : volume;
  },

  isMuted() {
    return muted;
  },

  setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    localStorage.setItem(VOL_KEY, String(volume));
    if (masterGain && !muted) masterGain.gain.value = volume;
  },

  /** Warm up AudioContext after first user gesture (call from click handler). */
  prime() {
    ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  },
};

// Auto-prime on first user interaction (iOS/Safari requirement)
const primeOnce = () => {
  sfx.prime();
  window.removeEventListener('pointerdown', primeOnce, { capture: true });
  window.removeEventListener('touchstart', primeOnce, { capture: true });
  window.removeEventListener('keydown', primeOnce, { capture: true });
};
window.addEventListener('pointerdown', primeOnce, { capture: true, once: true });
window.addEventListener('touchstart', primeOnce, { capture: true, once: true });
window.addEventListener('keydown', primeOnce, { capture: true, once: true });
