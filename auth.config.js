// Config edge-safe: sem Prisma, sem Node-only. Usada no middleware.
// A config completa (adapter + providers reais) vive em lib/auth.js.

const PROTECTED_PREFIXES = [
  "/meu-gemeo",
  "/meus-dados",
  "/api/analyze",
  "/api/opportunities",
  "/api/interview",
  "/api/tailor",
  "/api/chat",
];

export const authConfig = {
  pages: { signIn: "/entrar" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
      if (!isProtected) return true;
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
