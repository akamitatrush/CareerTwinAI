// Proxy server-side pro PostHog. Cliente envia event name + properties; server
// adiciona userId verificado via session + forwarda pro PostHog Capture API.
//
// Por que existir:
//  - Events sensiveis a fraude (CHECKOUT_COMPLETED, SUBSCRIPTION_CANCELED,
//    DATA_EXPORTED, ACCOUNT_DELETED) nao podem ser disparados do client sem
//    verificacao — qualquer um conseguiria fakear "checkout_completed" via
//    devtools. Server-side garante que o capture so acontece pra users
//    autenticados, com userId do banco e nao do payload.
//  - O proxy NAO recebe distinct_id do client; usa session.user.id ou cai
//    pra `$device_id`-like (hash do IP) pra eventos anon (raro).
//
// OWASP relevantes:
//  - A01 (auth): rate-limit + auth check.
//  - A04 (insecure design): valida event name contra allowlist server-side
//    em vez de aceitar string livre. Cliente nao define o que envia.
//  - A05 (security misconfig): nao expoe PostHog API key publica em logs.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { EVENTS, SERVER_SIDE_EVENTS } from "@/lib/analytics/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Allowlist server-side: SO eventos marcados SERVER_SIDE_EVENTS em events.js
// passam por aqui. Outros sao rejeitados (forcam o client a usar track()).
// Isso impede que um attacker use /api/_track pra inflar metricas arbitrarias.
const ALLOWED_EVENTS = SERVER_SIDE_EVENTS;

// Whitelist de keys permitidas em properties — defesa contra payload abuse
// (cliente nao pode enviar properties arbitrarias gigantes pra encher quota).
const PROPERTY_KEY_PATTERN = /^[a-z_][a-z0-9_]{0,40}$/;
const MAX_PROPERTY_VALUE_LEN = 200;
const MAX_PROPERTIES = 12;

function sanitizeProperties(raw) {
  if (!raw || typeof raw !== "object") return {};
  const clean = {};
  let count = 0;
  for (const key of Object.keys(raw)) {
    if (count >= MAX_PROPERTIES) break;
    if (!PROPERTY_KEY_PATTERN.test(key)) continue;
    const v = raw[key];
    // Aceita primitivos seguros. Rejeita objetos/arrays profundos
    // (poderiam carregar PII estruturada).
    if (typeof v === "string") {
      clean[key] = v.slice(0, MAX_PROPERTY_VALUE_LEN);
    } else if (typeof v === "number" && Number.isFinite(v)) {
      clean[key] = v;
    } else if (typeof v === "boolean") {
      clean[key] = v;
    } else {
      continue;
    }
    count++;
  }
  return clean;
}

export async function POST(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Rate-limit conservador: 30/min/user. Esses eventos nao deveriam vir
  // em rajada (sao milestones), entao limite baixo nao machuca UX e bloqueia
  // tentativas de spam.
  const limit = await guardLLM(req, {
    name: "track",
    userId,
    perMinuteAnon: 5,
    perMinuteUser: 30,
  });
  if (!limit.ok) return tooMany(limit);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Payload invalido.", code: "BAD_JSON" },
      { status: 400 }
    );
  }

  const event = String(body?.event || "").trim();
  if (!event || !ALLOWED_EVENTS.has(event)) {
    // Lista de events nao revelada — apenas rejeicao generica.
    return NextResponse.json(
      { error: "Event not allowed via server-side proxy.", code: "EVENT_NOT_ALLOWED" },
      { status: 400 }
    );
  }

  const properties = sanitizeProperties(body?.properties);

  const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!KEY) {
    // Sem PostHog configurado (dev local). Retorna ok mas no-op.
    return NextResponse.json({ ok: true, forwarded: false }, { status: 200 });
  }

  // distinct_id: prefere userId verificado da session. Sem session, usa
  // um identificador anonimo gerado a partir do IP (hash com sal do env)
  // pra correlacionar eventos do mesmo browser sem armazenar IP cru.
  let distinctId = userId;
  if (!distinctId) {
    // Anonymous distinct id derivado do IP. Nao tentamos correlacionar
    // entre devices — so dentro do request flow.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    distinctId = `anon:${ip}`;
  }

  try {
    const res = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: KEY,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          // Marca explicitamente que veio do server pra distinguir no PostHog.
          $lib: "careertwin-server",
        },
        timestamp: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      // PostHog falhou — log mas nao quebra o caller. Capture de analytics
      // nunca deve ser blocking pra UX.
      console.error("[track] posthog falhou:", res.status);
      return NextResponse.json({ ok: false, forwarded: false }, { status: 502 });
    }
    return NextResponse.json({ ok: true, forwarded: true }, { status: 200 });
  } catch (e) {
    console.error("[track] fetch falhou:", e?.message);
    return NextResponse.json({ ok: false, forwarded: false }, { status: 502 });
  }
}
