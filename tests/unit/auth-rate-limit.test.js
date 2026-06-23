import { describe, it, expect, beforeEach, vi } from "vitest";

// Mockamos os providers do next-auth e o adapter pra nao precisar do DB real.
// `lib/auth.js` faz side-effects de import (cria providers, valida env). Aqui
// so queremos testar a logica de rate-limit isolada.

vi.mock("next-auth", () => ({
  default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("next-auth/providers/nodemailer", () => ({ default: (cfg) => ({ id: "nodemailer", ...cfg }) }));
vi.mock("next-auth/providers/resend", () => ({ default: (cfg) => ({ id: "resend", ...cfg }) }));
vi.mock("next-auth/providers/linkedin", () => ({ default: (cfg) => ({ id: "linkedin", ...cfg }) }));
vi.mock("next-auth/providers/credentials", () => ({ default: (cfg) => ({ id: "credentials", ...cfg }) }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/auth.config", () => ({ authConfig: { pages: {}, providers: [], callbacks: {}, session: {} } }));

describe("auth rate-limit — magic link anti-spam", () => {
  let mod;

  beforeEach(async () => {
    // Reset env pra teste consistente
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
    mod = await import("@/lib/auth.js");
    mod._resetAuthRateLimitBuckets();
  });

  it("permite ate AUTH_MAGIC_LIMIT (3) requisicoes por email/janela", async () => {
    const { checkAuthRate, AUTH_MAGIC_LIMIT } = mod.__test_auth_rate__;
    expect(AUTH_MAGIC_LIMIT).toBe(3);

    const email = "user1@test.com";
    const r1 = await checkAuthRate(email);
    const r2 = await checkAuthRate(email);
    const r3 = await checkAuthRate(email);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(true);
  });

  it("bloqueia 4a requisicao no mesmo email", async () => {
    const { checkAuthRate } = mod.__test_auth_rate__;
    const email = "spammed@test.com";
    await checkAuthRate(email);
    await checkAuthRate(email);
    await checkAuthRate(email);
    const r4 = await checkAuthRate(email);
    expect(r4).toBe(false);
  });

  it("buckets sao independentes por email", async () => {
    const { checkAuthRate } = mod.__test_auth_rate__;
    for (let i = 0; i < 3; i++) {
      await checkAuthRate("a@test.com");
    }
    const blocked = await checkAuthRate("a@test.com");
    const allowedOther = await checkAuthRate("b@test.com");
    expect(blocked).toBe(false);
    expect(allowedOther).toBe(true);
  });

  it("enforceAuthRate lanca rate_limited apos exceder", async () => {
    const { enforceAuthRate } = mod.__test_auth_rate__;
    const email = "x@y.com";
    await enforceAuthRate(email);
    await enforceAuthRate(email);
    await enforceAuthRate(email);
    await expect(enforceAuthRate(email)).rejects.toThrow(/rate_limited/);
  });

  it("enforceAuthRate normaliza email (case + trim)", async () => {
    const { enforceAuthRate, checkAuthRate } = mod.__test_auth_rate__;
    await enforceAuthRate("  Foo@Bar.COM  ");
    await enforceAuthRate("foo@bar.com");
    await enforceAuthRate("FOO@BAR.COM");
    // Mesmo bucket: 3 hits — proximo deve bloquear
    const blocked = await checkAuthRate("foo@bar.com");
    expect(blocked).toBe(false);
  });

  it("enforceAuthRate rejeita identifier invalido", async () => {
    const { enforceAuthRate } = mod.__test_auth_rate__;
    await expect(enforceAuthRate("")).rejects.toThrow(/invalid_identifier/);
    await expect(enforceAuthRate(null)).rejects.toThrow(/invalid_identifier/);
    await expect(enforceAuthRate("a".repeat(201) + "@x.com")).rejects.toThrow(/invalid_identifier/);
  });

  it("_resetAuthRateLimitBuckets zera estado entre testes", async () => {
    const { checkAuthRate } = mod.__test_auth_rate__;
    const email = "reset@test.com";
    await checkAuthRate(email);
    await checkAuthRate(email);
    await checkAuthRate(email);
    expect(await checkAuthRate(email)).toBe(false);

    mod._resetAuthRateLimitBuckets();
    expect(await checkAuthRate(email)).toBe(true);
  });
});
