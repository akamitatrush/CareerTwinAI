import { describe, it, expect } from "vitest";
import {
  CAREER_PATHS,
  getCareerPath,
  getAllPaths,
} from "@/lib/career-paths";

describe("getCareerPath", () => {
  it("retorna null pra role desconhecida", () => {
    expect(getCareerPath("astronauta lunar")).toBeNull();
  });

  it("retorna null pra entrada invalida (null, undefined, vazio, nao-string)", () => {
    expect(getCareerPath(null)).toBeNull();
    expect(getCareerPath(undefined)).toBeNull();
    expect(getCareerPath("")).toBeNull();
    expect(getCareerPath("   ")).toBeNull();
    expect(getCareerPath(42)).toBeNull();
    expect(getCareerPath({})).toBeNull();
  });

  it("match exato (case-insensitive + trim)", () => {
    const path = getCareerPath("Product Owner AI");
    expect(path).not.toBeNull();
    expect(path.targetTitle).toMatch(/Product Owner AI/i);

    const trimmed = getCareerPath("  product owner ai  ");
    expect(trimmed).not.toBeNull();
    expect(trimmed.targetTitle).toMatch(/Product Owner AI/i);
  });

  it("substring fallback funciona (role contem a key)", () => {
    // "Product Owner AI Senior" contem "product owner ai"
    const path = getCareerPath("Product Owner AI Senior na Tera");
    expect(path).not.toBeNull();
    expect(path.targetTitle).toMatch(/Product Owner AI/i);
  });

  it("substring fallback retorna primeiro hit (determinismo)", () => {
    // "Tech Lead" deve bater quando role tem "tech lead" como substring
    const path = getCareerPath("Senior Tech Lead na BigCo");
    expect(path).not.toBeNull();
    expect(path.targetTitle).toMatch(/Tech Lead/i);
  });
});

describe("getAllPaths", () => {
  it("retorna todos os paths com shape esperado", () => {
    const all = getAllPaths();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBe(Object.keys(CAREER_PATHS).length);
    for (const p of all) {
      expect(typeof p.key).toBe("string");
      expect(typeof p.title).toBe("string");
      expect(typeof p.timeline).toBe("string");
      expect(typeof p.milestonesCount).toBe("number");
      expect(p.milestonesCount).toBeGreaterThanOrEqual(3);
    }
  });

  it("tem no minimo 5 cargos curados", () => {
    // Requisito do MVP: minimo 5 cargos comuns no mercado BR.
    const all = getAllPaths();
    expect(all.length).toBeGreaterThanOrEqual(5);
  });
});

describe("CAREER_PATHS — estrutura curada", () => {
  it("cada path tem entre 3 e 5 milestones", () => {
    for (const [key, value] of Object.entries(CAREER_PATHS)) {
      expect(Array.isArray(value.milestones), `${key}.milestones`).toBe(true);
      expect(value.milestones.length, `${key} milestones count`).toBeGreaterThanOrEqual(3);
      expect(value.milestones.length, `${key} milestones count`).toBeLessThanOrEqual(5);
    }
  });

  it("cada path tem targetTitle e timeline nao-vazios", () => {
    for (const [key, value] of Object.entries(CAREER_PATHS)) {
      expect(typeof value.targetTitle, `${key}.targetTitle`).toBe("string");
      expect(value.targetTitle.length, `${key}.targetTitle`).toBeGreaterThan(0);
      expect(typeof value.timeline, `${key}.timeline`).toBe("string");
      expect(value.timeline.length, `${key}.timeline`).toBeGreaterThan(0);
    }
  });

  it("cada milestone tem order, title, durationWeeks, skills, actions, evidence", () => {
    for (const [key, value] of Object.entries(CAREER_PATHS)) {
      value.milestones.forEach((m, i) => {
        const tag = `${key}.milestones[${i}]`;
        expect(typeof m.order, `${tag}.order`).toBe("number");
        expect(m.order, `${tag}.order`).toBeGreaterThan(0);
        expect(typeof m.title, `${tag}.title`).toBe("string");
        expect(m.title.length, `${tag}.title`).toBeGreaterThan(0);
        expect(typeof m.durationWeeks, `${tag}.durationWeeks`).toBe("number");
        expect(m.durationWeeks, `${tag}.durationWeeks`).toBeGreaterThan(0);

        expect(Array.isArray(m.skills), `${tag}.skills`).toBe(true);
        expect(m.skills.length, `${tag}.skills`).toBeGreaterThan(0);
        for (const s of m.skills) {
          expect(typeof s, `${tag}.skills item`).toBe("string");
          // Skills lowercase pra match case-insensitive na pagina sem normalizacao extra.
          expect(s, `${tag}.skills lowercase`).toBe(s.toLowerCase());
        }

        expect(Array.isArray(m.actions), `${tag}.actions`).toBe(true);
        expect(m.actions.length, `${tag}.actions`).toBeGreaterThan(0);
        for (const a of m.actions) {
          expect(typeof a, `${tag}.actions item`).toBe("string");
          expect(a.length, `${tag}.actions item`).toBeGreaterThan(0);
        }

        expect(typeof m.evidence, `${tag}.evidence`).toBe("string");
        expect(m.evidence.length, `${tag}.evidence`).toBeGreaterThan(0);
      });
    }
  });

  it("milestones tem order sequencial comecando em 1", () => {
    for (const [key, value] of Object.entries(CAREER_PATHS)) {
      value.milestones.forEach((m, i) => {
        expect(m.order, `${key}.milestones[${i}].order`).toBe(i + 1);
      });
    }
  });

  it("keys de CAREER_PATHS sao lowercase (pro lookup bater)", () => {
    for (const key of Object.keys(CAREER_PATHS)) {
      expect(key).toBe(key.toLowerCase());
    }
  });
});
