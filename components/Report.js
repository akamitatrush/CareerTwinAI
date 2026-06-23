"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WEIGHTS, SS_META } from "@/lib/score";
import InterviewModal from "@/components/InterviewModal";
import TailorModal from "@/components/TailorModal";
import ChatModal from "@/components/ChatModal";
import { track } from "@/components/PostHogProvider";
import { safeHref } from "@/lib/url-safe";

const CIRC = 2 * Math.PI * 52;
const SS_KEYS = ["aderencia_vagas", "relevancia_habilidades", "otimizacao_perfil", "experiencia_mercado"];
// Limites de exibição inline na home — listas completas vão pras telas /gaps e /oportunidades
const MAX_GAPS_INLINE = 3;
const MAX_JOBS_INLINE = 5;
const JOB_MATCH_MIN = 30;     // filtro principal de relevância (esconde "lixo visual")
const JOB_MATCH_FALLBACK = 20; // relaxa se quase nada passar no filtro

function splitSrc(t) {
  const s = String(t || "");
  const m = s.match(/\[(.+?)\]\s*$/);
  return { text: s.replace(/\s*\[(.+?)\]\s*$/, ""), src: m ? m[1] : null };
}
function effortClass(e) {
  return String(e || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function Src({ value, dark }) {
  if (!value) return null;
  return <span className={"src" + (dark ? " dark" : "")}>{value}</span>;
}
// Heurística pra quebrar a explicação do sub-score em "primeiras 2 linhas + resto".
// Mantemos a frase 1 sempre; se houver mais de 1 frase, jogamos pro <details>.
function splitWhy(text) {
  const s = String(text || "").trim();
  if (!s) return { head: "", rest: "" };
  const sentences = s.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 1 || s.length < 140) return { head: s, rest: "" };
  return { head: sentences[0], rest: sentences.slice(1).join(" ") };
}
function intensityClass(v) {
  if (v >= 70) return "good";
  if (v >= 50) return "mid";
  return "low";
}

export default function Report({ diag, opp, role, cv, onRestart, footerNote }) {
  const p = diag.perfil || {};
  const ss = diag.sub_scores || {};
  const gaps = diag.gaps || [];

  const [completed, setCompleted] = useState({});
  const [reveal, setReveal] = useState(0);
  const [showInterview, setShowInterview] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [tailorVaga, setTailorVaga] = useState(null);

  useEffect(() => {
    const timers = [];
    const start = requestAnimationFrame(() => setReveal(1));
    [320, 540, 760, 980, 1200].forEach((ms, i) => {
      timers.push(setTimeout(() => setReveal(2 + i), ms));
    });
    return () => {
      cancelAnimationFrame(start);
      timers.forEach(clearTimeout);
    };
  }, []);

  const animated = reveal >= 1;

  const baseVals = {};
  SS_KEYS.forEach((k) => (baseVals[k] = Number(ss[k]?.valor) || 0));
  const liveVals = { ...baseVals };
  gaps.forEach((g, i) => {
    if (completed[i]) {
      const dim = g.impacto?.dimensao || "relevancia_habilidades";
      const pts = Number(g.impacto?.pontos) || 4;
      if (liveVals[dim] != null) liveVals[dim] = Math.min(100, liveVals[dim] + pts);
    }
  });
  const overallOf = (vals) => Math.round(SS_KEYS.reduce((t, k) => t + vals[k] * WEIGHTS[k], 0));
  const baseOverall = diag.overall ?? overallOf(baseVals);
  const liveOverall = overallOf(liveVals);
  const delta = liveOverall - baseOverall;
  const gaugeOff = animated ? CIRC * (1 - liveOverall / 100) : CIRC;
  const gapNames = gaps.map((g) => g.habilidade);

  // Top microações por impacto (já vêm ordenadas pela LLM; cortamos no MAX_GAPS_INLINE)
  const topGaps = gaps.slice(0, MAX_GAPS_INLINE);

  // Vagas: filtra match < JOB_MATCH_MIN. Se sobra menos que 3 (ex.: alvo nicho), relaxa pro fallback.
  const allJobs = Array.isArray(opp?.vagas) ? opp.vagas : [];
  const sortedJobs = [...allJobs].sort((a, b) => (Number(b.match) || 0) - (Number(a.match) || 0));
  const strictJobs = sortedJobs.filter((v) => Number(v.match) >= JOB_MATCH_MIN);
  const fallbackJobs = sortedJobs.filter((v) => Number(v.match) >= JOB_MATCH_FALLBACK);
  const visibleJobs = (strictJobs.length >= 3 ? strictJobs : fallbackJobs).slice(0, MAX_JOBS_INLINE);

  return (
    <div className="report">
      <div className="mirror">
        <div className="mirror-side">
          <p className="mirror-tag">Você · hoje</p>
          <h3 className="mirror-name">{p.nome || "Seu perfil"}</h3>
          <p className="mirror-role">{p.cargo_atual || ""}{p.senioridade ? " · " + p.senioridade : ""}</p>
          <div className="chips">{(p.skills || []).map((s, i) => <span className="chip" key={i}>{s}</span>)}</div>
        </div>
        <div className="mirror-seam">
          <span className="seam-tag">Career Health</span>
          <span className="seam-score">{liveOverall}</span>
          <span className="seam-of">/ 100</span>
          {delta > 0 && <span className="seam-delta">▲ +{delta}</span>}
        </div>
        <div className="mirror-side target">
          <p className="mirror-tag">Alvo</p>
          <h3 className="mirror-name">{role}</h3>
          <p className="mirror-role">a distância entre os dois é o que o plano resolve</p>
          <div className="chips">{gaps.slice(0, 4).map((g, i) => <span className="chip tgt" key={i}>{g.habilidade}</span>)}</div>
        </div>
      </div>

      <div className="tools">
        <button className="tool-btn" onClick={() => setShowInterview(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" /></svg>
          Treinar entrevista
        </button>
        <button className="tool-btn" onClick={() => setShowChat(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
          Conversar com meu gêmeo
        </button>
      </div>

      <section className="ct-report-section">
        <div className="sec-head">
          <span className="ct-report-section-num s1">01</span>
          <h2 className="sec-title">O número, por dentro</h2>
          <p className="sec-sub">Nada de caixa-preta: o Career Health Score é a soma ponderada de quatro sub-scores. Marque as microações conforme conclui — quando estiver pronto, clique em "Atualizar diagnóstico" no dashboard pra cristalizar o ganho.</p>
        </div>

        <div className="instrument">
          <div className="inst-top">
            <div className="gauge">
              <svg width="120" height="120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="9" />
                <circle cx="60" cy="60" r="52" fill="none" className="gauge-arc" strokeWidth="9" strokeLinecap="round" strokeDasharray={CIRC.toFixed(1)} strokeDashoffset={gaugeOff.toFixed(1)} />
              </svg>
              <div className="gauge-num">{liveOverall}</div>
            </div>
            <div className="inst-headline">
              <h3>Sua empregabilidade para “{role}”{delta > 0 && <span className="inst-delta"> ▲ +{delta} desde o diagnóstico</span>}</h3>
              <p>Quanto mais alto, mais perto você está do que o mercado pede para esse alvo. Marque microações abaixo pra projetar o ganho — o número definitivo se cristaliza no dashboard.</p>
              <div className="formula">Score = (Aderência × <b>.40</b>) + (Habilidades × <b>.30</b>) + (Perfil × <b>.20</b>) + (Experiência × <b>.10</b>)</div>
            </div>
          </div>
        </div>

        <div className="ct-report-cta-bar" role="navigation" aria-label="Próximos passos">
          <Link href="/meu-gemeo" className="ct-report-cta-primary">
            Ir pro dashboard completo →
          </Link>
          <Link href="/meu-gemeo#gaps" className="ct-report-cta-secondary">
            Ver todas as ações
          </Link>
          <Link href="/meu-gemeo#oportunidades" className="ct-report-cta-secondary">
            Radar de vagas
          </Link>
        </div>

        <div className="ct-subscores-list">
          {SS_KEYS.map((k, idx) => {
            const v = liveVals[k];
            const meta = SS_META[k];
            const contrib = (v * WEIGHTS[k]).toFixed(1);
            const { text, src } = splitSrc(ss[k]?.explicacao);
            const { head, rest } = splitWhy(text);
            const boosted = v > baseVals[k];
            const ssRevealed = reveal >= 2 + idx;
            const cls = intensityClass(v);
            return (
              <div className={"ct-subscore-compact" + (ssRevealed ? " ss-revealed" : "")} key={k}>
                <div className="ct-ss-c-head">
                  <span className="ct-ss-c-label">{meta.label}{boosted && <span className="ss-up"> ▲</span>}</span>
                  <span className="ct-ss-c-weight">peso {meta.w}</span>
                  <span className="ct-ss-c-value">{v}</span>
                </div>
                <div className="ct-ss-c-bar"><div className={"ct-ss-c-fill " + cls} style={{ width: (animated ? v : 0) + "%" }} /></div>
                <p className="ct-ss-c-why">{head} <Src value={src} /></p>
                {rest && (
                  <details>
                    <summary>ver detalhes do cálculo</summary>
                    <p className="ct-ss-c-why" style={{ marginTop: 8 }}>{rest}</p>
                    <p className="ct-ss-c-math">{v} × {meta.w} (peso) = {contrib} pts no score final</p>
                  </details>
                )}
                {!rest && (
                  <p className="ct-ss-c-math">{v} × {meta.w} = {contrib} pts</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="ct-report-section">
        <div className="sec-head">
          <span className="ct-report-section-num s2">02</span>
          <h2 className="sec-title">O que separa você do alvo</h2>
          <p className="sec-sub">As três microações com maior impacto no score. Marcar como concluída projeta o ganho aqui na hora — o número definitivo cristaliza quando você atualiza o diagnóstico.</p>
        </div>
        <div className="gap-list ct-report-microactions">
          {topGaps.map((g, i) => {
            const { text, src } = splitSrc(g.porque);
            const pts = Number(g.impacto?.pontos) || 4;
            const done = !!completed[i];
            return (
              <div className={"gapc" + (done ? " done" : "")} key={i}>
                <div className="gapc-top"><h4 className="gapc-skill">{g.habilidade}</h4><span className="gapc-freq">{g.frequencia} das vagas</span></div>
                <p className="gapc-why">{text} <Src value={src} /></p>
                <div className="gapc-foot">
                  <span className="microaction">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    {g.microacao}
                  </span>
                  <button className={"gap-done" + (done ? " on" : "")} onClick={() => setCompleted((c) => ({ ...c, [i]: !c[i] }))}>
                    {done ? "✓ Concluída" : `Concluir +${pts}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {gaps.length > MAX_GAPS_INLINE && (
          <Link href="/meu-gemeo#gaps" className="ct-report-see-more">
            Ver todas as {gaps.length} ações →
          </Link>
        )}
      </section>

      {opp?.vagas && opp.vagas.length === 0 && opp?.sources != null && (
        <section className="ct-report-section">
          <div className="sec-head">
            <span className="ct-report-section-num s3">03</span>
            <h2 className="sec-title">Nenhuma vaga voltou agora pra esse cargo</h2>
            <p className="sec-sub">
              As três fontes que consultamos (Adzuna, Jooble, Greenhouse) não trouxeram resultado
              compatível agora. Pode ser cargo muito específico, momento ruim do mercado, ou
              fontes temporariamente fora. Tente:
            </p>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "var(--text-muted)" }}>
            <li>Refazer o diagnóstico com um cargo-alvo mais comum (ex.: "engenheiro de software" em vez de "engenheiro de plataforma sênior em fintech")</li>
            <li>Voltar daqui a algumas horas — a base atualiza periodicamente</li>
            <li>Cadastrar candidaturas manualmente em <a href="/candidaturas" style={{ color: "var(--primary)" }}>/candidaturas</a> enquanto isso</li>
          </ul>
        </section>
      )}

      {visibleJobs.length > 0 && (
        <section className="ct-report-section">
          <div className="sec-head">
            <span className="ct-report-section-num s3">03</span>
            <h2 className="sec-title">Vagas onde você tem chance real</h2>
            <p className="sec-sub">
              Top {visibleJobs.length} ordenadas por aderência ao seu gêmeo (esconde matches abaixo de {JOB_MATCH_MIN}%). Clique em "Adaptar currículo" para alinhar seu CV a uma delas.
            </p>
          </div>
          <div className="vaga-list">
            {visibleJobs.map((v, i) => {
              const { text, src } = splitSrc(v.porque);
              const sourceLabel = v.sourceLabel || v.source || "";
              const isReal = v.source && v.source !== "fixtures";
              return (
                <div className="vagac" key={i}>
                  <div className="vagac-top">
                    <div>
                      <h4 className="vagac-title">{v.titulo}</h4>
                      <p className="vagac-co">
                        {v.empresa}{v.local ? " · " + v.local : ""}
                        {v.salario ? " · " + v.salario : ""}
                      </p>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      {sourceLabel && (
                        <span
                          className="src"
                          style={{
                            background: isReal ? "var(--primary-soft)" : "var(--surface-2)",
                            color: isReal ? "var(--primary)" : "var(--text-muted)",
                            border: isReal ? "1px solid var(--primary)" : "1px dashed var(--border-strong)",
                            padding: "2px 8px",
                            borderRadius: 6,
                            fontSize: 11,
                          }}
                          title={isReal ? "Fonte real" : "Vaga ilustrativa — não é uma empresa real"}
                        >
                          {sourceLabel}
                        </span>
                      )}
                      <div className="match"><span className="match-num">{v.match}</span><span className="match-lbl">match</span></div>
                    </div>
                  </div>
                  <p className="vagac-why">{text} <Src value={src} /></p>
                  {v.falta && v.falta.length > 0 && (
                    <div className="vagac-falta"><span className="falta-lbl">falta:</span>{v.falta.map((f, j) => <span className="falta-chip" key={j}>{f}</span>)}</div>
                  )}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {/* safeHref: vagas vem de LLM ou fontes externas — defesa-em-
                        profundidade contra schemes perigosos. */}
                    {safeHref(v.url) && (
                      <a className="vagac-tailor" href={safeHref(v.url)} target="_blank" rel="noopener noreferrer">
                        Ver vaga original ↗
                      </a>
                    )}
                    <button className="vagac-tailor" onClick={() => setTailorVaga(v)}>
                      Adaptar currículo →
                    </button>
                    <SaveJobButton vaga={v} />
                  </div>
                </div>
              );
            })}
          </div>
          {allJobs.length > visibleJobs.length && (
            <Link href="/meu-gemeo#oportunidades" className="ct-report-see-more">
              Ver todas as {allJobs.length} vagas no radar completo →
            </Link>
          )}
        </section>
      )}

      {opp?.plano && opp.plano.length > 0 && (
        <section className="ct-report-section">
          <div className="sec-head">
            <span className="ct-report-section-num s2">04</span>
            <h2 className="sec-title">Seu plano das próximas 3 semanas</h2>
            <p className="sec-sub">Microações com impacto estimado no score e esforço — para aplicar melhor, não aplicar mais.</p>
          </div>
          <div className="weeks">
            {opp.plano.map((w, i) => (
              <div className="week" key={i}>
                <div className="week-head"><span className="week-no">Semana {w.semana}</span><span className="week-foco">{w.foco}</span></div>
                <div className="acts">
                  {(w.acoes || []).map((a, j) => (
                    <div className="act" key={j}>
                      <div className="act-body"><p className="act-title">{a.titulo}</p><p className="act-impact">{a.impacto}</p></div>
                      <span className={"effort " + effortClass(a.esforco)}>{a.esforco}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="ct-report-footer">
        <div className="ct-report-footer-actions">
          <Link href="/meu-gemeo" className="ct-report-footer-cta">Continuar pro dashboard →</Link>
          {onRestart && (
            <button className="ct-report-footer-text" onClick={onRestart}>← Construir outro gêmeo</button>
          )}
        </div>
        <p className="ct-report-transparency">{footerNote || (
          <>
            <b>Transparência:</b> o score é um cálculo auditável (a fórmula acima);
            os textos são gerados por IA a partir do seu currículo
            {opp?.illustrative ? (
              <>; as vagas marcadas como <b>ilustrativas</b> são exemplos (configure Adzuna+Jooble pra vagas reais)</>
            ) : opp?.sources?.length ? (
              <>; vagas vieram de {opp.sources.join(", ")}</>
            ) : null}
            . Princípio do produto: número = cálculo, texto = explicação com fonte.
          </>
        )}</p>
      </footer>

      {showInterview && <InterviewModal role={role} gaps={gapNames} onClose={() => setShowInterview(false)} />}
      {showChat && <ChatModal role={role} perfil={p} gaps={gapNames} onClose={() => setShowChat(false)} />}
      {tailorVaga && cv && <TailorModal role={role} cv={cv} vaga={tailorVaga} onClose={() => setTailorVaga(null)} />}
    </div>
  );
}

function SaveJobButton({ vaga }) {
  const [state, setState] = useState("idle");
  async function save() {
    setState("busy");
    try {
      const r = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          titulo: vaga.titulo,
          empresa: vaga.empresa,
          local: vaga.local || undefined,
          url: vaga.url || undefined,
          salario: vaga.salario || undefined,
          source: vaga.source || undefined,
          status: "SAVED",
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 401) {
          setState("login");
          return;
        }
        throw new Error(data.error || "erro");
      }
      setState(data.duplicated ? "dup" : "saved");
      if (!data.duplicated) {
        track("application_saved", {
          status: "SAVED",
          has_url: !!vaga.url,
          has_local: !!vaga.local,
          has_salario: !!vaga.salario,
          source: vaga.source || "unknown",
          origin: "from_jobs",
        });
      }
    } catch {
      setState("err");
    }
  }
  if (state === "saved") return <span className="vagac-tailor" style={{ opacity: .7 }}>✓ Salva nas candidaturas</span>;
  if (state === "dup") return <span className="vagac-tailor" style={{ opacity: .7 }}>✓ Já estava salva</span>;
  if (state === "login") return <a className="vagac-tailor" href="/entrar">Entrar pra salvar →</a>;
  if (state === "err") return <button className="vagac-tailor" onClick={save}>Falhou — tentar de novo</button>;
  return <button className="vagac-tailor" onClick={save} disabled={state === "busy"}>{state === "busy" ? "Salvando…" : "+ Salvar candidatura"}</button>;
}
