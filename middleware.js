import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { isProtected } from "@/lib/auth-protected-paths";

const { auth: authMiddleware } = NextAuth(authConfig);

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
  // PostHog + Sentry precisam de connect-src liberado pra mandar eventos.
  // - us.i.posthog.com: ingestion da PostHog Cloud (US)
  // - *.posthog.com: cobre subdomínios extras (assets, session recording, etc)
  // - *.ingest.sentry.io e *.ingest.us.sentry.io: ingestion do Sentry
  const observabilityHosts =
    "https://us.i.posthog.com https://*.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io";
  const connectSrc = IS_DEV
    ? `connect-src 'self' ws: wss: ${observabilityHosts}`
    : `connect-src 'self' ${observabilityHosts}`;
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
  // Usa a lista unica de lib/auth-protected-paths.js (mesma que auth.config
  // consulta). Garante que middleware e callback `authorized` enxerguem o
  // mesmo conjunto de rotas — sem isso, page nova podia ficar exposta.
  if (isProtected(req.nextUrl.pathname)) {
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
