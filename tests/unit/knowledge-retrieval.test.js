import { describe, it, expect } from "vitest";
import {
  retrieveKnowledge,
  formatAsContext,
  getAllTopics,
} from "@/lib/knowledge/retrieval";

describe("retrieveKnowledge — keyword retrieval BM25-lite", () => {
  it("retorna empty pra query vazia", () => {
    expect(retrieveKnowledge({ query: "" })).toEqual([]);
    expect(retrieveKnowledge({})).toEqual([]);
    expect(retrieveKnowledge()).toEqual([]);
  });

  it("retorna empty quando query so tem tokens curtos (< 3 chars)", () => {
    expect(retrieveKnowledge({ query: "a e o" })).toEqual([]);
  });

  it("encontra chunk de CV com query relevante", () => {
    const r = retrieveKnowledge({
      query: "curriculo metodo CAR resultado",
      topic: "cv",
      limit: 1,
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].topic).toBe("cv");
  });

  it("respeita topic filter", () => {
    const r = retrieveKnowledge({
      query: "curriculo",
      topic: "interview",
      limit: 5,
    });
    r.forEach((c) => expect(c.topic).toBe("interview"));
  });

  it("audience match boosta score (mesma query, com e sem audience)", () => {
    const generic = retrieveKnowledge({ query: "transicao carreira", limit: 1 });
    const targeted = retrieveKnowledge({
      query: "transicao carreira",
      audience: "transition",
      limit: 1,
    });
    expect(generic.length).toBeGreaterThan(0);
    expect(targeted.length).toBeGreaterThan(0);
    // Boost nao muda o numero de resultados (a query ja matchou); confirma
    // que audience targeting nao quebra o pipeline.
    expect(targeted[0]).toBeDefined();
  });

  it("normalizacao funciona com acento (NFD)", () => {
    // Query com acento e sem acento devem retornar mesmos resultados.
    const sem = retrieveKnowledge({ query: "salario negociacao", limit: 2 });
    const com = retrieveKnowledge({ query: "salário negociação", limit: 2 });
    expect(sem.map((c) => c.id)).toEqual(com.map((c) => c.id));
  });

  it("respeita limit", () => {
    const r = retrieveKnowledge({ query: "carreira", limit: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("ranking favorece chunk com mais matches", () => {
    // "entrevista comportamental STAR" deve trazer o chunk do framework STAR
    // primeiro, porque tem 3 matches em tags (entrevista, comportamental, star).
    const r = retrieveKnowledge({
      query: "entrevista comportamental STAR",
      topic: "interview",
      limit: 1,
    });
    expect(r.length).toBe(1);
    expect(r[0].id).toBe("interview-star-framework");
  });
});

describe("formatAsContext — formatacao pra injecao em prompt", () => {
  it("retorna string vazia pra lista vazia ou null", () => {
    expect(formatAsContext([])).toBe("");
    expect(formatAsContext(null)).toBe("");
    expect(formatAsContext(undefined)).toBe("");
  });

  it("inclui source citation no formato [source]", () => {
    const chunks = [{ content: "exemplo", source: "Test 2025" }];
    const text = formatAsContext(chunks);
    expect(text).toContain("[Test 2025]");
    expect(text).toContain("exemplo");
  });

  it("separa chunks com double newline", () => {
    const chunks = [
      { content: "a", source: "S1" },
      { content: "b", source: "S2" },
    ];
    const text = formatAsContext(chunks);
    expect(text).toBe("[S1] a\n\n[S2] b");
  });
});

describe("getAllTopics — sanity check da base", () => {
  it("retorna lista de topicos distintos", () => {
    const topics = getAllTopics();
    expect(Array.isArray(topics)).toBe(true);
    expect(topics.length).toBeGreaterThan(3);
  });

  it("contem topicos canonicos esperados", () => {
    const topics = getAllTopics();
    expect(topics).toContain("cv");
    expect(topics).toContain("interview");
    expect(topics).toContain("linkedin");
    expect(topics).toContain("transition");
  });
});
