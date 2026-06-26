"use client";

// Modal opcional pra reportar outcome de busca. Aparece no /dashboard quando:
//  - User tem firstDiagnosisAt ha 30+/60+/90+ dias E
//  - User NAO tem Outcome registrado pra esse milestone (server-side check)
//
// Pergunta gentilmente: "Como tem sido sua busca?" — 6 opcoes (HIRED,
// HIRED_DIFFERENT, NOT_HIRED, STILL_LOOKING, PAUSED, DECLINED_TO_ANSWER).
// Submit -> POST /api/me/outcome. Dismiss -> POST DECLINED_TO_ANSWER pra
// nao perguntar de novo no mesmo milestone.
//
// Optional fields: monthsSearching (numero) + evidence (texto livre 500 chars
// no UI, 2000 chars max no validator).
//
// Sem dependencia de libs — usa Modal existente. Sem state pesado.

import { useState } from "react";
import Modal from "./Modal";

const KIND_OPTIONS = [
  {
    value: "HIRED",
    label: "Fui contratado pro cargo-alvo",
    emoji: "🎯",
  },
  {
    value: "HIRED_DIFFERENT",
    label: "Fui contratado pra um cargo diferente",
    emoji: "✅",
  },
  {
    value: "STILL_LOOKING",
    label: "Ainda estou procurando",
    emoji: "🔄",
  },
  {
    value: "NOT_HIRED",
    label: "Decidi parar de buscar por enquanto",
    emoji: "⏸️",
  },
  {
    value: "PAUSED",
    label: "Pausei (mudança de vida, estudo)",
    emoji: "🌱",
  },
  {
    value: "DECLINED_TO_ANSWER",
    label: "Prefiro não responder",
    emoji: "—",
  },
];

export default function OutcomeSurveyModal({
  open,
  surveyKind, // "THIRTY_DAYS" | "SIXTY_DAYS" | "NINETY_DAYS" — opcional
  onClose,
  onSubmitted,
}) {
  const [kind, setKind] = useState(null);
  const [monthsSearching, setMonthsSearching] = useState("");
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e) {
    e?.preventDefault?.();
    if (!kind) {
      setError("Escolha uma das opções acima.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const body = { kind };
      if (surveyKind) body.surveyKind = surveyKind;
      const months = parseInt(monthsSearching, 10);
      if (Number.isFinite(months) && months >= 0 && months <= 60) {
        body.monthsSearching = months;
      }
      // evidence: trim + limita 2000 chars (servidor valida tambem).
      const ev = (evidence || "").trim().slice(0, 2000);
      if (ev) body.evidence = ev;

      const res = await fetch("/api/me/outcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Falha ao enviar.");
      }
      onSubmitted?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || "Não consegui enviar agora. Tente de novo.");
    } finally {
      setSubmitting(false);
    }
  }

  // Dismiss => registra DECLINED_TO_ANSWER pra nao perguntar de novo.
  async function handleDismiss() {
    setSubmitting(true);
    try {
      const body = { kind: "DECLINED_TO_ANSWER" };
      if (surveyKind) body.surveyKind = surveyKind;
      await fetch("/api/me/outcome", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Silencioso — se falhar, nao queremos prender o user. Proxima visita
      // tenta de novo (vai re-aparecer ate funcionar, mas e ok).
    } finally {
      setSubmitting(false);
      onClose?.();
    }
  }

  const subtitle =
    surveyKind === "THIRTY_DAYS"
      ? "Faz cerca de 30 dias desde seu primeiro diagnóstico."
      : surveyKind === "SIXTY_DAYS"
        ? "Faz cerca de 60 dias desde seu primeiro diagnóstico."
        : surveyKind === "NINETY_DAYS"
          ? "Faz cerca de 90 dias desde seu primeiro diagnóstico."
          : "Compartilhe pra ajudar a construir nossa mediana real de contratados.";

  return (
    <Modal title="Como tem sido sua busca?" subtitle={subtitle} onClose={onClose}>
      <form onSubmit={handleSubmit} className="outcome-survey-form">
        <fieldset
          style={{
            border: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <legend
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 8,
              color: "var(--text-primary)",
            }}
          >
            Qual a sua situação hoje?
          </legend>
          {KIND_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border:
                  kind === opt.value
                    ? "2px solid var(--primary)"
                    : "1px solid var(--border)",
                borderRadius: 8,
                cursor: "pointer",
                background:
                  kind === opt.value ? "var(--primary-soft)" : "transparent",
              }}
            >
              <input
                type="radio"
                name="kind"
                value={opt.value}
                checked={kind === opt.value}
                onChange={() => setKind(opt.value)}
                style={{ marginRight: 4 }}
              />
              <span style={{ fontSize: 16 }} aria-hidden="true">
                {opt.emoji}
              </span>
              <span>{opt.label}</span>
            </label>
          ))}
        </fieldset>

        {/* Campos opcionais — so aparecem quando faz sentido pelo kind. */}
        {kind &&
          kind !== "DECLINED_TO_ANSWER" &&
          kind !== "PAUSED" && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <label>
                <span
                  style={{ display: "block", fontSize: 13, marginBottom: 4 }}
                >
                  Quantos meses procurando? (opcional)
                </span>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={monthsSearching}
                  onChange={(e) => setMonthsSearching(e.target.value)}
                  placeholder="Ex: 3"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 14,
                  }}
                />
              </label>
              <label>
                <span
                  style={{ display: "block", fontSize: 13, marginBottom: 4 }}
                >
                  Quer contar mais? (opcional, sem dados sensíveis)
                </span>
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value.slice(0, 500))}
                  placeholder="Ex: Consegui depois de 3 entrevistas, valeu o foco em dados."
                  rows={3}
                  maxLength={500}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 14,
                    resize: "vertical",
                  }}
                />
                <small style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {evidence.length}/500 — não inclua nomes, salários ou dados
                  pessoais.
                </small>
              </label>
            </div>
          )}

        {error && (
          <p
            role="alert"
            style={{
              color: "var(--negative, #c00)",
              fontSize: 13,
              marginTop: 12,
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            marginTop: 18,
          }}
        >
          <button
            type="button"
            onClick={handleDismiss}
            disabled={submitting}
            className="btn btn-ghost"
            style={{ background: "transparent" }}
          >
            Não perguntar de novo
          </button>
          <button
            type="submit"
            disabled={submitting || !kind}
            className="btn btn-primary"
          >
            {submitting ? "Enviando…" : "Enviar"}
          </button>
        </div>

        <p
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            marginTop: 14,
          }}
        >
          Seus dados ficam agregados e anônimos na mediana de contratados.
          Nenhuma informação pessoal vai pra outros usuários.
        </p>
      </form>
    </Modal>
  );
}
