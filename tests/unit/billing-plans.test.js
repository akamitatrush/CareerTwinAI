import { describe, it, expect } from "vitest";
import { PLANS, getPlan, periodKey, dayKey } from "@/lib/billing/plans";

describe("PLANS config", () => {
  it("tem os 4 planos esperados", () => {
    expect(PLANS.free).toBeDefined();
    expect(PLANS.pro_monthly).toBeDefined();
    expect(PLANS.pro_yearly).toBeDefined();
    expect(PLANS.team_monthly).toBeDefined();
  });

  it("free tem limites finitos por feature", () => {
    // Limites generosos durante validacao (pre-revenue).
    // Quando atingir ~100 users com dado real, ajustar pra forcar upgrade.
    expect(PLANS.free.limits.analyze).toBe(10);
    expect(PLANS.free.limits.tailor).toBe(5);
    expect(PLANS.free.limits.opportunities).toBe(20);
    expect(PLANS.free.limits.interview).toBe(10);
    // Importante: nenhum Infinity (free DEVE ter limite)
    for (const f of ["analyze", "tailor", "opportunities", "interview"]) {
      expect(PLANS.free.limits[f]).toBeLessThan(Infinity);
    }
  });

  it("pro tem Infinity em todas as features", () => {
    for (const f of ["analyze", "tailor", "opportunities", "interview"]) {
      expect(PLANS.pro_monthly.limits[f]).toBe(Infinity);
      expect(PLANS.pro_yearly.limits[f]).toBe(Infinity);
    }
  });

  it("free nao tem stripePriceId (nao compravel)", () => {
    expect(PLANS.free.stripePriceId).toBeNull();
  });

  it("pro tem priorityLLM e noBranding", () => {
    expect(PLANS.pro_monthly.features.priorityLLM).toBe(true);
    expect(PLANS.pro_monthly.features.noBranding).toBe(true);
  });
});

describe("getPlan", () => {
  it("retorna o plano correto pelo id", () => {
    expect(getPlan("free").id).toBe("free");
    expect(getPlan("pro_monthly").id).toBe("pro_monthly");
    expect(getPlan("pro_yearly").id).toBe("pro_yearly");
    expect(getPlan("team_monthly").id).toBe("team_monthly");
  });

  it("fail closed: id desconhecido cai pra free", () => {
    expect(getPlan("enterprise_unicorn").id).toBe("free");
    expect(getPlan("").id).toBe("free");
    expect(getPlan(null).id).toBe("free");
    expect(getPlan(undefined).id).toBe("free");
  });

  it("nao aceita prototype pollution", () => {
    expect(getPlan("__proto__").id).toBe("free");
    expect(getPlan("constructor").id).toBe("free");
    expect(getPlan("toString").id).toBe("free");
  });
});

describe("periodKey", () => {
  it("retorna YYYY-MM em UTC", () => {
    const d = new Date(Date.UTC(2026, 5, 15)); // junho (mes 5 zero-based)
    expect(periodKey(d)).toBe("2026-06");
  });

  it("zero-pad em mes < 10", () => {
    const d = new Date(Date.UTC(2026, 0, 1)); // janeiro
    expect(periodKey(d)).toBe("2026-01");
  });

  it("usa now() por default", () => {
    const k = periodKey();
    expect(k).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("dayKey", () => {
  it("retorna YYYY-MM-DD em UTC", () => {
    const d = new Date(Date.UTC(2026, 5, 22));
    expect(dayKey(d)).toBe("2026-06-22");
  });

  it("zero-pad mes e dia < 10", () => {
    const d = new Date(Date.UTC(2026, 0, 5));
    expect(dayKey(d)).toBe("2026-01-05");
  });

  it("usa now() por default", () => {
    const k = dayKey();
    expect(k).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
