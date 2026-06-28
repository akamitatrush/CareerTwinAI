import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Resend from "next-auth/providers/resend";
import LinkedIn from "next-auth/providers/linkedin";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

const providers = [];

// ---------- Auth rate-limit (magic link anti-spam) ----------
// Por que aqui:
//   Auth.js v5 nao expoe hook antes do signIn no middleware. Estrategia
//   pratica: rate-limit dentro do sendVerificationRequest de cada email
//   provider. Se o email do alvo ja foi flooded (3/h), nao chama o transporte
//   — mas LANCA erro generico. Auth.js mantem a resposta opaca pro cliente
//   (evita account enumeration via timing/mensagem).
//
// Storage: Upstash em prod (compartilhado entre lambdas); Map em-memoria em
// dev/CI (defesa fraca mas funcional). Mesmo padrao do lib/rate-limit.js,
// mas isolado aqui porque auth.js nao pode importar dele (ciclo: rate-limit
// importa NextResponse, e auth.js ja carrega tudo do auth core).

let _authRedis = null;
function getAuthRedis() {
  if (_authRedis) return _authRedis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  _authRedis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _authRedis;
}

const _authMemBuckets = new Map();

// Max 3 magic-link / email / hora. Conservador, mas suficiente — usuario
// legitimo pede 1 e usa; spam de impersonation precisa de muitos.
const AUTH_MAGIC_LIMIT = 3;
const AUTH_MAGIC_WINDOW_S = 60 * 60;

async function checkAuthRate(emailKey) {
  const KEY = `auth:magic:${emailKey}`;
  const redis = getAuthRedis();
  if (redis) {
    try {
      const count = await redis.incr(KEY);
      if (count === 1) await redis.expire(KEY, AUTH_MAGIC_WINDOW_S);
      return count <= AUTH_MAGIC_LIMIT;
    } catch (e) {
      // Redis indisponivel — cai pro mem. Log mas nao quebra o login.
      console.error("auth rate-limit redis falhou, usando mem:", e?.message);
    }
  }
  const now = Date.now();
  const windowMs = AUTH_MAGIC_WINDOW_S * 1000;
  let bucket = _authMemBuckets.get(KEY);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    bucket = { windowStart: now, count: 0 };
    _authMemBuckets.set(KEY, bucket);
  }
  bucket.count++;
  return bucket.count <= AUTH_MAGIC_LIMIT;
}

// Reset usado em testes pra isolar runs. Nao toca Redis (test envs sem UPSTASH).
export function _resetAuthRateLimitBuckets() {
  _authMemBuckets.clear();
}

// Helper: chamar antes de qualquer transporte de email no provider Email.
// Lanca erro NAO-revelador se passou do teto. Auth.js converte em redirect
// pra /entrar?error sem expor "rate_limited" pro client.
async function enforceAuthRate(identifier) {
  const email = String(identifier || "").toLowerCase().trim();
  if (!email || email.length > 200) {
    throw new Error("invalid_identifier");
  }
  const allowed = await checkAuthRate(email);
  if (!allowed) {
    // Log censurado (so primeiros 3 chars + dominio). Suficiente pra correlacao.
    const at = email.indexOf("@");
    const censored = at > 0 ? `${email.slice(0, 3)}***${email.slice(at)}` : "***";
    console.warn(`auth rate-limit hit pra ${censored}`);
    throw new Error("rate_limited");
  }
}

// Email magic link — prefere Resend em producao; Mailpit (SMTP) em dev.
// Se AUTH_RESEND_KEY estiver presente, ela ganha. Caso contrario, cai pro
// Nodemailer/SMTP (configurado pelo EMAIL_SERVER no .env).
//
// IMPORTANTE: o id do provider Auth.js difere conforme qual e registrado:
// Resend -> "resend", Nodemailer -> "nodemailer". A pagina /entrar precisa
// chamar signIn() com o id certo. Exportamos EMAIL_PROVIDER_ID pra ela.
export let EMAIL_PROVIDER_ID = null;
if (process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM) {
  providers.push(
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM,
      // Override do default pra meter o rate-limit antes de gastar quota Resend.
      // Mantemos o mesmo payload/endpoint do provider builtin (Auth.js gera o
      // body via params.url/identifier/expires).
      async sendVerificationRequest(params) {
        const { identifier, url, provider } = params;
        await enforceAuthRate(identifier);

        // Body padrao do provider Resend Auth.js v5 (mesma estrutura interna).
        const subject = `Entre no CareerTwin AI`;
        const text = `Entre no CareerTwin AI clicando no link abaixo (expira em 24h):\n\n${url}\n\nSe nao foi voce, ignore este email.`;
        const html = `<!doctype html>
<html lang="pt-BR"><body style="font-family:Helvetica,Arial,sans-serif;background:#FFF8F0;color:#0F0F0E;padding:32px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;margin:0 auto;">
  <tr><td>
    <div style="font:700 14px/1 Helvetica,Arial,sans-serif;letter-spacing:.04em;margin-bottom:8px;">CareerTwin AI</div>
    <h1 style="font:800 22px/1.2 Helvetica,Arial,sans-serif;margin:0 0 12px;">Confirme seu login</h1>
    <p style="font:14px/1.5 Helvetica,Arial,sans-serif;color:#4C5048;margin:0 0 16px;">
      Clique no botao abaixo pra entrar. O link expira em 24h.
    </p>
    <p style="margin:0 0 24px;"><a href="${url}" style="display:inline-block;background:#0F0F0E;color:#FFF8F0;padding:12px 20px;text-decoration:none;font-weight:600;border-radius:4px;">Entrar agora</a></p>
    <p style="font:12px/1.5 Helvetica,Arial,sans-serif;color:#888;margin:0;">
      Se voce nao pediu este email, ignore. Nada acontece sem o clique.
    </p>
  </td></tr>
</table>
</body></html>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify({
            from: provider.from,
            to: [identifier],
            subject,
            text,
            html,
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Resend ${res.status}: ${t.slice(0, 200)}`);
        }
      },
    })
  );
  EMAIL_PROVIDER_ID = "resend";
} else if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
  providers.push(
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      // Mesma logica de rate-limit no Nodemailer (dev/self-hosted).
      // Aqui delegamos pro default do Auth.js v5 enviando via nodemailer interno;
      // override re-implementa a parte minima necessaria.
      async sendVerificationRequest(params) {
        const { identifier, url, provider } = params;
        await enforceAuthRate(identifier);

        // Usa nodemailer dynamic import pra nao subir custo de bundle no edge.
        const { default: nodemailer } = await import("nodemailer");
        const transport = nodemailer.createTransport(provider.server);
        await transport.sendMail({
          from: provider.from,
          to: identifier,
          subject: "Entre no CareerTwin AI",
          text: `Entre no CareerTwin AI clicando no link abaixo (expira em 24h):\n\n${url}\n\nSe nao foi voce, ignore este email.`,
          html: `<p>Entre no CareerTwin AI clicando no link abaixo (expira em 24h):</p><p><a href="${url}">${url}</a></p><p>Se nao foi voce, ignore este email.</p>`,
        });
      },
    })
  );
  EMAIL_PROVIDER_ID = "nodemailer";
}

if (process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET) {
  providers.push(
    LinkedIn({
      clientId: process.env.AUTH_LINKEDIN_ID,
      clientSecret: process.env.AUTH_LINKEDIN_SECRET,
    })
  );
}

// Google OAuth — opcional. Mesmo pattern do LinkedIn: so registra se ambos
// AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET estiverem setados, evita quebrar em
// dev/staging sem credenciais. O provider id default e "google" — usado pra
// signIn("google") no /entrar e pro redirect URI /api/auth/callback/google.
export const GOOGLE_PROVIDER_ID = "google";
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // allowDangerousEmailAccountLinking nao habilitado de proposito:
      // se um email ja tem conta com outro provider (ex: magic link),
      // Auth.js retorna OAuthAccountNotLinked e cai na nossa /auth/error,
      // que explica pro user usar o provider original (anti account-takeover).
    })
  );
}

// Guarda dupla: AUTH_DEV_CREDENTIALS=true so e permitido em ambientes nao-prod.
// Usa VERCEL_ENV pra discriminar (NODE_ENV=production em preview deploys, nao
// serve pra essa decisao). Em Vercel "preview" e "development" => permitido.
// Em Vercel "production" => bloqueado. Self-hosted: cai no NODE_ENV.
import { isRealProduction } from "@/lib/env";

if (isRealProduction() && process.env.AUTH_DEV_CREDENTIALS === "true") {
  throw new Error(
    "AUTH_DEV_CREDENTIALS=true e proibido em producao (bypass de autenticacao)."
  );
}

if (!isRealProduction() && process.env.AUTH_DEV_CREDENTIALS === "true") {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: { label: "email", type: "email" } },
      async authorize(creds) {
        const email = String(creds?.email || "").trim().toLowerCase();
        if (!email || email.length > 200) return null;
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: { email, emailVerified: new Date() },
          });
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        };
      },
    })
  );
}

// Audit hook — registra LOGIN/LOGOUT/ACCOUNT_CREATED em AuditLog (OWASP A09).
// Import dinamico evita import-time side effects e mantem o auth init enxuto.
// events.* sao chamados em ambiente Node (rotas /api/auth/*), prisma OK.
const auditEvents = {
  signIn: async ({ user }) => {
    if (!user?.id) return;
    try {
      const { audit } = await import("@/lib/audit");
      await audit({ userId: user.id, action: "LOGIN", target: `User:${user.id}` });
    } catch (e) {
      console.error("auth events.signIn audit falhou:", e?.message);
    }
  },
  signOut: async (msg) => {
    // Em sessao JWT, msg.token tem sub (userId). Em DB session, msg.session.user.id.
    const uid = msg?.token?.sub || msg?.session?.user?.id;
    if (!uid) return;
    try {
      const { audit } = await import("@/lib/audit");
      await audit({ userId: uid, action: "LOGOUT", target: `User:${uid}` });
    } catch (e) {
      console.error("auth events.signOut audit falhou:", e?.message);
    }
  },
  createUser: async ({ user }) => {
    if (!user?.id) return;
    try {
      const { audit } = await import("@/lib/audit");
      await audit({ userId: user.id, action: "ACCOUNT_CREATED", target: `User:${user.id}` });
    } catch (e) {
      console.error("auth events.createUser audit falhou:", e?.message);
    }
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  trustHost: true,
  pages: {
    ...(authConfig.pages || {}),
    verifyRequest: "/auth/verify-request",
    // Auth.js v5 redireciona falhas OAuth/Email aqui (?error=<code>).
    // Sem isso, falhas caem no /api/auth/error builtin (tela em branco/stack).
    error: "/auth/error",
  },
  events: auditEvents,
});

// Test-only: exposicao da funcao de rate-limit pra unit tests.
// Nao usar em codigo de producao — chamar sendVerificationRequest direto.
export const __test_auth_rate__ = {
  enforceAuthRate,
  checkAuthRate,
  AUTH_MAGIC_LIMIT,
  AUTH_MAGIC_WINDOW_S,
};
