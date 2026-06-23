// Enforcement de limites por plano. Centraliza:
//   1) getUserPlan: resolve plano atual (free se sub inativa/expirada)
//   2) checkUsage: consulta sem incrementar (so leitura — usado em UI/preview)
//   3) enforceUsage: VERIFICA E INCREMENTA ATOMICAMENTE em transaction
//      (fix TOCTOU — antes era alias de checkUsage, callers ainda chamavam
//      trackUsage depois e abriam race window)
//   4) trackUsage: incrementa count puro (LEGACY — quando codigo ja chama
//      enforceUsage, NAO chame trackUsage depois, ja foi tracked)
//   5) trackTokenUsage: incrementa tokens + custo USD apos chamada LLM
//   6) checkDailyBudget: hard-cap de custo USD/dia/user (defende cost amplification)
//
// PADRAO NOVO de uso em rota LLM:
//   if (userId) {
//     const lim = await enforceUsage(userId, "analyze");  // check + increment atomico
//     if (!lim.ok) return NextResponse.json({...}, { status: 402 });
//   }
//   // ... trabalho LLM ...
//   if (userId) await trackTokenUsage(userId, "analyze", { tokensIn, tokensOut, costUsd });
//   // NAO chama trackUsage — enforceUsage ja incrementou count.
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

// Budget DIARIO em USD por plano. Hard-cap acima dos limites de uso
// (mesmo Pro tem teto pra defender contra runaway cost de attacker que
// rodar LLM em loop). Numeros calibrados em ~5x o uso normal honesto.
//   Free: $0.10/dia ≈ 3 analyses + 5 opp + 1 tailor + 5 interview
//   Pro:  $5.00/dia  ≈ 150 chamadas LLM (ilimitado pratico)
//   Team: $20.00/dia ≈ uso de equipe pequena
const DAILY_COST_CAP_USD = {
  free: 0.1,
  pro_monthly: 5.0,
  pro_yearly: 5.0,
  team_monthly: 20.0,
};

// Lista de emails owner/dev — bypass de limites + plano efetivo pro_yearly.
// Definida via env OWNER_EMAILS (comma-separated). Caso de uso:
//   - Sergio (owner) testa o produto sem bater cap
//   - Equipe Tera testa sem precisar configurar Stripe
//   - Dev local sem Stripe configurado funciona ilimitado
// IMPORTANTE: lookup case-insensitive + trim. Lista vazia (default) = ninguem.
const OWNER_EMAILS = new Set(
  String(process.env.OWNER_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

function isOwnerEmail(email) {
  if (!email || OWNER_EMAILS.size === 0) return false;
  return OWNER_EMAILS.has(String(email).toLowerCase().trim());
}

export async function getUserPlan(userId) {
  if (!userId) return getPlan("free");
  // Owner bypass: emails listados em OWNER_EMAILS pegam pro_yearly direto
  // (ilimitado). Lookup do email via User table — uma query a mais, mas so
  // executa se OWNER_EMAILS tiver algo. Em prod sem OWNER_EMAILS, no-op.
  if (OWNER_EMAILS.size > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user?.email && isOwnerEmail(user.email)) {
      return getPlan("pro_yearly");
    }
  }
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
 * Consulta apenas (NAO incrementa). Use pra exibir contador na UI ou pra
 * preview sem cobrar. Pra enforcement em rota, use enforceUsage.
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
 * VERIFICA E INCREMENTA ATOMICAMENTE. Substitui o par antigo
 * (checkUsage + trackUsage) que tinha race window de TOCTOU — atacante
 * disparava N requests paralelas, todas passavam check (count abaixo do
 * limit), todas executavam, depois track incrementava N vezes => uso
 * gratuito amplificado em N.
 *
 * Implementacao: transaction Serializable + SELECT seguido de UPSERT.
 * Em race real, Postgres serializa as transactions — a perdedora retry
 * automaticamente OU vira erro (capturamos e devolvemos internal_error).
 *
 * Retorna { ok, remaining, limit, plan, reason? }.
 */
export async function enforceUsage(userId, feature) {
  if (!userId) {
    return { ok: false, remaining: 0, limit: 0, plan: "anonymous", reason: "auth_required" };
  }
  const plan = await getUserPlan(userId);
  const limit = plan.limits ? plan.limits[feature] : undefined;

  const isUnlimited = limit === undefined || limit === Infinity;
  const key = DAILY_FEATURES.has(feature) ? dayKey() : periodKey();

  // Sem limite (Pro/Team ou feature nao listada): so incrementa contador,
  // sem check. Upsert atomico ja era idempotente em race nesse caso.
  if (isUnlimited) {
    try {
      await prisma.usageMeter.upsert({
        where: { userId_feature_periodKey: { userId, feature, periodKey: key } },
        create: { userId, feature, periodKey: key, count: 1 },
        update: { count: { increment: 1 } },
      });
    } catch (e) {
      // Falha de track em unlimited nao bloqueia o uso — log so.
      console.error("enforceUsage upsert unlimited falhou:", e?.message);
    }
    return { ok: true, remaining: Infinity, limit: Infinity, plan: plan.id };
  }

  // Com limite: check + increment em transaction Serializable.
  // Em race entre N requests do mesmo (userId,feature,periodKey), Postgres
  // serializa as gravacoes via UNIQUE composto. A perdedora pega
  // serialization failure e Prisma propaga — capturamos e devolvemos
  // erro generico (o usuario tenta de novo, ai a count nova ja conta).
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const meter = await tx.usageMeter.findUnique({
          where: { userId_feature_periodKey: { userId, feature, periodKey: key } },
          select: { count: true },
        });
        const used = meter?.count || 0;
        if (used >= limit) {
          return {
            ok: false,
            remaining: 0,
            limit,
            plan: plan.id,
            reason: "limit_reached",
          };
        }
        await tx.usageMeter.upsert({
          where: { userId_feature_periodKey: { userId, feature, periodKey: key } },
          create: { userId, feature, periodKey: key, count: 1 },
          update: { count: { increment: 1 } },
        });
        return {
          ok: true,
          remaining: Math.max(0, limit - used - 1),
          limit,
          plan: plan.id,
        };
      },
      { isolationLevel: "Serializable" }
    );
    return result;
  } catch (e) {
    // Serialization failure (Postgres 40001) ou erro real de DB. Fail-closed:
    // bloqueia esse request com erro generico. Tentativa proxima do user
    // sera atendida normalmente (state ja foi commit em alguma das txs).
    console.error("enforceUsage transaction falhou:", e?.message);
    return {
      ok: false,
      remaining: 0,
      limit,
      plan: plan.id,
      reason: "internal_error",
    };
  }
}

/**
 * Track tokens + custo USD apos chamada LLM. Idempotente em race via upsert.
 * costUsd em Decimal(10,6) — passa Number, Prisma converte. Se algum campo
 * vier undefined/null/NaN, vira 0 (defesa contra LLM que nao reporte custo).
 *
 * Falha silenciosa: tokens ja foram gastos, nao quebra a resposta.
 */
export async function trackTokenUsage(userId, feature, { tokensIn, tokensOut, costUsd } = {}) {
  if (!userId) return;
  const tIn = Number.isFinite(Number(tokensIn)) ? Math.max(0, Math.floor(Number(tokensIn))) : 0;
  const tOut = Number.isFinite(Number(tokensOut)) ? Math.max(0, Math.floor(Number(tokensOut))) : 0;
  const cost = Number.isFinite(Number(costUsd)) ? Math.max(0, Number(costUsd)) : 0;
  if (tIn === 0 && tOut === 0 && cost === 0) return; // nada a tracker
  const key = DAILY_FEATURES.has(feature) ? dayKey() : periodKey();
  try {
    await prisma.usageMeter.upsert({
      where: { userId_feature_periodKey: { userId, feature, periodKey: key } },
      create: {
        userId,
        feature,
        periodKey: key,
        count: 0,
        tokensIn: tIn,
        tokensOut: tOut,
        costUsd: cost,
      },
      update: {
        tokensIn: { increment: tIn },
        tokensOut: { increment: tOut },
        costUsd: { increment: cost },
      },
    });
  } catch (e) {
    console.error("trackTokenUsage falhou:", e?.message);
  }
}

/**
 * Verifica budget diario de custo LLM. Soma costUsd de TODAS as features
 * do user no dia (todas usam dayKey() pra esse aggregate — periodKey mensal
 * convive, mas o aggregate filtra por dia via where exato).
 *
 * IMPORTANTE: aggregate filtra periodKey === dayKey() entao so pega features
 * diarias (opportunities) E features mensais cujo periodKey calhe de ser
 * "YYYY-MM-DD" (nunca, sao "YYYY-MM"). Pra fazer o agg corretamente,
 * filtramos por createdAt do dia atual. Mas pra simplicidade do MVP,
 * acumulamos costUsd em registros do periodo atual: cada feature tem seu
 * proprio periodKey, entao precisamos somar todos os periodos ATIVOS.
 * Decisao pragmatica: somar somente o mes atual + o dia atual.
 *
 * Chame APOS LLM responder (sabe costUsd) ou ANTES (estima e pre-aprova).
 * Default Free $0.10/dia ≈ 10 analyses no Sonnet 4.6 (input curto).
 */
export async function checkDailyBudget(userId, planId = null) {
  if (!userId) return { ok: true, used: 0, cap: 0, remaining: 0 };
  const plan = planId || (await getUserPlan(userId)).id;
  const cap = DAILY_COST_CAP_USD[plan] || DAILY_COST_CAP_USD.free;
  const day = dayKey();
  const month = periodKey();
  // Soma costUsd de qualquer meter do user com periodKey do dia OU do mes
  // atual. Em features diarias o tracking entra no dia; em features mensais,
  // tudo do mes corrente conta — mais agressivo, mas o cap diario absorve.
  const result = await prisma.usageMeter.aggregate({
    where: {
      userId,
      OR: [{ periodKey: day }, { periodKey: month }],
    },
    _sum: { costUsd: true },
  });
  const used = Number(result._sum.costUsd || 0);
  const remaining = Math.max(0, cap - used);
  return {
    ok: used < cap,
    used,
    cap,
    remaining,
    plan,
  };
}

/**
 * LEGACY — incrementa count puro. Mantido pra compatibilidade. NAO use
 * em rotas novas (use enforceUsage que ja incrementa atomicamente).
 *
 * Se rota antiga chama enforceUsage E trackUsage, o count vai duplicar.
 * Routes auditadas e migradas: analyze, opportunities, tailor, interview.
 *
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

// Re-exports pra outros modulos (endpoint /api/billing/plan)
export { periodKey, dayKey };
