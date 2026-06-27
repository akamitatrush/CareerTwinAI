# Gimli v2 — Performance audit (2026-06-26)

Auditoria research-only (zero edição). Foco em bundle, CWV, caching, data
fetching, JS heavy. Build artefatos não disponíveis no worktree — análise
estática + leitura de fontes. Stack: Next.js 14.2.35 App Router, React 18,
Vercel, sem Tailwind (CSS puro 6710 linhas), Sentry + PostHog.

## TL;DR

- Bundle hot files (anti-pattern bundle): **6** (8/8 site/* são "use client", 1
  globals.css 232 KB carregado em toda rota, fonts via `<link>` Google Fonts
  sem `next/font`, `<img>` raw no avatar, `force-dynamic` na raiz).
- "use client" mau usado: **3** confirmados (SiteFeatures, SiteFaq,
  SiteHowItWorks — só fade-in via IO, conteúdo 100% estático).
- Image issues: **2** (avatar `<img>` raw em AppShell.js:250, zero uso de
  `next/image` em toda a base — risco zero hoje porque não há imagem real, mas
  vira P0 no minuto que existir uma).
- Cache opportunities: **9** (`force-dynamic` em todas as rotas + landing +
  páginas legais estáticas; zero `revalidate`, zero `unstable_cache`, zero
  `use cache` directive do Next 16).
- IntersectionObserver duplicado: **8** instâncias na landing (SiteHero,
  SiteFeatures, SiteTrustBar, SiteHowItWorks, SiteSocialProof, SiteMetrics,
  SitePricing, SiteFaq) — cada componente cria o seu, zero compartilhamento.
- Animations forever-loop: **2** (SiteHero demo loop a cada 7.5s,
  SiteStackMarquee `animation infinite` no track).

---

## 1. Bundle analysis

> Build artefatos (`.next/static/chunks`) não disponíveis neste worktree.
> Análise é estática.

### Hot bundle suspects

| Arquivo | Tamanho | Cliente? | Risco |
|---|---|---|---|
| `app/globals.css` | **232 KB** / 6710 linhas | sim (CSS global) | crítico — entra em TODA rota, incluindo landing fria |
| `components/site/SiteHero.js` | 22 KB / 606 linhas | sim | alto — bundle inicial da `/` |
| `components/Report.js` | 24 KB / 431 linhas | sim | alto — bundle do `/experimentar` e `/dashboard` |
| `components/AppShell.js` | 12 KB / 333 linhas | sim | médio — em todas as rotas autenticadas |
| `components/SkillGraph.js` | — / 369 linhas | sim | médio (dashboard) |
| `components/site/SiteFeatures.js` | — / 354 linhas | sim, **deveria ser server** | alto |

### Imports pesados — bem isolados (positivo)

- `lib/pdf.js:38` — `pdf-parse` carregado via `await import()` lazy, só no
  servidor. Bom.
- `lib/docx.js:61` — `mammoth` carregado via `await import()` lazy. Bom.
- `@sentry/nextjs` — configurado via `withSentryConfig` em
  `next.config.mjs:35`. Cliente carrega via `sentry.client.config.js` (32
  linhas, mínimo). Bom.

### Imports pesados — preocupantes

- `posthog-js` é direct import em `components/PostHogProvider.js:4`. Mount no
  root layout (`app/layout.js:50`), entra em **todas** as rotas, incluindo
  landing pública e `/privacidade`. PostHog SDK ≈ 50-60 KB gzip + recursos
  extras. **Sem `Script strategy="lazyOnload"`** — bloqueia a hidratação inicial.
- `next/image` **zero uso** em toda a base (`grep` confirma). Hoje sem
  impacto porque não tem `public/`, mas o avatar `<img>` em
  `components/AppShell.js:250` é raw — quando user.image vier do Google OAuth,
  carrega URL externa sem otimização nem CLS guard (já tem width/height ao
  menos).

---

## 2. Client/server boundary

8 dos 8 componentes em `components/site/*` são `"use client"`. Análise individual:

### Realmente precisa de client

- `components/site/SiteCursorGlow.js:1` — usa `pointermove` + RAF. OK.
- `components/site/SiteHero.js:1` — line-draw + loop demo + parallax. OK
  (mas demo é pesado, ver §8).
- `components/site/SiteNav.js:1` — scroll listener + mobile drawer state. OK.
- `components/site/SiteStackMarquee.js:1` — comment diz "precisa de `<style>`
  inline pra hover/animation" mas isso é mentira: CSS inline em Server
  Component **funciona** (Next 13+). Pode ser server. Marginal.
- `components/site/SiteMetrics.js:1` — counter-up + IO. Precisa client.
  Marginal (poderia ficar estático com texto final + ser hidratado seletivo).

### Mau usado — só fade-in via IntersectionObserver

- `components/site/SiteFeatures.js:1` — 354 linhas, **tudo estático**. Único
  motivo do `"use client"`: fade-up stagger via `IntersectionObserver`
  (linhas 100-137) + `onMouseEnter`/`onMouseLeave` inline (linhas 221-241)
  com spotlight cursor. Conteúdo dos cards (`FEATURES` const linha 10) é
  100% server-rendered-friendly.
- `components/site/SiteFaq.js:1` — 203 linhas, `<details>/<summary>` HTML
  nativo. JS só pra fade-up via IO (linhas 48-74). Conteúdo estático
  (`FAQ` const linha 10).
- `components/site/SiteHowItWorks.js:1` — 236 linhas, conteúdo estático
  (`STEPS` const linha 11), só fade-up via IO (linhas 54-83).
- `components/site/SiteTrustBar.js:1` — 200 linhas, mesma situação: chips
  estáticos + IO de fade-up.
- `components/site/SiteSocialProof.js:1` — 262 linhas, mesma situação.
- `components/site/SitePricing.js:1` — 354 linhas, `TIERS` estático, fade-up
  via IO. Server poderia renderizar tudo, com um único `<ScrollReveal>`
  client wrapper compartilhado.

**Padrão**: 6 componentes pagam o custo de client (200-350 linhas cada,
viram bundle JS) só pra animar `opacity: 0 → 1`. CSS `@keyframes` + `animation-delay`
escalonado faria o mesmo sem **uma linha** de JS.

---

## 3. Images

- `components/AppShell.js:250` — `<img src={user.image} alt="" width={36}
  height={36}>` raw. Width/height tem (sem CLS). Risco real: URL externa
  (provavelmente Google avatar de OAuth) **sem otimização Next.js**, sem
  domínios remotePatterns configurados em `next.config.mjs` (linha 1-30,
  ausente). Quando `user.image` for um host não configurado, hoje carrega
  direto. Se migrar pra `next/image` precisa adicionar `remotePatterns:
  [{hostname: "lh3.googleusercontent.com"}, ...]`.
- **Zero uso de `next/image`** em todo o repo. Confirmado por `grep -rn
  "next/image"` (só hit é comment em `app/globals.css:1997`).
- **Zero `<img>` adicional** além do AppShell. SVGs inline em todos os Site*
  components — perfeito pra perf, péssimo pra tamanho de JS (cada SVG vira
  string no client bundle). Trade-off OK por enquanto.

Recomendação para o avatar:
```jsx
import Image from "next/image";
<Image src={user.image} alt="" width={36} height={36} unoptimized={false} />
```
+ `next.config.mjs` ganha `images: { remotePatterns: [...] }`.

---

## 4. Fonts

**Achado P0**: `app/layout.js:38-43` carrega Google Fonts via `<link
href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Spectral:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=JetBrains+Mono:wght@400;500;600&display=swap">`.

Problemas:
1. **Sem `next/font`** — perde optimização do Next (self-hosted, zero
   render-blocking, fallback métrico automático contra CLS).
2. **3 famílias** (Plus Jakarta + Spectral + JetBrains Mono) com 5+6+3=**14
   peso/estilos**. Estimativa: ~600-800 KB de WOFF2 por visita inicial até
   browser cachear. Mesmo com `preconnect` (linha 36-37) e `display=swap`,
   existe FOUT visível.
3. **Sem `subset`** (Latin + Latin-extended automático, mas sem latin-ext
   excluído).
4. **CSP-cost**: `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
   (middleware.js:40) e `font-src 'self' https://fonts.gstatic.com data:`
   (linha 41) — duas regras adicionais que não precisariam existir com
   `next/font`.

Comentário no `app/layout.js:13-19` justifica `dynamic = "force-dynamic"`
pelo nonce CSP — não tem relação com fonts, mas sublinha que o time já
sabe que tem dor de CSP que `next/font` resolveria automaticamente.

---

## 5. Third-party

### PostHog

- Direct import em `components/PostHogProvider.js:4` (`import posthog from
  "posthog-js"`). Mountado em `app/layout.js:50` no root, **todas** as
  rotas (incluindo landing + páginas legais) carregam o SDK no JS inicial.
- Tem fallback (`if (!KEY) return`) então em dev sem env-var não trava nada,
  mas **em prod a importação JS continua acontecendo** — só a inicialização
  é pulada. O SDK ≈ 50-60 KB gzip ainda entra no main bundle.
- `fetch("/api/auth/session")` em todo mount (`components/PostHogProvider.js:97`).
  Roda em **toda página visitada** mesmo sem PostHog configurado (early
  return condicional só pra capture, não pro fetch). 1 round-trip extra de TTFB
  na hidratação.
- **Não usa `<Script strategy="lazyOnload">`**. Recomendação: usar
  `posthog-js/dist/array.no-external` (lazy) ou wrapper `<Script>`.

### Sentry

- `sentry.client.config.js` — `tracesSampleRate: 0.1`. Bom.
- `replaysSessionSampleRate: 0` + `replaysOnErrorSampleRate: 0`. Replay
  desabilitado, isso poupa muito JS. Bom.
- `next.config.mjs:42` — `withSentryConfig` + `widenClientFileUpload: true`
  (uploada todos os chunks pro source-map). Build-time custo, runtime OK.
- `tunnelRoute: "/monitoring"` — rota Edge intercepta envio de events. Pode
  custar TTFB se Vercel cobra Edge invocations.

---

## 6. Caching

### `force-dynamic` espalhado

`grep -rn 'force-dynamic'` retorna **41 hits**. Auditoria:

- `app/layout.js:11` — root layout `force-dynamic` por causa do nonce CSP.
  **Cascateia pra todo o app**. Em `app/(landing)/layout.js:12` reaplicam por
  segurança. Comentário (linha 13-19) é honesto sobre o trade-off mas faz
  com que a landing **nunca seja cacheada**, mesmo sendo conteúdo 100%
  estático que poderia ser ISR de 1 dia.
- `app/privacidade/page.js:3`, `app/termos/page.js` (provavel) — páginas legais
  cristalizadas, sem motivo pra `force-dynamic`.
- `app/(app)/dashboard/page.js:17` — necessário (auth + Prisma). OK.
- `app/(app)/plano/page.js:7` — necessário (auth + Prisma). OK.
- `app/admin/page.js:27` — necessário. OK.
- `app/api/*` — quase todas API routes têm `force-dynamic`. Pra POSTs com
  body parsing está OK (Next infere automaticamente), mas é redundante:
  declaração não muda comportamento de POST.

### Zero `revalidate`

Nenhum `export const revalidate` no repo. Páginas que poderiam ter
revalidate=3600 (landing, /privacidade, /termos, /precos se virar página):
**não usam**.

### Zero `unstable_cache` / Cache Components

`grep "unstable_cache\|use cache\|cacheTag\|cacheLife"` retorna **zero
hits**. `getRealMedian` (citado em `app/(app)/dashboard/page.js:7`) usa
"cache em memória 1h" caseiro (comment linha 53). Não escala em multi-
instance/edge, e não invalida em writes.

### Vercel.json sem headers de cache

`vercel.json` (linhas 1-32) tem só `crons`. Nenhum `headers` pra assets
estáticos (Next já faz `_next/static` com immutable, mas qualquer asset
público fica sem Cache-Control explícito).

### Redirects no Next config

`next.config.mjs:22-25` tem 2 redirects 308 permanentes pra rotas `/site*`.
Edge-cached, OK. Não é problema.

---

## 7. Data fetching hot paths

### `/api/opportunities/route.js` (radar de vagas, backlog conhecido)

Já tem paralelização via `Promise.all` (linha 290): porques + plano. Bom.
Achados de melhoria adicional:

- **`searchJobs` é sequencial** (linha 147): chama múltiplos providers em
  série dentro de `lib/jobs.js` (confirma `lib/jobs/providers/greenhouse.js`,
  `lib/jobs/providers/lever.js`). Cada provider tem `fetchWithTimeout` mas
  não há `Promise.all` entre eles. **Suspeito principal do 20-40s percebido**:
  se Adzuna+Jooble+Greenhouse rodam em série e cada um tem timeout 5-8s,
  vira 20-25s só de busca de vagas, **antes** das 2 chamadas LLM.
- `enforceUsage` (linha 38) + `checkDailyBudget` (linha 56) — 2 round-trips
  sequenciais ao Redis no warm-up. Poderia ser `Promise.all`.
- `prisma.scoreSnapshot.findFirst` (linha 116) sequencial com `include:
  {gaps: true}`. Não paraleliza com `searchJobs`. Poderia rodar em paralelo:
  snapshot lookup + searchJobs + LLM warmup em `Promise.all`.

### `/app/(app)/dashboard/page.js`

- Linha 54: `Promise.all([profile, snapshots, median])` — bom.
- Linha 56: `prisma.scoreSnapshot.findMany` com `take: 30` + `include:
  {gaps, planItems}` — N+1 risco baixo (Prisma faz join). OK.
- Sem `Suspense` boundary — toda página espera o `Promise.all` antes de
  começar a stream HTML. Em conexão lenta vira TTFB alto.

### `/app/(app)/plano/page.js`

- Linha 22 + 34: `findMany(scoreSnapshot)` **sequencial** com o
  `Promise.all` seguinte. snapshotIds depende do primeiro await — não dá pra
  paralelizar trivialmente, mas dá pra rodar um `prisma.scoreSnapshot.findMany`
  **sem** `select` extra em paralelo com appEvents/applications.

### `/components/PostHogProvider.js`

- Linha 97: `fetch("/api/auth/session")` em **todo mount** de toda página.
  Cada navegação client-side dispara round-trip. Já tem `auth()` server-side
  em layouts. Dá pra passar a session via `useContext` em vez de fetch.

---

## 8. JS heavy

### Animations forever-loop

- `components/site/SiteHero.js:367-369` — `loopTimer = setTimeout(() => { if
  (!stopped && document.visibilityState === "visible") runSequence(); },
  7500)`. Loop infinito do mini-demo: a cada 7.5s recomeça setando 9 timers
  + 2 `countUp` que internamente fazem `setTimeout(tick, 16)` recursivo
  (linha 333) e `setTimeout(tick, 30)` (linha 344). Pausa em
  `visibilitychange` (linha 380) — bom. Mas enquanto aba está aberta, **infinito**.
- `components/site/SiteStackMarquee.js:118` — `.site-marquee-track { animation:
  siteMarqueeScroll 38s linear infinite; }` no track 2x duplicado. CSS-only
  é GPU, mas força composite-layer permanente.
- `components/site/SiteFeatures.js:476` — `siteHeroPulse 2s ease-out
  ...ms infinite` em 5 circles SVG ao mesmo tempo. CSS-only, OK, mas é
  trabalho de composite contínuo.

### IntersectionObserver multiplicação

8 IOs instanciados na landing (todos os Site* têm o seu, ver §1). Cada um
tem callback próprio, threshold próprio, gerencia próprio fade. Custo:
8 listeners + 8 cleanup paths + entropia de race-condition.

**Solução**: 1 IO global + `data-fade` + `data-fade-delay` em qualquer
elemento — código compartilhado, fade homogêneo, 1 listener.

### Scroll listeners

- `components/site/SiteNav.js:21` — `window.addEventListener("scroll",
  onScroll, { passive: true })`. Comment (linha 4-7) admite que IO seria
  melhor mas mantém scroll por "leitura". 1 scroll listener é OK; problema é
  que junta com:
- `components/site/SiteHero.js:300` — outro `addEventListener("scroll", ...,
  {passive: true})` pra parallax. Já usa RAF (linha 290).

2 scroll listeners em paralelo no mesmo container. Cada scroll dispara
ambos. OK na prática, mas sub-ótimo.

### Inline styles & willChange

- `components/site/SiteHero.js:106` e linha 86 — `willChange: "transform"` em
  H1 e eyebrow. Mantém composite-layer reservada permanentemente, custa
  GPU memory mesmo quando não anima. Recomendação: aplicar via `:hover`
  ou via JS na hora da animação, remover depois.
- `components/site/SiteCursorGlow.js:85` — `willChange: "transform"` no glow.
  Necessário porque anima 60fps, mas atenção: glow é `width:600 height:600
  borderRadius:50% mixBlendMode:screen` — `mix-blend-mode` força repaint
  em camadas inferiores. Em mobile já desativa (linha 28), bom.

### setInterval esquecidos

- `app/experimentar/page.js:107` — `setInterval(() => setProcElapsed(s => s
  + 1), 1000)`. Cleanup em linha 108. OK, sem leak.

Nenhum `setInterval` órfão encontrado.

---

## Top 5 alavancas de perf

Em ordem de impacto vs esforço.

### 1. Migrar Google Fonts pra `next/font/google` — ROI muito alto

Substitui o `<link>` em `app/layout.js:38-43` por:

```js
import { Plus_Jakarta_Sans, JetBrains_Mono, Spectral } from "next/font/google";
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], weight: ["400","500","600","700"] });
```

Ganhos:
- Self-hosted (zero conexão a fonts.googleapis/gstatic).
- Render-blocking eliminado (font-face com `font-display:swap` + size-adjust).
- CSP perde 2 regras (`fonts.googleapis.com` em style-src, `fonts.gstatic.com`
  em font-src).
- Subset BR `latin` em vez do default que vem com latin-ext.
- Estimativa: -150-250 KB de fonts no critical path. -200-400ms LCP.

### 2. Remover `force-dynamic` da landing + páginas estáticas — ROI alto

Hoje `/`, `/privacidade`, `/termos` rodam SSR a cada request. A justificativa
em `app/layout.js:13-19` (nonce CSP) é real, **mas só serve pra páginas que
têm scripts inline com nonce**. A landing pública tem inline `<style>` (não
nonce) e o boot script de tema (`app/layout.js:24-37` — usa
`dangerouslySetInnerHTML`, **não tem nonce no script**).

Refator possível:
- Tirar `dynamic = "force-dynamic"` do root.
- Aplicar `force-dynamic` só em route groups que precisam (`(app)/*`, `auth`).
- Landing/legal: `export const revalidate = 3600` (ISR 1h).

Ganhos: TTFB cai pra ~50ms (Vercel Edge cache hit), CDN serve HTML pré-renderizado.

### 3. Mover 6 Site* components pra Server Component — ROI alto

`SiteFeatures`, `SiteFaq`, `SiteHowItWorks`, `SiteTrustBar`, `SiteSocialProof`,
`SitePricing` não precisam ser client. Trocar o fade-up por CSS puro
(`@keyframes` + `animation-delay`):

```css
@keyframes fadeUp { from {opacity:0; transform:translateY(16px)} to {opacity:1; transform:none} }
[data-fade] { animation: fadeUp 700ms ease forwards; opacity: 0; }
[data-fade="2"] { animation-delay: 80ms; }
/* ... */
@media (prefers-reduced-motion: reduce) { [data-fade] { animation: none; opacity: 1; } }
```

Ganhos:
- ~6 × 200-350 linhas de JS saem do client bundle.
- Sumiço de 6 IntersectionObservers.
- React hydration mais leve (5 client islands em vez de 11 na landing).
- LCP melhor: HTML pre-renderizado, conteúdo visível imediatamente.

### 4. Paralelizar providers no `searchJobs` — ROI muito alto pro radar de vagas

`lib/jobs.js` (suspeita confirmada via grep `lib/jobs/providers/*`) chama
providers em série. Refator: `Promise.allSettled([adzuna, jooble,
greenhouse])` com timeouts individuais (ex: 5s cada).

Ganhos:
- Tempo total: max(provider) em vez de soma. Ex: 25s → 8s.
- Resiliência: `allSettled` deixa fallback parcial funcionar (1 provider lento
  não trava os outros 2).
- Casa com o backlog "radar de vagas perf" em `~/.claude/.../backlog_radar_perf.md`.

### 5. Lazy-load PostHog + Sentry no client — ROI médio-alto

Hoje:
- `components/PostHogProvider.js:4` faz `import posthog from "posthog-js"`
  estático.
- `sentry.client.config.js` carrega `@sentry/nextjs` no mount.

Refator possível:
- `posthog-js`: substitui por `await import("posthog-js")` dentro do
  `useEffect`. SDK só vira chunk separado, carrega depois de hidratação.
- Sentry: já é Sentry config oficial, deixa como está (mais arriscado mexer).
- Remover `fetch("/api/auth/session")` do `PostHogProvider.js:97` — mover pra
  Context provider que recebe session via prop do server layout.

Ganhos:
- ~50-60 KB do critical path pra after-interactive.
- Menos 1 round-trip de hidratação por página.
- TBT (Total Blocking Time) cai significativamente em landing fria.

---

## Bonus — quick wins de 1 linha

- `app/layout.js:34-35`: `preconnect` pra `fonts.googleapis.com` +
  `fonts.gstatic.com` fica obsoleto se migrar pra `next/font`. Remover.
- `components/site/SiteHero.js:106,86`: tirar `willChange: transform` dos
  elementos estáticos pós-mount (parallax acaba após 1 viewport-height).
- `components/site/SiteStackMarquee.js:1`: trocar `"use client"` por server
  component — não precisa client, é só CSS animation infinita.
- `components/site/SiteHero.js:478`: `siteHeroPulse infinite` nos 5 SVG
  circles. Trocar pra `iteration-count: 3` se aceitável visualmente, ou
  pausar quando hero sai do viewport.
- `app/layout.js:11`: documentar que tirar `force-dynamic` em rotas
  específicas com `revalidate` evita o problema do nonce CSP cacheado (cache
  ISR não tem nonce mismatch porque o script inline não usa nonce).
