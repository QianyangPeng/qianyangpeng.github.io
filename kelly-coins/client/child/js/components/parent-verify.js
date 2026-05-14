// Parent verification modal
// Before awarding task coins, asks a random multiplication question
// (2×2 through 9×9) that only a parent can answer.
// This ensures Kelly isn't just clicking tasks by herself to farm coins.
// The check can be skipped via localStorage setting for testing.

import { speak, cancelSpeak } from './voice.js';

let backdropEl = null;
let currentResolve = null;
let currentAnswer = 0;
let currentInput = '';
let attemptCount = 0;

const SKIP_KEY = 'kelly-coins-skip-parent-verify'; // for dev/testing

function ensureBackdrop() {
  if (backdropEl) return;
  backdropEl = document.createElement('div');
  backdropEl.className = 'parent-verify-backdrop';
  document.getElementById('app').appendChild(backdropEl);
}

// Returns a promise that resolves to true (verified) or false (cancelled)
export function requestParentVerify() {
  // Dev bypass
  if (localStorage.getItem(SKIP_KEY) === '1') {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    currentResolve = resolve;
    attemptCount = 0;
    showChallenge();
  });
}

function showChallenge() {
  ensureBackdrop();
  cancelSpeak();

  // Pick a random multiplication problem: 2-9 × 2-9 (avoid trivial 0/1)
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  currentAnswer = a * b;
  currentInput = '';

  backdropEl.innerHTML = `
    <div class="parent-verify">
      <div class="parent-verify__badge">👨‍👩‍👧 家长验证</div>
      <div class="parent-verify__title">请爸爸或妈妈回答</div>
      <div class="parent-verify__subtitle">确认 Kelly 真的完成了任务</div>

      <div class="parent-verify__question">
        <span>${a}</span>
        <span class="parent-verify__operator">×</span>
        <span>${b}</span>
        <span class="parent-verify__operator">=</span>
        <span class="parent-verify__answer" id="pv-answer">?</span>
      </div>

      <div class="parent-verify__keypad">
        ${[1,2,3,4,5,6,7,8,9,'clear',0,'ok'].map(k => {
          if (k === 'clear') return '<button class="pv-key pv-key--clear" data-key="clear">⌫</button>';
          if (k === 'ok')    return '<button class="pv-key pv-key--ok"    data-key="ok">✓</button>';
          return `<button class="pv-key" data-key="${k}">${k}</button>`;
        }).join('')}
      </div>

      <div class="parent-verify__status" id="pv-status">
        ${attemptCount > 0 ? '❌ 再试一次' : ''}
      </div>

      <button class="parent-verify__cancel" id="pv-cancel">取消</button>
    </div>
  `;

  backdropEl.classList.add('parent-verify-backdrop--visible');

  // Keypad handlers
  backdropEl.querySelectorAll('.pv-key').forEach(btn => {
    btn.addEventListener('click', () => handleKey(btn.dataset.key));
  });

  document.getElementById('pv-cancel').addEventListener('click', cancel);

  // Keyboard support (parents can use actual keyboard too)
  backdropEl._keyHandler = (e) => {
    if (!backdropEl.classList.contains('parent-verify-backdrop--visible')) return;
    if (e.key >= '0' && e.key <= '9') handleKey(e.key);
    else if (e.key === 'Backspace' || e.key === 'Delete') handleKey('clear');
    else if (e.key === 'Enter') handleKey('ok');
    else if (e.key === 'Escape') cancel();
  };
  window.addEventListener('keydown', backdropEl._keyHandler);
}

function handleKey(k) {
  if (k === 'clear') {
    currentInput = currentInput.slice(0, -1);
  } else if (k === 'ok') {
    submit();
    return;
  } else if (/^\d$/.test(k) && currentInput.length < 3) {
    currentInput += k;
  }
  const el = document.getElementById('pv-answer');
  if (el) el.textContent = currentInput || '?';
}

function submit() {
  const value = parseInt(currentInput, 10);
  if (isNaN(value)) return;

  if (value === currentAnswer) {
    // Correct!
    const status = document.getElementById('pv-status');
    if (status) status.innerHTML = '✅ 答对了！';
    backdropEl.querySelector('.parent-verify').classList.add('parent-verify--success');
    setTimeout(() => {
      close();
      if (currentResolve) {
        const r = currentResolve;
        currentResolve = null;
        r(true);
      }
    }, 700);
  } else {
    attemptCount++;
    // Shake animation
    const card = backdropEl.querySelector('.parent-verify');
    card.classList.remove('parent-verify--shake');
    void card.offsetWidth;
    card.classList.add('parent-verify--shake');
    const status = document.getElementById('pv-status');
    if (status) status.innerHTML = `❌ 再试一次（${attemptCount}/3）`;
    currentInput = '';
    const answerEl = document.getElementById('pv-answer');
    if (answerEl) answerEl.textContent = '?';

    if (attemptCount >= 3) {
      setTimeout(() => {
        // Generate a new question after 3 failed attempts
        showChallenge();
      }, 1000);
    }
  }
}

function cancel() {
  close();
  if (currentResolve) {
    const r = currentResolve;
    currentResolve = null;
    r(false);
  }
}

function close() {
  if (backdropEl) {
    backdropEl.classList.remove('parent-verify-backdrop--visible');
    if (backdropEl._keyHandler) {
      window.removeEventListener('keydown', backdropEl._keyHandler);
      backdropEl._keyHandler = null;
    }
  }
}
