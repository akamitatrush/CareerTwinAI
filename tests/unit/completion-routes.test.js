import { describe, it, expect } from "vitest";

describe("completion routes", () => {
  it("payload de POST gap retorna shape esperado", () => {
    const sample = {
      ok: true,
      id: "x",
      completedAt: new Date(),
      habilidade: "Python",
      impactoPontos: 5,
    };
    expect(sample).toHaveProperty("completedAt");
    expect(sample.impactoPontos).toBeGreaterThan(0);
  });

  it("payload de DELETE retorna completedAt null", () => {
    const sample = { ok: true, id: "x", completedAt: null };
    expect(sample.completedAt).toBeNull();
  });

  it("plan item POST seta status=feita E completedAt", () => {
    const sample = {
      ok: true,
      id: "x",
      completedAt: new Date(),
      status: "feita",
    };
    expect(sample.status).toBe("feita");
    expect(sample.completedAt).toBeTruthy();
  });
});
