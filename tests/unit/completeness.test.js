import { describe, it, expect } from "vitest";
import { computeCompleteness } from "@/lib/metrics/completeness";

describe("computeCompleteness", () => {
  it("retorna 0% pra profile null", () => {
    const result = computeCompleteness(null);
    expect(result.percent).toBe(0);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("retorna 0% pra profile vazio", () => {
    expect(computeCompleteness({}).percent).toBe(0);
  });

  it("retorna 100% pra profile completo", () => {
    const profile = {
      nome: "Test",
      cargoAtual: "Engineer",
      senioridade: "Senior",
      targetRole: "PM",
      skills: ["python", "sql", "go"],
      rawCv: "x".repeat(300),
      linkedinJson: { something: true },
      githubUser: "test",
      portfolioJson: {
        projetos: [{ descricao: "Aumentou conversao em 30% para o produto X" }],
      },
    };
    expect(computeCompleteness(profile).percent).toBe(100);
  });

  it("retorna % parcial pra profile incompleto", () => {
    const profile = { nome: "X", cargoAtual: "Y", targetRole: "Z" };
    const result = computeCompleteness(profile);
    expect(result.percent).toBeGreaterThan(0);
    expect(result.percent).toBeLessThan(100);
    expect(result.missing.some((m) => m.key === "skills")).toBe(true);
  });

  it("missing fields tem label legivel", () => {
    const result = computeCompleteness({});
    expect(result.missing[0].label).toBeTruthy();
    expect(typeof result.missing[0].label).toBe("string");
  });
});
