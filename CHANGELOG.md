# Changelog

Todas as mudancas notaveis deste projeto sao documentadas aqui.

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento [SemVer](https://semver.org/lang/pt-BR/).

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
