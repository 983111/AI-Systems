// ─────────────────────────────────────────────────────────────────────────────
// Stremini Financial Agent — Cloudflare Worker
// Deploy this as a Worker. Set these secrets via wrangler / dashboard:
//   K2THINK_API_KEY  — your K2Think / MBZUAI API key
// ─────────────────────────────────────────────────────────────────────────────

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
      return new Response(JSON.stringify({ status: "OK", message: "Stremini Financial Agent Worker is running." }), { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ status: "ERROR", message: "Method not allowed." }), { status: 405, headers: corsHeaders });
    }

    if (!env.K2THINK_API_KEY) {
      return new Response(JSON.stringify({ status: "ERROR", message: "Worker secret missing. Please set K2THINK_API_KEY." }), { status: 500, headers: corsHeaders });
    }

    try {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Invalid JSON body." }), { status: 400, headers: corsHeaders });
      }

      const {
        action,          // "initialize" | "chat"
        mode,            // "budget" | "generic"
        csvData,         // raw CSV text (sent on initialize)
        filename = "data.csv",
        message,         // user chat message
        history = [],    // conversation history array [{role, content}]
      } = body;

      if (!action) {
        return new Response(JSON.stringify({ status: "ERROR", message: "Missing 'action' field." }), { status: 400, headers: corsHeaders });
      }

      // ── ACTION: initialize ────────────────────────────────────────────────
      if (action === "initialize") {
        if (!csvData) {
          return new Response(JSON.stringify({ status: "ERROR", message: "Missing csvData." }), { status: 400, headers: corsHeaders });
        }

        const rows = parseCSV(csvData);
        if (rows.length === 0) {
          return new Response(JSON.stringify({ status: "ERROR", message: "CSV appears empty or unparseable." }), { status: 400, headers: corsHeaders });
        }

        const limited = rows.slice(0, 300);

        let systemPrompt, contextMsg, summary;

        if (mode === "budget") {
          const analysis = analyzeTransactions(limited);
          summary = buildSummary(analysis);
          systemPrompt = buildBudgetSystemPrompt();
          contextMsg = buildBudgetContextMsg(analysis, filename);
        } else {
          summary = { mode: "generic", rows: limited.length, filename };
          systemPrompt = buildGenericSystemPrompt();
          const headers = Object.keys(limited[0] || {}).join(",");
          const csvString = limited.map(r => Object.values(r).join(",")).join("\n");
          contextMsg = `The user uploaded a dataset: '${filename}' (${limited.length} rows).\n\nDATA:\n${headers}\n${csvString}\n\nBe ready to answer any analytical or financial questions about this dataset.`;
        }

        // Build initial conversation
        const initialHistory = [
          { role: "system", content: systemPrompt },
          { role: "user", content: contextMsg },
          { role: "assistant", content: `I've analyzed '${filename}' (${limited.length} rows loaded). ${mode === "budget" ? "I can see your income, expenses, and spending patterns. " : ""}What would you like to know?` },
        ];

        return new Response(JSON.stringify({
          status: "INITIALIZED",
          history: initialHistory,
          summary,
          rowsLoaded: limited.length,
          filename,
        }), { headers: corsHeaders });
      }

      // ── ACTION: chat ──────────────────────────────────────────────────────
      if (action === "chat") {
        if (!message) {
          return new Response(JSON.stringify({ status: "ERROR", message: "Missing 'message' field." }), { status: 400, headers: corsHeaders });
        }
        if (!history.length) {
          return new Response(JSON.stringify({ status: "ERROR", message: "No conversation history. Please initialize first." }), { status: 400, headers: corsHeaders });
        }

        // Append new user message
        const messages = [...history.slice(-20), { role: "user", content: message }];

        const aiResponse = await callAI(env.K2THINK_API_KEY, messages);

        if (!aiResponse.ok) {
          const errBody = await aiResponse.text();
          return new Response(JSON.stringify({
            status: "ERROR",
            message: `AI API error (${aiResponse.status}): ${errBody}`,
          }), { headers: corsHeaders });
        }

        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content ?? "";
        const cleanContent = sanitizeResponse(rawContent);

        if (!cleanContent) {
          return new Response(JSON.stringify({ status: "ERROR", message: "AI returned empty response." }), { headers: corsHeaders });
        }

        // Return the reply plus the updated history so frontend stays in sync
        const updatedHistory = [...messages, { role: "assistant", content: cleanContent }];

        return new Response(JSON.stringify({
          status: "REPLY",
          reply: cleanContent,
          history: updatedHistory,
        }), { headers: corsHeaders });
      }

      return new Response(JSON.stringify({ status: "ERROR", message: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders });

    } catch (err) {
      return new Response(JSON.stringify({
        status: "ERROR",
        message: `Worker exception: ${err.message ?? String(err)}`,
      }), { status: 500, headers: corsHeaders });
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AI call — primary model with fallback (mirrors index.js pattern)
// ─────────────────────────────────────────────────────────────────────────────
async function callAI(apiKey, messages) {
  const url = "https://api.k2think.ai/v1/chat/completions";
  const headers = {
    "Authorization": `Bearer ${apiKey.trim()}`,
    "Content-Type": "application/json",
  };

  const makeBody = (model) => JSON.stringify({
    model,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  });

  let res = await fetch(url, { method: "POST", headers, body: makeBody("MBZUAI/K2-Think-v2") });

  // Fallback to IFM variant if primary fails
  if (!res.ok) {
    res = await fetch(url, { method: "POST", headers, body: makeBody("MBZUAI-IFM/K2-Think-v2") });
  }

  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// Strip reasoning/thinking tokens from model output (same as index.js)
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeResponse(text) {
  let out = text || "";

  // Remove <think>...</think> blocks
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, "");
  out = out.replace(/<analysis>[\s\S]*?<\/analysis>/gi, "");

  // Strip everything before orphaned closing tags
  for (const tag of ["</think>", "</analysis>"]) {
    if (out.toLowerCase().includes(tag)) {
      const idx = out.toLowerCase().lastIndexOf(tag);
      out = out.slice(idx + tag.length);
    }
  }

  // Remove reasoning header lines
  const blockedPrefixes = ["reasoning:", "chain-of-thought:", "analysis:", "thought process:", "internal reasoning:"];
  out = out.split("\n")
    .filter(line => !blockedPrefixes.some(p => line.trim().toLowerCase().startsWith(p)))
    .join("\n");

  // Remove planner leakage
  out = out.replace(/(?:now produce final answer\.?|proceed\.?|final answer:)\s*/gi, "");

  return out.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV Parser
// ─────────────────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCSVLine(lines[0]).map(h => h.trim().replace(/"/g, ""));

  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || "").trim().replace(/"/g, ""); });
    return obj;
  }).filter(r => Object.values(r).some(v => v !== ""));
}

function splitCSVLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { result.push(cur); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transaction Analysis — mirrors Python src/analyzer.py + src/profile_builder.py
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_KEYWORDS = {
  food_dining:    ["restaurant","cafe","food","pizza","burger","dining","zomato","swiggy","uber eats","mcdonald","subway","kfc","dominos","starbucks","cafe coffee"],
  groceries:      ["supermarket","grocery","walmart","target","costco","big bazaar","dmart","reliance fresh","market"],
  transportation: ["uber","lyft","taxi","gas","fuel","metro","train","ola","rapido","petrol","parking","toll","metro card"],
  utilities:      ["electricity","water","gas bill","internet","phone","mobile recharge","broadband","wifi","jio","airtel","recharge"],
  entertainment:  ["movie","netflix","spotify","prime","theater","concert","game","xbox","playstation","hotstar","pvr","cinema","spotify","amazon prime"],
  shopping:       ["amazon","flipkart","myntra","mall","clothing","shoes","fashion"],
  healthcare:     ["hospital","doctor","pharmacy","medical","clinic","medicine","health","dental","apollo","max healthcare"],
  education:      ["school","college","university","course","books","tuition","fees","udemy","coursera"],
  housing:        ["rent","mortgage","maintenance","repairs","furniture","apartment","society"],
  insurance:      ["insurance","premium","lic","policy"],
  investment:     ["mutual fund","stock","bond","sip","investment","zerodha","groww","upstox"],
  salary:         ["salary","wages","payroll","income","bonus","freelance"],
  transfer:       ["transfer","sent to","received from","upi","neft","imps"],
};

const ESSENTIAL_CATS     = new Set(["housing","utilities","groceries","healthcare","insurance","transportation","education"]);
const DISCRETIONARY_CATS = new Set(["food_dining","entertainment","shopping","others"]);

function categorize(desc) {
  const d = (desc || "").toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of kws) {
      if (d.includes(kw)) return cat;
    }
  }
  return "others";
}

function cleanAmount(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const s = String(val).replace(/[₹$£€,\s]/g, "");
  if (s.includes("(") || s.endsWith("-")) return -Math.abs(parseFloat(s.replace(/[()]/g, "")) || 0);
  return parseFloat(s) || 0;
}

function analyzeTransactions(rows) {
  // Auto-detect column names
  const keys = Object.keys(rows[0] || {});
  const find = (patterns) => keys.find(k => patterns.some(p => new RegExp(p, "i").test(k))) || keys[0];

  const dateCol = find(["date","time","when"]);
  const descCol = find(["desc","narrat","detail","name","particular","remark"]);
  const amtCol  = find(["amount","amt","value","debit","credit","sum"]);
  const typeCol = find(["type","cr.?dr|direction"]);

  // Parse all transactions
  const txns = rows.map(r => {
    const rawAmt = cleanAmount(r[amtCol]);
    let type = "debit";
    if (typeCol && r[typeCol]) {
      const t = String(r[typeCol]).toLowerCase().trim();
      type = (t === "credit" || t === "cr" || t === "c" || t === "in") ? "credit" : "debit";
    } else {
      type = rawAmt >= 0 ? "credit" : "debit";
    }
    const amount = Math.abs(rawAmt);
    const desc = (r[descCol] || "").trim();
    return { date: r[dateCol] || "", desc, amount, type, category: categorize(desc) };
  });

  // Split credits / debits
  const credits = txns.filter(t => t.type === "credit");
  const debits  = txns.filter(t => t.type === "debit");

  // Monthly grouping
  const byMonth = {};
  txns.forEach(t => {
    const m = String(t.date).slice(0, 7) || "unknown";
    if (!byMonth[m]) byMonth[m] = { income: 0, expenses: 0 };
    if (t.type === "credit") byMonth[m].income   += t.amount;
    else                     byMonth[m].expenses += t.amount;
  });

  const months   = Object.keys(byMonth);
  const nMonths  = Math.max(1, months.length);
  const totalIn  = credits.reduce((s, t) => s + t.amount, 0);
  const totalOut = debits.reduce((s, t) => s + t.amount, 0);
  const monthlyIncome   = totalIn  / nMonths;
  const monthlyExpenses = totalOut / nMonths;

  // Income stability (inverse of CV)
  const incomeVals = months.map(m => byMonth[m].income).filter(v => v > 0);
  let stability = 0.5;
  if (incomeVals.length > 1) {
    const mean = incomeVals.reduce((a, b) => a + b, 0) / incomeVals.length;
    const std  = Math.sqrt(incomeVals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / incomeVals.length);
    stability  = mean > 0 ? Math.max(0, 1 - std / mean) : 0.5;
  }

  // Category spending
  const byCat = {};
  debits.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });

  const essentialTotal     = Object.entries(byCat).filter(([c]) => ESSENTIAL_CATS.has(c)).reduce((s, [, v]) => s + v, 0);
  const discretionaryTotal = Object.entries(byCat).filter(([c]) => DISCRETIONARY_CATS.has(c)).reduce((s, [, v]) => s + v, 0);

  // Monthly debt payments (EMI/loan keywords)
  const debtKws = ["emi","loan","credit card","installment"];
  const debtPmt = debits.filter(t => debtKws.some(k => t.desc.toLowerCase().includes(k))).reduce((s, t) => s + t.amount, 0) / nMonths;

  // Spending volatility
  const expVals = months.map(m => byMonth[m].expenses).filter(v => v > 0);
  let volatility = 0;
  if (expVals.length > 1) {
    const mean = expVals.reduce((a, b) => a + b, 0) / expVals.length;
    const std  = Math.sqrt(expVals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / expVals.length);
    volatility = mean > 0 ? std / mean : 0;
  }

  // Risk tolerance (mirrors Python profile_builder.py)
  const discRatio = monthlyExpenses > 0 ? discretionaryTotal / (totalOut || 1) : 0;
  const riskTolerance = volatility < 0.2 && discRatio < 0.3 ? "low"
    : (volatility > 0.4 || discRatio > 0.5) ? "high" : "medium";

  const savings     = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (savings / monthlyIncome) * 100 : 0;
  const emergencyFundMonths = monthlyExpenses > 0 ? (savings * 3) / monthlyExpenses : 0; // rough estimate

  // Top spending categories
  const topSpending = Object.entries(byCat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([cat, total]) => ({
      category: cat,
      total,
      count: debits.filter(t => t.category === cat).length,
      avg: total / Math.max(1, debits.filter(t => t.category === cat).length),
    }));

  // Anomaly detection: Z-score per category (mirrors Python analyzer.py)
  const anomalies = [];
  for (const cat of Object.keys(byCat)) {
    const catTxns = debits.filter(t => t.category === cat);
    if (catTxns.length < 3) continue;
    const amounts  = catTxns.map(t => t.amount);
    const mean     = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const std      = Math.sqrt(amounts.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / amounts.length);
    if (std === 0) continue;
    catTxns.forEach(t => {
      const z = Math.abs((t.amount - mean) / std);
      if (z > 2.5) anomalies.push({ ...t, zScore: z });
    });
  }

  // Recurring transactions (mirrors Python analyze_recurring)
  const descGroups = {};
  txns.forEach(t => {
    const key = t.desc.toLowerCase().trim();
    if (!descGroups[key]) descGroups[key] = [];
    descGroups[key].push(t);
  });
  const recurring = Object.entries(descGroups)
    .filter(([, g]) => g.length >= 2)
    .filter(([, g]) => {
      const amounts = g.map(t => t.amount);
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const std  = Math.sqrt(amounts.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / amounts.length);
      return mean > 0 && std / mean < 0.1;
    })
    .map(([desc, g]) => ({
      desc,
      category: g[0].category,
      amount: g.reduce((s, t) => s + t.amount, 0) / g.length,
      count: g.length,
    }));

  // Human insights (mirrors Python generate_insights)
  const insights = [];
  if (topSpending.length) {
    const top = topSpending[0];
    insights.push(`Highest spend: ${top.category} at ₹${top.total.toFixed(0)} (${top.count} transactions)`);
  }
  if (savingsRate >= 20) insights.push(`Great savings rate of ${savingsRate.toFixed(1)}%`);
  else if (savingsRate > 0) insights.push(`Savings rate is ${savingsRate.toFixed(1)}% — aim for 20%+`);
  else insights.push("Warning: Spending exceeds income in this period");
  if (recurring.length >= 2) {
    const recTotal = recurring.reduce((s, r) => s + r.amount, 0);
    insights.push(`${recurring.length} recurring charges totalling ₹${recTotal.toFixed(0)}/period`);
  }
  if (volatility > 0.3) insights.push("High spending volatility — budgeting could help stabilise expenses");
  if (anomalies.length) insights.push(`${anomalies.length} unusual transactions detected`);

  const profile = {
    monthly_income:        monthlyIncome,
    income_stability:      stability,
    monthly_expenses:      monthlyExpenses,
    expense_categories:    byCat,
    essential_expenses:    essentialTotal / nMonths,
    discretionary_expenses: discretionaryTotal / nMonths,
    monthly_savings:       savings,
    savings_rate:          savingsRate,
    emergency_fund_months: emergencyFundMonths,
    total_debt:            0,
    monthly_debt_payment:  debtPmt,
    debt_to_income_ratio:  monthlyIncome > 0 ? debtPmt / monthlyIncome : 0,
    spending_volatility:   volatility,
    risk_tolerance:        riskTolerance,
  };

  const patterns = {
    total_income:   totalIn,
    total_expenses: totalOut,
    net_savings:    totalIn - totalOut,
    top_spending:   topSpending,
    by_category:    byCat,
    insights,
    recurring,
    anomalies: anomalies.slice(0, 5),
    months_analyzed: nMonths,
  };

  return { profile, patterns };
}

function buildSummary(analysis) {
  const p = analysis.profile;
  const pat = analysis.patterns;
  return {
    mode: "budget",
    monthly_income:   +p.monthly_income.toFixed(2),
    monthly_expenses: +p.monthly_expenses.toFixed(2),
    monthly_savings:  +p.monthly_savings.toFixed(2),
    savings_rate:     +p.savings_rate.toFixed(1),
    emergency_fund_months: +p.emergency_fund_months.toFixed(1),
    top_category:     pat.top_spending[0]?.category || "N/A",
    insights:         pat.insights,
    risk_tolerance:   p.risk_tolerance,
    anomaly_count:    pat.anomalies.length,
    recurring_count:  pat.recurring.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget Optimizer — mirrors Python src/optimizer.py (fallback strategy)
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONSTRAINTS = {
  housing:        { min: 0.20, max: 0.35, recommended: 0.30 },
  groceries:      { min: 0.10, max: 0.20, recommended: 0.15 },
  transportation: { min: 0.05, max: 0.15, recommended: 0.10 },
  utilities:      { min: 0.05, max: 0.10, recommended: 0.08 },
  healthcare:     { min: 0.05, max: 0.15, recommended: 0.10 },
  food_dining:    { min: 0.00, max: 0.10, recommended: 0.05 },
  entertainment:  { min: 0.00, max: 0.08, recommended: 0.05 },
  shopping:       { min: 0.00, max: 0.10, recommended: 0.05 },
  education:      { min: 0.00, max: 0.15, recommended: 0.10 },
  insurance:      { min: 0.05, max: 0.10, recommended: 0.08 },
  investment:     { min: 0.00, max: 0.30, recommended: 0.15 },
  others:         { min: 0.00, max: 0.10, recommended: 0.05 },
};

// Included in context so the AI can reference it
function buildOptimizedBudget(income, currentSpending, savingsGoalPct = 20) {
  const savingsTarget = income * (savingsGoalPct / 100);
  const targetBudget  = income - savingsTarget;
  const cats          = Object.keys(DEFAULT_CONSTRAINTS);
  const allocations   = {};

  cats.forEach(cat => {
    const c   = DEFAULT_CONSTRAINTS[cat];
    const cur = currentSpending[cat] || 0;
    const min = income * c.min;
    const max = income * c.max;
    const rec = income * c.recommended;
    // Blend current with recommended, clamped to constraints
    const raw = cur > 0 ? (cur + rec) / 2 : rec;
    allocations[cat] = Math.max(min, Math.min(max, raw));
  });

  // Scale to fit target budget
  const total = Object.values(allocations).reduce((s, v) => s + v, 0);
  if (total > 0) {
    const scale = Math.min(1, targetBudget / total);
    cats.forEach(cat => { allocations[cat] = +(allocations[cat] * scale).toFixed(2); });
  }

  return {
    category_allocations: allocations,
    total_budget:    +Object.values(allocations).reduce((s, v) => s + v, 0).toFixed(2),
    savings_target:  +savingsTarget.toFixed(2),
    expected_savings: +(income - Object.values(allocations).reduce((s, v) => s + v, 0)).toFixed(2),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// System Prompts
// ─────────────────────────────────────────────────────────────────────────────
function buildBudgetSystemPrompt() {
  return `You are Stremini, an expert AI financial advisor. Your role is to:
1. Analyse users' financial situation objectively using their transaction data
2. Provide personalised, actionable recommendations with specific rupee/dollar amounts
3. Return only the final user-facing answer — never expose reasoning or chain-of-thought
4. Help users understand financial concepts and simulate scenarios
5. Be clear, concise, evidence-based, supportive, and focused on long-term health

Response rules:
- Use ₹ for Indian currency amounts unless the data suggests otherwise
- Always reference the actual numbers from the user's data
- When making recommendations, explain WHY with calculations
- Format responses readably — use short paragraphs or bullet points as appropriate
- Strip any internal reasoning; output only the polished final answer`;
}

function buildGenericSystemPrompt() {
  return `You are Stremini, an expert data analyst and financial advisor AI. Your role is to:
1. Analyse any CSV data the user provides
2. Answer questions about the dataset accurately with specific figures
3. Surface insights, trends, anomalies, and summaries
4. Be concise, precise, and direct — no internal reasoning in output

Use appropriate currency symbols if the data is financial. Format responses clearly.`;
}

function buildBudgetContextMsg(analysis, filename) {
  const p   = analysis.profile;
  const pat = analysis.patterns;
  const budget = buildOptimizedBudget(p.monthly_income, p.expense_categories, 20);

  return `=== USER FINANCIAL DATA (from: ${filename}) ===

INCOME
  Monthly income:   ₹${p.monthly_income.toFixed(2)}
  Income stability: ${(p.income_stability * 100).toFixed(0)}%

EXPENSES
  Monthly expenses:      ₹${p.monthly_expenses.toFixed(2)}
  Essential expenses:    ₹${p.essential_expenses.toFixed(2)}
  Discretionary expenses:₹${p.discretionary_expenses.toFixed(2)}
  By category:
${Object.entries(p.expense_categories).map(([k, v]) => `    ${k}: ₹${v.toFixed(2)}`).join("\n")}

SAVINGS
  Monthly savings:   ₹${p.monthly_savings.toFixed(2)}
  Savings rate:      ${p.savings_rate.toFixed(1)}%
  Emergency fund coverage: ~${p.emergency_fund_months.toFixed(1)} months

DEBT
  Monthly debt payment: ₹${p.monthly_debt_payment.toFixed(2)}
  Debt-to-income ratio: ${(p.debt_to_income_ratio * 100).toFixed(1)}%

RISK PROFILE
  Risk tolerance:       ${p.risk_tolerance}
  Spending volatility:  ${(p.spending_volatility * 100).toFixed(1)}%

ANALYSIS PERIOD: ${pat.months_analyzed} month(s)
  Total income:   ₹${pat.total_income.toFixed(2)}
  Total expenses: ₹${pat.total_expenses.toFixed(2)}
  Net savings:    ₹${pat.net_savings.toFixed(2)}

TOP SPENDING CATEGORIES:
${pat.top_spending.slice(0, 5).map(s => `  ${s.category}: ₹${s.total.toFixed(2)} (${s.count} txns, avg ₹${s.avg.toFixed(2)})`).join("\n")}

RECURRING PAYMENTS (${pat.recurring.length} detected):
${pat.recurring.slice(0, 5).map(r => `  ${r.desc}: ₹${r.amount.toFixed(2)} × ${r.count}`).join("\n") || "  None detected"}

UNUSUAL TRANSACTIONS (${pat.anomalies.length} flagged):
${pat.anomalies.map(a => `  ${a.desc}: ₹${a.amount.toFixed(2)} (z=${a.zScore.toFixed(1)})`).join("\n") || "  None"}

INSIGHTS:
${pat.insights.map(i => `  • ${i}`).join("\n")}

OPTIMISED BUDGET PLAN (20% savings goal):
  Savings target:    ₹${budget.savings_target.toFixed(2)}/month
  Expected savings:  ₹${budget.expected_savings.toFixed(2)}/month
  Total budget:      ₹${budget.total_budget.toFixed(2)}/month
${Object.entries(budget.category_allocations).map(([k, v]) => `  ${k}: ₹${v.toFixed(2)}`).join("\n")}

I am ready to answer financial planning questions based on this data.`;
}