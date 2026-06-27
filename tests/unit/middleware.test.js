import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Testes do middleware.js — auth gating + CSP headers.
//
// Mocks:
//   - next-auth (NextAuth(authConfig) retorna { auth: authMiddleware })
//   - @/auth.config — provido inline
//   - lib/auth-protected-paths — usamos o real (puro, sem side-effects)
//
// O middleware:
//   - whitelist de NEVER_BLOCK_PREFIXES => next() + CSP
//   - isProtected(pathname) => delega ao authMiddleware (que pode retornar
//     redirect). Se authMiddleware retornar nada => next() + CSP.
//   - default => next() + CSP.

const mockAuthMiddleware = vi.fn();

vi.mock("next-auth", () => ({
  default: () => ({ auth: mockAuthMiddleware }),
}));

vi.mock("@/auth.config", () => ({
  authConfig: {
    pages: { signIn: "/entrar" },
    providers: [],
    callbacks: {},
    session: { strategy: "jwt" },
  },
}));

function makeReq(pathname) {
  // O middleware le req.nextUrl.pathname. Simula objeto compativel.
  return {
    nextUrl: { pathname },
    headers: new Headers(),
    url: `https://x.test${pathname}`,
  };
}

describe("middleware — whitelist NEVER_BLOCK_PREFIXES", () => {
  let middleware;

  beforeEach(async () => {
    vi.resetModules();
    mockAuthMiddleware.mockReset();
    process.env.NODE_ENV = "test";
    const mod = await import("@/middleware.js");
    middleware = mod.default;
  });

  it("/api/analyze passa sem chamar auth (whitelist)", async () => {
    const res = await middleware(makeReq("/api/analyze"));
    expect(res).toBeDefined();
    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  it("/api/opportunities passa sem chamar auth (whitelist)", async () => {
    const res = await middleware(makeReq("/api/opportunities"));
    expect(res).toBeDefined();
    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  it("/api/chat com sub-path passa sem chamar auth", async () => {
    const res = await middleware(makeReq("/api/chat/stream"));
    expect(res).toBeDefined();
    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  it("/api/cv/analyze passa sem chamar auth (modo experimentar)", async () => {
    const res = await middleware(makeReq("/api/cv/analyze"));
    expect(res).toBeDefined();
    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  it("seta CSP header em rotas whitelist", async () => {
    const res = await middleware(makeReq("/api/analyze"));
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });
});

describe("middleware — rotas protegidas", () => {
  let middleware;

  beforeEach(async () => {
    vi.resetModules();
    mockAuthMiddleware.mockReset();
    const mod = await import("@/middleware.js");
    middleware = mod.default;
  });

  it("/dashboard chama authMiddleware (rota protegida)", async () => {
    mockAuthMiddleware.mockResolvedValue(undefined);
    await middleware(makeReq("/dashboard"));
    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
  });

  it("/conta chama authMiddleware", async () => {
    mockAuthMiddleware.mockResolvedValue(undefined);
    await middleware(makeReq("/conta"));
    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
  });

  it("retorna response do authMiddleware quando ele intervem (redirect)", async () => {
    const redirectRes = { headers: new Headers(), status: 307 };
    mockAuthMiddleware.mockResolvedValue(redirectRes);
    const res = await middleware(makeReq("/dashboard"));
    // O middleware seta CSP no response e retorna ele
    expect(res).toBe(redirectRes);
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("segue pra next() quando authMiddleware retorna undefined (autorizado)", async () => {
    mockAuthMiddleware.mockResolvedValue(undefined);
    const res = await middleware(makeReq("/dashboard"));
    expect(res).toBeDefined();
    expect(res.headers.get("Content-Security-Policy")).toBeTruthy();
  });

  it("/admin (rota protegida + owner-only) chama authMiddleware", async () => {
    mockAuthMiddleware.mockResolvedValue(undefined);
    await middleware(makeReq("/admin"));
    expect(mockAuthMiddleware).toHaveBeenCalledTimes(1);
  });
});

describe("middleware — rotas publicas", () => {
  let middleware;

  beforeEach(async () => {
    vi.resetModules();
    mockAuthMiddleware.mockReset();
    const mod = await import("@/middleware.js");
    middleware = mod.default;
  });

  it("/ (home) nao chama authMiddleware (rota publica)", async () => {
    mockAuthMiddleware.mockResolvedValue(undefined);
    await middleware(makeReq("/"));
    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  it("/entrar (login page) nao chama authMiddleware", async () => {
    mockAuthMiddleware.mockResolvedValue(undefined);
    await middleware(makeReq("/entrar"));
    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  it("/sobre publico nao chama authMiddleware", async () => {
    mockAuthMiddleware.mockResolvedValue(undefined);
    await middleware(makeReq("/sobre"));
    expect(mockAuthMiddleware).not.toHaveBeenCalled();
  });

  it("seta CSP em rotas publicas tambem", async () => {
    const res = await middleware(makeReq("/"));
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});

describe("middleware — CSP configuration", () => {
  let middleware;

  beforeEach(async () => {
    vi.resetModules();
    mockAuthMiddleware.mockReset();
    const mod = await import("@/middleware.js");
    middleware = mod.default;
  });

  it("CSP inclui hosts de PostHog/Sentry em connect-src", async () => {
    const res = await middleware(makeReq("/"));
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("posthog.com");
    expect(csp).toContain("sentry.io");
  });

  it("CSP inclui style-src com Google Fonts", async () => {
    const res = await middleware(makeReq("/"));
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("fonts.googleapis.com");
    expect(csp).toContain("fonts.gstatic.com");
  });

  it("CSP tem object-src 'none' (defesa anti-flash/plugin)", async () => {
    const res = await middleware(makeReq("/"));
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).toContain("object-src 'none'");
  });
});

describe("middleware — config exportado", () => {
  it("exporta matcher excluindo assets estaticos e api/auth", async () => {
    vi.resetModules();
    const mod = await import("@/middleware.js");
    expect(mod.config).toBeDefined();
    expect(mod.config.matcher).toBeDefined();
    expect(Array.isArray(mod.config.matcher)).toBe(true);
    const matcher = mod.config.matcher[0];
    expect(matcher).toContain("_next/static");
    expect(matcher).toContain("api/auth");
  });
});
