// ─────────────────────────────────────────────────────────────────────────────
// Stremini Concept Explainer + Visualizer Agent — Cloudflare Worker
// Secret required: K2THINK_API_KEY
// Deploy: wrangler deploy concept-worker.js
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
    if (request.method === "GET")     return new Response(JSON.stringify({ status: "OK", message: "Stremini Concept Explainer running." }), { headers: cors });
    if (request.method !== "POST")    return new Response(JSON.stringify({ status: "ERROR", message: "Method not allowed." }), { status: 405, headers: cors });
    if (!env.K2THINK_API_KEY)         return new Response(JSON.stringify({ status: "ERROR", message: "Worker secret missing. Set K2THINK_API_KEY." }), { status: 500, headers: cors });

    let body;
    try { body = await request.json(); }
    catch (_) { return new Response(JSON.stringify({ status: "ERROR", message: "Invalid JSON body." }), { status: 400, headers: cors }); }

    const { concept, vizType = "auto" } = body;
    if (!concept) return new Response(JSON.stringify({ status: "ERROR", message: "Missing 'concept' field." }), { status: 400, headers: cors });

    try {
      const resolvedVizType = vizType === "auto" ? pickVizType(concept) : vizType;

      const messages = [
        { role: "system", content: buildSystemPrompt() },
        { role: "user",   content: buildPrompt(concept, resolvedVizType) },
      ];

      const { ok, text, error } = await callAI(env.K2THINK_API_KEY, messages);
      if (!ok) return new Response(JSON.stringify({ status: "ERROR", message: error }), { headers: cors });

      const clean  = sanitize(text);
      const parsed = extractJSON(clean);

      if (!parsed) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Model returned invalid structure. Please try again." }), { headers: cors });
      }

      // Inject resolved vizType in case auto was used
      parsed.vizType = parsed.vizType || resolvedVizType;
      parsed.status  = "OK";

      return new Response(JSON.stringify(parsed), { headers: cors });

    } catch (err) {
      return new Response(JSON.stringify({
        status: "ERROR",
        message: `Worker exception: ${err.message ?? String(err)}`,
      }), { status: 500, headers: cors });
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Auto-pick best viz type from concept text
// ─────────────────────────────────────────────────────────────────────────────
function pickVizType(concept) {
  const c = concept.toLowerCase();
  if (c.match(/compare|vs|versus|difference|better|which/))           return "compare";
  if (c.match(/history|timeline|evolution|invented|founded|over time/)) return "timeline";
  if (c.match(/like|analogy|similar to|think of/))                     return "analogy";
  if (c.match(/parts|components|aspects|types|categories|overview/))   return "map";
  return "flow"; // default — most concepts have a flow or process
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemPrompt() {
  return [
    "You are the Stremini Concept Explainer Agent. You explain concepts visually by outputting a single structured JSON object.",
    "",
    "STRICT RULES:",
    "1. Output ONLY a single valid JSON object. No markdown, no explanation, no text outside the JSON.",
    "2. The JSON must match the schema exactly for the requested vizType.",
    "3. All string values must be plain text — no markdown, no asterisks, no hashtags.",
    "4. Be specific, educational, and accurate. No vague filler.",
    "5. Always include keyConcepts (array of 4-8 short terms) and a rich explanation string.",
    "6. Always include an analogy object even when vizType is not analogy.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Build prompt per viz type
// ─────────────────────────────────────────────────────────────────────────────
function buildPrompt(concept, vizType) {
  const schemas = {
    flow: `{
  "title": "Full concept name",
  "subtitle": "One sentence: what it is and why it matters",
  "vizType": "flow",
  "keyConcepts": ["term1", "term2", "term3", "term4", "term5"],
  "visualization": [
    { "step": 1, "name": "Step Name", "desc": "What happens here and why", "badge": "optional short tag", "arrowLabel": "optional label on arrow to next step" },
    { "step": 2, "name": "Step Name", "desc": "What happens here and why" },
    { "step": 3, "name": "Step Name", "desc": "What happens here and why", "highlight": true },
    { "step": 4, "name": "Step Name", "desc": "What happens here and why" },
    { "step": 5, "name": "Step Name", "desc": "What happens here and why" }
  ],
  "analogy": {
    "concept": "short name of concept",
    "comparison": "the real-world analogy",
    "explanation": "2-3 sentences explaining why this analogy works"
  },
  "explanation": "3-4 paragraph plain-text explanation. Cover what it is, how it works, why each step matters, and real-world use cases. No markdown."
}`,

    map: `{
  "title": "Full concept name",
  "subtitle": "One sentence overview",
  "vizType": "map",
  "keyConcepts": ["term1", "term2", "term3", "term4", "term5"],
  "visualization": {
    "center": "Core concept name",
    "branches": [
      { "name": "Branch Title", "items": ["point 1", "point 2", "point 3"] },
      { "name": "Branch Title", "items": ["point 1", "point 2", "point 3"] },
      { "name": "Branch Title", "items": ["point 1", "point 2", "point 3"] },
      { "name": "Branch Title", "items": ["point 1", "point 2", "point 3"] },
      { "name": "Branch Title", "items": ["point 1", "point 2"] }
    ]
  },
  "analogy": {
    "concept": "short name",
    "comparison": "real-world analogy",
    "explanation": "2-3 sentences"
  },
  "explanation": "3-4 paragraph plain-text explanation. No markdown."
}`,

    timeline: `{
  "title": "Full concept name",
  "subtitle": "One sentence overview",
  "vizType": "timeline",
  "keyConcepts": ["term1", "term2", "term3", "term4"],
  "visualization": [
    { "label": "Year or Phase", "title": "Event or milestone name", "desc": "What happened and why it matters" },
    { "label": "Year or Phase", "title": "Event or milestone name", "desc": "What happened and why it matters" },
    { "label": "Year or Phase", "title": "Event or milestone name", "desc": "What happened and why it matters" },
    { "label": "Year or Phase", "title": "Event or milestone name", "desc": "What happened and why it matters" },
    { "label": "Year or Phase", "title": "Event or milestone name", "desc": "What happened and why it matters" }
  ],
  "analogy": {
    "concept": "short name",
    "comparison": "real-world analogy",
    "explanation": "2-3 sentences"
  },
  "explanation": "3-4 paragraph plain-text explanation. No markdown."
}`,

    compare: `{
  "title": "Thing A vs Thing B",
  "subtitle": "One sentence: what is being compared and why it matters",
  "vizType": "compare",
  "keyConcepts": ["term1", "term2", "term3", "term4"],
  "visualization": {
    "columns": ["Thing A", "Thing B"],
    "rows": [
      { "feature": "Feature name", "Thing A": "description", "Thing B": "description" },
      { "feature": "Feature name", "Thing A": "description", "Thing B": "description" },
      { "feature": "Feature name", "Thing A": "description", "Thing B": "description" },
      { "feature": "Feature name", "Thing A": "description", "Thing B": "description" },
      { "feature": "Feature name", "Thing A": "description", "Thing B": "description" },
      { "feature": "Feature name", "Thing A": "description", "Thing B": "description" },
      { "feature": "Best for",     "Thing A": "use case",    "Thing B": "use case" }
    ]
  },
  "analogy": {
    "concept": "short name",
    "comparison": "real-world analogy",
    "explanation": "2-3 sentences"
  },
  "explanation": "3-4 paragraph plain-text explanation covering both sides, trade-offs, and when to choose each. No markdown."
}`,

    analogy: `{
  "title": "Full concept name",
  "subtitle": "One sentence overview",
  "vizType": "analogy",
  "keyConcepts": ["term1", "term2", "term3", "term4"],
  "visualization": null,
  "analogy": {
    "concept": "short name of the concept",
    "comparison": "the everyday analogy (1-2 sentences)",
    "explanation": "4-5 sentences deeply explaining how every part of the analogy maps to the real concept"
  },
  "explanation": "3-4 paragraph plain-text explanation. Start from basics, build up to advanced. No markdown."
}`,
  };

  const schema = schemas[vizType] || schemas.flow;

  return [
    `Explain this concept: "${concept}"`,
    `Visualization type: ${vizType}`,
    "",
    "Output ONLY this JSON structure, filled with real accurate content:",
    schema,
    "",
    "Important:",
    "- Replace ALL placeholder text with real, specific, accurate content about the concept.",
    "- explanation must be 3-4 full paragraphs of plain prose, minimum 200 words.",
    "- For compare type: replace 'Thing A' and 'Thing B' in both columns array and row keys with the actual names being compared.",
    "- Output ONLY the JSON object. No text before or after it.",
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
      temperature: 0.7,
      max_tokens:  4096,
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
// Strip <think> reasoning tokens
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
// Extract JSON object from raw text — strips fences, finds first { ... }
// ─────────────────────────────────────────────────────────────────────────────
function extractJSON(text) {
  if (!text) return null;

  // Strip markdown fences
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

  // Find outermost { }
  const start = text.indexOf("{");
  const end   = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const jsonStr = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch (_) {
    // Attempt repair: close any open braces/brackets
    try { return JSON.parse(repairJSON(jsonStr)); }
    catch (_) { return null; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repair truncated JSON
// ─────────────────────────────────────────────────────────────────────────────
function repairJSON(text) {
  let t        = text.trimEnd().replace(/,\s*$/, "");
  let braces   = 0, brackets = 0;
  let inString = false, escape = false;

  for (const ch of t) {
    if (escape)      { escape = false; continue; }
    if (ch === "\\") { escape = true;  continue; }
    if (ch === '"')  { inString = !inString; continue; }
    if (inString)    continue;
    if (ch === "{")  braces++;
    if (ch === "}")  braces--;
    if (ch === "[")  brackets++;
    if (ch === "]")  brackets--;
  }

  if (braces   > 0) t += "}".repeat(braces);
  if (brackets > 0) t += "]".repeat(brackets);
  return t;
}