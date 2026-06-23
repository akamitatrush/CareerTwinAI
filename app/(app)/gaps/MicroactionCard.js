"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Card de microacao para a tela /gaps.
 *
 * Mesma logica de optimismo do ActionCardClient do dashboard:
 *  - busy: desabilita o botao enquanto a request roda (sem duplo POST/DELETE)
 *  - done: estado otimista local. Sincronizado inicialmente com gap.completedAt.
 *  - error: msg curta abaixo do card em falha de rede / 4xx / 5xx.
 *
 * Em caso de falha de fetch (rede ou status != 2xx) revertemos via setError
 * e mantemos o estado anterior (nao toggla). Se o POST/DELETE der ok mas o
 * router.refresh() falhar, mantemos o estado otimista — o banco ja persistiu;
 * o refresh so reordena/recalcula e bate na proxima navegacao.
 *
 * Diferenca pro dashboard: aqui mostramos sempre o card (mesmo se done),
 * com estilo .done aplicado, e o botao vira "Desfazer" pra permitir reverter.
 */
export default function MicroactionCard({ gap }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(!!gap.completedAt);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const method = done ? "DELETE" : "POST";
      const res = await fetch(`/api/gaps/${gap.id}/complete`, { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falhou");
      }
      setDone(!done);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e.message || "Tenta de novo");
    } finally {
      setBusy(false);
    }
  }

  // Remove citacao "[fonte: ...]" do final do "porque" (ruido visual aqui).
  const porqueLimpo = gap.porque
    ? gap.porque.replace(/\s*\[(.+?)\]\s*$/, "")
    : "";

  return (
    <div className={"ct-microaction-card" + (done ? " done" : "")}>
      <div className="ct-microaction-head">
        <div className="ct-microaction-skill">{gap.habilidade}</div>
        <span className="ct-microaction-impact">
          {gap.frequencia || "alta freq."} · +{gap.impactoPontos || 4} pts
        </span>
      </div>
      {porqueLimpo && <p className="ct-microaction-why">{porqueLimpo}</p>}
      {gap.microacao && (
        <p className="ct-microaction-action">
          <strong>O que fazer:</strong> {gap.microacao}
        </p>
      )}
      {error && (
        <p className="ct-microaction-error" role="alert">
          {error}
        </p>
      )}
      <div className="ct-microaction-foot">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={"ct-microaction-cta" + (done ? " done" : "")}
        >
          {busy ? "..." : done ? "✓ Concluído (desfazer)" : "Marcar como concluído →"}
        </button>
      </div>
    </div>
  );
}
