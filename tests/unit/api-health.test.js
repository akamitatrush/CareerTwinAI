// Integration tests da rota GET /api/health.
//
// Cobertura:
//  - 200 quando DB ping passa (e LLM configurada)
//  - 503 quando DB ping falha (unhealthy)
//  - 503 quando LLM nao configurada (core feature missing)
//  - Resposta NAO vaza secrets (DSN, chaves, hosts)
//  - Build info: node version + sha curto (sem PII)
//  - Cache-control no-store (sempre fresh)
//  - status "degraded" se knowledge/redis/llm secundarios falham mas DB ok
//
// Mocks: prisma, logger.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(),
    scoreSnapshot: { findFirst: vi.fn() },
    billingEvent: { findFirst: vi.fn() },
    knowledgeChunk: { count: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock global fetch pra evitar requests reais aos hosts LLM/Redis.
const originalFetch = global.fetch;

import { prisma } from "@/lib/db";

let GET;
let envBackup;

beforeEach(async () => {
  vi.resetModules();
  prisma.$queryRawUnsafe.mockReset();
  prisma.scoreSnapshot.findFirst.mockReset();
  prisma.billingEvent.findFirst.mockReset();
  prisma.knowledgeChunk.count.mockReset();

  // Defaults — secondary checks ok pra evitar interferencia entre os tests.
  prisma.scoreSnapshot.findFirst.mockResolvedValue({ createdAt: new Date() });
  prisma.billingEvent.findFirst.mockResolvedValue(null);
  prisma.knowledgeChunk.count.mockResolvedValue(100);

  // Backup das env vars relevantes.
  envBackup = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AUTH_RESEND_KEY: process.env.AUTH_RESEND_KEY,
    EMAIL_SERVER: process.env.EMAIL_SERVER,
    SENTRY_DSN: process.env.SENTRY_DSN,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    LLM_PROVIDER: process.env.LLM_PROVIDER,
  };
  // Defaults seguros — LLM configurada pra nao virar 503 por accident.
  process.env.ANTHROPIC_API_KEY = "sk-ant-test";
  // Redis nao configurado por default (passa pelo check sem fetch).
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  // Mock fetch (LLM provider HEAD/Redis ping). Default: HEAD retorna 200.
  global.fetch = vi.fn(async () => ({ ok: true, status: 200 }));

  // Migrations: mock retornar count alto pra nao falhar.
  prisma.$queryRawUnsafe.mockImplementation(async (sql) => {
    if (typeof sql === "string" && sql.includes("_prisma_migrations")) {
      return [{ count: 999 }];
    }
    return [{}];
  });

  const mod = await import("@/app/api/health/route.js");
  GET = mod.GET;
});

afterEach(() => {
  for (const [k, v] of Object.entries(envBackup)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  global.fetch = originalFetch;
});

describe("GET /api/health — DB check", () => {
  it("200 healthy quando DB ping passa + LLM + redis configurada", async () => {
    // Redis precisa estar configurado pra atingir "healthy" estrito (senao
    // cai em "degraded" por causa do redis check).
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tk_test";
    const r = await GET();
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("healthy");
    expect(data.checks.database.ok).toBe(true);
    expect(typeof data.checks.database.latency_ms).toBe("number");
  });

  it("503 unhealthy quando DB ping lanca", async () => {
    prisma.$queryRawUnsafe.mockImplementation(async (sql) => {
      if (typeof sql === "string" && sql.includes("SELECT 1")) {
        throw new Error("connection refused");
      }
      return [{ count: 999 }];
    });
    const r = await GET();
    expect(r.status).toBe(503);
    const data = await r.json();
    expect(data.ok).toBe(false);
    expect(data.status).toBe("unhealthy");
    expect(data.checks.database.ok).toBe(false);
    // Cliente nao recebe detalhe do erro — so label generico.
    expect(data.checks.database.error).toBe("connection_failed");
    expect(JSON.stringify(data)).not.toContain("connection refused");
  });

  it("503 unhealthy quando LLM nao configurada (core feature missing)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const r = await GET();
    expect(r.status).toBe(503);
    const data = await r.json();
    expect(data.status).toBe("unhealthy");
  });
});

describe("GET /api/health — defesa contra leak de secrets", () => {
  it("LLM check NAO retorna o valor da chave", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-secret-12345";
    const r = await GET();
    const text = await r.text();
    expect(text).not.toContain("sk-ant-secret-12345");
    expect(text).not.toContain("12345");
    const parsed = JSON.parse(text);
    expect(parsed.checks.llm_configured.ok).toBe(true);
  });

  it("Sentry DSN nao aparece no payload", async () => {
    process.env.SENTRY_DSN = "https://abc123@o123.ingest.sentry.io/456";
    const r = await GET();
    const text = await r.text();
    expect(text).not.toContain("abc123");
    expect(text).not.toContain("o123.ingest");
    const parsed = JSON.parse(text);
    expect(parsed.checks.observability.sentry).toBe(true);
  });

  it("Email check expoe apenas via (resend/smtp), nao valor", async () => {
    process.env.AUTH_RESEND_KEY = "re_secret_xyz";
    const r = await GET();
    const text = await r.text();
    expect(text).not.toContain("re_secret_xyz");
    const parsed = JSON.parse(text);
    expect(parsed.checks.email.via).toBe("resend");
  });
});

describe("GET /api/health — build info + headers", () => {
  it("retorna node version + env (sem PII)", async () => {
    const r = await GET();
    const data = await r.json();
    expect(data.build).toHaveProperty("node");
    expect(data.build.node).toMatch(/^v\d+\./);
    expect(data.build).toHaveProperty("env");
  });

  it("cache-control no-store (sempre fresh)", async () => {
    const r = await GET();
    const cc = r.headers.get("cache-control");
    expect(cc).toContain("no-store");
  });

  it("timestamp ISO + check_duration_ms numerico", async () => {
    const r = await GET();
    const data = await r.json();
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof data.check_duration_ms).toBe("number");
    expect(data.check_duration_ms).toBeGreaterThanOrEqual(0);
  });
});

describe("GET /api/health — degraded state", () => {
  it("status=degraded quando knowledge_base vazio (mas DB+LLM ok)", async () => {
    prisma.knowledgeChunk.count.mockResolvedValue(0);
    const r = await GET();
    expect(r.status).toBe(200); // HTTP 200 mesmo degraded
    const data = await r.json();
    expect(data.status).toBe("degraded");
    expect(data.ok).toBe(true); // ok=true pra degraded (so unhealthy e false)
    expect(data.checks.knowledge_base.ok).toBe(false);
  });
});
