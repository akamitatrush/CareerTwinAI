// Testes da rota /api/me/outcome (POST + GET).
//
// Cobre:
//  - 401 sem sessao (auth required).
//  - IDOR-safe: where escopa por session.user.id, ignora userId no body.
//  - Body Zod strict: rejeita campos extras (userId, custom).
//  - Captura scoreAtTime do latest ScoreSnapshot (correlacionavel).
//  - Audita OUTCOME_REPORTED com kind/surveyKind no meta (sem evidence raw).
//  - GET retorna SO outcomes do dono.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    outcome: { create: vi.fn(), findMany: vi.fn() },
    scoreSnapshot: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/rate-limit", () => ({
  guardLLM: vi.fn().mockResolvedValue({ ok: true }),
  tooMany: vi.fn(() => new Response("Too many", { status: 429 })),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { POST, GET } from "@/app/api/me/outcome/route";

function mkReq(body) {
  return new Request("http://localhost/api/me/outcome", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/me/outcome", () => {
  beforeEach(() => {
    auth.mockReset();
    audit.mockReset();
    prisma.outcome.create.mockReset();
    prisma.outcome.findMany.mockReset();
    prisma.scoreSnapshot.findFirst.mockReset();
  });

  it("401 quando nao tem sessao", async () => {
    auth.mockResolvedValue(null);
    const res = await POST(mkReq({ kind: "HIRED" }));
    expect(res.status).toBe(401);
  });

  it("400 quando body tem campo extra (strict reject)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(mkReq({ kind: "HIRED", userId: "u2" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_INPUT");
    expect(prisma.outcome.create).not.toHaveBeenCalled();
  });

  it("400 quando kind invalido", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(mkReq({ kind: "INVALIDO" }));
    expect(res.status).toBe(400);
  });

  it("captura scoreAtTime + roleAtTime do latest snapshot", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.scoreSnapshot.findFirst.mockResolvedValue({
      overall: 65,
      role: "Tech Lead",
    });
    prisma.outcome.create.mockResolvedValue({
      id: "o1",
      kind: "HIRED",
      scoreAtTime: 65,
      roleAtTime: "Tech Lead",
      surveyKind: "SELF_REPORTED",
    });
    const res = await POST(mkReq({ kind: "HIRED" }));
    expect(res.status).toBe(200);

    expect(prisma.scoreSnapshot.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
    expect(prisma.outcome.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          kind: "HIRED",
          scoreAtTime: 65,
          roleAtTime: "Tech Lead",
        }),
      })
    );
  });

  it("usa userId da SESSAO mesmo se body tentar enviar outro", async () => {
    // (zod strict ja rejeita userId — mas dupla defesa: o where do create
    // NUNCA usa body.userId. Conferimos que o create.data.userId e u1.)
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    prisma.outcome.create.mockResolvedValue({ id: "o1", kind: "STILL_LOOKING" });
    // body sem userId — passa no strict. Mas se vier alguma coisa estranha do
    // body, o userId no create vem da sessao.
    const res = await POST(mkReq({ kind: "STILL_LOOKING" }));
    expect(res.status).toBe(200);
    expect(prisma.outcome.create.mock.calls[0][0].data.userId).toBe("u1");
  });

  it("audita OUTCOME_REPORTED com kind/surveyKind no meta (sem evidence raw)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.scoreSnapshot.findFirst.mockResolvedValue({ overall: 80, role: "Dev" });
    prisma.outcome.create.mockResolvedValue({
      id: "o1",
      kind: "HIRED",
      surveyKind: "THIRTY_DAYS",
    });
    await POST(
      mkReq({
        kind: "HIRED",
        surveyKind: "THIRTY_DAYS",
        evidence: "Foi no Magalu, 2 meses",
      })
    );
    expect(audit).toHaveBeenCalledTimes(1);
    const call = audit.mock.calls[0][0];
    expect(call.action).toBe("OUTCOME_REPORTED");
    expect(call.userId).toBe("u1");
    expect(call.meta).toEqual(
      expect.objectContaining({
        kind: "HIRED",
        surveyKind: "THIRTY_DAYS",
        hadSnapshot: true,
      })
    );
    // evidence NUNCA vai pro audit meta
    expect(JSON.stringify(call.meta)).not.toMatch(/Magalu/);
  });

  it("default surveyKind SELF_REPORTED quando nao fornecido", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.scoreSnapshot.findFirst.mockResolvedValue(null);
    prisma.outcome.create.mockResolvedValue({
      id: "o1",
      kind: "PAUSED",
      surveyKind: "SELF_REPORTED",
    });
    await POST(mkReq({ kind: "PAUSED" }));
    expect(prisma.outcome.create.mock.calls[0][0].data.surveyKind).toBe(
      "SELF_REPORTED"
    );
  });
});

describe("GET /api/me/outcome", () => {
  beforeEach(() => {
    auth.mockReset();
    prisma.outcome.findMany.mockReset();
  });

  it("401 sem sessao", async () => {
    auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("retorna SO outcomes do dono (IDOR-safe)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.outcome.findMany.mockResolvedValue([
      { id: "o1", kind: "HIRED" },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(prisma.outcome.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } })
    );
  });
});
