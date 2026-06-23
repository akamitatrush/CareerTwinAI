// Integration tests da rota POST /api/tailor.
//
// Cobertura:
//  - 400 BAD_JSON / ROLE_REQUIRED / CV_TOO_SHORT / JOB_REQUIRED / INVALID_INPUT
//  - 402 LIMIT_REACHED (Free atinge limite tailor)
//  - 429 quando guardLLM nega
//  - 502 LLM_FAILED quando completeJSON lanca
//  - 200 anonimo: NAO persiste TailoredCv (sem userId, fail-closed)
//  - 200 autenticado: persiste TailoredCv linkado ou ad-hoc
//  - applicationId valido cria TailoredCv com applicationId; invalido (de outro user) ignora silenciosamente
//  - Persistencia falha NAO derruba a resposta (LLM ja gastou tokens)
//
// Mocks: prisma, LLM, audit, auth, billing, rate-limit.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeReq } from "../helpers/api.js";

vi.mock("@/lib/db", () => {
  const mock = {
    application: { findUnique: vi.fn() },
    tailoredCv: { create: vi.fn() },
  };
  return { prisma: mock };
});

vi.mock("@/lib/llm", () => ({
  completeJSON: vi.fn(),
  completeJSONWithUsage: vi.fn(),
}));
vi.mock("@/lib/prompts", () => ({
  promptTailor: vi.fn(() => ({ system: "sys", user: "usr" })),
}));
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

import { prisma } from "@/lib/db";
import { completeJSON, completeJSONWithUsage } from "@/lib/llm";
import { auth } from "@/lib/auth";
import {
  enforceUsage,
  trackTokenUsage,
  checkDailyBudget,
} from "@/lib/billing/enforce";
import { guardLLM } from "@/lib/rate-limit";

const VALID_CV = "Maria, dev backend ha 5 anos. Trabalhou com Python e SQL em empresas grandes brasileiras.";
const VALID_VAGA = {
  titulo: "Backend Senior",
  empresa: "ACME",
  descricao: "Empresa SaaS BR procurando dev backend pleno-senior com Python e PostgreSQL.",
};
const VALID_TAILOR_RESULT = {
  resumo_adaptado: "Backend dev com 5 anos focando em Python/PostgreSQL.",
  bullets: [
    { texto: "Construiu APIs REST em Django + PostgreSQL atendendo 100k MAU.", tipo: "nova" },
  ],
  observacao: "Otimizado pro keyword 'Python'.",
};

let POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.application.findUnique.mockReset();
  prisma.tailoredCv.create.mockReset();
  completeJSON.mockReset();
  completeJSONWithUsage.mockReset();
  auth.mockReset();
  enforceUsage.mockReset();
  enforceUsage.mockResolvedValue({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" });
  trackTokenUsage.mockReset();
  trackTokenUsage.mockResolvedValue(undefined);
  checkDailyBudget.mockReset();
  checkDailyBudget.mockResolvedValue({ ok: true, used: 0, cap: 100 });
  guardLLM.mockReset();
  guardLLM.mockResolvedValue({ ok: true });

  const mod = await import("@/app/api/tailor/route.js");
  POST = mod.POST;
});

describe("POST /api/tailor — input validation", () => {
  it("400 BAD_JSON com body invalido", async () => {
    auth.mockResolvedValue(null);
    const req = new Request("http://test.local/api/tailor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json{",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("BAD_JSON");
  });

  it("400 ROLE_REQUIRED quando role vazio", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ cv: VALID_CV, role: "", vaga: VALID_VAGA }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("ROLE_REQUIRED");
  });

  it("400 CV_TOO_SHORT quando cv abaixo de 60 chars", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ cv: "abc", role: "Backend", vaga: VALID_VAGA }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("CV_TOO_SHORT");
  });

  it("400 JOB_REQUIRED quando vaga ausente", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("JOB_REQUIRED");
  });
});

describe("POST /api/tailor — gates billing e rate-limit", () => {
  it("429 quando guardLLM nega", async () => {
    auth.mockResolvedValue(null);
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend", vaga: VALID_VAGA }));
    expect(r.status).toBe(429);
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("402 LIMIT_REACHED quando enforceUsage nega (Free)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    enforceUsage.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      limit: 1,
      plan: "free",
    });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend", vaga: VALID_VAGA }));
    expect(r.status).toBe(402);
    const data = await r.json();
    expect(data.code).toBe("LIMIT_REACHED");
    expect(data.feature).toBe("tailor");
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("anonimo NAO chama enforceUsage", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_TAILOR_RESULT, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend", vaga: VALID_VAGA }));
    expect(r.status).toBe(200);
    expect(enforceUsage).not.toHaveBeenCalled();
  });
});

describe("POST /api/tailor — LLM e persistencia", () => {
  it("502 LLM_FAILED quando completeJSON lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockRejectedValue(new Error("timeout"));
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend", vaga: VALID_VAGA }));
    expect(r.status).toBe(502);
    const data = await r.json();
    expect(data.code).toBe("LLM_FAILED");
    expect(data.error).not.toContain("timeout");
  });

  it("200 anonimo: retorna data SEM tailoredCvId (nao persiste)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_TAILOR_RESULT, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend", vaga: VALID_VAGA }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.tailoredCvId).toBeNull();
    expect(data.resumo_adaptado).toBe(VALID_TAILOR_RESULT.resumo_adaptado);
    expect(prisma.tailoredCv.create).not.toHaveBeenCalled();
  });

  it("200 autenticado: persiste TailoredCv + retorna id", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: VALID_TAILOR_RESULT, usage: { inputTokens: 100, outputTokens: 50 } });
    prisma.tailoredCv.create.mockResolvedValue({ id: "tcv-1" });
    const r = await POST(
      makeReq({
        cv: VALID_CV,
        role: "Backend",
        vaga: VALID_VAGA,
        vagaTitulo: "Backend Senior",
        vagaEmpresa: "ACME",
      })
    );
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.tailoredCvId).toBe("tcv-1");
    expect(prisma.tailoredCv.create).toHaveBeenCalledTimes(1);
    const args = prisma.tailoredCv.create.mock.calls[0][0];
    expect(args.data.userId).toBe("u1");
    expect(args.data.applicationId).toBeNull();
    expect(args.data.vagaTitulo).toBe("Backend Senior");
    expect(args.data.beforeText).toBe(VALID_CV);
  });

  it("applicationId valido (do mesmo user) e gravado", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: VALID_TAILOR_RESULT, usage: { inputTokens: 100, outputTokens: 50 } });
    prisma.application.findUnique.mockResolvedValue({ userId: "u1" });
    prisma.tailoredCv.create.mockResolvedValue({ id: "tcv-1" });
    await POST(
      makeReq({
        cv: VALID_CV,
        role: "Backend",
        vaga: VALID_VAGA,
        applicationId: "app-1",
      })
    );
    const args = prisma.tailoredCv.create.mock.calls[0][0];
    expect(args.data.applicationId).toBe("app-1");
  });

  it("applicationId de OUTRO user e ignorado silenciosamente (IDOR-safe)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: VALID_TAILOR_RESULT, usage: { inputTokens: 100, outputTokens: 50 } });
    // App existe mas pertence a outro user.
    prisma.application.findUnique.mockResolvedValue({ userId: "outro" });
    prisma.tailoredCv.create.mockResolvedValue({ id: "tcv-1" });
    await POST(
      makeReq({
        cv: VALID_CV,
        role: "Backend",
        vaga: VALID_VAGA,
        applicationId: "app-de-outro",
      })
    );
    // applicationId virou null (nao stranger-link).
    const args = prisma.tailoredCv.create.mock.calls[0][0];
    expect(args.data.applicationId).toBeNull();
  });

  it("persistencia falha NAO derruba resposta (graceful degradation)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: VALID_TAILOR_RESULT, usage: { inputTokens: 100, outputTokens: 50 } });
    prisma.tailoredCv.create.mockRejectedValue(new Error("DB pool exhausted"));
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend", vaga: VALID_VAGA }));
    // 200 porque o LLM ja gerou — apenas tailoredCvId fica null.
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.tailoredCvId).toBeNull();
    expect(data.resumo_adaptado).toBeDefined();
  });
});
