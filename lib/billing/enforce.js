// Enforcement de limites por plano. Centraliza:
//   1) getUserPlan: resolve plano atual (free se sub inativa/expirada)
//   2) checkUsage: consulta sem incrementar (use antes de gastar LLM)
//   3) trackUsage: incrementa apos uso bem-sucedido (idempotente via upsert)
//
// Padrao de uso em rota:
//   const lim = await checkUsage(userId, "analyze");
//   if (!lim.ok) return NextResponse.json({...}, { status: 402 });
//   // ... faz o trabalho ...
//   await trackUsage(userId, "analyze");
//
// Fail closed: sem userId => sempre nega (anonimos nao consomem cota).
// Plano resolvido server-side; jamais confiar em planId vindo do cliente.

import { prisma } from "@/lib/db";
import { getPlan, periodKey, dayKey } from "./plans";

// Features cobradas por dia (resetam a cada 24h). Demais sao mensais.
const DAILY_FEATURES = new Set(["opportunities"]);

// Status considerados "pagos/ativos" — qualquer outro cai pra free.
// TRIALING tambem libera (Stripe permite trial sem cobrar).
const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING"]);

export async function getUserPlan(userId) {
  if (!userId) return getPlan("free");
  const sub = await prisma.subscription.findUnique({
    where: { userId },
    select: { planId: true, status: true, currentPeriodEnd: true },
  });
  if (!sub) return getPlan("free");
  if (!ACTIVE_STATUSES.has(sub.status)) return getPlan("free");
  // Subscription expirou e webhook ainda nao atualizou? Cai pra free
  // (defesa contra delay de webhook).
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date()) {
    return getPlan("free");
  }
  return getPlan(sub.planId);
}

/**
 * Verifica se user pode usar a feature. NAO incrementa.
 * Retorna { ok, remaining, limit, plan, reason? }.
 */
export async function checkUsage(userId, feature) {
  if (!userId) {
    return { ok: false, remaining: 0, limit: 0, plan: "anonymous", reason: "auth_required" };
  }
  const plan = await getUserPlan(userId);
  const limit = plan.limits ? plan.limits[feature] : undefined;

  // Feature nao listada no plano => sem limite imposto (back-compat seguro).
  if (limit === undefined) {
    return { ok: true, remaining: Infinity, limit: Infinity, plan: plan.id };
  }
  if (limit === Infinity) {
    return { ok: true, remaining: Infinity, limit: Infinity, plan: plan.id };
  }

  const key = DAILY_FEATURES.has(feature) ? dayKey() : periodKey();
  const meter = await prisma.usageMeter.findUnique({
    where: { userId_feature_periodKey: { userId, feature, periodKey: key } },
    select: { count: true },
  });
  const used = meter?.count || 0;
  const remaining = Math.max(0, limit - used);
  return {
    ok: remaining > 0,
    remaining,
    limit,
    plan: plan.id,
    reason: remaining > 0 ? null : "limit_reached",
  };
}

/**
 * Incrementa UsageMeter. Chamar APOS uso bem-sucedido.
 * Idempotente em race via upsert atomico (UNIQUE composto cobre).
 * Falha silenciosa: uso ja aconteceu, nao quebra a rota.
 */
export async function trackUsage(userId, feature) {
  if (!userId) return;
  const key = DAILY_FEATURES.has(feature) ? dayKey() : periodKey();
  try {
    await prisma.usageMeter.upsert({
      where: { userId_feature_periodKey: { userId, feature, periodKey: key } },
      create: { userId, feature, periodKey: key, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch (e) {
    // Log sem PII (so .message). Nao derruba resposta.
    console.error("trackUsage falhou:", e?.message);
  }
}

/**
 * Alias semantico — uso recomendado em rotas:
 *   const lim = await enforceUsage(userId, "analyze");
 *   if (!lim.ok) return NextResponse.json({...}, { status: 402 });
 *
 * NAO incrementa. Chame trackUsage APOS o trabalho ser concluido.
 */
export async function enforceUsage(userId, feature) {
  return await checkUsage(userId, feature);
}

// Re-exports pra outros modulos (endpoint /api/billing/plan)
export { periodKey, dayKey };
