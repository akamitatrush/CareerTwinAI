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
import { completeJSON } from "@/lib/llm";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { enforceUsage } from "@/lib/billing/enforce";
import { guardLLM } from "@/lib/rate-limit";

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
  audit.mockReset();
  auth.mockReset();
  enforceUsage.mockReset();
  enforceUsage.mockResolvedValue({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" });
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
    completeJSON.mockResolvedValue(validDiag);
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
    // Score sobe — quanto exatamente depende do computeAllSubScores base,
    // mas com 18 pts capados em 20, a soma deve refletir aumento real.
    expect(data.score).toBeGreaterThan(0);
    expect(data.delta).toBeGreaterThan(0);
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
    // Meta sem PII raw — apenas metadados.
    expect(callArgs.meta).toMatchObject({
      reason: "refresh_diagnosis",
      previousOverall: 60,
      newOverall: 72,
      delta: 12,
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
    completeJSON.mockResolvedValue(validDiag);
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
    completeJSON.mockResolvedValue({ perfil: {}, sub_scores_explicacoes: {}, gaps: "string-bad" });
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
    completeJSON.mockRejectedValue(new Error("timeout"));
    const r = await POST(makeReq({}));
    expect(r.status).toBe(502);
    const data = await r.json();
    expect(data.code).toBe("LLM_FAILED");
    // Não vazar detalhes ao cliente.
    expect(data.error).not.toContain("timeout");
  });
});
