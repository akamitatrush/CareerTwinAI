// Cache de respostas LLM pra requests identicos (mesmo system + user + model).
// TTL 1h. Bate quando o input e deterministico (chat com history mutavel NUNCA
// vai bater cache; analyze do mesmo CV+role no mesmo dia pode bater).
//
// Skip cache:
//  - streaming (incompativel)
//  - user-specific (analyze, profile/refresh) — sempre frescos pra ter
//    nova explicacao da LLM no snapshot
//
// Usar cache:
//  - parsing (linkedin, portfolio) — entrada idempotente
//  - interview question (mesma pergunta pode repetir em mock)
//  - cv/analyze-bullets pra bullets identicos
//  - opportunities porques (vagas mesmas + perfil mesmo = mesma resposta)
//
// Em PROD (UPSTASH_REDIS_REST_URL setado), usa Redis pra compartilhar entre
// lambdas Vercel. Em DEV/single-instance, cai pra Map em-memoria.
//
// Seguranca:
//  - Key e SHA-256(model|system|user) truncado em 32 hex chars (col-resist
//    pratico — 16 bytes = 2^128 search space).
//  - Sem PII no log: keys nao trazem conteudo, so hash.
//  - TTL 1h limita janela de cache poisoning (se atacante conseguir injetar
//    resposta no cache, expira em ate 1h).

import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";

let _redis = null;
function getRedis() {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

// Cache em memoria pra DEV ou fallback se Redis falhar. NAO compartilha entre
// processos — em PROD multi-lambda, cada instancia tem o seu (degradacao).
const memCache = new Map();
const TTL_MS = 60 * 60 * 1000; // 1h
const MAX_MEM_ENTRIES = 500;

function makeKey({ model, system, user }) {
  const content = `${model || ""}|${system || ""}|${user || ""}`;
  return "llm:" + createHash("sha256").update(content).digest("hex").slice(0, 32);
}

export async function cacheGet({ model, system, user }) {
  const key = makeKey({ model, system, user });
  const redis = getRedis();
  if (redis) {
    try {
      const v = await redis.get(key);
      // @upstash/redis ja parseia JSON quando setado via .set() — retorna obj.
      return v ?? null;
    } catch (e) {
      console.error("llm-cache get falhou:", e?.message);
    }
  }
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

export async function cacheSet({ model, system, user }, value) {
  const key = makeKey({ model, system, user });
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, { ex: 3600 });
      return;
    } catch (e) {
      console.error("llm-cache set falhou:", e?.message);
    }
  }
  // Fallback em memoria com LRU pobre (drop o mais antigo quando estoura cap).
  if (memCache.size >= MAX_MEM_ENTRIES) {
    const firstKey = memCache.keys().next().value;
    if (firstKey !== undefined) memCache.delete(firstKey);
  }
  memCache.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

// Reset do cache em-memoria. Util pra testes — NAO toca Redis.
export function cacheClear() {
  memCache.clear();
}

// Exportado pra testes — nao usar em rota.
export const _internal = { makeKey, TTL_MS };
