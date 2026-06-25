# UX Flows Audit — Éowyn — 2026-06-25

Auditoria RESEARCH-ONLY da jornada do candidato vs. os 7 passos da Discovery oficial. Vocabulário central: **loop quebrado** — quando uma feature termina sem deep link contextualizado pro próximo passo da jornada, deixando o user órfão.

## Executive Summary

1. **O Radar de vagas é um beco-sem-saída total.** `app/(app)/oportunidades/RadarClient.js:374-387` só oferece "Ver vaga original ↗" (URL externa). Os botões "Adaptar currículo →" e "+ Salvar candidatura" existem APENAS no componente legacy `components/Report.js:315-318` (usado só em `/experimentar` após diagnóstico). O usuário logado que abre /oportunidades **não consegue agir dentro do produto**. Loop 1→2 e 1→4 totalmente quebrados.

2. **`/cvs-adaptados` mente sobre o fluxo.** O empty state em `app/(app)/cvs-adaptados/page.js:94-98` diz literalmente "Vá em /oportunidades, clique em 'Adaptar currículo →'" — mas esse botão **não existe** lá. O empty state instrui o user a fazer algo impossível. Loop 2 quebrado na ENTRADA.

3. **`/candidaturas` tem links pra rotas mortas.** `app/candidaturas/page.js:30,46` e `app/candidaturas/KanbanClient.js:141-147` linkam pra `/meu-gemeo` (legacy que redireciona pra /dashboard, mas o copy diz "Meu gêmeo → Vagas" — uma aba inexistente). Pior: `/candidaturas` está FORA do AppShell — não usa o layout `(app)`. Quem entra perde a sidebar e perde contexto de "tô no app".

4. **`/estagios` tem link 404.** `app/(app)/estagios/page.js:116` aponta pra `/linkedin`, que não existe (só `/api/linkedin/parse`). Dica visual virá quebrada.

5. **3 componentes órfãos comprometendo o onboarding e o loop 6→7:** `WelcomeModal` (nunca é renderizado — `components/WelcomeModal.js:20` declara "TODO manual: adicionar em (app)/layout.js" e ninguém adicionou); `OutcomeSurveyModal` (zero pontos de montagem, mas o cron `app/api/cron/outcome-survey/route.js` assume que ele vai aparecer no dashboard); `TailorModal` (mencionado em empty states mas não conectado ao Radar).

6. **Microactions são honor-system.** `MicroactionCard` e `ActionCardClient` só têm "Marcar como concluída". Não há link pra cumprir a ação (curso → ✓), nem pra registrar evidência da skill (em /evidencias), nem pra refiltrar /oportunidades pela skill que acabou de fechar. Loop 3→4 silencioso.

7. **DailyQuest sem destino.** `DailyQuestCard.js:96-103` tem só "Marquei como feito" — sem link pra DOing the quest. Habit loop quebrado.

---

## Mapa de rotas → passos da jornada

| Rota | Passo(s) | Entrada natural | Saída natural | Loop fechado? |
|---|---|---|---|---|
| `/` (landing) | pré-1 | (público) | /experimentar ou /entrar | ✅ ok |
| `/experimentar` | 1 (entry) | / | /dashboard (se logado) ou /entrar | ⚠️ parcial — pós-diagnóstico mostra Report.js com ações completas, mas user logado é redirecionado pra /dashboard que NÃO tem essas ações |
| `/entrar` | 1 (entry) | / | /dashboard | ✅ ok |
| `/dashboard` | 1 (resumo) + 3 (próximas ações) | /experimentar, /entrar | /gaps, /oportunidades, /cvs-adaptados | ⚠️ parcial — ActionCardClient só tem "Concluir" sem link pra fazer a ação |
| `/oportunidades` | **1** | /dashboard | **deveria ir pra /cvs-adaptados?fromJob=X e /candidaturas (save)** | ❌ **QUEBRADO** — só "Ver vaga original ↗" (externa). Sem Adaptar, sem Salvar. |
| `/gaps` | **3** | /dashboard, /oportunidades | **/evidencias (registrar evidência), /oportunidades (filtrar por skill que fechei)** | ❌ **QUEBRADO** — só "Marcar concluída" + cursos externos |
| `/cvs-adaptados` | 2 (lista) | /oportunidades (teoricamente) | /candidaturas | ❌ **QUEBRADO na ENTRADA** — empty state instrui fluxo impossível |
| `/cvs-adaptados/[id]` | 2 (detalhe) | /cvs-adaptados | **deveria ir pra /candidaturas (salvar com este CV) ou /oportunidades original** | ⚠️ parcial — só "← Voltar para CVs adaptados" |
| `/evidencias` | 2 (suporte) | /gaps, /carreira | **deveria sugerir /candidaturas onde a evidência se aplica** | ❌ ilha — não recebe e não manda ninguém |
| `/autoconhecimento` + `[kind]` | pré-1 (autoconhecimento de valores) | (descoberta lateral) | **deveria sugerir cargos-alvo compatíveis em /conta** | ❌ ilha — termina e fica aí |
| `/carreira` | 3 + 7 (visão macro) | /dashboard | **deveria linkar cada milestone → /gaps filtrado por skills daquele milestone, /evidencias pra evidência esperada** | ❌ **QUEBRADO** — zero CTAs outbound, é "wall of text" |
| `/plano` | 7 (timeline histórico) | /dashboard | **deveria reabrir o item — gap, candidatura, plano** | ⚠️ — timeline rica mas não-clicável |
| `/concursos` | 1 (alt) | (sidebar) | "Ver edital" externa | ❌ **QUEBRADO** mesmo padrão do Radar — sem Salvar candidatura nesta vaga pública |
| `/estagios` | 1 (alt) | (sidebar) | externa | ❌ **QUEBRADO** + link 404 pra /linkedin |
| `/funil` | **7** | /dashboard, sidebar | suggestion link contextual baseado em bottleneck | ✅ **ÚNICA rota com deep-link contextual** (`lib/funnel.js:120-179`) |
| `/candidaturas` | **4 + 6** | sidebar, /oportunidades (deveria) | nenhum saída | ❌ **QUEBRADO** — fora do AppShell, links pra `/meu-gemeo` (legacy) |
| `/conta` | suporte | sidebar | revalidatePath /conta | ⚠️ ok pra config, mas não orienta próximo passo |
| `/transparencia` | suporte (explica) | dashboard "Como calculamos" | volta pro dashboard | ✅ ok |
| `/meus-dados` | suporte LGPD | /conta | — | ✅ ok |
| `/admin` | n/a | n/a | n/a | n/a |

---

## Dead-ends concretos (P0)

Lista priorizada — rotas onde o user fica órfão hoje:

1. **`/oportunidades`** (`app/(app)/oportunidades/RadarClient.js:316-441`): card de vaga termina em URL externa e botão expandir breakdown. Zero CTAs in-app. Esta é a porta principal pro passo 1 da jornada. **#1 quebra do produto.**
2. **`/cvs-adaptados` (lista)** (`app/(app)/cvs-adaptados/page.js:91-99`): empty state literal: "Vá em /oportunidades, clique em 'Adaptar currículo →'". O botão **não existe**. User segue a instrução e bate no muro.
3. **`/cvs-adaptados/[id]`** (`app/(app)/cvs-adaptados/[id]/page.js:86-98`): após ver o diff, único CTA é "← Voltar". Não oferece "Salvar candidatura usando este CV" nem "Aplicar pra essa vaga".
4. **`/gaps` microactions** (`app/(app)/gaps/MicroactionCard.js:201-213`): "Marcar como concluída" sem ponte pra cumprir a ação (sem link pro curso recomendado vinculando "agora eu fechei" → "ver vagas que aceitam esse skill").
5. **`/evidencias`** (`app/(app)/evidencias/page.js:115-136`): empty state textual sem CTA. List view sem hint de onde a evidência serve (não conecta com /candidaturas ou /carreira).
6. **`/carreira`** (`app/(app)/carreira/page.js:188-275`): renderiza milestones com skills + actions + evidência, mas é puro texto. Skills bullets não linkam pra /gaps. "Evidência pra fechar este milestone" não linka pra /evidencias.
7. **`/autoconhecimento`** (`app/(app)/autoconhecimento/page.js`): após completar 3 assessments, **nenhum link** pra "cargos que combinam com seu perfil" — apesar de CARD_BENEFITS textualmente mencionar "arquetipo + cargos que combinam" (linha 22).
8. **`/concursos`** (`app/(app)/concursos/page.js:262-287`): card de concurso = "Ver edital ↗" externo. Sem "Salvar pra acompanhar", sem "Adaptar CV pra concurso público".
9. **`/estagios`** (`app/(app)/estagios/page.js:380-390`): mesmo padrão + bug: link em `linha 116` pra `/linkedin` é rota inexistente.
10. **`/candidaturas`** (`app/candidaturas/`): rota completamente fora do AppShell (sem sidebar). Links navegacionais (linhas 30, 46) e empty state (KanbanClient.js:141, 146) apontam pra `/meu-gemeo` legacy, com microcopy "Meu gêmeo → Vagas" — aba inexistente. User perde contexto.

---

## Loop quebrado (anti-padrões)

### Anti-padrão 1: Feature termina em URL externa sem capturar contexto

> "Radar = vaga sem detalhe é o pior exemplo conhecido"

**Confirmado e amplificado.** Ocorre em:

- `app/(app)/oportunidades/RadarClient.js:374-387` — único CTA é `<a href={safeHref(job.url)} target="_blank">Ver vaga original ↗</a>`. Sem capturar `vaga.id` em URL, sem opção de salvar antes de clicar, sem opção de adaptar CV antes.
- `app/(app)/concursos/page.js:262-287` — `<a href={c.url} target="_blank">Ver edital</a>` mesma trampa.
- `app/(app)/estagios/page.js:380-390` — mesma trampa.
- `app/(app)/gaps/MicroactionCard.js:160-189` — cursos sugeridos abrem em aba nova sem salvar progresso pro usuário voltar.

**Loop quebrado:** passos 1 (Radar/Concursos/Estágios) → 2 (Adaptar) e → 4 (Candidatar). User vai pra fora, faz a candidatura no site da empresa, **nunca volta pra registrar no /candidaturas**, e o produto perde o sinal de outcome (passo 7).

### Anti-padrão 2: User vê info mas não consegue agir (CTAs ausentes)

- **`/oportunidades`**: vê match% + breakdown + skills falta → não consegue: (a) adaptar CV pra essa vaga, (b) salvar pra Kanban, (c) ver gaps específicos dela.
- **`/cvs-adaptados/[id]`**: vê diff antes/depois → não consegue: (a) baixar PDF, (b) salvar como candidatura com este CV, (c) compartilhar.
- **`/evidencias`**: lista evidência → não consegue: (a) ver onde essa evidência casaria com qual vaga, (b) reusar em adaptação de CV.
- **`/plano`**: timeline rica de eventos → linhas inteiras não-clicáveis (`TimelineRow` em `app/(app)/plano/page.js:394-468` é puro display, não navega de volta pro item original).
- **`/autoconhecimento` results**: usuário completa 3 assessments → resultado é guardado mas nunca recheado em outras telas (não influencia targetRole sugerido em /conta, não filtra /oportunidades).

### Anti-padrão 3: Action numa feature não atualiza outra (sem deep link entre vizinhos)

Busca por `fromJob=`, `?gap=`, `?skill=` em todo o repo: **zero ocorrências**. O produto inteiro usa Links genéricos. Exemplos do que **deveria existir**:

- `/oportunidades` → `<Link href="/cvs-adaptados?fromJob={vaga.id}">Adaptar pra esta vaga</Link>` — não existe.
- `/gaps` (após "Marcar concluída") → `<Link href="/oportunidades?skill={gap.habilidade}">Ver vagas onde isso vale</Link>` — não existe.
- `/gaps` → `<Link href="/evidencias?skill={gap.habilidade}">Registrar evidência</Link>` — não existe.
- `/carreira` milestone → `<Link href="/gaps?milestone={i}">Trabalhar nestas skills</Link>` — não existe.
- `/cvs-adaptados/[id]` → `<Link href="/candidaturas?cvId={cv.id}">Criar candidatura com este CV</Link>` — não existe.
- `/funil` analysis.link = `/oportunidades` genérico (`lib/funnel.js:120`) — sem propagação do estágio bloqueado.

**Único caso parcial:** `/funil` `BottleneckBanner` rende um CTA "Agir agora" → analysis.link. Mas o link é sempre **genérico** (a rota raiz `/oportunidades`), nunca filtrada pelo bottleneck identificado (ex.: se "gargalo: triagem", deveria linkar pra `/cvs-adaptados` mostrando "comece adaptando CV pra próxima vaga").

### Anti-padrão 4: "Veja também" sem deep link contextualizado

- `app/(app)/dashboard/page.js:513-528` "Como calculamos →" linka pra /transparencia sem fragment pra subscore atual. User vai pra topo de página de explicação inteira.
- `app/(app)/cvs-adaptados/[id]/page.js:87-98` "← Voltar" volta pra lista, não pra vaga original.
- `app/(app)/oportunidades/RadarClient.js:524-526` "Mais detalhes em /transparencia" não destaca a seção do match formula.

### Anti-padrão 5: Score sobe sem motivo visível (quebra transparência)

- **Sobe sem cristalizar:** `dashboard/page.js:80-99` mostra "ganho projetado" mas só após click em "Atualizar diagnóstico" o overall muda. User pode marcar 5 gaps como done e ver "+15 pts projetados" no ring mas o ring "real" não mexe. **Microcopy explica** (`linha 436`: "clique em 'Atualizar diagnóstico' abaixo pra cristalizar"), mas é fácil ler como bug ("marquei e não mudou").
- **DailyQuest +pts no UI mas onde foram?** `DailyQuestCard.js:85` mostra "+{rewardPoints}pts" mas esse ponto não é cristalizado em lugar nenhum visível depois do click. Não há "carteira de XP" ou histórico de quests por dia.

### Anti-padrão 6: Daily Quest / Achievements desconectados do progresso real

- `DailyQuestCard.js:96-103` — único botão é "Marquei como feito". **Não tem link pra DOing a quest.** Se a quest é "atualize 1 skill no perfil", deveria ter `<Link href="/conta#skills">Ir fazer agora</Link>`. Hoje é puro honor system.
- `OutcomeSurveyModal.js` — componente existe mas **nunca é montado** (`grep -rn "<OutcomeSurveyModal"` = 0 resultados). O cron `app/api/cron/outcome-survey/route.js:5` assume que ele aparece no /dashboard, mas o dashboard não renderiza. Loop 6→7 **morto na infraestrutura** (cron envia notif → user clica → notif fica em pin no NotificationsBell mas modal nunca abre).
- `WelcomeModal.js` — mesma coisa. **Nunca é montado.** `components/WelcomeModal.js:20-21` explicitamente diz "USO (TODO manual): adicionar <WelcomeModal /> em app/(app)/layout.js" — ninguém adicionou. Onboarding modal pronto, no chão da fábrica.

**Atualmente em produção:** existe um `WelcomeBanner` server-component dentro de `dashboard/page.js:287-333` que cumpre parte do papel (banner inline, não modal). Mas é menos enfático e fica perdido se o user já rolou pra baixo.

---

## Hierarquia de informação por página

| Página | "Entendo em 3s?" | CTA principal claro? | Poluído? |
|---|---|---|---|
| `/` (landing) | ✅ Sim — Hero + How it works | ✅ "Construir meu gêmeo" | ⚠️ leve — 9 seções (Hero, Trust, Features, How, Social, Metrics, Stack, Pricing, FAQ) |
| `/experimentar` | ⚠️ — título "Construa seu gêmeo" mas brand panel competindo com input | ⚠️ "Gerar diagnóstico" mas LinkedinImportButton/PortfolioImportButton acima podem distrair | ❌ poluído — 3 modos de input (paste/chat), 3 botões de fonte, stepper, sources cards |
| `/dashboard` | ⚠️ — "Olá {firstName}" inicial bom; score ring é dominante; mas 6 seções abaixo (ScoreRing, SubScores, DailyQuest, SkillGraph, NextActions, ProfileSnapshot) sem hierarquia clara | ⚠️ qual o "próximo step"? Vários cards competem | ⚠️ |
| `/oportunidades` | ✅ "Radar de vagas" + filtros visíveis | ❌ **CTA principal de cada card é VER VAGA externa** — esse não é o objetivo do produto | ✅ limpo |
| `/gaps` | ✅ — 3 atos numerados (Onde você está / O que falta / O que fazer) — **melhor arquitetura informacional do app** | ✅ Microactions priorizadas | ✅ ok |
| `/cvs-adaptados` | ✅ lista clara | ✅ "Ver diff" | ✅ ok |
| `/cvs-adaptados/[id]` | ✅ — KPI strip + diff lado-a-lado | ❌ termina sem CTA — só "← Voltar" | ✅ |
| `/evidencias` | ✅ | ⚠️ "Adicionar evidência" via EvidenceForm fica no topo, sem orientação contextual ("qual evidência você está faltando?") | ✅ |
| `/funil` | ✅ — pergunta direta "Onde sua busca está parando?" | ✅ Form + Analysis + Chart | ✅ ok — provavelmente a melhor página |
| `/candidaturas` | ⚠️ — Kanban claro mas **sem sidebar** quebra o "tô no app" | ⚠️ "+ Nova candidatura" claro mas empty hero linka pra rota legacy | ⚠️ |
| `/carreira` | ⚠️ — milestones longos verticalmente, muita info por card (skills + actions + evidence + progress bar) sem fold visual | ❌ não tem CTA — só leitura | ❌ poluído |
| `/plano` | ✅ Chart + timeline numerada | ⚠️ chart é não-interativo, timeline não-clicável | ✅ |
| `/transparencia` | ✅ explica fórmula | n/a (página de explicação) | ✅ |
| `/autoconhecimento` | ✅ — 3 cards limpos | ✅ "Começar →" / "Refazer →" | ✅ |
| `/conta` | ⚠️ — página enorme (653 linhas), múltiplas seções (nome, target, achievements, plano premium, digest, deletar conta) sem segmentação visual | ⚠️ "Salvar" várias vezes em formulários distintos | ❌ poluído |

---

## Empty states e Erro states

| Página | Empty state | Estado de erro | Loading |
|---|---|---|---|
| `/oportunidades` | ✅ específico (`RadarClient.js:177-223`) — diferencia 0 vagas com filtros vs sem filtros, sugere reset ou refazer diagnóstico. **Mas** sugere "volte daqui a algumas horas" sem CTA acionável agora. | ✅ msg friendly | ✅ `ct-loading-skeleton` 3 cards |
| `/oportunidades` (sem snapshot) | ✅ direciona pra /dashboard (`page.js:30-46`) | ✅ | ✅ |
| `/gaps` (no target) | ✅ direciona pra /conta e /dashboard | ✅ | server-render |
| `/gaps` (sem jobs no provider) | ✅ msg honesta "tente daqui a horas" mas sem CTA acionável | ✅ | server-render |
| `/cvs-adaptados` | ❌ **engana o usuário** — manda pra ação inexistente | ✅ | server-render |
| `/evidencias` | ⚠️ — descreve "adicione projetos, cases…" mas **forma já está logo acima** — empty state redundante | ✅ | server-render |
| `/candidaturas` | ❌ — manda pra /meu-gemeo "vagas" inexistente (`KanbanClient.js:139-154`) | ✅ "Não consegui criar a candidatura. Tenta de novo daqui a pouco." (boa microcopy) | server-render |
| `/funil` | ✅ excelente — "Comece registrando esta semana" (`page.js:94-117`) | n/a | server-render |
| `/carreira` (no target) | ✅ links pra /conta + CTA primary | ✅ | server-render |
| `/carreira` (no path) | ✅ lista paths disponíveis | n/a | server-render |
| `/plano` (0 snapshots) | ✅ direciona pra /dashboard | n/a | server-render |
| `/plano` (1 snapshot) | ✅ educativo — "Refaça o diagnóstico daqui a 2-4 semanas" | n/a | server-render |
| `/autoconhecimento` | ✅ — cards "Pendente" claramente diferenciados | n/a | server-render |
| `/dashboard` (sem snapshot) | ✅ EmptyState component (`page.js:264-281`) com CTA "Construir meu gêmeo →" pra / | ✅ | server-render |

**Padrão preocupante:** dois empty states (`/cvs-adaptados`, `/candidaturas`) instruem fluxos impossíveis ou mortos.

---

## Onboarding e first-time

**1. User novo entra → o que vê?**
- Anonymous: `/` (landing premium com hero + 9 sections) → CTA principal "Construir meu gêmeo" leva pra `/experimentar`.
- Logged-in: `/` redireciona pra `/meu-gemeo` (que redireciona pra `/dashboard`).

**2. Modo experimentar (`/experimentar`) → como flui pra cadastro?**
- Anonymous gera diagnóstico → vê Report.js inline com 4 sections (incluindo "Adaptar currículo" + "Salvar candidatura" que SÓ aparecem aqui) → **footer** (`Report.js:357-376`) tem CTAs: "Continuar pro dashboard →" e "Construir outro gêmeo".
- SaveJobButton (`Report.js:425-430`) detecta anonymous (HTTP 401) e mostra "Entrar pra salvar →" → /entrar.
- **Ponto cego:** depois que o user faz login e volta pra /experimentar, ele entra direto no resultado salvo mas se for explorar o app via sidebar, a infra com "Adaptar currículo" etc. desaparece (Report.js é só efêmero no flow de /experimentar). Loop 1→2 quebra exatamente na transição anonymous→logged.

**3. Welcome modal funciona?**
- ❌ **Não.** `components/WelcomeModal.js` está pronto mas não é renderizado em lugar nenhum (`grep -rn "<WelcomeModal" = 0 resultados`). O comentário no topo do componente (`linha 20`) é honesto: "TODO manual: adicionar <WelcomeModal /> em app/(app)/layout.js".
- **Existe um substituto inline:** `WelcomeBanner` server-component em `app/(app)/dashboard/page.js:287-333` — banner inline (não modal) mostrado até user clicar "Não mostrar mais" (server action `dismissWelcomeAction` linhas 24-37). Funciona, mas é muito menos enfático que modal.

**4. Primeira vez no Radar → tem orientação?**
- Se não tem snapshot: mensagem clara em `oportunidades/page.js:30-46` ("Faça um diagnóstico no seu dashboard").
- Se tem snapshot e vagas: vê lista direto, **sem tooltip explicando que "Adaptar currículo" e "Salvar candidatura" não estão lá apesar do dashboard sugerir**. Vai querer fazer e bater no muro.
- Sem coach mark, sem highlight banner contextual no /oportunidades.

**5. OnboardingChat funciona?**
- `components/OnboardingChat.js` é montado dentro de `/experimentar` (linha 513). Após completar, retorna CV estruturado e dispara `setCv` (linha 517) — flui de volta pro modo "paste". ✅ bem feito.

---

## Feedback emocional (Gap #6 do Benchmarking)

> "Feedback honesto, específico e encorajador, sem prometer aprovação."

### Onde o microcopy ACERTA

- `/funil` `BottleneckBanner` (`page.js:136-213`) — analítico mas humano: "Baseado em X candidaturas das últimas 4 semanas. Agir agora →". Não promete sucesso, mas direciona.
- `/dashboard` `WelcomeBanner` first-time copy (`page.js:310-313`): "Cole seu currículo na home ou clique em 'Construir meu gêmeo'. Tudo fica salvo aqui." — informativo e calmo.
- `/dashboard` `EmptyState` (`page.js:264-281`): "Seu gêmeo ainda está em branco." — poético sem ser piegas.
- `/candidaturas` empty column microcopy (`KanbanClient.js:30-37`): "Recusas acontecem. Use pra entender padrão, não pra punir." — **excelente.** "Proposta na mão? Move pra cá. Boa sorte na negociação." — humano.
- `/oportunidades` retorno vazio (`RadarClient.js:185-223`): "Nenhuma vaga voltou agora. As fontes não responderam." — honesto.

### Onde o microcopy ERRA

- `/dashboard` "+{projectedGain} pts projetados" (`page.js:432-440`): mostra projeção mas pune com "clique em 'Atualizar diagnóstico' abaixo pra cristalizar". Microcopy é instrucional e técnica ("cristalizar"). Falta o "boa, você está investindo nas suas skills".
- `/gaps` MicroactionCard ao concluir (`MicroactionCard.js:208-212`): "✓ Concluída (desfazer)" — celebra zero. Deveria ter um momento de "fechou X. Aqui vai um próximo desafio". Falta o equivalente Duolingo do "Excelente! +5 pts → próxima".
- `/dashboard` ScoreRing baseline (`page.js:461-499`): "você está a X pontos da mediana de contratados." — tecnicamente certo mas pune. Deveria ter variante encorajadora quando o gap é < 10pts.
- `/autoconhecimento` disclaimer (`page.js:219-223`): "Importante: estes assessments são informativos. Não substituem MBTI/DISC oficial, avaliação psicológica ou consulta com psicólogo." — tom legal e frio. Justifica-se mas pode ser reformulado pra "pontos de partida — não verdades absolutas".
- `/conta` página de delete account (linha aproximadamente 600+) — tem que verificar mas tipicamente nesse tipo de página o tom é severo. Não auditei detalhe.
- **Streaks/achievements bem usados?** Existe sistema (`/lib/achievements` referenciado em /conta, e `AchievementToast.js` em `components/`). Não consegui validar se o toast é montado em fluxos reais (sem grep evidente fora de `components/AchievementToast.js`). **Achievement loop subutilizado** se for o caso.

---

## Findings priorizados

### P0 — Loop quebrado (bloqueia core flow)

1. **Adicionar botões "Adaptar currículo" e "+ Salvar candidatura" em `/oportunidades` RadarClient.js JobCard** (`app/(app)/oportunidades/RadarClient.js:374-387`). Reusar lógica de `Report.js:307-319` (TailorModal trigger + SaveJobButton). Sem isso, o Radar é cosmético.
2. **Arrumar empty state de `/cvs-adaptados`** (`app/(app)/cvs-adaptados/page.js:91-99`). Ou (a) consertar a inconsistência removendo a instrução, ou (b) — preferível — implementar P0#1 acima e manter o copy.
3. **Migrar `/candidaturas` pra dentro do AppShell** (mover de `app/candidaturas/` pra `app/(app)/candidaturas/`). Atualizar links legacy de `/meu-gemeo` pra `/oportunidades` em `app/candidaturas/page.js:30,46` e `KanbanClient.js:141,146`.
4. **Conectar `OutcomeSurveyModal` ao dashboard** ou outra rota acionada pelo cron. Hoje o cron envia notif sem destino funcional.
5. **Renderizar `WelcomeModal`** em `app/(app)/layout.js` (ou decidir que o `WelcomeBanner` inline atual é o substituto definitivo e remover o componente órfão).
6. **Fix do link 404 `/linkedin` em `/estagios`** (`app/(app)/estagios/page.js:116-119`).

### P1 — Hierarquia confusa / dead-ends de info

7. **Adicionar CTAs outbound em `/carreira` milestones**: cada `m.skills` virar Link pra `/gaps?milestone={i}`; cada `m.evidence` virar Link pra `/evidencias?milestone={i}`.
8. **Adicionar CTA "Salvar como candidatura" em `/cvs-adaptados/[id]`** com `cvId` preservado pra associar.
9. **`/oportunidades` JobCard "Por que esse match?" → linkar skills falta** pra `/gaps?skill={skill}` em vez de só listar.
10. **`/plano` timeline rows → clicáveis** (cada item linka pro recurso original — gap, application, snapshot).
11. **`/autoconhecimento` results → "cargos compatíveis"** baseado no resultado. CARD_BENEFITS (`autoconhecimento/page.js:14-27`) promete isso mas não entrega.
12. **`/funil` BottleneckBanner → propagar contexto** no `analysis.link`. Hoje sempre genérico (`lib/funnel.js:120` `/oportunidades` cru). Deveria ser `/cvs-adaptados?reason=triagem` ou `/evidencias?reason=hm` etc.

### P2 — Onboarding

13. **Welcome modal vs banner** — escolher um e remover o outro. Banner inline atual é menos enfático mas funcional; modal está pronto e nunca aparece. Decisão de produto.
14. **Coach marks no /oportunidades primeira visita** — explicar que cards têm botão expandir + (futuro) que tem Adaptar/Salvar quando P0#1 entrar.
15. **`/experimentar` → /dashboard transition** — quando usuário anonymous vira logged, o Report.js (com todas as ações) é descartado e o user vai pra /dashboard que não tem Adaptar/Salvar. Considerar um banner "[X] vagas com match alto te esperam no Radar →" pra trazer o user pro /oportunidades já com expectativa.

### P3 — Microcopy / feedback emocional

16. **MicroactionCard concluir → momento de celebração**: substituir "✓ Concluída (desfazer)" por algo como "✓ Excelente! +{impactoPontos}pts no projetado. Próxima ação →" linkando pra próxima.
17. **Score baseline microcopy variante encorajadora**: quando `medianValue - score < 10`, copy: "Você está a poucos pontos da mediana — mais um diagnóstico atualizado pode te levar lá".
18. **`/conta` segmentação visual**: dividir em tabs (Perfil / Conta / LGPD / Plano) ou seções colapsáveis. 653 linhas num scroll é hostil.
19. **DailyQuestCard "Marquei como feito" + link de origem**: se a quest é "atualize 1 skill no perfil", incluir `<Link href="/conta#skills">Ir fazer agora</Link>` antes do "Marquei".

---

## Roteiro de teste manual

Para validar os findings empiricamente, executar este roteiro num browser limpo (incognito ou novo perfil):

- [ ] Abrir `/`. Clicar "Construir meu gêmeo" → deve cair em /experimentar.
- [ ] Em /experimentar (anonymous), preencher CV + cargo + clicar "Gerar diagnóstico (efêmero)". Conferir que Report.js mostra "Adaptar currículo" e "+ Salvar candidatura" em cada vaga.
- [ ] Logar via /entrar. Voltar pra `/`. Conferir redirect → /dashboard.
- [ ] No /dashboard, clicar uma das "3 próximas ações". O botão é apenas "Concluir →". **Onde eu vou efetivamente FAZER essa ação?**
- [ ] Navegar pra /oportunidades. Clicar numa vaga. **O ÚNICO CTA é "Ver vaga original ↗" externa.** Confirmar.
- [ ] Voltar pra /cvs-adaptados (vazio). Ler empty state. **Seguir a instrução**: "Vá em /oportunidades e clique em 'Adaptar currículo →'". Tentar achar esse botão. **Confirmar quebra do fluxo.**
- [ ] Em /candidaturas (vazio), ler empty hero. Clicar em "Ver vagas no meu gêmeo →". **Confirma redirect /meu-gemeo → /dashboard.** Procurar "Vagas" como aba — não existe na sidebar.
- [ ] Em /estagios, ler dica do banner. Clicar em "/linkedin". **Confirmar 404.**
- [ ] Em /carreira, abrir um milestone. Tentar clicar em uma skill listada — não é Link. Tentar clicar na "evidência pra fechar" — não é Link.
- [ ] No NotificationsBell, conferir se há notif "Como foi?" do cron outcome-survey. Se sim, clicar → deveria abrir OutcomeSurveyModal. Confirmar que **nada acontece** (modal não montado).
- [ ] Em /autoconhecimento, completar 1 assessment. Ver resultado. Procurar "cargos que combinam com seu perfil" — **não existe**.
- [ ] No /funil, registrar 4 semanas de dados. Conferir BottleneckBanner. Clicar "Agir agora". **Conferir que vai pra rota genérica** (não filtrada pelo bottleneck).

---

## Recomendações priorizadas

### Quick wins (≤ 1h cada)

1. **Fix link `/linkedin` em /estagios** (`app/(app)/estagios/page.js:116`). Apontar pra `/conta#linkedin` ou simplesmente remover. **5min.**
2. **Atualizar copy do empty state de /candidaturas** (`app/candidaturas/page.js:30,46` e `KanbanClient.js:141-147`) trocando "Meu gêmeo → Vagas" por "/oportunidades". **15min.**
3. **Renderizar `<WelcomeModal />`** em `app/(app)/layout.js`. **10min.** OU remover componente se decidir que banner inline é suficiente.
4. **Mover `/candidaturas` pra dentro do `(app)` group** (rename pasta + ajustar imports). Restaura sidebar. **30min.**
5. **Atualizar copy de `/cvs-adaptados` empty state**: temporariamente "Por enquanto crie um CV adaptado pela home/diagnóstico em /experimentar" até P0#1 entrar.

### Estrutural (≥ 4h, mas críticos)

6. **P0#1: Botões "Adaptar" e "Salvar" no RadarClient.js**. Refatorar `JobCard` pra incluir os 2 botões + TailorModal trigger. Reusar `SaveJobButton` de Report.js. **~6h.** Esse é o que destrava 70% do loop quebrado.
7. **Sistema de deep-link contextual** (parametros padronizados `?fromJob=`, `?skill=`, `?milestone=`). Implementar 1ª onda: `/oportunidades` → `/cvs-adaptados?fromJob=X` (P0#1) + `/gaps` → `/oportunidades?skill=X`. **~8h.**
8. **OutcomeSurveyModal renderer**: hook server-side em `dashboard/page.js` que detecta candidatura com 7+ dias em INTERVIEW/OFFER sem outcome registrado → renderiza o modal client-side. **~6h.**
9. **`/carreira` CTAs outbound**: cada milestone skill/evidence vira Link contextualizado. **~3h.**
10. **`/funil` analysis.link propagação de contexto**: refatorar `lib/funnel.js` pra link contextualizado por stage. **~3h.**

### Refactor maior (sprint dedicado)

11. **`/conta` segmentação por tabs**. **~12h.**
12. **Achievement toast + integração em fluxos**: verificar uso e fortalecer celebrações em microactions, candidaturas convertidas, primeiro CV adaptado, etc. **~8h.**
13. **Coach-mark / onboarding tour** primeira visita em /oportunidades e /gaps. **~16h.**

---

## Encerramento

A jornada do candidato hoje **tem todas as peças construídas** (CVs, gaps, vagas, kanban, funil, evidências, carreira, autoconhecimento) — **mas as peças não conversam entre si**. O produto é uma constelação de ilhas com links genéricos. Para escapar da "constelação morta" e virar funil real, o trabalho principal não é mais código novo: é **conexão contextual entre o que já existe**.

O Radar é o ponto de partida do loop e hoje o pior dead-end. Consertar P0#1 (botões Adaptar+Salvar no RadarClient) é o maior ROI de UX possível no produto. Tudo o mais flui depois.

Éowyn, defensora da jornada.
