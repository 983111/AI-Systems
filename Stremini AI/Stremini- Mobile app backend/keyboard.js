import { Hono } from 'hono';

export const keyboardRoutes = new Hono();

// ==========================================
// CONFIGURATION
// ==========================================
const KEYBOARD_MODEL = 'MBZUAI-IFM/K2-Think-v2';
const KEYBOARD_API_URL = 'https://api.k2think.ai/v1/chat/completions';

// Groq — used exclusively for translation
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ==========================================
// IN-FLIGHT DEDUPLICATION
// If the same prompt fires twice simultaneously, reuse the first promise.
// ==========================================
const inflightCache = new Map();

function deduped(key, fn) {
  if (inflightCache.has(key)) return inflightCache.get(key);
  const p = fn().finally(() => inflightCache.delete(key));
  inflightCache.set(key, p);
  return p;
}

// ==========================================
// UTILITIES
// ==========================================

function sanitizeText(text) {
  return text ? text.trim().slice(0, 3000).replace(/[\x00-\x1F\x7F]/g, '') : '';
}

function cleanOutput(text) {
  if (!text) return '';

  if (text.includes('</think>')) {
    const parts = text.split('</think>');
    text = parts[parts.length - 1].trim();
  }

  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/Thought:[\s\S]*?(Answer:|Response:)/i, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/(?<!\S)\*(?!\S)/g, '')
    .replace(/^["'`]|["'`]$/g, '')
    .trim();
}

// ==========================================
// LLM HELPER
// ==========================================
async function callLLM(systemInstruction, userPrompt, apiKey, config = {}) {
  const response = await fetch(KEYBOARD_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: KEYBOARD_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: config.max_tokens || 80,
      temperature: config.temperature ?? 0.25,
      top_p: 0.85,
      reasoning: false
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  const result = await response.json();
  const raw = result.choices?.[0]?.message?.content || '';
  return cleanOutput(raw);
}

// ==========================================
// GROQ LLM HELPER (for translation)
// ==========================================
async function callGroq(systemInstruction, userPrompt, apiKey, config = {}) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: config.max_tokens || 400,
      temperature: config.temperature ?? 0.2
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error ${response.status}: ${err}`);
  }

  const result = await response.json();
  const raw = result.choices?.[0]?.message?.content || '';
  return cleanOutput(raw);
}

// ==========================================
// ROUTES
// ==========================================

// 1. SMART TEXT COMPLETION
keyboardRoutes.post('/complete', async (c) => {
  try {
    const { text, context = '' } = await c.req.json();
    if (!text) return c.json({ error: 'Text is required' }, 400);

    const sanitized = sanitizeText(text);
    const apiKey = c.env.K2_API_KEY;
    if (!apiKey) throw new Error('K2_API_KEY not configured.');

    const systemInstruction = `You are a keyboard autocomplete engine.
Given an incomplete sentence, return ONLY the continuation — the words that come AFTER the input.
Rules:
- Do NOT repeat or include the original input text.
- Output only the new words that complete the sentence. No labels, no quotes, no explanation.
- Keep it short and natural (a few words to one sentence max).
- If the sentence is already complete, return an empty string.`;

    const prompt = `${context ? `Context: ${context.slice(-100)}\n` : ''}Complete after: "${sanitized}"`;

    const completion = await deduped(`complete:${sanitized}`, () =>
      callLLM(systemInstruction, prompt, apiKey, {
        max_tokens: 30,
        temperature: 0.2
      })
    );

    return c.json({
      success: true,
      completion,
      originalText: sanitized
    });

  } catch (error) {
    return c.json({ error: 'Completion failed', message: error.message }, 500);
  }
});

// 2. NEXT-WORD SUGGESTIONS
keyboardRoutes.post('/suggest', async (c) => {
  try {
    const { text, count = 3 } = await c.req.json();
    const sanitized = sanitizeText(text || '');
    const apiKey = c.env.K2_API_KEY;
    if (!apiKey) throw new Error('K2_API_KEY not configured.');

    const systemInstruction = `You are a next-word prediction engine.
Return ONLY a JSON array of ${count} short word/phrase predictions that naturally follow the input.
Example output: ["going", "doing well", "are you"]
No explanation. No markdown. JSON array only.`;

    let suggestions = [];
    try {
      const response = await deduped(`suggest:${sanitized}:${count}`, () =>
        callLLM(systemInstruction, `Input: "${sanitized}"`, apiKey, {
          max_tokens: 50,
          temperature: 0.45
        })
      );
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) suggestions = JSON.parse(jsonMatch[0]);
    } catch {
      suggestions = ['OK', 'Thanks', 'Yes'];
    }

    return c.json({
      success: true,
      suggestions: suggestions.slice(0, count)
    });
  } catch (error) {
    return c.json({ error: 'Suggestions failed', message: error.message }, 500);
  }
});

// 3. TONE REWRITING
keyboardRoutes.post('/tone', async (c) => {
  try {
    const { text, tone } = await c.req.json();
    if (!text || !tone) return c.json({ error: 'Missing text or tone' }, 400);

    const sanitized = sanitizeText(text);
    const sanitizedTone = String(tone).trim().slice(0, 50);
    const apiKey = c.env.K2_API_KEY;
    if (!apiKey) throw new Error('K2_API_KEY not configured.');

    const systemInstruction = `Rewrite the user's text in a ${sanitizedTone} tone. Preserve the original meaning. Output ONLY the rewritten text with no labels, no quotes, and no explanation.`;

    const rewritten = await callLLM(systemInstruction, sanitized, apiKey, {
      max_tokens: 200,
      temperature: 0.5
    });

    return c.json({ success: true, rewritten });
  } catch (error) {
    return c.json({ error: 'Tone rewrite failed', message: error.message }, 500);
  }
});

// 4. TRANSLATION
// Supported languages map: code → display name
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'zh': 'Chinese (Simplified)',
  'zh-tw': 'Chinese (Traditional)',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'bn': 'Bengali',
  'tr': 'Turkish',
  'nl': 'Dutch',
  'pl': 'Polish',
  'sv': 'Swedish',
  'da': 'Danish',
  'fi': 'Finnish',
  'no': 'Norwegian',
  'cs': 'Czech',
  'ro': 'Romanian',
  'hu': 'Hungarian',
  'el': 'Greek',
  'he': 'Hebrew',
  'th': 'Thai',
  'vi': 'Vietnamese',
  'id': 'Indonesian',
  'ms': 'Malay',
  'uk': 'Ukrainian',
  'fa': 'Persian',
  'sw': 'Swahili',
  'ur': 'Urdu',
  'ta': 'Tamil',
  'te': 'Telugu',
  'ml': 'Malayalam',
  'mr': 'Marathi',
  'pa': 'Punjabi',
  'gu': 'Gujarati',
};

// GET /translate/languages — return the full supported language list
keyboardRoutes.get('/translate/languages', (c) => {
  const languages = Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
    code,
    name
  }));
  return c.json({ success: true, languages });
});

// POST /translate — translate text to one or more target languages
keyboardRoutes.post('/translate', async (c) => {
  try {
    const { text, targetLanguage, targetLanguages } = await c.req.json();
    if (!text) return c.json({ error: 'Missing text' }, 400);

    // Support both single (targetLanguage) and batch (targetLanguages) modes
    const rawTargets = targetLanguages
      ? (Array.isArray(targetLanguages) ? targetLanguages : [targetLanguages])
      : targetLanguage
        ? [targetLanguage]
        : [];

    if (rawTargets.length === 0) {
      return c.json({
        error: 'Missing targetLanguage or targetLanguages',
        hint: 'Use GET /translate/languages to see supported language codes'
      }, 400);
    }

    if (rawTargets.length > 10) {
      return c.json({ error: 'Maximum 10 target languages per request' }, 400);
    }

    const apiKey = c.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured.');

    const sanitized = sanitizeText(text);

    // Resolve each target to a full language name (accept code or name)
    const resolveLanguage = (input) => {
      const lower = String(input).trim().toLowerCase();
      // Exact code match
      if (SUPPORTED_LANGUAGES[lower]) return SUPPORTED_LANGUAGES[lower];
      // Name match (case-insensitive)
      const byName = Object.values(SUPPORTED_LANGUAGES).find(
        (name) => name.toLowerCase() === lower
      );
      if (byName) return byName;
      // Partial name match
      const partial = Object.values(SUPPORTED_LANGUAGES).find(
        (name) => name.toLowerCase().startsWith(lower)
      );
      if (partial) return partial;
      // Allow free-form if not recognized (pass through as-is)
      return String(input).trim();
    };

    const resolvedTargets = rawTargets.map(resolveLanguage);

    // Run all translations in parallel
    const results = await Promise.all(
      resolvedTargets.map(async (languageName, i) => {
        const cacheKey = `translate:${sanitized}:${languageName}`;
        const systemInstruction = `You are a professional translator. Translate the given text to ${languageName}.
Return ONLY the translated text. No labels, no explanations, no quotes.`;

        try {
          const translation = await deduped(cacheKey, () =>
            callGroq(systemInstruction, sanitized, apiKey, {
              max_tokens: 400,
              temperature: 0.2
            })
          );
          return {
            language: languageName,
            input: rawTargets[i],
            translation,
            success: true
          };
        } catch (err) {
          return {
            language: languageName,
            input: rawTargets[i],
            error: err.message,
            success: false
          };
        }
      })
    );

    // Flatten to a single value for single-target requests (backwards compatible)
    const isSingle = !targetLanguages && rawTargets.length === 1;

    return c.json({
      success: true,
      ...(isSingle
        ? {
            translation: results[0].translation,
            language: results[0].language
          }
        : { translations: results })
    });

  } catch (error) {
    return c.json({ error: 'Translation failed', message: error.message }, 500);
  }
});

// 5. GRAMMAR CORRECTION
keyboardRoutes.post('/correct', async (c) => {
  try {
    const { text } = await c.req.json();
    if (!text) return c.json({ error: 'Text required' }, 400);

    const apiKey = c.env.K2_API_KEY;
    if (!apiKey) throw new Error('K2_API_KEY not configured.');

    const systemInstruction = `Fix grammar, spelling, and punctuation in the given text.
Return ONLY the corrected text. Do not change the meaning or style.`;

    const corrected = await callLLM(systemInstruction, text, apiKey, {
      max_tokens: 300,
      temperature: 0.15
    });

    return c.json({ success: true, corrected });
  } catch (error) {
    return c.json({ error: 'Correction failed', message: error.message }, 500);
  }
});

// 6. EMOJI SUGGESTIONS
keyboardRoutes.post('/emoji', async (c) => {
  try {
    const { text, count = 5 } = await c.req.json();
    if (!text) return c.json({ error: 'Text required' }, 400);

    const apiKey = c.env.K2_API_KEY;
    if (!apiKey) throw new Error('K2_API_KEY not configured.');

    const sanitized = sanitizeText(text);

    const systemInstruction = `Suggest ${count} relevant emojis for the given text.
Return ONLY a JSON array of emoji characters. Example: ["😊", "👍", "🔥"]
No text, no labels, no markdown.`;

    let emojis = [];
    try {
      const response = await deduped(`emoji:${sanitized}:${count}`, () =>
        callLLM(systemInstruction, `Text: "${sanitized}"`, apiKey, {
          max_tokens: 40,
          temperature: 0.7
        })
      );
      const jsonMatch = response.match(/\[[\s\S]*?\]/);
      if (jsonMatch) emojis = JSON.parse(jsonMatch[0]);
    } catch {
      emojis = ['👍', '😊', '✅'];
    }

    return c.json({ success: true, emojis: emojis.slice(0, count) });
  } catch (error) {
    return c.json({ error: 'Emoji suggestion failed', message: error.message }, 500);
  }
});

// 7. HEALTH
keyboardRoutes.get('/health', (c) => {
  const hasKey = !!c.env?.K2_API_KEY;
  return c.json({
    status: hasKey ? 'operational' : 'degraded',
    model: KEYBOARD_MODEL,
    message: hasKey ? 'Service operational' : 'K2_API_KEY missing'
  });
});