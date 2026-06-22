import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import Resend from "next-auth/providers/resend";
import LinkedIn from "next-auth/providers/linkedin";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

const providers = [];

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
    })
  );
  EMAIL_PROVIDER_ID = "resend";
} else if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
  providers.push(
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers,
  trustHost: true,
  pages: {
    ...(authConfig.pages || {}),
    verifyRequest: "/auth/verify-request",
  },
});
