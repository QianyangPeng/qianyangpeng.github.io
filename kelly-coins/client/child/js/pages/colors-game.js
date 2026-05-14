// 认颜色 — 8 colors, spoken in English.
//
// Instead of PNG illustrations each card shows a big organic watercolor
// "blob" painted in that color using a radial gradient + an SVG blob mask.
// This keeps the aesthetic consistent with the rest of the app and needs
// zero external assets. Tapping the blob replays its English name.

import { createFlashcardMicGame, shuffleAndPick } from './flashcard-mic-game.js';

// Each color defines:
//   - hex: the paint color used for the card's watercolor blob
//   - palette: card background/ink/accent (matching hue family so every
//     slice of the card is tonally coherent with the paint)
//   - word: English name (what Kelly needs to say)
//   - zh: Chinese subtitle
const COLOR_META = {
  red: {
    hex: '#E5524F', word: 'Red',   zh: '红色',
    palette: { bg: '#FFE3E1', ink: '#A82824', accent: '#E87671' },
  },
  orange: {
    hex: '#F4923B', word: 'Orange', zh: '橙色',
    palette: { bg: '#FFE8C9', ink: '#A65307', accent: '#F6AA57' },
  },
  yellow: {
    hex: '#F4C430', word: 'Yellow', zh: '黄色',
    palette: { bg: '#FFF3B5', ink: '#8A6802', accent: '#EFCB4F' },
  },
  green: {
    hex: '#5DB874', word: 'Green',  zh: '绿色',
    palette: { bg: '#DCF3DF', ink: '#1F6A34', accent: '#7CC18F' },
  },
  blue: {
    hex: '#5AA9E6', word: 'Blue',   zh: '蓝色',
    palette: { bg: '#DFEEFB', ink: '#1E5A86', accent: '#7EBFEC' },
  },
  purple: {
    hex: '#9A74D1', word: 'Purple', zh: '紫色',
    palette: { bg: '#EBDFF8', ink: '#55308F', accent: '#A98CDA' },
  },
  pink: {
    hex: '#F490B4', word: 'Pink',   zh: '粉色',
    palette: { bg: '#FCDEE8', ink: '#A63D68', accent: '#F5A6C1' },
  },
  brown: {
    hex: '#A06E42', word: 'Brown',  zh: '棕色',
    palette: { bg: '#F0DEC8', ink: '#5E3A1A', accent: '#B6835A' },
  },
};

// Watercolor blob SVG — same irregular outline every card, recolored per
// prompt. Extra ink-splatter dots give it a painterly feel. Keeping it
// inline means we have exactly one draw path to style and no network
// request per card.
function blobSvg(hex) {
  return `
    <svg class="color-blob" viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="g-${hex.slice(1)}" cx="40%" cy="35%" r="70%">
          <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.65"/>
          <stop offset="45%"  stop-color="${hex}"  stop-opacity="1"/>
          <stop offset="100%" stop-color="${hex}"  stop-opacity="0.75"/>
        </radialGradient>
      </defs>
      <!-- Main blob: hand-drawn irregular organic shape -->
      <path
        d="M110 14
           C 150 14, 186 38, 198 80
           C 210 122, 192 158, 158 182
           C 124 206, 76 204, 46 178
           C 16 152, 8 110, 26 74
           C 44 38, 70 14, 110 14 Z"
        fill="url(#g-${hex.slice(1)})"
        stroke="${hex}" stroke-opacity="0.6" stroke-width="2"/>
      <!-- Ink-splash dots scattered around -->
      <circle cx="28"  cy="48"  r="4" fill="${hex}" opacity="0.55"/>
      <circle cx="200" cy="72"  r="3" fill="${hex}" opacity="0.55"/>
      <circle cx="180" cy="200" r="5" fill="${hex}" opacity="0.55"/>
      <circle cx="46"  cy="206" r="3" fill="${hex}" opacity="0.55"/>
    </svg>
  `;
}

export function createColorsGame(containerEl, onEnd) {
  // 10 rounds, sampled with replacement from the 8-color pool so occasionally
  // a color repeats within a round (that's fine — good for reinforcement).
  const all = Object.keys(COLOR_META);
  const picks = shuffleAndPick(all, all.length); // all 8
  while (picks.length < 10) picks.push(all[Math.floor(Math.random() * all.length)]);

  const cards = picks.map((colorId) => {
    const meta = COLOR_META[colorId];
    return {
      key: colorId,
      display: meta.word,
      englishName: meta.word,
      chineseName: meta.zh,
      illustration: blobSvg(meta.hex),
      palette: meta.palette,
      speakOnShow: meta.word,
      successSpeak: `Yes! ${meta.word}`,
      revealSpeak: `This is ${meta.word}`,
      promptLabel: `${meta.word} · ${meta.zh}`,
    };
  });

  return createFlashcardMicGame(containerEl, onEnd, {
    pack: 'colors',
    cards,
    topic: '颜色',
  });
}
