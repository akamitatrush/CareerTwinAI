"use client";

// Error boundary do grupo (app) — rotas autenticadas (dashboard, oportunidades,
// plano, transparencia, etc). Renderiza DENTRO do AppShell — sidebar + topbar
// continuam funcionando, so o conteudo principal cai pro fallback.
//
// UX: usuario nao perde contexto de navegacao. Pode pular pra outra secao do
// app sem precisar recarregar tudo.

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({ error, reset }) {
  useEffect(() => {
    if (typeof window !== "undefined" && window.Sentry?.captureException) {
      window.Sentry.captureException(error, {
        tags: { error_boundary: "app_route" },
        extra: { digest: error?.digest },
      });
    }
  }, [error]);

  return (
    <main className="app-container" id="main-content">
      <div className="ct-dash-empty">
        <h2>Essa parte do app teve um solucinho.</h2>
        <p>
          Os outros dados estao a salvo. Tenta de novo ou volta pro dashboard.
          {error?.digest && (
            <span style={{ display: "block", fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>
              ID: {error.digest}
            </span>
          )}
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={() => reset()} className="btn btn-primary">
            Tentar de novo
          </button>
          <Link href="/dashboard" className="btn-ghost">
            Ir pro dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
