import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Health check publico — sem auth. Usado por UptimeRobot e similares.
// Retorna 200 quando o sistema responde; 503 se algum subsistema CRITICO
// (hoje: somente o banco) falhar. As demais checagens sao informacionais.
//
// Decisao de seguranca:
//  - Endpoint e publico mas devolve so booleanos/contagens/latencia. Nao expoe
//    DSN, chaves, hosts internos, conteudo de PII nem stack trace.
//  - `deploy` e o sha curto (7 chars) do commit, ja visivel via headers de
//    deploy do Vercel — nao adiciona superficie nova.
//  - `node` e a versao do Node de runtime. Util pra debugar incidentes; ja
//    inferivel por fingerprint de framework. Mantemos.
//  - Nenhum erro real e devolvido ao cliente: somente "connection_failed"
//    generico. Detalhes vao pro log do servidor (e Sentry, via beforeSend).
export async function GET() {
  const startedAt = Date.now();
  const checks = {};
  let healthy = true;

  // DB ping — query leve. SELECT 1 e literal estatica, sem entrada do cliente.
  // Single source of truth pro 503: se o DB cai, o app esta indisponivel.
  try {
    const dbStart = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1");
    checks.database = { ok: true, latency_ms: Date.now() - dbStart };
  } catch (e) {
    // Log detalhado fica no servidor; cliente so ve label generico.
    console.error("[health] db check failed:", e?.message || e);
    checks.database = { ok: false, error: "connection_failed" };
    healthy = false;
  }

  // LLM provider — checa apenas presenca da chave (sem chamada externa).
  checks.llm = {
    ok: !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY,
    provider: process.env.LLM_PROVIDER || "anthropic",
  };

  // Email provider — Resend tem prioridade sobre SMTP (mesma logica de lib/email).
  checks.email = {
    ok: !!process.env.AUTH_RESEND_KEY || !!process.env.EMAIL_SERVER,
    via: process.env.AUTH_RESEND_KEY
      ? "resend"
      : process.env.EMAIL_SERVER
      ? "smtp"
      : null,
  };

  // Jobs providers — conta quantos estao configurados. Zero ainda funciona
  // (app cai em vagas ilustrativas), entao nao e critico pro 503.
  const jobsConfigured = [
    !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    !!process.env.JOOBLE_API_KEY,
    !!process.env.GREENHOUSE_BOARDS,
    !!process.env.LEVER_BOARDS,
    !!process.env.ASHBY_BOARDS,
    !!process.env.WORKABLE_BOARDS,
  ].filter(Boolean).length;
  checks.jobs_providers = { ok: jobsConfigured > 0, count: jobsConfigured };

  // Observability — booleano apenas (presenca de DSN/KEY). Nao retorna o valor.
  checks.observability = {
    sentry: !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
    posthog: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
  };

  // Build info — Node version e sha curto do commit (Vercel injeta).
  // env e o ambiente do Vercel (production/preview/development) ou NODE_ENV.
  checks.build = {
    node: process.version,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
    deploy: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
  };

  const totalMs = Date.now() - startedAt;

  return NextResponse.json(
    {
      ok: healthy,
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      check_duration_ms: totalMs,
      checks,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "cache-control": "no-store, max-age=0" },
    }
  );
}
