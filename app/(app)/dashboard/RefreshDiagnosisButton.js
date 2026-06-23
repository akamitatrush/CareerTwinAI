"use client";

// Botão "Atualizar diagnóstico" no empty state das microações.
// Reusa o rawCv armazenado em Profile pra refazer o diagnóstico sem que o user
// precise re-colar o CV. Quando todas as microações foram concluídas, oferece
// modal pedindo se quer cristalizar as skills concluídas no perfil antes do
// recálculo (trust: usuário decide; recomendação inline orienta).
//
// Tratamento de erros mapeados do servidor:
//  - NO_RAW_CV: TTL de 90 dias expirou — redireciona pra / (re-colar CV).
//  - NO_TARGET_ROLE: redireciona pra /conta.
//  - LIMIT_REACHED: mostra mensagem; user vai pra /precos manualmente.
//  - rate limit / generic: mostra mensagem, permite retry.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RefreshDiagnosisButton({
  allGapsDone,
  projectedGain,
  completedCount,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showApplyModal, setShowApplyModal] = useState(false);
  // Result toast: aparece apos sucesso pra confirmar movimento real do score.
  // Sem isso, user nao percebia mudanca pequena (ex: 56 -> 60) — pensava que
  // "nao mexeu" e clicava de novo, criando loop perceptual.
  const [resultToast, setResultToast] = useState(null);

  async function refresh(applyCompletedSkills) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applyCompletedSkills }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === "NO_RAW_CV" || data?.code === "NO_TARGET_ROLE") {
          // Redirect explícito (rota indica destino).
          if (data?.redirectTo) {
            router.push(data.redirectTo);
            return;
          }
        }
        throw new Error(
          data?.error || "Não consegui atualizar agora. Tente em alguns segundos."
        );
      }
      // Sucesso: refresh server component pra mostrar novo snapshot/score.
      setShowApplyModal(false);
      // Mostra delta antes de re-renderizar — toast persiste 6s.
      const delta = Number(data?.delta) || 0;
      const score = Number(data?.score) || 0;
      const previousScore = Number(data?.previousScore) || 0;
      setResultToast({ delta, score, previousScore, applied: !!applyCompletedSkills });
      router.refresh();
      // Auto-dismiss apos 6s pra nao poluir.
      setTimeout(() => setResultToast(null), 6000);
    } catch (e) {
      setError(e?.message || "Tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  if (showApplyModal) {
    return (
      <div className="ct-refresh-modal" role="dialog" aria-modal="true" aria-labelledby="ct-refresh-title">
        <h3 id="ct-refresh-title">Aplicar conquistas ao perfil?</h3>
        <p>
          Você marcou <strong>{completedCount}</strong>{" "}
          {completedCount === 1 ? "ação" : "ações"}. Quer adicionar essas skills
          ao seu perfil profissional antes de recalcular o score?
        </p>
        <p className="ct-refresh-hint">
          Recomendação: adicione apenas se tem evidência real (curso, projeto,
          certificação). Você pode documentar essas evidências em{" "}
          <a href="/evidencias">/evidencias</a> antes ou depois.
        </p>
        {error && (
          <p role="alert" className="ct-refresh-error">
            {error}
          </p>
        )}
        <div className="ct-refresh-actions">
          <button
            type="button"
            disabled={loading}
            onClick={() => refresh(true)}
            className="btn btn-primary"
          >
            {loading ? "Atualizando…" : "Aplicar e recalcular"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => refresh(false)}
            className="btn btn-ghost"
          >
            Só recalcular sem aplicar
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setShowApplyModal(false)}
            className="ct-btn-text"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ct-empty-card">
      {resultToast && (
        <div
          role="status"
          aria-live="polite"
          className={
            "ct-refresh-toast" +
            (resultToast.delta > 0 ? " up" : resultToast.delta < 0 ? " down" : "")
          }
        >
          {resultToast.delta > 0 ? (
            <>
              <strong>Score subiu +{resultToast.delta} pts!</strong>{" "}
              De {resultToast.previousScore} para {resultToast.score}.
              {resultToast.applied && " Conquistas aplicadas ao perfil."}
            </>
          ) : resultToast.delta === 0 ? (
            <>
              <strong>Score se manteve em {resultToast.score}.</strong>{" "}
              Adicione mais evidências em <a href="/evidencias">/evidencias</a>{" "}
              ou marque novas microações pra ver movimento.
            </>
          ) : (
            <>
              <strong>Score caiu {resultToast.delta} pts.</strong> Algumas
              skills podem ter sido re-avaliadas — confira em /transparencia.
            </>
          )}
        </div>
      )}
      {allGapsDone ? (
        <>
          <strong>Você concluiu todas as ações.</strong> O score acima ainda
          mostra o estado do CV que você analisou. Pra cristalizar os{" "}
          <strong>+{projectedGain} pontos projetados</strong>:
          {error && (
            <p role="alert" className="ct-refresh-error">
              {error}
            </p>
          )}
          <div className="ct-refresh-actions">
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowApplyModal(true)}
              className="btn btn-primary"
            >
              {loading ? "Atualizando…" : "Atualizar diagnóstico →"}
            </button>
          </div>
          <p className="ct-refresh-foot">
            Reusa seu CV armazenado · LLM regenera diagnóstico · ~15s
          </p>
        </>
      ) : (
        <>
          <strong>Sem microações pendentes neste snapshot.</strong>
          {error && (
            <p role="alert" className="ct-refresh-error">
              {error}
            </p>
          )}
          <div className="ct-refresh-actions">
            <button
              type="button"
              disabled={loading}
              onClick={() => refresh(false)}
              className="btn btn-ghost"
            >
              {loading ? "Atualizando…" : "Atualizar diagnóstico"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
