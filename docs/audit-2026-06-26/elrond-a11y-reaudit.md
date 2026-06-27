# Accessibility Re-Audit — Elrond — 2026-06-26 — WCAG 2.2 AA + AAA críticos

Auditor: Elrond (Wave 11, defesa defensiva)
Branch: `redesign/claude-design`
Escopo: Validar fixes Wave 10A (Galadriel-foundation `4b20db0` + Faramir-bugs `60f8096`) + novos componentes (SrcChip) + regressões introduzidas. RESEARCH-ONLY.

Comparação contra: `docs/design-audit/elrond-accessibility-2026-06-25.md` (Wave 9, APROVADO COM RESSALVAS).

---

## Executive Summary

**Veredito: Wave 10A MELHOROU contraste de texto base, MAS introduziu/expôs regressões P0 graves em tema NOIR.**

| Eixo | Wave 9 | Wave 10A | Delta |
|---|---|---|---|
| `--text-muted` light | 4.48:1 FAIL | **5.90:1 AA ✓** | RESOLVIDO (Galadriel claimed 5.7:1; real 5.90) |
| `--text-faint` light | 2.41:1 FAIL | **4.70:1 AA ✓** | RESOLVIDO (claimed 4.6; real 4.70) |
| `--text-faint` dark | 2.94:1 FAIL | **5.87:1 AA ✓** | RESOLVIDO (claimed 5.8; real 5.87) |
| `--site-fg-dim` | 3.98:1 FAIL | **6.62:1 AA ✓** | RESOLVIDO (bonus fix não documentado no brief) |
| Skip link em noir | invisível | **20.12:1 AAA ✓** | RESOLVIDO |
| `--on-primary` adoção em `.btn-primary` | só `.btn-primary` | apenas 1 de ~30 botões | **PARCIAL — 29 botões custom ainda hardcodam `#fff`** |
| Modal canonical focus trap | OK | OK | mantido |
| 3 modais ad-hoc focus trap | aberto | **aberto** (RefreshDiagnosis, CvDetailClient tailor, NotificationsBell drawer) | aberto |
| NotificationsBell `<li onClick>` | aberto | **aberto** | aberto |
| SiteNav mobile ESC | aberto | **aberto** | aberto |

**Achados novos P0 introduzidos/expostos por Wave 10A:**
1. **29 instâncias de `color:#fff` hardcoded sobre `var(--primary)`**, `var(--positive)` e `var(--attention)` continuam — em NOIR esses tokens são quase-brancos (#FAFAFA / #E5E5E5 / #A8A8A8) → contraste **1.04 a 2.38:1**, texto **invisível**. Galadriel só fixou `.btn-primary`. Os outros 29 continuam quebrados.
2. **`.appshell-avatar` (default desktop+mobile) usa `color:#fff` sobre `linear-gradient(var(--avatar-from), var(--avatar-to))`** — em NOIR avatar-to=#E5E5E5, inicial do user fica **invisível (1.26:1)**.
3. **`.brand-mark` legacy CSS (linha 601) `color:#fff` sobre `linear-gradient(var(--primary-light), var(--primary-deep))`** — em NOIR ambos são quase-brancos, **logo fica invisível**. (`BrandMark` no AppShell foi fixado pela Faramir via SVG `currentColor`, mas a classe CSS `.brand-mark` no globals.css continua quebrada.)

---

## Eixo 1 — Contraste validado (cálculos manuais WCAG 2.x)

### Metodologia (verificável)

Fórmula WCAG 2.x:
```
Para cada componente RGB (0-255 → 0-1):
  if c <= 0.03928: linear = c / 12.92
  else: linear = ((c + 0.055) / 1.055) ** 2.4
L = 0.2126*R + 0.7152*G + 0.0722*B
ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

Tokens RGBA (texto noir) compostos via alpha-blend sobre `--bg` antes do cálculo:
`blended[i] = int(fg[i]*alpha + bg[i]*(1-alpha))`

### Fixes Wave 10A — verificação

| Token | Wave 9 valor | Wave 10A valor | Galadriel "alegou" | Calculado real | Verdict W11 | Comparação |
|---|---|---|---|---|---|---|
| Light `--text-muted` sobre `--bg` | `#6B7180` on `#F6F5F2` = 4.48:1 FAIL | `#5A5F6D` on `#F4F6FA` | 5.7:1 ✓ | **5.90:1** | **AA** ✓ | Real ligeiramente melhor que alegado (+0.20) |
| Light `--text-faint` sobre `--bg` | `#9CA0AE` on `#F4F6FA` = 2.39:1 FAIL | `#6A6E7B` on `#F4F6FA` | 4.6:1 ✓ | **4.70:1** | **AA** ✓ | Real igual ao alegado (+0.10) |
| Dark `--text-faint` sobre `--bg` | `#5C6171` on `#0D1117` = 3.07:1 FAIL | `#8A8FA0` on `#0D1117` | 5.8:1 ✓ | **5.87:1** | **AA** ✓ | Real igual ao alegado (+0.07) |
| Dark `--text-muted` (não tocado) | `#8A8FA1` on `#0D1117` | igual | — | **5.88:1** | **AA** ✓ | já passava, mantido |
| Light `--text-soft` | `#797585` ~4.1:1 | `#4A4D63` on `#F4F6FA` | — | **7.66:1** | **AAA** ✓ | Galadriel reforçou hierarquia (soft mais escuro que muted) |
| Light `--text` | — | `#1A1B2E` on `#F4F6FA` | — | **15.65:1** | **AAA** ✓ | baseline |
| Dark `--text-soft` | — | `#C9CDD8` on `#0D1117` | — | **11.90:1** | **AAA** ✓ | baseline |
| Dark `--text` | — | `#F0F2F6` on `#0D1117` | — | **16.88:1** | **AAA** ✓ | baseline |

**Noir (alpha-blended antes do cálculo):**

| Token | Composição | Verdict |
|---|---|---|
| Noir `--text-muted` rgba(250,250,250,0.65) sobre `#000` | blended `rgb(162,162,162)` | **8.23:1 AAA ✓** |
| Noir `--text-soft` rgba(250,250,250,0.78) sobre `#000` | blended `rgb(195,195,195)` | **11.91:1 AAA ✓** |
| Noir `--text-faint` rgba(250,250,250,0.42) sobre `#000` | blended `rgb(105,105,105)` | **3.83:1 AA-large only** ⚠️ |

**P2-1 (Eixo 1):** Noir `--text-faint` 3.83:1 — abaixo de 4.5 (AA texto normal). Aceitável APENAS pra metadata curta / ícones (≥3:1 UI). **NÃO usar como `color` em parágrafos**. Wave 9 já alertou. Wave 10A não mexeu em noir alpha → finding permanece.

### `--site-fg-dim` (bonus fix não documentado no brief mas presente no diff)

| Tema | Antes Wave 9 | Wave 10A | Calculado | Verdict |
|---|---|---|---|---|
| `:root` (site default) | `rgba(250,250,252,0.45)` on `#0A0A0E` = 3.98:1 | `rgba(250,250,252,0.58)` | **6.62:1** | **AA** ✓ |
| `noir` | `rgba(250,250,250,0.42)` on `#0A0A0A` = ~3.6:1 | `rgba(250,250,250,0.58)` | **6.61:1** | **AA** ✓ |

P0 Wave 9 (`--site-fg-dim` FAIL 3.98:1) **RESOLVIDO**.

### `--negative` em 3 temas

| Tema | FG → BG | Calculado | Verdict |
|---|---|---|---|
| Light | `--negative #DC2626` on `--bg #F4F6FA` | **4.46:1** | **AA-large only** ⚠️ (4.5:1 falta 0.04) |
| Light | `--negative #DC2626` on `--negative-soft #FEE2E2` | **3.95:1** | **AA-large only** ⚠️ |
| Light | `--negative-deep #991B1B` on `--negative-soft #FEE2E2` | **6.80:1** | **AA** ✓ |
| Dark | `--negative #F87171` on `--bg #0D1117` | **6.84:1** | **AA** ✓ |
| Dark | `--negative #F87171` on `--negative-soft #2E0E0E` | **6.40:1** | **AA** ✓ |
| Noir | `--negative #FFB4B4` on `--bg #000` | **12.44:1** | **AAA** ✓ |

**P1-1 (Eixo 1, NOVO):** Light `--negative #DC2626` 4.46:1 sobre `--bg` falha AA texto normal por **0.04** (borderline). Recomendação: usar `--negative-deep #991B1B` em texto de erro (6.80:1) e reservar `--negative` pra ícones/borders. Mesma decisão usada em Wave 9 para `--positive`/`--attention`.

### Comparação com valores OLD declarados em Wave 9 (validar baseline)

| Wave 9 declarou | Recalculado | Match |
|---|---|---|
| Light `--text-muted` OLD `#6B7180` on `#F6F5F2` = 4.48:1 | **4.48:1** | ✓ exato |
| Light `--text-faint` OLD `#9CA0AE` on `#F4F6FA` = 2.41:1 | **2.39:1** | ✓ (-0.02 arredondamento) |
| Dark `--text-faint` OLD `#5C6171` on `#0D1117` = 2.94:1 | **3.07:1** | ⚠️ Wave 9 reportou 2.94, real 3.07 (Galadriel ainda assim fixou, OK) |

---

## Eixo 2 — `--on-primary` consistência

### `.btn-primary` (única classe que adotou `var(--on-primary)`)

| Tema | `--on-primary` | sobre `--primary` | Calculado | Verdict |
|---|---|---|---|---|
| Light | `#FFFFFF` | `#4F4FB0` | **6.82:1** | **AA** ✓ |
| Dark | `#FFFFFF` | `#8585D9` | **3.30:1** | **AA-large only** ⚠️ |
| Noir | `#000000` | `#FAFAFA` | **20.12:1** | **AAA** ✓ |

**P1-2 (Eixo 2, NOVO):** Dark `--on-primary #FFF` sobre `--primary #8585D9` é **3.30:1** — falha AA pra texto normal (precisa 4.5). Botões primary em dark estão tecnicamente em **AA-large only** (texto ≥18px ou ≥14px+bold passam em 3.0, mas labels CTA típicos de 14-15px regular **FAIL**).

Opções:
- Escurecer `--primary` dark de `#8585D9` pra `~#6E6EC8` (~4.5:1) — mas perde luminance contrast com bg.
- Ou ajustar `--on-primary` dark pra `#0D1117` (preto bg). Calculado:
  - `#0D1117` sobre `#8585D9` = **6.50:1** ✓ AA
- **Recomendação:** override em dark — `--on-primary: var(--text-strong)` ou hardcode preto.

Atualmente o gradient ainda mistura `--primary-light → --primary` (`#A2A2E5 → #8585D9`):
- `#FFF` on `#A2A2E5` = **2.38:1 FAIL** (gradient top)
- `#FFF` on `#8585D9` = **3.30:1 AA-large** (gradient bottom)
- **Hover gradient** `--primary → --primary-deep` (`#8585D9 → #6B6BC8`):
  - `#FFF` on `#8585D9` = 3.30:1
  - `#FFF` on `#6B6BC8` = **4.60:1 AA** ✓ — hover OK
- **Conclusão:** estado **default** do `.btn-primary` em dark está abaixo do AA texto normal. P1 NOVO.

### Outros botões custom (regressões NÃO fixadas por Galadriel)

Wave 10A fixou apenas `.btn-primary`. Os seguintes botões **continuam com `color:#fff` hardcoded** sobre `var(--primary)`:

| Linha | Classe | Background | Falha NOIR? |
|---|---|---|---|
| 601 | `.brand-mark` | `linear-gradient(var(--primary-light), var(--primary-deep))` | **SIM — 1.00:1 a 1.26:1** |
| 1954 | `.appshell-avatar` (default) | `linear-gradient(var(--avatar-from), var(--avatar-to))` | **SIM em noir — avatar-to=#E5E5E5 → 1.26:1** |
| 2055 | `.ct-principle-card` | `linear-gradient(var(--primary), var(--primary-deep))` | **SIM — 1.04 a 1.26:1** |
| 2500 | (sample, verificar contexto) | linear-gradient primary | **SIM** |
| 2696 | `.ct-conta-btn.primary` | `linear-gradient(var(--primary-light), var(--primary))` | **SIM** |
| 2996 | (avatar variante) | `linear-gradient(var(--primary-light), var(--primary-deep))` | **SIM** |
| 3219 | (botão verde) | `linear-gradient(#2BB390, var(--positive))` | Em noir `--positive=#E5E5E5` → **1.26:1** |
| 3271 | (botão primary) | linear-gradient primary | **SIM** |
| 3680 | `.ct-onb-step-item.active .ct-onb-step-n` | `var(--primary)` | **SIM — 1.04:1** |
| 3778 | `.appshell-notif-badge` | `var(--attention)` (noir=#A8A8A8) | **SIM — 2.38:1** |
| 3812 | `.ct-onb-source-card.done .ct-onb-source-icon` | `var(--positive)` (noir=#E5E5E5) | **SIM — 1.26:1** |
| 3853 | `.ct-onb-illust-*` | linear-gradient primary | **SIM** |
| 3866 | `.ct-onb-cta` | linear-gradient primary | **SIM** |
| 3951 | `.ct-tailor-btn-copy` | linear-gradient primary | **SIM** |
| 4150, 4311 | avatar variantes | linear-gradient primary | **SIM** |
| 4490 | botão primary | `var(--primary)` | **SIM** |
| 4605 | `.ct-self-submit` | `var(--primary)` | **SIM** |

**P0-NOVO-1 (Eixo 2):** ~17 classes CSS com `color:#fff` sobre `var(--primary)` / `var(--positive)` / `var(--attention)` / `var(--avatar-to)` resultam em **contraste 1.00–2.38:1 em NOIR** — texto/símbolos **invisíveis ou ilegíveis**.

Wave 9 não pegou isso porque NOIR foi introduzido na própria Wave 9 e os fixes só vieram parciais em Wave 10A. Wave 10A só fixou `.btn-primary` (linha 749).

---

## Eixo 3 — Skip link

Galadriel mudou pra `background:var(--text); color:var(--bg);`. CSS confirmado em globals.css linha 2575-2576.

| Tema | bg `--text` | color `--bg` | Calculado | Verdict |
|---|---|---|---|---|
| Light | `#1A1B2E` | `#F4F6FA` | **15.65:1** | **AAA** ✓ |
| Dark | `#F0F2F6` | `#0D1117` | **16.88:1** | **AAA** ✓ |
| Noir | `#FAFAFA` | `#000000` | **20.12:1** | **AAA** ✓ |

**Status: ✅ resolvido em todos os temas.** P0 Wave 9 (skip link invisível em noir) **RESOLVIDO**.

---

## Eixo 4 — H1 sistema unificado (`.ct-page-header-title`)

CSS em globals.css linha 6232-6240:
```css
font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
font-size: clamp(40px, 6vw, 80px);
font-weight: 700;
letter-spacing: -0.03em;
line-height: 1.05;
color: var(--text);
```

Mobile (≤640px) linha 6260: `clamp(32px, 9vw, 48px); line-height: 1.08`.

| Verificação | Status |
|---|---|
| Tamanho mínimo 40px (desktop) ≥ WCAG req | ✓ — heading não tem mínimo absoluto, mas 40px é generoso |
| Mobile mínimo 32px @ 320px viewport | ✓ — 9vw em 320px = 28.8px, mas clamp piso é 32px → fica 32px |
| `line-height: 1.05` | ⚠️ WCAG 2.5 ("Text Spacing", 1.4.12) é AA opcional; aplica-se a quando user override — não bloqueia. Mas line-height < 1.5 não é problema pra **headings** (regra é só pra body text). H1 OK. |
| `letter-spacing: -0.03em` | ⚠️ Disléxicos preferem ≥0 letter-spacing. -0.03em é leve (~-2px em 80px). Não bloqueia AA, mas tende a piorar disléxicos. Comum em Display H1. **Aceitável**. |
| `color: var(--text)` | ✓ — 15.65 / 16.88 / 20.12:1 em light/dark/noir |

**Veredito Eixo 4: ✅ acessível.** Risco menor (disléxicos com letter-spacing negativo), aceitável dado o uso em H1 display.

---

## Eixo 5 — Modal canonical (z-index 9100)

`components/Modal.js` (lido completo):

| Requisito | Status | Evidência |
|---|---|---|
| Focus trap real | ✅ | Linhas 21-35: Tab/Shift+Tab interceptado, focus circula entre first/last focusable |
| `aria-modal="true"` + `role="dialog"` | ✅ | Linhas 55-56 |
| `aria-labelledby` | ✅ | Linha 57 (`useId()` em linha 6) |
| ESC fecha | ✅ | Linha 16: `if (e.key === "Escape") onClose?.()` |
| Return focus ao trigger | ✅ | Linhas 8, 11, 45: `previouslyFocused.current?.focus?.()` no cleanup |
| Scroll lock body | ✅ | Linha 40 |
| Click overlay fecha | ✅ | Linha 50 |
| Click dentro não fecha | ✅ | Linha 54: `stopPropagation` |
| Z-index resolve overlap com drawer (9000/9001) | ✅ | Linha 1388 globals: `z-index: 9100` |

**Veredito Eixo 5: ✅ Modal canonical Faramir/Galadriel está padrão WAI-ARIA APG dialog conformante.**

### ⚠️ Modais ad-hoc (NÃO usam Modal canonical) — **AINDA FALHAM**

#### 5a. `app/(app)/dashboard/RefreshDiagnosisButton.js`

Linha 84:
```jsx
<div className="ct-refresh-modal" role="dialog" aria-modal="true" aria-labelledby="ct-refresh-title">
```

| Requisito | Status |
|---|---|
| role + aria-modal + aria-labelledby | ✅ |
| Focus trap | ❌ **AUSENTE** |
| ESC fecha | ❌ **AUSENTE** |
| Return focus | ❌ **AUSENTE** |
| Auto-focus inicial | ❌ **AUSENTE** |

**P1-NOVO-2:** Refatorar pra usar `components/Modal.js`. Wave 9 já apontou; Wave 10A não tocou.

#### 5b. `app/(app)/cvs-adaptados/CvDetailClient.js` (tailor modal)

Linhas 20-27 têm ESC handler global. Linhas 128-132 têm `role="dialog"` + `aria-modal="true"` + `aria-labelledby`.

| Requisito | Status |
|---|---|
| role + aria-modal + aria-labelledby | ✅ |
| ESC fecha | ✅ (handler global window) |
| Focus trap | ❌ **AUSENTE** |
| Return focus | ❌ **AUSENTE** |
| Auto-focus inicial | ❌ **AUSENTE** |

**P1-NOVO-3:** Adicionar focus trap. Wave 9 já apontou; Wave 10A não tocou.

#### 5c. `components/NotificationsBell.js` (drawer)

ESC handler linhas 138-146. role=dialog + aria-modal linhas 243-245.

| Requisito | Status |
|---|---|
| role + aria-modal + aria-label | ✅ |
| ESC fecha | ✅ |
| Focus trap | ❌ **AUSENTE** |
| Return focus | ❌ **AUSENTE** |
| Auto-focus inicial | ❌ **AUSENTE** |
| `<li onClick>` items focáveis por teclado | ❌ **AUSENTE** — linha 289 |

**P0-NOVO-4** (Eixo 5+8): NotificationsBell items são `<li onClick>` sem `tabIndex` nem `role="button"` nem keyboard handler. **Usuário keyboard-only NÃO consegue marcar notificação como lida.** Wave 9 apontou; Wave 10A não tocou.

---

## Eixo 6 — AppShell user clicável

`components/AppShell.js` linhas 240-271:

| Requisito | Status | Evidência |
|---|---|---|
| `<Link>` semântico (Next renderiza `<a>`) | ✅ | Linha 244 |
| `aria-label="Ver minha conta"` | ✅ | Linha 247 |
| Tab order correto (entre brand e bell) | ✅ | Estrutura DOM ordenada |
| Avatar `<img>` tem `alt` | ✅ — `alt=""` + `aria-hidden="true"` (decorativo, label vem do `<Link>`) | Linhas 253, 256 |
| Focus visible state | ✅ | globals.css 1994-1996: `box-shadow: 0 0 0 2px var(--primary-tint)` |
| Hover state | ✅ | globals.css 1989-1992 |

**Veredito Eixo 6: ✅ AppShell user-link totalmente acessível.** Faramir fix correto.

⚠️ **Sub-nota:** Avatar mobile (linhas 294-301) **NÃO** está envolto em `<Link>`. É decorativo com `aria-hidden + title={userName}`. Como mobile não tem sidebar com link "Ver minha conta", **não há atalho keyboard pra /conta em mobile** — usuário precisa navegar via bottom-nav (que não tem item Conta na NAV). 

**P2-NOVO-5 (Eixo 6):** Em mobile, não existe link visível pra `/conta`. Recomendação: avatar mobile virar `<Link href="/conta" aria-label="Ver minha conta">` também, ou adicionar item "Conta" no `appshell-mobile-nav`.

---

## Eixo 7 — SrcChip a11y

`components/SrcChip.js` (62 linhas) lido completo.

| Requisito | Status | Evidência |
|---|---|---|
| Decorative SVG com `aria-hidden="true"` | ✅ | Linha 52 |
| Texto da fonte legível (não só ícone) | ✅ | Linha 58: `{label}` renderizado como texto |
| `title` attribute funciona pra screen readers | ⚠️ — `title` NÃO é confiável pra screen readers (muitos ignoram) | Linha 28 |
| Sanitização (sem XSS) | ✅ | Linhas 22-23: `replace(/^\[|\]$/g, "")` + interpolação JSX (React escapa) |

### Contraste do chip em 3 temas

Componente usa `color: var(--text-muted, var(--text-soft))` sobre `background: var(--surface-2, var(--surface))`.

| Tema | text-muted | surface-2 | Calculado | Verdict |
|---|---|---|---|---|
| Light | `#5A5F6D` | `#F8FAFC` | **6.10:1** | **AA** ✓ |
| Dark | `#8A8FA1` | `#1F2530` | **4.78:1** | **AA** ✓ |
| Noir | `rgba(250,250,250,0.65)` blended on `#121212` | `rgb(140,140,140)` ~ | **7.88:1** | **AAA** ✓ |

**Veredito Eixo 7: ✅ Contraste OK em todos os temas.**

**P3-NOVO-6 (Eixo 7):** `title` attribute é frágil pra SR (NVDA lê em alguns modos, JAWS depende de config, VoiceOver ignora muitas vezes). Como o `<span>` já tem o texto literal da fonte renderizado (`{label}` linha 58), o screen reader já anuncia a fonte. O `title` é redundante mas inofensivo. **Não-bloqueante**.

Sugestão menor: trocar `title` por `aria-label` se quiser garantir SR uniforme (mas como o texto literal já está visível, `title` é só pra tooltip mouse — manter está OK).

---

## Eixo 8 — Wave 9 findings — status atual

| Finding Wave 9 | Status W11 | Evidência |
|---|---|---|
| P0-1: `--text-muted` light (4.48:1) | ✅ **RESOLVIDO** | 5.90:1 |
| P0-2: `--text-faint` light (2.41:1) | ✅ **RESOLVIDO** | 4.70:1 |
| P0-2: `--text-faint` dark (2.94:1 / real 3.07) | ✅ **RESOLVIDO** | 5.87:1 |
| `--site-fg-dim` 3.98:1 | ✅ **RESOLVIDO** | 6.62:1 (Galadriel fixou bonus) |
| Skip link invisível em noir | ✅ **RESOLVIDO** | 20.12:1 |
| 3 modais ad-hoc sem focus trap | ❌ **ABERTO** | RefreshDiagnosisButton, CvDetailClient, NotificationsBell — nenhum tem trap |
| NotificationsBell `<li onClick>` | ❌ **ABERTO** | linha 289 NotificationsBell.js permanece |
| SiteNav mobile sem ESC handler | ❌ **ABERTO** | components/site/SiteNav.js sem `addEventListener Escape` |
| Lime sobre preto AAA (positivo W9) | ✅ **MANTIDO** | noir continua usando `--accent-cyan` lime |

---

## Eixo 9 — Touch targets e mobile (WCAG 2.5.5 AAA)

### Theme toggle reposicionado bottom-right

globals.css linhas 5993-5998:
```css
@media (max-width: 880px) {
  .theme-toggle { width: 44px; height: 44px; top: auto; bottom: 20px; }
}
```

| Verificação | Status |
|---|---|
| Touch target ≥ 44x44px (WCAG 2.5.5 AAA) | ✅ — 44px exato |
| Não cobre Copilot FAB (bottom:24px, right:24px) | ⚠️ — Theme toggle em bottom:20px right:20px **sobrepõe** Copilot FAB que também é bottom:24px right:24px. Z-index theme=100 vs copilot=90 → theme cobre copilot. |

**P1-NOVO-7 (Eixo 9):** Em mobile, theme toggle (bottom:20px right:20px, 44x44, z=100) **se sobrepõe** ao Copilot FAB (bottom:24px right:24px, z=90). Áreas se intersectam → Copilot FAB pode ficar inacessível em tela pequena.

Recomendação: theme toggle pra bottom:88px (acima do FAB que ocupa ~48-56px + margem) ou usar `left:20px` pra ficar oposto.

### Outros touch targets verificados

| Componente | Mobile | Verdict |
|---|---|---|
| `.appshell-nav-item` | `min-height: 44px` linha 5985 | ✅ AAA |
| `.appshell-mobile-nav-item` | `min-height: 44px` | ✅ AAA |
| `.ct-action-cta` etc. | `min-height: 36px` visual + `padding: 8px 4px` (hitbox ~52px) | ⚠️ visual <44 mas hitbox >44 — aceitável |
| `.ct-microaction-check` | `min-width: 44px; min-height: 44px` linha 6013 | ✅ AAA |

**Cards Kanban em `/candidaturas`:** **não auditado neste passe** (não modificado por Wave 10A). Fica como verificação manual futura.

---

## Eixo 10 — Prefers-reduced-motion

`grep -c 'prefers-reduced-motion'` → **12 ocorrências** em globals.css.

Cobertura existente:
- Linha 414 (?): regra global `* { animation:none!important; transition:none!important; }` aplica reset universal
- Linhas específicas: `.ct-score-ring-wrap`, `.ct-confetti-piece`, `.ct-achievement-toast`, `.ct-action-card`, `.ct-job-card`, `.ct-kpi-card`, `.ct-microaction-card`, `.ct-onb-illust-animated`, `.ct-skeleton`, etc.

| Verificação | Status |
|---|---|
| Reset global `* { animation:none; transition:none }` existe | ✅ |
| Componentes novos Wave 10A (SrcChip) respeitam | ✅ — SrcChip não tem animation/transition, sem efeito |
| Theme toggle (transition em hover) coberto | ✅ pelo reset universal |
| Avatar hover lift | ✅ pelo reset universal |

**Veredito Eixo 10: ✅ reduced-motion coberto comprehensively.** Regra global universal cobre qualquer nova animação adicionada inadvertidamente.

---

## Componentes auditados pós Wave 10A — resumo

### Modal canonical (z-index 9100)
Padrão APG dialog conformante. Faramir/Galadriel fizeram certo. ✅

### AppShell user clicável
Faramir transformou `<div>` em `<Link>` semântico com aria-label, focus-visible, alt=""/aria-hidden no avatar decorativo. Apenas regressão lateral: mobile sem link equivalente. ✅ desktop / ⚠️ mobile.

### SrcChip
Decorative SVG OK, texto visível, contraste AA/AAA. `title` redundante mas inofensivo. Inline styles não animados (reduced-motion safe). ✅

### Theme toggle mobile
44x44 OK. Z-index conflito com Copilot FAB. ⚠️

---

## Novos findings (introduzidos ou expostos por Wave 10A)

### 🔴 P0 — bloqueantes

**P0-NOVO-1 (Eixo 2).** `color:#fff` hardcoded em ~17 classes CSS sobre `var(--primary)`, `var(--positive)`, `var(--attention)`, `var(--avatar-to)` resultam em contraste **1.00–2.38:1 em NOIR** (texto invisível).

Afetados (não exaustivo):
- `.brand-mark` (linha 601) — logo do app em headers públicos
- `.appshell-avatar` (linha 1954) — avatar default do user (inicial)
- `.ct-principle-card` (linha 2055) — /transparencia
- `.ct-conta-btn.primary` (linha 2696) — /conta
- `.ct-onb-cta` (linha 3866) — onboarding CTA
- `.ct-tailor-btn-copy` (linha 3951) — modal tailor CV
- `.ct-onb-step-item.active .ct-onb-step-n` (linha 3680) — onboarding steps
- `.appshell-notif-badge` (linha 3778) — badge sobre attention=#A8A8A8 em noir
- `.ct-onb-source-card.done .ct-onb-source-icon` (linha 3812) — over positive=#E5E5E5
- Linhas 2500, 2996, 3219, 3271, 3853, 4150, 4311, 4490, 4605

**Fix:** trocar todos por `color: var(--on-primary, #FFF)` ou criar token dedicado (`--on-positive`, `--on-attention`, `--on-avatar`) e adicionar override em noir. Pattern usado em `.btn-primary` linha 749.

**P0-NOVO-4 (Eixo 5+8).** NotificationsBell `<li onClick>` permanecem não-focáveis — keyboard users não conseguem marcar notificação como lida. Wave 9 apontou; nenhum fix aplicado em Wave 10A.

### 🟡 P1 — alta prioridade

**P1-NOVO-2 (Eixo 5a).** RefreshDiagnosisButton modal ad-hoc sem focus trap, sem ESC, sem return focus. Refatorar pra usar `Modal.js` canonical.

**P1-NOVO-3 (Eixo 5b).** CvDetailClient tailor modal ad-hoc com ESC mas sem focus trap, sem return focus. Refatorar pra `Modal.js`.

**P1-NOVO-NotificationsDrawer.** NotificationsBell drawer (aside role=dialog) com ESC mas sem focus trap, sem return focus.

**P1-NOVO-Eixo2-Dark.** Dark `.btn-primary` text `#FFF` sobre `--primary #8585D9` = **3.30:1 (FAIL AA texto normal)**. Override `--on-primary: #0D1117` em dark → 6.50:1. Ou ajustar `--primary` dark pra `#6E6EC8` (AA pass texto).

**P1-NOVO-Eixo1.** Light `--negative #DC2626` 4.46:1 sobre `--bg` — borderline FAIL (-0.04). Usar `--negative-deep #991B1B` pra texto, reservar `--negative` pra UI/ícones.

**P1-NOVO-7 (Eixo 9).** Theme toggle mobile bottom:20px right:20px **sobrepõe** Copilot FAB (bottom:24px right:24px). Mover pra bottom:88px ou left:20px.

### 🟢 P2 — média prioridade

**P2-1 (Eixo 1 — pré-existente W9).** Noir `--text-faint` 3.83:1 AA-large only. Não usar como `color` em parágrafos.

**P2-NOVO-5 (Eixo 6).** Mobile não tem link visível pra `/conta`. Adicionar item no `appshell-mobile-nav` ou tornar avatar mobile clicável.

**P2-NOVO-SiteNavESC (Eixo 8).** SiteNav mobile drawer sem ESC handler nem `role="dialog"` no drawer.

### ⚪ P3 — baixa prioridade

**P3-NOVO-6 (Eixo 7).** SrcChip usa `title` (frágil pra SR). Como texto literal já está visível, `title` é redundante mas inofensivo. Manter ou trocar por `aria-label` — não-bloqueante.

---

## Roteiro de teste manual (com screen reader + keyboard)

- [ ] **Tab por /dashboard inteiro** — verificar se notificações abrem com Enter, se cada item da lista é focável (espera-se FALHA por P0-NOVO-4)
- [ ] **Tab por /conta em mobile** — verificar se existe atalho keyboard pra acessar conta (espera-se FALHA por P2-NOVO-5)
- [ ] **VoiceOver + iOS** lê SrcChip em /gaps e /oportunidades — anuncia "Curriculo" como label inline?
- [ ] **NVDA + Firefox** abre Modal canonical (`/cvs-adaptados/[id]` → "Adaptar"), navega com Tab — circula entre botões? ESC fecha? Return focus volta pro botão?
- [ ] **Theme toggle mobile** + Copilot FAB — em viewport 360px, ambos clicáveis sem sobreposição? (espera-se FALHA por P1-NOVO-7)
- [ ] **Skip link em noir** — Tab da pagina (em /, ou /entrar com tema noir), Enter ativa, foca em #main-content?
- [ ] **Pular sidebar com skip link em /dashboard** — atalho funciona?
- [ ] **Botões primary em noir** — visualmente, texto branco aparece sobre primary branco? (espera-se NÃO — P0-NOVO-1)
- [ ] **Avatar mobile noir** — inicial do user visível sobre gradient #2A2A2A→#E5E5E5? (espera-se invisível se posicionado no lado claro)
- [ ] **NotificationsBell drawer em noir** — items lidos com border-left cyan visíveis?
- [ ] **Forms /conta em noir** — botão "Salvar" (`.ct-conta-btn.primary`) tem texto visível?

---

## Veredito final

### "Wave 10A melhorou a11y?" — **SIM, parcialmente**

✅ **Vitórias claras (P0 Wave 9 resolvidos):**
- 3 tokens de texto base agora atingem AA WCAG real (verificado por cálculo manual — Galadriel disse a verdade nos números)
- Skip link agora visível em noir (20:1 AAA)
- `--site-fg-dim` fix bonus (3.98 → 6.62:1)
- Modal canonical (Faramir) é padrão APG dialog conformante
- AppShell user link semântico com aria-label (Faramir)

❌ **Regressões e gaps **(introduzidos ou expostos por Wave 10A**):**
- **Tema NOIR está quebrado em ~17 classes CSS** que hardcodam `#fff` sobre tokens que viraram quase-brancos em noir. Texto/símbolos **invisíveis (1.00-2.38:1)**. Galadriel só fixou `.btn-primary`; deveria ter aplicado o mesmo padrão a todas as classes que usam `var(--primary)` / `var(--positive)` / `var(--attention)` como background.
- **3 modais ad-hoc continuam sem focus trap** (Wave 9 já apontou, Wave 10A não tocou)
- **NotificationsBell `<li onClick>` continua** quebrando keyboard navigation
- **Dark `.btn-primary` 3.30:1 FAIL AA texto normal** — `--on-primary #FFF` sobre `--primary #8585D9` insuficiente em dark
- **Mobile theme toggle sobrepõe Copilot FAB** (regressão Faramir)
- **Light `--negative` 4.46:1 borderline FAIL** (-0.04)

### Status global (compare Wave 9)

| Métrica | Wave 9 | Wave 11 |
|---|---|---|
| P0 contraste texto base | 2 FAIL | **0 FAIL** ✅ |
| P0 contraste em noir (NOVO) | 0 conhecido | **17+ classes FAIL** ❌ |
| P0 keyboard-only navegação | 1 (NotificationsBell items) | **1 (mesma)** ❌ |
| P1 modais ad-hoc | 3 sem trap | **3 sem trap** ❌ |
| P1 skip link | invisível noir | resolvido ✅ |
| P1 SiteNav ESC | aberto | **aberto** ❌ |
| P1 dark btn-primary (NOVO) | n/a | **1 FAIL** ❌ |
| P2 site-fg-dim | FAIL | resolvido ✅ |

### Recomendação pra Wave 10B/C

**Wave 10B (urgência alta):**
1. Audit semântico de **todo `color:#fff` hardcoded** sobre tokens dinâmicos. Substituir por `var(--on-primary)` (ou `--on-positive`, `--on-attention`, `--on-avatar` se criar tokens novos) com override em noir.
2. Override `--on-primary: #0D1117` em `[data-theme="dark"]` (resolve P1-NOVO-Eixo2-Dark).
3. Mover theme toggle mobile pra bottom:88px ou left:20px (P1-NOVO-7).

**Wave 10C (médio prazo):**
4. Refatorar 3 modais ad-hoc pra usar `components/Modal.js` (focus trap + return focus + ESC).
5. NotificationsBell: trocar `<li onClick>` por `<button>` ou `<li tabIndex={0} role="button" onKeyDown>` com Enter/Space handlers.
6. SiteNav mobile: adicionar ESC handler global + role=dialog no drawer.
7. Avatar mobile virar `<Link href="/conta">` ou adicionar item Conta no bottom-nav.

**Wave 11:**
8. Re-audit pós Wave 10B/C. Validar todos os fixes via grep + recalcular contrastes em noir.

---

*"Luz não mente. Calcule sem viés." — Elrond, Wave 11.*
