// Adzuna API (https://developer.adzuna.com/) — pais "br".
// Liga so com ADZUNA_APP_ID + ADZUNA_APP_KEY. Sem chave → este modulo nem e
// importado (ver lib/jobs/index.js).

const ENDPOINT = "https://api.adzuna.com/v1/api/jobs/br/search/1";
const TIMEOUT_MS = 6000;

async function withTimeout(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    return r;
  } finally {
    clearTimeout(t);
  }
}

export async function searchAdzuna({ role, location, limit = 3 }) {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];

  // Adzuna max e 50 por pagina (free tier). Pedimos o maximo razoavel pra
  // alimentar o radar — o caller (route.js) ja faz top 24 depois do match.
  const params = new URLSearchParams({
    app_id: id,
    app_key: key,
    results_per_page: String(Math.min(Math.max(limit, 1), 50)),
    what: role,
    where: location || "Brasil",
    "content-type": "application/json",
  });
  const url = `${ENDPOINT}?${params.toString()}`;

  const res = await withTimeout(url);
  if (!res.ok) {
    // Log o snippet de erro no servidor (sem chave) para ajudar a debugar
    // problemas de credencial — a chave esta na URL, entao NAO logamos a URL.
    let snippet = "";
    try {
      snippet = (await res.text()).slice(0, 200).replace(/\s+/g, " ");
    } catch {}
    console.error(`adzuna: status ${res.status} — ${snippet}`);
    return [];
  }
  const data = await res.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  // Sem .slice(0, limit) — devolve tudo que veio. O caller dedupica e corta.
  return results.map((r) => ({
    id: `adzuna-${r.id || r.adref || Math.random().toString(36).slice(2)}`,
    source: "adzuna",
    titulo: String(r.title || "").slice(0, 240),
    empresa: String(r.company?.display_name || r.company || "").slice(0, 160),
    local: String(r.location?.display_name || "").slice(0, 200),
    url: typeof r.redirect_url === "string" ? r.redirect_url : null,
    descricao: String(r.description || "").slice(0, 4000),
    salario:
      r.salary_min || r.salary_max
        ? `R$ ${Math.round(r.salary_min || r.salary_max).toLocaleString("pt-BR")}${
            r.salary_max && r.salary_min && r.salary_max !== r.salary_min
              ? "–" + Math.round(r.salary_max).toLocaleString("pt-BR")
              : ""
          }`
        : null,
    postedAt: typeof r.created === "string" ? r.created : null,
  }));
}
