import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma — testa logica de plano/uso sem hit no banco.
vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: { findUnique: vi.fn() },
    usageMeter: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { getUserPlan, checkUsage, trackUsage, enforceUsage } from "@/lib/billing/enforce";

const futureDate = () => new Date(Date.now() + 86400000);
const pastDate = () => new Date(Date.now() - 86400000);

beforeEach(() => {
  prisma.subscription.findUnique.mockReset();
  prisma.usageMeter.findUnique.mockReset();
  prisma.usageMeter.upsert.mockReset();
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

describe("checkUsage", () => {
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
    // Verifica que a chave passada e formato dia (YYYY-MM-DD)
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

describe("trackUsage", () => {
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

describe("enforceUsage", () => {
  it("e alias de checkUsage", async () => {
    prisma.subscription.findUnique.mockResolvedValueOnce(null);
    prisma.usageMeter.findUnique.mockResolvedValueOnce({ count: 3 });
    const r = await enforceUsage("u1", "analyze");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("limit_reached");
  });
});
