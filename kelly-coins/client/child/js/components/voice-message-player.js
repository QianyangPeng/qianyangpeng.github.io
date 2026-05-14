// Voice Message Player
// Polls for unplayed voice messages from parents and shows a notification banner
// User can tap to play, and the message gets marked as played

import * as api from '../api.js';
import { speak, cancelSpeak } from './voice.js';

let bannerEl = null;
let pollInterval = null;
let currentAudio = null;

const POLL_MS = 60 * 1000; // poll every minute
const CHECK_DELAY = 3000;  // initial check 3s after load

function ensureBanner() {
  if (bannerEl) return;
  bannerEl = document.createElement('div');
  bannerEl.className = 'voice-msg-banner';
  bannerEl.style.display = 'none';
  document.getElementById('app').appendChild(bannerEl);
}

export function setupVoiceMessageWatcher() {
  ensureBanner();
  // Initial check after a short delay so other init has time
  setTimeout(checkForMessages, CHECK_DELAY);
  pollInterval = setInterval(checkForMessages, POLL_MS);
}

export function stopVoiceMessageWatcher() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = null;
}

async function checkForMessages() {
  try {
    const messages = await api.fetchVoiceMessages(true); // unplayed only
    if (messages && messages.length > 0) {
      showBanner(messages[0]); // show oldest first
    }
  } catch {}
}

function showBanner(msg) {
  ensureBanner();
  cancelSpeak();
  bannerEl.style.display = '';
  bannerEl.innerHTML = `
    <div class="voice-msg-banner__inner">
      <div class="voice-msg-banner__icon">💌</div>
      <div class="voice-msg-banner__text">
        <div class="voice-msg-banner__title">爸爸妈妈给你的语音</div>
        <div class="voice-msg-banner__label">${msg.label || msg.category || '消息'}</div>
      </div>
      <button class="voice-msg-banner__play" id="vm-play">▶</button>
      <button class="voice-msg-banner__close" id="vm-close">✕</button>
    </div>
  `;

  bannerEl.querySelector('#vm-play').addEventListener('click', () => playMessage(msg));
  bannerEl.querySelector('#vm-close').addEventListener('click', () => hideBanner());

  // Auto-play after 1 second (after the speak prompt)
  speak('爸爸妈妈给你录了一条语音哦！');
  setTimeout(() => playMessage(msg), 2500);
}

async function playMessage(msg) {
  try {
    cancelSpeak();
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    currentAudio = new Audio(msg.audio_path);
    currentAudio.onended = async () => {
      try { await fetch(`/api/voice-messages/${msg.id}/played`, { method: 'POST' }); } catch {}
      hideBanner();
    };
    currentAudio.onerror = () => {
      console.warn('Failed to play voice message:', msg.audio_path);
      hideBanner();
    };
    await currentAudio.play();
  } catch (e) {
    console.warn('Voice message play error:', e);
  }
}

function hideBanner() {
  if (bannerEl) {
    bannerEl.style.display = 'none';
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
