import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma — testa logica de plano/uso sem hit no banco.
// $transaction recebe um callback async(tx) e devolve o que ele retornar.
// Mockamos pra simplesmente chamar o callback com o proprio prisma mock (tx).
vi.mock("@/lib/db", () => {
  const mock = {
    subscription: { findUnique: vi.fn() },
    usageMeter: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      aggregate: vi.fn(),
    },
  };
  // $transaction com callback async (Serializable). Default: chama com 'mock'.
  mock.$transaction = vi.fn(async (cb) => {
    if (typeof cb === "function") return await cb(mock);
    // Array form (lista de promises) — return all
    return await Promise.all(cb);
  });
  return { prisma: mock };
});

import { prisma } from "@/lib/db";
import {
  getUserPlan,
  checkUsage,
  trackUsage,
  enforceUsage,
  trackTokenUsage,
  checkDailyBudget,
} from "@/lib/billing/enforce";

const futureDate = () => new Date(Date.now() + 86400000);
const pastDate = () => new Date(Date.now() - 86400000);

beforeEach(() => {
  prisma.subscription.findUnique.mockReset();
  prisma.usageMeter.findUnique.mockReset();
  prisma.usageMeter.upsert.mockReset();
  prisma.usageMeter.aggregate.mockReset();
  prisma.$transaction.mockReset();
  // Default: $transaction executa o callback com prisma mock como tx.
  prisma.$transaction.mockImplementation(async (cb) => {
    if (typeof cb === "function") return await cb(prisma);
    return await Promise.all(cb);
  });
});

describe("getUserPlan", () => {
  it("retorna free sem userId", async () => {
    const p = await getUserPlan(null);
    expect(p.id).toBe("free");
  });

  it("retorna free se sem subscription", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    const p = await getUserPlan("u1");
    expect(p.id).toBe("free");
  });

  it("retorna free se status PAST_DUE", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_monthly",
      status: "PAST_DUE",
      currentPeriodEnd: futureDate(),
    });
    const p = await getUserPlan("u1");
    expect(p.id).toBe("free");
  });

  it("retorna free se status CANCELED", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_monthly",
      status: "CANCELED",
      currentPeriodEnd: futureDate(),
    });
    const p = await getUserPlan("u1");
    expect(p.id).toBe("free");
  });

  it("retorna free se status INCOMPLETE", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_monthly",
      status: "INCOMPLETE",
      currentPeriodEnd: futureDate(),
    });
    const p = await getUserPlan("u1");
    expect(p.id).toBe("free");
  });

  it("retorna free se currentPeriodEnd expirou (webhook delay)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_monthly",
      status: "ACTIVE",
      currentPeriodEnd: pastDate(),
    });
    const p = await getUserPlan("u1");
    expect(p.id).toBe("free");
  });

  it("retorna pro_monthly se ACTIVE e nao expirado", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_monthly",
      status: "ACTIVE",
      currentPeriodEnd: futureDate(),
    });
    const p = await getUserPlan("u1");
    expect(p.id).toBe("pro_monthly");
  });

  it("retorna pro se TRIALING (mesmo sem cobranca)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_yearly",
      status: "TRIALING",
      currentPeriodEnd: futureDate(),
    });
    const p = await getUserPlan("u1");
    expect(p.id).toBe("pro_yearly");
  });

  it("retorna pro se currentPeriodEnd null (sem expiracao conhecida)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_monthly",
      status: "ACTIVE",
      currentPeriodEnd: null,
    });
    const p = await getUserPlan("u1");
    expect(p.id).toBe("pro_monthly");
  });
});

describe("checkUsage (read-only)", () => {
  it("nega sem userId (anonimos consomem so rate-limit)", async () => {
    const r = await checkUsage(null, "analyze");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("auth_required");
  });

  it("permite pro_monthly (limite Infinity)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_monthly",
      status: "ACTIVE",
      currentPeriodEnd: futureDate(),
    });
    const r = await checkUsage("u1", "analyze");
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(Infinity);
    expect(r.limit).toBe(Infinity);
  });

  it("nega free quando used >= limit", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.findUnique.mockResolvedValueOnce({ count: 3 });
    const r = await checkUsage("u1", "analyze");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("limit_reached");
    expect(r.remaining).toBe(0);
    expect(r.limit).toBe(3);
    expect(r.plan).toBe("free");
  });

  it("permite free quando used < limit", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.findUnique.mockResolvedValueOnce({ count: 1 });
    const r = await checkUsage("u1", "analyze");
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(2);
    expect(r.limit).toBe(3);
  });

  it("permite free sem meter (used=0)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.findUnique.mockResolvedValueOnce(null);
    const r = await checkUsage("u1", "analyze");
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(3);
  });

  it("usa dayKey pra opportunities (feature diaria)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.findUnique.mockResolvedValueOnce({ count: 2 });
    const r = await checkUsage("u1", "opportunities");
    expect(r.ok).toBe(true);
    expect(r.limit).toBe(5);
    const call = prisma.usageMeter.findUnique.mock.calls[0][0];
    expect(call.where.userId_feature_periodKey.periodKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("usa periodKey (YYYY-MM) pra analyze (feature mensal)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.findUnique.mockResolvedValueOnce({ count: 0 });
    await checkUsage("u1", "analyze");
    const call = prisma.usageMeter.findUnique.mock.calls[0][0];
    expect(call.where.userId_feature_periodKey.periodKey).toMatch(/^\d{4}-\d{2}$/);
  });

  it("feature desconhecida no plano nao limita (back-compat)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    const r = await checkUsage("u1", "feature_nova_qualquer");
    expect(r.ok).toBe(true);
    expect(r.limit).toBe(Infinity);
  });
});

describe("trackUsage (legacy)", () => {
  it("incrementa usageMeter via upsert", async () => {
    prisma.usageMeter.upsert.mockResolvedValueOnce({ count: 1 });
    await trackUsage("u1", "analyze");
    expect(prisma.usageMeter.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.usageMeter.upsert.mock.calls[0][0];
    expect(call.create.userId).toBe("u1");
    expect(call.create.feature).toBe("analyze");
    expect(call.create.count).toBe(1);
    expect(call.update.count).toEqual({ increment: 1 });
  });

  it("ignora chamadas sem userId", async () => {
    await trackUsage(null, "analyze");
    expect(prisma.usageMeter.upsert).not.toHaveBeenCalled();
  });

  it("falha silenciosa (uso ja gastou tokens)", async () => {
    prisma.usageMeter.upsert.mockRejectedValueOnce(new Error("DB offline"));
    await expect(trackUsage("u1", "analyze")).resolves.toBeUndefined();
  });
});

describe("enforceUsage — fix TOCTOU (check + increment atomico)", () => {
  it("nega sem userId", async () => {
    const r = await enforceUsage(null, "analyze");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("auth_required");
  });

  it("permite pro_monthly sem checar limite mas conta uso", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_monthly",
      status: "ACTIVE",
      currentPeriodEnd: futureDate(),
    });
    prisma.usageMeter.upsert.mockResolvedValueOnce({ count: 1 });
    const r = await enforceUsage("u1", "analyze");
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(Infinity);
    // Sem limite, pro nao entra em transaction Serializable — upsert direto.
    expect(prisma.usageMeter.upsert).toHaveBeenCalledTimes(1);
  });

  it("permite free quando used < limit e ja incrementa atomicamente", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.findUnique.mockResolvedValueOnce({ count: 1 });
    prisma.usageMeter.upsert.mockResolvedValueOnce({ count: 2 });
    const r = await enforceUsage("u1", "analyze");
    expect(r.ok).toBe(true);
    expect(r.remaining).toBe(1); // limit 3 - used 1 - 1 (incrementado) = 1
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Verifica que foi com Serializable
    const txCall = prisma.$transaction.mock.calls[0];
    expect(txCall[1]).toEqual({ isolationLevel: "Serializable" });
    // E que upsert rolou DENTRO da transaction
    expect(prisma.usageMeter.upsert).toHaveBeenCalledTimes(1);
  });

  it("nega free quando used >= limit SEM incrementar", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.findUnique.mockResolvedValueOnce({ count: 3 });
    const r = await enforceUsage("u1", "analyze");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("limit_reached");
    expect(r.remaining).toBe(0);
    // Limit_reached -> NAO chama upsert (nao adianta incrementar se ja bateu).
    expect(prisma.usageMeter.upsert).not.toHaveBeenCalled();
  });

  it("TOCTOU defense: 10 reqs paralelas com used=0, limit=3 — so 3 passam", async () => {
    // Simulamos transaction Serializable: cada chamada serializa em ordem.
    // O mock usa contador compartilhado pra simular o estado real do DB.
    let dbCount = 0;
    const limit = 3;

    prisma.subscription.findUnique.mockResolvedValue(null); // free
    prisma.usageMeter.findUnique.mockImplementation(async () => ({ count: dbCount }));
    prisma.usageMeter.upsert.mockImplementation(async () => {
      dbCount++;
      return { count: dbCount };
    });
    // $transaction serializa: chama o callback sequencialmente, simulando lock.
    let serialQueue = Promise.resolve();
    prisma.$transaction.mockImplementation(async (cb, opts) => {
      // Garantia: callback so roda quando o anterior terminar.
      const next = serialQueue.then(() => cb(prisma));
      serialQueue = next.catch(() => {});
      return await next;
    });

    // 10 reqs paralelas
    const results = await Promise.all(
      Array.from({ length: 10 }, () => enforceUsage("u1", "analyze"))
    );
    const passed = results.filter((r) => r.ok).length;
    const rejected = results.filter((r) => !r.ok && r.reason === "limit_reached").length;
    expect(passed).toBe(limit); // exatamente 3 — sem amplificacao
    expect(rejected).toBe(10 - limit); // restantes 7 negados
    expect(dbCount).toBe(limit); // DB ficou consistente em count=3
  });

  it("captura serialization failure e retorna internal_error", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.$transaction.mockRejectedValueOnce(new Error("40001 serialization failure"));
    const r = await enforceUsage("u1", "analyze");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("internal_error");
  });

  it("opportunities usa dayKey (diario) na transaction", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.findUnique.mockResolvedValueOnce({ count: 2 });
    prisma.usageMeter.upsert.mockResolvedValueOnce({ count: 3 });
    await enforceUsage("u1", "opportunities");
    const upsertCall = prisma.usageMeter.upsert.mock.calls[0][0];
    expect(upsertCall.where.userId_feature_periodKey.periodKey).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });
});

describe("trackTokenUsage", () => {
  it("incrementa tokensIn/tokensOut/costUsd via upsert", async () => {
    prisma.usageMeter.upsert.mockResolvedValueOnce({});
    await trackTokenUsage("u1", "analyze", {
      tokensIn: 1500,
      tokensOut: 800,
      costUsd: 0.012345,
    });
    expect(prisma.usageMeter.upsert).toHaveBeenCalledTimes(1);
    const call = prisma.usageMeter.upsert.mock.calls[0][0];
    expect(call.create.tokensIn).toBe(1500);
    expect(call.create.tokensOut).toBe(800);
    expect(call.create.costUsd).toBe(0.012345);
    expect(call.update.tokensIn).toEqual({ increment: 1500 });
    expect(call.update.tokensOut).toEqual({ increment: 800 });
    expect(call.update.costUsd).toEqual({ increment: 0.012345 });
  });

  it("ignora sem userId", async () => {
    await trackTokenUsage(null, "analyze", { tokensIn: 100, tokensOut: 50, costUsd: 0.01 });
    expect(prisma.usageMeter.upsert).not.toHaveBeenCalled();
  });

  it("ignora chamadas zeradas (sem tokens nem cost)", async () => {
    await trackTokenUsage("u1", "analyze", { tokensIn: 0, tokensOut: 0, costUsd: 0 });
    expect(prisma.usageMeter.upsert).not.toHaveBeenCalled();
  });

  it("sanitiza inputs invalidos (NaN/negativo viram 0)", async () => {
    await trackTokenUsage("u1", "analyze", {
      tokensIn: -100,
      tokensOut: NaN,
      costUsd: "invalid",
    });
    // Tudo virou 0 -> ignorado, nao chamou upsert.
    expect(prisma.usageMeter.upsert).not.toHaveBeenCalled();
  });

  it("falha silenciosa (tokens ja gastaram)", async () => {
    prisma.usageMeter.upsert.mockRejectedValueOnce(new Error("DB offline"));
    await expect(
      trackTokenUsage("u1", "analyze", { tokensIn: 100, tokensOut: 50, costUsd: 0.001 })
    ).resolves.toBeUndefined();
  });
});

describe("checkDailyBudget — hard-cap anti runaway cost", () => {
  it("retorna ok sem userId", async () => {
    const r = await checkDailyBudget(null);
    expect(r.ok).toBe(true);
  });

  it("free user dentro do cap (0.05 < 0.10)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.aggregate.mockResolvedValueOnce({ _sum: { costUsd: "0.05" } });
    const r = await checkDailyBudget("u1");
    expect(r.ok).toBe(true);
    expect(r.cap).toBe(0.1);
    expect(r.used).toBeCloseTo(0.05);
    expect(r.remaining).toBeCloseTo(0.05);
  });

  it("free user atingiu cap (0.10 >= 0.10) -> bloqueia", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.aggregate.mockResolvedValueOnce({ _sum: { costUsd: "0.10" } });
    const r = await checkDailyBudget("u1");
    expect(r.ok).toBe(false);
    expect(r.used).toBeCloseTo(0.1);
    expect(r.remaining).toBe(0);
  });

  it("pro_monthly tem cap maior ($5/dia)", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce({
      planId: "pro_monthly",
      status: "ACTIVE",
      currentPeriodEnd: futureDate(),
    });
    prisma.usageMeter.aggregate.mockResolvedValueOnce({ _sum: { costUsd: "2.5" } });
    const r = await checkDailyBudget("u1");
    expect(r.ok).toBe(true);
    expect(r.cap).toBe(5.0);
    expect(r.used).toBeCloseTo(2.5);
  });

  it("plan override (skipa lookup de subscription)", async () => {
    prisma.usageMeter.aggregate.mockResolvedValueOnce({ _sum: { costUsd: "0" } });
    const r = await checkDailyBudget("u1", "team_monthly");
    expect(r.cap).toBe(20.0);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("aggregate filtra por periodKey do dia ou do mes atual", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.aggregate.mockResolvedValueOnce({ _sum: { costUsd: null } });
    await checkDailyBudget("u1");
    const call = prisma.usageMeter.aggregate.mock.calls[0][0];
    expect(call.where.userId).toBe("u1");
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR).toHaveLength(2);
    // Um dos OR deve ser dayKey (YYYY-MM-DD), outro periodKey (YYYY-MM)
    const periodKeys = call.where.OR.map((o) => o.periodKey);
    expect(periodKeys.some((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))).toBe(true);
    expect(periodKeys.some((k) => /^\d{4}-\d{2}$/.test(k) && !/^\d{4}-\d{2}-\d{2}$/.test(k))).toBe(true);
  });
});
