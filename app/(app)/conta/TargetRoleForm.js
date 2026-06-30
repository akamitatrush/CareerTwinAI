"use client";

// TargetRoleForm — form client-side pra editar Profile.targetRole com
// auto-refresh sincrono do ScoreSnapshot.
//
// Bug raiz reportado pelo fundador 2026-06-30 (po-oportunidades-auditoria §3.5):
//   User editava cargo em /conta -> Profile.targetRole mudava -> mas
//   ScoreSnapshot.role ficava preso no antigo -> /oportunidades ranqueava vagas
//   do role velho enquanto pill mostrava novo. Inconsistencia silenciosa
//   destruia confianca em 30s.
//
// Decisao fundador: opcao (a) auto-refresh sincrono. ~15s de bloqueio UX e
// melhor que inconsistencia. Trade-off documentado em perf-vercel-next §LLM
// bottleneck.
//
// Fluxo:
//   1. Submete -> chama server action updateTargetRole (rapido, <500ms)
//   2. Se roleChanged=true -> POST /api/profile/refresh (sincrono, 10-15s)
//   3. Mostra loading "Atualizando seu diagnostico..." durante o refresh
//   4. Sucesso: router.refresh pra mostrar pill nova
//   5. Refresh falha: warning amigavel, mas Profile.targetRole JA esta salvo
//      (degradacao graceful — banner de divergencia em /oportunidades sinaliza)
//
// Edge cases tratados:
//   - targetRole nao mudou (so re-salvou) -> nao dispara refresh
//   - oldRole vazio + newRole preenchido -> dispara refresh (primeira vez)
//   - newRole vazio (limpar) -> NAO dispara refresh (sem role, refresh retorna
//     NO_TARGET_ROLE — economiza chamada)
//   - Refresh ja rodando (double-click) -> botao disabled + guard local
//
// a11y: aria-live="polite" no status pra screen reader anunciar progresso.

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateTargetRole } from "./actions";

export default function TargetRoleForm({ initialTargetRole = "" }) {
  const router = useRouter();
  const [value, setValue] = useState(initialTargetRole || "");
  const [phase, setPhase] = useState("idle"); // idle | saving | refreshing | done
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  // Guard local contra double-submit (botao disabled + flag).
  const inFlight = useRef(false);

  const loading = phase === "saving" || phase === "refreshing";
  const busy = loading || inFlight.current;

  async function onSubmit(e) {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    setWarning("");
    setPhase("saving");

    try {
      // 1) Persist Profile.targetRole via server action.
      const result = await updateTargetRole({ targetRole: value });
      if (!result.ok) {
        setError(result.message || "Nao foi possivel salvar agora.");
        setPhase("idle");
        return;
      }

      // 2) Decide se dispara refresh sincrono.
      // - roleChanged=false: nada a fazer; profile salvo + revalidatePath ja rolou.
      // - newRole vazio: refresh retornaria NO_TARGET_ROLE — pula.
      const shouldRefresh = result.roleChanged && Boolean(result.newRole);
      if (!shouldRefresh) {
        setPhase("done");
        router.refresh();
        return;
      }

      // 3) POST /api/profile/refresh — sincrono pra resincronizar
      // ScoreSnapshot.role. ~10-15s tipico (Anthropic Sonnet + searchJobs).
      setPhase("refreshing");
      try {
        const res = await fetch("/api/profile/refresh", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // applyCompletedSkills:false — esse fluxo nao aplica conquistas,
          // so resincroniza role. User aplica conquistas em /dashboard.
          body: JSON.stringify({ applyCompletedSkills: false }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Degradacao graceful: profile foi salvo, mas diagnostico nao
          // atualizou. Banner /oportunidades sinaliza divergencia. Mensagem
          // amigavel sem detalhe tecnico.
          const code = data?.code;
          if (code === "NO_RAW_CV") {
            setWarning(
              "Cargo-alvo salvo. Seu CV nao esta mais armazenado — refaca o diagnostico em /."
            );
          } else if (code === "LIMIT_REACHED" || code === "BUDGET_EXCEEDED") {
            setWarning(
              "Cargo-alvo salvo. Voce atingiu o limite do plano — refaca o diagnostico depois."
            );
          } else {
            setWarning(
              "Cargo-alvo salvo, mas nao consegui atualizar o diagnostico agora. Tente refazer em /dashboard."
            );
          }
        }
      } catch {
        // Falha de rede tambem cai em degradacao graceful.
        setWarning(
          "Cargo-alvo salvo, mas nao consegui atualizar o diagnostico agora. Tente refazer em /dashboard."
        );
      }

      setPhase("done");
      router.refresh();
    } finally {
      inFlight.current = false;
    }
  }

  // Botao label muda por fase pra UX honesta sobre o que esta acontecendo.
  let buttonLabel = "Salvar cargo-alvo";
  if (phase === "saving") buttonLabel = "Salvando...";
  else if (phase === "refreshing") buttonLabel = "Atualizando seu diagnostico...";

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: "grid", gap: 8, maxWidth: 480 }}
    >
      <label htmlFor="targetRole" className="ct-conta-label">
        Cargo-alvo
      </label>
      <input
        id="targetRole"
        name="targetRole"
        type="text"
        maxLength={80}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ex: Product Manager de IA"
        className="ct-conta-input"
        disabled={busy}
      />
      <div>
        <button
          className="ct-conta-btn primary"
          type="submit"
          disabled={busy}
          aria-busy={loading ? "true" : "false"}
        >
          {buttonLabel}
        </button>
      </div>

      {/* Status acessivel — aria-live polite pra screen reader anunciar progresso
          sem interromper foco. Mostra explicacao de tempo durante o refresh. */}
      <div
        role="status"
        aria-live="polite"
        style={{ minHeight: phase === "refreshing" ? "auto" : 0 }}
      >
        {phase === "refreshing" && (
          <p
            style={{
              fontSize: 12.5,
              color: "var(--text-soft)",
              margin: "6px 0 0",
            }}
          >
            Reanalizando seu CV com o novo cargo — leva 10-15 segundos. Nao
            feche esta pagina.
          </p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          style={{
            fontSize: 13,
            color: "var(--attention-deep)",
            margin: "6px 0 0",
          }}
        >
          {error}
        </p>
      )}

      {warning && (
        <p
          role="status"
          aria-live="polite"
          style={{
            fontSize: 12.5,
            color: "var(--text-soft)",
            background: "var(--attention-soft)",
            border: "1px solid var(--attention-tint)",
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            margin: "6px 0 0",
          }}
        >
          {warning}
        </p>
      )}
    </form>
  );
}
