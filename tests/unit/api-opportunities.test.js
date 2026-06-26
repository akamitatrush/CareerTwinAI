// Integration tests da rota POST /api/opportunities.
//
// Cobertura:
//  - 400 BAD_JSON / INVALID_INPUT / PROFILE_REQUIRED
//  - 402 LIMIT_REACHED (Free atinge limite buscas/dia)
//  - 429 quando guardLLM nega
//  - 404 SNAPSHOT_NOT_FOUND quando snapshot e de OUTRO user (IDOR)
//  - Anonimo PASSA (sem enforce, so rate-limit) com role+perfil
//  - 200 happy path com jobs e match
//  - withPlan=false economiza chamada LLM de plano
//  - LLM falhar nao quebra resposta (fallback deterministico)
//
// Mocks: prisma, LLM, auth, billing, rate-limit, jobs, skills-taxonomy.
// Route usa completeJSONWithUsage (Wave 11) — mocks correspondentes.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeReq } from "../helpers/api.js";

vi.mock("@/lib/db", () => {
  const mock = {
    scoreSnapshot: { findFirst: vi.fn() },
    planItem: { createMany: vi.fn(), deleteMany: vi.fn() },
  };
  return { prisma: mock };
});

vi.mock("@/lib/llm", () => ({
  completeJSON: vi.fn(),
  completeJSONWithUsage: vi.fn(),
}));
vi.mock("@/lib/prompts", () => ({
  promptOpp: vi.fn(() => ({ system: "sys", user: "usr" })),
  promptOppReal: vi.fn(() => ({ system: "sys", user: "usr" })),
  promptPlano: vi.fn(() => ({ system: "sys", user: "usr" })),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/billing/enforce", () => ({
  enforceUsage: vi.fn(async () => ({ ok: true, remaining: 99, limit: 100, plan: "pro_monthly" })),
  // Wave 11: trackTokenUsage + checkDailyBudget
  trackTokenUsage: vi.fn(async () => undefined),
  checkDailyBudget: vi.fn(async () => ({ ok: true, used: 0, cap: 100 })),
}));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
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
vi.mock("@/lib/skills-taxonomy", () => ({
  extractSkills: vi.fn(() => ["python", "sql"]),
  matchScore: vi.fn(() => ({ match: 80, comuns: ["python"], falta: ["docker"] })),
}));

import { prisma } from "@/lib/db";
import { completeJSONWithUsage } from "@/lib/llm";
import { auth } from "@/lib/auth";
import {
  enforceUsage,
  trackTokenUsage,
  checkDailyBudget,
} from "@/lib/billing/enforce";
import { guardLLM } from "@/lib/rate-limit";
import { searchJobs } from "@/lib/jobs";

// Helper pra emitir o shape novo de completeJSONWithUsage ({ result, usage }).
// Mantemos usage com tokens nominais (>0) pra ativar o code path de tracking,
// mas costUsd=0 pra nao precisar tunar mocks de checkDailyBudget.
const withUsage = (result) => ({
  result,
  usage: { tokensIn: 100, tokensOut: 50, costUsd: 0 },
});

const VALID_PERFIL = {
  nome: "Maria",
  cargo_atual: "Dev Backend",
  skills: ["python", "sql"],
};

const SAMPLE_JOBS = [
  {
    id: "j1",
    titulo: "Backend Senior Python",
    empresa: "ACME",
    descricao: "Python + SQL",
    source: "adzuna",
    url: "https://adzuna.com/j1",
  },
  {
    id: "j2",
    titulo: "Backend Pleno",
    empresa: "Foo",
    descricao: "SQL + Python",
    source: "adzuna",
    url: "https://adzuna.com/j2",
  },
];

let POST;

beforeEach(async () => {
  vi.resetModules();
  prisma.scoreSnapshot.findFirst.mockReset();
  prisma.planItem.createMany.mockReset();
  prisma.planItem.deleteMany.mockReset();
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
  searchJobs.mockReset();
  searchJobs.mockResolvedValue({ jobs: SAMPLE_JOBS, sources: [], counts: {} });

  const mod = await import("@/app/api/opportunities/route.js");
  POST = mod.POST;
});

describe("POST /api/opportunities — input validation", () => {
  it("400 BAD_JSON com body invalido", async () => {
    auth.mockResolvedValue(null);
    const req = new Request("http://test.local/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("BAD_JSON");
  });

  it("400 PROFILE_REQUIRED sem role nem snapshot", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({})); // sem role/perfil
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("PROFILE_REQUIRED");
  });

  it("400 PROFILE_REQUIRED com role mas sem perfil", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq({ role: "Backend" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("PROFILE_REQUIRED");
  });
});

describe("POST /api/opportunities — gates billing e rate-limit", () => {
  it("429 quando guardLLM nega (aplica mesmo anonimo)", async () => {
    auth.mockResolvedValue(null);
    guardLLM.mockResolvedValueOnce({ ok: false, retryAfter: 30 });
    const r = await POST(makeReq({ role: "Backend", perfil: VALID_PERFIL }));
    expect(r.status).toBe(429);
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("402 LIMIT_REACHED quando enforceUsage nega (5 buscas/dia)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    enforceUsage.mockResolvedValueOnce({
      ok: false,
      remaining: 0,
      limit: 5,
      plan: "free",
    });
    const r = await POST(makeReq({ role: "Backend", perfil: VALID_PERFIL }));
    expect(r.status).toBe(402);
    const data = await r.json();
    expect(data.code).toBe("LIMIT_REACHED");
    expect(data.feature).toBe("opportunities");
    expect(completeJSONWithUsage).not.toHaveBeenCalled();
  });

  it("anonimo: rate-limit aplica, mas enforce nao", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue(
      withUsage({ porques: [{ id: "j1", porque: "boa" }] })
    );
    const r = await POST(makeReq({ role: "Backend", perfil: VALID_PERFIL }));
    expect(r.status).toBe(200);
    expect(enforceUsage).not.toHaveBeenCalled();
    expect(guardLLM).toHaveBeenCalled();
  });
});

describe("POST /api/opportunities — IDOR via snapshotId", () => {
  it("404 SNAPSHOT_NOT_FOUND quando snapshot e de outro user (findFirst scope-by-userId)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    // findFirst com where: { id, userId } retorna null pq snapshot e de outro user.
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    const r = await POST(
      makeReq({
        snapshotId: "snap-de-outro-user",
        role: "Backend",
        perfil: VALID_PERFIL,
      })
    );
    expect(r.status).toBe(404);
    const data = await r.json();
    expect(data.code).toBe("SNAPSHOT_NOT_FOUND");
    // Confirma escopo correto na query (anti-IDOR).
    expect(prisma.scoreSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "snap-de-outro-user", userId: "u1" },
      })
    );
  });

  it("usa snapshot dono se findFirst retorna (role/perfil vem do snapshot)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.scoreSnapshot.findFirst.mockResolvedValue({
      id: "snap-1",
      role: "Backend",
      perfilJson: VALID_PERFIL,
      gaps: [{ habilidade: "kubernetes" }],
    });
    completeJSONWithUsage.mockResolvedValue(
      withUsage({ porques: [{ id: "j1", porque: "boa" }] })
    );
    const r = await POST(makeReq({ snapshotId: "snap-1" }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(Array.isArray(data.vagas)).toBe(true);
  });
});

describe("POST /api/opportunities — happy path + filtros", () => {
  it("200 retorna vagas com match calculado", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue(
      withUsage({ porques: [{ id: "j1", porque: "boa" }] })
    );
    const r = await POST(makeReq({ role: "Backend", perfil: VALID_PERFIL }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.vagas).toBeDefined();
    expect(data.vagas.length).toBeGreaterThan(0);
    expect(data.vagas[0]).toHaveProperty("match");
    expect(data.vagas[0]).toHaveProperty("porque");
  });

  it("withPlan=false NAO chama LLM de plano (so porques)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockResolvedValue(
      withUsage({ porques: [{ id: "j1", porque: "boa" }] })
    );
    await POST(
      makeReq({ role: "Backend", perfil: VALID_PERFIL, withPlan: false })
    );
    // Sob withPlan=false, plano e Promise.resolve([]) — completeJSON e
    // chamado apenas 1x (pros porques), nao 2x (porques + plano).
    expect(completeJSONWithUsage).toHaveBeenCalledTimes(1);
  });

  it("withPlan=true (default) chama LLM 2x (porques + plano)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage
      .mockResolvedValueOnce(withUsage({ porques: [{ id: "j1", porque: "boa" }] }))
      .mockResolvedValueOnce(
        withUsage({
          plano: [{ semana: 1, foco: "Foo", acoes: [{ titulo: "A1" }] }],
        })
      );
    await POST(makeReq({ role: "Backend", perfil: VALID_PERFIL }));
    expect(completeJSONWithUsage).toHaveBeenCalledTimes(2);
  });

  it("LLM porques falha: fallback deterministico (sem 500)", async () => {
    auth.mockResolvedValue(null);
    completeJSONWithUsage.mockRejectedValue(new Error("LLM down"));
    const r = await POST(makeReq({ role: "Backend", perfil: VALID_PERFIL }));
    // Nao retorna erro — fallback constroi porques a partir de comuns/falta.
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(Array.isArray(data.vagas)).toBe(true);
    expect(data.vagas[0].porque).toBeDefined();
  });

  it("searchJobs falha: retorna lista vazia mas sem 500", async () => {
    auth.mockResolvedValue(null);
    searchJobs.mockRejectedValue(new Error("Adzuna down"));
    completeJSONWithUsage.mockResolvedValue(withUsage({ porques: [] }));
    const r = await POST(makeReq({ role: "Backend", perfil: VALID_PERFIL }));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(Array.isArray(data.vagas)).toBe(true);
  });
});

describe("POST /api/opportunities — persistencia plano", () => {
  it("salva PlanItems quando snapshot dono existe e plano nao vazio", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.scoreSnapshot.findFirst.mockResolvedValue({
      id: "snap-1",
      role: "Backend",
      perfilJson: VALID_PERFIL,
      gaps: [],
    });
    completeJSONWithUsage
      .mockResolvedValueOnce(withUsage({ porques: [{ id: "j1", porque: "p" }] }))
      .mockResolvedValueOnce(
        withUsage({
          plano: [
            {
              semana: 1,
              foco: "Foo",
              acoes: [{ titulo: "A1", impacto: "alto", esforco: "Baixo" }],
            },
          ],
        })
      );
    await POST(makeReq({ snapshotId: "snap-1" }));
    expect(prisma.planItem.deleteMany).toHaveBeenCalledWith({
      where: { snapshotId: "snap-1" },
    });
    expect(prisma.planItem.createMany).toHaveBeenCalledTimes(1);
    const args = prisma.planItem.createMany.mock.calls[0][0];
    expect(args.data[0]).toMatchObject({
      snapshotId: "snap-1",
      semana: 1,
      titulo: "A1",
    });
  });

  it("persistencia plano falha NAO derruba resposta", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.scoreSnapshot.findFirst.mockResolvedValue({
      id: "snap-1",
      role: "Backend",
      perfilJson: VALID_PERFIL,
      gaps: [],
    });
    completeJSONWithUsage
      .mockResolvedValueOnce(withUsage({ porques: [{ id: "j1", porque: "p" }] }))
      .mockResolvedValueOnce(
        withUsage({
          plano: [{ semana: 1, foco: "Foo", acoes: [{ titulo: "A1" }] }],
        })
      );
    prisma.planItem.deleteMany.mockRejectedValue(new Error("DB pool"));
    const r = await POST(makeReq({ snapshotId: "snap-1" }));
    expect(r.status).toBe(200);
  });
});
