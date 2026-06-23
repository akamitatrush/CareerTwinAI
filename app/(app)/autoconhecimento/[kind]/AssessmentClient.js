"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  narrativeFor,
  ikigaiSynthesis,
} from "@/lib/assessments/definitions";
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";

// Client component que renderiza UM dos 3 tipos de form (likert, multiselect,
// openText), submete pra /api/assessments/[kind] e mostra o resultado.
//
// definition vem do server (definitions.js sanitizado) — sem userId, sem
// segredos. initialResult e o ultimo registro do user (ou null pra nunca feito).
//
// Imports de narrativeFor/ikigaiSynthesis sao funcoes puras: nao tocam DB nem
// auth, soh formatam texto a partir de respostas. Safe pro client bundle.

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

  // ASSESSMENT_STARTED: dispara 1x ao montar (sem result previo, ou no
  // retake). kind ja indica qual assessment (DISC, valores, ikigai).
  useEffect(() => {
    if (mode === "form") {
      track(EVENTS.ASSESSMENT_STARTED, { kind: String(definition.kind || "") });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Computa "completion_percent" de forma simples (heuristica por tipo).
      let completionPercent = 100;
      if (definition.type === "likert") {
        const answered = definition.questions.filter(
          (q) => Number(responses[q.id]) >= 1
        ).length;
        completionPercent = Math.round(
          (answered / definition.questions.length) * 100
        );
      } else if (definition.type === "openText") {
        const ok = definition.questions.filter(
          (q) => String(responses[q.id] || "").trim().length >= 20
        ).length;
        completionPercent = Math.round(
          (ok / definition.questions.length) * 100
        );
      } else if (definition.type === "multiselect") {
        const max = definition.maxSelections || 5;
        completionPercent = Math.round(
          (Math.min(max, responses.length) / max) * 100
        );
      }
      track(EVENTS.ASSESSMENT_COMPLETED, {
        kind: String(definition.kind || ""),
        completion_percent: completionPercent,
      });
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
    <div className={`ct-self-form ct-self-form-${definition.palette || "indigo"}`}>
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
        <p className="ct-self-error" role="alert">
          {error}
        </p>
      )}

      <div className="ct-self-actions">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !canSubmit(definition, responses)}
          className="ct-self-submit"
        >
          {submitting ? "Salvando…" : "Salvar respostas"}
        </button>
        <p className="ct-self-actions-hint">
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
  // Progress (X de N respondidas). Conta entradas >= 1 (0 = nao respondido).
  const answered = questions.filter((q) => Number(responses[q.id]) >= 1).length;
  const total = questions.length;
  const pct = Math.round((answered / total) * 100);
  return (
    <>
      <div
        className="ct-self-likert-progress"
        aria-label={`${answered} de ${total} respondidas`}
      >
        <div className="ct-self-likert-progress-head">
          <span>
            {answered} de {total} respondidas
          </span>
          <span className="ct-self-likert-progress-pct">{pct}%</span>
        </div>
        <div
          className="ct-self-likert-progress-track"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="ct-self-likert-progress-fill"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <ol className="ct-likert-list">
        {questions.map((q, idx) => {
          const current = Number(responses[q.id]) || 0;
          const isAnswered = current >= 1;
          return (
            <li
              key={q.id}
              className={"ct-likert-row" + (isAnswered ? " answered" : "")}
            >
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
    </>
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
    <div className={`ct-self-result ct-self-result-${definition.palette || "indigo"}`}>
      <div className="ct-self-result-head">
        <div>
          <h2 className="ct-self-result-title">Seu resultado</h2>
          {completedAt && (
            <p className="ct-self-result-date">Salvo em {completedAt}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onRetake}
          className="ct-self-retake"
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

      <NextStepsBlock />
    </div>
  );
}

// ============ DISC ============

function DiscResult({ definition, scores }) {
  // scores = { D: 0-100, I: 0-100, S: 0-100, C: 0-100 }
  const safe = { D: 0, I: 0, S: 0, C: 0, ...(scores || {}) };
  const order = ["D", "I", "S", "C"];
  const max = Math.max(...order.map((k) => Number(safe[k]) || 0));
  const dominant = order.find((k) => Number(safe[k]) === max) || "D";
  const labels = definition.quadrantLabels || {};
  const dominantInfo = labels[dominant] || {};
  return (
    <>
      <div className="ct-self-disc-grid">
        <DiscMatrix scores={safe} dominant={dominant} labels={labels} />
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
      </div>

      {dominantInfo.narrative && (
        <section className="ct-self-narrative">
          <h3 className="ct-self-narrative-title">
            O que isso quer dizer?
          </h3>
          <p className="ct-self-narrative-text">{dominantInfo.narrative}</p>
        </section>
      )}

      {Array.isArray(dominantInfo.careerHints) && dominantInfo.careerHints.length > 0 && (
        <section className="ct-self-hints">
          <h3 className="ct-self-hints-title">
            Como isso se traduz em carreira
          </h3>
          <ul className="ct-self-hints-list">
            {dominantInfo.careerHints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// Matriz 2x2 com bolha posicionada. Eixo X: I (esquerda) <-> D (direita).
// Eixo Y: C (cima) <-> S (baixo). Calculamos posicao normalizada e o quadrante
// dominante recebe destaque visual.
function DiscMatrix({ scores, dominant, labels }) {
  // Eixo X: D - I (vai de -100 a +100). Eixo Y: S - C (mesmo intervalo).
  // Mapeamos pra 0-100 (X) e 0-100 (Y, invertido — 0 = topo).
  const dx = Number(scores.D) - Number(scores.I); // + -> direita
  const dy = Number(scores.S) - Number(scores.C); // + -> baixo (S em baixo)
  const px = 50 + dx / 2; // -100..+100 -> 0..100
  const py = 50 + dy / 2;
  const cx = Math.max(8, Math.min(92, px));
  const cy = Math.max(8, Math.min(92, py));
  return (
    <div className="ct-self-disc-matrix" aria-label="Matriz DISC com posicao do usuario">
      <svg viewBox="0 0 100 100" className="ct-self-disc-matrix-svg">
        {/* Quadrantes — destaque o dominante */}
        <rect
          x="0" y="0" width="50" height="50"
          className={"ct-self-disc-quad" + (dominant === "C" ? " dom" : "")}
        />
        <rect
          x="50" y="0" width="50" height="50"
          className={"ct-self-disc-quad" + (dominant === "D" ? " dom" : "")}
        />
        <rect
          x="0" y="50" width="50" height="50"
          className={"ct-self-disc-quad" + (dominant === "I" ? " dom" : "")}
        />
        <rect
          x="50" y="50" width="50" height="50"
          className={"ct-self-disc-quad" + (dominant === "S" ? " dom" : "")}
        />
        {/* Linhas centrais */}
        <line x1="50" y1="0" x2="50" y2="100" className="ct-self-disc-matrix-axis" />
        <line x1="0" y1="50" x2="100" y2="50" className="ct-self-disc-matrix-axis" />
        {/* Letras nos quadrantes */}
        <text x="25" y="28" textAnchor="middle" className="ct-self-disc-matrix-letter">C</text>
        <text x="75" y="28" textAnchor="middle" className="ct-self-disc-matrix-letter">D</text>
        <text x="25" y="78" textAnchor="middle" className="ct-self-disc-matrix-letter">I</text>
        <text x="75" y="78" textAnchor="middle" className="ct-self-disc-matrix-letter">S</text>
        {/* Bolha posicionada */}
        <circle cx={cx} cy={cy} r="5" className="ct-self-disc-matrix-dot" />
        <circle cx={cx} cy={cy} r="9" className="ct-self-disc-matrix-dot-halo" />
      </svg>
      <p className="ct-self-disc-matrix-caption">
        Quadrante dominante: <strong>{labels[dominant]?.name || dominant}</strong>
      </p>
    </div>
  );
}

// ============ VALORES ============

function ValoresResult({ definition, scores }) {
  const sel = Array.isArray(scores?.selected) ? scores.selected : [];
  const narrative = useMemo(() => narrativeFor(sel), [sel]);
  const labelMap = new Map(definition.options.map((o) => [o.id, o.label]));
  return (
    <>
      <div className="ct-self-valores-grid">
        <ValoresRadar
          options={definition.options}
          selected={sel}
        />
        <div className="ct-self-valores-side">
          <p className="ct-valores-result-sub">
            Seus {sel.length} valor{sel.length === 1 ? "" : "es"}, sem hierarquia:
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
      </div>

      {narrative.narrative && (
        <section className="ct-self-narrative">
          <h3 className="ct-self-narrative-title">
            O que isso quer dizer?
          </h3>
          <p className="ct-self-narrative-text">{narrative.narrative}</p>
        </section>
      )}

      {Array.isArray(narrative.cargos) && narrative.cargos.length > 0 && (
        <section className="ct-self-hints">
          <h3 className="ct-self-hints-title">
            Cargos que costumam combinar com esse perfil
          </h3>
          <ul className="ct-self-hints-list">
            {narrative.cargos.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// Radar simples: cada uma das 16 opcoes vira um eixo. Eixo do valor SELECIONADO
// vai ate raio cheio. Nao-selecionado fica em raio reduzido (so marca o eixo).
function ValoresRadar({ options, selected }) {
  const n = options.length;
  const sel = new Set(selected);
  const cx = 100;
  const cy = 100;
  const rMax = 78;
  const rOff = 18; // raio quando nao selecionado (so um pontinho proximo do centro)
  const points = options.map((opt, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = sel.has(opt.id) ? rMax : rOff;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    // Posicao do label (sempre no raio cheio, pra ficar legivel)
    const lr = rMax + 16;
    const lx = cx + Math.cos(angle) * lr;
    const ly = cy + Math.sin(angle) * lr;
    return { ...opt, x, y, lx, ly, angle, isSel: sel.has(opt.id) };
  });
  const polygon = points.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <div className="ct-self-valores-radar" aria-label="Radar dos valores selecionados">
      <svg viewBox="0 0 200 200" className="ct-self-valores-radar-svg">
        {/* aneis de referencia */}
        <circle cx={cx} cy={cy} r={rMax} className="ct-self-radar-ring" />
        <circle cx={cx} cy={cy} r={rMax * 0.66} className="ct-self-radar-ring soft" />
        <circle cx={cx} cy={cy} r={rMax * 0.33} className="ct-self-radar-ring soft" />
        {/* poligono dos selecionados */}
        <polygon points={polygon} className="ct-self-radar-poly" />
        {/* eixos */}
        {points.map((p, i) => (
          <line
            key={`a-${i}`}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(p.angle) * rMax}
            y2={cy + Math.sin(p.angle) * rMax}
            className="ct-self-radar-axis"
          />
        ))}
        {/* pontos por valor */}
        {points.map((p, i) => (
          <circle
            key={`p-${i}`}
            cx={p.x}
            cy={p.y}
            r={p.isSel ? 3.5 : 1.6}
            className={"ct-self-radar-dot" + (p.isSel ? " sel" : "")}
          />
        ))}
      </svg>
    </div>
  );
}

// ============ IKIGAI ============

function IkigaiResult({ definition, scores }) {
  const answers = scores?.answers || {};
  const percent = Number(scores?.percent) || 0;
  const synthesis = useMemo(() => ikigaiSynthesis(answers), [answers]);
  // Computa quais dimensoes estao "preenchidas" (>=20 chars) pra colorir o Venn
  const filled = {
    ama: String(answers.ama || "").trim().length >= 20,
    fazBem: String(answers.fazBem || "").trim().length >= 20,
    mundoPrecisa: String(answers.mundoPrecisa || "").trim().length >= 20,
    pagar: String(answers.pagar || "").trim().length >= 20,
  };
  return (
    <>
      <div className="ct-self-ikigai-grid">
        <IkigaiVenn filled={filled} percent={percent} />
        <div className="ct-self-ikigai-side">
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
        </div>
      </div>

      <section className="ct-self-narrative">
        <h3 className="ct-self-narrative-title">Síntese da reflexão</h3>
        <p className="ct-self-narrative-text">{synthesis}</p>
      </section>

      <details className="ct-self-ikigai-details">
        <summary>Ver respostas que você deu</summary>
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
      </details>
    </>
  );
}

// 4 circulos sobrepostos clessico. Cada dimensao tem cor + posicao + intensidade
// (opacidade maior se preenchida). No centro, label "Ikigai" com % completude.
function IkigaiVenn({ filled, percent }) {
  const dims = [
    { id: "ama", label: "Ama", cx: 80, cy: 80, color: "var(--primary)" },
    { id: "fazBem", label: "Faz bem", cx: 120, cy: 80, color: "var(--positive)" },
    { id: "mundoPrecisa", label: "Mundo precisa", cx: 80, cy: 120, color: "var(--attention)" },
    { id: "pagar", label: "Pagam", cx: 120, cy: 120, color: "var(--primary-deep)" },
  ];
  return (
    <div className="ct-self-ikigai-venn" aria-label="Diagrama Ikigai">
      <svg viewBox="0 0 200 200" className="ct-self-ikigai-venn-svg">
        {dims.map((d) => (
          <circle
            key={d.id}
            cx={d.cx}
            cy={d.cy}
            r="42"
            fill={d.color}
            fillOpacity={filled[d.id] ? 0.35 : 0.1}
            stroke={d.color}
            strokeOpacity={filled[d.id] ? 0.9 : 0.35}
            strokeWidth="1.4"
          />
        ))}
        {/* Centro: %  */}
        <text x="100" y="98" textAnchor="middle" className="ct-self-ikigai-venn-center-label">
          ikigai
        </text>
        <text x="100" y="115" textAnchor="middle" className="ct-self-ikigai-venn-center-val">
          {percent}%
        </text>
        {/* Labels dos circulos */}
        <text x="58" y="56" textAnchor="middle" className="ct-self-ikigai-venn-label">Ama</text>
        <text x="142" y="56" textAnchor="middle" className="ct-self-ikigai-venn-label">Faz bem</text>
        <text x="58" y="158" textAnchor="middle" className="ct-self-ikigai-venn-label">Mundo precisa</text>
        <text x="142" y="158" textAnchor="middle" className="ct-self-ikigai-venn-label">Pagam</text>
      </svg>
    </div>
  );
}

// ============ Next steps (connection com o resto do produto) ============

function NextStepsBlock() {
  // 3 destinos que fazem sentido apos o assessment. Hardcoded — sao rotas
  // estaveis do produto. Cada card tem icone + titulo + razao curta.
  const steps = [
    {
      href: "/dashboard",
      title: "Cruze com seu score",
      desc: "Veja como o estilo influencia suas decisões de carreira hoje.",
    },
    {
      href: "/gaps",
      title: "Olhe seus gaps",
      desc: "Lacunas entre quem você é e o cargo-alvo. Prioridades reais.",
    },
    {
      href: "/evidencias",
      title: "Adicione evidências",
      desc: "Conecte essas reflexões a projetos e conquistas concretas.",
    },
  ];
  return (
    <section className="ct-self-next">
      <h3 className="ct-self-next-title">O que fazer com isso</h3>
      <div className="ct-self-next-grid">
        {steps.map((s) => (
          <Link key={s.href} href={s.href} className="ct-self-next-card">
            <div className="ct-self-next-body">
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
            </div>
            <span className="ct-self-next-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
