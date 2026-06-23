"use client";

// Error boundary do segmento raiz (paginas publicas: /, /entrar, /privacidade,
// /termos, etc). Mantem o root layout (PostHog provider, ThemeToggle, fontes)
// — substitui apenas o conteudo da rota com falha.
//
// Erros que escapam ate do root layout caem em app/global-error.js.
// Erros dentro do grupo (app)/* caem em app/(app)/error.js primeiro.

import { useEffect } from "react";
import Link from "next/link";

export default function RootError({ error, reset }) {
  useEffect(() => {
    if (typeof window !== "undefined" && window.Sentry?.captureException) {
      window.Sentry.captureException(error, {
        tags: { error_boundary: "root_route" },
        extra: { digest: error?.digest },
      });
    }
  }, [error]);

  return (
    <main className="app-container" style={{ paddingTop: 80 }}>
      <div className="ct-dash-empty">
        <h2>Algo deu errado aqui.</h2>
        <p>
          Voce nao esta perdendo dados — so essa tela travou. A gente ja foi notificado.
          {error?.digest && (
            <span style={{ display: "block", fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>
              Codigo do incidente: {error.digest}
            </span>
          )}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={() => reset()} className="btn-primary">
            Tentar de novo
          </button>
          <Link href="/" className="btn-ghost">
            Voltar pra home
          </Link>
        </div>
      </div>
    </main>
  );
}
