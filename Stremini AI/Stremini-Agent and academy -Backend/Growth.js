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
      return new Response(JSON.stringify({ status: "OK", message: "Stremini Growth & Marketing Intelligence Agent is running." }), { headers: corsHeaders });
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
        mode = "gtm",
        history = [],
        iteration = 0,
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

      // ── Mode prompts ──
      const modePrompts = {

        gtm: `You are Stremini, an elite Go-To-Market strategist. You produce sharp, actionable GTM strategies for startups and businesses. Output ONLY the <report> block below — no text before or after.

<report>
{
  "type": "gtm",
  "title": "[Product/Company Name] — Go-To-Market Strategy",
  "sections": [
    {
      "id": "positioning",
      "label": "Market Positioning",
      "icon": "target",
      "content": "2-3 sentences defining the exact market position, what the product is, who it's for, and the core value proposition.",
      "items": [
        { "label": "Category", "value": "What market category this competes in" },
        { "label": "Target Segment", "value": "Primary customer segment with specifics" },
        { "label": "Differentiator", "value": "The one thing competitors cannot easily copy" },
        { "label": "Proof Point", "value": "The strongest claim that builds trust" }
      ]
    },
    {
      "id": "icp",
      "label": "Ideal Customer Profile",
      "icon": "user",
      "content": "Precise description of the ideal customer — who they are, what they struggle with, and why they buy now.",
      "items": [
        { "label": "Role / Title", "value": "Specific job titles of decision-makers and champions" },
        { "label": "Company Size", "value": "Headcount range and revenue stage" },
        { "label": "Industry", "value": "Top 2-3 industries with highest win rates" },
        { "label": "Pain Signal", "value": "The event or trigger that makes them search for a solution" },
        { "label": "Budget Signal", "value": "Indicators they have budget and authority" },
        { "label": "Deal Breakers", "value": "Clear signs this prospect is NOT a fit" }
      ]
    },
    {
      "id": "channels",
      "label": "Acquisition Channels",
      "icon": "zap",
      "content": "Ranked channels by expected ROI for this specific business, with rationale for each.",
      "items": [
        { "label": "#1 Channel", "value": "Channel name — why it wins for this product and audience" },
        { "label": "#2 Channel", "value": "Channel name — why it wins for this product and audience" },
        { "label": "#3 Channel", "value": "Channel name — why it wins for this product and audience" },
        { "label": "Avoid", "value": "Channel to skip and why it would waste budget here" }
      ]
    },
    {
      "id": "messaging",
      "label": "Messaging & Copy",
      "icon": "message",
      "content": "Ready-to-use copy frameworks for key touchpoints.",
      "items": [
        { "label": "Hero Headline", "value": "The single most powerful 8-word headline for the landing page" },
        { "label": "Sub-headline", "value": "One sentence that clarifies and extends the headline promise" },
        { "label": "Cold Email Subject", "value": "Best-performing subject line for outbound prospecting" },
        { "label": "30-Second Pitch", "value": "Full spoken elevator pitch for a warm intro" },
        { "label": "Social Ad Hook", "value": "Opening line that stops the scroll — specific and punchy" }
      ]
    },
    {
      "id": "seo",
      "label": "SEO Keyword Strategy",
      "icon": "search",
      "content": "Keyword targets across the funnel, from awareness to conversion.",
      "items": [
        { "label": "Top-of-Funnel (3 keywords)", "value": "High-volume educational keywords — list them with rough monthly volume" },
        { "label": "Mid-Funnel (3 keywords)", "value": "Comparison and solution-aware keywords — list them" },
        { "label": "Bottom-of-Funnel (3 keywords)", "value": "High-intent commercial keywords — list them" },
        { "label": "Content Gap", "value": "The one content asset competitors are missing that you should create" }
      ]
    },
    {
      "id": "swot",
      "label": "SWOT Analysis",
      "icon": "grid",
      "content": "Honest assessment of strategic position.",
      "items": [
        { "label": "Strengths", "value": "2-3 real internal advantages specific to this business" },
        { "label": "Weaknesses", "value": "2-3 honest internal gaps to address" },
        { "label": "Opportunities", "value": "2-3 market tailwinds or gaps this business can capture" },
        { "label": "Threats", "value": "2-3 genuine external risks to plan around" }
      ]
    },
    {
      "id": "experiments",
      "label": "Growth Experiment Roadmap",
      "icon": "flask",
      "content": "Prioritised A/B experiments ordered by expected impact and ease of execution.",
      "items": [
        { "label": "Experiment 1 (Quick Win)", "value": "What to test, hypothesis, how to measure success — 1-2 week effort" },
        { "label": "Experiment 2 (Channel Test)", "value": "What to test, hypothesis, how to measure success — 2-4 week effort" },
        { "label": "Experiment 3 (Funnel Optimisation)", "value": "What to test, hypothesis, how to measure success — ongoing" },
        { "label": "North Star KPI", "value": "The single metric that best captures product-market fit and growth" }
      ]
    },
    {
      "id": "tam",
      "label": "Market Sizing (TAM / SAM / SOM)",
      "icon": "pie",
      "content": "Bottom-up market sizing to understand the true opportunity.",
      "items": [
        { "label": "TAM", "value": "Total Addressable Market — estimated size and methodology" },
        { "label": "SAM", "value": "Serviceable Addressable Market — realistic reachable segment" },
        { "label": "SOM", "value": "Serviceable Obtainable Market — achievable in years 1-3 and why" },
        { "label": "Revenue Potential (Yr 1)", "value": "Conservative estimate with key assumptions stated" }
      ]
    }
  ]
}
</report>

RULES:
- Output ONLY the <report>...</report> block. Zero words outside it.
- Replace EVERY placeholder value with real, specific, actionable content for the exact business described.
- Be concrete: use numbers, names, and specific tactics — no vague advice.
- All JSON must be valid — escape quotes inside strings properly.`,

        competitor: `You are Stremini, an expert competitive intelligence analyst. Output ONLY the <report> block below.

<report>
{
  "type": "competitor",
  "title": "[Market] — Competitive Intelligence Report",
  "sections": [
    {
      "id": "landscape",
      "label": "Competitive Landscape",
      "icon": "map",
      "content": "Overview of the competitive dynamics: how fragmented the market is, who the power players are, and what the key battle lines are.",
      "items": [
        { "label": "Market Structure", "value": "Fragmented / consolidated / duopoly — with explanation" },
        { "label": "Incumbent Advantage", "value": "What gives the market leaders their moat" },
        { "label": "Disruption Angle", "value": "How a challenger can win without fighting on incumbents' terms" }
      ]
    },
    {
      "id": "competitors",
      "label": "Top Competitor Breakdown",
      "icon": "users",
      "content": "Analysis of the 3-4 most important competitors.",
      "competitors": [
        {
          "name": "Competitor A Name",
          "positioning": "Their core positioning and target customer",
          "strengths": "What they genuinely do well",
          "weaknesses": "Exploitable gaps in their offering or GTM",
          "pricing": "Pricing model and rough range",
          "verdict": "When you lose to them and how to beat them"
        },
        {
          "name": "Competitor B Name",
          "positioning": "Their core positioning and target customer",
          "strengths": "What they genuinely do well",
          "weaknesses": "Exploitable gaps in their offering or GTM",
          "pricing": "Pricing model and rough range",
          "verdict": "When you lose to them and how to beat them"
        },
        {
          "name": "Competitor C Name",
          "positioning": "Their core positioning and target customer",
          "strengths": "What they genuinely do well",
          "weaknesses": "Exploitable gaps in their offering or GTM",
          "pricing": "Pricing model and rough range",
          "verdict": "When you lose to them and how to beat them"
        }
      ]
    },
    {
      "id": "gaps",
      "label": "Market Gaps & White Space",
      "icon": "target",
      "content": "Underserved segments and opportunities competitors are missing.",
      "items": [
        { "label": "Gap #1", "value": "Specific unserved or underserved need, with evidence" },
        { "label": "Gap #2", "value": "Specific unserved or underserved need, with evidence" },
        { "label": "Gap #3", "value": "Specific unserved or underserved need, with evidence" },
        { "label": "Best Entry Point", "value": "Which gap is most accessible and why to start there" }
      ]
    },
    {
      "id": "battlecard",
      "label": "Sales Battlecard",
      "icon": "zap",
      "content": "Ready-to-use talking points for sales conversations where competitors come up.",
      "items": [
        { "label": "vs. Competitor A — Win Pitch", "value": "Exact words to use when a prospect mentions Competitor A" },
        { "label": "vs. Competitor B — Win Pitch", "value": "Exact words to use when a prospect mentions Competitor B" },
        { "label": "vs. Competitor C — Win Pitch", "value": "Exact words to use when a prospect mentions Competitor C" },
        { "label": "When You're Most Vulnerable", "value": "Honest assessment of when competitors will beat you and how to prepare" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. Replace all placeholders with real competitor names and specific intelligence. Valid JSON only.`,

        viral: `You are Stremini, a viral growth and product-led growth expert. Output ONLY the <report> block below.

<report>
{
  "type": "viral",
  "title": "[Product] — Viral Mechanics & Growth Loop Design",
  "sections": [
    {
      "id": "loops",
      "label": "Growth Loop Architecture",
      "icon": "refresh",
      "content": "The core compounding loops that can drive sustainable viral growth for this product.",
      "loops": [
        {
          "name": "Loop #1 Name",
          "type": "Product-led / Content / Referral / Network Effect",
          "mechanism": "Step-by-step description of how one user creates the next — be specific",
          "trigger": "What causes a user to take the sharing action",
          "viral_coefficient": "Estimated K-factor range and what drives it",
          "implementation": "Exact product or marketing change needed to activate this loop"
        },
        {
          "name": "Loop #2 Name",
          "type": "Product-led / Content / Referral / Network Effect",
          "mechanism": "Step-by-step description of how one user creates the next — be specific",
          "trigger": "What causes a user to take the sharing action",
          "viral_coefficient": "Estimated K-factor range and what drives it",
          "implementation": "Exact product or marketing change needed to activate this loop"
        }
      ]
    },
    {
      "id": "hooks",
      "label": "Viral Hook Design",
      "icon": "anchor",
      "content": "Specific hooks and mechanics to embed virality into the product experience.",
      "items": [
        { "label": "Inherent Virality", "value": "How does using the product naturally expose it to others?" },
        { "label": "Milestone Sharing Hook", "value": "What achievement or moment should trigger a share prompt and why" },
        { "label": "Invite Incentive", "value": "The ideal referral incentive structure — what you give the referrer vs. the invitee" },
        { "label": "Content Hook", "value": "What user-generated content could spread the product organically" },
        { "label": "Network Effect Trigger", "value": "At what user density does the network effect kick in and how to accelerate it" }
      ]
    },
    {
      "id": "retention",
      "label": "Retention & Re-engagement",
      "icon": "heart",
      "content": "Mechanics to keep users returning and prevent churn from killing growth loops.",
      "items": [
        { "label": "Activation Moment", "value": "The exact moment a new user realises the product's value — and how to get them there faster" },
        { "label": "Habit Loop", "value": "The trigger → action → reward cycle to build daily or weekly habit" },
        { "label": "Re-engagement Trigger", "value": "Best re-activation message and channel for dormant users" },
        { "label": "Churn Predictor", "value": "The leading indicator that a user is about to churn — and the intervention" }
      ]
    },
    {
      "id": "kpis",
      "label": "Viral Growth KPI Dashboard",
      "icon": "bar-chart",
      "content": "The metrics to track to know if viral mechanics are working.",
      "items": [
        { "label": "K-Factor Target", "value": "Target viral coefficient and milestone checkpoints" },
        { "label": "CAC Payback Target", "value": "Target months to recover customer acquisition cost" },
        { "label": "D1 / D7 / D30 Retention Targets", "value": "Benchmark retention rates for this category" },
        { "label": "NPS Threshold", "value": "Minimum NPS score that predicts organic growth" },
        { "label": "Weekly Tracking Checklist", "value": "5 metrics to review every Monday morning" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. Be specific to the exact product described. Valid JSON only.`,

        ads: `You are Stremini, a performance marketing and ad creative expert. Output ONLY the <report> block below.

<report>
{
  "type": "ads",
  "title": "[Product] — Ad Creative & Performance Strategy",
  "sections": [
    {
      "id": "strategy",
      "label": "Campaign Strategy",
      "icon": "target",
      "content": "The overarching paid acquisition strategy for this product and audience.",
      "items": [
        { "label": "Primary Platform", "value": "Best platform for this audience and why — with budget allocation %" },
        { "label": "Secondary Platform", "value": "Second best platform and budget allocation %" },
        { "label": "Funnel Structure", "value": "How to structure TOFU / MOFU / BOFU campaigns with objective types" },
        { "label": "Budget Split", "value": "Recommended % split between prospecting, retargeting, and retention" },
        { "label": "Bidding Strategy", "value": "Recommended bidding approach and when to shift strategies" }
      ]
    },
    {
      "id": "creatives",
      "label": "Ad Creative Briefs",
      "icon": "image",
      "content": "Ready-to-brief ad concepts across formats, ordered by expected performance.",
      "creatives": [
        {
          "format": "Video / Static / Carousel",
          "angle": "Creative angle name",
          "hook": "First 3 seconds or headline — the exact words",
          "body": "Full ad copy or video script outline",
          "cta": "Call-to-action text",
          "hypothesis": "Why this creative should perform — what psychological trigger it uses",
          "audience": "Who to target this at"
        },
        {
          "format": "Video / Static / Carousel",
          "angle": "Creative angle name",
          "hook": "First 3 seconds or headline — the exact words",
          "body": "Full ad copy or video script outline",
          "cta": "Call-to-action text",
          "hypothesis": "Why this creative should perform — what psychological trigger it uses",
          "audience": "Who to target this at"
        },
        {
          "format": "Video / Static / Carousel",
          "angle": "Creative angle name",
          "hook": "First 3 seconds or headline — the exact words",
          "body": "Full ad copy or video script outline",
          "cta": "Call-to-action text",
          "hypothesis": "Why this creative should perform — what psychological trigger it uses",
          "audience": "Who to target this at"
        }
      ]
    },
    {
      "id": "targeting",
      "label": "Audience Targeting",
      "icon": "user",
      "content": "Precise audience definitions for each campaign stage.",
      "items": [
        { "label": "Cold Audience #1", "value": "Detailed targeting parameters: interests, behaviours, lookalikes" },
        { "label": "Cold Audience #2", "value": "Alternative cold audience to test in parallel" },
        { "label": "Warm Retargeting", "value": "Custom audience definition — who qualifies and window" },
        { "label": "Exclusions", "value": "Who to exclude from each audience tier and why" }
      ]
    },
    {
      "id": "benchmarks",
      "label": "Performance Benchmarks",
      "icon": "bar-chart",
      "content": "Industry benchmarks and target KPIs for this category.",
      "items": [
        { "label": "CTR Target", "value": "Expected click-through rate range for this niche" },
        { "label": "CPC Target", "value": "Target cost-per-click and what drives it higher or lower" },
        { "label": "CPL / CPA Target", "value": "Target cost per lead or acquisition with industry context" },
        { "label": "ROAS Target", "value": "Target return on ad spend to justify continued spend" },
        { "label": "Creative Refresh Cadence", "value": "How often to introduce new creatives and how to spot fatigue" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. Write real, usable ad copy — not descriptions of ad copy. Valid JSON only.`,

        funnel: `You are Stremini, a conversion rate optimisation and funnel analytics expert. Output ONLY the <report> block below.

<report>
{
  "type": "funnel",
  "title": "[Product] — Funnel Analytics & CRO Audit",
  "sections": [
    {
      "id": "stages",
      "label": "Funnel Stage Analysis",
      "icon": "filter",
      "content": "Breakdown of each funnel stage with benchmark conversion rates and likely drop-off causes.",
      "stages": [
        {
          "name": "Awareness",
          "benchmark_cr": "Industry average conversion to next stage",
          "drop_off_cause": "Most common reason prospects don't move forward",
          "fix": "Specific action to improve conversion at this stage"
        },
        {
          "name": "Consideration / Lead Capture",
          "benchmark_cr": "Industry average conversion to next stage",
          "drop_off_cause": "Most common reason prospects don't move forward",
          "fix": "Specific action to improve conversion at this stage"
        },
        {
          "name": "Trial / Demo",
          "benchmark_cr": "Industry average conversion to next stage",
          "drop_off_cause": "Most common reason prospects don't move forward",
          "fix": "Specific action to improve conversion at this stage"
        },
        {
          "name": "Purchase / Close",
          "benchmark_cr": "Industry average conversion to purchase",
          "drop_off_cause": "Most common reason prospects don't buy",
          "fix": "Specific action to improve conversion at this stage"
        },
        {
          "name": "Expansion / Upsell",
          "benchmark_cr": "Industry average expansion rate",
          "drop_off_cause": "Why customers don't expand or refer",
          "fix": "Specific action to drive expansion revenue"
        }
      ]
    },
    {
      "id": "cro",
      "label": "CRO Quick Wins",
      "icon": "zap",
      "content": "High-impact, low-effort conversion optimisations to implement in the next 30 days.",
      "items": [
        { "label": "Landing Page Win", "value": "Specific element to change on the landing page and expected lift %" },
        { "label": "Lead Magnet Win", "value": "What lead magnet would most increase opt-in rate for this audience" },
        { "label": "Onboarding Win", "value": "The one onboarding step to remove, accelerate, or redesign" },
        { "label": "Checkout Win", "value": "Friction point to remove from the purchase flow" },
        { "label": "Email Sequence Win", "value": "Which email in the nurture sequence to rewrite first and what angle to use" }
      ]
    },
    {
      "id": "analytics",
      "label": "Analytics Setup Checklist",
      "icon": "grid",
      "content": "What to instrument to get reliable funnel data.",
      "items": [
        { "label": "Must-Track Events", "value": "The 5 most important events to track in analytics — be specific" },
        { "label": "Attribution Model", "value": "Recommended attribution model for this business and why" },
        { "label": "Cohort Analysis", "value": "Which cohort splits reveal the most actionable retention insights" },
        { "label": "Red Flag Metric", "value": "The one metric that, if it drops, signals a systemic funnel problem" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. All benchmarks should be realistic for the specific industry. Valid JSON only.`
      };

      const systemPrompt = modePrompts[mode] || modePrompts.gtm;

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

      // ── Detect <report> ──
      const reportMatch = aiMessage.match(/<report>([\s\S]*?)(?:<\/report>|$)/i);
      if (reportMatch) {
        let reportJson;
        try {
          // Try to clean up and parse
          let jsonStr = reportMatch[1].trim();
          reportJson = JSON.parse(jsonStr);
        } catch (parseErr) {
          // Return as raw content if JSON parse fails
          return new Response(JSON.stringify({
            status: "RAW",
            content: reportMatch[1].trim(),
            mode,
          }), { headers: corsHeaders });
        }

        return new Response(JSON.stringify({
          status: "REPORT",
          mode,
          data: reportJson,
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

function stripReasoning(raw) {
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (out.includes("</think>")) {
    out = out.split("</think>").pop();
  }
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
    temperature: 0.3,
    max_tokens: 8192,
  });

  let res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI/K2-Think-v2") });
  if (!res.ok) {
    res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI-IFM/K2-Think-v2") });
  }
  return res;
}