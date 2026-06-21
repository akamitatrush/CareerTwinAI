import { useState, useRef, useEffect } from "react";
import Modal from "./Modal";

const STARTERS = [
  "Como explico minha transição de carreira numa entrevista?",
  "Qual lacuna devo priorizar primeiro?",
  "Como deixo meu LinkedIn mais alinhado ao cargo-alvo?",
];

export default function ChatModal({ role, perfil, gaps, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setErr("");
    setInput("");
    const history = messages;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, perfil, gaps, history, message: content }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha no chat.");
      setMessages((m) => [...m, { role: "assistant", content: d.resposta || "" }]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Converse com seu gêmeo" subtitle="Pergunte sobre sua carreira — as respostas saem do seu perfil." onClose={onClose} wide>
      <div className="chat-area">
        {messages.length === 0 && (
          <div className="chat-empty">
            <p>Por onde quer começar?</p>
            <div className="chat-starters">
              {STARTERS.map((s, i) => (
                <button className="chat-starter" key={i} onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div className={"bubble " + m.role} key={i}>{m.content}</div>
        ))}
        {loading && <div className="bubble assistant typing">digitando…</div>}
        <div ref={endRef} />
      </div>

      {err && <div className="err" style={{ marginBottom: 10 }}>{err}</div>}

      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Escreva sua pergunta…"
        />
        <button className="btn btn-primary" onClick={() => send()} disabled={loading}>Enviar</button>
      </div>
    </Modal>
  );
}
