# E2E Functionality Audit — Éowyn — 2026-06-26

Re-percorrida da jornada do candidato pós Wave 10A. Research-only, comparando o estado atual com o que a auditoria UX Flows Wave 9 (`docs/design-audit/eowyn-ux-flows-2026-06-25.md`) flagou. Vocabulário central preservado: **loop quebrado** quando uma feature termina sem deep link contextual pro próximo passo da jornada.

## Executive Summary

1. **Wave 10A endereçou apenas 3 das 9 dores flagadas na Wave 9.** Resolveu `/candidaturas` (movido pro AppShell, links corrigidos), `/estagios → /linkedin` 404, e restaurou SrcChip em Radar/MicroactionCard. **Os outros 6 dead-ends continuam exatamente como na Wave 9.**
2. **O dead-end mais crítico (Radar sem CTA "Adaptar"/"Salvar") continua intocado.** `app/(app)/oportunidades/RadarClient.js:385-398` — o único CTA por card de vaga ainda é `Ver vaga original ↗` externa. Loop 1→2 e 1→4 seguem totalmente quebrados.
3. **Empty state de `/cvs-adaptados` continua mentindo.** `app/(app)/cvs-adaptados/page.js:94-97` ainda instrui o user a clicar num botão "Adaptar currículo →" no Radar que não existe.
4. **3 modais órfãos continuam órfãos** — WelcomeModal, OutcomeSurveyModal e TailorModal. Resultado mais grave: o **cron de outcome-survey envia emails apontando pra `/dashboard?survey=30d` esperando modal abrir, mas o dashboard ignora o parâmetro** (`grep "survey" dashboard/page.js` = 0 resultados). **Loop 6→7 morto na infraestrutura, em produção.**
5. **Zero deep-links contextuais implementados.** `grep -rn "fromJob=\|?skill=\|?milestone=\|?reason=\|?cvId="` retorna **0 ocorrências** em todo o repo. Continua "constelação de ilhas".

---

## Status por dead-end Wave 9

| # | Dead-end Wave 9 | Wave 10A entregou? | Status agora | Evidência |
|---|---|---|---|---|
| 1 | Radar sem CTA Adaptar/Salvar | NÃO | ❌ continua quebrado | `app/(app)/oportunidades/RadarClient.js:385-398` — só `Ver vaga original ↗` |
| 2 | `/cvs-adaptados` empty state mente | NÃO | ❌ continua mentindo | `app/(app)/cvs-adaptados/page.js:94-97` — instrui botão inexistente |
| 3 | `/candidaturas` fora do AppShell | SIM (`6926723`) | ✅ resolvido | `app/(app)/candidaturas/` existe; layout `(app)` envolve; antiga `app/candidaturas/` deletada |
| 4 | `/candidaturas` link `/meu-gemeo` | SIM (`6926723`) | ✅ resolvido | `KanbanClient.js:142,146-148` aponta pra `/oportunidades` ("Radar de vagas") |
| 5 | WelcomeModal órfão | NÃO | ❌ ainda órfão (substituto inline funciona) | `grep "<WelcomeModal" = 0`. `WelcomeBanner` server-component renderiza em `dashboard/page.js:182` |
| 6 | OutcomeSurveyModal órfão (cron→destino morto) | NÃO | ❌ ainda órfão. **Loop morto em produção** | `grep "<OutcomeSurveyModal" = 0`. Cron `app/api/cron/outcome-survey/route.js:67` envia email pra `/dashboard?survey=30d`, dashboard não lê o param |
| 7 | TailorModal órfão fora de `/experimentar` | NÃO | ❌ ainda órfão | `components/TailorModal.js` só consumido em `components/Report.js:380` (modo `/experimentar`) |
| 8 | `/estagios` link 404 `/linkedin` | SIM (commit `60f8096`) | ✅ resolvido | `app/(app)/estagios/page.js:116` aponta pra `/conta` (texto "pra otimizar seu perfil") |
| 9 | Microactions honor-system "Marcar concluída" | NÃO | ❌ continua | `app/(app)/gaps/MicroactionCard.js:225` ainda "✓ Concluída (desfazer)" |
| 10 | DailyQuest honor-system "Marquei feito" | NÃO | ❌ continua | `app/(app)/dashboard/DailyQuestCard.js:96-103` ainda só "Marquei como feito" |
| 11 | Zero deep-links contextuais | NÃO | ❌ continua | `grep -rn "fromJob=\|?skill=\|?milestone=\|?reason=\|?cvId="` = 0 |
| 12 | Streaks invisíveis | NÃO | ❌ continua | `grep -rn "streak\b"` em `app/` + `components/` = 0 ocorrências relevantes |
| 13 | `/carreira` sem CTA outbound | NÃO | ❌ continua | `app/(app)/carreira/page.js:239-269` skills/actions/evidence puro texto, não-Link |
| 14 | `/plano` timeline não-clicável | NÃO | ❌ continua | `app/(app)/plano/page.js:394-468` TimelineRow puro display |
| 15 | `/autoconhecimento` resultado sem deep-link | PARCIAL | ⚠️ texto melhor, deep-link continua ausente | `app/(app)/autoconhecimento/[kind]/AssessmentClient.js:573-584` mostra "Cargos que costumam combinar" como `<li>` simples, sem Link pra `/oportunidades` |

**Score Wave 10A:** 3 resolvidos + 1 parcial + 11 abertos = 4 / 15 (~27%).

---

## Loop fechado pós Wave 10A

7 passos da jornada (Discovery):

1. Entender oportunidade → `/oportunidades` (Radar)
2. Adaptar materiais → `/cvs-adaptados` + `/evidencias`
3. Superar lacunas → `/gaps`
4. Candidatar → `/candidaturas`
5. Preparar entrevistas → não existe
6. Acompanhar → `/candidaturas` (kanban)
7. Aprender → `/funil` + Outcome

| Transição | Status | Evidência |
|---|---|---|
| 0 → 1 (dashboard → radar) | ✅ ok | `app/(app)/dashboard/page.js` sidebar tem `/oportunidades` |
| 1 → 2 (radar → adaptar CV) | ❌ **quebrado** | `RadarClient.js:385-398` só URL externa, sem trigger TailorModal |
| 1 → 4 (radar → salvar candidatura) | ❌ **quebrado** | mesmo card, sem SaveJobButton |
| 2 → 4 (CV adaptado → salvar candidatura) | ❌ **quebrado** | `app/(app)/cvs-adaptados/[id]/page.js:87-98` só "← Voltar para CVs adaptados". Nada de "Criar candidatura com este CV" |
| 3 → 1 (fechei gap → ver vagas onde vale) | ❌ **quebrado** | `MicroactionCard.js:215-228` só toggle "Concluir/Desfazer" |
| 3 → 2 (fechei gap → registrar evidência da skill) | ❌ **quebrado** | nenhum link MicroactionCard → /evidencias com skill preservada |
| 4 → 6 (candidatei → tracking) | ✅ ok | `/candidaturas` Kanban funciona dentro do AppShell |
| 6 → 7 (acompanhar → outcome survey) | ❌ **morto em produção** | Cron envia email `/dashboard?survey=30d` mas dashboard não monta `OutcomeSurveyModal` nem lê searchParam |
| 7 → 1/2/3 (funil aponta gargalo → ação contextual) | ⚠️ parcial | `lib/funnel.js:120-181` linka por stage (triagem→/cvs-adaptados, hm→/autoconhecimento, final→/evidencias, offer→/plano) **sem filtro/contexto na URL** |
| autoconhecimento → 1 (perfil → cargos sugeridos) | ⚠️ texto presente, link ausente | `AssessmentClient.js:573-584` |
| /carreira milestone → 3 (trabalhar skills) | ❌ **quebrado** | `carreira/page.js:239-263` skills/actions são texto |
| /plano timeline → reabrir item | ❌ **quebrado** | `plano/page.js:394-468` `TimelineRow` não-Link |

**Sumário:** dos ~12 transições críticas, apenas **2 fechadas** (0→1, 4→6). O resto continua quebrado ou parcial. Wave 10A não tocou nessa frente.

---

## SrcChip presença

Status pós commit `e773e6b`:

- ✅ `app/(app)/gaps/MicroactionCard.js:148` — chip renderizado no "porque" do gap
- ✅ `app/(app)/oportunidades/RadarClient.js:381` — chip renderizado no "porque" da vaga
- ✅ `components/SrcChip.js:20` — componente próprio + estilos
- ⚠️ `components/Report.js:213,270` — usa `splitSrc` helper local em vez do `<SrcChip>` global, mas FUNCIONA (mostra `[Fonte]` na frente do texto). Inconsistente, mas não falha de transparência.

**Lugares onde faria sentido ter SrcChip mas NÃO tem (potencial Wave 10C):**

- `app/(app)/dashboard/page.js` — SubScores breakdown, "Por que esse score?". Score é o moat #1 de transparência mas dashboard só mostra os números crus, sem chip de fonte para o usuário entender "esse 76 vem de RAG da vaga + BLS pra mercado".
- `app/(app)/carreira/page.js` — path/milestones vêm de RAG mas não há indicação visual.
- `app/(app)/plano/page.js` — timeline events (gap_completed, application_event) deveriam mostrar fonte.

**Stripping de fontes:**
- Não encontrei stripping LLM em componentes além das duas regex já conhecidas (`RadarClient.js:377`, `MicroactionCard.js:78`) — ambas extraem `[Fonte]` pra passar pro `<SrcChip>`, não strippam de fato. **OK.**

---

## Onboarding ICP

**`components/OnboardingChat.logic.js:6-50`** — exatamente o mesmo array `QUESTIONS` da Wave 9. **6 perguntas fixas**: name, currentRole, years, skills, achievements, education. Nenhuma pergunta sobre "momento de carreira" (transitioning/searching/exploring/employed). ICP do Discovery doc continua **não detectada**.

**WelcomeModal**: comentário em `components/WelcomeModal.js:20-21` ainda diz "USO (TODO manual): adicionar `<WelcomeModal />` em app/(app)/layout.js quando consolidar". Nunca foi adicionado. Substituto inline funciona (`WelcomeBanner` em `dashboard/page.js:287-333`).

Email de boas-vindas é disparado: `app/api/auth/welcome-sent/route.js:3` confirma "Chamado pelo cliente apos o WelcomeModal montar". Como modal não monta, esse trigger **nunca dispara em produção**, então o email de boas-vindas inteiro está dormindo.

---

## Empty/Error states

| Rota | Empty state | Status | Evidência |
|---|---|---|---|
| `/oportunidades` (sem snapshot) | ✅ direciona pra dashboard | ok | `oportunidades/page.js:30-46` |
| `/oportunidades` (sem vagas) | ⚠️ honesto "tente daqui horas" sem CTA imediato | ok mas frustra | `RadarClient.js:185-223` |
| `/cvs-adaptados` (vazio) | ❌ **MENTE** | continua quebrado | `cvs-adaptados/page.js:94-97` instrui botão inexistente |
| `/candidaturas` (vazio) | ✅ Wave 10A corrigiu | resolvido | `KanbanClient.js:139-154` aponta pra `/oportunidades` (Radar de vagas) |
| `/gaps` (sem target) | ✅ direciona /conta + /dashboard | ok | `gaps/page.js:338-342` |
| `/evidencias` (vazio) | ⚠️ redundante (form acima já mostra) | ok mas sub-ótimo | `evidencias/page.js:116-125` |
| `/funil` (vazio) | ✅ excelente "Comece registrando esta semana" | ok | `funil/page.js:94-117` |
| `/carreira` (sem path) | ✅ lista paths | ok | server-render |
| `/plano` (0 snapshots) | ✅ direciona | ok | server-render |
| `/dashboard` (sem snapshot) | ✅ CTA "Construir meu gêmeo" | ok | `dashboard/page.js:264-281` |
| `/autoconhecimento` | ✅ cards "Pendente" claros | ok | server-render |

**Error states**: padrão "Não consegui X. Tenta de novo daqui a pouco." está bem aplicado (`KanbanClient.js:71-72`, `ActionCardClient.js:88-97`, etc). Honesto, sem promessa, sem tom punitivo. ✅

**Veredito empty:** dos 11 empty states críticos, 1 segue mentindo (`/cvs-adaptados`), 1 foi corrigido pela Wave 10A (`/candidaturas`), os outros estão ok ou sub-ótimos sem dolo.

---

## Feedback emocional

### Acertos preservados
- `KanbanClient.js:30-37` — "Recusas acontecem. Use pra entender padrão, não pra punir." continua excelente
- `KanbanClient.js:115` — "Não consegui criar a candidatura. Tenta de novo daqui a pouco" — humano
- `funil/page.js` BottleneckBanner — analítico sem ser frio
- `dashboard/page.js:309-313` WelcomeBanner — informativo e calmo

### Erros que CONTINUAM (Wave 10A não tocou)
- `MicroactionCard.js:225` ao concluir: "✓ Concluída (desfazer)" — celebra zero. Falta o equivalente "Excelente! +X pts → próxima ação"
- `DailyQuestCard.js:93` ao concluir: "✓ Concluído — volta amanhã pra próxima" — não cristaliza recompensa (carteira XP ausente)
- `ActionCardClient.js:132` "Concluir →" puro mecânico (mesmo problema)
- `dashboard` "+{projectedGain} pts projetados" + microcopy "clique em 'Atualizar diagnóstico' abaixo pra cristalizar" — tom técnico ("cristalizar")
- `/autoconhecimento` disclaimer (linha ~219) — tom legal/frio

**Conclusão emocional:** Wave 10A focou em estrutura (rotas, AppShell, SrcChip) e não tocou em microcopy de momento de celebração. O loop habit/gamification continua **sem celebrar a vitória do user**.

---

## Funcionalidades quebradas latentes

### ✅ Funcionando

- **NotificationsBell** (`components/AppShell.js:270`) monta drawer, click marca lido (`NotificationsBell.js:168-184`), link "Ver detalhes" usa `safeHref` (`linha 316-323`).
- **AchievementToast** (`components/AchievementToast.js`) montado via NotificationsBell drawer trigger (`NotificationsBell.js:194-199`) — toast aparece quando `kind=ACHIEVEMENT_UNLOCKED` chega.
- **CopilotWidget** (`components/AppShell.js:330`) montado, com sugestões contextuais por rota (`CopilotWidget.js:117-165` — 7 contextos diferentes, bem feito).
- **Funnel analyzer** (`lib/funnel.js:108-181`) end-to-end funcional, gera análise por stage, linka pra rota relacionada (genérica mas linka).
- **DailyQuest** (`dashboard/page.js:222` montado se `latest`) aparece no dashboard.

### ❌ Quebrado/Invisível

- **Streaks**: zero ocorrências de `streak` em `app/` ou `components/`. Tabela `Streak` no schema (se existir) não tem UI. **Habit loop sem visualização.**
- **OutcomeSurveyModal**: cron `app/api/cron/outcome-survey/route.js:67` envia email apontando pra `/dashboard?survey=30d`. Dashboard **não monta o modal nem lê `searchParams.survey`**. Confirme: `grep "survey" app/(app)/dashboard/page.js` = 0 hits. **Pipeline 6→7 quebrado em produção.** Para usuários com 30/60/90 dias no produto, isso é o feedback loop de Outcome (caso Jamar do Discovery).
- **WelcomeModal**: substituto inline `WelcomeBanner` funciona, mas o email de boas-vindas via `/api/auth/welcome-sent` nunca dispara porque o modal nunca monta (`WelcomeModal.js` é client-only e nunca renderizado).
- **TailorModal**: pronto e funcional dentro de `Report.js:380`, mas Report.js só é usado em `/experimentar` (modo efêmero anônimo). User logado nunca vê.

### ⚠️ Limítrofe

- **Achievement unlock por fluxo natural** — `grantAchievement` é chamado em (não auditei exaustivamente, mas) `gap-complete` route. Trigger funcional. Problema: **nada celebra na própria página onde o user fez a ação** — depende do toast aparecer via NotificationsBell, e o toast só aparece se o user já viu badge nova OU se já havia notificação `ACHIEVEMENT_UNLOCKED` não-vista. Fluxo é "marcou gap → recarregou → talvez bell tem badge → talvez toast aparece". **Fricção alta pro feedback emocional.**

---

## Findings priorizados

### P0 — Loop quebrado em produção (bloqueia core flow)

1. **Radar sem CTA Adaptar/Salvar** (`app/(app)/oportunidades/RadarClient.js:385-398`) — **#1 problema do produto, segue intocado.** Reutilizar lógica de `Report.js:307-319` (TailorModal trigger + SaveJobButton). Sem isso, o Radar é cosmético.

2. **OutcomeSurveyModal renderer no /dashboard** (`app/(app)/dashboard/page.js`) — montar modal client-side que lê `searchParams.survey`, exibe pesquisa quando `?survey=30d|60d|90d`. **Cron já está enviando emails há semanas pra uma página que ignora o parâmetro.** Loop 6→7 morto em produção é P0 absoluto.

3. **`/cvs-adaptados` empty state mente** (`app/(app)/cvs-adaptados/page.js:94-97`) — quick win: ou (a) atualizar copy pra "Por enquanto, crie um CV adaptado via /experimentar ou aguarde adaptar uma vaga no Radar (em breve)"; ou (b) preferível, resolver junto com P0#1.

### P1 — Funcionalidade existe mas escondida / loop subutilizado

4. **Achievement celebration no momento da ação** — quando user marca gap concluído (`MicroactionCard.js:215-228`), substituir "✓ Concluída (desfazer)" por celebração inline com link pra próxima ação. Não depender do bell.

5. **Sistema de deep-link contextual (1ª onda)**:
   - `/gaps` MicroactionCard → `/oportunidades?skill={skill}` ("Ver vagas onde isso vale")
   - `/gaps` MicroactionCard → `/evidencias?skill={skill}` ("Registrar evidência")
   - `/oportunidades` skills falta → `/gaps?skill={skill}` (clicar na skill falta abre o gap)
   - `/cvs-adaptados/[id]` → `/candidaturas?cvId={id}` ("Salvar candidatura com este CV")

6. **OnboardingChat ICP question** — adicionar 7ª pergunta sobre momento de carreira em `OnboardingChat.logic.js:6-50`. Salvar em Profile pra filtrar copy posterior.

7. **WelcomeModal vs WelcomeBanner — decisão de produto.** Hoje banner inline funciona mas é menos enfático que modal. Ou monta modal em `app/(app)/layout.js` e remove banner, ou remove modal e mantém banner como sistema oficial.

### P2 — UX confusa / hierarquia

8. **`/carreira` milestones outbound** — cada skill vira Link `/gaps?milestone={i}`, cada evidência vira Link `/evidencias?milestone={i}`. Hoje é wall of text.

9. **`/plano` timeline clicável** — `TimelineRow` (`plano/page.js:394-468`) virar Link de acordo com `item.type`:
   - `gap_completed` → `/gaps#{gapId}`
   - `application_event` → `/candidaturas#{applicationId}`
   - `diagnosis` → `/dashboard`

10. **Funnel analyzer deep-link** — `lib/funnel.js:120-181` passar contexto na URL (ex: `link: "/cvs-adaptados?reason=triagem"`).

11. **`/autoconhecimento` cargos sugeridos viram Link** — `AssessmentClient.js:573-584` substituir `<li>{c}</li>` por `<Link href="/oportunidades?role={c}">{c}</Link>`.

### P3 — Polish / streaks / microcopy

12. **Streaks visíveis** — adicionar `StreakBadge` no dashboard (ou sidebar). Sem visualização, habit loop é teórico.

13. **DailyQuest "Ir fazer agora"** — `DailyQuestCard.js:96-103` adicionar Link contextual antes do "Marquei como feito" baseado em `quest.title`.

14. **Microcopy de celebração ao subir score** — quando user "Atualizar diagnóstico" e score sobe, mostrar momento visual em vez de só atualizar o ring.

---

## Roteiro de teste manual (founder confirma — TOP 10)

- [ ] **Radar sem CTA**: Abrir `/oportunidades`. Em qualquer vaga, confirmar que **o único CTA é "Ver vaga original ↗"**. (Esperado: confirmar quebra.)
- [ ] **CVs adaptados mente**: Abrir `/cvs-adaptados` com 0 CVs. Ler empty state. Tentar seguir instrução. (Esperado: chegar em /oportunidades e não encontrar "Adaptar currículo →".)
- [ ] **Candidaturas resolvido**: Abrir `/candidaturas`. Confirmar **sidebar visível** (AppShell). Confirmar empty state aponta pra `/oportunidades` (Radar de vagas). (Esperado: ok.)
- [ ] **Estágios resolvido**: Abrir `/estagios`. Verificar dica do banner. Confirmar link **`/conta`** (não /linkedin). (Esperado: ok.)
- [ ] **Outcome survey morto**: Abrir `/dashboard?survey=30d` direto na URL. Confirmar que **nada acontece** (modal não monta). (Esperado: confirmar quebra.)
- [ ] **Microaction sem ponte**: Em `/gaps`, completar 1 microação. Confirmar que **apenas botão "✓ Concluída (desfazer)" aparece**, sem link pra "Ver vagas onde isso vale" ou "Registrar evidência". (Esperado: confirmar quebra.)
- [ ] **DailyQuest sem link**: No `/dashboard`, confirmar DailyQuestCard. **Único CTA é "Marquei como feito"**, sem link pra DOing a quest. (Esperado: confirmar quebra.)
- [ ] **OnboardingChat ICP**: Em `/experimentar` modo chat, confirmar **6 perguntas, nenhuma sobre momento de carreira** (transitioning/searching/exploring). (Esperado: confirmar gap.)
- [ ] **SrcChip Radar+Gaps**: Confirmar chip `[Fonte]` aparece em cards de `/oportunidades` e `/gaps`. (Esperado: ok — Wave 10A restaurou.)
- [ ] **Notification flow**: Forçar uma notif (gap_completed via API ou aguardar daily-briefing). Abrir Bell drawer. Click → marca lido. (Esperado: ok.)

---

## Veredito

> **"Wave 10A destravou o loop?"**

**PARCIALMENTE — mas a destrava foi de PERIFERIA, não de CORE.**

A Wave 10A resolveu pontos importantes de **acessibilidade do app shell** (`/candidaturas` agora tem sidebar, links legacy corrigidos, `/estagios` sem 404, SrcChip restaurado pra moat de transparência). Esses são P0/P1 estruturais legítimos e bem entregues.

**Mas o loop CORE da jornada — entender oportunidade → adaptar → candidatar — continua quebrado exatamente como na Wave 9.** O Radar segue com URL externa como único CTA. O empty state de `/cvs-adaptados` ainda manda o user pra uma instrução impossível. Os 3 modais órfãos seguem órfãos. Zero deep-link contextual foi implementado. **Para o usuário que se loga, a experiência de "fazer algo concreto no produto após ver uma vaga" não mudou.**

Pior: o **cron de outcome-survey já está em produção mandando emails com link pra um destino que NÃO renderiza o modal esperado**. Quem completa 30/60/90 dias no produto está recebendo um link broken. **Loop 6→7 (aprender com outcome) está oficialmente quebrado em produção.** Isso é P0 que precisa entrar na próxima onda antes de qualquer feature nova.

A frase fechamento da Wave 9 continua válida: *"a jornada do candidato hoje tem todas as peças construídas, mas as peças não conversam entre si"*. Wave 10A conectou apenas 3 fios. Faltam mais ~10 conexões críticas pro produto sair de "constelação de ilhas" pra "funil real".

**Recomendação de Éowyn:** próxima onda deve atacar (1) Radar + Adaptar + Salvar como pacote único, (2) OutcomeSurveyModal renderer no /dashboard (pipeline já em produção, perdendo dado), e (3) primeira onda de deep-links (`?fromJob=`, `?skill=`, `?cvId=`). Essas 3 frentes destravam ~70% do loop que segue quebrado.

— Éowyn, escudeira de Rohan
