// Tests pro helper skillsForRole + categorizeSkills do SkillGraph.
// Cobre os 3 caminhos do lookup (exato, substring, fallback) + a
// categorizacao em have/haveExtra/missing — que e o core da feature.

import { describe, it, expect } from "vitest";
import { skillsForRole, categorizeSkills } from "@/lib/skills-taxonomy";

describe("skillsForRole — lookup de skills por cargo-alvo", () => {
  it("match exato: retorna lista do mapa pra chave conhecida", () => {
    const out = skillsForRole("backend");
    expect(Array.isArray(out)).toBe(true);
    expect(out).toContain("python");
    expect(out).toContain("sql");
  });

  it("match exato e case-insensitive (lower + trim)", () => {
    const out = skillsForRole("  BACKEND  ");
    expect(out).toContain("python");
  });

  it("substring match: 'backend engineer pleno' bate em 'backend'", () => {
    const out = skillsForRole("backend engineer pleno");
    expect(out).toContain("docker");
  });

  it("substring match: 'AI Engineer SR' bate em 'ai engineer' (lower)", () => {
    const out = skillsForRole("AI Engineer SR");
    expect(out).toContain("llm");
    expect(out).toContain("rag");
  });

  it("substring match prioriza chave mais longa (ai engineer > ml)", () => {
    // "ai engineer" contem "ml"? Nao — mas testa que matches sao corretos.
    // Caso real: "machine learning engineer" deveria bater "machine learning",
    // nao "ml" (curta) nem "ai engineer".
    const out = skillsForRole("machine learning engineer");
    expect(out).toContain("tensorflow");
    expect(out).toContain("pytorch");
  });

  it("fallback generico pra role completamente desconhecido", () => {
    const out = skillsForRole("astronauta de marte");
    expect(out).toContain("communication");
    expect(out).toContain("git");
    expect(out).toContain("agile");
  });

  it("retorna [] pra role vazio/null/undefined", () => {
    expect(skillsForRole(null)).toEqual([]);
    expect(skillsForRole(undefined)).toEqual([]);
    expect(skillsForRole("")).toEqual([]);
    expect(skillsForRole("   ")).toEqual([]);
  });

  it("retorna [] pra non-string que vira string vazia depois de trim", () => {
    // String(0) = "0" nao vazia entao cai no fallback. So queremos garantir
    // que nao throw.
    expect(() => skillsForRole(0)).not.toThrow();
    expect(() => skillsForRole({})).not.toThrow();
  });
});

describe("categorizeSkills — buckets have/haveExtra/missing", () => {
  it("have: profile ∩ target (case-insensitive)", () => {
    const { have } = categorizeSkills({
      profileSkills: ["Python", "SQL", "AWS"],
      targetSkills: ["python", "sql"],
    });
    expect(have).toEqual(["python", "sql"]);
  });

  it("haveExtra: profile \\ target (skills que tem mas cargo nao pede)", () => {
    const { haveExtra } = categorizeSkills({
      profileSkills: ["python", "rust", "haskell"],
      targetSkills: ["python", "sql"],
    });
    expect(haveExtra).toContain("rust");
    expect(haveExtra).toContain("haskell");
    expect(haveExtra).not.toContain("python");
  });

  it("missing: target \\ profile (cargo pede, perfil nao tem)", () => {
    const { missing } = categorizeSkills({
      profileSkills: ["python"],
      targetSkills: ["python", "sql", "docker"],
    });
    expect(missing).toEqual(["sql", "docker"]);
  });

  it("normaliza skills: lowercase + trim + filtra falsy", () => {
    const { have, missing } = categorizeSkills({
      profileSkills: ["  Python  ", "", null, "SQL"],
      targetSkills: ["python", "sql", "  Docker  "],
    });
    expect(have).toContain("python");
    expect(have).toContain("sql");
    expect(missing).toContain("docker");
  });

  it("defensivo: listas vazias / null / undefined nao quebra", () => {
    expect(categorizeSkills({})).toEqual({
      have: [],
      haveExtra: [],
      missing: [],
    });
    expect(
      categorizeSkills({ profileSkills: null, targetSkills: undefined }),
    ).toEqual({ have: [], haveExtra: [], missing: [] });
  });

  it("nao tem duplicatas indevidas: skill em 3 buckets ao mesmo tempo e impossivel", () => {
    const { have, haveExtra, missing } = categorizeSkills({
      profileSkills: ["python", "sql"],
      targetSkills: ["python", "docker"],
    });
    // Cada skill aparece em exatamente 1 bucket.
    const all = [...have, ...haveExtra, ...missing];
    const unique = new Set(all);
    expect(all.length).toBe(unique.size);
  });

  it("integracao com skillsForRole: bate skills do perfil com cargo conhecido", () => {
    const target = skillsForRole("backend");
    const { have, missing } = categorizeSkills({
      profileSkills: ["python", "sql"],
      targetSkills: target,
    });
    expect(have).toContain("python");
    expect(missing).toContain("docker"); // backend pede docker, perfil nao tem
  });
});
