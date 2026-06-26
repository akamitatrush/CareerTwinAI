"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";

/**
 * Card de microacao com fluxo cliente de "concluir / desfazer".
 *
 * Estado local refletido na UI:
 *  - done: usuario marcou como concluido nessa sessao OU veio com completedAt do snapshot.
 *  - busy: ha request em voo (desabilita botao pra evitar duplo POST/DELETE).
 *  - error: mensagem curta exibida abaixo da microacao em caso de falha de rede / 4xx / 5xx.
 *
 * UI consistency em caso de refresh falhar:
 *  Mantemos o estado otimista (done=true) MESMO se router.refresh() falhar.
 *  Motivo: o POST ja persistiu no banco; o refresh so reordena/recalcula.
 *  Se o refresh quebrar, na proxima navegacao normal o estado vai bater.
 *  Nao revertemos otimismo em refresh-failure pra nao confundir o usuario
 *  ("cliquei, ficou done, mas voltou pendente — bug?").
 *  Se o POST/DELETE falhar (status != 2xx), ai sim revertemos e mostramos erro.
 */
export default function ActionCardClient({ gap, index }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(!!gap.completedAt);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function markDone() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/gaps/${gap.id}/complete`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falhou");
      setDone(true);
      track(EVENTS.GAP_COMPLETED, {
        gap_id: gap.id,
        impacto_pontos: gap.impactoPontos || 0,
      });
      // router.refresh recalcula gaps no server (filtro completedAt) sem
      // tirar a UI do ar. Falha aqui nao reverte estado: ver comentario topo.
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e.message || "Tenta de novo");
    } finally {
      setBusy(false);
    }
  }

  async function undoDone() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/gaps/${gap.id}/complete`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falhou");
      }
      setDone(false);
      track(EVENTS.GAP_UNCOMPLETED, { gap_id: gap.id });
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e.message || "Tenta de novo");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={"ct-action-card" + (done ? " done" : "")}>
      <div className="ct-action-num">{done ? "✓" : index + 1}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ct-action-top">
          <div className="ct-action-title">{gap.habilidade}</div>
          <span className="ct-action-impact">
            +{gap.impactoPontos || 4} pts
          </span>
        </div>
        <p className="ct-action-why">{gap.microacao || gap.porque || ""}</p>
        {error && (
          <p
            role="alert"
            style={{
              color: "var(--attention-deep)",
              fontSize: 11,
              margin: "6px 0 0",
            }}
          >
            {error}
          </p>
        )}
        <div className="ct-action-foot">
          <span className="ct-action-tag">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2-6.3-4.6L5.7 21l2.3-7.2-6-4.4h7.6z" />
            </svg>
            {gap.frequencia || "alta frequência"}
          </span>
          {done ? (
            <button
              type="button"
              onClick={undoDone}
              disabled={busy}
              className="ct-action-cta"
            >
              {busy ? "Desfazendo..." : "Desfazer"}
            </button>
          ) : (
            <button
              type="button"
              onClick={markDone}
              disabled={busy}
              className="ct-action-cta"
            >
              {busy ? "Marcando..." : "Concluir →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
