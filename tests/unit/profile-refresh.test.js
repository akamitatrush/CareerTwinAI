// Tests da rota POST /api/profile/refresh.
//
// Cobertura:
//  - 401 quando sem sessão (anti IDOR — userId NUNCA vem do body)
//  - 400 NO_RAW_CV se profile sem rawCv (TTL expirou ou nunca colou)
//  - 400 NO_RAW_CV se rawCvRedactedAt setado (cron de redact-cv apagou)
//  - 400 NO_TARGET_ROLE quando targetRole é null
//  - 402 LIMIT_REACHED quando enforceUsage bloqueia
//  - 429 quando guardLLM bloqueia
//  - applyCompletedSkills=true adiciona habilidades das gaps concluídas
//  - applyCompletedSkills=false NÃO modifica Profile.skills
//  - delta computado contra snapshot anterior
//  - audit() chamado com action PROFILE_UPDATED
//  - body extra rejeitado (strict() — anti smuggling)
//
// Mocks: prisma, LLM, audit, auth, billing, rate-limit, jobs, scoring.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => {
  const mock = {
    profile: { findUnique: vi.fn(), update: vi.fn() },
    scoreSnapshot: { findFirst: vi.fn(), create: vi.fn() },
    gap: { createMany: vi.fn() },
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

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/billing/enforce", () => ({
  enforceUsage: vi.fn(async () => ({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" })),
  // Wave 11: trackTokenUsage + checkDailyBudget
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
  searchJobs: vi.fn(async () => ({ jobs: [] })),
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

// Helper pra emitir o shape novo de completeJSONWithUsage ({ result, usage }).
const withUsage = (result) => ({
  result,
  usage: { tokensIn: 100, tokensOut: 50, costUsd: 0 },
});

// LLM diag shape válido (mínimo) — extraído depois de DiagShape.safeParse.
const validDiag = {
  perfil: {
    nome: "Maria",
    cargo_atual: "Dev Pleno",
    senioridade: "pleno",
    skills: ["python", "sql"],
  },
  sub_scores_explicacoes: {
    aderencia_vagas: "Skills batem com 70% do mercado. [Mercado]",
    relevancia_habilidades: "Skills declaradas são modernas. [Currículo]",
    otimizacao_perfil: "Falta LinkedIn no perfil. [Currículo]",
    experiencia_mercado: "5 anos como pleno. [Currículo]",
  },
  gaps: [
    {
      habilidade: "kubernetes",
      porque: "60% das vagas pedem",
      frequencia: "60%",
      microacao: "Curso CKAD 8h",
      impacto: { dimensao: "aderencia_vagas", pontos: 5 },
    },
  ],
};

function makeReq(body) {
  return new Request("https://x.test/api/profile/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : "",
  });
}

let POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.profile.findUnique.mockReset();
  prisma.profile.update.mockReset();
  prisma.scoreSnapshot.findFirst.mockReset();
  prisma.scoreSnapshot.create.mockReset();
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

  const mod = await import("@/app/api/profile/refresh/route.js");
  POST = mod.POST;
});

describe("POST /api/profile/refresh — auth & input", () => {
  it("401 quando sessão ausente", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({}));
    expect(r.status).toBe(401);
    const data = await r.json();
    expect(data.code).toBe("UNAUTHORIZED");
    // Não toca prisma se nem autenticou.
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
  });

  it("400 NO_RAW_CV quando Profile.rawCv ausente", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({
      rawCv: null,
      rawCvRedactedAt: null,
      targetRole: "Backend",
    });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("NO_RAW_CV");
    expect(data.redirectTo).toBe("/");
    // findUnique foi escopado por userId (anti IDOR).
    expect(prisma.profile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
  });

  it("400 NO_RAW_CV quando rawCvRedactedAt preenchido (cron apagou)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({
      rawCv: "cv text...",
      rawCvRedactedAt: new Date(),
      targetRole: "Backend",
    });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("NO_RAW_CV");
  });

  it("400 NO_TARGET_ROLE quando targetRole null", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({
      rawCv: "Maria, dev backend há 5 anos com Python.",
      rawCvRedactedAt: null,
      targetRole: null,
    });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("NO_TARGET_ROLE");
    expect(data.redirectTo).toBe("/conta");
  });

  it("400 INVALID_INPUT quando body tem campo extra (strict)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(makeReq({ applyCompletedSkills: true, userId: "outro-user" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_INPUT");
  });

  it("402 LIMIT_REACHED quando enforceUsage nega", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    enforceUsage.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      limit: 3,
      plan: "free",
      reason: "limit_reached",
    });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(402);
    const data = await r.json();
    expect(data.code).toBe("LIMIT_REACHED");
    expect(data.plan).toBe("free");
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
  });

  it("429 quando guardLLM nega (rate limit)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(429);
    // Não chega a tocar enforce nem prisma.
    expect(enforceUsage).not.toHaveBeenCalled();
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/profile/refresh — fluxo de sucesso", () => {
  function setupOk({ previousOverall = 65, completedGaps = [], existingSkills = ["python"] } = {}) {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({
      rawCv: "Maria, dev backend há 5 anos. Trabalhou com Python e SQL.",
      rawCvRedactedAt: null,
      targetRole: "Engenheiro Backend",
      perfilJson: { nome: "Maria", skills: existingSkills },
      skills: existingSkills,
      nome: "Maria",
      cargoAtual: "Dev Pleno",
      senioridade: "pleno",
    });
    prisma.scoreSnapshot.findFirst.mockResolvedValue({
      id: "snap-prev",
      overall: previousOverall,
      gaps: completedGaps,
    });
    completeJSONWithUsage.mockResolvedValue(withUsage(validDiag));
    prisma.scoreSnapshot.create.mockResolvedValue({
      id: "snap-new",
      overall: 72,
      gaps: validDiag.gaps,
    });
  }

  it("retorna ok=true com snapshotId, score, delta e appliedSkills vazio", async () => {
    setupOk({ previousOverall: 60 });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.snapshotId).toBe("snap-new");
    expect(data.score).toBe(72);
    expect(data.previousScore).toBe(60);
    expect(data.delta).toBe(12); // 72 - 60
    expect(data.appliedSkills).toEqual([]);
  });

  it("aceita body vazio (sem applyCompletedSkills) e NÃO atualiza Profile.skills", async () => {
    setupOk({ previousOverall: 70, existingSkills: ["python"] });
    const r = await POST(makeReq()); // body literalmente vazio
    expect(r.status).toBe(200);
    // applyCompletedSkills default false => profile.update NÃO chamado.
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it("applyCompletedSkills=true mescla habilidades das gaps concluídas em Profile.skills", async () => {
    setupOk({
      previousOverall: 60,
      existingSkills: ["python"],
      completedGaps: [
        { habilidade: "kubernetes", completedAt: new Date() },
        { habilidade: "Docker", completedAt: new Date() },
        { habilidade: "graphql", completedAt: null }, // nao concluida — ignorada
      ],
    });
    const r = await POST(makeReq({ applyCompletedSkills: true }));
    expect(r.status).toBe(200);
    const data = await r.json();
    // applied = skills das gaps concluídas que NÃO estavam no perfil ainda.
    expect(data.appliedSkills).toEqual(expect.arrayContaining(["kubernetes", "Docker"]));
    expect(data.appliedSkills).not.toContain("graphql");
    // Profile.update foi chamado com skills mescladas (case-insensitive dedup).
    expect(prisma.profile.update).toHaveBeenCalledTimes(1);
    const updateArg = prisma.profile.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ userId: "u1" });
    expect(updateArg.data.skills).toEqual(expect.arrayContaining(["python", "kubernetes", "Docker"]));
  });

  it("applyCompletedSkills=true sem gaps concluídas: NÃO toca Profile (appliedSkills vazio)", async () => {
    setupOk({ previousOverall: 60, completedGaps: [] });
    const r = await POST(makeReq({ applyCompletedSkills: true }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.appliedSkills).toEqual([]);
    // Sem nada novo pra aplicar — não chama update.
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it("applyCompletedSkills=true com impactoPontos aplica bonus deterministico ao score", async () => {
    // Quando user marca gap concluida e ela tem impactoDimensao+impactoPontos,
    // o refresh aplica bonus aos sub-scores correspondentes. Sem esse bonus,
    // o score nunca subia (bug reportado pelo user: "marco done, score nao
    // muda, mesmo gap volta na lista, marco de novo, loop infinito").
    setupOk({
      previousOverall: 60,
      existingSkills: ["python"],
      completedGaps: [
        {
          habilidade: "Discovery de Produto",
          completedAt: new Date(),
          impactoDimensao: "aderencia_vagas",
          impactoPontos: 10,
        },
        {
          habilidade: "Metricas de IA",
          completedAt: new Date(),
          impactoDimensao: "relevancia_habilidades",
          impactoPontos: 8,
        },
      ],
    });
    const r = await POST(makeReq({ applyCompletedSkills: true }));
    expect(r.status).toBe(200);
    const data = await r.json();
    // Base computed.overall=72 (mock). Bonus aplicado = 10 + 8 = 18 pts (sob
    // o cap de 25 total e 15 por dimensao). Overall recalculado:
    //   aderencia: 70+10=80 (0.4) + relevancia: 75+8=83 (0.3) + otim: 80 (0.2)
    //   + exp: 65 (0.1) = 32 + 24.9 + 16 + 6.5 = 79.4 -> 79.
    expect(data.score).toBe(79);
    expect(data.delta).toBe(19); // 79 - 60
  });

  it("Fix bug do loop: gap SEM impactoPontos/impactoDimensao ainda gera bonus default", async () => {
    // Gaps de snapshots antigos podiam vir sem impactoPontos/impactoDimensao
    // (LLM inconsistente). Bug: bloco "if (g.impactoDimensao && g.impactoPontos)"
    // pulava esses gaps -> projectedGains continuava 0 -> bonus 0 -> overall
    // base do computeAllSubScores nao subia -> score parecia nao mudar.
    // Fix: default DEFAULT_BONUS_PTS=5 em DEFAULT_BONUS_DIM=relevancia_habilidades.
    setupOk({
      previousOverall: 60,
      existingSkills: ["python"],
      completedGaps: [
        { habilidade: "Algo Antigo", completedAt: new Date() }, // sem impacto*
        { habilidade: "Outra Skill", completedAt: new Date() }, // sem impacto*
      ],
    });
    const r = await POST(makeReq({ applyCompletedSkills: true }));
    expect(r.status).toBe(200);
    const data = await r.json();
    // Default: 5 pts cada -> 10 pts em relevancia_habilidades (sob cap 15).
    // relevancia base = 75 + 10 = 85. Overall recalc:
    //   70*0.4 + 85*0.3 + 80*0.2 + 65*0.1 = 28 + 25.5 + 16 + 6.5 = 76.
    expect(data.score).toBe(76);
    expect(data.delta).toBe(16); // 76 - 60 (subiu em vez de ficar igual)
  });

  it("dimensao invalida no gap cai pra default relevancia_habilidades", async () => {
    // Defesa: se gap tem impactoDimensao com string fora do enum (DB legacy,
    // bug de migracao, LLM com escape), nao explode — usa default.
    setupOk({
      previousOverall: 60,
      completedGaps: [
        {
          habilidade: "skill X",
          completedAt: new Date(),
          impactoDimensao: "dimensao_inexistente",
          impactoPontos: 7,
        },
      ],
    });
    const r = await POST(makeReq({ applyCompletedSkills: true }));
    expect(r.status).toBe(200);
    const data = await r.json();
    // 7 pts -> relevancia_habilidades (default). 75 + 7 = 82.
    // 70*0.4 + 82*0.3 + 80*0.2 + 65*0.1 = 28 + 24.6 + 16 + 6.5 = 75.1 -> 75.
    expect(data.score).toBe(75);
  });

  it("cap total 25 pts: 3 gaps de 10 pts em dimensoes diferentes geram bonus de 25 (nao 30)", async () => {
    // Cap impede gaming. Quando soma supera MAX_TOTAL_BONUS, aplica os primeiros
    // gains ate o cap (ordem deterministica por gain desc).
    setupOk({
      previousOverall: 60,
      completedGaps: [
        { habilidade: "a", completedAt: new Date(), impactoDimensao: "aderencia_vagas", impactoPontos: 10 },
        { habilidade: "b", completedAt: new Date(), impactoDimensao: "relevancia_habilidades", impactoPontos: 10 },
        { habilidade: "c", completedAt: new Date(), impactoDimensao: "otimizacao_perfil", impactoPontos: 10 },
      ],
    });
    const r = await POST(makeReq({ applyCompletedSkills: true }));
    expect(r.status).toBe(200);
    const data = await r.json();
    // Total bonus aplicado = 25 (cap). Distribuicao deterministica:
    //   ordem por gain desc (todos 10) -> aplica 10 em aderencia, 10 em relevancia,
    //   5 em otimizacao (cap esgotado).
    //   aderencia: 70+10=80 (0.4)=32, relevancia: 75+10=85 (0.3)=25.5,
    //   otimizacao: 80+5=85 (0.2)=17, experiencia: 65 (0.1)=6.5
    //   total = 32 + 25.5 + 17 + 6.5 = 81.
    expect(data.score).toBe(81);
    expect(data.delta).toBe(21);
  });

  it("applyCompletedSkills=true dedup case-insensitive (não duplica 'Python' se 'python' existe)", async () => {
    setupOk({
      previousOverall: 60,
      existingSkills: ["python"],
      completedGaps: [{ habilidade: "Python", completedAt: new Date() }],
    });
    const r = await POST(makeReq({ applyCompletedSkills: true }));
    expect(r.status).toBe(200);
    const data = await r.json();
    // 'Python' === 'python' (case-insensitive) — não aplica.
    expect(data.appliedSkills).toEqual([]);
    expect(prisma.profile.update).not.toHaveBeenCalled();
  });

  it("audit() chamado com action PROFILE_UPDATED + meta sanitizado", async () => {
    setupOk({
      previousOverall: 60,
      completedGaps: [{ habilidade: "k8s", completedAt: new Date() }],
    });
    await POST(makeReq({ applyCompletedSkills: true }));
    expect(audit).toHaveBeenCalledTimes(1);
    const callArgs = audit.mock.calls[0][0];
    expect(callArgs.userId).toBe("u1");
    expect(callArgs.action).toBe("PROFILE_UPDATED");
    expect(callArgs.target).toBe("ScoreSnapshot:snap-new");
    // Meta sem PII raw — apenas metadados. Bonus default 5 pts (gap sem
    // impactoPontos) cai em relevancia_habilidades, recalcula overall.
    expect(callArgs.meta).toMatchObject({
      reason: "refresh_diagnosis",
      previousOverall: 60,
      newOverall: 75,
      delta: 15,
      appliedSkillsCount: 1,
      applyCompletedSkills: true,
    });
    // Confirma que meta NÃO contém rawCv ou outro PII.
    expect(JSON.stringify(callArgs.meta)).not.toContain("Maria, dev backend");
  });

  it("delta=0 quando previousSnapshot ausente (primeiro refresh)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({
      rawCv: "CV text completo aqui pra teste com tamanho suficiente.",
      rawCvRedactedAt: null,
      targetRole: "Backend",
      perfilJson: {},
      skills: [],
      nome: null,
      cargoAtual: null,
      senioridade: null,
    });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue(withUsage(validDiag));
    prisma.scoreSnapshot.create.mockResolvedValue({ id: "snap-1", overall: 72 });
    const r = await POST(makeReq({}));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.previousScore).toBe(0);
    expect(data.delta).toBe(72);
  });
});

describe("POST /api/profile/refresh — defesas LLM", () => {
  it("502 LLM_INVALID quando LLM retorna shape inválido (não persiste)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({
      rawCv: "CV text completo aqui pra teste.",
      rawCvRedactedAt: null,
      targetRole: "Backend",
      perfilJson: {},
      skills: [],
    });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    // Shape inválido — gaps deveria ser array, mas mandamos string.
    completeJSONWithUsage.mockResolvedValue(
      withUsage({ perfil: {}, sub_scores_explicacoes: {}, gaps: "string-bad" })
    );
    const r = await POST(makeReq({}));
    expect(r.status).toBe(502);
    const data = await r.json();
    expect(data.code).toBe("LLM_INVALID");
    // Nada foi criado.
    expect(prisma.scoreSnapshot.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("502 LLM_FAILED quando completeJSON lança", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.profile.findUnique.mockResolvedValue({
      rawCv: "CV text aqui.",
      rawCvRedactedAt: null,
      targetRole: "Backend",
      perfilJson: {},
      skills: [],
    });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    completeJSONWithUsage.mockRejectedValue(new Error("timeout"));
    const r = await POST(makeReq({}));
    expect(r.status).toBe(502);
    const data = await r.json();
    expect(data.code).toBe("LLM_FAILED");
    // Não vazar detalhes ao cliente.
    expect(data.error).not.toContain("timeout");
  });
});
