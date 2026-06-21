"use client";

import { useEffect, useState } from "react";
import { WEIGHTS, SS_META } from "@/lib/score";
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
  return String(e || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function Src({ value, dark }) {
  if (!value) return null;
  return <span className={"src" + (dark ? " dark" : "")}>{value}</span>;
}

export default function Report({ diag, opp, role, cv, onRestart, footerNote }) {
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

      {opp?.vagas && opp.vagas.length > 0 && (
        <div className="sec">
          <div className="sec-head">
            <span className="sec-no">03</span>
            <h2 className="sec-title">Vagas onde você tem chance real</h2>
            <p className="sec-sub">
              Ordenadas por aderência ao seu gêmeo. Cada vaga mostra a fonte;
              clique em "Adaptar currículo" para alinhar seu CV a uma delas.
            </p>
          </div>
          <div className="vaga-list">
            {opp.vagas.map((v, i) => {
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
                            background: isReal ? "rgba(185,217,12,.18)" : "rgba(255,255,255,.10)",
                            color: isReal ? "#B9D90C" : "rgba(255,255,255,.7)",
                            border: isReal ? "1px solid rgba(185,217,12,.35)" : "1px dashed rgba(255,255,255,.25)",
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
                    {v.url && (
                      <a className="vagac-tailor" href={v.url} target="_blank" rel="noopener noreferrer">
                        Ver vaga original ↗
                      </a>
                    )}
                    <button className="vagac-tailor" onClick={() => setTailorVaga(v)}>
                      Adaptar currículo →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {opp?.plano && opp.plano.length > 0 && (
        <div className="sec">
          <div className="sec-head">
            <span className="sec-no">04</span>
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
        </div>
      )}

      <div className="rep-foot">
        {onRestart && <button className="btn btn-ghost" onClick={onRestart}>← Construir outro gêmeo</button>}
        <p className="transp">{footerNote || (
          <>
            <b>Transparência:</b> o score é um cálculo auditável (a fórmula acima);
            os textos são gerados por IA a partir do seu currículo
            {opp?.illustrative ? (
              <> ; as vagas aqui são <b>ilustrativas</b> (sem provider real configurado)</>
            ) : opp?.sources?.length ? (
              <> ; vagas vieram de {opp.sources.join(", ")}</>
            ) : null}
            . Princípio do produto: número = cálculo, texto = explicação com fonte.
          </>
        )}</p>
      </div>

      {showInterview && <InterviewModal role={role} gaps={gapNames} onClose={() => setShowInterview(false)} />}
      {showChat && <ChatModal role={role} perfil={p} gaps={gapNames} onClose={() => setShowChat(false)} />}
      {tailorVaga && cv && <TailorModal role={role} cv={cv} vaga={tailorVaga} onClose={() => setTailorVaga(null)} />}
    </div>
  );
}
