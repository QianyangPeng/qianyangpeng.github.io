// Whisper API wrapper — transcribes a short audio clip and returns the text.
//
// Used by the alphabet game: Kelly hears a letter prompt, speaks it into the
// mic, we POST the resulting audio blob to /api/alphabet/verify, and this
// module calls OpenAI's gpt-4o-transcribe (the successor to whisper-1) with
// a biased prompt to nudge recognition toward the expected letter.
//
// Node has no native multipart/form-data builder, so we assemble the body
// manually. It's a small fixed shape — one file field + a few text fields —
// and the audio is at most a few seconds of Opus/webm, so the whole thing
// fits comfortably in memory.

const fs = require('fs');
const path = require('path');
const https = require('https');

let cachedKey = null;
function getApiKey() {
  if (cachedKey) return cachedKey;
  if (process.env.OPENAI_API_KEY) { cachedKey = process.env.OPENAI_API_KEY; return cachedKey; }
  try {
    const p = path.join(__dirname, 'openai-key.txt');
    if (fs.existsSync(p)) {
      cachedKey = fs.readFileSync(p, 'utf8').trim();
      return cachedKey;
    }
  } catch (e) { /* fall through */ }
  return null;
}

/**
 * Transcribe an audio buffer via OpenAI's transcription API.
 *
 * @param {Buffer} audioBuffer  Raw audio data (webm/opus/mp3/wav all OK).
 * @param {object} opts
 *   opts.filename  - reported filename (e.g. 'letter.webm'); the extension
 *                    tells Whisper what codec to decode.
 *   opts.prompt    - biasing prompt, e.g. "The child is saying an English
 *                    letter: A B C D ...". Improves accuracy on tiny clips.
 *   opts.language  - ISO code ('en', 'zh'). Leaving unset lets Whisper
 *                    detect, which we prefer here because the child may
 *                    reply in either language.
 * @returns {Promise<{text: string}>}  Resolves to the transcript text.
 */
function transcribe(audioBuffer, { filename = 'audio.webm', prompt = '', language = 'en' } = {}) {
  return new Promise((resolve, reject) => {
    const key = getApiKey();
    if (!key) return reject(new Error('OPENAI_API_KEY not configured'));

    const boundary = '----kellycoins' + Math.random().toString(36).slice(2);
    const CRLF = '\r\n';

    const header = (name, extra = '') =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${extra}${CRLF}${CRLF}`;

    const parts = [];
    // model
    parts.push(Buffer.from(header('model') + 'whisper-1' + CRLF));
    // response_format
    parts.push(Buffer.from(header('response_format') + 'json' + CRLF));
    // language
    if (language) parts.push(Buffer.from(header('language') + language + CRLF));
    // prompt
    if (prompt) parts.push(Buffer.from(header('prompt') + prompt + CRLF));
    // temperature (low = more deterministic; we want the most likely single token)
    parts.push(Buffer.from(header('temperature') + '0' + CRLF));
    // file
    const contentType = filename.endsWith('.webm')
      ? 'audio/webm'
      : filename.endsWith('.mp3')
        ? 'audio/mpeg'
        : 'application/octet-stream';
    parts.push(Buffer.from(
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"${CRLF}` +
      `Content-Type: ${contentType}${CRLF}${CRLF}`
    ));
    parts.push(audioBuffer);
    parts.push(Buffer.from(CRLF));
    // closing boundary
    parts.push(Buffer.from(`--${boundary}--${CRLF}`));

    const body = Buffer.concat(parts);

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/audio/transcriptions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      timeout: 30000,
    }, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 400) {
          return reject(new Error(`Whisper ${res.statusCode}: ${raw.slice(0, 400)}`));
        }
        try {
          const json = JSON.parse(raw);
          resolve({ text: (json.text || '').trim(), raw: json });
        } catch (e) {
          reject(new Error(`Invalid JSON from Whisper: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Whisper request timeout')); });
    req.write(body);
    req.end();
  });
}

module.exports = { transcribe };
