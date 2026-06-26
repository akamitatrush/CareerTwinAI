// tests/unit/embeddings.test.js
// Cobre selecao de provedor (Voyage default, OpenAI fallback) e erro claro
// quando nem um nem outro estao disponiveis. Usa vi.resetModules() pra
// re-importar com env vars manipuladas.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const ORIGINAL_VOYAGE = process.env.VOYAGE_API_KEY;
const ORIGINAL_OPENAI = process.env.OPENAI_API_KEY;

beforeEach(() => {
  mockFetch.mockReset();
  delete process.env.VOYAGE_API_KEY;
  delete process.env.OPENAI_API_KEY;
  vi.resetModules();
});

afterEach(() => {
  if (ORIGINAL_VOYAGE) process.env.VOYAGE_API_KEY = ORIGINAL_VOYAGE;
  else delete process.env.VOYAGE_API_KEY;
  if (ORIGINAL_OPENAI) process.env.OPENAI_API_KEY = ORIGINAL_OPENAI;
  else delete process.env.OPENAI_API_KEY;
});

describe("embedTexts — selecao de provedor", () => {
  it("usa Voyage AI quando VOYAGE_API_KEY disponivel", async () => {
    process.env.VOYAGE_API_KEY = "voy-test";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: new Array(1024).fill(0.1) }] }),
    });
    const { embedTexts } = await import("@/lib/embeddings");
    const r = await embedTexts(["test"]);
    expect(r.length).toBe(1);
    expect(r[0].length).toBe(1024);
    expect(mockFetch.mock.calls[0][0]).toContain("voyageai.com");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.model).toBe("voyage-3");
    expect(body.input_type).toBe("document");
  });

  it("cai pra OpenAI se Voyage falhar e OPENAI_API_KEY existir", async () => {
    process.env.VOYAGE_API_KEY = "voy-test";
    process.env.OPENAI_API_KEY = "sk-test";
    // Voyage tenta com retry (maxAttempts=2) — em 5xx, falha as 2 tentativas
    // e CAI pra OpenAI. Por isso 3 mocks: 2x Voyage 500, 1x OpenAI sucesso.
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "boom" })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: new Array(1024).fill(0.2) }] }),
      });
    const { embedTexts } = await import("@/lib/embeddings");
    const r = await embedTexts(["test"]);
    expect(r.length).toBe(1);
    // A ultima chamada e na OpenAI; intermediaria(s) sao Voyage.
    const lastCall = mockFetch.mock.calls.at(-1);
    expect(lastCall[0]).toContain("openai.com");
    // Sanity: Voyage foi chamado pelo menos uma vez.
    expect(mockFetch.mock.calls[0][0]).toContain("voyageai.com");
  });

  it("usa OpenAI direto se so OPENAI_API_KEY existir", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: new Array(1024).fill(0.3) }] }),
    });
    const { embedTexts } = await import("@/lib/embeddings");
    const r = await embedTexts(["test"]);
    expect(r.length).toBe(1);
    expect(mockFetch.mock.calls[0][0]).toContain("openai.com");
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.dimensions).toBe(1024); // truncado pra casar com schema
  });

  it("throw com erro claro se sem keys", async () => {
    const { embedTexts } = await import("@/lib/embeddings");
    await expect(embedTexts(["test"])).rejects.toThrow(/VOYAGE_API_KEY/);
  });

  it("retorna array vazio pra input vazio sem chamar API", async () => {
    process.env.VOYAGE_API_KEY = "voy-test";
    const { embedTexts } = await import("@/lib/embeddings");
    expect(await embedTexts([])).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("embedQuery usa input_type=query no Voyage", async () => {
    process.env.VOYAGE_API_KEY = "voy-test";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: new Array(1024).fill(0.4) }] }),
    });
    const { embedQuery } = await import("@/lib/embeddings");
    const r = await embedQuery("uma pergunta");
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBe(1024);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.input_type).toBe("query");
  });

  it("isEmbeddingAvailable reflete env vars", async () => {
    const { isEmbeddingAvailable } = await import("@/lib/embeddings");
    expect(isEmbeddingAvailable()).toBe(false);
    process.env.VOYAGE_API_KEY = "voy-test";
    expect(isEmbeddingAvailable()).toBe(true);
  });
});
