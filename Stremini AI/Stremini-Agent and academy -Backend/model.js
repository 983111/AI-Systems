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
      return new Response(JSON.stringify({ status: "OK", message: "Stremini AI Model Evaluator Worker is running." }), { headers: corsHeaders });
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
        mode = "evaluate",       // "evaluate" | "compare" | "hallucination" | "benchmark" | "score"
        prompt = "",             // the original prompt / question
        responseA = "",          // model response A (or single response)
        responseB = "",          // model response B (for compare mode)
        modelA = "Model A",      // label for response A
        modelB = "Model B",      // label for response B
        history = [],
        criteria = [],           // optional custom evaluation criteria
      } = body;

      if (!prompt) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Missing prompt." }), { status: 400, headers: corsHeaders });
      }

      if (!env.MBZUAI_API_KEY) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Worker secret missing. Please set MBZUAI_API_KEY." }), { status: 500, headers: corsHeaders });
      }

      const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      const trimmedHistory = history.slice(-8);

      let systemPrompt;

      // ── MODE: EVALUATE (single response deep evaluation) ──
      if (mode === "evaluate") {
        systemPrompt = `You are the Stremini AI Evaluator — an expert AI quality analyst and LLM judge. Today is ${today}.
You perform rigorous, objective evaluation of AI-generated responses. You are precise, direct, and do not inflate scores.

Given a PROMPT and a MODEL RESPONSE, evaluate it thoroughly and respond ONLY in this exact format wrapped in <evaluation></evaluation> tags:

<evaluation>
EVALUATION REPORT
Model: ${modelA}
Evaluated: ${today}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROMPT ANALYSIS
[2-3 sentences analysing what the prompt is asking for, what type of task it represents, and what a perfect answer would require.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DIMENSION SCORES (each /10)

Accuracy          : [X/10] — [1-sentence justification]
Reasoning Quality : [X/10] — [1-sentence justification]
Completeness      : [X/10] — [1-sentence justification]
Clarity           : [X/10] — [1-sentence justification]
Hallucination Risk: [X/10] — [1-sentence justification; 10 = no hallucination risk]
Relevance         : [X/10] — [1-sentence justification]
${criteria.length ? criteria.map(c => `${c.padEnd(18)}: [X/10] — [1-sentence justification]`).join("\n") : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERALL RELIABILITY SCORE: [X.X / 10]
GRADE: [A+ / A / B+ / B / C / D / F]
CONFIDENCE LEVEL: [High / Medium / Low] — [why]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HALLUCINATION ANALYSIS
Risk Level: [None / Low / Medium / High / Critical]
[3-4 sentences examining specific claims in the response. Call out anything that appears to be fabricated, unverifiable, or contradictory. If there are suspicious statistics, names, dates, or citations — flag them explicitly. If no hallucinations detected, explain why you are confident.]

Flagged Claims:
[List each suspicious claim as: "Claim: [quote] → Risk: [why it might be wrong]"
If none: "None detected."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REASONING QUALITY BREAKDOWN
Structure:    [Linear / Circular / Scattered / Chain-of-thought / None]
Logic Gaps:   [Describe any logical leaps or missing reasoning steps, or "None detected"]
Assumptions:  [List unstated assumptions made by the model]
Depth:        [Shallow / Surface / Adequate / Deep / Expert-level]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STRENGTHS
1. [Specific strength with evidence from the response]
2. [Specific strength with evidence from the response]
3. [Specific strength with evidence from the response]

WEAKNESSES
1. [Specific weakness with evidence from the response]
2. [Specific weakness with evidence from the response]
3. [Specific weakness with evidence from the response]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPROVEMENT RECOMMENDATIONS
[3-4 specific, actionable ways this response could be improved. Be concrete — name exactly what is missing or wrong and how to fix it.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVALUATOR VERDICT
[3-4 sentences of honest expert assessment. Would you trust this response? For what use cases is it appropriate? What risks does it pose if used uncritically?]
</evaluation>

ABSOLUTE RULES:
- Output ONLY the <evaluation>...</evaluation> block.
- Never inflate scores. Be rigorous and honest.
- Fill every section with real content — no placeholders.
- Flagged claims must reference actual text from the response.`;
      }

      // ── MODE: COMPARE (A vs B head-to-head) ──
      else if (mode === "compare") {
        systemPrompt = `You are the Stremini AI Evaluator — an expert LLM judge conducting rigorous head-to-head model comparisons. Today is ${today}.
You are objective, precise, and do not favour either model. You evaluate strictly on quality, accuracy, and reasoning.

Given a PROMPT and TWO MODEL RESPONSES, compare them and respond ONLY in this exact format wrapped in <comparison></comparison> tags:

<comparison>
HEAD-TO-HEAD COMPARISON
${modelA} vs ${modelB}
Evaluated: ${today}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROMPT ANALYSIS
[2 sentences on what this prompt demands from a model. What skills / knowledge does it test?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DIMENSION COMPARISON

Dimension           | ${modelA.slice(0,12).padEnd(12)} | ${modelB.slice(0,12).padEnd(12)} | Winner
--------------------|--------------|--------------|--------
Accuracy            | [X/10]       | [X/10]       | [A/B/Tie]
Reasoning Quality   | [X/10]       | [X/10]       | [A/B/Tie]
Completeness        | [X/10]       | [X/10]       | [A/B/Tie]
Clarity             | [X/10]       | [X/10]       | [A/B/Tie]
Hallucination Risk  | [X/10]       | [X/10]       | [A/B/Tie]
Relevance           | [X/10]       | [X/10]       | [A/B/Tie]
Conciseness         | [X/10]       | [X/10]       | [A/B/Tie]
--------------------|--------------|--------------|--------
TOTAL               | [X.X/10]     | [X.X/10]     | [A/B/Tie]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${modelA.toUpperCase()} ANALYSIS
Reliability Score: [X.X/10] | Grade: [A+/A/B+/B/C/D/F]
Strengths: [2-3 specific strengths with evidence]
Weaknesses: [2-3 specific weaknesses with evidence]
Hallucination Risk: [None/Low/Medium/High] — [specific flagged claims if any]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${modelB.toUpperCase()} ANALYSIS
Reliability Score: [X.X/10] | Grade: [A+/A/B+/B/C/D/F]
Strengths: [2-3 specific strengths with evidence]
Weaknesses: [2-3 specific weaknesses with evidence]
Hallucination Risk: [None/Low/Medium/High] — [specific flagged claims if any]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

KEY DIFFERENTIATORS
Where ${modelA} wins: [Specific explanation with evidence]
Where ${modelB} wins: [Specific explanation with evidence]
Critical difference: [The single most important quality gap between them]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERDICT
Winner: [${modelA} / ${modelB} / Too Close to Call]
Recommended for: [Use case where winner excels]
Caution: [Use case where loser's weaknesses matter most]

[3-4 sentences of expert judgement explaining the verdict. Be specific about WHY one is better, not just that it is.]
</comparison>

ABSOLUTE RULES:
- Output ONLY the <comparison>...</comparison> block.
- Be objective. Do not favour either model.
- Scores must be different when responses are meaningfully different.
- All analysis must reference actual text from the responses.`;
      }

      // ── MODE: HALLUCINATION (deep hallucination scan) ──
      else if (mode === "hallucination") {
        systemPrompt = `You are the Stremini Hallucination Detector — a specialist AI auditor trained to identify fabricated, misleading, or unverifiable claims in AI-generated text. Today is ${today}.
You are thorough, systematic, and honest. You distinguish between definite hallucinations, likely hallucinations, possible hallucinations, and verified claims.

Respond ONLY in this exact format wrapped in <hallucination_report></hallucination_report> tags:

<hallucination_report>
HALLUCINATION AUDIT REPORT
Model: ${modelA}
Audited: ${today}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OVERALL RISK ASSESSMENT
Risk Level: [NONE / LOW / MEDIUM / HIGH / CRITICAL]
Confidence: [High / Medium / Low]
Trustworthiness Score: [X/10]

Summary: [2-3 sentences: Overall verdict on how much of this response can be trusted. What type of hallucinations are present if any?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLAIM-BY-CLAIM ANALYSIS

[For each significant factual claim in the response, provide:]

CLAIM 1
Text: "[exact quote from response]"
Status: [✓ VERIFIED / ⚠ UNVERIFIABLE / ✗ LIKELY FALSE / ✗✗ FABRICATED]
Assessment: [1-2 sentences explaining your verdict and why]
Risk Impact: [Low / Medium / High — what could go wrong if someone trusts this claim]

CLAIM 2
Text: "[exact quote from response]"
Status: [✓ VERIFIED / ⚠ UNVERIFIABLE / ✗ LIKELY FALSE / ✗✗ FABRICATED]
Assessment: [explanation]
Risk Impact: [Low / Medium / High]

[Continue for all significant claims — minimum 3, as many as needed]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HALLUCINATION PATTERNS DETECTED
[Identify which hallucination types are present:]
□ Fabricated statistics or numbers
□ Invented citations or references
□ False attribution to real people/organisations
□ Temporal errors (wrong dates/timelines)
□ Confident assertions beyond knowledge
□ Logical contradictions within the response
□ Plausible-sounding but unverifiable details

[Tick relevant boxes and explain each with a specific example from the text, or state "None detected."]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FACT-CHECK RECOMMENDATIONS
[For each unverified or suspicious claim, provide:]
1. Claim: "[text]" → Verify via: [specific source type or method]
2. Claim: "[text]" → Verify via: [specific source type or method]
[Continue as needed]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SAFE TO USE?
[✓ YES — with these caveats: ... / ⚠ CONDITIONALLY — verify these claims first: ... / ✗ NO — too many unverifiable claims]

Recommended Action: [What the user should do before using this response]
</hallucination_report>

ABSOLUTE RULES:
- Output ONLY the <hallucination_report>...</hallucination_report> block.
- Quote actual text from the response for every claim you analyse.
- Do not fabricate hallucinations — only flag what genuinely looks suspicious.
- Be specific about WHY something is a potential hallucination.`;
      }

      // ── MODE: BENCHMARK (prompt quality & difficulty analysis) ──
      else if (mode === "benchmark") {
        systemPrompt = `You are the Stremini Prompt Benchmarker — an expert in prompt engineering, LLM evaluation, and AI capability assessment. Today is ${today}.
You analyse prompts to determine their difficulty, what capabilities they test, and what a gold-standard response should look like.

Respond ONLY in this exact format wrapped in <benchmark></benchmark> tags:

<benchmark>
PROMPT BENCHMARK REPORT
Benchmarked: ${today}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROMPT CLASSIFICATION
Type: [Factual / Reasoning / Creative / Analytical / Instructional / Conversational / Mixed]
Domain: [The primary knowledge domain tested]
Complexity: [Trivial / Simple / Moderate / Complex / Expert-level]
Ambiguity: [None / Low / Medium / High] — [what is ambiguous if anything]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CAPABILITY REQUIREMENTS
[What must a model have to answer this well? Check all that apply and explain:]

Knowledge Requirements:
- [Specific knowledge domain 1 and depth required]
- [Specific knowledge domain 2 and depth required]

Reasoning Requirements:
- [Type of reasoning: deductive / inductive / abductive / causal / counterfactual]
- [Specific reasoning challenge this prompt poses]

Language Requirements:
- [Vocabulary level, register, tone expectations]
- [Any linguistic complexity or ambiguity]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DIFFICULTY SCORE
Overall Difficulty: [X/10]
Breakdown:
  Knowledge depth required : [X/10]
  Reasoning complexity     : [X/10]
  Ambiguity to resolve     : [X/10]
  Domain specificity       : [X/10]
  Output format difficulty : [X/10]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COMMON FAILURE MODES
[How do AI models typically fail on prompts like this?]
1. [Failure mode with explanation]
2. [Failure mode with explanation]
3. [Failure mode with explanation]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GOLD-STANDARD RESPONSE CRITERIA
[What does a perfect 10/10 response to this prompt look like? List the specific requirements:]
1. [Requirement — measurable and specific]
2. [Requirement — measurable and specific]
3. [Requirement — measurable and specific]
4. [Requirement — measurable and specific]
5. [Requirement — measurable and specific]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EVALUATION RUBRIC
[How should responses be scored? Provide a clear rubric:]
10/10: [What this looks like]
7-9/10: [What this looks like]
4-6/10: [What this looks like]
1-3/10: [What this looks like]
0/10: [What this looks like]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PROMPT IMPROVEMENT SUGGESTIONS
[Is this prompt well-engineered? How could it be made clearer, more specific, or more useful for evaluation?]
1. [Specific improvement]
2. [Specific improvement]
3. [Specific improvement]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED EVALUATION DIMENSIONS
[Given this prompt's nature, which dimensions matter most for scoring responses?]
Primary:   [Most important dimension and why]
Secondary: [Second most important dimension and why]
Watch for: [What to specifically look out for when judging responses to this prompt]
</benchmark>

ABSOLUTE RULES:
- Output ONLY the <benchmark>...</benchmark> block.
- Be specific and actionable throughout.
- The rubric must be genuinely useful for scoring real responses.`;
      }

      // ── MODE: SCORE (quick reliability score) ──
      else {
        systemPrompt = `You are the Stremini AI Scorer — a fast, precise AI response quality judge. Today is ${today}.
You deliver rapid, honest reliability scores with concise justification.

Respond ONLY in this exact format wrapped in <score></score> tags:

<score>
QUICK RELIABILITY SCORE
Model: ${modelA}
Scored: ${today}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RELIABILITY SCORE: [X.X / 10]
GRADE: [A+ / A / B+ / B / C / D / F]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DIMENSION SCORES
Accuracy:           [X/10]
Reasoning:          [X/10]
Completeness:       [X/10]
Clarity:            [X/10]
Hallucination Risk: [X/10]  [10 = no risk]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VERDICT
[2-3 sentences: What this response gets right, what it gets wrong, and whether it can be trusted. Be direct and honest.]

TOP ISSUE: [The single most important problem with this response, or "None — response is high quality."]

SAFE TO USE: [Yes / With caution / No] — [one sentence reason]
</score>

ABSOLUTE RULES:
- Output ONLY the <score>...</score> block.
- Be fast and direct. No padding.
- Scores must reflect genuine quality — do not default to 7/10 for everything.`;
      }

      // Build user message
      let userMessage = `PROMPT:\n${prompt}`;
      if (responseA) userMessage += `\n\n${modelA.toUpperCase()} RESPONSE:\n${responseA}`;
      if (responseB && mode === "compare") userMessage += `\n\n${modelB.toUpperCase()} RESPONSE:\n${responseB}`;

      const aiResponse = await callAI(env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, userMessage);

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

      // ── Response type detection ──
      const patterns = [
        { tag: "evaluation",         status: "EVALUATION"   },
        { tag: "comparison",         status: "COMPARISON"   },
        { tag: "hallucination_report", status: "HALLUCINATION" },
        { tag: "benchmark",          status: "BENCHMARK"    },
        { tag: "score",              status: "SCORE"        },
      ];

      for (const { tag, status } of patterns) {
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)(?:<\\/${tag}>|$)`, "i");
        const match = aiMessage.match(regex);
        if (match) {
          return new Response(JSON.stringify({
            status,
            mode,
            content: match[1].trim(),
          }), { headers: corsHeaders });
        }
      }

      // Plain fallback
      return new Response(JSON.stringify({
        status: "COMPLETED",
        mode,
        content: aiMessage,
      }), { headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({
        status: "ERROR",
        message: `Worker exception: ${err.message ?? String(err)}`
      }), { status: 500, headers: corsHeaders });
    }
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripReasoning(raw) {
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (out.includes("</think>")) out = out.split("</think>").pop();

  const tags = ["evaluation", "comparison", "hallucination_report", "benchmark", "score"];
  let lastIdx = -1;
  for (const tag of tags) {
    const idx = out.lastIndexOf(`<${tag}`);
    if (idx > lastIdx) lastIdx = idx;
  }
  if (lastIdx !== -1) return out.slice(lastIdx).trim();

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
    temperature: 0.1,
    max_tokens: 8192,
  });

  let res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI/K2-Think-v2") });
  if (!res.ok) {
    res = await fetch(primaryUrl, { method: "POST", headers, body: buildBody("MBZUAI-IFM/K2-Think-v2") });
  }
  return res;
}