// Camada de IA, agnóstica de provedor.
// Padrão: Anthropic (claude-sonnet-4-6). Trocável por env LLM_PROVIDER=openai.
// A chave NUNCA vai para o cliente — isto roda só no servidor (API routes).

const MAX_TOKENS = 1500;

async function callAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Defina ANTHROPIC_API_KEY no arquivo .env");
  const model = process.env.LLM_MODEL || "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Defina OPENAI_API_KEY no arquivo .env");
  const model = process.env.LLM_MODEL || "gpt-4o";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 240)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

function parseJSON(text) {
  let s = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a !== -1 && b !== -1) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

export async function completeJSON(prompt) {
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  const raw = provider === "openai" ? await callOpenAI(prompt) : await callAnthropic(prompt);
  return parseJSON(raw);
}
