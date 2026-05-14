// Task Progress Modal
// Two modes:
//   1. Timed task: shows mm:ss timer counting up, accumulates coins per interval
//   2. Instant task: shows "in progress" with confirm/cancel
// Includes a cute companion animation (character + task icon bouncing)
// Optional photo capture: tap "拍照" to attach a proof photo before confirming

import { speak, cancelSpeak } from './voice.js';
import { playEarnSound } from './animations.js';
import { uploadPhoto } from '../api.js';

let backdropEl = null;
let timerInterval = null;
let elapsedSeconds = 0;
let accumulatedCoins = 0;
let currentTask = null;
let onCompleteCallback = null;
let pendingPhoto = null;

function ensureBackdrop() {
  if (backdropEl) return;
  backdropEl = document.createElement('div');
  backdropEl.className = 'task-progress-backdrop';
  document.getElementById('app').appendChild(backdropEl);
}

// Open the task progress modal
// task: { id, name, icon_emoji, coins, duration_minutes, coins_per_interval }
// onComplete(coinsEarned): called when user confirms
export function showTaskProgress(task, onComplete) {
  ensureBackdrop();
  currentTask = task;
  onCompleteCallback = onComplete;
  elapsedSeconds = 0;
  accumulatedCoins = 0;

  const isTimed = task.duration_minutes && task.duration_minutes > 0;
  const imgSrc = `/child/assets/icons/tasks/${task.id}.png`;

  backdropEl.innerHTML = `
    <div class="task-progress">
      <div class="task-progress__header">${task.name}</div>

      <div class="task-progress__animation">
        <div class="task-progress__icon-wrap">
          <img src="${imgSrc}" alt="${task.name}" class="task-progress__icon-img"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="task-progress__icon-emoji" style="display:none">${task.icon_emoji}</div>
        </div>
        <div class="task-progress__sparkles">
          <span class="tp-spark tp-spark--1">✨</span>
          <span class="tp-spark tp-spark--2">⭐</span>
          <span class="tp-spark tp-spark--3">💫</span>
          <span class="tp-spark tp-spark--4">🌟</span>
        </div>
        <div class="task-progress__status" id="tp-status">
          ${isTimed ? '进行中...' : `${task.name}中...`}
        </div>
      </div>

      ${isTimed ? `
        <div class="task-progress__timer-section">
          <div class="task-progress__timer" id="tp-timer">00:00</div>
          <div class="task-progress__coins-earned" id="tp-coins">
            已积攒: <span class="tp-coins-value" id="tp-coins-value">0</span> 🪙
          </div>
          <div class="task-progress__interval-hint">
            每 ${task.duration_minutes} 分钟 +${task.coins_per_interval} 🪙
          </div>
        </div>
      ` : `
        <div class="task-progress__instant-section">
          <div class="task-progress__reward-preview">
            完成可得 <span class="tp-coins-value">${task.coins}</span> 🪙
          </div>
        </div>
      `}

      <div class="task-progress__photo-section">
        <input type="file" id="tp-photo-input" accept="image/*" capture="environment" style="display:none;">
        <button class="task-progress__photo-btn" id="tp-photo-btn">
          📷 拍张照片留念（可选）
        </button>
        <div class="task-progress__photo-preview" id="tp-photo-preview" style="display:none;">
          <img id="tp-photo-img" alt="preview">
          <button class="task-progress__photo-remove" id="tp-photo-remove">✕</button>
        </div>
      </div>

      <div class="task-progress__actions">
        <button class="task-progress__btn task-progress__btn--cancel" id="tp-cancel">
          取消
        </button>
        <button class="task-progress__btn task-progress__btn--confirm" id="tp-confirm">
          ${isTimed ? '✅ 结束并领取' : '✅ 完成了！'}
        </button>
      </div>
    </div>
  `;

  backdropEl.classList.add('task-progress-backdrop--visible');

  // Photo capture handlers
  setupPhotoCapture();

  // Start timer for timed tasks
  if (isTimed) {
    startTimer(task);
    speak(`${task.name}开始啦！加油！`);
  } else {
    accumulatedCoins = task.coins;
    speak(`${task.name}，完成了就点确认哦！`);
  }

  // Button handlers
  document.getElementById('tp-cancel').addEventListener('click', handleCancel);
  document.getElementById('tp-confirm').addEventListener('click', handleConfirm);
}

function startTimer(task) {
  const timerEl = document.getElementById('tp-timer');
  const coinsEl = document.getElementById('tp-coins-value');
  const intervalSec = task.duration_minutes * 60;

  timerInterval = setInterval(() => {
    elapsedSeconds++;

    // Update timer display
    const min = Math.floor(elapsedSeconds / 60);
    const sec = elapsedSeconds % 60;
    if (timerEl) timerEl.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

    // Check if new interval reached
    const newCoins = Math.floor(elapsedSeconds / intervalSec) * task.coins_per_interval;
    if (newCoins > accumulatedCoins) {
      accumulatedCoins = newCoins;
      if (coinsEl) coinsEl.textContent = accumulatedCoins;
      playEarnSound();
      speak(`太棒了！又攒了${task.coins_per_interval}个金币！`);

      // Visual feedback
      const statusEl = document.getElementById('tp-status');
      if (statusEl) {
        statusEl.textContent = `🎉 +${task.coins_per_interval}🪙！继续加油！`;
        setTimeout(() => { if (statusEl) statusEl.textContent = '进行中...'; }, 2000);
      }
    }
  }, 1000);
}

async function handleConfirm() {
  stopTimer();
  const coins = currentTask.duration_minutes ? accumulatedCoins : currentTask.coins;
  const photoBlob = pendingPhoto;
  const taskInfo = currentTask;
  close();

  // Upload photo (if any) in the background
  if (photoBlob && taskInfo) {
    uploadPhoto(photoBlob, taskInfo.id, taskInfo.name).catch(e => {
      console.warn('Photo upload failed:', e);
    });
  }

  if (onCompleteCallback) onCompleteCallback(coins);
}

function handleCancel() {
  stopTimer();
  pendingPhoto = null;
  speak('没关系，下次再来！');
  close();
  if (onCompleteCallback) onCompleteCallback(0);
}

// Photo capture: opens camera/file picker, shows preview
function setupPhotoCapture() {
  const btn = document.getElementById('tp-photo-btn');
  const input = document.getElementById('tp-photo-input');
  const preview = document.getElementById('tp-photo-preview');
  const previewImg = document.getElementById('tp-photo-img');
  const removeBtn = document.getElementById('tp-photo-remove');
  if (!btn || !input) return;

  pendingPhoto = null;

  btn.addEventListener('click', () => input.click());

  input.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    pendingPhoto = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      previewImg.src = ev.target.result;
      preview.style.display = '';
      btn.style.display = 'none';
    };
    reader.readAsDataURL(file);
  });

  removeBtn.addEventListener('click', () => {
    pendingPhoto = null;
    input.value = '';
    preview.style.display = 'none';
    btn.style.display = '';
  });
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function close() {
  cancelSpeak();
  if (backdropEl) {
    backdropEl.classList.remove('task-progress-backdrop--visible');
  }
}

// Force close (for page unmount)
export function closeTaskProgress() {
  stopTimer();
  close();
}
