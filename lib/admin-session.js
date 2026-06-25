// Camada extra de senha pro /admin. Defesa-em-camadas em cima do email gate:
//   1. Sessao logada (Auth.js) + email em ADMIN_EMAILS  (camada 1, ja existia)
//   2. Senha em ADMIN_PASSWORD via cookie HTTP-only signed (camada 2, aqui)
//
// Sem a senha, mesmo que alguem capture um magic link de admin, nao passa.
//
// Cookie:
//   - HTTP-only (JS nao acessa, mitiga XSS)
//   - Secure em prod (HTTPS only)
//   - SameSite=strict (mitiga CSRF)
//   - Path=/admin (so envia em rotas admin, reduz superficie)
//   - MaxAge 7 dias (re-autentica semanalmente)
//   - Assinado HMAC-SHA256 com AUTH_SECRET (mesmo segredo NextAuth)
//
// Brute-force:
//   - Comparação timing-safe (timingSafeEqual)
//   - Logging de tentativa via audit (caller injeta — aqui nao depende de DB)
//   - Rate-limit deve ser aplicado no caller (server action) via guardLLM

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "ct-admin-auth";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias em segundos

function getSecret() {
  // AUTH_SECRET ja existe (NextAuth). Reuso pra evitar mais 1 segredo na
  // gestao de envs. Em prod a Vercel ja garante presenca dessa env.
  return process.env.AUTH_SECRET || "";
}

function getPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

export function adminPasswordConfigured() {
  return getPassword().length > 0;
}

// Constant-time compare. Mesmo comprimento diferente, gasta tempo similar
// pra evitar timing oracle (atacante medindo latencia pra adivinhar tamanho).
export function verifyAdminPassword(password) {
  const expected = getPassword();
  if (!expected) return false;
  if (!password || typeof password !== "string") return false;
  // Pad ate comprimento maior pra constant-time mesmo em mismatch de length.
  const len = Math.max(expected.length, password.length);
  const a = Buffer.alloc(len);
  const b = Buffer.alloc(len);
  Buffer.from(password).copy(a);
  Buffer.from(expected).copy(b);
  const equal = timingSafeEqual(a, b);
  return equal && password.length === expected.length;
}

function sign(data) {
  return createHmac("sha256", getSecret()).update(data).digest("hex");
}

// Token formato: "admin.{issuedTimestamp}.{hexSignature}". O timestamp esta
// em segundos UTC. A signature cobre os 2 primeiros campos (HMAC). Sem
// payload de PII no token.
export function makeAdminToken() {
  const issued = Math.floor(Date.now() / 1000);
  const data = `admin.${issued}`;
  const sig = sign(data);
  return `${data}.${sig}`;
}

export function verifyAdminToken(token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [prefix, issuedStr, sig] = parts;
  if (prefix !== "admin") return false;
  const issued = parseInt(issuedStr, 10);
  if (!Number.isFinite(issued) || issued <= 0) return false;
  const now = Math.floor(Date.now() / 1000);
  if (now - issued > COOKIE_MAX_AGE) return false; // expirado
  if (now - issued < 0) return false; // futuro (clock skew anormal)
  const expected = sign(`${prefix}.${issuedStr}`);
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function getAdminCookieValue() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE_NAME)?.value || null;
}

export async function setAdminCookie() {
  const cookieStore = await cookies();
  const token = makeAdminToken();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/", // / em vez de /admin pra cobrir tambem /api/admin/*
  });
}

export async function clearAdminCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function isAdminAuthenticated() {
  const token = await getAdminCookieValue();
  return verifyAdminToken(token);
}
