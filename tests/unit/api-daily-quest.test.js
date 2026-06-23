// Tests da rota /api/me/daily-quest (GET + POST /complete).
//
// Cobertura:
//  - GET 401 sem sessao
//  - GET sem quest existente cria nova (lazy create) e retorna
//  - GET com quest existente retorna a MESMA (idempotente)
//  - GET IDOR-safe: userId vem da sessao, where escopa por dono
//  - POST /complete 401 sem sessao
//  - POST /complete marca completedAt
//  - POST /complete idempotente (2x = sem nova escrita, mesma resposta)
//  - POST /complete IDOR-safe: nao toca quest de outro user
//
// Mocks: prisma, auth, rate-limit. Sem chamadas reais.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    dailyQuest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    profile: { findUnique: vi.fn() },
    evidence: { count: vi.fn() },
    assessmentResult: { count: vi.fn() },
    scoreSnapshot: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  guardLLM: vi.fn().mockResolvedValue({ ok: true }),
  tooMany: vi.fn(() => new Response("Too many", { status: 429 })),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { GET } from "@/app/api/me/daily-quest/route";
import { POST as COMPLETE } from "@/app/api/me/daily-quest/complete/route";

function mkGet() {
  return new Request("http://localhost/api/me/daily-quest", { method: "GET" });
}
function mkPost() {
  return new Request("http://localhost/api/me/daily-quest/complete", {
    method: "POST",
  });
}

// Helper pra resetar todos os mocks do prisma.dailyQuest e companhia.
function resetAll() {
  auth.mockReset();
  prisma.dailyQuest.findUnique.mockReset();
  prisma.dailyQuest.findMany.mockReset();
  prisma.dailyQuest.create.mockReset();
  prisma.dailyQuest.update.mockReset();
  prisma.profile.findUnique.mockReset();
  prisma.evidence.count.mockReset();
  prisma.assessmentResult.count.mockReset();
  prisma.scoreSnapshot.findFirst.mockReset();
}

describe("GET /api/me/daily-quest", () => {
  beforeEach(() => {
    resetAll();
    // Defaults razoaveis pras queries de estado do user (state-builder).
    prisma.profile.findUnique.mockResolvedValue({ rawCv: null, linkedinJson: null });
    prisma.evidence.count.mockResolvedValue(0);
    prisma.assessmentResult.count.mockResolvedValue(0);
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    prisma.dailyQuest.findMany.mockResolvedValue([]);
  });

  it("401 sem sessao", async () => {
    auth.mockResolvedValue(null);
    const res = await GET(mkGet());
    expect(res.status).toBe(401);
    expect(prisma.dailyQuest.findUnique).not.toHaveBeenCalled();
  });

  it("cria nova quest quando nao existe e retorna serializada", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.dailyQuest.findUnique.mockResolvedValue(null);
    prisma.dailyQuest.create.mockResolvedValue({
      id: "q1",
      userId: "u1",
      questDate: new Date("2026-06-22T00:00:00Z"),
      kind: "REFLECTION",
      title: "titulo",
      description: "desc",
      estimatedMinutes: 5,
      rewardPoints: 5,
      completedAt: null,
    });

    const res = await GET(mkGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quest).toBeDefined();
    expect(body.quest.id).toBe("q1");
    expect(body.quest.completedAt).toBeNull();
    // userId nao deve vazar pro cliente (escopo de dono ja foi enforcado)
    expect(body.quest.userId).toBeUndefined();
    expect(prisma.dailyQuest.create).toHaveBeenCalledTimes(1);
    // Conferimos que o data.userId veio da SESSAO (anti-IDOR)
    expect(prisma.dailyQuest.create.mock.calls[0][0].data.userId).toBe("u1");
  });

  it("retorna quest existente sem criar nova (idempotente no mesmo dia)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const existing = {
      id: "q-existing",
      userId: "u1",
      questDate: new Date("2026-06-22T00:00:00Z"),
      kind: "EVIDENCE_ADD",
      title: "ja existia",
      description: "x",
      estimatedMinutes: 10,
      rewardPoints: 10,
      completedAt: null,
    };
    prisma.dailyQuest.findUnique.mockResolvedValue(existing);

    const res = await GET(mkGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quest.id).toBe("q-existing");
    expect(prisma.dailyQuest.create).not.toHaveBeenCalled();
  });

  it("IDOR-safe: findUnique e create usam userId da SESSAO, nao do body", async () => {
    // Mesmo que o cliente tentasse spoofar (impossivel num GET), o where
    // escopa por dono via composite key (userId, questDate).
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.dailyQuest.findUnique.mockResolvedValue(null);
    prisma.dailyQuest.create.mockResolvedValue({
      id: "q1",
      userId: "u1",
      questDate: new Date(),
      kind: "REFLECTION",
      title: "t",
      description: "d",
      estimatedMinutes: 5,
      rewardPoints: 5,
      completedAt: null,
    });

    await GET(mkGet());
    const findCall = prisma.dailyQuest.findUnique.mock.calls[0][0];
    expect(findCall.where.userId_questDate.userId).toBe("u1");
    const createCall = prisma.dailyQuest.create.mock.calls[0][0];
    expect(createCall.data.userId).toBe("u1");
  });

  it("re-fetch em P2002 (race condition): retorna o vencedor", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    // Primeira findUnique: null (parece que precisa criar)
    // Apos P2002 no create, faz nova findUnique e acha o vencedor.
    prisma.dailyQuest.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "q-winner",
        userId: "u1",
        questDate: new Date(),
        kind: "REFLECTION",
        title: "t",
        description: "d",
        estimatedMinutes: 5,
        rewardPoints: 5,
        completedAt: null,
      });
    const err = new Error("unique");
    err.code = "P2002";
    prisma.dailyQuest.create.mockRejectedValue(err);

    const res = await GET(mkGet());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.quest.id).toBe("q-winner");
  });
});

describe("POST /api/me/daily-quest/complete", () => {
  beforeEach(() => {
    resetAll();
  });

  it("401 sem sessao", async () => {
    auth.mockResolvedValue(null);
    const res = await COMPLETE(mkPost());
    expect(res.status).toBe(401);
    expect(prisma.dailyQuest.update).not.toHaveBeenCalled();
  });

  it("404 quando user ainda nao tem quest de hoje", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.dailyQuest.findUnique.mockResolvedValue(null);
    const res = await COMPLETE(mkPost());
    expect(res.status).toBe(404);
    expect(prisma.dailyQuest.update).not.toHaveBeenCalled();
  });

  it("marca completedAt e retorna points + completedAt", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.dailyQuest.findUnique.mockResolvedValue({
      id: "q1",
      userId: "u1",
      completedAt: null,
      rewardPoints: 5,
    });
    const now = new Date("2026-06-22T12:34:56Z");
    prisma.dailyQuest.update.mockResolvedValue({
      rewardPoints: 5,
      completedAt: now,
    });

    const res = await COMPLETE(mkPost());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.points).toBe(5);
    expect(body.completedAt).toBe(now.toISOString());
    // O UPDATE foi escopado por id (defesa adicional)
    expect(prisma.dailyQuest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q1" } }),
    );
  });

  it("idempotente: quest ja completada retorna alreadyCompleted=true sem update", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const completedAt = new Date("2026-06-22T08:00:00Z");
    prisma.dailyQuest.findUnique.mockResolvedValue({
      id: "q1",
      userId: "u1",
      completedAt,
      rewardPoints: 5,
    });

    const res = await COMPLETE(mkPost());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alreadyCompleted).toBe(true);
    expect(body.completedAt).toBe(completedAt.toISOString());
    expect(prisma.dailyQuest.update).not.toHaveBeenCalled();
  });

  it("IDOR-safe: findUnique escopado por userId da SESSAO", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.dailyQuest.findUnique.mockResolvedValue(null);
    await COMPLETE(mkPost());
    const findCall = prisma.dailyQuest.findUnique.mock.calls[0][0];
    expect(findCall.where.userId_questDate.userId).toBe("u1");
  });

  it("IDOR-safe: user nao consegue completar quest de outro user", async () => {
    // Cenario: user u2 tenta completar a quest do u1. Como o findUnique
    // tem userId=u2 no where, ele NAO acha a quest de u1 (different composite
    // key) e retorna null -> 404. Quest de u1 fica intacta.
    auth.mockResolvedValue({ user: { id: "u2" } });
    prisma.dailyQuest.findUnique.mockResolvedValue(null);
    const res = await COMPLETE(mkPost());
    expect(res.status).toBe(404);
    expect(prisma.dailyQuest.update).not.toHaveBeenCalled();
  });
});

describe("daily-quest-templates", () => {
  // Importa lazy pra nao acoplar ao mock do prisma acima.
  it("pickKindForUser sempre retorna kind valido (allow-list)", async () => {
    const { pickKindForUser, QUEST_KINDS } = await import(
      "@/lib/daily-quest-templates"
    );
    // Estados variados
    const states = [
      {},
      { hasEvidence: true, hasLinkedin: true, latestScore: 80 },
      { latestScore: 30, completedQuests: [] },
      {
        // Todos os candidatos completados nos ultimos 7d — re-rotaciona, mas
        // ainda assim devolve algo valido.
        completedQuests: QUEST_KINDS.map((k) => ({ kind: k })),
      },
    ];
    for (const s of states) {
      const kind = pickKindForUser(s);
      expect(QUEST_KINDS).toContain(kind);
    }
  });

  it("pickTemplate retorna template valido pra todo kind", async () => {
    const { pickTemplate, QUEST_KINDS } = await import(
      "@/lib/daily-quest-templates"
    );
    for (const k of QUEST_KINDS) {
      const t = pickTemplate(k);
      expect(t).not.toBeNull();
      expect(t.title).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.estimatedMinutes).toBeGreaterThan(0);
      expect(t.rewardPoints).toBeGreaterThan(0);
    }
  });

  it("pickTemplate retorna null pra kind invalido (defesa)", async () => {
    const { pickTemplate } = await import("@/lib/daily-quest-templates");
    expect(pickTemplate("INVALID_KIND")).toBeNull();
    expect(pickTemplate(null)).toBeNull();
    expect(pickTemplate("")).toBeNull();
  });

  it("pickKindForUser filtra kinds completed nos ultimos 7d", async () => {
    const { pickKindForUser } = await import("@/lib/daily-quest-templates");
    // User com tudo, mas REFLECTION completada recente — nao deve voltar
    // (a menos que seja o unico restante; aqui ha outros disponiveis).
    const completed = [{ kind: "REFLECTION" }];
    // Run varias vezes pra reduzir flakiness do random.
    for (let i = 0; i < 50; i++) {
      const kind = pickKindForUser({
        hasEvidence: true,
        hasLinkedin: true,
        latestScore: 90,
        completedQuests: completed,
      });
      // REFLECTION saiu, mas outros candidatos (SKILL_RESEARCH, INTERVIEW_PREP,
      // NETWORK_OUTREACH) seguem disponiveis. Garante 50 sorteios sem cair em
      // REFLECTION:
      expect(kind).not.toBe("REFLECTION");
    }
  });
});
