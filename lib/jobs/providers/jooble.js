// Jooble API (https://jooble.org/api/about) — endpoint POST /api/{key}.
// Liga so com JOOBLE_API_KEY.

import { withRetry } from "@/lib/retry";

const TIMEOUT_MS = 6000;

async function withTimeout(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function searchJooble({ role, location, limit = 3 }) {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return [];

  // O endpoint inclui a key na URL; nao loga URL completa.
  const url = `https://jooble.org/api/${key}`;
  const body = {
    keywords: role,
    location: location || "Brasil",
    page: 1,
  };

  // Retry em 429/5xx — Jooble nao publica limites mas devolve 429 sob spike.
  let res;
  try {
    res = await withRetry(async () => {
      const r = await withTimeout(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 429 || (r.status >= 500 && r.status <= 599)) {
        throw new Error(`jooble: ${r.status}`);
      }
      return r;
    }, { maxAttempts: 2, baseDelayMs: 400 });
  } catch (e) {
    console.error(`jooble: retry exauridos — ${e?.message || e}`);
    return [];
  }
  if (!res.ok) {
    let snippet = "";
    try {
      snippet = (await res.text()).slice(0, 200).replace(/\s+/g, " ");
    } catch {}
    console.error(`jooble: status ${res.status} — ${snippet}`);
    return [];
  }
  const data = await res.json();
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  if (jobs.length === 0) {
    console.warn(`jooble: 0 vagas para "${role}" em "${location}" (total reportado: ${data?.totalCount ?? "?"})`);
  }
  return jobs.slice(0, limit).map((j, i) => ({
    id: `jooble-${j.id || i}`,
    source: "jooble",
    titulo: String(j.title || "").slice(0, 240),
    empresa: String(j.company || "").slice(0, 160),
    local: String(j.location || "").slice(0, 200),
    url: typeof j.link === "string" ? j.link : null,
    descricao: String(j.snippet || "").replace(/<[^>]+>/g, "").slice(0, 4000),
    salario: j.salary ? String(j.salary).slice(0, 80) : null,
    postedAt: typeof j.updated === "string" ? j.updated : null,
  }));
}
