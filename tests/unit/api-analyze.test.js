// Integration tests da rota POST /api/analyze.
//
// Cobertura:
//  - 400 BAD_JSON quando body nao e JSON valido
//  - 400 ROLE_REQUIRED / CV_TOO_SHORT / CV_TOO_LONG / INVALID_INPUT
//  - 402 LIMIT_REACHED quando enforceUsage nega (Free atinge limite)
//  - 429 quando guardLLM nega
//  - 502 LLM_INVALID quando shape do LLM nao bate com DiagShape
//  - 502 LLM_FAILED quando completeJSON lanca
//  - 200 happy path com sessao: cria Profile.upsert, ScoreSnapshot, audit, consent
//  - 200 efemero (anonimo): nao persiste, retorna efemero:true
//  - Verifica rawCvExpiresAt setado em +90 dias (LGPD TTL)
//  - audit() chamado com CV_UPLOADED em meta sanitizado
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
import { completeJSON, completeJSONWithUsage } from "@/lib/llm";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import {
  enforceUsage,
  trackTokenUsage,
  checkDailyBudget,
} from "@/lib/billing/enforce";
import { guardLLM } from "@/lib/rate-limit";

const VALID_CV = "Maria, dev backend ha 5 anos. Trabalhou com Python, SQL, Docker e AWS em empresas grandes.";
const VALID_DIAG = {
  perfil: {
    nome: "Maria",
    cargo_atual: "Dev Pleno",
    senioridade: "pleno",
    skills: ["python", "sql"],
  },
  sub_scores_explicacoes: {
    aderencia_vagas: "Boa aderencia. [Mercado]",
    relevancia_habilidades: "Skills modernas. [Curriculo]",
    otimizacao_perfil: "Bom perfil. [Curriculo]",
    experiencia_mercado: "5 anos pleno. [Curriculo]",
  },
  gaps: [
    {
      habilidade: "kubernetes",
      porque: "60% das vagas pedem",
      frequencia: "60%",
      microacao: "Curso CKAD",
      impacto: { dimensao: "aderencia_vagas", pontos: 5 },
    },
  ],
};

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
  completeJSON.mockReset();
  completeJSONWithUsage.mockReset();
  audit.mockReset();
  auth.mockReset();
  enforceUsage.mockReset();
  enforceUsage.mockResolvedValue({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" });
  trackTokenUsage.mockReset();
  trackTokenUsage.mockResolvedValue(undefined);
  checkDailyBudget.mockReset();
  checkDailyBudget.mockResolvedValue({ ok: true, used: 0, cap: 100 });
  guardLLM.mockReset();
  guardLLM.mockResolvedValue({ ok: true });

  const mod = await import("@/app/api/analyze/route.js");
  POST = mod.POST;
});

describe("POST /api/analyze — input validation", () => {
  it("400 BAD_JSON quando body nao e JSON", async () => {
    auth.mockResolvedValue(null);
    const req = new Request("http://test.local/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("BAD_JSON");
  });

  it("400 ROLE_REQUIRED quando role vazio", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ cv: VALID_CV, role: "" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("ROLE_REQUIRED");
  });

  it("400 CV_TOO_SHORT quando cv abaixo do minimo (60 chars)", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ cv: "curto", role: "Backend" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("CV_TOO_SHORT");
  });

  it("400 CV_TOO_LONG quando cv passa 40k chars", async () => {
    auth.mockResolvedValue(null);
    const longCv = "x".repeat(40_001);
    const r = await POST(makeReq({ cv: longCv, role: "Backend" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("CV_TOO_LONG");
  });
});

describe("POST /api/analyze — rate-limit e billing gates", () => {
  it("429 quando guardLLM nega", async () => {
    auth.mockResolvedValue(null);
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(429);
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("402 LIMIT_REACHED quando enforceUsage nega (so logado)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    enforceUsage.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      limit: 3,
      plan: "free",
      reason: "limit_reached",
    });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(402);
    const data = await r.json();
    expect(data.code).toBe("LIMIT_REACHED");
    expect(data.feature).toBe("analyze");
    expect(data.plan).toBe("free");
    // Nao chega a chamar LLM.
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("anonimo NAO chama enforceUsage (so rate-limit aplica)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(200);
    expect(enforceUsage).not.toHaveBeenCalled();
  });
});

describe("POST /api/analyze — defesas LLM", () => {
  it("502 LLM_INVALID quando shape invalido", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: { perfil: {}, gaps: "string-bad" }, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(502);
    const data = await r.json();
    expect(data.code).toBe("LLM_INVALID");
    // Nao persistiu nada.
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
    expect(prisma.scoreSnapshot.create).not.toHaveBeenCalled();
  });

  it("502 LLM_FAILED quando completeJSON lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockRejectedValue(new Error("upstream timeout"));
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(502);
    const data = await r.json();
    expect(data.code).toBe("LLM_FAILED");
    // Erro nao vaza pro cliente.
    expect(data.error).not.toContain("timeout");
  });
});

describe("POST /api/analyze — happy path autenticado", () => {
  function setupOk({ snapshotId = "snap-1", prevCount = 0 } = {}) {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });
    prisma.profile.upsert.mockResolvedValue({ userId: "u1" });
    prisma.scoreSnapshot.create.mockResolvedValue({
      id: snapshotId,
      overall: 72,
      gaps: VALID_DIAG.gaps,
    });
    prisma.scoreSnapshot.count.mockResolvedValue(prevCount);
    prisma.scoreSnapshot.findFirst.mockResolvedValue(
      prevCount > 0 ? { overall: 60 } : null
    );
    prisma.notification.count.mockResolvedValue(0);
  }

  it("200 retorna snapshotId, perfil, sub_scores, gaps e overall", async () => {
    setupOk();
    const r = await POST(makeReq({ cv: VALID_CV, role: "Engenheiro Backend" }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.snapshotId).toBe("snap-1");
    expect(data.overall).toBe(72);
    expect(data.gaps).toEqual(VALID_DIAG.gaps);
    expect(data.efemero).toBeUndefined();
  });

  it("Profile.upsert escopado por userId com rawCvExpiresAt em ~90 dias", async () => {
    setupOk();
    await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(prisma.profile.upsert).toHaveBeenCalledTimes(1);
    const args = prisma.profile.upsert.mock.calls[0][0];
    expect(args.where).toEqual({ userId: "u1" });
    // create + update ambos com rawCvExpiresAt em ~+90 dias.
    const createExp = args.create.rawCvExpiresAt;
    const updateExp = args.update.rawCvExpiresAt;
    const expectedMs = 90 * 24 * 60 * 60 * 1000;
    const tolerance = 60_000; // 1min de folga pro test runtime
    expect(Math.abs(createExp.getTime() - (Date.now() + expectedMs))).toBeLessThan(tolerance);
    expect(Math.abs(updateExp.getTime() - (Date.now() + expectedMs))).toBeLessThan(tolerance);
    // rawCv preservado, rawCvRedactedAt null (ciclo recomeca).
    expect(args.create.rawCv).toBe(VALID_CV);
    expect(args.update.rawCvRedactedAt).toBeNull();
  });

  it("ScoreSnapshot create traz Gaps inline com impacto", async () => {
    setupOk();
    await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    const args = prisma.scoreSnapshot.create.mock.calls[0][0];
    expect(args.data.userId).toBe("u1");
    expect(args.data.role).toBe("Backend");
    expect(args.data.overall).toBe(72);
    expect(args.data.gaps.create).toHaveLength(1);
    expect(args.data.gaps.create[0]).toMatchObject({
      habilidade: "kubernetes",
      impactoDimensao: "aderencia_vagas",
      impactoPontos: 5,
    });
  });

  it("audit() chamado com CONSENT_GRANTED + CV_UPLOADED e meta sanitizado (sem rawCv bruto)", async () => {
    setupOk();
    await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    // Galadriel v4 (Wave 11): consent.create no fluxo LGPD agora emite audit
    // CONSENT_GRANTED tambem. Esperamos 2 calls: consent e cv_uploaded.
    expect(audit).toHaveBeenCalledTimes(2);
    const consentCall = audit.mock.calls.find((c) => c[0].action === "CONSENT_GRANTED");
    expect(consentCall).toBeTruthy();
    expect(consentCall[0].userId).toBe("u1");
    expect(consentCall[0].target).toBe("Consent:u1");
    expect(consentCall[0].meta).toMatchObject({ source: "CV_PASTE" });
    const uploadCall = audit.mock.calls.find((c) => c[0].action === "CV_UPLOADED");
    expect(uploadCall).toBeTruthy();
    expect(uploadCall[0].userId).toBe("u1");
    expect(uploadCall[0].target).toBe("Profile:u1");
    expect(uploadCall[0].meta).toMatchObject({
      kind: "CV_PASTE",
      snapshotId: "snap-1",
    });
    expect(uploadCall[0].meta.sizeBytes).toBeGreaterThan(0);
    // Nada de PII raw no meta.
    expect(JSON.stringify(uploadCall[0].meta)).not.toContain("Maria");
  });

  it("consent + dataSource criados em transaction (rastro LGPD)", async () => {
    setupOk();
    await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    // dataSource recebe kind=CV_PASTE escopado por userId.
    expect(prisma.dataSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "u1", kind: "CV_PASTE" }),
      })
    );
    // consent recebe payloadHash (sha256 do cv).
    expect(prisma.consent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          source: "CV_PASTE",
          payloadHash: expect.any(String),
        }),
      })
    );
  });
});

describe("POST /api/analyze — efemero (anonimo)", () => {
  it("200 retorna efemero:true sem persistir", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.efemero).toBe(true);
    expect(data.snapshotId).toBeNull();
    // Persistencia nao acontece.
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
    expect(prisma.scoreSnapshot.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});

describe("POST /api/analyze — DB failure no persist", () => {
  it("500 PERSIST_FAILED se profile.upsert lanca", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    completeJSONWithUsage.mockResolvedValue({ result: VALID_DIAG, usage: { inputTokens: 100, outputTokens: 50 } });
    prisma.profile.upsert.mockRejectedValue(new Error("DB pool exhausted"));
    const r = await POST(makeReq({ cv: VALID_CV, role: "Backend" }));
    expect(r.status).toBe(500);
    const data = await r.json();
    expect(data.code).toBe("PERSIST_FAILED");
    // Erro nao vaza.
    expect(data.error).not.toContain("DB pool");
  });
});
