# Wave 9 — Síntese da Auditoria UX/UI/Design (7 anéis paralelos)

**Data:** 2026-06-25
**Anéis:** Galadriel · Lúthien · Elrond · Éowyn · Faramir · Arwen · Gwaihir
**Total:** ~2.600 linhas de findings em 7 docs · 200+ findings priorizados

Este doc cruza os 7 audits e prioriza **fixes onde 2+ anéis convergem** + **achados únicos críticos**.

---

## TL;DR — O diagnóstico em 1 parágrafo

A **tese do CareerTwin está 80% no código, mas só 55% nos pixels** (Gwaihir). Infra dos 4 pilares existe, mas **o loop principal está quebrado em produção**: clicar numa vaga no Radar leva só à URL externa — os botões "Adaptar CV" e "Salvar candidatura" existem apenas em `Report.js` (só no `/experimentar`). **Fontes rastreáveis ([Currículo]/[Mercado]/[Base de Vagas]) que o LLM gera são STRIPADAS da UI por código intencional** — quebra o pilar #1 (transparência). **Streaks definidos no `lib/achievements.js` nunca renderizam** — quebra defesa contra episodicidade (risco ALTO do produto). **`.btn-primary` em noir é invisível** (texto branco sobre fundo branco) — afeta ~25 lugares. Acessibilidade está **acima da média BR** mas com 2 contraste-FAIL e 3 modais ad-hoc sem focus trap. Design system tem **bons artefatos mas migração incompleta** — 2 sistemas de h1 + 3 sistemas de botão coexistindo.

**Bottom line:** o problema não é "produto ruim". É "produto bom escondido atrás de bugs de loop + tese não comunicada nos pixels".

---

## Convergências críticas (P0 — citado por 2-3+ anéis)

### 🔴 1. Loop do Radar quebrado em produção
**Anéis: Éowyn + Gwaihir + Faramir**
- `RadarClient.js:374-387` só tem "Ver vaga original ↗" (URL externa)
- Botões `Adaptar CV →` + `+ Salvar candidatura` existem só em `Report.js:315-318` (que só roda em `/experimentar`)
- `/cvs-adaptados` MENTE no empty state: instrui "vá no Radar e clique Adaptar Currículo" — botão **inexistente** no app logado
- **Fix:** portar TailorModal + SaveJobButton do `Report.js` pro `RadarClient.js` (2-3 dias)
- **Impacto:** resolve 60% do loop quebrado, destrava 2 passos da jornada (1→2 e 1→4)

### 🔴 2. Fontes rastreáveis STRIPADAS da UI
**Anel: Gwaihir (achado único, mas crítico — quebra Pilar #1)**
- `MicroactionCard.js:65-68` tem comentário literal: **"Remove citacao [fonte: ...] do final do porque (ruido visual aqui)"**
- `RadarClient.js:371` faz o mesmo
- LLM gera `[Currículo]/[Mercado]/[Base de Vagas]` (forçado em `lib/prompts.js:36-37`), **UI joga fora**
- **Fix:** restaurar chip `<Src>` em ambos (4 horas)
- **Impacto:** P0 estratégico — restaura nosso moat principal (explicabilidade)

### 🔴 3. `.btn-primary` invisível em noir (texto branco sobre fundo branco)
**Anéis: Faramir (B-001) + Galadriel + Lúthien**
- `globals.css:734`: `.btn-primary { color: #FFF }`
- Em noir, `--primary-light → --primary` resolve para `#FFFFFF → #E5E5E5` (`globals.css:259-262`)
- Token `--on-primary: #000` existe em noir (`globals.css:334`) **mas NENHUM CSS consome**
- Afeta ~25 lugares: modais Welcome/Interview/Outcome/Chat, error pages, /conta, /experimentar, /candidaturas, /dashboard, /carreira, /gaps, /entrar
- **Bug "Ver vagas no Meu Gêmeo"** que founder reportou é instância disso
- **Fix:** `.btn-primary { color: var(--on-primary, #FFF) }` em globals.css (5 min)
- **Impacto:** corrige 25 botões de uma vez

### 🔴 4. Streaks invisíveis (combate à episodicidade quebrado)
**Anel: Gwaihir (único, P0 estratégico — risco ALTO do produto)**
- `lib/achievements.js:75-86` define `STREAK_7_DAYS`, `STREAK_30_DAYS`
- `grep -r "streak"` em `app/(app)/` e `components/` retorna **ZERO**
- Achievements **nunca podem ser desbloqueados**
- **Fix:** componente `<StreakBadge>` no AppShell header + cron daily-briefing já existe (1-2 dias)
- **Impacto:** combate à episodicidade — risco crítico do produto (doc Análise Crítica)

### 🔴 5. 2 sistemas de H1 coexistindo (3x diferença ao trocar aba)
**Anéis: Galadriel + Lúthien**
- `/dashboard`, `/carreira`, `/plano`, `/evidencias`, `/autoconhecimento` usam H1 inline `clamp(40px, 6vw, 80px)` Plus Jakarta (Arwen uplift Wave 6)
- `/concursos`, `/oportunidades`, `/funil`, `/estagios`, `/gaps`, `/transparencia`, `/cvs-adaptados`, `/conta`, `/admin` usam `.ct-page-header-title` = **26px Spectral serif fixo** (`globals.css:6171-6173`)
- **Fix:** unificar — substituir `.ct-page-header-title` por clamp moderno (1 linha em globals.css resolve 5+ páginas)
- **Impacto:** ROI máximo, coerência visual instantânea

### 🔴 6. 3 componentes ÓRFÃOS (prontos, nunca renderizados)
**Anel: Éowyn (único, mas é débito de implementação real)**
- `WelcomeModal` — `WelcomeModal.js:20-21` tem `// TODO manual` que nunca foi feito
- `OutcomeSurveyModal` — cron `outcome-survey` envia notif **assumindo modal que não monta**
- `TailorModal` — pronto, não usado
- **Fix:** integrar WelcomeModal no primeiro login + OutcomeSurveyModal no cron handler + TailorModal no Radar (parte do P0 #1)
- **Impacto:** features completas perdendo valor

### 🟠 7. ICP não detectada no onboarding
**Anel: Gwaihir (P0 estratégico — Gap #3 do mercado)**
- `OnboardingChat.logic.js:6-50` são 6 perguntas FIXAS (nome, cargo, anos, skills, conquistas, formação)
- Nenhuma sobre **momento de carreira** (transição forçada vs migração vs 1º emprego)
- ICP precisa do produto = "transição **forçada**", nunca perguntada
- **Fix:** pergunta `momentoCarreira` com 4 opções (1-2 dias)
- **Impacto:** segmentação de microcopy/recomendações + diferencial vs commodity

### 🟠 8. Modal canonical não usado por 3 modais ad-hoc
**Anéis: Elrond + Arwen**
- `RefreshDiagnosisButton`, `CvDetailClient tailor`, `NotificationsBell drawer` — todos ad-hoc
- Sem focus trap, sem ESC, sem return-focus
- **Fix:** refatorar pra usar `<Modal>` canonical (8-12h)
- **Impacto:** a11y + consistência

### 🟠 9. /candidaturas fora do AppShell + linka pra /meu-gemeo legacy
**Anéis: Éowyn + Faramir**
- Localizado em `app/candidaturas/` (FORA do route group `(app)`) — sem AppShell
- Linka "Voltar pro gêmeo → Vagas" mas `/meu-gemeo` redireciona pro `/dashboard` (sem listagem)
- Logo brand SVG `stroke="#B9D90C"` hardcoded (verde-tóxico errado vs lime canônico `#C2F542`)
- **Fix:** mover pra `app/(app)/candidaturas/` + corrigir link + remover SVG hardcoded
- **Impacto:** restaura AppShell consistente

### 🟠 10. Dead link `/linkedin` em `/estagios`
**Anéis: Éowyn + Faramir**
- `app/(app)/estagios/page.js:116` → href `/linkedin` (rota não existe)
- **Fix:** remover ou apontar pra `/conta` (LinkedIn parse fica lá)
- **Impacto:** 404 quebrado

---

## Achados únicos críticos por anel

### Galadriel — Design System
- 3 sistemas de botão primário (`.btn .btn-primary` indigo legacy + `.site-btn-primary` cyan pill + custom !important inline em 5+ pages)
- `borderRadius: 8` hardcoded **30+ vezes** — tokens existem mas não usados em inline styles
- `/entrar/page.js` usa tokens `--ink-faint`, `--rule`, `--mono` que **NÃO EXISTEM** em globals.css — fallback silencioso pra browser default. Bug latente.
- 10+ blocos `<style dangerouslySetInnerHTML>` injetados em runtime (technical debt)

### Lúthien — Brand
- **BrandMark gradient usa `--primary-light → --primary-deep`** — em noir vira `#FFFFFF → #E5E5E5`. **Logo da marca é branco-cinza sem lime em 100% das telas logadas.**
- `.appshell-nav-item.active` usa `--primary` (noir = #FAFAFA) — active state da nav é branco-em-cinza, **sem lime accent em nenhum estado da navegação**
- WelcomeModal hardcoded `#4F46E5`/`#06B6D4`/`#8B5CF6` — primeiro contato pós-login mostra paleta de **outro produto**
- `/entrar` hero 38px hardcoded + h2 com `var(--serif)` — dissonância tipográfica com landing

### Elrond — Accessibility (status: APROVADO COM RESSALVAS)
- **Lime sobre preto em noir = 16.54:1 AAA ✓** (excelente)
- 2 P0 FAIL: `--text-muted` light (4.48:1, falha AA por 0.02), `--text-faint` light (2.41) e dark (2.94)
- Skip link **invisível em noir** (color #fff sobre `--primary` = #FAFAFA = 1.04:1)
- `NotificationsBell` itens são `<li onClick>` (não focáveis por teclado)
- `SiteNav` mobile drawer sem ESC handler
- `--site-fg-dim` (alpha 0.45) = 3.98:1, falha AA texto

### Éowyn — UX Flows
- `/funil` é **A ÚNICA rota com deep-link contextual** (`lib/funnel.js:120-179`), mas mesmo assim genérico por stage
- `/carreira` é wall of text — milestones com skills/evidências sem CTAs outbound
- Microactions e DailyQuest são **honor-system puros** — sem link pra fazer a ação, só "Marcar concluída"

### Faramir — QA bugs
- **B-005**: Modal z-index 100 vs drawer 9000-9001 — modal abre **por baixo** quando drawer aberto
- **B-006**: Theme toggle sobrepõe avatar/bell no mobile header
- **B-008**: `className="btn-primary"` SEM `btn ` em not-found, error pages, /carreira, DailyQuestCard — botão sem padding/border-radius (texto colado)
- `/privacidade:1121` — `background: var(--accent-cyan-deep)` (lime em noir) + `color: "#fff"` = baixo contraste
- AppShell BrandMark `stroke="#fff"` no SVG (vira invisível em noir quando gradient é branco)
- `app/globals.css:3452` (`.ct-onb-brand`) — brand panel do `/experimentar` fica branco-com-texto-branco em noir
- `appshell-user` na sidebar **NÃO é clicável** (só `<div>` decorativo)
- **NÃO existe item "Conta" na NAV** + `user.image` totalmente ignorado (sempre só inicial)

### Arwen — Polish
- Modal core (Modal.js) ficou pra trás — borda `1px solid var(--text)` puro, blur só `3px` (Wave 8 não chegou aqui)
- **ZERO spinners inline** em ChatModal, InterviewModal, OutcomeSurveyModal (produto IA-heavy 5-10s wait sem feedback)
- 4 close buttons com 3 caracteres diferentes (`✕` vs `&times;` vs SVG) — sem feedback hover
- 4 padrões de focus state em inputs
- 8 stroke-widths distintos em ícones (1.0-2.4) sem regra
- `.site-fade-up` só existe na landing — app logado sem card reveals

### Gwaihir — Tese vs Implementação
- Onde a tese **vive forte:** `/transparencia` (fórmula visível, peso explícito, exemplo numérico reproduzível), `/dashboard` SubScoresCol (única tela mostrando fonte), `/funil` (BottleneckBanner), `/plano` ScoreChart (Serasa-style), landing SiteFeatures (microcopy independência editorial)
- Onde **some pós-login:**
  - Independência editorial: 2 menções na landing, **ZERO no app logado**
  - Caso Jamar: `grep Jamar app/ components/` → vazio
  - Página comparativa (CareerTwin vs Emprega.AI/LinkedIn/ChatGPT): não existe
  - `/meu-gemeo` é só `redirect("/dashboard")` — branding "gêmeo" diluído

---

## Wave 10 proposta — ordem de fix (priorizada por ROI)

### Sprint 1 — Quick wins (8-16h, alto impacto)
1. **Fix `.btn-primary` color noir** (5 min) → corrige 25 botões
2. **Restaurar fontes rastreáveis** em MicroactionCard + RadarClient (4h) → restaura Pilar #1
3. **Unificar H1 sistema** — substituir `.ct-page-header-title` (1-2h) → 5 páginas instantâneas
4. **Fix dead link `/linkedin`** em `/estagios:116` (5 min)
5. **Fix Modal z-index 100 → 9100** (5 min) → desbug abertura por baixo
6. **Fix `className="btn-primary"` sem `btn `** em 5 arquivos (15 min)
7. **Adicionar `--on-primary` aos botões `.btn-primary`** globalmente (10 min)
8. **Fix BrandMark/AppShell SVG branco** em noir (15 min)

### Sprint 2 — Loop fechado (3-5 dias, P0 estratégico)
9. **Portar TailorModal + SaveJobButton do Report.js para RadarClient.js** (2-3 dias) → resolve loop principal
10. **Mover `/candidaturas` pra `app/(app)/candidaturas/`** + corrigir links (4h)
11. **Integrar WelcomeModal no primeiro login** (4h) → resolve TODO órfão
12. **Integrar OutcomeSurveyModal no handler do cron** (4h)
13. **`<StreakBadge>` no AppShell header** + visualização achievements (1-2 dias) → combate episodicidade

### Sprint 3 — Refator + a11y (1 semana)
14. **Refatorar 3 modais ad-hoc** para `<Modal>` canonical (8-12h)
15. **Fix contrastes WCAG AA** — `--text-muted` light + `--text-faint` light/dark (2h)
16. **Fix skip link visível em noir** (15 min)
17. **NotificationsBell items focáveis por teclado** (2h)
18. **SiteNav mobile ESC handler** (1h)
19. **Adicionar spinners inline** em 3 modais IA (4h)

### Sprint 4 — Brand + tese visível (1-2 semanas)
20. **Tokens BrandMark + nav active** com lime em noir (4h) → moat visual
21. **Pergunta `momentoCarreira` no Onboarding** (1-2 dias) → ICP detectada
22. **Página comparativa CareerTwin vs Emprega.AI/LinkedIn/ChatGPT** (3-5 dias)
23. **Microcopy "você é o cliente" no marketplace de cursos** (2h)
24. **Caso Jamar como testimonial** em landing + dashboard (4h)
25. **`/meu-gemeo` página real** (não redirect) — manifesto "gêmeo digital" (1-2 dias)

### Sprint 5 — Polish (paralelizável)
26. Unificar focus state inputs (4h)
27. Unificar close button (2h)
28. Stroke-width regra ícones (2h)
29. `.site-fade-up` no app logado (3h)
30. ...

---

## Sinais positivos (manter, não mexer)

- **`/transparencia`** é provavelmente o melhor moat visível do produto (Gwaihir)
- **`/funil`** com BottleneckBanner é o único deep-link contextual implementado (Éowyn)
- **`/plano` ScoreChart** = snapshot history Serasa-style perfeito (Gwaihir)
- **Skip link real + 14 arquivos com prefers-reduced-motion + Modal canonical com focus trap** = base sólida de a11y (Elrond)
- **Contraste em noir entre lime e preto = AAA** (16.54:1) — perfeito
- **8 waves anteriores criaram bons artefatos** — problema é cobertura, não qualidade

---

## Roteiro de teste manual (founder confirma após Sprint 1)

- [ ] Abrir `/meu-gemeo` em noir → clicar "Ver vagas" → texto legível?
- [ ] Abrir Radar → cards mostram chip de fonte `[Currículo]`?
- [ ] Click vaga no Radar → vai pra Vaga Detail (não URL externa)?
- [ ] Abrir todos os modais → ESC fecha? Focus trap funciona?
- [ ] Resize 375px → theme toggle não sobrepõe header?
- [ ] H1 nas 14 páginas do app → todos parecem do mesmo produto?
- [ ] BrandMark no header tem lime em noir? Active state também?
- [ ] Streaks/achievements aparecem em algum lugar?
- [ ] Onboarding pergunta "momento de carreira"?
- [ ] Skip link visível ao Tab no /dashboard?

---

## Conclusão honesta

**O produto está construído. Falta a UX comunicar isso.** A maior parte dos fixes não são "feature nova" — são **conectar coisas que já existem** (TailorModal órfão + chip de fonte stripado + streaks definidos mas não exibidos + ICP detectada mas não perguntada).

**Wave 10 = polish + loop closure + tese visível.** Não precisa repensar arquitetura — precisa fechar gaps de implementação.

Mentor de growth vai cravar: **"Você tem 4 pilares, o produto entrega 4, mas o usuário vê 2."** Wave 10 fecha esse gap.
