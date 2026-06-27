# Gandalf v2 — Testing audit (2026-06-26)

> Research-only. Zero edição. Vitest 4.x (unit) + Playwright 1.61 (E2E). 1101
> unit tests passando em 9.5s. Coverage v8 v4 já configurada e funcional.

## TL;DR

| Métrica | Valor |
|---|---|
| Test files (unit) | **82** (`tests/unit/*.test.js`) |
| Tests (unit) | **1101** (todos passando) |
| Duração unit | **9.5s** local |
| E2E spec files | **6** (`tests/e2e/*.spec.js`) |
| Coverage Statements | **63.09%** (3364/5332) |
| Coverage Branches | **54.60%** (2313/4236) |
| Coverage Functions | **62.53%** (464/742) |
| Coverage Lines | **63.94%** (3073/4806) |
| Routes com 0% coverage | **24/55** (~44%) |
| `lib/` files com 0% coverage | **4** (`admin-access.js`, `docx.js`, `prompts.js`, `sample.js`, + `stripe.js`, `types.js`, `median-stub.js`, providers `adzuna/greenhouse/jooble`) |
| `.skip` em unit tests | **0** |
| `.skip` em E2E (intencional) | **6/6 specs** (auto-skip se faltar `DATABASE_URL`+`ANTHROPIC_API_KEY`+`AUTH_DEV_CREDENTIALS`) |
| `.only` ou `.todo` | **0** (nenhum lixo) |
| Snapshot tests | **0** (não usa `toMatchSnapshot`) |
| Assertions fracas (`.toBeDefined()` órfão) | **27 hits**, ~16 únicos relevantes |
| Mocks excessivos (>20 mocks/arquivo) | **6 arquivos**: `api-budget` (27), `api-analyze` (27), `api-analyze-streaming` (29), `profile-refresh` (25), `api-opportunities` (24) |
| A11y testada (axe-core) | **NÃO** (zero integração) |
| Server actions (`"use server"`) testadas | **0/5** (nenhum teste cobre `app/meus-dados/page.js`, `app/entrar/page.js`, `app/admin/page.js`, `app/(app)/dashboard/page.js`, `app/(app)/conta/page.js`) |
| Middleware testado | **NÃO** (`middleware.js` 108L, 0% — não importado por test algum) |

---

## 1. Coverage report

### Como foi medida

```bash
npx vitest run --coverage
# vitest@4.1.9 + @vitest/coverage-v8@4.1.9
# config: vitest.config.js:9-22  (provider v8, include lib/** + app/api/**)
```

Resultado final (rodado nesta auditoria):

```
Statements   : 63.09% ( 3364/5332 )
Branches     : 54.60% ( 2313/4236 )
Functions    : 62.53% ( 464/742 )
Lines        : 63.94% ( 3073/4806 )
```

Sem threshold configurado (`vitest.config.js:9-12` explicita "não queremos
quebrar build por enquanto, apenas medir progresso"). CI não consulta
coverage — `npm test` no `ci.yml:42-43` não inclui flag `--coverage`.

### Distribuição por área

| Área | Cobertura aproximada | Comentário |
|---|---|---|
| `lib/scoring/` | **95% / 85% br** | Excelente. `subscores.js` core de scoring. |
| `lib/metrics/` | **98% / 91% br** | Quase total (exceto `median-stub.js` deliberadamente 0%). |
| `lib/email/` | **96% / 88% br** | Bem coberto (`send-welcome.js`, `welcome-template.js`). |
| `lib/assessments/` | **100% / 94% br** | Perfeito. |
| `lib/billing/` | **84%** | Bom (`enforce.js` 91%, mas `stripe.js` 0%). |
| `lib/concursos/` + `lib/estagios/` | **83-85%** | Aceitável. |
| `lib/jobs/providers/` | **52% / 35% br** | Ruim — só `gupy/vagas-com/fixtures` testados. `adzuna/greenhouse/jooble/lever/workable/ashby` quase 0%. |
| `lib/knowledge/retrieval.js` | **55% / 53% br** | RAG core mal coberto (vetorizador). |
| `lib/auth.js` (NextAuth, 284L) | **40.42% / 42.64% br** | **CRÍTICO** — só rate-limit testado. Callbacks, providers, signIn flow não cobertos. |
| `lib/api-handler.js` | **21.42%** | Wrapper genérico de API mal testado. |
| `lib/safe-fetch.js` | **45% / 50% br** | Helper de SSRF defense — branches críticas (`19-198`) não cobertas. |
| `lib/pdf.js` | **54%** | CV parser PDF mal coberto (caminho de erro). |
| `lib/llm.js` (core LLM caller) | **61.06% / 55% br** | Path de fallback/cache parcial. |
| `lib/llm-cache.js` | **65%** | Lógica de TTL/eviction parcial. |
| `lib/rate-limit.js` | **70.9% / 65% br** | OK mas branches do `incr-then-expire` (77-78,152-154) não cobertas. |

### Files importantes com **0% coverage** (lib/)

| File | Linhas não cobertas | Risco |
|---|---|---|
| `lib/admin-access.js:22-48` | 27 linhas | **ALTO** — guard de role admin sem teste. |
| `lib/docx.js:13-76` | 64 linhas | **ALTO** — parser de docx no upload de CV. |
| `lib/prompts.js:21-277` | 257 linhas | **ALTO** — todos os prompts LLM sem snapshot/teste. |
| `lib/sample.js:1-3` | 3 linhas | Trivial. |
| `lib/billing/stripe.js:11-27` | 17 linhas | **MÉDIO** — wrapper Stripe sem teste. |
| `lib/jobs/types.js` | tipos | Baixo (DTOs). |
| `lib/metrics/median-stub.js` | stub | Intencional. |
| `lib/jobs/providers/adzuna.js:7-68` | 62 linhas | **MÉDIO** — provider Adzuna inteiro sem teste. |
| `lib/jobs/providers/greenhouse.js:5-80` | 76 linhas | **ALTO** — Greenhouse é principal ATS provider. |
| `lib/jobs/providers/jooble.js:6-61` | 56 linhas | **MÉDIO** |
| `lib/jobs/providers/ashby.js` | 18.96% | **MÉDIO** |
| `lib/jobs/providers/lever.js` | 10.71% | **ALTO** — Lever também ATS principal. |
| `lib/jobs/providers/workable.js` | 16.41% | **MÉDIO** |

### Routes com **0% coverage** (24/55)

| Route | Linhas | Categoria | Risco |
|---|---|---|---|
| `app/api/_track/route.js:24-143` | 143 | Analytics ingest | **MÉDIO** — endpoint público recebendo eventos. |
| `app/api/admin/usage/route.js:19-144` | 144 | Admin | **ALTO** — sem guard testado. |
| `app/api/applications/route.js:7-123` | 123 | CRUD apps | **ALTO** — IDOR não testado. |
| `app/api/applications/[id]/route.js:7-130` | 130 | CRUD apps | **ALTO** — IDOR + DELETE não testado. |
| `app/api/assessments/[kind]/route.js:12-135` | 135 | Assessments | **MÉDIO** |
| `app/api/auth/[...nextauth]/route.js` | 3 | NextAuth handler | Wrapper trivial. |
| `app/api/auth/welcome-sent/route.js:19-44` | 26 | Welcome flow | Baixo. |
| `app/api/concursos/route.js:23-78` | 56 | Concursos | **MÉDIO** |
| `app/api/cron/outcome-survey/route.js:28-253` | 253 | **CRON** | **CRÍTICO** — outcome survey cron sem teste. |
| `app/api/cron/redact-billing/route.js:17-61` | 45 | **CRON** | **ALTO** — LGPD redaction. |
| `app/api/cron/redact-cv/route.js:24-157` | 134 | **CRON** | **CRÍTICO** — LGPD redaction CV. |
| `app/api/cron/usage-cleanup/route.js:12-43` | 32 | **CRON** | **MÉDIO** — cleanup. |
| `app/api/cv/upload/route.js:11-194` | 195 | **UPLOAD** | **CRÍTICO** — file upload, parsing, MIME check. |
| `app/api/estagios/route.js:25-91` | 67 | Estágios | **MÉDIO** |
| `app/api/gaps/courses/route.js:13-71` | 59 | Gaps | **MÉDIO** |
| `app/api/gaps/requirements/route.js:9-72` | 64 | Gaps | **MÉDIO** |
| `app/api/gaps/summary/route.js:9-84` | 76 | Gaps | **MÉDIO** |
| `app/api/history/actions/route.js:5-130` | 126 | History | **MÉDIO** |
| `app/api/history/score/route.js:5-32` | 28 | History | Baixo |
| `app/api/linkedin/parse/route.js:13-207` | 195 | **EXT-API** | **ALTO** — LinkedIn parse + LLM call. |
| `app/api/me/preferences/route.js:17-89` | 73 | Preferences | **MÉDIO** — PUT/PATCH PII. |
| `app/api/metrics/median/route.js:21-40` | 20 | Metrics | Baixo. |
| `app/api/notifications/route.js:9-46` | 38 | Notifications | **MÉDIO** |
| `app/api/notifications/[id]/read/route.js:10-42` | 33 | Notifications | **MÉDIO** — IDOR. |
| `app/api/notifications/read-all/route.js:9-26` | 18 | Notifications | Baixo |
| `app/api/plan-items/[id]/complete/route.js:5-94` | 90 | Plan | **MÉDIO** — IDOR. |
| `app/api/portfolio/import/route.js:13-305` | 293 | Portfolio | **ALTO** — import grande sem teste. |
| `app/api/profile/completeness/route.js:6-22` | 17 | Profile | Baixo. |
| `app/api/profile/onboarding/route.js:6-24` | 19 | Profile | Baixo. |
| `app/api/score/with-history/route.js:5-67` | 63 | Score | **MÉDIO** |
| `app/api/tailored-cvs/route.js:5-34` | 30 | CVs | **MÉDIO** — listing. |
| `app/api/tailored-cvs/[id]/route.js:5-75` | 71 | CVs | **ALTO** — IDOR + DELETE. |

---

## 2. Critical paths sem cobertura

| Módulo | Path | Risk |
|---|---|---|
| **Middleware (CSP+auth gate)** | `middleware.js:1-108` | **CRÍTICO** — não importado por test algum. `isProtected()` e header injection (CSP/HSTS/X-Frame) sem regression test. Single point of failure pra rotas protegidas. |
| **Auth callbacks/providers** | `lib/auth.js:105-219,235-260` | **CRÍTICO** — só rate-limit (`auth-rate-limit.test.js`) cobre uma função (`checkAuthRate`). `sendVerificationRequest`, callbacks `session/jwt/signIn`, provider Credentials dev (gate `isRealProduction`), Resend fallback — **nenhum teste**. |
| **CV upload** | `app/api/cv/upload/route.js:11-194` | **CRÍTICO** — file upload com MIME check, magic bytes, `lib/pdf.js` + `lib/docx.js`. Vetor clássico de RCE/path-traversal sem teste de input adverso. |
| **CV docx parser** | `lib/docx.js:13-76` | **ALTO** — 0% coverage, parser de docx (mammoth.js) sem fuzzing. |
| **Cron LGPD redact-cv** | `app/api/cron/redact-cv/route.js:24-157` | **CRÍTICO** — cron de LGPD apaga CV após N dias. Bug aqui = não-compliance OU data-loss. |
| **Cron LGPD redact-billing** | `app/api/cron/redact-billing/route.js:17-61` | **ALTO** — idem para dados de billing. |
| **Cron outcome-survey** | `app/api/cron/outcome-survey/route.js:28-253` | **ALTO** — 253L sem teste. Manda email pra usuários — bug pode floodar. |
| **Cron usage-cleanup** | `app/api/cron/usage-cleanup/route.js:12-43` | **MÉDIO** — cleanup de tracker quota. |
| **LinkedIn parse** | `app/api/linkedin/parse/route.js:13-207` | **ALTO** — parsing externo + LLM call, sem teste de schema variation. |
| **Portfolio import** | `app/api/portfolio/import/route.js:13-305` | **ALTO** — 305L, integração externa. |
| **Server actions (`"use server"`)** | `app/meus-dados/page.js`, `app/entrar/page.js`, `app/admin/page.js`, `app/(app)/dashboard/page.js`, `app/(app)/conta/page.js` | **CRÍTICO** — 5 actions, **0 testes**. `meus-dados/page.js` faz **eraseUserData** (delete cascata) — bug aqui = perda de dados. |
| **Admin access guard** | `lib/admin-access.js:22-48` | **CRÍTICO** — 0% coverage. Único guard de RBAC pra rotas admin. Sem teste de bypass (string injection no email allowlist, case sensitivity etc). |
| **Billing webhook** | `app/api/billing/webhook/route.js` | **ALTO** — só 61.44% coverage (testado parcialmente em `api-billing-webhook.test.js`). Branches de signature verification + idempotency parcialmente cobertas. |
| **`api-handler.js` wrapper** | `lib/api-handler.js:20-51,70-72` | **MÉDIO** — wrapper genérico de error handling, 21% coverage. Sem teste = todo route que usa pode quebrar silenciosamente. |
| **safe-fetch SSRF defense** | `lib/safe-fetch.js:19,132,137-198` | **CRÍTICO** — helper contra SSRF mal testado. Path de DNS resolution + IP private check (`137-198`) é a defesa principal. |
| **Jobs providers (Greenhouse/Lever/Adzuna)** | `lib/jobs/providers/{greenhouse,lever,adzuna,workable,ashby,jooble}.js` | **ALTO** — providers principais quase 0%. Bug em mapping = sumiço de vagas reais. |
| **LLM cache invalidation** | `lib/llm-cache.js:62,78-82,87-88` | **MÉDIO** — branches de TTL miss não cobertas, risco de cache poisoning. |
| **PDF parser error path** | `lib/pdf.js:23,36-45,48-54` | **MÉDIO** — error handling sem teste; usuário com PDF malformado quebra silenciosamente. |

---

## 3. Test quality issues

### 3.1 Sem `.only`, `.skip`, `.todo` em unit tests
Excelente higiene. Único `.skip` é o guard intencional dos 6 E2E specs
(`tests/e2e/*.spec.js`) baseado em env (`DATABASE_URL`, `ANTHROPIC_API_KEY`,
`AUTH_DEV_CREDENTIALS=true`). **Não é débito**, é design.

### 3.2 Assertions fracas (`.toBeDefined()` órfão)
27 ocorrências em 12 arquivos. As mais suspeitas:

| File:line | Padrão |
|---|---|
| `tests/unit/billing-plans.test.js:6-9` | `expect(PLANS.free).toBeDefined()` × 4 — testa apenas presença, não shape. |
| `tests/unit/api-funnel.test.js:165-167,238-239` | `expect(data.analysis).toBeDefined()` × 5 — não valida conteúdo. |
| `tests/unit/api-opportunities.test.js:247,287` | `expect(data.vagas).toBeDefined()` — não valida estrutura das vagas. |
| `tests/unit/api-daily-quest.test.js:101` | `expect(body.quest).toBeDefined()` |
| `tests/unit/funnel-analysis.test.js:200` | `expect(r.rates).toBeDefined()` |

**Diagnóstico**: ~16 são assertions de "smoke" (campo existe) sem validação
de tipo/shape. Risco baixo (raramente regressão silencia), mas oportunidade
de upgrade pra `toMatchObject({...})` ou `expect.objectContaining`.

### 3.3 Snapshot tests
**0 ocorrências** de `toMatchSnapshot`/`toMatchInlineSnapshot`. Não há
snapshots grandes (frágil) — bom. Mas perde-se cobertura barata de "shape"
de respostas LLM/prompts (`lib/prompts.js` 0%).

### 3.4 Source-grep tests (smell)
6 arquivos validam código-fonte via `readFileSync` + regex em vez de
executar a unidade:

- `tests/unit/cv-diff-view.test.js` — testa componente React lendo source
  (env `node` sem JSDOM/RTL). Documentado no header: "Como o setup do
  projeto NAO inclui JSDOM/RTL, nao renderizamos o componente: validamos
  a forma".
- `tests/unit/copilot-widget.test.js` — idem (`AppShell.js`, `layout.js`).
- `tests/unit/css-mobile.test.js` — regex em `globals.css` (5k linhas)
  procurando media queries.
- `tests/unit/welcome-modal.test.js` — source-grep.
- `tests/unit/jobs-gupy.test.js`, `tests/unit/jobs-vagas-com.test.js` —
  usam `readFileSync` mas pra **fixtures** (HTML samples), o que é
  legítimo.

**Diagnóstico**: 3-4 destes (`cv-diff-view`, `copilot-widget`,
`css-mobile`, `welcome-modal`) são **proxy tests** — refatoração inocente
de variável quebra teste sem haver bug. Trade-off explícito: sem JSDOM,
não dá pra render. **Custo de adicionar `jsdom` ao vitest config: ~30
linhas + ~5s no test run.**

### 3.5 Mocks excessivos (>20 mocks/arquivo)

| File | vi.mock + vi.fn + vi.spyOn |
|---|---|
| `tests/unit/api-analyze-streaming.test.js` | 29 |
| `tests/unit/api-analyze.test.js` | 27 |
| `tests/unit/api-budget.test.js` | 27 |
| `tests/unit/profile-refresh.test.js` | 25 |
| `tests/unit/api-opportunities.test.js` | 24 |
| `tests/unit/api-chat-streaming.test.js` | 19 |

Esses são tests de **API routes** que precisam mockar `prisma`, `auth`, LLM,
billing, rate-limit, logger, sentry etc — 20+ é razoável pra integração
em-process. **Mas**: alta dependência de mock = baixa confiança real. Risco
de "tests passam, prod quebra" porque mock não reflete contrato real do
Prisma/LLM. **Sem integration test com DB de verdade** (e2e usa real, mas
só 6 specs).

### 3.6 Timeouts > 10s
**Não encontrado em unit tests.** Timeouts em E2E: 5-10s
(`waitForURL { timeout: 10_000 }`), padrão saudável. Default global
Playwright `timeout: 60_000` (`playwright.config.js:7`).

### 3.7 Tests pequenos demais (potencial cobertura trivial)
Os 10 menores arquivos por `expect()` count:

```
gaps-routes.test.js          5 expects
completion-routes.test.js    6
health-route.test.js         6
pdf.test.js                  8
score.test.js                9
completeness.test.js        10
onboarding-state.test.js    11
jobs.test.js                12
lever-provider.test.js      13
css-mobile.test.js          14
```

`pdf.test.js` com 8 expects pra cobrir parser PDF (lib/pdf.js 54%) é
preocupante — cobertura baixa + poucos asserts = pouca confiança no
parser.

---

## 4. E2E coverage

### Specs (6 total — `tests/e2e/`)

| Spec | Linhas | Cobre |
|---|---|---|
| `auth-persist-erase.spec.js` | 57 | **Jornada principal Fase 1** — login dev → diagnóstico → persiste → re-login → erase (LGPD). Único E2E que cobre `/api/analyze` POST com cookies. |
| `login-dashboard.spec.js` | 38 | Login dev → AppShell visível + 5 nav items (Dashboard, Gaps, Radar, Plano, Transparência). |
| `navigation-claude-design.spec.js` | 31 | Navega entre 5 telas Claude Design (`/gaps`, `/oportunidades`, `/plano`, `/transparencia`, `/conta`). |
| `theme-toggle.spec.js` | 41 | Toggle light↔dark persiste em localStorage entre páginas/reload. |
| `lgpd-export-delete.spec.js` | 38 | `/api/me/export` retorna JSON com `user.email`. (Delete coberto pelo `auth-persist-erase`.) |
| `onboarding-modo-experimentar.spec.js` | 42 | Home pública `/` → split-panel onboarding + botão "Carregar exemplo" sem login. **Único E2E sem dependência DB/LLM** — sempre roda. |

### Smoke tests
**Sim, parcialmente.** `login-dashboard.spec.js` cobre login + dashboard
landing (era o pedido explícito de "/entrar e2e"). Falta:
- Smoke do logout flow (não há).
- Smoke de fluxo upload de CV (nenhum E2E cobre `/api/cv/upload`).
- Smoke de bypass auth (acessar `/dashboard` sem cookie → redirect pra
  `/entrar`) — middleware sem teste.

### Acessibilidade (axe-core)
**ZERO integração.** Não há import de `@axe-core/playwright`, `axe-core`,
ou `injectAxe`. Para projeto que tem skill `elrond-a11y-reaudit` no audit
de hoje, é um gap relevante — a11y só é testada **manualmente** ou via
audit estático, sem assertions no E2E.

### Gates do E2E
- `playwright.config.js:9` — `fullyParallel: false, workers: 1`. Sério —
  E2E roda single-threaded. OK pra estabilidade mas lento (~3-5min CI).
- `playwright.config.js:11` — `trace: "retain-on-failure"` (boa prática).
- `playwright.config.js:14-21` — `webServer: next dev` com
  `reuseExistingServer: !CI`. Em CI sobe `next dev`, **não** `next start`
  com build de produção. Bugs específicos de prod (build minification,
  edge runtime) **não são pegos por E2E**.
- `.github/workflows/e2e.yml:13` — roda apenas em PR com label `e2e`,
  **não** em push pra main. Decisão explícita
  (`ci.yml` separa unit/lint/build de E2E).

---

## 5. Test infrastructure

### vitest.config.js (`vitest.config.js:1-30`)
- Env: `node` (sem JSDOM — limita test de componentes React).
- Globals: `true` (sem precisar importar `describe/it/expect`).
- Include: apenas `tests/unit/**/*.test.js` (não pega `*.spec.js` — clean).
- Coverage: provider `v8`, include `lib/**` + `app/api/**`, exclude
  `**/*.test.js`, `tests/**`, `**/node_modules/**`, `**/*.config.*`.
- **Sem threshold** (`coverage.thresholds` ausente). Decisão explicitamente
  documentada na config (linhas 9-12).
- Alias: `@` → root (linha 26-27) — alinhado com `jsconfig.json`.
- **Sem setup file** (`test.setupFiles` ausente). Cada test mocka isolado.

### Mock Prisma — pattern caseiro
`tests/helpers/api.js:42-166`. Função `mockPrisma()` cria objeto plano
com `vi.fn()` pra cada model usado. `$transaction` default chama callback
com o próprio mock como tx (mimica Serializable).

**Não usa `vitest-mock-extended` nem `jest-mock-prisma`** — opção
consciente. Vantagem: zero dep adicional, controle total. Desvantagem:
manual sync com schema (`prisma/schema.prisma` muda → helper precisa
ajuste).

### Test database — separado de dev?
**Sim para E2E** (`.github/workflows/e2e.yml:29-44` sobe Postgres service
isolado por workflow run). Não há fixtures pré-setadas — cada test usa
email único via `Date.now()` (`auth-persist-erase.spec.js:18`,
`login-dashboard.spec.js:16`, etc) pra evitar colisão entre rodadas.

**Sem rollback automático.** Dados ficam até serem apagados manualmente
pelo próprio teste (LGPD delete cobre alguns, outros vazam). Local: aceito.
CI: usa container Postgres efêmero (descartado ao fim do job), então OK.

### Fixtures / factories
- `tests/fixtures/gupy-sample.html` + `tests/fixtures/vagas-com-sample.html`
  — HTML real do scraper. Sem factories de objeto Prisma.
- **Sem `lib/test-utils/`** (não existe). Não há `makeUser()`,
  `makeProfile()`, etc — cada test inline.
- `tests/helpers/api.js` (166L) tem `makeReq`, `makeGetReq`, `makeDeleteReq`,
  `setupAuthSession`, `mockPrisma` — funciona como pseudo-factory.

### Eval suite (não-vitest)
`tests/eval/rag/` (815L total) — eval de RAG via `node` script direto
(`scripts/ingest-knowledge.mjs`). Não roda no `npm test`, só via
`npm run eval:rag`. Não conta pra coverage. **Bom** que existe; **gap**:
não há gate no CI bloqueando degradação de RAG.

---

## 6. CI gate

### `.github/workflows/ci.yml`
Roda em `push` para `main`/`redesign/claude-design` e em todo PR.

Steps relevantes:
1. `npm ci`
2. `npx prisma format --check` — `continue-on-error: true` (não gate).
3. `npx prisma validate` (com DATABASE_URL placeholder).
4. **`npm test`** (linha 42-43) → `vitest run` (1101 tests, 9.5s) — **gate**.
5. `npm run lint` — `continue-on-error: true` (não gate).
6. `npm audit --audit-level=critical --omit=dev` — gate, mas rebaixado de
   `high` pra `critical` por workaround documentado em
   `docs/security/audit-exceptions-2026-06-26.md` (next@14 + nodemailer@7
   com 14+6 CVEs HIGH sem fix upstream).
7. Job `build` (`next build`) — gate (precisa `test` passar).

**Resumo**: falha em qualquer test unit **bloqueia merge**. Coverage **não
é gate**. Lint não é gate. `npm audit` é gate só pra critical (não high).

### `.github/workflows/e2e.yml`
- Só roda em PR com label `e2e` (`if: contains(github.event.pull_request.labels.*.name, 'e2e')`).
- Sobe Postgres service + Mailpit-like, instala Playwright + chromium.
- `npm run test:e2e` é gate (job falha = PR fica vermelho **mas** PR sem
  label nunca dispara o job, então default-flow não pega regressão E2E).
- Upload de Playwright report como artifact (retention 7d).

**Risco**: PR sem label `e2e` **nunca executa E2E**. Bug que só aparece no
fluxo full (login → analyze → persist) passa direto. Não há cron nightly
do E2E.

---

## Top 5 alavancas

1. **Adicionar testes pro middleware (`middleware.js:1-108`).**
   Cobertura zero hoje. É o gate principal (CSP, HSTS, redirect pra
   `/entrar` quando não-autenticado). 1 dia. Importar `middleware.js`
   direto no test + invocar com `NextRequest` mockado.

2. **Cobrir `lib/admin-access.js` + 4 cron handlers (`cron/redact-cv`,
   `cron/redact-billing`, `cron/outcome-survey`, `cron/usage-cleanup`).**
   Admin guard sem teste = bypass silencioso. Crons sem teste = bug em
   LGPD/email/cleanup só descobre em prod. 2-3 dias usando padrão
   `tests/helpers/api.js`.

3. **Test pra `/api/cv/upload/route.js` (195L, 0% cov) + `lib/docx.js` (0%) +
   `lib/safe-fetch.js` (45%) com casos adversos** (PDF malformado, magic
   bytes, redirect-loop, IP privado). Vetor de ataque #1 numa app de CV.
   2 dias.

4. **Integrar `@axe-core/playwright` nos 6 E2E specs.** A11y compliance é
   pedido recorrente da auditoria — sem assertion, regressão passa. ~4
   linhas por spec + `npm i -D @axe-core/playwright`. 1 dia + reportar
   findings.

5. **Subir threshold de coverage no vitest** (mesmo modesto: 60% lines,
   55% branches) **e** habilitar `--coverage` no CI step. Hoje a métrica
   existe mas é cosmética. Pequeno bonus: rodar E2E em cron noturno (não
   só por label) pra pegar regressão de fluxo full sem custar PR latency.

---

## Apêndice — comandos pra reproduzir

```bash
# Unit tests
cd /home/akametatron/Downloads/careertwin-aiV2/careertwin-ai
npm test                       # vitest run, 9.5s, 1101 tests
npx vitest run --coverage      # gera coverage/index.html + summary text

# E2E (precisa docker compose + .env)
docker compose up -d postgres mailpit
npx prisma migrate dev
npm run test:e2e

# RAG eval (não no CI)
npm run eval:rag
npm run eval:rag:json
```
