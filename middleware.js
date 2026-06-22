import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

const { auth: authMiddleware } = NextAuth(authConfig);

const PROTECTED = [/^\/meu-gemeo(\/|$)/, /^\/meus-dados(\/|$)/];

// CSP. Trade-off pragmatico:
//  - Next 14 + Vercel + chunks estaticos = nonce + strict-dynamic NAO funciona
//    consistentemente (o Next nao propaga o nonce pros chunks externos do
//    _next/static). Tentativa de seguir a receita oficial nao funcionou em prod.
//  - Decisao: 'self' + 'unsafe-inline' em script-src. Perde protecao contra
//    XSS via inline script injection, mas:
//      * React escapa interpolacoes por default
//      * Nao usamos dangerouslySetInnerHTML
//      * Input validado por Zod nas bordas
//      * frame-ancestors 'none' + X-Frame-Options DENY
//      * Quando migrar pra Next 15 com suporte estavel a nonce, voltamos.
//
// Em DEV o Next ainda usa eval() pro Fast Refresh — mantemos unsafe-eval +
// ws: pra HMR funcionar. Em PROD nao tem unsafe-eval nem ws:.
const IS_DEV = process.env.NODE_ENV !== "production";

function buildCsp() {
  const scriptSrc = IS_DEV
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
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

function setSecurityHeaders(res) {
  res.headers.set("Content-Security-Policy", buildCsp());
}

export default async function middleware(req) {
  const isProtected = PROTECTED.some((re) => re.test(req.nextUrl.pathname));

  if (isProtected) {
    // Delega ao NextAuth (que pode retornar redirect pra /entrar).
    const authRes = await authMiddleware(req);
    if (authRes) {
      setSecurityHeaders(authRes);
      return authRes;
    }
  }

  const res = NextResponse.next();
  setSecurityHeaders(res);
  return res;
}

export const config = {
  // Roda em tudo, exceto assets estaticos e a propria API de auth (que tem
  // seu proprio handler e nao precisa de CSP gerada por nos).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
