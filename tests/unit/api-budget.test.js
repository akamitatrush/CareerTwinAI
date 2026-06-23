// Integration tests do pre-check de budget diario (Wave 11) em rotas LLM.
//
// Cobertura:
//  - POST /api/analyze retorna 402 BUDGET_EXCEEDED quando budget hit
//  - Audit log SECURITY_BUDGET_EXCEEDED disparado no pre-check
//  - LLM NAO e chamado quando budget bate (cost amplification defense)
//  - Anonimo NAO ativa pre-check de budget (sem userId)
//
// Mocks: prisma, LLM, audit, auth, billing, rate-limit, jobs, scoring, notifications.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeReq } from "../helpers/api.js";

vi.mock("@/lib/db", () => {
  const mock = {
    profile: { upsert: vi.fn(), update: vi.fn() },
    scoreSnapshot: { create: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    notification: { count: vi.fn() },
    consent: { create: vi.fn() },
    dataSource: { create: vi.fn() },
  };
  mock.$transaction = vi.fn(async (cb) => {
    if (typeof cb === "function") return await cb(mock);
    return await Promise.all(cb);
  });
  return { prisma: mock };
});

vi.mock("@/lib/llm", () => ({
  completeJSON: vi.fn(),
  completeJSONWithUsage: vi.fn(),
}));
vi.mock("@/lib/prompts", () => ({
  promptDiag: vi.fn(async () => ({ system: "sys", user: "usr" })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/billing/enforce", () => ({
  enforceUsage: vi.fn(async () => ({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" })),
  trackTokenUsage: vi.fn(async () => undefined),
  checkDailyBudget: vi.fn(async () => ({ ok: true, used: 0, cap: 100 })),
}));
vi.mock("@/lib/rate-limit", () => ({
  guardLLM: vi.fn(async () => ({ ok: true })),
  tooMany: vi.fn(() =>
    new Response(JSON.stringify({ error: "rate", code: "RATE_LIMITED" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    })
  ),
}));
vi.mock("@/lib/jobs", () => ({
  searchJobs: vi.fn(async () => ({ jobs: [], sources: [] })),
}));
vi.mock("@/lib/scoring/subscores", () => ({
  computeAllSubScores: vi.fn(() => ({
    overall: 72,
    sub_scores: {
      aderencia_vagas: { valor: 70, _meta: {} },
      relevancia_habilidades: { valor: 75, _meta: {} },
      otimizacao_perfil: { valor: 80, _meta: {} },
      experiencia_mercado: { valor: 65, _meta: {} },
    },
  })),
}));
vi.mock("@/lib/notifications", () => ({
  notify: vi.fn(async () => undefined),
  NotificationTemplates: {
    scoreUpdated: () => ({ kind: "SCORE_UPDATED", title: "x", body: "y" }),
    welcome: () => ({ kind: "WELCOME", title: "x", body: "y" }),
  },
}));

import { prisma } from "@/lib/db";
import { completeJSONWithUsage } from "@/lib/llm";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import {
  enforceUsage,
  checkDailyBudget,
  trackTokenUsage,
} from "@/lib/billing/enforce";
import { guardLLM } from "@/lib/rate-limit";

const VALID_CV = "Maria, dev backend ha 5 anos. Python + SQL em empresas brasileiras grandes.";

let POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.profile.upsert.mockReset();
  prisma.profile.update.mockReset();
  prisma.scoreSnapshot.create.mockReset();
  prisma.scoreSnapshot.findFirst.mockReset();
  prisma.scoreSnapshot.count.mockReset();
  prisma.notification.count.mockReset();
  prisma.consent.create.mockReset();
  prisma.dataSource.create.mockReset();
  prisma.$transaction.mockReset();
  prisma.$transaction.mockImplementation(async (cb) => {
    if (typeof cb === "function") return await cb(prisma);
    return await Promise.all(cb);
  });
  // Defaults pra evitar 500 PERSIST_FAILED em happy paths.
  prisma.profile.upsert.mockResolvedValue({ userId: "u1" });
  prisma.scoreSnapshot.create.mockResolvedValue({
    id: "snap-1",
    overall: 72,
    gaps: [],
  });
  prisma.scoreSnapshot.count.mockResolvedValue(0);
  prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
  prisma.notification.count.mockResolvedValue(0);

  completeJSONWithUsage.mockReset();
  audit.mockReset();
  auth.mockReset();
  enforceUsage.mockReset();
  enforceUsage.mockResolvedValue({
    ok: true,
    remaining: 99,
    limit: 100,
    plan: "free",
  });
  trackTokenUsage.mockReset();
  trackTokenUsage.mockResolvedValue(undefined);
  checkDailyBudget.mockReset();
  guardLLM.mockReset();
  guardLLM.mockResolvedValue({ ok: true });

  const mod = await import("@/app/api/analyze/route.js");
  POST = mod.POST;
});

describe("POST /api/analyze — Wave 11 pre-check budget diario", () => {
  it("402 BUDGET_EXCEEDED quando user passou do cap diario", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    // enforceUsage OK (count ainda nao bateu), mas budget USD ja estourou.
    checkDailyBudget.mockResolvedValue({
      ok: false,
      used: 0.12,
      cap: 0.1,
      remaining: 0,
      plan: "free",
    });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(402);
    const data = await r.json();
    expect(data.code).toBe("BUDGET_EXCEEDED");
    expect(data.used).toBeCloseTo(0.12);
    expect(data.cap).toBe(0.1);
    // LLM NAO foi chamado — cost amplification bloqueado antes.
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("dispara audit SECURITY_BUDGET_EXCEEDED no pre-check", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    checkDailyBudget.mockResolvedValue({
      ok: false,
      used: 0.15,
      cap: 0.1,
      remaining: 0,
      plan: "free",
    });
    await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(audit).toHaveBeenCalledTimes(1);
    const call = audit.mock.calls[0][0];
    expect(call.action).toBe("SECURITY_BUDGET_EXCEEDED");
    expect(call.userId).toBe("u1");
    expect(call.meta.feature).toBe("analyze");
    expect(call.meta.used).toBeCloseTo(0.15);
    expect(call.meta.cap).toBe(0.1);
    // Meta NAO contem PII raw (cv, role) — so metadados financeiros.
    expect(JSON.stringify(call.meta)).not.toContain("Maria");
  });

  it("anonimo NAO ativa pre-check de budget (sem userId)", async () => {
    auth.mockResolvedValue(null); // anonimo
    completeJSONWithUsage.mockResolvedValue({
      result: {
        perfil: { nome: "X", cargo_atual: "Y", senioridade: "z", skills: [] },
        sub_scores_explicacoes: {},
        gaps: [],
      },
      usage: { tokensIn: 100, tokensOut: 50, costUsd: 0 },
    });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    // Anonimo passa pelo LLM (sem budget aplicado). 200 efemero.
    expect(r.status).toBe(200);
    expect(checkDailyBudget).not.toHaveBeenCalled();
  });

  it("budget OK no pre-check NAO bloqueia — LLM e chamado normalmente", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    checkDailyBudget.mockResolvedValue({
      ok: true,
      used: 0.05,
      cap: 0.1,
      remaining: 0.05,
      plan: "free",
    });
    completeJSONWithUsage.mockResolvedValue({
      result: {
        perfil: { nome: "X", cargo_atual: "Y", senioridade: "z", skills: [] },
        sub_scores_explicacoes: {},
        gaps: [],
      },
      usage: { tokensIn: 100, tokensOut: 50, costUsd: 0.001 },
    });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(200);
    expect(completeJSONWithUsage).toHaveBeenCalledTimes(1);
    // Trackou tokens DEPOIS do LLM (Wave 11).
    expect(trackTokenUsage).toHaveBeenCalledWith(
      "u1",
      "analyze",
      expect.objectContaining({ tokensIn: 100, tokensOut: 50, costUsd: 0.001 })
    );
  });

  it("budget pos-LLM excedido dispara audit (defesa em camadas)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    // Pre-check passa, mas pos-LLM estoura.
    checkDailyBudget
      .mockResolvedValueOnce({
        ok: true,
        used: 0.09,
        cap: 0.1,
        remaining: 0.01,
        plan: "free",
      })
      .mockResolvedValueOnce({
        ok: false,
        used: 0.105,
        cap: 0.1,
        remaining: 0,
        plan: "free",
      });
    completeJSONWithUsage.mockResolvedValue({
      result: {
        perfil: { nome: "X", cargo_atual: "Y", senioridade: "z", skills: [] },
        sub_scores_explicacoes: {},
        gaps: [],
      },
      usage: { tokensIn: 1000, tokensOut: 500, costUsd: 0.015 },
    });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    // Resposta continua 200 — usuario nao paga por nosso erro de cap apertado.
    expect(r.status).toBe(200);
    // Audit log SECURITY_BUDGET_EXCEEDED com phase post-llm.
    const securityCalls = audit.mock.calls.filter(
      (c) => c[0].action === "SECURITY_BUDGET_EXCEEDED"
    );
    expect(securityCalls.length).toBeGreaterThanOrEqual(1);
    const post = securityCalls.find((c) => c[0].meta?.phase === "post-llm");
    expect(post).toBeDefined();
    expect(post[0].meta.feature).toBe("analyze");
  });
});
