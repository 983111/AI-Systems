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
      return new Response(JSON.stringify({ status: "OK", message: "Stremini Research & Math Agent Worker is running." }), { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ status: "ERROR", message: "Method not allowed." }), { status: 405, headers: corsHeaders });
    }

    try {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Invalid JSON body." }), { status: 400, headers: corsHeaders });
      }

      const {
        query,
        mode = "research",
        history = [],
        iteration = 0,
        searchResults = [],
      } = body;

      if (!query) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Missing query." }), { status: 400, headers: corsHeaders });
      }

      if (!env.MBZUAI_API_KEY) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Worker secret missing. Please set MBZUAI_API_KEY." }), { status: 500, headers: corsHeaders });
      }

      const MAX_ITERATIONS = 3;
      if (iteration >= MAX_ITERATIONS) {
        return new Response(JSON.stringify({
          status: "ERROR",
          message: `Stopped after ${MAX_ITERATIONS} iterations. Could not complete the task.`
        }), { headers: corsHeaders });
      }

      const trimmedHistory = history.slice(-10);

      // ── Fetch real-time search results via Serper (research mode only) ──
      let liveSearchResults = [];
      if (mode !== "math" && env.SERPER_API_KEY) {
        try {
          liveSearchResults = await fetchSerperResults(env.SERPER_API_KEY, query);
        } catch (searchErr) {
          console.error("Serper search failed:", searchErr.message ?? String(searchErr));
        }
      }

      // Merge: live Serper results first, then any client-supplied results (deduplicated by URL)
      const seenUrls = new Set(liveSearchResults.map(r => r.url));
      const mergedSearchResults = [
        ...liveSearchResults,
        ...searchResults.filter(r => !seenUrls.has(r.url)),
      ];

      // ── Shared diagram instructions ──
      const diagramInstructions = `
DIAGRAMS — Embed Mermaid diagrams inline using this exact tag format:

<diagram type="flowchart" title="Diagram Title Here">
flowchart TD
    A[Start Node] --> B[Process Node]
    B --> C{Decision?}
    C -->|Yes| D[Outcome A]
    C -->|No| E[Outcome B]
    D --> F[End]
    E --> F
</diagram>

<diagram type="sequence" title="Diagram Title Here">
sequenceDiagram
    participant A as Actor A
    participant B as Actor B
    A->>B: Request
    B-->>A: Response
    A->>B: Follow-up
</diagram>

<diagram type="mindmap" title="Diagram Title Here">
mindmap
  root((Core Topic))
    Category One
      Item A
      Item B
    Category Two
      Item C
      Item D
    Category Three
      Item E
</diagram>

<diagram type="timeline" title="Diagram Title Here">
timeline
    title Development Timeline
    section Early Period
        1950 : First milestone
        1960 : Second milestone
    section Modern Era
        2000 : Key development
        2020 : Recent advance
</diagram>

<diagram type="graph" title="Diagram Title Here">
graph LR
    A[Concept A] --> B[Concept B]
    B --> C[Concept C]
    A --> C
    C --> D[Outcome]
</diagram>

Diagram usage guide:
- flowchart: use for processes, methodologies, decision trees, algorithms
- sequence: use for interactions, protocols, cause-effect chains
- mindmap: use for concept overviews, topic structures, literature maps
- timeline: use for historical developments, chronological reviews
- graph: use for relationships, networks, dependencies between concepts
- Keep all node labels SHORT — under 25 characters per node
- Place diagrams naturally INSIDE the relevant section, not at the end
- Do NOT wrap diagram content in backticks or code fences — use only the <diagram> tag
- Each paper must include at least 3 diagrams; each math solution may include 1-2 if helpful
`;

      let systemPrompt;

      if (mode === "math") {
        systemPrompt = `You are Stremini, a world-class mathematics expert and professor. You solve mathematical problems with complete rigour, showing every step. You may include Mermaid diagrams to illustrate proof structure, algorithm flow, or geometric relationships.
${diagramInstructions}
OUTPUT — wrap everything in <solution></solution> tags and fill in ALL content with real mathematics:

<solution>
PROBLEM RESTATEMENT
Write a formal restatement of the problem in precise mathematical language.

GIVEN & FIND
Given: list all known quantities, conditions, and constraints
Find: state exactly what must be computed or proved

SOLUTION

Step 1 — [Write the actual name of this step, e.g. "Factor the denominator"]
Write the complete algebraic or logical working for this step. Show every intermediate line. Use ASCII math notation: fractions as a/b, powers as x^n, roots as sqrt(x), integrals as integral(f dx), sums as sum(i=1 to n). Justify each transformation with the rule or theorem applied.

Step 2 — [Write the actual name of this step]
Continue the working...

[Continue with as many steps as the problem requires — never skip or abbreviate]

[Insert a <diagram> here if it helps — e.g. flowchart of proof steps, or graph of relationships]

ANSWER
=============================================
[State the complete final answer clearly]
=============================================

VERIFICATION
Show the verification: substitute the answer back, check dimensions, or use an alternate method. Write out the full verification working.

KEY CONCEPTS USED
Write 2-4 sentences naming and briefly explaining the mathematical theorems, identities, or techniques applied in this solution.
</solution>

ABSOLUTE RULES:
- Output ONLY the <solution>...</solution> block. Zero words outside it.
- NEVER truncate. Show ALL steps with full working.
- Use plain ASCII math only — no LaTeX, no dollar signs, no backslashes.
- Fill in every section with real content — no placeholders.
- Name every theorem and lemma used in proofs.`;

      } else {
        const searchNote = mergedSearchResults.length > 0
          ? `\n\nWEB SEARCH RESULTS (real-time, via Serper):\n${mergedSearchResults.map((r, i) => `[${i+1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join("\n\n")}\n\nUse these sources. Cite as [1], [2], etc. Prioritise these results for current facts, statistics, and recent developments.`
          : "";

        const iterNote = iteration >= MAX_ITERATIONS - 1
          ? "\n\nFINAL PASS: Output a complete <paper> now."
          : "";

        systemPrompt = `You are Stremini, an elite academic research assistant. You write complete, publication-quality research papers filled with real content, real analysis, and embedded Mermaid diagrams. You never output templates or placeholder text.

Given a topic, write the ENTIRE paper NOW — every sentence, every paragraph, every diagram — all real and complete.
${diagramInstructions}
Wrap your entire output in <paper></paper> tags. Structure as follows, replacing every instruction line with real written content:

<paper>
[The actual full title of this paper in Title Case]

Authors: Stremini Research Agent
Date: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ABSTRACT

Write 200 words of real abstract prose here. Cover: what the paper investigates and why it matters, the analytical approach used, the key findings discovered, and the implications for the field. Must be a fully written paragraph with real sentences.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. INTRODUCTION

Write 4 full paragraphs of real introduction text. Paragraph 1: establish background and context for the topic. Paragraph 2: identify the specific problem or research gap. Paragraph 3: state the objectives and scope of this paper. Paragraph 4: preview the structure of the paper. Use formal academic English.

[Insert a mindmap or flowchart <diagram> here visualising the paper's core themes or the topic's key dimensions]

2. LITERATURE REVIEW / BACKGROUND

Write 4 full paragraphs reviewing real prior work. Discuss key foundational studies and their contributions. Describe competing theories or perspectives. Note gaps or contradictions in the existing literature. Reference real authors and publications.

[Insert a timeline <diagram> showing the field's historical development, OR a graph <diagram> showing relationships between key concepts]

3. METHODOLOGY / THEORETICAL FRAMEWORK

Write 3 full paragraphs describing the analytical approach used in this paper. Explain the theoretical lens or framework applied. Justify why this approach is appropriate for the research question.

[Insert a flowchart <diagram> illustrating the methodological process or analytical steps]

4. ANALYSIS AND DISCUSSION

4.1 [Write a real sub-section title directly relevant to the paper's topic]
Write 3 full paragraphs of substantive analysis under this sub-heading. Engage with evidence, data, arguments, and counterarguments. Draw on the literature reviewed.

4.2 [Write a real sub-section title directly relevant to the paper's topic]
Write 3 full paragraphs of substantive analysis. Develop the argument further. Introduce new dimensions or considerations.

[Insert a <diagram> here relevant to the analysis content — use flowchart, sequence, or graph as most appropriate]

4.3 [Write a real sub-section title directly relevant to the paper's topic]
Write 3 full paragraphs of substantive analysis. Address implications or challenges. Synthesise insights from earlier sections.

5. FINDINGS AND IMPLICATIONS

Write 4 full paragraphs presenting the key findings of the analysis. Discuss practical implications for practitioners or policymakers. Discuss theoretical implications for the academic field. Address how findings relate to the literature reviewed.

6. CONCLUSION

Write 3 full paragraphs concluding the paper. Paragraph 1: summarise the paper's core argument and contributions. Paragraph 2: acknowledge the limitations of this analysis. Paragraph 3: suggest specific, concrete directions for future research.

REFERENCES

[1] Author Last, First. "Article or Book Title." Journal Name or Publisher, Volume(Issue), Year, Pages. DOI or URL.
[2] ...
Write at least 10 real, verifiable academic references. Use real author names, real titles, real journals, and real years.
</paper>

ABSOLUTE RULES:
- Output ONLY the <paper>...</paper> block. Zero words before or after.
- NEVER output placeholder text — replace every instruction with real written content.
- Every major section must have full substantive paragraphs — minimum 3 per section.
- Include at least 3 Mermaid <diagram> blocks placed inline within relevant sections.
- Write the COMPLETE paper from title to last reference — never truncate.
- Use formal academic English with proper hedging language (suggests, indicates, may, appears to).${searchNote}${iterNote}`;
      }

      const aiResponse = await callAI(env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, query);

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text();
        return new Response(JSON.stringify({
          status: "ERROR",
          message: `AI API error (${aiResponse.status}): ${errBody}`
        }), { headers: corsHeaders });
      }

      const aiData = await aiResponse.json();
      const rawMessage = aiData.choices?.[0]?.message?.content ?? "";
      const aiMessage = stripReasoning(rawMessage);

      if (!aiMessage) {
        return new Response(JSON.stringify({ status: "ERROR", message: "AI returned empty response." }), { headers: corsHeaders });
      }

      // ── Detect <paper> ──
      const paperMatch = aiMessage.match(/<paper>([\s\S]*?)(?:<\/paper>|$)/i);
      if (paperMatch) {
        const paperContent = paperMatch[1].trim();
        const titleMatch = paperContent.match(/^(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : "Research Paper";
        return new Response(JSON.stringify({
          status: "PAPER",
          title,
          content: paperContent,
        }), { headers: corsHeaders });
      }

      // ── Detect <solution> ──
      const solutionMatch = aiMessage.match(/<solution>([\s\S]*?)(?:<\/solution>|$)/i);
      if (solutionMatch) {
        return new Response(JSON.stringify({
          status: "SOLUTION",
          content: solutionMatch[1].trim(),
        }), { headers: corsHeaders });
      }

      // ── Plain text fallback ──
      return new Response(JSON.stringify({
        status: "COMPLETED",
        solution: aiMessage,
      }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({
        status: "ERROR",
        message: `Worker exception: ${err.message ?? String(err)}`
      }), { status: 500, headers: corsHeaders });
    }
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetches real-time search results from the Serper API.
 * Returns an array of { title, url, snippet } objects.
 */
async function fetchSerperResults(serperApiKey, query, numResults = 10) {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": serperApiKey.trim(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: numResults }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Serper API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const results = [];

  // Knowledge graph — most authoritative, prepend first
  if (data.knowledgeGraph) {
    const kg = data.knowledgeGraph;
    if (kg.title && kg.description) {
      results.push({
        title: kg.title,
        url: kg.descriptionLink ?? kg.website ?? "",
        snippet: kg.description,
      });
    }
  }

  // Answer box — direct answer, prepend after knowledge graph
  if (data.answerBox) {
    const ab = data.answerBox;
    const snippet = ab.answer ?? ab.snippet ?? (Array.isArray(ab.snippetHighlighted) ? ab.snippetHighlighted.join(" ") : "") ?? "";
    if (snippet) {
      results.push({
        title: ab.title ?? "Answer Box",
        url: ab.link ?? "",
        snippet,
      });
    }
  }

  // Organic results
  if (Array.isArray(data.organic)) {
    for (const item of data.organic) {
      results.push({
        title: item.title ?? "",
        url: item.link ?? "",
        snippet: item.snippet ?? "",
      });
    }
  }

  return results;
}

function stripReasoning(raw) {
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (out.includes("</think>")) {
    out = out.split("</think>").pop();
  }
  const lastPaperIdx    = out.lastIndexOf("<paper");
  const lastSolutionIdx = out.lastIndexOf("<solution");
  const actionIdx       = Math.max(lastPaperIdx, lastSolutionIdx);
  if (actionIdx !== -1) return out.slice(actionIdx).trim();

  const paragraphs = out.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 0);
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if (paragraphs[i].length <= 800) return paragraphs[i];
  }
  const lines = out.split("\n").map(l => l.trim()).filter(l => l);
  return (lines[lines.length - 1] ?? "").trim();
}

async function callAI(apiKey, systemPrompt, history, userQuery) {
  const primaryUrl = "https://api.k2think.ai/v1/chat/completions";
  const headers = {
    "Authorization": `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  const buildBody = (model) => JSON.stringify({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userQuery },
    ],
    temperature: 0.2,
    max_tokens: 8192,
  });

  let res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI/K2-Think-v2") });
  if (!res.ok) {
    res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI-IFM/K2-Think-v2") });
  }
  return res;
}