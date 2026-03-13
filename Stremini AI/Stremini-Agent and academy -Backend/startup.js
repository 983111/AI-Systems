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
      return new Response(JSON.stringify({ status: "OK", message: "Stremini Startup Strategy Agent is running." }), { headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ status: "ERROR", message: "Method not allowed." }), { status: 405, headers: corsHeaders });
    }

    try {
      let body;
      try { body = await request.json(); }
      catch (_) { return new Response(JSON.stringify({ status: "ERROR", message: "Invalid JSON body." }), { status: 400, headers: corsHeaders }); }

      const {
        mode = "business_model",
        query = "",
        context = {},
        history = [],
      } = body;

      if (!query) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Missing query." }), { status: 400, headers: corsHeaders });
      }
      if (!env.MBZUAI_API_KEY) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Worker secret missing. Please set MBZUAI_API_KEY." }), { status: 500, headers: corsHeaders });
      }

      const VALID_MODES = ["business_model", "revenue", "market", "pitch", "swot"];
      if (!VALID_MODES.includes(mode)) {
        return new Response(JSON.stringify({ status: "ERROR", message: `Invalid mode. Must be one of: ${VALID_MODES.join(", ")}` }), { status: 400, headers: corsHeaders });
      }

      const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const trimmedHistory = history.slice(-6);
      const ctxBlock = buildContextBlock(context);

      // ─────────────────────────────────────────────
      // PITCH: Split into 2 calls to prevent the K2-Think model
      // from entering an infinite self-verification loop.
      // Each call has a smaller schema (~6 fields) so the model
      // can reason quickly and produce output within token limits.
      // ─────────────────────────────────────────────
      if (mode === "pitch") {
        const pitchResult = await handlePitchMode(env.MBZUAI_API_KEY, query, ctxBlock, today, trimmedHistory);
        return new Response(JSON.stringify(pitchResult), { headers: corsHeaders });
      }

      // ─────────────────────────────────────────────
      // All other modes: single call
      // ─────────────────────────────────────────────
      let systemPrompt = buildSystemPrompt(mode, ctxBlock, today);
      const userMessage = `Business query: ${query}`;
      const aiResponse = await callAI(env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, userMessage);

      if (!aiResponse.ok) {
        const errBody = await aiResponse.text();
        return new Response(JSON.stringify({ status: "ERROR", message: `AI API error (${aiResponse.status}): ${errBody}` }), { headers: corsHeaders });
      }

      const aiData = await aiResponse.json();
      const rawMessage = aiData.choices?.[0]?.message?.content ?? "";
      const cleanedMessage = stripReasoning(rawMessage);

      if (!cleanedMessage) {
        return new Response(JSON.stringify({ status: "ERROR", message: "AI returned empty response." }), { headers: corsHeaders });
      }

      let parsedOutput;
      try {
        parsedOutput = parseJsonResponse(cleanedMessage);
      } catch (parseErr) {
        return new Response(JSON.stringify({
          status: "COMPLETED",
          mode,
          content: cleanedMessage,
          parse_warning: `Could not parse as JSON: ${parseErr.message}.`,
        }), { headers: corsHeaders });
      }

      const MODE_STATUS_MAP = {
        business_model: "BUSINESS_MODEL",
        revenue:        "REVENUE",
        market:         "MARKET",
        swot:           "SWOT",
      };

      return new Response(JSON.stringify({
        status: MODE_STATUS_MAP[mode] ?? "COMPLETED",
        mode,
        data: parsedOutput,
      }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({
        status: "ERROR",
        message: `Worker exception: ${err.message ?? String(err)}`,
      }), { status: 500, headers: corsHeaders });
    }
  }
};

// ─────────────────────────────────────────────
// PITCH: Two-call strategy
// Call 1: cover, problem, solution, why_now, market_size, business_model, traction
// Call 2: go_to_market, competition, team, financials, ask, pitch_coaching
// Then merge and return as one object.
// ─────────────────────────────────────────────
async function handlePitchMode(apiKey, query, ctxBlock, today, history) {
  const antiLoop = `CRITICAL INSTRUCTION: You are a JSON generator. Do NOT verify, check, or review fields after writing them. Do NOT repeat any field names. Write the JSON once, start to finish, then stop immediately. No self-review loops.`;

  const part1Prompt = `You are a pitch deck expert for Indian, UAE, and US startups. Today is ${today}.
${ctxBlock}
${antiLoop}

Write ONLY this JSON object — no other text, no markdown fences:

{
  "cover": {
    "company_name": "string",
    "one_liner": "string",
    "tagline": "string"
  },
  "problem": {
    "headline": "string",
    "narrative": "string",
    "key_stats": ["stat1", "stat2", "stat3"]
  },
  "solution": {
    "headline": "string",
    "narrative": "string",
    "product_visual_description": "string",
    "core_features": [
      { "feature": "string", "benefit": "string" },
      { "feature": "string", "benefit": "string" },
      { "feature": "string", "benefit": "string" }
    ]
  },
  "why_now": {
    "headline": "string",
    "narrative": "string",
    "timing_factors": ["factor1", "factor2", "factor3"]
  },
  "market_size": {
    "tam": "string",
    "sam": "string",
    "som": "string",
    "narrative": "string"
  },
  "business_model": {
    "how_we_make_money": "string",
    "tiers": [
      { "plan": "string", "price": "string", "features": "string" },
      { "plan": "string", "price": "string", "features": "string" }
    ],
    "key_metric": "string"
  },
  "traction": {
    "stage": "pre-revenue",
    "highlights": ["highlight1", "highlight2", "highlight3"]
  }
}

Fill every field with real, specific content for this startup. Output ONLY the JSON. Stop after the closing brace.`;

  const part2Prompt = `You are a pitch deck expert for Indian, UAE, and US startups. Today is ${today}.
${ctxBlock}
${antiLoop}

Write ONLY this JSON object — no other text, no markdown fences:

{
  "go_to_market": {
    "phase1": "string",
    "phase2": "string",
    "phase3": "string",
    "acquisition_strategy": "string",
    "cac": "string",
    "ltv": "string",
    "payback_months": 12
  },
  "competition": {
    "axes": { "x": "string", "y": "string" },
    "competitors": [
      { "name": "string", "position": "string", "weakness": "string" },
      { "name": "string", "position": "string", "weakness": "string" }
    ],
    "why_we_win": "string"
  },
  "team": {
    "members": [
      { "name": "string", "role": "string", "bio": "string" },
      { "name": "string", "role": "string", "bio": "string" }
    ],
    "why_this_team": "string",
    "key_hires_needed": ["hire1", "hire2"]
  },
  "financials": {
    "year1": { "revenue": "string", "burn_per_month": "string", "headcount": 5 },
    "year2": { "revenue": "string", "burn_per_month": "string", "headcount": 15 },
    "year3": { "revenue": "string", "burn_per_month": "string", "headcount": 35 },
    "breakeven": "string"
  },
  "ask": {
    "amount": "string",
    "valuation_or_cap": "string",
    "round_type": "string",
    "use_of_funds": [
      { "category": "string", "pct": 40, "amount": "string", "purpose": "string" },
      { "category": "string", "pct": 30, "amount": "string", "purpose": "string" },
      { "category": "string", "pct": 30, "amount": "string", "purpose": "string" }
    ],
    "milestones": { "m6": "string", "m12": "string", "m18": "string" }
  },
  "pitch_coaching": {
    "opening_hook": "string",
    "hardest_question": { "question": "string", "answer": "string" },
    "second_hardest_question": { "question": "string", "answer": "string" },
    "closing_line": "string"
  }
}

Fill every field with real, specific content for this startup. Output ONLY the JSON. Stop after the closing brace.`;

  const userMsg = `Startup query: ${query}`;

  // Run both calls in parallel for speed
  const [res1, res2] = await Promise.all([
    callAI(apiKey, part1Prompt, history, userMsg),
    callAI(apiKey, part2Prompt, history, userMsg),
  ]);

  const errors = [];

  let part1Data = {};
  if (res1.ok) {
    const d1 = await res1.json();
    const raw1 = d1.choices?.[0]?.message?.content ?? "";
    const clean1 = stripReasoning(raw1);
    try { part1Data = parseJsonResponse(clean1); }
    catch (e) { errors.push(`Part 1 parse error: ${e.message}`); }
  } else {
    errors.push(`Part 1 API error: ${res1.status}`);
  }

  let part2Data = {};
  if (res2.ok) {
    const d2 = await res2.json();
    const raw2 = d2.choices?.[0]?.message?.content ?? "";
    const clean2 = stripReasoning(raw2);
    try { part2Data = parseJsonResponse(clean2); }
    catch (e) { errors.push(`Part 2 parse error: ${e.message}`); }
  } else {
    errors.push(`Part 2 API error: ${res2.status}`);
  }

  // Merge both parts into one complete pitch object
  const merged = { ...part1Data, ...part2Data };

  if (Object.keys(merged).length === 0) {
    return {
      status: "ERROR",
      message: `Pitch generation failed. ${errors.join(" | ")}`,
    };
  }

  return {
    status: "PITCH",
    mode: "pitch",
    data: merged,
    ...(errors.length ? { warnings: errors } : {}),
  };
}

// ─────────────────────────────────────────────
// SYSTEM PROMPTS for non-pitch modes
// ─────────────────────────────────────────────
function buildSystemPrompt(mode, ctxBlock, today) {
  const antiLoop = `CRITICAL: Output ONLY the JSON object. Do not verify fields after writing them. Do not repeat yourself. Write once, then stop.`;

  if (mode === "business_model") {
    return `You are Stremini Strategy — an elite startup advisor. Today is ${today}.
${ctxBlock}
${antiLoop}

Generate a complete business model. Output ONLY this JSON:

{
  "venture_overview": {
    "name": "string",
    "one_liner": "string",
    "category": "string",
    "stage": "string"
  },
  "value_proposition": {
    "core_problem": "string",
    "solution": "string",
    "unique_insight": "string",
    "unfair_advantage": "string"
  },
  "customer_segments": {
    "primary": {
      "profile": "string",
      "pain_intensity": "High",
      "willingness_to_pay": "string",
      "segment_size": "string"
    },
    "secondary": {
      "profile": "string",
      "why_secondary": "string"
    },
    "persona": {
      "name": "string",
      "role": "string",
      "goal": "string",
      "frustration": "string",
      "trigger": "string"
    }
  },
  "revenue_model": {
    "primary_stream": {
      "model": "string",
      "pricing": "string",
      "billing": "string",
      "rationale": "string"
    },
    "secondary_streams": ["string", "string"],
    "unit_economics": {
      "arpu": "string",
      "cac": "string",
      "ltv": "string",
      "ltv_cac_ratio": "string",
      "gross_margin": "string"
    }
  },
  "go_to_market": {
    "launch_market": "string",
    "channel_mix": {
      "phase_1": "string",
      "phase_2": "string",
      "phase_3": "string"
    },
    "acquisition_playbook": {
      "first_10": "string",
      "first_100": "string",
      "first_1000": "string"
    },
    "key_partnerships": ["string", "string", "string"]
  },
  "cost_structure": {
    "fixed_costs": {
      "infrastructure": "string",
      "team": "string",
      "compliance_legal": "string"
    },
    "variable_costs": {
      "cogs": "string",
      "support": "string"
    },
    "monthly_burn": "string",
    "runway_to_breakeven_months": 12
  },
  "risks": [
    { "name": "string", "description": "string", "mitigation": "string" },
    { "name": "string", "description": "string", "mitigation": "string" },
    { "name": "string", "description": "string", "mitigation": "string" }
  ],
  "verdict": {
    "viability_score": "7/10",
    "biggest_bet": "string",
    "first_milestone": "string",
    "honest_assessment": "string"
  }
}`;
  }

  if (mode === "revenue") {
    return `You are Stremini Strategy — a financial modelling expert. Today is ${today}.
${ctxBlock}
${antiLoop}

Build a revenue projection. Output ONLY this JSON with real numbers (no zeros, no strings for numeric fields):

{
  "assumptions": {
    "business_type": "string",
    "pricing": "string",
    "growth_driver": "string",
    "geography": "string",
    "currency": "string",
    "starting_customers": 10,
    "monthly_growth_rate_conservative": 0.08,
    "monthly_growth_rate_base": 0.15,
    "monthly_growth_rate_optimistic": 0.25,
    "churn_rate_monthly": 0.03,
    "arpu": 1000,
    "gross_margin": 0.75
  },
  "monthly_projections": [
    { "month": 1, "customers": 10, "mrr": 10000, "churn": 0, "net_new": 2, "cumulative_revenue": 10000 },
    { "month": 2, "customers": 12, "mrr": 12000, "churn": 0, "net_new": 2, "cumulative_revenue": 22000 },
    { "month": 3, "customers": 14, "mrr": 14000, "churn": 1, "net_new": 3, "cumulative_revenue": 36000 },
    { "month": 4, "customers": 16, "mrr": 16000, "churn": 1, "net_new": 3, "cumulative_revenue": 52000 },
    { "month": 5, "customers": 19, "mrr": 19000, "churn": 1, "net_new": 4, "cumulative_revenue": 71000 },
    { "month": 6, "customers": 22, "mrr": 22000, "churn": 1, "net_new": 4, "cumulative_revenue": 93000 },
    { "month": 7, "customers": 26, "mrr": 26000, "churn": 1, "net_new": 5, "cumulative_revenue": 119000 },
    { "month": 8, "customers": 30, "mrr": 30000, "churn": 1, "net_new": 5, "cumulative_revenue": 149000 },
    { "month": 9, "customers": 35, "mrr": 35000, "churn": 2, "net_new": 6, "cumulative_revenue": 184000 },
    { "month": 10, "customers": 40, "mrr": 40000, "churn": 2, "net_new": 7, "cumulative_revenue": 224000 },
    { "month": 11, "customers": 47, "mrr": 47000, "churn": 2, "net_new": 8, "cumulative_revenue": 271000 },
    { "month": 12, "customers": 55, "mrr": 55000, "churn": 2, "net_new": 9, "cumulative_revenue": 326000 }
  ],
  "annual_summary": {
    "conservative": { "year1_arr": 0, "year2_arr": 0, "year3_arr": 0, "customers_y3": 0 },
    "base_case":    { "year1_arr": 0, "year2_arr": 0, "year3_arr": 0, "customers_y3": 0 },
    "optimistic":   { "year1_arr": 0, "year2_arr": 0, "year3_arr": 0, "customers_y3": 0 }
  },
  "unit_economics": {
    "cac": 0, "ltv": 0, "ltv_cac_ratio": 0,
    "payback_period_months": 0,
    "breakeven_mrr": 0, "breakeven_month": 0
  },
  "funding_requirements": {
    "total_needed": 0,
    "allocation": {
      "product_pct": 40, "product_amount": 0,
      "marketing_pct": 30, "marketing_amount": 0,
      "team_pct": 20, "team_amount": 0,
      "operations_pct": 10, "operations_amount": 0
    }
  },
  "sensitivity_analysis": {
    "if_churn_up_2pct": "string",
    "if_arpu_down_20pct": "string",
    "if_growth_halved": "string",
    "key_lever": "string"
  },
  "honest_assessment": "string"
}

Replace ALL placeholder numbers with real calculated figures based on the query.`;
  }

  if (mode === "market") {
    return `You are Stremini Strategy — a market research expert. Today is ${today}.
${ctxBlock}
${antiLoop}

Build a rigorous market sizing analysis. Output ONLY this JSON:

{
  "market_definition": {
    "industry": "string",
    "geography": "string",
    "time_horizon": "string"
  },
  "top_down": {
    "tam": { "global": "string", "india": "string", "uae": "string", "source_basis": "string" },
    "sam": { "value": "string", "why_this_subset": "string" },
    "som": { "year3": "string", "year5": "string", "market_share_assumption": "string" }
  },
  "bottom_up": {
    "target_universe": 0,
    "reachable_via_channels": 0,
    "reachable_pct": 0.0,
    "convert_year1": 0,
    "convert_year3": 0,
    "revenue_year1": "string",
    "revenue_year3": "string",
    "revenue_year5": "string"
  },
  "market_dynamics": {
    "cagr_pct": 0.0,
    "growth_driver": "string",
    "key_trends": ["string", "string", "string"],
    "tailwinds": ["string", "string"],
    "headwinds": ["string", "string"]
  },
  "competitive_landscape": {
    "direct_competitors": [
      { "name": "string", "description": "string", "est_revenue": "string", "weakness": "string" },
      { "name": "string", "description": "string", "est_revenue": "string", "weakness": "string" }
    ],
    "indirect_competitors": [
      { "name": "string", "what_customers_use": "string" }
    ],
    "your_position": {
      "where_you_win": "string",
      "where_youre_weaker": "string",
      "defensibility": "Medium",
      "defensibility_reason": "string"
    }
  },
  "india_context": {
    "govt_initiatives": "string",
    "regulatory_considerations": "string",
    "payment_infrastructure_maturity": "string",
    "regional_opportunity": "string"
  },
  "sizing_verdict": {
    "vc_backable": "Yes",
    "explanation": "string",
    "ideal_beachhead": "string",
    "time_to_market_position_years": 3
  }
}

Use real estimates with specific numbers. Commit to figures.`;
  }

  if (mode === "swot") {
    return `You are Stremini Strategy — a strategic analyst. Today is ${today}.
${ctxBlock}
${antiLoop}

Build a deep SWOT + TOWS analysis. Output ONLY this JSON:

{
  "business_context": "string",
  "strengths": [
    { "id": "S1", "name": "string", "description": "string" },
    { "id": "S2", "name": "string", "description": "string" },
    { "id": "S3", "name": "string", "description": "string" },
    { "id": "S4", "name": "string", "description": "string" },
    { "id": "S5", "name": "string", "description": "string" }
  ],
  "weaknesses": [
    { "id": "W1", "name": "string", "description": "string" },
    { "id": "W2", "name": "string", "description": "string" },
    { "id": "W3", "name": "string", "description": "string" },
    { "id": "W4", "name": "string", "description": "string" }
  ],
  "opportunities": [
    { "id": "O1", "name": "string", "description": "string" },
    { "id": "O2", "name": "string", "description": "string" },
    { "id": "O3", "name": "string", "description": "string" },
    { "id": "O4", "name": "string", "description": "string" }
  ],
  "threats": [
    { "id": "T1", "name": "string", "description": "string" },
    { "id": "T2", "name": "string", "description": "string" },
    { "id": "T3", "name": "string", "description": "string" },
    { "id": "T4", "name": "string", "description": "string" }
  ],
  "tows_matrix": {
    "so_strategies": [
      { "action": "string", "references": ["S1", "O1"] },
      { "action": "string", "references": ["S2", "O2"] },
      { "action": "string", "references": ["S3", "O3"] }
    ],
    "wo_strategies": [
      { "action": "string", "references": ["W1", "O1"] },
      { "action": "string", "references": ["W2", "O2"] }
    ],
    "st_strategies": [
      { "action": "string", "references": ["S1", "T1"] },
      { "action": "string", "references": ["S2", "T2"] }
    ],
    "wt_strategies": [
      { "action": "string", "references": ["W1", "T1"] },
      { "action": "string", "references": ["W2", "T2"] }
    ]
  },
  "priority_matrix": [
    { "priority": 1, "action": "string", "timeline": "0-30d", "impact": "Critical" },
    { "priority": 2, "action": "string", "timeline": "30-90d", "impact": "High" },
    { "priority": 3, "action": "string", "timeline": "90-180d", "impact": "Medium-High" },
    { "priority": 4, "action": "string", "timeline": "6m+", "impact": "Medium" }
  ],
  "verdict": {
    "overall_position": "Moderate",
    "position_reason": "string",
    "one_thing_that_changes_everything": "string",
    "biggest_existential_risk": "string",
    "12_month_strategic_focus": "string"
  }
}

Every point must be specific to the described business. No generic items.`;
  }

  return "";
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function buildContextBlock(ctx) {
  if (!ctx || !Object.keys(ctx).length) return "";
  const lines = ["── BUSINESS CONTEXT ──"];
  if (ctx.industry)     lines.push(`Industry: ${ctx.industry}`);
  if (ctx.stage)        lines.push(`Stage: ${ctx.stage}`);
  if (ctx.location)     lines.push(`Location/Market: ${ctx.location}`);
  if (ctx.targetMarket) lines.push(`Target Market / Raise: ${ctx.targetMarket}`);
  if (ctx.revenue)      lines.push(`Current Revenue: ${ctx.revenue}`);
  if (ctx.teamSize)     lines.push(`Team Size: ${ctx.teamSize}`);
  lines.push("── END CONTEXT ──\n");
  return lines.join("\n");
}

/**
 * Strip <think>...</think> reasoning blocks.
 * Also handles the case where the model runs out of tokens mid-think
 * and the response is entirely inside an unclosed <think> block —
 * in that case we look for the last valid JSON object in the full text.
 */
function stripReasoning(raw) {
  // Remove complete <think>...</think> blocks
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // Handle unclosed <think> — the think block ate all tokens.
  // Try to salvage any JSON from inside the think block itself.
  const openThink = out.indexOf("<think>");
  if (openThink !== -1) {
    const beforeThink = out.slice(0, openThink).trim();
    if (beforeThink.includes("{")) {
      out = beforeThink;
    } else {
      // Look inside the think block for JSON
      const fullThinkContent = raw.slice(raw.indexOf("<think>") + 7);
      const lastBrace = fullThinkContent.lastIndexOf("}");
      const firstBrace = fullThinkContent.indexOf("{");
      if (firstBrace !== -1 && lastBrace !== -1) {
        out = fullThinkContent.slice(firstBrace, lastBrace + 1);
      } else {
        out = "";
      }
    }
  }

  // Handle </think> without opening tag — take everything after
  if (out.includes("</think>")) out = out.split("</think>").pop() ?? "";

  return out.trim();
}

/**
 * Extract and parse JSON from AI response.
 * Handles markdown fences, leading prose, trailing text.
 */
function parseJsonResponse(text) {
  let cleaned = text
    .replace(/^```(?:json)?\s*/im, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  const start = cleaned.indexOf("{");
  const end   = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in AI response.");
  }

  const jsonStr = cleaned.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

async function callAI(apiKey, systemPrompt, history, userQuery) {
  const primaryUrl = "https://api.k2think.ai/v1/chat/completions";
  const headers = {
    "Authorization": `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  const buildBody = (model) => JSON.stringify({
    model,
    temperature: 0.1,   // Lower temperature = more deterministic, less looping
    max_tokens: 8192,
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userQuery },
    ],
  });

  let res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI/K2-Think-v2") });
  if (!res.ok) {
    res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI-IFM/K2-Think-v2") });
  }
  return res;
}