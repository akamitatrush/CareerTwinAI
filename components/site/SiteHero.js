"use client";

// Hero — Cloudwalk noir + Apple BR editorial + Linear precisão.
// Quatro pecas:
//   1. H-display editorial duas linhas (clamp 64-160px) — accent cyan sólido (sem gradient).
//   2. SVG trajetória 880x440 com line-draw on mount (stroke-dashoffset, 2200ms) +
//      pontos de inflexão pulsando após o draw.
//   3. Mini-demo glassmorphism "Calculando diagnóstico…" abaixo do SVG, com sequência
//      typing-style, count-up no score, loop pausável em visibilitychange.
//   4. Single accent — magenta morto, tudo cyan (--site-accent) ou neutro (--site-fg).
//
// "Use client" porque temos animacoes orquestradas (line-draw, count-up, type-in),
// IntersectionObserver, e respeito a prefers-reduced-motion. Sem JS, ainda renderiza
// completo (graceful degradation) — texto estático aparece via aria-live polite + sr-only.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { WEIGHTS, SS_META } from "@/lib/score";

const PATH_LENGTH_FALLBACK = 1400;

// Aragorn v7 (2026-06-30) — DEMO sintetico que reflete a formula REAL.
// Substitui o modelo "ação → +N pontos" (gamificacao falsa estilo Duolingo)
// pelo modelo "4 sub-scores ponderados se montando" (vide lib/score.js:5-17).
// Cada `value` e ilustrativo mas plausivel; scoreNow/Next sao DERIVADOS no
// render via reduce — nao hardcoded. Se WEIGHTS mudar em lib/score.js, a UI
// segue automaticamente. Cada `cause` descreve um ESTADO observado (nao
// promete pontos por ação) — vide proposta §3.4 do aragorn-v7-proposal.md.
const DEMO = {
  personaFrom: "Analista de marketing",
  personaTo: "Gerente de marketing",
  stackNow: ["GA4", "SQL", "Looker"],
  stackTarget: ["+ SEO", "+ Branding"],
  subScoresNow: [
    { key: "aderencia_vagas",        value: 52 },
    { key: "relevancia_habilidades", value: 41 },
    { key: "otimizacao_perfil",      value: 60 },
    { key: "experiencia_mercado",    value: 38 },
  ],
  subScoresNext: [
    { key: "aderencia_vagas",        value: 68, cause: "+16 novas skills no pool" },
    { key: "relevancia_habilidades", value: 72, cause: "+31 evidências validadas" },
    { key: "otimizacao_perfil",      value: 85, cause: "+25 CV reescrito CAR/STAR" },
    { key: "experiencia_mercado",    value: 72, cause: "+34 1 cargo a mais" },
  ],
};

// Helper: deriva score (0..100) a partir dos sub-scores + WEIGHTS reais.
// Math identica ao lib/score.js::computeOverall — NUNCA hardcode.
function computeScore(subScores) {
  return Math.round(subScores.reduce((s, r) => s + r.value * (WEIGHTS[r.key] || 0), 0));
}

const SCORE_NOW = computeScore(DEMO.subScoresNow);     // = 47
const SCORE_NEXT = computeScore(DEMO.subScoresNext);   // = 73

// Tokens compartilhados — definidos uma vez pra reusar e baixar ruido visual no JSX.
const MONO_FAMILY = "'JetBrains Mono', ui-monospace, monospace";
const SANS_FAMILY = "'Plus Jakarta Sans', system-ui, sans-serif";
const GRAIN_SVG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' " +
  "width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' " +
  "numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)' " +
  "opacity='0.7'/></svg>\")";

// Estilos estaticos do hero — declarados fora do componente porque nao mudam em
// runtime, evitando recriacao a cada render. JSX abaixo so referencia.
const S = {
  section: {
    position: "relative",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "160px 24px 80px",
    overflow: "hidden",
  },
  mesh: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(at 30% 20%, var(--site-mesh-cyan), transparent 50%), " +
      "radial-gradient(at 80% 60%, var(--site-mesh-cyan), transparent 60%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  grain: {
    position: "absolute",
    inset: 0,
    opacity: 0.04,
    mixBlendMode: "overlay",
    backgroundImage: GRAIN_SVG,
    pointerEvents: "none",
    zIndex: 0,
  },
  inner: { position: "relative", zIndex: 2, maxWidth: 1100, width: "100%" },
  eyebrow: {
    fontFamily: MONO_FAMILY,
    textTransform: "uppercase",
    letterSpacing: "0.18em",
    fontSize: 11,
    color: "var(--site-fg-muted)",
    margin: "0 0 28px 0",
    willChange: "transform",
  },
  eyebrowDot: {
    display: "inline-block",
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "var(--site-accent)",
    marginRight: 10,
    verticalAlign: "middle",
    boxShadow: "0 0 12px var(--site-accent-glow)",
  },
  h1: {
    fontFamily: SANS_FAMILY,
    fontSize: "clamp(48px, 9.5vw, 144px)",
    lineHeight: 0.95,
    letterSpacing: "-0.035em",
    fontWeight: 700,
    color: "var(--site-fg)",
    margin: "0 auto 32px",
    maxWidth: "16ch",
    willChange: "transform",
  },
  body: {
    fontSize: "clamp(17px, 1.6vw, 22px)",
    lineHeight: 1.5,
    color: "var(--site-fg-muted)",
    maxWidth: 720,
    margin: "0 auto 48px",
    fontWeight: 400,
  },
  ctaRow: {
    display: "flex",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
    marginBottom: 60,
  },
  ctaPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "16px 28px",
    borderRadius: 999,
    background: "var(--site-accent)",
    color: "var(--site-bg)",
    fontWeight: 600,
    fontSize: 15,
    textDecoration: "none",
    border: "1px solid var(--site-accent)",
    boxShadow: "0 0 40px var(--site-accent-glow)",
    transition: "transform 200ms ease, box-shadow 200ms ease",
  },
  ctaSecondary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "16px 28px",
    borderRadius: 999,
    background: "var(--site-card-bg)",
    color: "var(--site-fg)",
    fontWeight: 500,
    fontSize: 15,
    textDecoration: "none",
    border: "1px solid var(--site-border-strong)",
  },
  svgWrap: { maxWidth: 880, margin: "0 auto 56px", opacity: 0.95 },
  demo: {
    maxWidth: 560,
    width: "100%",
    margin: "0 auto",
    padding: "24px 28px",
    borderRadius: 18,
    background: "var(--site-card-bg, rgba(20, 22, 28, 0.55))",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid var(--site-border, rgba(255,255,255,0.08))",
    boxShadow:
      "0 30px 80px -40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
    textAlign: "left",
    fontFamily: SANS_FAMILY,
  },
  demoHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
  },
  demoStatus: {
    fontFamily: MONO_FAMILY,
    fontSize: 12,
    letterSpacing: "0.04em",
    color: "var(--site-fg-muted)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  progressTrack: {
    width: 96,
    height: 4,
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    flexShrink: 0,
  },
  label: {
    fontFamily: MONO_FAMILY,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--site-fg-muted)",
  },
  divider: {
    height: 1,
    background:
      "linear-gradient(90deg, transparent, var(--site-border, rgba(255,255,255,0.10)), transparent)",
    margin: "0 0 16px",
  },
  scrollCue: {
    position: "absolute",
    bottom: 32,
    left: "50%",
    transform: "translateX(-50%)",
    color: "var(--site-fg-dim)",
    fontSize: 11,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    fontFamily: MONO_FAMILY,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    zIndex: 2,
  },
  // Aragorn v7 — tokens da tabela de sub-scores
  subScoresLabel: {
    fontFamily: MONO_FAMILY,
    fontSize: 10.5,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--site-fg-muted)",
    marginBottom: 10,
  },
  weightTag: {
    fontFamily: MONO_FAMILY,
    fontSize: 10.5,
    letterSpacing: "0.06em",
    color: "var(--site-fg-muted)",
    padding: "2px 7px",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 4,
  },
  subScoreVal: {
    fontFamily: MONO_FAMILY,
    fontSize: 14,
    fontWeight: 500,
    color: "var(--site-fg)",
    letterSpacing: "-0.01em",
    minWidth: 56,
    textAlign: "right",
  },
  causeTag: {
    fontFamily: MONO_FAMILY,
    fontSize: 10.5,
    color: "var(--site-fg-muted)",
    opacity: 0.7,
    marginLeft: 6,
  },
  demoFooter: {
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px dashed rgba(255,255,255,0.06)",
    fontFamily: MONO_FAMILY,
    fontSize: 11,
    color: "var(--site-fg-muted)",
    letterSpacing: "0.02em",
    lineHeight: 1.5,
  },
  demoFooterLink: {
    color: "var(--site-fg)",
    textDecoration: "underline",
    textUnderlineOffset: 2,
    textDecorationColor: "var(--site-accent)",
  },
  srOnly: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0,
  },
};

export default function SiteHero() {
  const containerRef = useRef(null);
  const pathRef = useRef(null);
  const ghostRef = useRef(null);
  const demoRef = useRef(null);

  const [step, setStep] = useState(0);
  const [scoreNow, setScoreNow] = useState(0);
  const [scoreNext, setScoreNext] = useState(0);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("Calculando diagnóstico…");
  const [reduceMotion, setReduceMotion] = useState(false);

  // Fade-up + parallax + line-draw mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setReduceMotion(reduce);

    const els = containerRef.current?.querySelectorAll("[data-fade]") || [];
    const parallaxEls = containerRef.current?.querySelectorAll("[data-parallax]") || [];

    if (reduce) {
      els.forEach((el) => { el.style.opacity = "1"; el.style.transform = "none"; });
      if (pathRef.current) { pathRef.current.style.strokeDasharray = "none"; pathRef.current.style.strokeDashoffset = "0"; }
      if (ghostRef.current) { ghostRef.current.style.opacity = "1"; }
      return;
    }

    els.forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(16px)";
      el.style.transition = "opacity 700ms ease, transform 700ms ease";
      setTimeout(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; }, 90 * i + 80);
    });

    // Line-draw: stroke-dashoffset anima de len → 0 ao longo de 2200ms.
    if (pathRef.current) {
      const len = pathRef.current.getTotalLength?.() || PATH_LENGTH_FALLBACK;
      pathRef.current.style.strokeDasharray = `${len}`;
      pathRef.current.style.strokeDashoffset = `${len}`;
      pathRef.current.style.transition = "stroke-dashoffset 2200ms cubic-bezier(0.22, 1, 0.36, 1)";
      requestAnimationFrame(() => { if (pathRef.current) pathRef.current.style.strokeDashoffset = "0"; });
    }
    if (ghostRef.current) {
      ghostRef.current.style.opacity = "0";
      ghostRef.current.style.transition = "opacity 1400ms ease 600ms";
      requestAnimationFrame(() => { if (ghostRef.current) ghostRef.current.style.opacity = "1"; });
    }

    // Parallax sutil — RAF pra evitar layout thrash.
    let rafId = null;
    let lastY = 0;
    const onScroll = () => {
      lastY = window.scrollY;
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const vh = window.innerHeight || 800;
        if (lastY > vh) return;
        parallaxEls.forEach((el) => {
          const factor = Number(el.dataset.parallax || 0.1);
          el.style.transform = `translate3d(0, ${lastY * factor * -1}px, 0)`;
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (rafId !== null) cancelAnimationFrame(rafId); };
  }, []);

  // Mini-demo loop. Pausa quando aba escondida. prefers-reduced-motion mostra estado final.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (reduceMotion) {
      setStep(9); setScoreNow(SCORE_NOW); setScoreNext(SCORE_NEXT);
      setProgress(100); setStatusLabel("Diagnóstico completo · 4 dimensões ponderadas");
      return;
    }

    let timers = [];
    let countTimers = [];
    let loopTimer = null;
    let stopped = false;

    const clearAll = () => {
      timers.forEach((t) => clearTimeout(t));
      countTimers.forEach((t) => clearTimeout(t));
      timers = []; countTimers = [];
      if (loopTimer) clearTimeout(loopTimer);
      loopTimer = null;
    };

    const countUp = (from, to, durationMs, setter) => {
      const startTime = performance.now();
      const tick = () => {
        if (stopped) return;
        const t = Math.min(1, (performance.now() - startTime) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setter(Math.round(from + (to - from) * eased));
        if (t < 1) countTimers.push(setTimeout(tick, 16));
      };
      tick();
    };

    const animateProgress = (from, to, durationMs) => {
      const startTime = performance.now();
      const tick = () => {
        if (stopped) return;
        const t = Math.min(1, (performance.now() - startTime) / durationMs);
        setProgress(Math.round(from + (to - from) * t));
        if (t < 1) countTimers.push(setTimeout(tick, 30));
      };
      tick();
    };

    const runSequence = () => {
      setStep(0); setScoreNow(0); setScoreNext(0); setProgress(0);
      setStatusLabel("Calculando diagnóstico…");

      animateProgress(0, 35, 1100);
      timers.push(setTimeout(() => animateProgress(35, 65, 900), 1200));
      timers.push(setTimeout(() => animateProgress(65, 92, 1100), 2200));

      // Steps: 1=persona, 2=stacks, 3-6=4 sub-scores agora (1 por step),
      // 7=score atual count-up, 8=4 sub-scores projetados (revealed juntos),
      // 9=score projetado count-up + status final.
      timers.push(setTimeout(() => setStep(1), 0));
      timers.push(setTimeout(() => setStep(2), 400));
      timers.push(setTimeout(() => setStep(3), 800));    // sub-score 1
      timers.push(setTimeout(() => setStep(4), 1100));   // sub-score 2
      timers.push(setTimeout(() => setStep(5), 1400));   // sub-score 3
      timers.push(setTimeout(() => setStep(6), 1700));   // sub-score 4
      timers.push(setTimeout(() => { setStep(7); countUp(0, SCORE_NOW, 700, setScoreNow); }, 2100));
      timers.push(setTimeout(() => setStep(8), 3000));   // reveal sub-scores projetados
      timers.push(setTimeout(() => { setStep(9); countUp(SCORE_NOW, SCORE_NEXT, 900, setScoreNext); animateProgress(92, 100, 500); setStatusLabel("Diagnóstico completo · 4 dimensões ponderadas"); }, 3700));

      loopTimer = setTimeout(() => {
        if (!stopped && document.visibilityState === "visible") runSequence();
      }, 9000);
    };

    let started = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !started) { started = true; runSequence(); }
      });
    }, { threshold: 0.2 });
    if (demoRef.current) observer.observe(demoRef.current);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") { clearAll(); stopped = true; }
      else if (started) { stopped = false; runSequence(); }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true; clearAll();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reduceMotion]);

  const delta = scoreNext > DEMO.scoreNow ? scoreNext - DEMO.scoreNow : 0;

  return (
    <section ref={containerRef} style={S.section}>
      <div aria-hidden="true" style={S.mesh} />
      <div aria-hidden="true" style={S.grain} />

      <div style={S.inner}>
        <p className="site-eyebrow" data-fade data-parallax="0.06" style={S.eyebrow}>
          <span style={S.eyebrowDot} />
          BRASIL · SEM CAIXA-PRETA
        </p>

        <h1 className="site-h-display" data-fade data-parallax="0.1" style={S.h1}>
          <span style={{ display: "block" }}>Pare de mandar CV genérico.</span>
          <span style={{ display: "block" }}>
            Sua carreira sem{" "}
            <span style={{ color: "var(--site-accent)", display: "inline-block" }}>caixa-preta</span>
            .
          </span>
        </h1>

        <p className="site-body-lg" data-fade style={S.body}>
          Diagnóstico auditável, vagas reais e microações com fonte rastreável.
          Tudo em português, sem alucinação.
        </p>

        <div data-fade style={S.ctaRow}>
          <Link href="/experimentar" className="site-btn-primary" style={S.ctaPrimary}>
            Começar diagnóstico
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <a href="#como-funciona" className="site-btn-secondary" style={S.ctaSecondary}>
            Ver como funciona
          </a>
        </div>

        {/* SVG trajetória — protagonista. 880x440 com line-draw on mount + pontos pulsando. */}
        <div data-fade aria-hidden="true" style={S.svgWrap}>
          <svg viewBox="0 0 880 440" width="100%" height="auto" role="presentation">
            <defs>
              <linearGradient id="ctTraj" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--site-accent)" stopOpacity="0" />
                <stop offset="18%" stopColor="var(--site-accent)" stopOpacity="0.9" />
                <stop offset="55%" stopColor="var(--site-fg)" stopOpacity="0.85" />
                <stop offset="88%" stopColor="var(--site-accent)" stopOpacity="0.95" />
                <stop offset="100%" stopColor="var(--site-accent)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ctBaseline" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--site-fg)" stopOpacity="0" />
                <stop offset="50%" stopColor="var(--site-fg)" stopOpacity="0.10" />
                <stop offset="100%" stopColor="var(--site-fg)" stopOpacity="0" />
              </linearGradient>
              <radialGradient id="ctPulse" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--site-accent)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="var(--site-accent)" stopOpacity="0" />
              </radialGradient>
            </defs>

            <line x1="0" y1="320" x2="880" y2="320" stroke="url(#ctBaseline)" strokeWidth="1" strokeDasharray="2 6" />

            {/* trajetoria principal — ascendente dramatica em 440px */}
            <path ref={pathRef}
              d="M 20 380 C 140 340, 220 300, 320 230 S 540 100, 680 130 S 820 70, 860 50"
              stroke="url(#ctTraj)" strokeWidth="2.4" fill="none" strokeLinecap="round" />

            {/* trajetoria fantasma — "voce hoje" */}
            <path ref={ghostRef}
              d="M 20 380 C 140 378, 220 370, 320 358 S 540 332, 680 320 S 820 308, 860 302"
              stroke="var(--site-border-strong)" strokeWidth="1" strokeDasharray="3 4" fill="none" />

            {/* pontos de inflexao — pulso radial sutil apos draw terminar */}
            {[
              { x: 20, y: 380, c: "var(--site-accent)", d: 0 },
              { x: 320, y: 230, c: "var(--site-fg)", d: 0.4 },
              { x: 540, y: 110, c: "var(--site-fg)", d: 0.8 },
              { x: 680, y: 130, c: "var(--site-fg)", d: 1.2 },
              { x: 860, y: 50, c: "var(--site-accent)", d: 1.6 },
            ].map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="18" fill="url(#ctPulse)"
                  style={{ animation: `siteHeroPulse 2s ease-out ${2200 + p.d * 200}ms infinite`, transformOrigin: `${p.x}px ${p.y}px` }} />
                <circle cx={p.x} cy={p.y} r="10" fill={p.c} opacity="0.16" />
                <circle cx={p.x} cy={p.y} r="4.5" fill={p.c} />
              </g>
            ))}
          </svg>
        </div>

        {/* Mini-demo "Score sendo calculado" — peça central, glassmorphism.
            Dados sinteticos APENAS — nenhuma API chamada. Loop pausável. */}
        <div ref={demoRef} data-fade role="region"
          aria-label="Demonstração do cálculo do score CareerTwin"
          className="site-hero-demo" style={S.demo}>

          {/* Status + progress */}
          <div style={S.demoHead}>
            <div aria-live="polite" style={S.demoStatus}>
              <span aria-hidden="true" style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: step >= 9 ? "var(--site-accent)" : "var(--site-fg-muted)", boxShadow: step >= 9 ? "0 0 10px var(--site-accent-glow)" : "none", transition: "background 400ms ease, box-shadow 400ms ease", flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {step >= 9 ? "✓ " : ""}{statusLabel}
              </span>
            </div>
            <div style={S.progressTrack}>
              <div style={{ width: `${progress}%`, height: "100%", background: "var(--site-accent)", boxShadow: "0 0 12px var(--site-accent-glow)", transition: "width 300ms ease" }} />
            </div>
          </div>

          {/* Persona */}
          <div style={{ opacity: step >= 2 ? 1 : 0, transform: step >= 2 ? "translateY(0)" : "translateY(6px)", transition: "opacity 400ms ease, transform 400ms ease", marginBottom: 14, fontSize: 14, color: "var(--site-fg)", lineHeight: 1.5 }}>
            <span style={{ ...S.label, marginRight: 10 }}>Persona</span>
            {DEMO.personaFrom}{" "}
            <span style={{ color: "var(--site-fg-muted)" }}>→</span>{" "}
            <span style={{ color: "var(--site-accent)" }}>{DEMO.personaTo}</span>
          </div>

          {/* Stacks */}
          <div style={{ opacity: step >= 3 ? 1 : 0, transform: step >= 3 ? "translateY(0)" : "translateY(6px)", transition: "opacity 400ms ease, transform 400ms ease", marginBottom: 18, display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", alignItems: "center", fontSize: 13 }}>
            <span style={S.label}>Stack atual</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DEMO.stackNow.map((s) => (<span key={s} style={chipStyle()}>{s}</span>))}
            </div>
            <span style={S.label}>Stack-alvo</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DEMO.stackTarget.map((s) => (<span key={s} style={chipStyle(true)}>{s}</span>))}
            </div>
          </div>

          <div style={S.divider} />

          {/* Sub-scores AGORA — 4 dimensoes aparecem 1 a 1 (steps 3-6). */}
          <div style={S.subScoresLabel} aria-hidden="true">Os 4 sub-scores (mesma fórmula em /transparencia)</div>
          <div role="table" aria-label="Sub-scores que compõem o diagnóstico atual" style={{ marginBottom: 14 }}>
            {DEMO.subScoresNow.map((r, i) => {
              const meta = SS_META[r.key] || { label: r.key, w: `${Math.round((WEIGHTS[r.key] || 0) * 100)}%` };
              return (
                <div key={r.key} role="row" style={{ opacity: step >= 3 + i ? 1 : 0, transform: step >= 3 + i ? "translateX(0)" : "translateX(-6px)", transition: "opacity 360ms ease, transform 360ms ease", display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "baseline", padding: "5px 0", fontSize: 13, color: "var(--site-fg)", borderBottom: i < DEMO.subScoresNow.length - 1 ? "1px dashed rgba(255,255,255,0.06)" : "none" }}>
                  <span>{meta.label}</span>
                  <span style={S.weightTag}>peso {meta.w}</span>
                  <span style={S.subScoreVal}>{r.value}<span style={{ color: "var(--site-fg-muted)", fontSize: "0.7em" }}>/100</span></span>
                </div>
              );
            })}
          </div>

          {/* Score atual = soma ponderada (count-up no step 7) */}
          <div style={{ opacity: step >= 7 ? 1 : 0, transform: step >= 7 ? "translateY(0)" : "translateY(6px)", transition: "opacity 400ms ease, transform 400ms ease", display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
            <span style={{ ...S.label, letterSpacing: "0.14em" }}>Score atual</span>
            <span aria-live="polite" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "clamp(32px, 5vw, 40px)", lineHeight: 1, fontWeight: 500, color: "var(--site-fg)", letterSpacing: "-0.02em" }}>
              {scoreNow}<span style={{ color: "var(--site-fg-muted)", fontSize: "0.55em" }}>/100</span>
            </span>
          </div>

          <div style={S.divider} />

          {/* Separador editorial — "Em 60 dias, mantendo o roadmap →" */}
          <div style={{ ...S.subScoresLabel, opacity: step >= 8 ? 1 : 0, transition: "opacity 400ms ease" }} aria-hidden="true">
            Em 60 dias, mantendo o roadmap →
          </div>

          {/* Sub-scores PROJETADOS — revealed juntos no step 8, cause inline. */}
          <div role="table" aria-label="Sub-scores projetados em 60 dias" style={{ opacity: step >= 8 ? 1 : 0, transform: step >= 8 ? "translateY(0)" : "translateY(6px)", transition: "opacity 500ms ease, transform 500ms ease", marginBottom: 14 }}>
            {DEMO.subScoresNext.map((r, i) => {
              const meta = SS_META[r.key] || { label: r.key, w: `${Math.round((WEIGHTS[r.key] || 0) * 100)}%` };
              return (
                <div key={r.key} role="row" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "baseline", padding: "5px 0", fontSize: 13, color: "var(--site-fg)", borderBottom: i < DEMO.subScoresNext.length - 1 ? "1px dashed rgba(255,255,255,0.06)" : "none" }}>
                  <span>
                    {meta.label}
                    <span style={S.causeTag}> · {r.cause}</span>
                  </span>
                  <span style={S.weightTag}>peso {meta.w}</span>
                  <span style={S.subScoreVal}>{r.value}<span style={{ color: "var(--site-fg-muted)", fontSize: "0.7em" }}>/100</span></span>
                </div>
              );
            })}
          </div>

          {/* Score projetado (count-up no step 9) */}
          <div style={{ opacity: step >= 9 ? 1 : 0, transform: step >= 9 ? "translateY(0)" : "translateY(6px)", transition: "opacity 400ms ease, transform 400ms ease", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ ...S.label, letterSpacing: "0.14em" }}>Score projetado</span>
            <span aria-live="polite" style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: "clamp(40px, 6vw, 56px)", lineHeight: 1, fontWeight: 600, color: "var(--site-fg)", letterSpacing: "-0.025em" }}>
              {scoreNext}<span style={{ color: "var(--site-fg-muted)", fontSize: "0.45em" }}>/100</span>
            </span>
          </div>

          {/* Microcopy de rodapé — disclaimer + link auditavel pra /transparencia. */}
          <div style={S.demoFooter}>
            Demo ilustrativa · números sintéticos · <Link href="/transparencia" style={S.demoFooterLink}>fórmula real em /transparencia</Link>
          </div>

          {/* Descrição estática pra screen readers — espelha SS_META + WEIGHTS reais. */}
          <span style={S.srOnly}>
            CareerTwin calcula o score com 4 sub-scores ponderados — Aderência a vagas
            (peso 40%), Relevância das habilidades (peso 30%), Otimização do perfil
            (peso 20%) e Experiência de mercado (peso 10%). Persona ilustrativa
            Analista de marketing rumo a Gerente de marketing começa em {SCORE_NOW} de 100
            e projeta {SCORE_NEXT} de 100 após 60 dias mantendo o roadmap. Fórmula completa
            documentada em transparência.
          </span>
        </div>
      </div>

      {/* Scroll cue */}
      <div aria-hidden="true" style={S.scrollCue}>
        <span>scroll</span>
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "siteHeroChevron 1.6s ease-in-out infinite" }}>
          <path d="M7 2v14M2 11l5 5 5-5" />
        </svg>
        <style>{`
          @keyframes siteHeroChevron {
            0%, 100% { transform: translateY(0); opacity: 0.7; }
            50% { transform: translateY(4px); opacity: 1; }
          }
          @keyframes siteHeroPulse {
            0%   { transform: scale(0.7); opacity: 0; }
            30%  { opacity: 0.7; }
            100% { transform: scale(1.6); opacity: 0; }
          }
          .site-hero-demo { transform-origin: center top; }
          @media (max-width: 640px) {
            .site-hero-demo { padding: 18px 18px !important; width: calc(100% - 48px) !important; }
          }
          @media (prefers-reduced-motion: reduce) {
            [style*="siteHeroChevron"] { animation: none !important; }
            [style*="siteHeroPulse"] { animation: none !important; }
          }
        `}</style>
      </div>
    </section>
  );
}

// chip pra stack tags — neutro pro atual, accent pra alvo.
function chipStyle(isAccent = false) {
  return {
    display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 6,
    fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, letterSpacing: "0.02em",
    background: isAccent ? "rgba(0, 217, 232, 0.10)" : "rgba(255,255,255,0.04)",
    border: isAccent ? "1px solid var(--site-accent)" : "1px solid var(--site-border, rgba(255,255,255,0.10))",
    color: isAccent ? "var(--site-accent)" : "var(--site-fg)",
  };
}
