import { signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

const hasEmail = !!(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);
const hasLinkedIn = !!(process.env.AUTH_LINKEDIN_ID && process.env.AUTH_LINKEDIN_SECRET);
const hasDevCreds =
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_CREDENTIALS === "true";

async function emailAction(formData) {
  "use server";
  const raw = String(formData.get("email") || "").trim().toLowerCase();
  if (!raw || raw.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    // Mensagem genérica intencional — não revela se o e-mail existe.
    return;
  }
  await signIn("nodemailer", { email: raw, redirectTo: "/meu-gemeo" });
}

async function linkedinAction() {
  "use server";
  await signIn("linkedin", { redirectTo: "/meu-gemeo" });
}

async function devAction(formData) {
  "use server";
  const raw = String(formData.get("email") || "").trim().toLowerCase();
  if (!raw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return;
  await signIn("dev", { email: raw, redirectTo: "/meu-gemeo" });
}

export default function EntrarPage({ searchParams }) {
  const enviado = searchParams?.enviado === "1";

  return (
    <main className="wrap" style={{ maxWidth: 480, paddingTop: 48 }}>
      <h1 className="hero" style={{ fontSize: 36 }}>Entrar</h1>
      <p className="hero-lede">
        Seu gêmeo de carreira fica salvo só pra você. Entre por e-mail (link
        mágico) {hasLinkedIn ? "ou com sua conta do LinkedIn" : ""}.
      </p>

      {enviado && (
        <div className="note-line" style={{ marginBottom: 16 }}>
          Se houver uma conta com esse e-mail, enviamos um link de acesso. Confira sua caixa de entrada (e o spam).
        </div>
      )}

      {hasEmail && (
        <form action={emailAction} style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={200}
            placeholder="voce@exemplo.com"
            style={{ padding: 10, borderRadius: 8 }}
          />
          <button className="btn btn-primary" type="submit">
            Enviar link de acesso
          </button>
        </form>
      )}

      {hasLinkedIn && (
        <form action={linkedinAction} style={{ marginBottom: 16 }}>
          <button className="btn btn-ghost" type="submit">
            Entrar com LinkedIn
          </button>
        </form>
      )}

      {hasDevCreds && (
        <form action={devAction} style={{ display: "grid", gap: 8, marginTop: 24, padding: 12, border: "1px dashed #888", borderRadius: 8 }}>
          <p style={{ fontSize: 12, opacity: 0.8 }}>
            <b>Modo dev</b> (NÃO disponível em produção): entra direto pelo e-mail.
          </p>
          <input
            name="email"
            type="email"
            required
            placeholder="dev@local"
            style={{ padding: 10, borderRadius: 8 }}
          />
          <button className="btn btn-ghost" type="submit">Entrar (dev)</button>
        </form>
      )}

      {!hasEmail && !hasLinkedIn && !hasDevCreds && (
        <p className="err">
          Nenhum provider de login configurado. Defina <code>EMAIL_SERVER</code>
          + <code>EMAIL_FROM</code> ou <code>AUTH_LINKEDIN_ID/SECRET</code> no .env.
        </p>
      )}
    </main>
  );
}
