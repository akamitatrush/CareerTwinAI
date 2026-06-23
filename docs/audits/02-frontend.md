# Audit Frontend — CareerTwin AI

> Data: 2026-06-23
> Branch: redesign/claude-design
> Auditor: frontend code review agent

## Resumo executivo

Frontend solido em base — Auth.js cobre PROTECTED, `(app)/layout.js` redireciona, todos `target="_blank"` tem `rel`, e nao existe `dangerouslySetInnerHTML` em conteudo de usuario. Mas tem **XSS armazenado critico**: `z.string().url()` aceita `javascript:`/`data:` (validators.js linhas 229,257,317,333), e essas URLs chegam direto em `<a href={…}>`. Alem disso, 4 rotas billing recem-criadas importam um pacote `stripe` que **nao esta em package.json**, quebrando build/runtime.

## Achados por severidade

### Critico
- **lib/validators.js:229,257,317,333** — `z.string().url()` aceita `javascript:`, `data:`, `vbscript:`, `file:` (`node -e` confirma). Usuario salva evidencia com `url=javascript:fetch('/api/me/export')…`, clica no proprio painel, executa JS no contexto autenticado. Sinks: `EvidenceItem.js:66`, `KanbanClient.js:206`, `PortfolioImportButton.js:124`, `RadarClient.js:335`, `Report.js:256`.
- **lib/billing/stripe.js:9** + `app/api/billing/{checkout,portal,webhook}/route.js` — `import Stripe from "stripe"` mas `stripe` nao consta em package.json. Build do route handler quebra com `MODULE_NOT_FOUND` no Vercel.

### Alto
- **middleware.js:7** — `PROTECTED = [meu-gemeo, meus-dados]`. As demais (`dashboard`, `gaps`, `oportunidades`, `plano`, `cvs-adaptados`, `evidencias`, `candidaturas`, `conta`, `transparencia`) dependem so do `auth()` na page. Divergencia com `auth.config.js:4` PROTECTED_PREFIXES. Atualmente mitigado (todas pages chamam `auth()`), mas armadilha pro proximo Server Component.
- **middleware.js:26** — CSP com `'unsafe-inline'` (trade-off documentado). Combina com `app/layout.js:27` (dangerouslySetInnerHTML estatico do theme). Se um XSS reflected aparecer, nao tem nonce pra bloquear. Considerar migrar pra Next 15 + nonce.
- **app/layout.js:43** — Google Fonts via `<link>` (Plus Jakarta + Spectral + JetBrains Mono). Bloqueia render, DNS lookup pra `fonts.gstatic.com`, sem subsetting. `next/font` corta ~200-400ms FCP e elimina dep externa do CSP.

### Medio
- **app/page.js:51** — Home publica chama `/api/auth/session` no client e importa `Report.js` (366 linhas) sem code-split. Carrega ~30KB JS desnecessario pra quem vai so logar.
- **components/PostHogProvider.js** registrado em `app/layout.js:49` (root) — PostHog (~80KB) carrega em **toda** page, incluindo `/entrar`, `/privacidade`, `/auth/verify-request`. Mover pra `(app)/layout.js`.
- **components/InterviewModal.js:33,38 / TailorModal.js:31** — `react-hooks/exhaustive-deps` desabilitado. Funciona, mas merece comentario explicando por que ou refator.
- **app/(app)/cvs-adaptados/CvDetailClient.js:60** — `window.location.reload()` pos-delete recarrega o shell inteiro. `router.refresh()` re-renderiza so o server tree.
- **app/auth/verify-request/page.js:25** — aceita `?email=` arbitrario na URL. Auth.js v5 nao envia, mas o codigo renderiza qualquer string. Vetor de phishing (atacante manda link com `?email=victim@x.com`). Validado por regex, mas confunde.

### Baixo
- **components/AppShell.js:128** — `mq.addListener` legacy fallback (Safari <14). Pode sair.
- **app/page.js:120** — `await new Promise((r) => setTimeout(r, 350))` artificial delay.
- **app/(app)/conta/page.js** (468 linhas) / **dashboard/page.js** (621) — grandes pra Server Components. Quebrar.
- **components/Modal.js:39** — `document.body.style.overflow="hidden"` direto. Conflita se 2 modais simultaneos.
- **app/(app)/oportunidades/RadarClient.js:329** — `job.porque.replace(/.../)` em string da LLM. OK porque LLM ja foi validada com Zod max 500.

## Detalhamento

### 1. XSS / Injection vectors
- `dangerouslySetInnerHTML`: 1 uso (`app/layout.js:27`, theme bootstrap, string estatica). OK.
- `target="_blank"`: 8 ocorrencias, **todas** com `rel="noopener noreferrer"`.
- **URLs nao sanitizadas**: ver Critico. 5 sinks de XSS via href.
- User input em JSX: React escapa; nenhum bypass.

### 2. CSP / Headers
- middleware.js:25-49 — bons defaults: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
- `script-src 'self' 'unsafe-inline'` — trade-off explicito documentado.
- next.config.mjs:5-13 — HSTS 2y + preload, X-Frame DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy bloqueia camera/mic/geo.
- `connect-src` libera so PostHog + Sentry.

### 3. Auth boundary
- `(app)/layout.js:11-13` redireciona. Pages fora do `(app)/` (`candidaturas`, `meus-dados`) chamam `auth()` na page.
- Server actions re-checam (`entrar:17`, `meus-dados:20,34`).
- API: 33 de 37 chamam `auth()`. Excecoes: health (publico), cron/digest e cron/usage-cleanup (header secret + `safeCompare`), `[...nextauth]`.

### 4. Hydration / SSR/CSR
- `"use client"` apropriado.
- `force-dynamic` no root garante `new Date()` em Server Components nao quebra.
- `AppShell.js:144-150` doc fallback de viewport bem.

### 5. Form security
- CSRF: Auth.js `sameSite=lax`.
- Upload CV: limite Content-Length, magic bytes, hash do TEXTO. Bom.

### 6. Cookies & Storage
- localStorage: so `ct_theme` + PostHog. Sem PII.
- Cookies Auth.js: `httpOnly`, `secure`, `sameSite=lax`.

### 7. Dependencias

| pkg | versao | nota |
|---|---|---|
| next | 14.2.35 | post CVE-2025-29927 + CVE-2024-46982. OK |
| react / react-dom | 18.3.1 | OK |
| next-auth | 5.0.0-beta.31 | ainda beta — risco breaking |
| @auth/core | 0.41.2 | OK |
| @prisma/client / prisma | 6.19.3 | OK |
| pdf-parse | 2.4.5 | inclui pdfjs-dist 5.4.296 (post GHSA-wgrm-67xf-hhpq) |
| mammoth | 1.12.0 | OK |
| nodemailer | 7.0.13 | OK |
| @sentry/nextjs | 10.59.0 | OK |
| posthog-js | 1.391.3 | OK |
| zod | 4.4.3 | **`.url()` permissivo** |
| **stripe** | **AUSENTE** | requerido por 4 imports — critico |
| anthropic-sdk / voyageai | ausente | usa fetch direto. OK |

### 8. Bundle / Performance
- Home (`app/page.js` 430 linhas) importa Report inteiro estatico.
- Google Fonts via CDN.
- PostHog 80KB em pages publicas.
- globals.css 158KB / 4533 linhas (server-side, cacheado).

### 9. Accessibility
- Skip-link `AppShell.js:157`. `aria-label` em nav, `aria-current="page"`.
- Modal: focus trap, `role="dialog"`, `aria-modal`, Esc, restore focus. Excelente.

### 10. Patterns
- Race-cleanup `alive`/`active` em `app/page.js:50`, `TailorModal.js:10`, `NotificationsBell.js:42` (useCallback). Bom.
- 3 `exhaustive-deps` disabled — revisar.

## Recomendacoes priorizadas

1. **`safeUrl()` validator** com regex `^https?://` + `new URL()`; substituir todos `z.string().url()` que viram href. ~30min. **Critico**.
2. **`stripe` em package.json** (ou dynamic import gated por env). ~5min. **Critico**.
3. **Alinhar `middleware.js` PROTECTED** com `auth.config.js`. ~10min.
4. **`next/font`** ao inves de Google `<link>`. ~30min.
5. **Code-split Report.js** com `next/dynamic`. ~15min.
6. **PostHog so em `(app)/layout.js`**. ~10min.

## Metricas
- Pages: 24 (`.js`)
- Server components: 18 (auth() onde obrigatorio: 13/13)
- Client components: 11
- API routes: 37 (auth(): 33; cron: 2 com secret; nativos: 2)
- `dangerouslySetInnerHTML`: 1 (justificado)
- `target="_blank"` sem rel: 0 / 8
- URL fields sem protocol whitelist: 4
- Deps diretas: 13 (1 ausente: stripe)
- Maior CSS: 158KB (`app/globals.css`)
- Maior client component: `app/page.js` (430 linhas)
