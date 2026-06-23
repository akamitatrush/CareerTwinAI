import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Testa a logica de batching + role-deduplication do cron digest.
// Antes: loop serial 200 users * ~2.5s = 500s, estourava timeout Vercel Cron.
// Depois: batch paralelo (10/lote) + pre-fetch de searchJobs por role unico.

// Stubamos prisma, sendDigestEmail, searchJobs. Como o handler exporta GET/POST
// que recebe Request, importamos e chamamos diretamente com um Request mock.

const mockUsers = vi.fn();
const mockUpdate = vi.fn();
const mockSendDigest = vi.fn();
const mockSearchJobs = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findMany: (...args) => mockUsers(...args),
      update: (...args) => mockUpdate(...args),
    },
  },
}));
vi.mock("@/lib/email", () => ({
  sendDigestEmail: (...args) => mockSendDigest(...args),
}));
vi.mock("@/lib/jobs", () => ({
  searchJobs: (...args) => mockSearchJobs(...args),
}));
vi.mock("@/lib/skills-taxonomy", () => ({
  extractSkills: () => ["python", "sql"],
  matchScore: () => ({ match: 85 }),
}));

function makeReq(secret) {
  return new Request("https://x.test/api/cron/digest", {
    method: "GET",
    headers: { "x-cron-secret": secret },
  });
}

describe("cron digest — batching + role dedup", () => {
  let GET;

  beforeEach(async () => {
    vi.resetModules();
    process.env.CRON_SECRET = "test-secret-1234567890abcd";
    mockUsers.mockReset();
    mockUpdate.mockReset();
    mockSendDigest.mockReset();
    mockSearchJobs.mockReset();
    mockUpdate.mockResolvedValue({});
    mockSendDigest.mockResolvedValue({ id: "sent" });
    const mod = await import("@/app/api/cron/digest/route.js");
    GET = mod.GET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("403 se cron-secret invalido", async () => {
    mockUsers.mockResolvedValue([]);
    const r = await GET(makeReq("wrong-secret"));
    expect(r.status).toBe(403);
  });

  it("400 ate 500 trate CRON_NOT_CONFIGURED quando env ausente", async () => {
    delete process.env.CRON_SECRET;
    vi.resetModules();
    const mod = await import("@/app/api/cron/digest/route.js");
    const r = await mod.GET(makeReq("anything"));
    expect(r.status).toBe(500);
  });

  it("deduplica searchJobs por role unico (3 users, 1 role => 1 chamada searchJobs)", async () => {
    mockUsers.mockResolvedValue([
      { id: "u1", email: "u1@t.com", profile: { targetRole: "Backend", skills: ["python"], nome: "A" } },
      { id: "u2", email: "u2@t.com", profile: { targetRole: "Backend", skills: ["sql"], nome: "B" } },
      { id: "u3", email: "u3@t.com", profile: { targetRole: "Backend", skills: ["go"], nome: "C" } },
    ]);
    mockSearchJobs.mockResolvedValue({
      jobs: [
        { titulo: "Dev Backend", empresa: "Acme", local: "SP", descricao: "Python SQL", source: "adzuna", match: 0 },
        { titulo: "Senior Backend", empresa: "Beta", local: "RJ", descricao: "Python", source: "adzuna", match: 0 },
      ],
    });

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();

    expect(r.status).toBe(200);
    expect(mockSearchJobs).toHaveBeenCalledTimes(1); // 1 unique role, nao 3
    expect(mockSearchJobs).toHaveBeenCalledWith(
      expect.objectContaining({ role: "Backend" })
    );
    expect(data.uniqueRoles).toBe(1);
    expect(data.sent).toBe(3);
    expect(mockSendDigest).toHaveBeenCalledTimes(3);
  });

  it("3 users, 3 roles distintos => 3 chamadas searchJobs (sem dedup)", async () => {
    mockUsers.mockResolvedValue([
      { id: "u1", email: "u1@t.com", profile: { targetRole: "Backend", skills: [], nome: "A" } },
      { id: "u2", email: "u2@t.com", profile: { targetRole: "Frontend", skills: [], nome: "B" } },
      { id: "u3", email: "u3@t.com", profile: { targetRole: "Data Engineer", skills: [], nome: "C" } },
    ]);
    mockSearchJobs.mockResolvedValue({
      jobs: [{ titulo: "T", empresa: "E", local: "L", descricao: "d", source: "adzuna", match: 0 }],
    });

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();

    expect(r.status).toBe(200);
    expect(mockSearchJobs).toHaveBeenCalledTimes(3);
    expect(data.uniqueRoles).toBe(3);
  });

  it("Promise.allSettled: 1 user com erro nao quebra o lote", async () => {
    mockUsers.mockResolvedValue([
      { id: "u1", email: "u1@t.com", profile: { targetRole: "X", skills: [], nome: "A" } },
      { id: "u2", email: "u2@t.com", profile: { targetRole: "X", skills: [], nome: "B" } },
      { id: "u3", email: "u3@t.com", profile: { targetRole: "X", skills: [], nome: "C" } },
    ]);
    mockSearchJobs.mockResolvedValue({
      jobs: [{ titulo: "T", empresa: "E", local: "L", descricao: "d", source: "adzuna", match: 0 }],
    });
    // Falha somente no segundo
    mockSendDigest
      .mockResolvedValueOnce({ id: "1" })
      .mockRejectedValueOnce(new Error("transport down"))
      .mockResolvedValueOnce({ id: "3" });

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();

    expect(r.status).toBe(200);
    expect(data.sent).toBe(2);
    expect(data.failed).toBe(1);
    expect(data.errors).toBeTruthy();
    expect(data.errors[0].err).toMatch(/transport down/);
  });

  it("skipped quando jobs vazio pra role", async () => {
    mockUsers.mockResolvedValue([
      { id: "u1", email: "u1@t.com", profile: { targetRole: "Nicho Raro", skills: [], nome: "A" } },
    ]);
    mockSearchJobs.mockResolvedValue({ jobs: [] });

    const r = await GET(makeReq("test-secret-1234567890abcd"));
    const data = await r.json();

    expect(data.sent).toBe(0);
    expect(data.skipped).toBe(1);
    expect(mockSendDigest).not.toHaveBeenCalled();
  });

  it("paraleliza dentro do batch (10 chamadas simultaneas)", async () => {
    const users = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      email: `u${i}@t.com`,
      profile: { targetRole: "X", skills: [], nome: `n${i}` },
    }));
    mockUsers.mockResolvedValue(users);
    mockSearchJobs.mockResolvedValue({
      jobs: [{ titulo: "T", empresa: "E", local: "L", descricao: "d", source: "adzuna", match: 0 }],
    });

    let inflight = 0;
    let maxInflight = 0;
    mockSendDigest.mockImplementation(async () => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight--;
      return { id: "ok" };
    });

    await GET(makeReq("test-secret-1234567890abcd"));
    // Se fosse serial maxInflight seria 1. Batched paralelo: ate BATCH_SIZE(10).
    expect(maxInflight).toBeGreaterThan(1);
  });
});
