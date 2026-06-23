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
          <h2>Nenhuma vaga voltou pra esses filtros</h2>
          <p>
            Tente relaxar os filtros, ou volte daqui a algumas horas. Posso
            também sugerir refazer o diagnóstico no{" "}
            <Link href="/dashboard">seu dashboard</Link> com cargo-alvo diferente.
          </p>
        </div>
      ) : (
        <div className="ct-jobs-list">
          {vagas.map((v, i) => (
            <JobCard key={(v.url || "") + i} job={v} />
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

function JobCard({ job }) {
  const initial = (job.empresa || "?").charAt(0).toUpperCase();
  const fit = job.match || 0;
  // Anel SVG: r=26 → circunferencia ~163.4px. offset = (1 - fit/100) * C
  // arrasta o "vazio" pro final do arco. Sem clamp aqui — fit ja vem 0..100.
  const CIRC = 2 * Math.PI * 26;
  const offset = CIRC * (1 - fit / 100);
  const fitColor =
    fit >= 70 ? "var(--positive)" : fit >= 40 ? "var(--primary)" : "var(--attention)";

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
          {(job.comuns || []).slice(0, 3).map((skill, i) => (
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
          {(job.falta || []).slice(0, 2).map((skill, i) => (
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
        <div className="ct-fit-ring">
          <svg
            width="62"
            height="62"
            viewBox="0 0 62 62"
            role="img"
            aria-label={`Aderência: ${fit}%`}
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
          {/* Texto duplicado do SVG: aria-hidden pra evitar leitura dupla. */}
          <div className="ct-fit-num" aria-hidden="true">{fit}</div>
        </div>
        <span className="ct-fit-label">ADERÊNCIA</span>
      </div>
    </div>
  );
}
