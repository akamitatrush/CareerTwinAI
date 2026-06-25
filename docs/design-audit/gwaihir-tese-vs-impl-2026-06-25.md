# Tese vs Implementação Audit — Gwaihir — 2026-06-25

> Águia mensageira dos Senhores Élficos. Auditoria sobre se os 4 pilares da tese CareerTwin aparecem nos pixels — ou ficaram só no PRD.
>
> Escopo: `app/`, `components/`, `lib/scoring/*`, `lib/prompts.js`, sem `tests/`.

---

## Executive Summary

**A pergunta central:** o produto está sendo CareerTwin (workflow opinionated com 4 pilares) ou virou SaaS de carreira genérico?

**Resposta de uma frase:** A tese está **80% implementada na INFRA mas só ~55% nos PIXELS**, com duas fraturas críticas — (1) o loop principal "Radar → Adaptar CV → Salvar candidatura → Funil" **está quebrado no app logado** (só fecha no /experimentar efêmero), e (2) a **fonte rastreável das microactions é STRIPADA da UI em /gaps e /oportunidades**, quebrando o pilar "número = cálculo, texto = explicação com fonte".

Resumo:
- ✅ **Pilar 1 (Score auditável)** está **MUITO bem implementado** em /transparencia + dashboard — provavelmente o ponto mais forte do produto hoje.
- ❌ **Pilar 2 (Workflow opinionated)** está **quebrado no app real**: Report.js (com loop fechado) só roda em /experimentar; RadarClient.js (prod) tem apenas "Ver vaga original ↗" sem deep links para CV/candidatura.
- ⚠️ **Pilar 3 (Independência editorial)** comunicado **só na landing**; sumido depois do login. Sem página comparativa vs Emprega.AI/LinkedIn.
- ✅ **Pilar 4 (Brasil-first)** OK em nav (concursos/estágios/funil) e LGPD card no AppShell.
- ❌ **ICP** (28-50, transição forçada) **não aparece em microcopy nenhuma**; onboarding tem 6 perguntas fixas, nenhuma sobre momento/fase de carreira. Jamar (beta) não vira testimonial em parte alguma.
- ⚠️ **Episodicidade**: Daily Quest renderiza no dashboard, mas **streaks (definidos em `lib/achievements.js`) NUNCA aparecem na UI** — `grep STREAK_` em `app/` e `components/` retorna ZERO.

---

## Audit por pilar

### Pilar 1: Score auditável visível — ✅ FORTE

**Estado:** Bem implementado.

**Evidências:**
- `app/(app)/transparencia/page.js:127-477` — tese editorial ("Número é matemática, texto é IA com fonte"), 4 sub-scores com **fórmula visível em `<code>`**, peso explícito em pill ("peso 40%"), **exemplo numérico passo-a-passo reproduzível** com os 4 sub-scores calculados manualmente, e seção "Seu cálculo agora" com tabela `FormulaTable` que mostra contribuição de cada sub-score do snapshot do user.
- `app/(app)/dashboard/page.js:504-579` — `SubScoresCol` mostra os 4 sub-scores **com pesos sumarizados, valor, barra de progresso, explicação ("Por que")** e fonte (chips `ct-ss-source · {source}`). Header tem "Como calculamos →" linkando pra /transparencia.
- `app/(app)/plano/page.js:166-214` — snapshot history visível **Serasa-style** via `ScoreChart` SVG manual com escala adaptativa + delta "+N pontos desde mês X". Pilar #1 do Benchmarking (Serasa) implementado.
- `app/(app)/dashboard/page.js:404-440` — anel pontilhado da projeção mostra "+N pts projetados com K ações concluídas" — score evolution após microaction É visível e atribuída.

**Gaps:**
- ⚠️ "O que mais impacta meu score AGORA?" (Credit Karma) **não existe como CTA destacada**. O dashboard mostra os 4 sub-scores mas não tem o card específico "fator que mais sangra hoje". Implícito nos "3 próximas ações de maior impacto" (linha 581), mas não comunicado como "fator do score".
- ⚠️ /meu-gemeo é redirect mudo para /dashboard (`app/meu-gemeo/page.js:1-7`); branding "gêmeo" diluído — o usuário não chega a ver "/meu-gemeo" como rota.
- ❌ Não há card explícito **"Por que esse número?"** no dashboard (botão dedicado). A explicação está em sub-scores mas o user precisa pensar pra conectar.

**Recomendação:**
1. Adicionar card "**O que mais sangra hoje**" no dashboard apontando pro sub-score mais baixo, com CTA "+N pts se você fizer X" (Credit Karma-style).
2. Manter /meu-gemeo como **rota viva** (redirect quebra branding); transformar em alias de /dashboard com UI idêntica mas título "Seu gêmeo".

---

### Pilar 2: Workflow opinionated (loop fechado) — ❌ QUEBRADO em prod

**Estado:** Quebrado nos caminhos críticos do usuário logado. O loop fechado existe **só no Report.js (modo /experimentar efêmero)**.

**Evidências do loop FECHADO em /experimentar (Report.js):**
- `components/Report.js:315-318` — botão `Adaptar currículo →` abre `TailorModal`.
- `components/Report.js:385-431` — `SaveJobButton` faz POST /api/applications com status SAVED → confirma "✓ Salva nas candidaturas".
- `components/Report.js:158-167` — barra de CTAs com `Ir pro dashboard / Ver todas as ações / Radar de vagas`.
- `app/experimentar/page.js:6` — único call site de `Report.js`.

**Evidências do loop QUEBRADO em /oportunidades (RadarClient.js, app logado):**
- `app/(app)/oportunidades/RadarClient.js:374-387` — única ação por vaga é `<a>Ver vaga original ↗</a>`. **Sem botão "Adaptar currículo", sem "+ Salvar candidatura", sem deep link `/cvs-adaptados?fromJob=X`.**
- `grep -rn "Adaptar\|tailor" app/(app)/oportunidades/` → vazio.
- `app/(app)/cvs-adaptados/page.js:94-99` instrui: "Vá em **Radar de vagas**, escolha uma vaga e clique em **'Adaptar currículo →'**". **Esse botão não existe no /oportunidades** — instrução órfã, contrato quebrado.

**Outras quebras:**
- Após gap completar (`MicroactionCard:37-63`) → nenhuma CTA "próximo passo / refazer diagnóstico" (a CTA "Atualizar diagnóstico" mora no dashboard, não no card que o user marcou).
- /candidaturas → não há CTA "preparar entrevista" quando status vira INTERVIEW.
- /funil identifica bottleneck (`BottleneckBanner` linha 136-200) com `analysis.suggestion`, mas **a sugestão é texto livre** — sem CTA tipo "Adaptar CV pra triagem" linkando pra /cvs-adaptados.

**Recomendação:**
1. **P0:** Portar lógica de `Report.js` (TailorModal + SaveJobButton) para `app/(app)/oportunidades/RadarClient.js`. Cada `JobCard` precisa de 3 botões: `Adaptar CV → / + Salvar candidatura / Ver vaga ↗`.
2. **P0:** Após `MicroactionCard.toggle` → toast "Atualizar diagnóstico pra cristalizar +N pts?" com CTA inline.
3. **P1:** /funil → cada bottleneck sugestão deve virar deep link clicável (triagem → /cvs-adaptados; HM → mock interview).

---

### Pilar 3: Independência editorial — ⚠️ COMUNICADO SÓ NA LANDING

**Estado:** Mensagem existe na landing pública, **desaparece no app logado**.

**Evidências de COMUNICAÇÃO:**
- `components/site/SiteFeatures.js:55` — quote `"Você é o cliente, não o produto."` (LGPD card).
- `components/site/SiteFeatures.js:77-79` — card "Marketplace neutro": *"Recomenda Tera, Alura, Coursera, FreeCodeCamp por aderência ao seu gap — sem comissão, sem viés."*
- `app/privacidade/page.js:102` — comentário interno "Princípio — você é o cliente, não o produto" (não certifiquei se texto aparece visível ao usuário; bloco de privacy declarations).

**Evidências de NÃO COMUNICAÇÃO:**
- `grep -rn "Emprega.AI\|Gupy\|concorrente\|comparação" app/ components/` → **ZERO** matches. **Não existe página comparativa CareerTwin vs Emprega.AI/LinkedIn**, apesar disso ser explicitamente recomendado em `visao_produto_careertwin.md:103-105`.
- Marketplace de cursos: **não há rota /cursos**. Cursos aparecem inline em `MicroactionCard.js:146-192` (lista de 2 por gap). **Não há comunicação visível "estes cursos são neutros" nesse render** — só `provider` + `título` + `Ver curso ↗`. O user não sabe que CareerTwin não recebe comissão de Alura/Tera/Coursera ali.
- AppShell tem `appshell-lgpd-card` linha 211-232 (LGPD), mas **nenhum card "independência editorial"**.

**Recomendação:**
1. **P1:** Criar página `/comparar` (ou seção em /transparencia) com tabela "Por que CareerTwin não é Emprega.AI" — alinhamento direto com `concorrencia_landscape.md:30`.
2. **P1:** No render inline de cursos no `MicroactionCard.js`, adicionar microcopy: *"Sem comissão. Sem afiliado. Recomendação é por aderência ao seu gap."* — converte feature em DIFERENCIAL VISÍVEL.
3. **P2:** Considerar /cursos como página própria (marketplace de fato), não só inline em gaps.

---

### Pilar 4: Brasil-first — ✅ BOM

**Estado:** Bem implementado em nav e infra. Levemente subcomunicado em microcopy.

**Evidências:**
- `components/AppShell.js:25-39` — nav inclui `/concursos`, `/estagios`, `/funil` como itens de primeira classe.
- `app/(app)/concursos/page.js` (387 linhas) e `app/(app)/estagios/page.js` (570 linhas) — features substantivas, não placeholders.
- `app/(app)/funil/page.js:81-87` — pergunta core "Onde sua busca está parando?" alinhada com o problema central da tese (`visao_produto_careertwin.md:11`).
- `components/AppShell.js:211-232` — `appshell-lgpd-card` "SEUS DADOS, PROTEGIDOS · Conforme a LGPD" sempre visível na sidebar.
- `app/(app)/transparencia/page.js:594-738` — seção RAG declara "159 chunks · BR-first: CLT, PJ, MEI, concursos, setor regulado".
- `lib/jobs/` — providers BR (fixtures usa `Adzuna BR`, `Jooble`, etc.) — `RadarClient.js:131-147` mostra source chips.

**Gaps:**
- ❌ Linguagem PT-BR usada, mas **termos BR (CLT/PJ/MEI/Faria Lima/regulado)** mencionados só em /transparencia. **Não aparecem em onboarding/perfil/diagnóstico**. Em /conta não há campo "regime CLT/PJ/MEI" — perfil estrutural BR ausente.
- ⚠️ "Vagas regionais" — não há filtro por região BR no Radar (`RadarClient.js:10-12` só tem senioridade/modelo/minMatch). Mercado regulado BR (Bradesco/Itaú/Faria Lima) é categoria diferente, sem destaque.

**Recomendação:**
1. **P2:** Adicionar campo "regime trabalhista" (CLT/PJ/MEI) no /conta — sinal de Brasil-first concreto.
2. **P3:** Filtro regional no Radar (SP/RJ/Sul/Nordeste).

---

## Audit dos 7 critérios específicos

### 1. Score Serasa-style visível — ✅ SIM

**Estado:** Implementado com sofisticação acima da média do mercado.

Evidências em `app/(app)/dashboard/page.js:199-215` (hero com ring + sub-scores), `app/(app)/transparencia/page.js:345-477` (worked example reproduzível), `app/(app)/plano/page.js:254-340` (snapshot history chart). Único faltante crítico: card explícito "Por que esse número?" (botão dedicado).

**Ação:** Adicionar botão "Por que esse número?" abrindo painel com breakdown do snapshot atual (similar ao `<details>` linha 189-195 do Report.js, mas no dashboard real).

---

### 2. Microactions com fonte rastreável — ⚠️ PARCIAL (fonte STRIPADA em prod)

**Estado:** Sistema de prompts EXIGE fonte (`lib/prompts.js:37`), mas UI **STRIPA a fonte** em 2 dos 3 lugares mais importantes.

**Evidências:**
- `lib/prompts.js:36-37`: `RULES_FONTE = "Cada explicação termina com a fonte entre colchetes: [Currículo] para algo tirado do CV, [Mercado] para conhecimento de mercado..."`. LLM gera SEMPRE com fonte.
- `lib/prompts.js:83`: dashboard prompt: "...terminando em [Currículo], [Mercado] ou [Base de Vagas]".
- ✅ `app/(app)/dashboard/page.js:542-572` — **mostra a fonte** como chip (`ct-ss-source`).
- ✅ `components/Report.js:21-32` (Report.js / /experimentar) — `splitSrc()` + `<Src>` chip.
- ❌ `app/(app)/gaps/MicroactionCard.js:65-68` — **STRIPA a fonte** com comentário literal: `// Remove citacao "[fonte: ...]" do final do "porque" (ruido visual aqui).` — O `porqueLimpo` é renderizado SEM a fonte.
- ❌ `app/(app)/oportunidades/RadarClient.js:371` — `{job.porque.replace(/\s*\[(.+?)\]\s*$/, "")}` — STRIPADO em produção também.

**Diagnóstico:** Decisão consciente de remover por "ruído visual" — mas isso **mata o pilar 1 nas duas telas mais usadas** (gaps + radar). O LLM ESCREVE a fonte; a UI joga fora.

**Ação P0:** Restaurar `<Src>` chip (estilo `components/Report.js:29-32`) em MicroactionCard.js e RadarClient.js. Pode ser sutil (mute color, font-size 11), mas precisa aparecer. Pilar 1 e Pilar 5 (IA explicável) dependem disso.

---

### 3. Loop fechado entre features — ❌ QUEBRADO

Detalhe completo no Pilar 2 acima. Resumo:
- Adaptar CV: deep link **só em /experimentar**, não em /oportunidades logado.
- Salvar candidatura: idem.
- "Preparar entrevista" pós-INTERVIEW: ausente em /candidaturas.
- Funil bottleneck → CTA contextual: ausente em /funil.

**P0:** 2 deep links no RadarClient (Adaptar + Salvar). Resolve 60% do problema.

---

### 4. Episodicidade combatida (Duolingo-style) — ⚠️ INCOMPLETO

**Estado:** Infraestrutura toda construída, **streaks invisíveis na UI**.

**Evidências:**
- ✅ Daily Quest renderiza no dashboard: `app/(app)/dashboard/page.js:222` (`<DailyQuestCard />`), `app/(app)/dashboard/DailyQuestCard.js:73-100` (UI com "QUEST DO DIA · +Xpts" + estimatedMinutes).
- ✅ Achievements: `lib/achievements.js:20-123` define 17 kinds incluindo `STREAK_7_DAYS` e `STREAK_30_DAYS` com pontos +30/+100.
- ✅ Grid de achievements visível em /conta: `app/(app)/conta/page.js:475-522`.
- ❌ **Streaks**: `grep -rn "STREAK_\|streak" app/ components/` → **ZERO**. Os achievements existem na taxonomia mas **streaks nunca são computados nem mostrados na UI**. Sem flame counter no header, sem "você está em 5 dias seguidos", sem nada. O achievement de 7 dias **nunca pode ser desbloqueado** pelo fluxo atual.
- ✅ Daily-briefing email cron: `app/api/cron/daily-briefing/route.js:1-60` — 6x/semana terça-domingo 8h BRT. Re-engajamento via email OK.
- ⚠️ Trigger "você não voltou em X dias": não há cron específico de comeback. Daily briefing roda independente da última visita.

**Diagnóstico:** Combate à episodicidade está **metade no lugar** (daily quest + email) e **metade ausente** (streaks visuais + comeback trigger). Para o público ICP (que vai churnar 100% em 6 meses pós-recolocação), isso é grave.

**Ação:**
1. **P0:** Implementar contador de streak (consultar Sessions/AuditLog últimos 30 dias) e renderizar como pill no header do AppShell ao lado de NotificationsBell. Acende `STREAK_*` achievements.
2. **P1:** Cron `comeback-trigger` que detecta gap >7 dias sem login e dispara push/email "Seu funil tá esperando — 2 minutos só".

---

### 5. Independência editorial comunicada — ⚠️ SÓ NA LANDING

Detalhe no Pilar 3 acima. Resumo:
- ✅ Landing pública: 2 menções explícitas (`SiteFeatures.js:55,77`).
- ❌ App logado: ZERO menções. Cursos no `MicroactionCard.js:146-192` aparecem sem nenhuma microcopy "sem comissão".

**Ação:** Microcopy de 1 linha no header do bloco de cursos do `MicroactionCard.js`: *"Cursos recomendados por aderência ao seu gap — sem comissão, sem viés."*

---

### 6. Brasil-first comunicado — ✅ BOM

Detalhe no Pilar 4 acima. Resumo: nav + LGPD card no shell + páginas substantivas para concursos/estágios/funil. PT-BR é nativo. **Falta termos CLT/PJ/MEI no perfil/onboarding**.

---

### 7. ICP refletida em onboarding/microcopy — ❌ AUSENTE

**Estado:** ICP (28-50, transição forçada) **NÃO aparece em microcopy nenhuma do produto**. Onboarding é genérico.

**Evidências:**
- `components/OnboardingChat.logic.js:6-50` — 6 perguntas FIXAS: nome, cargo atual, anos, skills, conquistas, formação. **Nenhuma pergunta sobre fase/momento de carreira ou estágio do funil onde está parando.** A pergunta `currentRole` é estática — não diferencia "estou empregado e quero migrar" vs "estou desempregado há 7 meses".
- `components/WelcomeModal.js:33-52` — 3 cards (Diagnóstico/Gaps/Vagas) genéricos, sem ICP messaging.
- `grep "Jamar" app/ components/` → ZERO. Caso beta (`visao_produto_careertwin.md:79`) **não vira testimonial em parte alguma**.
- `components/site/SiteSocialProof.js:1-10` — declara honestamente "não fingimos volume" e usa stats técnicos (1101 testes, 50 rotas), mas **perde a chance** de aterrar com 1 caso real (Jamar). Comentário linha 7 diz "quote generica honesta (sem inventar testimonial)" — ok não inventar, mas Jamar É real, dá pra citar com permissão.
- `components/CopilotWidget.js:63` — fallback de targetRole é "Profissional em transição" (genérico, não comunica ICP).

**Diagnóstico:** Onboarding genérico = produto **comunica-se como ferramenta universal** quando o moat é ser **especialista no ICP**. Esse é o anti-padrão #3 da lista de gaps do mercado: "pouca personalização por momento de carreira" — gap que era pra ser nosso diferencial, sumiu na UX.

**Ação:**
1. **P0:** Adicionar pergunta `momentoCarreira` ao OnboardingChat: `["Empregado, quero migrar", "Em transição forçada", "Recém-formado / 1º emprego", "Retorno após pausa"]`. Salvar em `Profile.careerMoment` (nova coluna ou em `Profile.extras` JSON). Personalizar microcopy do dashboard pelo valor.
2. **P1:** Testimonial honesto do Jamar (com permissão) em `SiteSocialProof.js` ou /transparencia — "estudo de caso" com link pro post detalhado.
3. **P2:** WelcomeModal pergunta primeiro "qual o seu momento?" antes de mostrar os 3 cards.

---

## 8 GAPS do mercado — onde temos diferencial mas NÃO COMUNICAMOS

Aplicando a lista de `concorrencia_landscape.md:70-79`:

| # | Gap do mercado | Nosso estado | Tese diz | UI mostra? |
|---|---|---|---|---|
| 1 | Visão integrada | ✅ Temos infra (dash, gaps, radar, funil, cvs, candidaturas) | Diferencial | ⚠️ Sim, mas loop entre features está QUEBRADO em prod (ver pilar 2) |
| 2 | Diagnóstico → plano | ✅ Temos gaps + plano + carreira | Diferencial | ✅ /dashboard "3 próximas ações" + /gaps Ato 3 + /plano timeline |
| 3 | Personalização por momento | ❌ Onboarding genérico | Diferencial | ❌ Nenhuma pergunta de momento; ICP "transição forçada" não diferencia UX |
| 4 | Evidências democratizadas | ⚠️ /evidencias existe (139 linhas) sem templates por área | Diferencial | ❌ Empty state mostra texto genérico; sem cards "exemplo de evidência pra Backend/PM/Data..." |
| 5 | **IA explicável** | ✅ Pilar central, prompts forçam fonte | **Moat principal** | ⚠️ Dashboard mostra fonte, mas **/gaps e /oportunidades STRIPAM a fonte** (item 2 do audit) |
| 6 | Feedback emocionalmente seguro | ⚠️ Microcopy é honesto ("ainda em construção", "stub declarado") | Diferencial | ✅ Tom OK em transparência/mediana. Falta um pass específico em gaps com texto encorajador ("você cobre X de Y skills exigidas — bom progresso pra senioridade declarada"). |
| 7 | Aprendizagem ↔ candidatura | ✅ Cursos inline no MicroactionCard | Diferencial | ✅ `MicroactionCard.js:146-192` mostra 2 cursos por gap. Bem feito. |
| 8 | Qualidade > volume | ✅ Filosofia oposta a LazyApply | Diferencial | ⚠️ Não há messaging ANTI-volume visível. Em /candidaturas (Strava-style funil) o conceito está implícito mas não declarado. |

**Priorizado por "diferencial maior que não comunicamos":**
1. **#5 (IA explicável):** Restaurar `<Src>` chip em /gaps e /oportunidades. **P0**.
2. **#3 (Personalização por momento):** Pergunta de momento no onboarding. **P0**.
3. **#4 (Evidências democratizadas):** Templates por área em /evidencias. **P1**.
4. **#8 (Qualidade > volume):** Microcopy "Aplique a 5, não a 50" no banner do funil/radar. **P2**.

---

## Findings

### P0 — Tese quebrada (produto NÃO está sendo CareerTwin neste ponto)

1. **Loop principal quebrado em prod** — Radar (`RadarClient.js`) NÃO tem Adaptar CV nem Salvar candidatura. Só `/experimentar` (Report.js) tem isso. **Pilar 2 falha em produção.** `app/(app)/oportunidades/RadarClient.js:374-387`.

2. **Fonte rastreável é STRIPADA da UI em /gaps e /oportunidades** — `MicroactionCard.js:65-68` e `RadarClient.js:371` removem `[Currículo]/[Mercado]/[Base de Vagas]` que o LLM gerou. **Pilar 1 e Gap #5 do mercado falham nas 2 telas de maior uso.** O comentário literal no código diz "ruido visual aqui" — decisão de design contra a tese.

3. **Onboarding não pergunta momento de carreira** — `OnboardingChat.logic.js:6-50` é genérico. **ICP (transição forçada, 28-50) não é detectada nem comunicada.** Produto trata todos como mesma persona.

### P1 — Tese suportada por infra mas NÃO COMUNICADA na UI

4. **Streaks invisíveis** — `lib/achievements.js:75-86` define `STREAK_7_DAYS` e `STREAK_30_DAYS`, mas `grep streak` em `app/(app)/` retorna ZERO. Achievement nunca pode ser desbloqueado, sequência nunca aparece na UI. **Episodicidade (risco ALTO da tese) parcialmente sem combate visual.**

5. **Independência editorial some pós-login** — `SiteFeatures.js:55,77` comunica na landing; no app logado (incluindo MicroactionCard, onde cursos aparecem), zero menção a "sem comissão / sem viés". **Pilar 3 sumido.**

6. **Sem página comparativa** — `grep "Emprega.AI\|Gupy\|comparação"` → ZERO matches em UI. `visao_produto_careertwin.md:103-105` pede explicitamente. **Pilar 3 sem defesa concreta.**

7. **Caso Jamar não vira testimonial** — `SiteSocialProof.js` evita inventar mas perde a chance de aterrar com case real (Sr PM, 7 meses sem job). **ICP sem rosto.**

### P2 — Tese parcialmente comunicada

8. **/meu-gemeo é redirect** — `app/meu-gemeo/page.js:1-7` joga pra /dashboard. Branding "gêmeo" se dilui. Manter como página viva (mesmo que clonando dashboard) reforça o conceito "gêmeo evolutivo".

9. **/evidencias sem templates por área** — Página existe mas empty state é texto frio. Gap #4 do mercado.

10. **"O que mais sangra agora" não destacado** — Dashboard mostra todos os sub-scores; não tem callout Credit Karma-style "esse fator é seu maior gap".

11. **Comparação CareerTwin vs ChatGPT direto** — Substituto #1 da tese (`visao_produto_careertwin.md:56`). Não há messaging "8 razões = workflow vs ferramenta" na UI.

12. **CLT/PJ/MEI ausente do perfil** — Brasil-first conceitual mas falta o concreto.

### P3 — Polish

13. **Filtro regional no Radar** ausente (`RadarClient.js:10-12`).
14. **CTA pós-microaction** mora no dashboard, não no card (`MicroactionCard.js`).
15. **WelcomeModal cards genéricos** — não vinculados ao momento do user.

---

## Diagnóstico final

> **"O produto é CareerTwin (4 pilares) ou é mais um SaaS de carreira?"**

**Resposta honesta:** É **80% CareerTwin no código, 55% CareerTwin nos pixels**.

A tese vive de verdade em:
- /transparencia (excepcional — provavelmente o melhor moat visível do produto).
- /dashboard (score auditável + sub-scores com pesos).
- /funil (problema central da tese implementado).
- /plano (snapshot history Serasa-style).
- Landing pública (Marketplace neutro + "você é o cliente").

A tese morre em:
- /oportunidades (loop quebrado — só "Ver vaga ↗").
- /gaps (fonte stripada das microactions).
- Onboarding (genérico, ignora ICP).
- Header/AppShell (sem streaks, sem indicador de habit loop).
- Pós-login (mensagens de independência editorial somem).

**A reciclagem dos 2 quick wins (restaurar fonte em /gaps+/oportunidades + portar Adaptar/Salvar do Report.js pro RadarClient.js) leva o produto de 55% pra ~75% sem mudança de modelo.** Os outros itens (streaks visíveis, momento de carreira no onboarding, página comparativa) levam pra 90%+.

Sem essas correções: o usuário pago de R$49/mês vai ver um app bonito, com diagnóstico forte, mas vai sentir que ele PRÓPRIO precisa fazer a ponte entre as features — exatamente o que a tese promete RESOLVER.

---

## Recomendações priorizadas — top 10 ações pra reafirmar a tese

| # | Ação | Pilar afetado | Esforço | Impacto |
|---|---|---|---|---|
| 1 | Portar Adaptar CV + Salvar candidatura do Report.js pro RadarClient.js | Pilar 2 | M (2-3d) | **Crítico** — fecha o loop principal |
| 2 | Restaurar `<Src>` chip de fonte em MicroactionCard.js e RadarClient.js | Pilar 1 + Gap #5 | S (4h) | **Crítico** — IA explicável volta pra UI |
| 3 | Adicionar pergunta "momento de carreira" no OnboardingChat (4 opções) | ICP + Gap #3 | M (1-2d) | Alto — produto vira ICP-specific |
| 4 | Computar+exibir streak (header pill ao lado do sino) | Pilar 4 (episodicidade) | M (2d) | Alto — habit loop fica visual |
| 5 | Microcopy "Sem comissão, sem viés" no header de cursos do MicroactionCard | Pilar 3 | S (30min) | Médio — independência editorial volta pro app |
| 6 | Página /comparar (CareerTwin vs Emprega.AI vs LinkedIn vs ChatGPT) | Pilar 3 + Substituto #1 | M (2d) | Alto — defesa concreta de moat |
| 7 | Card "O que mais sangra agora" no /dashboard (Credit Karma-style) | Pilar 1 | S (4h) | Médio — priorização ganha foco |
| 8 | Testimonial Jamar (com permissão) em SiteSocialProof.js | ICP | XS (1h, depende de permissão) | Alto — caso real aterra a tese |
| 9 | Templates por área em /evidencias (Backend/PM/Data/etc) | Gap #4 | M (3d) | Médio |
| 10 | /meu-gemeo como página viva (não redirect) | Branding gêmeo | S (4h) | Médio |

---

## Roteiro de teste manual (founder confirma)

- [ ] **Score visível:** abrir /dashboard logado. Em 3 segundos, vejo POR QUE o score é aquele número? ✅ (sub-scores na coluna direita).
- [ ] **Score explicado:** clicar em "Como calculamos →". Vou pra /transparencia, vejo fórmula + exemplo numérico? ✅
- [ ] **Loop Radar→CV:** abrir /oportunidades. Em qualquer JobCard, há botão "Adaptar currículo →"? ❌ Apenas "Ver vaga original ↗" — confirma quebra.
- [ ] **Loop Radar→Candidatura:** mesmo JobCard, há botão "+ Salvar candidatura"? ❌ Confirma quebra.
- [ ] **Microaction com fonte:** abrir /gaps, expandir uma microação. Vejo `[Currículo]` ou `[Mercado]` ou `[Base de Vagas]` ao final do "Por que importa"? ❌ Stripped. Mesmo experimento no /dashboard sub-scores: ✅ (chip visível).
- [ ] **Comeback trigger:** fazer login. Fechar tudo. Voltar 2 dias depois. Recebi push/email "Sua busca está esperando"? ⚠️ Recebo daily briefing diário independente; não há trigger específico de comeback.
- [ ] **Streak:** completar daily quest 2 dias seguidos. Vejo "🔥 2 dias seguidos" em algum lugar? ❌ Streak não é renderizado.
- [ ] **Independência editorial:** abrir /gaps com gaps gerados. Nos cursos sugeridos (cards Tera/Alura/etc), há microcopy "sem comissão / sem viés"? ❌ Não.
- [ ] **ICP detectada:** rodar onboarding novo (modo experimentar OK pra teste). Em algum momento sou perguntado sobre meu MOMENTO de carreira (transição forçada vs migração voluntária vs primeiro emprego)? ❌ As 6 perguntas são fixas e ignoram momento.
- [ ] **Jamar / case real:** abrir landing /. Vejo algum case concreto de candidato (com nome, anos sem job, history)? ❌ Só stats técnicos.
- [ ] **Comparação CareerTwin vs outros:** abrir landing ou /transparencia. Há tabela "vs Emprega.AI / vs LinkedIn / vs ChatGPT"? ❌ Não.
- [ ] **Diagnóstico de funil:** abrir /funil. Após preencher semanas, vejo bottleneck identificado? ✅ (`BottleneckBanner`). Bottleneck tem CTA contextual ("Adaptar CV pra triagem")? ❌ Texto livre sem deep link.

---

*Que esta verdade chegue inteira aos Senhores Élficos. — Gwaihir.*
