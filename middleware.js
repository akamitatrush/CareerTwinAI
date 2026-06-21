import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/meu-gemeo/:path*",
    "/meus-dados/:path*",
    "/api/analyze/:path*",
    "/api/opportunities/:path*",
    "/api/interview/:path*",
    "/api/tailor/:path*",
    "/api/chat/:path*",
  ],
};
