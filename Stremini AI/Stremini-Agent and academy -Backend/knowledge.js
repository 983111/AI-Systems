/**
 * Stremini — Knowledge Graph Intelligence Agent
 * Cloudflare Worker · MBZUAI K2-Think backend
 *
 * Modes:
 *   add        → Extract nodes from raw input and add to the graph
 *   connect    → Build semantic edges between existing nodes
 *   explore    → Query / traverse the graph to answer questions
 *   gaps       → Detect missing knowledge in a domain
 *   synthesize → Generate insights, patterns, and novel ideas
 */

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: corsHeaders });

    if (request.method === "GET")
      return new Response(
        JSON.stringify({ status: "OK", message: "Stremini Knowledge Graph Agent is running." }),
        { status: 200, headers: corsHeaders }
      );

    if (request.method !== "POST")
      return new Response(
        JSON.stringify({ status: "ERROR", message: "Method not allowed." }),
        { status: 405, headers: corsHeaders }
      );

    // ── Parse body ────────────────────────────────────────────────────────────
    let body;
    try { body = await request.json(); }
    catch (_) {
      return new Response(
        JSON.stringify({ status: "ERROR", message: "Invalid JSON body." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { query: rawQuery, mode = "add", history = [] } = body;

    if (!rawQuery || typeof rawQuery !== "string")
      return new Response(
        JSON.stringify({ status: "ERROR", message: "Missing or invalid query." }),
        { status: 400, headers: corsHeaders }
      );

    if (!env.MBZUAI_API_KEY)
      return new Response(
        JSON.stringify({ status: "ERROR", message: "Worker secret missing. Set MBZUAI_API_KEY." }),
        { status: 500, headers: corsHeaders }
      );

    // ── Validate mode ─────────────────────────────────────────────────────────
    const VALID_MODES = ["add", "connect", "explore", "gaps", "synthesize"];
    const resolvedMode = VALID_MODES.includes(mode) ? mode : "add";

    // ── Cap input ─────────────────────────────────────────────────────────────
    const MAX_CHARS = 32000;
    const query = rawQuery.length > MAX_CHARS
      ? rawQuery.slice(0, MAX_CHARS) + "\n\n[Note: input truncated to 32 000 characters.]"
      : rawQuery;

    const trimmedHistory = history.slice(-10);

    // ── Shared preamble ───────────────────────────────────────────────────────
    const PATIENCE = `IMPORTANT: Think thoroughly before responding. Produce complete, accurate, well-reasoned structured output. Every JSON field must be populated with real, specific content — never use placeholder text. If a concept has multiple valid interpretations, choose the most useful one for a knowledge graph context.`;

    const JSON_RULES = `
ABSOLUTE OUTPUT RULES:
1. Output ONLY the JSON object inside the <kg> tags. Zero text outside it.
2. All string values must be valid JSON (escape quotes, no raw newlines inside strings).
3. Never truncate arrays. Include every node, edge, insight, and suggestion you identify.
4. node.type must be one of: concept | fact | source | question | idea
5. edge.strength must be one of: strong | moderate | weak
6. insight.type must be one of: pattern | gap | connection | contradiction | synthesis
7. suggestion.mode must be one of: add | connect | explore | gaps | synthesize`;

    // ── System prompts per mode ───────────────────────────────────────────────
    let systemPrompt;

    // ────────────────────────────────────────────────────────────────────
    // ADD — extract and structure knowledge nodes from raw input
    // ────────────────────────────────────────────────────────────────────
    if (resolvedMode === "add") {
      systemPrompt = `You are a Knowledge Graph Intelligence Agent. Your job is to parse raw notes, text, research, or descriptions and extract structured knowledge nodes for a dynamic personal knowledge graph.

${PATIENCE}

Analyze the input and produce a rich structured output. Wrap your entire output inside <kg></kg> tags:

<kg>
{
  "summary": "One-sentence description of what was captured",
  "stats": [
    { "value": 3, "label": "Nodes" },
    { "value": 5, "label": "Links" },
    { "value": 2, "label": "Insights" }
  ],
  "nodes": [
    {
      "title": "Primary concept name",
      "description": "Clear 1-2 sentence explanation of this concept and why it matters",
      "type": "concept",
      "domain": "Field or subject area (e.g. Physics, ML, History)",
      "weight": "high",
      "tags": ["tag1", "tag2"]
    }
  ],
  "edges": [
    {
      "from": "Node A title",
      "to": "Node B title",
      "relation": "short verb phrase describing the relationship (e.g. 'enables', 'contradicts', 'is a type of')",
      "strength": "strong"
    }
  ],
  "insights": [
    {
      "type": "pattern",
      "text": "A specific, actionable insight derived from this knowledge"
    }
  ],
  "suggestions": [
    {
      "emoji": "🔍",
      "title": "Explore further",
      "body": "Why exploring this would be valuable",
      "mode": "explore",
      "prompt": "Exact query to explore this topic",
      "type": "explore"
    },
    {
      "emoji": "⚠️",
      "title": "Knowledge gap detected",
      "body": "What is missing from this picture",
      "mode": "gaps",
      "prompt": "Exact query to find gaps in this area",
      "type": "gap"
    }
  ]
}
</kg>

Extract EVERY distinct concept, fact, entity, relationship, and idea from the input. Be generous — it is better to have more nodes than fewer. The knowledge graph should grow richly.

${JSON_RULES}`;

    // ────────────────────────────────────────────────────────────────────
    // CONNECT — build semantic relationships between concepts
    // ────────────────────────────────────────────────────────────────────
    } else if (resolvedMode === "connect") {
      systemPrompt = `You are a Knowledge Graph Intelligence Agent specializing in semantic relationship mapping. Your job is to identify and formalize the relationships between concepts described by the user.

${PATIENCE}

Identify every meaningful semantic connection. Wrap your entire output inside <kg></kg> tags:

<kg>
{
  "summary": "One sentence describing the relationship landscape discovered",
  "stats": [
    { "value": 4, "label": "Connections" },
    { "value": 2, "label": "Patterns" },
    { "value": 1, "label": "Contradictions" }
  ],
  "nodes": [
    {
      "title": "Concept name",
      "description": "Brief clarification of this concept as it relates to the connection",
      "type": "concept",
      "domain": "Domain area",
      "weight": "high",
      "tags": []
    }
  ],
  "edges": [
    {
      "from": "Concept A",
      "to": "Concept B",
      "relation": "precise relationship verb (e.g. 'is a prerequisite for', 'emerged from', 'challenges')",
      "strength": "strong"
    }
  ],
  "insights": [
    {
      "type": "connection",
      "text": "A non-obvious insight about how these concepts relate"
    },
    {
      "type": "contradiction",
      "text": "Any tension or contradiction between the connected ideas"
    }
  ],
  "suggestions": [
    {
      "emoji": "🧩",
      "title": "Bridge concept",
      "body": "There may be a missing intermediate concept that would clarify this relationship",
      "mode": "add",
      "prompt": "Add a concept that bridges X and Y",
      "type": "explore"
    }
  ]
}
</kg>

Be precise with relationship labels — a vague "relates to" is never acceptable. Find the exact verb that describes the connection: "enables", "contradicts", "is a subset of", "historically preceded", "is implemented by", etc.

${JSON_RULES}`;

    // ────────────────────────────────────────────────────────────────────
    // EXPLORE — traverse and answer questions about the graph
    // ────────────────────────────────────────────────────────────────────
    } else if (resolvedMode === "explore") {
      systemPrompt = `You are a Knowledge Graph Intelligence Agent. You help users explore, query, and understand the knowledge in their graph. Drawing on the conversation history and the user's question, provide a rich structured exploration.

${PATIENCE}

Wrap your entire output inside <kg></kg> tags:

<kg>
{
  "summary": "Direct answer to the question in 1-2 sentences",
  "stats": [
    { "value": 5, "label": "Related Nodes" },
    { "value": 3, "label": "Paths Found" },
    { "value": 2, "label": "Key Themes" }
  ],
  "nodes": [
    {
      "title": "Most relevant node",
      "description": "Why this node is central to the answer",
      "type": "concept",
      "domain": "Domain",
      "weight": "high",
      "tags": []
    }
  ],
  "edges": [
    {
      "from": "Node A",
      "to": "Node B",
      "relation": "how they connect in the context of the question",
      "strength": "strong"
    }
  ],
  "insights": [
    {
      "type": "synthesis",
      "text": "A synthesized insight answering or enriching the user's question"
    },
    {
      "type": "pattern",
      "text": "A pattern visible when exploring this part of the graph"
    }
  ],
  "suggestions": [
    {
      "emoji": "🔗",
      "title": "Deepen this exploration",
      "body": "Next natural step in understanding this topic",
      "mode": "explore",
      "prompt": "Follow-up exploration query",
      "type": "explore"
    },
    {
      "emoji": "⚠️",
      "title": "Gap spotted",
      "body": "A missing piece of knowledge revealed by this exploration",
      "mode": "gaps",
      "prompt": "Find gaps in this area",
      "type": "gap"
    }
  ]
}
</kg>

Draw on all context from the conversation history. Be specific and substantive — not generic. Every node and edge should be directly relevant to answering the user's query.

${JSON_RULES}`;

    // ────────────────────────────────────────────────────────────────────
    // GAPS — detect missing knowledge
    // ────────────────────────────────────────────────────────────────────
    } else if (resolvedMode === "gaps") {
      systemPrompt = `You are a Knowledge Graph Intelligence Agent specializing in epistemic gap analysis. Your job is to identify what is missing, unknown, or under-explored in the user's knowledge of a domain.

${PATIENCE}

Analyse the domain described and identify concrete knowledge gaps. Wrap your entire output inside <kg></kg> tags:

<kg>
{
  "summary": "Overview of the knowledge gap landscape in this domain",
  "stats": [
    { "value": 6, "label": "Gaps Found" },
    { "value": 3, "label": "Critical" },
    { "value": 2, "label": "Blind Spots" }
  ],
  "nodes": [
    {
      "title": "Missing concept name",
      "description": "What this gap is and why it matters for a complete understanding of the domain",
      "type": "question",
      "domain": "Domain area",
      "weight": "high",
      "tags": ["gap", "unknown"]
    }
  ],
  "edges": [
    {
      "from": "Known concept",
      "to": "Gap / unknown",
      "relation": "requires understanding of",
      "strength": "strong"
    }
  ],
  "insights": [
    {
      "type": "gap",
      "text": "A specific, concrete description of a knowledge gap and its downstream consequences"
    },
    {
      "type": "pattern",
      "text": "A meta-pattern in the gaps — e.g. 'all gaps cluster around practical application, not theory'"
    }
  ],
  "suggestions": [
    {
      "emoji": "📚",
      "title": "Fill this gap",
      "body": "Specific suggestion for how to address the most critical gap",
      "mode": "add",
      "prompt": "Add knowledge about [specific topic]",
      "type": "gap"
    },
    {
      "emoji": "🔍",
      "title": "Explore a gap",
      "body": "Start exploring the most interesting unknown",
      "mode": "explore",
      "prompt": "What do I need to know about [gap topic]?",
      "type": "explore"
    }
  ]
}
</kg>

Be brutally honest and specific. Generic "you should learn more about X" is not a gap analysis — identify precisely what concepts are missing, what questions are unanswered, and what blind spots exist based on what the user has described.

${JSON_RULES}`;

    // ────────────────────────────────────────────────────────────────────
    // SYNTHESIZE — generate insights and novel ideas from the graph
    // ────────────────────────────────────────────────────────────────────
    } else {
      systemPrompt = `You are a Knowledge Graph Intelligence Agent specializing in synthesis, cross-domain pattern recognition, and idea generation. Your job is to find non-obvious connections, emergent insights, and novel ideas latent in the user's knowledge graph.

${PATIENCE}

Synthesize across everything in the conversation history and the current request. Wrap your entire output inside <kg></kg> tags:

<kg>
{
  "summary": "The most important synthesized insight in one sentence",
  "stats": [
    { "value": 5, "label": "Patterns" },
    { "value": 3, "label": "Novel Ideas" },
    { "value": 2, "label": "Cross-links" }
  ],
  "nodes": [
    {
      "title": "Emergent concept or idea name",
      "description": "What this novel concept is and why it emerges from the knowledge graph",
      "type": "idea",
      "domain": "Synthesized domain",
      "weight": "high",
      "tags": ["emergent", "novel"]
    }
  ],
  "edges": [
    {
      "from": "Source concept A",
      "to": "Target concept B",
      "relation": "unexpected cross-domain link (e.g. 'is structurally analogous to')",
      "strength": "moderate"
    }
  ],
  "insights": [
    {
      "type": "synthesis",
      "text": "A powerful synthesized insight that would not be obvious by looking at any single concept"
    },
    {
      "type": "pattern",
      "text": "A recurring pattern across the knowledge graph that reveals something important"
    },
    {
      "type": "connection",
      "text": "An unexpected cross-domain connection with practical implications"
    }
  ],
  "suggestions": [
    {
      "emoji": "💡",
      "title": "Novel idea to explore",
      "body": "A concrete new idea or hypothesis generated from this synthesis",
      "mode": "add",
      "prompt": "Add this new idea to the knowledge graph: [specific idea]",
      "type": "explore"
    },
    {
      "emoji": "🔬",
      "title": "Test this synthesis",
      "body": "How to validate or stress-test this synthesized insight",
      "mode": "explore",
      "prompt": "What evidence supports or contradicts [synthesized insight]?",
      "type": "explore"
    }
  ]
}
</kg>

Be bold and intellectually daring. The value of synthesis is finding things nobody else would connect. Draw on the full history of this conversation to surface insights the user has not yet articulated.

${JSON_RULES}`;
    }

    // ── Call AI ───────────────────────────────────────────────────────────────
    let aiResponse;
    try {
      aiResponse = await callAI(env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, query);
    } catch (fetchErr) {
      return new Response(
        JSON.stringify({ status:"ERROR", message:`Failed to reach AI API: ${fetchErr.message ?? String(fetchErr)}` }),
        { status:502, headers:corsHeaders }
      );
    }

    if (!aiResponse.ok) {
      const errBody = await aiResponse.text().catch(() => "(unreadable)");
      return new Response(
        JSON.stringify({ status:"ERROR", message:`AI API returned HTTP ${aiResponse.status}. ${errBody.slice(0,400)}` }),
        { status:502, headers:corsHeaders }
      );
    }

    let aiData;
    try { aiData = await aiResponse.json(); }
    catch (_) {
      return new Response(
        JSON.stringify({ status:"ERROR", message:"AI API returned non-JSON response." }),
        { status:502, headers:corsHeaders }
      );
    }

    const rawMessage = aiData.choices?.[0]?.message?.content ?? "";
    if (!rawMessage)
      return new Response(
        JSON.stringify({ status:"ERROR", message:"AI returned an empty response." }),
        { status:200, headers:corsHeaders }
      );

    const aiMessage = stripReasoning(rawMessage);

    // ── Extract <kg> JSON ─────────────────────────────────────────────────────
    const kgRaw = extractTag(aiMessage, "kg");

    if (kgRaw) {
      let graphData;
      try {
        const cleaned = kgRaw
          .replace(/```json/gi, "")
          .replace(/```/g, "")
          .trim();
        graphData = JSON.parse(cleaned);
      } catch (parseErr) {
        // JSON parse failed — return prose fallback
        return new Response(
          JSON.stringify({ status:"COMPLETED", content: kgRaw }),
          { status:200, headers:corsHeaders }
        );
      }

      const statusMap = {
        add:       "NODE_ADDED",
        connect:   "CONNECTIONS",
        explore:   "EXPLORATION",
        gaps:      "GAPS_FOUND",
        synthesize:"SYNTHESIS",
      };

      return new Response(
        JSON.stringify({ status: statusMap[resolvedMode] || "COMPLETED", mode: resolvedMode, graph: graphData }),
        { status:200, headers:corsHeaders }
      );
    }

    // ── Plain-text fallback ───────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ status:"COMPLETED", content: aiMessage }),
      { status:200, headers:corsHeaders }
    );
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
  if (out.includes("</think>")) out = out.split("</think>").pop();
  const structural = ["<kg>"];
  let latestIdx = -1;
  for (const tag of structural) {
    const idx = out.lastIndexOf(tag);
    if (idx > latestIdx) latestIdx = idx;
  }
  if (latestIdx !== -1) return out.slice(latestIdx).trim();
  return out.trim();
}

async function callAI(apiKey, systemPrompt, history, userQuery) {
  const url     = "https://api.k2think.ai/v1/chat/completions";
  const headers = {
    "Authorization": `Bearer ${apiKey.trim()}`,
    "Content-Type":  "application/json",
  };
  const buildBody = (model) => JSON.stringify({
    model,
    messages: [
      { role:"system",  content: systemPrompt },
      ...history,
      { role:"user",    content: userQuery },
    ],
    temperature: 0.75,
    max_tokens:  16384,
    stream:      false,
  });
  let res = await fetch(url, { method:"POST", headers, body: buildBody("MBZUAI/K2-Think-v2") });
  if (!res.ok) res = await fetch(url, { method:"POST", headers, body: buildBody("MBZUAI-IFM/K2-Think-v2") });
  return res;
}