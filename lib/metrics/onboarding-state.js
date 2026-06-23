// lib/metrics/onboarding-state.js
// Calcula state do onboarding — quais fontes o user conectou.
//
// Diferente de completeness.js (que pontua a riqueza do perfil), aqui o objetivo
// é só responder "quantas das 3 fontes mínimas (CV, LinkedIn, GitHub) o user já
// trouxe?" — é o contador X/3 que aparece no painel direito da home.
//
// Regras pragmáticas:
//   - CV conta quando `rawCv` tem >= 60 chars (mesmo limiar usado no submit da home).
//   - LinkedIn conta com `linkedinJson` (import OAuth) OU `linkedinRaw` (>=60 chars,
//     paste manual já parseado em algum momento).
//   - GitHub conta com `githubUser` (handle) OU `portfolioJson` (import já feito).
//   - `hasTarget` é tracked à parte porque "cargo-alvo" é a ETAPA 2, não fonte.
export function computeOnboardingState(profile) {
  if (!profile) {
    return {
      sources: {
        cv: false,
        linkedin: false,
        github: false,
      },
      connectedCount: 0,
      total: 3,
      complete: false,
      hasTarget: false,
    };
  }

  const cv = !!(profile.rawCv && profile.rawCv.length >= 60);
  const linkedin = !!(
    profile.linkedinJson ||
    (profile.linkedinRaw && profile.linkedinRaw.length >= 60)
  );
  const github = !!(profile.githubUser || profile.portfolioJson);

  const sources = { cv, linkedin, github };
  const connectedCount = [cv, linkedin, github].filter(Boolean).length;
  const hasTarget = !!profile.targetRole;

  return {
    sources,
    connectedCount,
    total: 3,
    complete: connectedCount === 3,
    hasTarget,
  };
}
