import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import LinkedIn from "next-auth/providers/linkedin";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

const providers = [];

if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
  providers.push(
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    })
  );
}

if (process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET) {
  providers.push(
    LinkedIn({
      clientId: process.env.AUTH_LINKEDIN_ID,
      clientSecret: process.env.AUTH_LINKEDIN_SECRET,
    })
  );
}

if (
  process.env.NODE_ENV !== "production" &&
  process.env.AUTH_DEV_CREDENTIALS === "true"
) {
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
});
