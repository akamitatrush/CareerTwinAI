<div align="center">

# CareerTwin AI

**Copiloto de empregabilidade com gêmeo digital de carreira.**

Cola o currículo, diz o cargo que quer, recebe um diagnóstico auditável + vagas reais + plano executável.

[Como funciona](#-como-funciona) · [Stack](#-stack) · [Rodar local](#-rodar-localmente) · [Deploy](#-deploy-no-vercel) · [Segurança](#-segurança) · [Roadmap](#-roadmap)

![status](https://img.shields.io/badge/status-MVP%20funcional-1f1f1f) ![license](https://img.shields.io/badge/license-MIT-1f1f1f) ![tests](https://img.shields.io/badge/tests-112%20passing-2F7D5B) ![next](https://img.shields.io/badge/Next.js-14-1f1f1f) ![lgpd](https://img.shields.io/badge/LGPD-by%20design-B9D90C)

</div>

---

## O que é

CareerTwin AI cria um **gêmeo digital da carreira** do usuário a partir do currículo (colado, PDF ou texto do LinkedIn) e do portfólio (GitHub ou site). Compara com o que o mercado pede pro cargo-alvo e devolve:

- **Career Health Score** auditável (4 sub-scores, cálculo determinístico em código — IA só explica).
- **Skill Gap Analysis** com prioridade, microação concreta e impacto no score em pontos.
- **Opportunity Radar** com vagas reais (Adzuna BR + Jooble + Greenhouse) e match calculado por skills.
- **Plano de 3 semanas** com microações ordenadas por impacto.
- **Simulador de entrevista** STAR/CAR com alerta de autenticidade ("não invente fato seu").
- **Adaptador de currículo** por vaga (reorganiza o que já existe, sinaliza qualquer sugestão nova).
- **Funil de candidaturas** (kanban: salva → aplicada → triagem → entrevista → oferta) com métricas reais de conversão.
- **Digest semanal por email** (Resend) com vagas novas que dão match.
- **LGPD por construção**: consentimento por fonte, download em JSON, apagar tudo em 1 clique.

Princípio editorial: **número = cálculo, texto = explicação com fonte** (`[Currículo]` / `[Mercado]` / `[Base de Vagas]`).

---

## 🧭 Como funciona

```mermaid
flowchart LR
    U[Usuário] -->|cola CV / PDF / LinkedIn / GitHub| H[Home /]
    H -->|POST| A[/api/analyze/]
    A -->|prompt + sanitização| LLM[Anthropic Claude<br/>Sonnet 4.6]
    A -->|persiste se logado| DB[(Postgres<br/>Prisma)]
    H -->|POST| O[/api/opportunities/]
    O -->|fetch paralelo| J[Adzuna BR<br/>Jooble<br/>Greenhouse]
    O -->|LLM justifica match| LLM
    O --> DB
    DB --> MG[/meu-gemeo<br/>histórico]
    DB --> KB[/candidaturas<br/>kanban]
    CRON[Vercel Cron<br/>seg 09h BRT] -->|/api/cron/digest| DG[Digest semanal]
    DG -->|Resend| MAIL[📧 vagas novas]
```

### Fluxo de diagnóstico

```mermaid
sequenceDiagram
    participant U as Usuário
    participant N as Next.js
    participant LLM as Claude Sonnet 4.6
    participant DB as Postgres

    U->>N: cola CV + cargo-alvo
    N->>N: valida Zod, rate-limit, sanitiza """
    N->>LLM: prompt diag (system + user separados)
    LLM-->>N: JSON {perfil, sub_scores, gaps}
    N->>N: computeOverall() determinístico
    alt logado
        N->>DB: upsert Profile + create ScoreSnapshot + Gap[] + Consent
    end
    N-->>U: diagnóstico
    par paralelo
        N->>J as Job providers: buscar vagas
        N->>LLM: gerar plano
    end
    N-->>U: vagas + plano
```

---

## ⚡ Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · CSS modules + jsx-css |
| Backend | Next.js Route Handlers (Node runtime) |
| Banco | Postgres 16 · Prisma 6 |
| Auth | Auth.js v5 (Email magic link via Resend, LinkedIn OIDC, Credentials dev) |
| LLM | Anthropic Claude Sonnet 4.6 (default) · OpenAI GPT-4o (opcional) |
| Vagas | Adzuna BR · Jooble · Greenhouse ATS |
| Email | Resend (prod) · Nodemailer/Mailpit (dev) |
| PDF | pdf-parse (com magic-bytes check) |
| Validação | Zod estrito (.strict() em todos os bodies) |
| Testes | Vitest (unit) · Playwright (e2e) |
| Deploy | Vercel + Postgres externo (Neon/Supabase/Railway) |

---

## 📐 Arquitetura

```
careertwin-ai/
├─ app/
│  ├─ page.js                  Home — entrada e diagnóstico efêmero
│  ├─ entrar/                  Login (magic link, LinkedIn, dev)
│  ├─ meu-gemeo/               Dashboard pós-login + histórico
│  ├─ candidaturas/            Kanban + funil de conversão
│  ├─ meus-dados/              LGPD (ver, baixar JSON, apagar tudo)
│  ├─ design-lab/              Lab visual (3 direções de design)
│  └─ api/
│     ├─ analyze/              POST: CV + cargo → diagnóstico
│     ├─ opportunities/        POST: perfil → vagas reais + plano
│     ├─ linkedin/parse/       POST: texto LinkedIn → estrutura
│     ├─ portfolio/import/     POST: github/url → projetos extraídos
│     ├─ tailor/               POST: CV + vaga → CV adaptado
│     ├─ interview/            POST: simulador (pergunta + avaliação)
│     ├─ chat/                 POST: conversar com o "gêmeo"
│     ├─ applications/         CRUD do funil de candidaturas
│     ├─ cv/upload/            Upload PDF (magic-bytes + sanitização)
│     ├─ me/export/            Export LGPD (JSON com tudo)
│     ├─ cron/digest/          Cron semanal (Resend digest)
│     └─ auth/[...nextauth]/   Handler NextAuth v5
├─ components/
│  ├─ Report.js                Saída do diagnóstico (gauge, sub-scores, gaps)
│  ├─ Modal.js                 Modal acessível (role=dialog + ARIA + ESC + focus trap)
│  ├─ InterviewModal.js        Simulador STAR/CAR
│  ├─ ChatModal.js             Chat com o gêmeo
│  ├─ TailorModal.js           Adaptador de currículo
│  ├─ LinkedinImportButton.js  Import via texto colado
│  └─ PortfolioImportButton.js Import via GitHub/URL
├─ lib/
│  ├─ llm.js                   Anthropic/OpenAI agnóstico (retry + timeout + log custo)
│  ├─ prompts.js               Prompts (system + user separados, sanitização """)
│  ├─ validators.js            Zod strict em tudo (40+ schemas)
│  ├─ score.js                 Career Health Score (4 sub-scores · pesos .40/.30/.20/.10)
│  ├─ jobs/                    Providers Adzuna/Jooble/Greenhouse + fixtures fallback
│  ├─ skills-taxonomy.js       Extração de skills + cálculo de match
│  ├─ rate-limit.js            Janela em memória (anônimo vs logado)
│  ├─ email.js                 Digest HTML (Resend ou Nodemailer)
│  ├─ pdf.js                   Parser PDF defensivo
│  ├─ data-export.js           Export LGPD
│  └─ auth.js                  NextAuth config (Resend > Mailpit fallback)
├─ prisma/
│  ├─ schema.prisma            Modelos
│  └─ migrations/              Migrations versionadas
├─ tests/
│  ├─ unit/                    Vitest (112 testes)
│  └─ e2e/                     Playwright
├─ middleware.js               CSP-nonce dinâmica + NextAuth gate
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
    ScoreSnapshot ||--o{ Gap : "lacunas priorizadas"
    ScoreSnapshot ||--o{ PlanItem : "plano de 3 semanas"
    Application ||--o{ ApplicationEvent : "timeline auditável"

    User { string id email }
    Profile { string targetRole string[] skills json perfilJson json linkedinJson json portfolioJson }
    ScoreSnapshot { int overall json subScores datetime createdAt }
    Application { enum status datetime savedAt appliedAt offerAt }
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
npm test            # vitest unit (112 testes)
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
   - Chaves de vagas se tiver (Adzuna, Jooble)
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
- ✅ **Escopo por `session.user.id`** em toda query Prisma — zero IDOR.
- ✅ **Rate limit** em memória nas 6 rotas LLM (anônimo 2-5/min, logado 8-30/min).
- ✅ **Prompt injection mitigado**: system prompt isolado, sanitização de `"""`, null bytes removidos.
- ✅ **LLM com retry + backoff exponencial + AbortController** (45s timeout, 2 tentativas, jitter).
- ✅ **CSP-nonce dinâmica** via middleware (script-src `strict-dynamic`, frame-ancestors `none`, em dev libera `unsafe-eval` para HMR).
- ✅ **Headers de segurança**: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- ✅ **Upload PDF defensivo**: magic-bytes + content-length antes do parse + sandbox.
- ✅ **Anti-SSRF** no portfolio: bloqueia IPv4 + IPv6 privados, CGNAT, link-local (metadata cloud), `.local`/`.internal`. DNS lookup antes do fetch (mitigação parcial DNS rebinding).
- ✅ **Cron protegido** por header `x-cron-secret` com comparação constante-tempo (sem query string).
- ✅ **Email HTML escapado** + validação de protocolo no `<a href>` (bloqueia `javascript:`, `data:`).
- ✅ **LGPD**: consent registrado por fonte, payloadHash SHA256, cascade delete em tudo que pende de User, export em JSON.
- ✅ **Observabilidade de custo LLM**: log estruturado (JSON line) com tokens, custo USD, latência, route, userId.

Auditoria completa com OWASP Top 10:2025 + OWASP Top 10 LLM Apps disponível no histórico de commits.

---

## 🗺️ Roadmap

**v0.4 ✅ Pitch completo** (estado atual)
- LinkedIn import, Portfolio (GitHub), Tracking de candidaturas, Weekly digest

**v0.5 — Polimento** (em andamento)
- Direção visual "Dossiê" editorial aplicada
- Empty states, loading com narrativa, erros humanos
- Onboarding wizard e wow moment

**v1.0 — Ser sério**
- CI/CD GitHub Actions (test + e2e + deploy)
- Sentry + PostHog
- Backup Postgres automático
- Status page

**v1.1 — Monetizar**
- Stripe (free 3 diag/mês · paid ilimitado)
- Landing page separada
- Onboarding guiado

**v2.0 — B2B**
- Orgs + seats (universidades, consultorias)
- SAML/SSO
- White-label
- API pública
- Dataset proprietário anonimizado (defensibilidade)

---

## 🧪 Testes

```bash
npm test                # 112 testes unit
npm run test:e2e        # playwright (autenticação + persistência + erase)
```

Cobertura:
- Validators Zod (45+ casos: AnalyzeBody, OppBody, InterviewBody, TailorBody, ChatBody, LinkedinParseBody, PortfolioImportBody, ApplicationCreateBody, ApplicationPatchBody)
- Email digest HTML (17 casos: escape XSS, singular/plural, validação de protocolo)
- Score determinístico
- E2E Playwright: login → diagnóstico → persistência → "apagar tudo"

---

## 📚 Documentação complementar

- [ARCHITECTURE.md](ARCHITECTURE.md) — visão técnica enxuta (stack, modelos, fluxos)
- [CHANGELOG.md](CHANGELOG.md) — histórico de versões (v0.1 → v0.4)
- [.env.example](.env.example) — todas as envs documentadas

---

## 🤝 Time

Fernanda Alves · Bianca Matos · Cicero Janiel · Caroline Guilmo · Jonatan Jamar · Daniel Scharf · **Sérgio Henrique**

---

<div align="center">

**CareerTwin AI** — copiloto de empregabilidade em pt-BR ·
Built with `Next.js 14` + `Anthropic Claude` + `Postgres` + ☕

</div>
