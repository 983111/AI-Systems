export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method === "GET") {
      return new Response(JSON.stringify({ status: "OK", message: "Stremini Data & Decision Intelligence Agent is running." }), { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ status: "ERROR", message: "Method not allowed." }), { status: 405, headers: corsHeaders });
    }

    try {
      let body;
      try { body = await request.json(); }
      catch (_) { return new Response(JSON.stringify({ status: "ERROR", message: "Invalid JSON body." }), { status: 400, headers: corsHeaders }); }

      const { query, mode = "diagnose", history = [], iteration = 0 } = body;

      if (!query) return new Response(JSON.stringify({ status: "ERROR", message: "Missing query." }), { status: 400, headers: corsHeaders });
      if (!env.MBZUAI_API_KEY) return new Response(JSON.stringify({ status: "ERROR", message: "Worker secret missing. Please set MBZUAI_API_KEY." }), { status: 500, headers: corsHeaders });

      const MAX_ITERATIONS = 3;
      if (iteration >= MAX_ITERATIONS) {
        return new Response(JSON.stringify({ status: "ERROR", message: `Stopped after ${MAX_ITERATIONS} iterations.` }), { headers: corsHeaders });
      }

      // Safety check to prevent .slice() crash on invalid payload types
      let safeHistory = Array.isArray(history) ? history : [];
      const trimmedHistory = safeHistory.slice(-10);

      // ─────────────────────────────────────────
      // MODE PROMPTS
      // ─────────────────────────────────────────

      const modePrompts = {

        // ── 1. Business Metric Diagnosis ──
        diagnose: `You are Stremini, a world-class Chief Data Officer. You interpret business metrics and diagnose what is healthy, broken, or at risk. Output ONLY the <report> block below — zero words outside it.

<report>
{
  "type": "diagnose",
  "title": "[Metric/Business Area] — Diagnostic Report",
  "summary": "2-3 sentence plain-English executive summary of what the data shows, the single biggest finding, and the immediate priority.",
  "health_score": 72,
  "health_label": "Needs Attention",
  "sections": [
    {
      "id": "insights",
      "label": "Key Insights",
      "icon": "lightbulb",
      "content": "What the data is telling us — the story behind the numbers.",
      "insights": [
        { "title": "Insight title", "detail": "2-3 sentence explanation of what this metric shows, why it matters, and what it implies about the business.", "signal": "positive" },
        { "title": "Insight title", "detail": "2-3 sentence explanation of what this metric shows, why it matters, and what it implies about the business.", "signal": "negative" }
      ]
    },
    {
      "id": "risk_flags",
      "label": "Risk Flags",
      "icon": "alert",
      "content": "Metrics or trends that signal potential problems if not addressed.",
      "flags": [
        { "severity": "high", "metric": "Metric name", "observation": "What the data shows", "consequence": "What happens if this is not addressed in 30 days" }
      ]
    },
    {
      "id": "benchmarks",
      "label": "Benchmark Comparison",
      "icon": "bar-chart",
      "content": "How these metrics compare to industry standards.",
      "benchmarks": [
        { "metric": "Metric name", "your_value": "Value", "industry_avg": "Average", "best_in_class": "Top tier", "verdict": "above" }
      ]
    }
  ]
}
</report>

RULES:
- Output ONLY the <report>...</report> block. Zero words outside.
- health_score must be an integer 0-100.
- All signal values must be exactly: "positive", "negative", or "neutral".
- All severity values must be exactly: "high", "medium", or "low".
- All verdict values must be exactly: "above", "below", or "at".
- Valid JSON only — escape all quotes inside strings.`,

        // ── 2. System Architecture Analysis ──
        architect: `You are Stremini, a world-class Solutions Architect. Analyse the system or codebase described and output ONLY the <report> block below — zero words outside it.

<report>
{
  "type": "architect",
  "title": "[System Name] — Architecture Analysis",
  "summary": "2 sentence plain-English summary: what this system does and the single biggest architectural finding.",
  "health_score": 74,
  "health_label": "Needs Attention",
  "sections": [
    {
      "id": "architecture",
      "label": "System Architecture",
      "icon": "layers",
      "content": "Textual component diagram showing how the system is structured.",
      "diagram": {
        "type": "ascii",
        "layers": [
          { "name": "Client", "components": ["Browser / Mobile App", "fetch() POST /v1/messages"] },
          { "name": "Edge", "components": ["Cloudflare Worker (index.js)", "CORS handler"] }
        ],
        "flows": [
          "Client → POST {query, mode, history} → Worker"
        ]
      }
    },
    {
      "id": "data_flow",
      "label": "Data Flow Mapping",
      "icon": "git-branch",
      "content": "How data moves through the system end to end.",
      "flows": [
        { "step": "1. Inbound", "from": "Client", "to": "Worker", "payload": "{ query, mode }", "notes": "JSON body validation" }
      ]
    }
  ]
}
</report>
RULES: Output ONLY the <report> block. Valid JSON only.`,

        // ── 3. RAG Pipeline Architecture ──
        rag: `You are Stremini, an expert in AI and Retrieval-Augmented Generation (RAG) architecture. Output ONLY the <report> block below.

<report>
{
  "type": "rag",
  "title": "[System Name] — RAG Performance & Architecture",
  "summary": "2-3 sentence summary: overall health of the RAG system, key bottleneck (e.g. retrieval vs generation), and most urgent priority.",
  "health_score": 75,
  "health_label": "Needs Attention",
  "sections": [
    {
      "id": "architecture",
      "label": "RAG Data Pipeline Flow",
      "icon": "git-branch",
      "content": "How data and queries move through the ingestion and retrieval pipeline.",
      "flows": [
        { "step": "1. Ingestion", "from": "Data Source", "to": "Chunker", "payload": "Raw documents", "notes": "Describe chunking strategy (size, overlap)" },
        { "step": "2. Embedding", "from": "Chunker", "to": "Vector DB", "payload": "Dense vectors + Metadata", "notes": "Embedding model and dimensionality" },
        { "step": "3. Retrieval", "from": "User Query", "to": "Vector DB", "payload": "Embedded Query", "notes": "Search type (e.g., Hybrid Search + BM25) & Top-K" },
        { "step": "4. Generation", "from": "Retrieved Context", "to": "LLM", "payload": "System Prompt + Context", "notes": "Model selection and generation parameters" }
      ]
    },
    {
      "id": "metrics",
      "label": "Retrieval & Generation Metrics",
      "icon": "bar-chart",
      "content": "Key performance indicators for the RAG system.",
      "benchmarks": [
        { "metric": "Retrieval Precision@K", "your_value": "User's value or 'Not provided'", "industry_avg": "75%", "best_in_class": "90%", "verdict": "below" },
        { "metric": "Generation Faithfulness", "your_value": "User's value or 'Not provided'", "industry_avg": "85%", "best_in_class": "98%", "verdict": "at" },
        { "metric": "End-to-End Latency", "your_value": "User's value or 'Not provided'", "industry_avg": "1.5s", "best_in_class": "600ms", "verdict": "below" }
      ]
    },
    {
      "id": "bottlenecks",
      "label": "System Bottlenecks & Risks",
      "icon": "alert",
      "content": "Where the pipeline is losing accuracy, speed, or reliability.",
      "flags": [
        { "severity": "high", "metric": "Bottleneck name", "observation": "What the metrics show (e.g., high multi-turn context loss)", "consequence": "Impact on user trust or system stability" },
        { "severity": "medium", "metric": "Bottleneck name", "observation": "What the metrics show", "consequence": "Impact on user trust or system stability" }
      ]
    },
    {
      "id": "experiments",
      "label": "Optimization Roadmap",
      "icon": "zap",
      "content": "Actionable steps to improve RAG quality, efficiency, and safety.",
      "experiments": [
        { "name": "Intervention name", "hypothesis": "Expected improvement", "method": "Implementation details (e.g., Cross-encoder re-ranking, query expansion)", "metric": "Metric to track", "timeline": "1-2 weeks", "effort": "medium" },
        { "name": "Intervention name", "hypothesis": "Expected improvement", "method": "Implementation details", "metric": "Metric to track", "timeline": "2-4 weeks", "effort": "high" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. Replace placeholders with specific metrics regarding indexing, retrieval, and generation. severity values must be exactly: "high", "medium", or "low". verdict values must be exactly: "above", "below", or "at". effort values must be exactly: "low", "medium", or "high". Valid JSON only.`
      };

      const systemPrompt = modePrompts[mode] || modePrompts.diagnose;

      const aiResponse = await callAI(env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, query);

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text();
        return new Response(JSON.stringify({ status: "ERROR", message: `AI API error (${aiResponse.status}): ${errBody}` }), { headers: corsHeaders });
      }

      const aiData = await aiResponse.json();
      const rawMessage = aiData.choices?.[0]?.message?.content ?? "";
      const aiMessage = stripReasoning(rawMessage);

      if (!aiMessage) {
        return new Response(JSON.stringify({ status: "ERROR", message: "AI returned empty response." }), { headers: corsHeaders });
      }

      // Robust regex that ignores Markdown tags around the <report>
      const reportMatch = aiMessage.match(/<report[^>]*>([\s\S]*?)(?:<\/report>|$)/i);
      
      if (reportMatch) {
        let reportJson;
        try {
          // Strip away common markdown wrappers LLMs accidentally inject inside the <report> block
          let cleanJsonString = reportMatch[1].trim();
          cleanJsonString = cleanJsonString.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
          reportJson = JSON.parse(cleanJsonString);
        } catch (_) {
          return new Response(JSON.stringify({ status: "RAW", content: reportMatch[1].trim(), mode }), { headers: corsHeaders });
        }
        return new Response(JSON.stringify({ status: "REPORT", mode, data: reportJson }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ status: "COMPLETED", solution: aiMessage }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({ status: "ERROR", message: `Worker exception: ${err.message ?? String(err)}` }), { status: 500, headers: corsHeaders });
    }
  }
};

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function stripReasoning(raw) {
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (out.includes("</think>")) out = out.split("</think>").pop();
  const lastReportIdx = out.lastIndexOf("<report");
  if (lastReportIdx !== -1) return out.slice(lastReportIdx).trim();
  const paragraphs = out.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if (paragraphs[i].length <= 800) return paragraphs[i];
  }
  const lines = out.split("\n").map(l => l.trim()).filter(l => l);
  return (lines[lines.length - 1] ?? "").trim();
}

async function callAI(apiKey, systemPrompt, history, userQuery) {
  const primaryUrl = "https://api.k2think.ai/v1/chat/completions";
  const headers = { "Authorization": `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" };
  const buildBody = (model) => JSON.stringify({
    model,
    messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: userQuery }],
    temperature: 0.2,
    max_tokens: 8192,
  });
  
  let res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI/K2-Think-v2") });
  if (!res.ok) res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI-IFM/K2-Think-v2") });
  return res;
}