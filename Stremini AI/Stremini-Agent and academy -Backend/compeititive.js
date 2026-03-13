/**
 * Stremini — Competitive Intelligence Agent
 * Cloudflare Worker
 *
 * Real-time data: Serper API (Google Search + News)
 * AI analysis:   MBZUAI K2-Think
 *
 * Modes: monitor | report | threats | opportunities | hiring | deep
 */

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") return new Response(null, { status:204, headers:cors });
    if (request.method === "GET")    return new Response(JSON.stringify({ status:"OK", message:"Stremini Competitive Intel Worker running." }), { status:200, headers:cors });
    if (request.method !== "POST")   return new Response(JSON.stringify({ status:"ERROR", message:"Method not allowed." }), { status:405, headers:cors });

    // ── Parse body ──────────────────────────────────────────────────────────
    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ status:"ERROR", message:"Invalid JSON." }), { status:400, headers:cors }); }

    const {
      query:    rawQuery  = "",
      mode:     rawMode   = "monitor",
      history:  rawHist   = [],
      companies = [],
    } = body;

    if (!rawQuery) return new Response(JSON.stringify({ status:"ERROR", message:"Missing query." }), { status:400, headers:cors });
    if (!env.MBZUAI_API_KEY) return new Response(JSON.stringify({ status:"ERROR", message:"MBZUAI_API_KEY not set." }), { status:500, headers:cors });

    const VALID = ["monitor","report","threats","opportunities","hiring","deep"];
    const mode  = VALID.includes(rawMode) ? rawMode : "monitor";
    const query = rawQuery.slice(0, 32000);
    const history = rawHist.slice(-10);

    // ── Real-time search (Serper — server-side secret) ───────────────────────
    const serperKey = env.SERPER_API_KEY || null;
    let liveContext = "";

    if (serperKey) {
      try {
        liveContext = await gatherIntelligence(serperKey, query, companies, mode);
      } catch (e) {
        liveContext = `[Search unavailable: ${e.message}]`;
      }
    }

    // ── System prompt ────────────────────────────────────────────────────────
    const today = new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
    const companiesList = companies.length ? companies.join(", ") : "the companies mentioned in the query";

    const PATIENCE = `IMPORTANT: Produce complete, accurate, richly detailed JSON. Populate every field with specific, real, actionable intelligence. Never use placeholder text. Never truncate arrays.`;

    const JSON_RULES = `
ABSOLUTE RULES:
1. Output ONLY the JSON object inside <intel></intel> tags. Zero text outside.
2. All strings must be valid JSON (no raw newlines in values — use \\n if needed).
3. signal.type: product | pricing | hiring | tech | partnership | funding | executive | strategy
4. signal.impact: high | medium | low
5. threat.severity: critical | high | medium | low
6. opportunity.size: high | medium | low
7. recommendation.priority: urgent | high | medium | low
8. tech_shift.type: adopting | abandoning | investing | patenting`;

    const modeInstructions = {

      monitor: `You are a world-class competitive intelligence analyst. Produce a real-time intelligence feed about the companies mentioned, drawing on the live search data below.

Focus on: product launches, pricing changes, partnership announcements, executive moves, and technology shifts from the LAST 7-14 DAYS.

${PATIENCE}

<intel>
{
  "companies_covered": ["Company A", "Company B"],
  "executive_summary": "2-3 sentence briefing on the most important developments this week",
  "signals": [
    {
      "company": "Company name",
      "title": "Specific, informative signal headline",
      "summary": "2-3 sentence description of what happened and why it matters competitively",
      "type": "product",
      "impact": "high",
      "date": "Approximate date or timeframe",
      "source": "Publication or source name",
      "source_url": "URL if available from search results"
    }
  ],
  "tech_shifts": [
    {
      "company": "Company name",
      "technology": "Technology name",
      "type": "adopting",
      "description": "What they are doing with this technology and the strategic implication"
    }
  ],
  "recommendations": [
    {
      "title": "Specific recommended action",
      "description": "Why this action is warranted now, based on the signals above",
      "priority": "high"
    }
  ],
  "sources": [
    { "title": "Source name", "url": "URL if known" }
  ]
}
</intel>`,

      report: `You are a senior strategy consultant producing a comprehensive weekly competitive intelligence report. This is a full strategic brief for an executive audience.

${PATIENCE}

Produce a complete, richly detailed report covering all watched companies:

<intel>
{
  "companies_covered": ["list all companies"],
  "executive_summary": "4-5 sentence executive summary of the week's competitive landscape. What moved, what changed, what matters most.",
  "scores": [
    { "value": 74, "label": "Threat Level", "change": "+3 pts", "trend": "up" },
    { "value": 82, "label": "Opportunity Score", "change": "+5 pts", "trend": "up" },
    { "value": 3, "label": "Critical Signals", "change": "", "trend": "flat" },
    { "value": 5, "label": "Recommendations", "change": "", "trend": "flat" }
  ],
  "company_profiles": [
    {
      "name": "Company name",
      "type": "ai",
      "tagline": "One-line description",
      "funding": "Funding stage/amount",
      "employees": "Headcount range",
      "founded": "Year",
      "hq": "City, Country",
      "summary": "2-3 sentence competitive snapshot focusing on recent moves and trajectory"
    }
  ],
  "signals": [
    {
      "company": "Name",
      "title": "Signal headline",
      "summary": "What happened and why it matters",
      "type": "product",
      "impact": "high",
      "date": "Date or timeframe",
      "source": "Source name",
      "source_url": "URL"
    }
  ],
  "threats": [
    {
      "title": "Specific threat name",
      "description": "Detailed description of the threat, how it could affect you, timeline",
      "severity": "high",
      "source_company": "Which competitor this originates from",
      "timeframe": "Immediate / 3-6 months / 6-12 months",
      "recommended_action": "Concrete action to take"
    }
  ],
  "opportunities": [
    {
      "title": "Specific opportunity",
      "description": "Why this opportunity exists right now based on competitor behavior",
      "size": "high",
      "evidence": "What competitor data supports this opportunity",
      "action": "Specific action to capture this opportunity"
    }
  ],
  "hiring_trends": [
    {
      "company": "Company name",
      "roles": [
        { "role": "Role title", "count": 12 }
      ],
      "strategic_signal": "What these hires signal about their 12-month strategy"
    }
  ],
  "tech_shifts": [
    {
      "company": "Name",
      "technology": "Tech name",
      "type": "adopting",
      "description": "Strategic implication"
    }
  ],
  "recommendations": [
    {
      "title": "Strategic recommendation title",
      "description": "Specific, actionable recommendation with clear rationale tied to the intelligence gathered",
      "priority": "urgent"
    }
  ],
  "sources": [
    { "title": "Source name", "url": "URL" }
  ]
}
</intel>`,

      threats: `You are a competitive threat intelligence specialist. Your job is to identify, classify, and rank every competitive threat from the companies mentioned.

${PATIENCE}

Be thorough and brutally honest — identify threats others might miss.

<intel>
{
  "companies_covered": ["list"],
  "executive_summary": "Summary of the threat landscape",
  "threats": [
    {
      "title": "Precise threat name",
      "description": "Detailed 3-4 sentence description: what is the threat, what competitor action created it, what is the specific mechanism by which it could harm you, and by when",
      "severity": "critical",
      "source_company": "Originating competitor",
      "timeframe": "When this threat materializes",
      "recommended_action": "Specific, concrete countermeasure"
    }
  ],
  "signals": [
    {
      "company": "Name",
      "title": "Supporting signal",
      "summary": "How this signal evidence supports a threat assessment",
      "type": "strategy",
      "impact": "high",
      "date": "Date",
      "source": "Source",
      "source_url": "URL"
    }
  ],
  "tech_shifts": [],
  "recommendations": [
    {
      "title": "Defensive action",
      "description": "How to mitigate or neutralize the threat",
      "priority": "urgent"
    }
  ],
  "sources": [{ "title": "Source", "url": "URL" }]
}
</intel>`,

      opportunities: `You are a competitive opportunity analyst. Identify every gap, weakness, and white-space opportunity created by competitor behavior.

${PATIENCE}

Look for: unmet customer needs, product gaps, pricing gaps, geographic gaps, talent gaps, technology gaps.

<intel>
{
  "companies_covered": ["list"],
  "executive_summary": "Summary of the opportunity landscape",
  "opportunities": [
    {
      "title": "Specific opportunity name",
      "description": "Detailed description: what is the opportunity, which competitor weakness/gap created it, what customer pain it addresses, why now is the right time",
      "size": "high",
      "evidence": "Specific competitor behavior or data that confirms this opportunity exists",
      "action": "The specific thing to build, launch, or do to capture this opportunity"
    }
  ],
  "signals": [
    {
      "company": "Name",
      "title": "Signal headline",
      "summary": "How this signal reveals an opportunity",
      "type": "product",
      "impact": "high",
      "date": "Date",
      "source": "Source",
      "source_url": "URL"
    }
  ],
  "tech_shifts": [],
  "recommendations": [
    {
      "title": "How to capitalize on opportunities",
      "description": "Specific prioritized actions",
      "priority": "high"
    }
  ],
  "sources": [{ "title": "Source", "url": "URL" }]
}
</intel>`,

      hiring: `You are a talent intelligence analyst. You decode competitor strategy through their hiring patterns, job postings, and organizational moves.

${PATIENCE}

Hiring patterns reveal roadmaps 6-18 months before product launches.

<intel>
{
  "companies_covered": ["list"],
  "executive_summary": "Summary of what the hiring landscape reveals about industry direction",
  "hiring_trends": [
    {
      "company": "Company name",
      "roles": [
        { "role": "Specific role title", "count": 8 },
        { "role": "Another role", "count": 5 }
      ],
      "strategic_signal": "2-3 sentence analysis: what these hires reveal about their product roadmap, technology bets, or market expansion plans for the next 12 months"
    }
  ],
  "signals": [
    {
      "company": "Name",
      "title": "Specific hiring signal",
      "summary": "What this specific hire or cluster of hires means strategically",
      "type": "hiring",
      "impact": "high",
      "date": "Date",
      "source": "Source",
      "source_url": "URL"
    }
  ],
  "tech_shifts": [],
  "opportunities": [
    {
      "title": "Talent opportunity",
      "description": "Opportunity revealed by competitor hiring patterns — e.g. they are abandoning a technology, creating availability of skilled engineers",
      "size": "medium",
      "evidence": "Hiring evidence",
      "action": "How to exploit this"
    }
  ],
  "recommendations": [
    {
      "title": "Talent and strategy recommendation",
      "description": "Action to take based on hiring intelligence",
      "priority": "high"
    }
  ],
  "sources": [{ "title": "Source", "url": "URL" }]
}
</intel>`,

      deep: `You are an elite competitive intelligence analyst producing a comprehensive deep-dive on a single company. Cover every dimension: products, pricing, technology, team, funding, strategy, culture, and competitive positioning.

${PATIENCE}

<intel>
{
  "companies_covered": ["single company"],
  "executive_summary": "5-6 sentence comprehensive portrait of the company, its current momentum, and its most significant competitive implications",
  "company_profiles": [
    {
      "name": "Company name",
      "type": "ai",
      "tagline": "One-line description",
      "funding": "Total funding raised",
      "employees": "Headcount estimate",
      "founded": "Founded year",
      "hq": "Headquarters",
      "summary": "3-4 sentence deep-dive summary covering recent trajectory, strategic bets, and competitive differentiation"
    }
  ],
  "scores": [
    { "value": 85, "label": "Market Position", "change": "+8", "trend": "up" },
    { "value": 72, "label": "Tech Strength", "change": "+3", "trend": "up" },
    { "value": 68, "label": "Threat Level", "change": "+5", "trend": "up" },
    { "value": 77, "label": "Growth Signal", "change": "+12", "trend": "up" }
  ],
  "signals": [
    {
      "company": "Name",
      "title": "Key development headline",
      "summary": "What happened and its competitive significance",
      "type": "product",
      "impact": "high",
      "date": "Date",
      "source": "Source",
      "source_url": "URL"
    }
  ],
  "threats": [
    {
      "title": "Threat this company poses",
      "description": "Specific threat mechanism",
      "severity": "high",
      "source_company": "Company name",
      "timeframe": "Timeline",
      "recommended_action": "How to respond"
    }
  ],
  "opportunities": [
    {
      "title": "Gap or weakness in this company",
      "description": "Exploitable weakness or gap",
      "size": "high",
      "evidence": "Supporting evidence",
      "action": "How to exploit"
    }
  ],
  "hiring_trends": [
    {
      "company": "Company name",
      "roles": [{ "role": "Role type", "count": 0 }],
      "strategic_signal": "What their hiring reveals"
    }
  ],
  "tech_shifts": [
    {
      "company": "Company name",
      "technology": "Technology",
      "type": "adopting",
      "description": "What they are doing and why it matters"
    }
  ],
  "recommendations": [
    {
      "title": "How to compete with this company",
      "description": "Specific differentiated strategy",
      "priority": "urgent"
    }
  ],
  "sources": [{ "title": "Source", "url": "URL" }]
}
</intel>`,
    };

    const systemPrompt = `${modeInstructions[mode]}

TODAY'S DATE: ${today}
WATCHED COMPANIES: ${companiesList}

${liveContext ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REAL-TIME SEARCH DATA (use this as primary source for recent events):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${liveContext}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : `[No real-time search data — using AI knowledge. Results reflect training cutoff, not live data. User can add a Serper API key in the sidebar for live intelligence.]`}

${JSON_RULES}`;

    // ── Call AI ───────────────────────────────────────────────────────────────
    let aiResponse;
    try { aiResponse = await callAI(env.MBZUAI_API_KEY, systemPrompt, history, query); }
    catch (e) { return new Response(JSON.stringify({ status:"ERROR", message:`AI API error: ${e.message}` }), { status:502, headers:cors }); }

    if (!aiResponse.ok) {
      const err = await aiResponse.text().catch(() => "");
      return new Response(JSON.stringify({ status:"ERROR", message:`AI returned ${aiResponse.status}: ${err.slice(0,400)}` }), { status:502, headers:cors });
    }

    let aiData;
    try { aiData = await aiResponse.json(); }
    catch { return new Response(JSON.stringify({ status:"ERROR", message:"AI returned non-JSON." }), { status:502, headers:cors }); }

    const raw = aiData.choices?.[0]?.message?.content ?? "";
    if (!raw) return new Response(JSON.stringify({ status:"ERROR", message:"AI returned empty response." }), { status:200, headers:cors });

    const stripped = stripReasoning(raw);
    const intelRaw = extractTag(stripped, "intel");

    if (intelRaw) {
      let report;
      try {
        const cleaned = intelRaw.replace(/```json/gi,"").replace(/```/g,"").trim();
        report = JSON.parse(cleaned);
      } catch {
        return new Response(JSON.stringify({ status:"COMPLETED", content: intelRaw }), { status:200, headers:cors });
      }

      const statusMap = { monitor:"MONITOR", report:"REPORT", threats:"THREATS", opportunities:"OPPORTUNITIES", hiring:"HIRING", deep:"DEEP" };
      return new Response(JSON.stringify({ status: statusMap[mode]||"COMPLETED", mode, report }), { status:200, headers:cors });
    }

    return new Response(JSON.stringify({ status:"COMPLETED", content: stripped }), { status:200, headers:cors });
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Serper intelligence gathering
// ─────────────────────────────────────────────────────────────────────────────

async function gatherIntelligence(serperKey, query, companies, mode) {
  const searches = buildSearchQueries(query, companies, mode);
  const results  = await Promise.allSettled(searches.map(q => serperSearch(serperKey, q.query, q.type)));

  const sections = [];
  results.forEach((result, i) => {
    if (result.status !== "fulfilled" || !result.value) return;
    const q = searches[i];
    sections.push(`=== SEARCH: "${q.query}" ===`);
    sections.push(formatSerperResult(result.value));
  });

  return sections.join("\n\n");
}

function buildSearchQueries(query, companies, mode) {
  const queries = [];
  const coList  = companies.length ? companies.slice(0,5) : extractCompanyNames(query);

  if (mode === "monitor") {
    coList.forEach(co => {
      queries.push({ query:`${co} product launch announcement 2024 2025`, type:"news" });
      queries.push({ query:`${co} news this week`, type:"news" });
    });
    queries.push({ query: query, type:"search" });
  }
  else if (mode === "report") {
    coList.forEach(co => {
      queries.push({ query:`${co} latest news updates strategy 2025`, type:"news" });
      queries.push({ query:`${co} funding valuation employees`, type:"search" });
    });
    queries.push({ query:`${coList.join(" vs ")} competitive landscape 2025`, type:"search" });
  }
  else if (mode === "threats") {
    coList.forEach(co => {
      queries.push({ query:`${co} new product launch competitor threat 2025`, type:"news" });
      queries.push({ query:`${co} market expansion pricing strategy`, type:"search" });
    });
  }
  else if (mode === "opportunities") {
    coList.forEach(co => {
      queries.push({ query:`${co} criticism problems user complaints weakness`, type:"search" });
      queries.push({ query:`${co} product gaps missing features`, type:"search" });
    });
  }
  else if (mode === "hiring") {
    coList.forEach(co => {
      queries.push({ query:`${co} hiring jobs open positions 2025`, type:"search" });
      queries.push({ query:`${co} layoffs hiring freeze expansion team`, type:"news" });
    });
  }
  else if (mode === "deep") {
    const company = coList[0] || query.split(" ")[0];
    queries.push({ query:`${company} company overview products funding 2025`, type:"search" });
    queries.push({ query:`${company} latest news announcements`, type:"news" });
    queries.push({ query:`${company} strategy roadmap technology stack`, type:"search" });
    queries.push({ query:`${company} pricing plans competitors`, type:"search" });
    queries.push({ query:`${company} hiring jobs team growth`, type:"search" });
  }
  else {
    queries.push({ query, type:"search" });
    coList.forEach(co => queries.push({ query:`${co} latest 2025`, type:"news" }));
  }

  return queries.slice(0, 8); // cap at 8 to stay within rate limits
}

function extractCompanyNames(query) {
  // Naive extraction — pull capitalized multi-word names
  const matches = query.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2}\b/g) || [];
  return [...new Set(matches)].filter(m => m.length > 3).slice(0, 5);
}

async function serperSearch(apiKey, query, type="search") {
  const endpoint = type === "news"
    ? "https://google.serper.dev/news"
    : "https://google.serper.dev/search";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-API-KEY":    apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 5 }),
  });

  if (!response.ok) {
    throw new Error(`Serper ${response.status}: ${await response.text().catch(()=>"")}`);
  }

  return response.json();
}

function formatSerperResult(data) {
  if (!data) return "";
  const lines = [];

  // News results
  if (data.news && data.news.length) {
    data.news.slice(0, 5).forEach(item => {
      lines.push(`• [NEWS] ${item.title}`);
      if (item.snippet) lines.push(`  ${item.snippet}`);
      if (item.source) lines.push(`  Source: ${item.source} | Date: ${item.date||"recent"}`);
      if (item.link)   lines.push(`  URL: ${item.link}`);
      lines.push("");
    });
  }

  // Organic results
  if (data.organic && data.organic.length) {
    data.organic.slice(0, 5).forEach(item => {
      lines.push(`• [WEB] ${item.title}`);
      if (item.snippet) lines.push(`  ${item.snippet}`);
      if (item.link)    lines.push(`  URL: ${item.link}`);
      lines.push("");
    });
  }

  // Knowledge graph
  if (data.knowledgeGraph) {
    const kg = data.knowledgeGraph;
    lines.push(`• [KNOWLEDGE] ${kg.title||""}${kg.type?` — ${kg.type}`:""}`);
    if (kg.description) lines.push(`  ${kg.description}`);
    const attrs = kg.attributes || {};
    if (attrs.Founded)   lines.push(`  Founded: ${attrs.Founded}`);
    if (attrs.Employees) lines.push(`  Employees: ${attrs.Employees}`);
    if (attrs.CEO)       lines.push(`  CEO: ${attrs.CEO}`);
    lines.push("");
  }

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractTag(text, tag) {
  const open  = `<${tag}>`;
  const close = `</${tag}>`;
  const si = text.lastIndexOf(open);
  if (si === -1) return null;
  const cs = si + open.length;
  const ei = text.indexOf(close, cs);
  const raw = ei === -1 ? text.slice(cs) : text.slice(cs, ei);
  return raw.trim() || null;
}

function stripReasoning(raw) {
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (out.includes("</think>")) out = out.split("</think>").pop();
  const idx = out.lastIndexOf("<intel>");
  if (idx !== -1) return out.slice(idx).trim();
  return out.trim();
}

async function callAI(apiKey, systemPrompt, history, userQuery) {
  const url     = "https://api.k2think.ai/v1/chat/completions";
  const headers = { "Authorization": `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" };
  const mkBody  = (model) => JSON.stringify({
    model,
    messages: [
      { role:"system", content: systemPrompt },
      ...history,
      { role:"user",   content: userQuery },
    ],
    temperature: 0.7,
    max_tokens:  16384,
    stream:      false,
  });
  let res = await fetch(url, { method:"POST", headers, body:mkBody("MBZUAI/K2-Think-v2") });
  if (!res.ok) res = await fetch(url, { method:"POST", headers, body:mkBody("MBZUAI-IFM/K2-Think-v2") });
  return res;
}