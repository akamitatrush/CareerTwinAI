"use client";

// CvAnalyzer — UI inline em /conta que mostra o CV linha-por-linha com
// highlights da IA: bullets fracos, sugestoes de reescrita, copia pra clipboard.
//
// Decisao de design importante:
//  - NAO substitui Profile.rawCv automaticamente. So oferece copy-to-clipboard
//    da sugestao. Motivos:
//      1) User mantem controle (consent UX).
//      2) Sem endpoint de update + lock optimista, race condition pode
//         sobrescrever edicoes paralelas.
//      3) Iteracao: depois de ver adocao real, decidimos auto-apply.
//  - cv vem como prop server-side (ja autenticado em /conta). Nao re-fetch.
//
// Defesa OWASP A03: nada de innerHTML/dangerouslySetInnerHTML — texto vai por
// React como children (escape automatico). Sugestao do LLM ja foi sanitizada
// e cortada em 600 chars no backend.

import { useState } from "react";
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";

// Labels PT-BR pros codigos de issue retornados pelo backend. Lista fechada —
// se backend mandar issue desconhecida, ja foi filtrada la (defense in depth).
function labelFor(issue) {
  const map = {
    "no-metric": "sem numero",
    "weak-verb": "verbo fraco",
    generic: "generico",
    "too-long": "muito longo",
    passive: "voz passiva",
    ambiguous: "ambiguo",
  };
  return map[issue] || issue;
}

export default function CvAnalyzer({ cv, role }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyses, setAnalyses] = useState(null);
  const [error, setError] = useState("");

  async function analyze() {
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch("/api/cv/analyze-bullets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cv, role: role || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Mensagens conhecidas do backend ficam amigaveis; resto cai em generico.
        const msg = data?.error || "Nao foi possivel analisar agora.";
        throw new Error(msg);
      }
      const bullets = Array.isArray(data.bullets) ? data.bullets : [];
      setAnalyses(bullets);
      // PostHog: contagem + medias, sem texto do CV (PII).
      const weak = bullets.filter((b) => b.score < 40).length;
      const medium = bullets.filter((b) => b.score >= 40 && b.score < 75).length;
      const good = bullets.filter((b) => b.score >= 75).length;
      track(EVENTS.CV_ANALYZED, {
        bullets_returned: bullets.length,
        weak_count: weak,
        medium_count: medium,
        good_count: good,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  // Render: CV linha-por-linha. Cada linha com analise pinta com cor de score.
  // Mapeamento: backend retorna originalLineIndex (linha no split('\n')) —
  // usamos isso direto pra evitar drift entre client/server na deteccao de bullets.
  const lines = (cv || "").split(/\r?\n/);
  const analysisByLine = new Map();
  if (analyses) {
    for (const a of analyses) {
      if (Number.isInteger(a.originalLineIndex)) {
        analysisByLine.set(a.originalLineIndex, a);
      }
    }
  }

  return (
    <div className="ct-cv-analyzer app-glass cv-analyzer-glass">
      {/* Refresh visual (Sam) — gradient cyan no botao primario + hover lift.
          Sem tocar globals.css. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .cv-analyzer-glass {
              padding: 16px;
              transition: box-shadow 200ms ease, border-color 200ms ease;
            }
            .cv-analyzer-glass:hover {
              box-shadow: var(--shadow-lg), 0 0 0 1px var(--accent-cyan-glow);
              border-color: var(--accent-cyan-glow);
            }
            .cv-analyzer-glass .ct-conta-btn.primary {
              background: linear-gradient(140deg, var(--accent-cyan) 0%, var(--accent-cyan-deep) 100%);
              color: #08313F;
              border: 1px solid transparent;
              box-shadow: var(--shadow-md);
              transition: transform 200ms ease, box-shadow 200ms ease, filter 200ms ease;
            }
            .cv-analyzer-glass .ct-conta-btn.primary:hover:not(:disabled) {
              transform: translateY(-1px);
              box-shadow: var(--shadow-lg), 0 0 0 3px var(--accent-cyan-glow);
              filter: brightness(1.04);
            }
            .cv-analyzer-glass .ct-conta-btn.primary:focus-visible {
              outline: none;
              box-shadow: var(--shadow-md), 0 0 0 3px var(--accent-cyan-glow);
            }
            .cv-analyzer-glass .ct-cv-line {
              transition: transform 200ms ease, box-shadow 200ms ease;
            }
            .cv-analyzer-glass .ct-cv-line:hover {
              transform: scale(1.005);
              box-shadow: 0 0 0 1px var(--accent-cyan-glow);
            }
            @media (prefers-reduced-motion: reduce) {
              .cv-analyzer-glass,
              .cv-analyzer-glass .ct-conta-btn.primary,
              .cv-analyzer-glass .ct-cv-line,
              .cv-analyzer-glass .ct-conta-btn.primary:hover,
              .cv-analyzer-glass .ct-cv-line:hover {
                transition: none;
                transform: none;
              }
            }
          `,
        }}
      />
      <div className="ct-cv-analyzer-head">
        <div>
          <h3 className="ct-cv-analyzer-title">Analise IA do seu CV</h3>
          <p className="ct-cv-analyzer-sub">
            A IA identifica bullets fracos (sem metrica, verbos passivos) e propoe
            reescrita. Voce aceita ou descarta cada sugestao.
          </p>
        </div>
        {!analyses && (
          <button
            type="button"
            onClick={analyze}
            disabled={analyzing || !cv}
            className="ct-conta-btn primary"
          >
            {analyzing ? "Analisando…" : "Analisar com IA"}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          style={{
            color: "var(--attention-deep)",
            background: "var(--attention-soft)",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 13,
            margin: "8px 0 0",
          }}
        >
          {error}
        </p>
      )}

      {analyses && (
        <>
          <div className="ct-cv-analyzer-summary" aria-live="polite">
            <span className="ct-summary-chip good">
              {analyses.filter((a) => a.score >= 75).length} bons
            </span>
            <span className="ct-summary-chip medium">
              {analyses.filter((a) => a.score >= 40 && a.score < 75).length} medios
            </span>
            <span className="ct-summary-chip weak">
              {analyses.filter((a) => a.score < 40).length} fracos
            </span>
          </div>

          <div className="ct-cv-lines" role="list">
            {lines.map((line, i) => {
              const analysis = analysisByLine.get(i);
              const variant = analysis
                ? analysis.score >= 75
                  ? "good"
                  : analysis.score >= 40
                  ? "medium"
                  : "weak"
                : "neutral";
              return (
                <CvLine
                  key={i}
                  line={line}
                  analysis={analysis}
                  variant={variant}
                />
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setAnalyses(null)}
            className="ct-conta-btn"
            style={{ marginTop: 16 }}
          >
            Limpar analise
          </button>
        </>
      )}
    </div>
  );
}

// Linha individual do CV. Se tem analise, renderiza chips de issue + toggle de
// sugestao. Se nao, renderiza neutro. Copia pra clipboard via navigator API.
function CvLine({ line, analysis, variant }) {
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [copied, setCopied] = useState(false);

  // Linha sem analise (ou linha vazia): render neutro, nao-interativo.
  if (!analysis) {
    return (
      <div className="ct-cv-line neutral" role="listitem">
        {line || <span>&nbsp;</span>}
      </div>
    );
  }

  const handleToggle = () => {
    const next = !showSuggestion;
    setShowSuggestion(next);
    if (next) {
      track(EVENTS.CV_SUGGESTION_VIEWED, {
        score: analysis.score,
        issues: analysis.issues || [],
      });
    }
  };

  const handleCopy = async () => {
    try {
      // navigator.clipboard requer HTTPS ou localhost. Fallback silencioso.
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(analysis.suggestion);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      track(EVENTS.CV_SUGGESTION_ACCEPTED, {
        score: analysis.score,
        issues: analysis.issues || [],
      });
    } catch {
      // Clipboard bloqueado (sem HTTPS, sem perm) — falha silenciosa. Sugestao
      // ainda esta visivel na tela pro user copiar manualmente.
    }
  };

  return (
    <div className={`ct-cv-line ${variant}`} role="listitem">
      <div className="ct-cv-line-content">
        <span className="ct-cv-line-text">{line}</span>
        {analysis.issues?.length > 0 && (
          <div className="ct-cv-line-issues" aria-label="Problemas detectados">
            {analysis.issues.map((issue) => (
              <span key={issue} className="ct-cv-issue-tag">
                {labelFor(issue)}
              </span>
            ))}
          </div>
        )}
      </div>
      {analysis.suggestion && (
        <>
          <button
            type="button"
            onClick={handleToggle}
            className="ct-cv-suggestion-toggle"
            aria-expanded={showSuggestion}
          >
            {showSuggestion ? "Esconder sugestao" : "Ver sugestao da IA"}
          </button>
          {showSuggestion && (
            <div className="ct-cv-suggestion-box">
              <p className="ct-cv-suggestion-label">Sugestao da IA</p>
              <p className="ct-cv-suggestion-text">{analysis.suggestion}</p>
              <div className="ct-cv-suggestion-actions">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="ct-conta-btn primary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  aria-label="Copiar sugestao para a area de transferencia"
                >
                  {copied ? "Copiado!" : "Copiar sugestao"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSuggestion(false)}
                  className="ct-conta-btn"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                >
                  Descartar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
