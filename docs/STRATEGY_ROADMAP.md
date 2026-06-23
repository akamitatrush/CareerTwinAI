# CareerTwin AI — Estudo Estratégico e Roadmap

> Análise crítica do produto atual (estado em 2026-06-23) com proposta de evolução pra
> "produto que pessoas queiram usar de verdade". Tom de consultoria sênior: sem fluff,
> sem inflar o que temos, sem amenizar o que falta.

## 1. Estado atual: o que temos

**Foundation funcional (entregue):** 4 pilares cobertos — Autoconhecimento (3 mini-assessments
DISC-lite/Valores/Ikigai), Diagnóstico (Career Health Score com sub-scores determinísticos +
gaps com microação), Ação (Skill Gap Mapper + Evidence + TailoredCv com diff antes/depois),
Oportunidade (radar de 6 providers com match matemático + kanban com `ApplicationEvent`
auditável). Refresh manual via novo diagnóstico cria `ScoreSnapshot` imutável.

**Foundation técnica (forte e raramente vista em produto seed):** RAG real com pgvector +
Voyage AI embeddings + hybrid retrieval (vector + BM25-lite com RRF) sobre 159 chunks
curados BR, schema de billing Stripe completo (Subscription + UsageMeter com custo LLM
agregado + BillingEvent idempotente), AuditLog OWASP A09, LGPD com TTL 90 dias em `rawCv`/
`linkedinRaw`, rate-limit em memória, anti-SSRF em portfolio import, CSP no middleware,
6 providers de vagas com `Promise.allSettled` fail-soft.

**Infra sem presença real ainda:** tabela `Outcome` existe mas mediana real depende de >=50
HIRED — hoje `lib/metrics/median-stub` retorna `HIRED_MEDIAN=78` hardcoded. Tabela
`Notification` existe mas notificações são pontuais reativas (não proativas). `ChatModal`
existe mas é modal episódico, não copiloto presente. Streaming LLM **não existe** — toda
chamada usa `completeJSON` com timeout 45s, user espera silêncio.

## 2. Diagnóstico crítico: por que parece "simples"

Cinco hipóteses; as três mais fortes em ordem:

**A. IA invisível (mais forte).** Claude faz heavy-lifting em /analyze, /tailor, /interview,
/chat — extração, explicação de sub-scores, gaps com microações, parsing de LinkedIn. Mas
o user **não sente** a IA: sai um relatório estático, sem conversa, sem antecipação, sem
proatividade, sem memória entre sessões. O ChatModal é episódico, não permanente. LLM
roda sync sem streaming — o user vê 15-30s de loading e depois um texto pronto. A
inteligência está lá, mas escondida atrás de uma estética de "form → relatório".

**B. Sem loop diário/semanal.** Produto é "evento de momento": cola CV → vê score → fecha.
O único hook recorrente é o digest semanal de vagas (Resend), genérico e fácil de ignorar.
Não há reason to come back tomorrow. Sem habit loop, retenção D7 será muito baixa
(estimativa <15%).

**C. Resultado opaco no execution path.** Gaps recomendam "Curso de threat modeling — 4h",
mas não há checkpoints, sem proof-of-work, sem evidência cobrada. PlanItem tem `pendente`/
`feita` mas o estado é binário e silencioso. Sem comunidade, sem cobrança social, sem prova.

**D. Conteúdo curado vs gerado.** RAG está bom (159 chunks, Recall@3 93.9%) mas é estático.
Não aprende com o user, não cresce com o uso, não personaliza recomendações com base no
histórico do próprio user.

**E. Visual neutro.** Claude Design (Indigo Sereno + Plus Jakarta Sans + Spectral) é bonito
e conservador. Cumpre a promessa de "auditabilidade séria" mas falta delight — animações,
celebração de progresso, momentos memoráveis.

## 3. O que adicionar pra ter mais "presença de IA"

### High value, médio esforço (priorize)

1. **Career Copilot conversacional permanente (~16h).** ChatModal vira sidebar/widget
   persistente. Streaming responses (SSE). Memória de longo prazo via nova tabela
   `ConversationTurn` com embedding por turn. Sugere ações proativas baseado em estado
   ("notei que você não atualizou em 7 dias…").

2. **Onboarding com agent guiado (~12h).** Em vez de textarea "cole CV", AI faz perguntas
   curtas ("Me conta o que você faz hoje"), extrai estruturado em conversa. User sente
   conexão imediata, não burocracia. Reusa `/api/linkedin/parse` adaptado.

3. **Daily/Weekly briefing personalizado (~8h).** Cron diário avalia estado do user e
   gera notificação contextual via LLM ("Bom dia. Vi 3 vagas novas que combinam: X, Y, Z.
   Foque em Z porque [razão]"). Substitui digest semanal genérico.

4. **AI-powered CV rewriter inline (~10h).** Highlight de bullets fracos em `/conta` com
   sugestão hover, accept/reject line by line. User sente IA assistindo, não substituindo.

### High value, alto esforço

5. **Career path simulator (~24h).** "Quero ser PM Senior em 2 anos. Que skills aprender?"
   → LLM + RAG gera roadmap visual com milestones, cursos do `lib/knowledge`, evidências
   necessárias. Atualiza conforme user completa.

6. **Mock interviews em voz (~30h).** Áudio + Voice Activity Detection + LLM streaming +
   feedback. Diferencial real vs Final Round AI / Sensei / careertwin.ai.

7. **Skill graph dinâmico (~16h).** Grafo D3 das skills do user + skills do cargo-alvo,
   interativo. Vai além da barra horizontal de aderência. Requer expandir
   `lib/skills-taxonomy.js` (hoje ~25 entradas) pra taxonomia hierárquica.

### Médio valor, baixo esforço

8. **Microinterações + delight (~6h).** Score sobe → mini celebration (confetti SVG).
   Achievement system (primeiro CV adaptado, 10 microações, primeira candidatura).
   Streak counter.

9. **Comparação com pares anônimos (~8h).** "Devs Python 5-10a em SP: você é 73º
   percentil." Depende de >=50 outcomes — habilita junto com mediana real.

10. **AI-suggested daily quest (~6h).** 1 microação curta/dia ("escreva 1 bullet
    quantificado pro CV"). Habit loop diário, não semanal.

## 4. O que NÃO adicionar agora

- **B2B dashboard** — ICP não validado, esforço alto, sem cliente piloto.
- **Mobile nativo** — responsive web cobre 90%, dev cost dobra (iOS+Android+web).
- **Análise psicométrica clínica** — sem licença CFP, risco regulatório.
- **Affiliate de cursos com tracking** — sem volume pra negociar com Alura/Tera/Coursera.
- **Salary prediction ML** — sem dataset proprietário; usar Adzuna salário como heurística.

## 5. Arquitetura proposta pra suportar "presença de IA"

**Camada nova: Career Memory.** Tabela `ConversationTurn` (id, userId, role, content,
embeddingVector, createdAt) com index `(userId, createdAt)`. Embedding via Voyage (reusa
`lib/embeddings.js`). Recall semântico no copilot — "você mencionou liderar time mês
passado, ainda é prioridade?".

**Camada nova: Action Engine.** Cron diário (`app/api/cron/daily-recommendation/route.js`)
percorre users ativos (último login <7d), avalia estado (`ScoreSnapshot` mais recente,
`Application` por status, `PlanItem` pendentes), monta contexto e pede ao LLM **uma**
recomendação contextual. Persiste como `Notification` + dispara push/email se opted-in.
Não é template — é geração contextual.

**Camada nova: Skill Graph.** Tabela `SkillNode` com taxonomia hierárquica (família →
área → skill específica) + `SkillEdge` (dependências: SQL precisa pra DataEng). Algoritmo:
shortest-path entre profile e cargo-alvo. Resolve limitação atual da `skills-taxonomy.js`
manual.

**Adapt: streaming LLM.** Substitui `completeJSON` por `completeStream` em
endpoints user-facing (`/api/chat`, `/api/analyze`, `/api/interview`). SSE ou Edge
Runtime streaming. Sensação imediata de "IA pensando". Validação Zod no servidor após
o stream fechar.

## 6. Roadmap proposto (90 dias)

**Sprint 1 (semana 1-2) — IA Presence MVP:** Career Copilot widget sempre visível (#1) +
streaming LLM em /api/chat + microinterações de score (#8).

**Sprint 2 (semana 3-4) — Habit loop:** Daily briefing automático (#3) + daily quest
system (#10).

**Sprint 3 (semana 5-6) — Wow features:** Skill graph (#7) + AI rewriter inline (#4).

**Sprint 4 (semana 7-8) — Onboarding revisado:** Onboarding agent guiado (#2) + métricas
de ativação (PostHog `onboarding_completed`).

**Sprint 5 (semana 9-12) — Career path + pares:** Simulator (#5) + comparação com pares
(#9, gated em N>=50 outcomes).

Mock interviews em voz (#6) fica fora dos 90 dias — esforço de 30h compete com Sprint 5
inteiro, e a equivalência funcional (texto) já cobre o caso primário.

## 7. Métricas de sucesso

Quando achar que "tem presença de IA":

- **D7 retention >40%** (vs estimado <15% hoje).
- **DAU/MAU ratio >0.3** (sticky).
- **Time per session >5min** (vs <2min hoje, estimado).
- **NPS conversações >7** ("a IA parece útil de verdade").
- **% users que completam 5+ ações/semana** — proxy de engajamento profundo.

PostHog já captura `diagnosis_completed`, `application_saved`, `digest_clicked`. Adicionar:
`copilot_message_sent`, `daily_quest_completed`, `onboarding_completed`, `skill_graph_viewed`.

## 8. Risco principal

Adicionar features sem validar com user real = bloat. Recomendação: **Sprints 1 e 2
primeiro, ship, captar 10-20 usuários reais, observar PostHog + entrevistas qualitativas,
depois Sprint 3+**. O fosso atual do produto (auditabilidade + BR + LGPD + RAG curado) é
real e raro — corremos o risco de diluí-lo perseguindo "wow" sem validação. Sprint 1+2
custa ~50h e é reversível; Sprint 3+ custa ~80h e cria dívida de UI/dados difícil de
desfazer.
