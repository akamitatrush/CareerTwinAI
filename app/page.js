"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SAMPLE_CV, SAMPLE_ROLE } from "@/lib/sample";
import Report from "@/components/Report";
import LinkedinImportButton from "@/components/LinkedinImportButton";
import PortfolioImportButton from "@/components/PortfolioImportButton";
import OnboardingChat from "@/components/OnboardingChat";
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";

// Card visual de fonte conectada (CV / LinkedIn / GitHub). Não recebe ação —
// é só status visual. As ações ficam nos botões de .ct-onb-extras logo abaixo.
function SourceCard({ label, done }) {
  return (
    <div className={"ct-onb-source-card" + (done ? " done" : "")}>
      <div className="ct-onb-source-icon" aria-hidden="true">
        {done ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" strokeDasharray="3 4" />
          </svg>
        )}
      </div>
      <span className="ct-onb-source-label">{label}</span>
      <span className="ct-onb-source-status">{done ? "Conectado" : "Pendente"}</span>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [stage, setStage] = useState("input");
  // Modo de entrada do CV. "paste" = textarea tradicional (default).
  // "chat" = onboarding conversacional (6 perguntas, sem LLM, monta CV
  // estruturado e devolve pra setCv via onComplete).
  const [mode, setMode] = useState("paste");
  const [cv, setCv] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [procStep, setProcStep] = useState(0);
  const [procElapsed, setProcElapsed] = useState(0);
  // Step text vindo do stream SSE de /api/analyze. Atualizado conforme o
  // backend emite eventos. Sincroniza com procStep abaixo pra dar feedback
  // contextual em cada fase do pipeline (validating → llm_jobs_parallel
  // → computing → persisting). Default "" antes do stream iniciar.
  const [procStepText, setProcStepText] = useState("");
  const [diag, setDiag] = useState(null);
  const [opp, setOpp] = useState(null);
  const [isLogged, setIsLogged] = useState(false);
  const [snapshotId, setSnapshotId] = useState(null);
  const [onbState, setOnbState] = useState(null);

  // === Analytics: HOME_VIEWED uma vez ao montar.
  // useEffect sem deps => roda 1x. Marca o topo do funil de ativacao.
  useEffect(() => {
    track(EVENTS.HOME_VIEWED, {});
  }, []);

  // === Analytics: CV_PASTE_STARTED com debounce de 500ms.
  // Dispara so na primeira vez que o user comeca a digitar/colar conteudo
  // significativo (>= 20 chars). Ref local pra disparar 1x por sessao.
  // useState pra persistir entre re-renders (vs useRef faria igual, mas
  // mantemos consistencia com o estilo do arquivo).
  const [cvPasteTracked, setCvPasteTracked] = useState(false);
  useEffect(() => {
    if (cvPasteTracked) return;
    if (cv.trim().length < 20) return;
    const t = setTimeout(() => {
      track(EVENTS.CV_PASTE_STARTED, { chars: cv.trim().length });
      setCvPasteTracked(true);
    }, 500);
    return () => clearTimeout(t);
  }, [cv, cvPasteTracked]);

  // Detecta sessao no client. Endpoint publico do NextAuth, sem expor PII alem
  // do que o proprio user ja sabe (email/nome). Se logged, em sequencia busca
  // o state do onboarding (fontes conectadas) pra renderizar o contador X/3.
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (alive && s?.user?.id) {
          setIsLogged(true);
          return fetch("/api/profile/onboarding").then((r) => r.json());
        }
      })
      .then((state) => {
        if (alive && state && !state.error) setOnbState(state);
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
    setProcStepText("");
    setBusy(true);
    track(EVENTS.DIAGNOSIS_STARTED, {
      cv_chars: cv.trim().length,
      role_len: role.trim().length,
      is_logged: isLogged,
    });
    try {
      setProcStep(1);
      // /api/analyze com ?stream=1: SSE com eventos progressivos. UI atualiza
      // o procStepText em tempo real. Em caso de erro mid-stream o backend
      // emite {type:"error", status, error, code} — tratamos como throw aqui
      // pra cair no catch e mostrar a mesma mensagem amigavel do path JSON.
      const dRes = await fetch("/api/analyze?stream=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cv, role }),
      });
      if (!dRes.ok) {
        // Fallback: se o servidor caiu antes de abrir o stream (raro — gateway
        // 5xx, por ex), tenta parsear JSON pra extrair msg amigavel.
        let msg = "Falha na análise.";
        try {
          const errBody = await dRes.json();
          msg = errBody.error || msg;
        } catch {}
        throw new Error(msg);
      }
      // Step mapping: nome do step do backend -> numero do procStep da UI.
      // Mantemos os steps existentes (0-3) e o text granular vem do stream.
      const stepNumberMap = {
        validating: 1,
        llm_jobs_parallel: 1,
        computing: 2,
        persisting: 2,
      };
      const reader = dRes.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let d = null;
      let streamError = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE: eventos separados por linha em branco (\n\n).
        const blocks = buf.split("\n\n");
        buf = blocks.pop() || "";
        for (const block of blocks) {
          const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          let event;
          try {
            event = JSON.parse(dataLine.slice(6));
          } catch {
            continue;
          }
          if (event.type === "step") {
            setProcStepText(event.step);
            const n = stepNumberMap[event.step];
            if (typeof n === "number") setProcStep(n);
          } else if (event.type === "result") {
            d = event.payload;
          } else if (event.type === "error") {
            // Mid-stream error: backend nos manda msg amigavel + code, jogamos
            // pra catch reusar o mapping existente (timeout/rate/cv_invalid).
            streamError = new Error(event.error || "Falha na análise.");
            streamError.code = event.code;
            streamError.status = event.status;
          } else if (event.type === "done") {
            // Marca explicita de fim. Loop sai no proximo done:true do reader.
          }
        }
      }
      if (streamError) throw streamError;
      if (!d) throw new Error("A IA não retornou resultado. Tente de novo.");
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
      track(EVENTS.DIAGNOSIS_COMPLETED, {
        cv_chars: cv.trim().length,
        role_len: role.trim().length,
        elapsed_seconds: procElapsed,
        overall_score: d?.overall,
        jobs_returned: (o?.vagas || []).length,
        jobs_illustrative: !!o?.illustrative,
        is_logged: isLogged,
      });
      // User logado: redireciona pro dashboard (resultado ja foi salvo).
      // Mostrar Report inline aqui seria redundante — dashboard tem o mesmo
      // conteudo mais persistente (com refresh, gaps marcaveis, etc).
      // User anonimo: continua vendo Report inline ("modo experimentar").
      if (isLogged) {
        router.push("/dashboard");
        return;
      }
      setStage("report");
    } catch (e) {
      const msg = String(e?.message || "").toLowerCase();
      let errorCode = "unknown";
      if (msg.includes("timeout") || msg.includes("aborted")) errorCode = "timeout";
      else if (msg.includes("network")) errorCode = "network";
      else if (msg.includes("rate") || msg.includes("429")) errorCode = "rate_limited";
      else if (msg.includes("cv") || msg.includes("currículo") || msg.includes("curriculo")) errorCode = "cv_invalid";
      track(EVENTS.DIAGNOSIS_FAILED, { error_code: errorCode });
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
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <section className="ct-onb-stage">
            <div className="ct-onb-grid">
              {/* Brand panel (esquerda) */}
              <div className="ct-onb-brand">
                <div className="ct-onb-brand-mark">
                  <div className="ct-onb-brand-mark-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="8" r="3.2" />
                      <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6" />
                      <path d="M14.5 13.5l2 2 4-4.5" />
                    </svg>
                  </div>
                  <span className="ct-onb-brand-name">CareerTwin AI</span>
                </div>

                {/* Ilustracao decorativa: 3 silhuetas humanas com linha de
                    progresso ascendente. SVG inline (sem dep externa, sem
                    request HTTP, respeita CSP). Tema "carreira de pessoas
                    crescendo". Decorativa — aria-hidden. */}
                <div className="ct-onb-brand-illust" aria-hidden="true">
                  <svg viewBox="0 0 360 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Linha de tendencia (ascendente) */}
                    <path d="M20 140 Q 90 130, 130 100 T 240 60 T 340 30"
                      stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="0" />
                    {/* Pontos na linha (milestones) */}
                    <circle cx="90" cy="130" r="3" fill="rgba(255,255,255,0.4)" />
                    <circle cx="180" cy="80" r="3" fill="rgba(255,255,255,0.4)" />
                    <circle cx="280" cy="42" r="4" fill="rgba(255,255,255,0.7)" />

                    {/* Pessoa 1 (esquerda) */}
                    <g transform="translate(40, 80)">
                      <circle cx="22" cy="14" r="11" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
                      <path d="M5 60 Q5 38, 22 38 Q39 38, 39 60" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinejoin="round" />
                    </g>

                    {/* Pessoa 2 (centro, destacada) */}
                    <g transform="translate(140, 60)">
                      <circle cx="26" cy="16" r="13" fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" />
                      <path d="M4 70 Q4 44, 26 44 Q48 44, 48 70" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinejoin="round" />
                      {/* Check mark indicando crescimento */}
                      <circle cx="44" cy="14" r="9" fill="rgba(122,255,178,0.85)" />
                      <path d="M40 14 L43.5 17.5 L49 11.5" stroke="#0E3D2A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </g>

                    {/* Pessoa 3 (direita, mais alta — futuro/cargo-alvo) */}
                    <g transform="translate(255, 35)">
                      <circle cx="22" cy="14" r="11" fill="rgba(255,255,255,0.22)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
                      <path d="M5 60 Q5 38, 22 38 Q39 38, 39 60" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" strokeLinejoin="round" />
                      {/* Mini estrela acima (cargo-alvo) */}
                      <path d="M22 -2 L23.5 2.5 L28 2.5 L24.3 5.5 L25.8 10 L22 7.3 L18.2 10 L19.7 5.5 L16 2.5 L20.5 2.5 Z"
                        fill="rgba(255,212,128,0.9)" />
                    </g>
                  </svg>
                </div>

                <div className="ct-onb-brand-content">
                  <div className="ct-onb-brand-eyebrow">CONSTRUA SEU GÊMEO</div>
                  <h1 className="ct-onb-brand-title">Um retrato vivo da sua carreira — que evolui com você.</h1>
                  <p className="ct-onb-brand-sub">
                    Conectamos seu perfil real ao que o mercado realmente pede e mostramos a próxima ação concreta. Sem achismo, com a fonte de cada recomendação.
                  </p>
                  {/* Trust pills: 3 features curtas, cada uma com icone. Mostra
                      defensibilidade (RAG curado, LGPD, sem achismo) no espaco
                      onde antes era vazio. */}
                  <ul className="ct-onb-brand-pills" role="list">
                    <li>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                      </svg>
                      <span>Base curada BR</span>
                    </li>
                    <li>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" />
                      </svg>
                      <span>LGPD-by-design</span>
                    </li>
                    <li>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                      </svg>
                      <span>Fonte em cada texto</span>
                    </li>
                  </ul>
                </div>

                <div className="ct-onb-lgpd">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#B9B9EC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" />
                  </svg>
                  <p>
                    Seus dados são processados com criptografia, nunca vendidos e nunca enviados a recrutadores sem você aprovar. Você pode apagar tudo a qualquer momento. <strong>Conforme a LGPD.</strong>
                  </p>
                </div>
              </div>

              {/* Right panel — inputs */}
              <div className="ct-onb-input">
                <div className="ct-onb-input-head">
                  <span className="ct-onb-step">ETAPA 1 DE 2 · CONECTAR SUAS FONTES</span>
                  {isLogged && onbState && (
                    <span className="ct-onb-counter" aria-label={`${onbState.connectedCount} de ${onbState.total} fontes conectadas`}>
                      <strong>{onbState.connectedCount}</strong>/{onbState.total}
                    </span>
                  )}
                </div>
                <h2 className="ct-onb-input-title">Vamos construir teu gêmeo digital</h2>
                <p className="ct-onb-input-sub">
                  O mínimo é colar seu currículo e dizer o cargo-alvo. Quanto mais fontes você conectar (LinkedIn, GitHub), mais preciso fica.
                </p>

                {/* Stepper visual mantido em estilo limpo */}
                <ol className="ct-onb-steps" aria-label="Etapas">
                  <li className={"ct-onb-step-item" + (homeStep >= 1 ? " active" : "") + (homeStep > 1 ? " done" : "")}>
                    <span className="ct-onb-step-n">1</span>
                    <span className="ct-onb-step-l">Currículo</span>
                  </li>
                  <li className={"ct-onb-step-item" + (homeStep >= 2 ? " active" : "") + (homeStep > 2 ? " done" : "")}>
                    <span className="ct-onb-step-n">2</span>
                    <span className="ct-onb-step-l">Cargo</span>
                  </li>
                  <li className={"ct-onb-step-item" + (homeStep >= 3 ? " active" : "")}>
                    <span className="ct-onb-step-n">3</span>
                    <span className="ct-onb-step-l">Diagnóstico</span>
                  </li>
                </ol>

                {/* Builder — mantém estrutura mas com tokens novos */}
                <div className="ct-onb-builder">
                  {/* Tabs: paste vs chat. Chat eh opcional; default paste pq eh o
                      modo que ja existia e nao queremos surpreender returning users. */}
                  <div className="ct-onb-mode-tabs" role="tablist" aria-label="Como informar seu currículo">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "paste"}
                      tabIndex={mode === "paste" ? 0 : -1}
                      className={mode === "paste" ? "active" : ""}
                      onClick={() => {
                        if (mode !== "paste") {
                          track(EVENTS.ONBOARDING_MODE_SWITCHED, { from: mode, to: "paste" });
                          setMode("paste");
                        }
                      }}
                    >
                      Colar CV
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "chat"}
                      tabIndex={mode === "chat" ? 0 : -1}
                      className={mode === "chat" ? "active" : ""}
                      onClick={() => {
                        if (mode !== "chat") {
                          track(EVENTS.ONBOARDING_MODE_SWITCHED, { from: mode, to: "chat" });
                          setMode("chat");
                        }
                      }}
                    >
                      Conversar com IA
                    </button>
                  </div>

                  {mode === "paste" ? (
                    <div className="field">
                      <label htmlFor="cvText">Seu currículo</label>
                      <textarea id="cvText" value={cv} onChange={(e) => setCv(e.target.value)} placeholder="Cole o texto do CV ou conteúdo do LinkedIn (experiências, habilidades, formação)..." />
                      <p className="field-hint">Quanto mais detalhado, melhor o diagnóstico — não tem certo nem errado.</p>
                    </div>
                  ) : (
                    <OnboardingChat
                      onComplete={(extractedCv) => {
                        // Chat terminou: preenche CV e volta pro modo paste pro user
                        // poder revisar/editar o texto antes de gerar o diagnostico.
                        setCv(extractedCv);
                        setMode("paste");
                      }}
                    />
                  )}
                  <div className="field">
                    <label htmlFor="roleText">Cargo-alvo</label>
                    <input
                      id="roleText"
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      onBlur={() => {
                        // Trackeia uma vez por sessao quando user "fecha" o input
                        // com algo digitado. Trim pra evitar tracking de espacos.
                        const r = role.trim();
                        if (r.length > 0) {
                          track(EVENTS.ROLE_DEFINED, { role_len: r.length });
                        }
                      }}
                      placeholder="Ex.: Product Manager de IA · Pessoa Engenheira de Dados Sênior"
                    />
                  </div>

                  <div className="ct-onb-actions">
                    <button className="btn btn-primary" onClick={build} disabled={busy}>
                      {isLogged ? "Gerar e salvar diagnóstico" : "Gerar diagnóstico (efêmero)"}
                      <span className="arw" aria-hidden="true">→</span>
                    </button>
                    <button className="btn btn-ghost" onClick={loadSample} disabled={busy}>Carregar exemplo</button>
                  </div>

                  {isLogged && onbState && (
                    <div className="ct-onb-sources" role="list" aria-label="Status das fontes conectadas">
                      <SourceCard label="Currículo" done={onbState.sources.cv} />
                      <SourceCard label="LinkedIn" done={onbState.sources.linkedin} />
                      <SourceCard label="GitHub" done={onbState.sources.github} />
                    </div>
                  )}

                  <div className="ct-onb-extras">
                    <label className="ct-onb-extra-btn" title="PDF ou DOCX">
                      {/* SVG paperclip */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                      </svg>
                      Enviar CV
                      <input
                        type="file"
                        accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          setError("");
                          setBusy(true);
                          track(EVENTS.CV_UPLOAD_STARTED, {
                            file_type: f.type || "unknown",
                            size_kb: Math.round((f.size || 0) / 1024),
                          });
                          try {
                            const fd = new FormData();
                            fd.append("file", f);
                            const r = await fetch("/api/cv/upload", { method: "POST", body: fd });
                            const data = await r.json();
                            if (!r.ok) {
                              track(EVENTS.CV_UPLOAD_FAILED, { status: r.status });
                              if (r.status === 401) {
                                setError("Pra enviar arquivo você precisa estar logado. Cole o texto direto aqui, ou entre em /entrar pra salvar.");
                              } else {
                                setError(data.error || "Não consegui ler esse arquivo. Tenta colar o texto direto.");
                              }
                              return;
                            }
                            track(EVENTS.CV_UPLOAD_SUCCEEDED, {
                              extracted_chars: data?.text?.length || 0,
                            });
                            setCv(data.text);
                          } catch (err) {
                            track(EVENTS.CV_UPLOAD_FAILED, { status: 0, reason: "network" });
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

                  {error && <div className="err" role="alert">{error}</div>}

                  <p className="ct-onb-foot">
                    <b>Modo experimentar (efêmero):</b> a IA roda de verdade, mas nada é salvo. Quer histórico? <a href="/entrar">Crie conta grátis</a> — sem cartão, com LGPD por construção.
                  </p>
                </div>
              </div>
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
              {/* Steps granulares vindo do SSE de /api/analyze. Renderiza so
                  enquanto estamos na fase analyze (procStep <= 2). Da feedback
                  contextual de "validando -> LLM+jobs em paralelo -> computando
                  -> salvando" pra reduzir tempo PERCEBIDO durante os ~15s. */}
              {procStepText && procStep <= 2 && (
                <ul className="ct-proc-steps" aria-label="Progresso do diagnóstico">
                  {[
                    { id: "validating", label: "Validando entrada" },
                    { id: "llm_jobs_parallel", label: "Analisando CV + buscando vagas em paralelo" },
                    { id: "computing", label: "Calculando score determinístico" },
                    { id: "persisting", label: isLogged ? "Salvando seu histórico" : "Finalizando" },
                  ].map((s, idx, arr) => {
                    const currentIdx = arr.findIndex((x) => x.id === procStepText);
                    const state =
                      currentIdx < 0 ? "" :
                      idx < currentIdx ? "done" :
                      idx === currentIdx ? "active" : "";
                    return (
                      <li key={s.id} className={state}>{s.label}</li>
                    );
                  })}
                </ul>
              )}
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
        .proc-headline { margin: 18px 0 22px; max-width: 560px; }
        .proc-title { font-size: 22px; font-weight: 700; line-height: 1.25; margin: 0 0 6px; font-family: var(--font-display); }
        .proc-sub { font-size: 14px; color: var(--text-muted); margin: 0 0 8px; line-height: 1.45; }
        .proc-meta { font-size: 12px; color: var(--text-subtle); font-family: "JetBrains Mono", monospace; letter-spacing: .04em; margin: 0; }
      `}</style>
    </>
  );
}
