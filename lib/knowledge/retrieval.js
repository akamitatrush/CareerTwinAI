// lib/knowledge/retrieval.js
// Keyword retrieval simples — sem embeddings, sem vector DB.
// Decisao pragmatica MVP: BM25-lite (tokenizacao NFD + lowercase, score por
// overlap contra content+tags), com boost 1.5x se audience match.
// Quando migrar pra pgvector: substituir esta funcao por query `<->` em
// coluna `embedding vector(1536)`. Schema do chunk continua compativel.

import careerBestPractices from "./career-best-practices.json";

const ALL_CHUNKS = [...careerBestPractices];

// Normaliza string pra comparacao tolerante a acento/case.
// NFD decompoe acentuados em base+combining mark; regex remove os combining
// (`̀-ͯ` = bloco "Combining Diacritical Marks").
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Tokeniza descartando tokens curtos (ruido: "de", "do", "se", "ou").
// Limite >= 3 chars filtra preposicoes/conjuncoes PT sem perder siglas
// curtas relevantes ('ats', 'crm', 'sql' tem 3).
function tokenize(s) {
  return normalize(s)
    .split(/\W+/)
    .filter((w) => w.length >= 3);
}

function scoreChunk(chunk, queryTokens, audienceFilter) {
  // Boost se audience match. Sem audience filter, todos os chunks tem boost 1.
  let audienceBoost = 1;
  if (audienceFilter && Array.isArray(chunk.audience)) {
    if (chunk.audience.includes(audienceFilter)) audienceBoost = 1.5;
  }

  const searchableText = `${chunk.topic} ${chunk.content} ${(chunk.tags || []).join(" ")}`;
  const chunkTokens = new Set(tokenize(searchableText));
  const normalizedTags = (chunk.tags || []).map(normalize);

  let score = 0;
  queryTokens.forEach((qt) => {
    if (chunkTokens.has(qt)) score += 1;
    // Bonus pra match em tags (sinal mais especifico que match em prosa).
    if (normalizedTags.includes(qt)) score += 0.5;
  });

  return score * audienceBoost;
}

/**
 * Retorna chunks mais relevantes pra query.
 * Score 0 nunca entra no resultado.
 *
 * @param {Object} options
 * @param {string} options.query - texto da pergunta/contexto
 * @param {string} [options.topic] - filtra por categoria (cv, interview, etc)
 * @param {string} [options.audience] - boost pra audience match (junior, pleno, senior, lead, transition)
 * @param {number} [options.limit=3] - maximo de chunks retornados
 * @returns {Array} chunks ordenados por relevancia (top N com score > 0)
 */
export function retrieveKnowledge({ query, topic, audience, limit = 3 } = {}) {
  if (!query) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  let candidates = ALL_CHUNKS;
  if (topic) candidates = candidates.filter((c) => c.topic === topic);

  const scored = candidates
    .map((c) => ({ chunk: c, score: scoreChunk(c, queryTokens, audience) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => s.chunk);
}

/**
 * Formata chunks como bloco de contexto pro LLM.
 * Cada chunk vem prefixado com [source] pra explicabilidade — quando a IA
 * usar o conteudo, a fonte deve aparecer no output ("[Fonte: ...]").
 *
 * @param {Array} chunks - lista retornada por retrieveKnowledge
 * @returns {string} bloco de texto pronto pra injecao no prompt (vazio se sem chunks)
 */
export function formatAsContext(chunks) {
  if (!chunks || chunks.length === 0) return "";
  return chunks
    .map((c) => `[${c.source}] ${c.content}`)
    .join("\n\n");
}

/**
 * Lista todos os topicos distintos na knowledge base.
 * Util pra debugging, sanity checks, ou UI futura de exploracao.
 */
export function getAllTopics() {
  return Array.from(new Set(ALL_CHUNKS.map((c) => c.topic)));
}
