// Speech-to-Text for the Stage 0 call log, via OpenAI's Whisper API.
// Requires OPENAI_API_KEY in the environment. Falls back to a clear
// Russian error message when the key is not configured, so the rest of
// the app remains fully usable without this integration.
export async function transcribeAudio(fileBuffer, filename = 'audio.webm', mimeType = 'audio/webm') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Транскрибация недоступна: не задан OPENAI_API_KEY на сервере.');
  }

  const form = new FormData();
  form.append('file', new Blob([fileBuffer], { type: mimeType }), filename);
  form.append('model', 'whisper-1');
  form.append('language', 'ru');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ошибка Whisper API: ${errText}`);
  }

  const data = await response.json();
  return data.text;
}

// Very small heuristic "key noun/verb" highlighter used until a deeper
// NLP pipeline is wired in. Splits on whitespace and flags long-ish words
// that are not common stop-words — good enough to draw attention while
// re-reading a transcript.
const STOP_WORDS = new Set([
  'что', 'как', 'это', 'она', 'он', 'мы', 'вы', 'они', 'но', 'если', 'когда',
  'для', 'или', 'там', 'тут', 'уже', 'ещё', 'еще', 'просто', 'быть', 'есть',
  'все', 'всё', 'так', 'вот', 'при', 'его', 'её', 'их', 'то', 'на', 'по',
]);

export function highlightKeywords(text) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const seen = new Set();
  const keywords = [];
  for (const raw of words) {
    const word = raw.replace(/[^\p{L}-]/gu, '').toLowerCase();
    if (word.length >= 5 && !STOP_WORDS.has(word) && !seen.has(word)) {
      seen.add(word);
      keywords.push(word);
    }
  }
  return keywords.slice(0, 25);
}
