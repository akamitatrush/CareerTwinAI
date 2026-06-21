// Jooble API (https://jooble.org/api/about) — endpoint POST /api/{key}.
// Liga so com JOOBLE_API_KEY.

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

  const res = await withTimeout(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("jooble: status", res.status);
    return [];
  }
  const data = await res.json();
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
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
