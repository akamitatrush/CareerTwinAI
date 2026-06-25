"use client";

// WelcomeModal — primeiro contato in-app com o produto.
//
// Mostra apenas no 1o acesso. Combina 2 checks pra reduzir risco de
// "ja vi mas o flag nao salvou":
//  1. localStorage flag `ct_welcome_shown` (lado cliente, rapido)
//  2. GET /api/profile/onboarding — Profile.welcomedAt null (lado servidor)
//
// Se AMBOS dizem "nunca vi", mostra modal. Ao dismissar (X, ESC, ou CTA),
// seta localStorage + dispara WELCOME_DISMISSED. WELCOME_SHOWN dispara no
// mount (1x por componente).
//
// Tambem chama POST /api/auth/welcome-sent fire-and-forget pra disparar o
// email de boas-vindas (fail-safe — server-side checa idempotencia).
//
// Acessibilidade: usa Modal existente que ja tem role=dialog, aria-modal,
// focus trap e fechamento por ESC.
//
// USO (TODO manual): adicionar <WelcomeModal /> em app/(app)/layout.js
// quando consolidar — render condicional vive aqui, montar ja eh seguro.

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { track } from "./PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";

const STORAGE_KEY = "ct_welcome_shown";

// Cards visuais do produto. Sem assets externos — emoji + CSS inline.
// Cor accent diferente por card pra dar sensacao de hierarquia visual.
const CARDS = [
  {
    icon: "◇",
    title: "Diagnóstico",
    desc: "Career Health Score 0-100 com fórmula auditável.",
    accent: "#4F46E5",
  },
  {
    icon: "✦",
    title: "Gaps",
    desc: "Lacunas reais com microação acionável pra cada.",
    accent: "#06B6D4",
  },
  {
    icon: "→",
    title: "Vagas",
    desc: "Match real com seu perfil, atualizado semanalmente.",
    accent: "#8B5CF6",
  },
];

export default function WelcomeModal() {
  const [show, setShow] = useState(false);
  const router = useRouter();
  const trackedShown = useRef(false);

  // Decide se monta. Roda 1x no mount. Combina localStorage + server check.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function decide() {
      try {
        // Check 1: localStorage flag. Se ja vi, no-op.
        const seen = window.localStorage.getItem(STORAGE_KEY);
        if (seen) return;
      } catch {
        // localStorage indisponivel (modo privado, quota cheia) — segue
        // pro server check; pior caso modal aparece mais de uma vez mas
        // welcomedAt server-side ainda funciona como segundo gate.
      }

      // Check 2: server-side — Profile.welcomedAt null?
      try {
        const res = await fetch("/api/profile/onboarding", {
          method: "GET",
          headers: { accept: "application/json" },
          credentials: "same-origin",
        });
        if (!res.ok) return; // 401/500 — nao mostra (fail-safe)
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        // Aceita formato { welcomedAt }, { profile: { welcomedAt } } e
        // tambem campo computado tipo isNewUser. computeOnboardingState
        // hoje nao expoe welcomedAt direto — mas o endpoint pode evoluir.
        // Estrategia segura: se NAO conseguir confirmar "ja visto", mostra.
        const welcomedAt =
          data?.welcomedAt ||
          data?.profile?.welcomedAt ||
          data?.state?.welcomedAt ||
          null;
        if (!welcomedAt) {
          setShow(true);
        }
      } catch {
        // Fetch falhou — nao mostra (defensivo, evita flicker em erro de rede).
      }
    }

    decide();
    return () => {
      cancelled = true;
    };
  }, []);

  // WELCOME_SHOWN dispara 1x quando o modal vira visivel. Tambem chama o
  // endpoint que envia o welcome email (fail-safe; servidor checa idempotencia).
  useEffect(() => {
    if (!show || trackedShown.current) return;
    trackedShown.current = true;
    try {
      track(EVENTS.WELCOME_SHOWN, {});
    } catch {}
    // Fire-and-forget: dispara welcome email. Resposta nao importa pro UI.
    try {
      fetch("/api/auth/welcome-sent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
      }).catch(() => {});
    } catch {}
  }, [show]);

  function handleDismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {}
    try {
      track(EVENTS.WELCOME_DISMISSED, {});
    } catch {}
    setShow(false);
  }

  function handleStart() {
    // Marca como visto + tracking igual ao dismiss. Diferenca: tambem
    // tenta scroll pro topo do dashboard (UX coerente com "comecar agora").
    handleDismiss();
    try {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {}
    // Em rota fora do dashboard, navega pra la (sem hard reload).
    try {
      if (typeof window !== "undefined" && window.location.pathname !== "/dashboard") {
        router.push("/dashboard");
      }
    } catch {}
  }

  if (!show) return null;

  return (
    <Modal
      title="Bem-vindo ao CareerTwin AI"
      subtitle="Seu copiloto de carreira em 3 passos simples."
      onClose={handleDismiss}
      wide
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
          }}
        >
          {CARDS.map((c) => (
            <div
              key={c.title}
              style={{
                padding: "18px 16px",
                borderRadius: 10,
                border: "1px solid var(--border, #E5E7EB)",
                background: "var(--surface-soft, #F8FAFC)",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  fontSize: 22,
                  lineHeight: 1,
                  fontWeight: 700,
                  color: c.accent,
                }}
              >
                {c.icon}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text, #0F172A)",
                }}
              >
                {c.title}
              </div>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--text-muted, #475569)",
                }}
              >
                {c.desc}
              </div>
            </div>
          ))}
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            lineHeight: 1.55,
            color: "var(--text-muted, #475569)",
          }}
        >
          Em ~5 minutos: cole seu CV + cargo-alvo. A IA cuida do resto e te
          devolve um diagnóstico honesto com microações.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            className="btn btn-ghost"
            style={{ background: "transparent" }}
          >
            Mais tarde
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="btn btn-primary"
            autoFocus
          >
            Começar diagnóstico
          </button>
        </div>
      </div>
    </Modal>
  );
}
