// ─────────────────────────────────────────────────────────────────────────────
// Stremini Dataset Builder Agent — Cloudflare Worker
// Secret required: K2THINK_API_KEY
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method === "GET")     return new Response(JSON.stringify({ status: "OK", message: "Stremini Dataset Builder Agent running." }), { headers: cors });
    if (request.method !== "POST")    return new Response(JSON.stringify({ status: "ERROR", message: "Method not allowed." }), { status: 405, headers: cors });
    if (!env.K2THINK_API_KEY)         return new Response(JSON.stringify({ status: "ERROR", message: "Worker secret missing. Set K2THINK_API_KEY." }), { status: 500, headers: cors });

    let body;
    try { body = await request.json(); }
    catch (_) { return new Response(JSON.stringify({ status: "ERROR", message: "Invalid JSON body." }), { status: 400, headers: cors }); }

    const { action, goal, mode = "full", message, history = [] } = body;
    if (!action) return new Response(JSON.stringify({ status: "ERROR", message: "Missing 'action'." }), { status: 400, headers: cors });

    try {

      // ── ACTION: initialize ─────────────────────────────────────────────────
      if (action === "initialize") {
        if (!goal) return new Response(JSON.stringify({ status: "ERROR", message: "Missing 'goal'." }), { status: 400, headers: cors });

        const messages = [
          { role: "system", content: buildSystemPrompt() },
          { role: "user",   content: buildPrompt(goal, 1, 50) },
        ];

        const { ok, text, error } = await callAI(env.K2THINK_API_KEY, messages);
        if (!ok) return new Response(JSON.stringify({ status: "ERROR", message: error }), { headers: cors });

        const records = extractJSON(sanitize(text));

        const fullHistory = [
          ...messages,
          { role: "assistant", content: text },
        ];

        return new Response(JSON.stringify({
          status:   "INITIALIZED",
          reply:    JSON.stringify(records),
          history:  fullHistory,
          summary:  buildSummary(records),
          pipeline: getPipelineStages(mode),
        }), { headers: cors });
      }

      // ── ACTION: chat (generate more / augment / readme) ───────────────────
      if (action === "chat") {
        if (!message) return new Response(JSON.stringify({ status: "ERROR", message: "Missing 'message'." }), { status: 400, headers: cors });
        if (!history.length) return new Response(JSON.stringify({ status: "ERROR", message: "No history. Initialize first." }), { status: 400, headers: cors });

        // Always force 50 more records regardless of user phrasing
        const goal = extractGoal(history);
        const existingCount = countExistingRecords(history);
        const startId = existingCount + 1;

        // Detect if user wants README instead of more data
        const wantsReadme = /readme|documentation|dataset card|huggingface card/i.test(message);

        let chatMessages;
        if (wantsReadme) {
          chatMessages = [
            ...history.slice(-6),
            { role: "user", content: buildReadmePrompt(goal) },
          ];
        } else {
          chatMessages = [
            { role: "system", content: buildSystemPrompt() },
            { role: "user",   content: buildPrompt(goal, startId, startId + 49) },
          ];
        }

        const { ok, text, error } = await callAI(env.K2THINK_API_KEY, chatMessages);
        if (!ok) return new Response(JSON.stringify({ status: "ERROR", message: error }), { headers: cors });

        const cleanText = sanitize(text);
        const records   = wantsReadme ? [] : extractJSON(cleanText);
        const reply     = wantsReadme ? cleanText : JSON.stringify(records);

        const updatedHistory = [...history.slice(-10), { role: "user", content: message }, { role: "assistant", content: text }];

        return new Response(JSON.stringify({
          status:  "REPLY",
          reply,
          history: updatedHistory,
          summary: records.length ? buildSummary(records) : undefined,
          pipeline: records.length ? getPipelineStages(mode) : undefined,
        }), { headers: cors });
      }

      return new Response(JSON.stringify({ status: "ERROR", message: `Unknown action: ${action}` }), { status: 400, headers: cors });

    } catch (err) {
      return new Response(JSON.stringify({
        status: "ERROR",
        message: `Worker exception: ${err.message ?? String(err)}`,
      }), { status: 500, headers: cors });
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builders — always 50 records
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return [
    "You are a synthetic ML dataset generator. Your only output is a valid JSON array of dataset records.",
    "RULES:",
    "1. Output ONLY a raw JSON array. No explanation, no markdown, no preamble, no text after the array.",
    "2. Always generate EXACTLY 50 records — no more, no less.",
    "3. Every record must have: id, text, label, source, quality_score, metadata.",
    "4. text must be realistic, specific, and unique — never generic filler.",
    "5. Never use ** or # or markdown in any field value.",
    "6. quality_score is an integer between 70 and 98.",
    "7. Distribute labels evenly across all relevant classes.",
    "8. The array must be complete and valid JSON — always close with ].",
  ].join("\n");
}

function buildPrompt(goal, startId, endId) {
  const padded = (n) => String(n).padStart(3, "0");
  return [
    `DATASET GOAL: ${goal}`,
    "",
    `Generate EXACTLY 50 JSON records. IDs must run from ${padded(startId)} to ${padded(endId)}.`,
    "Each record:",
    `{ "id": "rec_${padded(startId)}", "text": "<unique realistic text>", "label": "<class>", "source": "<real source name>", "quality_score": <70-98>, "metadata": { "language": "en", "length_chars": <int>, "topic": "<topic>", "date": "<YYYY-MM-DD>" } }`,
    "",
    "Requirements:",
    "- text fields must be long, varied, realistic — not repeated or paraphrased versions of each other",
    "- use at least 4 different values for source",
    "- distribute labels evenly",
    "- output ONLY the JSON array, starting with [ and ending with ]",
    "- do NOT stop before record " + padded(endId),
  ].join("\n");
}

function buildReadmePrompt(goal) {
  return [
    `Write a HuggingFace-style README dataset card for a dataset built for: ${goal}`,
    "Output ONLY the markdown inside a single markdown code fence (```markdown ... ```).",
    "Include: title, description, labels, sources, schema table, usage example, license, citation.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// AI call — streaming SSE
// ─────────────────────────────────────────────────────────────────────────────
async function callAI(apiKey, messages) {
  const res = await fetch("https://api.k2think.ai/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type":  "application/json",
      "Accept":        "application/json",
    },
    body: JSON.stringify({
      model:       "MBZUAI-IFM/K2-Think-v2",
      messages,
      temperature: 0.9,
      max_tokens:  8192,
      stream:      true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return { ok: false, text: "", error: `AI error (${res.status}): ${err}` };
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText  = "";
  let buffer    = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try { fullText += JSON.parse(data).choices?.[0]?.delta?.content ?? ""; }
      catch (_) {}
    }
  }

  return { ok: true, text: fullText, error: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Strip <think> tokens
// ─────────────────────────────────────────────────────────────────────────────
function sanitize(text) {
  let out = text || "";
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, "");
  out = out.replace(/<analysis>[\s\S]*?<\/analysis>/gi, "");
  for (const tag of ["</think>", "</analysis>"]) {
    if (out.toLowerCase().includes(tag)) {
      out = out.slice(out.toLowerCase().lastIndexOf(tag) + tag.length);
    }
  }
  return out.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract JSON array from raw text — robust against truncation & preamble
// ─────────────────────────────────────────────────────────────────────────────
function extractJSON(text) {
  if (!text) return [];

  // Remove markdown fences if present
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

  // Find the first [ and last ]
  const start = text.indexOf("[");
  let   end   = text.lastIndexOf("]");

  if (start === -1) return [];

  // If truncated (no closing ]), attempt to repair
  if (end === -1 || end < start) {
    text = repairJSON(text.slice(start));
    end  = text.lastIndexOf("]");
    if (end === -1) return [];
  }

  const jsonStr = text.slice(start, end + 1);

  try {
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr)) return [];
    // Validate each record has required fields
    return arr.filter(r => r && typeof r === "object" && r.text && r.label);
  } catch (_) {
    // Try repairing
    try {
      const arr = JSON.parse(repairJSON(jsonStr));
      if (!Array.isArray(arr)) return [];
      return arr.filter(r => r && typeof r === "object" && r.text && r.label);
    } catch (_) {
      return [];
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repair truncated JSON array — closes open objects and the array
// ─────────────────────────────────────────────────────────────────────────────
function repairJSON(text) {
  // Remove trailing comma before attempting close
  let t = text.trimEnd().replace(/,\s*$/, "");

  // Count unmatched braces
  let openBraces   = 0;
  let openBrackets = 0;
  let inString     = false;
  let escape       = false;

  for (const ch of t) {
    if (escape)       { escape = false; continue; }
    if (ch === "\\")  { escape = true;  continue; }
    if (ch === '"')   { inString = !inString; continue; }
    if (inString)     continue;
    if (ch === "{")   openBraces++;
    if (ch === "}")   openBraces--;
    if (ch === "[")   openBrackets++;
    if (ch === "]")   openBrackets--;
  }

  // Close any open braces first
  if (openBraces > 0)   t += "}".repeat(openBraces);
  // Close the array
  if (openBrackets > 0) t += "]".repeat(openBrackets);

  return t;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function buildSummary(records) {
  const labels  = [...new Set(records.map(r => r.label).filter(Boolean))];
  const sources = [...new Set(records.map(r => r.source).filter(Boolean))];
  const avgQ    = records.length ? Math.round(records.reduce((a, r) => a + (r.quality_score || 0), 0) / records.length) : 0;
  const avgL    = records.length ? Math.round(records.reduce((a, r) => a + (r.text || "").length, 0) / records.length) : 0;
  return {
    samples:            records.length,
    labels:             labels.length || "TBD",
    quality_pass:       records.filter(r => (r.quality_score || 0) >= 70).length,
    duplicates_removed: 0,
    augmented:          0,
    avg_length:         avgL ? `${avgL}ch` : "—",
    avg_quality:        avgQ,
    sources:            sources.length,
  };
}

function getPipelineStages(mode) {
  const all = ["collect", "clean", "label", "quality", "augment", "export"];
  const map = {
    full:    all,
    collect: ["collect"],
    clean:   ["clean", "label", "quality"],
    augment: ["augment", "export"],
    analyze: ["quality"],
    chat:    [],
  };
  return map[mode] || all;
}

function extractGoal(history) {
  const userMsg = history.find(m => m.role === "user" && m.content && m.content.includes("DATASET GOAL:"));
  if (userMsg) {
    const match = userMsg.content.match(/DATASET GOAL:\s*(.+)/);
    if (match) return match[1].trim();
  }
  const firstUser = history.find(m => m.role === "user");
  return firstUser ? firstUser.content.slice(0, 200) : "unknown dataset";
}

function countExistingRecords(history) {
  let count = 0;
  for (const m of history) {
    if (m.role === "assistant") {
      const records = extractJSON(m.content);
      count += records.length;
    }
  }
  return count;
}