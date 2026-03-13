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
        JSON.stringify({ status: "OK", message: "Stremini Security & Scalability Analysis Worker is running." }),
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

      // ── Accept either a raw code string OR a GitHub repo context object ──
      // Payload shape:
      //   { query: "<raw code or pre-assembled file dump>", history?: [], focus?: "security"|"scalability"|"both" }
      //
      // The frontend is expected to:
      //   1. Accept a GitHub URL from the user
      //   2. Call the GitHub Contents API to list & fetch files (keeping total
      //      chars ≤ 28 000 so they fit comfortably inside the context window)
      //   3. Assemble them into `query` as:
      //        === FILE: path/to/file.ext ===\n<contents>\n\n
      //   4. POST that assembled string here
      //
      // This worker does NOT hit GitHub itself — the fetching stays in the
      // client layer (or a separate thin proxy) to keep this worker stateless
      // and free of extra secrets.

      const { query: rawQuery, history = [], focus = "both" } = body;

      if (!rawQuery || typeof rawQuery !== "string") {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Missing or invalid query. Provide assembled file contents in the `query` field." }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!env.MBZUAI_API_KEY) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Worker secret missing. Please set MBZUAI_API_KEY." }),
          { status: 500, headers: corsHeaders }
        );
      }

      // ── Validate focus ─────────────────────────────────────────────────────
      const VALID_FOCUS = ["security", "scalability", "both"];
      const resolvedFocus = VALID_FOCUS.includes(focus) ? focus : "both";

      // ── Cap query length ───────────────────────────────────────────────────
      // 28 000 chars ≈ ~7k tokens — leaves plenty of room for the long
      // structured report the model needs to produce.
      const MAX_QUERY_CHARS = 28000;
      const query =
        rawQuery.length > MAX_QUERY_CHARS
          ? rawQuery.slice(0, MAX_QUERY_CHARS) +
            "\n\n[Note: input was truncated to 28 000 characters to fit the model context window.]"
          : rawQuery;

      const trimmedHistory = history.slice(-10);

      // ── Shared preamble ────────────────────────────────────────────────────
      const PATIENCE_PREAMBLE = `IMPORTANT: Take your time. Think through every aspect of the codebase fully before writing any output. Produce one complete, deeply reasoned report. Do NOT truncate sections. Do NOT use placeholder text like "[analysis here]" — every section must contain real, specific findings tied to the actual code.`;

      // ── Build system prompt based on focus ────────────────────────────────
      const today = new Date().toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
      });

      let systemPrompt;

      // ─── SECURITY-ONLY ────────────────────────────────────────────────────
      if (resolvedFocus === "security") {
        systemPrompt = `You are Stremini, an elite application security engineer and penetration tester with deep expertise in OWASP, CVE patterns, secure coding practices, and threat modelling across all major languages and frameworks.

${PATIENCE_PREAMBLE}

Wrap your ENTIRE output inside <security_analysis></security_analysis> tags. Every section must contain real, specific findings. Do NOT omit any section. Reference exact file names, function names, and line-level patterns from the submitted code.

<security_analysis>
SECURITY ANALYSIS REPORT
=========================
Language / Framework: [detected — be specific, e.g. "Node.js 18 + Express 4 + Prisma"]
Analysis Date: ${today}
Risk Verdict: [CRITICAL | HIGH | MEDIUM | LOW | SECURE] — one-sentence overall assessment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY
[3-4 sentences: the single most important security concern, overall posture, and the top recommended action. Written for a non-technical stakeholder.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THREAT MODEL
Attack Surface: [entry points — HTTP endpoints, file uploads, env vars, third-party APIs, etc.]
Trust Boundaries: [where user-controlled data crosses trust boundaries]
Assumed Attacker: [external unauthenticated / authenticated user / insider / supply chain]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VULNERABILITY FINDINGS
[For EACH finding use this block:]

► [SEVERITY: CRITICAL|HIGH|MEDIUM|LOW|INFO] — [Vulnerability Name, e.g. SQL Injection, Hardcoded Secret]
  CWE / OWASP: [e.g. CWE-89 / OWASP A03:2021 Injection]
  Location: [file and function/line reference from submitted code]
  Description: [precise explanation of the vulnerability and how an attacker could exploit it]
  Proof-of-Concept Vector:
  [show the attack payload or exploitation path — concrete, not hypothetical]
  Remediation:
\`\`\`
[corrected code snippet — fully implemented, no placeholders]
\`\`\`
  Effort to Fix: [Low | Medium | High]

[Repeat for every finding. If no findings in a severity tier, state "None identified." — do NOT skip the tier.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AUTHENTICATION & AUTHORISATION
[2-3 paragraphs: session management, token handling, privilege escalation risks, missing auth checks, IDOR patterns.]

CRYPTOGRAPHY & SECRETS
[2-3 paragraphs: key management, algorithm choices, secret storage, entropy issues, hashing practices.]

INPUT VALIDATION & OUTPUT ENCODING
[2-3 paragraphs: injection risks (SQL, NoSQL, command, LDAP, XSS), deserialization, regex DoS, prototype pollution.]

DEPENDENCY & SUPPLY-CHAIN SECURITY
[List any third-party packages visible in the code. Flag known-risky patterns. Recommend lockfile and audit practices.]

DATA EXPOSURE & PRIVACY
[Sensitive data in logs, error messages, API responses, or client-side storage. PII handling. GDPR/CCPA surface.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RISK SCORECARD
| Category                        | Score (0-10) | Verdict  |
|---------------------------------|--------------|----------|
| Authentication & Authorisation  | [score]      | [status] |
| Injection & Input Handling      | [score]      | [status] |
| Cryptography & Secret Mgmt      | [score]      | [status] |
| Dependency Security             | [score]      | [status] |
| Data Exposure & Privacy         | [score]      | [status] |
| Error Handling & Logging        | [score]      | [status] |
| Overall Security Score          | [score/10]   | [status] |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

REMEDIATION ROADMAP
[Prioritised action list. Each item: priority number, action, effort, impact.]
Priority 1 (Do Now): [action]
Priority 2 (This Sprint): [action]
Priority 3 (Next Sprint): [action]
[continue as needed]

SECURITY TOOLS RECOMMENDED
[3-5 specific tools (SAST, DAST, dependency scanners) suitable for this stack with one-line rationale each.]
</security_analysis>

ABSOLUTE RULES:
- Output ONLY the <security_analysis>…</security_analysis> block. Zero words outside it.
- Every finding must reference real code from the submission — no generic advice.
- The risk scorecard must have numeric scores, not just labels.`;

      // ─── SCALABILITY-ONLY ─────────────────────────────────────────────────
      } else if (resolvedFocus === "scalability") {
        systemPrompt = `You are Stremini, a principal engineer and distributed-systems architect with deep expertise in performance engineering, capacity planning, database scaling, cloud-native patterns, and high-availability design.

${PATIENCE_PREAMBLE}

Wrap your ENTIRE output inside <scalability_analysis></scalability_analysis> tags. Every section must contain real, specific findings tied to the submitted code. Reference exact file names and function patterns.

<scalability_analysis>
SCALABILITY ANALYSIS REPORT
============================
Language / Framework: [detected — be specific]
Analysis Date: ${today}
Scalability Verdict: [NOT SCALABLE | NEEDS WORK | MODERATELY SCALABLE | HIGHLY SCALABLE] — one-sentence overall assessment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY
[3-4 sentences: the primary scalability bottleneck, estimated scale ceiling before failure, and the single highest-impact fix. Written for a technical lead or CTO.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOAD PROFILE ASSUMPTIONS
Estimated Scale Ceiling (current code): [e.g. "~500 req/s on a single node before OOM or DB exhaustion"]
Bottleneck Layer: [API / Database / Cache / File I/O / External Service / CPU]
Failure Mode at Scale: [what breaks first and how]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALGORITHMIC COMPLEXITY
[For each significant function or data processing block found in the code:]
► Function / Module: [name and file reference]
  Time Complexity: [Big-O with justification]
  Space Complexity: [Big-O with justification]
  Problem at Scale: [how this degrades under high load or large data]
  Optimised Approach:
\`\`\`
[improved code — fully implemented]
\`\`\`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DATABASE & PERSISTENCE LAYER
[2-3 paragraphs: N+1 queries, missing indexes, full-table scans, connection pool sizing, ORM pitfalls, transaction scope, sharding readiness.]

CACHING STRATEGY
[2-3 paragraphs: what is currently cached (if anything), what should be, recommended cache layer (Redis/Memcached/CDN/in-process), invalidation approach, TTL guidance.]

CONCURRENCY & PARALLELISM
[2-3 paragraphs: blocking I/O, thread/goroutine/async patterns, race conditions under load, queue vs synchronous processing, event loop blocking (Node), GIL (Python), etc.]

STATELESSNESS & HORIZONTAL SCALING
[Can this service scale horizontally today? What prevents it (session state, local file storage, singleton objects, etc.)? How to fix each blocker.]

EXTERNAL DEPENDENCIES & RESILIENCE
[Third-party API calls — timeouts, retries, circuit-breaker patterns. What happens when a dependency is slow or down at 10× load?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCALABILITY SCORECARD
| Dimension                        | Score (0-10) | Verdict    |
|----------------------------------|--------------|------------|
| Algorithmic Efficiency           | [score]      | [status]   |
| Database Design & Queries        | [score]      | [status]   |
| Caching & Read Optimisation      | [score]      | [status]   |
| Concurrency & Async Design       | [score]      | [status]   |
| Statelessness / Horiz. Scale     | [score]      | [status]   |
| Resilience & Fault Tolerance     | [score]      | [status]   |
| Overall Scalability Score        | [score/10]   | [status]   |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SCALING ROADMAP
Phase 1 — Quick wins (hours): [list specific, concrete changes]
Phase 2 — Medium-term (days): [architectural changes]
Phase 3 — Long-term (weeks): [infrastructure and design evolution]

ARCHITECTURE RECOMMENDATION
[1-2 paragraphs: what this service should look like at 10× and 100× current load — concrete patterns (CQRS, event sourcing, read replicas, CDN offload, etc.) matched to the actual code.]
</scalability_analysis>

ABSOLUTE RULES:
- Output ONLY the <scalability_analysis>…</scalability_analysis> block. Zero words outside it.
- Every finding must reference real patterns from the submitted code — no generic advice.
- The scorecard must have numeric scores.`;

      // ─── BOTH (default) ───────────────────────────────────────────────────
      } else {
        systemPrompt = `You are Stremini, a principal engineer combining elite application security expertise with deep distributed-systems architecture knowledge. You produce thorough, actionable reports that teams use to harden and scale production systems.

${PATIENCE_PREAMBLE}

Wrap your ENTIRE output inside <analysis></analysis> tags. Every section must contain real, specific findings tied to the submitted code. Reference exact file names, function names, and patterns from the code. Do NOT omit any section. Do NOT use generic advice — every recommendation must be grounded in what you actually see.

<analysis>
CODE SECURITY & SCALABILITY REPORT
====================================
Language / Framework: [detected — be specific, e.g. "TypeScript + Next.js 14 + Prisma + PostgreSQL"]
Analysis Date: ${today}
Files Analysed: [list each file name extracted from the submission header comments]

Overall Security Verdict:    [CRITICAL | HIGH RISK | MEDIUM RISK | LOW RISK | SECURE]
Overall Scalability Verdict: [NOT SCALABLE | NEEDS WORK | MODERATELY SCALABLE | HIGHLY SCALABLE]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY
Security:    [2-3 sentences: most dangerous finding, overall posture, top recommended action.]
Scalability: [2-3 sentences: primary bottleneck, estimated scale ceiling, single highest-impact fix.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — SECURITY ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THREAT MODEL
Attack Surface: [entry points visible in the code — HTTP routes, file uploads, env vars, third-party calls, etc.]
Trust Boundaries: [where user-controlled data crosses trust boundaries]
Assumed Attacker: [external unauthenticated / authenticated user / insider / supply chain]

VULNERABILITY FINDINGS
[For EACH finding use this block. Cover all severity tiers. Never omit a tier — write "None identified." if clean.]

► [SEVERITY: CRITICAL|HIGH|MEDIUM|LOW|INFO] — [Vulnerability Name]
  CWE / OWASP: [e.g. CWE-89 / OWASP A03:2021 Injection]
  Location: [file + function/line reference from the submitted code]
  Description: [precise explanation — what is wrong and how an attacker exploits it]
  Proof-of-Concept Vector: [concrete attack payload or exploitation path]
  Remediation:
\`\`\`
[corrected code — fully implemented, no placeholders]
\`\`\`
  Effort to Fix: [Low | Medium | High]

AUTHENTICATION & AUTHORISATION
[2-3 paragraphs specific to this codebase.]

CRYPTOGRAPHY & SECRETS
[2-3 paragraphs: key management, algorithm choices, hardcoded secrets, entropy issues.]

INPUT VALIDATION & OUTPUT ENCODING
[2-3 paragraphs: injection, XSS, deserialization, regex DoS, prototype pollution — tied to actual code patterns.]

DEPENDENCY & SUPPLY-CHAIN SECURITY
[Identify packages visible in the code. Flag risky patterns. Recommend lockfile and audit practices.]

DATA EXPOSURE & PRIVACY
[Sensitive data in logs, error messages, API responses, client-side storage, PII handling.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — SCALABILITY ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOAD PROFILE
Estimated Scale Ceiling (current code): [e.g. "~500 req/s before DB connection exhaustion"]
Primary Bottleneck: [layer and specific cause]
Failure Mode at Scale: [what breaks first and why]

ALGORITHMIC COMPLEXITY
[For each significant function or processing block:]
► Function / Module: [name + file reference]
  Time Complexity: [Big-O + justification]
  Space Complexity: [Big-O + justification]
  Problem at Scale: [concrete degradation scenario]
  Optimised Approach:
\`\`\`
[improved code — fully implemented]
\`\`\`

DATABASE & PERSISTENCE LAYER
[2-3 paragraphs: N+1 queries, missing indexes, full-table scans, connection pooling, transaction scope, sharding readiness — specific to the ORM/DB patterns seen in the code.]

CACHING STRATEGY
[2-3 paragraphs: what is currently cached, what should be, recommended cache layer, invalidation approach, TTL guidance.]

CONCURRENCY & PARALLELISM
[2-3 paragraphs: blocking I/O, async patterns, race conditions, queue vs sync processing, event loop or thread pool issues — specific to the language/runtime detected.]

STATELESSNESS & HORIZONTAL SCALING
[Can this service scale horizontally today? List each blocker (session state, local files, singletons) with a concrete fix.]

EXTERNAL DEPENDENCIES & RESILIENCE
[For each external call visible in the code: timeout config, retry logic, circuit-breaker, behaviour under slow/down dependency at high load.]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — COMBINED SCORECARDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECURITY SCORECARD
| Category                        | Score (0-10) | Verdict  |
|---------------------------------|--------------|----------|
| Authentication & Authorisation  | [score]      | [status] |
| Injection & Input Handling      | [score]      | [status] |
| Cryptography & Secret Mgmt      | [score]      | [status] |
| Dependency Security             | [score]      | [status] |
| Data Exposure & Privacy         | [score]      | [status] |
| Error Handling & Logging        | [score]      | [status] |
| Overall Security Score          | [score/10]   | [verdict]|

SCALABILITY SCORECARD
| Dimension                        | Score (0-10) | Verdict  |
|----------------------------------|--------------|----------|
| Algorithmic Efficiency           | [score]      | [status] |
| Database Design & Queries        | [score]      | [status] |
| Caching & Read Optimisation      | [score]      | [status] |
| Concurrency & Async Design       | [score]      | [status] |
| Statelessness / Horiz. Scale     | [score]      | [status] |
| Resilience & Fault Tolerance     | [score]      | [status] |
| Overall Scalability Score        | [score/10]   | [verdict]|

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — UNIFIED REMEDIATION ROADMAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Ordered by combined risk × impact. Each item: action, security or scalability concern addressed, effort, owner hint.]

🔴 Do Now (hours):
1. [specific action tied to a real finding above]
2. [specific action]

🟠 This Sprint (days):
3. [specific action]
4. [specific action]

🟡 Next Sprint (weeks):
5. [specific action]
6. [specific action]

🟢 Long-Term Architecture:
[1-2 paragraphs: what this system should look like at 10× load with hardened security — concrete patterns matched to the actual codebase.]

RECOMMENDED TOOLING
Security: [3 specific SAST/DAST/dependency tools suited to this stack]
Performance: [3 specific profiling/APM/load-testing tools suited to this stack]
</analysis>

ABSOLUTE RULES:
- Output ONLY the <analysis>…</analysis> block. Zero words outside it.
- Every finding must reference real code from the submission — no generic advice.
- Both scorecards must contain numeric scores, not just labels.
- Code snippets in remediations must be fully implemented — no stubs or placeholders.`;
      }

      // ── Call the AI ────────────────────────────────────────────────────────
      let aiResponse;
      try {
        aiResponse = await callAI(env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, query);
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
          JSON.stringify({ status: "ERROR", message: "AI returned an empty response. The codebase may be too large — try reducing the number of files." }),
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

      // ── Extract structured output by focus ────────────────────────────────
      if (resolvedFocus === "security") {
        const content = extractTag(aiMessage, "security_analysis");
        if (content !== null) {
          return new Response(
            JSON.stringify({ status: "SECURITY_ANALYSIS", focus: "security", content }),
            { status: 200, headers: corsHeaders }
          );
        }
      }

      if (resolvedFocus === "scalability") {
        const content = extractTag(aiMessage, "scalability_analysis");
        if (content !== null) {
          return new Response(
            JSON.stringify({ status: "SCALABILITY_ANALYSIS", focus: "scalability", content }),
            { status: 200, headers: corsHeaders }
          );
        }
      }

      // "both" or fallback — try combined tag first, then individual tags
      const bothContent = extractTag(aiMessage, "analysis");
      if (bothContent !== null) {
        return new Response(
          JSON.stringify({ status: "ANALYSIS", focus: resolvedFocus, content: bothContent }),
          { status: 200, headers: corsHeaders }
        );
      }

      // Graceful degradation: one of the individual tags survived
      const secContent = extractTag(aiMessage, "security_analysis");
      if (secContent !== null) {
        return new Response(
          JSON.stringify({ status: "SECURITY_ANALYSIS", focus: "security", content: secContent }),
          { status: 200, headers: corsHeaders }
        );
      }

      const scaleContent = extractTag(aiMessage, "scalability_analysis");
      if (scaleContent !== null) {
        return new Response(
          JSON.stringify({ status: "SCALABILITY_ANALYSIS", focus: "scalability", content: scaleContent }),
          { status: 200, headers: corsHeaders }
        );
      }

      // ── Plain-text fallback ────────────────────────────────────────────────
      return new Response(
        JSON.stringify({ status: "COMPLETED", focus: resolvedFocus, solution: aiMessage }),
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
// Helpers  (identical contracts to the original Code Agent worker)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract content between <tagName>…</tagName>.
 * Finds the LAST occurrence of the opening tag so any reasoning preamble
 * that accidentally contains the same tag does not interfere.
 * If the closing tag is missing (truncated response), returns everything
 * after the opening tag so partial output is still usable.
 */
function extractTag(text, tagName) {
  const open  = `<${tagName}>`;
  const close = `</${tagName}>`;

  const startIdx = text.lastIndexOf(open);
  if (startIdx === -1) return null;

  const contentStart = startIdx + open.length;
  const endIdx = text.indexOf(close, contentStart);

  const raw = endIdx === -1
    ? text.slice(contentStart)
    : text.slice(contentStart, endIdx);

  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Remove <think>…</think> reasoning blocks produced by chain-of-thought
 * models. Also handles models that emit reasoning before the final answer
 * without proper closing tags.
 */
function stripReasoning(raw) {
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");

  if (out.includes("</think>")) {
    out = out.split("</think>").pop();
  }

  // Start from the last structural tag so reasoning preamble is skipped
  const structuralTags = [
    "<analysis>",
    "<security_analysis>",
    "<scalability_analysis>",
  ];
  let latestIdx = -1;
  for (const tag of structuralTags) {
    const idx = out.lastIndexOf(tag);
    if (idx > latestIdx) latestIdx = idx;
  }
  if (latestIdx !== -1) return out.slice(latestIdx).trim();

  return out.trim();
}

/**
 * Call the MBZUAI K2-Think model with automatic fallback to the alternate
 * model ID if the primary returns a non-2xx status.
 *
 * max_tokens: 16384 — required for the long structured reports.
 * temperature: 0.1  — keep analysis deterministic and factual.
 */
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
      { role: "user", content: userQuery },
    ],
    temperature: 0.1,
    max_tokens: 16384,
    stream: false,
  });

  let res = await fetch(url, { method: "POST", headers, body: buildBody("MBZUAI/K2-Think-v2") });
  if (!res.ok) {
    res = await fetch(url, { method: "POST", headers, body: buildBody("MBZUAI-IFM/K2-Think-v2") });
  }
  return res;
}