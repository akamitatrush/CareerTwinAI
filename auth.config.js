// Config edge-safe: sem Prisma, sem Node-only. Usada no middleware.
// A config completa (adapter + providers reais) vive em lib/auth.js.
//
// PROTECTED_PREFIXES vem de lib/auth-protected-paths.js — single source of
// truth compartilhada com middleware.js pra evitar drift (page nova adicionada
// num arquivo e esquecida no outro = bypass de session).

import { isProtected } from "@/lib/auth-protected-paths";

export const authConfig = {
  pages: { signIn: "/entrar" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      if (!isProtected(pathname)) return true;
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.sub) session.user.id = token.sub;
      return session;
    },
  },
  session: { strategy: "jwt" },
};
