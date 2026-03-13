// ─────────────────────────────────────────────────────────────────────────────
// Stremini Agent Worker — MBZUAI K2-Think-v2
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type":                 "application/json",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({ status: "OK", message: "Stremini Agent Worker is running." }),
        { headers: corsHeaders }
      );
    }

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ status: "ERROR", message: "Method not allowed." }),
        { status: 405, headers: corsHeaders }
      );
    }

    try {
      // ── Parse body ──────────────────────────────────────────────────────────
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return jsonError("Invalid JSON body.", 400, corsHeaders);
      }

      const {
        repoOwner,
        repoName,
        task      = "",
        history   = [],
        readFiles = [],
        iteration = 0,
        filePath  = "",
        fileName  = "",
      } = body;

      if (!repoOwner || !repoName || !task.trim()) {
        return jsonError("Missing repoOwner, repoName, or task.", 400, corsHeaders);
      }

      if (!env.GITHUB_TOKEN || !env.MBZUAI_API_KEY) {
        return jsonError(
          "Worker secrets missing. Please set GITHUB_TOKEN and MBZUAI_API_KEY.",
          500, corsHeaders
        );
      }

      const MAX_ITERATIONS = 10;

      // ── Iteration guard ──────────────────────────────────────────────────────
      if (iteration >= MAX_ITERATIONS) {
        return new Response(JSON.stringify({
          status:    "ERROR",
          message:   `Stopped after ${MAX_ITERATIONS} iterations. The AI could not complete the task.`,
          readFiles,
          iteration,
        }), { headers: corsHeaders });
      }

      // ── Duplicate-response guard ─────────────────────────────────────────────
      if (history.length >= 2) {
        const a = history[history.length - 1];
        const b = history[history.length - 2];
        if (a?.role === "assistant" && b?.role === "assistant" && a.content === b.content) {
          return new Response(JSON.stringify({
            status:    "ERROR",
            message:   "AI is producing identical responses — aborting to prevent infinite loop.",
            readFiles,
            iteration,
          }), { headers: corsHeaders });
        }
      }

      // ── 1. Fetch repo metadata ───────────────────────────────────────────────
      const repoRes = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}`,
        { headers: ghHeaders(env) }
      );
      if (!repoRes.ok) {
        const t = await repoRes.text();
        return jsonError(`GitHub API error fetching repo: ${repoRes.status} — ${t}`, 502, corsHeaders);
      }
      const repoData      = await repoRes.json();
      const defaultBranch = repoData.default_branch || "main";

      // ── Normalise and compress the task ─────────────────────────────────────
      // Trim whitespace, collapse blank lines, cap at 4000 chars so it never
      // alone consumes the model's context window.
      const normTask = compressTask(task);

      // ── 2. Fast-path: specific filePath pinned ───────────────────────────────
      if (filePath.trim()) {
        return await handlePinnedFile({
          env, corsHeaders,
          repoOwner, repoName,
          pinnedPath: filePath.trim(),
          normTask, history, readFiles, iteration,
          MAX_ITERATIONS,
        });
      }

      // ── 3. Normal path: fetch file tree ─────────────────────────────────────
      const treeRes = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/git/trees/${defaultBranch}?recursive=1`,
        { headers: ghHeaders(env) }
      );
      if (!treeRes.ok) {
        const t = await treeRes.text();
        return jsonError(`GitHub API error fetching tree: ${treeRes.status} — ${t}`, 502, corsHeaders);
      }

      const treeJson = await treeRes.json();
      if (!treeJson?.tree) {
        return jsonError("Repo tree is empty or invalid.", 502, corsHeaders);
      }

      const treeWasTruncated = treeJson.truncated === true;

      // ── Filter irrelevant files ──────────────────────────────────────────────
      const IGNORED_EXT = [
        ".png",".jpg",".jpeg",".gif",".webp",".ico",".svg",
        ".lock",".plist",".pbxproj",".xcworkspacedata",".xcscheme",
        ".ttf",".otf",".woff",".woff2",".eot",".pdf",".zip",
        ".mp3",".mp4",".mov",".avi",".DS_Store",".bin",".exe",
      ];
      const IGNORED_DIRS = [
        "ios/runner/assets.xcassets","android/app/src/main/res",
        "build/",".dart_tool/",".gradle/","node_modules/",".git/",
        ".next/","dist/","coverage/","__pycache__/",".turbo/",
      ];

      let filteredFiles = treeJson.tree
        .filter(f => f.type === "blob")
        .filter(f => {
          const p = f.path.toLowerCase();
          return !IGNORED_EXT.some(e => p.endsWith(e))
              && !IGNORED_DIRS.some(d => p.startsWith(d));
        })
        .map(f => f.path);

      // If a fileName hint was given, narrow the list
      if (fileName.trim()) {
        const hint     = fileName.trim().toLowerCase();
        const narrowed = filteredFiles.filter(p => p.toLowerCase().endsWith(hint));
        if (narrowed.length > 0) filteredFiles = narrowed;
      }

      // Smart relevance ranking — surface files most likely needed for the task
      filteredFiles = rankFilesByRelevance(filteredFiles, normTask);

      if (!filteredFiles.length) {
        return jsonError("No readable code files found in repository.", 404, corsHeaders);
      }

      // Cap file list to avoid context overflow — keep top 300 ranked files
      const MAX_FILES    = 300;
      const cappedFiles  = filteredFiles.slice(0, MAX_FILES);
      const fileListNote = filteredFiles.length > MAX_FILES
        ? `\n(Showing top ${MAX_FILES} most relevant of ${filteredFiles.length} total files)`
        : "";
      const truncNote = treeWasTruncated
        ? "\nNOTE: GitHub truncated the tree (very large repo) — list may be incomplete."
        : "";

      const fileList = cappedFiles.join("\n");

      const alreadyReadNote  = buildAlreadyReadNote(readFiles);
      const iterationWarning = buildIterationWarning(iteration, MAX_ITERATIONS);

      const systemPrompt = buildSystemPrompt(
        repoOwner, repoName,
        `AVAILABLE FILES:${truncNote}${fileListNote}\n${fileList}`,
        alreadyReadNote, iterationWarning
      );

      const trimmedHistory = trimHistory(history, systemPrompt, normTask);

      const { ok, message: aiMessage, error } = await callAIWithRetry(
        env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, normTask
      );
      if (!ok) return jsonError(`AI API error: ${error}`, 502, corsHeaders);
      if (!aiMessage) return jsonError("AI returned empty response.", 502, corsHeaders);

      return handleAIResponse(aiMessage, env, repoOwner, repoName, readFiles, iteration, corsHeaders);

    } catch (err) {
      return new Response(JSON.stringify({
        status:  "ERROR",
        message: `Worker exception: ${err.message ?? String(err)}`,
      }), { status: 500, headers: corsHeaders });
    }
  },
};


// ─────────────────────────────────────────────────────────────────────────────
// Pinned-file fast path
// ─────────────────────────────────────────────────────────────────────────────

async function handlePinnedFile({
  env, corsHeaders,
  repoOwner, repoName, pinnedPath,
  normTask, history, readFiles, iteration, MAX_ITERATIONS,
}) {
  let pinnedContent = null;
  if (!readFiles.includes(pinnedPath)) {
    pinnedContent = await fetchFileContent(env, repoOwner, repoName, pinnedPath);
  }

  const pinnedSection = pinnedContent
    ? `\nPINNED FILE — ${pinnedPath}:\n\`\`\`\n${pinnedContent}\n\`\`\``
    : `\nPINNED FILE — ${pinnedPath} (already in conversation history).`;

  const alreadyReadNote  = buildAlreadyReadNote(readFiles);
  const iterationWarning = buildIterationWarning(iteration, MAX_ITERATIONS);

  const systemPrompt = buildSystemPrompt(
    repoOwner, repoName,
    `Only the pinned file below is in scope.\n${pinnedSection}`,
    alreadyReadNote, iterationWarning
  );

  const updatedReadFiles = pinnedContent ? [...readFiles, pinnedPath] : readFiles;
  const trimmedHistory   = trimHistory(history, systemPrompt, normTask);

  const { ok, message: aiMessage, error } = await callAIWithRetry(
    env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, normTask
  );
  if (!ok) return jsonError(`AI API error: ${error}`, 502, corsHeaders);
  if (!aiMessage) return jsonError("AI returned empty response.", 502, corsHeaders);

  return handleAIResponse(aiMessage, env, repoOwner, repoName, updatedReadFiles, iteration, corsHeaders);
}


// ─────────────────────────────────────────────────────────────────────────────
// AI response dispatcher
// ─────────────────────────────────────────────────────────────────────────────

async function handleAIResponse(aiMessage, env, repoOwner, repoName, readFiles, iteration, corsHeaders) {
  // ── <read_file> ────────────────────────────────────────────────────────────
  const readMatch = aiMessage.match(/<read_file\s+path=["']?([^"'\s>]+)["']?\s*\/?>/i);
  if (readMatch) {
    const path = readMatch[1].trim();
    if (readFiles.includes(path)) {
      return new Response(JSON.stringify({
        status:    "ERROR",
        message:   `Loop detected: AI re-requested '${path}' which was already read.`,
        readFiles, iteration,
      }), { headers: corsHeaders });
    }
    const fileContent = await fetchFileContent(env, repoOwner, repoName, path);
    return new Response(JSON.stringify({
      status:      "CONTINUE",
      action:      "read_file",
      nextFile:    path,
      fileContent,
      iteration:   iteration + 1,
      readFiles:   [...readFiles, path],
    }), { headers: corsHeaders });
  }

  // ── <fix> ──────────────────────────────────────────────────────────────────
  const fixMatch = aiMessage.match(/<fix\s+path=["']?([^"'\s>]+)["']?>([\s\S]*?)(?:<\/fix>\s*)?$/i);
  if (fixMatch) {
    const fixedPath    = fixMatch[1].trim();
    const fixedContent = stripFences(fixMatch[2].trim());
    return new Response(JSON.stringify({
      status:       "FIXED",
      filePath:     fixedPath,
      fixedContent,
      readFiles,
      iteration,
    }), { headers: corsHeaders });
  }

  // ── Plain answer ───────────────────────────────────────────────────────────
  return new Response(JSON.stringify({
    status:    "COMPLETED",
    solution:  aiMessage,
    readFiles,
    iteration,
  }), { headers: corsHeaders });
}


// ─────────────────────────────────────────────────────────────────────────────
// Task compression — prevents long tasks from overflowing the context window
// ─────────────────────────────────────────────────────────────────────────────

function compressTask(task) {
  const MAX_TASK_CHARS = 4000;

  let out = task
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (out.length <= MAX_TASK_CHARS) return out;

  const head       = out.slice(0, MAX_TASK_CHARS);
  const lastBreak  = head.lastIndexOf("\n");
  const cut        = lastBreak > MAX_TASK_CHARS * 0.8 ? head.slice(0, lastBreak) : head;
  return cut + "\n\n[Task truncated for context window — focus on instructions above.]";
}


// ─────────────────────────────────────────────────────────────────────────────
// History trimming — keeps messages inside the safe context budget
// ─────────────────────────────────────────────────────────────────────────────

function estimateTokens(str) {
  return Math.ceil((str?.length ?? 0) / 4);
}

function trimHistory(history, systemPrompt, task) {
  // K2-Think-v2 has 128k context. Reserve 60k for our turn; leave rest for
  // system prompt + file list + fetched file contents + output.
  const BUDGET   = 60_000;
  const fixed    = estimateTokens(systemPrompt) + estimateTokens(task) + 2000;
  let   budget   = BUDGET - fixed;
  const kept     = [];

  for (let i = history.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(history[i].content);
    if (tokens > budget) break;
    kept.unshift(history[i]);
    budget -= tokens;
  }
  return kept;
}


// ─────────────────────────────────────────────────────────────────────────────
// Relevance ranking — surface files most likely needed for the task first
// ─────────────────────────────────────────────────────────────────────────────

function rankFilesByRelevance(files, task) {
  const taskLower = task.toLowerCase();
  const words     = taskLower.match(/\b\w{3,}\b/g) ?? [];

  function score(path) {
    const p = path.toLowerCase();
    let   s = 0;
    for (const w of words) if (p.includes(w)) s += 3;
    if (/\.(js|ts|jsx|tsx|py|dart|go|rs|java|kt|swift|rb|php|cs|cpp|c|vue|svelte)$/.test(p)) s += 2;
    if (/\.(test|spec|mock|fixture|generated|g\.dart)\b/.test(p)) s -= 1;
    if (p.includes("__tests__") || p.includes("/test/") || p.includes("/tests/")) s -= 1;
    return s;
  }

  return [...files].sort((a, b) => score(b) - score(a));
}


// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemPrompt(owner, repo, contextBlock, alreadyReadNote, iterationWarning) {
  return `You are a careful, methodical code-execution agent for ${owner}/${repo}.
You output ONLY one structured action per response. No prose, no plans outside <think>.

APPROACH: Go slow. Think fully inside <think> before acting. A correct answer on the
second try beats a broken answer on the first. Never rush. Never skip steps.

${contextBlock}

════════════════ OUTPUT FORMAT ════════════════

ACTION A — need to read a file before you can act:
<read_file path="exact/path/to/file" />
(Must be your ENTIRE response outside <think>.)

ACTION B — output the complete fixed/improved file:
<fix path="exact/path/to/file">
COMPLETE FILE CONTENT — every line, first to last, no omissions
</fix>
(Must be your ENTIRE response outside <think>.)

ACTION C — pure factual question, zero code needed:
One sentence only. Nothing else outside <think>.

════════════════ HARD RULES ════════════════

❌ NEVER output reasoning or planning outside <think>
❌ NEVER put any text before <fix or <read_file (outside <think>)
❌ NEVER put any text after </fix>
❌ NEVER truncate code — output the COMPLETE file, every single line
❌ NEVER use placeholder comments like "// ... rest unchanged"
❌ NEVER re-request a file already in FILES ALREADY READ
❌ ONE action per response only

✅ ALWAYS open a <think> block first and reason through the full task before acting.
✅ Inside <think>: identify which file to read or change, plan all edits, then act.
✅ For complex tasks: read one key file per iteration; do not try to guess changes blind.
✅ When writing <fix>: write the ENTIRE file from line 1 to the last line. Never stop early.

REMEMBER: Slow and correct beats fast and broken every time.${alreadyReadNote}${iterationWarning}`;
}

function buildAlreadyReadNote(readFiles) {
  if (!readFiles.length) return "";
  return `\n\nFILES ALREADY READ — DO NOT request these again:\n${readFiles.map(f => `  • ${f}`).join("\n")}`;
}

function buildIterationWarning(iteration, max) {
  if (iteration >= max - 1)
    return "\n\n⚠️  FINAL ITERATION — output <fix> or a plain answer NOW. No more <read_file>.";
  if (iteration >= max - 2)
    return "\n\n⚠️  SECOND-TO-LAST ITERATION — prefer <fix> now unless one more file is truly needed.";
  return "";
}


// ─────────────────────────────────────────────────────────────────────────────
// callAI — single raw HTTP request to K2-Think-v2
// ─────────────────────────────────────────────────────────────────────────────

async function callAI(apiKey, systemPrompt, history, userTask) {
  return await fetch("https://api.k2think.ai/v1/chat/completions", {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${apiKey.trim()}`,
      "Content-Type":  "application/json",
      "accept":        "application/json",
    },
    body: JSON.stringify({
      model:       "MBZUAI-IFM/K2-Think-v2",
      messages:    [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user",   content: userTask },
        // Assistant prefill: forces the model to open a <think> block and reason
        // carefully before acting. Prevents rushed or blank outputs on hard tasks.
        { role: "assistant", content: "<think>\nLet me read the task carefully and think through each step before responding." },
      ],
      temperature: 0.05,   // tiny non-zero prevents deterministic collapse to empty output
      max_tokens:  32768,  // generous ceiling so complete files are never cut off
      stream:      false,
    }),
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// callAIWithBackoff — handles 5xx / 429 / network failures with backoff
// ─────────────────────────────────────────────────────────────────────────────

async function callAIWithBackoff(apiKey, systemPrompt, history, userTask) {
  const MAX_ATTEMPTS = 4;
  const BASE_MS      = 1500;
  let   lastError    = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(BASE_MS * Math.pow(2, attempt - 1));

    let res;
    try {
      res = await callAI(apiKey, systemPrompt, history, userTask);
    } catch (e) {
      lastError = `Network error: ${e.message}`;
      continue;
    }

    if (res.status === 429) {
      const after = Number(res.headers?.get("retry-after") ?? 0);
      if (after > 0) await sleep(after * 1000);
      lastError = "HTTP 429 rate-limited";
      continue;
    }

    if (res.status >= 500) {
      lastError = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      continue;
    }

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 400)}` };
    }

    let data;
    try { data = await res.json(); }
    catch (e) { lastError = `JSON parse error: ${e.message}`; continue; }

    return { ok: true, data };
  }

  return { ok: false, error: `API unavailable after ${MAX_ATTEMPTS} attempts. Last: ${lastError}` };
}


// ─────────────────────────────────────────────────────────────────────────────
// callAIWithRetry — backoff + reasoning-leak correction (3 prompt attempts)
// ─────────────────────────────────────────────────────────────────────────────

async function callAIWithRetry(apiKey, systemPrompt, history, task) {
  // Attempt 1 — normal call with prefilled <think> nudge (in callAI)
  const r1 = await callAIWithBackoff(apiKey, systemPrompt, history, task);
  if (!r1.ok) return { ok: false, error: r1.error };

  const raw1 = r1.data.choices?.[0]?.message?.content ?? "";
  const msg1 = stripReasoning(raw1);

  // Success path
  if (msg1 && !isReasoningLeak(msg1)) return { ok: true, message: msg1 };

  // Diagnose what went wrong
  const isBlank  = !msg1 || msg1.trim().length === 0;
  const isLeak   = !isBlank && isReasoningLeak(msg1);

  // Attempt 2 — targeted correction based on failure type
  const correctionMsg = isBlank
    ? "Your previous response was empty. You MUST output one of:\n" +
      "  <read_file path=\"...\"/>\n" +
      "  <fix path=\"...\">COMPLETE FILE CONTENT</fix>\n" +
      "Think carefully inside <think> first, then output the action tag. Do not leave the response empty."
    : "ERROR: You output reasoning text instead of an action tag.\n" +
      "Respond with ONLY one of:\n" +
      "  <read_file path=\"...\"/>\n" +
      "  <fix path=\"...\">COMPLETE FILE</fix>\n" +
      "Open a <think> block first to reason, then output the tag. Zero other text.";

  const r2 = await callAIWithBackoff(apiKey, systemPrompt, [
    ...history,
    { role: "user",      content: task },
    { role: "assistant", content: msg1 || raw1 || "(empty)" },
    { role: "user",      content: correctionMsg },
    // Re-open the think prefill so the model slows down again
    { role: "assistant", content: "<think>\nLet me think carefully this time and produce a complete, correct response." },
  ].slice(-16), "Output the correct action tag now with complete content.");

  if (r2.ok) {
    const raw2 = r2.data.choices?.[0]?.message?.content ?? "";
    const msg2 = stripReasoning(raw2);
    if (msg2 && !isReasoningLeak(msg2)) return { ok: true, message: msg2 };
  }

  // Attempt 3 — absolute minimal prompt, no history noise
  const r3 = await callAIWithBackoff(apiKey,
    `You are a code agent. Output ONLY one of these two things:\n` +
    `1. <read_file path="path/to/file" />\n` +
    `2. <fix path="path/to/file">COMPLETE FILE CONTENT</fix>\n` +
    `Think inside <think> first. Then output the tag. Nothing else.`,
    [
      { role: "assistant", content: "<think>\nI need to respond with exactly one action tag." },
    ],
    task
  );

  if (r3.ok) {
    const raw3 = r3.data.choices?.[0]?.message?.content ?? "";
    const msg3 = stripReasoning(raw3);
    if (msg3) return { ok: true, message: msg3 };
  }

  // Last resort — return whatever we got from attempt 1, even if imperfect
  return { ok: true, message: msg1 || raw1 };
}


// ─────────────────────────────────────────────────────────────────────────────
// Reasoning-leak detector
// ─────────────────────────────────────────────────────────────────────────────

function isReasoningLeak(text) {
  if (!text || text.length < 80) return false;
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<fix ") || trimmed.startsWith("<read_file ")) return false;

  const hasAction = /<fix\s+path=/i.test(text) || /<read_file\s+path=/i.test(text);
  if (text.length > 200 && !hasAction) {
    const hasPlan = /\b(We need|Let me|Let['']s|I need|I'll|First,|Looking at|Based on|We can|We'll|enhance|improvement|analyze|plan the)\b/i.test(text);
    if (hasPlan) return true;
    if (!/^```[\s\S]{50,}```$/.test(text.trim())) return true;
  }

  const leakPat = [
    /^We need to\b/im,  /^Let me\b/im,      /^Let['']s\b/im,
    /^I need to\b/im,   /^I'll\b/im,         /^First,\s+I\b/im,
    /^Now,?\s+(let's|we need|I need|I'll|let me)\b/im,
    /^We can\b/im,      /^We'll\b/im,        /^We should\b/im,
    /^Looking at\b/im,  /^Based on\b/im,
    /^Potential (enhancements|improvements|changes)\b/im,
    /^Here('s| are) (the|my|our) (plan|approach|changes|steps)\b/im,
    /^\d+\.\s+[A-Z]/m,  /\*\*[A-Z][^*]{3,}\*\*/,  /^###?\s+/m,
  ];

  return leakPat.filter(p => p.test(text)).length >= 2;
}


// ─────────────────────────────────────────────────────────────────────────────
// stripReasoning
// ─────────────────────────────────────────────────────────────────────────────

function stripReasoning(raw) {
  if (!raw) return "";

  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (out.includes("</think>")) out = out.split("</think>").pop();
  out = out.trim();

  const fi = out.indexOf("<fix ");
  const ri = out.indexOf("<read_file ");
  const candidates = [fi, ri].filter(i => i !== -1);
  if (candidates.length) {
    out = out.slice(Math.min(...candidates)).trim();
    const fm = out.match(/(<fix\s[^>]*>[\s\S]*?<\/fix>)/i);
    if (fm) return fm[1].trim();
    const rm = out.match(/(<read_file\s[^>]*\s*\/>)/i);
    if (rm) return rm[1].trim();
    return out;
  }

  const planRe = /^(We need|Let me|Let['']s|I need|I'll|First,|Looking at|Based on|We can|We'll|We should|Now,|Potential|Here's the|Here are|###|##|\d+\.)/i;
  const paras  = out.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  for (let i = 0; i < paras.length; i++) {
    if (!planRe.test(paras[i])) return paras.slice(i).join("\n\n").trim();
  }

  const lines = out.split("\n").map(l => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? "";
}


// ─────────────────────────────────────────────────────────────────────────────
// Misc helpers
// ─────────────────────────────────────────────────────────────────────────────

function stripFences(code) {
  let o = code.replace(/^```[a-zA-Z0-9_+\-.]*\r?\n?/m, "");
  o = o.replace(/\r?\n?```\s*$/m, "");
  o = o.replace(/```[a-zA-Z0-9_+\-.]*\r?\n?/g, "").replace(/```/g, "");
  return o.trim();
}

function ghHeaders(env) {
  return {
    "Authorization": `Bearer ${env.GITHUB_TOKEN.trim()}`,
    "User-Agent":    "Stremini-Agent-v2",
    "Accept":        "application/vnd.github.v3+json",
  };
}

function jsonError(message, status = 400, corsHeaders) {
  return new Response(
    JSON.stringify({ status: "ERROR", message }),
    { status, headers: corsHeaders }
  );
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function fetchFileContent(env, owner, repo, filePath) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
    { headers: ghHeaders(env) }
  );
  if (!res.ok) return `ERROR: Could not read '${filePath}' (status ${res.status})`;
  const data = await res.json();
  if (Array.isArray(data)) return `ERROR: '${filePath}' is a directory, not a file.`;
  if (!data.content)       return `ERROR: No content field for '${filePath}'.`;
  const raw   = atob(data.content.replace(/\s/g, ""));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}