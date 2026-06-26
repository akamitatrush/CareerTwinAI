// Integration tests pra rota /api/funnel (POST + GET).
//
// Cobertura POST:
//  - 401 sem session
//  - 400 BAD_JSON / INVALID_INPUT / INVALID_HIERARCHY (callbacks > apps)
//  - 400 rejeita campos extras (Zod strict)
//  - 400 rejeita numeros negativos / fora de limites
//  - 200 happy path: upsert + analise retornada
//  - 200 userId vem da sessao mesmo se body tentar passar outro
//  - 429 rate limit
//
// Cobertura GET:
//  - 401 sem session
//  - 200 lista entries + agregado + analise
//
// Mocks: prisma, auth, rate-limit.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    funnelEntry: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

vi.mock("@/lib/rate-limit", () => ({
  guardLLM: vi.fn().mockResolvedValue({ ok: true }),
  tooMany: vi.fn(
    () =>
      new Response(JSON.stringify({ error: "rate", code: "RATE_LIMITED" }), {
        status: 429,
        headers: { "content-type": "application/json" },
      })
  ),
}));

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { guardLLM } from "@/lib/rate-limit";
import { POST, GET } from "@/app/api/funnel/route.js";

function mkReq(body, method = "POST") {
  // GET/HEAD nao podem ter body — passamos so headers/method nesses casos.
  if (method === "GET" || method === "HEAD") {
    return new Request("http://test.local/api/funnel", {
      method,
      headers: { "content-type": "application/json" },
    });
  }
  return new Request("http://test.local/api/funnel", {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID_BODY = {
  applications: 20,
  callbacks: 4,
  hmConversations: 2,
  finals: 1,
  offers: 0,
};

describe("POST /api/funnel", () => {
  beforeEach(() => {
    auth.mockReset();
    prisma.funnelEntry.upsert.mockReset();
    prisma.funnelEntry.findMany.mockReset();
    guardLLM.mockReset();
    guardLLM.mockResolvedValue({ ok: true });
  });

  it("401 sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await POST(mkReq(VALID_BODY));
    expect(r.status).toBe(401);
    expect(prisma.funnelEntry.upsert).not.toHaveBeenCalled();
  });

  it("429 quando rate-limit estoura", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    guardLLM.mockResolvedValue({ ok: false, retryAfter: 30 });
    const r = await POST(mkReq(VALID_BODY));
    expect(r.status).toBe(429);
    expect(prisma.funnelEntry.upsert).not.toHaveBeenCalled();
  });

  it("400 BAD_JSON com body invalido", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const req = new Request("http://test.local/api/funnel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not-json",
    });
    const r = await POST(req);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("BAD_JSON");
  });

  it("400 INVALID_INPUT quando body tem campo extra (Zod strict)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(
      mkReq({ ...VALID_BODY, userId: "outro-user", maliciousField: 1 })
    );
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_INPUT");
    expect(prisma.funnelEntry.upsert).not.toHaveBeenCalled();
  });

  it("400 INVALID_INPUT com numero negativo", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(mkReq({ ...VALID_BODY, applications: -1 }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_INPUT");
  });

  it("400 INVALID_HIERARCHY quando callbacks > applications", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(
      mkReq({
        applications: 5,
        callbacks: 10,
        hmConversations: 0,
        finals: 0,
        offers: 0,
      })
    );
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_HIERARCHY");
    expect(prisma.funnelEntry.upsert).not.toHaveBeenCalled();
  });

  it("400 INVALID_INPUT quando applications > 500 (limite max)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    const r = await POST(mkReq({ ...VALID_BODY, applications: 501 }));
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.code).toBe("INVALID_INPUT");
  });

  it("200 upsert + analise quando body valido", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.funnelEntry.upsert.mockResolvedValue({
      id: "fe1",
      userId: "u1",
      ...VALID_BODY,
    });
    prisma.funnelEntry.findMany.mockResolvedValue([
      { id: "fe1", ...VALID_BODY },
    ]);
    const r = await POST(mkReq(VALID_BODY));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.entry.id).toBe("fe1");
    expect(data.analysis).toBeDefined();
    expect(data.analysis.stage).toBeDefined();
    expect(data.aggregated).toBeDefined();
  });

  it("userId vem da sessao SEMPRE (anti-IDOR) mesmo sem userId no body", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.funnelEntry.upsert.mockResolvedValue({ id: "fe1", userId: "u1" });
    prisma.funnelEntry.findMany.mockResolvedValue([]);
    await POST(mkReq(VALID_BODY));
    const callArgs = prisma.funnelEntry.upsert.mock.calls[0][0];
    // userId no where vem da sessao (u1), nao do body.
    expect(callArgs.where.userId_weekStart.userId).toBe("u1");
    expect(callArgs.create.userId).toBe("u1");
  });

  it("calcula weekStart no servidor (Segunda 00:00 UTC)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.funnelEntry.upsert.mockResolvedValue({ id: "fe1" });
    prisma.funnelEntry.findMany.mockResolvedValue([]);
    await POST(mkReq(VALID_BODY));
    const callArgs = prisma.funnelEntry.upsert.mock.calls[0][0];
    const ws = callArgs.where.userId_weekStart.weekStart;
    expect(ws).toBeInstanceOf(Date);
    expect(ws.getUTCDay()).toBe(1); // Segunda
    expect(ws.getUTCHours()).toBe(0);
    expect(ws.getUTCMinutes()).toBe(0);
    expect(ws.getUTCSeconds()).toBe(0);
  });

  it("notes truncado/limpo: string vazia vira null", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.funnelEntry.upsert.mockResolvedValue({ id: "fe1" });
    prisma.funnelEntry.findMany.mockResolvedValue([]);
    await POST(mkReq({ ...VALID_BODY, notes: "   " }));
    const callArgs = prisma.funnelEntry.upsert.mock.calls[0][0];
    expect(callArgs.create.notes).toBeNull();
  });
});

describe("GET /api/funnel", () => {
  beforeEach(() => {
    auth.mockReset();
    prisma.funnelEntry.upsert.mockReset();
    prisma.funnelEntry.findMany.mockReset();
    guardLLM.mockReset();
    guardLLM.mockResolvedValue({ ok: true });
  });

  it("401 sem session", async () => {
    auth.mockResolvedValue(null);
    const r = await GET(mkReq(null, "GET"));
    expect(r.status).toBe(401);
    expect(prisma.funnelEntry.findMany).not.toHaveBeenCalled();
  });

  it("200 retorna entries + aggregated + analysis (IDOR-safe)", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.funnelEntry.findMany.mockResolvedValue([
      {
        id: "fe1",
        userId: "u1",
        applications: 20,
        callbacks: 4,
        hmConversations: 2,
        finals: 1,
        offers: 0,
      },
    ]);
    const r = await GET(mkReq(null, "GET"));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.entries).toHaveLength(1);
    expect(data.aggregated).toBeDefined();
    expect(data.analysis).toBeDefined();
    expect(data.aggregated.applications).toBe(20);
    // Confirma where com userId scope.
    expect(prisma.funnelEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        take: 12,
      })
    );
  });

  it("200 com lista vazia retorna analise volume baixo", async () => {
    auth.mockResolvedValue({ user: { id: "u1" } });
    prisma.funnelEntry.findMany.mockResolvedValue([]);
    const r = await GET(mkReq(null, "GET"));
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.entries).toEqual([]);
    expect(data.analysis.stage).toBe("volume");
  });
});
