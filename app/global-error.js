"use client";

// Global error boundary do Next.js 14 App Router.
// Pega erros que escapam ate do root layout — por isso renderiza html+body
// (substitui o layout normal por completo). E o ultimo nivel de defesa.
//
// Casos cobertos: erro em providers (PostHog), em ThemeToggle, em metadata
// async, em qualquer coisa fora do <main>. Erros DENTRO de rotas autenticadas
// caem em app/(app)/error.js primeiro (mantem AppShell visivel).

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Sentry @sentry/nextjs auto-instrumenta e expoe em window.Sentry.
    // Capturamos explicitamente pra anexar tag de boundary (facilita filtro
    // no painel: "todos os erros que renderizaram tela de fallback").
    if (typeof window !== "undefined") {
      const sentry = window.Sentry;
      if (sentry?.captureException) {
        sentry.captureException(error, {
          tags: { error_boundary: "global_app" },
          extra: { digest: error?.digest },
        });
      }
    }
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
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
              <a href="/" className="btn-ghost">
                Voltar pra home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
