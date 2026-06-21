import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

// Gate apenas as telas privadas. As rotas de API checam auth() internamente
// e podem rodar em modo efemero (sem persistencia) quando nao ha sessao —
// isso suporta o modo "experimentar" da landing sem abrir buracos de IDOR
// (a persistencia so acontece quando ha userId vindo de auth()).
export const config = {
  matcher: ["/meu-gemeo/:path*", "/meus-dados/:path*"],
};
