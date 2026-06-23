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
      router.refresh();
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
