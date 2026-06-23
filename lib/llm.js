// Camada de IA, agnóstica de provedor.
// Padrão: Anthropic (claude-sonnet-4-6). Trocável por env LLM_PROVIDER=openai.
// A chave NUNCA vai para o cliente — isto roda só no servidor (API routes).
//
// Defesas:
//  - System prompt isolado (mitiga prompt injection no user content).
//  - AbortController com timeout (default 15s).
//  - Retry com backoff exponencial em 429 / 5xx (3 tentativas).

import { logger } from "./logger.js";

const MAX_TOKENS = 1500;
// LLMs com max_tokens 1500 costumam responder em 8-25s. 15s era muito apertado
// — Sonnet 4.6 sob carga ou cold-start passa disso. Sobe pra 45s.
const TIMEOUT_MS = 45_000;
// 2 tentativas (em vez de 3) — se 45s nao deu, o problema nao e transitorio.
const MAX_RETRIES = 2;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldRetry(status) {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

async function fetchWithTimeout(url, init, timeoutMs = TIMEOUT_MS) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function callWithRetry(doFetch) {
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await doFetch();
      if (res.ok) return res;
      if (!shouldRetry(res.status) || attempt === MAX_RETRIES - 1) {
        return res;
      }
      const backoff = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      await sleep(backoff);
    } catch (e) {
      lastErr = e;
      if (attempt === MAX_RETRIES - 1) throw e;
      const backoff = 400 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      await sleep(backoff);
    }
  }
  throw lastErr || new Error("LLM: retries exauridos");
}

async function callAnthropic({ system, user }, meta) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Defina ANTHROPIC_API_KEY no arquivo .env");
  const model = process.env.LLM_MODEL || "claude-sonnet-4-6";
  const body = {
    model,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: user }],
  };
  if (system) body.system = system;
  const t0 = Date.now();
  const res = await callWithRetry(() =>
    fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    })
  );
  if (!res.ok) {
    const t = await res.text();
    // Log estruturado pro Sentry / agregador. Snippet limita PII vazado de
    // resposta de erro do provider (Anthropic raramente vaza, mas defesa em camadas).
    logger.error("llm.anthropic", "request failed", {
      status: res.status,
      route: meta?.route,
      model,
      snippet: t.slice(0, 160),
    });
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 240)}`);
  }
  const elapsedMs = Date.now() - t0;
  if (elapsedMs > 20_000) {
    logger.warn("llm.anthropic", "slow response", { elapsedMs, model, route: meta?.route });
  }
  const data = await res.json();
  logUsage({
    provider: "anthropic",
    model,
    inputTokens: data?.usage?.input_tokens ?? 0,
    outputTokens: data?.usage?.output_tokens ?? 0,
    latencyMs: Date.now() - t0,
    ...meta,
  });
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

async function callOpenAI({ system, user }, meta) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Defina OPENAI_API_KEY no arquivo .env");
  const model = process.env.LLM_MODEL || "gpt-4o";
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: user });
  const t0 = Date.now();
  const res = await callWithRetry(() =>
    fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: MAX_TOKENS, messages }),
    })
  );
  if (!res.ok) {
    const t = await res.text();
    logger.error("llm.openai", "request failed", {
      status: res.status,
      route: meta?.route,
      model,
      snippet: t.slice(0, 160),
    });
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  logUsage({
    provider: "openai",
    model,
    inputTokens: data?.usage?.prompt_tokens ?? 0,
    outputTokens: data?.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - t0,
    ...meta,
  });
  return data?.choices?.[0]?.message?.content || "";
}

// Custos em USD por 1M de tokens (Sonnet 4.6 / GPT-4o). Atualizar se mudar.
const PRICES = {
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
  "claude-opus-4-7": { in: 15.0, out: 75.0 },
  "claude-haiku-4-5-20251001": { in: 0.8, out: 4.0 },
  "gpt-4o": { in: 2.5, out: 10.0 },
};

function logUsage({ provider, model, inputTokens, outputTokens, latencyMs, route, userId }) {
  const p = PRICES[model];
  const costUsd = p
    ? +(((inputTokens * p.in) + (outputTokens * p.out)) / 1_000_000).toFixed(6)
    : null;
  // Log estruturado (1 linha JSON) — fácil de ingerir em Datadog/Loki/CloudWatch.
  console.log(JSON.stringify({
    evt: "llm.usage",
    ts: new Date().toISOString(),
    provider,
    model,
    route: route || "?",
    userId: userId || null,
    inputTokens,
    outputTokens,
    costUsd,
    latencyMs,
  }));
}

function parseJSON(text) {
  let s = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

// Aceita string (legado: vira user-only) OU { system, user }.
// `meta` opcional: { route, userId } — vai pro log de uso.
export async function completeJSON(input, meta = {}) {
  const payload = typeof input === "string" ? { user: input } : input;
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  const raw = provider === "openai"
    ? await callOpenAI(payload, meta)
    : await callAnthropic(payload, meta);
  return parseJSON(raw);
}
