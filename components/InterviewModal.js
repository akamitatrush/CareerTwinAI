import { useState, useEffect, useCallback } from "react";
import Modal from "./Modal";
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";

export default function InterviewModal({ role, gaps, onClose }) {
  const [q, setQ] = useState(null);
  const [answer, setAnswer] = useState("");
  const [evalResult, setEvalResult] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadingE, setLoadingE] = useState(false);
  const [asked, setAsked] = useState([]);
  const [err, setErr] = useState("");

  const nextQuestion = useCallback(async () => {
    setLoadingQ(true);
    setErr("");
    setEvalResult(null);
    setAnswer("");
    try {
      const r = await fetch("/api/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "question", role, gaps, asked }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao gerar pergunta.");
      setQ(d);
      setAsked((a) => [...a, d.pergunta]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingQ(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, gaps, asked]);

  useEffect(() => {
    track(EVENTS.INTERVIEW_STARTED, {
      gaps_count: Array.isArray(gaps) ? gaps.length : 0,
    });
    nextQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function evaluate() {
    if (answer.trim().length < 10) {
      setErr("Escreva uma resposta um pouco mais completa para avaliar.");
      return;
    }
    setLoadingE(true);
    setErr("");
    try {
      const r = await fetch("/api/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "evaluate", role, pergunta: q.pergunta, resposta: answer }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Falha ao avaliar.");
      setEvalResult(d);
      track(EVENTS.INTERVIEW_COMPLETED, {
        nota: Number(d?.nota) || 0,
        metodo: String(d?.metodo || ""),
      });
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoadingE(false);
    }
  }

  return (
    <Modal title="Simulador de entrevista" subtitle="Responda como numa entrevista real. A IA avalia pela estrutura STAR / CAR." onClose={onClose} wide>
      {loadingQ && <div className="iv-loading">Gerando pergunta…</div>}

      {q && !loadingQ && (
        <>
          <div className="iv-question">
            <span className="iv-qtag">{q.tipo}</span>
            <p className="iv-qtext">{q.pergunta}</p>
            {q.dica && <p className="iv-hint">Dica: {q.dica}</p>}
          </div>

          <textarea
            className="iv-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Conte sua experiência: situação, o que você fez e o resultado…"
          />

          <div className="iv-actions">
            <button className="btn btn-primary" onClick={evaluate} disabled={loadingE}>
              {loadingE ? "Avaliando…" : "Avaliar resposta"}
            </button>
            <button className="btn btn-ghost" onClick={nextQuestion} disabled={loadingQ}>
              Próxima pergunta →
            </button>
          </div>
        </>
      )}

      {err && <div className="err" style={{ marginTop: 14 }}>{err}</div>}

      {evalResult && (
        <div className="iv-eval">
          <div className="iv-eval-head">
            <span className="iv-method">Método {evalResult.metodo}</span>
            <span className="iv-nota">{evalResult.nota}<small>/100</small></span>
          </div>
          <div className="iv-cols">
            <div>
              <span className="iv-collbl good">Presentes</span>
              <div className="iv-chips">{(evalResult.presentes || []).map((x, i) => <span className="iv-chip good" key={i}>{x}</span>)}</div>
            </div>
            <div>
              <span className="iv-collbl bad">Faltando</span>
              <div className="iv-chips">{(evalResult.faltando || []).map((x, i) => <span className="iv-chip bad" key={i}>{x}</span>)}</div>
            </div>
          </div>
          <p className="iv-feedback">{evalResult.feedback}</p>
          {evalResult.versao_sugerida && (
            <div className="iv-suggest">
              <span className="iv-collbl">Versão mais forte</span>
              <p>{evalResult.versao_sugerida}</p>
            </div>
          )}
          {evalResult.alerta_autenticidade && (
            <div className="iv-auth">⚠ {evalResult.alerta_autenticidade}</div>
          )}
        </div>
      )}
    </Modal>
  );
}
