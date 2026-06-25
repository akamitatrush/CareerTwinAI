import { describe, it, expect } from "vitest";
import {
  diffLines,
  diffWords,
  lineStats,
  changePercent,
  alignSideBySide,
} from "@/lib/text-diff";

// Algoritmo de diff: LCS-based, puro JS, sem dependencia externa.
// Testes cobrem casos canonicos + edge cases reais de CV em portugues.

describe("diffLines — algoritmo de diff linha-a-linha", () => {
  it("texto identico vira tudo equal", () => {
    const result = diffLines("a\nb\nc", "a\nb\nc");
    expect(result).toHaveLength(3);
    expect(result.every((op) => op.type === "equal")).toBe(true);
    expect(result.map((op) => op.value)).toEqual(["a", "b", "c"]);
  });

  it("linha alterada vira delete + insert", () => {
    const result = diffLines("a\nb", "a\nc");
    // LCS: 'a' = equal. 'b' delete, 'c' insert.
    expect(result.length).toBeGreaterThanOrEqual(3);
    const types = result.map((op) => op.type);
    expect(types).toContain("equal");
    expect(types).toContain("delete");
    expect(types).toContain("insert");
    // Confirma valores certos por tipo
    const deleted = result.find((op) => op.type === "delete");
    const inserted = result.find((op) => op.type === "insert");
    expect(deleted.value).toBe("b");
    expect(inserted.value).toBe("c");
  });

  it("texto vazio + insercao retorna so insert", () => {
    const result = diffLines("", "linha nova");
    expect(result).toEqual([{ type: "insert", value: "linha nova" }]);
  });

  it("deletar tudo retorna so delete", () => {
    const result = diffLines("linha velha", "");
    expect(result).toEqual([{ type: "delete", value: "linha velha" }]);
  });

  it("ambos vazios retorna array vazio", () => {
    expect(diffLines("", "")).toEqual([]);
    expect(diffLines(null, null)).toEqual([]);
    expect(diffLines(undefined, undefined)).toEqual([]);
  });

  it("preserva unicode e acentos portugueses sem mutilar bytes", () => {
    const a = "Engenheiro de Software\nAnálise de dados";
    const b = "Engenheiro de Software\nAnálise estatística";
    const result = diffLines(a, b);
    // Primeira linha intacta
    const equals = result.filter((op) => op.type === "equal");
    expect(equals).toHaveLength(1);
    expect(equals[0].value).toBe("Engenheiro de Software");
    // Segunda muda — verifica que acento e preservado nos valores
    const deleted = result.find((op) => op.type === "delete");
    const inserted = result.find((op) => op.type === "insert");
    expect(deleted.value).toBe("Análise de dados");
    expect(inserted.value).toBe("Análise estatística");
  });

  it("normaliza \\r\\n (Windows) e \\r (Mac classic) pra \\n", () => {
    const winText = "linha 1\r\nlinha 2\r\nlinha 3";
    const unixText = "linha 1\nlinha 2\nlinha 3";
    const result = diffLines(winText, unixText);
    // Deve detectar como identicos — todos equal
    expect(result.every((op) => op.type === "equal")).toBe(true);
    expect(result).toHaveLength(3);
  });

  it("linhas duplicadas sao tratadas como elementos distintos", () => {
    const a = "x\nx\nx";
    const b = "x\nx";
    const result = diffLines(a, b);
    // Deve preservar 2 equals + 1 delete (ou similar — LCS escolhe alinhamento)
    const equals = result.filter((op) => op.type === "equal");
    const deletes = result.filter((op) => op.type === "delete");
    expect(equals).toHaveLength(2);
    expect(deletes).toHaveLength(1);
    expect(deletes[0].value).toBe("x");
  });

  it("preserva linhas vazias (separadores em CV)", () => {
    const a = "topo\n\nrodape";
    const b = "topo\n\nrodape";
    const result = diffLines(a, b);
    expect(result).toHaveLength(3);
    expect(result[1]).toEqual({ type: "equal", value: "" });
  });
});

describe("diffWords — granularidade palavra-a-palavra", () => {
  it("detecta palavra alterada dentro de uma linha", () => {
    const result = diffWords("Engenheiro Pleno", "Engenheiro Sr");
    // Espera: equal "Engenheiro", equal " ", delete "Pleno", insert "Sr"
    // (ordem pode variar mas tipos e valores precisam estar la)
    const inserted = result.filter((op) => op.type === "insert");
    const deleted = result.filter((op) => op.type === "delete");
    const equalValues = result
      .filter((op) => op.type === "equal")
      .map((op) => op.value);
    expect(equalValues).toContain("Engenheiro");
    expect(deleted.some((op) => op.value === "Pleno")).toBe(true);
    expect(inserted.some((op) => op.value === "Sr")).toBe(true);
  });

  it("preserva pontuacao e bullets (• -) como tokens", () => {
    const a = "• Backend Node";
    const b = "• Backend Python";
    const result = diffWords(a, b);
    // bullet "• " (bullet + espaco) eh tokenizado junto pq sao ambos non-letter.
    // Comportamento desejado: o bloco "• " inteiro fica equal (nao mexe no prefixo).
    const equals = result.filter((op) => op.type === "equal").map((op) => op.value);
    // Bullet+espaco juntos como prefixo
    expect(equals.some((v) => v.includes("•"))).toBe(true);
    expect(equals).toContain("Backend");
    // Palavra que mudou
    const inserted = result.filter((op) => op.type === "insert").map((op) => op.value);
    const deleted = result.filter((op) => op.type === "delete").map((op) => op.value);
    expect(inserted).toContain("Python");
    expect(deleted).toContain("Node");
  });

  it("ambos vazios retorna array vazio", () => {
    expect(diffWords("", "")).toEqual([]);
  });

  it("rejeita inputs null/undefined sem crash", () => {
    expect(diffWords(null, null)).toEqual([]);
    expect(diffWords(undefined, "a")).toEqual([{ type: "insert", value: "a" }]);
    expect(diffWords("a", undefined)).toEqual([{ type: "delete", value: "a" }]);
  });

  it("preserva whitespace como token (nao colapsa espacos)", () => {
    const a = "a b c";
    const b = "a b c";
    const result = diffWords(a, b);
    // Tudo equal, 5 tokens (a, espaco, b, espaco, c)
    expect(result.every((op) => op.type === "equal")).toBe(true);
    expect(result).toHaveLength(5);
  });
});

describe("lineStats — contagem de tipos de mudanca", () => {
  it("conta added/removed/changed/untouched corretamente", () => {
    // Fixture intencional: cobre TODOS os casos da heuristica.
    // - 2 equal (untouched)
    // - 1 par delete+insert consecutivo (changed)
    // - 1 insert solitario (added)
    // - 1 delete solitario (removed)
    const diff = [
      { type: "equal", value: "header" },
      { type: "delete", value: "linha velha" },
      { type: "insert", value: "linha nova" }, // par com a anterior
      { type: "equal", value: "meio" },
      { type: "insert", value: "linha bonus" }, // solo
      { type: "equal", value: "outro" },
      { type: "delete", value: "rodape" }, // solo
    ];
    const stats = lineStats(diff);
    expect(stats.changed).toBe(1); // par delete+insert
    expect(stats.added).toBe(1); // "linha bonus" sem par
    expect(stats.removed).toBe(1); // "rodape" sem par
    expect(stats.untouched).toBe(3); // "header", "meio", "outro"
    expect(stats.lines).toBe(6);
  });

  it("conta par insert+delete (ordem invertida) como changed", () => {
    // Algoritmo eh simetrico: a ordem do par nao importa.
    const diff = [
      { type: "insert", value: "novo" },
      { type: "delete", value: "velho" },
    ];
    const stats = lineStats(diff);
    expect(stats.changed).toBe(1);
    expect(stats.added).toBe(0);
    expect(stats.removed).toBe(0);
  });

  it("input invalido retorna stats zerados", () => {
    expect(lineStats(null)).toEqual({
      lines: 0,
      added: 0,
      removed: 0,
      changed: 0,
      untouched: 0,
    });
    expect(lineStats(undefined)).toEqual({
      lines: 0,
      added: 0,
      removed: 0,
      changed: 0,
      untouched: 0,
    });
  });

  it("array vazio retorna stats zerados", () => {
    expect(lineStats([])).toEqual({
      lines: 0,
      added: 0,
      removed: 0,
      changed: 0,
      untouched: 0,
    });
  });
});

describe("changePercent — % de mudanca total", () => {
  it("retorna 0 quando nao ha linhas", () => {
    expect(changePercent({ lines: 0, added: 0, removed: 0, changed: 0, untouched: 0 })).toBe(0);
  });

  it("retorna 100 quando todas linhas mudaram", () => {
    expect(
      changePercent({ lines: 4, added: 2, removed: 2, changed: 0, untouched: 0 }),
    ).toBe(100);
  });

  it("retorna 50 quando metade mudou", () => {
    expect(
      changePercent({ lines: 10, added: 3, removed: 1, changed: 1, untouched: 5 }),
    ).toBe(50);
  });

  it("arredonda corretamente", () => {
    // 1/3 = 33.33... → 33
    expect(
      changePercent({ lines: 3, added: 1, removed: 0, changed: 0, untouched: 2 }),
    ).toBe(33);
  });
});

describe("alignSideBySide — transformacao pra render lado-a-lado", () => {
  it("equal vira row com left=right e type=equal", () => {
    const rows = alignSideBySide([{ type: "equal", value: "x" }]);
    expect(rows).toEqual([{ left: "x", right: "x", type: "equal" }]);
  });

  it("delete+insert consecutivo vira row 'changed' com diff word-level", () => {
    const rows = alignSideBySide([
      { type: "delete", value: "Engenheiro Pleno" },
      { type: "insert", value: "Engenheiro Sr" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("changed");
    expect(rows[0].left).toBe("Engenheiro Pleno");
    expect(rows[0].right).toBe("Engenheiro Sr");
    expect(Array.isArray(rows[0].words)).toBe(true);
  });

  it("insert sozinho vira row com left=null", () => {
    const rows = alignSideBySide([{ type: "insert", value: "nova" }]);
    expect(rows).toEqual([{ left: null, right: "nova", type: "insert" }]);
  });

  it("delete sozinho vira row com right=null", () => {
    const rows = alignSideBySide([{ type: "delete", value: "velha" }]);
    expect(rows).toEqual([{ left: "velha", right: null, type: "delete" }]);
  });

  it("input invalido retorna array vazio", () => {
    expect(alignSideBySide(null)).toEqual([]);
    expect(alignSideBySide(undefined)).toEqual([]);
  });
});

describe("integracao end-to-end — CV real em portugues", () => {
  it("CV de 5 linhas com mudancas reais", () => {
    const cv_original = [
      "Sergio Hasher",
      "Engenheiro Backend Pleno",
      "",
      "• Desenvolveu API REST em Node",
      "• Banco PostgreSQL",
    ].join("\n");
    const cv_tailored = [
      "Sergio Hasher",
      "Engenheiro Backend Sr · 5 anos com Node",
      "",
      "• Desenvolveu API REST em Node.js com 99.9% uptime",
      "• Banco PostgreSQL com sharding",
    ].join("\n");

    const diff = diffLines(cv_original, cv_tailored);
    const stats = lineStats(diff);

    // Nome igual + linha vazia igual
    expect(stats.untouched).toBeGreaterThanOrEqual(2);
    // 3 linhas reescritas (titulo + 2 bullets)
    expect(stats.changed + stats.added + stats.removed).toBeGreaterThan(0);
    // Total faz sentido — LCS pode "aglomerar" inserts/deletes contiguos.
    // 5 a 8 linhas logicas dependendo do alinhamento que ele encontrar.
    expect(stats.lines).toBeGreaterThanOrEqual(5);
    expect(stats.lines).toBeLessThanOrEqual(8);

    const pct = changePercent(stats);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("performance: CV grande (~150 linhas) processa em <100ms", () => {
    // Gera CV sintetico de 150 linhas misturando equal e diff.
    const lines = [];
    for (let i = 0; i < 150; i++) {
      lines.push(`• Item de experiencia numero ${i} com texto razoavel`);
    }
    const original = lines.join("\n");
    // Modifica 20% das linhas
    const modified = lines
      .map((l, i) => (i % 5 === 0 ? l + " (com detalhe extra)" : l))
      .join("\n");

    const start = Date.now();
    const diff = diffLines(original, modified);
    const elapsed = Date.now() - start;

    expect(diff.length).toBeGreaterThan(0);
    // Benchmark frouxo: 100ms em CI lento ainda passa. Real <5ms tipicamente.
    expect(elapsed).toBeLessThan(100);
  });
});
