import { describe, it, expect } from "vitest";
import { extractSkills, matchScore } from "@/lib/skills-taxonomy";

describe("extractSkills", () => {
  it("detecta SQL e Python em texto livre", () => {
    const out = extractSkills("Procuramos engenheiro com experiencia em Python e SQL avancado.");
    expect(out).toContain("Python");
    expect(out).toContain("SQL");
  });

  it("nao da falso-positivo dentro de palavra (ex.: 'SQL' dentro de 'mysql')", () => {
    // 'mysql' contem 'sql' como substring mas a checagem de fronteira deve rejeitar.
    const out = extractSkills("Trabalho com MySQL ha 5 anos");
    expect(out).not.toContain("SQL");
  });

  it("detecta Inglês via alias normalizado (sem acento)", () => {
    const out = extractSkills("Ingles avancado e necessario");
    expect(out).toContain("Inglês");
  });

  it("texto vazio retorna []", () => {
    expect(extractSkills("")).toEqual([]);
    expect(extractSkills(null)).toEqual([]);
  });
});

describe("matchScore — deterministico, nao envolve LLM", () => {
  it("100% quando perfil cobre todas as skills da vaga", () => {
    const { match, comuns, falta } = matchScore({
      profileSkills: ["Python", "SQL", "AWS"],
      jobSkills: ["Python", "SQL"],
    });
    expect(match).toBe(100);
    expect(comuns.length).toBe(2);
    expect(falta).toEqual([]);
  });

  it("0% quando nao ha intersecao", () => {
    const { match, falta } = matchScore({
      profileSkills: ["Java"],
      jobSkills: ["Python", "SQL"],
    });
    expect(match).toBe(0);
    expect(falta).toEqual(["python", "sql"]);
  });

  it("parcial: 50% quando cobre metade", () => {
    const { match } = matchScore({
      profileSkills: ["Python"],
      jobSkills: ["Python", "Go"],
    });
    expect(match).toBe(50);
  });

  it("zero defensivo: listas vazias", () => {
    expect(matchScore({ profileSkills: [], jobSkills: ["X"] }).match).toBe(0);
    expect(matchScore({ profileSkills: ["X"], jobSkills: [] }).match).toBe(0);
  });
});
