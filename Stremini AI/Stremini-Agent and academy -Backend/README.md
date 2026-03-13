# Stremini — implement

# Stremini Academy (Learning & Research Mentor Agent)

## Files
- `index.js` (Backend Worker)
- `academy.html` (Frontend UI)

## Description
This is the flagship educational platform of the repository. It acts as a world‑class AI/ML educator and learning architect. The frontend provides a rich, interactive UI tracking 517 topics across 25 tracks (from Linear Algebra to LLM Fine‑Tuning). The backend dynamically generates personalized content based on the user's skill level and time commitment.

## Key Capabilities
- **Roadmaps:** Generates phase‑by‑phase personalized learning plans.
- **Interactive Lessons:** Breaks down complex concepts with analogies, math, and runnable Python code.
- **Project Guides:** Provides step‑by‑step instructions for building end‑to‑end ML projects.
- **Assessments:** Creates rigorous quizzes and coding challenges to test user knowledge.

# Business, Strategy & Marketing Agents

## 2. Startup Strategy Agent (`startup.js`)

### Description
An elite advisor for startup founders looking to raise capital and define their business.

### Key Capabilities
- Builds deep business models.
- Performs bottom‑up and top‑down market sizing (TAM/SAM/SOM).
- Generates revenue projections.
- Creates SWOT/TOWS matrices.
- Produces highly detailed pitch decks.

## 3. Growth & Marketing Intelligence Agent (`Growth.js`)

### Description
A Go‑To‑Market (GTM) and conversion rate optimization (CRO) strategist.

### Key Capabilities
- Defines Ideal Customer Profiles (ICP).
- Designs viral product‑led growth loops.
- Writes ad creative briefs.
- Plans SEO keyword strategies.
- Diagnoses funnel leaks to improve conversion rates.

## 4. Competitive Intelligence Agent (`compeititive.js`)

### Description
A strategic analyst that integrates with the Serper API for real‑time web and news search.

### Key Capabilities
- Monitors competitor product launches.
- Tracks hiring trends (to predict roadmap changes).
- Identifies market white‑space opportunities.
- Creates sales battlecards to defeat rivals.

# Engineering & Architecture Agents

## 5. Product Builder Agent (`productbuilder.js`)

### Description
An autonomous full‑stack product architect.

### Key Capabilities
- Takes a raw product idea and generates a complete MVP specification.
- Produces a Product Requirements Document (PRD).
- Provides full SQL database schemas.
- Generates working frontend code (React/HTML).
- Supplies step‑by‑step deployment guides.

## 6. Security & Scalability Agent (`Scalability.js`)

### Description
A principal engineer that acts as a combined penetration tester and distributed‑systems architect.

### Key Capabilities
- Analyzes raw codebases to find OWASP vulnerabilities (provides patched code snippets).
- Identifies scalability bottlenecks (e.g., N+1 queries, memory leaks).
- Generates architectural scaling roadmaps.

## 7. AI System Architect (`AI-architect.js`)

### Description
A specialized solutions architect for AI and data systems.

### Key Capabilities
- Maps end‑to‑end data flows.
- Designs system architectures.
- Deeply diagnoses Retrieval‑Augmented Generation (RAG) pipelines to fix bottlenecks in ingestion, chunking, retrieval, and generation.

# Data & AI Development Agents

## 8. Data & Decision Intelligence Agent (`data.js`)

### Description
A Chief Data Officer agent that interprets raw CSVs and business metrics.

### Key Capabilities
- Performs cohort and retention analysis.
- Detects data anomalies (with root cause trees).
- Builds scenario forecast models (bear/base/bull).
- Extracts insights from raw data dumps.

## 9. AI Model Evaluator (`model.js`)

### Description
An objective LLM judge and quality analyst.

### Key Capabilities
- Deeply evaluates AI‑generated text.
- Performs head‑to‑head comparisons of two models.
- Audits responses for hallucinations (flagging fabricated claims).
- Benchmarks the difficulty of prompts.

## 10. Dataset Builder Agent (`dataset.js`)

### Description
A synthetic machine learning dataset generator.

### Key Capabilities
- Automatically generates batches of high‑quality, diverse JSON training records for ML models.
- Writes complete HuggingFace‑style README dataset cards.

## 11. Knowledge Graph Agent (`knowledge.js`)

### Description
An epistemic agent that builds and traverses personal knowledge graphs.

### Key Capabilities
- Parses raw notes into structured nodes/edges.
- Finds semantic relationships between seemingly unrelated concepts.
- Identifies “knowledge gaps” in a user's understanding.
- Synthesizes novel ideas.

# Personal OS, Research & Specialized Agents

## 12. ARIA Personal OS (`Aria.js`)

### Description
An elite “second brain” and strategic thinking partner.

### Key Capabilities
- Acts as a hybrid founder/psychologist.
- Helps design habits, architect long‑term goals, reflect on difficult decisions.
- Builds strategic execution plans while referencing the user's stored memory.

## 13. Research & Math Agent (`Research.js`)

### Description
An elite academic research assistant and rigorous math professor.

### Key Capabilities
- Solves complex mathematical problems step‑by‑step (with proofs).
- Drafts full, publication‑quality academic papers featuring literature reviews, methodology sections, and embedded Mermaid diagrams (using real‑time search).

## 14. Financial Agent (`Fin.js`)

### Description
A personal finance advisor and transaction data analyst.

### Key Capabilities
- Ingests bank statement CSVs.
- Automatically categorizes spending (essential vs. discretionary).
- Detects unusual transactions.
- Assesses financial risk tolerance.
- Generates optimized budget plans.

## 15. Legal & Compliance Agent (`Legal.js`)

### Description
A specialized legal analyst for startups and freelancers.

### Key Capabilities
- Summarizes contracts into plain English.
- Flags dangerous “red flag” clauses.
- Audits Privacy Policies for GDPR/DPDP/CCPA compliance.
- Generates step‑by‑step company incorporation checklists for India, the UAE, and the US.

## 16. Concept Explainer & Visualizer (`concept.js`)

### Description
An educational visualizer agent.

### Key Capabilities
- Takes any complex concept and outputs structured JSON designed to be rendered as visual flowcharts, mindmaps, timelines, or comparison tables.
- Always accompanied by a relatable real‑world analogy.
# Stremini — implement

```markdown
# Agent Suite README

## Table of Contents
- [Core Model Architecture & Fallback Strategies](#1-core-model-architecture--fallback-strategies)
- [Handling "Chain-of-Thought" (CoT) and Reasoning](#2-handling-chain-of-thought-coT-and-reasoning)
- [Prompt Engineering & Deterministic Output](#3-prompt-engineering--deterministic-output)
- [Performance Optimization](#4-performance-optimization)
- [Security & Prompt Injection Defense](#5-security--prompt-injection-defense)
- [Retrieval-Augmented Generation (RAG) & Tooling](#6-retrieval-augmented-generation-rag--tooling)

## 1. Core Model Architecture & Fallback Strategies

### Primary and Fallback Models
- All agents are powered by the **MBZUAI K2-Think** models.
- Each agent first attempts to call **MBZUAI/K2-Think-v2**.
- If the request fails, times out, or returns an error, the system automatically falls back to **MBZUAI-IFM/K2-Think-v2**.
- This dual‑model approach provides high reliability without code changes.

### Serverless Edge Compute
- Agents are deployed as independent **Cloudflare Workers**.
- Benefits:
  - Low latency at the edge.
  - High concurrency without managing servers.
  - Pay‑per‑use billing.

## 2. Handling "Chain-of-Thought" (CoT) and Reasoning

### stripReasoning() function
- Every worker uses a dedicated regex to strip internal reasoning from the raw LLM output.
- Target patterns removed:
  - `\n?(\Think|... )...` (any `Think...` or `Answer...` sequences)
  - `<\analysis>.*?</\analysis>` tags
- The cleaned content is forwarded to the caller.

### Unclosed Tag Handling
- If the LLM reaches its token limit before closing a `<analysis>` tag, the parser truncates the reasoning segment.
- The parser then attempts to salvage any valid JSON or structural tags that were already emitted.
- This ensures downstream code receives a parsable response even when the model cuts off mid‑thought.

## 3. Prompt Engineering & Deterministic Output

### Strict XML/JSON Wrappers
- Prompts force the model to wrap its response in explicit tags, such as:
  - `<report>...</report>`
  - `<lesson>...</lesson>`
  - `<security_analysis>...</security_analysis>`
- Workers extract the inner payload with a regex like:
  ```js
  const match = output.match(/<(report|lesson|security_analysis)>([\s\S]*)<\/\1>/);
  const result = match ? match[2] : output;
  ```

### Anti‑Looping Directives
- For tasks prone to self‑correction loops (e.g., generating financial models), the prompt contains:
  ```
  CRITICAL: Output ONLY the JSON object. Do not verify fields after writing them. Write once, then stop.
  ```
- This directive stops the model from repeatedly rewriting its answer.

### Auto‑Repairing JSON
- Agents that return raw JSON arrays (e.g., Dataset Builder, Concept Explainer) may be truncated.
- `repairJSON()` counts unmatched brackets/braces and appends the missing characters to produce a valid JSON string.
- Example implementation:
  ```js
  function repairJSON(str) {
    const open = str.match(/[\{\[]+/g) || [];
    const close = str.match(/[\}\]]+/g) || [];
    const missingClose = open.length > close.length ? open.length - close.length : 0;
    const missingOpen = close.length > open.length ? close.length - open.length : 0;
    if (missingClose) {
      str += ']'.repeat(missingClose) + '}'.repeat(missingClose);
    }
    if (missingOpen) {
      str += '['.repeat(missingOpen) + '{'.repeat(missingOpen);
    }
    return str;
  }
  ```

## 4. Performance Optimization

### Parallel LLM Execution
- **Startup Agent** (`startup.js`) splits a large pitch‑deck generation prompt into two logical parts:
  1. Problem/Solution description.
  2. Financials/Team details.
- Both parts are sent to the LLM concurrently using `Promise.all()`.
- The two partial responses are merged into a single JSON object for downstream consumption.

### SHA‑256 LRU Caching
- **Academy Mentor Agent** (`index.js`) maintains an in‑memory Least Recently Used (LRU) cache.
- Cache key creation:
  ```js
  const cacheKey = crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(prompt + history + profile)
  );
  ```
- When a cached key is found, the stored response is returned instantly, saving API cost and latency.

## 5. Security & Prompt Injection Defense

### Payload Truncation
- All inbound payloads are limited to **1 MiB**.
- Prompt strings are forcibly sliced to fit safely within the model’s context window (e.g., code inputs truncated to **28 000** characters).

### Input Sanitization
- A strict regex `DANGEROUS_CHARS_RE` removes characters that could break out of the intended prompt namespace, such as:
  - `<system>`
  - `ignore`
  - Backticks `` ` ``
- Sanitized user profiles are used when constructing system prompts.

### AbortControllers
- Every outbound LLM request is wrapped in an `AbortController` with a **30‑second timeout**.
- If the provider hangs, the request is aborted and the fallback model is invoked.

## 6. Retrieval-Augmented Generation (RAG) & Tooling

### Live Search Injection
- **Competitive Intelligence** (`competitive.js`) and **Research** (`Research.js`) agents perform real‑time web searches via the **Serper API**.
- Example query construction:
  ```js
  const query = `${company} product launch 2025`;
  ```

### Context Assembly
- Results from live searches (news snippets, knowledge graphs, organic links) are:
  1. Deduplicated by URL.
  2. Injected into the LLM’s system prompt prior to generation.
- This gives the model up‑to‑date market data while preserving context integrity.

--- 

**License**: MIT  
**Author**: Your Name / Organization  

```
