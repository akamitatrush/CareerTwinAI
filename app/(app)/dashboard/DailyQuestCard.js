"use client";

// DailyQuestCard — feature #10 (habit loop) do STRATEGY_ROADMAP.
//
// Renderiza a quest do dia (busca via GET /api/me/daily-quest, lazy-cria no
// server se ainda nao existe). Quando o user clica "Marquei como feito",
// dispara POST /complete e atualiza UI otimisticamente.
//
// Sem persistir nada no client — fonte de verdade e sempre o server. Em erro,
// componente fica invisivel (return null) pra nao poluir dashboard com
// "erro genérico" — observabilidade fica no servidor (Sentry/console).

import { useState, useEffect } from "react";
import { track } from "@/components/PostHogProvider";

export default function DailyQuestCard() {
  const [quest, setQuest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/daily-quest")
      .then(async (r) => {
        if (!r.ok) {
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        setQuest(data.quest || null);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function complete() {
    if (!quest || completing) return;
    setCompleting(true);
    try {
      const res = await fetch("/api/me/daily-quest/complete", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setQuest({
          ...quest,
          completedAt: data.completedAt || new Date().toISOString(),
        });
        track("daily_quest_completed", {
          kind: quest.kind,
          points: quest.rewardPoints,
        });
      }
    } finally {
      setCompleting(false);
    }
  }

  // Estados de "nao mostrar":
  //  - loading: spinner-less (evita CLS — dashboard ja tem layout denso)
  //  - error ou sem quest: nao renderiza (degrada silenciosamente)
  if (loading || error || !quest) return null;

  const done = !!quest.completedAt;

  return (
    <div
      className={"ct-daily-quest" + (done ? " done" : "")}
      role="region"
      aria-label="Missão do dia"
    >
      <div className="ct-daily-quest-head">
        <span className="ct-daily-quest-label">
          QUEST DO DIA · +{quest.rewardPoints}pts
        </span>
        <span className="ct-daily-quest-time">~{quest.estimatedMinutes}min</span>
      </div>
      <h3 className="ct-daily-quest-title">{quest.title}</h3>
      <p className="ct-daily-quest-desc">{quest.description}</p>
      {done ? (
        <div className="ct-daily-quest-done">
          ✓ Concluído — volta amanhã pra próxima
        </div>
      ) : (
        <button
          type="button"
          onClick={complete}
          disabled={completing}
          className="btn btn-primary"
        >
          {completing ? "Salvando…" : "Marquei como feito"}
        </button>
      )}
    </div>
  );
}
