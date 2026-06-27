import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completeJSONFastWithUsage } from "@/lib/llm";
import { promptPortfolio } from "@/lib/prompts";
import { PortfolioImportBody, PortfolioShape } from "@/lib/validators";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { safeFetchExternal, isPrivateIp } from "@/lib/safe-fetch";
import { trackTokenUsage, checkDailyBudget, getUserPlan } from "@/lib/billing/enforce";
import { audit } from "@/lib/audit";
import { withApiGuard } from "@/lib/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FETCH_TIMEOUT = 6000;

// Validacao previa do hostname/URL antes mesmo de bater no DNS. Bloqueia
// schemes nao-http(s), nomes especiais (.local/.internal/.lan), e IPs
// privados quando o usuario passa URL literal por IP.
//
// A defesa REAL anti-TOCTOU contra DNS rebinding e o IP pinning dentro de
// safeFetchExternal (lib/safe-fetch.js): resolve+pina IP no socket via
// lookup custom no node:https/node:http — sem novo DNS lookup durante connect.
function isAllowedUrl(u) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return false;
    let h = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!h) return false;
    if (h === "localhost" || h === "0.0.0.0") return false;
    if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return false;
    // Literal IP: checa diretamente. Hostname: deixa pro safeFetchExternal
    // (que faz DNS + isPrivateIp depois). isPrivateIp aceita IP literal IPv4
    // ou IPv6.
    if (/^[\d.]+$/.test(h) && isPrivateIp(h, 4)) return false;
    if (h.includes(":") && isPrivateIp(h, 6)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchGithubRepos(user) {
  // API publica do GitHub — sem auth = 60 req/h por IP. Suficiente pra MVP.
  // Endpoint HARDCODED (api.github.com) — sem SSRF surface, nao precisa de
  // IP pinning. Mantemos fetch nativo aqui.
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), FETCH_TIMEOUT);
  let res;
  try {
    res = await fetch(
      `https://api.github.com/users/${encodeURIComponent(user)}/repos?per_page=30&sort=updated`,
      {
        headers: { "user-agent": "CareerTwin", accept: "application/vnd.github+json" },
        signal: ctl.signal,
      }
    );
  } finally {
    clearTimeout(t);
  }
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
  // safeFetchExternal faz: DNS lookup -> isPrivateIp check -> pin do IP no
  // socket (lookup custom no http/https.request) -> request. Garante que o IP
  // que validamos e o IP usado no socket. Antes, safeLookup + fetch deixavam
  // o socket fazer novo lookup (TOCTOU exploravel via DNS rebinding com TTL=0).
  let res;
  try {
    res = await safeFetchExternal(url, {
      headers: { "user-agent": "CareerTwin" },
      timeoutMs: FETCH_TIMEOUT,
      maxBytes: 500_000, // sites pessoais cabem facil
    });
  } catch {
    return "";
  }
  if (!res.ok) return "";
  const ct = String(res.headers["content-type"] || "");
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

async function handler(req) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const limit = await guardLLM(req, { name: "portfolio", userId, perMinuteAnon: 2, perMinuteUser: 8 });
  if (!limit.ok) return tooMany(limit);

  // Wave 11: cost amplification defense — budget diario antes do LLM rodar.
  let userPlan = null;
  if (userId) {
    userPlan = (await getUserPlan(userId)).id;
    const budget = await checkDailyBudget(userId, userPlan);
    if (!budget.ok) {
      await audit({
        userId,
        action: "SECURITY_BUDGET_EXCEEDED",
        target: `User:${userId}`,
        req,
        meta: { feature: "portfolio", used: budget.used, cap: budget.cap },
      });
      return NextResponse.json(
        {
          error: "Você atingiu o limite diário de uso de IA. Volte amanhã ou faça upgrade.",
          code: "BUDGET_EXCEEDED",
          used: budget.used,
          cap: budget.cap,
          upgradeUrl: "/precos",
        },
        { status: 402 }
      );
    }
  }

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
  let llmUsage = null;
  try {
    // Haiku 4.5: parsing de GitHub repos + site text -> projetos. Trabalho leve,
    // nao precisa de Sonnet. Cache default ON — mesmo user GitHub bate cache.
    const { result: raw, usage } = await completeJSONFastWithUsage(
      promptPortfolio(github, repos, siteText),
      { route: "portfolio.import", userId }
    );
    llmUsage = usage;
    const valid = PortfolioShape.safeParse(raw);
    if (!valid.success) {
      if (userId && llmUsage) await trackTokenUsage(userId, "portfolio", llmUsage);
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

  // Wave 11: token tracking + post-budget audit. Falha silenciosa.
  if (userId && llmUsage) {
    await trackTokenUsage(userId, "portfolio", llmUsage);
    try {
      const budgetAfter = await checkDailyBudget(userId, userPlan);
      if (!budgetAfter.ok) {
        await audit({
          userId,
          action: "SECURITY_BUDGET_EXCEEDED",
          target: `User:${userId}`,
          req,
          meta: {
            feature: "portfolio",
            used: budgetAfter.used,
            cap: budgetAfter.cap,
            phase: "post-llm",
          },
        });
      }
    } catch (e) {
      console.error("portfolio: post-budget check falhou", e?.message);
    }
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
      const consentSource = github ? "PORTFOLIO_GITHUB" : "PORTFOLIO_URL";
      await prisma.consent.create({
        data: { userId, source: consentSource },
      });
      // Audit consentimento LGPD (Galadriel v4: enum CONSENT_GRANTED existia
      // sem callers, quebrando auditabilidade do consent).
      await audit({
        userId,
        action: "CONSENT_GRANTED",
        target: `Consent:${userId}`,
        req,
        meta: { source: consentSource },
      });
    } catch (e) {
      console.error("portfolio: persistencia falhou", e?.message);
    }
  }

  return NextResponse.json({ portfolio, warnings });
}

export const POST = withApiGuard(handler);
