// Lucky wheel modal — bottom sheet opened from the home page FAB.
//
// Interaction model:
//   - The wheel itself is tappable (not a separate button). Tap → spin.
//   - Responsive: canvas sizes to min(screen width - padding, 420px).
//   - Two free spins per day, gated by the server (AM/PM shift).
//   - When on cooldown the wheel dims slightly and shows a friendly
//     "还不能转，等到XX再来" message.

import * as api from '../api.js';
import { setState } from '../state.js';
import { speak, clearHighlight } from './voice.js';
import { showToast } from './toast.js';
import { coinBurst, celebrate } from './animations.js';
import { sfx } from '../sfx.js';

let overlayEl = null;
let sheetEl = null;
let canvas = null;
let ctx = null;
let prizes = [];
let rotation = 0;
let spinning = false;
let status = null;  // { canSpin, nextWindow, ... } from /api/wheel/status
let pollTimer = null;

// Watercolor palette — maps prize.palette to paint colors
// Tuned so adjacent slices always contrast enough to be readable.
const PALETTE = {
  peach:    { fill: '#FFD6B5', accent: '#FF9A6B', edge: '#D47347' },
  rose:     { fill: '#FFC8D4', accent: '#F27B94', edge: '#C94A68' },
  mint:     { fill: '#BCE5C8', accent: '#6FC48A', edge: '#3D9A5E' },
  butter:   { fill: '#FFE9A8', accent: '#F5C147', edge: '#C99512' },
  lavender: { fill: '#D6C8F0', accent: '#A288D4', edge: '#6F4DB0' },
};

function ensureElements() {
  if (sheetEl) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'spicker-overlay';
  overlayEl.addEventListener('click', hide);

  sheetEl = document.createElement('div');
  sheetEl.className = 'spicker-sheet wheel-sheet';
  sheetEl.setAttribute('role', 'dialog');
  sheetEl.setAttribute('aria-label', '幸运转盘');

  const app = document.getElementById('app');
  app.appendChild(overlayEl);
  app.appendChild(sheetEl);
}

export function openWheelModal() {
  ensureElements();
  sfx.highlight();

  sheetEl.innerHTML = `
    <div class="spicker-handle" aria-hidden="true"></div>
    <div class="spicker-header">
      <div class="spicker-title">🎡 幸运转盘</div>
      <button class="spicker-close" aria-label="关闭">✕</button>
    </div>
    <div class="wheel-modal__body">
      <div class="wheel-modal__status" id="wheel-status">准备中...</div>
      <div class="wheel-modal__stage" id="wheel-stage">
        <canvas class="wheel-modal__canvas" id="wheel-canvas"></canvas>
        <div class="wheel-modal__pointer" aria-hidden="true"></div>
        <div class="wheel-modal__hub" aria-hidden="true">
          <div class="wheel-modal__hub-inner">GO</div>
        </div>
      </div>
      <div class="wheel-modal__hint" id="wheel-hint">点一下转盘开始！</div>
    </div>
  `;

  sheetEl.querySelector('.spicker-close').addEventListener('click', hide);

  canvas = sheetEl.querySelector('#wheel-canvas');
  ctx = canvas.getContext('2d');

  overlayEl.classList.add('spicker-overlay--visible');
  sheetEl.classList.add('spicker-sheet--visible');

  // Tap-to-spin: listen on the stage (includes canvas + hub)
  const stage = sheetEl.querySelector('#wheel-stage');
  stage.addEventListener('click', handleStageTap);

  // Load status + first render
  refreshStatus();

  // Re-render on resize so the wheel matches the sheet width
  window.addEventListener('resize', handleResize);
}

function hide() {
  overlayEl?.classList.remove('spicker-overlay--visible');
  sheetEl?.classList.remove('spicker-sheet--visible');
  clearHighlight();
  window.removeEventListener('resize', handleResize);
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function refreshStatus() {
  try {
    const res = await api.fetchWheelStatus();
    if (!res.success) throw new Error('status failed');
    status = res;
    prizes = res.prizes;
    sizeCanvas();
    drawWheel(rotation);
    updateStatusUI();
    // Announce only the first time
    if (!pollTimer) {
      if (status.canSpin) speak('幸运转盘！点一下转盘开始！');
      else speakCooldown();
    }
    // Poll once a minute so the cooldown message auto-updates at shift boundary
    if (!pollTimer) pollTimer = setInterval(refreshStatus, 60_000);
  } catch (e) {
    const hint = sheetEl?.querySelector('#wheel-hint');
    if (hint) hint.textContent = '加载失败，点一下重试';
  }
}

function updateStatusUI() {
  const statusEl = sheetEl?.querySelector('#wheel-status');
  const hintEl = sheetEl?.querySelector('#wheel-hint');
  const stage = sheetEl?.querySelector('#wheel-stage');
  if (!statusEl || !hintEl || !stage) return;

  if (status.canSpin) {
    if (status.unlimited) {
      statusEl.innerHTML = '<strong>无限次转盘</strong> ✨ 想转多少次都可以';
    } else {
      statusEl.innerHTML = `今天还有 <strong>${status.spinsPerShift - status.spinsInShift}</strong> 次免费转盘`;
    }
    hintEl.textContent = '点一下转盘开始！';
    stage.classList.remove('wheel-modal__stage--cooldown');
  } else {
    const waitText = status.nextWindow?.when === 'noon'
      ? '中午12点再来'
      : '明天早上再来';
    statusEl.innerHTML = `<span class="wheel-modal__status-cooldown">今天的转盘转完啦</span>`;
    hintEl.textContent = waitText;
    stage.classList.add('wheel-modal__stage--cooldown');
  }
}

function speakCooldown() {
  if (!status || status.canSpin) return;
  const msg = status.nextWindow?.when === 'noon'
    ? '还不能转，等到中午12点再转吧'
    : '今天的转盘转完啦，明天早上再来';
  speak(msg);
}

function sizeCanvas() {
  if (!canvas || !sheetEl) return;
  const body = sheetEl.querySelector('.wheel-modal__body');
  const available = Math.min(body.clientWidth - 32, 420);
  const size = Math.max(260, available);
  canvas.width = size * window.devicePixelRatio;
  canvas.height = size * window.devicePixelRatio;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}

function handleResize() {
  if (!canvas || spinning) return;
  sizeCanvas();
  drawWheel(rotation);
}

function drawWheel(currentRotation) {
  if (!ctx || !canvas || !prizes.length) return;
  const size = canvas.width / window.devicePixelRatio;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;

  ctx.clearRect(0, 0, size, size);

  // Outer cream paper ring (watercolor feel)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r + 10, 0, Math.PI * 2);
  ctx.fillStyle = '#FAEFDB';
  ctx.shadowColor = 'rgba(60,34,24,0.18)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fill();
  ctx.restore();

  // Decorative outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.strokeStyle = '#E8A77A';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(currentRotation);

  const sliceAngle = (Math.PI * 2) / prizes.length;

  prizes.forEach((prize, i) => {
    const startAngle = i * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const pal = PALETTE[prize.palette] || PALETTE.peach;

    // Slice fill — radial gradient for soft watercolor blend
    const grad = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r);
    grad.addColorStop(0, pal.fill);
    grad.addColorStop(0.75, pal.accent);
    grad.addColorStop(1, pal.edge);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Slice border
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Emoji + label
    ctx.save();
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Emoji (bigger, closer to edge)
    ctx.font = `${Math.round(r * 0.20)}px system-ui`;
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 3;
    ctx.fillText(prize.emoji, r * 0.63, -r * 0.10);

    // Label (smaller, further in)
    ctx.font = `700 ${Math.round(r * 0.10)}px "Fredoka", "LXGW WenKai Screen", system-ui`;
    ctx.fillStyle = '#4A2E1E';
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 2;
    ctx.fillText(prize.label, r * 0.56, r * 0.10);
    ctx.restore();
  });

  ctx.restore();

  // Decorative inner ring where the hub sits
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 4;
  ctx.stroke();
}

async function handleStageTap(e) {
  if (spinning) return;
  if (!status) return;

  if (!status.canSpin) {
    sfx.error();
    speakCooldown();
    return;
  }

  spinning = true;
  sfx.confirm();
  speak('转起来啦！');

  try {
    const res = await api.spinWheel();
    if (res.status === 429 || res.cooldown) {
      spinning = false;
      status = { ...status, canSpin: false, nextWindow: res.nextWindow };
      updateStatusUI();
      sfx.error();
      speakCooldown();
      return;
    }
    if (!res.success) {
      spinning = false;
      showToast(res.message || '转盘失败 😢', 'error');
      return;
    }

    // Animate to the winning slice
    await animateSpin(res.prize_index);
    // Apply reward
    setState({ coins: res.new_balance });
    const stage = sheetEl?.querySelector('#wheel-stage');
    if (stage) coinBurst(stage, Math.min(res.coins, 5));
    sfx.earn(Math.min(5, res.coins));
    setTimeout(() => sfx.complete(), 280);
    if (res.coins >= 5) celebrate();
    speak(`恭喜！获得了${res.coins}个金币！`);
    showToast(`🎉 ${res.label}`, 'success');

    // Update local status from server response
    status = res.status;
    updateStatusUI();
  } catch (err) {
    console.error('wheel spin failed', err);
    showToast('转盘出错啦 😢', 'error');
  } finally {
    spinning = false;
  }
}

function animateSpin(prizeIndex) {
  return new Promise(resolve => {
    const sliceAngle = (Math.PI * 2) / prizes.length;
    const sectorMiddle = prizeIndex * sliceAngle + sliceAngle / 2;
    // We want: rotation + sectorMiddle ≡ -π/2  (pointer at top)
    const targetFinal = -Math.PI / 2 - sectorMiddle;
    let delta = targetFinal - rotation;
    delta = ((delta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const fullSpins = 5 + Math.floor(Math.random() * 3);
    delta += fullSpins * Math.PI * 2;

    const startRotation = rotation;
    const duration = 4000;
    const start = performance.now();

    function frame(now) {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      rotation = startRotation + delta * ease;
      drawWheel(rotation);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}
