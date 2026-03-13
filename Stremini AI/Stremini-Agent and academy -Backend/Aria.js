export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS")
      return new Response(null, { headers: corsHeaders });

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({ status: "OK", message: "ARIA Personal OS Worker running." }),
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
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Invalid JSON body." }),
          { status: 400, headers: corsHeaders }
        );
      }

      const { query, mode = "chat", history = [], memory = {}, context = {} } = body;

      if (!query) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Missing query." }),
          { status: 400, headers: corsHeaders }
        );
      }

      if (!env.MBZUAI_API_KEY) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Missing MBZUAI_API_KEY secret." }),
          { status: 500, headers: corsHeaders }
        );
      }

      const trimmedHistory = history.slice(-12);
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

      const memoryBlock = buildMemoryBlock(memory, context);
      const systemPrompt = buildSystemPrompt(mode, today, memoryBlock);

      const aiResponse = await callAI(env.MBZUAI_API_KEY, systemPrompt, trimmedHistory, query);

      if (!aiResponse.ok) {
        const err = await aiResponse.text();
        return new Response(
          JSON.stringify({ status: "ERROR", message: `AI error ${aiResponse.status}: ${err}` }),
          { headers: corsHeaders }
        );
      }

      const aiData = await aiResponse.json();
      const rawMessage = aiData.choices?.[0]?.message?.content ?? "";
      const aiMessage = stripReasoning(rawMessage);

      if (!aiMessage) {
        return new Response(
          JSON.stringify({ status: "ERROR", message: "Empty AI response." }),
          { headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ status: "COMPLETED", mode, content: aiMessage.trim() }),
        { headers: corsHeaders }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ status: "ERROR", message: err.message ?? String(err) }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};


// ─────────────────────────────────────────
// SYSTEM PROMPT BUILDER
// ─────────────────────────────────────────

function buildSystemPrompt(mode, today, memoryBlock) {
  const baseIdentity = `You are ARIA — an elite second brain and strategic thinking partner.
Today is ${today}.

${memoryBlock}

PERSONALITY:
- Direct, sharp, warm. Think founder + psychologist hybrid.
- No fluff. No filler. No academic tone.
- Match depth to question size.
- Be conversational but intelligent.

OUTPUT FORMAT RULES — CRITICAL:
- Always respond using clean markdown with ## headers for each section.
- Every section MUST have a ## header on its own line.
- Under each header, write content as prose paragraphs OR bullet lists (- item).
- Use **bold** for key terms, numbers, or emphasis within paragraphs.
- For lists, always use "- " prefix on each item.
- For numbered steps, always use "1. " "2. " etc.
- Never output raw walls of text without any headers.
- Never skip the structured format even for short answers.
`;

  const modes = {
    chat: `MODE: General Conversation
REQUIRED SECTIONS — output EXACTLY these ## headers in order:
## Quick Answer
(2-3 sentences directly answering the question)

## Why This Matters
(1-2 paragraphs on the deeper significance or context)

## What To Do
(3-5 bullet points of concrete actions)

## Watch Out For
(2-3 bullet points of pitfalls or risks)

## Next Step
(One bold, time-bound action — e.g., "**This week:** Do X by Friday")
`,

    goals: `MODE: Goal Architecture
REQUIRED SECTIONS — output EXACTLY these ## headers in order:
## Goal Statement
(Reframe their goal as a sharp, specific, measurable statement)

## Why This Goal Matters
(The deeper motivation — connect to identity/values)

## Success Metrics
(3-5 bullets: specific, measurable KPIs to track progress)

## 90-Day Milestones
(3 milestones as numbered steps with dates/timeframes)

## Immediate Actions
(The first 3 things to do THIS WEEK — numbered list)

## Risks & Obstacles
(2-3 bullets of likely blockers and how to pre-empt them)
`,

    habits: `MODE: Habit Design
REQUIRED SECTIONS — output EXACTLY these ## headers in order:
## Habit Blueprint
(Clear name + one-line description of the habit)

## The Habit Loop
(Explain Cue → Routine → Reward in 3 bullet points)

## Implementation Intention
(The exact "When X happens, I will do Y" trigger statement)

## Daily Tracking System
(Simple system to track streaks — what to measure, how)

## Minimum Viable Version
(The smallest version of this habit for hard days)

## Failure Recovery Plan
(What to do when you miss a day — concrete protocol)
`,

    reflect: `MODE: Reflection & Decision
REQUIRED SECTIONS — output EXACTLY these ## headers in order:
## Situation Snapshot
(Neutral, clear summary of what's really happening)

## What's Actually At Stake
(The real tensions, values, or fears underneath the surface)

## Your Options
(2-4 options as a numbered list, each with a one-line pro and con)

## What The Data Says
(Logical analysis — what do facts, patterns, and evidence suggest)

## Gut Check
(What your instincts are likely telling you, and whether to trust them)

## Recommended Decision
(**Bold recommendation** + 2-3 sentence reasoning)

## The Uncomfortable Question
(One powerful question to sit with before deciding)
`,

    plan: `MODE: Strategic Execution Plan
REQUIRED SECTIONS — output EXACTLY these ## headers in order:
## Objective
(The clear, specific goal this plan achieves)

## Phase Breakdown
(3-4 phases as numbered items with timeframes and key outputs)

## Priority Sequence
(What to do first, second, third — and WHY that order)

## Next 7 Days
(Day-by-day or grouped tasks for the first week — numbered list)

## Resources Needed
(People, tools, money, time — bullet list)

## Risks & Contingencies
(Top 3 risks and what to do if they materialize)
`,

    memory: `MODE: Memory & Pattern Recognition
REQUIRED SECTIONS — output EXACTLY these ## headers in order:
## What I Found
(Summarize relevant stored memory that matches the query)

## Patterns I See
(3-5 bullets on themes, tendencies, or patterns across their data)

## Connections
(How goals, habits, and decisions relate to each other)

## Suggested Updates
(What memory entries to add, remove, or update — bullet list)

## Reflection Prompt
(One question to deepen self-awareness based on the patterns)
`,
  };

  return baseIdentity + "\n\n" + (modes[mode] || modes.chat);
}


// ─────────────────────────────────────────
// MEMORY CONTEXT BUILDER
// ─────────────────────────────────────────

function buildMemoryBlock(memory, context) {
  const lines = [];
  lines.push("── USER MEMORY ──");

  if (memory.goals?.length) {
    lines.push("\nActive Goals:");
    memory.goals.forEach((g, i) => lines.push(`${i + 1}. ${g}`));
  }
  if (memory.habits?.length) {
    lines.push("\nTracked Habits:");
    memory.habits.forEach((h, i) => lines.push(`${i + 1}. ${h}`));
  }
  if (memory.decisions?.length) {
    lines.push("\nRecent Decisions:");
    memory.decisions.slice(-5).forEach((d, i) => lines.push(`${i + 1}. ${d}`));
  }
  if (memory.insights?.length) {
    lines.push("\nStored Insights:");
    memory.insights.slice(-5).forEach((ins, i) => lines.push(`${i + 1}. ${ins}`));
  }
  if (context.currentGoals?.length) {
    lines.push(`\nCurrent Focus Areas: ${context.currentGoals.join(", ")}`);
  }
  if (context.pendingDecisions?.length) {
    lines.push(`\nPending Decisions: ${context.pendingDecisions.join(", ")}`);
  }
  if (context.recentHabits?.length) {
    lines.push(`\nRecent Habit Log: ${context.recentHabits.join(", ")}`);
  }
  if (lines.length === 1) lines.push("No stored memory yet.");
  lines.push("\n── END MEMORY ──");
  return lines.join("\n");
}


// ─────────────────────────────────────────
// STRIP INTERNAL REASONING
// ─────────────────────────────────────────

function stripReasoning(raw) {
  let out = raw.replace(/<think>[\s\S]*?<\/think>/gi, "");
  if (out.includes("</think>")) out = out.split("</think>").pop();
  return out.trim();
}


// ─────────────────────────────────────────
// CALL MBZUAI API
// ─────────────────────────────────────────

async function callAI(apiKey, systemPrompt, history, userQuery) {
  const url = "https://api.k2think.ai/v1/chat/completions";
  const headers = {
    Authorization: `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };
  const basePayload = {
    model: "MBZUAI/K2-Think-v2",
    messages: [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userQuery },
    ],
    temperature: 0.6,
    max_tokens: 4096,
  };

  let res = await fetch(url, { method: "POST", headers, body: JSON.stringify(basePayload) });

  if (!res.ok) {
    const fallbackPayload = { ...basePayload, model: "MBZUAI-IFM/K2-Think-v2" };
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(fallbackPayload) });
  }
  return res;
}