# Frodo v2 — User journey & mobile audit (2026-06-26)

Research-only. Audit pós-redesign Sociedade do Anel. ICP brasileiro mobile-heavy.

## TL;DR

- **Viewport meta tag AUSENTE no `<head>` raiz** — issue mais grave do audit; em iOS Safari isso vira o site escalado pra desktop com pinch-zoom obrigatório.
- **Breakpoints inconsistentes**: 54 `@media` em globals.css, com 12 valores diferentes (480, 520, 540, 600, 640, 680, 720, 760, 768, 800, 880, 900, 980, 1100). Não há sistema (`sm/md/lg`).
- **Touch target violations**: ≥7 componentes abaixo de 44px (`tool-btn` topbar ~38px, `kanban-x` candidaturas ~28px, `info-tip` 14px, hamburger `SiteNav` 40px, `appshell-mobile-actions` avatar 30px).
- **Loop de navegação**: dashboard empty state manda user logado pra `/` → landing redireciona pra `/meu-gemeo` → `/meu-gemeo` redireciona pra `/dashboard` → loop infinito potencial.
- **Body font-size 14.5px** — abaixo do recomendado mobile (16px), pode causar zoom em iOS em alguns selecionares de texto.
- **Pontos onde o fluxo quebra**: 5 detectados.
- **Estados vazios sem CTA editorial**: 4 (kanban-empty 11px, kanban-empty-hero, `<div className="ct-dash-empty">` no /error, mensagem "Vazia por enquanto" sem ação).
- **Nenhum sticky bottom CTA**: hero do `/experimentar` exige scroll pra chegar no botão.
- **Sem service worker / push notification web**, nem streak/gamification engagement loop.

## A. Mobile responsive

### A.1 Breakpoints e clamp

**Viewport meta tag ausente** — `app/layout.js:21-47` não declara `<meta name="viewport" content="width=device-width, initial-scale=1">` nem export const `viewport`. Next.js 15 não inclui por padrão — sem isso, iOS Safari vai abrir o site em modo "desktop" escalado e usuário precisa pinch-zoom. Verificado por busca: `grep -rn "viewport" app/` retorna 0 resultados de declaração (`app/globals.css:6024` e `:6687` são comentários sobre viewport, não meta tag).

**Breakpoints sem sistema declarado** — `app/globals.css` tem 54 media queries (`grep -c "@media"` confirma) usando 12 valores distintos:

- 480px (`globals.css:6077` iPhone SE)
- 520px (`globals.css:1522` iv-cols)
- 540px (`globals.css:4495`)
- 600px (`globals.css:2755`)
- 640px (`globals.css:6256, 6306, 6354`) — peças do hero/site
- 680px (`globals.css:6182`)
- 720px (`globals.css:1163, 2063, 2132, 2491, 2650, 3244, 3310, 3450, 3886, 4042, 4096, 4340, 4695, 4868, 4933, 5067, 5347, 5364, 5955`) — MAIORIA
- 760px (`globals.css:852, 903`)
- 768px (`globals.css:6367, 6603`)
- 800px (`app/entrar/page.js:271`) — inline
- 860px (`components/site/SiteNav.js:176`) — inline
- 880px (`components/AppShell.js:158`) — JS matchMedia + globals.css :2048, :2259, :2325, :2386, :2394, :3052
- 900px (`globals.css:3494, 3554`)
- 980px (`globals.css:4095`)
- 1100px (`app/(app)/candidaturas/KanbanClient.js:255`)

**Risco**: comportamento intermediário inconsistente entre ~720px e ~880px — sidebar do AppShell aparece (>880px) mas grids internos já são "mobile" (≤880px). Em iPad portrait (768px) AppShell vira mobile-header, mas formulários do `/entrar` ainda renderizam em 2 colunas até 800px.

**Mismatch JS vs CSS** — `components/AppShell.js:158` usa `(max-width: 880px)` no matchMedia mas `app/globals.css:5955` aplica regras de touch target só em `(max-width: 720px)`. Janela 721-880px: mobile header renderizado, mas `appshell-mobile-nav-item` SEM `min-height: 44px` aplicado.

**`clamp()` usado seletivamente** — 23 ocorrências em `globals.css` e 22 em `components/site/`. Concentrado no hero (`SiteHero.js:99, 109, 528, 550`) e títulos de páginas (`SitePlano EditorialEmpty`). Maioria dos cards e listagens usa font-size fixo (ex: `tool-btn 13px`, `kanban-card-t 13px`, `ct-fit-label 10px`).

### A.2 Touch targets

Apple HIG = 44x44; Material = 48x48. WCAG 2.5.5 AAA = 44x44.

| Componente | Tamanho | Arquivo | Status |
|---|---|---|---|
| `tool-btn` (topbar /experimentar) | ~38px (padding 9px+13px font) | `globals.css:1349-1354` | FALHA fora do @720 |
| `kanban-x` (remover candidatura) | ~28px (padding 4px 8px, font 11px) | `KanbanClient.js:270, globals.css inline 5961+` | FALHA — kanban-x não tem override mobile |
| `kanban-card-actions select` | ~28-30px | `KanbanClient.js:269` font 11px | iOS zoom + touch fail |
| `info-tip` (?) tooltip | 14x14 | `globals.css:616` | FALHA grave (botão de ajuda invisível) |
| `SiteNav` hamburger | 40x40 | `components/site/SiteNav.js:131-132` | FALHA marginal |
| `appshell-mobile-actions` avatar | 30x30 | `AppShell.js:296` | OK (decorativo) mas `Link href="/conta"` em mobile usa só `Bell + avatar` — sem item de conta no mobile-nav |
| `ct-action-cta` / `ct-job-link` | 36px desktop / 44px mobile | `globals.css:6003-6011` | OK no @720 |
| `appshell-mobile-nav-item` | 44px @720, **39px entre 720-880px** | `globals.css:5986` | FALHA na janela intermediária |
| `theme-toggle` | 38px desktop, 44px @720 | `globals.css:5993-5998` | OK |
| `modal-x` close | 30px desktop, 40px @720 | `globals.css:6017` | FALHA marginal (40 < 44) |

**Espaçamento entre alvos** — em `app/experimentar/page.js:325-336`, o topbar mobile coloca "Candidaturas" e "Meu gêmeo →" com `gap: 12px`. Em 360px, cada tool-btn tem ~150px de largura mas eles dividem espaço com brand. Ali pode acontecer overlap visual em 320px (iPhone SE 1ª gen).

**Stack de filter pills** em `/oportunidades` — `ct-filter-pill` ganha `min-height: 44px` em @720 (`globals.css:6058`) mas não declara `flex-wrap` no container `.ct-filters`. Risco overflow horizontal.

### A.3 Mobile-specific

**Viewport** — ausente (item A.1, mais crítico).

**iOS no-zoom-on-focus** — implementado parcialmente em `globals.css:5961-5972`: inputs textuais ganham `font-size:16px !important` em @720. **Mas há gaps**:

- `KanbanClient.js:269` define `kanban-card-actions select { font-size: 11px }` via `<style jsx>` no componente. O `!important` do globals deve dominar — mas Wave 9 comentário no globals (linha 5959) admite que styles inline podem brigar.
- `globals.css:5454-5458` `.ct-copilot-input` font-size 13px (corrigido pelo @720, mas se o copilot abrir em tablet 768px ainda zoom).

**`-webkit-overflow-scrolling: touch`** — presente em `globals.css:6044, 6074` (kanban e tabelas). OK.

**Touch swipe handlers** — não encontrados. Carousel `SiteStackMarquee` é animação CSS auto-scroll, não interativo. Kanban tem scroll horizontal nativo + snap (`globals.css:6041-6049`), aceitável.

**Sticky bottom CTA** — **ausente em flows de conversão**:
- `/` landing: hero CTA "Começar diagnóstico" só visível no topo (`SiteHero.js:421`). Após scroll por Features/HowItWorks/Metrics/Pricing/FAQ, não há sticky CTA.
- `/experimentar`: botões "Gerar diagnóstico" + "Carregar exemplo" em `experimentar/page.js:541-546` ficam na parte inferior do card de input, fora da fold em mobile com CV colado.
- `/entrar`: botão "Enviar link" no meio do form, sem sticky.

**`position: fixed` + input keyboard overlap** — `CopilotWidget` é FAB fixo bottom-right (`globals.css:5322-5331`). Quando aberto vira `ct-copilot-panel` com `position: fixed; bottom: 92px; right: 24px` (linha 5352). Em mobile, panel abre full-width (`right:8px; left:8px`, linha 5366) com altura `calc(100vh - 100px)`. **Input do copilot fica no fundo do panel** (`ct-copilot-form` linha 5450-5453) — ao focar input em iOS, teclado pode esconder o form (não há `env(safe-area-inset-bottom)` nem `interactive-widget=resizes-content`).

**Imagens** — quase tudo SVG inline. Apenas `AppShell.js:250` usa `<img>` real (avatar do user). Tem `width={36} height={36}` — OK, sem CLS. Não tem `loading="lazy"` nem `decoding="async"` (avatar acima da fold, ok).

**Performance perceptual mobile**:
- Skeleton screens presentes em `app/loading.js`, `app/(app)/loading.js`, `RadarClient.js:173-177` com `ct-skel-card` shimmer (`globals.css:2545-2553`). ✅ Bom.
- Hero loading: `SiteHero` tem demo loop com `IntersectionObserver` que só roda quando visível (`SiteHero.js:373-378`). Bom para perf.
- `/experimentar` proc state tem estimativa em tempo real do tempo (`experimentar/page.js:633-639`) — feedback excelente.

## B. User journey walkthrough

### B.1 Landing → primeiro contato

- **Hero comunica valor?** ✅ — `SiteHero.js:407-413` "Pare de mandar CV genérico. Sua carreira sem caixa-preta." + body "Diagnóstico auditável, vagas reais e microações com fonte rastreável." — promessa clara em < 5s. Mini-demo do score em tempo real é storytelling forte.
- **CTA primary leva a:** `/experimentar` (`SiteHero.js:421`).
- **Prova social na fold?** ❌ — TrustBar é a SEÇÃO seguinte (`(landing)/page.js:51`), abaixo do scroll. Hero só tem eyebrow "BRASIL · SEM CAIXA-PRETA" (`SiteHero.js:403`). Para mobile (viewport curto), TrustBar empurra abaixo do scroll inicial.
- **Friction**: zero. Nenhum modal, nenhum captcha. Hero é silenciosamente forte.
- **Bug fluxo**: user logado em `/` → server redirect pra `/meu-gemeo` (`page.js:36-38`) → `/meu-gemeo` redirect pra `/dashboard` (`app/meu-gemeo/page.js:5`). Duplo redirect — não loop, mas slow (2 round-trips antes de pintar). Pode juntar.

### B.2 Primeira sessão (modo experimentar)

Rota: `/experimentar` (`app/experimentar/page.js:35`).

- **Cliques pra primeiro score**: 3 — colar CV + escrever cargo + clicar "Gerar". Bom.
- **Pede dado pessoal cedo?** ❌ não. CV é colado direto. PII só na conta.
- **Friction (login wall, paywall, captcha)?** ❌ zero. Modo experimentar puro. Excelente.
- **Mas**: `/experimentar` tem botões "Candidaturas" + "Meu gêmeo →" no topbar se user logado (`experimentar/page.js:327-331`). Para anônimo mostra "Entrar para salvar" (linha 333) — OK.
- **Issue**: `/experimentar` tem `topbar` próprio mas NÃO o `AppShell` — mostra dois sistemas de navegação visualmente diferentes pro mesmo user. Coerência baixa.
- **CTA "Conversar com IA"** (`page.js:489-502`) — modo chat onboarding. Bom diferencial. **Problema**: na primeira visita não há tutorial visual. Tabs "Colar CV" vs "Conversar com IA" igual visualmente — user pode não notar que o segundo é uma feature distinta.

### B.3 Conversão experimentar → cadastrado

Rota: `/entrar`.

- **Magic link funciona em mobile?** — provavelmente sim, mas página `/auth/verify-request` (`app/auth/verify-request/page.js:128-130`) tem link "Voltar pro modo experimentar (sem login)" apontando para `/` — que **NÃO é mais o modo experimentar** após o redesign. O modo experimentar é `/experimentar`. Texto desatualizado, confunde.
- **Abre app de email correto?** — link do magic link é cliente-padrão. Sem deep-link customizado pra iOS Mail.
- **Fallback se magic link falhar?** ⚠️ — VerifyRequest tem só "Tentar com outro email" (`page.js:110-112`). Não há resend (rate-limited está em `lib/auth.js:41-47`, max 3/h/email — tudo bem, mas user não vê o botão "reenviar").
- **Modal de "deu errado"?** — caso usuário insira email inválido, `emailAction` retorna silencioso (`entrar/page.js:23`) — anti-enum **bom para segurança**, mas user fica sem feedback. Mensagem genérica "Se houver uma conta..." em `entrar/page.js:58-60` só aparece após submit válido (parâmetro `?enviado=1`).

### B.4 Onboarding pós-login

Rota: pós-magic link → `/meu-gemeo` (`lib/auth.js:28`) → redirect → `/dashboard` (`app/meu-gemeo/page.js:5`).

- **User vê valor IMEDIATO?** ❌ — dashboard `EmptyState` (`dashboard/page.js:264-281`) é mostrado se sem snapshots: "Seu gêmeo ainda está em branco." → CTA "Construir meu gêmeo →" apontando para `/` (linha 273). Mas `/` é a **landing** agora, não a página de input. User clica → vai pra landing → vê hero "Pare de mandar CV genérico" → confusão!
- **Mesmo bug em `WelcomeBanner`** (`dashboard/page.js:316`): `<Link href="/" className="ct-welcome-banner-cta">Construir meu gêmeo →` para usuário sem `firstDiagnosisAt`. Aponta pra landing.
- **Loop potencial**: user logado clica → vai para `/` → redirect pra `/meu-gemeo` (`(landing)/page.js:37`) → redirect pra `/dashboard` → empty state mostra link pra `/` → loop visual de 2 hops. Fix: trocar `href="/"` → `href="/experimentar"`.
- **Returning vs first-time**: `WelcomeBanner` diferencia (`dashboard/page.js:288`). ✅ bom.

### B.5 Loop principal (diagnóstico → gaps → plano → executar → re-diagnóstico)

Telas: `/dashboard` → `/gaps` → `/plano` → `/oportunidades` → `RefreshDiagnosisButton` recalcula.

- **Quebra do fluxo**: `/dashboard` empty banner aponta pra `/` (item B.4). Não tem CTA direto pra `/experimentar`.
- **Estados vazios editoriais**: existem em `/plano` (`EditorialEmpty` `plano/page.js:318`) — boa qualidade. Mas em `/oportunidades` o empty state usa só `<h2>Nenhuma vaga voltou agora</h2>` com fallback texto (`RadarClient.js:186-198`). CTA para "resetar filtros" existe (linha 203-213). OK.
- **Kanban empty** (`/candidaturas` columns vazias): `<div className="kanban-empty">{COLUMN_EMPTY[col.key] || "Vazia por enquanto."}</div>` (`KanbanClient.js:206`). Font-size 11px (linha 261) + italic + texto sem CTA. ❌ Falha do princípio "estado vazio é editorial".
- **Bug navegação**: `RadarClient.js:217-222` redireciona pra "seu dashboard" via `<Link href="/dashboard">` — OK.

### B.6 Retention / engagement

- **Push notification web?** ❌ — `grep "serviceWorker"` retorna 0. Sem PWA, sem push.
- **Email recorrente?** ✅ — digest semanal mencionado em `/entrar` (linha 222-228) + `/api/cron/digest/route.js`. Existe.
- **Streak / achievement / daily quest?** ⚠️ parcial:
  - Daily quest existe (`app/(app)/dashboard/DailyQuestCard.js`, `/api/me/daily-quest/route.js`). ✅
  - Achievement toast existe (`globals.css:2728` `.ct-achievement-toast`). ✅
  - **Streak**: `grep "streak"` retorna 0 results em `app/`, `components/`, `lib/`. ❌ ausente.
- **Notification bell**: `components/NotificationsBell.js` (referenciado em `AppShell.js:6`) — drawer in-app. ✅
- **Outcome survey cron** (`/api/cron/outcome-survey/route.js`) — bom pra re-engajamento.

## C. Estados de erro / loading / vazio

- **Tela branca quando falha?** ❌ — error boundaries existem em `app/error.js`, `app/global-error.js`, e `app/(app)/error.js`. Texto editorial: "Algo deu errado aqui. Voce nao esta perdendo dados — so essa tela travou." (`app/error.js:26-32`). ✅ excelente tom. **MAS**: "Voltar pra home" aponta pra `/` (linha 39-41) — mesmo bug do dashboard. User logado vai pra landing.
- **"Carregando..." sem skeleton?** — não encontrei spinner "..." puro. Loading states usam `ct-skel-card` shimmer (`app/loading.js`, `app/(app)/loading.js`, `RadarClient.js:173`). ✅
- **Mensagens de erro técnicas vs editorial?**
  - `/experimentar` proc: excelente — `procMessages` (`experimentar/page.js:278-295`) tem mensagens contextuais "Lendo seu currículo · X caracteres · estimativa de ~Ys".
  - Falha de análise tem 4 paths editoriais (timeout / network / rate-limit / cv-inválido) em `experimentar/page.js:243-261`. ✅ ótimo.
  - `RadarClient.js:166-169` erro mostra "Falhou a busca / {error}. Tente recarregar." — genérico mas funcional.
  - `KanbanClient`: sem error boundary visível pro caso de POST falhar. Risco silencioso.
- **Empty states com CTA editorial**:
  - `/dashboard` EmptyState: ✅ tem CTA "Construir meu gêmeo →" (mas bug rota).
  - `/plano` EditorialEmpty: ✅ excelente design.
  - `/oportunidades` empty: ✅ tem botão reset filtros + link dashboard.
  - `/candidaturas` empty kanban-empty: ❌ texto pequeno, sem CTA.
  - `/candidaturas` `kanban-empty-hero`: ✅ tem CTA "Adicionar candidatura".

## Top 5 alavancas

1. **[P0] Declarar `viewport` meta tag** em `app/layout.js` (export `viewport` constant ou `<meta>` em `<head>`). Sem isso, iOS Safari abre o site em modo desktop escalado. Maior bug mobile do projeto.

2. **[P0] Corrigir links `href="/"` em dashboard EmptyState e WelcomeBanner** (`app/(app)/dashboard/page.js:269, 273, 316`) e `app/error.js:39` para `href="/experimentar"`. Hoje user logado clica → vai pra landing premium → confusão (e duplo redirect). Simples replace, impact alto.

3. **[P1] Sistema de breakpoints unificado**. 12 valores diferentes em 54 media queries é caos. Adotar 4 tokens (`--bp-sm: 480`, `--bp-md: 720`, `--bp-lg: 880`, `--bp-xl: 1100`) e refatorar globalmente. Alinhar matchMedia do `AppShell.js:158` (880px) com regras CSS (720px) — janela intermediária 721-879px é zona morta de touch targets.

4. **[P1] Sticky bottom CTA bar** em flows de conversão. Landing após scroll (Pricing / FAQ) e `/experimentar` form longo precisam reaparecer com CTA fixo. Padrão Linear/Stripe: barra translúcida bottom 56px com "Começar diagnóstico →". 

5. **[P2] Corrigir touch targets restantes** (`kanban-x` 28px, `tool-btn` 38px sem override mobile, `SiteNav` hamburger 40px, `info-tip` 14px). Pacote rápido em globals.css. Bonus: trocar texto desatualizado "Voltar pro modo experimentar" em `app/auth/verify-request/page.js:128` para apontar pra `/experimentar`.

---

**Notas de pesquisa**

- Não testei dispositivo real — análise estática de código + comportamento esperado pelas regras CSS.
- `force-dynamic` no root layout (`app/layout.js:11`) é justificado por CSP/nonce — não confundir com perf.
- Skill graph e copilot widget têm comportamento mobile específico — confirmar com Eowyn e Gandalf v2 testing reports.
