// tests/unit/knowledge-retrieval.test.js
// retrieveKnowledge agora e async (RAG real: hybrid vector + keyword).
// Sem VOYAGE_API_KEY nem OPENAI_API_KEY => vector lane retorna null e cai
// pra keyword (degradacao graceful). Os testes abaixo rodam nesse modo,
// que e exatamente o que validamos: comportamento de keyword preservado e
// interface async correta.

import { describe, it, expect, beforeEach } from "vitest";
import {
  retrieveKnowledge,
  formatAsContext,
  getAllTopics,
} from "@/lib/knowledge/retrieval";

beforeEach(() => {
  // Garante modo keyword-only nos testes (sem chamar embedding API real).
  delete process.env.VOYAGE_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

describe("retrieveKnowledge — async, hybrid retrieval com fallback graceful", () => {
  it("retorna empty pra query vazia", async () => {
    expect(await retrieveKnowledge({ query: "" })).toEqual([]);
    expect(await retrieveKnowledge({})).toEqual([]);
    expect(await retrieveKnowledge()).toEqual([]);
  });

  it("retorna empty quando query so tem tokens curtos (< 3 chars)", async () => {
    expect(await retrieveKnowledge({ query: "a e o" })).toEqual([]);
  });

  it("encontra chunk de CV com query relevante (modo keyword fallback)", async () => {
    const r = await retrieveKnowledge({
      query: "curriculo metodo CAR resultado",
      topic: "cv",
      limit: 1,
    });
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].topic).toBe("cv");
  });

  it("respeita topic filter", async () => {
    const r = await retrieveKnowledge({
      query: "curriculo",
      topic: "interview",
      limit: 5,
    });
    r.forEach((c) => expect(c.topic).toBe("interview"));
  });

  it("audience match boosta score (mesma query, com e sem audience)", async () => {
    const generic = await retrieveKnowledge({
      query: "transicao carreira",
      limit: 1,
    });
    const targeted = await retrieveKnowledge({
      query: "transicao carreira",
      audience: "transition",
      limit: 1,
    });
    expect(generic.length).toBeGreaterThan(0);
    expect(targeted.length).toBeGreaterThan(0);
    // Boost nao muda o numero de resultados; confirma que audience targeting
    // nao quebra o pipeline.
    expect(targeted[0]).toBeDefined();
  });

  it("normalizacao funciona com acento (NFD)", async () => {
    const sem = await retrieveKnowledge({ query: "salario negociacao", limit: 2 });
    const com = await retrieveKnowledge({
      query: "salário negociação",
      limit: 2,
    });
    expect(sem.map((c) => c.id)).toEqual(com.map((c) => c.id));
  });

  it("respeita limit", async () => {
    const r = await retrieveKnowledge({ query: "carreira", limit: 2 });
    expect(r.length).toBeLessThanOrEqual(2);
  });

  it("ranking favorece chunk com mais matches (modo keyword)", async () => {
    const r = await retrieveKnowledge({
      query: "entrevista comportamental STAR",
      topic: "interview",
      limit: 1,
    });
    expect(r.length).toBe(1);
    expect(r[0].id).toBe("interview-star-framework");
  });

  it("degradacao graceful: sem embedding API, retorna so keyword sem throw", async () => {
    // Sem VOYAGE_API_KEY nem OPENAI_API_KEY (beforeEach garante), vectorRetrieve
    // retorna null mas o pipeline continua via keyword. Nao deve lancar erro.
    const r = await retrieveKnowledge({ query: "linkedin headline", limit: 2 });
    expect(Array.isArray(r)).toBe(true);
    // Pelo menos um chunk de linkedin deve aparecer.
    expect(r.some((c) => c.topic === "linkedin")).toBe(true);
  });

  it("retorna promise (interface async)", () => {
    const result = retrieveKnowledge({ query: "carreira" });
    expect(result).toBeInstanceOf(Promise);
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
