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

## Como rodar local

```bash
docker compose up -d              # Postgres + Mailpit
npm install
npx prisma migrate dev            # cria o schema
npm run dev                       # http://localhost:3000
```
