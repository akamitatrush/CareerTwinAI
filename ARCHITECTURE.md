# Arquitetura — CareerTwin AI

Plataforma de gestao de carreira em pt-BR. MVP funcional sobre Next.js 14 (App Router),
organizado em 4 pilares: **Autoconhecimento, Diagnostico, Acao e Oportunidade**. Da
identidade ate a contratacao, com auditabilidade radical e LGPD por construcao.

## Stack

- **App**: Next.js 14 (App Router, RSC), React 18, JS puro. Claude Design System (Plus
  Jakarta Sans + Spectral, paleta Indigo Sereno).
- **Banco**: PostgreSQL via Prisma 6 + extensao **pgvector** (RAG real).
- **Auth**: Auth.js v5 (magic link Email + LinkedIn OIDC opcional; CredentialsProvider em dev).
- **LLM**: Anthropic Claude Sonnet 4.6 (saidas estruturadas validadas com Zod). LLM gera
  apenas explicacoes — valores sao calculados deterministicamente em codigo.
- **Embeddings**: Voyage AI `voyage-3` (1024 dims) + OpenAI Matryoshka fallback.
- **Vagas**: agregador 6 providers — Adzuna BR + Jooble + Greenhouse + Lever + Ashby +
  Workable (fallback em fixtures).
- **Email**: Resend (prod) com fallback SMTP / Mailpit (dev) via Nodemailer.
- **Parsing**: pdf-parse (CV em PDF), mammoth (DOCX), Zod (entrada e saida).
- **Knowledge**: RAG hybrid (Voyage + pgvector + RRF fusion) com 159 chunks curados em
  `lib/knowledge/`; fontes curadas pra cursos sugeridos.
- **Billing**: Stripe SDK + Checkout + Customer Portal + Webhooks com HMAC + idempotencia.
- **Cache / Rate-limit**: Upstash Redis (prod, cross-lambda) com fallback Map em memoria.
- **Observabilidade**: Sentry (errors), PostHog (eventos), UptimeRobot (`/api/health`),
  **AuditLog** (17 actions com IP hash sha256+salt).
- **Testes**: Vitest (unit, 467 casos em 36 arquivos) + Playwright (e2e, 5 specs) +
  Eval RAG (50 queries com gate `recall@3 >= 70%`).

## Diagrama (alto nivel)

```
                +----------------------+
   Browser  --> |  Next.js App Router  |
   (pt-BR)     |  - Server Components  |
                |  - API routes        |
                |  - middleware (auth) |
                +----------+-----------+
                           |
   +-----+-----+----+----+----+----+-----+----+-----+
   |     |     |    |    |    |    |     |    |     |
   v     v     v    v    v    v    v     v    v     v
+----+ +----+ +---+ +---+ +---+ +---+ +-----+ +---+ +-----+
|LLM | |Emb | |DB | |ATS| |Mail| |Up | |Stri | |Sen| |Post |
|Anth| |Voy | |Pg | |6  | |Res | |sh | |pe   | |try| |Hog  |
|opic| |age | |+  | |Pro| |Send| |Red| |Check| |   | |     |
|    | |    | |Vec| |vs | |    | |is | |out  | |   | |     |
+----+ +----+ +---+ +---+ +----+ +---+ +-----+ +---+ +-----+
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
  api/                                39 route handlers
    analyze, opportunities, assessments/[kind], evidence, tailored-cvs, gaps,
    profile/refresh, profile/onboarding, profile/completeness, score, plan-items,
    linkedin/parse, portfolio/import, tailor, interview, chat, applications,
    history/actions, cv/upload, me/export, notifications, health,
    billing/{checkout, portal, webhook, plan},
    cron/{digest, redact-cv, usage-cleanup},
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
  validators.js                       Zod schemas (60+ schemas; body + shape de LLM)
  llm.js                              wrapper Anthropic/OpenAI (retry, sanitizacao,
                                      cost log + budget per-user)
  embeddings.js                       Voyage AI + OpenAI Matryoshka fallback
  audit.js                            AuditLog 17 actions (IP hash sha256+salt)
  safe-fetch.js                       Anti-SSRF custom HTTPS agent (IP pinning,
                                      mitiga DNS rebinding)
  url-safe.js                         safeExternalUrl + safeHref (Zod URL)
  email.js                            digest semanal (Resend ou SMTP)
  rate-limit.js                       Upstash Redis (prod) ou Map (dev/fallback)
  auth-protected-paths.js             SSoT do middleware (PROTECTED sync)
  env.js                              boot guards (AUTH_DEV_CREDENTIALS bloqueado em prod)
  score.js, pdf.js, docx.js, prompts.js, db.js, auth.js, data-export.js,
  notifications.js
prisma/
  schema.prisma                       21 modelos
  migrations/                         migrations versionadas (rodam fora do build)
scripts/
  ingest-knowledge.mjs                ingestao idempotente pgvector (sha256 contentHash)
tests/
  unit/                               Vitest (467 testes em 36 arquivos)
  e2e/                                Playwright (5 specs)
  eval/rag/                           50 queries · recall@3 / MRR / NDCG
docs/
  PRODUTO.md, ALGORITHMS.md, API.md, RAG.md (700 linhas), MONETIZACAO.md, DEPLOY.md,
  OBSERVABILITY.md, HANDOFF_TIME_TERA.md (341 linhas), audits/ (5 read-only)
middleware.js                         CSP + NextAuth gate + PROTECTED paths
next.config.mjs                       headers + Sentry source maps gatekeeper
vercel.json                           cron (digest weekly · redact-cv daily ·
                                      usage-cleanup)
docker-compose.yml                    Postgres + Mailpit pra dev
```

Numeros atuais: **39 route handlers** em `app/api/`, **12 telas autenticadas + 5 publicas**,
**21 modelos Prisma**, **467 testes unit em 36 arquivos**, **5 e2e specs**.

## Modelos Prisma principais

21 modelos no total. Destacando os principais (era 13 em v0.9, +8 em v0.10):

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

## Fluxos-chave

1. **Diagnostico** — usuario cola CV ou faz upload de PDF; rota `/api/analyze` valida com
   Zod (`AnalyzeBody`), faz **retrieval RAG hybrid** (Voyage + pgvector + RRF), chama o
   LLM, valida o shape de volta (`DiagShape`); **sub-scores sao calculados em codigo
   deterministico** (`lib/scoring/subscores.js`), nao pelo LLM. Persiste `ScoreSnapshot` +
   `Gap[]` + `PlanItem[]` se logado (+ `AuditLog`), ou retorna apenas em memoria se anonimo.
2. **Refresh sem repaste (NOVO)** — `POST /api/profile/refresh` reusa `Profile.rawCv` +
   `targetRole` + `perfilJson` (nao pede CV de novo). Calcula `projectedGains`
   deterministico com cap 15/sub + 20 total (anti-gaming). LLM recebe
   `completedHabilidades` e gera gaps **diferentes** (anti-loop). Aplica bonus +
   `computeAllSubScores` -> novo `ScoreSnapshot`.
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

- **`ci.yml`** — `npm ci` + `npx prisma generate` + `npm test` (vitest, 467 testes) +
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
