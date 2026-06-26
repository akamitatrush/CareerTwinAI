# Audit Mobile Responsive — 2026-06-22

Branch `redesign/claude-design`. Escopo: revisar `app/globals.css` (5575 linhas) e `components/AppShell.js` (285 linhas) em busca de problemas de UX mobile em iPhone SE (375px), iPhone Pro (414px) e iPad portrait (768px). BR e mercado mobile-first — qualquer fricao zoom/overflow/touch derruba conversao.

## Metodo

Read-only do CSS + componentes. Cross-check com WCAG 2.5.5 (touch target >=44px), Apple HIG iOS no-zoom-on-focus (`font-size >= 16px`), e best practices de Material Design 3.

## Issues identificadas

| # | Issue | Severidade | Fix aplicado |
|---|-------|------------|--------------|
| 1 | Inputs com `font-size: 13.5px` (`field input/textarea`, `ct-copilot-input`, `chat-input`) — iOS faz zoom-on-focus, prejudica fluxo de form | **P0** a11y | `input/textarea/select { font-size: 16px !important }` no bloco `@media (max-width: 720px)` |
| 2 | Buttons `.btn` (padding `11px 20px`, ~36px altura) abaixo de 44px WCAG | **P0** a11y | `.btn, .btn-primary, .btn-ghost, .btn-secondary { min-height: 44px }` em mobile |
| 3 | Theme toggle 38x38 (acima de 24x24, mas borderline) | P1 | 44x44 em mobile |
| 4 | AppShell nav items 13.5px font + padding 10px = ~37px touch | P1 | `min-height: 44px` em `.appshell-nav-item`/`.appshell-mobile-nav-item` |
| 5 | Botoes inline em cards (`ct-action-cta`, `ct-job-link`, `ct-subscores-link`) sao texto cru — sem padding clicavel | P1 | `min-height: 36px; padding: 8px 4px; inline-flex` em mobile |
| 6 | Microaction check (botao concluir gap) 32px em desktop — pequeno em touch | P1 | `min-width/height: 44px` em mobile |
| 7 | Modal close `X` 30x30 — pequeno demais pra dedao | P1 | 40x40 em mobile |
| 8 | Cards de vaga: salarios "R$ 12.000–R$ 18.000/mes" podem estourar 375px | P1 | `word-break: break-word; overflow-wrap: anywhere` em `.ct-job-card/.ct-job-meta/.ct-job-title` |
| 9 | Modais (refresh, tailor, base) sem `max-height` definido — landscape SE pode estourar viewport | P1 | `max-height: calc(100vh - 32px); overflow-y: auto` |
| 10 | Modal overlay com `padding: 48px 18px` — desperdica espaco em mobile estreito | P1 | `padding: 16px; align-items: center` em mobile; `padding: 8px` em <=480px |
| 11 | Kanban sem `scroll-snap` quando aparece overflow em mobile | P2 | `scroll-snap-type: x mandatory` + `scroll-snap-align: start` nos colunas |
| 12 | `ct-filter-pill` com 13.5px / padding pequeno — pills do radar dificeis de tocar | P1 | `min-height: 44px; padding: 10px 14px`; select font 16px |
| 13 | Cards (job/microaction/evidence) com padding 20-24px desperdiçando largura em 375px | P2 | Padding reduzido pra 14-16px em mobile |
| 14 | Refinamentos finos pra <=480px: titulos 22px, pill 11px, score grande 48px, modal overlay 8px | P2 | Bloco `@media (max-width: 480px)` |

## AppShell — verificacao do pattern responsivo

Confirmacao: AppShell **NAO usa drawer/hamburger**, mas **horizontal scrollable nav header**. Decisao explicita em `components/AppShell.js:147-151` — JS via `matchMedia("(max-width: 880px)")` troca entre sidebar fixa (desktop) e header sticky (mobile) com nav rolavel horizontal (`overflow-x: auto; scrollbar-width: none`). Padrao valido (e.g., Twitter mobile, Vercel). Vantagem: zero state de drawer aberto/fechado, descoberta visual imediata, sem trap de foco. Desvantagem: items longos exigem scroll horizontal — aceitavel pra 8 items curtos. **Sem mudancas estruturais**, apenas aumentamos touch target dos items pra 44px.

## Arquivos tocados

- `app/globals.css` — adicionado bloco final consolidado (linhas 5577-5708, ~131 linhas):
  - `@media (max-width: 720px)`: 14 grupos de regras (iOS no-zoom, touch targets, modais, kanban, headers, cards, filtros)
  - `@media (max-width: 480px)`: 9 refinamentos pra telas muito estreitas
- `tests/unit/css-mobile.test.js` (novo, 12 testes): valida presenca de regras criticas via string-match. Barato e suficiente pra detectar regressao acidental.

## Nao alterados (intencional)

- `components/AppShell.js` — pattern atual e adequado (horizontal scroll nav); refactor pra drawer adicionaria complexidade sem ganho proporcional.
- Blocos `@media` existentes em globals.css (linhas 1781, 1796, 2211, 2767, etc.) — sao fixes pontuais de grid/layout que continuam funcionando. Novo bloco e *aditivo*.
- Career roadmap CSS (linhas 5402-5575) — area de outro agente.

## Validacao

- `npm test` — 12/12 testes do novo `css-mobile.test.js` passam.
- Build com `AUTH_DEV_CREDENTIALS=` — sem novos warnings de CSS.

## Pendencias (out of scope deste audit)

- Touch drag-and-drop do Kanban: API HTML5 drag nao funciona em touch nativo. Considerar `react-dnd-touch-backend` ou solucao swipe-based em Wave futura. Hoje user pode trocar coluna via `<select>` no card, que e mobile-friendly (regra de no-zoom 16px ja garante UX).
- Visual regression real (Chromatic/Percy) so cobre quando Playwright e wirado pra mobile viewports.
