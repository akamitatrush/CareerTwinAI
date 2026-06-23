"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Client component que renderiza UM dos 3 tipos de form (likert, multiselect,
// openText), submete pra /api/assessments/[kind] e mostra o resultado.
//
// definition vem do server (definitions.js sanitizado) — sem userId, sem
// segredos. initialResult e o ultimo registro do user (ou null pra nunca feito).

export default function AssessmentClient({ definition, initialResult }) {
  const router = useRouter();
  const [responses, setResponses] = useState(() =>
    initialResponsesFor(definition, initialResult),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(initialResult || null);
  // "show" = mostra resultado em vez do form (apos submit OU se ja tem result
  // E o user nao clicou "refazer"). "retake" = form mesmo tendo result.
  const [mode, setMode] = useState(initialResult ? "show" : "form");

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const slug = String(definition.kind).toLowerCase();
      const r = await fetch(`/api/assessments/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ responses }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        // 400 = shape invalido; 401 = sessao caiu; 500 = retry
        const msg =
          json?.error === "responses_invalid"
            ? "Algumas respostas estão incompletas ou inválidas."
            : json?.error === "unauthorized"
              ? "Sua sessão expirou. Faça login de novo."
              : "Falhou ao salvar. Tente de novo.";
        throw new Error(msg);
      }
      setResult(json.result);
      setMode("show");
      // Atualiza server components (lista de autoconhecimento mostra status novo).
      router.refresh();
    } catch (e) {
      setError(e?.message || "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "show" && result) {
    return (
      <ResultView
        definition={definition}
        result={result}
        onRetake={() => {
          setResponses(initialResponsesFor(definition, null));
          setMode("form");
          setError("");
        }}
      />
    );
  }

  return (
    <div className="ct-assessment-form">
      {definition.type === "likert" && (
        <LikertForm
          definition={definition}
          responses={responses}
          setResponses={setResponses}
        />
      )}
      {definition.type === "multiselect" && (
        <MultiSelectForm
          definition={definition}
          responses={responses}
          setResponses={setResponses}
        />
      )}
      {definition.type === "openText" && (
        <OpenTextForm
          definition={definition}
          responses={responses}
          setResponses={setResponses}
        />
      )}

      {error && (
        <p className="ct-assessment-error" role="alert">
          {error}
        </p>
      )}

      <div className="ct-assessment-actions">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !canSubmit(definition, responses)}
          className="ct-assessment-submit"
        >
          {submitting ? "Salvando…" : "Salvar respostas"}
        </button>
        <p className="ct-assessment-actions-hint">
          Suas respostas ficam só com você. Você pode refazer depois.
        </p>
      </div>
    </div>
  );
}

function initialResponsesFor(def, prev) {
  if (def.type === "likert") {
    // 0 = nao respondido (computeScore tolera, mas o botao submit so libera
    // com todas respondidas).
    const r = {};
    def.questions.forEach((q) => {
      r[q.id] = 0;
    });
    return r;
  }
  if (def.type === "multiselect") {
    // Se ja respondido antes, pre-seleciona. Senao, array vazio.
    const prevSel = Array.isArray(prev?.scoresJson?.selected)
      ? prev.scoresJson.selected
      : [];
    return [...prevSel];
  }
  if (def.type === "openText") {
    const prevAns = prev?.scoresJson?.answers || {};
    const r = {};
    def.questions.forEach((q) => {
      r[q.id] = String(prevAns[q.id] || "");
    });
    return r;
  }
  return {};
}

function canSubmit(def, responses) {
  if (def.type === "likert") {
    return def.questions.every((q) => Number(responses[q.id]) >= 1);
  }
  if (def.type === "multiselect") {
    return Array.isArray(responses) && responses.length > 0;
  }
  if (def.type === "openText") {
    // Pelo menos 1 resposta com 20+ chars (alinhado com computeScore).
    return def.questions.some(
      (q) => String(responses[q.id] || "").trim().length >= 20,
    );
  }
  return false;
}

function LikertForm({ definition, responses, setResponses }) {
  const { scale, questions } = definition;
  const values = [];
  for (let v = scale.min; v <= scale.max; v++) values.push(v);
  return (
    <ol className="ct-likert-list">
      {questions.map((q, idx) => {
        const current = Number(responses[q.id]) || 0;
        return (
          <li key={q.id} className="ct-likert-row">
            <div className="ct-likert-row-head">
              <span className="ct-likert-num">{idx + 1}.</span>
              <span className="ct-likert-text">{q.text}</span>
            </div>
            <fieldset className="ct-likert-scale">
              <legend className="ct-sr-only">{q.text}</legend>
              {values.map((v) => {
                const label = scale.labels?.[v - 1] || String(v);
                const checked = current === v;
                return (
                  <label
                    key={v}
                    className={"ct-likert-btn" + (checked ? " checked" : "")}
                    title={label}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={v}
                      checked={checked}
                      onChange={() =>
                        setResponses((r) => ({ ...r, [q.id]: v }))
                      }
                      className="ct-sr-only"
                    />
                    <span className="ct-likert-btn-num" aria-hidden="true">
                      {v}
                    </span>
                    <span className="ct-likert-btn-label">{label}</span>
                  </label>
                );
              })}
            </fieldset>
          </li>
        );
      })}
    </ol>
  );
}

function MultiSelectForm({ definition, responses, setResponses }) {
  const max = definition.maxSelections || 5;
  const selected = Array.isArray(responses) ? responses : [];
  const atLimit = selected.length >= max;
  function toggle(id) {
    setResponses((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(id)) return arr.filter((x) => x !== id);
      if (arr.length >= max) return arr; // bloqueia ate desmarcar outro
      return [...arr, id];
    });
  }
  return (
    <div className="ct-values-form">
      <p className="ct-values-count">
        <strong>{selected.length}</strong> de {max} selecionados
      </p>
      <div className="ct-values-grid">
        {definition.options.map((opt) => {
          const checked = selected.includes(opt.id);
          const disabled = !checked && atLimit;
          return (
            <label
              key={opt.id}
              className={
                "ct-value-chip" +
                (checked ? " checked" : "") +
                (disabled ? " disabled" : "")
              }
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => toggle(opt.id)}
                className="ct-sr-only"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function OpenTextForm({ definition, responses, setResponses }) {
  return (
    <ol className="ct-open-list">
      {definition.questions.map((q, idx) => {
        const value = String(responses[q.id] || "");
        const len = value.trim().length;
        const ok = len >= 20;
        return (
          <li key={q.id} className="ct-open-row">
            <label className="ct-open-label" htmlFor={`q-${q.id}`}>
              <span className="ct-open-num">{idx + 1}.</span> {q.text}
            </label>
            {q.hint && <p className="ct-open-hint">{q.hint}</p>}
            <textarea
              id={`q-${q.id}`}
              value={value}
              onChange={(e) => {
                const v = e.target.value.slice(0, 4000);
                setResponses((r) => ({ ...r, [q.id]: v }));
              }}
              rows={4}
              maxLength={4000}
              className="ct-open-textarea"
              placeholder="Escreva pelo menos 20 caracteres…"
            />
            <p
              className={
                "ct-open-counter" + (ok ? " ok" : len > 0 ? " warn" : "")
              }
            >
              {len} caracteres {ok ? "· ok" : len > 0 ? "· pelo menos 20" : ""}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

// ============ Resultado ============

function ResultView({ definition, result, onRetake }) {
  const completedAt = result?.completedAt
    ? new Date(result.completedAt).toLocaleString("pt-BR")
    : "";
  return (
    <div className="ct-assessment-result">
      <div className="ct-assessment-result-head">
        <div>
          <h2 className="ct-assessment-result-title">Seu resultado</h2>
          {completedAt && (
            <p className="ct-assessment-result-date">
              Salvo em {completedAt}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onRetake}
          className="ct-assessment-retake"
        >
          Refazer
        </button>
      </div>

      {definition.type === "likert" && (
        <DiscResult definition={definition} scores={result.scoresJson} />
      )}
      {definition.type === "multiselect" && (
        <ValoresResult definition={definition} scores={result.scoresJson} />
      )}
      {definition.type === "openText" && (
        <IkigaiResult definition={definition} scores={result.scoresJson} />
      )}
    </div>
  );
}

function DiscResult({ definition, scores }) {
  // scores = { D: 0-100, I: 0-100, S: 0-100, C: 0-100 }
  const safe = { D: 0, I: 0, S: 0, C: 0, ...(scores || {}) };
  const order = ["D", "I", "S", "C"];
  const max = Math.max(...order.map((k) => Number(safe[k]) || 0));
  const dominant = order.find((k) => Number(safe[k]) === max) || "D";
  const labels = definition.quadrantLabels || {};
  return (
    <>
      <div className="ct-disc-bars">
        {order.map((k) => {
          const v = Math.max(0, Math.min(100, Number(safe[k]) || 0));
          const isDom = k === dominant;
          return (
            <div key={k} className="ct-disc-bar-row">
              <div className="ct-disc-bar-head">
                <span className="ct-disc-letter">{k}</span>
                <span className="ct-disc-name">
                  {labels[k]?.name || k}
                </span>
                <span className="ct-disc-value">{v}</span>
              </div>
              <div className="ct-disc-bar-track">
                <div
                  className={"ct-disc-bar-fill" + (isDom ? " dominant" : "")}
                  style={{ width: `${v}%` }}
                />
              </div>
              {labels[k]?.desc && (
                <p className="ct-disc-bar-desc">{labels[k].desc}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="ct-disc-dominant">
        <span className="ct-disc-dominant-label">Quadrante dominante</span>
        <span className="ct-disc-dominant-name">
          {labels[dominant]?.name || dominant} ({dominant})
        </span>
      </div>
    </>
  );
}

function ValoresResult({ definition, scores }) {
  const sel = Array.isArray(scores?.selected) ? scores.selected : [];
  const labelMap = new Map(definition.options.map((o) => [o.id, o.label]));
  return (
    <div className="ct-valores-result">
      <p className="ct-valores-result-sub">
        Seus {sel.length} valor{sel.length === 1 ? "" : "es"} escolhido
        {sel.length === 1 ? "" : "s"}, sem hierarquia:
      </p>
      <div className="ct-valores-chips">
        {sel.length === 0 ? (
          <p style={{ color: "var(--text-faint)", fontSize: 13 }}>
            Nenhum valor selecionado.
          </p>
        ) : (
          sel.map((id) => (
            <span key={id} className="ct-value-chip checked static">
              {labelMap.get(id) || id}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function IkigaiResult({ definition, scores }) {
  const answers = scores?.answers || {};
  const percent = Number(scores?.percent) || 0;
  return (
    <div className="ct-ikigai-result">
      <div className="ct-ikigai-progress">
        <div className="ct-ikigai-progress-head">
          <span className="ct-ikigai-progress-label">Completude</span>
          <span className="ct-ikigai-progress-value">{percent}%</span>
        </div>
        <div className="ct-ikigai-progress-track">
          <div
            className="ct-ikigai-progress-fill"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <ol className="ct-ikigai-answers">
        {definition.questions.map((q, idx) => {
          const v = String(answers[q.id] || "").trim();
          return (
            <li key={q.id} className="ct-ikigai-answer">
              <h4 className="ct-ikigai-answer-q">
                {idx + 1}. {q.text}
              </h4>
              {v.length === 0 ? (
                <p className="ct-ikigai-answer-empty">— sem resposta —</p>
              ) : (
                <p className="ct-ikigai-answer-text">{v}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
