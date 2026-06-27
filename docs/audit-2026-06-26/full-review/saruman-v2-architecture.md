# Saruman v2 — Architecture review (2026-06-26)

Escopo: arquitetura do app pós-redesign (route groups, server/client boundaries,
cache, RAG, LLM, cron, middleware, modularidade, acoplamento Prisma→UI).
**RESEARCH-ONLY** — zero arquivos modificados fora deste documento. Não duplica
findings de Saruman v1 (`docs/security/architecture-review-2026-06-25.md`).

---

## TL;DR

- **Critical: 1** | **High: 4** | **Medium: 6** | **Low: 3**
- Aprendizados-chave:
  1. **Landing é 100% "use client" em conteúdo estático.** `app/(landing)/page.js`
     (61 linhas) renderiza 12 componentes em `components/site/` — **todos** marcados
     `"use client"` (3.191 linhas), incluindo `SiteFeatures` (353 ln), `SiteFaq`
     (202 ln), `SitePricing` (353 ln), `SiteSocialProof` (261 ln). 90% disso é
     prosa estática + ilustração — não precisa de React no cliente. Maior alavanca
     do redesign: server-render essas seções, isolar só os blocos com animação
     (Hero/Marquee) em filho client. JS shippado pra landing cai ~70%.
  2. **`force-dynamic` em CASCATA contamina toda a árvore.** Root layout, `(landing)`
     e `(app)` declaram `dynamic = "force-dynamic"` (`app/layout.js:10`,
     `app/(landing)/layout.js:12`, `app/(app)/layout.js:8`), e cada page `(app)/*`
     re-declara (18 ocorrências). Razão: CSP nonce + middleware (`middleware.js:53`,
     comentário em `app/layout.js:5-10`). Mas o nonce **nem é gerado** — middleware
     usa `'unsafe-inline'` (comentário em `middleware.js:8-21` admite). Resultado:
     **zero páginas estáticas** sem benefício de segurança correspondente. Maior
     impacto silencioso em performance/custo da plataforma.
  3. **RAG hybrid retrieval bem-arquitetado mas o ingest é manual.** `retrieval.js`
     tem fallback em 4 camadas (vector → keyword → JSON in-memory), RRF fusion
     padrão indústria, lazy import de Prisma. Mas `KnowledgeChunk` só é populado
     por `scripts/ingest-knowledge.mjs` rodado à mão. Sem CI hook, sem cron de
     reindex, sem detecção de drift do `contentHash` — `career-best-practices.json`
     vive em `lib/knowledge/` (versionado) E em pgvector (não-versionado). Risco:
     conhecimento curado novo só entra na busca semântica via deploy + comando
     manual.
  4. **Duplicação `analyze` ⇄ `profile/refresh` se aprofundou.** Saruman v1 já
     apontou. Pós-redesign continuam 568 + 608 = 1.176 linhas em paralelo, mesmo
     prompt (`promptDiag`), mesmo `Promise.allSettled` (LLM + searchJobs), mesmo
     `subScores` + persistência de snapshot. Cada novo guard rail (token tracking,
     budget, audit) entrou em **dois lugares**. Extrair `lib/analysis/runDiagnosis()`
     é a refatoração de maior payoff arquitetural.
  5. **Boundaries `lib/` → `app/` são limpos** (zero imports `@/app` em `lib/`),
     mas **`app/(app)/*/page.js` faz queries Prisma direto** em 10+ páginas
     (`dashboard`, `gaps`, `oportunidades`, `plano`, `conta`, `transparencia` etc).
     `prisma.scoreSnapshot.findFirst({ userId, include: { gaps } })` se repete em
     5 arquivos (Saruman v1 §Medium-N+1 já citou; ainda não foi feito).

---

## Avaliação por dimensão

### 1. Route groups e layout strategy

- **Estado:** boa separação topológica em 3 grupos — `(landing)` (rota `/`),
  `(app)` (auth-gated SPA-ish), `app/api/*` (route handlers). Layouts especializados:
  root (`app/layout.js`) carrega fonts + theme + PostHog; `(landing)/layout.js`
  monta `SiteNav` + `SiteFooter`; `(app)/layout.js` faz `auth()` + busca Profile
  + `<AppShell>`. Rotas legacy `/site` → `/` mapeadas em `next.config.mjs:21-25`.
- **Problemas:**
  - `app/layout.js:10` e `app/(landing)/layout.js:12` declaram **ambos**
    `dynamic = "force-dynamic"` — duplicação não-necessária. Quando uma página
    `(landing)/page.js` herda do root, já é dynamic; re-declarar no grupo apenas
    documenta a decisão mas não faz nada. Manter no root, remover dos grupos +
    pages individuais reduz ruído visual em 19+ arquivos.
  - `app/(app)/layout.js:11-26` faz `prisma.profile.findUnique({ select: { nome, targetRole } })`
    em **toda** request a qualquer rota do grupo. AppShell já tem fallback se
    `profile` é null — mas o roundtrip Prisma roda mesmo em pages que não usam
    `user.targetRole` no shell (todas usam só para o sidebar). É uma query a
    mais em **18 rotas** por sessão. Aceitável, mas note que com Cache Components
    (Next 16) esse `findUnique` poderia entrar em `cache()` com tag `profile:${userId}`.
  - Pages fora de groups que **deveriam** estar em `(app)`: `app/meus-dados/page.js`
    (logged), `app/admin/page.js` (logged + owner), `app/meu-gemeo/page.js`,
    `app/experimentar/page.js`. Hoje cada uma duplica seu próprio `auth()` +
    redirect. Mover pra `(app)` herda gate do layout — menos código, menos drift.
  - `app/(landing)/page.js` (61 linhas) só compõe 12 sections. Toda a lógica está
    em `components/site/` — não há benefício de groupping se só uma rota mora aqui.
    Não-bug, mas convenção subutilizada: criar `(landing)/precos`, `(landing)/sobre`
    aproveitaria o grouping pra navegação interna.
- **Recomendações:**
  1. Centralizar `force-dynamic` no root. Remover dos grupos e das 18 pages.
  2. Mover `/admin`, `/meus-dados`, `/meu-gemeo`, `/experimentar` para `(app)`
     (com checks adicionais nas pages que precisam — admin já tem isOwnerEmail).
  3. Quando migrar para Next 16 Cache Components, `(app)/layout.js` vira o ponto
     natural para `cache()` de Profile com tag `profile:${userId}`.

---

### 2. Server vs Client Components

- **Estado:** 40 arquivos com `"use client"` no total. Em `components/`: AppShell,
  CopilotWidget, NotificationsBell e modais — uso justificado (interatividade,
  estado). Em `app/(app)/*`: cada page tem um sub-componente client por bloco
  interativo (CvAnalyzer, KanbanClient, FunnelForm). Padrão "page server + ilha
  client" aplicado consistentemente nas pages do app.
- **Problemas:**
  - **`components/AppShell.js:1` está `"use client"` e envolve TODO o conteúdo
    do grupo `(app)`.** AppShell precisa de client (`usePathname`, `useState`
    pra mobile breakpoint, `useEffect`). Mas isso converte cada page server child
    em um descendant de um boundary client — o que **funciona** porque Next
    propaga server components como children, MAS o footer/CopilotWidget vão
    junto. CopilotWidget (`components/CopilotWidget.js:1`) é `"use client"`
    pesado (chat, stream). Carregado em TODA tela `(app)`. Lazy load via dynamic
    import + `ssr:false` economiza bytes na primeira pintura.
  - **Toda a landing é client.** `components/site/SiteHero.js` (606 ln),
    `SiteFeatures.js` (353 ln), `SiteFaq.js` (202 ln), `SitePricing.js` (353 ln),
    `SiteSocialProof.js` (261 ln), `SiteHowItWorks.js` (235 ln) — todos `"use client"`.
    Justificativa em `SiteHero.js:8-14`: animações, IntersectionObserver,
    prefers-reduced-motion. **Válido para Hero.** Mas Features, FAQ, Pricing
    têm apenas CSS-based animations no Wave 6+ (não verifiquei se ainda usam
    JS pesado). Conteúdo majoritariamente estático em prosa. Conversão para
    server component em 4 das 12 cortaria ~1.000 linhas do bundle client da
    landing.
  - `components/site/SiteCursorGlow.js:1` (90 ln, `"use client"`) é puro efeito
    de cursor — quando user prefere reduzed motion, esse JS é morto-carregado.
    OK como custo, mas vale o `dynamic({ ssr:false })` defensivo.
- **Recomendações:**
  1. Auditar cada `SiteX.js` perguntando: "esse componente PRECISA de hook React?".
     Suspeitos: `SiteFeatures`, `SiteFaq`, `SiteSocialProof`, `SiteHowItWorks`,
     `SiteTrustBar`. Mover pra server, deixar apenas Hero/CursorGlow/Marquee/Metrics
     com client (animação JS-dependent).
  2. `CopilotWidget` em `next/dynamic` no AppShell — não precisa rodar na primeira
     pintura.

---

### 3. Data fetching e cache

- **Estado:** padrão dominante é **page server component faz Prisma direto** +
  Server Action inline pra mutações + client fetch via SSE pra LLM streams. Uso
  de `revalidatePath` aparece 4x (`dashboard/page.js:33`, `conta/page.js:80,112,143`).
  Zero usage de `unstable_cache`, `cache()` (React), `revalidateTag`. LLM tem
  cache próprio (`lib/llm-cache.js` Redis/in-mem 1h) — ortogonal ao Next cache.
  RAG tem 4-camada fallback (`lib/knowledge/retrieval.js`).
- **Problemas:**
  - **Cache do Next desligado por completo via `force-dynamic` global.** Mesmo
    consultas idempotentes como `getRealMedian()` (comentário em
    `dashboard/page.js:54` diz que tem "cache em memória 1h") sofrem porque
    a página não pode ser parcialmente prerendered. Sem PPR, qualquer N1 do
    page render bate no DB toda visita.
  - **`scoreSnapshot.findFirst({ where: { userId }, include: { gaps } })` em
    5 páginas:** `oportunidades:19`, `transparencia:36`, `gaps:31`, `conta:208`,
    e `dashboard:56` faz `findMany`. Saruman v1 sugeriu `lib/queries/snapshot.js`
    com `getLatestSnapshotWithGaps(userId)` — não implementado. Sem isso:
    indexes/include drift entre páginas conforme cada uma precisa de campos
    diferentes.
  - **`revalidatePath("/conta")` chamado 3x na mesma page** (`conta/page.js:80,112,143`),
    uma por server action. Funciona, mas dispara invalidação tripla se uma transação
    encadeia (ex: salvar perfil + privacidade no mesmo POST). Em prática hoje
    são actions separadas — OK. Quando consolidar `/conta` em subrotas, vira
    `revalidateTag("conta:${userId}")`.
  - **Server Actions inline em pages grandes.** `conta/page.js` (653 ln) tem
    4 server actions; `dashboard/page.js` tem 1 (`dismissWelcomeAction`). Move
    para `app/(app)/conta/actions.js` e `app/(app)/dashboard/actions.js`
    libera type-check independente e reduz a página pro que importa: render.
  - **Sem `revalidateTag` em lugar nenhum.** Quando uma mutação afeta múltiplas
    pages (ex: refresh diagnosis afeta `/dashboard`, `/gaps`, `/oportunidades`,
    `/transparencia`), hoje só `/dashboard` revalida e o resto faz fresh DB
    on next visit. Funcional por causa do `force-dynamic`, mas semanticamente
    instável: quando ligarem cache, vão precisar reescrever tudo isso com tags.
- **Recomendações:**
  1. Criar `lib/queries/snapshot.js` com `getLatestSnapshotWithGaps(userId)` —
     atende já 5 pages, vira ponto único para futuro `cache()` ou `unstable_cache`.
  2. Extrair server actions para `actions.js` adjacente.
  3. Quando remover `force-dynamic`, adotar tagging consistente: `user:${id}`,
     `snapshot:${id}`, `profile:${userId}` em todo getter de lib/queries.

---

### 4. Caching strategy (LLM + RAG + Redis)

- **Estado:** stack de cache em 3 camadas independentes:
  - `lib/llm-cache.js`: SHA-256(model|system|user), TTL 1h, Redis (Upstash)
    em prod / Map em dev. Opt-out via `meta.cache = false`. Aplicado em
    rotas idempotentes; pulado em analyze, refresh, chat, tailor, interview
    (todos têm `cache: false` documentado).
  - `lib/rate-limit.js`: token bucket via INCR Redis, fallback Map (~`rate-limit.js:35-50`).
  - `lib/auth.js`: bucket próprio (não compartilha com `lib/rate-limit.js` para
    evitar import cycle).
- **Problemas:**
  - **3 clientes Redis separados.** `llm-cache.js`, `rate-limit.js`, `auth.js`
    cada um instancia `new Redis(...)` com lazy singleton próprio. Acoplamento
    fraco (bom), mas: configuração triplicada, 3 conexões warm/cold, comportamento
    sob falha divergente (cada um logga e cai pro mem com mensagem diferente).
    Extrair `lib/redis.js#getRedis()` consolidaria — mantém isolamento de chaves
    via namespace (`llm:`, `rl:`, `auth-rl:`) que já existe.
  - **Cache do LLM é SHA-256 de plaintext.** `lib/llm-cache.js:50-52` hashes
    `${model}|${system}|${user}`. Como key é hash, sem leak. Como **value**, é
    `parsed` (JSON da LLM) — pode conter conteúdo do prompt (em rotas idempotentes
    como `linkedin/parse` o output reflete input do usuário). Em Redis Upstash
    isso fica até 1h cifrado-em-trânsito mas em-claro at-rest no Upstash side.
    Para LGPD, importante registrar que `cache: false` em todas as rotas user-PII
    (já é o caso para analyze/refresh/tailor/chat). **Auditar** que rotas
    idempotentes cacheadas (`linkedin/parse`, `portfolio/import`) não estão
    cacheando texto pessoal do CV. Spot-check: `linkedin/parse` cacheia output
    com nome+experiência. Risco LGPD não-crítico mas vale documentar.
  - **Sem invalidação de cache LLM por versão de prompt.** `lib/prompts.js`
    muda → cache hit retorna resposta da versão antiga até expirar (1h).
    Pra parsers (linkedin/portfolio) baixo impacto. Pra opportunities
    (cacheado) potencialmente notável. Mitigação: incluir `prompts.js`
    commit hash no cache key, ou bump `model` env var.
  - **In-memory fallback `MAX_MEM_ENTRIES = 500`.** Em serverless Vercel, cada
    lambda tem o seu — em prod sem Redis, cache é ~0% hit rate. Documentado
    em `llm-cache.js:39-41` mas vale alarme nas envs.
- **Recomendações:**
  1. Consolidar Redis client em `lib/redis.js`.
  2. Incluir hash de `lib/prompts.js` no LLM cache key, ou bump model env.
  3. Documentar política de cache vs PII em `/transparencia` para LGPD.

---

### 5. RAG pipeline (KnowledgeChunk + embeddings)

- **Estado:** bem-arquitetado para complexidade do problema. `lib/embeddings.js`
  faz Voyage (default) → OpenAI (fallback), com retry+timeout+truncation pra
  1024 dim. `lib/knowledge/retrieval.js` faz hybrid RRF (vector + keyword) com
  fallback em 4 camadas: sem embedding provider → keyword puro; sem DB →
  keyword in-memory; vector vazio → keyword puro; tudo OK → RRF fusion.
  Lazy import de Prisma evita custo em build/test (`retrieval.js:75-85`).
  Schema `KnowledgeChunk` (`schema.prisma:378+`) tem `contentHash @unique`
  pra idempotência, `@@index([topic])` pra filtro.
- **Problemas:**
  - **Pipeline de ingest é manual.** `scripts/ingest-knowledge.mjs` lê
    `lib/knowledge/career-best-practices.json` e UPSERTa via `contentHash`.
    Único trigger conhecido: `npm run ingest:knowledge` à mão (`package.json:15`).
    Sem cron, sem hook de CI, sem post-deploy script. Sem detecção de chunks
    em DB que sumiram do JSON (orfãos). Drift garantido conforme adicionarem
    chunks em PR.
  - **Knowledge base mora em 2 lugares:** `lib/knowledge/career-best-practices.json`
    (versionado) **+** tabela `KnowledgeChunk` (não-versionado). `retrieval.js:21`
    já importa o JSON pra fallback keyword. Acoplamento sutil: se um chunk
    em DB foi removido do JSON, ele ainda aparece em vector retrieval mas não
    no keyword fallback. Decisão arquitetural pendente: DB é "source of truth"
    ou "espelho indexado"?
  - **Sem evaluation pipeline integrado ao CI.** `package.json:16-17` tem
    `eval:rag` mas não roda em pipeline. Quando trocarem o modelo de embedding
    (Voyage → outro) ou os chunks, não há sinal automático de regressão de
    recall.
  - **`retrieveKnowledge` é async + chamado em `promptDiag` que é async** —
    a cascata adiciona ~200-500ms (embedding API + DB query) **em série
    antes** do LLM principal. `analyze/route.js:166-170` paraleliza LLM com
    searchJobs, mas o **prompt** já espera o embedding antes. Possível alavanca:
    pre-computar embedding do `role` em paralelo com job search; passar pro
    `promptDiag(role, cv, ctxBlock)`. Eco curto.
  - **Sem cache de embeddings de query.** Cada visita a `/api/analyze` com mesmo
    role chama Voyage de novo. Adicionar `embedQuery` em `llm-cache` (hash de
    query → vector) corta latência em ~200-300ms quando idempotente.
  - **`vector` extension não documentada no schema** (`KnowledgeChunk` tem
    `embedding` Unsupported type implícito no comentário de `retrieval.js`).
    Migration pendente verificável só pelo `try/catch` em runtime (`retrieval.js:124`).
- **Recomendações:**
  1. Cron semanal `cron/reindex-knowledge` que roda o ingest com `--check-orphans`
     (deletar IDs em DB sem contrapartida no JSON).
  2. Cache de embedding de query (1h, mesma camada de `llm-cache.js`).
  3. Pre-warm: ingest entra como step do `npm run build` se a flag
     `INGEST_ON_BUILD=1` (opcional pra envs de preview).
  4. `eval:rag` em GH Actions com threshold mínimo de recall.

---

### 6. LLM call patterns

- **Estado:** abstração madura. `lib/llm.js` (300 ln) tem `completeJSONWithUsage`
  + `completeJSONFast` (Haiku) + `_internal` exposto pra teste. `lib/llm-stream.js`
  (280 ln) tem `streamLLM` pra SSE. PRICES table + computeCost embedados. Retry
  em 429/5xx (2 tentativas). Timeout 45s. AbortController. Logger estruturado
  JSON-line. Budget enforcement (`enforceUsage` + `checkDailyBudget`) em
  todas rotas críticas (analyze, opportunities, tailor, chat, refresh).
- **Problemas:**
  - **Modelo escolhido por env, não por contexto.** Mesmo `STANDARD_MODEL`
    pra analyze (qualidade crítica) e tailor (qualidade média) e chat (uma
    pergunta curta). Algumas rotas usam `completeJSONFast` (Haiku) deliberadamente
    (`linkedin/parse`, `portfolio/import`, `cv/analyze-bullets`, `interview`).
    OK no MVP, mas falta um pequeno helper `pickModel({ task })` que mapeie
    contexto → modelo (ex: `tailor` poderia usar Haiku quando o CV é curto e
    Sonnet quando longo). Sem isso, single env var muda tudo de uma vez.
  - **`streamLLM` sem retry (intencional, `lib/llm-stream.js:14`) mas sem fallback
    pra non-stream também.** Se Anthropic SSE falha mid-stream, chat exibe erro.
    Aceitável; vale documentar.
  - **PRICES table duplicada** em `llm.js:69` E `llm-stream.js:26-30` (Saruman
    v1 já apontou; ainda não foi feito). Comentário admite "Manter sincronizado".
    Extrair `lib/llm/pricing.js`.
  - **`TIMEOUT_MS` é 45s em `llm.js:25` e 60s em `llm-stream.js:23`.** Justificativa
    em comentário (streaming pode demorar mais). OK. Mas em `app/api/opportunities/route.js:18`
    `maxDuration = 60` cobre **2 chamadas** LLM em série/paralelo. Se uma
    chamada cabe em 45s, duas paralelas em até 45s + overhead — apertado.
    Em cold-start + slow provider já é razão de timeout silencioso. Vale subir
    `maxDuration = 90` em `opportunities` ou separar em duas rotas.
  - **Cache key NÃO inclui `history` em `streamLLM`.** Chat com `history` mutável
    nunca bate cache (`llm-cache.js:7`). OK em chat. Mas se algum dia adicionarem
    cache pra chat opcional, é detalhe a lembrar.
  - **Erro no LLM tem snippet de 240 chars** (`llm.js:106`). Aceita-se que
    Anthropic raramente vaza, mas mensagem do provider em produção pode conter
    request payload ecoado em alguns erros (validação). 160 chars seria mais
    apertado.
- **Recomendações:**
  1. Extrair `lib/llm/pricing.js` — referência única para `PRICES` + `computeCost`.
  2. `maxDuration = 90` em `/api/opportunities` (faz 2 LLM em parallel) e
     `/api/analyze` (LLM + searchJobs paralelo já leva 15-20s no p95).
  3. `pickModel({ task, sizeHint })` em `lib/llm/select.js` — desacopla escolha
     de modelo da env var global.

---

### 7. Background jobs / crons

- **Estado:** 6 crons configurados em `vercel.json` (digest, daily-briefing,
  usage-cleanup, redact-cv, outcome-survey, redact-billing). Schedule
  realistic (sem overlap, BRT-aligned). Auth unificada via
  `verifyCronAuth` (`lib/cron-auth.js`) — aceita Vercel Bearer + legado
  `x-cron-secret`, constant-time compare. Cada cron tem `maxDuration` adequado
  (daily-briefing = 300 = Pro plan; outros default). Idempotência aproximada
  via timestamp guards (`lastDailyBriefingAt` debounce 18h em daily-briefing;
  `lastDigestAt` 7d em digest; `rawCvRedactedAt` already-set em redact-cv).
- **Problemas:**
  - **`digest` e `daily-briefing` competem pela mesma quota Resend free
    (100/dia).** Comentário em daily-briefing:32-35 reconhece e reserva 30 pra
    digest. Mas a reserva é por convenção — não há um broker que conte uso real
    pré-envio. Em scaling acima de 200 users, digest semanal monday pode
    consumir os 100 do dia inteiro, e daily-briefing falha silenciosamente até
    quarta. Sem dashboard único de consumo de email.
  - **Sem retry on fail por user.** `digest/route.js:140-150` usa
    `Promise.allSettled` para isolar falhas. User que falha **uma** vez tem que
    esperar `lastDigestAt`/`lastDailyBriefingAt` expirar pra reentrar — ou seja,
    7 dias pra digest, 18h pra daily. Para falhas transientes (Resend rate-limit,
    timeout LLM) isso é perda de UX silenciosa. Add: queue de retry com TTL 24h
    (LRU no Redis) que cron consulta no início do run.
  - **Observabilidade fraca em crons.** Returns `{ ok: true, sent, skipped, failed,
    errors: errors.slice(0, 10) }`. Vercel mostra status + body por execução,
    mas sem agregação histórica. PostHog não recebe esses eventos. Adicionar
    `posthog.capture('cron.completed', { name, sent, failed })` em `register`
    de `instrumentation.js` ou no fim de cada handler unifica observabilidade.
  - **`outcome-survey` (262 ln) e `daily-briefing` (326 ln) são grandes**, com
    LLM + email + audit + notify inline. Padrão de "cron handler = orquestrador
    de subprocessos por user". Aceitável; refatoração possível: `lib/cron/runForUser.js`
    com `(user) => { eligibility; build; send; mark }` + handler só itera e
    aggreda counts. Mas baixa prioridade.
  - **`redact-cv` lock no Profile** (`redact-cv:73` take=500). Em uma base com
    >500 perfis com TTL expirado num mesmo dia (improvável agora; possível em
    1-2 anos), o cron processa só os 500 primeiros — os outros esperam o próximo
    dia. Sem `ORDER BY rawCvExpiresAt ASC`, alguns ficam meses sem redact.
    LGPD risk. Adicionar `orderBy` consciente.
  - **`runtime = "nodejs"` em todos os crons** (justo por Prisma), mas o
    `redact-billing` (62 ln, sem LLM, sem email) cabe em edge — economia
    marginal porém real em cold start.
- **Recomendações:**
  1. `orderBy: { rawCvExpiresAt: "asc" }` em `redact-cv` (FIFO LGPD compliance).
  2. Cron `email-quota-monitor` que persiste em PostHog/Sentry e alerta quando
     atingir 80% da quota Resend free.
  3. Retry queue (Redis LRU TTL 24h) consultado no início de cada cron.

---

### 8. Middleware

- **Estado:** `middleware.js` (107 ln) faz 3 coisas: (1) whitelist absoluta
  pra rotas LLM `NEVER_BLOCK_PREFIXES`, (2) check `isProtected(pathname)` →
  delega ao Auth.js (`authConfig` edge-safe), (3) injeta CSP estático
  (sem nonce — admitido em comentário). Matcher exclui `_next/static`,
  `_next/image`, `favicon.ico`, `api/auth`.
- **Problemas:**
  - **Middleware roda em CADA request** (matcher amplo), faz N comparações de
    prefix em `isNeverBlocked` + `isProtected`. Cada uma é
    `Array.some(p => pathname.startsWith(p))` — O(n) em duas listas. Hoje
    n_blocked=8 e n_protected≈24 — 32 comparações por request × tráfego.
    Negligível, mas escalonável: ordenar por prefixo mais comum primeiro (=
    most-visited routes), ou trocar pra Map por prefix-of-path. Antecipar
    Trie em escala futura.
  - **CSP estática duplicada** entre `middleware.js:33-50` e `next.config.mjs`
    (headers). Comentário em next.config:1-3 diz "CSP fica no middleware".
    Documentação coerente. Não-bug.
  - **`'unsafe-inline'` permanente em script-src.** Documentado em
    `middleware.js:8-20` que tentativa de nonce + strict-dynamic não funcionou.
    Quando migrarem para Next 16 com Cache Components estáveis, o **nonce
    propaga corretamente pelos chunks _next/static** — re-tentar é uma
    alavanca de segurança real (mas fora do escopo arquitetural — Sauron).
  - **`api/auth` excluído do matcher** evita CSP nas redirects do NextAuth. OK,
    mas `/api/auth/welcome-sent` (custom em `app/api/auth/welcome-sent/route.js`)
    fica fora do CSP. Hoje retorna JSON, sem risk. Documentar como decisão.
  - **`NEVER_BLOCK_PREFIXES` é defensive twice** (comentário em
    `middleware.js:65-69`) — `isProtected` já exclui essas rotas. Manter
    pra robustez, OK.
- **Recomendações:**
  1. Ordenar prefix lists do mais para o menos provável (analytics: PostHog
     mostra `/dashboard` como mais visitado em users logados).
  2. Documentar que `/api/auth/*` fica sem CSP.

---

### 9. Boundaries entre módulos

- **Estado:** **excelente.** `lib/` é puro (zero imports `@/app` ou `@/components`).
  Subpastas de `lib/` (`billing/`, `jobs/`, `knowledge/`, `assessments/`,
  `concursos/`, `email/`, `scoring/`, `estagios/`, `analytics/`, `metrics/`)
  são domínios coesos. `components/` importa de `@/lib` (esperado). `app/`
  importa tudo (esperado). Nenhum ciclo detectado.
- **Problemas:**
  - **`auth.js` referência `Auth.js v5 dev hack` em `lib/auth.js`** — mantém
    bucket próprio pra evitar ciclo com `lib/rate-limit.js` (comentário
    `auth.js:13-19`). Boa decisão deliberada. Worth keeping.
  - **Falta `lib/queries/` recommended layer.** Pages fazem Prisma direto.
    Seria um terceiro nivel: `pages → queries → prisma`. Reduz repetição
    (Saruman v1 §Medium), centraliza tagging quando migrarem cache.
  - **`lib/analysis/` não existe.** Saruman v1 sugeriu — não foi feito.
    `analyze` e `profile/refresh` continuam quase idênticos.
  - **`components/site/*` mistura layout (SiteNav, SiteFooter) com seções de
    conteúdo (SiteFaq, SitePricing).** Em uma base maior, separar pra
    `components/site/layout/` + `components/site/sections/` deixaria mais óbvio
    o que é chrome e o que é página.
- **Recomendações:**
  1. Criar `lib/queries/` (snapshot, profile, gaps) — começa por
     `getLatestSnapshotWithGaps(userId)` que atende 5 pages.
  2. Criar `lib/analysis/runDiagnosis.js` (alavanca #1 de refactor).

---

### 10. Acoplamento Prisma → UI

- **Estado:** schema rico (24 models, 38+ indexes, cascade deletes em todas
  relações user-owned). LGPD bem modelado: `rawCvExpiresAt/rawCvRedactedAt`
  separados para `rawCv` e `linkedinRaw`. Idempotência baked-in (BillingEvent.stripeEventId,
  Achievement (userId, kind), DailyQuest (userId, questDate), UsageMeter (userId,
  feature, periodKey)).
- **Problemas:**
  - **Json columns shape-livre x UI shape-fixo.** `Profile.perfilJson`,
    `Profile.linkedinJson`, `Profile.portfolioJson`, `ScoreSnapshot.subScores`,
    `ScoreSnapshot.perfilJson`, `AssessmentResult.scoresJson`, `BillingEvent.payload`,
    `Notification.meta`, `Achievement.meta`, `AuditLog.meta`, `TailoredCv.bullets`.
    11 colunas Json. Saruman v1 §Medium já apontou. UI lê `perfilJson.skills`
    direto sem `parseProfileJson` zod. Quando shape muda (e mudou — diferentes
    versões da LLM produzem `skills` ou `habilidades`), render quebra
    silenciosamente. **Não foi corrigido.**
  - **Cascade deletes onDelete: Cascade em User → tudo.** Bom pra GDPR
    (right-to-be-forgotten). Mas `KnowledgeChunk` não é user-owned (não tem
    `userId`) — corretamente fica fora do cascade.
  - **Models possivelmente não-usados pós-redesign:**
    - `DataSource` (linha 254) — vi referência em comentários mas não em rotas.
      Verificar se ainda alimenta algo.
    - `Outcome` (linha 525+) — usado por `cron/outcome-survey` e `me/outcome`.
      OK.
    - `Consent` — modelado mas verificar uso ativo.
    Worth a `grep -rn "prisma.dataSource\|prisma.consent"` em separado.
  - **`ScoreSnapshot.perfilJson` duplica `Profile.perfilJson`.** Snapshot é
    point-in-time deliberadamente. Se UI quiser "perfil mais recente", lê
    `Profile`; se quiser "perfil ao tempo do snapshot", lê `ScoreSnapshot`.
    Aceitável; documentar onde cada um deve ser lido.
  - **`Notification.meta` Json sem validação.** Quem cria notificação faz
    `meta: { jobId, score }` livremente. Quem lê assume shape. Pra MVP OK,
    pra escala vale `lib/notifications/templates.js` com tipos por kind +
    Zod parse na leitura.
- **Recomendações:**
  1. `lib/validators/profile-json.js` com `parseProfileJson(raw)` Zod
     default-aware. Chamado em todo SELECT de Profile. (Saruman v1 ainda
     pendente.)
  2. Auditar Json columns vs UI shape: documentar em `prisma/schema.prisma`
     com `/// Zod: ...` comment apontando ao validator correspondente.
  3. `grep prisma.dataSource` para confirmar uso ativo de `DataSource`/`Consent`.

---

## Refactor candidates (top 5 alavancas)

1. **Server-renderizar a landing.** `components/site/SiteFeatures.js`,
   `SiteFaq.js`, `SiteSocialProof.js`, `SiteHowItWorks.js`, `SiteTrustBar.js`,
   `SitePricing.js` deixam de ser `"use client"`. Hero/CursorGlow/Marquee/Metrics
   continuam client. **Impacto:** -1.000+ linhas no bundle landing, TTI cai
   significativo, FCP melhora 30-40% (estimativa). Métrica: bundle analyzer
   `npm run build` antes/depois. **Esforço:** 1-2 dias (auditar JS-uso de cada
   sec + remover useEffect mortos).

2. **Extrair `lib/analysis/runDiagnosis.js`.** Função única
   `runDiagnosis({ userId, role, cv, snapshotId?, emit? })` chamada por
   `analyze/route.js` e `profile/refresh/route.js`. **Impacto:** 1.176
   linhas → ~80 + 80 + 250 (lib). Cada novo guard (token tracking, budget,
   audit, achievement) entra **uma vez**. Drift de prompt/scoring impossível.
   **Esforço:** 2-3 dias com testes de regressão (`tests/unit/profile-refresh.test.js`
   ajuda).

3. **Remover `force-dynamic` em cascata + tagging.** Auditar cada `dynamic =
   "force-dynamic"` (19 ocorrências); manter no root como salvaguarda do CSP
   inline; deletar dos grupos e pages que não fazem cookies/auth (transparencia,
   carreira); adicionar `revalidateTag` em mutações chave. Pré-requisito para
   ligar PPR no Next 15+. **Impacto:** habilita prerender parcial, abre porta
   pra cache-components migration. **Esforço:** 1-2 dias.

4. **`lib/queries/` com `getLatestSnapshotWithGaps(userId)`.** Atende 5 pages
   hoje (`dashboard`, `gaps`, `oportunidades`, `transparencia`, `conta`).
   Ponto único pra cache + include drift control. **Impacto:** menos duplicação,
   prep pra cache. **Esforço:** 0.5 dia.

5. **Consolidar Redis client em `lib/redis.js`.** `llm-cache.js`, `rate-limit.js`,
   `auth.js` instanciam Redis singletons separados. Único `getRedis()` exposto
   + namespaces (`llm:`, `rl:`, `auth-rl:`). **Impacto:** infra simpler, fewer
   warm connections, comportamento de fallback consistente. **Esforço:** 0.5 dia.

---

## Apêndice — Hot files novos pós-redesign

| Arquivo | Linhas | Tipo | Nota |
|---|---|---|---|
| `components/site/SiteHero.js` | 606 | Client (`"use client"`) | Justificado (animações orquestradas) |
| `components/site/SiteFeatures.js` | 353 | Client | Suspeito — provavelmente CSS-only |
| `components/site/SitePricing.js` | 353 | Client | Suspeito |
| `components/AppShell.js` | 333 | Client | Justificado (usePathname + media query) |
| `components/site/SiteMetrics.js` | 307 | Client | Provavelmente animação count-up |
| `components/site/SiteSocialProof.js` | 261 | Client | Suspeito — prosa estática |
| `components/site/SiteHowItWorks.js` | 235 | Client | Suspeito |
| `components/site/SiteFooter.js` | 218 | Server-able | Server (footer estático) |
| `components/site/SiteFaq.js` | 202 | Client | Suspeito — accordion CSS-only |
| `components/site/SiteTrustBar.js` | 199 | Client | Suspeito |

Total `components/site/` em "use client": 3.191 linhas. Estimativa pós-server:
~1.500-1.800 linhas de JS no bundle landing.

---

## Apêndice — Crons configurados

| Cron | Schedule (UTC) | Local BRT | maxDuration | Risco |
|---|---|---|---|---|
| `digest` | `0 12 * * 1` | Seg 09:00 | default | Resend quota ↗ |
| `daily-briefing` | `0 11 * * 0,2,3,4,5,6` | 08:00 (sex-dom + ter-qui) | 300 | LLM × 50 users sequencial |
| `usage-cleanup` | `0 3 1 * *` | Dia 1 às 00:00 | default | OK |
| `redact-cv` | `0 6 * * *` | 03:00 diário | default | take=500 sem ORDER BY |
| `outcome-survey` | `0 14 * * 1` | Seg 11:00 | default | OK |
| `redact-billing` | `0 4 1 * *` | Dia 1 às 01:00 | default | OK |

---

## Reconhecimentos (não-problemas)

- LLM provider abstraction sólida — switch entre Anthropic e OpenAI em 1 lugar.
- Token tracking integrado ao billing (Saruman v1 §Strength) continua exemplar.
- RAG hybrid retrieval com fallback em 4 camadas é state-of-the-art para o estágio.
- Cron auth unificada com constant-time compare + dual-header support — defensa madura.
- Schema Prisma com LGPD bem modelado (TTL por raw + cascade em User).
- `withApiGuard` aplicado nas rotas críticas (Saruman v1 anotou cobertura parcial; ver
  Saruman backend-health 2026-06-26 pra status atual).
- Idempotência no DB via `@@unique` é amplamente correta.
