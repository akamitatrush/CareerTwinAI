import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Testes pro helper lib/cron-auth.js. Cobre:
//   - Authorization: Bearer <secret>  (default Vercel Cron 2025+)
//   - x-cron-secret: <secret>         (manual/legado)
//   - ausencia de env CRON_SECRET     => CRON_NOT_CONFIGURED
//   - mismatch                         => FORBIDDEN
//   - constant-time compare (sanidade) — safeCompare nao throw em length diff
//
// O modulo importa de "node:crypto" (timingSafeEqual) — disponivel em ambiente
// Node do vitest. Sem mocks necessarios alem do env var.

const SECRET = "test-cron-secret-abcdef1234567890";

function makeReq(headers = {}) {
  return new Request("https://x.test/api/cron/anything", {
    method: "POST",
    headers,
  });
}

describe("cron-auth — verifyCronAuth", () => {
  let verifyCronAuth;

  beforeEach(async () => {
    process.env.CRON_SECRET = SECRET;
    const mod = await import("@/lib/cron-auth.js");
    verifyCronAuth = mod.verifyCronAuth;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("aceita Authorization: Bearer <secret> correto", () => {
    const req = makeReq({ authorization: `Bearer ${SECRET}` });
    const r = verifyCronAuth(req);
    expect(r.ok).toBe(true);
  });

  it("aceita Bearer case-insensitive (BEARER, bearer)", () => {
    const r1 = verifyCronAuth(makeReq({ authorization: `bearer ${SECRET}` }));
    const r2 = verifyCronAuth(makeReq({ authorization: `BEARER ${SECRET}` }));
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it("aceita x-cron-secret correto (fallback manual)", () => {
    const req = makeReq({ "x-cron-secret": SECRET });
    const r = verifyCronAuth(req);
    expect(r.ok).toBe(true);
  });

  it("rejeita quando nenhum header presente", () => {
    const req = makeReq({});
    const r = verifyCronAuth(req);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("FORBIDDEN");
  });

  it("rejeita secret errado em Authorization Bearer", () => {
    const req = makeReq({ authorization: "Bearer wrong-secret-value-here" });
    const r = verifyCronAuth(req);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("FORBIDDEN");
  });

  it("rejeita secret errado em x-cron-secret", () => {
    const req = makeReq({ "x-cron-secret": "definitely-not-the-secret" });
    const r = verifyCronAuth(req);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("FORBIDDEN");
  });

  it("rejeita Authorization sem esquema Bearer (ex: Basic)", () => {
    const req = makeReq({ authorization: `Basic ${SECRET}` });
    const r = verifyCronAuth(req);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("FORBIDDEN");
  });

  it("CRON_NOT_CONFIGURED quando env CRON_SECRET ausente", async () => {
    delete process.env.CRON_SECRET;
    // re-import com env limpa — o modulo le process.env em cada chamada
    const { verifyCronAuth: vc } = await import("@/lib/cron-auth.js");
    const r = vc(makeReq({ "x-cron-secret": "any" }));
    expect(r.ok).toBe(false);
    expect(r.code).toBe("CRON_NOT_CONFIGURED");
  });
});

describe("cron-auth — _internal.safeCompare (constant-time)", () => {
  let safeCompare;
  beforeEach(async () => {
    process.env.CRON_SECRET = SECRET;
    const mod = await import("@/lib/cron-auth.js");
    safeCompare = mod._internal.safeCompare;
  });

  it("retorna true em strings identicas", () => {
    expect(safeCompare("abc123", "abc123")).toBe(true);
  });

  it("retorna false em strings diferentes mesmo tamanho", () => {
    expect(safeCompare("abc123", "abc124")).toBe(false);
  });

  it("retorna false em strings com lengths diferentes (sem throw)", () => {
    // length mismatch costuma fazer timingSafeEqual lancar — safeCompare
    // protege e retorna false sem throw.
    expect(() => safeCompare("short", "muito-mais-longo")).not.toThrow();
    expect(safeCompare("short", "muito-mais-longo")).toBe(false);
  });

  it("retorna false em null/undefined/empty", () => {
    expect(safeCompare(null, "x")).toBe(false);
    expect(safeCompare("x", null)).toBe(false);
    expect(safeCompare(undefined, "x")).toBe(false);
    expect(safeCompare("", "")).toBe(false);
  });
});

describe("cron-auth — _internal.extractBearer", () => {
  let extractBearer;
  beforeEach(async () => {
    process.env.CRON_SECRET = SECRET;
    const mod = await import("@/lib/cron-auth.js");
    extractBearer = mod._internal.extractBearer;
  });

  it("extrai token de 'Bearer <token>'", () => {
    expect(extractBearer("Bearer abc123")).toBe("abc123");
  });

  it("tolera espacos extras", () => {
    expect(extractBearer("  Bearer    abc123  ")).toBe("abc123");
  });

  it("case-insensitive no esquema", () => {
    expect(extractBearer("bearer abc123")).toBe("abc123");
    expect(extractBearer("BEARER abc123")).toBe("abc123");
  });

  it("retorna string vazia quando header ausente/invalido", () => {
    expect(extractBearer(null)).toBe("");
    expect(extractBearer(undefined)).toBe("");
    expect(extractBearer("")).toBe("");
    expect(extractBearer("Basic abc123")).toBe("");
    expect(extractBearer(123)).toBe("");
  });
});
