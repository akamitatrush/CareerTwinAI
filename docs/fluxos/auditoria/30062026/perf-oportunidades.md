# perf-vercel-next — Investigacao: /oportunidades 20-40s

> Data: 2026-06-30 | Escopo: pipeline end-to-end + custo Vercel
> Status: research-only — NAO altera codigo
> Agente: perf-vercel-next (ex-Vercel DX, ex-Globo SRE, profiling guru)
> Branch: redesign/claude-design | Next.js 14.2.35 | Hospedagem: Vercel
> Fixes ja em HEAD: G2 single-flight (commit 7d20400), G3 fixtures `[]` (b5e7f8b)

---

## 1. Sintoma observado

Memoria do projeto `~/.claude/projects/.../backlog_radar_perf.md` (2026-06-25) reporta:
- "20-40s percebidos" no carregamento do Radar — diagnostico do founder em sessao anterior, sem instrumentacao formal.
- Estimativa do diagnostico original (mantido no doc):
  - `searchJobs`: 5-15s (9 providers paralelos, slowest wins)
  - LLM porques + plano: 10-25s (2 calls Anthropic em paralelo)
  - Total observado: 20-40s end-to-end no `POST /api/opportunities`

**Caveat de honestidade (anti-alucinacao):**
- O numero "20-40s" e P50-P95 percebido pelo founder em sessoes manuais, NAO uma metrica Vercel/Sentry. Nao temos span instrumentado em prod (vide secao 6 — falta SLI proposto).
- Estimativas a seguir sao calibradas com base nos timeouts hardcoded por provider (4-8s), no `TIMEOUT_MS` do LLM (`lib/llm.js:25` → 45s), e no comportamento real de Adzuna free tier (1 RPS, 250 req/mes — `adzuna.js:38-50`).
- Pos-G2 single-flight (7d20400): cache stampede em `/gaps` mitigado, **nao toca /oportunidades isoladamente** porque o Radar so dispara 1 chamada por filter-change (RadarClient.js:32). G2 melhora caso "usuario chega via /gaps -> clica /oportunidades" (warm cache shared).

---

## 2. Inventario do pipeline (com tempos estimados)

### 2.1 Diagrama sequencial

```
Browser                    SSR (page.js)             API /opportunities         lib/jobs            Providers HTTP
   |                            |                          |                       |                     |
   |-- GET /oportunidades ----->|                          |                       |                     |
   |                            |-- auth() ~30ms           |                       |                     |
   |                            |-- Promise.all(           |                       |                     |
   |                            |     profile + snapshot   |                       |                     |
   |                            |   ) ~80ms                |                       |                     |
   |                            |-- render HTML ~50ms      |                       |                     |
   |<-- HTML + JS bundle -------|                          |                       |                     |
   |                                                       |                       |                     |
   | (RadarClient.useEffect)                               |                       |                     |
   |-- POST /api/opportunities --------------------------->|                       |                     |
   |                                                       |-- auth() ~30ms        |                     |
   |                                                       |-- guardLLM (Redis)    |                     |
   |                                                       |   ~50ms               |                     |
   |                                                       |-- enforceUsage        |                     |
   |                                                       |   ($transaction       |                     |
   |                                                       |    Serializable)      |                     |
   |                                                       |   ~120-300ms          |                     |
   |                                                       |-- checkDailyBudget    |                     |
   |                                                       |   (aggregate)         |                     |
   |                                                       |   ~80ms               |                     |
   |                                                       |-- snapshot lookup     |                     |
   |                                                       |   ~50ms               |                     |
   |                                                       |-- searchJobs -------->|                     |
   |                                                       |                       |-- cacheGet (Redis)  |
   |                                                       |                       |   ~30-80ms (miss)   |
   |                                                       |                       |-- Promise.allSettled|
   |                                                       |                       |   (9 providers) --->|
   |                                                       |                       |   slowest wins:     |
   |                                                       |                       |     Gupy: 8-12s     |
   |                                                       |                       |     Adzuna: 1-3s    |
   |                                                       |                       |     +retry relaxRole|
   |                                                       |                       |     duplica !        |
   |                                                       |                       |   = 5-15s TOTAL     |
   |                                                       |<----------------------|                     |
   |                                                       |-- extractSkills + match ~50-200ms             |
   |                                                       |-- completeJSONWithUsage x 1 (porques)         |
   |                                                       |   Sonnet 4.6, sem cache hit                   |
   |                                                       |   = 5-15s                                     |
   |                                                       |   (planoPromise SKIPPED, withPlan=false       |
   |                                                       |    no Radar — vide RadarClient.js:42)        |
   |                                                       |-- trackTokenUsage + budgetCheck ~100ms        |
   |<-- JSON full payload --------------------------------|                                                |
   |
   |-- Render 24 cards
```

### 2.2 Pontos de I/O (com arquivo:linha)

| # | Step | Arquivo:Linha | Tipo | Latencia tipica |
|---|------|---------------|------|-----------------|
| 1 | `auth()` server | `app/(app)/oportunidades/page.js:14` | DB (session) | 20-50ms |
| 2 | `prisma.profile + prisma.scoreSnapshot` (Promise.all) | `page.js:18-25` | DB (2 queries //) | 50-150ms |
| 3 | Bundle JS download + hydrate RadarClient | `RadarClient.js:1` (19 KB source) | Bandwidth+CPU | 100-400ms (cold) |
| 4 | POST `/api/opportunities` — `auth()` | `route.js:28` | DB (session) | 20-50ms |
| 5 | `guardLLM` | `route.js:31` → `rate-limit.js:115` | Redis INCR + EXPIRE + TTL = 3 round-trips | 40-150ms |
| 6 | `enforceUsage` ($transaction Serializable) | `route.js:38` → `enforce.js:175-204` | DB (SELECT + UPSERT em tx) | 120-300ms |
| 7 | `checkDailyBudget` (aggregate) | `route.js:56` → `enforce.js:283-289` | DB SUM | 60-150ms |
| 8 | `prisma.scoreSnapshot` lookup | `route.js:116` | DB | 40-80ms |
| 9 | **`searchJobs`** (cache miss path) | `route.js:147` → `jobs/index.js:102` | 9 providers // + retry | **5-15s** |
| 10 | `extractSkills` x N + `matchScore` | `route.js:151-155` | CPU | 50-200ms |
| 11 | **`completeJSONWithUsage` (porques)** | `route.js:251-265` | LLM Anthropic Sonnet 4.6 | **5-15s** (no Radar so 1 call) |
| 12 | `trackTokenUsage` upsert + `checkDailyBudget` again | `route.js:301-321` | DB | 100-200ms |
| 13 | NextResponse.json — payload ~30-80 KB (24 vagas + porques) | `route.js:378` | Bandwidth | 50-200ms |

### 2.3 Cold-start Vercel (worst case)

`/api/opportunities` declara `runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 60` (`route.js:14-18`).
- Cold start node lambda em Vercel Hobby/Pro: **300-800ms** adicional na 1a invocacao.
- Fluid Compute (Vercel 2025+) reusa instancias e amortiza, mas pode nao estar habilitado no projeto. Worth a verificar no dashboard.
- Imports do route puxam Prisma (~50-150ms init), 9 providers via dynamic `import()` em `activeProviders()` — **mas dynamic import e LAZY**: so paga o custo do provider que tem env var setado. Em prod com 6 providers (Adzuna+Jooble+Greenhouse+Lever+Ashby+Gupy) = 6 `await import()` na 1a chamada = 30-100ms extra cold.

---

## 3. Hipoteses (1-8) — confirmadas / refutadas / incertas

| # | Hipotese | Evidencia (file:line) | Veredicto | Contribuicao estimada |
|---|----------|----------------------|-----------|----------------------|
| 1 | **Fan-out lento (slowest provider wins)** | `lib/jobs/index.js:134-147` usa `Promise.allSettled` sem corrida — espera TODOS. Timeouts: Gupy 8s (`gupy.js:26`), Vagas.com 8s (`vagas-com.js:27`), Greenhouse 8s (`greenhouse.js:5`), Adzuna 6s (`adzuna.js:8`), Jooble 6s (`jooble.js:6`), Lever/Ashby/Workable 4s. | **CONFIRMADO** — pior caso = 8s (1 Gupy/Vagas timeout). Em prod com sucesso parcial = 3-6s. | **5-10s do total** |
| 2 | **relaxRole double-call** multiplica latencia quando 1a chamada traz <5 | `jobs/index.js:138` — `if (!Array.isArray(got) || got.length < 5)` faz 2a chamada por provider. Ate 2x trips por provider quando role nicho. | **CONFIRMADO** — em role nicho (ex: "Engenheiro AgroTech"), CADA provider faz 2x HTTP. Pior caso: Gupy 2x 8s = 16s. | **+3-8s no worst-case** |
| 3 | **LLM call bloqueia retorno** | `route.js:290` — `await Promise.all([porquesPromise, planoPromise])`. No Radar `withPlan=false` (`RadarClient.js:42`) entao planoPromise resolve imediato (`route.js:288`). So `porques` ficam — Sonnet 4.6 com max_tokens 1500. Cache hit possivel (`llm.js:241`) mas ineficaz pra `promptOppReal` que inclui `topForLLM` (5 vagas dinamicas com IDs unicos) → cache key sempre diferente. | **CONFIRMADO** — 1 LLM call de 5-15s, **sem cache reuse pratico** pq key inclui IDs voláteis. | **5-15s do total** |
| 4 | **N+1 em providers (fan-out interno por board)** | `greenhouse.js:72`, `lever.js:130`, `ashby.js:142`, `workable.js:134`, `gupy.js:282`, `workable.js:134` — todos fazem `Promise.allSettled(boards.map(fetchBoard))`. Greenhouse `MAX_BOARDS` nao tem cap! `lever/ashby/workable/gupy` cappam em 20-12. Se prod tem `GREENHOUSE_BOARDS=nubank,ifood,stone,c6,inter,picpay,...` (10+ slugs), faz 10+ HTTP em paralelo. Como cada `fetchBoard` independente tem timeout proprio, slowest define. | **PARCIALMENTE CONFIRMADO** — fan-out interno acontece mas e PARALELO, nao serial. O timeout por board (8s greenhouse, 4s lever/ashby) define o teto. Slowest greenhouse board pode definir os 8s. | **Embedido em #1** |
| 5 | **No streaming** — endpoint manda payload completo no fim | `route.js:378` — `return NextResponse.json({...})` em vez de `ReadableStream`/SSE. `lib/llm-stream.js` existe mas NAO e usado em `/api/opportunities`. RadarClient (`RadarClient.js:32-58`) faz `fetch().then(r => r.json())` — nao consome stream. | **CONFIRMADO** — user ve skeleton ate o ULTIMO byte chegar. UX percebida ≈ tempo backend total. | **UX, nao latencia real** — mas dobra a "dor percebida" |
| 6 | **Cold start Vercel Lambda** | `runtime = "nodejs"` (`route.js:14`) + 6 dynamic imports lazy em `activeProviders` (`jobs/index.js:9-46`) + Prisma. | **PROVAVEL EM HOBBY/sem trafego** — 300-800ms na 1a. Em Fluid Compute (Pro/Enterprise + opt-in) cai pra ~50ms reused. | **+300-800ms cold; 0ms warm** |
| 7 | **Cache hit ratio baixo (TTL ineficiente)** | `lib/jobs/cache.js:24` — TTL 10 min. Key inclui role+location+limit (`jobs/index.js:111`). Como cada user busca seu role-alvo, cache **e por-role**, nao por-user — entao 2 backend devs do mesmo target_role compartilham. Em prod com baixo volume (early-stage), 1o user paga full latencia, 2o ate 10min depois pega cache. Backlog memo (item B) sugere 5min→30min, mas nem foi aplicado. | **CONFIRMADO** — TTL 10min e baixo pra trafego organic baixo. **Sem warmup ou pre-fetch.** | **Multiplicador de cache miss** |
| 8 | **N renders no RadarClient** | `RadarClient.js:26-62` — `useEffect` re-dispara em mudanca de `[seniority, model, minMatch, initial]`. `initial` e prop estavel (vem do server), nao deve mudar. `vagas`, `sources`, `counts` em states separados — cada um causa re-render mas Reactnao re-renderiza JobCard se props nao mudaram (key estavel). Filtros disparam refetch FULL (incluindo LLM!) — desperdicio. | **CONFIRMADO** mas baixo impacto perceptivo — filtros podem ser CLIENT-SIDE (vagas ja vem todas, dava pra filtrar localmente). Cada filter change hoje = 1 round-trip de 10-30s. | **0s em primeira carga; 10-30s por mudanca de filtro** |

---

## 4. Bottleneck hierarchy

Ordem por contribuicao estimada a latencia E2E (warm cache, role coberto):

| Rank | Bottleneck | Arquivo:Linha | Tempo estimado | % do total (de ~25s) |
|------|-----------|---------------|----------------|---------------------|
| **#1** | `completeJSONWithUsage` porques (Sonnet 4.6, sem cache pratico) | `route.js:251`, `llm.js:86-144` | **5-15s** | **40-60%** |
| **#2** | `searchJobs` fan-out + relax double-call | `jobs/index.js:134-147` | **5-12s** | **30-50%** |
| **#3** | `enforceUsage` $transaction Serializable + `checkDailyBudget` (2x) | `route.js:38, 56, 304`, `enforce.js:175-204` | **300-650ms** | 2-3% |
| #4 | DB profile + snapshot SSR | `page.js:18-25`, `route.js:116` | 100-230ms | <1% |
| #5 | Cold start lambda Node | runtime Vercel | 300-800ms (cold), 0 (warm) | 0-3% |
| #6 | Payload JSON (24 vagas, ~50 KB) | `route.js:378` | 50-200ms | <1% |

**Nota chave:** #1 e #2 sao concorrentes na linha do tempo somente parcialmente — searchJobs roda PRIMEIRO (`route.js:147`), depois LLM. Sao **sequenciais** no caminho critico:
- searchJobs (5-12s)
- depois match calc (~100ms)
- depois LLM porques (5-15s)
- = 10-27s minimo

Soma com overheads: **12-30s** observado bate com "20-40s percebidos" do founder.

---

## 5. PRs propostos (priorizado por ROI)

> Convencoes: S = <2h, M = 2-6h, L = 6-12h, XL = >12h.
> Latencia reduzida e estimativa **percebida pelo usuario** (nao necessariamente lambda billable).

| PR# | Fix | Arquivo principal | Esforco | Latencia reduzida (estimada) | Risco | Justificativa |
|-----|-----|-------------------|---------|------------------------------|-------|---------------|
| **A1** | **Two-phase response — fallback deterministico imediato, LLM via SSE/polling** | `app/api/opportunities/route.js` + novo `app/api/opportunities/explain/route.js` | **L** (6-10h) | **-15s percebidos (P50)**: user ve 24 vagas em ~5-8s, porques refinados em mais 5-15s | Medio — refator UI + estado parcial. Risco de race entre fetch + polling. | Maior ROI absoluto. Tira LLM do caminho critico. Memo backlog item (A). |
| **A2** | **Provider tiering — fast tier (Adzuna+Jooble+Greenhouse) sincrono; slow tier (Gupy+Vagas+Lever+Ashby+Workable) via SSE** | `lib/jobs/index.js` (split `activeProviders` em fast/slow) | M (3-5h) | -5-8s no caminho critico | Baixo — backend isolado. | Adzuna+Jooble retornam em 1-3s. Gupy/Vagas pedem 8s mesmo no happy path. Item (C) do memo. |
| **A3** | **Race-with-budget no `Promise.allSettled`** — em vez de esperar TODOS, espera ate ter ≥N resultados OU `RACE_BUDGET_MS=4000` | `lib/jobs/index.js:134` | S (1-2h) | -3-5s (slowest provider deixa de definir o teto) | Baixo-medio — providers lentos viram "tail" sem aparecer no 1o byte. Pode ser combinado com A2 pra encher depois. | Quick win. So muda comportamento do `_runSearch`. |
| **A4** | **Cache TTL 10min → 30min + warm na rota /meu-gemeo apos diagnostico** | `lib/jobs/cache.js:24`, `app/api/analyze/route.js` (post-resposta fire-and-forget) | S (1h) | Cache hit ratio sobe — para 2o+ user com mesmo role, **-10-25s** | Baixo — soh muda TTL e adiciona warmup. | Item (B) do memo. ROI grande pra usuarios recorrentes. |
| **A5** | **Skip relaxRole double-call quando provider ja retornou ≥3** | `lib/jobs/index.js:138` — mudar threshold `<5` → `<3` OU pular se relaxed igual ao role | S (30min) | -2-6s quando relaxed dispara | Baixo. Risco: -1 vaga em algumas buscas. | Quick win medido. Ou: nunca relaxar Gupy/Vagas (sao mais caros). |
| **A6** | **LLM cache key estavel** — separar `promptOppReal` em (perfil-cargo-gaps) + (vagas) e cachear o "porque generico por skill profile" | `lib/prompts.js:110`, `lib/llm-cache.js` | M (3-4h) | -5-10s quando user revisita com mesmo perfil | Medio — perde personalizacao por-vaga. Pode parecer "generico". | Avaliar antes — talvez o LLM nao traga valor real vs `porqueFallback` deterministico. |
| **A7** | **Skeleton UI + counter "X providers respondendo"** (puro client) | `RadarClient.js:172-177` | S (1h) | 0ms backend; -50% latencia percebida via fluencia visual | Zero. | Item (D) do memo. Combinar com A1. |
| **A8** | **Filtros client-side em vez de re-fetch** | `RadarClient.js:26-62` — manter `allVagas` no state e derivar filtrado | S (1-2h) | Mudanca de filtro: -10-30s (era refetch full, vira instantaneo) | Baixo — filtros ja sao simples no backend (senioridade/modelo/minMatch). | Bug oculto: HOJE cada mudanca de filtro consome 1 ticket do `enforceUsage` Free (5/dia)! Confirmar e fixar. |
| **A9** | **maxDuration 60s → 30s + alerta Sentry transaction >20s** | `route.js:18` + Sentry instrumentation | S (1h) | 0 latencia, mas para de cobrar function billable em casos pathologicos | Baixo. | Ja paga `maxDuration=60`; cair pra 30s forca disciplina. |
| **A10** | **Streaming JSON via `transformer/ndjson`** (alternativa a A1 se nao quiser SSE separado) | `route.js:378` — `new Response(stream)` em vez de `NextResponse.json` | M (3-5h) | -5-15s percebidos (1o byte chega cedo) | Medio-alto — RadarClient precisa parser. Edge cases em retry. | A1 com SSE e mais limpo arquiteturalmente. |

### 5.1 Ordem recomendada de wave

1. **Wave A (quick wins, 1 dia):** A3 + A4 + A5 + A7 + A8 + A9 → **-8-15s** sem refator estrutural. **A8 e suspeita-de-bug grave (consome quota)** — confirmar.
2. **Wave B (refactor, 1-2 dias):** A1 + A2 → **-15-25s percebidos**.
3. **Wave C (opcional):** A6 se metricas mostrarem LLM cache miss pesado.

---

## 6. SLO / SLI proposto

### 6.1 Indicadores (SLIs)

| Metrica | O que mede | Como capturar | Onde olhar |
|---------|------------|---------------|------------|
| `opp.e2e.p95` | Latencia E2E do POST `/api/opportunities` | Vercel Speed Insights (transacao API) ou Sentry custom transaction em `route.js:27` | Sentry Performance |
| `opp.searchJobs.p95` | Tempo da fase 1 (busca) | `console.time/timeEnd` em `route.js:147`; log estruturado JSON | Vercel logs → Datadog/Loki |
| `opp.llm.p95` | Tempo do LLM porques | Ja logado em `llm.js:194-205` (`evt: "llm.usage"`) — agregar por `route="opp.real"` | Mesmo JSON log |
| `opp.cache.hit_ratio` | `jobs:v2:*` cache hit / total | Adicionar log em `lib/jobs/cache.js:cacheGet` (hit/miss + key prefix) | Custom dashboard |
| `opp.provider.timeout_rate` | % de providers que timeout (ex: Gupy 8s abort) | Log em `Promise.allSettled` results (`jobs/index.js:148-156`) com status | Custom |
| `opp.lambda.duration.billable` | Active CPU billable | Vercel Functions tab → Active CPU duration p50/p95 | Vercel dashboard |

### 6.2 SLOs

| SLO | Alvo | Notas |
|-----|------|-------|
| Latencia E2E P50 | **<5s** | Pos Wave A. Wave B baixa pra <2s percebido (1o byte). |
| Latencia E2E P95 | **<15s** | Pos Wave A+B. Hoje provavelmente 25-35s. |
| Cache hit ratio | >40% | Pos A4 (TTL 30min + warm em /meu-gemeo). |
| Provider timeout rate | <5% por provider | Pos A2 (slow tier movido pra async). |
| Lambda P95 duration | <8s | Reduz custo Active CPU em ~3-5x. |

### 6.3 Alertas

- **Sentry transaction** com tag `route=/api/opportunities` — alertar se P95 > 20s em janela de 15min.
- **Vercel** — alerta "function timeout" (60s) >= 1% das invocacoes nas ultimas 24h.
- **Custom log** — alertar se `opp.cache.hit_ratio` < 20% por 1h (sinal de warm-up quebrado ou TTL muito curto).

---

## 7. Custo Vercel (estimativas)

> Numeros sao **estimativas calibradas** (Vercel pricing 2025: Active CPU $0.18/h, Function invocations 1M free Hobby; Function Memory default 1024 MB). Nao ha medicao real — confirmar com dashboard.

### 7.1 Cenario atual (estimado)

Assumindo:
- 1000 invocacoes /api/opportunities/mes (early stage)
- Duracao P50 = 15s, P95 = 35s, media ponderada ~18s
- Memory = 1024 MB

| Item | Calculo | Custo/mes |
|------|---------|-----------|
| Active CPU billable | 1000 invs * 18s avg = 18000s = 5h * $0.18 | **$0.90** |
| Function invocations | 1000 (longe do 1M free) | $0 |
| LLM Anthropic (Sonnet 4.6 in:$3/1M, out:$15/1M) | ~2000 tokens in + 800 out * 1000 invs | **$8.40** |
| **Total** | | **~$9.30/mes** |

Em escala (10000 invocacoes/mes):
- Active CPU: ~$9
- LLM: ~$84
- **Total: ~$93/mes**

### 7.2 Cenario pos-fix Wave A (estimado)

- Duracao media: 18s → **8s** (relax double-call cortado + cache hit 40%)
- LLM tokens iguais (mesmo modelo, mesma estrutura)

| Item | Custo/mes (1k invs) | Custo/mes (10k invs) |
|------|---------------------|----------------------|
| Active CPU | $0.40 (-55%) | $4 |
| LLM | $5 (-40% via A4 cache, mesmo tokens mas 40% miss) | $50 |
| **Total** | **~$5.40** | **~$54** |

### 7.3 Cenario pos-fix Wave A+B (two-phase)

- E2E P50: 5s (page paint) + 10s (LLM stream) = mesmos 15s billable
- MAS lambda principal so cobra 5s; LLM fica em rota separada que pode ate ir pra edge runtime
- UX percebida MUITO melhor — mesmo se custo Vercel quase igual

ROI principal nao e custo Vercel direto — e **retencao (user nao abandona em 8s de skeleton)** e **menor custo LLM via A4 cache** ($50→$30/mes em escala 10k).

---

## 8. Riscos residuais (post-fix)

1. **LLM upstream lento (Anthropic)** — fora do nosso controle. A1 mitiga via fallback deterministico.
2. **Adzuna free tier 250 req/mes** — em escala, Adzuna esgota. Provider tiering (A2) ja prioriza, mas eventually precisa upgrade ou caching agressivo.
3. **G2 single-flight e per-instance** — em Fluid Compute reusa, mas multi-instance Hobby pode ter Map separado. Pos-G2 esta OK pra /gaps stampede; /oportunidades tem 1 chamada por usuario entao single-flight nao adiciona valor aqui.
4. **A8 (filtros client-side)** — confirmar antes se filtros HOJE consomem ticket Free. Se sim, e regressao de quota silenciosa.
5. **Snapshot stale** — `dynamic = "force-dynamic"` em `page.js:10` impede cache de RSC. Defensavel (cada user ve seu snapshot), mas pesado. Cache Components (`"use cache"` + `cacheTag(userId)`) poderia ajudar no Next 16 — fora do escopo desta wave.

---

## 9. O que NAO foi medido (gaps de evidencia)

Honestidade: o seguinte foi ESTIMADO, nao MEDIDO. Pre-requisito de qualquer wave fix:

- **Span real de uma request P95** em prod (Sentry transaction ou Datadog APM). Sem isso, todos os numeros acima sao calibracao por inspecao de timeout, nao deads.
- **Cache hit ratio real** de `jobs:v2:*` em Redis. Pode estar muito mais alto ou baixo que assumido.
- **Tail dos providers** — qual provider EM PROD esta dando timeout? `gupy` e suspeito #1 por design, mas Adzuna 429 (rate limit) tambem.
- **LLM latency P95 by route** — `lib/llm.js:122-126` ja loga `slow response >20s`. Conferir se existem warnings em prod.
- **Distribuicao de roles dos users** — se 80% dos users tem role "Backend Pleno" comum, cache hit/warm vale muito. Se cada user tem role unico, A4 ROI cai.

**Pre-wave-fix recommendation:** rodar 1 dia com instrumentation Sentry/log adicional em `route.js` (timing entre cada step), coletar P95/P99 reais, ai priorizar.

---

## 10. TL;DR

- **Caminho critico hoje:** `searchJobs` (~8s) + `LLM porques` (~10s) sao SEQUENCIAIS → 18-25s + overheads. Bate com "20-40s percebidos".
- **Maior ROI:** **A1 (two-phase response)** + **A8 (filtros client-side)** + **A4 (cache TTL + warmup)**.
- **Quick wins (1 dia):** A3+A5+A7+A9 cortam 5-10s sem refator. **A8 pode estar consumindo quota Free indevidamente — investigar.**
- **Antes do fix:** instrumentar (Sentry transaction + log estruturado de cada step). Sem dado, fix vai no escuro.
- **SLO alvo pos-wave:** E2E P95 <15s (today provavelmente >25s).

---

**Anti-alucinacao recap:**
- Todos os tempos de provider sao do TIMEOUT hardcoded (`adzuna.js:8` etc), nao de medicao real.
- LLM 5-15s vem do `TIMEOUT_MS = 45_000` em `lib/llm.js:25` + warning threshold em `llm.js:122` (>20s). P95 real pode ser maior ou menor.
- "Backend AlphaTech BR" sem dados de uso esta no early-stage — assumi 1k-10k req/mes. Real pode ser 10x maior ou 10x menor.
- **NAO afirma um provider especifico e o lento** — Gupy e Vagas tem 8s timeout (maior), mas em prod o que tipicamente domina pode ser Adzuna 429 ou greenhouse board especifico. Precisa log.
