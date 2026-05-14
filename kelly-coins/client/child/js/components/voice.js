// Text-to-Speech via Edge TTS backend only (no browser fallback)
// XiaoxiaoNeural voice, cached in memory to avoid repeat requests

const audioCache = new Map();
let currentAudio = null;
let speaking = false;

// Check voice version on init to bust stale cache
fetch('/api/tts/version').then(r => r.json()).then(d => {
  const stored = localStorage.getItem('tts-voice-version');
  if (stored && stored !== d.version) {
    audioCache.clear();
  }
  localStorage.setItem('tts-voice-version', d.version);
}).catch(() => {});

export async function speak(text, lang) {
  if (!text) return;
  cancelSpeak();

  // Cache key must include language so "B" (English) and "B" (Chinese)
  // don't collide — edge-tts uses different voices per language.
  const cacheKey = lang ? `${lang}::${text}` : text;

  try {
    speaking = true;

    // Fetch or use cached audio
    if (!audioCache.has(cacheKey)) {
      const params = new URLSearchParams({ text });
      if (lang) params.set('lang', lang);
      const res = await fetch(`/api/tts?${params}`);
      if (!res.ok) throw new Error('TTS failed');
      const blob = await res.blob();
      audioCache.set(cacheKey, URL.createObjectURL(blob));
    }

    // Play (only if not cancelled while fetching)
    if (!speaking) return;

    await new Promise((resolve, reject) => {
      currentAudio = new Audio(audioCache.get(cacheKey));
      currentAudio.onended = resolve;
      currentAudio.onerror = reject;
      currentAudio.play().catch(reject);
    });
  } catch {
    // Silent fail — no fallback, no double voice
  } finally {
    speaking = false;
  }
}

export function cancelSpeak() {
  speaking = false;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  // Kill any stray browser TTS that might be running from old code
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

// ---- Two-tap interaction system ----
let highlightedEl = null;
let highlightedId = null;

export function handleTwoTap(cardEl, id, label, extraInfo = '') {
  if (highlightedId === id && highlightedEl === cardEl) {
    clearHighlight();
    return true;
  }

  clearHighlight();
  highlightedEl = cardEl;
  highlightedId = id;
  cardEl.classList.add('card--highlighted');

  const speechText = extraInfo ? `${label}，${extraInfo}` : label;
  speak(speechText);

  return false;
}

export function clearHighlight() {
  if (highlightedEl) {
    highlightedEl.classList.remove('card--highlighted');
    highlightedEl = null;
    highlightedId = null;
  }
}

export function isHighlighted(id) {
  return highlightedId === id;
}

export function prewarm(phrases) {
  phrases.forEach(text => {
    const url = `/api/tts?text=${encodeURIComponent(text)}`;
    fetch(url).then(r => r.blob()).then(blob => {
      audioCache.set(text, URL.createObjectURL(blob));
    }).catch(() => {});
  });
}
