import { describe, it, expect } from "vitest";
import { computeOverall, WEIGHTS } from "@/lib/score";

describe("computeOverall — score auditavel", () => {
  it("aplica os pesos 40/30/20/10 corretamente", () => {
    const ss = {
      aderencia_vagas: { valor: 100 },
      relevancia_habilidades: { valor: 100 },
      otimizacao_perfil: { valor: 100 },
      experiencia_mercado: { valor: 100 },
    };
    expect(computeOverall(ss)).toBe(100);
  });

  it("zeros viram zero", () => {
    const ss = {
      aderencia_vagas: { valor: 0 },
      relevancia_habilidades: { valor: 0 },
      otimizacao_perfil: { valor: 0 },
      experiencia_mercado: { valor: 0 },
    };
    expect(computeOverall(ss)).toBe(0);
  });

  it("ponderacao real: 80/60/40/20 = 60", () => {
    const ss = {
      aderencia_vagas: { valor: 80 },           // 32
      relevancia_habilidades: { valor: 60 },    // 18
      otimizacao_perfil: { valor: 40 },         // 8
      experiencia_mercado: { valor: 20 },       // 2
    };
    expect(computeOverall(ss)).toBe(60);
  });

  it("sub_scores ausentes contam como zero (fail safe)", () => {
    expect(computeOverall({})).toBe(0);
    expect(computeOverall(null)).toBe(0);
    expect(computeOverall(undefined)).toBe(0);
  });

  it("pesos somam exatamente 1", () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("nao aceita valor negativo passar (Number coerce)", () => {
    const ss = {
      aderencia_vagas: { valor: "x" },
      relevancia_habilidades: { valor: NaN },
      otimizacao_perfil: { valor: 50 },
      experiencia_mercado: { valor: undefined },
    };
    // 50 * 0.20 = 10
    expect(computeOverall(ss)).toBe(10);
  });
});
