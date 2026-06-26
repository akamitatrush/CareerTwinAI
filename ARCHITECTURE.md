# Arquitetura — CareerTwin AI

Plataforma de gestao de carreira em pt-BR. MVP funcional sobre Next.js 14 (App Router),
organizado em 4 pilares: **Autoconhecimento, Diagnostico, Acao e Oportunidade**. Da
identidade ate a contratacao, com auditabilidade radical e LGPD por construcao.

## Decisoes arquiteturais (ADRs)

Resumo das escolhas estruturais ainda validas:

| Decisao | Por que | Trade-off |
|---|---|---|
| **Prisma (vs Drizzle)** | Mature client + Auth.js v5 adapter + Studio + migration history | Build/bundle maior, geracao precisa rodar (`postinstall`) |
| **Auth.js v5 (vs Clerk)** | Self-host, zero-cost, magic link nativo, LinkedIn OIDC opcional | Sem dashboard hosted, magic-link UX precisa caprichar |
| **Anthropic (vs OpenAI)** | Sonnet 4.6 melhor em pt-BR + estrutura. Haiku 4.5 com cost/latencia melhor pra rotas leves. | Provider unico — env permite trocar pra OpenAI |
| **Score determ em codigo (vs LLM)** | Numero auditavel, reproducivel, defende contra hallucination | LLM so explica — perde fluidez generativa |
| **JS puro (vs TS)** | Velocidade de iteracao MVP, sem build complexo | Sem refactor-safety, types em JSDoc onde dor pesa |
| **App Router (vs Pages)** | RSC, layouts aninhados, streaming nativo (SSE em analyze) | Stack mais nova, alguns hooks 3rd-party ainda no Pages |
| **Upstash Redis (vs hosted)** | Free tier 10k/dia, REST API, zero infra | Por-request latency; Map fallback pra dev |
| **Modo experimentar anonimo** | Reduz friccao — user testa antes de criar conta | Rate-limit por IP mais apertado, sem persistencia |
| **`withApiGuard` em 9 rotas LLM** | JSON sempre, mesmo em Prisma drift/throw inesperado | Wrapper extra em cada rota — manual, nao centralizado |

## Stack

- **App**: Next.js 14 (App Router, RSC), React 18, JS puro. Claude Design System (Plus
  Jakarta Sans + Spectral, paleta Indigo Sereno).
- **Banco**: PostgreSQL via Prisma 6 + extensao **pgvector** (RAG real).
- **Auth**: Auth.js v5 (magic link Email + LinkedIn OIDC opcional; CredentialsProvider em dev).
- **LLM**: Anthropic Claude **Sonnet 4.6** (rotas criticas: analyze, chat, tailor,
  profile/refresh, interview evaluate) + **Haiku 4.5** (rotas leves: linkedin/parse,
  portfolio/import, cv/analyze-bullets, interview question — 3-5x mais rapido, 1/4 do
  custo). Saidas estruturadas validadas com Zod. LLM gera apenas explicacoes — valores
  sao calculados deterministicamente em codigo. Provider trocavel pra OpenAI por env
  (`LLM_PROVIDER=openai`).
- **LLM cache**: `lib/llm-cache.js` com chave `sha256(model|system|user)`, TTL 1h,
  Upstash Redis primary + Map fallback. Habilitado em parsing/perguntas (entrada
  idempotente); desabilitado em rotas user-specific.
- **Embeddings**: Voyage AI `voyage-3` (1024 dims) + OpenAI Matryoshka fallback.
- **Vagas**: agregador 6 providers — Adzuna BR + Jooble + Greenhouse + Lever + Ashby +
  Workable (fallback em fixtures).
- **Email**: **Resend** (prod, via `AUTH_RESEND_KEY` ou `EMAIL_SERVER`) com fallback
  SMTP / Mailpit (dev) via Nodemailer.
- **Parsing**: pdf-parse (CV em PDF), mammoth (DOCX), Zod (entrada e saida).
- **Knowledge**: RAG hybrid (Voyage + pgvector + RRF fusion) com 159 chunks curados em
  `lib/knowledge/`; fontes curadas pra cursos sugeridos.
- **Billing**: Stripe SDK + Checkout + Customer Portal + Webhooks com HMAC + idempotencia.
- **Cache / Rate-limit**: **Upstash Redis** (prod, cross-lambda) com fallback Map em
  memoria. **4 sistemas** compartilham: rate-limit, LLM response cache, jobs cache
  (Adzuna/Jooble), magic-link anti-spam (3/email/hora).
- **Observabilidade**: Sentry (errors), PostHog (eventos), UptimeRobot (`/api/health`),
  **AuditLog** (17 actions com IP hash sha256+salt).
- **Resiliencia**: `lib/api-handler.js` (`withApiGuard`) envolve 9 rotas LLM — garante
  JSON em qualquer erro (P2021/P2022/P1001/etc Prisma -> 503 amigavel; throw inesperado
  -> 500 SERVER_ERROR). Antes podia voltar HTML `<!DOCTYPE>`.
- **Testes**: Vitest (unit, **878 casos em 69 arquivos**) + Playwright (e2e, 5 specs) +
  Eval RAG (50 queries com gate `recall@3 >= 70%`).

## Diagrama (alto nivel)

```
                +----------------------+
   Browser  --> |  Next.js App Router  |
   (pt-BR)     |  - Server Components  |
                |  - API routes (49)   |
                |  - middleware (auth) |
                |  - SSE em analyze    |
                +----------+-----------+
                           |
                  withApiGuard (9 rotas LLM)
                           |
   +-----+-----+----+----+----+----+-----+----+-----+
   |     |     |    |    |    |    |     |    |     |
   v     v     v    v    v    v    v     v    v     v
+----+ +----+ +---+ +---+ +---+ +---+ +-----+ +---+ +-----+
|LLM | |Emb | |DB | |ATS| |Mail| |Up | |Stri | |Sen| |Post |
|Anth| |Voy | |Pg | |6  | |Res | |sh | |pe   | |try| |Hog  |
|opic| |age | |+  | |Pro| |Send| |Red| |Check| |   | |     |
|S46 | |    | |Vec| |vs | |    | |is | |out  | |   | |     |
|H45 | |    | |   | |   | |    | |   | |     | |   | |     |
+----+ +----+ +---+ +---+ +----+ +---+ +-----+ +---+ +-----+
   |                                  |
   |     cache: sha256(model|sys|user)|
   |     TTL 1h, rate-limit, jobs cache,
   |     magic-link anti-spam (4 sistemas)
   +----------- llm-cache.js ---------+

S46 = Sonnet 4.6 (rotas criticas)  H45 = Haiku 4.5 (rotas leves)
```

### Diagrama detalhado — `/api/analyze` (Wave 17)

```
  POST /api/analyze[?stream=1]
        |
        +-- withApiGuard wrapper (lib/api-handler.js)
        |     catches P2021/P2022/P1001 + throw inesperado -> JSON sempre
        |
        +-- core() emite steps via `emit()` (no-op em JSON, SSE em stream)
        |
        +-- 1) auth() + guardLLM (Upstash Redis cross-lambda)
        |     emit({step: "validating"})
        +-- 2) enforceUsage atomico (Prisma.$transaction Serializable)
        |     pre-check checkDailyBudget (cost amplification defense)
        +-- 3) zod AnalyzeBody.safeParse
        |
        +-- 4) Promise.allSettled em PARALELO:
        |     emit({step: "llm_jobs_parallel"})
        |     +-- completeJSONWithUsage (Sonnet 4.6, cache: false)
        |     +-- searchJobs(role, location, limit=50)
        |             (6 providers Promise.allSettled)
        |     >>> economiza 3-5s vs serial <<<
        |
        +-- 5) DiagShape.safeParse no output do LLM
        |     trackTokenUsage atomico (independente de persist OK)
        |     emit({step: "computing"})
        |
        +-- 6) computeAllSubScores (lib/scoring/subscores.js)
        |     determ deterministico, LLM nao toca os numeros
        |
        +-- 7) Persist (se userId):
        |     emit({step: "persisting"})
        |     Profile.upsert + ScoreSnapshot.create(+gaps)
        |     notify scoreUpdated + welcome flow + achievements
        |     audit CV_UPLOADED + DataSource + Consent
        |
        +-- 8) Retorno:
              JSON: NextResponse.json(payload)
              SSE:  emit({type:"result", payload}); emit({type:"done"})
```

## 4 Pilares

A aplicacao se organiza em 4 pilares (de identidade a contratacao):

1. **Autoconhecimento** (`/autoconhecimento`) — 3 mini-assessments (DISC-lite, Valores,
   Ikigai) com visualizacoes SVG (`DiscMatrix` quadrante, `ValoresRadar` 16 eixos,
   `IkigaiVenn` 4 circulos) e narrativas a partir de 6 arquetipos. Persistidos em
   `AssessmentResult`. Disclaimer etico em todas as telas.
2. **Diagnostico** (`/dashboard`, `/transparencia`) — Career Health Score (0-100) com 4
   sub-scores 100% deterministicos em `lib/scoring/subscores.js`. LLM gera apenas
   explicacoes (nunca valores). **Refresh sem repaste** via `/api/profile/refresh`.
3. **Acao** (`/gaps`, `/evidencias`, `/cvs-adaptados`) — Skill Gap Mapper com microactions
   + cursos sugeridos via RAG hybrid; evidencias de competencia; CVs adaptados com diff.
4. **Oportunidade** (`/oportunidades`, `/candidaturas`) — Radar de vagas (6 providers) com
   match matematico explicado; kanban de candidaturas com timeline auditavel.

## Estrutura de pastas

```
app/                                  rotas (RSC + API) — 12 telas auth + 5 publicas
  (app)/                              layout autenticado (AppShell sidebar 252px)
    dashboard, autoconhecimento, gaps, oportunidades, plano, cvs-adaptados,
    evidencias, transparencia, conta
  candidaturas/                       kanban + funil de conversao
  entrar/, meus-dados/                login + LGPD self-service
  api/                                49 route handlers
    analyze (com SSE em ?stream=1), opportunities, assessments/[kind],
    evidence, tailored-cvs, gaps/{summary, requirements, courses, [id]/complete},
    profile/{refresh, onboarding, completeness},
    score/latest-with-history, plan-items/[id]/complete,
    linkedin/parse, portfolio/import, tailor, interview, chat,
    cv/{upload, analyze-bullets}, applications, history/{actions, score},
    me/{export, daily-quest, outcome, preferences},
    notifications/{read-all, [id]/read}, health, _track, metrics/median,
    billing/{checkout, portal, webhook, plan},
    cron/{digest, daily-briefing, outcome-survey, redact-cv, redact-billing,
          usage-cleanup},
    auth/[...nextauth]
components/                           UI compartilhada (AppShell, Report,
                                      visualizations/{DiscMatrix, ValoresRadar,
                                      IkigaiVenn}, NextStepsBlock, modais...)
lib/
  jobs/                               6 providers (adzuna, jooble, greenhouse, lever,
                                      ashby, workable) + cache + fixtures fallback
  knowledge/                          RAG hybrid: retrieval + course-retrieval + base curada
  scoring/                            subscores deterministicos (TF-like, count/validity/
                                      diversity, completude, year-range)
  metrics/                            completeness.js (weighted field-presence)
  billing/                            stripe.js + plans.js + enforce.js (TOCTOU-safe)
  assessments/                        DISC/Valores/Ikigai logic + arquetipos
  analytics/                          PostHog server-side helpers
  achievements/                       (se aplicavel) — atualmente lib/achievements.js root
  validators.js                       Zod schemas (60+ schemas; body + shape de LLM)
  llm.js                              wrapper Anthropic/OpenAI (retry, sanitizacao,
                                      cost log + budget per-user, completeJSONFast helpers)
  llm-cache.js                        cache resposta LLM sha256(model|sys|user), TTL 1h,
                                      Upstash Redis + Map fallback
  llm-stream.js                       streaming helpers (chat/SSE)
  api-handler.js                      withApiGuard — JSON garantido em qualquer erro
  embeddings.js                       Voyage AI + OpenAI Matryoshka fallback
  audit.js                            AuditLog 17 actions (IP hash sha256+salt)
  safe-fetch.js                       Anti-SSRF custom HTTPS agent (IP pinning,
                                      mitiga DNS rebinding)
  url-safe.js                         safeExternalUrl + safeHref (Zod URL)
  email.js                            digest semanal + daily briefing (Resend ou SMTP)
  rate-limit.js                       Upstash Redis (prod) ou Map (dev/fallback)
  auth-protected-paths.js             SSoT do middleware (PROTECTED sync)
  env.js                              boot guards (AUTH_DEV_CREDENTIALS bloqueado em prod)
  achievements.js                     9 conquistas idempotentes (FIRST_DIAGNOSIS,
                                      SCORE_70/80/90, FIRST_REFRESH, etc)
  daily-quest-templates.js            templates de quest diaria
  career-paths.js, retry.js, logger.js, sample.js
  score.js, pdf.js, docx.js, prompts.js, db.js, auth.js, data-export.js,
  notifications.js, skills-taxonomy.js
prisma/
  schema.prisma                       24 modelos
  migrations/                         migrations versionadas (rodam fora do build)
scripts/
  ingest-knowledge.mjs                ingestao idempotente pgvector (sha256 contentHash)
tests/
  unit/                               Vitest (878 testes em 69 arquivos)
  e2e/                                Playwright (5 specs)
  eval/rag/                           50 queries · recall@3 / MRR / NDCG
docs/
  PRODUTO.md, ALGORITHMS.md, API.md, RAG.md (700 linhas), MONETIZACAO.md, DEPLOY.md,
  OBSERVABILITY.md, HANDOFF_TIME_TERA.md (341 linhas), audits/ (5 read-only)
middleware.js                         CSP + NextAuth gate + PROTECTED paths +
                                      NEVER_BLOCK_PREFIXES (defense-in-depth)
next.config.mjs                       headers + Sentry source maps gatekeeper
vercel.json                           6 crons (digest weekly · daily-briefing · outcome-survey
                                      · redact-cv daily · redact-billing · usage-cleanup)
docker-compose.yml                    Postgres + Mailpit pra dev
```

Numeros atuais: **49 route handlers** em `app/api/`, **12 telas autenticadas + 5 publicas**,
**24 modelos Prisma**, **878 testes unit em 69 arquivos**, **5 e2e specs**, **6 crons**.

## Modelos Prisma principais

**24 modelos** no total (era 13 em v0.9, +8 em v0.10, +3 pos-v0.10:
`Outcome`, `Achievement`, `DailyQuest`). Destacando os principais:

**Core User & Auth**
- **User** — conta Auth.js, contem flags de digest (`digestEnabled`, `lastDigestAt`).
- **Account / Session / VerificationToken** — Auth.js v5.

**Perfil & Diagnostico**
- **Profile** — perfil 1:1 com User; `rawCv` + `rawCvExpiresAt` (TTL 90d LGPD), JSON do
  LinkedIn, GitHub, portfolio.
- **ScoreSnapshot** — diagnostico imutavel por momento (overall + sub-scores + perfil JSON).
- **Gap** — habilidade faltante por snapshot (com microacao e `impactoPontos` por
  sub-score, usado no bonus deterministico do refresh).
- **PlanItem** — item do plano por snapshot (pendente/feita).

**Pilar 1 — Autoconhecimento**
- **AssessmentResult** — resultado de assessment (kind: `DISC_LITE | VALUES | IKIGAI`;
  answers + result em JSON).

**Pilar 3 — Acao**
- **Evidence** — evidencia de competencia (kind, title, description, url).
- **TailoredCv** — CV adaptado por vaga (jobTitle, company, adaptedCv text, diff JSON).

**Pilar 4 — Oportunidade**
- **Application** — candidatura salva no kanban (status enum, notas, salario, source).
- **ApplicationEvent** — historico de transicao de status (audit trail).

**LGPD & Observabilidade (NOVO em v0.10)**
- **Consent** — registro LGPD de cada fonte de dado consentida (payloadHash SHA256).
- **DataSource** — metadados de ingestao (rotulo, tamanho, kind).
- **AuditLog** — 17 actions com `userIdHash` + `ipHash` (sha256+`AUDIT_IP_SALT`),
  resolve A09 do audit OWASP.
- **Notification** — notifications in-app (sininho na sidebar).

**RAG (NOVO em v0.10)**
- **KnowledgeChunk** — 159 chunks com `content`, `metadata`, `contentHash` sha256
  (idempotencia), `embedding` `Unsupported("vector(1024)")` + HNSW index cosine.

**Billing (NOVO em v0.10)**
- **Subscription** — 1:1 com User. `status` (`SubscriptionStatus` enum: `ACTIVE`,
  `CANCELED`, `PAST_DUE`, `INCOMPLETE`), `plan` (Free/Pro M/Pro Y/Team), `currentPeriodEnd`,
  `stripeCustomerId`, `stripeSubscriptionId`.
- **UsageMeter** — quota por usuario e kind (`analyze`, `tailor`, `opportunities`,
  `interview`). `period` (`YYYY-MM` ou `YYYY-MM-DD`). Incremento atomic via Serializable.
- **BillingEvent** — eventos Stripe persistidos com `stripeEventId` unique (idempotency).

**Gamificacao & Outcomes (pos-v0.10)**
- **Achievement** — conquista desbloqueada (`userId` + `kind` unique). 9 tipos atualmente
  (FIRST_DIAGNOSIS, SCORE_70/80/90, FIRST_REFRESH, FIRST_EVIDENCE, COURSE_COMPLETED, etc).
  `grantAchievement(userId, kind, meta)` idempotente.
- **DailyQuest** — quest do dia rotacionada por template (`lib/daily-quest-templates.js`).
- **Outcome** — registro de outcomes do user (entrevistas marcadas, ofertas) — alimenta
  cron de outcome-survey e metrica do pitch.

## Fluxos-chave

1. **Diagnostico** — usuario cola CV ou faz upload de PDF; rota `/api/analyze` valida com
   Zod (`AnalyzeBody`), faz **retrieval RAG hybrid** (Voyage + pgvector + RRF), chama
   LLM (Sonnet 4.6) **em paralelo com `searchJobs`** via `Promise.allSettled` (Wave 17,
   economiza 3-5s), valida o shape de volta (`DiagShape`); **sub-scores sao calculados em
   codigo deterministico** (`lib/scoring/subscores.js`), nao pelo LLM. Persiste
   `ScoreSnapshot` + `Gap[]` + `PlanItem[]` se logado (+ `AuditLog`), ou retorna apenas em
   memoria se anonimo. **SSE em `?stream=1`** emite 6 etapas progressivas (back-compat
   total — sem param, JSON one-shot).
2. **Refresh sem repaste** — `POST /api/profile/refresh` reusa `Profile.rawCv` +
   `targetRole` + `perfilJson` (nao pede CV de novo). Calcula `projectedGains`
   deterministico com cap 15/sub + 25 total (anti-gaming). LLM recebe
   `completedHabilidades` e gera gaps **diferentes** (anti-loop). Aplica bonus +
   `computeAllSubScores` -> novo `ScoreSnapshot`. Com `applyCompletedSkills=true` usa
   `previousSnapshot.subScores` como **baseline** — score nunca cai apos marcar microacao
   (LLM nao-deterministico podia fazer score oscilar pra baixo antes do fix).
3. **Autoconhecimento** — `/api/assessments/[kind]` (GET retorna progresso, POST persiste
   respostas + resultado). 3 kinds: `DISC_LITE`, `VALUES`, `IKIGAI`. Disclaimer etico em
   todas as telas. Visualizacoes SVG (`DiscMatrix`, `ValoresRadar`, `IkigaiVenn`) +
   narrativas (6 arquetipos Valores, careerHints DISC).
4. **Skill Gap + Cursos** — `/api/gaps/summary` consolida gaps por snapshot; `/api/courses`
   (atras de microactions) usa **RAG hybrid** (`lib/knowledge/course-retrieval.js`) com
   skill-keyed lookup + boost pra cursos gratuitos contra knowledge base curada de 41 entries.
5. **Importacao** — `/api/linkedin/parse` recebe texto colado, gera CV consolidado +
   estrutura de perfil; `/api/portfolio/import` extrai stack/projetos do GitHub ou de
   uma URL pessoal (com **anti-SSRF custom HTTPS agent + IP pinning** contra DNS
   rebinding). Ambos passam por Zod no body e na saida do LLM.
6. **Vagas (6 providers)** — `lib/jobs/index.js` busca em paralelo Adzuna BR, Jooble,
   Greenhouse, Lever, Ashby e Workable (`Promise.allSettled` fail-soft, dedupe + cache
   TTL 10min). Match calculado por intersecao normalizada de skills via taxonomy.
7. **CVs adaptados** — `/api/tailor` recebe CV + vaga, retorna CV adaptado com diff
   antes/depois (campo `diff` JSON em `TailoredCv`). Passa por billing enforce.
8. **Tracking** — usuario salva vaga (`POST /api/applications`), arrasta entre colunas
   (`PATCH /api/applications/:id`); cada transicao grava `ApplicationEvent` (audit).
9. **Billing checkout (NOVO)** — `/api/billing/checkout` cria Stripe Checkout Session,
   redirect; webhook `/api/billing/webhook` faz HMAC verify + idempotency check via
   `BillingEvent.stripeEventId`, upserta `Subscription`. Enforce em cada chamada LLM via
   `lib/billing/enforce.js` (Serializable transaction).
10. **Cron jobs** — todos com header `x-cron-secret` constant-time:
    - `/api/cron/digest` (semanal): batching 10 paralelo + dedup por role.
    - `/api/cron/redact-cv` (diario): redaciona `Profile.rawCv` com >90d (TTL LGPD).
    - `/api/cron/usage-cleanup` (periodico): limpa `UsageMeter` antigo.
11. **Health check** — `GET /api/health` retorna `{status, db, time}` pra UptimeRobot.

## LLM tier-by-route + cache (Wave 17)

A partir da Wave 17, **rotas leves rodam em Haiku 4.5** (3-5x mais rapido +
1/4 do custo) via helpers `completeJSONFast` / `completeJSONFastWithUsage`
em `lib/llm.js`. Rotas criticas seguem em Sonnet 4.6.

| Rota | Modelo | Cache LLM | Por que |
|---|---|---|---|
| `/api/analyze` | Sonnet 4.6 | OFF | user-specific, snapshot novo |
| `/api/profile/refresh` | Sonnet 4.6 | OFF | user-specific |
| `/api/chat` | Sonnet 4.6 | OFF | history sempre muda |
| `/api/tailor` | Sonnet 4.6 | OFF | adaptacao por vaga deve ser fresca |
| `/api/interview` action=evaluate | Sonnet 4.6 | OFF | feedback de resposta unica |
| `/api/linkedin/parse` | Haiku 4.5 | **ON** | texto idempotente |
| `/api/portfolio/import` | Haiku 4.5 | **ON** | github user idempotente |
| `/api/cv/analyze-bullets` | Haiku 4.5 | **ON** | bullets identicos |
| `/api/interview` action=question | Haiku 4.5 | **ON** | perguntas se repetem |

**Cache key** = `sha256(model|system|user)` truncado em 32 hex chars
(2^128 search space, col-resist pratico). **TTL 1h**. **Upstash Redis
primary** (cross-lambda), **fallback Map em-memoria** (LRU pobre, cap 500
entries). Hit retorna `{tokensIn:0, tokensOut:0, costUsd:0, cached:true}` —
sem token cost em hit. **Erros nao sao cacheados** (proxima tentativa
sai limpa).

**Helpers em `lib/llm.js`:**
- `completeJSON(input, meta)` — back-compat (descarta usage)
- `completeJSONWithUsage(input, meta)` — Sonnet 4.6 + usage
- `completeJSONFast(input, meta)` — Haiku 4.5 + cache default ON
- `completeJSONFastWithUsage(input, meta)` — Haiku 4.5 + usage + cache

`meta.cache: false` desabilita cache na chamada.

## Upstash Redis — 4 sistemas compartilhados

Em prod, **4 sistemas usam Upstash Redis** pra estado cross-lambda
(Vercel serverless multi-instancia). Sem `UPSTASH_REDIS_REST_URL` +
`UPSTASH_REDIS_REST_TOKEN`, cada um cai pra Map em-memoria (defesa fraca
em multi-lambda — bypass trivial).

1. **`lib/rate-limit.js`** — token bucket por `route:userId` ou `route:ip`,
   60s window. Endpoints LLM + auth (3 magic-links/email/hora).
2. **`lib/llm-cache.js`** — cache resposta LLM, TTL 1h.
3. **`lib/jobs/*`** — cache de busca Adzuna/Jooble, TTL 10min.
4. **Magic-link anti-spam** — Auth.js rate-limit.

Setup gratuito: 10k commands/dia no free tier Upstash. Console -> Redis ->
Create Database -> tab REST API -> copia URL + token -> Vercel env
(Production + Preview).

## RAG architecture

Em v0.10, o RAG passou de `keyword-only` (BM25-lite contra JSON local) para **hybrid real**
com Voyage AI + pgvector + RRF fusion. Pipeline completo:

```
                       +-----------------------+
                       |  scripts/ingest-      |
                       |  knowledge.mjs        |
                       |  (idempotente sha256) |
                       +-----------+-----------+
                                   |
        +--------------------------+--------------------------+
        |                                                     |
        v                                                     v
+---------------+                                  +-------------------------+
|  Voyage AI    |  voyage-3 (1024 dims)            |  Postgres + pgvector    |
|  embeddings   |  fallback OpenAI Matryoshka      |  KnowledgeChunk         |
|  $0.06/1M tok |                                  |  HNSW cosine index      |
+-------+-------+                                  +-----------+-------------+
        |                                                      |
        | UPSERT (hash sha256 contentHash + embedding)         |
        +------------------------------------------------------+

Em runtime (lib/knowledge/retrieval.js):

  Query do prompt
    |
    +-- embedQuery() -> Voyage 1024-dim vector
    |     -> ORDER BY embedding <=> $vec (cosine) -> top-K vector candidates
    |
    +-- tokenize NFD + lowercase
          -> BM25-lite com audience boost 1.5x + tag-match boost
          -> top-K keyword candidates
                                |
                                v
                +---------------+---------------+
                |  RRF fusion (k=60)            |
                |  score = sum(1 / (k + rank))  |
                +---------------+---------------+
                                |
                                v
                +---------------+---------------+
                |  top 3 chunks -> context       |
                |  formatAsContext()             |
                +---------------+---------------+
                                |
                                v
                       prompt LLM com fontes
```

**Knowledge base:** 159 chunks curados manualmente (CV/LinkedIn/Interview/Transition/
Salary/Soft-skills/ATS/Mercado-BR/Tech-modern/Identidade/Network). Nao e scraped.

**Eval framework:** 50 queries com ground truth manual. `recall@3 / MRR / NDCG@5` + gate
`recall@3 >= 70%`. Atualmente 93.9% keyword-only (PASSED); 96-98% esperado pos-ingestao
Voyage.

**Detalhes completos em `docs/RAG.md` (700 linhas).**

## Billing architecture

Stripe Phase 1+2 (Checkout + Portal + Webhooks). Sem `STRIPE_SECRET_KEY`, todos endpoints
retornam 503 amigavel — app continua usavel.

```
   /api/billing/checkout
        |
        v
   Stripe Checkout Session  --redirect-->  Usuario paga (cartao BR)
                                                |
                                                v
                                        Stripe envia event
                                                |
                                                v
   /api/billing/webhook  <-- POST  (Stripe-Signature header)
        |
        +-- HMAC verify (lib/billing/stripe.js)
        +-- idempotency check (BillingEvent.stripeEventId unique)
        +-- handle event:
             - checkout.session.completed -> upsert Subscription{status=ACTIVE}
             - invoice.payment_succeeded -> renew currentPeriodEnd
             - customer.subscription.deleted -> status=CANCELED
        +-- create BillingEvent + AuditLog
        |
        v
   Subscription{status, plan, currentPeriodEnd} persisted
        |
   Proxima chamada LLM (analyze/tailor/opportunities/interview):
        |
        v
   lib/billing/enforce.js
        |
        +-- 1) OWNER_EMAILS bypass? -> liberar
        +-- 2) Subscription lookup -> plan = Free | Pro M | Pro Y | Team
        +-- 3) Prisma.$transaction({ isolationLevel: 'Serializable' }):
              - SELECT UsageMeter (kind, period)
              - IF count >= limit -> throw QuotaExceededError (429)
              - INCREMENT UsageMeter
        +-- 4) prossegue chamada LLM (cost log + budget cap)
```

**Planos atuais (Price IDs placeholder ate criar no Stripe):**

| Plan | Mes | Ano | Limites (Free tier mais generoso pos-v0.10) |
|---|---|---|---|
| Free | grátis | — | analyze 10/mes, tailor 5/mes, opp 20/dia, interview 10/mes |
| Pro Monthly | R$29 | — | quotas elevadas + budget $5/dia |
| Pro Yearly | — | R$290 | igual Pro M (~17% desconto) |
| Team | R$99/seat | — | quotas + features colaborativas |

**OWNER_EMAILS** = bypass total (Sergio + Daniel testam sem limit).

**Detalhes em `docs/MONETIZACAO.md`.**

## Observability + AuditLog

Tres camadas complementares:

**Sentry** — captura de erros server + client. Inicializado em `sentry.client.config.js`,
`sentry.server.config.js`, `sentry.edge.config.js` e `instrumentation.js`. Tudo *no-op* se
`SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` nao estiverem setados. `beforeSend` filtra rotas
sensiveis (whitelist expandida em v0.10: `/api/analyze`, `/api/chat`, `/api/cv/upload`,
`/api/me/export`, `/api/tailor`, `/api/interview`, `/api/linkedin/parse`,
`/api/billing/*`, `/api/profile/refresh`) e remove `request.data`, `cookies` e header
`Authorization`. Source maps so publicados se `SENTRY_ORG` + `SENTRY_PROJECT` estiverem
setados (gatekeeper em `next.config.mjs`).

**PostHog** — eventos de produto. `components/PostHogProvider.js` inicializa via
`NEXT_PUBLIC_POSTHOG_KEY` (no-op sem chave), com `autocapture: false`,
`disable_session_recording: true` e `respect_dnt: true`. Eventos manuais capturados:

| Evento | Onde dispara | Props |
|---|---|---|
| `diagnosis_completed` | `/app/page.js` apos `/api/analyze`+`/api/opportunities` | cv_chars, role_len, elapsed_seconds, overall_score, jobs_returned, jobs_illustrative, is_logged |
| `application_saved` | `KanbanClient` (origin=manual) e `SaveJobButton` (origin=from_jobs) | status, has_url, has_local, source, origin |
| `digest_clicked` | `PostHogProvider` quando `?utm_source=digest` na URL | medium, campaign, landing |

Os links no email digest (`lib/email.js`) ja carregam UTM
(`?utm_source=digest&utm_medium=email&utm_campaign=weekly`).

**AuditLog (NOVO em v0.10)** — `lib/audit.js` com **17 actions** persistidas em
`AuditLog{action, userIdHash, ipHash, createdAt, metadata}`. **LGPD-friendly:** IP nao e
armazenado em claro — somente `sha256(ip + AUDIT_IP_SALT)` (anti-rainbow). Cobre:

- Auth: `login_success`, `login_failed`, `magic_link_sent`, `logout`
- Diagnostico: `analyze_completed`, `analyze_anonymous`, `refresh_completed`
- Acoes: `tailor_completed`, `interview_completed`, `chat_message`
- LGPD: `data_exported`, `account_deleted`, `cv_redacted`
- Billing: `checkout_started`, `subscription_activated`, `subscription_canceled`,
  `quota_exceeded`

Resolve gap **A09 (Security Logging & Monitoring Failures)** do audit OWASP Top 10:2025.

**LLM cost log** — cada chamada LLM em `lib/llm.js` produz JSON-line estruturado:
`{ tokens_in, tokens_out, custo_usd, latencia_ms, route, userId }`. Budget per-user diario:
$0.10 Free / $5 Pro / $20 Team. Mitigacao OWASP LLM10.

## Seguranca

Toda rota usa Zod com `.strict()` para impedir mass-assignment (ex.: `userId` no body), e
as saidas do LLM passam por shapes Zod (`.strip()` quando precisa tolerar campos extras sem
deixa-los persistir). Queries Prisma sempre filtram por `userId` da sessao, nunca aceitam
ID de dono vindo do cliente — **2-step query pattern** evita IDOR.

**11 vulnerabilidades P0+P1 corrigidas na Onda 11:**

1. XSS via Zod URL (`safeExternalUrl` + `safeHref` em 5 sinks)
2. Rate-limit Upstash Redis (cross-lambda) + fallback Map
3. TOCTOU em UsageMeter -> `Prisma.$transaction` `Serializable`
4. Cost amplification -> budget per-user diario
5. AuditLog 17 actions + IP hash LGPD-friendly
6. Profile.rawCv TTL 90d + cron diario
7. `migrate deploy` fora do build (`docs/DEPLOY.md` 3 estrategias)
8. Transacao gigante /opportunities -> `createMany` batch
9. Auth rate-limit (3 magic-links/email/hora)
10. Middleware PROTECTED sync (`lib/auth-protected-paths.js` SSoT)
11. Chat ownership (body sem perfil/gaps — server carrega DB)

Adicionais: SSRF custom HTTPS agent + IP pinning (mitiga DNS rebinding TOCTOU), Sentry
whitelist expandida, CI gate `npm audit` + Dependabot weekly, Stripe Webhook HMAC +
idempotency.

**Cobertura OWASP:** auditoria completa em **5 read-only audits** em `docs/audits/`
(`01-backend`, `02-frontend`, `03-db-infra`, `04-appsec-owasp` [OWASP Top 10:2025],
`05-ai-llm-security` [OWASP LLM Top 10]).

## Backup de Postgres

O produto **nao** roda backup proprio — depende do provider gerenciado. Tres opcoes
recomendadas:

1. **Neon** (https://neon.tech) — backup automatico continuo (point-in-time recovery de
   ate 7 dias no free, 30 dias no pago). **Recomendado** (suporta pgvector nativo).
2. **Supabase** (https://supabase.com) — snapshot diario automatico no free, point-in-time
   recovery nos planos pagos.
3. **Vercel Postgres** (powered by Neon) — backup diario automatico, painel no proprio
   Vercel.

**Restore drill** (exercitar a cada 3 meses):

1. Criar branch/snapshot do DB no painel do provider.
2. Apontar `DATABASE_URL` de uma instancia staging pra esse snapshot.
3. Rodar `npx prisma migrate status` + smoke test (`/api/analyze` + `/api/applications`).
4. Documentar tempo total (RTO) — objetivo: < 30 minutos.

**O que nao entra no backup:**
- Sessoes Auth.js (sao recriadas no proximo login).
- Cache em memoria (`lib/jobs/*`, fallback Map de `lib/rate-limit.js`) — efemero por design.
- Cache Upstash Redis — efemero por design.
- Logs de LLM (gravados em stdout, capturados pelo provider de log do Vercel).

## CI/CD

GitHub Actions roda dois workflows em `.github/workflows/`:

- **`ci.yml`** — `npm ci` + `npx prisma generate` + `npm test` (vitest, **878 testes**) +
  `npm audit` (gate) a cada push em `main` e em todo PR pra `main`. Bloqueante.
- **`e2e.yml`** — Playwright contra Postgres em service container. Roda em push pra `main`
  e em PRs *com a label `e2e`* (opt-in pra nao gastar minutos do Actions). Requer secret
  `ANTHROPIC_API_KEY` no repo — sem ele, o teste e auto-skipado pelo guard interno.

Dependabot configurado pra updates semanais (npm + GitHub Actions).

**Migrations fora do build:** `prisma migrate deploy` nao roda mais no `build` (evita race
em PRs paralelos). Tres estrategias em `docs/DEPLOY.md`:
- Manual antes do deploy
- Vercel Install Command (`npm ci && npx prisma migrate deploy`)
- GitHub Action dedicada (`workflow_dispatch`)

## Como rodar local

```bash
docker compose up -d              # Postgres + Mailpit
npm install                       # inclui stripe, @upstash/redis, voyage client
cp .env.example .env              # preencher chaves (toda integracao off = no-op)
npx prisma migrate deploy         # cria o schema (nao roda mais no build)
npm run dev                       # http://localhost:3000
```

Opcionais (todas com fallback gracioso quando ausentes):

```bash
# Pra ativar lane vetorial do RAG (depois de setar VOYAGE_API_KEY):
npm run ingest:knowledge

# Pra rodar gate de eval RAG (recall@3 >= 70%):
npm run eval:rag
```
