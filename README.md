<div align="center">

```
   ▄▄▄▄    ▄▄▄  ▄▄▄  ▄▄▄ ▄▄▄ ▄▄▄ ▄▄▄    ▄▄▄▄▄ ▄▄▄ ▄ ▄ ▄ ▄▄▄ ▄ ▄
   █       █▄▄█ █▄▄▀ █▄▄ █▄▄ █▄▀  █        █  █▄▄█ █ █ █  █  ██▀
   █▄▄▄    █  █ █ ▄▄ █▄▄ █▄▄ █ █  █        █  █  █ ▀▄▀ ▄  █  █ █
```

# CareerTwin AI

**Plataforma de gestão de carreira com IA, em pt-BR.**
Da identidade até a contratação — auditável, sem caixa-preta, LGPD por construção.

[Quickstart](#rodar-localmente) · [Algoritmos](#algoritmos--cálculos) · [Arquitetura](#arquitetura) · [Roadmap](#roadmap) · [Documentação](#documentação)

![status](https://img.shields.io/badge/status-MVP%20funcional-1f1f1f) ![tests](https://img.shields.io/badge/tests-467%20passing-2F7D5B) ![next](https://img.shields.io/badge/Next.js-14-1f1f1f) ![lgpd](https://img.shields.io/badge/LGPD-by%20design-B9D90C) ![rag](https://img.shields.io/badge/RAG-Voyage%20%2B%20pgvector-1f1f1f) ![billing](https://img.shields.io/badge/Stripe-foundation-635BFF)

</div>

---

## O que é

CareerTwin AI cria um **gêmeo digital de carreira** a partir do CV, LinkedIn e GitHub do usuário, e organiza a jornada em 4 pilares — da identidade até a contratação.

| Pilar | O que faz | Como é calculado |
|---|---|---|
| **◇ Autoconhecimento** | 3 mini-assessments com visualizações SVG (DiscMatrix, ValoresRadar, IkigaiVenn) + narrativas a partir de 6 arquétipos de Valores e careerHints DISC. | Mapping determinístico em JS · LLM só polish |
| **◆ Diagnóstico** | Career Health Score (0-100) com 4 sub-scores ponderados, mediana comparativa, refresh sem repaste. | 100% código (TF-IDF, set theory, regex) · LLM só explica |
| **▸ Ação** | Skill Gap Mapper com 41 cursos curados, evidências de competência, CVs adaptados com diff. | Skill-keyed lookup + RAG hybrid · LLM gera microações |
| **● Oportunidade** | Radar de vagas com 6 providers + filtros + match breakdown matemático + kanban de candidaturas. | Set intersection normalizada · LLM justifica em 1 frase |

**Plataforma:**
- **▸ RAG real** com Voyage AI embeddings (1024 dims) + pgvector no Neon + RRF fusion · 159 chunks curados · recall@3 ≥ 70%.
- **▸ Monetização foundation** (Stripe Phase 1+2): Checkout + Customer Portal + Webhooks com HMAC + idempotência · 4 planos (Free / Pro M / Pro Y / Team) com Price IDs placeholder · 503 amigável sem `STRIPE_SECRET_KEY`.
- **▸ Refresh sem repaste** — `POST /api/profile/refresh` reusa `Profile.rawCv` + `targetRole` + `perfilJson`. Modal "Aplicar conquistas" com 3 opções (aplicar+recalcular, só recalcular, cancelar).
- **▸ OWNER_EMAILS** — bypass total de limite Free para owners (testing/operação).
- **▸ LGPD avançado** — AuditLog 17 actions com IP hash sha256+salt, `Profile.rawCv` com TTL 90d e cron diário de redação.

**Princípio editorial:** número = cálculo auditável, texto = explicação com fonte. Sem caixa-preta. Sem promessa de aprovação garantida. LGPD por construção.

**Paleta e experiência (Claude Design System):** Indigo Sereno como cor primária, neutros quentes para fundo (não cinza azulado-frio), tipografia Plus Jakarta Sans (UI) + Spectral (cabeçalhos editoriais). AppShell sidebar 252px no desktop, header colapsado no mobile, sombras Linear-style com camadas suaves, botões com gradiente e inset glassy, focus rings visíveis para a11y AA, skeleton loaders com shimmer. Light theme default, toggle persistente.

---

## Como funciona

Vista de alto nível — quatro pilares, integrações em paralelo, persistência só após login.

```mermaid
flowchart LR
    subgraph Inputs
      CV["CV PDF/DOCX/texto"]
      LI["LinkedIn paste"]
      GH["GitHub user/URL"]
      ROLE["Cargo-alvo"]
    end

    subgraph Core["Pipeline deterministico"]
      ANA["api/analyze - LLM extrai perfil"]
      RAG["RAG hybrid - Voyage + pgvector + RRF"]
      SCORE["computeAllSubScores - codigo"]
      OPP["api/opportunities - 6 ATS providers"]
    end

    subgraph Persist["Persistencia LGPD"]
      SS["ScoreSnapshot"]
      GAP["Gap list"]
      AUD["AuditLog 17 actions"]
    end

    subgraph UI
      DASH["dashboard"]
      GAPS["gaps + cursos"]
      OPS["oportunidades"]
      AUTO["autoconhecimento"]
    end

    CV --> ANA
    LI --> ANA
    GH --> ANA
    ROLE --> ANA
    ANA --> RAG
    RAG --> ANA
    ANA --> SCORE
    ROLE --> OPP
    SCORE --> SS
    SCORE --> GAP
    SS --> AUD
    SS --> DASH
    GAP --> GAPS
    OPP --> OPS
    AUTO --> DASH
```

### Fluxo 1 — Diagnóstico inicial

```mermaid
sequenceDiagram
    participant U as Usuario
    participant N as Next.js
    participant RAG as RAG hybrid
    participant LLM as Claude Sonnet 4.6
    participant DB as Postgres

    U->>N: POST api/analyze com CV + cargo-alvo
    N->>N: Zod strict + rate-limit + sanitiza prompt
    N->>RAG: retrieve query k=3
    RAG-->>N: top 3 chunks via RRF fusion
    N->>LLM: prompt diag system + user + context
    LLM-->>N: JSON com perfil, gaps, explicacoes
    N->>N: computeAllSubScores deterministico (0.40 + 0.30 + 0.20 + 0.10)
    alt logado
      N->>DB: upsert Profile + ScoreSnapshot + Gap + Consent + AuditLog
    end
    par paralelo
      N->>N: searchJobs 6 providers Promise.allSettled
      N->>LLM: plano + cursos sugeridos
    end
    N-->>U: diagnostico + vagas + plano
```

### Fluxo 2 — Refresh sem repaste de CV

```mermaid
sequenceDiagram
    participant U as Usuario
    participant N as Next.js
    participant LLM as Claude Sonnet 4.6
    participant DB as Postgres

    U->>N: marca microacao concluida em gaps
    U->>N: clica Atualizar diagnostico
    N->>U: modal Aplicar conquistas com 3 opcoes
    U->>N: POST api/profile/refresh com completedGapIds
    N->>DB: le Profile.rawCv + targetRole + perfilJson
    N->>N: projectedGains deterministico cap 15 por sub + 20 total
    N->>LLM: promptDiag com completedHabilidades evita loop
    LLM-->>N: novo perfil + gaps DIFERENTES
    N->>N: computeAllSubScores + bonus deterministico
    N->>DB: create ScoreSnapshot + Gap + AuditLog
    N-->>U: novo score + delta vs anterior
```

### Fluxo 3 — Billing (Stripe Phase 1+2)

```mermaid
sequenceDiagram
    participant U as Usuario
    participant N as Next.js
    participant S as Stripe
    participant DB as Postgres

    U->>N: POST api/billing/checkout com planId
    N->>S: Stripe Checkout Session com metadata.userId
    S-->>U: redirect pra Stripe Checkout
    U->>S: paga com cartao BR
    S->>N: POST api/billing/webhook checkout.session.completed
    N->>N: HMAC verify + BillingEvent idempotency check
    N->>DB: upsert Subscription ACTIVE + plan + currentPeriodEnd
    N->>DB: create BillingEvent + AuditLog
    Note over U,N: Proximas chamadas LLM
    U->>N: POST api/analyze
    N->>DB: enforceQuota Serializable + OWNER_EMAILS bypass + UsageMeter increment
    N-->>U: 200 OK dentro do limite
```

### Fluxo 4 — RAG hybrid retrieval

```mermaid
flowchart LR
    Q["Query do prompt"]
    Q -->|"Voyage AI embeddings"| E["1024-dim vector"]
    Q -->|"tokenize + NFD"| T["Keyword tokens"]
    E -->|"pgvector cosine HNSW"| V["Vector top-K"]
    T -->|"BM25-lite + boosts"| K["Keyword top-K"]
    V --> R["RRF fusion k=60"]
    K --> R
    R -->|"top 3"| C["Context chunks"]
    C -->|"formatAsContext"| P["Prompt LLM com fontes"]
```

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14 (App Router) · React 18 · Plus Jakarta Sans + Spectral (Claude Design) |
| Backend | Next.js Route Handlers (Node runtime) |
| Banco | Postgres 16 · Prisma 6 |
| Auth | Auth.js v5 (Email magic link via Resend, LinkedIn OIDC, Credentials dev) |
| LLM | Anthropic Claude Sonnet 4.6 (default) · OpenAI GPT-4o (opcional) |
| Embeddings | Voyage AI `voyage-3` (1024 dims) · OpenAI `text-embedding-3-small` fallback (Matryoshka) |
| Vector store | pgvector (Postgres) + HNSW cosine index |
| Vagas | Adzuna BR · Jooble · Greenhouse · Lever · Ashby · Workable |
| Email | Resend (prod) · Nodemailer/Mailpit (dev) |
| PDF / DOCX | pdf-parse + mammoth (com magic-bytes check) |
| Validação | Zod estrito (.strict() em todos os bodies) |
| Billing | Stripe (Checkout + Customer Portal + Webhooks com HMAC + idempotência) |
| Cache / Rate-limit | Upstash Redis (prod, cross-lambda) · Map em memória (dev/fallback) |
| Testes | Vitest (unit, 467 casos em 36 arquivos) · Playwright (e2e, 5 specs) |
| Observabilidade | Sentry (errors) · PostHog (eventos) · UptimeRobot (`/api/health`) · AuditLog (17 actions) |
| Deploy | Vercel + Postgres externo (Neon recomendado) |

---

## Algoritmos & Cálculos

CareerTwin é **explicável por construção.** Toda métrica que vira "número" é calculada em código determinístico — o LLM só explica o que esses cálculos significam para o usuário. Isso é o que viabiliza `/transparencia` (a fórmula é literalmente exibida na UI).

### Career Health Score (determinístico)

```
Score = (Aderência × 0.40) + (Habilidades × 0.30) + (Perfil × 0.20) + (Experiência × 0.10)
```

| # | Sub-score | Peso | Como é calculado |
|---|---|---|---|
| 1 | **Aderência a vagas** | 40% | **TF-IDF simplificado.** Extrai skills da vaga via taxonomy normalizada (NFD + lowercase), compara com `Profile.skills`, retorna `\|comuns\| / max(\|perfil\|, \|vaga\|) × 100`. Implementação em `lib/scoring/subscores.js#computeAderenciaVagas`. |
| 2 | **Relevância das habilidades** | 30% | **Score composto:** `count` (quantas declarou, cap 12) + `validity` (% reconhecidas pela taxonomy) + `diversity` (entropia simplificada de categorias: tech / soft / tool / method). `lib/scoring/subscores.js#computeRelevanciaHabilidades`. |
| 3 | **Otimização do perfil** | 20% | **Weighted field-presence.** rawCv=20, targetRole=15, skills=15, LinkedIn=15, GitHub=10, etc, soma=100. `lib/metrics/completeness.js`. |
| 4 | **Experiência de mercado** | 10% | **Year-range parsing do rawCv + senioridade alignment.** Anos extraídos via regex de datas. Senioridade declarada vs cargo-alvo via aliases (`junior / jr / trainee = junior`, `sr / senior / lead = senior`). `lib/scoring/subscores.js#computeExperienciaMercado`. |

**Os pesos vivem em `lib/score.js#WEIGHTS`** e são exibidos publicamente em `/transparencia` — qualquer mudança aparece para o usuário.

### RAG hybrid retrieval

```
Query → [Voyage embedding] → pgvector top-K ─┐
                                              ├→ RRF fusion (k=60) → top 3 → context no prompt
Query → [tokenize NFD]    → BM25-lite top-K ─┘
```

| Componente | O que é | Detalhe |
|---|---|---|
| **Embeddings** | Voyage AI `voyage-3` (1024 dims, ~$0.06/1M tokens) | **Modelo pré-treinado** — não treinamos modelo, apenas usamos a API. Fallback: OpenAI `text-embedding-3-small` (1536 nativos, truncado pra 1024 via Matryoshka usando o parâmetro `dimensions`). |
| **Storage** | pgvector no Neon (extensão Postgres) | HNSW index com cosine distance. Schema `KnowledgeChunk` usa `Unsupported("vector(1024)")` no Prisma — queries vector via raw SQL. |
| **Lane 1 — semântico** | Embedding da query + `ORDER BY embedding <=> $vec` | Top-K candidatos por similaridade de cosine. |
| **Lane 2 — keyword** | BM25-lite com NFD + audience boost 1.5x + tag-match boost | Top-K candidatos por overlap. |
| **Fusion — RRF** | Reciprocal Rank Fusion `score = Σ 1/(k + rank)`, k=60 | **Combina por posição, não por score absoluto.** Robusto contra magnitudes diferentes (cosine 0..1 vs overlap inteiro). |
| **Knowledge base** | 159 chunks curados **manualmente** | Cobertura: CV / LinkedIn / Interview / Transition / Salary / Soft-skills / ATS / Mercado-BR / Tech-modern / Identidade / Network. NÃO é scraped automaticamente. |
| **Ingestão** | `scripts/ingest-knowledge.mjs` (`npm run ingest:knowledge`) | Idempotente: hash sha256 do conteúdo evita reingest desnecessário; throttling pra free tier Voyage. |
| **Eval framework** | 50 queries com ground truth manual (`npm run eval:rag`) | Mede `recall@3`, `recall@5`, `MRR`, `NDCG@5`. **Threshold gate: recall@3 ≥ 70%**. Resultado atual: **93.9% keyword-only (PASSED)**; ~96-98% esperado pós-ingestão Voyage. |

Detalhes profundos em [docs/RAG.md](./docs/RAG.md) (700 linhas).

### Match de vagas (job ↔ profile)

`lib/skills-taxonomy.js#matchScore({ profileSkills, jobSkills })`. Set intersection normalizada (NFD + lowercase). Retorna `{ match: |∩| / max(|A|, |B|) × 100, comuns: [...], falta: [...] }`. **Em código, não LLM.** O LLM apenas justifica o porquê em frase curta, com fonte `[Currículo]` ou `[Base de Vagas]`. Nunca inventa número.

### Refresh score (não-gaming)

`POST /api/profile/refresh`. Quando o usuário marca microações concluídas, o backend:

1. Reusa `Profile.rawCv` + `targetRole` + `perfilJson` (não pede CV de novo).
2. Calcula `projectedGains` **determinístico** somando `impactoPontos` do gap por sub-score, com **cap 15 por sub + 20 total** (anti-gaming — impede que marcar 20 microações triviais infle o score).
3. Chama LLM com `promptDiag(completedHabilidades=[...])` — o LLM gera gaps **diferentes** (anti-loop infinito).
4. `computeAllSubScores` + bonus determinístico → novo `ScoreSnapshot` com delta vs anterior.

### Billing enforce (TOCTOU-safe)

`lib/billing/enforce.js`. Antes de cada chamada LLM cara:

1. **OWNER_EMAILS bypass** — env `OWNER_EMAILS=sergio@x,daniel@y` libera totalmente.
2. **Plan lookup** — busca `Subscription{status, plan}` do usuário. Sem subscription = Free.
3. **UsageMeter increment** — dentro de **`Prisma.$transaction` com isolationLevel `Serializable`** (fix do TOCTOU original). Free tier: analyze 10/mês, tailor 5/mês, opportunities 20/dia, interview 10/mês.
4. Sem `STRIPE_SECRET_KEY` setado, todos os endpoints de billing retornam **503 amigável** (não 500) — a app continua usável.

### Cost cap (anti-amplification)

`lib/llm.js`. Cada chamada LLM loga `{ tokens, custo_usd, latência, route, userId }` em JSON-line. Budget per-user diário: **$0.10 (Free) / $5 (Pro) / $20 (Team)**. Excedeu → 429 com mensagem amigável. Mitigação OWASP LLM10 (custo de inferência amplificável).

### O que **NÃO** é Machine Learning

| Componente | Por que não é ML |
|---|---|
| Career Health Score | TF-IDF + set theory + regex. Determinístico. |
| Job match | Set intersection. Determinístico. |
| Skill extraction | Regex + taxonomy lookup. Determinístico. |
| LLM Claude Sonnet 4.6 | Modelo **pré-treinado** da Anthropic. Usamos via API. **Não treinamos.** |
| Embeddings Voyage AI | Modelo **pré-treinado** da Voyage. Usamos via API. **Não treinamos.** |

### O que **poderia** virar ML no futuro (precisa dataset)

| Possibilidade | Dataset necessário |
|---|---|
| **Score calibration** — aprender pesos (0.40/0.30/0.20/0.10) a partir de outcome | `Outcome{snapshotId, status: HIRED\|REJECTED\|...}` — não temos ainda |
| **Course recommendations** — ranking aprendido por outcome | `CourseCompletion{userId, courseId, completedAt, gainedScore}` — não temos ainda |
| **Salary prediction** — regression a partir de skills + senioridade + região | Dataset salarial brasileiro consistente — não temos ainda |

Hoje, todo cálculo é **publicado em `/transparencia`** e o LLM nunca "inventa" um número.

### Outras camadas relevantes

| Camada | Algoritmo | Implementação |
|---|---|---|
| Skill extraction | Token-level matching + NFD normalization | `lib/skills-taxonomy.js#extractSkills` |
| Course suggestion | Skill-keyed lookup + boost para cursos grátis | `lib/knowledge/course-retrieval.js` |
| LLM extraction | Zod strict + `.strip` + prompt isolation | `lib/prompts.js`, `lib/llm.js` |
| Auth IDOR-safe | 2-step query pattern (busca IDs da sessão, depois `IN`) | `app/api/history/actions/route.js` |
| Anti-SSRF | DNS lookup + IP pinning + bloqueio IPv4/IPv6 privados + CGNAT | `lib/safe-fetch.js` |
| URL safety | `safeExternalUrl` + `safeHref` (Zod URL bloqueando `javascript:` / `data:`) | `lib/url-safe.js` |
| LGPD cascade | Prisma `onDelete: Cascade` + Consent `payloadHash` SHA256 | `prisma/schema.prisma` |
| LGPD TTL | `Profile.rawCv` redacted após 90d (cron diário `/api/cron/redact-cv`) | `app/api/cron/redact-cv/route.js` |
| Audit trail | 17 actions com IP hash sha256+`AUDIT_IP_SALT` (LGPD-friendly) | `lib/audit.js` |
| Cost cap LLM | Budget per-user diário + log estruturado JSON | `lib/llm.js` |

Detalhes completos em [docs/ALGORITHMS.md](./docs/ALGORITHMS.md).

---

## Funcionalidades

### Autenticadas (após login)
- `/dashboard` — Career Health Score + sub-scores + 3 próximas ações + perfil snapshot + mediana comparativa
- `/autoconhecimento` — 3 assessments (DISC-lite, Valores, Ikigai) com visualizações SVG + narrativas
- `/gaps` — KPI strip + requirements list + microactions com completion + cursos sugeridos inline
- `/oportunidades` — Radar de vagas com filtros + match breakdown explicado
- `/plano` — Histórico de score + timeline de ações
- `/cvs-adaptados` — Histórico de CVs adaptados por vaga
- `/evidencias` — Documentação de evidências de competência (projetos, cases, métricas)
- `/candidaturas` — Funil kanban (SAVED → APPLIED → INTERVIEW → OFFER)
- `/transparencia` — Fórmula auditável + data sources + LGPD
- `/conta` — Perfil + cargo-alvo + stats + LGPD
- `/meus-dados` — Export JSON + apagar tudo

### Endpoints internos relevantes
- `POST /api/profile/refresh` — recalcula score reusando `Profile.rawCv` + `targetRole` + `perfilJson`. Modal "Aplicar conquistas" oferece 3 ações: aplicar+recalcular, só recalcular, cancelar.
- `POST /api/billing/checkout` · `POST /api/billing/portal` · `POST /api/billing/webhook` · `GET /api/billing/plan` — Stripe Phase 1+2. Sem `STRIPE_SECRET_KEY` setado, retorna 503 amigável.
- `POST /api/cron/redact-cv` — TTL LGPD: redaciona `Profile.rawCv` após 90 dias (cron diário, header `x-cron-secret`).
- `POST /api/cron/usage-cleanup` — limpeza periódica de `UsageMeter` de períodos antigos.
- `POST /api/cron/digest` — digest semanal Resend (batching de 10 paralelo + dedup por role).
- AuditLog interno em `lib/audit.js` — 17 actions logadas (login, magic-link, analyze, tailor, export, delete, billing events…) com IP hash sha256+salt (anti-rainbow LGPD).

### Públicas
- `/` — Split-panel onboarding (modo experimentar sem login)
- `/entrar` — Login (magic link + LinkedIn opcional + dev creds em preview)
- `/auth/verify-request` — Estado pós-envio do magic link
- `/privacidade` — Política LGPD
- `/termos` — Termos de uso
- `/api/health` — Health check pro UptimeRobot

---

## Arquitetura

```
careertwin-ai/
├─ app/
│  ├─ page.js                       Home — split-panel onboarding + modo experimentar
│  ├─ (app)/                        Layout autenticado (AppShell sidebar)
│  │  ├─ dashboard/                 Career Health + sub-scores + próximas ações
│  │  ├─ autoconhecimento/          3 assessments (DiscMatrix, ValoresRadar, IkigaiVenn)
│  │  ├─ gaps/                      Skill Gap Mapper + microactions + cursos inline
│  │  ├─ oportunidades/             Radar de vagas + match breakdown
│  │  ├─ plano/                     Histórico de score + timeline
│  │  ├─ cvs-adaptados/             Histórico de CVs adaptados
│  │  ├─ evidencias/                Evidências de competência
│  │  ├─ transparencia/             Fórmula auditável + sources
│  │  └─ conta/                     Perfil + cargo-alvo + stats
│  ├─ candidaturas/                 Kanban + funil de conversão
│  ├─ entrar/                       Login (magic link, LinkedIn, dev)
│  ├─ meus-dados/                   LGPD (ver, baixar JSON, apagar tudo)
│  └─ api/
│     ├─ analyze/                   POST: CV + cargo → diagnóstico
│     ├─ opportunities/             POST: perfil → vagas (6 providers) + plano
│     ├─ assessments/[kind]/        GET/POST: DISC-lite, valores, Ikigai
│     ├─ evidence/                  CRUD evidências
│     ├─ tailored-cvs/              CRUD CVs adaptados (com diff)
│     ├─ gaps/                      GET summary + microactions + completion
│     ├─ profile/refresh/           POST: refresh score sem repaste de CV
│     ├─ profile/onboarding/        GET/POST: estado X/3 sources
│     ├─ profile/completeness/      GET: % completude
│     ├─ score/                     GET histórico
│     ├─ plan-items/                CRUD plano de ação
│     ├─ linkedin/parse/            POST: texto LinkedIn → estrutura
│     ├─ portfolio/import/          POST: github/url → projetos (anti-SSRF)
│     ├─ tailor/                    POST: CV + vaga → CV adaptado (enforce billing)
│     ├─ interview/                 POST: simulador STAR/CAR (enforce billing)
│     ├─ chat/                      POST: conversar com o "gêmeo" (server carrega DB)
│     ├─ applications/              CRUD do funil
│     ├─ history/actions/           Timeline com IDOR-safe pattern
│     ├─ cv/upload/                 Upload PDF (magic-bytes + sanitização)
│     ├─ me/export/                 Export LGPD (JSON com tudo)
│     ├─ notifications/             In-app notifications
│     ├─ billing/
│     │  ├─ checkout/               POST: Stripe Checkout Session
│     │  ├─ portal/                 POST: Stripe Customer Portal
│     │  ├─ webhook/                POST: Stripe webhooks (HMAC + idempotency)
│     │  └─ plan/                   GET: plano + uso atual
│     ├─ cron/
│     │  ├─ digest/                 Cron semanal (Resend digest, batching)
│     │  ├─ redact-cv/              Cron diário (TTL LGPD 90d)
│     │  └─ usage-cleanup/          Cron de limpeza de UsageMeter antigo
│     ├─ health/                    Health check (UptimeRobot)
│     └─ auth/[...nextauth]/        Handler NextAuth v5
├─ components/
│  ├─ AppShell.js                   Sidebar 252px desktop + header mobile (Linear-style shadows)
│  ├─ Report.js                     Saída do diagnóstico (hero CTA bar, sub-scores compactos)
│  ├─ NotificationBell.js           Notifications in-app
│  ├─ Modal.js                      Modal acessível (role=dialog + ARIA + ESC)
│  ├─ InterviewModal.js             Simulador STAR/CAR
│  ├─ ChatModal.js                  Chat com o gêmeo
│  ├─ TailorModal.js                Adaptador de currículo
│  ├─ visualizations/
│  │  ├─ DiscMatrix.js              SVG quadrante DISC
│  │  ├─ ValoresRadar.js            SVG radar 16 eixos
│  │  └─ IkigaiVenn.js              SVG 4 círculos
│  └─ NextStepsBlock.js             3 microações próximas
├─ lib/
│  ├─ llm.js                        Anthropic/OpenAI (retry + timeout + cost log + budget cap)
│  ├─ embeddings.js                 Voyage AI + OpenAI fallback (1024 dims)
│  ├─ prompts.js                    Prompts (system + user separados, sanitização """)
│  ├─ validators.js                 Zod strict em tudo
│  ├─ score.js                      Career Health Score (4 sub-scores · WEIGHTS)
│  ├─ scoring/subscores.js          Sub-scores 100% determinísticos
│  ├─ knowledge/                    RAG hybrid (retrieval + courses + base curada)
│  ├─ jobs/                         6 providers + fixtures fallback
│  ├─ skills-taxonomy.js            Extração + match
│  ├─ metrics/completeness.js       Weighted field-presence
│  ├─ rate-limit.js                 Upstash Redis (prod) ou Map (dev/fallback)
│  ├─ billing/
│  │  ├─ stripe.js                  SDK + 503 graceful
│  │  ├─ plans.js                   Free / Pro M / Pro Y / Team
│  │  └─ enforce.js                 OWNER_EMAILS bypass + TOCTOU-safe UsageMeter
│  ├─ audit.js                      AuditLog 17 actions (IP hash sha256+salt)
│  ├─ safe-fetch.js                 Anti-SSRF (DNS + IP pinning + private blocks)
│  ├─ url-safe.js                   safeExternalUrl + safeHref (Zod URL)
│  ├─ email.js                      Digest HTML (Resend ou Nodemailer)
│  ├─ pdf.js                        Parser PDF defensivo (magic-bytes)
│  ├─ docx.js                       Parser DOCX (mammoth)
│  ├─ data-export.js                Export LGPD
│  ├─ auth.js                       NextAuth config + rate-limit magic-link
│  ├─ auth-protected-paths.js       SSoT do middleware (PROTECTED sync)
│  ├─ env.js                        Boot guards (AUTH_DEV_CREDENTIALS bloqueado em prod)
│  └─ notifications.js              In-app notifications
├─ prisma/
│  ├─ schema.prisma                 21 modelos
│  └─ migrations/                   Migrations versionadas (rodam fora do build)
├─ scripts/
│  └─ ingest-knowledge.mjs          Ingestão idempotente pgvector (sha256 contentHash)
├─ tests/
│  ├─ unit/                         Vitest (467 testes em 36 arquivos)
│  ├─ e2e/                          Playwright (5 specs)
│  └─ eval/rag/                     50 queries · recall@3/MRR/NDCG
├─ docs/
│  ├─ PRODUTO.md · ALGORITHMS.md · API.md
│  ├─ RAG.md · MONETIZACAO.md · DEPLOY.md
│  ├─ OBSERVABILITY.md · HANDOFF_TIME_TERA.md
│  └─ audits/                       5 audits read-only
├─ middleware.js                    CSP + NextAuth gate + PROTECTED paths
├─ next.config.mjs                  Headers + Sentry source maps gatekeeper
├─ vercel.json                      Cron (digest weekly · redact-cv daily · usage-cleanup)
└─ docker-compose.yml               Postgres + Mailpit pra dev
```

### Modelos de dados principais

21 modelos no Prisma — destacando os principais:

```mermaid
erDiagram
    User ||--o| Profile : tem
    User ||--o| Subscription : "billing Stripe"
    User ||--o{ UsageMeter : "quota mensal/diária"
    User ||--o{ BillingEvent : "webhooks Stripe (idempotency)"
    User ||--o{ ScoreSnapshot : "histórico de score"
    User ||--o{ Application : "kanban candidaturas"
    User ||--o{ Consent : "LGPD por fonte"
    User ||--o{ DataSource : "rastreio de origem"
    User ||--o{ AssessmentResult : "autoconhecimento"
    User ||--o{ Evidence : "evidências"
    User ||--o{ TailoredCv : "CVs adaptados"
    User ||--o{ Notification : "in-app"
    User ||--o{ AuditLog : "17 actions LGPD"
    ScoreSnapshot ||--o{ Gap : "lacunas priorizadas"
    ScoreSnapshot ||--o{ PlanItem : "plano de ação"
    Application ||--o{ ApplicationEvent : "timeline auditável"

    User {
        string id
        string email
    }
    Profile {
        string targetRole
        json perfilJson
        string rawCv
        datetime rawCvExpiresAt
    }
    Subscription {
        enum status
        enum plan
        datetime currentPeriodEnd
        string stripeCustomerId
    }
    UsageMeter {
        string kind
        int count
        string period
    }
    BillingEvent {
        string stripeEventId
        string type
        json payload
    }
    ScoreSnapshot {
        int overall
        json subScores
        datetime createdAt
    }
    KnowledgeChunk {
        string contentHash
        text content
        json metadata
        vector embedding
    }
    AuditLog {
        string action
        string userIdHash
        string ipHash
        datetime createdAt
    }
```

---

## Rodar localmente

**Pré-requisitos:**
- Node.js 18.18+
- Docker + docker-compose (para Postgres e Mailpit em dev)
- Uma chave Anthropic ([console.anthropic.com](https://console.anthropic.com))

```bash
# 1. Instalar (inclui stripe, @upstash/redis, voyage client + pgvector setup)
npm install

# 2. Subir Postgres + Mailpit (captura emails locais em http://localhost:8025)
docker compose up -d postgres mailpit

# 3. Configurar env
cp .env.example .env
# Preencha pelo menos:
#   ANTHROPIC_API_KEY=sk-ant-...
#   AUTH_SECRET=$(openssl rand -base64 32)
#   DATABASE_URL ja vem apontando pro Postgres do compose
# Opcionais (toda integracao com flag off e no-op):
#   OWNER_EMAILS=sergio@lognullsec.com         # bypass Free tier pra testar
#   STRIPE_SECRET_KEY=sk_test_...              # sem isso, billing retorna 503
#   UPSTASH_REDIS_REST_URL / _TOKEN            # sem isso, rate-limit usa Map
#   VOYAGE_API_KEY=pa-...                      # sem isso, RAG fica em keyword-only
#   AUDIT_IP_SALT=$(openssl rand -hex 32)      # salt do hash de IP no AuditLog

# 4. Aplicar schema no banco (NAO roda mais no build — ver docs/DEPLOY.md)
npx prisma migrate deploy

# 5. Subir
npm run dev
```

Acesse **http://localhost:3000**. Em dev, `AUTH_DEV_CREDENTIALS=true` te deixa logar com qualquer e-mail (sem precisar de SMTP real).

### Comandos úteis

```bash
npm run dev                                    # dev server (hot reload)
npm run build                                  # build de produção (sem prisma migrate)
npm run start                                  # serve o build
npm test                                       # vitest unit (467 testes)
npm run test:watch                             # vitest em watch
npm run test:e2e                               # playwright (requer dev rodando)
npx prisma studio                              # GUI do banco em :5555
npx prisma migrate dev --name <nome>           # nova migration
npm run db:migrate                             # prisma migrate deploy (prod)
npm run ingest:knowledge                       # ingerir knowledge base no pgvector
npm run eval:rag                               # rodar 50-query eval (gate recall@3 >= 70%)
npm run eval:rag:json                          # eval em JSON pra pipeline/CI
```

---

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `LLM_PROVIDER` | não | `anthropic` (default) ou `openai` |
| `LLM_MODEL` | não | `claude-sonnet-4-6` (default), `claude-haiku-4-5-20251001`, `gpt-4o`… |
| `ANTHROPIC_API_KEY` | sim* | * se `LLM_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | sim* | * se `LLM_PROVIDER=openai` |
| `DATABASE_URL` | sim | Postgres connection string (Neon recomendado, com `?sslmode=require`) |
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
| `OWNER_EMAILS` | opcional | Lista CSV de e-mails com bypass total de limite Free (`sergio@x,daniel@y`) |
| `AUDIT_IP_SALT` | prod | `openssl rand -hex 32` — salt do hash sha256 de IP no AuditLog (anti-rainbow) |
| `STRIPE_SECRET_KEY` | opcional | Sem isso, billing retorna 503 amigável e o resto da app funciona |
| `STRIPE_WEBHOOK_SECRET` | opcional* | * obrigatória se Stripe estiver ativo (HMAC verification em `/api/billing/webhook`) |
| `STRIPE_PRICE_PRO_MONTHLY` | opcional* | * Price ID do plano Pro Mensal R$29 (placeholder até criar no Stripe) |
| `STRIPE_PRICE_PRO_YEARLY` | opcional* | * Price ID do plano Pro Anual R$290 |
| `STRIPE_PRICE_TEAM_MONTHLY` | opcional* | * Price ID do plano Team R$99/seat |
| `UPSTASH_REDIS_REST_URL` | opcional | Cache + rate-limit cross-lambda em prod. Sem isso, usa `Map` em memória |
| `UPSTASH_REDIS_REST_TOKEN` | opcional | Token REST do Upstash |
| `VOYAGE_API_KEY` | opcional | Embeddings Voyage AI (1024 dims). Sem isso, fallback Matryoshka OpenAI; sem nenhum dos dois, RAG fica em keyword-only |

Sem chaves de vagas → fallback de vagas ilustrativas (etiquetadas como tal na UI). Sem `STRIPE_SECRET_KEY` → endpoints de billing retornam 503 e o resto da app funciona normalmente.

---

## Deploy no Vercel

### Passo 1 — Postgres gerenciado

Vercel não hospeda Postgres direto (mais). Use um dos:

- **Neon** ([neon.tech](https://neon.tech)) — free tier generoso, recomendado (suporta pgvector nativo)
- **Supabase** ([supabase.com](https://supabase.com)) — também OK
- **Railway** ([railway.app](https://railway.app)) — também OK

Crie o banco e copie a connection string (formato `postgresql://user:pass@host:5432/db?sslmode=require`). **Para RAG**, habilite a extensão `pgvector` (no Neon já vem disponível, basta `CREATE EXTENSION vector`).

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
3. Em **Environment Variables**, adicione **todas as obrigatórias** da tabela acima.
4. **NÃO** defina `AUTH_DEV_CREDENTIALS` em prod (a guarda dupla aborta o boot).
5. Deploy.

### Passo 5 — Rodar a migration em prod

A migration **não** roda mais no `build` (evita race em PRs paralelos e mantém deploys atômicos). Três estratégias suportadas — escolha uma em [docs/DEPLOY.md](./docs/DEPLOY.md):

```bash
# Opção A — manual, antes de promover deploy:
DATABASE_URL="..." npx prisma migrate deploy

# Opção B — Vercel "Install Command":
#   npm ci && npx prisma migrate deploy

# Opção C — GitHub Action dedicada (workflow_dispatch) com `DATABASE_URL` secret.
```

### Passo 6 — Vercel Cron (digest semanal, redact-cv, usage-cleanup)

O `vercel.json` já tem os crons configurados. Como o Vercel não passa headers customizados, configure em **Project → Settings → Cron Jobs**:

```
x-cron-secret: <valor do CRON_SECRET>
```

Pra testar um cron manualmente em prod:
```bash
curl -X POST -H "x-cron-secret: <SEU_SECRET>" https://seu-app.vercel.app/api/cron/digest
curl -X POST -H "x-cron-secret: <SEU_SECRET>" https://seu-app.vercel.app/api/cron/redact-cv
```

### Passo 7 — RAG ingestion (opcional)

Pra ativar o lane vetorial do RAG:

```bash
# Localmente, apontando pro Postgres de prod (com VOYAGE_API_KEY setado):
DATABASE_URL="..." VOYAGE_API_KEY="pa-..." npm run ingest:knowledge

# Validar com eval gate:
DATABASE_URL="..." npm run eval:rag
```

Sem ingestão, o RAG cai no lane keyword-only (recall@3 ainda ≥ 70%).

---

## Segurança

Implementado (11 vulnerabilidades P0+P1 já remediadas na Onda 11):

- **Auth.js v5** com JWT + adapter Prisma. Guarda dupla impede `AUTH_DEV_CREDENTIALS=true` em prod (aborta boot). Rate-limit anti-enumeração no magic-link (3/email/hora).
- **Zod estrito** (`.strict()`) em todos os bodies + limites de tamanho contra DoS de custo.
- **Escopo por `session.user.id`** em toda query Prisma — zero IDOR (2-step query pattern).
- **Rate limit** em **Upstash Redis** (prod, cross-lambda) com fallback Map em memória. Rotas LLM, jobs, billing.
- **Prompt injection mitigado**: system prompt isolado, sanitização de `"""`, null bytes removidos.
- **LLM com retry + backoff exponencial + AbortController** (45s timeout, 2 tentativas, jitter) + **budget per-user** ($0.10 Free / $5 Pro / $20 Team daily).
- **TOCTOU em UsageMeter** corrigido com `Prisma.$transaction` isolationLevel `Serializable`.
- **CSP** via middleware (script-src `self` + `unsafe-inline`, frame-ancestors `none`).
- **Headers de segurança**: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- **Upload PDF/DOCX defensivo**: magic-bytes + content-length antes do parse.
- **Anti-SSRF custom HTTPS agent** com **IP pinning** + bloqueio IPv4/IPv6 privados, CGNAT, link-local (metadata cloud), `.local`/`.internal`. Mitiga DNS rebinding (TOCTOU).
- **Cron protegido** por header `x-cron-secret` com comparação constante-tempo (sem query string).
- **Email HTML escapado** + validação de protocolo no `<a href>` (bloqueia `javascript:`, `data:`). `safeExternalUrl` + `safeHref` via Zod URL aplicados em 5 sinks.
- **Stripe Webhook**: HMAC verify + `BillingEvent.stripeEventId` unique pra idempotency.
- **Chat ownership**: body sem perfil/gaps — server carrega do DB pra evitar spoofing.
- **LGPD**:
  - Consent registrado por fonte com `payloadHash` SHA256.
  - Cascade delete em tudo que pende de `User`.
  - Export em JSON inclui assessments + evidence + tailoredCvs.
  - **`Profile.rawCv` TTL 90d** (cron diário `/api/cron/redact-cv`).
  - **AuditLog** com 17 actions + IP hash sha256+`AUDIT_IP_SALT` (anti-rainbow).
- **Observabilidade de custo LLM**: log estruturado (JSON line) com tokens, custo USD, latência, route, userId.
- **CI gate**: `npm audit` + Dependabot weekly.
- **Sentry** whitelist expandida pra rotas sensíveis.

Auditoria completa em **5 read-only audits** em `docs/audits/`:
- `01-backend.md` · `02-frontend.md` · `03-db-infra.md` · `04-appsec-owasp.md` · `05-ai-llm-security.md`.

Cobre OWASP Top 10:2025 + OWASP Top 10 LLM Apps 2025.

---

## Roadmap

**v0.9 (atual) — MVP completo + RAG real + Stripe foundation (branch `redesign/claude-design`)**
- 4 pilares (Autoconhecimento, Diagnóstico, Ação, Oportunidade) implementados
- RAG real: Voyage AI + pgvector + RRF fusion · 159 chunks · recall@3 ≥ 70% gate
- Stripe Phase 1+2: Checkout + Portal + Webhooks com HMAC + idempotência (Price IDs placeholder)
- 6 ATS providers
- LGPD by construction + AuditLog 17 actions + Profile.rawCv TTL 90d
- 11 vulnerabilidades P0+P1 corrigidas (XSS Zod URL, TOCTOU UsageMeter, SSRF DNS rebinding, cost cap, rate-limit Upstash…)
- 5 audits read-only (Backend, Frontend, DB+Infra, OWASP Top 10:2025, OWASP LLM Top 10)
- 467 testes unit + 5 e2e Playwright

**v1.0 — Validação com usuários (próximo)**
- User testing com 5-10 candidatos
- Entrevistas B2B com universidades + RHs
- Decisão de ICP (B2C primário ou B2B primário)
- Refinamento baseado em feedback real

**v1.1 — Production hardening**
- Vercel Install Command pra `prisma migrate deploy` (manual hoje)
- Neon branch isolation (DB separado preview/prod)
- PITR drill (restore exercitado a cada 3 meses)
- Sentry + PostHog validados com tráfego real
- Lighthouse > 90 em todas as rotas
- Status page

**v1.2 — Monetização ativa**
- Criar Stripe Price IDs reais (placeholders hoje)
- NFe BR (integração com emissora)
- Pricing page + paywall UI nas rotas LLM
- Affiliate de cursos com tracking

**v2.0 — B2B**
- Modelo `Organization` + seats (universidades, consultorias)
- SAML/SSO
- White-label
- API pública
- Dataset proprietário anonimizado (defensibilidade)

**Futuro (não roteado ainda)**
- Mediana de contratados real (dataset)
- Mobile nativo
- i18n (en/es)
- Análise psicométrica clínica validada

---

## Testes

```bash
npm test                # 467 testes unit (vitest) em 36 arquivos
npm run test:e2e        # 5 specs playwright (skipped em CI por padrão)
npm run eval:rag        # 50 queries · gate recall@3 >= 70%
```

Cobertura:
- Validators Zod (60+ schemas: Analyze, Opp, Interview, Tailor, Chat, Linkedin, Portfolio, Application, Assessment, Evidence, TailoredCv, Refresh, Billing…)
- Email digest HTML (escape XSS, singular/plural, validação de protocolo)
- Score determinístico (sub-scores 100% em código + bonus refresh capado)
- RAG hybrid (retrieval + course suggestion + RRF fusion)
- Billing enforce (TOCTOU-safe + OWNER_EMAILS bypass + plan limits)
- Anti-SSRF (DNS pinning + private IPv4/IPv6/CGNAT)
- URL safety (`safeExternalUrl` / `safeHref` Zod URL)
- AuditLog (17 actions + IP hash)
- E2E Playwright: login → diagnóstico → persistência → "apagar tudo"

---

## Documentação

### Produto
- [PRODUTO.md](./docs/PRODUTO.md) — visão de produto, personas, princípios
- [ALGORITHMS.md](./docs/ALGORITHMS.md) — algoritmos, fórmulas, diagramas
- [API.md](./docs/API.md) — referência de rotas

### Engenharia
- [RAG.md](./docs/RAG.md) — arquitetura RAG real (Voyage + pgvector + RRF + eval) · 700 linhas
- [MONETIZACAO.md](./docs/MONETIZACAO.md) — planos, setup Stripe, enforcement, segurança
- [DEPLOY.md](./docs/DEPLOY.md) — 3 estratégias para aplicar migrations fora do build

### Arquitetura (redesign branch)
- [Master Plan](./docs/redesign/00-MASTER_PLAN.md) — plano de migração
- [Frontend](./docs/redesign/01-FRONTEND.md) — arquitetura frontend
- [Backend](./docs/redesign/02-BACKEND.md) — arquitetura backend
- [Production](./docs/redesign/03-PRODUCTION.md) — DevOps + QA + Security

### Auditorias (read-only)
- [01-backend.md](./docs/audits/01-backend.md) — review backend
- [02-frontend.md](./docs/audits/02-frontend.md) — review frontend
- [03-db-infra.md](./docs/audits/03-db-infra.md) — review DB + infra
- [04-appsec-owasp.md](./docs/audits/04-appsec-owasp.md) — OWASP Top 10:2025
- [05-ai-llm-security.md](./docs/audits/05-ai-llm-security.md) — OWASP LLM Top 10

### Operações
- [OBSERVABILITY.md](./docs/OBSERVABILITY.md) — Sentry + PostHog + UptimeRobot + AuditLog

### Pesquisa
- [UX_AUDIT.md](./docs/UX_AUDIT.md) — audit UX + referências internacionais
- [REBRAND_CANDIDATES.md](./docs/REBRAND_CANDIDATES.md) — 22 nomes alternativos verificados
- [A11Y_AUDIT.md](./docs/redesign/A11Y_AUDIT.md) — auditoria de acessibilidade

### Time
- [HANDOFF_TIME_TERA.md](./docs/HANDOFF_TIME_TERA.md) — documento de transparência pro time (341 linhas)

---

## Time

Fernanda Alves · Bianca Matos · Cicero Janiel · Caroline Guilmo · Jonatan Jamar · Daniel Scharf · **Sérgio Henrique**

---

<div align="center">

**CareerTwin AI** — plataforma de gestão de carreira em pt-BR ·
Built with `Next.js 14` + `Anthropic Claude` + `Voyage AI` + `pgvector` + `Postgres` + `Stripe`

</div>
