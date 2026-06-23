import Link from "next/link";

// Pagina 404 global. Next 14 renderiza isso quando notFound() e chamado ou
// quando a rota nao bate com nenhum match estatico/dinamico.
// Sem "use client" — totalmente estatica, sem JS.

export const metadata = { title: "Nao encontrado — CareerTwin AI" };

export default function NotFound() {
  return (
    <main className="app-container" style={{ paddingTop: 80 }}>
      <div className="ct-dash-empty">
        <h2>Essa rota nao existe.</h2>
        <p>Voce seguiu um link velho ou digitou errado.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <Link href="/" className="btn-primary">
            Voltar pra home
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            Ir pro dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
