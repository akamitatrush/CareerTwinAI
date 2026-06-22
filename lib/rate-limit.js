// Rate limit em memoria (janela fixa por chave). Suficiente pra MVP single-node;
// pra multi-node trocar por Redis/Upstash sem mudar a API publica.
//
// Uso tipico:
//   const r = checkLimit({ name: "chat", userId, ip, perMinute: 30 });
//   if (!r.ok) return tooMany(r);

const buckets = new Map();

function ipFrom(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "anon";
}

export function checkLimit({ name, userId, ip, perMinute }) {
  const subject = userId ? `u:${userId}` : `i:${ip || "anon"}`;
  const key = `${name}:${subject}`;
  const now = Date.now();
  const windowMs = 60_000;
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: perMinute - 1, retryAfter: 0 };
  }
  if (b.count >= perMinute) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, remaining: perMinute - b.count, retryAfter: 0 };
}

export function guardLLM(req, { name, userId, perMinuteAnon = 5, perMinuteUser = 30 }) {
  const ip = ipFrom(req);
  const perMinute = userId ? perMinuteUser : perMinuteAnon;
  return checkLimit({ name, userId, ip, perMinute });
}

// GC oportunista — limpa buckets expirados a cada 5min, sem segurar o event loop.
const gc = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}, 5 * 60_000);
gc.unref?.();

// Util pros routes: monta a resposta 429.
import { NextResponse } from "next/server";
export function tooMany(r) {
  const seconds = r.retryAfter || 60;
  return NextResponse.json(
    {
      error: `Você fez muitas requisições em pouco tempo. Aguarde ${seconds} segundo${seconds === 1 ? "" : "s"} e tente de novo.`,
      code: "RATE_LIMITED",
      retryAfter: seconds,
    },
    { status: 429, headers: { "Retry-After": String(seconds) } }
  );
}
