import { describe, it, expect, beforeEach, vi } from "vitest";

// Testes pro lib/admin-access.js. API:
//   - isAdminEmail(email) -> boolean
//   - _getAdminEmailsCount() -> number (diagnostico)
//
// O ADMIN_EMAILS Set e construido NA HORA DO IMPORT (module-level).
// Por isso, cada teste reset env + vi.resetModules() pra re-construir.

describe("admin-access — isAdminEmail", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ADMIN_EMAILS;
    // Silencia warn de "env nao configurada" pra nao poluir o output.
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("retorna false quando ADMIN_EMAILS env ausente (fail closed)", async () => {
    const { isAdminEmail } = await import("@/lib/admin-access.js");
    expect(isAdminEmail("anyone@test.com")).toBe(false);
  });

  it("retorna false quando ADMIN_EMAILS env vazio", async () => {
    process.env.ADMIN_EMAILS = "";
    const { isAdminEmail } = await import("@/lib/admin-access.js");
    expect(isAdminEmail("anyone@test.com")).toBe(false);
  });

  it("retorna true para email listado em ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "founder@careertwin.io";
    const { isAdminEmail } = await import("@/lib/admin-access.js");
    expect(isAdminEmail("founder@careertwin.io")).toBe(true);
  });

  it("suporta multiplos emails separados por virgula", async () => {
    process.env.ADMIN_EMAILS = "a@test.com,b@test.com,c@test.com";
    const { isAdminEmail } = await import("@/lib/admin-access.js");
    expect(isAdminEmail("a@test.com")).toBe(true);
    expect(isAdminEmail("b@test.com")).toBe(true);
    expect(isAdminEmail("c@test.com")).toBe(true);
    expect(isAdminEmail("d@test.com")).toBe(false);
  });

  it("e case-insensitive", async () => {
    process.env.ADMIN_EMAILS = "Founder@CareerTwin.io";
    const { isAdminEmail } = await import("@/lib/admin-access.js");
    expect(isAdminEmail("founder@careertwin.io")).toBe(true);
    expect(isAdminEmail("FOUNDER@CAREERTWIN.IO")).toBe(true);
    expect(isAdminEmail("Founder@CareerTwin.io")).toBe(true);
  });

  it("ignora whitespace ao redor de cada email no env", async () => {
    process.env.ADMIN_EMAILS = "  a@test.com  ,   b@test.com  ";
    const { isAdminEmail } = await import("@/lib/admin-access.js");
    expect(isAdminEmail("a@test.com")).toBe(true);
    expect(isAdminEmail("b@test.com")).toBe(true);
  });

  it("trim no input antes de comparar", async () => {
    process.env.ADMIN_EMAILS = "admin@test.com";
    const { isAdminEmail } = await import("@/lib/admin-access.js");
    expect(isAdminEmail("  admin@test.com  ")).toBe(true);
  });

  it("retorna false para email null/undefined/empty", async () => {
    process.env.ADMIN_EMAILS = "admin@test.com";
    const { isAdminEmail } = await import("@/lib/admin-access.js");
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
  });

  it("emails vazios entre virgulas sao filtrados (filter Boolean)", async () => {
    process.env.ADMIN_EMAILS = "a@test.com,,b@test.com,";
    const { isAdminEmail, _getAdminEmailsCount } = await import("@/lib/admin-access.js");
    expect(_getAdminEmailsCount()).toBe(2);
    expect(isAdminEmail("a@test.com")).toBe(true);
    expect(isAdminEmail("b@test.com")).toBe(true);
    // Empty string nao bate
    expect(isAdminEmail("")).toBe(false);
  });
});

describe("admin-access — _getAdminEmailsCount", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ADMIN_EMAILS;
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("retorna 0 quando env ausente", async () => {
    const { _getAdminEmailsCount } = await import("@/lib/admin-access.js");
    expect(_getAdminEmailsCount()).toBe(0);
  });

  it("retorna count correto pra lista com 3 emails", async () => {
    process.env.ADMIN_EMAILS = "a@t.com,b@t.com,c@t.com";
    const { _getAdminEmailsCount } = await import("@/lib/admin-access.js");
    expect(_getAdminEmailsCount()).toBe(3);
  });

  it("retorna 1 pra email unico", async () => {
    process.env.ADMIN_EMAILS = "solo@test.com";
    const { _getAdminEmailsCount } = await import("@/lib/admin-access.js");
    expect(_getAdminEmailsCount()).toBe(1);
  });
});

describe("admin-access — warning quando ADMIN_EMAILS ausente", () => {
  it("loga warn UMA vez por instancia de modulo (flag _warnedEmpty)", async () => {
    vi.resetModules();
    delete process.env.ADMIN_EMAILS;
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    warnSpy.mockClear();
    const { isAdminEmail } = await import("@/lib/admin-access.js");
    // Limpa chamadas que possam ter vindo de side-effects de import (defensivo)
    warnSpy.mockClear();

    isAdminEmail("a@t.com");
    const callsAfter1 = warnSpy.mock.calls.length;
    isAdminEmail("b@t.com");
    isAdminEmail("c@t.com");
    const callsAfter3 = warnSpy.mock.calls.length;

    // Mesma instancia do modulo: warn so na primeira chamada (flag _warnedEmpty)
    expect(callsAfter1).toBe(1);
    expect(callsAfter3).toBe(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/ADMIN_EMAILS/);

    warnSpy.mockRestore();
  });
});
