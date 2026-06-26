import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Health check publico — sem auth. Usado por UptimeRobot e similares.
//
// Status:
//  - "healthy"   → todos os checks core ok
//  - "degraded"  → features secundarias falhando (cache, embeddings provider,
//                  webhook handlers atrasados). App funciona, mas com perda
//                  de qualidade (sem RAG, sem rate-limit distribuido, etc).
//  - "unhealthy" → core falhando (DB inacessivel ou ambos LLM providers fora).
//                  App nao consegue atender requests minimamente.
//
// HTTP:
//  - 200: healthy ou degraded (resposta com payload completo)
//  - 503: unhealthy (UptimeRobot dispara alerta)
//
// Seguranca:
//  - Publico, mas devolve so booleanos, contagens, timestamps e latencia.
//  - Sem DSN, chaves, hosts internos, conteudo de PII nem stack trace.
//  - Detalhes de erro ficam em log do servidor + Sentry (via logger).
//  - Sem rate-limit explicito aqui — o handler e barato (5-6 queries no DB e
//    1 HEAD opcional pra LLM). UptimeRobot bate a cada 5min.

// Numero atual de migrations no repo (15). Atualizar ao criar nova migration —
// se em prod o count diverge, e sinal de deploy parcial / migrate nao rodado.
const EXPECTED_MIGRATIONS = 15;

async function checkDatabase() {
  const t0 = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return { ok: true, latency_ms: Date.now() - t0 };
  } catch (e) {
    logger.error("health.db", "ping failed", { err: String(e?.message || e) });
    return { ok: false, error: "connection_failed", latency_ms: Date.now() - t0 };
  }
}

async function checkLastDiagnosis() {
  // Sinal de "core funcional do app": pelo menos 1 ScoreSnapshot foi escrito
  // recentemente. Retorna timestamp do mais novo — nao expoe userId.
  try {
    const last = await prisma.scoreSnapshot.findFirst({
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return {
      ok: true,
      last_at: last?.createdAt?.toISOString() || null,
      age_hours: last ? Math.round((Date.now() - last.createdAt.getTime()) / 3_600_000) : null,
    };
  } catch (e) {
    logger.warn("health.diagnosis", "query failed", { err: String(e?.message || e) });
    return { ok: false, error: "query_failed" };
  }
}

async function checkLastBillingEvent() {
  // Stripe webhooks chegam e gravam BillingEvent.processedAt. Util pra detectar
  // que o webhook handler caiu silenciosamente (Stripe acumula sem alertar).
  try {
    const last = await prisma.billingEvent.findFirst({
      select: { processedAt: true, type: true },
      orderBy: { processedAt: "desc" },
    });
    return {
      ok: true,
      last_at: last?.processedAt?.toISOString() || null,
      last_type: last?.type || null,
    };
  } catch (e) {
    logger.warn("health.billing", "query failed", { err: String(e?.message || e) });
    return { ok: false, error: "query_failed" };
  }
}

async function checkKnowledgeBase() {
  // Sinal de RAG funcional: ha chunks ingeridos. Zero chunks = transparencia
  // sem fonte (degrada qualidade mas nao quebra).
  try {
    const count = await prisma.knowledgeChunk.count();
    return { ok: count > 0, chunks: count };
  } catch (e) {
    logger.warn("health.knowledge", "count failed", { err: String(e?.message || e) });
    return { ok: false, error: "query_failed" };
  }
}

async function checkRedis() {
  // Upstash Redis usado pra rate-limit distribuido. Sem ele, cai pra in-memory
  // (funciona em 1 instancia, falha em multi-instance) — degrada, nao quebra.
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return { ok: false, configured: false };
  }
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2000);
  try {
    // /ping endpoint do Upstash REST. Token vai em Authorization.
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      signal: ctl.signal,
    });
    if (!res.ok) {
      return { ok: false, configured: true, status: res.status, latency_ms: Date.now() - t0 };
    }
    return { ok: true, configured: true, latency_ms: Date.now() - t0 };
  } catch (e) {
    logger.warn("health.redis", "ping failed", { err: String(e?.message || e) });
    return { ok: false, configured: true, error: "unreachable", latency_ms: Date.now() - t0 };
  } finally {
    clearTimeout(timer);
  }
}

async function checkLlmProvider() {
  // HEAD pra api.anthropic.com (ou api.openai.com) com timeout 2s. NAO faz
  // chamada autenticada — so verifica que o host responde. Custo zero.
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  const hasKey = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  if (!hasKey) {
    return { ok: false, provider, reachable: false, configured: false };
  }
  const url = provider === "openai" ? "https://api.openai.com/v1/models" : "https://api.anthropic.com/v1/messages";
  const t0 = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 2000);
  try {
    // HEAD (ou GET sem body) — esperamos 401/405/400, NAO ECONNREFUSED.
    // Qualquer resposta HTTP significa "host vivo". Status > 0.
    const res = await fetch(url, { method: "HEAD", signal: ctl.signal });
    return {
      ok: true,
      provider,
      configured: true,
      reachable: true,
      status: res.status,
      latency_ms: Date.now() - t0,
    };
  } catch (e) {
    logger.warn("health.llm", "provider unreachable", { err: String(e?.message || e), provider });
    return {
      ok: false,
      provider,
      configured: true,
      reachable: false,
      latency_ms: Date.now() - t0,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function checkMigrations() {
  // Conta linhas em _prisma_migrations e compara com EXPECTED_MIGRATIONS.
  // Detecta deploy parcial (codigo novo + migrate antigo).
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT COUNT(*)::int AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL'
    );
    const count = Array.isArray(rows) && rows.length > 0 ? Number(rows[0].count) : 0;
    return {
      ok: count >= EXPECTED_MIGRATIONS,
      applied: count,
      expected: EXPECTED_MIGRATIONS,
    };
  } catch (e) {
    logger.warn("health.migrations", "query failed", { err: String(e?.message || e) });
    return { ok: false, error: "query_failed" };
  }
}

export async function GET() {
  const startedAt = Date.now();

  // Roda checks em paralelo. Cada um e isolado em try/catch interno — um
  // check com erro NAO derruba os outros.
  const [database, diagnosis, billing, knowledge, redis, llm, migrations] = await Promise.all([
    checkDatabase(),
    checkLastDiagnosis(),
    checkLastBillingEvent(),
    checkKnowledgeBase(),
    checkRedis(),
    checkLlmProvider(),
    checkMigrations(),
  ]);

  // Static checks (apenas leem env, sem I/O).
  const llmConfigured = !!process.env.ANTHROPIC_API_KEY || !!process.env.OPENAI_API_KEY;
  const emailOk = !!process.env.AUTH_RESEND_KEY || !!process.env.EMAIL_SERVER;
  const jobsConfigured = [
    !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    !!process.env.JOOBLE_API_KEY,
    !!process.env.GREENHOUSE_BOARDS,
    !!process.env.LEVER_BOARDS,
    !!process.env.ASHBY_BOARDS,
    !!process.env.WORKABLE_BOARDS,
  ].filter(Boolean).length;

  // Classifica status global. Ordem importa:
  //  1. DB fora     → unhealthy (app nao funciona)
  //  2. LLM nao configurado → unhealthy (feature principal fora)
  //  3. Migrations divergentes → unhealthy (schema/codigo dessincronizado)
  //  4. Knowledge / Redis / billing webhook atrasado → degraded
  let status = "healthy";
  if (!database.ok) status = "unhealthy";
  else if (!llmConfigured) status = "unhealthy";
  else if (!migrations.ok && migrations.applied !== undefined) status = "unhealthy";
  else if (!knowledge.ok || !redis.ok || !llm.ok) status = "degraded";

  const httpStatus = status === "unhealthy" ? 503 : 200;
  const totalMs = Date.now() - startedAt;

  return NextResponse.json(
    {
      ok: status !== "unhealthy",
      status,
      timestamp: new Date().toISOString(),
      check_duration_ms: totalMs,
      checks: {
        database,
        last_diagnosis: diagnosis,
        last_billing_event: billing,
        knowledge_base: knowledge,
        redis,
        llm,
        migrations,
        // Static (booleanos derivados de env).
        llm_configured: { ok: llmConfigured, provider: process.env.LLM_PROVIDER || "anthropic" },
        email: {
          ok: emailOk,
          via: process.env.AUTH_RESEND_KEY ? "resend" : process.env.EMAIL_SERVER ? "smtp" : null,
        },
        jobs_providers: { ok: jobsConfigured > 0, count: jobsConfigured },
        observability: {
          sentry: !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN,
          posthog: !!process.env.NEXT_PUBLIC_POSTHOG_KEY,
        },
      },
      build: {
        node: process.version,
        env: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
        deploy: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
      },
    },
    {
      status: httpStatus,
      headers: { "cache-control": "no-store, max-age=0" },
    }
  );
}
