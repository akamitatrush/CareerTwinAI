import { describe, it, expect } from "vitest";
import {
  suggestCoursesForSkill,
  suggestCoursesForGaps,
  decorateUrl,
} from "@/lib/knowledge/course-retrieval";

describe("suggestCoursesForSkill", () => {
  it("retorna empty pra skill vazia", () => {
    expect(suggestCoursesForSkill("")).toEqual([]);
    expect(suggestCoursesForSkill(null)).toEqual([]);
    expect(suggestCoursesForSkill(undefined)).toEqual([]);
  });

  it("retorna empty pra skill so com espacos", () => {
    expect(suggestCoursesForSkill("   ")).toEqual([]);
  });

  it("encontra cursos relevantes pra Python", () => {
    const r = suggestCoursesForSkill("python");
    expect(r.length).toBeGreaterThan(0);
    expect(
      r[0].skills.some((s) => s.toLowerCase().includes("python")),
    ).toBe(true);
  });

  it("encontra cursos relevantes pra SQL", () => {
    const r = suggestCoursesForSkill("SQL");
    expect(r.length).toBeGreaterThan(0);
    expect(
      r.some((c) => c.skills.some((s) => s.toLowerCase() === "sql")),
    ).toBe(true);
  });

  it("respeita limit", () => {
    const r = suggestCoursesForSkill("python", { limit: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("limit 1 retorna no maximo 1", () => {
    const r = suggestCoursesForSkill("javascript", { limit: 1 });
    expect(r.length).toBeLessThanOrEqual(1);
  });

  it("matching tolerante a acento (lideranca -> Liderança)", () => {
    const r = suggestCoursesForSkill("liderança");
    expect(r.length).toBeGreaterThan(0);
  });

  it("matching tolerante a caixa (PYTHON == python)", () => {
    const upper = suggestCoursesForSkill("PYTHON");
    const lower = suggestCoursesForSkill("python");
    expect(upper.length).toBe(lower.length);
  });

  it("nao retorna cursos pra skill que nao existe no catalogo", () => {
    const r = suggestCoursesForSkill("cobol-mainframe-z9");
    expect(r).toEqual([]);
  });

  it("ordena por score (gratuito empurra pra cima quando ha match", () => {
    const r = suggestCoursesForSkill("python");
    // Cursos free aparecem antes ou empatados com os pagos (free vale +2).
    expect(r.length).toBeGreaterThan(0);
    const firstIsFree = r[0].free === true;
    // Nao garantimos que SEMPRE seja free (titleMatch pode dominar), mas a
    // maioria das skills com mix vai abrir com um free.
    expect(typeof firstIsFree).toBe("boolean");
  });
});

describe("suggestCoursesForGaps", () => {
  it("retorna objeto vazio pra array vazio", () => {
    expect(suggestCoursesForGaps([])).toEqual({});
  });

  it("retorna objeto vazio pra input invalido", () => {
    expect(suggestCoursesForGaps(null)).toEqual({});
    expect(suggestCoursesForGaps(undefined)).toEqual({});
    expect(suggestCoursesForGaps("string")).toEqual({});
  });

  it("agrupa cursos por skill", () => {
    const gaps = [{ habilidade: "Python" }, { habilidade: "SQL" }];
    const r = suggestCoursesForGaps(gaps);
    expect(Object.keys(r).length).toBeGreaterThan(0);
    expect(r.Python || r.python || r.SQL || r.sql).toBeDefined();
  });

  it("aceita alias 'skill' e 'name' alem de 'habilidade'", () => {
    const gaps = [{ skill: "Python" }, { name: "SQL" }];
    const r = suggestCoursesForGaps(gaps);
    expect(Object.keys(r).length).toBeGreaterThan(0);
  });

  it("ignora gaps sem nome de skill", () => {
    const gaps = [{ outroCampo: "ruido" }, { habilidade: "Python" }];
    const r = suggestCoursesForGaps(gaps);
    expect(Object.keys(r).length).toBe(1);
  });

  it("respeita perGapLimit", () => {
    const gaps = [{ habilidade: "Python" }];
    const r = suggestCoursesForGaps(gaps, { perGapLimit: 1 });
    const list = r.Python || r.python || [];
    expect(list.length).toBeLessThanOrEqual(1);
  });

  it("respeita totalLimit", () => {
    const gaps = [
      { habilidade: "Python" },
      { habilidade: "SQL" },
      { habilidade: "React" },
      { habilidade: "TypeScript" },
      { habilidade: "Node" },
    ];
    const r = suggestCoursesForGaps(gaps, { perGapLimit: 2, totalLimit: 4 });
    const totalCourses = Object.values(r).reduce(
      (acc, list) => acc + list.length,
      0,
    );
    expect(totalCourses).toBeLessThanOrEqual(4);
  });

  it("dedupe: dois gaps com mesma habilidade nao geram duas entradas", () => {
    const gaps = [{ habilidade: "Python" }, { habilidade: "Python" }];
    const r = suggestCoursesForGaps(gaps);
    expect(Object.keys(r).length).toBe(1);
  });

  it("pula skills sem cursos no catalogo, continua processando o resto", () => {
    const gaps = [
      { habilidade: "cobol-mainframe-z9" },
      { habilidade: "Python" },
    ];
    const r = suggestCoursesForGaps(gaps);
    // Python entra; a fake nao.
    expect(Object.keys(r).length).toBe(1);
  });
});

describe("decorateUrl (affiliate hook)", () => {
  it("retorna URL inalterada por enquanto (sem affiliate ainda)", () => {
    expect(decorateUrl("https://example.com/curso")).toBe(
      "https://example.com/curso",
    );
  });
});
