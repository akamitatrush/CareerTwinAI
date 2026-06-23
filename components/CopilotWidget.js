"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";

// Widget flutuante "Career Copilot" sempre visivel pra users logados.
// FAB bottom-right que abre drawer/sidebar a direita (sticky).
//
// Renderizado a partir do AppShell, que ja eh server-side gated por auth() —
// nao vaza pra public pages (login, /entrar, marketing).
//
// Streaming: por enquanto request/response (deferred). O endpoint /api/chat
// hoje devolve JSON via completeJSON; SSE exigiria mudar provider stack.
// State management: localStorage com janela rolante (ultimas 20 msgs) pra
// nao explodir tamanho. Historico vai pra LLM com cap em 10 msgs * 4k chars
// (ChatBody.history.max = 30, content.max = 4000).
//
// LGPD: salvamos historico em localStorage do proprio user — nunca vai pro
// servidor exceto via /api/chat, que ja eh ownership-checked por sessao.

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // /api/chat valida via ChatBody: role + message + history
          role: targetRole,
          history,
          message: userMsg,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.error || `Falha (HTTP ${res.status}). Tente de novo.`;
        throw new Error(msg);
      }
      // /api/chat devolve { resposta } (campo PT-BR canonico). Fallback a
      // message/text por seguranca caso a rota mude no futuro.
      const assistantText =
        data.resposta || data.message || data.text || "Sem resposta.";
      setMessages((m) => [...m, { role: "assistant", content: assistantText }]);
      track(EVENTS.COPILOT_MESSAGE_RECEIVED, {
        len: assistantText.length,
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
        className={"ct-copilot-fab" + (open ? " open" : "")}
        onClick={handleToggle}
        aria-label={open ? "Fechar copilot" : "Abrir copilot"}
        aria-expanded={open}
        aria-controls="ct-copilot-panel"
      >
        {open ? (
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <aside
          id="ct-copilot-panel"
          className="ct-copilot-panel"
          role="dialog"
          aria-label="Career Copilot"
          aria-modal="false"
        >
          <header className="ct-copilot-header">
            <div className="ct-copilot-title">
              <span className="ct-copilot-dot" aria-hidden="true" />
              Copilot
            </div>
            <button
              type="button"
              className="ct-copilot-close"
              onClick={() => setOpen(false)}
              aria-label="Fechar copilot"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
              </svg>
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
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden="true"
              >
                <path
                  d="M5 12l7-7 7 7M12 5v14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
