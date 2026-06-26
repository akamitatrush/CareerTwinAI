"use client";

// Onboarding conversacional — alternativa ao "Cole o CV". Faz 6 perguntas
// sequenciais (sem LLM, sem custo) e monta um CV estruturado em texto plano
// pra alimentar o /api/analyze existente. UX:
//  - barra de progresso + contador "X de N"
//  - autofocus a cada step (boa pro fluxo de teclado)
//  - Enter avança em campos curtos; textarea precisa do botao (multi-linha)
//  - "Voltar" recupera a resposta anterior pra permitir edicao
//  - "Concluir" no ultimo step monta o CV e devolve via onComplete
//
// Por que template fixo em vez de LLM: zero custo de inferencia + previsivel
// pro user + nao trava em rate limit. LLM pode entrar depois pra polish.

import { useState, useRef, useEffect } from "react";
import { track } from "@/components/PostHogProvider";
import { EVENTS } from "@/lib/analytics/events";
import { QUESTIONS, buildCv } from "@/components/OnboardingChat.logic";

// Re-export pra manter compat com call sites que importavam direto daqui.
export { QUESTIONS, buildCv };

export default function OnboardingChat({ onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [current, setCurrent] = useState("");
  const inputRef = useRef(null);
  // startedRef garante que ONBOARDING_CHAT_STARTED dispara so uma vez
  // por sessao do componente (vs a cada re-render). useRef pq nao
  // precisa rerender quando muda.
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      track(EVENTS.ONBOARDING_CHAT_STARTED, { total_questions: QUESTIONS.length });
      startedRef.current = true;
    }
  }, []);

  // Foca o input toda vez que muda de step. Sem isso o user precisaria
  // clicar pra continuar — quebra o fluxo de teclado puro.
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const question = QUESTIONS[step];

  function submitAnswer() {
    if (question.required && !current.trim()) return;
    const newAnswers = { ...answers, [question.id]: current.trim() };
    setAnswers(newAnswers);
    setCurrent("");
    if (step + 1 >= QUESTIONS.length) {
      const cv = buildCv(newAnswers);
      // Trackeia conclusao com contagens (NAO o conteudo cru — sem PII).
      track(EVENTS.ONBOARDING_CHAT_COMPLETED, {
        answered_count: Object.keys(newAnswers).filter((k) => newAnswers[k]).length,
        cv_chars: cv.length,
      });
      onComplete(cv);
    } else {
      setStep(step + 1);
    }
  }

  function goBack() {
    if (step === 0) return;
    const prevStep = step - 1;
    const prevId = QUESTIONS[prevStep].id;
    setStep(prevStep);
    setCurrent(answers[prevId] || "");
  }

  const isLast = step + 1 >= QUESTIONS.length;
  const progressPct = ((step + 1) / QUESTIONS.length) * 100;

  return (
    <div className="ct-onb-chat" role="form" aria-label="Onboarding conversacional">
      <div className="ct-onb-chat-progress" aria-live="polite">
        Pergunta {step + 1} de {QUESTIONS.length}
        <div
          className="ct-onb-chat-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={QUESTIONS.length}
          aria-valuenow={step + 1}
        >
          <div style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="ct-onb-chat-question">
        <p id={`onb-q-${question.id}`}>{question.text}</p>
      </div>

      {question.inputType === "textarea" ? (
        <textarea
          ref={inputRef}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder={question.placeholder}
          rows={4}
          className="ct-onb-chat-input"
          maxLength={1500}
          aria-labelledby={`onb-q-${question.id}`}
          aria-required={question.required}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder={question.placeholder}
          className="ct-onb-chat-input"
          maxLength={400}
          aria-labelledby={`onb-q-${question.id}`}
          aria-required={question.required}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitAnswer();
            }
          }}
        />
      )}

      <div className="ct-onb-chat-actions">
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="ct-onb-chat-back"
          >
            ← Voltar
          </button>
        )}
        <button
          type="button"
          onClick={submitAnswer}
          disabled={question.required && !current.trim()}
          className="btn btn-primary ct-onb-chat-next"
        >
          {isLast ? "Concluir" : "Próximo →"}
        </button>
      </div>
    </div>
  );
}
