# Polish Audit — Arwen — 2026-06-25

> Wave 9 / Polish specialist component-by-component.
> Scope: granularidade do toque por componente — botões, cards, inputs,
> modais, badges, tooltips, dropdowns, microinterações, iconografia.
> Foco no que **um designer experiente notaria de primeira** (não 1px polish).

---

## Executive Summary

O sistema **tem boas peças, mas o polish está desigual**. Há padrões premium
(.btn-primary, .ct-microaction-cta com gradient + inset-top + glow no focus,
.appshell-notif-btn, Modal com fade+rise) convivendo com peças cruas
(.modal-x sem hover lift, .chat-input sem token de focus, .chat-starter com
transition genérica `.15s`, .iv-question/chip com border-radius 0/2px estilo
"editorial brutalist" preso na Wave 4).

Cinco problemas reais que vejo de primeira:

1. **Modal central (Modal.js) ficou pra trás.** Borda `1px solid var(--text)`
   (puro preto/branco), backdrop-filter só `blur(3px)`, .modal-x 30px sem
   afford de hover lift. A Wave 8 já trouxe glassmorphism + cyan glow em
   componentes adjacentes (drawer notif, copilot panel, achievement toast) —
   o Modal canônico não foi atualizado.
2. **Hover lift inconsistente entre famílias de botão.** -1px em btn-primary,
   site-btn-primary, tool-btn, appshell-notif-btn, conta-btn — mas -2px em
   cards clicáveis e .ct-copilot-fab faz `translateY(-2px) scale(1.04)`. Sem
   regra de "buttons -1px / cards -2px / FAB -2px+scale" explicitada — só
   acidente histórico.
3. **Chips/pills viraram um zoo.** Border-radius vai de 2px (.chip, .iv-chip,
   .falta-chip) a 999px (.ct-microaction-impact, .ct-source-chip) passando
   por 6/7/9/11px (.ct-job-chip 6px, .ct-skill-chip 7px, .ct-action-num 9px,
   .ct-source-card 11px). Coexistem duas filosofias visuais — "mono editorial"
   (sharp 2px + JetBrains Mono) e "premium pill" (radius-pill + Plus Jakarta).
4. **Inputs têm 4 designs de focus diferentes.** `.field input` usa
   `accent-wash` (legado), `.ct-conta-input` só border-color, `.ct-copilot-input`
   usa `--shadow-focus`, `.ct-onb-chat-input` combina shadow-focus + inset.
   Falta um pattern único.
5. **Loading state nos botões é só `texto + "…"`.** Nenhum spinner inline
   verdadeiro (Submetendo…, Avaliando…, Gerando pergunta…). Para um produto
   que se vende como "AI fará trabalho pesado", a ausência de spinner real é
   um polish que custa pouco e entrega muito.

---

## Inventário de componentes

### Botões — matriz comparativa

Family | File | Tipo | Hover lift | Active | Disabled | Loading | Border-radius | Padding | Easing | Notas
---|---|---|---|---|---|---|---|---|---|---
`.btn-primary` | globals.css:732-752 | App primary | -1px + cyan glow ring | scale(0.98) + translateY(0) | opacity .5 + cursor not-allowed + transform reset | ❌ (só texto "…") | `--radius-md` (10px) | 11px 20px | `--ease-standard` 180ms | Padrão sólido; **inset-top-light** premium
`.btn-ghost` | globals.css:754-770 | App secondary | -1px | scale(0.98) | herda .btn:disabled | ❌ | `--radius-md` | 11px 20px | 180ms | OK
`.site-btn-primary` | globals.css:6350-6380 | Landing primary | -1px + shadow expand + filter:brightness(1.04) | translateY(0) | ❌ | ❌ | `--radius-pill` (999px) | 16px 32px | `--ease-out-quart` 200ms | **Filosofia diferente** do .btn-primary
`.site-btn-secondary` | globals.css:6382-6407 | Landing secondary | -1px + bg shift | sem | ❌ | ❌ | `--radius-pill` | 16px 32px | 200ms | OK
`.tool-btn` | globals.css:1334-1360 | Header/toolbar | -1px | scale(0.98) | ❌ | ❌ | `--radius-md` | 9px 16px | 180ms | OK, segue padrão btn-ghost
`.appshell-notif-btn` | globals.css:3697-3727 | Icon button | -1px | ❌ (sem `:active`) | ❌ | ❌ | `--radius-md` | 38x38px (square) | 180ms | **Falta :active**
`.appshell-notif-close` | globals.css:3738-3739 | Icon close | ❌ (só color change) | ❌ | ❌ | ❌ | herdado | 0 4px | sem transition | **Polish fraco**
`.modal-x` | globals.css:1408-1414 | Modal close | ❌ (só bg/color) | ❌ | ❌ | ❌ | `--radius-sm` (6px) | 30x30px | sem transition | **Modal mais sério tem o close mais fraco**
`.ct-copilot-fab` | globals.css:5272-5298 | Floating FAB | -2px + scale(1.04) + bg gradient shift | ❌ | ❌ | ❌ | `28px` (= half de 56px = circle) | 56x56px | 220ms | **Único com scale no hover** — boa decisão, mas isolada
`.ct-copilot-close` | globals.css:5333-5339 | Drawer close | ❌ | ❌ | ❌ | ❌ | `--radius-sm` | 6px | 160ms | OK
`.ct-copilot-send` | globals.css:5411-5418 | Send arrow | bg darken | ❌ | opacity .4 | ❌ | 10px (custom, não token) | 40px wide | 160ms | **Radius custom 10px ≈ --radius-md (10px), poderia usar token**
`.ct-conta-btn` | globals.css:2620-2657 | Settings btns | -1px | ❌ | ❌ | ❌ | `--radius-md` | 10px 18px | 180ms | OK
`.ct-microaction-cta` | globals.css:3221-3249 | Action card CTA | -1px | scale(0.98) | opacity .6 + transform:none | ❌ (manual no JS) | `--radius-md` | 9px 18px | 180ms | **Padrão Linear** — usar como referência
`.ct-action-cta` (link) | globals.css:2774-2797 + 2924 | Action CTA | underline animado scaleX | ❌ | opacity .55 + cursor:progress | ❌ | n/a | n/a | 200ms | Underline animation lindo, raro no resto do app
`.ct-self-submit` | globals.css:4565-4566 | Self submit | -1px (bg darken) | ❌ | opacity sem `transform:none` | ❌ | n/a | n/a | n/a | **Inconsistente: outras versões resetam transform**
`.ct-tailor-btn-copy` | globals.css:3899-3919 | Copy btn | n/a (não testado) | scale(0.98) | ❌ | ❌ | n/a | n/a | n/a | (não fiz read completo)
`.chat-starter` | globals.css:1657-1670 | Chat suggestion | só border + color | ❌ | ❌ | ❌ | `--radius-sm` | 11px 14px | `.15s` (sem token) | **Transição inconsistente** (raw `.15s` em vez de `--ease-standard`)
`.ct-likert-btn` | globals.css:4423-4448 | Likert radio | border-color | n/a | n/a | n/a | n/a | n/a | n/a | (componente especializado)
`.ct-fit-ring-btn` | globals.css:3846-3849 | Ring toggle | só bg | n/a | n/a | n/a | `--radius-sm` | 4px 6px | 150ms | OK

**Padrão observado:** ~80% dos botões interativos seguem `-1px lift + shadow-md`,
mas há **5 botões core sem hover lift nenhum** (modal-x, appshell-notif-close,
copilot-close, conta-readonly, achievement-toast-close). Todos são "close
buttons" — afinal, "X" não precisa de hype, mas a falta de **qualquer**
afford visual pra esses tira o app do nível "Linear / Vercel" pro nível
"vanilla Bootstrap".

### Cards — matriz

Family | File | Hover state | Border-radius | Box-shadow base | Filosofia
---|---|---|---|---|---
`.app-glass` | globals.css:6587-6593 | n/a (utility) | `--radius-lg` (14px) | herdado | Glass para /app
`.site-card-glass` | globals.css:6312-6329 | bg + border + shadow | `16px` (hard-coded, ≠ token) | `--site-shadow-card` | Glass para /site
`.site-card-glass-accent` | globals.css:6331-6346 | bg + border + shadow | 16px (hard-coded) | --site-shadow-card | Glass com cyan accent
`.ct-action-card` | globals.css:2288, 2739-2748 | -2px + border-tint + shadow-md | `--radius-md` (10px) | `--shadow-sm` | Sólido clicável
`.ct-job-card` | globals.css:2447, 2739-2748 | -2px + ... | `--radius-lg` (14px) | --shadow-sm | Sólido clicável
`.ct-kpi-card` | globals.css:2344, 2750-2754 | -2px + ... | `--radius-md` (10px) | sem shadow base | Sólido clicável **(sem shadow inicial!)**
`.ct-rail-card` | globals.css:2394, 2763-2770 | só border-strong + shadow-md | `--radius-lg` | --shadow-sm | Informacional (sem lift)
`.ct-profile-card` | globals.css:2321, 2763-2770 | só border + shadow | `--radius-md` | --shadow-sm | Informacional
`.ct-conta-card` | globals.css:2597, 2763-2770 | só border + shadow | `--radius-lg` | --shadow-sm | Informacional
`.ct-chart-card` | globals.css:2407, 2763-2770 | só border + shadow | `--radius-lg` | --shadow-sm | Informacional
`.ct-req-card` | globals.css:2353, 2763-2770 | só border + shadow | `--radius-lg` | --shadow-sm | Informacional
`.ct-microaction-card` | globals.css:3252-3260 | -2px (mas só `:not(.done)`) | (não vi token, parece md) | (não vi) | Sólido clicável c/ estado done
`.ct-evidence-card` | mencionado em 2728 | -2px + ... | (não vi) | (não vi) | Sólido clicável
`.ct-empty-card` | globals.css:2298-2300 | sem hover | `--radius-md` | sem shadow | Informativo neutro
`.ct-dash-empty` | globals.css:2160-2186 | sem hover | `--radius-xl` (20px) | --shadow-md | Premium empty
`.ct-empty-state-v2` | globals.css:6216-6238 | sem hover | `--radius-lg` | sem shadow + dashed border | Alternativa cyan-accent
`.ct-formula-card` | globals.css:2038-2090 | (não vi hover) | `12px` (hard-coded) | (não vi) | Hard-coded radius
`.ct-source-card` | globals.css:2090-2099, 2756-2759 | só border + shadow | `11px` (hard-coded) | (não vi) | Hard-coded radius
`.ct-principle-card` | globals.css:2010-2030 | (não vi hover) | `12px` (hard-coded) | (não vi) | Hard-coded radius

**Padrão observado:** Cards clicáveis usam `-2px lift + shadow-md`; informacionais
usam só `border-strong + shadow-md` (sem lift) — **excelente decisão semântica**
(promete ação só quando há ação). Problema: **radius desalinhado** entre
.ct-formula-card (12px hard-coded), .ct-source-card (11px hard-coded),
.ct-action-card (--radius-md=10px), .ct-job-card (--radius-lg=14px). Não há
sistema "card pequeno → md, card grande → lg" — é histórico.

### Inputs / Forms — matriz

Family | File | Focus state | Border-radius | Padding | Notas
---|---|---|---|---|---
`.field input/textarea` | globals.css:687-703 | `accent-wash` shadow + text border | `--radius-sm` (6px) | 13px 14px | Legado Wave 1, accent-wash não tem token premium
`.iv-answer` | globals.css:1463-1474 | mesmo padrão `.field` | `--radius-sm` | 13px 14px | OK (cópia de .field)
`.chat-input` | globals.css:1699-1709 | mesmo padrão `.field` | `--radius-sm` | 12px 14px | **Padding 12px vs 13px nas outras** — inconsistente
`.ct-conta-input` | globals.css:2604-2605 | só border-color (sem ring) | `--radius-sm` | 10px 12px | **Não tem focus ring** — degradado vs Linear
`.ct-onb-chat-input` | globals.css:3687-3689 | `--shadow-focus` + border + inset shadow | `--radius-md` | 12px 14px | **Premium** — usar como referência
`.ct-copilot-input` | globals.css:5404-5410 | `--shadow-focus` + border | `10px` (hard-coded) | 10px 14px | Tem `:disabled` claro; radius hard-coded
`.ct-onb-builder textarea/input` | globals.css:3637-3661 | (não vi completo) | (não vi) | (não vi) | "Refresh visual" comment indica premium

**Inconsistência crítica:** `--shadow-focus` é o token universal mas só
.ct-onb-chat-input, .ct-copilot-input e .appshell-notif-btn usam. Os outros
(.field, .iv-answer, .chat-input) usam o legado `accent-wash` — antes do
sistema premium chegar.

Padding inconsistente (12/13/14/15px) entre inputs com mesma altura visual.

Label position: todas as labels são **above** (uppercase mono 10px+letter-spacing).
Consistente.

Placeholder color: .ct-onb-chat-input explicita `color: var(--text-faint);
opacity: 0.85`. Outros usam default do browser — diferente entre Chrome/Safari.

**Required marker (*):** Não vi `[required]` styling no CSS. Provavelmente
ausente.

### Modais / Drawers — matriz

Item | File | Backdrop blur | Animação | Border-radius | Close button | Notas
---|---|---|---|---|---|---
`.modal-overlay` | globals.css:1365-1374 | `blur(3px)` | fadein .2s | n/a | n/a | **Blur fraco** (3px vs 16-20px de glass moderno)
`.modal` | globals.css:1376-1384 | n/a | rise .3s ease | `--radius-sm` (6px) | .modal-x 30x30 | **Border `1px solid var(--text)` puro preto/branco** — visual brutalist preso na Wave 4
`.modal-x` | globals.css:1408-1414 | n/a | n/a | `--radius-sm` | 30x30 | Sem hover lift, sem :active feedback, sem transition listed (herda nada). Sem `aria-busy` indicator
`.appshell-notif-drawer-bg` | globals.css:3730 | só scrim (sem blur) | n/a | n/a | n/a | **Sem blur** — drawer perde "depth"
`.appshell-notif-drawer` | globals.css:3731-3735 | inline glass via JS (component) | ctNotifSlide .28s | flat (sem radius) | × char inline | Componente injeta `app-glass` + cyan border via style — bom, mas **flag fora do CSS** (glassmorphism deveria estar no .css base)
`.ct-copilot-panel` | globals.css:5301-5319 | inline glass via JS | copilotIn 220ms | `--radius-lg` | .ct-copilot-close | Inline `app-glass` no JSX em vez de CSS — mesma issue do drawer
`.ct-achievement-toast` | globals.css:2680-2690 | inline glass via JS | achievementToastIn 0.4s | `--radius-lg` | .ct-achievement-toast-close | Inline glass

**Padrão observado:** Os 3 componentes "secundários" (notif drawer, copilot,
toast) ganharam refresh glassmorphism via inline style no JS na Wave 8 — o
Modal canônico não foi tocado. Resultado: o componente **mais usado** (gates
de Tailor, Interview, Welcome, OutcomeSurvey, Chat) ficou com o look mais
datado.

Backdrop blur:
- .modal-overlay: 3px (muito fraco)
- .appshell-notif-drawer-bg: 0px (sem blur, só scrim)
- .ct-copilot-panel: backdrop só no app-glass do JS

Border-radius do modal: `--radius-sm` (6px) — pequeno demais para um dialog
grande de 560-680px wide. Drawer notif é flat 0, copilot é `--radius-lg`,
toast é `--radius-lg`. **Inconsistente.**

Close button alignment: .modal-x e .appshell-notif-close usam `&times;` HTML
entity; .ct-achievement-toast-close usa `&times;`; .ct-copilot-close usa SVG.
4 estilos de "X" em 4 lugares.

Header padding:
- .modal-head: 24px 26px 16px
- .appshell-notif-drawer-head: 18px 22px
- .ct-tailor-modal-head: 22px 26px
- .ct-copilot-header: 14px 18px

Footer com CTAs: WelcomeModal usa flex justify-end com gap 10 inline; outros
modais não têm padrão.

### Badges / Chips / Tags — zoo completo

Item | File | Radius | Padding | Font | Uppercase
---|---|---|---|---|---
`.chip` | globals.css:864-872 | `2px` | 4px 9px | mono 10.5px .05em | ❌
`.chip.tgt` | globals.css:873 | `2px` | herdado | herdado | ❌
`.iv-chip` | globals.css:1518-1527 | `2px` | 3px 8px | mono 10.5px .04em | ❌
`.falta-chip` | globals.css:1209-1214 | `2px` | (não vi) | (não vi) | (não vi)
`.iv-qtag` | globals.css:1436-1446 | `2px` | 3px 8px | mono 9.5px .16em | ✓
`.iv-method` | globals.css:1478-1488 | `--radius-sm` (6px) | 5px 10px | mono 10.5px .1em | ✓
`.ct-skill-chip` | globals.css:2332 | `7px` | 4px 9px | 11.5px sans | ❌
`.ct-job-chip` | globals.css:2467 | `6px` | 3px 8px | 11px sans | ❌
`.ct-source-chip` | globals.css:2436 | `999px` | 4px 10px | 11.5px sans .01em | ❌
`.ct-action-tag` | globals.css:2295 | `7px` | 4px 9px | 11px sans | ❌
`.ct-action-impact` | globals.css:2292 | `6px` | 3px 7px | 11px sans | ❌
`.ct-microaction-impact` | globals.css:3183 | `--radius-pill` | 4px 10px | 11px sans 800w | ❌
`.ct-microaction-priority` | globals.css:3184 | `--radius-pill` | 4px 10px | 10px sans 800w .05em | ✓
`.ct-microaction-course-free` | globals.css:3214 | `--radius-pill` | 2px 7px | 9.5px sans .04em | ✓
`.ct-microaction-label` | globals.css:3181 | (não é chip, label) | n/a | 10.5px 800w .06em | ✓
`.ct-conta-badge` | globals.css:2607-2618 | `--radius-pill` | 4px 11px | 10.5px sans 800w .06em | ✓
`.live-pill` | globals.css:608 | (não vi) | (não vi) | (não vi) | (não vi)
`.ct-target-pill` | globals.css:2136 | (não vi) | (não vi) | (não vi) | (não vi)
`.ct-filter-pill` | globals.css:2544-2570 | `--radius-md` | 8px 13px | 12.5px 600w | ❌ (acts as button)
`.ct-skill-pill` | globals.css:3050-3074 | `--radius-pill` | (não vi) | (não vi) | (não vi)

**Padrão observado:** Coexistem dois sistemas:
- **Editorial brutalist (Wave 1-4):** radius 2px, font-mono uppercase com
  letter-spacing 0.05-0.16em — .chip, .iv-chip, .iv-qtag, .falta-chip.
- **Premium pill (Wave 6+):** radius-pill ou 6-7px, font-body sans 600-800w,
  às vezes uppercase — .ct-microaction-impact, .ct-source-chip, .ct-conta-badge.

Não há regra explícita de "quando usar qual". O resultado é que o
.iv-question (interview modal) e .ct-microaction-card (dashboard) renderizam
chips com **filosofias visuais opostas** lado a lado se vistos em sequência.

### Tooltips / Dropdowns

Item | File | Background | Animação | Pointer / arrow
---|---|---|---|---
`.info-tip::after` | globals.css:604-607 | `var(--text)` solid | opacity .15s | sem arrow
`.ct-skill-graph-tooltip` | globals.css:5466-5485 | `var(--surface)` solid | sem animação | sem arrow
`.ct-filter-pill-select` (dropdown nativo) | globals.css:2575-2592 | n/a (native) | n/a | chevron via SVG bg
`.ct-filter-select` | globals.css:2443 | n/a (native) | n/a | sem chevron

**Padrão observado:** Não há sistema de tooltip — só `.info-tip` (legado,
black solid box) e `.ct-skill-graph-tooltip` (surface card). Selects nativos
não têm chevron consistente (filter-pill-select tem, filter-select não).

### Micro-interações

Estado | Implementação | Onde existe | Onde **falta**
---|---|---|---
Skeleton loading | `.ct-skeleton`, `.ct-skel-card`, `.ct-skeleton-ring` | dashboard, vagas | /carreira, /transparencia, /privacidade, /cvs-adaptados
Spinner inline (em botão) | **NÃO EXISTE** | n/a | TODOS os submits ("Avaliando…", "Enviando…", "Gerando…")
Toast notifications | `.ct-achievement-toast` (premium glass) + `.ct-refresh-toast` (texto simples) | NotificationsBell, dashboard refresh | acoes de save/delete em /cvs-adaptados, /conta
Empty states | `.ct-dash-empty`, `.ct-empty-state-v2`, `.ct-empty-card`, `.ct-copilot-empty` | dashboard, vagas, copilot | candidaturas/[id], evidencias sem dados
Scroll reveals | `.site-fade-up` (IntersectionObserver via data-fade) | landing only | **AUSENTE em /app/** (dashboard, carreira, etc — entram "secos")
Spotlight/cursor glow | `.site-cursor-glow` | landing only | n/a (decidido não levar pro app)
Pulse / breathe | `copilotPulse` (FAB), AccentPulse, NotificationsBell drop-shadow inline | copilot FAB, sino com unread | dashboard score ring, scoreboard
Underline animado | `.ct-action-cta::after` scaleX | dashboard actions | links de "ver mais" em outras páginas
Confetti | `.ct-confetti-piece` (achievement toast) | toast achievement | comemoração de gap completed (microaction done não usa)
Achievement done state | `.ct-microaction-cta.done` gradient verde | microactions | n/a (existe)
Progress bar shimmer | `.ct-skeleton` background-position | só skeleton | progress bars reais (.ct-progress-bar) não têm shimmer no preenchimento

### Iconography

Source | Sizes (px) | Stroke-width | Style
---|---|---|---
SVG `width=16` | 7 usos (Footer, Report, ThemeToggle) | 1.8 / 2 | outlined
SVG `width=18` | 1 (SiteNav) | 2 | outlined
SVG `width=19` | NavIcon (AppShell), BellIcon (Notif) | 1.8 | outlined
SVG `width=20` | 1 (SiteNav menu) | 2 | outlined
SVG `width=22-24` | CopilotWidget (FAB icon) | 2 / 2.4 | outlined
SVG `width=14-15` | SiteHero arrow, SiteFaq chevron, Report arrow | 2 / 2.4 | outlined
SVG `width=12` | SiteFaq | 2.4 | outlined

Stroke-widths usados: 1, 1.2, 1.5, 1.6, 1.8, 2, 2.2, 2.4 — **8 valores
distintos** sem regra. Distribuição: 13× 1.6 (mais comum), 10× 2.0, 6× 2.4,
4× 1.8.

Não há regra "16px → 1.5, 20px → 1.8, 24px → 2.0". É histórico.

Style: 100% outlined — bom, é consistente.

Color: maioria `currentColor` ou `var(--text-muted)`. Padrão correto.

---

## Findings

### P0 — Inconsistências gritantes

**P0-A. Modal core (Modal.js) ficou pra trás vs todos os outros dialogs.**
- Evidência: `globals.css:1376-1415` vs `globals.css:5301-5318` (copilot),
  `globals.css:3731` (drawer), `globals.css:2680` (toast).
- Sintoma: Borda `1px solid var(--text)` (preto absoluto), backdrop só
  `blur(3px)`, border-radius `--radius-sm` (6px, muito pequeno pra dialog).
  Compare com copilot panel que tem `--radius-lg` + glass blur 16px + cyan
  border-glow.
- Impacto: Welcome, Tailor, Chat, Interview, OutcomeSurvey, Refresh (todos
  os modais críticos do app) renderizam com look "Wave 4 brutalist" enquanto
  o copilot ao lado renderiza "Wave 8 premium".

**P0-B. Modal-x e os 4 close buttons sem hover lift / active feedback.**
- Evidência: `globals.css:1408-1414` (`.modal-x`), `:3738-3739`
  (`.appshell-notif-close`), `:3739` (`.ct-copilot-close`),
  `:2690-2691` (`.ct-achievement-toast-close`).
- Sintoma: Todos só mudam cor no hover. Nenhum tem `:active` feedback. Sem
  border-radius animado, sem rotate sutil, nada.
- Impacto: 4 "close buttons" que aparecem em **todo modal/drawer** do app
  ficam visualmente mortos quando interagidos.

**P0-C. Hover lift / scale inconsistente entre famílias.**
- Evidência: 26 ocorrências de `translateY(-1px)` (botões/inputs) +
  6 de `translateY(-2px)` (cards e .ct-copilot-fab que ainda combina com
  `scale(1.04)`).
- Sintoma: Sem regra documentada. .ct-achievement-card também usa -2px (é
  card, OK). Mas .ct-copilot-fab é botão e usa -2px + scale.
- Impacto: Inconsistência sutil mas perceptível em sequência (ex.:
  dashboard com microaction-cta -1px ao lado de microaction-card -2px e
  rail-card 0). Ok pra hierarquia se intencional, mas **não está documentado
  no CSS** — sem comentário "botão = -1px, card = -2px, hero = -2px+scale".

**P0-D. Chips/badges com 2 filosofias coexistindo.**
- Evidência: 5 chips com `border-radius: 2px` + font-mono uppercase
  (`.chip`, `.iv-chip`, `.iv-qtag`, `.falta-chip` legados) vs 8 chips com
  `--radius-pill` + sans + às vezes uppercase
  (`.ct-microaction-impact`, `.ct-microaction-priority`, `.ct-source-chip`,
  `.ct-conta-badge`, `.ct-microaction-course-free`).
- Sintoma: Modal de Interview (.iv-chip 2px mono) abre **em cima** do
  dashboard que tem .ct-microaction-impact (radius-pill sans). Cena visual
  conflitante.
- Impacto: Falta um chip system unificado. Galadriel cobre tokens, mas
  componente granular é meu — recomendo migrar chips legados pro premium.

### P1 — Polish faltando em componente core

**P1-A. Loading state nos botões: ZERO spinners inline.**
- Evidência: ChatModal.js:78 `disabled={loading}` + texto sem spinner;
  InterviewModal.js:93-96 `"Avaliando…"` texto;
  OutcomeSurveyModal.js:281 `"Enviando…"` texto.
- Sintoma: Botão fica disabled + texto muda. Sem feedback visual de
  "processando". Para um produto IA-heavy onde requests podem demorar 5-10s
  (gerar pergunta de interview, avaliar resposta, gerar microação), é
  contra-intuitivo não ter spinner.
- Impacto: User clica, vê "Avaliando…", e não sabe se está rodando ou
  travou. Designer experiente vê isso como "MVP inacabado".

**P1-B. Inputs com 4 padrões de focus state.**
- `--accent-wash` legado: `.field`, `.iv-answer`, `.chat-input`
- só border-color: `.ct-conta-input` (não tem ring sequer)
- `--shadow-focus` token: `.ct-copilot-input`, `.ct-onb-chat-input`,
  `.appshell-notif-btn`
- inset + shadow-focus: `.ct-onb-chat-input` (única com depth fingerprint)

Migração trivial mas **muda a perceived quality** de "OK" pra "Linear-grade".

**P1-C. Backdrop blur fraco no Modal central.**
- `globals.css:1368`: `backdrop-filter:blur(3px)`
- Compare: copilot/notif/toast usam `var(--app-glass-blur)` = 16px (light)
  / 8px (dark) / 8px (noir).
- 3px é o "blur Wave 1". Premium produtos usam 16-24px.

**P1-D. Notif drawer NÃO TEM blur no backdrop.**
- `globals.css:3730`: `.appshell-notif-drawer-bg { background: var(--scrim) }`
  — sem `backdrop-filter`.
- Compare: `.modal-overlay` tem 3px. Inconsistente.

**P1-E. Required marker e error state em forms.**
- Não vi estilo CSS para `:required`, `:invalid`, ou `aria-invalid`.
  OutcomeSurveyModal.js:255 mostra error como `<p style={{color: 'var(--negative)'}}>` inline — sem padding/border/icon.
- Convenção `<label>foo *</label>` provavelmente está nas pages, mas o `*`
  não tem styling específico (cor `--attention-deep`, font-weight 800).

### P2 — Microinterações faltando em pontos-chave

**P2-A. /dashboard entra "seco" sem reveals.**
- `.site-fade-up` existe (globals.css:6475) e é usado nas landing pages.
- /dashboard, /carreira, /evidencias, /vagas: cards entram instantaneamente.
- Recomendação: usar `data-fade` (IntersectionObserver já tem) em cards
  principais do dashboard — stagger 50ms entre cards de microação.

**P2-B. Microaction "done" não comemora.**
- `globals.css:3168-3173`: `.ct-microaction-check.done` muda cor/border/bg.
  `.ct-microaction-cta.done` muda gradient. Mas **sem confetti** (apesar do
  `.ct-confetti-piece` já existir no AchievementToast).
- Strava/Duolingo: ao completar microação, **pequeno confetti localizado**
  no botão done. Já temos a infra; só falta wire-up.

**P2-C. Progress bars sem shimmer de movimento.**
- `.ct-progress-bar-fill`, `.ct-formula-bar-fill`, `.ct-ss-bar-fill`,
  `.ct-req-bar-fill`: todas têm `transition: width 600ms ease`. Boa.
- Mas nenhuma tem **shimmer overlay** durante a animação (efeito metade
  pra dar "energia" durante o crescimento). Linear, Notion, Vercel fazem.

**P2-D. Sem ripple ou wave em ações destrutivas.**
- `.ct-tailor-btn-delete` (globals.css:3920-3922): só border + bg. Quando
  user clica em "Apagar adaptação" não há **shake** ou **wave vermelho**
  saindo do botão sinalizando ação irreversível.
- Convenção GitHub/Linear: ações destrutivas ganham micro-shake quando
  confirmadas (rejeita o "auto-confirm" muscle memory).

**P2-E. Bell icon sem badge counter pulse.**
- `NotificationsBell.js:222-232` aplica `boxShadow` cyan-glow no badge.
  Bom! Mas o **número** não pulsa quando muda de 0 → 1 (ex.: nova notif
  chegou enquanto user está na página).
- Opcionalmente o badge deveria animar bounce-in (scale 1 → 1.3 → 1) ao
  aparecer.

**P2-F. ThemeToggle sem animação de troca.**
- `ThemeToggle.js`: 3 SVGs (sun/moon/noir) que trocam instantaneamente.
  Sem cross-fade, sem rotate.
- Linear/Vercel fazem sun→moon com rotate(180deg) + fade. Polish trivial.

### P3 — Detalhes

**P3-A. Border-radius hard-coded em vez de tokens.**
- `.ct-formula-card`: `12px` (não bate com nenhum token, --radius-md=10 ou --radius-lg=14)
- `.ct-source-card`: `11px` (estranho — não é token nem múltiplo)
- `.ct-action-num`: `9px`
- `.ct-job-logo`: `--radius-md` ✓ OK
- `.site-card-glass*`: `16px` hard-coded (deveria ter `--radius-2xl` ou usar --radius-xl=20px)
- `.ct-copilot-send`, `.ct-copilot-input`: `10px` (= --radius-md mas escrito raw)
- `.ct-onb-chat-question`: `12px` (hard-coded)
- `.saved-cta`: presumivelmente também
- 13 outras ocorrências de border-radius raw (2px, 4px, 6px, 11px, 12px)
  além das já listadas.

Recomendação: criar `--radius-xs: 2px` (pra brutalist chips) e migrar
12/11/9 pra `--radius-md` (10px) com tolerância visual aceitável.

**P3-B. Easing inconsistente entre componentes.**
- `--ease-standard: cubic-bezier(0.4, 0, 0.2, 1)` — usado em ~25 lugares.
- `--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1)` — usado nos site-* e
  toast.
- Raw `.15s`, `.2s`, `220ms ease`, `400ms ease`, `200ms ease`, `300ms ease`
  espalhados.
- `.chat-starter` (globals.css:1668): `transition:.15s` — sem token.
- `.iv-chip`: sem transition explícita.

**P3-C. Inset white edge (`--inset-top-light`) só nos primary buttons.**
- Token premium criado pra "glassy feel" mas só aparece em .btn-primary,
  .ct-conta-btn.primary, .ct-microaction-cta. Cards premium (.ct-job-card,
  .ct-microaction-card) não usam — perdem opportunity de depth real.

**P3-D. Icon position vs text gap inconsistente.**
- `.btn`: gap 9px
- `.btn-primary` (herda): gap 9px ✓
- `.site-btn-primary`: gap 8px
- `.ct-microaction-cta`: sem gap definido (sem `display:inline-flex`?)
- `.tool-btn`: gap 9px ✓
- `.ct-conta-btn`: gap 7px
- `.ct-filter-pill`: gap 7px

Mistura 7/8/9px. Pequeno mas visível em comparação direta.

**P3-E. Stroke-width SVG sem regra de tamanho.**
- 16px ícones: 1.8 (Bell, Notes) e 2 (Theme, Footer)
- 18px: 2
- 19px: 1.8 (Nav, Bell)
- 22-24px: 2 / 2.4
- 14-15px: 2 / 2.4

Recomendação: estabelecer `≤16px → 2`, `18-24px → 1.8`, `≥24px → 1.5`.
Não é dogma, mas o "1.8 em 24px com 2 em 16px" do CopilotWidget gera leves
"icons mais fortes ali do que aqui" sem motivo.

**P3-F. Modal close uses `&times;` HTML entity (×) com font/size diferente do contexto.**
- `.modal-x`: usa `✕` no JSX (Modal.js:65) — caractere Unicode U+2715.
- `.appshell-notif-close`: usa `&times;` HTML entity (= ×, U+00D7).
- `.ct-achievement-toast-close`: usa `&times;` HTML entity.
- `.ct-copilot-close`: usa SVG path próprio.

4 caracteres diferentes (✕ vs × vs SVG), com cápsulas de font-size também
diferentes (14px vs 22px vs 22px).

**P3-G. WelcomeModal cards são inline-style improvisados.**
- `WelcomeModal.js:171-213`: cards de "Diagnóstico/Gaps/Vagas" são
  divs com style inline (border, padding, radius, background hard-coded).
- Não usa `.app-glass` nem `.ct-action-card`. Cor accent inline (`#4F46E5`,
  `#06B6D4`, `#8B5CF6`) — fora do token system.
- Deveria reusar uma classe existente ou ganhar uma `.welcome-card`.

**P3-H. Drawer notification item indica "novo" duas vezes redundante.**
- CSS (`globals.css:3741`): `.appshell-notif-item` (unread) tem `background:
  var(--primary-soft)`.
- JS (`NotificationsBell.js:298-302`): aplica `border-left: 2px solid
  var(--accent-cyan)` inline em items unread.
- Resultado: bg purple + border-left cyan. Cores não harmonizam (primary-soft
  é indigo wash, accent-cyan é verde-azulado). Pick one.

---

## Microinterações ausentes em pontos-chave

Priorizadas por valor de retenção / "vibe Strava/Duolingo":

1. **Spinner inline em todos os submits IA-heavy.** (P1-A) — Cada modal
   tem 5-10s de wait. ROI brutal. Adicionar `<svg class="btn-spinner">`
   ao lado do texto disabled. Animation `spin 1s linear infinite` já
   existe no `.proc-ring` (linha 784).

2. **Microaction done = confetti localizado** no botão. (P2-B) — Infra
   pronta (`.ct-confetti-piece`). Wire-up: ao clicar done, render 6
   `.ct-confetti-piece` absolute positioned dentro do `.ct-microaction-cta`.

3. **Score ring breathing.** Dashboard score 0-100 fica estático. Pulse
   sutil (0.5% scale) a cada 4s daria "produto vivo".

4. **Theme toggle rotate.** (P2-F) — Sun → moon com `rotate(180deg)
   transition: 300ms`. Trivial e leitura imediata.

5. **Card reveals no /dashboard.** (P2-A) — Reusar `.site-fade-up` +
   `data-fade` + IntersectionObserver já existente. Stagger 50ms entre
   cards de microação.

6. **Progress bar shimmer durante crescimento.** (P2-C) — `.ct-formula-bar-fill`
   ganha `::after` que viaja da esquerda pra direita uma vez quando
   `width` muda. Já temos animação `ctSkelShim`.

7. **Bell badge bounce-in.** (P2-E) — Quando `unreadCount` muda de 0 → ≥1,
   `@keyframes badgeBounce { from { scale: 0 } 60% { scale: 1.3 } to { scale: 1 } }`.

8. **Hover spotlight em cards informacionais.** Glow sutil seguindo cursor
   (`.site-cursor-glow` já existe). Trazer pra /app/ — em .ct-rail-card e
   .ct-job-card. (Não em todos — só nos hero cards do dashboard.)

9. **Tooltip system unificado.** Componente `<Tooltip text="…" placement="top">`
   substituindo `.info-tip` legado. Background glass, arrow pointer, animação
   200ms ease-out-quart.

10. **Delete action shake.** (P2-D) — `.ct-tailor-btn-delete:focus`
    ganha `animation: shake 200ms ease-out` na confirmação.

---

## Roteiro de teste manual

Lista pra QA visual rápido (15-20min se feita lado a lado em dual monitor):

- [ ] Hover em 6 botões diferentes (`.btn-primary`, `.site-btn-primary`,
  `.tool-btn`, `.appshell-notif-btn`, `.ct-conta-btn`, `.ct-copilot-fab`):
  todos liftam? Magnitude consistente entre os "app" ones?
- [ ] Hover em 5 cards diferentes (`.ct-action-card`, `.ct-job-card`,
  `.ct-rail-card`, `.ct-profile-card`, `.ct-microaction-card`): clicáveis
  liftam -2px, informacionais ganham só border + shadow?
- [ ] Click em CTA primary → tem feedback `:active` (scale 0.98 + translateY 0)?
- [ ] Submeter form (Interview avaliar, Chat enviar, Outcome survey enviar)
  → texto muda mas há spinner visual? **Hoje a resposta é NÃO.**
- [ ] Tab navigation em 1 form completo (ex.: /conta): focus ring visível
  e consistente em todos os inputs?
- [ ] Abrir 3 modais (Welcome, Interview, Tailor) em sequência: backdrop
  blur consistente? Border-radius do dialog igual? Posição/size do close
  consistente? **Hoje a resposta é NÃO em todos.**
- [ ] Abrir notif drawer + copilot panel + achievement toast: 3 níveis de
  glassmorphism. Coerente?
- [ ] Inspecionar chips em /carreira/[role] vs /vagas vs Interview modal:
  filosofia visual coerente?
- [ ] Disable button em form (campo vazio): visualmente claro que tá
  disabled? Cursor não-allowed?
- [ ] Reduced motion (browser pref): TODOS os transforms desligam? Score
  ring para de pulsar? Toast aparece sem slide?
- [ ] Theme switch sun→moon→noir: cada mudança tem transição? **Hoje NÃO.**
- [ ] Empty state em 4 contextos diferentes (dashboard sem CV, vagas sem
  matches, candidaturas sem itens, copilot sem mensagens): cada um tem
  arte? Ou é texto cinza chapado?

---

## Recomendações priorizadas

### Sprint Polish 1 (1-2 dias, alto ROI)

1. **Wave 9.1 — Modal core upgrade.** Migrar `.modal` pra glassmorphism
   alinhado ao copilot/notif/toast. Bordas `--app-glass-border` em vez de
   `var(--text)`. Backdrop blur 16px. Border-radius `--radius-lg`. Close
   button ganha hover lift + transition. Resolve P0-A + P0-B + P1-C + P3-F.
2. **Wave 9.2 — Spinner inline universal.** Adicionar `.btn-spinner` CSS
   reusável + componente `<ButtonSpinner />` JS. Substituir todos os
   "Enviando…", "Avaliando…", "Gerando…" por texto + spinner. Resolve P1-A.
3. **Wave 9.3 — Focus state unificado em inputs.** Migrar `.field`,
   `.iv-answer`, `.chat-input`, `.ct-conta-input` pro padrão de
   `.ct-onb-chat-input` (inset depth + `--shadow-focus`). Resolve P1-B.

### Sprint Polish 2 (2-3 dias, valor "vibe Strava/Duolingo")

4. **Wave 9.4 — Chip system unification.** Decidir entre brutalist (2px
   mono) ou premium (radius-pill sans). Sugiro: **manter ambos com semântica
   clara** — brutalist só em contextos de "alvo/tag editorial" (Interview
   .iv-qtag, .chip.tgt), premium em todo "impact/priority/status badge"
   (microaction, conta, source). Documentar no globals.css.
5. **Wave 9.5 — Microação done com confetti localizado.** Wire-up do
   `.ct-confetti-piece` já existente. Cria valor emocional alto pra cost
   técnico baixo.
6. **Wave 9.6 — Reveals no /app/.** Levar `data-fade` pra dashboard,
   /carreira, /evidencias. Stagger 50ms entre cards.

### Sprint Polish 3 (1-2 dias, detalhes finos)

7. **Wave 9.7 — Stroke-width SVG normalize.** Estabelecer regra
   por tamanho + migrar inconsistências em CopilotWidget, SiteHero, SiteFaq.
8. **Wave 9.8 — Border-radius token cleanup.** Substituir hard-coded
   2/9/10/11/12/16 por tokens. Considerar adicionar `--radius-xs: 2px` e
   `--radius-2xl: 16px`.
9. **Wave 9.9 — Theme toggle animation.** rotate(180deg) + cross-fade na
   troca de tema. ~20 linhas.
10. **Wave 9.10 — Required marker + error state.** `.field label.required::after
    { content: "*"; color: var(--attention-deep); }` + `.field.has-error
    input { border-color: var(--negative); }`.

### Out of scope (intencional)

- Tokens de cor / design system macro: **Galadriel** cobre.
- Tipografia hierarchy: **Wave 6** já consolidou em /dashboard, /carreira,
  /plano, /evidencias, /autoconhecimento.
- Brand visual / marca: **Lúthien** cobre.
- Bugs funcionais: **Faramir** cobre.

---

## Referência rápida — Tokens que deveriam estar sendo usados (mas não estão sempre)

```
--radius-sm: 6px       → inputs, modal-x, small buttons
--radius-md: 10px      → buttons médios, cards pequenos
--radius-lg: 14px      → cards grandes, modais
--radius-xl: 20px      → empty states premium
--radius-pill: 999px   → pills/badges premium
                       → (faltando: --radius-xs: 2px e --radius-2xl: 16-18px)

--shadow-sm           → cards base, botões secundários
--shadow-md           → hover de cards, depth média
--shadow-lg           → drawers, FAB, panels
--shadow-xl           → modal/toast (atualmente raro)
--shadow-focus        → focus ring universal (USAR EM TODOS OS INPUTS)
--inset-top-light     → buttons primary (estender pra cards premium?)

--ease-standard       → micro-interações (180-220ms)
--ease-out-quart      → entradas de panel/toast (250-400ms)
                       → (eliminar todos os raw .15s / .2s / 200ms ease)
```

— Arwen, filha de Elrond. Wave 9. Polish granular. Research-only.
