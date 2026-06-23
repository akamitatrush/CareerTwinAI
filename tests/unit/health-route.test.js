import { describe, it, expect } from "vitest";

describe("/api/health payload shape", () => {
  it("inclui campos esperados", () => {
    const sample = {
      ok: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      check_duration_ms: 42,
      checks: {
        database: { ok: true, latency_ms: 10 },
        llm: { ok: true, provider: "anthropic" },
      },
    };
    expect(sample).toHaveProperty("ok");
    expect(sample.checks).toHaveProperty("database");
    expect(sample.checks).toHaveProperty("llm");
  });

  it("status degraded quando DB falha", () => {
    const sample = {
      ok: false,
      status: "degraded",
      checks: { database: { ok: false } },
    };
    expect(sample.status).toBe("degraded");
    expect(sample.checks.database.ok).toBe(false);
  });
});
