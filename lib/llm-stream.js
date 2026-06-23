// Streaming LLM agnostico: Anthropic SSE OU OpenAI SSE.
// Retorna { stream, getUsage } onde:
//  - stream: AsyncIterable<string> de chunks de texto (delta apenas).
//  - getUsage(): retorna { tokensIn, tokensOut, costUsd } APOS o stream
//    terminar. Antes disso, retorna zeros (default seguro).
//
// Por que isso e separado de lib/llm.js?
//  - llm.js retorna JSON inteiro (request/response). Aqui yields texto bruto.
//  - O caller (rota /api/chat) precisa enviar SSE pro browser conforme chega.
//  - O JSON final (ex: {"resposta": "..."}) e parseado pelo cliente DEPOIS.
//
// Defesas (espelham llm.js):
//  - System prompt isolado (mitiga prompt injection no user content).
//  - AbortController com timeout 60s (streaming pode demorar mais que JSON one-shot).
//  - Sem retry (streaming nao e idempotente — interromper no meio = duplicar conteudo).
//  - Chave SO no servidor (esse modulo NUNCA pode ser importado por client component).
//  - Erros do provider re-lancados com snippet curto (sem PII; sem stack vazada).
//
// Sem dep nova: fetch global (Node 18+) + ReadableStream.getReader().
// Precos identicos aos de llm.js — espelhados aqui pra computeCost localmente.

const TIMEOUT_MS = 60_000;

// Espelho de PRICES em llm.js (USD por 1M tokens). Mantenha sincronizado.
const PRICES = {
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
  "claude-opus-4-7": { in: 15.0, out: 75.0 },
  "claude-haiku-4-5-20251001": { in: 0.8, out: 4.0 },
  "gpt-4o": { in: 2.5, out: 10.0 },
};

function computeCost(model, tokensIn, tokensOut) {
  const p = PRICES[model];
  if (!p) return 0;
  return +(((tokensIn * p.in) + (tokensOut * p.out)) / 1_000_000).toFixed(6);
}

// Log estruturado JSON-line (espelho de logUsage em llm.js). Ingestion-friendly.
function logUsage({ provider, model, inputTokens, outputTokens, costUsd, latencyMs, route, userId }) {
  const logCost = PRICES[model] ? costUsd : null;
  console.log(JSON.stringify({
    evt: "llm.usage.stream",
    ts: new Date().toISOString(),
    provider,
    model,
    route: route || "?",
    userId: userId || null,
    inputTokens,
    outputTokens,
    costUsd: logCost,
    latencyMs,
  }));
}

/**
 * Stream uma chamada LLM (Anthropic ou OpenAI).
 *
 * @param {{ system?: string, user: string, history?: Array<{role:string,content:string}> }} prompt
 * @param {{ route?: string, userId?: string }} meta
 * @returns {{ stream: AsyncIterable<string>, getUsage: () => {tokensIn:number,tokensOut:number,costUsd:number} }}
 *
 * Uso tipico:
 *   const { stream, getUsage } = streamLLM({ system, user }, { route, userId });
 *   for await (const chunk of stream) { ... }
 *   const usage = getUsage(); // tokens reportados pelo provider, custo computado.
 */
export function streamLLM(prompt, meta = {}) {
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  // Container compartilhado entre stream e getUsage. Mutado durante stream;
  // lido apos terminar. Defaults garantem que getUsage() nunca crash quando
  // chamado antes do stream completar (retorna zeros).
  const usageBox = { tokensIn: 0, tokensOut: 0, costUsd: 0 };
  const stream = provider === "openai"
    ? streamOpenAI(prompt, meta, usageBox)
    : streamAnthropic(prompt, meta, usageBox);
  return {
    stream,
    getUsage: () => ({ ...usageBox }),
  };
}

async function* streamAnthropic({ system, user, history = [] }, meta, usageBox) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Defina ANTHROPIC_API_KEY no arquivo .env");
  const model = process.env.LLM_MODEL || "claude-sonnet-4-6";

  // Anthropic message format: roles user/assistant alternados. history vem
  // do client (CopilotWidget) ja no shape { role, content }. user message
  // final agregado por ultimo. Truncamento de history e feito no validator
  // (ChatBody.history.max = 30, content.max = 4000).
  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: user },
  ];

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        system,
        messages,
        stream: true,
      }),
      signal: ctl.signal,
    });

    if (!res.ok) {
      // Mensagem do provider pode conter detalhes — limitamos a 200 chars
      // pra nao vazar muito em logs/Sentry. Status code preservado.
      const err = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // SSE Anthropic: blocos separados por "\n\n", cada bloco com linha
      // "event: tipo\ndata: {...json}". Pegamos so o JSON na linha data:.
      // Tipos relevantes:
      //   content_block_delta -> delta.text_delta -> chunk de texto.
      //   message_delta -> usage.output_tokens (tokens finais).
      //   message_start -> message.usage.input_tokens (tokens de input).
      const events = buf.split("\n\n");
      buf = events.pop() || "";

      for (const ev of events) {
        const dataLine = ev.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;
        try {
          const data = JSON.parse(dataLine.slice(6));
          if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
            yield data.delta.text;
          } else if (data.type === "message_start" && data.message?.usage) {
            // input_tokens vem no event message_start (Anthropic reporta cedo).
            usageBox.tokensIn = data.message.usage.input_tokens || 0;
          } else if (data.type === "message_delta" && data.usage) {
            // output_tokens cumulativo — message_delta sobrescreve com o total.
            usageBox.tokensOut = data.usage.output_tokens || 0;
          }
        } catch {
          // Linha malformada: ignora (provider pode emitir comentarios SSE).
        }
      }
    }

    // Stream terminou — computa custo final e log estruturado.
    usageBox.costUsd = computeCost(model, usageBox.tokensIn, usageBox.tokensOut);
    logUsage({
      provider: "anthropic",
      model,
      inputTokens: usageBox.tokensIn,
      outputTokens: usageBox.tokensOut,
      costUsd: usageBox.costUsd,
      latencyMs: Date.now() - t0,
      ...meta,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function* streamOpenAI({ system, user, history = [] }, meta, usageBox) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Defina OPENAI_API_KEY no arquivo .env");
  const model = process.env.LLM_MODEL || "gpt-4o";

  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: user },
  ];

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 1500,
        messages,
        stream: true,
        // OpenAI: stream_options.include_usage=true faz o ultimo chunk vir com
        // usage.prompt_tokens/completion_tokens. Sem isso, nao tem como saber.
        stream_options: { include_usage: true },
      }),
      signal: ctl.signal,
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    // SSE OpenAI: lines "data: {...}\n\n", terminadas por "data: [DONE]".
    // include_usage=true faz o chunk antes do [DONE] vir com usage cumulativo.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split("\n");
      buf = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") {
          // [DONE] marker — fim do stream. Sai dos loops externos.
          usageBox.costUsd = computeCost(model, usageBox.tokensIn, usageBox.tokensOut);
          logUsage({
            provider: "openai",
            model,
            inputTokens: usageBox.tokensIn,
            outputTokens: usageBox.tokensOut,
            costUsd: usageBox.costUsd,
            latencyMs: Date.now() - t0,
            ...meta,
          });
          return;
        }
        try {
          const data = JSON.parse(payload);
          const delta = data.choices?.[0]?.delta?.content;
          if (delta) yield delta;
          // Chunk final (com include_usage) traz usage no objeto root.
          if (data.usage) {
            usageBox.tokensIn = data.usage.prompt_tokens || 0;
            usageBox.tokensOut = data.usage.completion_tokens || 0;
          }
        } catch {
          // Ignora chunk malformado.
        }
      }
    }
    // Se sairmos sem [DONE] (provider falhou no meio), ainda computa custo.
    usageBox.costUsd = computeCost(model, usageBox.tokensIn, usageBox.tokensOut);
    logUsage({
      provider: "openai",
      model,
      inputTokens: usageBox.tokensIn,
      outputTokens: usageBox.tokensOut,
      costUsd: usageBox.costUsd,
      latencyMs: Date.now() - t0,
      ...meta,
    });
  } finally {
    clearTimeout(timer);
  }
}

// Exportado pra testes — nao usar em rota.
export const _internal = { computeCost, PRICES };
