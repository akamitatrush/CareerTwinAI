// Token bucket de rate-limit. Em PROD (UPSTASH_REDIS_REST_URL setado) usa
// Redis global pra que multiplos lambdas Vercel compartilhem o mesmo bucket
// — defesa real contra abuso. Em DEV/single-instance cai pra Map em-memoria
// (defesa fraca mas funcional; serverless multi-lambda continua bypassavel).
//
// Uso tipico:
//   const limit = await guardLLM(req, { name: "chat", userId, perMinuteUser: 30 });
//   if (!limit.ok) return tooMany(limit);
//
// IMPORTANTE: guardLLM/checkLimit sao ASYNC (eram sync antes da migracao Redis).
// Todos os callers precisam `await`.
//
// Audit: quando o limite e atingido, dispara SECURITY_RATE_LIMIT_HIT em
// fire-and-forget (sem await). Hot path; nao podemos bloquear a resposta no
// audit. Falha silenciosa pelo proprio helper audit().

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { audit } from "@/lib/audit";

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

// Fallback in-memory (Map por processo). NAO funciona como defesa em
// serverless multi-instance, mas mantem o contrato pra dev/CI/single-node.
const memBuckets = new Map();

function memCheck(key, max, windowMs) {
  const now = Date.now();
  let bucket = memBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { windowStart: now, count: 0 };
    memBuckets.set(key, bucket);
  }
  bucket.count++;
  const resetAt = bucket.windowStart + windowMs;
  return {
    ok: bucket.count <= max,
    remaining: Math.max(0, max - bucket.count),
    resetAt,
    retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

async function redisCheck(key, max, windowMs) {
  const redis = getRedis();
  if (!redis) return null;
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    // INCR atomico — primeiro hit retorna 1 e nessa hora setamos EXPIRE.
    // Janela fixa por chave (alinhada com a primeira req do bucket).
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSec);
    }
    const ttl = await redis.ttl(key);
    const resetAt = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);
    return {
      ok: count <= max,
      remaining: Math.max(0, max - count),
      resetAt,
      retryAfter: Math.max(1, ttl > 0 ? ttl : windowSec),
    };
  } catch (e) {
    // Redis falhou (rede/limit etc) — cai pro mem como fallback. Logamos
    // pra observabilidade mas nao quebramos a request.
    console.error("rate-limit redis falhou, usando mem:", e?.message);
    return null;
  }
}

async function check(key, max, windowMs) {
  const r = await redisCheck(key, max, windowMs);
  return r || memCheck(key, max, windowMs);
}

function ipFrom(req) {
  // req.headers e Headers do Web Standard (Next 13+). Compatibilidade com
  // possiveis chamadas em testes com objeto plain — get(...) sempre safe.
  const get = (h) => (typeof req?.headers?.get === "function" ? req.headers.get(h) : null);
  const xff = get("x-forwarded-for");
  if (xff) return String(xff).split(",")[0].trim();
  return get("x-real-ip") || "anon";
}

/**
 * Rate limit generico (key explicito). Async por causa do Redis.
 */
export async function checkLimit({ name, userId, ip, perMinute }) {
  const subject = userId ? `u:${userId}` : `i:${ip || "anon"}`;
  const key = `rl:${name}:${subject}`;
  return await check(key, perMinute, 60_000);
}

/**
 * Rate limit pra endpoints LLM. Bucket por userId (se logado) OU IP.
 * RETORNA Promise — todos os callers DEVEM await.
 *
 * Antes:  const limit = guardLLM(req, ...)
 * Depois: const limit = await guardLLM(req, ...)
 *
 * Quando o limite e atingido, dispara SECURITY_RATE_LIMIT_HIT em
 * fire-and-forget (audit helper ja eh falha-silenciosa internamente).
 */
export async function guardLLM(req, { name, userId, perMinuteAnon = 5, perMinuteUser = 30 }) {
  const ip = ipFrom(req);
  const perMinute = userId ? perMinuteUser : perMinuteAnon;
  const result = await checkLimit({ name, userId, ip, perMinute });
  if (!result.ok) {
    // Fire-and-forget: nao bloqueia o request. Anon: userId null no audit.
    // Meta sem PII raw — so a rota, IP ja vai hasheado pelo helper.
    audit({
      userId: userId || null,
      action: "SECURITY_RATE_LIMIT_HIT",
      actorIp: ip !== "anon" ? ip : null,
      target: `Route:${name}`,
      meta: { route: name, perMinute, retryAfter: result.retryAfter },
    }).catch(() => {
      // audit() ja loga internamente em failure; catch pra silenciar
      // unhandledRejection caso prisma ainda nao foi inicializado.
    });
  }
  return result;
}

// Monta resposta 429 padronizada (mensagem PT-BR + Retry-After).
export function tooMany(r) {
  const seconds = r?.retryAfter || 60;
  return NextResponse.json(
    {
      error: `Você fez muitas requisições em pouco tempo. Aguarde ${seconds} segundo${seconds === 1 ? "" : "s"} e tente de novo.`,
      code: "RATE_LIMITED",
      retryAfter: seconds,
    },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );
}

// GC oportunista do fallback in-memory. So em ambiente Node persistente
// (dev/CI). Em serverless cada lambda morre rapido, irrelevante.
const gc = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memBuckets) {
    if (v.windowStart + 60_000 <= now) memBuckets.delete(k);
  }
}, 5 * 60_000);
gc.unref?.();

// Reset do estado em memoria — usado em testes pra isolar runs. Nao toca
// Redis (test envs nao setam UPSTASH_*).
export function _resetMemBuckets() {
  memBuckets.clear();
}
