/**
 * src/services/geminiService.ts
 * All AI calls routed through the Cloudflare Worker (K2-Think-v2).
 * Set VITE_WORKER_URL in .env.local and Vercel environment variables.
 */

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;

if (!WORKER_URL) {
  console.warn("VITE_WORKER_URL is not set. AI features will not work.");
}

// ─── AI Assistant ──────────────────────────────────────────────────────────────

export async function askAgriAgent(
  message: string,
  context?: string
): Promise<string> {
  const res = await fetch(`${WORKER_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Chat request failed");
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullText = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const delta: string = parsed.choices?.[0]?.delta?.content ?? "";
        if (delta) fullText += delta;
      } catch {
        // skip malformed SSE lines
      }
    }
  }

  return fullText;
}

// ─── Crop Disease Detection ────────────────────────────────────────────────────

export async function analyzeCropDisease(
  base64Image: string,
  mimeType: string
): Promise<string> {
  const res = await fetch(`${WORKER_URL}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image, mimeType }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Analysis request failed");
  }

  const data = await res.json();
  return data.result ?? "Could not analyze the image.";
}

// ─── Market Price Forecast ─────────────────────────────────────────────────────

export async function getMarketForecast(crop: string): Promise<{
  currentPrice: number;
  trend: "up" | "down" | "stable";
  forecast: { month: string; price: number }[];
  analysis: string;
} | null> {
  const res = await fetch(`${WORKER_URL}/api/market`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ crop }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Market forecast request failed");
  }

  return res.json();
}
