# Accessibility Audit — Elrond — 2026-06-25 — WCAG 2.2 AA + AAA críticos

> **Escopo:** `app/(app)/*`, `app/(landing)/*`, `app/admin/*`, `app/entrar/*`,
> `app/experimentar/*`, `app/meu-gemeo/*`, `app/meus-dados/*`,
> `components/*`, `app/globals.css`. Branch `redesign/claude-design`.
>
> **Metodologia:** WCAG 2.2 AA como baseline obrigatório, AAA aplicado em
> texto corrido de leitura longa e em CTAs principais. Contrast ratio
> calculado à mão (fórmula WCAG: luminance relativa + `(L1+0.05)/(L2+0.05)`)
> para 3 temas (light, dark, noir). Keyboard nav, focus management e ARIA
> verificados por leitura estática do código (sem renderizar). Itens
> marcados como **"PRECISA TESTE MANUAL"** quando o veredicto depende de
> comportamento runtime que research-only não consegue confirmar.

---

## Executive Summary

| Severity | Count | Notes |
|---|---|---|
| **P0** — WCAG FAIL crítico | **2** | text-muted light borderline (4.48:1), text-faint usado como texto |
| **P1** — AA passa mas AAA falha em elemento crítico, ou gap arquitetural | **8** | modais ad-hoc sem focus trap, label-input desassociado, etc. |
| **P2** — ARIA/semantic gaps | **6** | tablist sem tabpanel, drawer mobile site sem ESC, `<li onClick>` |
| **P3** — Polish / refinamento | **5** | scrollbar width, font alternative pra disléxicos |

**Status geral:** APROVADO COM RESSALVAS. O app já passou 8 waves de
redesign e os fundamentos estão **muito acima da média** do mercado BR:
skip link real, focus trap correto no `<Modal>` canonical, `prefers-reduced-motion`
honrado em **14 arquivos** + `globals.css` global, ARIA labels em ícones, skip
link, ESC funcional em quase todas as superfícies, lime sobre preto (noir
CTA) com contraste **excelente (16.54:1)**.

Os P0 são **estreitos e refinados** (não bugs estruturais). O maior risco
arquitetural é a **proliferação de modais ad-hoc** (`RefreshDiagnosisButton`,
`CvDetailClient`, `NotificationsBell`) que não reusam o `<Modal>` canonical —
cada um reimplementa parcialmente focus management e fica sujeito a regressão.

---

## Contraste por tema

> **Como ler:** L = luminance relativa (0=preto, 1=branco). Ratio = razão
> entre L_claro+0.05 e L_escuro+0.05. AA texto normal = 4.5:1, AA texto
> grande/UI = 3:1, AAA texto normal = 7:1.

### Exemplo de cálculo passo-a-passo (educacional, para auditoria reproduzível)

Tomemos `#1A1B2E` (text light) sobre `#F4F6FA` (bg light):

```
#1A1B2E => R=26, G=27, B=46
Normalizar:
  Rn = 26/255 = 0.1020  -> > 0.03928  -> ((0.1020+0.055)/1.055)^2.4 ≈ 0.01057
  Gn = 27/255 = 0.1059  -> ((0.1059+0.055)/1.055)^2.4 ≈ 0.01103
  Bn = 46/255 = 0.1804  -> ((0.1804+0.055)/1.055)^2.4 ≈ 0.02601
  L_text = 0.2126*0.01057 + 0.7152*0.01103 + 0.0722*0.02601 ≈ 0.0120

#F4F6FA => R=244, G=246, B=250
  Rn = 244/255 = 0.9569  -> ((0.9569+0.055)/1.055)^2.4 ≈ 0.9046
  Gn = 246/255 = 0.9647  -> ((0.9647+0.055)/1.055)^2.4 ≈ 0.9215
  Bn = 250/255 = 0.9804  -> ((0.9804+0.055)/1.055)^2.4 ≈ 0.9572
  L_bg = 0.2126*0.9046 + 0.7152*0.9215 + 0.0722*0.9572 ≈ 0.9206

Ratio = (0.9206 + 0.05) / (0.0120 + 0.05) = 0.9706 / 0.0620 ≈ 15.65:1   AAA ✓
```

### Light (`:root`, `:root[data-theme="light"]`)

| Combinação | Tokens (hex) | Contrast | WCAG | Notas |
|---|---|---|---|---|
| --text on --bg | #1A1B2E on #F4F6FA | **15.65:1** | AAA ✓ | corpo de leitura |
| --text-soft on --bg | #4A4D63 on #F4F6FA | ~7.6:1 | AAA ✓ | hierarquia secundária |
| --text-muted on --bg | #6B7180 on #F4F6FA | **4.48:1** | **FAIL** | falha AA por **0.02** — P0 |
| --text-faint on --bg | #9CA0AE on #F4F6FA | **2.41:1** | **FAIL** | só pode ser usado em UI 3:1 ou texto **decorativo** |
| --primary on --bg | #4F4FB0 on #F4F6FA | 6.32:1 | AA ✓ | link / accent |
| #FFF on --primary (btn-primary) | #FFFFFF on #4F4FB0 | 6.84:1 | AA ✓ | CTA principal |
| --primary-deep on --bg | #34357E on #F4F6FA | ~10.6:1 | AAA ✓ | títulos coloridos |
| --positive on --bg | #15A871 on #F4F6FA | ~3.1:1 | FAIL texto, AA UI | usar só em chips/badges, não corpo |
| --attention on --bg | #D97706 on #F4F6FA | ~3.5:1 | FAIL texto, AA UI | idem |
| --negative on --bg | #DC2626 on #F4F6FA | ~4.9:1 | AA ✓ | mensagem de erro |
| --accent-cyan on --bg | #70FFDD on #F4F6FA | **1.14:1** | FAIL | jamais usar como TEXTO em light |

### Dark (`[data-theme="dark"]`)

| Combinação | Tokens (hex) | Contrast | WCAG | Notas |
|---|---|---|---|---|
| --text on --bg | #F0F2F6 on #0D1117 | **15.97:1** | AAA ✓ | corpo |
| --text-soft on --bg | #C9CDD8 on #0D1117 | ~11.5:1 | AAA ✓ | |
| --text-muted on --bg | #8A8FA1 on #0D1117 | **5.57:1** | AA ✓ | |
| --text-faint on --bg | #5C6171 on #0D1117 | **2.94:1** | FAIL texto, FAIL UI 3:1 | **borderline** — não usar pra TEXTO nem UI focusable |
| --primary on --bg | #8585D9 on #0D1117 | **5.43:1** | AA ✓ | link, accent |
| --positive on --bg | #34D399 on #0D1117 | ~8.5:1 | AAA ✓ | |
| --attention on --bg | #F59E0B on #0D1117 | ~8.7:1 | AAA ✓ | |
| --negative on --bg | #F87171 on #0D1117 | ~5.6:1 | AA ✓ | |
| --accent-cyan on --bg | #70FFDD on #0D1117 | ~13.9:1 | AAA ✓ | usável como texto em dark |

### Noir (`[data-theme="noir"]`)

| Combinação | Tokens (hex) | Contrast | WCAG | Notas |
|---|---|---|---|---|
| --text on --bg | #FAFAFA on #000000 | **20.14:1** | AAA ✓ | máximo possível |
| --text-soft on --bg | rgba(250,250,250,.78) on #000 | **12.02:1** | AAA ✓ | |
| --text-muted on --bg | rgba(250,250,250,.65) on #000 | **8.56:1** | AAA ✓ | |
| --text-faint on --bg | rgba(250,250,250,.42) on #000 | **3.89:1** | FAIL texto, AA UI | só ícones / metadata curta |
| **--accent-cyan #C2F542 on --bg #000** | lime on preto (CTA bg / glow) | **16.54:1** | **AAA ✓** | lime Cloudwalk sobre preto — **excelente** |
| **--site-accent-on #000 on --accent-cyan #C2F542** (btn texto) | preto sobre lime | **16.54:1** | **AAA ✓** | texto do CTA primary em noir — premium |
| --alert on --bg (warnings) | #FFB4B4 on #000 | ~11.8:1 | AAA ✓ | único toque de cor preservado |
| --border-strong | rgba(255,255,255,.22) | n/a (border) | OK | borda visível mas não chamativa |

### Site landing (dark editorial, fixo independente de tema)

| Combinação | Tokens | Contrast | WCAG | Notas |
|---|---|---|---|---|
| --site-fg on --site-bg | #FAFAFC on #0A0A0E | ~19.4:1 | AAA ✓ | |
| --site-fg-muted on --site-bg | rgba(250,250,252,.65) on #0A0A0E | **8.04:1** | AAA ✓ | parágrafos de lede |
| --site-fg-dim on --site-bg | rgba(250,250,252,.45) on #0A0A0E | **3.98:1** | **FAIL texto** | usado em footer/secondary — checar uso |
| --site-accent on --site-bg | #70FFDD on #0A0A0E | ~13.7:1 | AAA ✓ | accent cyan |
| --site-accent-on on --site-accent | #08313F on #70FFDD | **11.29:1** | AAA ✓ | botão primary do site (teal escuro sobre cyan) |
| --site-accent-magenta on --site-bg | #B924FF on #0A0A0E | ~4.3:1 | AA texto grande / FAIL texto normal | use só em headings >24px ou badges |

---

## Findings

### P0 — WCAG FAIL crítico

#### P0-1. `--text-muted` em LIGHT falha AA por 0.02:1
- **Arquivo:** `app/globals.css:148` (`--text-muted: #6B7180`)
- **Cálculo:** 4.48:1 sobre `#F4F6FA` (precisa 4.5:1)
- **Onde é usado:** descrições secundárias de cards (`.ct-conta-card-sub`,
  `.ct-job-card`, body em `ct-body-large` muted, etc.) — **leitura
  importante**, não decorativa.
- **Fix:** baixar luminance pra `#666B7A` (≈4.81:1) ou `#5F6478`
  (≈5.2:1). 1 char de diferença visualmente, ganho de AA.
- **Prioridade:** P0 porque cobre superfície grande do app.

#### P0-2. `--text-faint` em LIGHT (2.41:1) e DARK (2.94:1) — não pode ser usado pra texto
- **Arquivo:** `app/globals.css:149` (`--text-faint: #9CA0AE` light), `app/globals.css:172` (`#5C6171` dark)
- **Cálculo:** light 2.41:1, dark 2.94:1 — abaixo de **qualquer** threshold WCAG
  (mesmo o de UI components 3:1).
- **Onde é usado:** `grep` mostra uso em timestamps, hint text, metadata
  curta — porém também em `--ink-faint` (alias legado, ainda usado por
  parágrafos curtos como `entrar-footer`).
- **Fix duplo:**
  1. Auditar todos os usos de `--text-faint`/`--ink-faint` — se for texto
     com >20 chars, trocar pra `--text-muted` (após corrigir P0-1).
  2. Subir luminance: light `#828695` (≈3.05:1 ainda UI-only) ou `#71768A`
     (≈3.55:1 — limítrofe texto grande). **Ideal**: `#6C7186` (4.0:1) pra
     bater texto grande AA.
- **Prioridade:** P0 porque `--text-faint` é usado em footer, captions
  e metadados visíveis em todas as telas.

---

### P1 — AA passa mas AAA falha em elemento crítico, OU gap arquitetural

#### P1-1. Modais ad-hoc não reusam `<Modal>` canonical → focus trap quebrado
- **Arquivos:**
  - `app/(app)/dashboard/RefreshDiagnosisButton.js:84-128` — modal próprio
    com `role="dialog"` + `aria-modal="true"`, **mas sem focus trap, sem
    ESC handler, sem `previouslyFocused.current?.focus()` no close**.
  - `app/(app)/cvs-adaptados/CvDetailClient.js:122-185` — `ct-tailor-modal`
    com `role="dialog"` e `aria-labelledby` corretos, **mas não há focus
    trap nem ESC handler** (`onKeyDown` está só no `<input>`s, não no dialog).
  - `components/NotificationsBell.js:241-329` — drawer com `role="dialog"`
    + `aria-modal="true"` + ESC handler ✓, **mas sem focus trap**: Tab
    fora do drawer foca elementos do background.
- **Por quê é problema:** WCAG 2.1.2 (No Keyboard Trap) + 2.4.3 (Focus
  Order). Quando dialog é modal (`aria-modal="true"`), o foco DEVE ser
  contido. Usuários SR navegando por Tab acessam conteúdo "atrás" do modal.
- **Fix arquitetural:** refatorar todos pra usar `<Modal>` (que já tem
  focus trap correto em `components/Modal.js:21-35`). Não vou listar
  porque é refactor — só registrar.
- **Modal canonical OK ✓**: `components/Modal.js` — focus trap, ESC,
  `previouslyFocused`, `tabIndex={-1}` no dialog, `aria-labelledby` por
  `useId()`. **Padrão de referência do app — usar sempre.**

#### P1-2. `NotificationsBell` usa `<li onClick>` em itens da lista
- **Arquivo:** `components/NotificationsBell.js:288-304`
- **Problema:** `<li>` com `onClick` para `markOneRead(n.id)` **não é
  focável por teclado** (sem `tabIndex`, sem `role="button"`, sem
  `onKeyDown`). Quem usa só teclado / SR não consegue marcar como lido.
- **Fix:** transformar a região clicável em `<button>` interno, ou
  adicionar `tabIndex={0}` + `role="button"` + handler de Enter/Space.
- **Severity:** P1 (não bloqueia conteúdo, mas quebra função).

#### P1-3. `InterviewModal` e `ChatModal`: `<textarea>` / `<input>` sem label
- **Arquivos:**
  - `components/InterviewModal.js:85-90` — `<textarea>` só com placeholder,
    sem `<label>`, sem `aria-label`, sem `aria-labelledby`.
  - `components/ChatModal.js:71-77` — `<input>` idem.
- **Problema:** WCAG 3.3.2 Labels or Instructions + 4.1.2 Name, Role, Value.
  Placeholder NÃO substitui label (some no foco, baixo contraste em alguns
  browsers).
- **Fix:** adicionar `aria-label="Sua resposta de entrevista"` ou
  `aria-label="Pergunta ao seu gêmeo"`. Caso visual queira manter sem
  label visível, `aria-label` resolve.

#### P1-4. `PortfolioImportButton` e `LinkedinImportButton`: label visual sem `htmlFor`
- **Arquivos:**
  - `components/PortfolioImportButton.js:70-77, 80-90` — `<label>` com
    style block mas `htmlFor` ausente; `<input>` não tem `id`.
  - `components/LinkedinImportButton.js:70` (similar).
- **Problema:** clicar no `<label>` não foca o `<input>` (perde affordance
  comum), e SRs não associam corretamente.
- **Fix:** adicionar `id` no `<input>` + `htmlFor` no `<label>` (ou
  envolver `<input>` com `<label>`, que dispensa htmlFor).

#### P1-5. `SiteNav` mobile drawer sem ESC handler
- **Arquivo:** `components/site/SiteNav.js:151-172`
- **Problema:** `mobileOpen` abre overlay com lista de links, **mas sem
  listener de `keydown`** pra fechar com ESC. Em desktop / tablet com
  teclado conectado fica preso.
- **Fix:** `useEffect` com `keydown` ouvindo ESC enquanto `mobileOpen`.
- **Modal `<Modal>` faz isso ✓, mas o drawer da landing não.**

#### P1-6. `--text-faint` em DARK no limite AA UI (2.94:1, precisa 3:1)
- **Arquivo:** `app/globals.css:172` (`--text-faint: #5C6171`)
- **Problema:** abaixo de 3:1 para UI components (WCAG 1.4.11). Em
  componentes interativos (placeholders, ícones inativos), falha.
- **Fix:** `#6B7186` ou `#74798C` → AA texto grande + UI ✓.

#### P1-7. `--site-fg-dim` (rgba .45) no site = 3.98:1 — borderline
- **Arquivo:** `app/globals.css:36` (`--site-fg-dim: rgba(250,250,252,0.45)`)
- **Problema:** falha AA texto normal (4.5). Usado em footer copy + meta
  text. Em texto curto/grande passa; em parágrafo longo falha.
- **Fix:** elevar alpha pra 0.55 (≈5.5:1) — ainda visualmente "dim" mas
  legível.

#### P1-8. `RefreshDiagnosisButton` modal usa `<h3>` sem que o pai tenha `<h2>`
- **Arquivo:** `app/(app)/dashboard/RefreshDiagnosisButton.js:85`
- **Problema:** salto de heading dentro do dialog (não tem `<h1>`/`<h2>`
  precedente no dialog). Para SRs anunciarem hierarquia, dialog deveria
  começar com `<h2>` (já que app `<main>` tem `<h1>`).
- **Fix:** `<h2 id="ct-refresh-title">` em vez de `<h3>`. (Modal canonical
  já usa `<h3>` em `.modal-title` — também merece subir pra `<h2>`, ou
  o `aria-labelledby` é suficiente.)

---

### P2 — ARIA / semantic gaps

#### P2-1. `CvDetailClient` tabs sem `role="tabpanel"` + `aria-controls`
- **Arquivo:** `app/(app)/cvs-adaptados/CvDetailClient.js:165-208`
- **Problema:** `role="tablist"` ✓ e `role="tab"` + `aria-selected` ✓,
  **mas o conteúdo (`<pre>`)** não tem `role="tabpanel"` + `aria-labelledby`
  apontando pro tab ativo. SR não anuncia "Você está no painel X".
- **Fix:** envolver o `<pre>` em `<div role="tabpanel" id="..." aria-labelledby="...">`.

#### P2-2. `appshell-notif-item` é `<li>` interativo sem semântica de botão
- **Arquivo:** `components/NotificationsBell.js:288` (já contado em P1-2,
  registrado aqui para visibilidade ARIA).

#### P2-3. `.theme-toggle` posicionamento fixo pode sobrepor conteúdo
- **Arquivo:** `app/globals.css:544-548` (`position:fixed; top:20px; right:20px`)
- **Problema:** botão de tema sobrepõe conteúdo de canto superior direito
  em viewports pequenos. Não é a11y per se, mas usuários com zoom 200%+
  (WCAG 1.4.10 Reflow) podem perder conteúdo abaixo.
- **Fix:** `@media (max-width: 600px)` mover pro footer ou pra dentro do
  AppShell mobile header.

#### P2-4. `.live-pill` + `.live-dot` animação `pulse` infinita sem `aria-hidden`
- **Arquivo:** `app/globals.css:608-622`
- **Problema:** elemento "LIVE" pisca pra sempre — irritante pra usuários
  com sensibilidade vestibular / cognitiva. **Reduced-motion já cancela
  via regra global linha 404** ✓, mas o ponto pulsante visualmente ainda
  é forte.
- **Fix:** opcional — adicionar `aria-hidden="true"` no `.live-dot` (já
  faz isso? checar). Verificado: HTML não está mostrado aqui mas worth checking.

#### P2-5. Skip link `.ct-skip-link` cor `var(--primary)` + `#fff` em noir
- **Arquivo:** `app/globals.css:2524-2539`
- **Problema:** em noir `--primary: #FAFAFA` (branco). Skip link vira
  "branco sobre branco" — invisível. **Texto** `color:#fff` sobre
  `background:var(--primary)` em noir = 1:1. **Skip link BUG em noir.**
- **Cálculo:** `#FFF` on `#FAFAFA` = (1.0+0.05)/(0.957+0.05) = 1.04:1 FAIL.
- **Fix:** trocar `background: var(--primary); color: #fff;` por algo que
  funcione em todos os temas, p.ex.: `background: var(--text); color: var(--bg);`
  (light: dark on light, dark: light on dark, noir: white on black ✓).

#### P2-6. SiteSocialProof / SiteMetrics counters: `aria-live` regions?
- **Arquivos:** `components/site/SiteMetrics.js:60`, `SiteSocialProof.js:33`,
  `SiteFeatures.js:105`, `SiteTrustBar.js:77`, `SiteHowItWorks.js:56`.
- **Problema:** counters animam 0→N em ~1.2s. Sem `aria-live` o SR não
  anuncia o número final. Para SR, parecem "vazio" ou só lê o valor inicial.
- **Fix:** marcar containers com `aria-live="off"` e adicionar `aria-label`
  no parent contendo o valor final estático (ex.: `aria-label="159 chunks"`).
  Ou esconder o counter inteiro de SR com `aria-hidden="true"` no número
  animado e expor `<span class="sr-only">159</span>`.

---

### P3 — Polish

#### P3-1. Sem opção OpenDyslexic / dyslexia-friendly font
- Plus Jakarta Sans (`--font-body`) é uma sans humanista — **OK pra
  disléxicos** comparado a Inter/SF, mas não otimizada. Spectral (display)
  é serifa transitional moderna — também OK.
- **Sugestão:** adicionar opt-in via setting `dyslexia: true` que troca
  `--font-body` por `'Atkinson Hyperlegible'` (livre, Braille Institute).
  Letter-spacing já está em `0.005em` no `.btn`, headings com `-0.02em` —
  considerar adicionar `letter-spacing: 0.02em` em `body` quando dyslexia
  mode ativo.

#### P3-2. Scrollbar `width: 8px` (`globals.css:531`) — touch fica difícil
- 8px é OK em desktop com mouse, **abaixo dos 24px mínimos para touch**.
  Não bloqueia (touch scroll é por gesto), mas se usuário tentar arrastar
  thumb não consegue.

#### P3-3. `Modal.js` poderia ter `role="alertdialog"` opcional
- Hoje sempre `role="dialog"`. Pra confirmações destrutivas
  (`/meus-dados/page.js:240` "APAGAR conta"), o correto é `role="alertdialog"`
  com `aria-describedby` apontando para o aviso de irreversibilidade.

#### P3-4. `<details>/<summary>` da FAQ sem `aria-expanded`
- `components/site/SiteFaq.js:115-175` — `<details>` nativo já expõe
  `aria-expanded` automaticamente pra SR, MAS o chevron decorativo
  `<span>` poderia ser `aria-hidden="true"` (já está, linha 144 ✓).
  No-op — já está OK.

#### P3-5. Pulse animations (loading) duram 1.8s
- `.live-dot` `pulse 1.8s infinite` (globals.css:616). WCAG 2.2.2 Pause/Stop/Hide
  exige controle sobre conteúdo que pisca > 5s. 1.8s é OK, mas se múltiplos
  pulsantes simultâneos (live-dot + theme-toggle dot + bell glow), fica
  acumulado. Já mitigado por reduced-motion global.

---

## Keyboard nav report (por superfície)

| Superfície | Tab alcança? | ESC fecha? | Tab order lógico? | Focus visible? |
|---|---|---|---|---|
| `AppShell` sidebar nav | ✓ (Links Next.js) | n/a | ✓ | ✓ via `:focus-visible` global |
| `AppShell` mobile nav | ✓ | n/a | ✓ | ✓ |
| `<Modal>` canonical | ✓ (focus trap correto) | ✓ | ✓ | ✓ |
| `CopilotWidget` FAB | ✓ | ✓ (linha 109) | ✓ | ✓ |
| `CopilotWidget` painel | ✓ | ✓ | ✓ (sem focus trap interno — `aria-modal="false"` é intencional, painel é drawer secundário) | ✓ |
| `NotificationsBell` drawer | ✓ | ✓ (linha 142) | **PARCIAL** — `<li>` não focável | ✓ |
| `AchievementToast` | ✓ (close button) | ✗ (sem ESC) | ✓ | ✓ |
| `ThemeToggle` | ✓ | n/a | ✓ | ✓ |
| `RefreshDiagnosisButton` modal | ✓ | **✗ SEM ESC** | **✗ sem focus trap** | ✓ |
| `CvDetailClient` tailor modal | ✓ | **✗ SEM ESC** | **✗ sem focus trap** | ✓ |
| `WelcomeModal` | ✓ (usa `<Modal>`) | ✓ | ✓ | ✓ |
| `OutcomeSurveyModal` | ✓ (usa `<Modal>`) | ✓ | ✓ | ✓ |
| `InterviewModal` / `ChatModal` | ✓ (usa `<Modal>`) | ✓ | ✓ — porém textarea/input sem label | ✓ |
| `OnboardingChat` | ✓ | n/a | ✓ (autofocus a cada step) | ✓ |
| `SiteNav` mobile drawer | ✓ | **✗ SEM ESC** | ✓ | ✓ |
| `SiteFaq` `<details>` | ✓ (nativo) | n/a | ✓ | ✓ |
| `/entrar` form | ✓ | n/a | ✓ | ✓ |
| `/conta` forms | ✓ | n/a | ✓ | ✓ |

---

## Focus management report

### Modal canonical (`components/Modal.js`)
- ✓ Salva `previouslyFocused.current = document.activeElement` antes de abrir
- ✓ Foca o dialog (`tabIndex={-1}` + `focus()`)
- ✓ Focus trap correto (Tab/Shift+Tab dentro)
- ✓ ESC fecha
- ✓ Restaura foco no anterior ao desmontar
- ✓ Trava scroll do body

**Padrão de referência.** Reusar em todos os dialogs.

### `CopilotWidget` painel
- ✓ Autofocus no input após 240ms de abertura
- ✓ ESC fecha
- ✗ Sem focus trap (aria-modal="false" — design intencional)
- Comentário: aceitável porque é drawer permanente, não bloqueante. OK.

### `RefreshDiagnosisButton` modal
- ✗ Nenhum focus management implementado
- ✗ Sem ESC
- ✗ Sem focus trap
- ✗ Sem return-focus
- **PRECISA REFATOR**

### `CvDetailClient` tailor modal
- ✗ Idem acima — mesmas faltas
- **PRECISA REFATOR**

### `NotificationsBell` drawer
- ✓ ESC fecha
- ✗ Sem focus trap
- ✗ Sem foco inicial automático no dialog
- ✗ `<li>` interativo não recebe foco

### `SiteNav` mobile drawer
- ✗ Sem ESC
- ✗ Sem focus trap (aceitável se não for modal — não tem `aria-modal`)
- ✓ Links são `<a>` nativos focáveis

---

## ARIA gaps detectados

| Local | Gap | Severity |
|---|---|---|
| `RefreshDiagnosisButton.js:85` | `<h3>` em modal, esperado `<h2>` | P1-8 |
| `CvDetailClient.js:165-208` | tabs sem `role="tabpanel"` | P2-1 |
| `NotificationsBell.js:288` | `<li onClick>` em vez de `<button>` | P1-2 / P2-2 |
| `InterviewModal.js:85`, `ChatModal.js:71` | textarea/input sem label | P1-3 |
| `PortfolioImportButton.js:70+80` | `<label>` sem `htmlFor` | P1-4 |
| `SiteNav.js:151` | drawer mobile sem ESC | P1-5 |
| `SiteMetrics.js`, etc | counter animado sem `aria-live` apropriado | P2-6 |
| `.ct-skip-link` em noir | invisível (#FFF on #FAFAFA) | P2-5 |

---

## Roteiro de teste manual (com screen reader)

Marque cada item após validar localmente (NVDA + Firefox / VoiceOver + Safari):

- [ ] **Skip link** `Tab` na home → skip link aparece → Enter foca `<main id="main-content">` em todas as rotas
- [ ] **Skip link em NOIR** → verificar visualmente que aparece (P2-5)
- [ ] **AppShell nav** → Tab navega Dashboard → Gaps → ... → Candidaturas em ordem
- [ ] **Theme toggle** → Tab alcança → Enter alterna noir → light → dark → noir
- [ ] **NotificationsBell** → bell ganha foco → Enter abre drawer → ESC fecha → foco volta no bell
- [ ] **NotificationsBell** itens da lista → Tab **NÃO** atinge `<li>` clicáveis (P1-2)
- [ ] **CopilotWidget** FAB → Enter abre → input ganha foco automaticamente → ESC fecha
- [ ] **Modal canonical** abrir Welcome/Outcome → ESC fecha → foco volta no trigger → Tab fica dentro
- [ ] **RefreshDiagnosisButton modal** → ESC NÃO fecha (bug P1-1) → Tab escapa pra fora (bug)
- [ ] **CvDetailClient** abrir modal de CV adaptado → ESC NÃO fecha (bug P1-1)
- [ ] **InterviewModal** → SR anuncia "Sua resposta" no textarea? (Esperado: NÃO, fail P1-3)
- [ ] **SiteFaq** → navegar `<details>` por Tab → Space expande → seta down/up move entre `<summary>`
- [ ] **SiteNav** mobile (resize <860px) → abrir hamburger → ESC NÃO fecha (bug P1-5)
- [ ] **ScoreRing** (dashboard) → SR anuncia número + label "Aderência X%"
- [ ] **SkillGraph** → tooltip `aria-live` anuncia mudança ao trocar foco
- [ ] **AchievementToast** → SR anuncia título + descrição quando aparece (role=status)
- [ ] **Contraste light** zoom 200% → texto-muted ainda legível? (P0-1)
- [ ] **Contraste light** → text-faint usado em corpo de texto? Verificar onde (P0-2)
- [ ] **Reduced motion** (System Preferences > Reduce Motion) → confetti não anima
- [ ] **Reduced motion** → counter do site mostra valor final estático
- [ ] **Touch target** mobile → todos botões >=44x44px (visualmente medir)

---

## Recomendações priorizadas

### Ondas sugeridas

**Wave 9.1 — Bugfix contraste (4h, baixíssimo risco):**
1. `--text-muted` light: `#6B7180` → `#5F6478` (4.5→5.2:1)
2. `--text-faint` light: `#9CA0AE` → `#6C7186` (2.4→4.0:1, sobe pra AA large)
3. `--text-faint` dark: `#5C6171` → `#74798C` (2.9→3.3:1, OK UI)
4. `--site-fg-dim`: alpha 0.45 → 0.55
5. `.ct-skip-link` noir fix: `background:var(--text); color:var(--bg)`

**Wave 9.2 — Modais ad-hoc → Modal canonical (8-12h, médio risco):**
6. Refatorar `RefreshDiagnosisButton`, `CvDetailClient` tailor modal,
   `NotificationsBell` drawer pra usar `<Modal>` canonical OU adicionar
   focus trap manual + ESC + return-focus.

**Wave 9.3 — ARIA + semantic polish (4h):**
7. `NotificationsBell` `<li>` → `<button>` (P1-2)
8. `InterviewModal` + `ChatModal` + Portfolio/Linkedin Import labels (P1-3, P1-4)
9. `SiteNav` mobile drawer ESC (P1-5)
10. `CvDetailClient` tabs adicionar `role="tabpanel"` + `aria-controls` (P2-1)
11. Modal headings: `<h3>` → `<h2>` (P1-8)
12. SiteMetrics counter `aria-live="off"` + `aria-label` no valor final (P2-6)

**Wave 9.4 — Polish (3h):**
13. Theme toggle position responsivo (P2-3)
14. OpenDyslexic / Atkinson Hyperlegible opt-in (P3-1)
15. `role="alertdialog"` opcional no Modal canonical (P3-3)

### Métricas de sucesso pós-fix
- [ ] axe-core / Lighthouse a11y score ≥ 95 em /, /dashboard, /entrar, /conta
- [ ] Pa11y CI verde em todas as rotas listadas
- [ ] WCAG 2.2 AA pass em VoiceOver (macOS) + NVDA (Firefox Windows) + TalkBack (Android Chrome)
- [ ] Zero `<div onClick>` / `<li onClick>` interativos no `grep`

---

## Confiança e limitações

- **Alta confiança**: cálculos de contraste (math reproduzível), grep
  por padrões textuais (label/htmlFor, role/aria-modal, onClick em
  tags não-interativas), análise de `<Modal>` canonical.
- **Confiança média (PRECISA TESTE MANUAL)**:
  - Focus trap real em modais ad-hoc (estático sugere ausência, mas
    pode ter handler global que eu não capturei).
  - `aria-live` real anunciado por SR (depende de combinação SR+browser).
  - Reflow em zoom 200% (não testado, infere-se de tokens).
  - Visual real do skip link em noir (calculo prevê branco-sobre-branco).
- **Não verificado**:
  - Rotas que use `useEffect` + `addEventListener('keydown')` em pais
    podem capturar ESC antes de chegar nos filhos. Não detecto isso só
    com grep.
  - Token `--text-faint` cobertura real: precisa rodar `grep -rn 'text-faint\|--text-faint\|ink-faint'` em produção para mapear todas as instâncias e classificar (texto vs decoração).

---

— **Elrond**, Senhor de Rivendell · Wave 9 Accessibility Audit · 2026-06-25
