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

      const trimmedHistory = history.slice(-10);

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
        { "title": "Insight title", "detail": "2-3 sentence explanation of what this metric shows, why it matters, and what it implies about the business.", "signal": "negative" },
        { "title": "Insight title", "detail": "2-3 sentence explanation of what this metric shows, why it matters, and what it implies about the business.", "signal": "neutral" }
      ]
    },
    {
      "id": "risk_flags",
      "label": "Risk Flags",
      "icon": "alert",
      "content": "Metrics or trends that signal potential problems if not addressed.",
      "flags": [
        { "severity": "high", "metric": "Metric name", "observation": "What the data shows", "consequence": "What happens if this is not addressed in 30 days" },
        { "severity": "medium", "metric": "Metric name", "observation": "What the data shows", "consequence": "What happens if this is not addressed in 90 days" },
        { "severity": "low", "metric": "Metric name", "observation": "What the data shows", "consequence": "What happens if this is ignored" }
      ]
    },
    {
      "id": "benchmarks",
      "label": "Benchmark Comparison",
      "icon": "bar-chart",
      "content": "How these metrics compare to industry standards and best-in-class benchmarks.",
      "benchmarks": [
        { "metric": "Metric name", "your_value": "User's value or 'Not provided'", "industry_avg": "Industry average", "best_in_class": "Top quartile value", "verdict": "above / below / at" },
        { "metric": "Metric name", "your_value": "User's value or 'Not provided'", "industry_avg": "Industry average", "best_in_class": "Top quartile value", "verdict": "above / below / at" },
        { "metric": "Metric name", "your_value": "User's value or 'Not provided'", "industry_avg": "Industry average", "best_in_class": "Top quartile value", "verdict": "above / below / at" }
      ]
    },
    {
      "id": "hypotheses",
      "label": "Hypothesis List",
      "icon": "flask",
      "content": "Ranked explanations for why the data looks the way it does — from most to least likely.",
      "items": [
        { "label": "Hypothesis #1 (Most Likely)", "value": "Specific, testable explanation of what is causing this pattern and the evidence that supports it" },
        { "label": "Hypothesis #2", "value": "Alternative explanation with supporting reasoning" },
        { "label": "Hypothesis #3", "value": "Alternative explanation with supporting reasoning" },
        { "label": "How to Validate", "value": "The fastest, cheapest way to confirm which hypothesis is correct" }
      ]
    },
    {
      "id": "experiments",
      "label": "Recommended Experiments",
      "icon": "zap",
      "content": "Prioritised actions to test, ordered by expected impact vs. effort.",
      "experiments": [
        { "name": "Experiment name", "hypothesis": "What we believe will happen", "method": "Exactly how to run this experiment", "metric": "The one metric that proves it worked", "timeline": "1-2 weeks", "effort": "low" },
        { "name": "Experiment name", "hypothesis": "What we believe will happen", "method": "Exactly how to run this experiment", "metric": "The one metric that proves it worked", "timeline": "2-4 weeks", "effort": "medium" },
        { "name": "Experiment name", "hypothesis": "What we believe will happen", "method": "Exactly how to run this experiment", "metric": "The one metric that proves it worked", "timeline": "4-8 weeks", "effort": "high" }
      ]
    },
    {
      "id": "priorities",
      "label": "Metric Prioritisation",
      "icon": "target",
      "content": "Which metrics to focus on, ignore, and watch — and why.",
      "items": [
        { "label": "North Star Metric", "value": "The single metric that best predicts long-term success for this business right now and why" },
        { "label": "Fix Now (Leading Indicators)", "value": "2-3 leading indicators that need immediate action" },
        { "label": "Watch (Lagging Indicators)", "value": "2-3 metrics to monitor weekly but not panic about yet" },
        { "label": "Ignore For Now", "value": "Metrics that distract from the real issues at this stage" },
        { "label": "Add to Dashboard", "value": "1-2 metrics that are likely missing from current tracking" }
      ]
    }
  ]
}
</report>

RULES:
- Output ONLY the <report>...</report> block. Zero words outside.
- health_score must be an integer 0-100. health_label must match: 0-40 = "Critical", 41-60 = "At Risk", 61-75 = "Needs Attention", 76-89 = "Healthy", 90-100 = "Excellent".
- All signal values must be exactly: "positive", "negative", or "neutral".
- All severity values must be exactly: "high", "medium", or "low".
- All effort values must be exactly: "low", "medium", or "high".
- All verdict values must be exactly: "above", "below", or "at".
- Replace EVERY placeholder with real, specific analysis of the exact data or metrics described.
- If the user pastes actual data, analyse it directly. If they describe metrics without raw data, use the numbers they give.
- Valid JSON only — escape all quotes inside strings.`,

        // ── 2. Cohort & Retention Analysis ──
        cohort: `You are Stremini, an expert in cohort analysis and retention modelling. Output ONLY the <report> block below.

<report>
{
  "type": "cohort",
  "title": "[Product] — Cohort & Retention Analysis",
  "summary": "2-3 sentence plain-English summary: what the retention pattern reveals, the single most important cohort insight, and the biggest lever to pull.",
  "health_score": 68,
  "health_label": "Needs Attention",
  "sections": [
    {
      "id": "retention_shape",
      "label": "Retention Curve Diagnosis",
      "icon": "trending",
      "content": "What the shape of the retention curve reveals about product-market fit and user behaviour.",
      "insights": [
        { "title": "Curve Shape Diagnosis", "detail": "Describe what the retention curve looks like and what that shape means about PMF — e.g. does it flatten? At what point? What does that imply?", "signal": "neutral" },
        { "title": "D1 / D7 / D30 Reading", "detail": "Interpret the day-1, day-7, and day-30 retention numbers specifically — what they tell us about the onboarding experience and habit formation.", "signal": "negative" },
        { "title": "Long-Tail Retention", "detail": "What the 60-90 day retention tells us about whether the product has found a loyal core audience.", "signal": "positive" }
      ]
    },
    {
      "id": "cohort_comparison",
      "label": "Cohort Comparison",
      "icon": "grid",
      "content": "How different cohorts perform and what that reveals about product changes, seasonality, or channel quality.",
      "items": [
        { "label": "Best Performing Cohort", "value": "Which cohort or time period shows strongest retention and the likely reason" },
        { "label": "Worst Performing Cohort", "value": "Which cohort shows weakest retention and the likely cause" },
        { "label": "Trend Direction", "value": "Is retention improving, declining, or flat across successive cohorts — and what that implies" },
        { "label": "Cohort Anomaly", "value": "Any cohort that behaves unusually and the most likely explanation" }
      ]
    },
    {
      "id": "drop_off_diagnosis",
      "label": "Drop-off Point Diagnosis",
      "icon": "alert",
      "content": "Where users leave and the most likely reasons for each critical drop-off.",
      "flags": [
        { "severity": "high", "metric": "Drop-off point #1", "observation": "When and how many users leave", "consequence": "What this costs in LTV and why it is the highest priority to fix" },
        { "severity": "medium", "metric": "Drop-off point #2", "observation": "When and how many users leave", "consequence": "Business impact and urgency" },
        { "severity": "low", "metric": "Drop-off point #3", "observation": "When and how many users leave", "consequence": "Business impact if not addressed" }
      ]
    },
    {
      "id": "ltv_model",
      "label": "LTV & Revenue Implications",
      "icon": "dollar",
      "content": "What the retention data implies for customer lifetime value and revenue projections.",
      "items": [
        { "label": "Implied LTV (Current)", "value": "Estimated LTV based on current retention rates — show the rough calculation" },
        { "label": "Implied LTV (If D30 +10%)", "value": "What LTV would be if 30-day retention improved by 10 percentage points" },
        { "label": "Payback Period Impact", "value": "How current retention affects CAC payback period" },
        { "label": "Expansion Revenue Signal", "value": "Whether the retention data suggests upsell/expansion potential" }
      ]
    },
    {
      "id": "experiments",
      "label": "Retention Experiments",
      "icon": "zap",
      "content": "Specific experiments to improve retention at the most critical drop-off points.",
      "experiments": [
        { "name": "Experiment name", "hypothesis": "Specific belief about what will improve retention", "method": "Exactly what to build or change and how to run the test", "metric": "Retention metric that proves success", "timeline": "1-2 weeks", "effort": "low" },
        { "name": "Experiment name", "hypothesis": "Specific belief about what will improve retention", "method": "Exactly what to build or change and how to run the test", "metric": "Retention metric that proves success", "timeline": "2-4 weeks", "effort": "medium" },
        { "name": "Experiment name", "hypothesis": "Specific belief about what will improve retention", "method": "Exactly what to build or change and how to run the test", "metric": "Retention metric that proves success", "timeline": "4-8 weeks", "effort": "high" }
      ]
    },
    {
      "id": "priorities",
      "label": "Retention Metric Prioritisation",
      "icon": "target",
      "content": "Which retention metrics to fix first and which to track over time.",
      "items": [
        { "label": "Highest Leverage Retention Metric", "value": "The single retention metric that will most improve LTV if moved — and by how much" },
        { "label": "Activation Moment to Find", "value": "The specific action correlated with long-term retention that you should identify and optimise for" },
        { "label": "Segment to Analyse Next", "value": "The user segment or slice that would be most revealing to examine separately" },
        { "label": "Data Gap to Fill", "value": "The missing data or instrumentation needed to properly understand retention" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. All signal, severity, effort values must be exactly the allowed strings. health_score is integer 0-100. Valid JSON only.`,

        // ── 3. Conversion Breakdown ──
        conversion: `You are Stremini, a conversion rate optimisation expert and funnel analyst. Output ONLY the <report> block below.

<report>
{
  "type": "conversion",
  "title": "[Funnel/Product] — Conversion Breakdown",
  "summary": "2-3 sentence summary: where the funnel is leaking most, what the data suggests about root cause, and the single highest-ROI fix.",
  "health_score": 58,
  "health_label": "At Risk",
  "sections": [
    {
      "id": "funnel_map",
      "label": "Funnel Performance Map",
      "icon": "filter",
      "content": "Step-by-step conversion rates with diagnosis of each stage.",
      "funnel_steps": [
        { "step": "Step name", "conversion_rate": "X%", "benchmark": "Y%", "status": "good", "diagnosis": "One sentence on why this stage is performing well or poorly" },
        { "step": "Step name", "conversion_rate": "X%", "benchmark": "Y%", "status": "warn", "diagnosis": "One sentence on why this stage is performing well or poorly" },
        { "step": "Step name", "conversion_rate": "X%", "benchmark": "Y%", "status": "bad", "diagnosis": "One sentence on why this stage is performing well or poorly" }
      ]
    },
    {
      "id": "biggest_leak",
      "label": "Biggest Leak Analysis",
      "icon": "alert",
      "content": "Deep analysis of the single most costly conversion drop-off.",
      "items": [
        { "label": "The Leak", "value": "Exactly which step loses the most users in absolute and relative terms" },
        { "label": "Revenue Cost", "value": "Estimated monthly or annual revenue lost due to this drop-off — show rough maths" },
        { "label": "Root Cause (Most Likely)", "value": "The most probable reason users abandon at this step" },
        { "label": "Evidence", "value": "What data signals or patterns support this diagnosis" },
        { "label": "Fix Complexity", "value": "Effort and timeline to address the root cause" }
      ]
    },
    {
      "id": "segment_breakdown",
      "label": "Segment Conversion Breakdown",
      "icon": "users",
      "content": "How conversion varies by key segments and what that reveals.",
      "items": [
        { "label": "Best Converting Segment", "value": "Which traffic source, device, geography, or cohort converts best — and why that matters" },
        { "label": "Worst Converting Segment", "value": "Which segment converts worst — and whether to fix it or deprioritise it" },
        { "label": "Mobile vs Desktop Gap", "value": "Conversion gap between mobile and desktop and the likely UX cause" },
        { "label": "Channel Quality Signal", "value": "Which acquisition channel brings the highest-intent traffic based on conversion data" }
      ]
    },
    {
      "id": "risk_flags",
      "label": "Risk Flags",
      "icon": "alert",
      "content": "Conversion patterns that signal deeper problems in the business or product.",
      "flags": [
        { "severity": "high", "metric": "Risk flag name", "observation": "What the conversion data shows", "consequence": "Business consequence if not addressed" },
        { "severity": "medium", "metric": "Risk flag name", "observation": "What the conversion data shows", "consequence": "Business consequence if not addressed" },
        { "severity": "low", "metric": "Risk flag name", "observation": "What the conversion data shows", "consequence": "Business consequence if not addressed" }
      ]
    },
    {
      "id": "experiments",
      "label": "Conversion Experiments",
      "icon": "zap",
      "content": "Prioritised CRO tests to run, ordered by expected impact.",
      "experiments": [
        { "name": "Experiment name", "hypothesis": "What we expect to happen to conversion rate", "method": "Exactly what to change and how to measure it", "metric": "Primary conversion metric", "timeline": "1-2 weeks", "effort": "low" },
        { "name": "Experiment name", "hypothesis": "What we expect to happen to conversion rate", "method": "Exactly what to change and how to measure it", "metric": "Primary conversion metric", "timeline": "2-4 weeks", "effort": "medium" },
        { "name": "Experiment name", "hypothesis": "What we expect to happen to conversion rate", "method": "Exactly what to change and how to measure it", "metric": "Primary conversion metric", "timeline": "4-8 weeks", "effort": "high" }
      ]
    },
    {
      "id": "priorities",
      "label": "Metric Prioritisation",
      "icon": "target",
      "content": "Which conversion metrics to prioritise and how to sequence improvements.",
      "items": [
        { "label": "Fix First", "value": "The one conversion rate to improve before anything else — and by how many points" },
        { "label": "Tracking Gap", "value": "What micro-conversion events are missing from analytics that would reveal the real cause of drop-off" },
        { "label": "Quick Win (This Week)", "value": "The single copy, design, or UX change that could improve conversion with zero engineering" },
        { "label": "30-Day Target", "value": "A realistic, specific conversion rate improvement target and the path to hit it" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. funnel_steps status values must be exactly: "good", "warn", or "bad". All severity, effort values must be the exact allowed strings. Valid JSON only.`,

        // ── 4. Anomaly Detection ──
        anomaly: `You are Stremini, a data anomaly detection and root cause analysis expert. Output ONLY the <report> block below.

<report>
{
  "type": "anomaly",
  "title": "[Metric/System] — Anomaly Detection Report",
  "summary": "2-3 sentence summary: what anomalies were found, confidence level that something real happened vs. noise, and the most urgent investigation to run.",
  "health_score": 45,
  "health_label": "At Risk",
  "sections": [
    {
      "id": "anomalies",
      "label": "Detected Anomalies",
      "icon": "alert",
      "content": "Each detected anomaly with severity, pattern type, and initial diagnosis.",
      "anomalies": [
        { "name": "Anomaly name", "metric": "Metric affected", "pattern": "Spike / Drop / Trend shift / Oscillation / Plateau", "magnitude": "How large the deviation is vs. baseline (e.g. -40% vs 30-day avg)", "first_seen": "When this anomaly started", "severity": "high", "likely_cause": "Most probable root cause in one sentence" },
        { "name": "Anomaly name", "metric": "Metric affected", "pattern": "Spike / Drop / Trend shift / Oscillation / Plateau", "magnitude": "How large the deviation is vs. baseline", "first_seen": "When this anomaly started", "severity": "medium", "likely_cause": "Most probable root cause in one sentence" },
        { "name": "Anomaly name", "metric": "Metric affected", "pattern": "Spike / Drop / Trend shift / Oscillation / Plateau", "magnitude": "How large the deviation is vs. baseline", "first_seen": "When this anomaly started", "severity": "low", "likely_cause": "Most probable root cause in one sentence" }
      ]
    },
    {
      "id": "root_cause",
      "label": "Root Cause Tree",
      "icon": "git-branch",
      "content": "Systematic breakdown of possible causes ranked by probability.",
      "causes": [
        { "rank": 1, "cause": "Most likely root cause", "probability": "~65%", "evidence": "What in the data supports this", "rule_out": "How to quickly rule this in or out" },
        { "rank": 2, "cause": "Second most likely cause", "probability": "~20%", "evidence": "What in the data supports this", "rule_out": "How to quickly rule this in or out" },
        { "rank": 3, "cause": "Third most likely cause", "probability": "~10%", "evidence": "What in the data supports this", "rule_out": "How to quickly rule this in or out" },
        { "rank": 4, "cause": "Other / unknown", "probability": "~5%", "evidence": "What data is missing to rule this out", "rule_out": "What additional data would help" }
      ]
    },
    {
      "id": "correlation",
      "label": "Correlation Analysis",
      "icon": "trending",
      "content": "What other metrics moved at the same time — and what that implies.",
      "items": [
        { "label": "Correlated Metric #1", "value": "Metric name, direction it moved, and what that correlation implies about the cause" },
        { "label": "Correlated Metric #2", "value": "Metric name, direction it moved, and what that correlation implies about the cause" },
        { "label": "Counter-correlation", "value": "A metric that did NOT move when expected — and what that rules out" },
        { "label": "Confounding Factor", "value": "External event (holiday, campaign, product release) that may explain the anomaly without being a real problem" }
      ]
    },
    {
      "id": "risk_flags",
      "label": "Risk Flags",
      "icon": "alert",
      "content": "Anomaly patterns that signal structural problems beyond the immediate spike or drop.",
      "flags": [
        { "severity": "high", "metric": "Flag name", "observation": "What the pattern shows", "consequence": "Business risk if this is a structural issue rather than noise" },
        { "severity": "medium", "metric": "Flag name", "observation": "What the pattern shows", "consequence": "Business risk if not monitored" },
        { "severity": "low", "metric": "Flag name", "observation": "What the pattern shows", "consequence": "Lower-priority risk to watch" }
      ]
    },
    {
      "id": "investigation",
      "label": "Investigation Playbook",
      "icon": "search",
      "content": "The exact steps to take in the next 48 hours to confirm what happened.",
      "items": [
        { "label": "Step 1 (Next 1 hour)", "value": "The very first query or check to run — what tool, what query, what you are looking for" },
        { "label": "Step 2 (Next 4 hours)", "value": "Second investigation step if step 1 is inconclusive" },
        { "label": "Step 3 (Next 24 hours)", "value": "Deeper investigation if the anomaly is confirmed to be real" },
        { "label": "Escalation Trigger", "value": "The specific finding that should trigger an all-hands or emergency response" },
        { "label": "Resolution Signal", "value": "How you will know the anomaly has been resolved and what recovery looks like" }
      ]
    },
    {
      "id": "prevention",
      "label": "Prevention & Monitoring",
      "icon": "shield",
      "content": "How to detect this class of anomaly faster next time.",
      "items": [
        { "label": "Alert to Create", "value": "Exact alert rule to set up — metric, threshold, window, and channel to notify" },
        { "label": "Dashboard Addition", "value": "Chart or metric to add to the monitoring dashboard" },
        { "label": "Runbook Gap", "value": "What playbook or documentation should exist for this type of incident" },
        { "label": "MTTD Improvement", "value": "How to reduce mean time to detect this anomaly from days/hours to minutes" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. severity values must be exactly: "high", "medium", or "low". Valid JSON only.`,

        // ── 5. Forecast Modeling ──
        forecast: `You are Stremini, an expert in business forecasting and predictive analytics. Output ONLY the <report> block below.

<report>
{
  "type": "forecast",
  "title": "[Metric] — Forecast & Scenario Model",
  "summary": "2-3 sentence summary: what the current trajectory implies, the key variable that most determines the outcome, and the probability of hitting growth targets.",
  "health_score": 74,
  "health_label": "Needs Attention",
  "sections": [
    {
      "id": "scenarios",
      "label": "Scenario Models",
      "icon": "trending",
      "content": "Three scenarios showing the range of outcomes based on different assumptions.",
      "scenarios": [
        { "name": "Bear Case", "probability": "25%", "key_assumption": "The single most pessimistic but realistic assumption", "month3": "3-month projection", "month6": "6-month projection", "month12": "12-month projection", "trigger": "What specific event or metric failure causes this scenario" },
        { "name": "Base Case", "probability": "55%", "key_assumption": "The most likely assumption given current trajectory", "month3": "3-month projection", "month6": "6-month projection", "month12": "12-month projection", "trigger": "What needs to be true for this scenario to hold" },
        { "name": "Bull Case", "probability": "20%", "key_assumption": "The single most optimistic but realistic assumption", "month3": "3-month projection", "month6": "6-month projection", "month12": "12-month projection", "trigger": "What specific unlock or catalyst drives this scenario" }
      ]
    },
    {
      "id": "drivers",
      "label": "Key Growth Drivers",
      "icon": "zap",
      "content": "The variables that will most determine which scenario plays out.",
      "items": [
        { "label": "Driver #1 (Highest Leverage)", "value": "Specific variable, current value, target value, and how to influence it" },
        { "label": "Driver #2", "value": "Specific variable, current value, target value, and how to influence it" },
        { "label": "Driver #3", "value": "Specific variable, current value, target value, and how to influence it" },
        { "label": "Biggest Risk to Forecast", "value": "The one assumption in the base case most likely to be wrong and what that means" }
      ]
    },
    {
      "id": "model_inputs",
      "label": "Model Assumptions & Inputs",
      "icon": "grid",
      "content": "The key inputs used in this forecast and sensitivity of the output to each.",
      "items": [
        { "label": "Growth Rate Assumption", "value": "MoM or WoW growth rate used and how sensitive the 12-month outcome is to ±5%" },
        { "label": "Churn Rate Assumption", "value": "Monthly churn rate used and how sensitive the model is to ±1%" },
        { "label": "CAC Assumption", "value": "Customer acquisition cost assumed and how it is expected to change with scale" },
        { "label": "LTV Assumption", "value": "Customer LTV used and the key variables that determine it" },
        { "label": "Seasonality Factor", "value": "Any seasonal adjustment applied and the evidence for it" }
      ]
    },
    {
      "id": "risk_flags",
      "label": "Forecast Risk Flags",
      "icon": "alert",
      "content": "Assumptions or external factors that could invalidate the forecast.",
      "flags": [
        { "severity": "high", "metric": "Risk name", "observation": "What the data or trend shows", "consequence": "Impact on 12-month forecast if this risk materialises" },
        { "severity": "medium", "metric": "Risk name", "observation": "What the data or trend shows", "consequence": "Impact on 12-month forecast if this risk materialises" },
        { "severity": "low", "metric": "Risk name", "observation": "What the data or trend shows", "consequence": "Impact on 12-month forecast if this risk materialises" }
      ]
    },
    {
      "id": "milestones",
      "label": "Milestone Tracker",
      "icon": "flag",
      "content": "Key targets to hit and the leading indicators that signal whether you are on track.",
      "milestones": [
        { "target": "Milestone name", "deadline": "Month X", "leading_indicator": "The metric you can track weekly that predicts whether you will hit this", "current_pace": "on-track / behind / ahead", "gap": "What needs to change to get on track if behind" },
        { "target": "Milestone name", "deadline": "Month X", "leading_indicator": "The metric you can track weekly that predicts whether you will hit this", "current_pace": "on-track / behind / ahead", "gap": "What needs to change to get on track if behind" },
        { "target": "Milestone name", "deadline": "Month X", "leading_indicator": "The metric you can track weekly that predicts whether you will hit this", "current_pace": "on-track / behind / ahead", "gap": "What needs to change to get on track if behind" }
      ]
    },
    {
      "id": "priorities",
      "label": "Metric Prioritisation",
      "icon": "target",
      "content": "How to focus measurement and reporting to maximise forecast accuracy.",
      "items": [
        { "label": "Weekly Metric to Watch", "value": "The one leading indicator to check every Monday that predicts monthly performance" },
        { "label": "Model Refresh Trigger", "value": "The specific data point that should prompt a full forecast update" },
        { "label": "Data Collection Gap", "value": "What data you are not collecting that would significantly improve forecast accuracy" },
        { "label": "Board Reporting Metric", "value": "The single metric to report to investors that best captures business health and trajectory" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. severity values must be exactly: "high", "medium", or "low". current_pace values must be exactly: "on-track", "behind", or "ahead". Valid JSON only.`,

        // ── 6. CSV / Data Paste Analysis ──
        csv: `You are Stremini, a world-class data analyst. The user has pasted raw data (CSV, JSON, table, or numbers). Analyse it thoroughly and output ONLY the <report> block below.

<report>
{
  "type": "csv",
  "title": "[Dataset Name] — Data Analysis Report",
  "summary": "2-3 sentence summary: what this dataset contains, the most important pattern found, and the single most actionable finding.",
  "health_score": 70,
  "health_label": "Needs Attention",
  "sections": [
    {
      "id": "data_profile",
      "label": "Data Profile",
      "icon": "table",
      "content": "What the dataset contains — structure, coverage, quality, and any issues.",
      "items": [
        { "label": "Dataset Type", "value": "What kind of data this is and what business process it tracks" },
        { "label": "Time Period", "value": "Date range covered, if applicable" },
        { "label": "Records / Rows", "value": "Number of records and key dimensions" },
        { "label": "Data Quality Issues", "value": "Missing values, duplicates, outliers, or inconsistencies found" },
        { "label": "Key Fields", "value": "The most analytically important columns and what they represent" }
      ]
    },
    {
      "id": "insights",
      "label": "Key Insights",
      "icon": "lightbulb",
      "content": "The most important patterns, trends, and findings in the data.",
      "insights": [
        { "title": "Finding title", "detail": "2-3 sentences explaining this finding, what drives it, and why it matters for the business.", "signal": "positive" },
        { "title": "Finding title", "detail": "2-3 sentences explaining this finding, what drives it, and why it matters for the business.", "signal": "negative" },
        { "title": "Finding title", "detail": "2-3 sentences explaining this finding, what drives it, and why it matters for the business.", "signal": "neutral" },
        { "title": "Finding title", "detail": "2-3 sentences explaining this finding, what drives it, and why it matters for the business.", "signal": "positive" }
      ]
    },
    {
      "id": "statistics",
      "label": "Key Statistics",
      "icon": "bar-chart",
      "content": "The most important descriptive statistics from the dataset.",
      "items": [
        { "label": "Statistic name", "value": "Value with units and context — compare to expectation or benchmark" },
        { "label": "Statistic name", "value": "Value with units and context" },
        { "label": "Statistic name", "value": "Value with units and context" },
        { "label": "Statistic name", "value": "Value with units and context" },
        { "label": "Statistic name", "value": "Value with units and context" }
      ]
    },
    {
      "id": "risk_flags",
      "label": "Risk Flags",
      "icon": "alert",
      "content": "Patterns in the data that signal problems or risks.",
      "flags": [
        { "severity": "high", "metric": "Flag name", "observation": "Specific data pattern observed", "consequence": "Business risk or decision impact" },
        { "severity": "medium", "metric": "Flag name", "observation": "Specific data pattern observed", "consequence": "Business risk or decision impact" },
        { "severity": "low", "metric": "Flag name", "observation": "Specific data pattern observed", "consequence": "Business risk or decision impact" }
      ]
    },
    {
      "id": "hypotheses",
      "label": "Hypothesis List",
      "icon": "flask",
      "content": "What the data suggests — and what further investigation would confirm.",
      "items": [
        { "label": "Hypothesis #1 (Most Supported)", "value": "What the data most strongly suggests and the evidence for it" },
        { "label": "Hypothesis #2", "value": "Alternative interpretation and supporting evidence" },
        { "label": "Hypothesis #3", "value": "Alternative interpretation and supporting evidence" },
        { "label": "Next Analysis Step", "value": "The most valuable additional analysis or data cut to run on this dataset" }
      ]
    },
    {
      "id": "experiments",
      "label": "Recommended Actions",
      "icon": "zap",
      "content": "Concrete actions based on the data findings.",
      "experiments": [
        { "name": "Action name", "hypothesis": "What outcome we expect", "method": "Exactly what to do based on this data", "metric": "How to measure success", "timeline": "1-2 weeks", "effort": "low" },
        { "name": "Action name", "hypothesis": "What outcome we expect", "method": "Exactly what to do based on this data", "metric": "How to measure success", "timeline": "2-4 weeks", "effort": "medium" },
        { "name": "Action name", "hypothesis": "What outcome we expect", "method": "Exactly what to do based on this data", "metric": "How to measure success", "timeline": "4-8 weeks", "effort": "high" }
      ]
    }
  ]
}
</report>

RULES: Output ONLY the <report> block. Analyse the ACTUAL data pasted — use real numbers from the data. signal values must be exactly: "positive", "negative", or "neutral". severity values must be exactly: "high", "medium", or "low". effort values must be exactly: "low", "medium", or "high". Valid JSON only.`,
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

      const reportMatch = aiMessage.match(/<report>([\s\S]*?)(?:<\/report>|$)/i);
      if (reportMatch) {
        let reportJson;
        try {
          reportJson = JSON.parse(reportMatch[1].trim());
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