"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Card expandido de microacao (ato 3 da /gaps).
 *
 * Logica de optimismo identica a antes:
 *  - busy: desabilita o botao enquanto a request roda (sem duplo POST/DELETE)
 *  - done: estado otimista local. Sincronizado inicialmente com gap.completedAt.
 *  - error: msg curta abaixo do card em falha de rede / 4xx / 5xx.
 *
 * Em caso de falha de fetch (rede ou status != 2xx) revertemos via setError
 * e mantemos o estado anterior (nao toggla). Se o POST/DELETE der ok mas o
 * router.refresh() falhar, mantemos o estado otimista — o banco ja persistiu;
 * o refresh so reordena/recalcula e bate na proxima navegacao.
 *
 * NOVO no redesign:
 *  - prop `courses`: lista (ate 2) de cursos pre-calculados em server pra
 *    aquela habilidade. Render inline dentro do card pra eliminar a secao
 *    separada "Cursos sugeridos" no final da pagina.
 *  - visual: card grande, border-left de 3px colorida (indigo pendente,
 *    verde feito), check visual grande no done state.
 *  - "Por que" + "O que fazer" estao mais espacosos.
 */
export default function MicroactionCard({ gap, courses = [], priority }) {
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

  const impactPts = gap.impactoPontos || 4;
  const cardClass =
    "ct-microaction-card" +
    (done ? " done" : "") +
    (priority === "top" && !done ? " priority-top" : "");

  return (
    <article className={cardClass}>
      <div className="ct-microaction-leftrail">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={"ct-microaction-check" + (done ? " done" : "")}
          aria-label={
            done
              ? `Desfazer conclusão da microação ${gap.habilidade}`
              : `Marcar microação ${gap.habilidade} como concluída`
          }
          title={done ? "Desfazer" : "Marcar como concluída"}
        >
          {done ? "✓" : ""}
        </button>
      </div>

      <div className="ct-microaction-body">
        <header className="ct-microaction-head">
          <div className="ct-microaction-head-left">
            <span className="ct-microaction-label">Habilidade</span>
            <h3 className="ct-microaction-skill">{gap.habilidade}</h3>
          </div>
          <div className="ct-microaction-head-right">
            {priority === "top" && !done && (
              <span className="ct-microaction-priority" title="Maior impacto no score">
                top prioridade
              </span>
            )}
            <span className="ct-microaction-impact" title="Pontos estimados de ganho no score">
              +{impactPts} pts
            </span>
          </div>
        </header>

        {porqueLimpo && (
          <div className="ct-microaction-block">
            <span className="ct-microaction-block-label">Por que importa</span>
            <p className="ct-microaction-why">{porqueLimpo}</p>
          </div>
        )}

        {gap.microacao && (
          <div className="ct-microaction-block">
            <span className="ct-microaction-block-label">Próximo passo</span>
            <p className="ct-microaction-action">{gap.microacao}</p>
          </div>
        )}

        {courses && courses.length > 0 && (
          <div className="ct-microaction-courses">
            <div className="ct-microaction-courses-head">
              <span className="ct-microaction-courses-label">
                Cursos sugeridos pra esta lacuna
              </span>
            </div>
            <div className="ct-microaction-courses-grid">
              {courses.map((c) => (
                <a
                  key={c.id}
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ct-microaction-course"
                >
                  <div className="ct-microaction-course-head">
                    <span className="ct-microaction-course-provider">
                      {c.provider}
                    </span>
                    {c.free && (
                      <span className="ct-microaction-course-free">grátis</span>
                    )}
                  </div>
                  <span className="ct-microaction-course-title">{c.title}</span>
                  <span className="ct-microaction-course-meta">
                    {c.duration} · {c.level} · {c.language}
                  </span>
                  <span className="ct-microaction-course-cta">Ver curso ↗</span>
                </a>
              ))}
            </div>
          </div>
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
            {busy
              ? "..."
              : done
                ? "✓ Concluída (desfazer)"
                : "Marcar como concluída →"}
          </button>
        </div>
      </div>
    </article>
  );
}
