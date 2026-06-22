import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth: authMiddleware } = NextAuth(authConfig);

const PROTECTED = [/^\/meu-gemeo(\/|$)/, /^\/meus-dados(\/|$)/];

// CSP por requisicao com nonce — script-src restrito; style-src ainda com
// 'unsafe-inline' (limitacao do Next 14: ele injeta estilos inline durante a
// hidratacao e nao ha API estavel pra nonce em styles).
//
// Em DEV o Next usa eval() pro React Fast Refresh (HMR) e abre WebSocket pra
// hot reload — sem unsafe-eval e connect-src ws:, o app trava. Em PROD essas
// concessoes nao entram.
const IS_DEV = process.env.NODE_ENV !== "production";

function buildCsp(nonce) {
  const scriptSrc = IS_DEV
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const connectSrc = IS_DEV
    ? "connect-src 'self' ws: wss:"
    : "connect-src 'self'";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    connectSrc,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

function setSecurityHeaders(res, nonce) {
  res.headers.set("Content-Security-Policy", buildCsp(nonce));
  res.headers.set("x-nonce", nonce);
}

function nonceFromRequest(req) {
  // Propaga o nonce para o app via header de request — o root layout le com
  // headers() do next/headers e injeta como atributo nos <Script>.
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Buffer.from(buf).toString("base64");
}

export default async function middleware(req) {
  const nonce = nonceFromRequest(req);
  const isProtected = PROTECTED.some((re) => re.test(req.nextUrl.pathname));

  if (isProtected) {
    // Delega ao NextAuth (que pode retornar redirect pra /entrar).
    const authRes = await authMiddleware(req);
    if (authRes) {
      setSecurityHeaders(authRes, nonce);
      authRes.headers.set("x-nonce", nonce);
      return authRes;
    }
  }

  // Clona os headers preservando duplicados (importante pra cookies do NextAuth).
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  setSecurityHeaders(res, nonce);
  return res;
}

export const config = {
  // Roda em tudo, exceto assets estaticos e a propria API de auth (que tem
  // seu proprio handler e nao precisa de CSP gerada por nos).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
