export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({ status: "OK", message: "Stremini Product Builder Worker is running." }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ status: "ERROR", message: "Method not allowed." }),
        { status: 405, headers: corsHeaders }
      );
    }

    try {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Invalid JSON body." }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { idea: rawIdea, phase = "full", history = [] } = body;

      if (!rawIdea || typeof rawIdea !== "string") {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Missing or invalid idea." }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!env.MBZUAI_API_KEY) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Worker secret missing. Please set MBZUAI_API_KEY." }),
          { status: 500, headers: corsHeaders }
        );
      }

      // ── Cap idea length ────────────────────────────────────────────────────
      const MAX_CHARS = 8000;
      const idea = rawIdea.length > MAX_CHARS
        ? rawIdea.slice(0, MAX_CHARS) + "\n\n[Note: input truncated to 8 000 characters.]"
        : rawIdea;

      const trimmedHistory = history.slice(-8);

      // ── Shared preamble ────────────────────────────────────────────────────
      const PATIENCE_PREAMBLE = `IMPORTANT: Think carefully and produce complete, production-quality output for every section. Do NOT use placeholders like "[add here]", "[TBD]", or "...". Every section must be genuinely filled with thoughtful, specific content tailored to the given idea.`;

      // ── VALID PHASES ───────────────────────────────────────────────────────
      const VALID_PHASES = ["prd", "schema", "frontend", "deployment", "full"];
      const resolvedPhase = VALID_PHASES.includes(phase) ? phase : "full";

      // ── Build system prompt ────────────────────────────────────────────────
      const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

      const systemPrompt = `You are Stremini, an elite autonomous product architect and full-stack engineer. Your job is to take a raw product idea and turn it into a complete, ready-to-build MVP specification and codebase.

${PATIENCE_PREAMBLE}

You will produce output wrapped in <product></product> tags. Inside, use exactly these section tags in this order:

<product>
<prd>
PRODUCT REQUIREMENTS DOCUMENT
==============================
Product: [Product name — catchy, memorable]
Tagline: [One sentence value proposition]
Date: ${today}
Version: 1.0 MVP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROBLEM STATEMENT
[2–3 sentences: who has this problem, what they currently do, why that's inadequate.]

TARGET USERS
Primary: [description + 2-line persona]
Secondary: [description + 2-line persona]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CORE FEATURES — MVP SCOPE

[For each feature, use this format:]
Feature N — [Feature Name]
  Priority: [P0 / P1 / P2]
  User story: As a [user], I want to [action] so that [benefit].
  Acceptance criteria:
    • [criterion 1]
    • [criterion 2]
    • [criterion 3]

[Include 5–8 features minimum.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OUT OF SCOPE (V1)
[3–5 things explicitly excluded from MVP with reason.]

SUCCESS METRICS
[4–6 measurable KPIs with specific targets, e.g. "DAU > 500 within 60 days".]

TECH STACK RECOMMENDATION
Frontend: [specific framework + rationale]
Backend: [specific stack + rationale]
Database: [specific DB + rationale]
Auth: [specific solution + rationale]
Hosting: [specific platform + rationale]
</prd>

<schema>
DATABASE SCHEMA
===============
Technology: [chosen DB from PRD]
ORM/Query Layer: [e.g. Prisma, Drizzle, raw SQL]

[For each table:]
━━ TABLE: [table_name] ━━
Purpose: [what this table represents]

\`\`\`sql
CREATE TABLE [table_name] (
  [column definitions with types, constraints, defaults]
  -- inline comments explaining non-obvious columns
);
\`\`\`

Indexes:
\`\`\`sql
[CREATE INDEX statements]
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RELATIONSHIPS
[Entity-relationship description in plain English, then:]

\`\`\`sql
-- Foreign key constraints and junction tables
[SQL]
\`\`\`

SEED DATA
\`\`\`sql
-- Sample seed data for development
[INSERT statements with realistic example data]
\`\`\`
</schema>

<frontend>
FRONTEND CODE
=============
Framework: [from PRD stack]
Styling: [CSS approach]
Key Libraries: [list with versions]

[Produce complete, working React/HTML code for the main application shell and the 3 most critical screens/components. Each file must be complete and functional.]

FILE: [filename.ext]
\`\`\`[language]
[complete file contents — no placeholders, no stubs, no TODOs]
\`\`\`

FILE: [filename.ext]
\`\`\`[language]
[complete file contents]
\`\`\`

FILE: [filename.ext]
\`\`\`[language]
[complete file contents]
\`\`\`
</frontend>

<deployment>
DEPLOYMENT GUIDE
================
Platform: [from PRD stack]
Estimated Monthly Cost (MVP): [cost estimate with breakdown]
Time to Deploy: [realistic estimate]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PREREQUISITES
[Numbered list of accounts, tools, and environment setup needed.]

STEP-BY-STEP DEPLOYMENT

Phase 1 — Infrastructure Setup
[Numbered steps with exact commands]
\`\`\`bash
[commands]
\`\`\`

Phase 2 — Database Setup
[Steps + commands]
\`\`\`bash
[commands]
\`\`\`

Phase 3 — Backend Deployment
[Steps + commands]
\`\`\`bash
[commands]
\`\`\`

Phase 4 — Frontend Deployment
[Steps + commands]
\`\`\`bash
[commands]
\`\`\`

Phase 5 — Post-Deploy Verification
[Checklist of things to verify after deploy]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENVIRONMENT VARIABLES
\`\`\`env
# [section comments]
[KEY=description for each required env var]
\`\`\`

SCALING PLAYBOOK
[3–5 specific scaling actions to take as traffic grows, with trigger thresholds.]

GO-LIVE CHECKLIST
[10–15 checkbox items covering security, performance, monitoring, legal.]
</deployment>
</product>

ABSOLUTE RULES:
- Output ONLY the <product>…</product> block. Zero words outside it.
- Every section tag (<prd>, <schema>, <frontend>, <deployment>) must be present and fully filled.
- All code must be complete and runnable — no stubs, no "// implement later", no "...".
- Make all content specific to the given product idea — never generic filler.
- The frontend code must be real working code (React or plain HTML/JS), not pseudocode.`;

      // ── Call the AI ────────────────────────────────────────────────────────
      let aiResponse;
      try {
        aiResponse = await callAI(env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, idea);
      } catch (fetchErr) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: `Failed to reach AI API: ${fetchErr.message ?? String(fetchErr)}` }),
          { status: 502, headers: corsHeaders }
        );
      }

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text().catch(() => "(unreadable)");
        return new Response(
          JSON.stringify({ status: "ERROR", message: `AI API returned HTTP ${aiResponse.status}. Details: ${errBody.slice(0, 400)}` }),
          { status: 502, headers: corsHeaders }
        );
      }

      let aiData;
      try {
        aiData = await aiResponse.json();
      } catch (_) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "AI API returned non-JSON response." }),
          { status: 502, headers: corsHeaders }
        );
      }

      const rawMessage = aiData.choices?.[0]?.message?.content ?? "";
      if (!rawMessage) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "AI returned an empty response. Try a more specific idea." }),
          { status: 200, headers: corsHeaders }
        );
      }

      const aiMessage = stripReasoning(rawMessage);
      if (!aiMessage) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Could not extract a usable response from the model output." }),
          { status: 200, headers: corsHeaders }
        );
      }

      // ── Extract structured output ──────────────────────────────────────────
      const productContent = extractTag(aiMessage, "product");
      if (productContent !== null) {
        const prd        = extractTag(productContent, "prd")        ?? "";
        const schema     = extractTag(productContent, "schema")     ?? "";
        const frontend   = extractTag(productContent, "frontend")   ?? "";
        const deployment = extractTag(productContent, "deployment") ?? "";

        return new Response(
          JSON.stringify({
            status: "PRODUCT_BUILT",
            data: { prd, schema, frontend, deployment, raw: productContent }
          }),
          { status: 200, headers: corsHeaders }
        );
      }

      // ── Plain fallback ─────────────────────────────────────────────────────
      return new Response(
        JSON.stringify({ status: "COMPLETED", solution: aiMessage }),
        { status: 200, headers: corsHeaders }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({ status: "ERROR", message: `Worker exception: ${err.message ?? String(err)}` }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractTag(text, tagName) {
  const open  = `<${tagName}>`;
  const close = `</${tagName}>`;
  const startIdx = text.lastIndexOf(open);
  if (startIdx === -1) return null;
  const contentStart = startIdx + open.length;
  const endIdx = text.indexOf(close, contentStart);
  const raw = endIdx === -1 ? text.slice(contentStart) : text.slice(contentStart, endIdx);
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stripReasoning(raw) {
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (out.includes("</think>")) {
    out = out.split("</think>").pop();
  }
  const structuralTags = ["<product>"];
  let latestIdx = -1;
  for (const tag of structuralTags) {
    const idx = out.lastIndexOf(tag);
    if (idx > latestIdx) latestIdx = idx;
  }
  if (latestIdx !== -1) return out.slice(latestIdx).trim();
  return out.trim();
}

async function callAI(apiKey, systemPrompt, history, userQuery) {
  const url = "https://api.k2think.ai/v1/chat/completions";
  const headers = {
    "Authorization": `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  const buildBody = (model) => JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: `Build a complete MVP for this idea:\n\n${userQuery}` },
    ],
    temperature: 0.7,
    max_tokens: 16384,
    stream: false,
  });

  let res = await fetch(url, { method: "POST", headers, body: buildBody("MBZUAI/K2-Think-v2") });
  if (!res.ok) {
    res = await fetch(url, { method: "POST", headers, body: buildBody("MBZUAI-IFM/K2-Think-v2") });
  }
  return res;
}	