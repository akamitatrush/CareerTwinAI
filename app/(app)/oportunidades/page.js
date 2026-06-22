import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import RadarClient from "./RadarClient";

// Render dinamico: depende de auth() (cookies) e do snapshot mais recente.
// Cachear estaticamente entregaria a tela "sem diagnostico" pra todo mundo.
export const dynamic = "force-dynamic";
export const metadata = { title: "Radar de vagas — CareerTwin AI" };

export default async function OportunidadesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const userId = session.user.id;
  const [profile, latestSnapshot] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.scoreSnapshot.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { gaps: true },
    }),
  ]);

  // Sem cargo-alvo ou sem snapshot a busca nao tem o que ranquear. Mandamos
  // pro /meu-gemeo em vez de chamar a API que retornaria PROFILE_REQUIRED.
  if (!profile?.targetRole || !latestSnapshot) {
    return (
      <div className="app-container">
        <div className="ct-gaps-header">
          <div>
            <h1 className="ct-gaps-title">Radar de vagas</h1>
            <p className="ct-gaps-sub">
              Vagas reais ordenadas pela sua aderência — com o porquê de cada match.
            </p>
          </div>
        </div>
        <div className="ct-dash-empty">
          <h2>Sem diagnóstico ainda</h2>
          <p>
            Faça um diagnóstico em <Link href="/meu-gemeo">/meu-gemeo</Link> pra
            eu poder buscar vagas ranqueadas pelo seu perfil.
          </p>
        </div>
      </div>
    );
  }

  // Server passa o snapshotId pra rota — quando ele existe, a API ignora
  // role/perfil/gaps do body e usa o que esta no DB (mais seguro).
  const initialData = {
    snapshotId: latestSnapshot.id,
    role: latestSnapshot.role,
    perfil: latestSnapshot.perfilJson,
    gaps: latestSnapshot.gaps.map((g) => g.habilidade),
  };

  return (
    <div className="app-container">
      <div className="ct-gaps-header">
        <div>
          <h1 className="ct-gaps-title">Radar de vagas</h1>
          <p className="ct-gaps-sub">
            Vagas reais ordenadas pela sua aderência — com o porquê de cada match.
          </p>
        </div>
      </div>
      <RadarClient initial={initialData} />
    </div>
  );
}
