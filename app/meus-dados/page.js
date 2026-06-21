import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { eraseUserData } from "@/lib/data-export";

export const dynamic = "force-dynamic";

const SOURCE_LABEL = {
  CV_PASTE: "Currículo colado",
  CV_PDF: "Currículo em PDF",
  LINKEDIN_EXPORT: "Export do LinkedIn",
  LINKEDIN_OIDC: "LinkedIn (login OIDC)",
};

async function eraseAction(formData) {
  "use server";
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const confirm = String(formData.get("confirm") || "").trim();
  if (confirm !== "APAGAR") {
    // Confirmacao errada: nao faz nada. Mensagem generica via query string.
    redirect("/meus-dados?erro=confirme");
  }
  await eraseUserData(session.user.id);
  await signOut({ redirectTo: "/?apagado=1" });
}

export default async function MeusDadosPage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");
  const userId = session.user.id;

  // Tudo escopado por userId (sem IDOR).
  const [profile, snapshots, consents, dataSources] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: { id: true, createdAt: true, updatedAt: true, targetRole: true, skills: true },
    }),
    prisma.scoreSnapshot.count({ where: { userId } }),
    prisma.consent.findMany({ where: { userId }, orderBy: { grantedAt: "desc" } }),
    prisma.dataSource.findMany({ where: { userId }, orderBy: { ingestedAt: "desc" } }),
  ]);

  const erroConfirmar = searchParams?.erro === "confirme";

  return (
    <main className="wrap" style={{ maxWidth: 760, paddingTop: 24 }}>
      <div className="topbar-inner" style={{ marginBottom: 24 }}>
        <Link href="/meu-gemeo" style={{ textDecoration: "none" }}>
          <div className="brand">
            <div>
              <div className="brand-name">Meus dados</div>
              <div className="brand-sub">{session.user.email}</div>
            </div>
          </div>
        </Link>
        <Link href="/meu-gemeo" className="tool-btn" style={{ textDecoration: "none" }}>← Meu gêmeo</Link>
      </div>

      <h1 className="hero" style={{ fontSize: 32 }}>Seus dados, sob seu controle.</h1>
      <p className="hero-lede">
        Aqui você vê o que consta no seu gêmeo, baixa uma cópia em JSON e pode
        apagar tudo de uma vez. <b>LGPD por construção:</b> nenhum dado seu é
        compartilhado, e o "apagar tudo" remove de verdade — não fica em sombra.
      </p>

      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">01</span>
          <h2 className="sec-title">O que está salvo</h2>
        </div>
        <ul style={{ paddingLeft: 16, lineHeight: 1.8 }}>
          <li>
            <b>Perfil vigente:</b>{" "}
            {profile
              ? `${profile.skills?.length || 0} skills · cargo-alvo "${profile.targetRole || "não definido"}" · atualizado em ${new Date(profile.updatedAt).toLocaleString("pt-BR")}`
              : "ainda em branco"}
          </li>
          <li><b>Diagnósticos (snapshots):</b> {snapshots}</li>
          <li><b>Fontes de dado registradas:</b> {dataSources.length}</li>
          <li><b>Consentimentos:</b> {consents.length}</li>
        </ul>
      </div>

      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">02</span>
          <h2 className="sec-title">Fontes que alimentaram seu gêmeo</h2>
          <p className="sec-sub">Cada item aqui só entrou com seu consentimento expresso. Em produção, listará também o consentimento por origem.</p>
        </div>
        {dataSources.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Nenhuma fonte registrada ainda.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.7, fontSize: 13 }}>
                <th>Fonte</th><th>Rótulo</th><th>Tamanho</th><th>Quando</th>
              </tr>
            </thead>
            <tbody>
              {dataSources.map((d) => (
                <tr key={d.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                  <td>{SOURCE_LABEL[d.kind] || d.kind}</td>
                  <td>{d.label}</td>
                  <td>{d.sizeBytes ? `${(d.sizeBytes / 1024).toFixed(1)} KB` : "—"}</td>
                  <td>{new Date(d.ingestedAt).toLocaleString("pt-BR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">03</span>
          <h2 className="sec-title">Baixar uma cópia</h2>
          <p className="sec-sub">JSON com tudo que está em seu nome no banco — usuário, perfil, snapshots, consentimentos.</p>
        </div>
        <a className="btn btn-primary" href="/api/me/export">Baixar meus dados (JSON)</a>
      </div>

      <div className="sec" style={{ borderTop: "1px solid #c33", paddingTop: 16 }}>
        <div className="sec-head">
          <span className="sec-no" style={{ color: "#c33" }}>04</span>
          <h2 className="sec-title">Apagar tudo</h2>
          <p className="sec-sub">
            Isso remove sua conta, perfil, todos os snapshots/gaps/plano, consentimentos
            e contas vinculadas (LinkedIn). Operação irreversível — recomendamos baixar
            os dados antes.
          </p>
        </div>
        <form action={eraseAction} style={{ display: "grid", gap: 8, maxWidth: 420 }}>
          <label htmlFor="confirm">Digite <b>APAGAR</b> em maiúsculas para confirmar</label>
          <input
            id="confirm"
            name="confirm"
            type="text"
            autoComplete="off"
            maxLength={20}
            placeholder="APAGAR"
            style={{ padding: 10, borderRadius: 8 }}
          />
          {erroConfirmar && (
            <div className="err">Confirmação não bateu. Digite exatamente APAGAR.</div>
          )}
          <button className="btn" style={{ background: "#c33", color: "white" }} type="submit">
            Apagar tudo definitivamente
          </button>
        </form>
      </div>
    </main>
  );
}
