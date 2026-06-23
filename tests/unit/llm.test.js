// Unit tests pra lib/llm.js — foca em:
//  - computeCost: USD por 1M tokens, tabela PRICES, modelo desconhecido => 0
//  - completeJSONWithUsage: retorna { result, usage } com tokens/cost
//  - completeJSON (legacy): retorna so o result (back-compat)
//  - parseJSON tolera cercas ```json + ``` no inicio/fim
//
// NAO chama provider real — mock global fetch retorna shape esperado.
// Sem rede, sem chave, sem PII.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger pra nao poluir output — modulo importa logger.js.
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

let originalFetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.LLM_MODEL = "claude-sonnet-4-6";
  process.env.LLM_PROVIDER = "anthropic";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.resetModules();
});

// Helper pra montar response do fetch parecido com Anthropic.
function mockAnthropicResponse(json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (status >= 400 ? "error body" : JSON.stringify(json)),
    json: async () => json,
  };
}

describe("computeCost (export interno)", () => {
  it("calcula USD por 1M tokens pra Sonnet 4.6 corretamente", async () => {
    const { _internal } = await import("@/lib/llm.js");
    // Sonnet: $3/1M in, $15/1M out. 1000 in + 500 out = 0.003 + 0.0075 = 0.0105.
    const cost = _internal.computeCost("claude-sonnet-4-6", 1000, 500);
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it("calcula USD pro Haiku (mais barato)", async () => {
    const { _internal } = await import("@/lib/llm.js");
    // Haiku: $0.8/1M in, $4/1M out. 1000+500 = 0.0008 + 0.002 = 0.0028.
    const cost = _internal.computeCost("claude-haiku-4-5-20251001", 1000, 500);
    expect(cost).toBeCloseTo(0.0028, 6);
  });

  it("retorna 0 pra modelo desconhecido (sem crash em drift de pricing)", async () => {
    const { _internal } = await import("@/lib/llm.js");
    const cost = _internal.computeCost("claude-modelo-inventado-9999", 1000, 500);
    expect(cost).toBe(0);
  });

  it("arredonda em 6 casas decimais (bate com Decimal(10,6) do schema)", async () => {
    const { _internal } = await import("@/lib/llm.js");
    // 1 token in, 1 token out => 3e-6 + 15e-6 = 18e-6 (so muda na 6a casa).
    const cost = _internal.computeCost("claude-sonnet-4-6", 1, 1);
    expect(cost).toBe(0.000018);
  });
});

describe("completeJSONWithUsage", () => {
  it("retorna { result, usage } com tokens + costUsd do provider", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"hello":"world"}' }],
        usage: { input_tokens: 1234, output_tokens: 567 },
      })
    );
    const { completeJSONWithUsage } = await import("@/lib/llm.js");
    const { result, usage } = await completeJSONWithUsage({ user: "diga oi" }, { route: "test" });
    expect(result).toEqual({ hello: "world" });
    expect(usage.tokensIn).toBe(1234);
    expect(usage.tokensOut).toBe(567);
    // Sonnet 4.6: 1234*3 + 567*15 = 3702 + 8505 = 12207 micro-USD = 0.012207 USD
    expect(usage.costUsd).toBeCloseTo(0.012207, 6);
  });

  it("aceita string (back-compat) — vira user-only", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"ok":true}' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      })
    );
    const { completeJSONWithUsage } = await import("@/lib/llm.js");
    const { result, usage } = await completeJSONWithUsage("string direto");
    expect(result).toEqual({ ok: true });
    expect(usage.tokensIn).toBe(10);
    expect(usage.tokensOut).toBe(5);
  });

  it("tolera cercas ```json + ``` na resposta", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '```json\n{"x":1}\n```' }],
        usage: { input_tokens: 5, output_tokens: 3 },
      })
    );
    const { completeJSONWithUsage } = await import("@/lib/llm.js");
    const { result } = await completeJSONWithUsage({ user: "x" });
    expect(result).toEqual({ x: 1 });
  });

  it("usage.tokensIn/Out default 0 quando provider nao reporta", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"ok":true}' }],
        // usage ausente
      })
    );
    const { completeJSONWithUsage } = await import("@/lib/llm.js");
    const { usage } = await completeJSONWithUsage({ user: "x" });
    expect(usage.tokensIn).toBe(0);
    expect(usage.tokensOut).toBe(0);
    expect(usage.costUsd).toBe(0);
  });
});

describe("completeJSON (legacy back-compat)", () => {
  it("retorna so o result (sem usage)", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"legacy":true}' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      })
    );
    const { completeJSON } = await import("@/lib/llm.js");
    const result = await completeJSON({ user: "x" }, { route: "legacy" });
    // Direto o objeto, nao { result, usage }.
    expect(result).toEqual({ legacy: true });
  });
});
