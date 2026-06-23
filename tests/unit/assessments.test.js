import { describe, it, expect } from "vitest";
import {
  DISC_LITE,
  VALORES,
  IKIGAI,
  ALL_ASSESSMENTS,
  ALLOWED_KINDS,
  VALUE_GROUPS,
  getByKind,
  kindFromSlug,
  slugFromKind,
  narrativeFor,
  ikigaiSynthesis,
} from "@/lib/assessments/definitions";

// Cobertura: computeScore (3 tipos) + shape do payload + sanitizacao defensiva
// (anti-injection no multiselect, clamp no likert, teto/min char no openText).
// Validacao de IDOR e feita na rota /api/assessments/[kind] — aqui cuidamos da
// pureza das funcoes de calculo.

describe("ALL_ASSESSMENTS", () => {
  it("expõe exatamente 3 kinds", () => {
    expect(ALL_ASSESSMENTS).toHaveLength(3);
    expect(ALLOWED_KINDS.sort()).toEqual(["DISC_LITE", "IKIGAI", "VALORES"]);
  });

  it("getByKind retorna o def correto e null pra invalido", () => {
    expect(getByKind("DISC_LITE")).toBe(DISC_LITE);
    expect(getByKind("VALORES")).toBe(VALORES);
    expect(getByKind("IKIGAI")).toBe(IKIGAI);
    expect(getByKind("INEXISTENTE")).toBeUndefined();
  });

  it("kindFromSlug aceita slug e bate com slugFromKind", () => {
    expect(kindFromSlug("disc_lite")).toBe("DISC_LITE");
    expect(kindFromSlug("DISC_LITE")).toBe("DISC_LITE");
    expect(kindFromSlug("valores")).toBe("VALORES");
    expect(kindFromSlug("ikigai")).toBe("IKIGAI");
    expect(kindFromSlug("hack")).toBeNull();
    expect(kindFromSlug(null)).toBeNull();
    expect(slugFromKind("DISC_LITE")).toBe("disc_lite");
  });
});

describe("DISC_LITE.computeScore", () => {
  it("normaliza pra 0-100 por quadrante (3 perguntas * 5 max = 15 = 100%)", () => {
    // Tudo 5 -> 100 em cada quadrante
    const responses = {};
    DISC_LITE.questions.forEach((q) => {
      responses[q.id] = 5;
    });
    const out = DISC_LITE.computeScore(responses);
    expect(out).toEqual({ D: 100, I: 100, S: 100, C: 100 });
  });

  it("calcula D=100 quando so D respondido em 5 e resto sem resposta", () => {
    const responses = {};
    DISC_LITE.questions.forEach((q) => {
      // Apenas perguntas de D respondidas em 5. Outros ids ficam undefined
      // (computeScore trata como 0 — diferente de clamp 1, que ocorreria se
      // mandassemos 0 explicito).
      if (q.id.startsWith("d")) responses[q.id] = 5;
    });
    const out = DISC_LITE.computeScore(responses);
    expect(out.D).toBe(100);
    expect(out.I).toBe(0);
    expect(out.S).toBe(0);
    expect(out.C).toBe(0);
  });

  it("clamp 1-5: valores fora do range nao bagunçam o score", () => {
    const responses = {};
    DISC_LITE.questions.forEach((q) => {
      responses[q.id] = 999; // bem fora do range
    });
    const out = DISC_LITE.computeScore(responses);
    // 999 -> clamp pra 5 -> 100 em todos
    expect(out.D).toBe(100);
    expect(out.I).toBe(100);
  });

  it("input null/undefined explode com responses_invalid", () => {
    expect(() => DISC_LITE.computeScore(null)).toThrow(/responses_invalid/);
    expect(() => DISC_LITE.computeScore(undefined)).toThrow(/responses_invalid/);
  });

  it("respostas faltantes nao quebram (default 0)", () => {
    const out = DISC_LITE.computeScore({});
    expect(out).toEqual({ D: 0, I: 0, S: 0, C: 0 });
  });
});

describe("VALORES.computeScore", () => {
  it("aceita array de ids validos e respeita maxSelections (5)", () => {
    const out = VALORES.computeScore([
      "autonomia",
      "criatividade",
      "impacto",
      "aprendizado",
      "equilibrio",
      "remuneracao", // 6o item — deve cair fora
    ]);
    expect(out.selected).toHaveLength(5);
    expect(out.selected).not.toContain("remuneracao");
  });

  it("filtra ids invalidos (anti-injection)", () => {
    const out = VALORES.computeScore([
      "autonomia",
      "<script>alert(1)</script>",
      "valor_inexistente",
      "criatividade",
    ]);
    expect(out.selected).toEqual(["autonomia", "criatividade"]);
  });

  it("aceita formato { selected: [...] } tambem", () => {
    const out = VALORES.computeScore({ selected: ["autonomia", "proposito"] });
    expect(out.selected).toEqual(["autonomia", "proposito"]);
  });

  it("input invalido explode com responses_invalid", () => {
    expect(() => VALORES.computeScore("not-array")).toThrow(/responses_invalid/);
    expect(() => VALORES.computeScore(null)).toThrow(/responses_invalid/);
  });
});

describe("IKIGAI.computeScore", () => {
  it("completude conta apenas respostas com >= 20 chars", () => {
    const out = IKIGAI.computeScore({
      ama: "Gosto de resolver problemas tecnicos complexos no dia a dia.",
      fazBem: "curto", // <20 chars => nao conta
      mundoPrecisa: "Mais educacao acessivel pra todos os brasileiros hoje.",
      pagar: "", // vazio
    });
    expect(out.completion).toBe(2);
    expect(out.total).toBe(4);
    expect(out.percent).toBe(50);
  });

  it("teto de 4000 chars por campo (anti-DoS)", () => {
    const big = "a".repeat(10_000);
    const out = IKIGAI.computeScore({ ama: big });
    expect(out.answers.ama.length).toBe(4000);
  });

  it("input null explode com responses_invalid", () => {
    expect(() => IKIGAI.computeScore(null)).toThrow(/responses_invalid/);
  });

  it("payload tem shape { answers, completion, total, percent }", () => {
    const out = IKIGAI.computeScore({
      ama: "x".repeat(30),
      fazBem: "x".repeat(30),
      mundoPrecisa: "x".repeat(30),
      pagar: "x".repeat(30),
    });
    expect(out).toHaveProperty("answers");
    expect(out).toHaveProperty("completion");
    expect(out).toHaveProperty("total");
    expect(out).toHaveProperty("percent");
    expect(out.completion).toBe(4);
    expect(out.percent).toBe(100);
  });
});

describe("Seguranca / shape do payload", () => {
  it("AssessmentResult.scoresJson deve ser objeto serializavel (sem userId)", () => {
    // Garantia: computeScore() NUNCA mistura userId no scores. userId fica
    // na coluna proper, separada. Sem isso, um leak no scoresJson vazaria
    // o dono em logs/exports.
    const disc = DISC_LITE.computeScore({});
    const val = VALORES.computeScore([]);
    const ik = IKIGAI.computeScore({});
    expect(disc).not.toHaveProperty("userId");
    expect(val).not.toHaveProperty("userId");
    expect(ik).not.toHaveProperty("userId");
  });

  it("VALORES rejeita ids alem dos definidos em options (IDOR-safe na entrada)", () => {
    // Cliente malicioso pode mandar id de outro user/arquivo etc. computeScore
    // filtra contra a allowlist hardcoded em options.
    const out = VALORES.computeScore(["../../../etc/passwd", "DROP TABLE", "autonomia"]);
    expect(out.selected).toEqual(["autonomia"]);
  });

  it("DISC_LITE retorna sempre as 4 chaves (sem chaves extras do input)", () => {
    const out = DISC_LITE.computeScore({ d1: 3, evil: 99 });
    expect(Object.keys(out).sort()).toEqual(["C", "D", "I", "S"]);
  });
});

// ============ UI metadata (howTo, palette, iconKind) ============
// Garante que toda definition tem o que a UI espera. Se alguem remover um
// desses campos sem pensar, o redesign quebra silenciosamente — o teste falha
// em vez disso.

describe("Definitions: UI metadata (howTo, palette, iconKind)", () => {
  ALL_ASSESSMENTS.forEach((def) => {
    it(`${def.kind} tem howTo array com pelo menos 3 dicas`, () => {
      expect(Array.isArray(def.howTo)).toBe(true);
      expect(def.howTo.length).toBeGreaterThanOrEqual(3);
      def.howTo.forEach((tip) => {
        expect(typeof tip).toBe("string");
        expect(tip.length).toBeGreaterThanOrEqual(20);
      });
    });

    it(`${def.kind} tem palette valida (indigo|positive|attention)`, () => {
      expect(["indigo", "positive", "attention"]).toContain(def.palette);
    });

    it(`${def.kind} tem iconKind valido (matrix|star|circles)`, () => {
      expect(["matrix", "star", "circles"]).toContain(def.iconKind);
    });
  });

  it("DISC_LITE.quadrantLabels tem narrative + careerHints em cada quadrante", () => {
    ["D", "I", "S", "C"].forEach((k) => {
      const q = DISC_LITE.quadrantLabels[k];
      expect(typeof q.narrative).toBe("string");
      expect(q.narrative.length).toBeGreaterThanOrEqual(50);
      expect(Array.isArray(q.careerHints)).toBe(true);
      expect(q.careerHints.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ============ narrativeFor() ============

describe("narrativeFor(selected)", () => {
  it("retorna narrativa do grupo 'explorador' quando bate todos os ids tipicos", () => {
    const out = narrativeFor(["autonomia", "criatividade", "aprendizado", "impacto", "proposito"]);
    expect(out.group).toBe("explorador");
    expect(typeof out.narrative).toBe("string");
    expect(out.narrative.length).toBeGreaterThanOrEqual(40);
    expect(Array.isArray(out.cargos)).toBe(true);
    expect(out.cargos.length).toBeGreaterThan(0);
  });

  it("retorna narrativa do grupo 'estavel' quando bate ids tipicos", () => {
    const out = narrativeFor(["estabilidade", "equilibrio", "remuneracao", "saude_mental", "colaboracao"]);
    expect(out.group).toBe("estavel");
    expect(typeof out.narrative).toBe("string");
  });

  it("retorna narrativa do grupo 'lider' quando bate ids tipicos", () => {
    const out = narrativeFor(["lideranca", "reconhecimento", "desafio", "remuneracao", "impacto"]);
    expect(out.group).toBe("lider");
    expect(out.cargos.length).toBeGreaterThan(0);
  });

  it("cai pra 'misto' (fallback) quando nenhum grupo tem >= 2 ids em comum", () => {
    // 1 id de cada grupo — ninguem ganha
    const out = narrativeFor(["diversidade"]);
    expect(out.group).toBe("misto");
    expect(typeof out.narrative).toBe("string");
    expect(out.narrative.length).toBeGreaterThan(0);
  });

  it("array vazio retorna narrativa indefinida (nao explode)", () => {
    const out = narrativeFor([]);
    expect(out.group).toBe("indefinido");
    expect(typeof out.narrative).toBe("string");
  });

  it("input invalido (null/string) nao explode, devolve indefinido", () => {
    const out1 = narrativeFor(null);
    expect(out1.group).toBe("indefinido");
    const out2 = narrativeFor("not-array");
    expect(out2.group).toBe("indefinido");
  });

  it("VALUE_GROUPS expoe pelo menos 4 arquetipos distintos", () => {
    expect(Object.keys(VALUE_GROUPS).length).toBeGreaterThanOrEqual(4);
    Object.values(VALUE_GROUPS).forEach((g) => {
      expect(Array.isArray(g.match)).toBe(true);
      expect(g.match.length).toBeGreaterThanOrEqual(3);
      expect(typeof g.narrative).toBe("string");
      expect(g.narrative.length).toBeGreaterThanOrEqual(40);
    });
  });

  it("todos os ids de match em VALUE_GROUPS existem em VALORES.options (anti-typo)", () => {
    const validIds = new Set(VALORES.options.map((o) => o.id));
    Object.entries(VALUE_GROUPS).forEach(([key, group]) => {
      group.match.forEach((id) => {
        expect(validIds.has(id)).toBe(true);
      });
    });
  });
});

// ============ ikigaiSynthesis() ============

describe("ikigaiSynthesis(answers)", () => {
  const filled = "x".repeat(40);

  it("4 dimensoes preenchidas retorna sintese 'tudo cruzado'", () => {
    const text = ikigaiSynthesis({
      ama: filled,
      fazBem: filled,
      mundoPrecisa: filled,
      pagar: filled,
    });
    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(30);
    // Sintese de 4/4 deve mencionar a intersecao (sem ser frase exata)
    expect(text.toLowerCase()).toMatch(/4|encontram|emergir|direção|próximo|proximo/);
  });

  it("3 dimensoes retorna sintese apontando a lacuna", () => {
    const text = ikigaiSynthesis({
      ama: filled,
      fazBem: filled,
      mundoPrecisa: filled,
      pagar: "",
    });
    expect(text).toMatch(/3 das 4|falta/i);
  });

  it("2 dimensoes retorna sintese cedo demais", () => {
    const text = ikigaiSynthesis({
      ama: filled,
      fazBem: filled,
    });
    expect(text.length).toBeGreaterThan(20);
    expect(text.toLowerCase()).toMatch(/2 das 4|falta/);
  });

  it("1 dimensao retorna sintese de primeiro passo", () => {
    const text = ikigaiSynthesis({ ama: filled });
    expect(text.length).toBeGreaterThan(20);
  });

  it("0 dimensoes retorna sintese vazia/encorajando comecar", () => {
    const text = ikigaiSynthesis({});
    expect(text.length).toBeGreaterThan(0);
  });

  it("answers null/undefined nao explode", () => {
    expect(() => ikigaiSynthesis(null)).not.toThrow();
    expect(() => ikigaiSynthesis(undefined)).not.toThrow();
    const text = ikigaiSynthesis(null);
    expect(typeof text).toBe("string");
  });

  it("conta apenas respostas com >= 20 chars (consistente com computeScore)", () => {
    // 3 com 20+ chars, 1 com 5 chars — deve cair em "3 das 4"
    const text = ikigaiSynthesis({
      ama: filled,
      fazBem: filled,
      mundoPrecisa: filled,
      pagar: "curt",
    });
    expect(text).toMatch(/3 das 4|falta/i);
  });
});
