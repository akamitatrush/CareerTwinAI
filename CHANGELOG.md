# Changelog

Todas as mudancas notaveis deste projeto sao documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

> Acumula Waves 16 e 17 ainda nao tagueadas. Subsections abaixo agrupam por wave.

### Wave 17 — latencia + custo

#### Added

- **Streaming SSE em `/api/analyze`** — adicionando `?stream=1` na rota, ela
  passa a responder com `text/event-stream` emitindo 6 etapas progressivas:
  `validating`, `llm_jobs_parallel`, `computing`, `persisting`, `result`,
  `done`. Sem o query param, mantem JSON one-shot tradicional (back-compat
  total — testes existentes nao quebram). Pipeline interno (auth, rate-limit,
  validacao, billing, persist) e identico nos dois modos — so o transporte
  muda. Em erro estruturado emite `{type:"error", status, error, code}`.
- **Helpers `completeJSONFast` + `completeJSONFastWithUsage`** em `lib/llm.js`
  — wrappers em volta de `completeJSON*` que forcam `meta.model = FAST_MODEL`
  (Haiku 4.5). Sintaxe identica, swap por linha em 4 rotas leves.
- **LLM response cache (`lib/llm-cache.js`)** — chave
  `sha256(model|system|user)` truncada em 32 hex chars, TTL 1h. **Upstash
  Redis primary** (cross-lambda em Vercel) com **fallback Map em-memoria**
  (LRU pobre, cap 500 entries) quando sem Redis. Cache opt-out via
  `meta.cache: false` — habilitado em parsing/perguntas (`linkedin/parse`,
  `portfolio/import`, `cv/analyze-bullets`, `interview` action=question);
  desabilitado em rotas user-specific (`analyze`, `chat`, `tailor`,
  `profile/refresh`, `interview` action=evaluate). Hit retorna
  `{tokensIn:0, tokensOut:0, costUsd:0, cached:true}` (sem track de tokens em
  cache hit). Erros (LLM/parse) NAO sao cacheados.
- **`lib/api-handler.js` + `withApiGuard`** — wrapper aplicado em **9 rotas
  LLM** (`analyze`, `opportunities`, `interview`, `tailor`, `chat`,
  `cv/analyze-bullets`, `linkedin/parse`, `portfolio/import`,
  `profile/refresh`). Garante **JSON em qualquer erro** mesmo em throw
  inesperado: captura `P2021` (tabela faltando) -> 503 DB_TABLE_MISSING,
  `P2022/P2025` (drift) -> 503 DB_SCHEMA_DRIFT, `P1001/P1008/P1017`
  (DB indisponivel) -> 503 DB_UNAVAILABLE, fallback -> 500 SERVER_ERROR.
  Antes podia voltar HTML `<!DOCTYPE>` e quebrar parse no cliente
  (`Unexpected token '<'`).
- **Defense-in-depth no `middleware.js`** — constante `NEVER_BLOCK_PREFIXES`
  hardcoded como whitelist absoluta de rotas LLM que suportam modo
  experimentar anonimo (`/api/analyze`, `/api/opportunities`, `/api/interview`,
  `/api/tailor`, `/api/chat`, `/api/cv/`, `/api/linkedin/`, `/api/portfolio/`).
  Mesmo se algum agente regredir e re-adicionar essas rotas em
  `PROTECTED_PREFIXES`, esse whitelist garante que continuam acessiveis.

#### Changed

- **Paralelizacao LLM + searchJobs em `/api/analyze`** — antes eram serial
  (LLM primeiro, depois jobs); agora rodam via `Promise.allSettled`. `jobs`
  so precisa do `role` (nao do output do LLM). **-3 a -5s** de latencia
  percebida. Falha de jobs nao mata o diagnostico (degrada gracioso, score de
  aderencia computa com array vazio).
- **Haiku 4.5 em 4 rotas leves** — `/api/linkedin/parse`, `/api/portfolio/import`,
  `/api/cv/analyze-bullets`, `/api/interview` (action=question) migradas de
  Sonnet 4.6 para Haiku 4.5 via `completeJSONFastWithUsage`. **~3-5x mais
  rapido + 1/4 do custo**. Rotas criticas (`analyze`, `chat`, `tailor`,
  `profile/refresh`, `interview` action=evaluate) seguem em Sonnet 4.6.

#### Tests

- **+31 testes** (cumulativo agora **878 passing em 69 files**): SSE/streaming
  do analyze (`api-analyze-streaming.test.js`), cache LLM
  (`llm-cache.test.js`), helpers fast (`llm-fast.test.js`).

#### Performance

- `/api/analyze` (Sonnet): ~18s -> ~13-15s (paralelizacao economiza 3-5s).
- `/api/linkedin/parse` (Haiku + cache hit): 8-12s -> ~2-3s (ou 0s em hit).
- Custo medio por user mensal (Free tier): -30% estimado (cache + Haiku).

### Wave 16 — score-baseline + crons

#### Changed

- **`/api/profile/refresh` preserva sub-scores anteriores como baseline**
  quando `applyCompletedSkills=true`. LLM e nao-deterministico — mesmo CV gera
  perfil ligeiramente diferente a cada call e isso fazia score CAIR depois de
  marcar tarefa (re-extracao -9 + bonus +5 = liquido -4). Fix: quando user
  aplica conquistas explicitamente, usa `previousSnapshot.subScores` como
  floor; bonus aplicado em cima do baseline. **Score nunca cai apos marcar
  microacao concluida**.
- **`RefreshDiagnosisButton` aparece quando QUALQUER tarefa marcada** (antes
  era so quando todas as 3 estavam done — empty state). Agora aparece como
  hint em cima da lista assim que `completedCount > 0`. UX: user marca 1 ->
  ja ve "Atualizar diagnostico" -> recalcula sem esperar terminar todas.

#### Fixed

- **Vercel cron `/api/cron/daily-briefing`** — schedule `0 11 * * 2-7`
  (intervalo de day-of-week invalido pra Vercel — range 1-7) corrigido pra
  `0 11 * * 0,2,3,4,5,6` (dom + ter-sab, day-of-week semantica 0-6,
  pulando segunda). Vercel/cron usa convencao Unix (0 = domingo).
- **`AchievementToast.js` usa `createPortal` pra `document.body`** — antes
  renderizava inline e herdava `overflow:auto` da sidebar
  (`appshell-sidebar`); em alguns engines `position:fixed` era clipado e o
  toast aparecia "embaixo" do dashboard. Portal escapa do stacking ancestor.
  Texto do achievement `FIRST_REFRESH`: "Diagnostico atualizado" / "Voce
  recalculou seu Career Health depois de evoluir".

---

## [0.10.0] — 2026-06-27 (branch redesign/claude-design)

### Added — 4 pilares

- **Pilar 1 — Autoconhecimento:** 3 mini-assessments com narrativas + visualizacoes SVG
  (`DiscMatrix` quadrante, `ValoresRadar` 16 eixos, `IkigaiVenn` 4 circulos). Narrativas
  a partir de 6 arquetipos de Valores e careerHints DISC. `NextStepsBlock` integrado.
- **Pilar 3 — Skill Gap Mapper completo:** 41 cursos curados (entries com source, free,
  duracao, skill-keyed). Integracao inline em `/gaps` com microactions + completion
  endpoints.
- **Pilar 3 — Evidencias de competencia:** schema `Evidence` + `/evidencias` UI + export
  LGPD. Demonstrar > declarar.
- **Pilar 4 — Radar:** 32 fixtures curadas com skills extraiveis pela taxonomy (fixtures
  antigas geravam vagas sem skills -> match=0 -> tela vazia). 6 ATS providers (Adzuna BR,
  Jooble, Greenhouse, Lever, Ashby, Workable) + filtros senioridade/modelo/aderencia.

### Added — RAG real (Onda 9)

- **Voyage AI embeddings** (`voyage-3`, 1024 dims, ~$0.06/1M tokens) + OpenAI fallback
  Matryoshka (`text-embedding-3-small` 1536 dims truncado pra 1024 via parametro
  `dimensions`).
- **pgvector no Neon** com `Unsupported("vector(1024)")` no Prisma + HNSW cosine index.
- **Hybrid retrieval com RRF fusion** (k=60) — vetor (cosine) + keyword (BM25-lite
  com audience boost 1.5x + tag-match). Robusto contra magnitudes diferentes.
- **Knowledge base 30 -> 159 chunks** com cobertura: CV/LinkedIn/Interview/Transition/
  Salary/Soft-skills/ATS/Mercado-BR/Tech-modern/Identidade/Network. Curacao manual,
  nao scraped.
- **Ingestao idempotente** (`scripts/ingest-knowledge.mjs`) com sha256 `contentHash` +
  throttling pra free tier Voyage.
- **Eval framework:** 50 queries com ground truth manual + `recall@3 / recall@5 / MRR /
  NDCG@5` + **threshold gate (recall@3 >= 70%)**. Resultado atual: **93.9% recall@3
  keyword-only (PASSED)**; ~96-98% esperado pos-ingestao Voyage.
- Comandos `npm run ingest:knowledge` + `npm run eval:rag` + `npm run eval:rag:json`.
- `docs/RAG.md` (700 linhas) — arquitetura completa.

### Added — Monetizacao foundation (Onda 10)

- **Stripe SDK** + **Checkout Session** + **Customer Portal** + **5 Webhooks** com
  **HMAC verify** + **idempotencia** (`BillingEvent.stripeEventId` unique).
- Schema: `Subscription{status, plan, currentPeriodEnd, stripeCustomerId}` +
  `UsageMeter{kind, count, period}` + `BillingEvent{stripeEventId, type, payload}` +
  enum `SubscriptionStatus`.
- **Enforcement atomico** em 4 rotas LLM (analyze/tailor/opportunities/interview) via
  `lib/billing/enforce.js` — **TOCTOU fix com `Prisma.$transaction` isolationLevel
  `Serializable`**.
- 4 planos: Free / Pro Monthly R$29 / Pro Yearly R$290 / Team R$99 (todos com Price IDs
  placeholder ate criar no Stripe).
- **503 graceful** quando `STRIPE_SECRET_KEY` ausente — endpoints retornam 503 amigavel,
  resto da app continua funcionando.
- **OWNER_EMAILS env var** = bypass total de limite Free (Sergio testa sem limit).
- `docs/MONETIZACAO.md` — planos, setup, enforcement, seguranca.

### Added — Refresh diagnosis sem repaste (Onda 12)

- **`POST /api/profile/refresh`** — reusa `Profile.rawCv` + `targetRole` + `perfilJson`
  pra recalcular score (nao pede CV de novo).
- **Botao "Atualizar diagnostico"** em Report + modal **"Aplicar conquistas ao perfil?"**
  com 3 opcoes: aplicar+recalcular / so recalcular / cancelar.
- `promptDiag(completedHabilidades=[...])` — LLM gera gaps **diferentes** (anti-loop
  infinito quando user marca gaps como done).
- **Bonus deterministico de `impactoPontos`** aos sub-scores com **cap 15 por sub-score +
  20 total** (anti-gaming: impede que marcar 20 microacoes triviais infle o score).

### Added — Quality & Security (Onda 11)

- **5 audits read-only em `docs/audits/`:**
  - `01-backend.md` — review backend
  - `02-frontend.md` — review frontend
  - `03-db-infra.md` — review DB + infra
  - `04-appsec-owasp.md` — OWASP Top 10:2025
  - `05-ai-llm-security.md` — OWASP LLM Top 10
- **11 vulnerabilidades P0+P1 corrigidas:**
  1. **XSS via Zod URL** — `safeExternalUrl` + `safeHref` em 5 sinks
  2. **Rate-limit Upstash Redis** + fallback Map em memoria (cross-lambda em prod)
  3. **TOCTOU UsageMeter** — `Prisma.$transaction` `Serializable`
  4. **Cost amplification** — budget per-user $0.10/$5/$20 daily + log JSON
  5. **AuditLog** — 17 actions + LGPD-friendly IP hash sha256+`AUDIT_IP_SALT`
  6. **`Profile.rawCv` TTL 90d** + cron `/api/cron/redact-cv` diario
  7. **`migrate deploy` fora do build** + `docs/DEPLOY.md` (3 estrategias)
  8. **Transacao gigante /opportunities** -> `createMany` batch
  9. **Auth rate-limit** (3 magic-links/email/hora)
  10. **Middleware PROTECTED sync** — `lib/auth-protected-paths.js` SSoT
  11. **Chat ownership** — body sem perfil/gaps, server carrega DB pra evitar spoofing
- **Cron digest batching** (BATCH=10 paralelo + dedup por role).
- **SSRF custom HTTPS agent** com IP pinning (mitiga DNS rebinding TOCTOU) + private
  IPv4/IPv6/CGNAT blocks.
- **Sentry whitelist** expandida pra rotas sensiveis.
- **CI gate** — `npm audit` + Dependabot weekly.
- **467 testes** unit (+147 desde v0.9) em 36 arquivos + 5 e2e Playwright.

### Added — Plataforma

- **Upstash Redis** — rate-limit + cache cross-lambda em prod, Map fallback em dev.
- **OWNER_EMAILS** env — bypass total de limite Free para owners.
- **`POST /api/cron/usage-cleanup`** — limpeza periodica de `UsageMeter` antigo.
- 21 modelos no Prisma (era 13): + `Subscription` + `UsageMeter` + `BillingEvent` +
  `AuditLog` + `KnowledgeChunk` + `Notification`.

### Changed

- **Report.js polish:** hero CTA bar (+ /dashboard / /gaps / /oportunidades), sub-scores
  compactos com barra colorida (good/mid/low), top 3 microacoes + "Ver todas N", top 5
  vagas com filtro match>=30% + "Ver todas N", footer com nav.
- **User logado redirecionado pra /dashboard apos analyze** (era render inline redundante).
- **Free tier mais generoso:** analyze 3->10/mes, tailor 1->5/mes, opportunities
  5->20/dia, interview 5->10/mes.
- **SaaS polish holistico** (Onda 8): sombras Linear-style, typography hierarchy
  (display-1/2/3), botoes com gradient + inset glassy, 14 cards padronizados com depth,
  AppShell premium, focus rings, skeleton shimmer.
- **AppShell** sidebar 252px desktop, header colapsado mobile, Indigo Sereno + neutros
  quentes.

### Fixed

- **Radar vagas vazio** — fixtures match=0 corrigidas pra 32 curadas com skills
  extraiveis.
- **/dashboard EmptyState links broken** — apontavam pra /dashboard, agora "Construir
  meu gemeo" -> /.
- **TOCTOU em UsageMeter** — race condition no limite Free corrigida com Serializable.
- **SSRF parcial em /portfolio/import** — DNS rebinding (TOCTOU IP) mitigado com custom
  HTTPS agent + IP pinning.
- **`migrate deploy` no build** — race condition em PRs paralelos eliminada (rodadas
  manuais ou via Install Command).
- **Loop infinito de gaps no refresh** — LLM agora recebe `completedHabilidades` e gera
  gaps diferentes.
- 30+ outras correcoes de tipos/UX/a11y.

### Documentation

- `docs/RAG.md` — arquitetura RAG real (700 linhas).
- `docs/MONETIZACAO.md` — planos, setup Stripe, enforcement, seguranca.
- `docs/DEPLOY.md` — 3 estrategias para aplicar migrations fora do build.
- `docs/audits/` — 5 audits + remediacoes.
- `docs/HANDOFF_TIME_TERA.md` — 341 linhas para o time.

## [0.9.0] — MVP completo (branch redesign/claude-design)

### Added — 4 pilares completos

**Autoconhecimento (Pilar 1):**
- `/autoconhecimento` com 3 mini-assessments (DISC-lite, Valores, Ikigai)
- Schema `AssessmentResult` + 1 migration
- Endpoints `/api/assessments/[kind]` (GET/POST)
- Disclaimer ético em todas as telas

**Diagnóstico (Pilar 2):**
- Sub-scores 100% determinísticos em `lib/scoring/subscores.js`
- LLM só gera explicações (não valores)
- 4 fórmulas: TF-like + count/validity/diversity + completude + year-range
- Score auditável em `/transparencia`

**Ação (Pilar 3):**
- Skill Gap Mapper completo: gaps + microactions com completion endpoints + **cursos sugeridos** curados
- Evidências de competência: schema `Evidence` + `/evidencias` UI
- CVs adaptados: schema `TailoredCv` + `/cvs-adaptados` UI com diff antes/depois

**Oportunidade (Pilar 4):**
- 6 ATS providers: Adzuna BR, Jooble, Greenhouse, Lever, Ashby, Workable
- Filtros senioridade/modelo/aderência mínima
- Match breakdown "Por que?" inline com fórmula matemática

### Added — Plataforma
- AppShell sidebar 252px desktop + header mobile (Claude Design)
- 12 telas autenticadas + 5 públicas
- Notifications in-app com sininho na sidebar
- Welcome flow first-time experience
- Onboarding state X/3 sources tracking
- RAG-lite com knowledge base JSON + keyword retrieval
- `/api/health` pra UptimeRobot
- LGPD: export JSON inclui assessments + evidence + tailoredCvs

### Added — Quality
- 200+ testes unit (vitest)
- 5 specs E2E Playwright (skipped em CI por padrão)
- A11y audit (~85% score AA estimado)
- UX audit completo de 6 telas
- Hover micro-interactions + skeletons consistentes
- Light/dark theme toggle com persistência

### Added — Docs
- ALGORITHMS.md (4500+ palavras)
- OBSERVABILITY.md (Sentry + PostHog + UptimeRobot)
- HANDOFF_TIME_TERA.md
- Master plan + Frontend/Backend/Production architecture docs
- UX_REVIEW_PREVIEW.md + A11Y_AUDIT.md

### Changed
- Paleta verde-limão → Índigo Sereno (V2.zip mock)
- Fontes: Bricolage Grotesque + Source Serif → Plus Jakarta Sans + Spectral
- Default theme: dark → light
- `/meu-gemeo` → redirect pra `/dashboard`
- Positioning: "recolocação" → "gestão de carreira" (proposta Daniel Scharf)

### Fixed
- CSP bloqueando PostHog/Sentry (connect-src expandido)
- Sub-scores LLM-generated violando "número = cálculo"
- Resend signIn provider id mismatch
- Bricolage hardcoded em ~6 componentes
- 30+ violações WCAG AA com `--text-faint` recalibrado

## [0.4.0] — Fase "Pitch" (LinkedIn, Portfolio, Tracking, Digest)

### Added
- Importacao de **LinkedIn** via paste: rota `/api/linkedin/parse` que recebe texto colado,
  consolida em CV e estrutura perfil (experiencias, formacoes, skills) com validacao Zod
  (`LinkedinParseBody`, `LinkedinShape`).
- Importacao de **Portfolio**: rota `/api/portfolio/import` aceita username GitHub e/ou URL
  pessoal, retorna stack consolidada + projetos (`PortfolioImportBody`, `PortfolioShape`).
- **Tracking de candidaturas** (kanban): modelos `Application` e `ApplicationEvent` no
  schema Prisma; rotas `POST /api/applications` e `PATCH /api/applications/:id`; pagina
  `/candidaturas` com colunas SAVED → APPLIED → SCREENING → INTERVIEW → OFFER/REJECTED.
- **Digest semanal**: cron `/api/cron/digest` protegido por `CRON_SECRET`; renderiza HTML
  em `lib/email.js`; envia via Resend (fallback SMTP). Flags `digestEnabled` e
  `lastDigestAt` em `User` evitam reenvio.
- Provider de email **Resend** em `lib/email.js` (mantem fallback Mailpit/SMTP em dev).
- Enum `ApplicationStatus` e `ConsentSource` (com `WEEKLY_DIGEST`, `LINKEDIN_PASTE`,
  `PORTFOLIO_GITHUB`, `PORTFOLIO_URL`) no schema.
- Testes unit (~67 novos casos): `validators-pitch.test.js` cobre todos os novos schemas
  com casos OK + bordas; `email-digest.test.js` valida render do digest, escape XSS,
  singular/plural e payload Resend.
- Docs: `ARCHITECTURE.md` e `CHANGELOG.md`.

### Changed
- `Profile` ganhou colunas `linkedinRaw`, `linkedinJson`, `githubUser`, `portfolioJson`
  para guardar os dados importados.

### Security
- Todos os bodies novos usam `.strict()` (anti mass-assignment, ex. `userId`).
- Shapes do LLM usam `.strip()` em sub-objetos perfilados pra descartar campos extras
  injetados via prompt injection (OWASP LLM01).
- Username GitHub validado por regex `[a-zA-Z0-9._-]{1,80}` (anti path traversal / shell
  injection).
- HTML do digest faz escape em **todos** os campos vindos do LLM (titulo, empresa, local,
  source, url, nome, role) — anti-XSS em cliente de email.
- Cron `/api/cron/digest` exige header `Authorization: Bearer <CRON_SECRET>`.

## [0.3.0] — Seguranca

### Added
- **Rate limit** em memoria (`lib/rate-limit.js`) por user/IP, aplicado nas rotas LLM e
  jobs.
- **Retry** com backoff exponencial em chamadas ao Claude (`lib/llm.js`) — resiliencia a
  429/503 da API.
- **CSP com nonce** em `middleware.js` (anti-XSS).
- **System prompt isolado** do conteudo do usuario nas chamadas LLM (mitigacao OWASP
  LLM01 — Prompt Injection).
- Sanitizacao adicional de outputs LLM (truncamento, escape em strings que vao pra UI).

### Security
- Adocao das skills `seguranca-careertwin` e `owasp-security` como checklist obrigatorio
  em PRs que mexem em rotas, auth, Prisma, upload, LLM ou PII.

## [0.2.0] — Fase 2 (Vagas reais + Upload PDF)

### Added
- `lib/jobs/` com providers **Adzuna**, **Jooble** e **Greenhouse**, cache em memoria e
  fallback automatico em fixtures locais quando todos os providers falham.
- Skills taxonomy (`lib/skills-taxonomy.js`) para normalizar termos do LLM/vagas.
- Endpoint `/api/upload-cv` aceita PDF, faz parse com `pdf-parse`, valida tamanho e magic
  bytes (checklist OWASP da skill `seguranca-careertwin`).
- UI de `/oportunidades` mostra **fonte por vaga** (adzuna/jooble/greenhouse/fixture).

### Changed
- `/api/opportunities` agora consulta vagas reais em vez de retornar apenas fixtures.

### Security
- Limite de tamanho e validacao de tipo no upload de PDF.
- Validacao de magic bytes evita upload de binario disfarcado.
- Texto extraido passa por limites Zod antes de ir ao LLM.

## [0.1.0] — Fase 1 (Auth + LGPD)

### Added
- **Auth.js v5** com magic link Email (Mailpit em dev), LinkedIn OIDC opcional e
  `CredentialsProvider` apenas em dev.
- **Prisma + Postgres** via `docker-compose.yml` (Mailpit incluso).
- Schema inicial: `User`, `Account`, `Session`, `VerificationToken`, `Profile`,
  `ScoreSnapshot`, `Gap`, `PlanItem`, `Consent`, `DataSource`.
- Middleware de auth que tranca todas as rotas API (exceto publicas explicitas).
- Pagina `/meu-gemeo` (snapshot vigente + historico de score).
- Pagina `/meus-dados` (LGPD): ver, baixar (`/api/me/export`), apagar tudo (cascade em
  `User`).
- Testes Vitest (unit) + Playwright (e2e) — 45 casos iniciais cobrindo validators, pdf,
  score, jobs, skills e data-export.

### Security
- Diagnostico em modo "experimentar" e efemero (nao persiste sem login).
- Cascade em `User` garante que `DELETE` apaga tudo (LGPD direito ao esquecimento).
- Rotas API isoladas do front por middleware — nada de exposicao acidental.
