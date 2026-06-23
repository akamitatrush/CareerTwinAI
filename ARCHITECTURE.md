# Arquitetura — CareerTwin AI

Plataforma de gestao de carreira em pt-BR. MVP funcional sobre Next.js 14 (App Router),
organizado em 4 pilares: **Autoconhecimento, Diagnostico, Acao e Oportunidade**. Da
identidade ate a contratacao, com auditabilidade radical e LGPD por construcao.

## Stack

- **App**: Next.js 14 (App Router, RSC), React 18, JS puro. Claude Design System (Plus
  Jakarta Sans + Spectral, paleta Indigo Sereno).
- **Banco**: PostgreSQL via Prisma 6.
- **Auth**: Auth.js v5 (magic link Email + LinkedIn OIDC opcional; CredentialsProvider em dev).
- **LLM**: Anthropic Claude (saidas estruturadas validadas com Zod). LLM gera apenas
  explicacoes — valores sao calculados deterministicamente em codigo.
- **Vagas**: agregador 6 providers — Adzuna BR + Jooble + Greenhouse + Lever + Ashby +
  Workable (fallback em fixtures).
- **Email**: Resend (prod) com fallback SMTP / Mailpit (dev) via Nodemailer.
- **Parsing**: pdf-parse (CV em PDF), Zod (entrada e saida).
- **Knowledge**: RAG-lite com keyword retrieval BM25-like contra knowledge base JSON
  (`lib/knowledge/`); fontes curadas pra cursos sugeridos.
- **Observabilidade**: Sentry (errors), PostHog (eventos), UptimeRobot (`/api/health`).
- **Testes**: Vitest (unit, 200+ casos) + Playwright (e2e, 5 specs).

## Diagrama (alto nivel)

```
                +----------------------+
   Browser  --> |  Next.js App Router  |
   (pt-BR)     |  - Server Components  |
                |  - API routes        |
                |  - middleware (auth) |
                +----------+-----------+
                           |
        +------------------+--------------------+----------------+
        |                  |                    |                |
        v                  v                    v                v
  +-----------+     +-------------+     +---------------+   +---------+
  | Anthropic |     | PostgreSQL  |     | 6 ATS Provs.  |   | Resend  |
  | (Claude)  |     | (Prisma)    |     | Adzuna/Jooble |   | / SMTP  |
  |           |     |             |     | Greenhouse    |   |         |
  |           |     |             |     | Lever/Ashby   |   |         |
  |           |     |             |     | Workable      |   |         |
  +-----------+     +-------------+     +---------------+   +---------+
```

## 4 Pilares

A aplicacao se organiza em 4 pilares (de identidade a contratacao):

1. **Autoconhecimento** (`/autoconhecimento`) — 3 mini-assessments (DISC-lite, Valores,
   Ikigai). Persistidos em `AssessmentResult`. Disclaimer etico em todas as telas.
2. **Diagnostico** (`/dashboard`, `/transparencia`) — Career Health Score (0-100) com 4
   sub-scores 100% deterministicos em `lib/scoring/subscores.js`. LLM gera apenas
   explicacoes (nunca valores).
3. **Acao** (`/gaps`, `/evidencias`, `/cvs-adaptados`) — Skill Gap Mapper com microactions
   + cursos sugeridos via RAG-lite; evidencias de competencia; CVs adaptados com diff.
4. **Oportunidade** (`/oportunidades`, `/candidaturas`) — Radar de vagas (6 providers) com
   match matematico explicado; kanban de candidaturas com timeline auditavel.

## Estrutura de pastas

```
app/                    rotas (RSC + API) — 12 telas auth + 5 publicas
  api/                  endpoints (/analyze, /opportunities, /assessments/[kind],
                        /evidence, /tailored-cvs, /gaps, /courses, /applications,
                        /linkedin, /portfolio, /cron/digest, /upload-cv, /health ...)
  dashboard/            Career Health + sub-scores + proximas acoes
  autoconhecimento/     3 assessments (DISC-lite, Valores, Ikigai)
  gaps/                 Skill Gap Mapper + microactions + cursos sugeridos
  oportunidades/        Radar de vagas + match breakdown
  cvs-adaptados/        Historico de CVs adaptados (diff antes/depois)
  evidencias/           Evidencias de competencia (projetos, cases, metricas)
  candidaturas/         Kanban + funil de conversao
  transparencia/        Formula auditavel + sources + LGPD
  conta/                Perfil + cargo-alvo + stats
  meus-dados/           LGPD (ver, exportar, apagar)
components/             UI compartilhada (AppShell, NotificationBell, modais...)
lib/
  jobs/                 6 providers (adzuna, jooble, greenhouse, lever, ashby,
                        workable) + cache + fixtures fallback
  knowledge/            RAG-lite: retrieval + course-retrieval + JSON knowledge base
  scoring/              subscores deterministicos (TF-like, count/validity/diversity,
                        completude, year-range)
  metrics/              completeness.js (weighted field-presence)
  validators.js         Zod schemas (60+ schemas; body + shape de LLM)
  llm.js                wrapper Anthropic/OpenAI (retry, sanitizacao, cost log)
  email.js              digest semanal (Resend ou SMTP)
  rate-limit.js         throttle por user/IP
  score.js, pdf.js, prompts.js, db.js, auth.js, data-export.js
prisma/schema.prisma    modelo de dados
tests/unit/             Vitest (200+ casos)
tests/e2e/              Playwright (5 specs)
```

## Modelos Prisma principais

- **User** — conta Auth.js, contem flags de digest (`digestEnabled`, `lastDigestAt`).
- **Profile** — perfil 1:1 com User; CV bruto, JSON do LinkedIn, GitHub, portfolio.
- **ScoreSnapshot** — diagnostico imutavel por momento (overall + sub-scores + perfil JSON).
- **Gap** — habilidade faltante por snapshot (com microacao e impacto estimado).
- **PlanItem** — item do plano por snapshot (pendente/feita).
- **AssessmentResult** — resultado de assessment (kind: DISC_LITE | VALUES | IKIGAI;
  answers + result em JSON).
- **Evidence** — evidencia de competencia (kind, title, description, url; demonstrar
  competencia em vez de declarar).
- **TailoredCv** — CV adaptado por vaga (jobTitle, company, adaptedCv text, diff JSON).
- **Application** — candidatura salva no kanban (status enum, notas, salario, source).
- **ApplicationEvent** — historico de transicao de status (audit trail).
- **Consent** — registro LGPD de cada fonte de dado consentida (payloadHash SHA256).
- **DataSource** — metadados de ingestao (rotulo, tamanho, kind).

## Fluxos-chave

1. **Diagnostico** — usuario cola CV ou faz upload de PDF; rota `/api/analyze` valida com Zod
   (`AnalyzeBody`), chama o LLM, valida o shape de volta (`DiagShape`); **sub-scores sao
   calculados em codigo deterministico** (`lib/scoring/subscores.js`), nao pelo LLM.
   Persiste `ScoreSnapshot` + `Gap[]` + `PlanItem[]` se logado, ou retorna apenas em
   memoria se anonimo.
2. **Autoconhecimento** — `/api/assessments/[kind]` (GET retorna progresso, POST persiste
   respostas + resultado). 3 kinds: DISC_LITE, VALUES, IKIGAI. Disclaimer etico em todas
   as telas pra deixar claro que nao substitui avaliacao psicometrica clinica.
3. **Skill Gap + Cursos** — `/api/gaps/summary` consolida gaps por snapshot; `/api/courses`
   usa **RAG-lite** (`lib/knowledge/course-retrieval.js`) com skill-keyed lookup + boost
   pra cursos gratuitos contra knowledge base JSON curada.
4. **Importacao** — `/api/linkedin/parse` recebe texto colado, gera CV consolidado +
   estrutura de perfil; `/api/portfolio/import` extrai stack/projetos do GitHub ou de uma
   URL pessoal (com anti-SSRF). Ambos passam por Zod no body e na saida do LLM.
5. **Vagas (6 providers)** — `lib/jobs/index.js` busca em paralelo Adzuna BR, Jooble,
   Greenhouse, Lever, Ashby e Workable (`Promise.allSettled` fail-soft, dedupe + cache
   TTL 10min). Match calculado por intersecao normalizada de skills.
6. **CVs adaptados** — `/api/tailor` recebe CV + vaga, retorna CV adaptado com diff
   antes/depois (campo `diff` JSON em `TailoredCv` pra visualizacao).
7. **Tracking** — usuario salva vaga (`POST /api/applications`), arrasta entre colunas
   (`PATCH /api/applications/:id`); cada transicao grava `ApplicationEvent` (audit).
8. **Monitoramento** — `GET /api/cron/digest` (com `CRON_SECRET`) percorre usuarios com
   `digestEnabled=true` e `targetRole`, busca novas vagas via `lib/jobs`, renderiza HTML em
   `lib/email.js` e dispara via Resend; marca `lastDigestAt` pra nao reenviar na semana.
9. **Health check** — `GET /api/health` retorna `{status, db, time}` pra UptimeRobot.

## Seguranca

Toda rota usa Zod com `.strict()` para impedir mass-assignment (ex.: `userId` no body), e as
saidas do LLM passam por shapes Zod (`.strip()` quando precisa tolerar campos extras sem
deixa-los persistir). Queries Prisma sempre filtram por `userId` da sessao, nunca aceitam
ID de dono vindo do cliente — **2-step query pattern** evita IDOR (busca `snapshotIds` da
sessao, depois filtra `IN`; retorna 404 nao 403 pra evitar enumeration). Rate-limit em
memoria (`lib/rate-limit.js`) protege rotas caras (LLM, jobs, upload). CSP em
`middleware.js` (`self` + `unsafe-inline` pragmatica em Next 14). Uploads de PDF tem teto
de tamanho, sniffing de magic bytes (PDF, DOCX, DOC legacy), e o texto extraido passa por
validacao antes do LLM. System prompts ficam isolados do user content para mitigar prompt
injection (OWASP LLM01). Portfolio import tem anti-SSRF (bloqueia IPs privados, CGNAT,
link-local, `.local`/`.internal`). Cron usa `safeCompare` constant-time + header-only.
Consentimentos LGPD sao registrados em `Consent` com `payloadHash` SHA256, e `/meus-dados`
permite exportar (inclui assessments + evidence + tailoredCvs) e apagar tudo (cascade em
`User`).

## Observabilidade (v0.5)

**Sentry** — captura de erros server + client. Inicializado em `sentry.client.config.js`,
`sentry.server.config.js`, `sentry.edge.config.js` e `instrumentation.js`. Tudo *no-op* se
`SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` nao estiverem setados. `beforeSend` filtra rotas
sensiveis (`/api/analyze`, `/api/chat`, `/api/cv/upload`, `/api/me/export`, `/api/tailor`,
`/api/interview`, `/api/linkedin/parse`) e remove `request.data`, `cookies` e header
`Authorization` antes de enviar. Source maps so publicados se `SENTRY_ORG` + `SENTRY_PROJECT`
estiverem setados no build (gatekeeper em `next.config.mjs`).

**PostHog** — eventos de produto. `components/PostHogProvider.js` inicializa via
`NEXT_PUBLIC_POSTHOG_KEY` (no-op sem chave), com `autocapture: false`,
`disable_session_recording: true` e `respect_dnt: true` (sem rastrear quem opta por DNT).
Eventos manuais capturados:

| Evento | Onde dispara | Props |
|---|---|---|
| `diagnosis_completed` | `/app/page.js` apos `/api/analyze`+`/api/opportunities` | cv_chars, role_len, elapsed_seconds, overall_score, jobs_returned, jobs_illustrative, is_logged |
| `application_saved` | `KanbanClient` (origin=manual) e `SaveJobButton` (origin=from_jobs) | status, has_url, has_local, source, origin |
| `digest_clicked` | `PostHogProvider` quando `?utm_source=digest` na URL | medium, campaign, landing |

Os links no email digest (`lib/email.js`) ja carregam UTM
(`?utm_source=digest&utm_medium=email&utm_campaign=weekly`).

## Backup de Postgres

O produto **nao** roda backup proprio — depende do provider gerenciado. Tres opcoes
recomendadas, em ordem de preferencia:

1. **Neon** (https://neon.tech) — backup automatico continuo (point-in-time recovery de
   ate 7 dias no free, 30 dias no pago). Provedor recomendado: zero configuracao, ja
   integra direto via `DATABASE_URL`.
2. **Supabase** (https://supabase.com) — snapshot diario automatico no free, point-in-time
   recovery nos planos pagos. Considerar se ja usar outras features do Supabase
   (auth, storage).
3. **Vercel Postgres** (powered by Neon) — backup diario automatico, painel no proprio
   Vercel. Opcao default se ja deployar la.

**Restore drill** (deve ser exercitado a cada 3 meses pra garantir que funciona):

1. Criar branch/snapshot do DB no painel do provider.
2. Apontar `DATABASE_URL` de uma instancia staging pra esse snapshot.
3. Rodar `npx prisma migrate status` + smoke test (`/api/analyze` + `/api/applications`).
4. Documentar tempo total (RTO) — objetivo: < 30 minutos.

**O que nao entra no backup:**
- Sessoes Auth.js (sao recriadas no proximo login).
- Cache em memoria (`lib/jobs/*`, `lib/rate-limit.js`) — efemero por design.
- Logs de LLM (gravados em stdout, capturados pelo provider de log do Vercel).

## CI/CD

GitHub Actions roda dois workflows em `.github/workflows/`:

- **`ci.yml`** — `npm ci` + `npx prisma generate` + `npm test` (vitest, 200+ testes) a cada
  push em `main` e em todo PR pra `main`. Bloqueante.
- **`e2e.yml`** — Playwright contra Postgres em service container. Roda em push pra `main`
  e em PRs *com a label `e2e`* (opt-in pra nao gastar minutos do Actions). Requer secret
  `ANTHROPIC_API_KEY` no repo — sem ele, o teste e auto-skipado pelo guard interno.

## Como rodar local

```bash
docker compose up -d              # Postgres + Mailpit
npm install
npx prisma migrate dev            # cria o schema
npm run dev                       # http://localhost:3000
```
