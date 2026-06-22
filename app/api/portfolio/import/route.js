import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSON } from "@/lib/llm";
import { promptPortfolio } from "@/lib/prompts";
import { PortfolioImportBody, PortfolioShape } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT = 6000;

async function fetchWithTimeout(url, init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

// SSRF: bloqueia hostnames internos (IPv4 + IPv6 + nomes locais).
// Hostname literal IPv6 vem entre colchetes na URL (ex.: http://[::1]/).
function isPrivateIpv4(h) {
  if (h === "localhost" || h === "0.0.0.0") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true; // link-local (cloud metadata 169.254.169.254)
  if (/^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(h)) return true; // CGNAT 100.64/10
  return false;
}
function isPrivateIpv6(h) {
  const x = h.toLowerCase();
  if (x === "::1" || x === "::") return true;
  if (x.startsWith("fe80:") || x.startsWith("fe80::")) return true; // link-local
  if (x.startsWith("fc") || x.startsWith("fd")) return true; // ULA fc00::/7
  // IPv4-mapped IPv6: ::ffff:x.x.x.x — extrai e checa
  const m = x.match(/^::ffff:([0-9.]+)$/);
  if (m && isPrivateIpv4(m[1])) return true;
  return false;
}
function isAllowedUrl(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return false;
    let h = url.hostname.toLowerCase();
    // IPv6 vem entre colchetes — `new URL` remove no `hostname`, mas garantia:
    h = h.replace(/^\[|\]$/g, "");
    if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return false;
    if (isPrivateIpv4(h)) return false;
    if (h.includes(":") && isPrivateIpv6(h)) return false;
    return true;
  } catch {
    return false;
  }
}

// Mitigação parcial de DNS rebinding: resolve o hostname AGORA e usa o IP no
// fetch (via `lookup` custom do Node fetch). Bloqueia se o IP resolvido for
// privado. Não é proteção perfeita (multi-A, IPv6+IPv4 mix), mas fecha o caso
// trivial de "DNS retorna 8.8.8.8, fetch resolve pra 127.0.0.1".
async function safeLookup(hostname) {
  const dns = await import("node:dns/promises");
  const recs = await dns.lookup(hostname, { all: true, verbatim: true });
  for (const r of recs) {
    if (r.family === 4 && isPrivateIpv4(r.address)) {
      throw new Error("hostname resolve para IP privado");
    }
    if (r.family === 6 && isPrivateIpv6(r.address)) {
      throw new Error("hostname resolve para IPv6 privado");
    }
  }
  return recs[0];
}

async function fetchGithubRepos(user) {
  // API publica do GitHub — sem auth = 60 req/h por IP. Suficiente pra MVP.
  const res = await fetchWithTimeout(
    `https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=30&sort=updated`,
    { headers: { "user-agent": "CareerTwin", accept: "application/vnd.github+json" } }
  );
  if (!res.ok) {
    return { error: `github status ${res.status}`, repos: [] };
  }
  const data = await res.json();
  if (!Array.isArray(data)) return { error: "github resposta inesperada", repos: [] };
  // Ordena por stars desc, pega top 10.
  const repos = data
    .filter((r) => !r.fork && !r.archived)
    .map((r) => ({
      name: String(r.name || "").slice(0, 80),
      description: String(r.description || "").slice(0, 280),
      language: String(r.language || "").slice(0, 40),
      stars: Number(r.stargazers_count || 0),
      url: typeof r.html_url === "string" ? r.html_url : "",
    }))
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 10);
  return { repos };
}

async function fetchSiteText(url) {
  // Anti DNS-rebinding: valida IP do hostname antes de fazer o fetch real.
  try {
    const u = new URL(url);
    await safeLookup(u.hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return "";
  }
  const res = await fetchWithTimeout(url, { headers: { "user-agent": "CareerTwin" } });
  if (!res.ok) return "";
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("text/html") && !ct.includes("text/plain")) return "";
  const html = (await res.text()).slice(0, 200_000);
  // Strip tags, scripts, styles — bruto mas funciona pra MVP.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

export async function POST(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = guardLLM(req, { name: "portfolio", userId, perMinuteAnon: 2, perMinuteUser: 8 });
  if (!limit.ok) return tooMany(limit);

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Não consegui entender o que foi enviado. Tente de novo.", code: "BAD_JSON" },
      { status: 400 }
    );
  }
  const parsed = PortfolioImportBody.safeParse(body);
  if (!parsed.success) {
    // O refine do schema já retorna a mensagem "Informe seu usuário do GitHub..."
    // mas outros erros (regex do github, URL inválida) caem aqui também.
    if (body?.github && typeof body.github === "string") {
      return NextResponse.json(
        {
          error: "Usuário do GitHub inválido. Use apenas letras, números, ponto, hífen ou sublinhado.",
          code: "INVALID_GITHUB",
        },
        { status: 400 }
      );
    }
    if (body?.url && typeof body.url === "string") {
      return NextResponse.json(
        { error: "URL do portfólio inválida. Cole o link completo (com https://).", code: "INVALID_URL" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: "Informe seu usuário do GitHub OU a URL do seu site/portfólio.",
        code: "PORTFOLIO_SOURCE_REQUIRED",
      },
      { status: 400 }
    );
  }
  const { github, url } = parsed.data;

  let repos = [];
  let siteText = "";
  const warnings = [];

  if (github) {
    try {
      const r = await fetchGithubRepos(github);
      if (r.error) warnings.push(r.error);
      repos = r.repos || [];
    } catch (e) {
      warnings.push(`github fetch: ${e?.message || "erro"}`);
    }
  }

  if (url) {
    if (!isAllowedUrl(url)) {
      return NextResponse.json(
        {
          error: "URL não permitida (parece um endereço interno ou protocolo não suportado).",
          code: "URL_BLOCKED",
        },
        { status: 400 }
      );
    }
    try {
      siteText = await fetchSiteText(url);
    } catch (e) {
      warnings.push(`site fetch: ${e?.message || "erro"}`);
    }
  }

  if (repos.length === 0 && !siteText) {
    return NextResponse.json(
      {
        error: "Não consegui buscar conteúdo. Confira se o usuário do GitHub existe e se a URL do site abre publicamente.",
        code: "FETCH_EMPTY",
      },
      { status: 422 }
    );
  }

  let portfolio;
  try {
    const raw = await completeJSON(promptPortfolio(github, repos, siteText), {
      route: "portfolio.import",
      userId,
    });
    const valid = PortfolioShape.safeParse(raw);
    if (!valid.success) {
      return NextResponse.json(
        {
          error: "A IA devolveu uma resposta em formato inesperado. Tente novamente em alguns segundos.",
          code: "LLM_INVALID",
        },
        { status: 502 }
      );
    }
    portfolio = valid.data;
  } catch (e) {
    console.error("portfolio: LLM falhou", e?.message);
    return NextResponse.json(
      {
        error: "A IA não conseguiu analisar seu portfólio agora. Tente novamente em alguns segundos.",
        code: "LLM_FAILED",
      },
      { status: 502 }
    );
  }

  if (userId) {
    try {
      await prisma.profile.upsert({
        where: { userId },
        create: {
          userId,
          githubUser: github || null,
          portfolioJson: portfolio,
        },
        update: {
          githubUser: github || undefined,
          portfolioJson: portfolio,
        },
      });
      await prisma.consent.create({
        data: { userId, source: github ? "PORTFOLIO_GITHUB" : "PORTFOLIO_URL" },
      });
    } catch (e) {
      console.error("portfolio: persistencia falhou", e?.message);
    }
  }

  return NextResponse.json({ portfolio, warnings });
}
