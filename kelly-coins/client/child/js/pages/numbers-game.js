// 认数字 — digits 1-10 with mic verification.
//
// Same flashcard engine as the alphabet game. Each card shows:
//   • the big digit
//   • N copies of a themed emoji below it (so "3" literally shows three stars)
//   • the English word + Chinese subtitle
//
// Kelly presses the mic and says the number in English. Whisper is biased
// toward "one/two/three/..." via the numbers vocab pack on the server.

import { createFlashcardMicGame, FLASHCARD_PALETTES, shuffleAndPick } from './flashcard-mic-game.js';

// English + Chinese names for each digit, plus the emoji we repeat under the
// digit to visualise the count. Emojis are chosen to rotate visually so the
// card illustrations don't all look the same across a round.
const NUMBER_META = {
  '1':  { word: 'One',   zh: '一', emoji: '⭐' },
  '2':  { word: 'Two',   zh: '二', emoji: '🌸' },
  '3':  { word: 'Three', zh: '三', emoji: '🦋' },
  '4':  { word: 'Four',  zh: '四', emoji: '🍎' },
  '5':  { word: 'Five',  zh: '五', emoji: '💖' },
  '6':  { word: 'Six',   zh: '六', emoji: '🐞' },
  '7':  { word: 'Seven', zh: '七', emoji: '🍇' },
  '8':  { word: 'Eight', zh: '八', emoji: '🐠' },
  '9':  { word: 'Nine',  zh: '九', emoji: '🍪' },
  '10': { word: 'Ten',   zh: '十', emoji: '🌼' },
};

function illustrationFor(digit, meta) {
  const count = Number(digit);
  // Wrap the emojis in a flex grid so large counts (7+) wrap nicely onto a
  // second row instead of shrinking into a single squished line.
  const emojis = Array.from({ length: count }, () => `<span class="num-card__pip">${meta.emoji}</span>`).join('');
  return `<div class="num-card__pips num-card__pips--n${count}">${emojis}</div>`;
}

export function createNumbersGame(containerEl, onEnd) {
  const digits = shuffleAndPick(Object.keys(NUMBER_META), 10);

  const cards = digits.map((digit, i) => {
    const meta = NUMBER_META[digit];
    return {
      key: digit,
      display: digit,
      englishName: meta.word,
      chineseName: meta.zh,
      illustration: illustrationFor(digit, meta),
      palette: FLASHCARD_PALETTES[i % FLASHCARD_PALETTES.length],
      speakOnShow: meta.word,
      successSpeak: `Yes! ${meta.word}`,
      revealSpeak: `This is ${meta.word}`,
      promptLabel: `${digit} — ${meta.word}`,
    };
  });

  return createFlashcardMicGame(containerEl, onEnd, {
    pack: 'numbers',
    cards,
    topic: '数字',
  });
}
