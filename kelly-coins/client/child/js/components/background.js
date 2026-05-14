// Animated background particles for atmosphere
// Creates floating sparkle/star divs with CSS keyframe animations

const PARTICLES = [
  { emoji: '✨', size: 18, duration: 8 },
  { emoji: '⭐', size: 14, duration: 12 },
  { emoji: '🌟', size: 16, duration: 10 },
  { emoji: '💫', size: 12, duration: 14 },
  { emoji: '✨', size: 10, duration: 9 },
  { emoji: '⭐', size: 16, duration: 11 },
  { emoji: '🌟', size: 12, duration: 13 },
  { emoji: '💫', size: 14, duration: 7 },
];

export function createBackground() {
  const layer = document.createElement('div');
  layer.className = 'bg-particles';

  PARTICLES.forEach((p, i) => {
    const el = document.createElement('div');
    el.className = 'bg-particle';
    el.textContent = p.emoji;
    el.style.cssText = `
      font-size: ${p.size}px;
      left: ${8 + (i * 12) % 85}%;
      top: ${5 + (i * 17) % 80}%;
      animation-duration: ${p.duration}s;
      animation-delay: ${i * -1.3}s;
    `;
    layer.appendChild(el);
  });

  return layer;
}
