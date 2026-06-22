# Arquitetura — CareerTwin AI

Copiloto de carreira em pt-BR. MVP funcional sobre Next.js 14 (App Router), focado em
diagnostico de empregabilidade, plano de acao e tracking de candidaturas.

## Stack

- **App**: Next.js 14 (App Router, RSC), React 18, JS puro.
- **Banco**: PostgreSQL via Prisma 6.
- **Auth**: Auth.js v5 (magic link Email + LinkedIn OIDC opcional; CredentialsProvider em dev).
- **LLM**: Anthropic Claude (saidas estruturadas validadas com Zod).
- **Vagas**: agregador Adzuna + Jooble + Greenhouse (fallback em fixtures).
- **Email**: Resend (prod) com fallback SMTP / Mailpit (dev) via Nodemailer.
- **Parsing**: pdf-parse (CV em PDF), Zod (entrada e saida).
- **Testes**: Vitest (unit) + Playwright (e2e).

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
  | Anthropic |     | PostgreSQL  |     | Adzuna/Jooble |   | Resend  |
  | (Claude)  |     | (Prisma)    |     | / Greenhouse  |   | / SMTP  |
  +-----------+     +-------------+     +---------------+   +---------+
```

## Estrutura de pastas

```
app/                    rotas (RSC + API)
  api/                  endpoints (/analyze, /opportunities, /applications, /linkedin, /portfolio, /cron/digest, /upload-cv ...)
  candidaturas/         kanban de candidaturas
  meu-gemeo/            diagnostico + historico de score
  meus-dados/           LGPD (ver, exportar, apagar)
components/             UI compartilhada
lib/
  jobs/                 providers (adzuna, jooble, greenhouse) + cache + types
  validators.js         Zod schemas (body de rota + shape de LLM)
  llm.js                wrapper do Claude (retry, sanitizacao)
  email.js              digest semanal (Resend ou SMTP)
  rate-limit.js         throttle por user/IP
  score.js, pdf.js, prompts.js, db.js, auth.js
prisma/schema.prisma    modelo de dados
tests/unit/             Vitest
tests/e2e/              Playwright
```

## Modelos Prisma principais

- **User** — conta Auth.js, contem flags de digest (`digestEnabled`, `lastDigestAt`).
- **Profile** — perfil 1:1 com User; CV bruto, JSON do LinkedIn, GitHub, portfolio.
- **ScoreSnapshot** — diagnostico imutavel por momento (overall + sub-scores + perfil JSON).
- **Gap** — habilidade faltante por snapshot (com microacao e impacto estimado).
- **PlanItem** — item do plano de 6 semanas por snapshot (pendente/feita).
- **Application** — candidatura salva no kanban (status enum, notas, salario, source).
- **ApplicationEvent** — historico de transicao de status (audit trail).
- **Consent** — registro LGPD de cada fonte de dado consentida.
- **DataSource** — metadados de ingestao (rotulo, tamanho, kind).

## Fluxos-chave

1. **Diagnostico** — usuario cola CV ou faz upload de PDF; rota `/api/analyze` valida com Zod
   (`AnalyzeBody`), chama o LLM, valida o shape de volta (`DiagShape`), persiste `ScoreSnapshot`
   + `Gap[]` + `PlanItem[]` se logado, ou retorna apenas em memoria se anonimo.
2. **Importacao** — `/api/linkedin/parse` recebe texto colado (~120-60k chars), gera CV
   consolidado e estrutura de perfil; `/api/portfolio/import` extrai stack/projetos do GitHub
   ou de uma URL pessoal. Ambos passam por Zod no body e na saida do LLM.
3. **Tracking** — usuario salva vaga (`POST /api/applications`), arrasta entre colunas
   (`PATCH /api/applications/:id`); cada transicao grava `ApplicationEvent` (audit).
4. **Monitoramento** — `GET /api/cron/digest` (com `CRON_SECRET`) percorre usuarios com
   `digestEnabled=true` e `targetRole`, busca novas vagas via `lib/jobs`, renderiza HTML em
   `lib/email.js` e dispara via Resend; marca `lastDigestAt` pra nao reenviar na semana.

## Seguranca

Toda rota usa Zod com `.strict()` para impedir mass-assignment (ex.: `userId` no body), e as
saidas do LLM passam por shapes Zod (`.strip()` quando precisa tolerar campos extras sem
deixa-los persistir). Queries Prisma sempre filtram por `userId` da sessao, nunca aceitam
ID de dono vindo do cliente. Rate-limit em memoria (`lib/rate-limit.js`) protege rotas
caras (LLM, jobs, upload). CSP com nonce em `middleware.js`. Uploads de PDF tem teto de
tamanho, sniffing de magic bytes, e o texto extraido passa por validacao antes do LLM.
System prompts ficam isolados do user content para mitigar prompt injection (OWASP LLM01).
Consentimentos LGPD sao registrados em `Consent`, e `/meus-dados` permite exportar e
apagar tudo (cascade em `User`).

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

- **`ci.yml`** — `npm ci` + `npx prisma generate` + `npm test` (vitest, 112 testes) a cada
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
