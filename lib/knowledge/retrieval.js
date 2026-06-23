// lib/knowledge/retrieval.js v2
// Hybrid retrieval: vector semantico (pgvector + Voyage AI) + keyword BM25-lite.
// Fallback graceful em camadas:
//   1. Sem embeddings provider configurado => so keyword (JSON em memoria).
//   2. Sem DB / sem tabela KnowledgeChunk => so keyword.
//   3. Voyage falhou + sem OpenAI => so keyword.
//   4. Tudo OK => RRF fusion entre vector + keyword.
//
// Interface publica MANTIDA (retrieveKnowledge, formatAsContext, getAllTopics).
// Diferenca: retrieveKnowledge agora e ASYNC (pode esperar embedding API + DB).
//
// Decisao RRF (Reciprocal Rank Fusion) vs ponderacao manual: scores de vector
// (cosine similarity 0..1) e keyword (overlap count) nao sao comparaveis. RRF
// usa so o RANKING (posicao na lista) com formula 1/(k+rank), k=60 — robusto
// e parametro-free. Padrao em hybrid search (Elastic, Pinecone).

import { embedQuery, isEmbeddingAvailable } from "@/lib/embeddings";
import careerBestPractices from "./career-best-practices.json";

const ALL_CHUNKS_JSON = [...careerBestPractices];

// Normaliza string pra comparacao tolerante a acento/case. NFD decompoe
// acentuados em base+combining; regex remove os combining marks.
function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Filtra tokens curtos (preposicoes/conjuncoes PT) mas mantem siglas de 3 chars
// (ats, sql, crm) que sao relevantes.
function tokenize(s) {
  return normalize(s)
    .split(/\W+/)
    .filter((w) => w.length >= 3);
}

// === Keyword retrieval (fallback / hybrid lane) ===
function keywordScore(chunk, queryTokens, audienceFilter) {
  let audienceBoost = 1;
  if (audienceFilter && Array.isArray(chunk.audience)) {
    if (chunk.audience.includes(audienceFilter)) audienceBoost = 1.5;
  }
  const searchable = `${chunk.topic} ${chunk.content} ${(chunk.tags || []).join(" ")}`;
  const chunkTokens = new Set(tokenize(searchable));
  const normalizedTags = (chunk.tags || []).map(normalize);
  let score = 0;
  queryTokens.forEach((qt) => {
    if (chunkTokens.has(qt)) score += 1;
    // Match em tag = sinal mais especifico que match em prosa.
    if (normalizedTags.includes(qt)) score += 0.5;
  });
  return score * audienceBoost;
}

function keywordRetrieve({ query, topic, audience, limit = 3 }) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  let candidates = ALL_CHUNKS_JSON;
  if (topic) candidates = candidates.filter((c) => c.topic === topic);
  const scored = candidates
    .map((c) => ({ chunk: c, score: keywordScore(c, tokens, audience) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    // 2x candidatos pra hybrid ter mais "material" pra RRF combinar.
    .slice(0, limit * 2);
  return scored.map((s) => ({
    ...s.chunk,
    score: s.score,
    source_retrieval: "keyword",
  }));
}

// === Vector retrieval (real RAG) ===
// Retorna null em qualquer falha (sem provider, sem DB, query falhou) — caller
// trata como "vector indisponivel" e cai pro keyword puro. Fail-closed.
async function vectorRetrieve({ query, topic, limit = 3 }) {
  if (!isEmbeddingAvailable()) return null;

  // Lazy import do prisma — em build/test sem DB, nao queremos custo aqui.
  // Se import falhar (impossivel em prod), tratamos como "vector indisponivel".
  let prisma;
  try {
    const mod = await import("@/lib/db");
    prisma = mod.prisma;
  } catch (e) {
    console.error("retrieve: import @/lib/db falhou:", e.message);
    return null;
  }
  if (!prisma) return null;

  let queryEmbedding;
  try {
    queryEmbedding = await embedQuery(query);
  } catch (e) {
    console.error("retrieve: embed query falhou:", e.message);
    return null;
  }
  if (!queryEmbedding) return null;

  // vecLit precisa ser literal "[v1,v2,...]" — castado pra ::vector na query.
  const vecLit = `[${queryEmbedding.join(",")}]`;
  let rows;
  try {
    // <=> = cosine distance no pgvector. Menor = mais similar.
    // similarity = 1 - distance (escala 0..1, maior = melhor) — converte pra
    // a convencao do JS land (maior = melhor).
    rows = topic
      ? await prisma.$queryRaw`
          SELECT id, content, source, topic, audience, tags,
                 1 - (embedding <=> ${vecLit}::vector) AS similarity
          FROM "KnowledgeChunk"
          WHERE topic = ${topic}
          ORDER BY embedding <=> ${vecLit}::vector
          LIMIT ${limit * 2}
        `
      : await prisma.$queryRaw`
          SELECT id, content, source, topic, audience, tags,
                 1 - (embedding <=> ${vecLit}::vector) AS similarity
          FROM "KnowledgeChunk"
          ORDER BY embedding <=> ${vecLit}::vector
          LIMIT ${limit * 2}
        `;
  } catch (e) {
    // Esperado se a tabela nao foi migrada ainda OU se a base nao foi ingerida.
    // Loga pra debug, mas nao quebra retrieval — keyword cobre.
    console.error("retrieve: query DB falhou (migrou? ingestou?):", e.message);
    return null;
  }
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    source: r.source,
    topic: r.topic,
    audience: r.audience,
    tags: r.tags,
    score: Number(r.similarity) || 0,
    source_retrieval: "vector",
  }));
}

// === Hybrid: RRF fusion ===
// score_rrf = sum(1 / (k + rank)) onde k=60 (default da literatura).
// Combina rankings sem precisar normalizar magnitudes diferentes.
function fuseResults(vectorResults, keywordResults, limit) {
  const k = 60;
  const fused = new Map();

  (vectorResults || []).forEach((r, i) => {
    const cur = fused.get(r.id) || { ...r, fusedScore: 0 };
    cur.fusedScore += 1 / (k + i + 1);
    fused.set(r.id, cur);
  });

  (keywordResults || []).forEach((r, i) => {
    const cur = fused.get(r.id) || { ...r, fusedScore: 0 };
    cur.fusedScore += 1 / (k + i + 1);
    fused.set(r.id, cur);
  });

  return Array.from(fused.values())
    .sort((a, b) => b.fusedScore - a.fusedScore)
    .slice(0, limit);
}

/**
 * Hybrid retrieval. Sempre roda keyword (rapido, in-memory).
 * Tenta vector em paralelo; se disponivel, RRF fusion. Caso contrario, so keyword.
 *
 * @param {Object} options
 * @param {string} options.query - texto da pergunta/contexto
 * @param {string} [options.topic] - filtra por categoria (cv, interview, etc)
 * @param {string} [options.audience] - boost pra audience match (junior, pleno, etc)
 * @param {number} [options.limit=3] - max chunks retornados
 * @returns {Promise<Array>} chunks ordenados por relevancia, shape compativel com v1
 */
export async function retrieveKnowledge({
  query,
  topic,
  audience,
  limit = 3,
} = {}) {
  if (!query) return [];

  // Paralelo: vector pode demorar 200-500ms (embedding API + query DB),
  // keyword e sync. Promise.all garante que esperamos os dois sem serializar.
  const [vectorResults, keywordResults] = await Promise.all([
    vectorRetrieve({ query, topic, limit }),
    Promise.resolve(keywordRetrieve({ query, topic, audience, limit })),
  ]);

  // Degradacao graceful: vector indisponivel ou vazio => keyword puro.
  if (!vectorResults || vectorResults.length === 0) {
    return keywordResults.slice(0, limit);
  }

  return fuseResults(vectorResults, keywordResults, limit);
}

/**
 * Formata chunks como bloco de contexto pro LLM. Cada chunk vem prefixado
 * com [source] pra explicabilidade — quando a IA usa, fonte deve aparecer
 * no output final.
 */
export function formatAsContext(chunks) {
  if (!chunks || chunks.length === 0) return "";
  return chunks.map((c) => `[${c.source}] ${c.content}`).join("\n\n");
}

/**
 * Lista todos os topicos distintos na base JSON (in-memory).
 * Util pra debugging, sanity checks, UI futura de exploracao.
 */
export function getAllTopics() {
  return Array.from(new Set(ALL_CHUNKS_JSON.map((c) => c.topic)));
}
