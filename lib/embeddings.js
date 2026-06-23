// lib/embeddings.js
// Camada de embeddings agnostica de provedor.
// Padrao: Voyage AI (voyage-3, 1024 dim, $0.06/1M tokens — Anthropic-recommended).
// Fallback: OpenAI text-embedding-3-small (1536 dim nativo, truncado pra 1024
// via parametro `dimensions` pra casar com o schema da KnowledgeChunk).
//
// Politica: se VOYAGE_API_KEY existe, tenta primeiro; em caso de erro, cai pra
// OpenAI (se OPENAI_API_KEY existe). Se nem um nem outro, lanca erro claro —
// callers (retrieval.js, ingest script) tem que tratar.
//
// Seguranca: a chave so existe no server (sem NEXT_PUBLIC_). Timeout duro
// (8s) evita travar request inteiro do CareerTwin por uma chamada lenta.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3"; // 1024 dims
const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const OPENAI_MODEL = "text-embedding-3-small"; // 1536 dims nativos; truncamos via `dimensions`

const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url, init, timeoutMs = TIMEOUT_MS) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function embedVoyage(texts, inputType = "document") {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) return null;
  const res = await fetchWithTimeout(VOYAGE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      input: Array.isArray(texts) ? texts : [texts],
      model: VOYAGE_MODEL,
      // "document" pra indexar a base, "query" pra busca — Voyage otimiza
      // diferente nos dois lados (assimetria).
      input_type: inputType,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Voyage ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.data || []).map((d) => d.embedding);
}

async function embedOpenAI(texts) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetchWithTimeout(OPENAI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      input: Array.isArray(texts) ? texts : [texts],
      model: OPENAI_MODEL,
      // Trunca de 1536 pra 1024 pra casar com o schema vector(1024). OpenAI
      // suporta isso desde dezembro/2024 (Matryoshka representation).
      dimensions: 1024,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`OpenAI emb ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.data || []).map((d) => d.embedding);
}

/**
 * Embed lista de textos. Retorna Array<number[]> com vetores 1024-dim.
 * Tenta Voyage; em erro, tenta OpenAI; se ambos falharem, throw.
 *
 * @param {string[]} texts - textos a embedar (max 128 por batch no Voyage)
 * @param {Object} [opts]
 * @param {"document"|"query"} [opts.inputType="document"] - so afeta Voyage
 */
export async function embedTexts(texts, { inputType = "document" } = {}) {
  if (!Array.isArray(texts) || texts.length === 0) return [];
  if (process.env.VOYAGE_API_KEY) {
    try {
      const r = await embedVoyage(texts, inputType);
      if (r) return r;
    } catch (e) {
      // Log so a mensagem; corpo do erro pode conter trecho do payload.
      console.error("voyage embed falhou, tentando OpenAI:", e.message);
    }
  }
  if (process.env.OPENAI_API_KEY) {
    const r = await embedOpenAI(texts);
    if (r) return r;
  }
  throw new Error("Sem VOYAGE_API_KEY nem OPENAI_API_KEY — embeddings indisponiveis");
}

/**
 * Embed query unica pra search. inputType="query" otimiza recall.
 * Retorna o vetor diretamente (nao array).
 */
export async function embedQuery(text) {
  const r = await embedTexts([text], { inputType: "query" });
  return r[0] || null;
}

/**
 * Existe pelo menos um provedor configurado?
 * Usado em retrieval.js pra decidir se tenta vector ou cai direto em keyword.
 */
export function isEmbeddingAvailable() {
  return !!(process.env.VOYAGE_API_KEY || process.env.OPENAI_API_KEY);
}
