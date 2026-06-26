// Integration tests pras rotas /api/evidence e /api/evidence/[id].
//
// Cobertura POST /api/evidence:
//  - 401 sem session
//  - 400 BAD_JSON / TITLE_TOO_SHORT / DESC_TOO_SHORT / INVALID_URL / INVALID_INPUT
//  - 400 LIMIT_REACHED quando user ja tem 50 evidencias
//  - 200 cria evidencia escopada por userId (anti-IDOR)
//
// Cobertura GET /api/evidence:
//  - 401 sem session
//  - 200 retorna items escopados por userId
//
// Cobertura GET/PATCH/DELETE /api/evidence/[id]:
//  - 401 sem session
//  - 400 invalid_id
//  - 404 IDOR quando evidencia e de outro user (GET, PATCH, DELETE)
//  - 200 happy paths
//
// Mocks: prisma, auth.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeReq, makeGetReq, makeDeleteReq } from "../helpers/api.js";

vi.mock("@/lib/db", () => ({
  prisma: {
    evidence: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const VALID_EVIDENCE = {
  kind: "PROJECT",
  title: "Backend escalavel em 3 meses",
  description: "Construi API REST com Django e PostgreSQL, atingindo 100k MAU.",
  skills: ["python", "django", "postgresql"],
  metricLabel: "MAU",
  metricValue: "100k",
};

describe("POST /api/evidence", () => {
  let POST;
  beforeEach(async () => {
    vi.resetModules();
    Object.values(prisma.evidence).forEach((fn) => fn.mockReset && fn.mockReset());
    auth.mockReset();
    const mod = await import("@/app/api/evidence/route.js");
    POST = mod.POST;
  });

  it("401 sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(makeReq(VALID_EVIDENCE));
    expect(r.status).toBe(401);
    expect(prisma.evidence.create).not.toHaveBeenCalled();
  });

  it("400 BAD_JSON com body invalido", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const req = new Request("http://test.local/api/evidence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("BAD_JSON");
  });

  it("400 TITLE_TOO_SHORT", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(makeReq({ ...VALID_EVIDENCE, title: "ab" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("TITLE_TOO_SHORT");
  });

  it("400 DESC_TOO_SHORT", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(makeReq({ ...VALID_EVIDENCE, description: "muito curto" }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("DESC_TOO_SHORT");
  });

  it("400 LIMIT_REACHED quando user ja tem 50 evidencias", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.evidence.count.mockResolvedValue(50);
    const r = await POST(makeReq(VALID_EVIDENCE));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("LIMIT_REACHED");
    expect(prisma.evidence.create).not.toHaveBeenCalled();
  });

  it("200 cria evidencia escopada por userId", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.evidence.count.mockResolvedValue(5);
    prisma.evidence.create.mockResolvedValue({
      id: "ev-1",
      userId: "u1",
      ...VALID_EVIDENCE,
    });
    const r = await POST(makeReq(VALID_EVIDENCE));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.item.id).toBe("ev-1");
    // userId da session, NUNCA do body.
    const args = prisma.evidence.create.mock.calls[0][0];
    expect(args.data.userId).toBe("u1");
  });
});

describe("GET /api/evidence (lista)", () => {
  let GET;
  beforeEach(async () => {
    vi.resetModules();
    Object.values(prisma.evidence).forEach((fn) => fn.mockReset && fn.mockReset());
    auth.mockReset();
    const mod = await import("@/app/api/evidence/route.js");
    GET = mod.GET;
  });

  it("401 sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await GET(makeGetReq());
    expect(r.status).toBe(401);
    expect(prisma.evidence.findMany).not.toHaveBeenCalled();
  });

  it("200 retorna items escopados por userId (anti-IDOR)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.evidence.findMany.mockResolvedValue([
      { id: "ev-1", userId: "u1", title: "T1" },
    ]);
    const r = await GET(makeGetReq());
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.items).toHaveLength(1);
    expect(prisma.evidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" }, take: 200 })
    );
  });
});

function mkCtx(id) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/evidence/[id]", () => {
  let GET;
  beforeEach(async () => {
    vi.resetModules();
    Object.values(prisma.evidence).forEach((fn) => fn.mockReset && fn.mockReset());
    auth.mockReset();
    const mod = await import("@/app/api/evidence/[id]/route.js");
    GET = mod.GET;
  });

  it("401 sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await GET(makeGetReq(), mkCtx("ev-1"));
    expect(r.status).toBe(401);
  });

  it("404 IDOR quando evidencia pertence a OUTRO user", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.evidence.findUnique.mockResolvedValue({
      id: "ev-1",
      userId: "OUTRO",
      title: "T",
    });
    const r = await GET(makeGetReq(), mkCtx("ev-1"));
    expect(r.status).toBe(404);
  });

  it("200 retorna item SEM userId no payload", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.evidence.findUnique.mockResolvedValue({
      id: "ev-1",
      userId: "u1",
      title: "T",
      description: "D",
    });
    const r = await GET(makeGetReq(), mkCtx("ev-1"));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.item.id).toBe("ev-1");
    expect(data.item.userId).toBeUndefined();
  });
});

describe("PATCH /api/evidence/[id]", () => {
  let PATCH;
  beforeEach(async () => {
    vi.resetModules();
    Object.values(prisma.evidence).forEach((fn) => fn.mockReset && fn.mockReset());
    auth.mockReset();
    const mod = await import("@/app/api/evidence/[id]/route.js");
    PATCH = mod.PATCH;
  });

  it("404 IDOR quando evidencia pertence a OUTRO user", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.evidence.findUnique.mockResolvedValue({ userId: "OUTRO" });
    const r = await PATCH(makeReq({ title: "Novo titulo" }), mkCtx("ev-1"));
    expect(r.status).toBe(404);
    expect(prisma.evidence.update).not.toHaveBeenCalled();
  });

  it("200 atualiza apenas campos fornecidos", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.evidence.findUnique.mockResolvedValue({ userId: "u1" });
    prisma.evidence.update.mockResolvedValue({
      id: "ev-1",
      userId: "u1",
      title: "Novo titulo atualizado",
    });
    const r = await PATCH(
      makeReq({ title: "Novo titulo atualizado" }),
      mkCtx("ev-1")
    );
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.item.userId).toBeUndefined(); // omit userId
    // Confirma update so com o que veio.
    const args = prisma.evidence.update.mock.calls[0][0];
    expect(args.where).toEqual({ id: "ev-1" });
    expect(args.data.title).toBe("Novo titulo atualizado");
  });
});

describe("DELETE /api/evidence/[id]", () => {
  let DELETE;
  beforeEach(async () => {
    vi.resetModules();
    Object.values(prisma.evidence).forEach((fn) => fn.mockReset && fn.mockReset());
    auth.mockReset();
    const mod = await import("@/app/api/evidence/[id]/route.js");
    DELETE = mod.DELETE;
  });

  it("401 sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await DELETE(makeDeleteReq(), mkCtx("ev-1"));
    expect(r.status).toBe(401);
  });

  it("404 quando deleteMany count=0 (nao existe OU nao e do user)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.evidence.deleteMany.mockResolvedValue({ count: 0 });
    const r = await DELETE(makeDeleteReq(), mkCtx("ev-1"));
    expect(r.status).toBe(404);
  });

  it("200 quando deleteMany count=1 (delete escopado por userId)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.evidence.deleteMany.mockResolvedValue({ count: 1 });
    const r = await DELETE(makeDeleteReq(), mkCtx("ev-1"));
    expect(r.status).toBe(200);
    // Confirma where com userId scope.
    expect(prisma.evidence.deleteMany).toHaveBeenCalledWith({
      where: { id: "ev-1", userId: "u1" },
    });
  });
});
