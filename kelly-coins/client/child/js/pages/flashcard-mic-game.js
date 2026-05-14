// Shared "show a card, kid says it, Whisper verifies" engine.
//
// Three games use this right now: 认字母, 认数字, 认颜色. They differ only in
// what's on each card and which vocab pack the server uses to bias Whisper.
// Everything else — progress bar, mic record/release, fuzzy result handling,
// 3-attempt retry, reward scaling — is identical.
//
// A "card" is a plain data object built by the game wrapper:
//   {
//     key:          'A' | '7' | 'red'          // what the server expects back
//     display:      'A'                         // big text on the front
//     englishName:  'Angel'                     // subtitle line 1 ("A is for Angel")
//     chineseName:  '小天使'                    // subtitle line 2
//     illustration: '<img src="..." />'         // raw HTML for the image area
//     palette:      { bg, ink, accent }         // card colours
//     speakOnShow:  'A'                         // text for English TTS on show
//     successSpeak: '对了!A'                    // text for English TTS on correct
//     revealSpeak:  '这个字母是A'               // text for English TTS after 3 wrong
//     promptLabel:  'A is for Angel'            // optional footer line override
//   }
//
// The wrapper passes `pack` ('letters' | 'numbers' | 'colors') which is
// forwarded to /api/voice-verify so the server can bias Whisper correctly.

import * as api from '../api.js';
import { speak } from '../components/voice.js';
import { sfx } from '../sfx.js';

const TOTAL_CARDS = 10;
const MAX_ATTEMPTS = 3;

export function createFlashcardMicGame(containerEl, onEnd, config) {
  const {
    pack,                     // 'letters' | 'numbers' | 'colors'
    cards,                    // pre-shuffled, length >= TOTAL_CARDS
    totalRounds = TOTAL_CARDS,
    topic = '卡片',           // e.g. '字母', '数字', '颜色' — shown in hints
  } = config;

  let currentIdx = 0;
  let correctCount = 0;
  let attempts = 0;
  let recorder = null;
  let stream = null;
  let recordedChunks = [];
  let isRecording = false;
  let cardEl = null;
  let destroyed = false;

  const root = document.createElement('div');
  root.className = 'alphabet-game';
  root.innerHTML = `
    <div class="alphabet-game__header">
      <div class="alphabet-game__progress">
        <div class="alphabet-game__progress-label" id="fc-progress">1 / ${totalRounds}</div>
        <div class="alphabet-game__progress-bar">
          <div class="alphabet-game__progress-fill" id="fc-fill" style="width: ${(1 / totalRounds) * 100}%"></div>
        </div>
      </div>
      <div class="alphabet-game__score">
        <span class="alphabet-game__score-num" id="fc-score">0</span>
        <span class="alphabet-game__score-max">/ ${totalRounds}</span>
      </div>
    </div>

    <div class="alphabet-game__stage" id="fc-stage"></div>

    <div class="alphabet-game__controls">
      <button class="alphabet-game__mic" id="fc-mic" aria-label="按住说话">
        <span class="alphabet-game__mic-icon">🎤</span>
        <span class="alphabet-game__mic-label" id="fc-mic-label">按住说话</span>
      </button>
      <div class="alphabet-game__hint" id="fc-hint">按住麦克风,大声说出来!</div>
    </div>
  `;
  containerEl.appendChild(root);

  const stageEl = root.querySelector('#fc-stage');
  const micEl = root.querySelector('#fc-mic');
  const micLabelEl = root.querySelector('#fc-mic-label');
  const hintEl = root.querySelector('#fc-hint');
  const progressLabelEl = root.querySelector('#fc-progress');
  const fillEl = root.querySelector('#fc-fill');
  const scoreEl = root.querySelector('#fc-score');

  // -------- Rendering --------

  function renderCard(card) {
    const el = document.createElement('div');
    el.className = 'alpha-card alpha-card--enter';
    el.style.setProperty('--card-bg', card.palette.bg);
    el.style.setProperty('--card-ink', card.palette.ink);
    el.style.setProperty('--card-accent', card.palette.accent);
    const footer = card.promptLabel ?? `${card.display} is for ${card.englishName}`;
    el.innerHTML = `
      <div class="alpha-card__letter" aria-label="${card.display}">
        ${card.display}
      </div>
      <div class="alpha-card__word">
        <div class="alpha-card__word-icon">${card.illustration}</div>
        <div class="alpha-card__word-label">${footer}</div>
        <div class="alpha-card__word-zh">${card.chineseName || ''}</div>
      </div>
    `;
    return el;
  }

  function showCard(idx) {
    const card = cards[idx];
    stageEl.innerHTML = '';
    cardEl = renderCard(card);
    stageEl.appendChild(cardEl);

    // Tapping the big display plays the English pronunciation again.
    const letterEl = cardEl.querySelector('.alpha-card__letter');
    letterEl.addEventListener('click', () => {
      sfx.highlight();
      speak(card.speakOnShow, 'en-US');
    });

    setTimeout(() => speak(card.speakOnShow, 'en-US'), 300);
    attempts = 0;
    hintEl.textContent = '按住麦克风,大声说出来!';
    micEl.classList.remove('alpha-mic--wrong');
    micLabelEl.textContent = '按住说话';

    progressLabelEl.textContent = `${idx + 1} / ${totalRounds}`;
    fillEl.style.width = `${((idx + 1) / totalRounds) * 100}%`;
  }

  // -------- Recording --------

  async function startRecording() {
    if (isRecording || destroyed) return;
    try {
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      recordedChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      recorder.onstop = async () => {
        isRecording = false;
        micEl.classList.remove('alpha-mic--recording');
        micLabelEl.textContent = '识别中...';
        const blob = new Blob(recordedChunks, { type: mimeType });
        await verifyBlob(blob);
      };
      recorder.start();
      isRecording = true;
      micEl.classList.add('alpha-mic--recording');
      micLabelEl.textContent = '松开结束';
      sfx.tap();
      if (navigator.vibrate) navigator.vibrate(20);
    } catch (e) {
      console.error('mic start failed', e);
      hintEl.textContent = '无法访问麦克风';
      sfx.error();
    }
  }

  function stopRecording() {
    if (!isRecording || !recorder) return;
    try { recorder.stop(); } catch {}
  }

  async function verifyBlob(blob) {
    if (destroyed) return;
    if (blob.size < 800) {
      hintEl.textContent = '没听清楚,再大声说一次';
      micEl.classList.add('alpha-mic--wrong');
      micLabelEl.textContent = '按住说话';
      sfx.error();
      return;
    }
    try {
      const card = cards[currentIdx];
      const res = await api.verifyVoice(pack, card.key, blob);
      if (destroyed) return;
      if (res && res.matches) {
        onCorrect(card);
      } else {
        onWrong(card);
      }
    } catch (e) {
      console.error('verify failed', e);
      hintEl.textContent = '识别失败,再试一次';
      micLabelEl.textContent = '按住说话';
      sfx.error();
    }
  }

  // -------- Outcomes --------

  function onCorrect(card) {
    correctCount += 1;
    scoreEl.textContent = String(correctCount);
    if (cardEl) cardEl.classList.add('alpha-card--correct');
    hintEl.textContent = '棒棒哒!';
    micLabelEl.textContent = '✓';
    sfx.earn(2);
    setTimeout(() => sfx.complete(), 240);
    speak(card.successSpeak || `Yes! ${card.display}`, 'en-US');
    if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
    setTimeout(advance, 1400);
  }

  function onWrong(card) {
    attempts += 1;
    if (cardEl) {
      cardEl.classList.remove('alpha-card--wrong');
      void cardEl.offsetWidth;
      cardEl.classList.add('alpha-card--wrong');
    }
    micEl.classList.add('alpha-mic--wrong');
    sfx.error();
    if (attempts >= MAX_ATTEMPTS) {
      hintEl.textContent = `是 ${card.display}`;
      if (cardEl) cardEl.classList.add('alpha-card--reveal');
      speak(card.revealSpeak || `This is ${card.display}`, 'en-US');
      setTimeout(advance, 1800);
    } else {
      const remain = MAX_ATTEMPTS - attempts;
      hintEl.textContent = `再试一次,还有 ${remain} 次机会`;
      micLabelEl.textContent = '按住说话';
      speak(card.speakOnShow, 'en-US');
    }
  }

  function advance() {
    if (destroyed) return;
    currentIdx += 1;
    if (currentIdx >= totalRounds) {
      finishRound();
      return;
    }
    showCard(currentIdx);
  }

  function finishRound() {
    // Always award at least 1 for trying — Kelly never walks away empty.
    let coins = 1;
    if (correctCount >= totalRounds)       coins = 5;
    else if (correctCount >= totalRounds - 1) coins = 3;
    else if (correctCount >= totalRounds - 3) coins = 2;
    onEnd(coins);
  }

  // -------- Input --------

  micEl.addEventListener('pointerdown', (e) => { e.preventDefault(); startRecording(); });
  micEl.addEventListener('pointerup',   (e) => { e.preventDefault(); stopRecording(); });
  micEl.addEventListener('pointerleave', () => stopRecording());
  micEl.addEventListener('pointercancel', () => stopRecording());

  // Kick off
  showCard(0);

  return {
    destroy() {
      destroyed = true;
      try { if (recorder && recorder.state !== 'inactive') recorder.stop(); } catch {}
      if (stream) {
        try { stream.getTracks().forEach(t => t.stop()); } catch {}
        stream = null;
      }
      if (root.parentNode) root.parentNode.removeChild(root);
    }
  };
}

// Standard 5-colour pastel palette rotated across cards for visual variety.
export const FLASHCARD_PALETTES = [
  { bg: '#FFE4CD', ink: '#C4582B', accent: '#FFB183' }, // peach
  { bg: '#FFD9DF', ink: '#BC3F5E', accent: '#F48AA1' }, // rose
  { bg: '#D9F1DF', ink: '#2E7D4F', accent: '#7FC893' }, // mint
  { bg: '#FFF2C7', ink: '#A8710A', accent: '#F3C94B' }, // butter
  { bg: '#E3D9F3', ink: '#6A4AA8', accent: '#A68ADC' }, // lavender
];

export function shuffleAndPick(array, count) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}
