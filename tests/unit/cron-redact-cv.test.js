import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Testes pro cron LGPD app/api/cron/redact-cv/route.js.
// Cobre:
//   - 403 / 500 quando auth falha
//   - busca Profile com rawCv / linkedinRaw expirado E nao redactado
//   - update zera rawCv + seta rawCvRedactedAt (idem linkedinRaw)
//   - audit log emitido (CV_DELETED + LINKEDIN_RAW_REDACTED)
//   - response com stats (checked, rawCvRedacted, linkedinRawRedacted, redacted)
//   - erro de update em um profile nao quebra os outros
//
// Mocks: prisma, audit, cron-auth.

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockAudit = vi.fn();
const mockVerifyCronAuth = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findMany: (...a) => mockFindMany(...a),
      update: (...a) => mockUpdate(...a),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  audit: (...a) => mockAudit(...a),
}));

vi.mock("@/lib/cron-auth", () => ({
  verifyCronAuth: (...a) => mockVerifyCronAuth(...a),
}));

function makeReq() {
  return new Request("https://x.test/api/cron/redact-cv", {
    method: "POST",
    headers: { "x-cron-secret": "ignored-in-this-test-mock" },
  });
}

describe("cron/redact-cv — auth gating", () => {
  let POST, GET;

  beforeEach(async () => {
    vi.resetModules();
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    mockAudit.mockReset();
    mockVerifyCronAuth.mockReset();
    mockUpdate.mockResolvedValue({});
    mockAudit.mockResolvedValue(undefined);
    const mod = await import("@/app/api/cron/redact-cv/route.js");
    POST = mod.POST;
    GET = mod.GET;
  });

  it("403 quando verifyCronAuth retorna FORBIDDEN", async () => {
    mockVerifyCronAuth.mockReturnValue({ ok: false, code: "FORBIDDEN" });
    const r = await POST(makeReq());
    expect(r.status).toBe(403);
    const body = await r.json();
    expect(body.code).toBe("FORBIDDEN");
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("500 quando verifyCronAuth retorna CRON_NOT_CONFIGURED", async () => {
    mockVerifyCronAuth.mockReturnValue({ ok: false, code: "CRON_NOT_CONFIGURED" });
    const r = await POST(makeReq());
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body.code).toBe("CRON_NOT_CONFIGURED");
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("GET handler tambem suportado (mesma logica do POST)", async () => {
    mockVerifyCronAuth.mockReturnValue({ ok: false, code: "FORBIDDEN" });
    const r = await GET(makeReq());
    expect(r.status).toBe(403);
  });
});

describe("cron/redact-cv — comportamento principal", () => {
  let POST;

  beforeEach(async () => {
    vi.resetModules();
    mockFindMany.mockReset();
    mockUpdate.mockReset();
    mockAudit.mockReset();
    mockVerifyCronAuth.mockReset();
    mockUpdate.mockResolvedValue({});
    mockAudit.mockResolvedValue(undefined);
    mockVerifyCronAuth.mockReturnValue({ ok: true });
    const mod = await import("@/app/api/cron/redact-cv/route.js");
    POST = mod.POST;
  });

  it("sem perfis expirados => retorna 200 com 0s", async () => {
    mockFindMany.mockResolvedValue([]);
    const r = await POST(makeReq());
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.ok).toBe(true);
    expect(body.checked).toBe(0);
    expect(body.rawCvRedacted).toBe(0);
    expect(body.linkedinRawRedacted).toBe(0);
    expect(body.redacted).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("query usa take: 500 + OR com rawCv + linkedinRaw expirados", async () => {
    mockFindMany.mockResolvedValue([]);
    await POST(makeReq());
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const args = mockFindMany.mock.calls[0][0];
    expect(args.take).toBe(500);
    expect(args.where.OR).toBeDefined();
    expect(args.where.OR.length).toBe(2);
    // Cobre os dois caminhos independentes
    const rawCvBranch = JSON.stringify(args.where.OR[0]);
    const linkedinBranch = JSON.stringify(args.where.OR[1]);
    expect(rawCvBranch).toContain("rawCv");
    expect(rawCvBranch).toContain("rawCvExpiresAt");
    expect(rawCvBranch).toContain("rawCvRedactedAt");
    expect(linkedinBranch).toContain("linkedinRaw");
    expect(linkedinBranch).toContain("linkedinRawExpiresAt");
    expect(linkedinBranch).toContain("linkedinRawRedactedAt");
  });

  it("redacta rawCv expirado: update zera rawCv + seta rawCvRedactedAt", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockFindMany.mockResolvedValue([
      {
        id: "prof1",
        userId: "user1",
        rawCv: "PII CV content here",
        linkedinRaw: null,
        rawCvExpiresAt: past,
        rawCvRedactedAt: null,
        linkedinRawExpiresAt: null,
        linkedinRawRedactedAt: null,
      },
    ]);

    const r = await POST(makeReq());
    const body = await r.json();

    expect(r.status).toBe(200);
    expect(body.rawCvRedacted).toBe(1);
    expect(body.linkedinRawRedacted).toBe(0);
    expect(body.redacted).toBe(1);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdate.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: "prof1" });
    expect(updateArgs.data.rawCv).toBeNull();
    expect(updateArgs.data.rawCvRedactedAt).toBeInstanceOf(Date);
    // linkedinRaw nao deve ser tocado nesse caso
    expect(updateArgs.data.linkedinRaw).toBeUndefined();
  });

  it("redacta linkedinRaw expirado independente de rawCv (LGPD Art.16 fix)", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockFindMany.mockResolvedValue([
      {
        id: "prof2",
        userId: "user2",
        rawCv: null,
        linkedinRaw: "{json linkedin pii}",
        rawCvExpiresAt: null,
        rawCvRedactedAt: null,
        linkedinRawExpiresAt: past,
        linkedinRawRedactedAt: null,
      },
    ]);

    const r = await POST(makeReq());
    const body = await r.json();

    expect(body.rawCvRedacted).toBe(0);
    expect(body.linkedinRawRedacted).toBe(1);
    expect(body.redacted).toBe(1);

    const updateArgs = mockUpdate.mock.calls[0][0];
    expect(updateArgs.data.linkedinRaw).toBeNull();
    expect(updateArgs.data.linkedinRawRedactedAt).toBeInstanceOf(Date);
    expect(updateArgs.data.rawCv).toBeUndefined();
  });

  it("perfil com AMBOS expirados: 1 update + 2 audits (CV_DELETED + LINKEDIN_RAW_REDACTED)", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockFindMany.mockResolvedValue([
      {
        id: "prof3",
        userId: "user3",
        rawCv: "raw cv",
        linkedinRaw: "raw linkedin",
        rawCvExpiresAt: past,
        rawCvRedactedAt: null,
        linkedinRawExpiresAt: past,
        linkedinRawRedactedAt: null,
      },
    ]);

    const r = await POST(makeReq());
    const body = await r.json();

    expect(body.rawCvRedacted).toBe(1);
    expect(body.linkedinRawRedacted).toBe(1);
    expect(body.redacted).toBe(2);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockAudit).toHaveBeenCalledTimes(2);

    const auditActions = mockAudit.mock.calls.map((c) => c[0].action).sort();
    expect(auditActions).toEqual(["CV_DELETED", "LINKEDIN_RAW_REDACTED"]);

    // Audit meta NAO deve incluir o raw (PII)
    for (const call of mockAudit.mock.calls) {
      const meta = call[0].meta;
      expect(meta).toBeDefined();
      expect(meta.reason).toBe("ttl_expired");
      expect(meta.autoRedacted).toBe(true);
      expect(JSON.stringify(call[0])).not.toContain("raw cv");
      expect(JSON.stringify(call[0])).not.toContain("raw linkedin");
    }
  });

  it("erro no update de um profile NAO quebra os outros", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockFindMany.mockResolvedValue([
      {
        id: "ok1",
        userId: "u1",
        rawCv: "x",
        linkedinRaw: null,
        rawCvExpiresAt: past,
        rawCvRedactedAt: null,
        linkedinRawExpiresAt: null,
        linkedinRawRedactedAt: null,
      },
      {
        id: "fail1",
        userId: "u2",
        rawCv: "x",
        linkedinRaw: null,
        rawCvExpiresAt: past,
        rawCvRedactedAt: null,
        linkedinRawExpiresAt: null,
        linkedinRawRedactedAt: null,
      },
      {
        id: "ok2",
        userId: "u3",
        rawCv: "x",
        linkedinRaw: null,
        rawCvExpiresAt: past,
        rawCvRedactedAt: null,
        linkedinRawExpiresAt: null,
        linkedinRawRedactedAt: null,
      },
    ]);

    mockUpdate
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("db transient"))
      .mockResolvedValueOnce({});

    // Silencia o console.error do handler
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await POST(makeReq());
    const body = await r.json();

    expect(r.status).toBe(200);
    expect(body.checked).toBe(3);
    // 2 sucessos contam, 1 falha nao incrementa
    expect(body.rawCvRedacted).toBe(2);
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it("500 quando findMany falha", async () => {
    mockFindMany.mockRejectedValue(new Error("db down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await POST(makeReq());
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body.error).toBe("query_failed");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAudit).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it("audit usa target Profile:<id> + userId correto", async () => {
    const past = new Date(Date.now() - 1000 * 60 * 60 * 24);
    mockFindMany.mockResolvedValue([
      {
        id: "prof-x",
        userId: "user-x",
        rawCv: "x",
        linkedinRaw: null,
        rawCvExpiresAt: past,
        rawCvRedactedAt: null,
        linkedinRawExpiresAt: null,
        linkedinRawRedactedAt: null,
      },
    ]);

    await POST(makeReq());

    expect(mockAudit).toHaveBeenCalledTimes(1);
    const call = mockAudit.mock.calls[0][0];
    expect(call.userId).toBe("user-x");
    expect(call.target).toBe("Profile:prof-x");
    expect(call.action).toBe("CV_DELETED");
  });
});
