# Boromir v2 — Code quality audit (2026-06-26)

> Research-only. Zero edicao. Foco em alavancas grandes, nao micro-otimizacao.
>
> Scope: `app/`, `components/`, `lib/` (JS/JSX). 203 arquivos totais.
> Branch ativa: `redesign/claude-design` pos-Sociedade do Anel.

---

## TL;DR

- **Dead code**: 3 arquivos completamente mortos (0 imports) + 2 exports nao usados externamente
- **Complexity hotspots**: 5 arquivos > 600 LOC, 1 funcao > 540 linhas, 1 funcao > 420 linhas
- **Duplicacao significativa**: 6 padroes critico (constante + funcao + helpers fmt)
- **Console.log esquecidos**: 14 ocorrencias (excluindo `console.warn` legitimos de provider fallback)
- **TODOs acumulados**: 1 unico TODO real (`// TODO manual` em WelcomeModal.js:20) — surpreendentemente limpo
- **Inconsistencias graves**: 11/55 rotas usam `withApiGuard` (20%), 1/~50 arquivos usa `lib/logger.js`, 3 envelopes de erro diferentes coexistem
- **Lint**: ESLint NAO esta inicializado (`npm run lint` pede pra escolher config) — CI passa com `continue-on-error: true`, mascarando isso

**Alavanca #1 (biggest win)**: Inicializar ESLint config + remover `continue-on-error` do CI. Sem isso, qualquer outro fix nao tem gate.

---

## 1. Dead code

| Tipo | Arquivo | Simbolo | Confidence |
|---|---|---|---|
| Arquivo morto | `lib/metrics/median-stub.js` | `HIRED_MEDIAN` | Alta — usado so em `lib/metrics/median-real.js` como referencia historica (`globals.css` match e coincidencia de string) |
| Arquivo morto | `lib/jobs/types.js` | `SOURCES`, `isJob()` | Alta — 0 imports externos. Doc-only (forma canonica de Job documentada nos comments) |
| Arquivo quase-morto | `lib/llm-cache.js` | `cacheGet`, `cacheSet` | Media — importado apenas por `lib/llm.js`. Util mas ja consolidado, ok como esta |
| Export nao usado | `lib/career-paths.js:13` | `CAREER_PATHS` | Alta — export externamente nao consumido (so `getCareerPath`/`getAllPaths` em `app/(app)/carreira/page.js:5`) |
| Export nao usado | `lib/score.js:19` | `computeOverall()` | Media — usado em `tests/unit/score.test.js` mas em nenhum lugar de producao (sub-scores ja vem computados de outro lugar). Mantido como referencia auditavel |
| Pacote prod nao-importado | `package.json` | `@auth/prisma-adapter` | Baixa — provavel usado em `auth.config.js`/`lib/auth.js`. Confirmar antes de remover |

**Validacoes feitas**:
- `mammoth` -> usado em `lib/docx.js` (extractDocxText). OK
- `pdf-parse` -> usado em `lib/pdf.js` (extractPdfText). OK
- `@sentry/nextjs` -> usado em `sentry.{client,edge,server}.config.js` + `lib/logger.js`. OK
- `stripe` -> usado em `lib/billing/stripe.js`. OK
- `lib/auth-protected-paths.js` -> usado por middleware (importado por convencao em pages como `app/(app)/concursos/page.js`). OK

**Rotas API "orfas"** (referenciadas zero vezes em frontend):
- `/api/gaps/courses` (`app/api/gaps/courses/route.js`) — 0 refs em `app/` ou `components/`. Confirmar se e consumida por cron ou e morta.
- `/api/plan-items/[id]/complete` — 0 refs. Provavelmente chamada via fetch dinamico (template-string `/api/plan-items/${id}/complete`) — re-verificar com grep mais aberto antes de deletar.
- `/api/profile/completeness` — 0 refs em frontend.

---

## 2. Complexity hotspots

| Arquivo | LOC | Funcao maior |
|---|---|---|
| `app/privacidade/page.js` | **1192** | `PrivacidadePage()` (SSR JSX gigante) — quase todo JSX inline. Refatorar em subcomponentes |
| `lib/career-paths.js` | **1021** | Mostly data (`CAREER_PATHS` const enorme). `getCareerPath` e ~10 linhas. Considerar mover data pra JSON |
| `app/(app)/transparencia/page.js` | **953** | Pagina explicativa SSR — JSX inline + secoes muito longas |
| `lib/jobs/providers/fixtures.js` | **815** | `searchFixtures()` a partir de linha 779. Mas a maior parte e dataset hardcoded |
| `app/(app)/autoconhecimento/[kind]/AssessmentClient.js` | **789** | Componente client gigante. Provavel candidato a quebrar em hooks |
| `app/(app)/dashboard/page.js` | **730** | Page SSR + muitos sub-componentes inline |
| `app/experimentar/page.js` | **701** | Demo flow inline — ok pra MVP, mas muita logica |
| `app/(app)/conta/page.js` | **653** | Pagina de conta com sub-componentes inline |
| **`app/api/profile/refresh/route.js:67-608`** | **542 linhas / 1 funcao** | `handler()` faz: auth, rate-limit, billing, parsing, scoring, LLM, snapshot, achievements. Cyclomatic complexity alta. Caso mais critico do projeto |
| **`app/api/analyze/route.js:63-487`** | **425 linhas / 1 funcao** | `async function core()` espelhamente do refresh handler. Mesmo problema arquitetural |
| `app/(app)/plano/page.js` | 599 | Page client com cards + handlers inline |
| `components/site/SiteHero.js` | 606 | Componente landing pesado pos-redesign |
| `app/(app)/estagios/page.js` | 570 | Page + helpers fmt inline (ver duplicacao) |
| `app/api/analyze/route.js` (total) | 568 | Em conjunto |
| `lib/estagios/index.js` | 567 | Scraping + parsing — ja modularizado parcialmente |
| `app/(app)/oportunidades/RadarClient.js` | 543 | Client componente longo |
| `components/CopilotWidget.js` | 488 | Componente client complexo (chat + tailor + interview) |

**Aninhamento profundo** (>= L4 — espacos > 8):
- `app/api/analyze/route.js`: L4=1, L5=1 — refactor candidato pra extrair guards
- `app/api/opportunities/route.js`: L4=2, L5=1
- `lib/concursos/index.js`: L4=3, L3=3 — scraping parser tipico

---

## 3. Duplicacao

### 3.1 Constante + helper duplicados literais

`FALLBACK_EXPL` (objeto de 4 chaves com texto identico) e funcao `pickExplicacao()` aparecem 100% duplicados em:
- `app/api/analyze/route.js:26-45`
- `app/api/profile/refresh/route.js:51-65`

Mesma string, mesmo array de keys, mesma logica. Deveria viver em `lib/scoring/fallbacks.js`.

### 3.2 Formatters BRL/Date espalhados sem util compartilhado

Tres formatters quase identicos, nenhum compartilhado:
- `app/(app)/concursos/page.js:32` — `fmtSalario()` com `new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })`
- `app/(app)/estagios/page.js:50` — `fmtBolsa()` com mesma config Intl
- `app/(app)/conta/page.js:160` — `formatDatePtBr()` com `toLocaleDateString("pt-BR", { day, month: "long", year })`

Outras 8 ocorrencias de `new Date(x).toLocaleString("pt-BR")` inline em pages diversas (`meus-dados`, `admin`, `experimentar`, `AssessmentClient`, `NotificationsBell`, `SiteMetrics`). Total: 30 ocorrencias de formatacao pt-BR sem util central.

**Sugestao**: `lib/format.js` com `formatBRL`, `formatDateLong`, `formatDateTime`.

### 3.3 Retry duplicado

- `lib/retry.js`: exporta `withRetry()` — usado por `lib/embeddings.js`, `lib/jobs/providers/jooble.js`, `lib/jobs/providers/adzuna.js`
- `lib/llm.js:46-65`: implementa `callWithRetry()` com mesma logica (backoff exponencial + jitter, mesmos status retryable). NAO usa `withRetry` do `lib/retry.js`

Mesma logica, dois lugares. lib/llm.js poderia delegar pra `withRetry`.

### 3.4 Session check pattern (43 ocorrencias)

```js
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: "...", code: "UNAUTHORIZED" }, { status: 401 });
}
const userId = session.user.id;
```

Aparece 43x em rotas API (`grep "if (!session?.user?.id)"`). Wave 1 introduziu `withApiGuard` mas 44/55 rotas ainda nao usam. Faltam helpers `requireAuth(req)` / `withAuthGuard()`.

### 3.5 `sleep()` redefinido

- `lib/llm.js:29`: `function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }`
- (varios outros `setTimeout` ad-hoc em retry blocks)

Util uma-linha, mas 0 sharing. Mais sintoma que doenca.

### 3.6 Error envelope shapes inconsistentes

Tres formas convivem:
- **camelCase com code**: `{ error: "Faça login...", code: "UNAUTHORIZED" }` — usado em `analyze`, `refresh`, billing (44 ocorrencias com `code:`)
- **snake_case minimal**: `{ error: "unauthorized" }` ou `{ error: "invalid_id" }` ou `{ error: "not_found" }` — usado em `app/api/evidence/[id]/route.js`, `app/api/tailored-cvs/[id]/route.js`, `app/api/cron/usage-cleanup/route.js`
- **api-handler wrap**: `{ error: "Encontramos um problema...", code: "SERVER_ERROR" }` — vindo de `lib/api-handler.js:errorPayload()`

Cliente nao consegue confiar no shape do erro.

---

## 4. Inconsistencias

### 4.1 `withApiGuard` parcialmente adotado

- 11/55 rotas usam `withApiGuard` (20%)
- 44 rotas ainda implementam try/catch ad-hoc OU nada
- Resultado: rotas nao-guardadas retornam HTML em 500 (justamente o problema que motivou criar `withApiGuard` — esta documentado em `lib/api-handler.js:5-7`)

### 4.2 Logger nao adotado

- `lib/logger.js` (3.5 KB) com PII sanitization implementado
- Importado por apenas 1 arquivo: `lib/llm.js` (e o proprio logger.js + health route)
- 152 ocorrencias de `console.error()` no codebase + 14 ocorrencias de `console.log()` em producao = nenhuma usa logger

PII risk: error logs podem vazar email/cv via `console.error(e)` sem sanitize. Adocao do logger seria ganho de seguranca + observability.

### 4.3 Naming snake_case dentro de JS (mistura com camelCase)

- `sub_scores` (snake) coexiste com `userId` (camel) no mesmo arquivo:
  - `app/api/profile/refresh/route.js:386` — `JSON.stringify(computed.sub_scores)` ao lado de `userId`, `previousSnapshot`
  - 50 ocorrencias snake_case em codebase (sub_scores, aderencia_vagas, etc)
- Mistura justificada pela compat com schema/LLM JSON, mas falta uma "boundary layer" que converta entre os mundos.

### 4.4 Error handling: try/catch vs `.catch()` vs Result

- Try/catch: `app/api/portfolio/import/route.js` (9 blocks), `app/api/analyze/route.js` (9), `lib/embeddings.js` (7)
- `withApiGuard` wrap: 11 routes
- `withRetry` no `lib/retry.js`: retorna result direto, throw em erro
- Em alguns lugares, callbacks ainda fazem `.catch()` inline (`app/api/_track/route.js`)
- Sem padrao "Result/Either" — ok, mas a mistura cria fadiga cognitiva pra revisor

### 4.5 Cost de LLM logging fora do logger

- `lib/llm.js:194` faz `console.log(JSON.stringify({ evt: "llm.usage", ... }))` direto
- `lib/llm-stream.js:41` mesma coisa
- Logger JSON-line existe (`lib/logger.js`), tem PII sanitization, mas nao e usado aqui
- Conserto trivial mas impacto grande em PII (model output pode escapar)

---

## 5. `console.log` esquecidos

Excluindo `console.error` legitimos e `console.warn` de provider fallback (lib/jobs/providers/*).

| Arquivo:linha | Conteudo | Severidade |
|---|---|---|
| `app/api/billing/webhook/route.js:92` | `console.log("webhook: evento ja processado:", event.id)` | P1 — webhook idempotencia, util mas deve virar logger |
| `app/api/billing/webhook/route.js:153` | `console.log("webhook: evento nao tratado:", event.type)` | P1 |
| `app/api/billing/webhook/route.js:260` | `console.log("subscription.deleted: subscription desconhecida:", sub.id)` | P1 |
| `app/api/billing/webhook/route.js:275` | `console.log("payment_succeeded:", invoice.id, invoice.amount_paid)` | **P0 — PII financeira em log raw** |
| `app/api/billing/webhook/route.js:280` | `console.log("payment_failed:", invoice.id)` | P0 — mesma classe |
| `app/api/profile/refresh/route.js:255` | `console.log("[refresh] completedGaps:", JSON.stringify(completedGapsDebug))` | **P0 — debug deixado em prod** |
| `app/api/profile/refresh/route.js:256` | `console.log("[refresh] projectedGains:", ...)` | P0 — debug |
| `app/api/profile/refresh/route.js:386` | `console.log("[refresh] sub_scores antes do bonus:", ...)` | P0 — debug |
| `app/api/profile/refresh/route.js:387` | `console.log("[refresh] overall antes do bonus:", computed.overall)` | P0 — debug |
| `app/api/profile/refresh/route.js:421` | `console.log("[refresh] baseline restaurado de previousSnapshot")` | P1 — debug |
| `app/api/profile/refresh/route.js:422` | `console.log("[refresh] sub_scores apos baseline:", ...)` | P0 — debug |
| `app/api/profile/refresh/route.js:423` | `console.log("[refresh] overall apos baseline:", ...)` | P0 — debug |
| `app/api/profile/refresh/route.js:457` | `console.log("[refresh] totalBonus aplicado:", totalBonus)` | P0 — debug |
| `app/api/profile/refresh/route.js:458-459` | `console.log("[refresh] ... depois do bonus", ...)` | P0 — debug |
| `lib/llm.js:194` | `console.log(JSON.stringify({ evt: "llm.usage", ... }))` | P2 — observability legitimo, mas devia ir pro logger |
| `lib/llm-stream.js:41` | Mesmo padrao logUsage | P2 |
| `lib/logger.js:84` | `console.log(line)` | OK — o proprio logger usa console como sink, expected |

**Total**: 9 console.log de **debug** esquecidos em `app/api/profile/refresh/route.js` (uma sessao de debug do scoring que nao foi limpa). Esse arquivo sozinho representa 64% dos log noise de producao.

`console.warn` em `lib/jobs/providers/*` e `lib/concursos/index.js` foram excluidos — sao alertas legitimos de scraping fallback.

---

## 6. TODOs / FIXMEs

Codebase surpreendentemente limpo nesse quesito.

| Arquivo:linha | Texto | Categoria | Prioridade |
|---|---|---|---|
| `components/WelcomeModal.js:20` | `// USO (TODO manual): adicionar <WelcomeModal /> em app/(app)/layout.js` | Acao manual pendente | **P1** — Componente existe mas nao esta integrado ao layout, e dead-code de facto se isso nao acontecer |
| `app/layout.js:8` | `// bloqueia TODOS os scripts inline...` | False positive (TODO = "todos" em portugues) | — |
| `app/api/cv/analyze-bullets/route.js:178` | `"Reescrita proposta mantendo TODO o conteudo factual"` | False positive (prompt em PT) | — |
| `components/PostHogProvider.js:54` | `// ...em TODOS os events subsequentes` | False positive | — |
| `lib/admin-access.js:36` | `"...vao negar TODOS os usuarios"` | False positive (mensagem PT) | — |
| `lib/concursos/index.js:275` | `// Encontra TODOS os blocos` | False positive | — |

**Achado**: o codebase tem 1 (um) TODO real. Disciplina de "limpar TODO antes de mergear" parece consolidada. Recomendacao: manter.

Ha um `TODO(audit-exception 2026-06-26)` em `.github/workflows/ci.yml:54` (npm audit rebaixado de high pra critical — tracker em docs/security/), legitimo e datado, fora do escopo dessa auditoria.

---

## 7. Lint violations top 10

**Estado atual**: `next lint` esta no estado **interativo** ("? How would you like to configure ESLint?"). NAO ha config persistido em `.eslintrc*` nem `eslint.config*`.

```
$ npm run lint
> careertwin-ai@0.3.0 lint
> next lint
? How would you like to configure ESLint?
  Strict (recommended)
  Base
  Cancel
```

**Implicacao**: lint nunca rodou de verdade. CI (`.github/workflows/ci.yml:46-50`) tem `continue-on-error: true` no step "Lint" justamente porque o setup nunca foi finalizado. Nao da pra reportar "top 10 violations" — nao existe linter ativo.

**Recomendacao P0**: rodar `npx next lint` localmente em modo interativo uma vez (escolher Strict), commitar `.eslintrc.json` resultante, ai sim coletar baseline. Tirar `continue-on-error: true` depois que warnings forem zerados.

Issues que apareceriam no baseline (estimativa):
1. `react-hooks/exhaustive-deps` em varios `useEffect` (componentes client grandes)
2. `react/no-unescaped-entities` em paginas com PT (`Lê`, `Você`, etc)
3. `@next/next/no-img-element` se houver `<img>` raw
4. `no-unused-vars` em rotas API (props nao usadas)
5. `react/jsx-key` em maps inline
6. `no-undef` em arquivos que usam `process.env` sem typescript
7. `react/display-name` em forwardRef/lazy
8. `@next/next/no-html-link-for-pages` se houver `<a href="/algo">`
9. `prefer-const` em vars de loop
10. `no-console` (nao default no Next strict, mas seria onde os 14 console.log apareceriam)

---

## Top 5 alavancas

1. **Inicializar ESLint + remover `continue-on-error` no CI** (~30 min setup, baseline pode levar 1 dia)
   - Sem isso, qualquer outro fix nao tem gate. Single biggest leverage.
   - `.github/workflows/ci.yml:48-50` documenta a divida tecnica explicitamente: "Quando estabilizar baseline, remover continue-on-error".

2. **Adotar `lib/logger.js` em rotas + LLM** (~1 dia)
   - 152 `console.error` + 14 `console.log` cru com risco de PII.
   - Logger tem PII sanitization (`PII_KEYS` em `lib/logger.js:14-31`) e Sentry breadcrumb pronto.
   - Comecar pelos console.log de **debug** em `app/api/profile/refresh/route.js` (linhas 255-459) — limpar essas 9 linhas ja muda o cenario.

3. **Extrair handler de `app/api/profile/refresh/route.js` (542 linhas em 1 funcao)** (~2 dias)
   - Espelha `app/api/analyze/route.js:core()` (425 linhas) — mesma arquitetura de auth + rate-limit + parse + score + LLM + snapshot. Refatorar os dois juntos:
     - `lib/scoring/refreshPipeline.js` (orquestracao)
     - `lib/scoring/fallbacks.js` (mover `FALLBACK_EXPL` + `pickExplicacao` duplicados)
     - `lib/api/requireAuth.js` (eliminar 43 copies de session check)

4. **`lib/format.js` + adotar `withApiGuard` em todas rotas** (~1 dia)
   - 30 ocorrencias de formatadores pt-BR ad-hoc -> 1 util.
   - 44/55 rotas sem `withApiGuard` -> retorno HTML em 500 (problema documentado, nao corrigido).
   - Pode ser feito como sweep mecanico.

5. **Quebrar `app/privacidade/page.js` (1192 LOC) e `app/(app)/transparencia/page.js` (953 LOC) em subcomponentes** (~1 dia cada)
   - Paginas SSR puras com JSX inline gigantesco. Risco de regressao baixo se cada secao virar componente puro.
   - Ganho: review-friendly + reuso de seccoes.

---

**Saude geral do codebase**: B-/B. Disciplina alta em TODO/audit-trail (1 unico TODO), arquitetura clara em camadas (`lib/billing`, `lib/scoring`, `lib/jobs`), mas duas debts concretas grandes: lint nunca rodou + duas funcoes monstruosas duplicando logica. Nada catastrofico, tudo enderecavel em sprints curtos.
