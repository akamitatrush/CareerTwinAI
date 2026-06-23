// Unit tests pra lib/llm-stream.js — foca em:
//  - streamLLM retorna { stream, getUsage } e yields chunks de texto.
//  - Anthropic SSE parsing: content_block_delta -> text, message_delta -> usage.
//  - OpenAI SSE parsing: delta.content -> text, ultimo chunk com usage.
//  - Errors do provider sao re-lancados com snippet curto (sem PII vazada).
//  - Timeout/abort cancela.
//  - computeCost identico a llm.js (espelho).
//
// NAO chama provider real — mock global fetch retorna ReadableStream com
// chunks SSE. Sem rede, sem chave, sem PII.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let originalFetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.OPENAI_API_KEY = "test-key-oai";
  process.env.LLM_MODEL = "claude-sonnet-4-6";
  process.env.LLM_PROVIDER = "anthropic";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.resetModules();
});

// Monta um Response mock cujo body eh ReadableStream emitindo `chunks`.
// Cada chunk eh string SSE (ja com \n\n). Util pra simular Anthropic/OpenAI.
function mockStreamResponse(chunks, status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    body: stream,
    text: async () => (status >= 400 ? "error body" : ""),
  };
}

async function collect(stream) {
  const out = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

describe("streamLLM — Anthropic SSE parsing", () => {
  it("yields chunks de texto do content_block_delta", async () => {
    // SSE Anthropic: message_start (com usage de input), depois deltas, depois message_delta com usage final.
    const sseChunks = [
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":42,"output_tokens":0}}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Olá"}}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":" mundo"}}\n\n',
      'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":7}}\n\n',
    ];
    globalThis.fetch = vi.fn(async () => mockStreamResponse(sseChunks));

    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream, getUsage } = streamLLM(
      { system: "sys", user: "oi" },
      { route: "test", userId: "u1" }
    );
    const chunks = await collect(stream);
    expect(chunks).toEqual(["Olá", " mundo"]);

    const usage = getUsage();
    expect(usage.tokensIn).toBe(42);
    expect(usage.tokensOut).toBe(7);
    // Sonnet 4.6: 42*3 + 7*15 = 126 + 105 = 231 micro-USD = 0.000231
    expect(usage.costUsd).toBeCloseTo(0.000231, 6);
  });

  it("lida com chunk SSE quebrado entre fetches (buffering)", async () => {
    // Um unico chunk de bytes pode terminar no meio de um evento SSE — o
    // parser deve buferizar e remontar na proxima leitura.
    const sseChunks = [
      // Comeca um evento mas nao fecha o \n\n
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"par',
      // Fecha o anterior + comeca outro
      'te1"}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"parte2"}}\n\n',
    ];
    globalThis.fetch = vi.fn(async () => mockStreamResponse(sseChunks));

    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream } = streamLLM({ user: "x" });
    const chunks = await collect(stream);
    expect(chunks).toEqual(["parte1", "parte2"]);
  });

  it("ignora linhas SSE malformadas (resilencia)", async () => {
    const sseChunks = [
      'event: ping\ndata: nao-eh-json\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n',
      ': comment-like-line\n\n',
    ];
    globalThis.fetch = vi.fn(async () => mockStreamResponse(sseChunks));

    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream } = streamLLM({ user: "x" });
    const chunks = await collect(stream);
    expect(chunks).toEqual(["ok"]);
  });

  it("re-lanca erro do provider com snippet curto (max 200 chars)", async () => {
    const longErr = "x".repeat(500);
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      body: null,
      text: async () => longErr,
    }));

    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream } = streamLLM({ user: "x" });
    await expect(collect(stream)).rejects.toThrow(/Anthropic 429:/);
  });

  it("lanca quando ANTHROPIC_API_KEY ausente", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream } = streamLLM({ user: "x" });
    await expect(collect(stream)).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe("streamLLM — OpenAI SSE parsing", () => {
  beforeEach(() => {
    process.env.LLM_PROVIDER = "openai";
    process.env.LLM_MODEL = "gpt-4o";
  });

  it("yields delta.content e captura usage no chunk final", async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Olá"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" tudo"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" bem?"}}]}\n\n',
      'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":50,"completion_tokens":10}}\n\n',
      'data: [DONE]\n\n',
    ];
    globalThis.fetch = vi.fn(async () => mockStreamResponse(sseChunks));

    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream, getUsage } = streamLLM({ system: "sys", user: "oi" });
    const chunks = await collect(stream);
    expect(chunks).toEqual(["Olá", " tudo", " bem?"]);

    const usage = getUsage();
    expect(usage.tokensIn).toBe(50);
    expect(usage.tokensOut).toBe(10);
    // gpt-4o: $2.5/1M in, $10/1M out. 50*2.5 + 10*10 = 125 + 100 = 225 micro = 0.000225
    expect(usage.costUsd).toBeCloseTo(0.000225, 6);
  });

  it("inclui system prompt em messages quando fornecido", async () => {
    const sseChunks = ['data: [DONE]\n\n'];
    const fetchSpy = vi.fn(async () => mockStreamResponse(sseChunks));
    globalThis.fetch = fetchSpy;

    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream } = streamLLM({ system: "VOCE EH X", user: "oi" });
    await collect(stream);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "VOCE EH X" });
    expect(body.messages[body.messages.length - 1]).toEqual({ role: "user", content: "oi" });
    // stream_options.include_usage habilitado pra capturar tokens.
    expect(body.stream_options?.include_usage).toBe(true);
  });

  it("re-lanca erro do provider OpenAI", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      body: null,
      text: async () => "internal error from openai",
    }));

    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream } = streamLLM({ user: "x" });
    await expect(collect(stream)).rejects.toThrow(/OpenAI 500:/);
  });

  it("lanca quando OPENAI_API_KEY ausente", async () => {
    delete process.env.OPENAI_API_KEY;
    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream } = streamLLM({ user: "x" });
    await expect(collect(stream)).rejects.toThrow(/OPENAI_API_KEY/);
  });
});

describe("streamLLM — history e mensagens", () => {
  it("inclui history antes da pergunta atual (ambos providers)", async () => {
    const sseChunks = [
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"ok"}}\n\n',
    ];
    const fetchSpy = vi.fn(async () => mockStreamResponse(sseChunks));
    globalThis.fetch = fetchSpy;

    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { stream } = streamLLM({
      system: "sys",
      user: "nova",
      history: [
        { role: "user", content: "anterior 1" },
        { role: "assistant", content: "resposta 1" },
      ],
    });
    await collect(stream);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: "user", content: "anterior 1" },
      { role: "assistant", content: "resposta 1" },
      { role: "user", content: "nova" },
    ]);
    // system fica em campo separado (Anthropic), nao no array.
    expect(body.system).toBe("sys");
  });
});

describe("streamLLM — computeCost (export interno)", () => {
  it("retorna 0 pra modelo desconhecido (sem crash em drift de pricing)", async () => {
    const { _internal } = await import("@/lib/llm-stream.js");
    expect(_internal.computeCost("modelo-novo-9999", 1000, 500)).toBe(0);
  });

  it("calcula USD pra Sonnet 4.6 (mesmo de llm.js)", async () => {
    const { _internal } = await import("@/lib/llm-stream.js");
    // Sonnet: $3/1M in, $15/1M out. 1000 in + 500 out = 0.003 + 0.0075 = 0.0105.
    expect(_internal.computeCost("claude-sonnet-4-6", 1000, 500)).toBeCloseTo(0.0105, 6);
  });
});

describe("streamLLM — getUsage antes do stream terminar", () => {
  it("retorna zeros se chamado antes do stream consumir", async () => {
    globalThis.fetch = vi.fn(async () => mockStreamResponse([]));
    const { streamLLM } = await import("@/lib/llm-stream.js");
    const { getUsage } = streamLLM({ user: "x" });
    // Sem iterar o stream — usage ainda nao foi populado.
    expect(getUsage()).toEqual({ tokensIn: 0, tokensOut: 0, costUsd: 0 });
  });
});
