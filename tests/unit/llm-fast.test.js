// Unit tests pra completeJSONFast / completeJSONFastWithUsage — foca em:
//  - completeJSONFastWithUsage usa Haiku 4.5 (model no body do fetch)
//  - Pricing Haiku aplicado em usage.costUsd
//  - completeJSONFast retorna so result (back-compat)
//  - cache funciona (hit retorna { cached: true })
//  - meta.cache=false bypassa cache
//
// NAO chama provider real — mock global fetch.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let originalFetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.LLM_PROVIDER = "anthropic";
  // Limpa LLM_MODEL e LLM_MODEL_FAST pra usar defaults do modulo.
  delete process.env.LLM_MODEL;
  delete process.env.LLM_MODEL_FAST;
  // Fallback em memoria (sem Redis no test env).
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.resetModules();
});

function mockAnthropicResponse(json, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (status >= 400 ? "error body" : JSON.stringify(json)),
    json: async () => json,
  };
}

describe("completeJSONFastWithUsage", () => {
  it("usa Haiku 4.5 no body do fetch (model no payload)", async () => {
    const fetchSpy = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"ok":true}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })
    );
    globalThis.fetch = fetchSpy;

    const { completeJSONFastWithUsage, _internal } = await import("@/lib/llm.js");
    const { cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();

    await completeJSONFastWithUsage({ user: "parse this" }, { route: "test" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.model).toBe(_internal.FAST_MODEL);
    expect(body.model).toBe("claude-haiku-4-5-20251001");
  });

  it("retorna usage com pricing Haiku ($0.8/1M in, $4/1M out)", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"x":1}' }],
        usage: { input_tokens: 1000, output_tokens: 500 },
      })
    );

    const { completeJSONFastWithUsage } = await import("@/lib/llm.js");
    const { cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();

    const { result, usage } = await completeJSONFastWithUsage(
      { user: "unique input 1" },
      { route: "test" }
    );
    expect(result).toEqual({ x: 1 });
    expect(usage.tokensIn).toBe(1000);
    expect(usage.tokensOut).toBe(500);
    // Haiku: 1000*0.8 + 500*4 = 800 + 2000 = 2800 micro-USD = 0.0028 USD
    expect(usage.costUsd).toBeCloseTo(0.0028, 6);
  });

  it("respeita override LLM_MODEL_FAST do env", async () => {
    process.env.LLM_MODEL_FAST = "custom-fast-model";

    const fetchSpy = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"ok":true}' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      })
    );
    globalThis.fetch = fetchSpy;

    // ResetModules acima do test garante que o modulo le o env atual.
    vi.resetModules();
    const { completeJSONFastWithUsage } = await import("@/lib/llm.js");
    const { cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();

    await completeJSONFastWithUsage({ user: "x" }, { route: "test" });

    const [, init] = fetchSpy.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.model).toBe("custom-fast-model");
  });
});

describe("completeJSONFast (back-compat)", () => {
  it("retorna so o result (sem usage)", async () => {
    globalThis.fetch = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"fast":true}' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      })
    );

    const { completeJSONFast } = await import("@/lib/llm.js");
    const { cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();

    const result = await completeJSONFast(
      { user: "unique fast input" },
      { route: "test" }
    );
    expect(result).toEqual({ fast: true });
  });
});

describe("cache integration via completeJSONWithUsage", () => {
  it("hit retorna usage.cached=true e nao bate fetch", async () => {
    const fetchSpy = vi.fn(async () =>
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"cached":"miss"}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      })
    );
    globalThis.fetch = fetchSpy;

    const { completeJSONWithUsage } = await import("@/lib/llm.js");
    const { cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();

    const payload = { user: "unique cache test 1" };

    // 1a chamada: miss, bate fetch
    const r1 = await completeJSONWithUsage(payload, { route: "test" });
    expect(r1.result).toEqual({ cached: "miss" });
    expect(r1.usage.cached).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // 2a chamada: hit, nao bate fetch
    const r2 = await completeJSONWithUsage(payload, { route: "test" });
    expect(r2.result).toEqual({ cached: "miss" });
    expect(r2.usage.cached).toBe(true);
    expect(r2.usage.tokensIn).toBe(0);
    expect(r2.usage.tokensOut).toBe(0);
    expect(r2.usage.costUsd).toBe(0);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // ainda 1 — cache hit nao chamou
  });

  it("cache=false bypassa cache (bate fetch sempre)", async () => {
    let n = 0;
    const fetchSpy = vi.fn(async () => {
      n++;
      return mockAnthropicResponse({
        content: [{ type: "text", text: `{"n":${n}}` }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    });
    globalThis.fetch = fetchSpy;

    const { completeJSONWithUsage } = await import("@/lib/llm.js");
    const { cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();

    const payload = { user: "nocache test" };

    const r1 = await completeJSONWithUsage(payload, { route: "test", cache: false });
    const r2 = await completeJSONWithUsage(payload, { route: "test", cache: false });
    expect(r1.result).toEqual({ n: 1 });
    expect(r2.result).toEqual({ n: 2 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("Fast e Standard nao colidem no cache (model diff)", async () => {
    let n = 0;
    globalThis.fetch = vi.fn(async () => {
      n++;
      return mockAnthropicResponse({
        content: [{ type: "text", text: `{"n":${n}}` }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    });

    const { completeJSONWithUsage, completeJSONFastWithUsage } = await import("@/lib/llm.js");
    const { cacheClear } = await import("@/lib/llm-cache.js");
    cacheClear();

    const payload = { user: "model split test" };

    const standard = await completeJSONWithUsage(payload, { route: "test" });
    const fast = await completeJSONFastWithUsage(payload, { route: "test" });
    // Cada um foi um MISS (entries diferentes por model). Numeros diferentes.
    expect(standard.result).toEqual({ n: 1 });
    expect(fast.result).toEqual({ n: 2 });
  });
});
