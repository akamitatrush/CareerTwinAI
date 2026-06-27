"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";

// Widget flutuante "Career Copilot" sempre visivel pra users logados.
// FAB bottom-right que abre drawer/sidebar a direita (sticky).
//
// Renderizado a partir do AppShell, que ja eh server-side gated por auth() —
// nao vaza pra public pages (login, /entrar, marketing).
//
// Streaming: consome SSE de /api/chat?stream=1. O LLM responde JSON
// {"resposta":"..."} — extraimos o texto progressivamente conforme chega
// (best-effort: regex no JSON parcial; ao final o servidor envia {done, full}
// e a gente parseia o JSON completo pra confiar no resultado canonico).
// State management: localStorage com janela rolante (ultimas 20 msgs) pra
// nao explodir tamanho. Historico vai pra LLM com cap em 10 msgs * 4k chars
// (ChatBody.history.max = 30, content.max = 4000).
//
// LGPD: salvamos historico em localStorage do proprio user — nunca vai pro
// servidor exceto via /api/chat, que ja eh ownership-checked por sessao.

// Extrai o valor de "resposta" de um JSON parcial em construcao via stream.
// Regex tolera escape (\") e quebra de linha. Em JSON ainda nao fechado,
// retorna o que ja foi acumulado dentro da string. Usado SO durante o
// streaming pro preview ao vivo — o estado final usa JSON.parse na resposta
// completa devolvida pelo backend (campo `full`).
function extractPartialResposta(text) {
  if (!text) return "";
  // Procura: "resposta" : " ... (sem fechar com aspas naotratadas)
  const match = text.match(/"resposta"\s*:\s*"((?:\\.|[^"\\])*)/);
  if (!match) return "";
  // Unescape basico (\\n, \", \\): suficiente pra preview. JSON.parse trata
  // o resto no final.
  return match[1]
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

const HISTORY_KEY = "ct-copilot-history";
const MAX_HISTORY = 20;

export default function CopilotWidget({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [err, setErr] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const pathname = usePathname();

  // targetRole eh OBRIGATORIO pelo /api/chat (ChatBody.role.min = 1). Se o
  // user ainda nao definiu cargo-alvo, fallback educado pro placeholder
  // generico que ainda passa no validator (>1 char).
  const targetRole =
    user?.targetRole && user.targetRole !== "Defina seu cargo-alvo"
      ? user.targetRole
      : "Profissional em transicao";

  // Persiste em localStorage por sessao
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-MAX_HISTORY));
      }
    } catch {
      // localStorage corrompido — ignora silenciosamente
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (messages.length > 0) {
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
      } catch {
        // quota cheia — ignora
      }
    }
  }, [messages]);

  // Auto-scroll pro fim a cada mensagem/streaming
  useEffect(() => {
    if (scrollRef.current && open) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming, open]);

  // Foco automatico no input quando abre (a11y + UX)
  useEffect(() => {
    if (open && inputRef.current) {
      const t = setTimeout(() => inputRef.current?.focus(), 240);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ESC fecha o painel (a11y)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Sugestoes contextuais por pagina. Ajudam user a descobrir capacidades
  // do copilot e reduzem o "blank-page problem".
  function getSuggestions() {
    if (pathname?.startsWith("/dashboard")) {
      return [
        "O que devo fazer pra subir o score?",
        "Minha aderencia ta baixa — por que?",
        "Sugira microacao prioritaria pra essa semana",
      ];
    }
    if (pathname?.startsWith("/gaps")) {
      return [
        "Como comeco o gap numero 1?",
        "Qual gap tem maior ROI no meu caso?",
        "Quanto tempo cada microacao leva?",
      ];
    }
    if (pathname?.startsWith("/oportunidades")) {
      return [
        "Como adapto meu CV pra essa primeira vaga?",
        "Qual vaga tem mais chance real?",
        "O que melhorar pra subir o match dessas vagas?",
      ];
    }
    if (pathname?.startsWith("/plano")) {
      return [
        "Qual a sequencia ideal pro meu plano?",
        "Como mantenho o foco semana a semana?",
        "Quais marcos sao realistas em 30 dias?",
      ];
    }
    if (pathname?.startsWith("/autoconhecimento")) {
      return [
        "Como uso meus resultados de DISC nas entrevistas?",
        "Meus valores conflitam com meu cargo-alvo?",
        "Como traduzir Ikigai em proximos passos?",
      ];
    }
    if (pathname?.startsWith("/cvs-adaptados") || pathname?.startsWith("/candidaturas")) {
      return [
        "Como melhoro o impacto do meu CV?",
        "Qual carta de apresentacao usar pra essa vaga?",
        "Estou no funil — qual o proximo passo?",
      ];
    }
    return [
      "Como melhoro meu CV?",
      "Qual proximo passo na minha carreira?",
      "Me ajuda a focar essa semana",
    ];
  }

  async function send(text, viaSuggestion = false) {
    const userMsg = String(text ?? input ?? "").trim();
    if (!userMsg || busy) return;
    setErr("");
    setInput("");

    if (viaSuggestion) {
      track(EVENTS.COPILOT_SUGGESTION_CLICKED, { path: pathname, len: userMsg.length });
    }

    // history em snapshot (antes da nova msg) — pra mandar pro backend
    const history = messages.slice(-10).map((m) => ({
      role: m.role,
      content: String(m.content || "").slice(0, 4000),
    }));

    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setBusy(true);
    setStreaming("");
    track(EVENTS.COPILOT_MESSAGE_SENT, { len: userMsg.length, path: pathname });

    try {
      // ?stream=1 ativa SSE. Servidor envia data:{delta:"..."} por chunk e
      // data:{done:true, full:"<JSON completo>"} no fim. Erro mid-stream
      // chega como data:{error:"..."} (status HTTP ja foi 200).
      const res = await fetch("/api/chat?stream=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          role: targetRole,
          history,
          message: userMsg,
        }),
      });

      // Erro precoce (auth/rate/budget/validacao): servidor ainda manda JSON
      // antes de entrar no stream — content-type indica.
      const ctype = res.headers.get("content-type") || "";
      if (!res.ok || !ctype.includes("text/event-stream")) {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error || `Falha (HTTP ${res.status}). Tente de novo.`;
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let accumulated = "";
      let finalText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // SSE: blocos separados por "\n\n", cada um tem linha "data: {...}".
        const events = buf.split("\n\n");
        buf = events.pop() || "";

        for (const ev of events) {
          const dataLine = ev.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine.slice(6));
            if (typeof data.delta === "string") {
              accumulated += data.delta;
              // Preview ao vivo: extrai "resposta" do JSON parcial em construcao.
              const partial = extractPartialResposta(accumulated);
              if (partial) setStreaming(partial);
            } else if (data.error) {
              throw new Error(data.error);
            } else if (data.done) {
              // Resposta canonica: parse o JSON completo enviado pelo servidor.
              // Tolera o caso (improvavel) de o LLM ter respondido sem cercar
              // — `full` ja contem o texto bruto do modelo.
              try {
                const parsed = JSON.parse(data.full || accumulated);
                finalText = parsed?.resposta || extractPartialResposta(accumulated) || "Sem resposta.";
              } catch {
                finalText = extractPartialResposta(accumulated) || "Sem resposta.";
              }
            }
          } catch (parseErr) {
            // Linha SSE corrompida: ignora silenciosamente. Se foi erro
            // sinalizado pelo data.error acima, repropaga.
            if (parseErr?.message && parseErr.message !== "Unexpected end of JSON input") {
              if (parseErr.message.startsWith("A IA falhou") || parseErr.message.includes("STREAM_FAILED")) {
                throw parseErr;
              }
            }
          }
        }
      }

      if (!finalText) {
        finalText = extractPartialResposta(accumulated) || "Sem resposta.";
      }
      setMessages((m) => [...m, { role: "assistant", content: finalText }]);
      track(EVENTS.COPILOT_MESSAGE_RECEIVED, {
        len: finalText.length,
        path: pathname,
      });
    } catch (e) {
      const message = e?.message || "Erro inesperado.";
      setErr(message);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Tive um problema: ${message}` },
      ]);
    } finally {
      setBusy(false);
      setStreaming("");
    }
  }

  function handleToggle() {
    setOpen((prev) => {
      const next = !prev;
      if (next) track(EVENTS.COPILOT_OPENED, { path: pathname });
      return next;
    });
  }

  return (
    <>
      <button
        type="button"
        className={"ct-copilot-fab ct-copilot-fab-pulse" + (open ? " open" : "")}
        onClick={handleToggle}
        aria-label={open ? "Fechar copilot" : "Abrir copiloto de carreira"}
        aria-expanded={open}
        aria-controls="ct-copilot-panel"
        style={{
          // Refresh visual: anel cyan-glow sutil em volta do FAB pra reforcar presenca.
          // Nao sobrescreve animacao copilotPulse (que ja usa box-shadow).
          filter: "drop-shadow(0 0 12px var(--accent-cyan-glow))",
        }}
      >
        {open ? (
          /* X exibido em 22px com stroke 2 (canonico forte). Antes era 2.4
              hardcoded — visualmente equivalente ao 2 do scale. */
          <Icon name="x" size={22} stroke={2} />
        ) : (
          <Icon name="chat-round" size={24} stroke={2} />
        )}
      </button>

      {open && (
        <aside
          id="ct-copilot-panel"
          className="ct-copilot-panel app-glass"
          role="dialog"
          aria-label="Career Copilot"
          aria-modal="false"
          style={{
            // Refresh visual: glassmorphism sobre o painel. Background e backdrop-filter
            // vem da util .app-glass; aqui reforcamos borda accent-cyan + glow externo
            // pra premium-feel. Mantemos box-shadow base do CSS via composicao.
            background: "var(--app-glass-bg)",
            backdropFilter: "blur(var(--app-glass-blur))",
            WebkitBackdropFilter: "blur(var(--app-glass-blur))",
            border: "1px solid var(--app-glass-border)",
            boxShadow: "var(--shadow-lg), 0 0 0 1px var(--accent-cyan-glow)",
          }}
        >
          <header className="ct-copilot-header">
            <div className="ct-copilot-title">
              {/*
                Refresh visual: dot ganha pulso cyan (drop-shadow) reforcando
                presenca "ativa" do copilot. Mantemos a classe original ct-copilot-dot
                pro fallback de cor positive/posicao — overlay cyan via inline.
              */}
              <span
                className="ct-copilot-dot"
                aria-hidden="true"
                style={{
                  background: "var(--accent-cyan)",
                  boxShadow: "0 0 8px var(--accent-cyan-glow), 0 0 0 4px var(--accent-cyan-glow)",
                }}
              />
              Copilot
            </div>
            <button
              type="button"
              className="ct-copilot-close"
              onClick={() => setOpen(false)}
              aria-label="Fechar copilot"
            >
              {/* 14px nao bate scale — proposital pro close compacto */}
              <Icon name="x" size={14} stroke={2} />
            </button>
          </header>

          <div className="ct-copilot-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <div className="ct-copilot-empty">
                <p className="ct-copilot-empty-title">
                  Oi! Sou seu Copilot de carreira.
                </p>
                <p className="ct-copilot-empty-sub">
                  Posso te ajudar com diagnostico, gaps, vagas, CV e entrevistas.
                  Tente uma sugestao:
                </p>
                <div className="ct-copilot-suggestions">
                  {getSuggestions().map((s, i) => (
                    <button
                      type="button"
                      key={i}
                      className="ct-copilot-suggestion"
                      onClick={() => send(s, true)}
                      disabled={busy}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={"ct-copilot-msg " + m.role}>
                <div className="ct-copilot-msg-bubble">{m.content}</div>
              </div>
            ))}
            {streaming && (
              <div className="ct-copilot-msg assistant streaming">
                <div className="ct-copilot-msg-bubble">{streaming}</div>
              </div>
            )}
            {busy && !streaming && (
              <div className="ct-copilot-msg assistant">
                <div className="ct-copilot-msg-bubble ct-copilot-typing" aria-label="Digitando">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          {err && (
            <div className="ct-copilot-err" role="status">
              {err}
            </div>
          )}

          <form
            className="ct-copilot-form"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte qualquer coisa..."
              disabled={busy}
              className="ct-copilot-input"
              maxLength={2000}
              aria-label="Mensagem pro copilot"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="ct-copilot-send"
              aria-label="Enviar mensagem"
            >
              <Icon name="send" size={18} stroke={2} />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
