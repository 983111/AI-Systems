import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

const K2_MODEL = 'MBZUAI-IFM/K2-Think-v2';
const K2_API_URL = 'https://api.k2think.ai/v1/chat/completions';
const SERPER_API_URL = 'https://google.serper.dev/search';

export const chatRoutes = new Hono();

// ================= SYSTEM PROMPT =================
function getSystemPrompt() {
  const now = new Date();
  return `You are Stremini, an advanced AI assistant developed by Stremini AI.
Today's date is ${now.toDateString()}.

RULES:
- Answer concisely and accurately. No filler.
- CRITICAL: DO NOT repeat yourself. Avoid infinite loops. Once a fact is stated, move on.
- Use plain text. No asterisks, no markdown bold/italic. Use dashes for lists if needed.
- Structure with clear headings only when the answer is genuinely complex.
- Never reveal reasoning, chain-of-thought, or thinking steps.
- Output the final answer only.
- If you don't know something, say so directly.`;
}

// ================= SECURITY =================
function sanitizeInput(input) {
  return input ? input.trim().slice(0, 4000) : '';
}

function containsPromptInjection(input) {
  const patterns = [
    /ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/i,
    /\bsystem\s*:/i,
    /reveal\s+(hidden|system|reasoning)/i
  ];
  return patterns.some(p => p.test(input));
}

// ================= CLEAN OUTPUT =================
function cleanOutput(text) {
  if (!text) return '';

  // If the API finished but didn't close the think tag (due to max_tokens limit), 
  // the actual text is trapped inside or empty.
  if (text.includes('</think>')) {
    const parts = text.split('</think>');
    text = parts[parts.length - 1].trim();
  } else if (text.includes('<think>')) {
    // If it opened <think> but never closed it, there is NO final answer.
    text = '';
  }

  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/Thought:[\s\S]*?(Answer:|Response:)/i, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/(?<!\S)\*(?!\S)/g, '')
    .trim();
}

// ================= SEARCH =================
function shouldSearch(input) {
  if (!input) return false;
  const hardTriggers = [
    /\b(today'?s?|right now|currently|live)\b.*\b(price|weather|score|news|result|winner|match)\b/i,
    /\b(latest|breaking|recent)\s+(news|update|result|score)\b/i,
    /\bstock\s+price\b/i,
    /\bweather\s+(in|for|at)\b/i,
    /\b(who\s+won|final\s+score)\b/i,
    /\b(current|live)\s+(standings?|leaderboard)\b/i,
    /\brelease\s+date\s+of\b/i,
  ];
  return hardTriggers.some(r => r.test(input));
}

async function performWebSearch(query, env) {
  if (!env?.SERPER_API_KEY) return null;
  try {
    const res = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': env.SERPER_API_KEY },
      body: JSON.stringify({ q: query, num: 4 })
    });
    const data = await res.json();
    if (!data.organic) return null;
    return data.organic.slice(0, 4);
  } catch {
    return null;
  }
}

// ================= MESSAGE BUILDER =================
function buildMessages(history, userMessage, searchResults) {
  const messages = [{ role: 'system', content: getSystemPrompt() }];

  if (Array.isArray(history)) {
    const cleanHistory = history
      .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
      .slice(-10);
    messages.push(...cleanHistory);
  }

  if (searchResults) {
    const context = searchResults
      .map((r, i) => `[${i + 1}] ${r.title}: ${r.snippet} (${r.link})`)
      .join('\n');
    messages.push({
      role: 'user',
      content: `Search results:\n${context}\n\nQuestion: ${userMessage}\n\nAnswer using the search results above. Be concise and accurate.`
    });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  return messages;
}

// ================= K2 CALLER (shared) =================
async function callK2(messages, env, maxTokens = 3000) {
  const response = await fetch(K2_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.K2_API_KEY}`
    },
    body: JSON.stringify({
      model: K2_MODEL,
      messages,
      temperature: 0.8, // Perfect balance for logic and variety (stops loops)
      top_p: 0.9,
      max_tokens: maxTokens // Massively increased to handle heavy thinking blocks
    })
  });

  if (!response.ok) return null;
  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content || '';
  return cleanOutput(raw);
}

// ================= DOCUMENT HELPERS =================
const MAX_CHARS_PER_CHUNK = 8000;

function chunkText(text) {
  const chunks = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = '';

  for (const para of paragraphs) {
    if ((current + para).length > MAX_CHARS_PER_CHUNK) {
      if (current.trim()) chunks.push(current.trim());
      if (para.length > MAX_CHARS_PER_CHUNK) {
        let start = 0;
        while (start < para.length) {
          chunks.push(para.slice(start, start + MAX_CHARS_PER_CHUNK));
          start += MAX_CHARS_PER_CHUNK;
        }
        current = '';
      } else {
        current = para + '\n\n';
      }
    } else {
      current += para + '\n\n';
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, MAX_CHARS_PER_CHUNK)];
}

// ================= NORMAL ROUTE =================
chatRoutes.post('/message', async (c) => {
  try {
    const { message, history } = await c.req.json();
    const userMessage = sanitizeInput(message);

    if (!userMessage) return c.json({ error: 'Empty message.' }, 400);
    if (containsPromptInjection(userMessage)) return c.json({ error: 'Suspicious input detected.' }, 400);

    let searchResults = null;
    if (shouldSearch(userMessage)) searchResults = await performWebSearch(userMessage, c.env);

    const messages = buildMessages(history, userMessage, searchResults);
    const answer = await callK2(messages, c.env, 3000);

    if (!answer) return c.json({ error: 'No response from model.' }, 502);
    return c.json({ response: answer });

  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ================= DOCUMENT CHAT ROUTE =================
chatRoutes.post('/document', async (c) => {
  try {
    const body = await c.req.json();
    const { documentText, question } = body;

    if (!documentText || !question) {
      return c.json({ error: 'documentText and question are required.' }, 400);
    }

    const sanitizedQuestion = sanitizeInput(question);
    if (containsPromptInjection(sanitizedQuestion)) {
      return c.json({ error: 'Suspicious input detected.' }, 400);
    }

    const docText = documentText.slice(0, 600000).trim();

    if (docText.length < 10) {
      return c.json({ error: 'Document text appears to be empty. Check your PDF extraction.' }, 400);
    }

    const chunks = chunkText(docText);

    // CASE 1: Document is small enough to fit in a single chunk.
    if (chunks.length === 1) {
      const answer = await callK2([
        {
          role: 'system',
          content: 'You are an advanced document analysis assistant. Use the provided document text as your primary source, but combine it with your own broader knowledge and intelligence to give a thorough, insightful, and conversational answer. If the document is missing details, use your reasoning to fill in the gaps or explain the context.\nCRITICAL: Do not repeat yourself.'
        },
        {
          role: 'user',
          content: `Document Text:\n\n${chunks[0]}\n\nQuestion: ${sanitizedQuestion}\n\nAnswer:`
        }
      ], c.env, 3500);

      return c.json({ response: answer || 'Failed to generate a response.' });
    }

    // CASE 2: Document is large. Map-Reduce Strategy (Extract -> Synthesize)
    const chunkAnswers = [];
    const extractFromChunk = async (chunk, index) => {
      const messages = [
        {
          role: 'system',
          content: `You are an information extraction assistant. Read the following portion of a document. Extract ANY facts, concepts, or context that might be related to the user's question. 
CRITICAL: Reply with EXACTLY the word "NOT_RELEVANT" if this chunk has nothing to do with the question. Answer immediately.`
        },
        {
          role: 'user',
          content: `Document portion (${index + 1} of ${chunks.length}):\n\n${chunk}\n\nQuestion: ${sanitizedQuestion}\n\nExtracted relevant content:`
        }
      ];
      return await callK2(messages, c.env, 1200);
    };

    // Process extraction in parallel (max 4 at a time to respect rate limits)
    const batchSize = 4;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const results = await Promise.all(batch.map((c, j) => extractFromChunk(c, i + j)));
      
      for (const r of results) {
        if (r && !r.includes('NOT_RELEVANT') && r.trim().length > 8) {
          chunkAnswers.push(r.trim());
        }
      }
    }

    // Nothing found in any chunk - Fallback to intelligent response
    if (chunkAnswers.length === 0) {
       const fallbackAnswer = await callK2([
          {
             role: 'system',
             content: 'You are an intelligent assistant. The user asked a question about a document, but the document did not contain the exact answer. Acknowledge that the document lacks the specific information, but then answer the user\'s question using your own general knowledge and intelligence.'
          },
          {
             role: 'user',
             content: `Question: ${sanitizedQuestion}`
          }
       ], c.env, 3500);
       return c.json({ response: fallbackAnswer });
    }

    // FINAL SYNTHESIS: Blend extracted facts with AI Intelligence
    const merged = await callK2([
      {
        role: 'system',
        content: `You are an expert document assistant. You have been provided with extracted facts from a document. Use these facts as your foundation, but apply your own intelligence, reasoning, and broader knowledge to comprehensively answer the user's question. 
RULES:
- Answer naturally and conversationally.
- Do not say "Based on the chunks" or "The document says".
- If the extracted facts are incomplete, fill in the blanks using your own expertise.
- CRITICAL: Do not fall into a loop. Do not repeat phrases.`
      },
      {
        role: 'user',
        content: `Extracted Facts:\n\n${chunkAnswers.join('\n\n')}\n\nQuestion: ${sanitizedQuestion}\n\nFinal Conversational Answer:`
      }
    ], c.env, 4000);

    return c.json({ response: merged || 'Failed to synthesize final answer.' });

  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ================= STREAM ROUTE =================
chatRoutes.post('/stream', async (c) => {
  try {
    const { message, history } = await c.req.json();
    const userMessage = sanitizeInput(message);

    if (!userMessage) return c.json({ error: 'Empty message.' }, 400);
    if (containsPromptInjection(userMessage)) return c.json({ error: 'Suspicious input detected.' }, 400);

    let searchResults = null;
    if (shouldSearch(userMessage)) searchResults = await performWebSearch(userMessage, c.env);

    const messages = buildMessages(history, userMessage, searchResults);

    const response = await fetch(K2_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.env.K2_API_KEY}` },
      body: JSON.stringify({
        model: K2_MODEL,
        messages,
        temperature: 0.5,
        top_p: 0.9,
        max_tokens: 3500, // Very important for stream stability
        stream: true
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return c.json({ error: err }, response.status);
    }

    return streamSSE(c, async (stream) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let thinkBuffer = '';
      let pastThinkTag = false;
      const THINK_BUFFER_LIMIT = 15000;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          let parsed;
          try { parsed = JSON.parse(data); } catch { continue; }

          const token = parsed.choices?.[0]?.delta?.content;
          if (!token) continue;

          if (pastThinkTag) {
            const clean = token
              .replace(/\*\*(.+?)\*\*/g, '$1')
              .replace(/\*(.+?)\*/g, '$1')
              .replace(/(?<!\S)\*(?!\S)/g, '');
            if (clean) await stream.writeSSE({ data: JSON.stringify({ token: clean }) });
          } else {
            thinkBuffer += token;

            if (thinkBuffer.length > THINK_BUFFER_LIMIT) {
              pastThinkTag = true;
              const clean = cleanOutput(thinkBuffer);
              if (clean) await stream.writeSSE({ data: JSON.stringify({ token: clean }) });
              thinkBuffer = '';
              continue;
            }

            if (thinkBuffer.includes('</think>')) {
              const parts = thinkBuffer.split('</think>');
              const realAnswer = parts[parts.length - 1];
              pastThinkTag = true;
              thinkBuffer = '';
              if (realAnswer) {
                const clean = cleanOutput(realAnswer);
                if (clean) await stream.writeSSE({ data: JSON.stringify({ token: clean }) });
              }
            }
          }
        }
      }

      if (!pastThinkTag && thinkBuffer) {
        const clean = cleanOutput(thinkBuffer);
        if (clean) await stream.writeSSE({ data: JSON.stringify({ token: clean }) });
      }

      await stream.writeSSE({ data: '[DONE]' });
    });

  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ================= HEALTH =================
chatRoutes.get('/health', (c) =>
  c.json({ status: 'ok', model: K2_MODEL })
);