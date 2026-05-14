// 认字母 — the first mini-game built on the shared flashcard-mic engine.
//
// Shows a random 10 of the 26 English letters, one per card. Each card
// pairs the big letter with a watercolor illustration of a word that
// starts with it ("A is for Angel", "B is for Butterfly"...). Kelly
// presses the mic button and says the letter; Whisper + phonetic
// aliasing on the server verify.

import { createFlashcardMicGame, FLASHCARD_PALETTES, shuffleAndPick } from './flashcard-mic-game.js';

// Word illustration mapping — which letters have a generated watercolor PNG
// living at /child/assets/icons/alphabet/<file>.png. Letters not in this
// map use an emoji fallback.
const LETTER_WORDS = {
  A: { word: 'Angel',    zh: '小天使',  file: 'angel' },
  B: { word: 'Butterfly', zh: '蝴蝶',   file: 'butterfly' },
  C: { word: 'Cake',     zh: '蛋糕',    file: 'cake' },
  D: { word: 'Dog',      zh: '小狗',    emoji: '🐶' },
  E: { word: 'Elephant', zh: '大象',    file: 'elephant' },
  F: { word: 'Fox',      zh: '狐狸',    file: 'fox' },
  G: { word: 'Giraffe',  zh: '长颈鹿',  file: 'giraffe' },
  H: { word: 'Heart',    zh: '爱心',    file: 'heart' },
  I: { word: 'Ice',      zh: '冰淇淋',  emoji: '🍦' },
  J: { word: 'Jellyfish', zh: '水母',   file: 'jellyfish' },
  K: { word: 'Koala',    zh: '考拉',    file: 'koala' },
  L: { word: 'Lion',     zh: '狮子',    file: 'lion' },
  M: { word: 'Mushroom', zh: '蘑菇',    file: 'mushroom' },
  N: { word: 'Nest',     zh: '鸟巢',    emoji: '🪺' },
  O: { word: 'Owl',      zh: '猫头鹰',  file: 'owl' },
  P: { word: 'Pumpkin',  zh: '南瓜',    file: 'pumpkin' },
  Q: { word: 'Queen',    zh: '女王',    file: 'queen' },
  R: { word: 'Rainbow',  zh: '彩虹',    file: 'rainbow' },
  S: { word: 'Star',     zh: '星星',    file: 'star' },
  T: { word: 'Turtle',   zh: '乌龟',    file: 'turtle' },
  U: { word: 'Unicorn',  zh: '独角兽',  file: 'unicorn' },
  V: { word: 'Violin',   zh: '小提琴',  file: 'violin' },
  W: { word: 'Whale',    zh: '鲸鱼',    file: 'whale' },
  X: { word: 'Xylophone', zh: '木琴',   file: 'xylophone' },
  Y: { word: 'Yarn',     zh: '毛线球',  file: 'yarn' },
  Z: { word: 'Zebra',    zh: '斑马',    file: 'zebra' },
};

function illustrationFor(meta) {
  if (meta.file) {
    return `<img src="/child/assets/icons/alphabet/${meta.file}.png" alt="${meta.word}" class="alpha-card__word-img"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <div class="alpha-card__word-emoji" style="display:none">${meta.emoji || '✨'}</div>`;
  }
  return `<div class="alpha-card__word-emoji">${meta.emoji || '✨'}</div>`;
}

export function createAlphabetGame(containerEl, onEnd) {
  const letters = shuffleAndPick(Object.keys(LETTER_WORDS), 10);

  const cards = letters.map((letter, i) => {
    const meta = LETTER_WORDS[letter];
    return {
      key: letter,
      display: letter,
      englishName: meta.word,
      chineseName: meta.zh,
      illustration: illustrationFor(meta),
      palette: FLASHCARD_PALETTES[i % FLASHCARD_PALETTES.length],
      speakOnShow: letter,
      successSpeak: `Yes! ${letter}`,
      revealSpeak: `This is ${letter}`,
      promptLabel: `${letter} is for ${meta.word}`,
    };
  });

  return createFlashcardMicGame(containerEl, onEnd, {
    pack: 'letters',
    cards,
    topic: '字母',
  });
}
