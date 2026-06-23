import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AppShell from "@/components/AppShell";

// Força render dinâmico — depende de auth() (cookies) e Prisma (DB), que
// nunca devem ser cacheados estaticamente.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  // Profile pode não existir ainda (user recém-criado pelo magic link, sem
  // onboarding concluído). Caímos no fallback do AppShell sem quebrar.
  let profile = null;
  try {
    profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { nome: true, targetRole: true },
    });
  } catch {
    // DB pode estar fora; o shell tem fallback. Não derrubamos a página inteira.
    profile = null;
  }

  const user = {
    name: profile?.nome || session.user.name || session.user.email,
    targetRole: profile?.targetRole || "Defina seu cargo-alvo",
  };

  return <AppShell user={user}>{children}</AppShell>;
}
