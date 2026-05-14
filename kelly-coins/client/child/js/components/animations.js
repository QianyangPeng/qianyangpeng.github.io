// Animation system: coin bursts, floating text, celebrations
// All animations are pure DOM + CSS keyframes for performance

let container = null;

function ensureContainer() {
  if (container) return;
  container = document.createElement('div');
  container.className = 'anim-container';
  document.getElementById('app').appendChild(container);
}

// Spawn coin burst from a source element or position
// Now uses real coin PNG images instead of emoji
export function coinBurst(sourceEl, amount) {
  ensureContainer();
  const rect = sourceEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Big burst image centered behind the coins
  const burst = document.createElement('img');
  burst.src = '/child/assets/ui/burst.png';
  burst.className = 'anim-burst';
  burst.style.left = cx + 'px';
  burst.style.top = cy + 'px';
  burst.onerror = () => burst.remove();
  container.appendChild(burst);
  burst.addEventListener('animationend', () => burst.remove());

  // Coin particles flying outward
  for (let i = 0; i < 10; i++) {
    const coin = document.createElement('img');
    coin.className = 'anim-coin anim-coin--img';
    coin.src = '/child/assets/ui/coin.png';
    coin.onerror = function() {
      // Fallback to emoji if image fails to load
      const span = document.createElement('div');
      span.className = 'anim-coin';
      span.textContent = '🪙';
      Object.assign(span.style, this.style.cssText);
      this.replaceWith(span);
    };
    const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5);
    const dist = 60 + Math.random() * 80;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 40;
    coin.style.left = cx + 'px';
    coin.style.top = cy + 'px';
    coin.style.setProperty('--dx', dx + 'px');
    coin.style.setProperty('--dy', dy + 'px');
    coin.style.animationDelay = (i * 30) + 'ms';
    container.appendChild(coin);
    coin.addEventListener('animationend', () => coin.remove());
  }

  // Floating text
  const text = document.createElement('div');
  text.className = 'anim-float-text';
  text.textContent = `+${amount}`;
  text.style.left = cx + 'px';
  text.style.top = (cy - 20) + 'px';
  container.appendChild(text);
  text.addEventListener('animationend', () => text.remove());

  // Sound
  playEarnSound();
}

// Celebration overlay (for special moments like leveling up)
export function celebrate() {
  ensureContainer();
  const emojis = ['🎉', '⭐', '✨', '🌟', '💫', '🎊'];
  for (let i = 0; i < 20; i++) {
    const el = document.createElement('div');
    el.className = 'anim-confetti';
    el.textContent = emojis[i % emojis.length];
    el.style.left = (Math.random() * 100) + 'vw';
    el.style.animationDelay = (Math.random() * 500) + 'ms';
    el.style.animationDuration = (1500 + Math.random() * 1000) + 'ms';
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }
}

// Simple audio feedback using Web Audio API
let audioCtx = null;
export function playEarnSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.08 + 0.2);
      osc.start(audioCtx.currentTime + i * 0.08);
      osc.stop(audioCtx.currentTime + i * 0.08 + 0.25);
    });
  } catch { /* silent fail on audio init */ }
}

export function playTapSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.12);
  } catch { /* silent */ }
}
