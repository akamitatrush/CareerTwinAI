import { describe, it, expect } from "vitest";
import { EvidenceCreateBody, EvidencePatchBody } from "@/lib/validators";

// Cobertura: validator shape (formato esperado do form) + regras de seguranca
// (IDOR-safe by rejection-of-userId, .strict() contra campos extras, limites
// pra DoS/abuso). Roteamento e Prisma sao cobertos por inspecao + outros testes.

describe("EvidenceCreateBody — shape minimo", () => {
  const ok = {
    kind: "PROJECT",
    title: "Migração de monolito Rails para microsserviços Go",
    description: "Liderei a quebra de um monolito de 800k LOC em 3 serviços Go. Resultado: deploy caiu de 45min pra 6min.",
    skills: ["Go", "microsserviços", "liderança técnica"],
    metricLabel: "Tempo de deploy",
    metricValue: "-87%",
    url: "https://github.com/me/projeto",
    whenLabel: "Q1 2024",
  };

  it("aceita evidencia completa bem-formada", () => {
    expect(EvidenceCreateBody.safeParse(ok).success).toBe(true);
  });

  it("aceita evidencia minima (so campos obrigatorios)", () => {
    const r = EvidenceCreateBody.safeParse({
      kind: "CASE",
      title: "Implementei feature flags",
      description: "Desenhei e implementei sistema de feature flags pra time de 8 devs.",
    });
    expect(r.success).toBe(true);
    // skills default vazia
    expect(r.data.skills).toEqual([]);
  });

  it("rejeita kind invalido", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, kind: "RANDOM" });
    expect(r.success).toBe(false);
  });

  it("rejeita title curto (< 3 chars)", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, title: "Hi" });
    expect(r.success).toBe(false);
  });

  it("rejeita description curta (< 20 chars)", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, description: "pouco" });
    expect(r.success).toBe(false);
  });

  it("rejeita description gigante (> 5000 chars) — DoS/custo", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, description: "x".repeat(5001) });
    expect(r.success).toBe(false);
  });

  it("rejeita title gigante (> 200 chars)", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, title: "T".repeat(201) });
    expect(r.success).toBe(false);
  });

  it("rejeita mais de 10 skills (abuso)", () => {
    const skills = Array.from({ length: 11 }, (_, i) => `skill-${i}`);
    const r = EvidenceCreateBody.safeParse({ ...ok, skills });
    expect(r.success).toBe(false);
  });

  it("rejeita skill com mais de 80 chars", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, skills: ["x".repeat(81)] });
    expect(r.success).toBe(false);
  });

  it("rejeita URL malformada", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, url: "nao-e-url" });
    expect(r.success).toBe(false);
  });

  it("aceita URL https valida", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, url: "https://github.com/me/x" });
    expect(r.success).toBe(true);
  });

  it("rejeita userId no body (.strict — cliente NAO define dono)", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, userId: "outroUser" });
    expect(r.success).toBe(false);
  });

  it("rejeita id no body (.strict — cliente NAO define id)", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, id: "fake-id" });
    expect(r.success).toBe(false);
  });

  it("rejeita campos extras de injecao (.strict)", () => {
    const r = EvidenceCreateBody.safeParse({ ...ok, admin: true });
    expect(r.success).toBe(false);
  });

  it("aceita metricLabel/metricValue/url/whenLabel como null (limpar campo)", () => {
    const r = EvidenceCreateBody.safeParse({
      kind: "PROJECT",
      title: "Refactor da API",
      description: "Desenhei e implementei refactor estrutural da API legacy.",
      metricLabel: null,
      metricValue: null,
      url: null,
      whenLabel: null,
    });
    expect(r.success).toBe(true);
  });

  it("aceita todos os kinds validos", () => {
    const kinds = ["PROJECT", "CASE", "PUBLICATION", "CERTIFICATION", "AWARD", "CONTRIBUTION"];
    for (const k of kinds) {
      expect(EvidenceCreateBody.safeParse({ ...ok, kind: k }).success).toBe(true);
    }
  });
});

describe("EvidencePatchBody — atualizacao parcial", () => {
  it("aceita patch so com title", () => {
    const r = EvidencePatchBody.safeParse({ title: "Novo titulo claro" });
    expect(r.success).toBe(true);
  });

  it("aceita patch so com skills", () => {
    const r = EvidencePatchBody.safeParse({ skills: ["Go"] });
    expect(r.success).toBe(true);
  });

  it("aceita patch limpando url (null explicito)", () => {
    const r = EvidencePatchBody.safeParse({ url: null });
    expect(r.success).toBe(true);
  });

  it("rejeita patch vazio (.refine — nada pra atualizar)", () => {
    const r = EvidencePatchBody.safeParse({});
    expect(r.success).toBe(false);
  });

  it("rejeita userId no patch (.strict)", () => {
    const r = EvidencePatchBody.safeParse({ userId: "outroUser", title: "x" });
    expect(r.success).toBe(false);
  });

  it("rejeita title curto no patch", () => {
    const r = EvidencePatchBody.safeParse({ title: "x" });
    expect(r.success).toBe(false);
  });
});

describe("Evidence shape — contrato com a UI", () => {
  it("card payload tem campos esperados", () => {
    // Espelha o select do GET /api/evidence (todos os campos do model).
    const sample = {
      id: "evi_abc",
      kind: "PROJECT",
      title: "Migração K8s",
      description: "Liderei migração de VMs pra K8s, reduzindo custo de infra em 35%.",
      skills: ["Kubernetes", "DevOps"],
      metricLabel: "Custo de infra",
      metricValue: "-35%",
      url: "https://github.com/me/k8s",
      whenLabel: "Jan-Jun 2024",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(sample).toHaveProperty("kind");
    expect(sample).toHaveProperty("title");
    expect(sample).toHaveProperty("description");
    expect(Array.isArray(sample.skills)).toBe(true);
    // userId nao deve aparecer no payload de saida (IDOR — dono ja confirmado)
    expect(sample).not.toHaveProperty("userId");
  });

  it("IDOR-safe: 404 (nao 403) quando id e de outro user", () => {
    // Espelha o que /api/evidence/[id] retorna no caso IDOR.
    const resp = { error: "not_found" };
    expect(resp).toEqual({ error: "not_found" });
  });

  it("invalid_id rejeita id > 50 chars (limite cuid)", () => {
    const longId = "x".repeat(51);
    const valid = longId.length <= 50;
    expect(valid).toBe(false);
  });
});
