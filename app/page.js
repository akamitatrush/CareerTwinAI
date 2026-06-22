"use client";

import { useState, useEffect } from "react";
import { SAMPLE_CV, SAMPLE_ROLE } from "@/lib/sample";
import Report from "@/components/Report";
import LinkedinImportButton from "@/components/LinkedinImportButton";
import PortfolioImportButton from "@/components/PortfolioImportButton";
import { track } from "@/components/PostHogProvider";

export default function Home() {
  const [stage, setStage] = useState("input");
  const [cv, setCv] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [procStep, setProcStep] = useState(0);
  const [procElapsed, setProcElapsed] = useState(0);
  const [diag, setDiag] = useState(null);
  const [opp, setOpp] = useState(null);
  const [isLogged, setIsLogged] = useState(false);
  const [snapshotId, setSnapshotId] = useState(null);

  // Detecta sessao no client. Endpoint publico do NextAuth, sem expor PII alem
  // do que o proprio user ja sabe (email/nome).
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (alive && s?.user?.id) setIsLogged(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Cronômetro suave durante o "proc" pra dar sensação de progresso real
  useEffect(() => {
    if (stage !== "proc") {
      setProcElapsed(0);
      return;
    }
    const t = setInterval(() => setProcElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [stage]);

  function loadSample() {
    setCv(SAMPLE_CV);
    setRole(SAMPLE_ROLE);
    setError("");
  }

  // Stepper visual da home — qual etapa o usuário está preenchendo
  const homeStep = (() => {
    if (cv.trim().length >= 60 && role.trim()) return 3;
    if (cv.trim().length >= 60) return 2;
    return 1;
  })();

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
      setSnapshotId(d?.snapshotId || null);
      setStage("report");
      track("diagnosis_completed", {
        cv_chars: cv.trim().length,
        role_len: role.trim().length,
        elapsed_seconds: procElapsed,
        overall_score: d?.overall,
        jobs_returned: (o?.vagas || []).length,
        jobs_illustrative: !!o?.illustrative,
        is_logged: isLogged,
      });
    } catch (e) {
      const msg = String(e?.message || "").toLowerCase();
      let friendly;
      if (msg.includes("timeout") || msg.includes("aborted") || msg.includes("network")) {
        friendly = "A IA passou do tempo dessa vez. Respira fundo e tenta de novo daqui a alguns segundos — geralmente roda de primeira.";
      } else if (msg.includes("rate") || msg.includes("429")) {
        friendly = "Muitas tentativas seguidas. Aguarda cerca de 1 minuto e manda de novo.";
      } else if (msg.includes("cv") || msg.includes("currículo") || msg.includes("curriculo")) {
        friendly = "Algo no currículo travou a validação. Tenta colar um trecho mais limpo — sem caracteres estranhos ou formatação de PDF copiada torta.";
      } else {
        friendly = `Não rolou montar o diagnóstico (${e.message || "erro desconhecido"}). Tenta de novo — se insistir, ajuste o cargo ou o trecho do CV.`;
      }
      setError(friendly);
      setStage("input");
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setStage("input");
    setDiag(null);
    setOpp(null);
    setSnapshotId(null);
  }

  // Mensagens contextuais do loading — cada uma reage ao input real do usuário
  const cvChars = cv.trim().length;
  const estSec = Math.max(8, Math.min(18, Math.round(cvChars / 220) + 8));
  const procMessages = [
    {
      title: `Lendo seu currículo`,
      sub: `${cvChars.toLocaleString("pt-BR")} caracteres · estimativa de ~${estSec}s no total`,
    },
    {
      title: `Estruturando seu gêmeo digital`,
      sub: `Identificando cargo, senioridade e skills — separando o que é sinal do que é ruído`,
    },
    {
      title: `Comparando com vagas reais de “${role || "seu cargo"}”`,
      sub: `Cruzando seu perfil com descrições reais publicadas no Brasil pra medir a distância`,
    },
    {
      title: `Montando seu radar e plano de 3 semanas`,
      sub: `Priorizando lacunas por impacto no score — só o que move a agulha`,
    },
  ];

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
              <div className="brand-sub">
                seu gêmeo de carreira
                <span
                  className="info-tip"
                  tabIndex={0}
                  role="button"
                  aria-label="O que é o gêmeo de carreira"
                  data-tip="É o seu perfil estruturado a partir do CV e comparado ao que o mercado pede pro cargo que você quer. Mostra onde você já está pronto, onde tem lacuna e o que fazer pra fechar — sempre com a fonte do número."
                >
                  ?
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {stage === "report" && <div className="live-pill"><span className="live-dot" /> IA ao vivo</div>}
            {isLogged ? (
              <>
                <a href="/candidaturas" className="tool-btn" style={{ textDecoration: "none" }}>Candidaturas</a>
                <a href="/meu-gemeo" className="tool-btn" style={{ textDecoration: "none" }}>Meu gêmeo →</a>
              </>
            ) : (
              <a href="/entrar" className="tool-btn" style={{ textDecoration: "none" }}>Entrar para salvar</a>
            )}
          </div>
        </div>
      </div>

      <main className="wrap">
        {stage === "input" && (
          <section className="stage">
            <div className="intro">
              <p className="eyebrow">Beta · MVP funcional</p>
              <h1 className="hero">Construa o <em>gêmeo</em> da sua carreira em 30 segundos.</h1>
              <p className="hero-lede">Cole seu currículo e diga o cargo que você quer. A IA estrutura quem você é hoje, compara com o que o mercado pede e te mostra a distância — com o porquê e a fonte de cada número.</p>
            </div>

            {/* Stepper visual discreto — só estado, não interativo */}
            <ol className="home-steps" aria-label="Etapas do diagnóstico">
              <li className={"home-step" + (homeStep >= 1 ? " active" : "") + (homeStep > 1 ? " done" : "")}>
                <span className="home-step-n">1</span>
                <span className="home-step-l">Currículo</span>
              </li>
              <li className={"home-step" + (homeStep >= 2 ? " active" : "") + (homeStep > 2 ? " done" : "")}>
                <span className="home-step-n">2</span>
                <span className="home-step-l">Cargo</span>
              </li>
              <li className={"home-step" + (homeStep >= 3 ? " active" : "")}>
                <span className="home-step-n">3</span>
                <span className="home-step-l">Diagnóstico</span>
              </li>
            </ol>

            <div className="builder">
              <div className="field">
                <label htmlFor="cvText">Seu currículo — cole o texto</label>
                <textarea id="cvText" value={cv} onChange={(e) => setCv(e.target.value)} placeholder="Cole aqui o conteúdo do seu currículo ou do seu LinkedIn (experiências, habilidades, formação)…" />
                <p className="field-hint">Quanto mais detalhado, melhor o diagnóstico — não tem certo nem errado, é só matéria-prima pra IA.</p>
              </div>
              <div className="field">
                <label htmlFor="roleText">Cargo-alvo</label>
                <input id="roleText" type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex.: Product Manager de IA · Pessoa Engenheira de Dados Sênior · Coordenação de Marketing" />
              </div>
              <div className="builder-actions">
                <button className="btn btn-primary" onClick={build} disabled={busy}>
                  {isLogged ? "Gerar e salvar diagnóstico" : "Gerar diagnóstico (efêmero)"}
                  <span className="arw">→</span>
                </button>
                <button className="btn btn-ghost" onClick={loadSample} disabled={busy}>Carregar exemplo</button>
                <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
                  Enviar PDF
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      setError("");
                      setBusy(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", f);
                        const r = await fetch("/api/cv/upload", { method: "POST", body: fd });
                        const data = await r.json();
                        if (!r.ok) {
                          if (r.status === 401) {
                            setError("Pra enviar PDF você precisa estar logado. Cole o texto direto aqui, ou entre em /entrar pra salvar.");
                          } else {
                            setError(data.error || "Não consegui ler esse PDF. Tenta um arquivo de texto (não escaneado).");
                          }
                          return;
                        }
                        setCv(data.text);
                      } catch (err) {
                        setError("Falhou o upload: " + (err.message || "tenta de novo daqui a pouco."));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  />
                </label>
                <LinkedinImportButton
                  disabled={busy}
                  onImport={({ cv: parsedCv, perfil }) => {
                    if (parsedCv) setCv(parsedCv);
                    if (!role && perfil?.cargo_atual) setRole(perfil.cargo_atual);
                  }}
                />
                <PortfolioImportButton disabled={busy} />
              </div>
              <p className="note-line">
                <b>Modo experimentar (efêmero):</b> a IA roda de verdade, mas nada é salvo — quando você fecha a aba, evapora.
                Quer manter o gêmeo, ver evolução no tempo e organizar candidaturas? <a href="/entrar">Crie sua conta</a> —
                é grátis, com consentimento separado por fonte e botão de “apagar tudo” sempre à mão.
              </p>
              {error && <div className="err">{error}</div>}
            </div>
          </section>
        )}

        {stage === "proc" && (
          <section className="stage">
            <div className="proc">
              <div className="proc-ring" />
              <div className="proc-headline">
                <h2 className="proc-title">{procMessages[procStep]?.title || "Quase lá"}</h2>
                <p className="proc-sub">{procMessages[procStep]?.sub || ""}</p>
                <p className="proc-meta">
                  {procElapsed > estSec + 5
                    ? `Mais lento que o normal — o servidor de IA pode estar em fila. Aguenta só mais um pouco · ${procElapsed}s decorridos`
                    : procElapsed > estSec
                      ? `Já passou da estimativa, mas chega lá · ${procElapsed}s decorridos`
                      : `Normalmente leva entre ${estSec - 4} e ${estSec + 3} segundos · ${procElapsed}s decorridos`}
                </p>
              </div>
              <div className="proc-steps">
                {procMessages.map((m, i) => (
                  <div key={i} className={"step" + (i < procStep ? " done" : i === procStep ? " doing" : "")}>
                    {m.title}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {stage === "report" && diag && isLogged && snapshotId && (
          <div className="saved-banner" role="status">
            <span className="saved-check">✓</span>
            <div className="saved-text">
              <b>Diagnóstico salvo no seu gêmeo.</b>
              <span> Você pode voltar quando quiser e acompanhar a evolução.</span>
            </div>
            <a href="/meu-gemeo" className="btn btn-primary saved-cta">Ver meu gêmeo →</a>
            <a href="/candidaturas" className="btn btn-ghost saved-cta">Funil de candidaturas</a>
          </div>
        )}
        {stage === "report" && diag && (
          <section className="stage">
            <Report diag={diag} opp={opp} role={role} cv={cv} onRestart={restart} />
          </section>
        )}
      </main>

      <style jsx global>{`
        .home-steps { list-style: none; padding: 0; margin: 0 0 18px; display: flex; gap: 8px; flex-wrap: wrap; }
        .home-step { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border: 1px solid #E5E3DA; border-radius: 999px; background: #FAF8F2; opacity: .55; transition: opacity .2s; }
        .home-step.active { opacity: 1; border-color: #B9D90C; }
        .home-step.done { opacity: .85; }
        .home-step-n { font-family: "JetBrains Mono", monospace; font-size: 10px; width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 1px solid #D4D6CA; display: inline-flex; align-items: center; justify-content: center; }
        .home-step.active .home-step-n { background: #B9D90C; border-color: #B9D90C; color: #1a1a1a; font-weight: 700; }
        .home-step-l { font-size: 12px; letter-spacing: .04em; text-transform: uppercase; color: #4C5048; }
        .field-hint { font-size: 12px; color: #6B6B66; margin: 6px 0 0; line-height: 1.4; }
        .proc-headline { margin: 18px 0 22px; max-width: 560px; }
        .proc-title { font-size: 22px; font-weight: 700; line-height: 1.25; margin: 0 0 6px; font-family: "Bricolage Grotesque", sans-serif; }
        .proc-sub { font-size: 14px; color: #4C5048; margin: 0 0 8px; line-height: 1.45; }
        .proc-meta { font-size: 12px; color: #888; font-family: "JetBrains Mono", monospace; letter-spacing: .04em; margin: 0; }
      `}</style>
    </>
  );
}
