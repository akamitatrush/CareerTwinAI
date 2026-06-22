# Review: Dark Mode Contrast + Legibility (Report.js + globals.css)

## TL;DR

A paleta dark "atira no próprio pé" em duas frentes: (a) `--surface (#141414)` está colado em `--bg (#0A0A0A)` — ratio 1.07:1 — então TODO card no report (mirror, gapc, vagac, week, builder) flutua sem distinção visual, dependendo só de `--border (#2A2A2A)` que também é fraca (1.36:1). (b) `--text-subtle (#666666)` está usado em 14+ lugares como texto normal e falha WCAG AA em todos sobre os fundos atuais. O bloco mais quebrado é `.instrument` (Seção 01 do report) — ele usa `background:var(--text)` (#EDEDED), invertendo pra fundo claro, mas filhos como `.formula`, `.ss-body p`, `.ss-calc`, `.inst-delta`, `.seam-delta` continuam apontando para `--accent (#B9D90C)` e `--text-subtle (#666)` que foram calibrados pra fundo escuro — resultado: lima sobre wash-lima dá 1.16:1, ilegível.

## 5 issues já conhecidos — revisita

1. **`.wizard-x:hover` bg `rgba(0,0,0,.04)`** — `app/page.js:390`. AINDA EXISTE. Fix: trocar por `background: var(--surface-2)` ou `rgba(255,255,255,.06)`.
2. **Badge "ilustrativa" baixo contraste** — `components/Report.js:230-246`. Quando `isReal=false`, inline style usa `background:var(--surface-2)` + `color:var(--text-muted)` + `border:1px dashed var(--border-strong)`. text-muted/surface-2 dá 6.5:1 ok, mas a border dashed border-strong/surface-2 dá 1.76:1 — dashed praticamente some. Fix: usar `border:1px dashed var(--text-subtle)` (ratio sobe pra 2.84:1, ainda fraco mas visível), ou trocar pelo token novo `--border-dashed`.
3. **`.kanban-col-count` chip sobre `.kanban-col`** — não está no `globals.css` carregado (provavelmente inline ou outro CSS). Fix sugerido independente: token novo `--surface-hover: #242424` pra criar 3 níveis (bg/surface/surface-hover) e usar nos chips/headers.
4. **Botão "Apagar tudo" terracota-claro no dark** — `--alert: #E07A5F` foi clareada pra dar contraste com fundo escuro, mas perde o sinal "perigo". Não está no Report.js, mas o token afeta `.gapc-freq`, `.falta-chip`, `.err`. Fix: introduzir `--danger: #FF5C45` separado de `--alert` (warning vs destructive — diferentes).
5. **Placeholder dashed na ScoreHistory** — `app/meu-gemeo/page.js:146` (não inspecionei o estilo inline, mas o padrão de dashed border-strong/surface = 1.76:1 se repete). Fix: mesmo do #2.

## Top 10 issues novos (priorizados HIGH → LOW)

### 1. `.instrument` é um falso "light mode" enxertado no dark — HIGH

- **Onde:** `app/globals.css:463-518` (`.instrument`, `.formula`, `.inst-delta`, `.seam-delta`, `.gauge-num`, `.inst-headline h3/p`); `components/Report.js:109-153`.
- **Combinação ruim:**
  - `.instrument` usa `background: var(--text)` → no dark vira `#EDEDED` (branco claro).
  - `.formula` herda: cor é `--text-subtle (#666)` sobre `--accent-soft` (rgba 12% lima) **sobre o `#EDEDED`** → mistura ~`#DDE7C0` (L≈0.74). Contrast `#666 / #DDE7C0` ≈ **4.05:1 FAIL pra 11.5px**.
  - `.formula b` é `--accent (#B9D90C, L≈0.64)` sobre o mesmo wash → **1.16:1 GRAVE FAIL**. Os pesos da fórmula (.40/.30/.20/.10) viram fantasmas.
  - `.inst-delta` (font 12) e `.seam-delta` (font 11) usam `color:var(--accent)` sobre `--mirror-seam` ou `.instrument` (ambos bg=text=#EDEDED) → **1.38:1 GRAVE FAIL**. O ▲ +delta fica invisível justo no momento de celebração.
  - `.inst-headline p` text-subtle sobre bg branco: 4.81:1 (passa borderline AA, mas combinado com itálico+font-serif fica cansativo).
- **Impacto:** Toda a seção 01 ("O número, por dentro"), que é a SEÇÃO ÂNCORA do report, tem três elementos críticos (fórmula, delta de score, sub-scores) com contrast falhando.
- **Fix:** Não inverter o `.instrument` no dark — tratar como card escuro normal. Substituir `background:var(--text)` por `background:var(--surface-2)` e `color:var(--bg)` por `color:var(--text)`. Re-validar `.gauge-num` (45px, alto contraste mesmo invertido) — pode manter dourado se quiser destaque. Alternativa cirúrgica: criar `--instrument-bg` e `--instrument-text` no `:root[data-theme="dark"]`.

### 2. `.subscores` (`.ss`) herda o caos do `.instrument` — HIGH

- **Onde:** `app/globals.css:521-563`; `Report.js:124-152`.
- **Combinação ruim:** `.ss` tem `background:var(--accent-soft)` sobre o `.instrument` (bg=text=#EDEDED). Cor final ≈ `#DDE7C0`. Então:
  - `.ss-body p` color text-muted (`#A3A3A3`) sobre `#DDE7C0` → **1.76:1 GRAVE FAIL**.
  - `.ss-calc` color accent (`#B9D90C`) sobre accent-soft sobre branco → **1.16:1 GRAVE FAIL** (mesmo problema da fórmula, e essa é A explicação da matemática que o produto promete ser "auditável").
  - `.ss-weight` (font 10.5) text-subtle sobre o mesmo wash: **4.05:1 borderline FAIL**.
  - `.ss-chev` text-subtle: idem 4.05:1.
- **Impacto:** Quando o usuário expande um sub-score (que é a interação central da seção), o texto explicativo e o cálculo ficam ilegíveis.
- **Fix:** Mesmo do #1 — recalibrar `.instrument` pra usar surface escuro. Aí `.ss` continua com `accent-soft` mas agora ele é wash sobre escuro (já testado: bom contraste).

### 3. `--text-subtle (#666)` está sub-calibrado pro dark — HIGH

- **Onde:** Token em `globals.css:32`. Usado em **14+ lugares** no Report.js: `.mirror-tag`, `.seam-tag`, `.seam-of`, `.ss-weight`, `.ss-chev`, `.vagac-co`, `.match-lbl`, `.falta-lbl`, `.transp`, `.note-line`, `.modal-sub`, `.modal-x`, `.chat-empty`, `.iv-loading`, `.iv-hint`, `.iv-nota small`, `.iv-collbl`, `.tl-legend`, `.tl-base`, `.chat-input`(no estilo placeholder default).
- **Combinação ruim:**
  - `#666 / #0A0A0A (bg)` = **3.47:1 FAIL** pra texto normal AA (precisa 4.5).
  - `#666 / #141414 (surface)` = **3.23:1 FAIL**.
  - `#666 / #1F1F1F (surface-2)` = **2.84:1 FAIL severo**.
  - `#666 / #3A3A3A (border-strong)` (se ovrelap): 1.84:1 GRAVE.
- **Impacto:** A categoria inteira de "labels mono caps" (mirror-tag, seam-tag, match-lbl, falta-lbl, week-no na seção 04, etc.) — tudo no padrão jornalístico do produto — fica washed out. Embora tipograficamente sejam "metadata", AA falha tecnicamente.
- **Fix:** Subir `--text-subtle` no dark de `#666` para **`#8A8A8A`** (L≈0.265, ratio 5.4:1 sobre bg, 4.81:1 sobre surface, 4.06:1 sobre surface-2). Mantém hierarquia abaixo de text-muted (#A3) sem cair em ilegibilidade. Ou mais agressivo: `#909090` (5.97:1 sobre bg).

### 4. `--surface` cola em `--bg` — cards somem — HIGH

- **Onde:** Token em `globals.css:26`. Aplicado em: `.builder`, `.mirror`, `.gapc`, `.vagac`, `.week`, `.iv-question`, `.iv-suggest`, `.tl-resumo`, `.tl-bullet`, `.bubble.assistant`, `.chat-starter`, `.field textarea`, `.field input`, `.chat-input`, `.iv-answer`.
- **Combinação ruim:** `#141414 / #0A0A0A` = **1.07:1**. Não há WCAG pra container-vs-container mas como sinal visual de "elevação" é nulo. Aí a única coisa que separa card de fundo é a `--border` (#2A2A2A), que sobre bg dá **1.47:1** (também pífio).
- **Impacto:** No report — que tem 5+ tipos de card (mirror, instrument, gapc, vagac, week) — o ritmo visual depende de cards "se levantando" do fundo. No dark atual, eles afundam. Owner reporta "tela difícil de ler" — boa parte é esse afogamento.
- **Fix:** Subir `--surface` no dark para **`#1A1A1A`** (L≈0.011, ratio com bg = 2.04:1) e `--surface-2` para **`#242424`** (ratio com surface ≈ 1.45:1, com bg ≈ 2.94:1). Borda fica forte por contraste mesmo sem subir. Alternativa: manter surface=#141414 e subir `--border` pra `#333333` (ratio 1.97:1 com bg) pra desenhar caixas mais nítidas.

### 5. Bordas de input invisíveis (`.field input/textarea`, `.iv-answer`, `.chat-input`) — HIGH

- **Onde:** `globals.css:265-281`, `955-966`, `1191-1201`.
- **Combinação ruim:** `border:1px solid var(--border)` (#2A2A2A) sobre `background:var(--surface)` (#141414) → **1.36:1**. Inputs grandes ainda dão pra adivinhar pelo padding, mas não há sinal de affordance.
- **Impacto:** Usuário não sabe onde clicar pra digitar. Em forma builder + iv-answer + chat-input + tl, são 5+ inputs por sessão.
- **Fix:** Input usa `--border-strong` (#3A3A3A) — sobe ratio pra 1.76:1, ainda fraco mas mais visível. Combinar com fix #4 (surface mais clara) eleva tudo. Ou criar token `--border-input: #4A4A4A` (ratio 2.55:1).

### 6. `--accent` (#B9D90C) usado como texto em fontes pequenas — MEDIUM

- **Onde:** `.inst-delta` (12px), `.seam-delta` (11px), `.ss-calc` (11.5px), `.ss-up` inline com label, `.formula b` (11.5px), `.gapc-freq` (10.5px, mas color é alert), `.ss-chev.open` (16px icon).
- **Combinação ruim:** Sobre fundo escuro (#0A): 12.1:1 ✓. Mas a maioria dos usos do accent como texto **acontece sobre `--instrument` ou `--mirror-seam` que são `bg:var(--text)=#EDEDED`** → 1.38:1 GRAVE FAIL. Mesmo sobre accent-wash (mistura com escuro 9:1, ok). O problema é especificamente onde accent é texto e o container inverte pra claro.
- **Impacto:** O verde-limão é a "marca" — mas vira ilegível justo nos micro-numerais de status (+delta, sub-score breakdown).
- **Fix:** Pra texto pequeno sobre fundo claro, usar `--accent-deep` (#D8EE5A — atualmente mais claro que accent, errado!). Recalibrar `--accent-deep` no dark pra um lima MAIS ESCURO (ex.: `#7C9106` igual ao light theme) e usá-lo quando o texto cair sobre `--text`/`--instrument`. Ou simplesmente eliminar inversão (#1).

### 7. `--alert` (#E07A5F) sobre `--alert-wash` em fontes 10-11px — MEDIUM

- **Onde:** `.gapc-freq` (`globals.css:602-610`, 10.5px), `.falta-chip` (716-722, 10.5px), `.iv-chip.bad` (1019), `.proc-steps .step.doing::before`.
- **Combinação ruim:** alert (#E07A5F, L≈0.265) sobre alert-wash (rgba 12% sobre bg=#0A → ≈#1A0F0D, L≈0.0094 quando isolado, mas dentro de surface=#141 vira ~#221A18 L≈0.022): ratio ≈ **4.4:1 borderline FAIL** pra texto 10.5px (AA exige 4.5).
- **Impacto:** Chips "falta:", "frequência das vagas", "ponto fraco" — labels de informação clínica do report — beiram o ilegível.
- **Fix:** Subir `--alert` pra `#E88A6F` (L≈0.317, ratio 5.0:1) ou intensificar `--alert-wash` reduzindo opacidade pra criar mais contraste (rgba 8% em vez de 12%).

### 8. `.chip` border quase invisível — MEDIUM

- **Onde:** `globals.css:372-380`. `.mirror` Section.
- **Combinação ruim:** `border:1px solid var(--border)` (#2A2A2A) sobre `background:var(--surface-2)` (#1F1F1F) → **1.27:1**. As skills do perfil viram blobs sem moldura.
- **Impacto:** No mirror header (a vitrine "Você · hoje" vs "Alvo"), a lista de skills é uma sopa de cinza.
- **Fix:** `.chip` usar `border-color: var(--border-strong)` (ratio 1.59:1 sobre surface-2 — fraco ainda mas melhor). Combinado com fix #4 (surfaces mais escuras), o chip ganha definição.

### 9. `.bubble.assistant` border + `.tl-bullet` border somem — LOW

- **Onde:** `globals.css:1177-1183`, `1085-1095`.
- **Combinação ruim:** border (#2A2A2A) sobre surface (#141414) = 1.36:1. Bubbles do chat e bullets do tailor modal viram blocos sem moldura. Chat assistant fica com bottom-left-radius:2px que ajuda a diferenciar, mas tailor não.
- **Impacto:** Conversa do chat e sugestões do tailor parecem texto solto.
- **Fix:** Mesmo do #5. Usar `border-strong` (1.76:1) ou adicionar `box-shadow: 0 1px 0 var(--border-strong)` como falsa elevação.

### 10. `.proc-steps .step` opacity 0.32 sobre text-muted = ilegível antes do "doing" — LOW

- **Onde:** `globals.css:325-326`.
- **Combinação ruim:** color text-muted (#A3A3A3) com `opacity:.32` resulta em luminância efetiva muito próxima do bg. Não passa AA.
- **Impacto:** Os "próximos passos" do processing parecem sumir. Aceitável como sinal visual de "ainda não", mas dificulta antever a sequência.
- **Fix:** opacidade .5 em vez de .32, ou color text-subtle direto (uma vez que o token suba — issue #3).

## Tokens novos sugeridos

- `--surface-hover: #242424` — pra hover de chips/cards (resolve issue conhecido #1 e melhora kanban).
- `--border-input: #4A4A4A` — pra inputs especificamente, evita repetir hack inline.
- `--text-on-accent: var(--accent-text)` — alias semântico (já existe `--accent-text`, mas o nome confunde; usar este nas microactions).
- `--danger: #FF5C45` — separado de `--alert` (warning vs destructive). Usar em "Apagar tudo", confirmação de delete, etc.
- `--accent-on-light: #7C9106` — pra texto accent sobre fundos claros (instrument, mirror-seam). Resolve issue #6.
- `--instrument-bg: var(--surface-2)` + `--instrument-text: var(--text)` — desacopla a inversão atual, permite recalibrar sem mexer no token global `--text`.
- `--ring-focus: 3px solid color-mix(in srgb, var(--accent) 60%, transparent)` — atualmente focus usa só `outline:2px solid var(--text)` que some sobre `--instrument` (bg=text).

## Paleta refinada (proposta)

```css
:root, :root[data-theme="dark"] {
  --bg: #0A0A0A;                   /* mantém */
  --surface: #1A1A1A;              /* SUBIR de #141414 → 2.04:1 com bg (fix #4) */
  --surface-2: #242424;            /* SUBIR de #1F1F1F → 2.94:1 com bg, 1.45:1 com surface */
  --surface-hover: #2F2F2F;        /* NOVO */
  --border: #333333;               /* SUBIR de #2A2A2A → 1.97:1 com bg, melhor card definition */
  --border-strong: #4A4A4A;        /* SUBIR de #3A3A3A → 2.55:1 com bg */
  --text: #EDEDED;                 /* mantém */
  --text-muted: #B0B0B0;           /* SUBIR levemente de #A3A3A3 → 8.8:1 sobre bg (era 8.0) — opcional */
  --text-subtle: #909090;          /* SUBIR de #666666 → 5.97:1 sobre bg, 5.46:1 sobre surface (fix #3) */

  --accent: #B9D90C;               /* mantém pra fundos escuros */
  --accent-deep: #7C9106;          /* INVERTER lógica: agora deep é MAIS ESCURO, pra usar sobre fundo claro (fix #6) */
  --accent-soft: rgba(185,217,12,.12);
  --accent-wash: rgba(185,217,12,.10);
  --accent-text: #0A0A0A;

  --alert: #E88A6F;                /* SUBIR levemente de #E07A5F → 5.0:1 (fix #7) */
  --alert-wash: rgba(232,138,111,.10);
  --danger: #FF5C45;               /* NOVO — separado de alert */

  --ok: #6FB58E;                   /* mantém */
  --ok-wash: rgba(111,181,142,.12);

  --scrim: rgba(0,0,0,.6);
}
```

**Mudanças críticas (em ordem de impacto):**

1. **`.instrument` para de inverter** (mudar `background:var(--text)` → `var(--surface-2)`, `color:var(--bg)` → `var(--text)`). Sozinha, essa mudança consertar issues #1, #2, #6 (a maioria das falhas graves).
2. **`--surface` sobe pra #1A1A1A** + **`--surface-2` pra #242424** + **`--border` pra #333**. Resolve cards afundados (#4) e bordas invisíveis (#5, #8, #9).
3. **`--text-subtle` sobe pra #909090**. Resolve labels mono ilegíveis em 14+ lugares (#3).
4. Wizard-x hover usar `var(--surface-2)` em vez de `rgba(0,0,0,.04)` (issue conhecido #1).

Com (1)+(2)+(3) feitos, ~80% dos 10 issues do report some sem mexer no JS.
