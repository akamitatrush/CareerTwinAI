"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// Labels casam exatamente com os aliases que a rota /api/opportunities
// normaliza (junior/jr/trainee, pleno/mid, senior/sr...). Strings vazias =
// "qualquer" — a rota ignora filtros vazios.
const SENIORITY_OPTIONS = ["", "Júnior", "Pleno", "Sênior"];
const MODEL_OPTIONS = ["", "Remoto", "Híbrido", "Presencial"];
const MIN_MATCH_OPTIONS = [0, 30, 50, 60, 70, 80];

export default function RadarClient({ initial }) {
  const [seniority, setSeniority] = useState("");
  const [model, setModel] = useState("");
  const [minMatch, setMinMatch] = useState(0);
  const [vagas, setVagas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sources, setSources] = useState([]);
  const [illustrative, setIllustrative] = useState(false);

  useEffect(() => {
    // `cancelled` previne race-condition: se o user mexer no filtro antes da
    // resposta anterior chegar, a nova request sobe e a antiga e descartada.
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...initial,
        seniority: seniority || undefined,
        model: model || undefined,
        minMatch,
        // Radar nao usa plano — economiza 1 chamada LLM (~15s).
        withPlan: false,
      }),
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) throw new Error(data.error || "Falha ao buscar vagas");
        setVagas(data.vagas || []);
        setSources(data.sources || []);
        setIllustrative(!!data.illustrative);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [seniority, model, minMatch, initial]);

  return (
    <>
      <div className="ct-filters-bar">
        {/* aria-live: anuncia mudanca de contagem quando filtros disparam re-fetch.
            polite = espera SR terminar leitura corrente; atomic=false = so le delta. */}
        <span className="ct-filters-count" aria-live="polite" aria-atomic="true">
          {loading
            ? "Buscando…"
            : `${vagas.length} ${
                vagas.length === 1 ? "vaga compatível" : "vagas compatíveis"
              }`}
        </span>
        <div className="ct-filters-sep" aria-hidden="true" />
        <FilterSelect
          label="Senioridade"
          value={seniority}
          onChange={setSeniority}
          options={SENIORITY_OPTIONS}
        />
        <FilterSelect
          label="Modelo"
          value={model}
          onChange={setModel}
          options={MODEL_OPTIONS}
        />
        <FilterNumber
          label="Aderência mín."
          value={minMatch}
          onChange={setMinMatch}
          options={MIN_MATCH_OPTIONS}
          suffix="%"
        />
      </div>

      {illustrative && (
        <div
          className="ct-req-illustrative"
          style={{
            marginBottom: 16,
            borderRadius: 10,
            border: "1px solid var(--attention-tint)",
          }}
        >
          Sem provider de vagas configurado — exibindo dados ilustrativos.
        </div>
      )}

      {error && (
        <div className="ct-dash-empty" role="alert">
          <h2>Falhou a busca</h2>
          <p>{error}. Tente recarregar.</p>
        </div>
      )}

      {loading ? (
        <div className="ct-loading-skeleton">
          {[1, 2, 3].map((i) => (
            <div className="ct-skel-card" key={i} />
          ))}
        </div>
      ) : vagas.length === 0 && !error ? (
        <div className="ct-dash-empty">
          <h2>Nenhuma vaga voltou agora</h2>
          <p>
            As fontes de vagas (Adzuna, Jooble e os ATS) não responderam ou
            ainda não estão configuradas neste ambiente.
            {sources.includes("fixtures") && (
              <>
                {" "}
                Estamos exibindo vagas <strong>ilustrativas</strong> baseadas no
                seu cargo-alvo — funcionalidade plena fica ativa em produção com
                chaves configuradas.
              </>
            )}
          </p>
          <p style={{ marginTop: 12 }}>
            {(seniority || model || minMatch > 0) ? (
              <>
                Tente{" "}
                <button
                  type="button"
                  onClick={() => {
                    setSeniority("");
                    setModel("");
                    setMinMatch(0);
                  }}
                  className="ct-link-btn"
                >
                  resetar os filtros
                </button>{" "}
                ou volte daqui a algumas horas.
              </>
            ) : (
              <>
                Volte daqui a algumas horas, ou refaça o diagnóstico no{" "}
                <Link href="/dashboard">seu dashboard</Link> com um cargo-alvo
                diferente.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="ct-jobs-list">
          {vagas.map((v, i) => (
            <JobCard key={(v.url || "") + i} job={v} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

// FilterSelect / FilterNumber:
// Antes: <button><select> — HTML invalido (button nao pode conter select),
// teclado quebrado em alguns browsers. Agora: <label> + <select> nativo
// estilizado como pill. Chevron decorativo via background-image no CSS
// (.ct-filter-pill-select). Acessivel: label visivel + aria-label redundante
// pra reforco, select recebe focus, Enter/Espaco abre menu nativo.
function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="ct-filter-pill">
      <span className="ct-filter-pill-label">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ct-filter-pill-select"
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt || "Qualquer"}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterNumber({ label, value, onChange, options, suffix }) {
  return (
    <label className="ct-filter-pill">
      <span className="ct-filter-pill-label">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ct-filter-pill-select"
        aria-label={label}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt === 0 ? "Sem mínimo" : opt + suffix}
          </option>
        ))}
      </select>
    </label>
  );
}

function JobCard({ job, index }) {
  // Disclosure "Por que esse match?" — fica fechado por padrao pra nao
  // poluir a lista. Cada card tem estado proprio (nao compartilhado).
  const [showBreakdown, setShowBreakdown] = useState(false);

  const initial = (job.empresa || "?").charAt(0).toUpperCase();
  const fit = job.match || 0;
  // Anel SVG: r=26 → circunferencia ~163.4px. offset = (1 - fit/100) * C
  // arrasta o "vazio" pro final do arco. Sem clamp aqui — fit ja vem 0..100.
  const CIRC = 2 * Math.PI * 26;
  const offset = CIRC * (1 - fit / 100);
  const fitColor =
    fit >= 70 ? "var(--positive)" : fit >= 40 ? "var(--primary)" : "var(--attention)";

  const skillsComuns = job.comuns || [];
  const skillsFalta = job.falta || [];
  // Aproximacao client-side: o backend so devolve `comuns` (skills do perfil
  // que casam) + `falta` (top 3 skills da vaga ausentes no perfil). O total
  // exato das skills da vaga nao trafega pra economizar payload — esse numero
  // (comuns + falta) e o melhor que da pra reconstruir aqui sem nova request.
  const skillsTotal = skillsComuns.length + skillsFalta.length;
  // ID estavel pro aria-controls (job.url nem sempre presente nos fixtures).
  const panelId = `breakdown-${index}`;

  return (
    <div className="ct-job-card">
      <div className="ct-job-logo">{initial}</div>
      <div className="ct-job-info">
        <div className="ct-job-top">
          <h3 className="ct-job-role">{job.titulo}</h3>
          <span className="ct-job-company">· {job.empresa}</span>
        </div>
        <div className="ct-job-meta">
          {job.local && <span className="ct-job-chip">{job.local}</span>}
          {job.salario && <span className="ct-job-chip">{job.salario}</span>}
          {job.sourceLabel && (
            <span className="ct-job-chip ct-job-source">{job.sourceLabel}</span>
          )}
        </div>
        <div className="ct-job-tags">
          {skillsComuns.slice(0, 3).map((skill, i) => (
            <span className="ct-job-tag have" key={"c" + i}>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
              {skill}
            </span>
          ))}
          {skillsFalta.slice(0, 2).map((skill, i) => (
            <span className="ct-job-tag missing" key={"m" + i}>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              falta: {skill}
            </span>
          ))}
        </div>
        {job.porque && (
          <p className="ct-job-why">
            {job.porque.replace(/\s*\[(.+?)\]\s*$/, "")}
          </p>
        )}
        <div className="ct-job-actions">
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ct-job-link"
            >
              Ver vaga original ↗
            </a>
          )}
        </div>
      </div>
      <div className="ct-job-fit">
        {/* Ring vira botao: aria-expanded indica estado, aria-controls aponta
            pro painel. aria-label longo pq o SR le antes do click — explica o
            que vai acontecer ("clique pra ver o calculo"). */}
        <button
          type="button"
          className="ct-fit-ring-btn"
          onClick={() => setShowBreakdown((v) => !v)}
          aria-expanded={showBreakdown}
          aria-controls={panelId}
          aria-label={`Aderência ${fit}%. ${
            showBreakdown ? "Fechar" : "Abrir"
          } detalhamento do cálculo.`}
        >
          <div className="ct-fit-ring">
            <svg
              width="62"
              height="62"
              viewBox="0 0 62 62"
              aria-hidden="true"
            >
              <circle
                cx="31"
                cy="31"
                r="26"
                fill="none"
                stroke="var(--primary-soft)"
                strokeWidth="6"
              />
              <circle
                cx="31"
                cy="31"
                r="26"
                fill="none"
                stroke={fitColor}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={CIRC.toFixed(1)}
                strokeDashoffset={offset.toFixed(1)}
                transform="rotate(-90 31 31)"
              />
            </svg>
            <div className="ct-fit-num" aria-hidden="true">{fit}</div>
          </div>
          <span className="ct-fit-label">ADERÊNCIA</span>
        </button>
      </div>

      {showBreakdown && (
        <div
          className="ct-job-breakdown"
          id={panelId}
          role="region"
          aria-label={`Detalhamento da aderência de ${fit}% pra ${job.titulo}`}
        >
          <h4>Por que {fit}% de aderência?</h4>
          <div className="ct-job-breakdown-formula">
            <code>match = |skills em comum| / max(|perfil|, |vaga|) × 100</code>
          </div>
          <div className="ct-job-breakdown-numbers">
            <div className="ct-job-breakdown-num-row">
              <span className="ct-job-breakdown-num-label">Skills em comum:</span>
              <span className="ct-job-breakdown-num-value">{skillsComuns.length}</span>
            </div>
            <div className="ct-job-breakdown-num-row">
              <span className="ct-job-breakdown-num-label">
                Skills detectadas na vaga:
              </span>
              <span className="ct-job-breakdown-num-value">{skillsTotal}</span>
            </div>
            <div className="ct-job-breakdown-num-row">
              <span className="ct-job-breakdown-num-label">Match calculado:</span>
              <span className="ct-job-breakdown-num-value strong">{fit}%</span>
            </div>
          </div>

          {skillsComuns.length > 0 && (
            <>
              <h5>O que você já cobre</h5>
              <div className="ct-job-breakdown-chips">
                {skillsComuns.map((s, i) => (
                  <span key={"bc" + i} className="ct-job-tag have">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12.5l4.5 4.5L19 7" />
                    </svg>
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}

          {skillsFalta.length > 0 && (
            <>
              <h5>O que falta</h5>
              <div className="ct-job-breakdown-chips">
                {skillsFalta.map((s, i) => (
                  <span key={"bf" + i} className="ct-job-tag missing">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}

          <p className="ct-job-breakdown-foot">
            Skills são extraídas das descrições das vagas via taxonomia
            curada. Mais detalhes em <Link href="/transparencia">/transparencia</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
