"use client";

import { useState } from "react";
import { SAMPLE_CV, SAMPLE_ROLE } from "@/lib/sample";
import Report from "@/components/Report";

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
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {stage === "report" && <div className="live-pill"><span className="live-dot" /> IA ao vivo</div>}
            <a href="/entrar" className="tool-btn" style={{ textDecoration: "none" }}>Entrar para salvar</a>
          </div>
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
                <button className="btn btn-primary" onClick={build} disabled={busy}>Construir meu gêmeo (sem salvar) <span className="arw">→</span></button>
                <button className="btn btn-ghost" onClick={loadSample} disabled={busy}>Carregar exemplo</button>
              </div>
              <p className="note-line"><b>Modo experimentar (efêmero):</b> roda a IA ao vivo, mas <b>não salva</b> nada. Para construir um gêmeo que persiste, <a href="/entrar">crie sua conta</a> — gratuita, com consentimento por fonte e botão de "apagar tudo" sempre disponível.</p>
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
