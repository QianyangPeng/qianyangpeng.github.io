// Unified voice verification endpoint for speaking-mini-games.
//
// Three vocab packs share this route:
//   - letters: 26 English letters (A-Z)
//   - numbers: digits 1-10
//   - colors:  8 core colors (red, orange, yellow, green, blue, purple, pink, brown)
//
// Each pack has phonetic aliases so toddler mispronunciations and Whisper's
// own phonetic rendering ("bee" for "B", "gween" for "green") still count.
//
// Whisper is biased with a prompt listing the full vocab plus the expected
// answer — this dramatically boosts accuracy on 1-2 second single-word
// utterances, which is what we're getting from the child here.

const express = require('express');
const router = express.Router();
const whisper = require('../whisper');

// -------------------------------------------------------------------------
// Vocab packs
// -------------------------------------------------------------------------
//
// Each pack:
//   keys:     ordered list of valid answers (what the game asks for)
//   aliases:  map of key -> [accepted pronunciations, all lowercase]
//   promptFor: (expected) => string fed to Whisper as bias
//   label:    human-readable Chinese topic name (only used in logs)

const PACKS = {
  letters: {
    label: '字母',
    keys: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    aliases: {
      A: ['a', 'ay', 'eh', 'hey', 'aye'],
      B: ['b', 'bee', 'be'],
      C: ['c', 'see', 'sea', 'si'],
      D: ['d', 'dee', 'de'],
      E: ['e', 'ee', 'eh', 'he'],
      F: ['f', 'ef', 'eff'],
      G: ['g', 'gee', 'ji', 'jee'],
      H: ['h', 'aitch', 'haitch', 'age', 'etch'],
      I: ['i', 'eye', 'aye', 'ai'],
      J: ['j', 'jay', 'jai'],
      K: ['k', 'kay', 'cay', 'okay'],
      L: ['l', 'el', 'ell'],
      M: ['m', 'em', 'emm'],
      N: ['n', 'en', 'enn'],
      O: ['o', 'oh', 'ow', 'owe'],
      P: ['p', 'pee', 'pe'],
      Q: ['q', 'cue', 'queue', 'kyu', 'kew'],
      R: ['r', 'ar', 'are', 'arr'],
      S: ['s', 'es', 'ess'],
      T: ['t', 'tee', 'te'],
      U: ['u', 'you', 'yoo', 'oo'],
      V: ['v', 'vee', 've'],
      W: ['w', 'double u', 'double-u', 'dub', 'doubleyou', 'double you'],
      X: ['x', 'ex', 'ecks'],
      Y: ['y', 'why', 'wye'],
      Z: ['z', 'zee', 'zed'],
    },
    promptFor(expected) {
      return `The child is saying an English alphabet letter. The expected letter is ${expected}. Possible answers: A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z.`;
    },
  },

  numbers: {
    label: '数字',
    keys: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    // Toddler phonetic variants matter here: "tree" for "three", "free" for
    // "three", "sebben" for "seven", "tin" for "ten".
    aliases: {
      '1':  ['1', 'one', 'won', 'wun'],
      '2':  ['2', 'two', 'too', 'to', 'tu'],
      '3':  ['3', 'three', 'tree', 'free', 'thee'],
      '4':  ['4', 'four', 'for', 'fore', 'fo'],
      '5':  ['5', 'five', 'fife', 'fi'],
      '6':  ['6', 'six', 'sicks', 'siks'],
      '7':  ['7', 'seven', 'sebben', 'seben'],
      '8':  ['8', 'eight', 'ate', 'ait'],
      '9':  ['9', 'nine', 'nien', 'nyne'],
      '10': ['10', 'ten', 'tin', 'tenn'],
    },
    promptFor(expected) {
      return `The child is saying a number. The expected number is ${expected}. Possible answers: one, two, three, four, five, six, seven, eight, nine, ten.`;
    },
  },

  colors: {
    label: '颜色',
    keys: ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'brown'],
    aliases: {
      red:    ['red', 'rad', 'wed'],
      orange: ['orange', 'orenj', 'ornge', 'ornj'],
      yellow: ['yellow', 'yello', 'yelo', 'yewo'],
      green:  ['green', 'grin', 'gween', 'geen'],
      blue:   ['blue', 'bloo', 'blu', 'bew'],
      purple: ['purple', 'perple', 'pupple', 'purpul'],
      pink:   ['pink', 'pinku', 'peenk'],
      brown:  ['brown', 'bown', 'bran', 'bown'],
    },
    promptFor(expected) {
      return `The child is saying a color name in English. The expected color is ${expected}. Possible answers: red, orange, yellow, green, blue, purple, pink, brown.`;
    },
  },
};

// -------------------------------------------------------------------------
// Fuzzy matching
// -------------------------------------------------------------------------

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\s-]/gu, ' ') // drop punctuation except dash
    .replace(/\s+/g, ' ')
    .trim();
}

function answerMatches(pack, expected, heard) {
  const aliases = pack.aliases[expected] || [String(expected).toLowerCase()];
  const norm = normalize(heard);
  if (!norm) return false;

  // Exact match against any alias string (handles multi-word like "double u")
  if (aliases.includes(norm)) return true;

  // Word-level match — transcript might be "three." or "it's three"
  const words = norm.split(/[\s-]+/);
  if (words.length <= 4 && words.some(w => aliases.includes(w))) return true;

  // Some aliases are multi-word ("double u"). Do substring check as fallback.
  if (aliases.some(a => a.includes(' ') && norm.includes(a))) return true;

  return false;
}

// -------------------------------------------------------------------------
// Route: POST /api/voice-verify?pack=<letters|numbers|colors>&answer=<key>
// Body: raw audio bytes (webm/opus)
// -------------------------------------------------------------------------

router.post(
  '/api/voice-verify',
  express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '5mb' }),
  async (req, res) => {
    const packName = String(req.query.pack || '').toLowerCase();
    const answer = String(req.query.answer || '');
    const pack = PACKS[packName];
    if (!pack) {
      return res.status(400).json({ success: false, message: `unknown pack: ${packName}` });
    }
    if (!pack.keys.includes(answer)) {
      return res.status(400).json({ success: false, message: `answer not in pack: ${answer}` });
    }
    if (!req.body || !req.body.length) {
      return res.status(400).json({ success: false, message: 'audio body required' });
    }

    try {
      const { text } = await whisper.transcribe(req.body, {
        filename: 'voice.webm',
        prompt: pack.promptFor(answer),
        language: 'en',
      });
      const matches = answerMatches(pack, answer, text);
      res.json({ success: true, matches, expected: answer, heard: text, pack: packName });
    } catch (e) {
      console.error(`[voice-verify] ${packName} ${answer} failed:`, e.message);
      res.status(500).json({ success: false, message: 'verify failed', error: e.message });
    }
  }
);

// -------------------------------------------------------------------------
// Backward-compat: the alphabet game was calling /api/alphabet/verify?letter=X
// before the packs existed. Route it through the same handler so existing
// clients keep working until a browser refresh.
// -------------------------------------------------------------------------

router.post(
  '/api/alphabet/verify',
  express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '5mb' }),
  async (req, res) => {
    const letter = String(req.query.letter || '').toUpperCase();
    const pack = PACKS.letters;
    if (!pack.keys.includes(letter)) {
      return res.status(400).json({ success: false, message: 'letter must be A-Z' });
    }
    if (!req.body || !req.body.length) {
      return res.status(400).json({ success: false, message: 'audio body required' });
    }
    try {
      const { text } = await whisper.transcribe(req.body, {
        filename: 'letter.webm',
        prompt: pack.promptFor(letter),
        language: 'en',
      });
      const matches = answerMatches(pack, letter, text);
      res.json({ success: true, matches, expected: letter, heard: text });
    } catch (e) {
      console.error('[alphabet-compat] verify failed:', e.message);
      res.status(500).json({ success: false, message: 'verify failed', error: e.message });
    }
  }
);

module.exports = router;
