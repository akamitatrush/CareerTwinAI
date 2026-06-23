<div align="center">

# CareerTwin AI

**Plataforma de gestão de carreira com IA, em pt-BR.** Da identidade até a contratação, com auditabilidade radical e LGPD por construção.

[Como funciona](#-como-funciona) · [Stack](#-stack) · [Rodar local](#-rodar-localmente) · [Deploy](#-deploy-no-vercel) · [Segurança](#-segurança) · [Roadmap](#-roadmap)

![status](https://img.shields.io/badge/status-MVP%20funcional-1f1f1f) ![tests](https://img.shields.io/badge/tests-200%2B%20passing-2F7D5B) ![next](https://img.shields.io/badge/Next.js-14-1f1f1f) ![lgpd](https://img.shields.io/badge/LGPD-by%20design-B9D90C)

</div>

---

## O que é

CareerTwin AI cria um **gêmeo digital de carreira** a partir do CV, LinkedIn e GitHub do usuário, e organiza a jornada em 4 pilares:

1. **Autoconhecimento** — 3 mini-assessments (estilo comportamental DISC-lite, valores, Ikigai) pra entender quem você é antes de pensar em vaga.
2. **Diagnóstico** — Career Health Score auditável (0-100) com 4 sub-scores ponderados, cálculo determinístico em código, LLM só explica.
3. **Ação** — Skill Gap Mapper com cursos sugeridos, Evidências de competência (demonstrar > declarar), CVs adaptados com histórico.
4. **Oportunidade** — Radar de vagas com 6 providers (Adzuna BR, Jooble, Greenhouse, Lever, Ashby, Workable), filtros e match explicado matematicamente.

Princípio editorial: **número = cálculo auditável, texto = explicação com fonte**. Sem caixa-preta. Sem promessa de aprovação garantida. LGPD por construção.

---

## 🧭 Como funciona

```mermaid
flowchart LR
    A[CV / LinkedIn / GitHub] --> B[Estruturação via LLM]
    B --> C[Profile estruturado]
    C --> D[Diagnóstico determinístico]
    D --> E[Career Health Score]
    F[6 ATS Providers] --> G[Match calculado]
    C --> G
    E --> H[Plano de ação]
    G --> H
    H --> I["/dashboard"]
```

### Fluxo de diagnóstico

```mermaid
sequenceDiagram
    participant U as Usuário
    participant N as Next.js
    participant LLM as Claude Sonnet 4.6
    participant J as Job providers
    participant DB as Postgres

    U->>N: cola CV + cargo-alvo
    N->>N: valida Zod, rate-limit, sanitiza
    N->>LLM: prompt diag (system + user separados)
    LLM-->>N: JSON perfil, gaps, explicações
    N->>N: computeSubScores + computeOverall determinístico
    alt logado
        N->>DB: upsert Profile + create ScoreSnapshot + Gap + Consent
    end
    N-->>U: diagnóstico
    par paralelo
        N->>J: buscar vagas (6 providers)
        N->>LLM: gerar plano + cursos sugeridos
    end
    N-->>U: vagas + plano + cursos
```

---

## ⚡ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · Plus Jakarta Sans + Spectral (Claude Design) |
| Backend | Next.js Route Handlers (Node runtime) |
| Banco | Postgres 16 · Prisma 6 |
| Auth | Auth.js v5 (Email magic link via Resend, LinkedIn OIDC, Credentials dev) |
| LLM | Anthropic Claude Sonnet 4.6 (default) · OpenAI GPT-4o (opcional) |
| Vagas | Adzuna BR · Jooble · Greenhouse · Lever · Ashby · Workable |
| Email | Resend (prod) · Nodemailer/Mailpit (dev) |
| PDF | pdf-parse (com magic-bytes check) |
| Validação | Zod estrito (.strict() em todos os bodies) |
| Testes | Vitest (unit, 200+ casos) · Playwright (e2e, 5 specs) |
| Observabilidade | Sentry (errors) · PostHog (eventos) · UptimeRobot (`/api/health`) |
| Deploy | Vercel + Postgres externo (Neon/Supabase/Railway) |

---

## Algoritmos & Modelos

| Camada | Algoritmo | Implementação |
|---|---|---|
| Career Health Score | Média ponderada determinística (4 sub-scores) | `lib/score.js`, `lib/scoring/subscores.js` |
| Aderência a vagas | TF-IDF simplificado | `lib/scoring/subscores.js#computeAderenciaVagas` |
| Relevância das habilidades | Count + validity + diversity | `lib/scoring/subscores.js#computeRelevanciaHabilidades` |
| Otimização do perfil | Weighted field-presence | `lib/metrics/completeness.js` |
| Experiência de mercado | Year-range parsing + seniority alignment | `lib/scoring/subscores.js#computeExperienciaMercado` |
| Skill extraction | Token-level matching + NFD normalization | `lib/skills-taxonomy.js#extractSkills` |
| Job match | Set intersection normalizada | `lib/skills-taxonomy.js#matchScore` |
| RAG-lite | Keyword retrieval BM25-like + JSON knowledge base | `lib/knowledge/retrieval.js` |
| Course suggestion | Skill-keyed lookup + boost grátis | `lib/knowledge/course-retrieval.js` |
| LLM extraction | Zod strict + .strip + prompt isolation | `lib/prompts.js`, `lib/llm.js` |
| Auth IDOR-safe | 2-step query pattern | `app/api/history/actions/route.js` |
| LGPD cascade | Prisma onDelete + Consent payloadHash | `prisma/schema.prisma` |

Detalhes em [docs/ALGORITHMS.md](./docs/ALGORITHMS.md).

Pipeline de diagnóstico em uma vista:

```mermaid
flowchart LR
    CV[CV / PDF / DOCX / LinkedIn] --> LLM[Claude Sonnet 4.6:<br/>perfil + gaps + explicações]
    Cargo[Cargo-alvo] --> Jobs[searchJobs<br/>6 providers paralelo]
    LLM --> Code[Cálculo determinístico<br/>4 sub-scores]
    Jobs --> Code
    Code --> Score[Overall = Σ subscore × peso]
    Score --> Snapshot[(ScoreSnapshot imutável<br/>+ Gap + PlanItem<br/>+ Consent payloadHash)]
```

---

## Funcionalidades

### Autenticadas (após login)
- `/dashboard` — Career Health Score + sub-scores + 3 próximas ações + perfil snapshot + mediana comparativa
- `/autoconhecimento` — 3 assessments (DISC-lite, Valores, Ikigai)
- `/gaps` — KPI strip + requirements list + microactions com completion + cursos sugeridos
- `/oportunidades` — Radar de vagas com filtros + match breakdown explicado
- `/plano` — Histórico de score + timeline de ações
- `/cvs-adaptados` — Histórico de CVs adaptados por vaga
- `/evidencias` — Documentação de evidências de competência (projetos, cases, métricas)
- `/candidaturas` — Funil kanban (SAVED → APPLIED → INTERVIEW → OFFER)
- `/transparencia` — Fórmula auditável + data sources + LGPD
- `/conta` — Perfil + cargo-alvo + stats + LGPD
- `/meus-dados` — Export JSON + apagar tudo

### Públicas
- `/` — Split-panel onboarding (modo experimentar sem login)
- `/entrar` — Login (magic link + LinkedIn opcional + dev creds em preview)
- `/auth/verify-request` — Estado pós-envio do magic link
- `/privacidade` — Política LGPD
- `/termos` — Termos de uso
- `/api/health` — Health check pro UptimeRobot

---

## 📐 Arquitetura

```
careertwin-ai/
├─ app/
│  ├─ page.js                  Home — split-panel onboarding + modo experimentar
│  ├─ entrar/                  Login (magic link, LinkedIn, dev)
│  ├─ dashboard/               Career Health + sub-scores + próximas ações
│  ├─ autoconhecimento/        3 assessments (DISC-lite, Valores, Ikigai)
│  ├─ gaps/                    Skill Gap Mapper + microactions + cursos
│  ├─ oportunidades/           Radar de vagas + match breakdown
│  ├─ plano/                   Histórico de score + timeline
│  ├─ cvs-adaptados/           Histórico de CVs adaptados
│  ├─ evidencias/              Evidências de competência
│  ├─ candidaturas/            Kanban + funil de conversão
│  ├─ transparencia/           Fórmula auditável + sources
│  ├─ conta/                   Perfil + cargo-alvo + stats
│  ├─ meus-dados/              LGPD (ver, baixar JSON, apagar tudo)
│  └─ api/
│     ├─ analyze/              POST: CV + cargo → diagnóstico
│     ├─ opportunities/        POST: perfil → vagas (6 providers) + plano
│     ├─ assessments/[kind]/   GET/POST: DISC-lite, valores, Ikigai
│     ├─ evidence/             CRUD evidências de competência
│     ├─ tailored-cvs/         CRUD CVs adaptados (com diff)
│     ├─ gaps/                 GET summary + microactions + completion
│     ├─ courses/              GET cursos sugeridos por skill
│     ├─ linkedin/parse/       POST: texto LinkedIn → estrutura
│     ├─ portfolio/import/     POST: github/url → projetos extraídos
│     ├─ tailor/               POST: CV + vaga → CV adaptado
│     ├─ interview/            POST: simulador (pergunta + avaliação)
│     ├─ chat/                 POST: conversar com o "gêmeo"
│     ├─ applications/         CRUD do funil de candidaturas
│     ├─ history/actions/      Timeline com IDOR-safe pattern
│     ├─ cv/upload/            Upload PDF (magic-bytes + sanitização)
│     ├─ me/export/            Export LGPD (JSON com tudo)
│     ├─ health/               Health check (UptimeRobot)
│     ├─ cron/digest/          Cron semanal (Resend digest)
│     └─ auth/[...nextauth]/   Handler NextAuth v5
├─ components/
│  ├─ AppShell.js              Sidebar 252px desktop + header mobile
│  ├─ NotificationBell.js      Notifications in-app
│  ├─ Report.js                Saída do diagnóstico (gauge, sub-scores, gaps)
│  ├─ Modal.js                 Modal acessível (role=dialog + ARIA + ESC)
│  ├─ InterviewModal.js        Simulador STAR/CAR
│  ├─ ChatModal.js             Chat com o gêmeo
│  └─ TailorModal.js           Adaptador de currículo
├─ lib/
│  ├─ llm.js                   Anthropic/OpenAI agnóstico (retry + timeout + log custo)
│  ├─ prompts.js               Prompts (system + user separados, sanitização """)
│  ├─ validators.js            Zod strict em tudo (60+ schemas)
│  ├─ score.js                 Career Health Score (4 sub-scores · pesos)
│  ├─ scoring/subscores.js     Sub-scores 100% determinísticos
│  ├─ knowledge/               RAG-lite (retrieval + courses + JSON base)
│  ├─ jobs/                    6 providers + fixtures fallback
│  ├─ skills-taxonomy.js       Extração de skills + cálculo de match
│  ├─ metrics/completeness.js  Weighted field-presence
│  ├─ rate-limit.js            Janela em memória (anônimo vs logado)
│  ├─ email.js                 Digest HTML (Resend ou Nodemailer)
│  ├─ pdf.js                   Parser PDF defensivo
│  ├─ data-export.js           Export LGPD
│  └─ auth.js                  NextAuth config (Resend > Mailpit fallback)
├─ prisma/
│  ├─ schema.prisma            Modelos (User, Profile, Score, Gap, Assessment, Evidence, TailoredCv...)
│  └─ migrations/              Migrations versionadas
├─ tests/
│  ├─ unit/                    Vitest (200+ casos)
│  └─ e2e/                     Playwright (5 specs)
├─ middleware.js               CSP + NextAuth gate
├─ next.config.mjs             Headers de segurança estáticos
├─ vercel.json                 Cron weekly digest
└─ docker-compose.yml          Postgres + Mailpit pra dev
```

### Modelos de dados principais

```mermaid
erDiagram
    User ||--o| Profile : tem
    User ||--o{ ScoreSnapshot : "registra ao longo do tempo"
    User ||--o{ Application : "candidatura no funil"
    User ||--o{ Consent : "LGPD por fonte"
    User ||--o{ DataSource : "rastreio de origem"
    User ||--o{ AssessmentResult : "autoconhecimento"
    User ||--o{ Evidence : "evidências de competência"
    User ||--o{ TailoredCv : "CVs adaptados"
    ScoreSnapshot ||--o{ Gap : "lacunas priorizadas"
    ScoreSnapshot ||--o{ PlanItem : "plano de ação"
    Application ||--o{ ApplicationEvent : "timeline auditável"

    User { string id email }
    Profile { string targetRole string[] skills json perfilJson json linkedinJson json portfolioJson }
    ScoreSnapshot { int overall json subScores datetime createdAt }
    AssessmentResult { string kind json answers json result }
    Evidence { string kind string title string description string url }
    TailoredCv { string jobTitle string company text adaptedCv json diff }
```

---

## 🚀 Rodar localmente

**Pré-requisitos:**
- Node.js 18.18+
- Docker + docker-compose (para Postgres e Mailpit em dev)
- Uma chave Anthropic ([console.anthropic.com](https://console.anthropic.com))

```bash
# 1. Instalar
npm install

# 2. Subir Postgres + Mailpit (captura emails locais em http://localhost:8025)
docker compose up -d postgres mailpit

# 3. Configurar env
cp .env.example .env
# Preencha pelo menos:
#   ANTHROPIC_API_KEY=sk-ant-...
#   AUTH_SECRET=$(openssl rand -base64 32)
#   DATABASE_URL já vem apontando pro Postgres do compose

# 4. Aplicar schema no banco
npx prisma migrate dev

# 5. Subir
npm run dev
```

Acesse **http://localhost:3000**. Em dev, `AUTH_DEV_CREDENTIALS=true` te deixa logar com qualquer e-mail (sem precisar de SMTP real).

### Comandos úteis

```bash
npm run dev         # dev server (hot reload)
npm run build       # build de produção
npm run start       # serve o build
npm test            # vitest unit (200+ testes)
npm run test:watch  # vitest em watch
npm run test:e2e    # playwright (requer dev rodando)
npx prisma studio   # GUI do banco em :5555
npx prisma migrate dev --name <nome>  # nova migration
```

---

## 🔐 Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `LLM_PROVIDER` | não | `anthropic` (default) ou `openai` |
| `LLM_MODEL` | não | `claude-sonnet-4-6` (default), `claude-haiku-4-5-20251001`, `gpt-4o`… |
| `ANTHROPIC_API_KEY` | sim* | * se `LLM_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | sim* | * se `LLM_PROVIDER=openai` |
| `DATABASE_URL` | sim | Postgres connection string |
| `AUTH_SECRET` | sim | `openssl rand -base64 32` |
| `AUTH_URL` | prod | URL pública (ex.: `https://careertwin.app`) |
| `EMAIL_FROM` | sim | `"CareerTwin <no-reply@seu-dominio>"` |
| `AUTH_RESEND_KEY` | prod | Chave do Resend para magic link e digest |
| `EMAIL_SERVER` | dev | `smtp://localhost:1025` (Mailpit) |
| `AUTH_LINKEDIN_ID` / `_SECRET` | opcional | LinkedIn OIDC |
| `AUTH_DEV_CREDENTIALS` | dev | `true` libera login dev — **proibido em prod** (guarda dupla no código) |
| `ADZUNA_APP_ID` / `_KEY` | opcional | Vagas reais BR ([developer.adzuna.com](https://developer.adzuna.com)) |
| `JOOBLE_API_KEY` | opcional | Vagas agregadas |
| `GREENHOUSE_BOARDS` | opcional | Slugs separados por vírgula: `nubank,stone` |
| `LEVER_SITES` | opcional | Slugs Lever |
| `ASHBY_ORGS` | opcional | Slugs Ashby |
| `WORKABLE_ACCOUNTS` | opcional | Subdomínios Workable |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | opcional | Sentry server + client |
| `NEXT_PUBLIC_POSTHOG_KEY` | opcional | PostHog product analytics |
| `CRON_SECRET` | prod | `openssl rand -hex 32` — header `x-cron-secret` no cron |

Sem chaves de vagas → fallback de vagas ilustrativas (etiquetadas como tal na UI).

---

## ☁️ Deploy no Vercel

### Passo 1 — Postgres gerenciado

Vercel não hospeda Postgres direto (mais). Use um dos:

- **Neon** ([neon.tech](https://neon.tech)) — free tier generoso, recomendado
- **Supabase** ([supabase.com](https://supabase.com)) — também OK
- **Railway** ([railway.app](https://railway.app)) — também OK

Crie o banco e copie a connection string (formato `postgresql://user:pass@host:5432/db?sslmode=require`).

### Passo 2 — Resend com domínio verificado

1. [resend.com/domains](https://resend.com/domains) → Add Domain.
2. Adicione os DNS records (SPF + DKIM) no seu provedor de domínio.
3. Aguarde a verificação (5-30min).
4. Gere uma API key em [resend.com/api-keys](https://resend.com/api-keys) com escopo "Sending access".

### Passo 3 — Push pro GitHub

```bash
git remote add origin git@github.com:SEU_USER/careertwin-ai.git
git push -u origin main
```

### Passo 4 — Importar no Vercel

1. [vercel.com/new](https://vercel.com/new) → importe o repositório.
2. Framework: **Next.js** (detectado automaticamente).
3. Em **Environment Variables**, adicione **todas as obrigatórias** da tabela acima:
   - `DATABASE_URL` (do Neon/Supabase)
   - `AUTH_SECRET` (gere novo: `openssl rand -base64 32`)
   - `AUTH_URL=https://seu-app.vercel.app`
   - `ANTHROPIC_API_KEY`
   - `EMAIL_FROM` (com domínio verificado no Resend)
   - `AUTH_RESEND_KEY`
   - `CRON_SECRET` (gere novo: `openssl rand -hex 32`)
   - Chaves de vagas se tiver (Adzuna, Jooble, Lever, Ashby, Workable)
4. **NÃO** defina `AUTH_DEV_CREDENTIALS` em prod (a guarda dupla aborta o boot).
5. Deploy.

### Passo 5 — Rodar a migration em prod

```bash
# localmente, apontando pro Postgres de prod:
DATABASE_URL="..." npx prisma migrate deploy
```

### Passo 6 — Vercel Cron (digest semanal)

O `vercel.json` já tem o cron configurado (`/api/cron/digest`, segunda 12:00 UTC = 9h BRT). Mas o Vercel não passa headers customizados — você precisa configurar:

**Project → Settings → Cron Jobs** → adicionar header:
```
x-cron-secret: <valor do CRON_SECRET>
```

Pra testar o cron manualmente em prod:
```bash
curl -X POST -H "x-cron-secret: <SEU_SECRET>" https://seu-app.vercel.app/api/cron/digest
```

---

## 🛡️ Segurança

Implementado:

- ✅ **Auth.js v5** com JWT + adapter Prisma. Guarda dupla impede `AUTH_DEV_CREDENTIALS=true` em prod (aborta boot).
- ✅ **Zod estrito** (`.strict()`) em todos os bodies + limites de tamanho contra DoS de custo.
- ✅ **Escopo por `session.user.id`** em toda query Prisma — zero IDOR (2-step query pattern).
- ✅ **Rate limit** em memória nas rotas LLM (anônimo 2-5/min, logado 8-30/min).
- ✅ **Prompt injection mitigado**: system prompt isolado, sanitização de `"""`, null bytes removidos.
- ✅ **LLM com retry + backoff exponencial + AbortController** (45s timeout, 2 tentativas, jitter).
- ✅ **CSP** via middleware (script-src `self` + `unsafe-inline`, frame-ancestors `none`).
- ✅ **Headers de segurança**: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- ✅ **Upload PDF defensivo**: magic-bytes + content-length antes do parse + sandbox.
- ✅ **Anti-SSRF** no portfolio: bloqueia IPv4 + IPv6 privados, CGNAT, link-local (metadata cloud), `.local`/`.internal`. DNS lookup antes do fetch.
- ✅ **Cron protegido** por header `x-cron-secret` com comparação constante-tempo (sem query string).
- ✅ **Email HTML escapado** + validação de protocolo no `<a href>` (bloqueia `javascript:`, `data:`).
- ✅ **LGPD**: consent registrado por fonte, payloadHash SHA256, cascade delete em tudo que pende de User, export em JSON (inclui assessments + evidence + tailoredCvs).
- ✅ **Observabilidade de custo LLM**: log estruturado (JSON line) com tokens, custo USD, latência, route, userId.

Auditoria completa com OWASP Top 10:2025 + OWASP Top 10 LLM Apps disponível no histórico de commits.

---

## Roadmap

**v0.9 (atual) ✅ MVP funcional completo (branch `redesign/claude-design`)**
- 4 pilares (Autoconhecimento, Diagnóstico, Ação, Oportunidade) implementados
- 6 ATS providers
- LGPD by construction
- 200+ testes unit + 5 e2e Playwright

**v1.0 — Validação com usuários (próximo)**
- User testing com 5-10 candidatos
- Entrevistas B2B com universidades + RHs
- Decisão de ICP (B2C primário ou B2B primário)
- Refinamento baseado em feedback real

**v1.1 — Production hardening**
- Neon branch isolation (DB separado preview/prod)
- Sentry + PostHog validados com tráfego real
- Lighthouse > 90 em todas as rotas
- Backup Postgres automatizado
- Status page

**v1.2 — Monetização**
- Stripe (freemium: 3 diag/mês grátis · paid ilimitado)
- Affiliate de cursos com tracking
- Landing dedicada

**v2.0 — B2B**
- Orgs + seats (universidades, consultorias)
- SAML/SSO
- White-label
- API pública
- Dataset proprietário anonimizado (defensibilidade)

**Futuro (não roteado ainda)**
- Mediana de contratados real (dataset)
- pgvector + embeddings (RAG completo)
- Mobile nativo
- i18n (en/es)
- Análise psicométrica clínica validada

---

## 🧪 Testes

```bash
npm test                # 200+ testes unit (vitest)
npm run test:e2e        # 5 specs playwright (skipped em CI por padrão)
```

Cobertura:
- Validators Zod (60+ schemas: Analyze, Opp, Interview, Tailor, Chat, Linkedin, Portfolio, Application, Assessment, Evidence, TailoredCv...)
- Email digest HTML (escape XSS, singular/plural, validação de protocolo)
- Score determinístico (sub-scores 100% em código)
- RAG-lite (retrieval + course suggestion)
- E2E Playwright: login → diagnóstico → persistência → "apagar tudo"

---

## Documentação

### Produto
- [PRODUTO.md](./docs/PRODUTO.md) — visão de produto, personas, princípios
- [ALGORITHMS.md](./docs/ALGORITHMS.md) — algoritmos, fórmulas, diagramas
- [API.md](./docs/API.md) — referência de rotas

### Arquitetura (redesign branch)
- [Master Plan](./docs/redesign/00-MASTER_PLAN.md) — plano de migração
- [Frontend](./docs/redesign/01-FRONTEND.md) — arquitetura frontend
- [Backend](./docs/redesign/02-BACKEND.md) — arquitetura backend
- [Production](./docs/redesign/03-PRODUCTION.md) — DevOps + QA + Security

### Operações
- [OBSERVABILITY.md](./docs/OBSERVABILITY.md) — Sentry + PostHog + UptimeRobot

### Pesquisa
- [UX_AUDIT.md](./docs/UX_AUDIT.md) — audit UX + referências internacionais
- [REBRAND_CANDIDATES.md](./docs/REBRAND_CANDIDATES.md) — 22 nomes alternativos verificados
- [A11Y_AUDIT.md](./docs/redesign/A11Y_AUDIT.md) — auditoria de acessibilidade

### Time
- [HANDOFF_TIME_TERA.md](./docs/HANDOFF_TIME_TERA.md) — documento de transparência pro time

---

## 🤝 Time

Fernanda Alves · Bianca Matos · Cicero Janiel · Caroline Guilmo · Jonatan Jamar · Daniel Scharf · **Sérgio Henrique**

---

<div align="center">

**CareerTwin AI** — plataforma de gestão de carreira em pt-BR ·
Built with `Next.js 14` + `Anthropic Claude` + `Postgres` + ☕

</div>
