"use client";

import { useState, useEffect } from "react";
import { WEIGHTS, SS_META } from "@/lib/score";
import { SAMPLE_CV, SAMPLE_ROLE } from "@/lib/sample";
import InterviewModal from "@/components/InterviewModal";
import TailorModal from "@/components/TailorModal";
import ChatModal from "@/components/ChatModal";

const CIRC = 2 * Math.PI * 52;
const SS_KEYS = ["aderencia_vagas", "relevancia_habilidades", "otimizacao_perfil", "experiencia_mercado"];

function splitSrc(t) {
  const s = String(t || "");
  const m = s.match(/\[(.+?)\]\s*$/);
  return { text: s.replace(/\s*\[(.+?)\]\s*$/, ""), src: m ? m[1] : null };
}
function effortClass(e) {
  return String(e || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function Src({ value, dark }) {
  if (!value) return null;
  return <span className={"src" + (dark ? " dark" : "")}>{value}</span>;
}

export default function Home() {
  const [stage, setStage] = useState("input");
  const [cv, setCv] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [procStep, setProcStep] = useState(0);
  const [diag, setDiag] = useState(null);
  const [opp, setOpp] = useState(null);

  function loadSample() {
    setCv(SAMPLE_CV);
    setRole(SAMPLE_ROLE);
    setError("");
  }

  async function build() {
    setError("");
    if (cv.trim().length < 60) {
      setError("Faltou o currículo. Cole um pouco mais de texto (experiências e habilidades) — ou clique em “Carregar exemplo”.");
      return;
    }
    if (!role.trim()) {
      setError("Faltou o cargo-alvo. Diga para qual cargo você quer comparar seu perfil.");
      return;
    }
    setStage("proc");
    setProcStep(0);
    setBusy(true);
    try {
      setProcStep(1);
      const dRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cv, role }),
      });
      const d = await dRes.json();
      if (!dRes.ok) throw new Error(d.error || "Falha na análise.");
      setProcStep(2);
      const oRes = await fetch("/api/opportunities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, perfil: d.perfil, gaps: (d.gaps || []).map((g) => g.habilidade) }),
      });
      const o = await oRes.json();
      if (!oRes.ok) throw new Error(o.error || "Falha ao gerar oportunidades.");
      setProcStep(3);
      await new Promise((r) => setTimeout(r, 350));
      setDiag(d);
      setOpp(o);
      setStage("report");
    } catch (e) {
      setError("A IA tropeçou ao montar o gêmeo: " + (e.message || "") + " Tente de novo.");
      setStage("input");
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setStage("input");
    setDiag(null);
    setOpp(null);
  }

  return (
    <>
      <div className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#B9D90C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3.2" />
                <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6" />
                <path d="M14.5 13.5l2 2 4-4.5" />
              </svg>
            </div>
            <div>
              <div className="brand-name">CareerTwin AI</div>
              <div className="brand-sub">seu gêmeo de carreira</div>
            </div>
          </div>
          {stage === "report" && <div className="live-pill"><span className="live-dot" /> IA ao vivo</div>}
        </div>
      </div>

      <main className="wrap">
        {stage === "input" && (
          <section className="stage">
            <div className="intro">
              <p className="eyebrow">Discovery · protótipo funcional</p>
              <h1 className="hero">Construa o <em>gêmeo</em> da sua carreira em 30 segundos.</h1>
              <p className="hero-lede">Cole seu currículo e diga o cargo que você quer. A IA estrutura quem você é hoje, compara com o que o mercado pede e te mostra a distância — com o porquê e a fonte de cada número.</p>
            </div>
            <div className="builder">
              <div className="field">
                <label htmlFor="cvText">Seu currículo — cole o texto</label>
                <textarea id="cvText" value={cv} onChange={(e) => setCv(e.target.value)} placeholder="Cole aqui o conteúdo do seu currículo ou do seu LinkedIn (experiências, habilidades, formação)…" />
              </div>
              <div className="field">
                <label htmlFor="roleText">Cargo-alvo</label>
                <input id="roleText" type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex.: Product Manager de IA · Pessoa Engenheira de Dados Sênior · Coordenação de Marketing" />
              </div>
              <div className="builder-actions">
                <button className="btn btn-primary" onClick={build} disabled={busy}>Construir meu gêmeo <span className="arw">→</span></button>
                <button className="btn btn-ghost" onClick={loadSample} disabled={busy}>Carregar exemplo</button>
              </div>
              <p className="note-line"><b>Roda IA de verdade.</b> O diagnóstico, os gaps, as vagas e o plano são gerados na hora a partir do seu texto. As vagas do radar são <b>ilustrativas</b> (empresas fictícias plausíveis) — num produto real viriam de uma base de vagas indexada.</p>
              {error && <div className="err">{error}</div>}
            </div>
          </section>
        )}

        {stage === "proc" && (
          <section className="stage">
            <div className="proc">
              <div className="proc-ring" />
              <div className="proc-steps">
                {["Lendo seu currículo", "Estruturando o gêmeo digital", "Comparando com o mercado", "Montando radar e plano"].map((label, i) => (
                  <div key={i} className={"step" + (i < procStep ? " done" : i === procStep ? " doing" : "")}>{label}</div>
                ))}
              </div>
            </div>
          </section>
        )}

        {stage === "report" && diag && (
          <section className="stage">
            <Report diag={diag} opp={opp} role={role} cv={cv} onRestart={restart} />
          </section>
        )}
      </main>
    </>
  );
}

function Report({ diag, opp, role, cv, onRestart }) {
  const p = diag.perfil || {};
  const ss = diag.sub_scores || {};
  const gaps = diag.gaps || [];

  const [open, setOpen] = useState({});
  const [completed, setCompleted] = useState({});
  const [animated, setAnimated] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [tailorVaga, setTailorVaga] = useState(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Live, auditable recompute as microactions are completed
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

  return (
    <div className="report">
      {/* Mirror */}
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

      {/* Tools */}
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

      {/* 01 — Score instrument */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">01</span>
          <h2 className="sec-title">O número, por dentro</h2>
          <p className="sec-sub">Nada de caixa-preta: o Career Health Score é a soma ponderada de quatro sub-scores. Conclua uma microação lá embaixo e veja ele subir aqui.</p>
        </div>
        <div className="instrument">
          <div className="inst-top">
            <div className="gauge">
              <svg width="120" height="120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="9" />
                <circle cx="60" cy="60" r="52" fill="none" className="gauge-arc" strokeWidth="9" strokeLinecap="round" strokeDasharray={CIRC.toFixed(1)} strokeDashoffset={gaugeOff.toFixed(1)} />
              </svg>
              <div className="gauge-num">{liveOverall}</div>
            </div>
            <div className="inst-headline">
              <h3>Sua empregabilidade para “{role}”{delta > 0 && <span className="inst-delta"> ▲ +{delta} desde o diagnóstico</span>}</h3>
              <p>Quanto mais alto, mais perto você está do que o mercado pede para esse alvo. O número recalcula sozinho conforme você conclui as microações.</p>
              <div className="formula">Score = (Aderência × <b>.40</b>) + (Habilidades × <b>.30</b>) + (Perfil × <b>.20</b>) + (Experiência × <b>.10</b>)</div>
            </div>
          </div>
          <div className="subscores">
            {SS_KEYS.map((k) => {
              const v = liveVals[k];
              const meta = SS_META[k];
              const contrib = (v * WEIGHTS[k]).toFixed(1);
              const isOpen = !!open[k];
              const { text, src } = splitSrc(ss[k]?.explicacao);
              const boosted = v > baseVals[k];
              return (
                <div className="ss" key={k}>
                  <button className="ss-head" aria-expanded={isOpen} onClick={() => setOpen((o) => ({ ...o, [k]: !o[k] }))}>
                    <div className="ss-bar-wrap">
                      <div className="ss-bar-top"><span className="ss-label">{meta.label}{boosted && <span className="ss-up"> ▲</span>}</span><span className="ss-weight">peso {meta.w}</span></div>
                      <div className="ss-track"><div className="ss-fill" style={{ width: animated ? v + "%" : "0%" }} /></div>
                    </div>
                    <span className="ss-val">{v}</span>
                    <svg className={"ss-chev" + (isOpen ? " open" : "")} width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  {isOpen && (
                    <div className="ss-body">
                      <p>{text} <Src value={src} dark /></p>
                      <div className="ss-calc">{v} × {meta.w} (peso) = {contrib} pts no score final</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 02 — Gaps (live) */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">02</span>
          <h2 className="sec-title">O que separa você do alvo</h2>
          <p className="sec-sub">Marque uma microação como concluída e o score lá em cima sobe na hora — o cálculo é transparente.</p>
        </div>
        <div className="gap-list">
          {gaps.map((g, i) => {
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
      </div>

      {/* 03 — Radar */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">03</span>
          <h2 className="sec-title">Vagas onde você tem chance real</h2>
          <p className="sec-sub">Ordenadas por aderência ao seu gêmeo. Clique em “Adaptar currículo” para alinhar seu CV a uma delas.</p>
        </div>
        <div className="vaga-list">
          {(opp?.vagas || []).map((v, i) => {
            const { text, src } = splitSrc(v.porque);
            return (
              <div className="vagac" key={i}>
                <div className="vagac-top">
                  <div><h4 className="vagac-title">{v.titulo}</h4><p className="vagac-co">{v.empresa}{v.local ? " · " + v.local : ""}</p></div>
                  <div className="match"><span className="match-num">{v.match}</span><span className="match-lbl">match</span></div>
                </div>
                <p className="vagac-why">{text} <Src value={src} /></p>
                {v.falta && v.falta.length > 0 && (
                  <div className="vagac-falta"><span className="falta-lbl">falta:</span>{v.falta.map((f, j) => <span className="falta-chip" key={j}>{f}</span>)}</div>
                )}
                <button className="vagac-tailor" onClick={() => setTailorVaga(v)}>Adaptar currículo para esta vaga →</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 04 — Plano */}
      <div className="sec">
        <div className="sec-head">
          <span className="sec-no">04</span>
          <h2 className="sec-title">Seu plano das próximas 3 semanas</h2>
          <p className="sec-sub">Microações com impacto estimado no score e esforço — para aplicar melhor, não aplicar mais.</p>
        </div>
        <div className="weeks">
          {(opp?.plano || []).map((w, i) => (
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
      </div>

      <div className="rep-foot">
        <button className="btn btn-ghost" onClick={onRestart}>← Construir outro gêmeo</button>
        <p className="transp"><b>Transparência:</b> o score é um cálculo auditável (a fórmula acima); os textos são gerados por IA a partir do seu currículo. As vagas são <b>ilustrativas</b>. Princípio do produto: número = cálculo, texto = explicação com fonte.</p>
      </div>

      {showInterview && <InterviewModal role={role} gaps={gapNames} onClose={() => setShowInterview(false)} />}
      {showChat && <ChatModal role={role} perfil={p} gaps={gapNames} onClose={() => setShowChat(false)} />}
      {tailorVaga && <TailorModal role={role} cv={cv} vaga={tailorVaga} onClose={() => setTailorVaga(null)} />}
    </div>
  );
}
