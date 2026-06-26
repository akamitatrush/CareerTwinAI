import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock next/headers porque os modulos sao import-time-resolved no Next runtime.
// Em teste so importamos os helpers puros (verify password + token).
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => null,
    set: () => {},
    delete: () => {},
  }),
}));

describe("admin-session — verifyAdminPassword", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-32-bytes-minimum-len-ok";
  });

  it("retorna false quando ADMIN_PASSWORD nao configurado", async () => {
    process.env.ADMIN_PASSWORD = "";
    vi.resetModules();
    const { verifyAdminPassword } = await import("@/lib/admin-session");
    expect(verifyAdminPassword("anything")).toBe(false);
  });

  it("retorna false quando password vazio", async () => {
    process.env.ADMIN_PASSWORD = "correct-pass";
    vi.resetModules();
    const { verifyAdminPassword } = await import("@/lib/admin-session");
    expect(verifyAdminPassword("")).toBe(false);
    expect(verifyAdminPassword(null)).toBe(false);
    expect(verifyAdminPassword(undefined)).toBe(false);
  });

  it("retorna false quando password tipo errado", async () => {
    process.env.ADMIN_PASSWORD = "correct-pass";
    vi.resetModules();
    const { verifyAdminPassword } = await import("@/lib/admin-session");
    expect(verifyAdminPassword(123)).toBe(false);
    expect(verifyAdminPassword({})).toBe(false);
    expect(verifyAdminPassword([])).toBe(false);
  });

  it("retorna true so com match exato", async () => {
    process.env.ADMIN_PASSWORD = "the-right-one-32-chars-xxxxxxxxx";
    vi.resetModules();
    const { verifyAdminPassword } = await import("@/lib/admin-session");
    expect(verifyAdminPassword("the-right-one-32-chars-xxxxxxxxx")).toBe(true);
    expect(verifyAdminPassword("the-right-one-32-chars-xxxxxxxxX")).toBe(false);
    expect(verifyAdminPassword("the-right-one-32-chars-xxxxxxxx")).toBe(false); // 1 a menos
    expect(verifyAdminPassword("the-right-one-32-chars-xxxxxxxxxx")).toBe(false); // 1 a mais
  });

  it("e case-sensitive", async () => {
    process.env.ADMIN_PASSWORD = "MySecret";
    vi.resetModules();
    const { verifyAdminPassword } = await import("@/lib/admin-session");
    expect(verifyAdminPassword("MySecret")).toBe(true);
    expect(verifyAdminPassword("mysecret")).toBe(false);
  });
});

describe("admin-session — make/verifyAdminToken", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-32-bytes-minimum-len-ok";
  });

  it("token gerado bate na verificacao", async () => {
    vi.resetModules();
    const { makeAdminToken, verifyAdminToken } = await import("@/lib/admin-session");
    const t = makeAdminToken();
    expect(verifyAdminToken(t)).toBe(true);
  });

  it("token vazio/null/undefined rejeitado", async () => {
    vi.resetModules();
    const { verifyAdminToken } = await import("@/lib/admin-session");
    expect(verifyAdminToken("")).toBe(false);
    expect(verifyAdminToken(null)).toBe(false);
    expect(verifyAdminToken(undefined)).toBe(false);
  });

  it("token com formato errado rejeitado", async () => {
    vi.resetModules();
    const { verifyAdminToken } = await import("@/lib/admin-session");
    expect(verifyAdminToken("invalid")).toBe(false);
    expect(verifyAdminToken("admin.123")).toBe(false); // sem sig
    expect(verifyAdminToken("admin.notanumber.deadbeef")).toBe(false);
    expect(verifyAdminToken("wrongprefix.123.deadbeef")).toBe(false);
  });

  it("token com signature corrompida rejeitado", async () => {
    vi.resetModules();
    const { makeAdminToken, verifyAdminToken } = await import("@/lib/admin-session");
    const t = makeAdminToken();
    const corrupted = t.slice(0, -2) + "ff";
    expect(verifyAdminToken(corrupted)).toBe(false);
  });

  it("token com timestamp no futuro rejeitado", async () => {
    vi.resetModules();
    const { verifyAdminToken } = await import("@/lib/admin-session");
    // Constroi manualmente token com timestamp absurdamente no futuro
    const future = Math.floor(Date.now() / 1000) + 10000;
    const fake = `admin.${future}.${"a".repeat(64)}`;
    expect(verifyAdminToken(fake)).toBe(false);
  });

  it("AUTH_SECRET diferente invalida token (cross-env)", async () => {
    vi.resetModules();
    const { makeAdminToken } = await import("@/lib/admin-session");
    const t = makeAdminToken();
    // Re-import com novo AUTH_SECRET
    process.env.AUTH_SECRET = "other-secret-completely-different";
    vi.resetModules();
    const { verifyAdminToken } = await import("@/lib/admin-session");
    expect(verifyAdminToken(t)).toBe(false);
  });
});

describe("admin-session — adminPasswordConfigured", () => {
  it("false quando env vazia", async () => {
    process.env.ADMIN_PASSWORD = "";
    vi.resetModules();
    const { adminPasswordConfigured } = await import("@/lib/admin-session");
    expect(adminPasswordConfigured()).toBe(false);
  });

  it("true quando env tem valor", async () => {
    process.env.ADMIN_PASSWORD = "anything";
    vi.resetModules();
    const { adminPasswordConfigured } = await import("@/lib/admin-session");
    expect(adminPasswordConfigured()).toBe(true);
  });
});
