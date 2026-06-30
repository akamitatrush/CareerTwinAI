// Cache TTL pros providers de vagas. Em PROD (UPSTASH_REDIS_REST_URL setado)
// usa Redis pra que multiplos lambdas Vercel compartilhem o cache — sem isso
// cada instancia bate Adzuna independente, esgotando a cota de 250 req/mes.
// Em DEV/single-instance cai pra Map em-memoria (cap LRU pobre).
//
// cacheGet/cacheSet sao ASYNC agora (eram sync). Callers em lib/jobs/index.js
// usam await.

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

const TTL_MS = 10 * 60 * 1000; // 10 min
const MAX_ENTRIES = 200;

const memStore = new Map(); // key -> { exp, value }

export async function cacheGet(key) {
  const redis = getRedis();
  if (redis) {
    try {
      const v = await redis.get(key);
      // @upstash/redis ja parseia JSON quando setamos via .set() — retorna o
      // valor original. null se nao existir/expirou.
      return v ?? null;
    } catch (e) {
      console.error("cache redis get falhou, usando mem:", e?.message);
    }
  }
  const hit = memStore.get(key);
  if (!hit) return null;
  if (hit.exp < Date.now()) {
    memStore.delete(key);
    return null;
  }
  return hit.value;
}

export async function cacheSet(key, value, ttlMs = TTL_MS) {
  const redis = getRedis();
  if (redis) {
    try {
      const ex = Math.max(1, Math.ceil(ttlMs / 1000));
      await redis.set(key, value, { ex });
      return;
    } catch (e) {
      console.error("cache redis set falhou, usando mem:", e?.message);
    }
  }
  // Fallback in-memory com LRU pobre (drop o mais antigo quando estoura).
  if (memStore.size >= MAX_ENTRIES) {
    const firstKey = memStore.keys().next().value;
    if (firstKey !== undefined) memStore.delete(firstKey);
  }
  memStore.set(key, { exp: Date.now() + ttlMs, value });
}

// Callbacks registrados por modulos consumidores que mantem state ancilar
// (ex: single-flight Map em lib/jobs/index.js). cacheClear() os dispara
// pra evitar ghost-promises entre testes que recriam estado.
const _inflightClearCallbacks = new Set();
export function registerInflightClear(fn) {
  if (typeof fn === "function") _inflightClearCallbacks.add(fn);
}

// Reset do cache em-memoria. Util pra testes — NAO toca Redis (test envs
// nao setam UPSTASH_*; se setarem, dev cuida do flush manual).
export function cacheClear() {
  memStore.clear();
  for (const cb of _inflightClearCallbacks) {
    try { cb(); } catch { /* ignore */ }
  }
}
