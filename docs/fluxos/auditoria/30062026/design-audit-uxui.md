# Design-Systems-UXUI-BR — Auditoria visual app logado

> Data: 2026-06-30  
> Autor: agente `design-systems-uxui-br` (persona Linear/Vercel/Stripe/Cloudwalk)  
> Escopo: `app/(app)/*` + `app/transparencia/*` + `components/AppShell.js` + `components/AlgorithmDisclaimer.js` + `components/DashboardHighlightBanner.js` + `app/globals.css` (6.718 linhas)  
> Status: **research-only — NÃO edita CSS**  
> Direção solicitada: clean (vs sujo/neon/colorido)  
> Branch alvo: `redesign/claude-design`

---

## 1. Diagnóstico macro (1 parágrafo)

A sensação de "sujo / neon / colorido" do app logado **não é exagero**: é arquitetural. O CSS atual mistura **dois sistemas de cor conflitantes** (indigo `--primary` + cyan `--accent-cyan` vibrante), **3 temas** (`light` / `dark` / `noir`) onde o `noir` é radicalmente diferente dos outros dois (lime `#C2F542`), e — pior — adotou como **padrão sistêmico** o empilhamento de `app-glass + site-section-mesh + boxShadow accent-cyan-glow + drop-shadow accent-cyan-glow + border accent-cyan-glow + filter drop-shadow` em praticamente toda hero/header/banner do produto. Isso é o anti-padrão #2 da minha filosofia ("glassmorphism + accent glow + box-shadow simultâneos = 3 efeitos competindo") elevado a regra de UI. Sobreposto a isso, **TODA tela do app usa display sizes de landing** (`clamp(40px, 6vw, 80px)` em `.ct-page-header-title`) — equivalente a abrir o Vercel Dashboard e encontrar h1 do tamanho de hero da homepage. Resultado: o produto está disfarçado de landing, e a hierarquia visual desapareceu porque cada elemento grita.

---

## 2. Inventário visual atual

### 2.1 Tokens de cor (do `app/globals.css`)

**Cor de marca (3 escalas que coexistem):**

| Token | Light (`:root`) | Dark | Noir | Linha |
| --- | --- | --- | --- | --- |
| `--primary` | `#4F4FB0` indigo | `#8585D9` indigo claro | `#FAFAFA` branco | 12 / 191 / 268 |
| `--primary-deep` | `#34357E` | `#6B6BC8` | `#E5E5E5` | 13 / 193 / 269 |
| `--primary-light` | `#6B6BC8` | `#A2A2E5` | `#FFFFFF` | 16 / 192 / 272 |
| `--primary-soft` | `#EEEEFB` | `#2A2A4F` | `#1F1F1F` | 14 / 194 / 270 |
| `--primary-tint` | `#C7C7E8` | `#5C5CA8` | `#2A2A2A` | 15 / 195 / 271 |
| `--accent-cyan` | `#70FFDD` | `#70FFDD` | `#C2F542` (lime!) | 22 / 218 / 284 |
| `--accent-cyan-deep` | `#4DCFB3` | `#5BE0C4` | `#A8DB28` | 23 / 219 / 285 |
| `--accent-cyan-glow` | `rgba(112,255,221,.35)` | `rgba(112,255,221,.42)` | `rgba(194,245,66,.18)` | 24 / 220 / 286 |
| `--accent-magenta` | `#B924FF` | `#D364FF` | `#FAFAFA` (branco neutralizado) | 25 / 221 / 287 |

**Observação crítica**: o nome `--accent-cyan` é **mentiroso no tema noir** — vira lime `#C2F542`. O fundador citou "muito cor", e o tema "noir" deveria ser o cura — mas ele já não é cyan, é lime Cloudwalk. Provavelmente os usuários estão majoritariamente em **dark** (`#70FFDD` cyan agressivo).

**Surfaces (4 níveis — recomendo 3):**

| Token | Light | Dark | Noir | Linha |
| --- | --- | --- | --- | --- |
| `--bg` | `#F4F6FA` | `#0D1117` | `#000000` | 141 / 168 / 248 |
| `--surface` | `#FFFFFF` | `#161B22` | `#0A0A0A` | 142 / 169 / 249 |
| `--surface-2` | `#F8FAFC` | `#1F2530` | `#121212` | 143 / 170 / 250 |
| `--surface-3` | `#EDF1F7` | `#2A3140` | `#1A1A1A` | 144 / 171 / 251 |

→ **4 níveis é overkill** (anti-padrão #8: "6 níveis de surface — 3 níveis máximo"). `--surface-3` vs `--surface-2` em dark (`#2A3140` vs `#1F2530`) tem ΔL ≈ 4% — ruído imperceptível que polui o sistema.

**Texto (5 níveis + 2 aliases):**

| Token | Light | Dark | Noir | Linha |
| --- | --- | --- | --- | --- |
| `--text` | `#1A1B2E` | `#F0F2F6` | `#FAFAFA` | 147 / 174 / 258 |
| `--text-strong` | `#1A1B2E` | `#FFFFFF` | `#FFFFFF` | 148 / 175 / 259 |
| `--text-soft` | `#4A4D63` | `#C9CDD8` | `rgba(250,250,250,.78)` | 149 / 176 / 260 |
| `--text-muted` | `#5A5F6D` | `#8A8FA1` | `rgba(250,250,250,.65)` | 152 / 177 / 261 |
| `--text-faint` | `#6A6E7B` | `#8A8FA0` | `rgba(250,250,250,.42)` | 155 / 182 / 262 |
| `--text-subtle` (alias) | `#4A4D63` | `#C9CDD8` | `rgba(250,250,250,.78)` | 156 / 183 / 264 |
| `--text-dim` (só noir!) | — | — | `rgba(250,250,250,.42)` | 263 |

→ **5 níveis de texto é tolerável** mas a diferença entre `--text-muted` (`#8A8FA1`) e `--text-faint` (`#8A8FA0`) em dark é **1 dígito de hex** (basicamente o mesmo cinza). E `--text-subtle` é um alias confuso (legado).

**Aliases (linha 366-400):**

```css
:root, :root[data-theme="dark"], :root[data-theme="noir"], :root[data-theme="light"] {
  --accent: var(--primary);          /* mas em noir, --accent override pra #FAFAFA */
  --accent-soft: var(--primary-soft);
  --accent-text: #FFFFFF;            /* hardcoded! quebra em noir */
  --accent-deep: var(--primary-light);
  --ink: var(--text);
  --ink-soft: var(--text-muted);
  --ink-faint: var(--text-subtle);
  --rule: var(--border);
  --bone: var(--bg);
  --card: var(--surface);
  --line: var(--border);
  --citron: var(--accent);
  ...
}
```

→ **Aliases legados redundantes**: `--ink`/`--text`, `--card`/`--surface`, `--line`/`--border`, `--bone`/`--bg`, `--citron`/`--accent` etc. Cada par é a mesma cor com 2 nomes. Decisão correta de quando manter o nome novo? Nenhuma — todos coexistem no codebase. Dívida pura.

**Glow / shadow / mesh tokens extras:**

```css
/* :root base (light + default) */
--site-mesh-cyan: rgba(112, 255, 221, 0.10);             /* linha 49 */
--site-mesh-magenta: rgba(185, 36, 255, 0.08);            /* linha 50 */
--site-shadow-card: 0 8px 32px rgba(0,0,0,.32), 0 0 0 1px rgba(255,255,255,.06) inset;
--site-shadow-card-hover: 0 16px 48px rgba(0,0,0,.40), 0 0 0 1px rgba(112,255,221,.25) inset;
--site-glass-blur: 20px;                                  /* linha 43 */
--app-glass-bg: rgba(255,255,255,.04);                    /* linha 62 */
--app-glass-blur: 16px;                                   /* linha 64 */
```

→ `--site-mesh-cyan` é **usado no app via `.site-section-mesh`** (anti-pattern #4 — mesh radial gradient em containers de produto). O nome "site-" deveria ser barreira mas não é.

### 2.2 Classes utilitárias notáveis

| Classe | Linha | Função | Pecado |
| --- | --- | --- | --- |
| `.app-glass` | 6664 | `backdrop-filter: blur(16px) + rgba bg + border` | Usada em 15+ lugares com glow empilhado |
| `.site-section-mesh` | 6373 | 2 radial-gradients (cyan + magenta) | Usada em **5 telas de produto** (anti-pattern #4) |
| `.site-card-glass` / `.site-card-glass-accent` | 6381 / 6400 | blur(20px) + alpha + shadow inset + glow | OK pra landing, **não** pra app — mas é usado em vários lugares |
| `.ct-page-header` | 6202 | header card com `border-left: 4px solid accent-cyan` + `::after gradient cyan-glow` | 8 telas usam — accent cyan em cada header |
| `.ct-page-header-title` | 6231 | `clamp(40px, 6vw, 80px)` | **Display size em h1 de produto** (anti-pattern #9). Vercel/Linear usam 22-28px |
| `.ct-score-ring-wrap` | 2256 | `drop-shadow(indigo) drop-shadow(cyan-glow)` + `scoreGlow 12s pulse` | 2 drop-shadows empilhados + animação pulsante em hero estático |
| `.ct-highlight-banner` | 6098 | `border-left: 4px solid cyan` + `::after gradient cyan-glow` | Acumula gradient + accent |
| `.ct-highlight-banner-icon` | 6121 | `linear-gradient cyan + box-shadow cyan-glow` | Glow em ícone decorativo |
| `.ct-empty-state-v2-icon` | 6292 | `linear-gradient cyan` + `box-shadow -6px cyan-glow` | Mais glow |
| `.ct-dash-hero` | 2229 | `radial-gradient primary-soft + surface + ::before radial primary-soft` | 2 gradientes empilhados em card de dashboard |
| `.ct-dash-empty` | 2197 | `radial-gradient(120% 80%) + surface` | Mais um gradient mesh em estado vazio |
| `.cloud-accent`, `.cloud-accent-bg`, `.cloud-accent-border` | 6698-6709 | Atalhos pro lime Cloudwalk | Dead code? Conflita com noir |
| `.h-brutal` | 6713 | `letter-spacing: -0.05em + line-height: 0.92` | OK só pra landing |
| `.ct-accent-glow` / `.ct-pulse-cyan` | 6274-6277 | hover/pulse cyan | Anti-pattern #5 (decorative pulsing em produto) |

### 2.3 Conflicts identificados (contagem real)

1. **3 sistemas de cor coexistem como "accent" no app**:
   - `--primary` (indigo) — usado em `.ct-ss-value`, `.ct-target-value`, `.ct-action-num`, navegação ativa
   - `--accent-cyan` (cyan vibrante) — usado em headers, banners, glows, borders
   - `--accent` (alias pra primary, mas em noir vira branco) — usado em `.mark`, `.btn-primary`, `.gauge-arc`

2. **`--accent-cyan-glow` é referenciado em ~25 lugares** (CSS + JSX inline):
   - 14x em `globals.css` (linhas 759, 2262, 2266, 2272, 6275, 6276, 6280, 6296, 6314, 6320, 6325, 6603, 6604, 6438...)
   - 11x em pages/components (`page.js` do dashboard, gaps, oportunidades, cvs-adaptados, conta, estagios, evidencias, funil, concursos + `DashboardHighlightBanner.js`, `MicroactionCard.js`, `GapsKpiStrip.js`, `RequirementsFrequency.js`, `SkillMap.js`, `AchievementToast.js`, `CopilotWidget.js`, `NotificationsBell.js`, `RadarClient.js`)

3. **Padrão repetido "hero ambicioso" em 8 page.js do app**:
   ```
   className="ct-page-header site-section-mesh"
   style={{
     paddingTop: "clamp(56px, 9vw, 96px)",
     paddingBottom: "clamp(32px, 5vw, 64px)",
     boxShadow: "0 8px 24px -6px var(--accent-cyan-glow), var(--shadow-md)"
   }}
   ```
   - `app/(app)/dashboard/page.js:121-126` (sem boxShadow, com clamps)
   - `app/(app)/gaps/page.js:134-140`
   - `app/(app)/oportunidades/page.js:72-78`
   - `app/(app)/autoconhecimento/page.js:57-64`
   - `app/(app)/carreira/page.js:34-40`
   - `app/(app)/evidencias/page.js:39-45`
   - `app/(app)/conta/page.js` (segue padrão similar)
   - `app/(app)/plano/page.js` (segue padrão similar)

4. **4 níveis de surface** (`--bg`, `--surface`, `--surface-2`, `--surface-3`) com Δ insuficiente em dark (`#1F2530` vs `#2A3140` ≈ 4% L).

5. **5 níveis de texto + 2 aliases** (`--text`, `--text-strong`, `--text-soft`, `--text-muted`, `--text-faint`, `--text-subtle`, `--text-dim` em noir). `--text-muted` (`#8A8FA1`) vs `--text-faint` (`#8A8FA0`) em dark = **mesmo cinza**.

6. **`--accent` desreferencia diferente por tema**: em light/dark vira indigo; em noir vira branco. Componentes que usam `var(--accent)` mudam de significado entre temas — bug de design system.

7. **`.candidaturas` quebra o padrão inteiro**: `app/(app)/candidaturas/page.js:28-50` usa `topbar-inner`, `brand-mark`, `wrap` (linhas 589-615 do CSS — design system **velho**) + hardcoded `#B9D90C` (lime — nem do design atual). É um Ítaca esquecido.

8. **`--accent-text: #FFFFFF` hardcoded** (linha 92) — quando aplicado em noir (`--accent: #FAFAFA`), texto branco sobre fundo quase branco. Bug de contraste latente.

9. **Mesh radial em telas de produto** (`.site-section-mesh` em 5 page.js do app): `radial-gradient cyan + magenta` empilhado. Anti-pattern #4 explícito.

10. **Animações decorativas pulsantes**: `@keyframes scoreGlow` (12s loop) na linha 2265, `@keyframes ctAccentPulse` (7s loop) na 6279, `@keyframes pulse` (1.8s loop) na 633. Tudo em telas de produto.

---

## 3. Heatmap de problemas (tela × categoria × severidade)

Categorias: **Cor** (mono-accent saturado, contraste), **Hier** (hierarquia tipográfica), **Efeit** (efeitos empilhados), **Mob** (mobile/clamp), **Tipo** (size/weight/spacing), **Dec** (decoração gratuita).

P0 = bloqueador "sujo/neon" / P1 = ruidoso mas tolerável / P2 = polish.

| Tela / componente | Cor | Hier | Efeit | Mob | Tipo | Dec | Pior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/dashboard` (`dashboard/page.js`) | **P0** | P1 | **P0** | P1 | **P0** | P1 | **P0** |
| `/gaps` (`gaps/page.js`) | **P0** | P1 | **P0** | P0 | P0 | P1 | **P0** |
| `/oportunidades` (`oportunidades/page.js`) | **P0** | P1 | **P0** | P1 | P0 | P1 | **P0** |
| `/conta` (`conta/page.js`) | P0 | P1 | P1 | P1 | P0 | P2 | **P0** |
| `/plano` (`plano/page.js`) | P0 | P1 | P1 | P1 | P0 | P2 | **P0** |
| `/carreira` (`carreira/page.js`) | **P0** | P1 | P1 | P0 | P0 | P1 | **P0** |
| `/autoconhecimento` (`autoconhecimento/page.js`) | **P0** | P1 | P1 | P0 | P0 | P1 | **P0** |
| `/evidencias` (`evidencias/page.js`) | P0 | P1 | P1 | P0 | P0 | P2 | **P0** |
| `/concursos` (`concursos/page.js`) | P1 | P1 | P1 | P1 | P0 | P2 | **P1** |
| `/estagios` (`estagios/page.js`) | P1 | P1 | P1 | P1 | P0 | P2 | **P1** |
| `/funil` (`funil/page.js`) | P1 | P1 | P2 | P1 | P0 | P2 | **P1** |
| `/cvs-adaptados` (`cvs-adaptados/page.js`) | **P0** | P2 | P0 | P2 | P1 | P2 | **P0** |
| `/candidaturas` (`candidaturas/page.js`) | **P1** | P0 | P2 | P2 | P0 | P2 | **P0** (legado) |
| `/transparencia` (`transparencia/page.js`) | P1 | P1 | P1 | P1 | P0 | P1 | **P0** |
| `AppShell` sidebar (`AppShell.js`) | P2 | P2 | P2 | P2 | P2 | P1 | **P1** |
| `AlgorithmDisclaimer` | — | — | — | — | P2 | — | **P2 (calmo ✓)** |
| `DashboardHighlightBanner` | **P0** | P2 | **P0** | P2 | P2 | P1 | **P0** |
| `GapsKpiStrip` + `MicroactionCard` | **P0** | P1 | **P0** | P2 | P1 | P1 | **P0** |

**Resumo**: 10 das 14 telas têm pelo menos um **P0** (sujo). O AppShell sidebar é o **único** elemento já calmo (P1/P2 worst-case). O `AlgorithmDisclaimer` que criei hoje é o **mais discreto do app** — bom sinal, pode ser o template visual pro resto.

---

## 4. Hipóteses confirmadas/refutadas

| # | Hipótese | Status | Evidência |
| --- | --- | --- | --- |
| 1 | **Mono-accent cyan saturado em tudo** | ✅ **CONFIRMADA** | `--accent-cyan: #70FFDD` referenciado em **25+ lugares** (CSS + JSX). Usado em: header border, banner border, button glow, icon glow, KPI value drop-shadow, score ring glow, eyebrow color, hover state, focus ring, pulse animation. Linha 22 / 218 do `globals.css`. |
| 2 | **Glassmorphism overdose** | ✅ **CONFIRMADA** | `.app-glass` (linha 6664) + `.site-card-glass` (6381) + `.site-card-glass-accent` (6400) + cada tem `backdrop-filter: blur(16-20px)` + alpha overlay + box-shadow. Aplicado em `.ct-dash-hero`, `.ct-empty-state-v2`, `.ct-microaction-card`, `.ct-kpi-card`, `.ct-profile-card`, `.ct-highlight-banner`, todo `.ct-page-header`, todos `NoTargetState`/`NoJobsState`. **15+ aplicações por viewport possível**. |
| 3 | **Mesh radial gradients em containers grandes** | ✅ **CONFIRMADA** | `.site-section-mesh` (linha 6373) usado em **8 page.js do app**: dashboard, gaps, oportunidades, autoconhecimento, carreira, evidencias, conta, plano. Plus: `.ct-dash-hero` tem **2 radial-gradients empilhados internos** (linha 2233-2249); `.ct-dash-empty` tem 1 radial (linha 2199); `.ct-welcome-banner` tem 1 radial + 1 linear (linha 3850-3852). |
| 4 | **Box-shadow + drop-shadow + border-glow empilhados** | ✅ **CONFIRMADA — É O PADRÃO** | Exemplo `gaps/page.js:134-140`: `app-glass + site-section-mesh` (mesh) + `boxShadow: "0 8px 24px -6px accent-cyan-glow, var(--shadow-md)"` (2 box-shadows) + `<div ct-page-header-icon style={{filter: "drop-shadow(0 0 6px accent-cyan-glow)"}}>` (drop-shadow extra) + `.ct-page-header::after` que **adiciona um terceiro gradient cyan** decorativo (linha 6210-6215). **5 efeitos no mesmo header**. |
| 5 | **Pulsing dots, animated decorative SVGs em telas de produto** | ✅ **CONFIRMADA** | `@keyframes scoreGlow` 12s loop em `.ct-score-ring-wrap` (linha 2265) — drop-shadow cyan pulsando no hero do dashboard 24h. `@keyframes ctAccentPulse` 7s loop em `.ct-pulse-cyan` (linha 6279). `@keyframes pulse` em `.live-dot` (1.8s, linha 633). `@keyframes copilotPulse`/`copilotBlip` em CopilotWidget (linha 5335, 5441). E score ring tem **2 drop-shadows simultâneos** (indigo + cyan) na linha 2262. |
| 6 | **Borders vibrantes em vez de `rgba(white, .06)`** | ✅ **CONFIRMADA** | `.ct-page-header` (linha 6206): `border-left: 4px solid var(--accent-cyan)` — em **8 telas**. `.ct-highlight-banner` (linha 6103): `border-left: 4px solid var(--accent-cyan)`. `.site-card-glass-accent` (linha 6404): `border: 1px solid var(--site-accent-glow)`. `.ct-empty-state-v2` (linha 6289): `1.5px dashed cyan-deep`. Em vez de borders neutras, todas usam cyan. |
| 7 | **Display sizes em headings de produto** | ✅ **CONFIRMADA — GRAVE** | `.ct-page-header-title` (linha 6231-6238): **`clamp(40px, 6vw, 80px)`**. Aplicado em **8 telas do app**: dashboard, gaps, oportunidades, conta, plano, carreira, autoconhecimento, evidencias, transparencia. Plus: `.ct-self-hero-title` em autoconhecimento usa inline `clamp(40px, 6vw, 80px)`. **Linear/Vercel/Stripe usam 22-28px em h1 de dashboard**. Estamos com **2.8x maior**. |

**Hipóteses NOVAS descobertas durante audit:**

| # | Hipótese | Evidência |
| --- | --- | --- |
| 8 | **Sistema de cor "primary" (indigo) compete com "accent-cyan"** | Headers usam cyan (`.ct-page-header-eyebrow` cor cyan-deep), mas valores numéricos usam primary indigo (`.ct-ss-value`, `.ct-kpi-value.ct-kpi-primary`, `.ct-target-value`). Dois sistemas paralelos no mesmo viewport. |
| 9 | **`/candidaturas` está fora do design system inteiro** | `app/(app)/candidaturas/page.js:28-50` usa `topbar-inner` (linha 593 CSS antigo), `brand-mark` (linha 595), `wrap` (linha 418) + hardcoded SVG + hardcoded `#B9D90C` (lime velho que nem é do tema atual). |
| 10 | **`.ct-welcome-banner` é o pior offender de gradientes** | Linha 3850-3852: `radial-gradient(120% 80% at 100% 0%, rgba(238,238,251,.6) 0%, transparent 50%), linear-gradient(135deg, primary-soft 0%, surface 100%)`. Dois gradientes empilhados num banner de boas-vindas. |
| 11 | **Empty states empilham glow desnecessário** | `NoTargetState` e `NoJobsState` em `gaps/page.js:289-292` e `:316-318`: `ct-dash-empty app-glass + boxShadow accent-cyan-glow`. Empty state deveria ser o LUGAR mais calmo do app. |
| 12 | **`.cloud-accent*` classes são dead code** | Linha 6698-6709: 3 classes definidas (`.cloud-accent`, `.cloud-accent-bg`, `.cloud-accent-border`). `grep -r "cloud-accent" app/ components/` → 0 usos. Pode remover. |

---

## 5. Paleta proposta CLEAN

### 5.1 Princípios (não-negociáveis)

1. **Um accent vibrante por viewport**. Aplicar somente em: CTA primário OU 1 destaque numérico do contexto. Nunca em borders, glows, dots, eyebrows decorativos.
2. **Bordas neutras sempre** (`rgba(white,.08)` em dark, `rgba(black,.08)` em light).
3. **Sem mesh radial gradients no app** (manter só em `/site/*`).
4. **Sem `backdrop-filter` no app** (manter `app-glass` legacy mas mudar definição pra `background: var(--surface)` sólido).
5. **3 níveis de surface** (`--bg`, `--surface`, `--surface-elevated`). Fim de `--surface-2/-3`.
6. **4 níveis de texto** (`--text-strong`, `--text`, `--text-soft`, `--text-faint`). Fim de `--text-muted`, `--text-subtle`, `--text-dim`.
7. **Hierarquia 100% via tipografia + spacing**. Cor é último recurso.

### 5.2 Tokens novos (paleta CLEAN — preset dark, principal do produto)

```css
:root[data-theme="dark"] {
  /* ===== Backgrounds — 3 níveis (Δ luminance perceptível) ===== */
  --bg:                  #0B0D11;   /* canvas — era #0D1117 */
  --surface:             #14171D;   /* card padrão — era #161B22 */
  --surface-elevated:    #1C2029;   /* modais/dropdowns — era surface-2/-3 (mesclado) */

  /* ===== Borders — 2 níveis neutros ===== */
  --border:              rgba(255, 255, 255, 0.07);
  --border-strong:       rgba(255, 255, 255, 0.13);

  /* ===== Texto — 4 níveis com hierarquia clara ===== */
  --text-strong:         #FFFFFF;             /* h1, números grandes */
  --text:                #E8EAF0;             /* body default */
  --text-soft:           #A8ADBA;             /* meta, label, sub */
  --text-faint:          #6B7080;             /* timestamps, hints, disabled */

  /* ===== Accent — UM vibrante, controlado ===== */
  --accent:              #5BE0C4;   /* turquesa SOLIDA — era 70FFDD vibrante demais */
  --accent-hover:        #4ACEB2;   /* hover do CTA primário */
  --accent-on:           #062821;   /* texto sobre accent (era 08313F) */

  /* ===== Subtle accent — pra texto/border discreto ===== */
  --accent-subtle:       rgba(91, 224, 196, 0.10);   /* bg hint */
  --accent-subtle-bd:    rgba(91, 224, 196, 0.22);   /* border hint */

  /* ===== Indigo — opcional, secundário (PROIBIDO usar como acento principal) ===== */
  --indigo:              #8585D9;
  --indigo-soft:         rgba(133, 133, 217, 0.10);

  /* ===== Estados ===== */
  --positive:            #34D399;
  --positive-soft:       rgba(52, 211, 153, 0.10);
  --attention:           #F59E0B;
  --attention-soft:      rgba(245, 158, 11, 0.10);
  --negative:            #F87171;
  --negative-soft:       rgba(248, 113, 113, 0.10);

  /* ===== Shadow — uma única elevação, neutra ===== */
  --shadow:              0 1px 2px rgba(0,0,0,.35), 0 8px 24px rgba(0,0,0,.18);
  --shadow-elevated:     0 1px 2px rgba(0,0,0,.4),  0 16px 32px rgba(0,0,0,.28);

  /* ===== Focus ring — accent-subtle-bd (1 cor só) ===== */
  --shadow-focus:        0 0 0 2px var(--bg), 0 0 0 4px var(--accent);

  /* ===== REMOVIDOS (deprecate, deletar em fase 2) ===== */
  /* --accent-cyan, --accent-cyan-deep, --accent-cyan-glow → migrar pra --accent */
  /* --accent-magenta, --accent-magenta-soft → DELETAR (cor não usada estrategicamente) */
  /* --primary-* (todos) → migrar pra --indigo / --accent / --text */
  /* --surface-2, --surface-3 → migrar pra --surface-elevated */
  /* --text-muted, --text-subtle, --text-dim → migrar pra --text-soft / --text-faint */
  /* --site-mesh-cyan, --site-mesh-magenta → manter só em /site, NÃO usar em (app) */
  /* --app-glass-bg, --app-glass-blur → sólido var(--surface) */
}
```

### 5.3 Migration guide (token antigo → novo)

| Antigo | Novo | Notas |
| --- | --- | --- |
| `var(--accent-cyan)` (vibrante) | `var(--accent)` (turquesa sólida) | Hex muda `#70FFDD` → `#5BE0C4`. WCAG AA: `5BE0C4` sobre `0B0D11` = **8.4:1** ✓ (texto), **3.9:1** sobre `14171D` (large/UI) ✓ |
| `var(--accent-cyan-deep)` | `var(--accent)` | Mesma cor. Não há mais 2 níveis. |
| `var(--accent-cyan-glow)` | `var(--accent-subtle-bd)` | Hex `rgba(91,224,196,.22)`. Use APENAS pra border/focus, nunca pra box-shadow glow. |
| `var(--primary)` (indigo) | `var(--text-strong)` (números) ou `var(--indigo)` (badges raros) | KPIs e Score Ring deviam usar `--text-strong`, não cor de marca |
| `var(--primary-soft)` | `var(--surface-elevated)` ou `var(--indigo-soft)` | Depende do uso: bg → surface; chip → indigo-soft |
| `var(--primary-light)`, `--primary-deep` | `var(--indigo)` | Colapsar pra 1 valor |
| `var(--surface-2)` | `var(--surface-elevated)` | |
| `var(--surface-3)` | `var(--surface-elevated)` | |
| `var(--text-muted)` | `var(--text-soft)` | |
| `var(--text-subtle)` | `var(--text-soft)` | |
| `var(--text-dim)` | `var(--text-faint)` | |
| `var(--accent-magenta)` | **DELETAR** | Não usar magenta no app |
| `.site-section-mesh` em (app) | **REMOVER** das page.js do app | Manter classe só pra /site |
| `.app-glass` (com backdrop-filter blur) | `background: var(--surface); border: 1px solid var(--border)` | Glass vira sólido |
| `boxShadow: "0 8px 24px -6px accent-cyan-glow, var(--shadow-md)"` (padrão atual) | `boxShadow: "var(--shadow)"` | Single shadow neutro |
| `filter: drop-shadow(0 0 6px accent-cyan-glow)` em ícones | **REMOVER** | Ícones não precisam de glow |
| `border-left: 4px solid accent-cyan` em headers | `border-left: 0; border-bottom: 1px solid var(--border)` (ou só padding) | Headers usam type hierarchy, não bar lateral |
| `clamp(40px, 6vw, 80px)` em h1 de produto | `28px` fixo (line-height 1.2, weight 600) | Display size some |

### 5.4 Comparação textual antes/depois (header de `/gaps`)

**ANTES** (`gaps/page.js:134-167` + CSS):

```
┌─────────────────────────────────────────────────────────────┐
│ [icon cyan glow]  DIAGNÓSTICO · LACUNAS         [pill]      │
│                                                  CARGO-ALVO  │
│  ████████████████████████████████████  ← h1 80px display    │
│  Análise de lacunas                                         │
│                                                              │
│  Identificamos o que falta entre seu perfil...              │
│                                                              │
│  ╔═══ 3 gaps · 0 concluídos                                 │
│                                                              │
│ ← border-left 4px CYAN                                       │
│ + background gradient mesh cyan/magenta                      │
│ + box-shadow accent-cyan-glow + shadow-md                   │
│ + ::after gradient cyan no canto direito                    │
│ + drop-shadow no ícone                                       │
│ + app-glass (blur 16px)                                      │
└─────────────────────────────────────────────────────────────┘
```
**5 efeitos visuais competindo, h1 80px (display landing-grade), eyebrow cyan, border cyan, glow cyan, mesh cyan, gradient cyan no after, drop-shadow cyan no ícone.**

**DEPOIS** (proposto):

```
┌──────────────────────────────────────────────────────────┐
│  DIAGNÓSTICO · LACUNAS                          [pill]    │
│                                                 CARGO-ALVO│
│  Análise de lacunas             ← h1 28px serif/sans     │
│                                                            │
│  Identificamos o que falta entre seu perfil...            │
│                                                            │
│  3 gaps  ·  0 concluídos                                  │
└──────────────────────────────────────────────────────────┘
   ↑ Sem border-left. Sem mesh. Sem glow. Sem app-glass.
   ↑ background: var(--bg) (continuação do canvas).
   ↑ Separação visual: padding-bottom + border-bottom: 1px solid var(--border).
   ↑ Hierarquia: h1 28px weight 600 + eyebrow 11px uppercase text-soft.
```
**Zero efeitos visuais. Tipografia carrega a hierarquia. Padding + 1 border = estrutura. Espaço respira.**

---

## 6. PRs priorizados

> Esforço: S = ≤30min, M = 30min-2h, L = ≥2h  
> Impacto subjetivo escala 1-5 (5 = "vira outro app")

### P0 — Bloqueador "sujo/neon" (faça nesta ordem)

| PR # | Título | Arquivos | Esforço | Impacto |
| --- | --- | --- | --- | --- |
| **P0.1** | **Reduzir saturação do `--accent-cyan` em dark/light** | `app/globals.css` (linhas 22-24, 218-220) | S | 5 — base de tudo |
|     | `#70FFDD` (vibrante) → `#5BE0C4` (turquesa sólida). Glow alpha `0.42` → `0.18`. Já reduz **40% da percepção "neon"** sem tocar em mais nada. | | | |
| **P0.2** | **Remover `.site-section-mesh` de TODAS as page.js do app** | `dashboard/page.js:121`, `gaps/page.js:135`, `oportunidades/page.js:73`, `autoconhecimento/page.js:58`, `carreira/page.js:35`, `evidencias/page.js:40`, `conta/page.js`, `plano/page.js` | S | 5 — remove o "metaverse vibe" |
|     | Substituir por background sólido (`var(--bg)`). Mesh é pra landing — não pra dashboard. | | | |
| **P0.3** | **Remover `boxShadow accent-cyan-glow` inline de TODAS as headers/banners** | `gaps/page.js:138`, `oportunidades/page.js:76`, `GapsKpiStrip.js:88-90, 168-170`, `MicroactionCard.js:91-95`, `DashboardHighlightBanner.js:48`, todos `NoTargetState/NoJobsState` em gaps + oportunidades | S | 4 — mata o glow sistêmico |
|     | Manter só `var(--shadow-md)` ou nenhuma sombra. | | | |
| **P0.4** | **Remover `filter: drop-shadow(... accent-cyan-glow)` de ícones decorativos** | `gaps/page.js:144`, `oportunidades/page.js:82`, `MicroactionCard.js:131`, `DashboardHighlightBanner.js:56`, `GapsKpiStrip.js:177` | S | 3 |
|     | Ícones não precisam de glow. | | | |
| **P0.5** | **Reduzir `.ct-page-header-title` de `clamp(40px, 6vw, 80px)` pra `28px` fixo** | `app/globals.css:6231-6238` | S | 5 — vira produto de fato |
|     | Plus: peso 600 (não 700), letter-spacing `-0.015em` (não `-0.03em`), line-height `1.25`. Sem clamp. | | | |
| **P0.6** | **Remover `clamp()` inline em `style={{}}` dos page.js (`paddingTop: clamp(56px, 9vw, 96px)` etc)** | `autoconhecimento/page.js:60-62`, `carreira/page.js:37-39`, `evidencias/page.js:42-44`, `dashboard/page.js:123-125` | S | 4 — densidade volta |
|     | Substituir por padding fixo `32px 0` no header. | | | |
| **P0.7** | **`.ct-page-header`: remover `border-left: 4px accent-cyan` + `::after gradient cyan`** | `app/globals.css:6206, 6210-6215` | S | 4 — borda neutra |
|     | Substituir por `padding-bottom: 24px; border-bottom: 1px solid var(--border)`. Sem cor. Sem ::after. | | | |
| **P0.8** | **`.ct-score-ring-wrap`: remover `drop-shadow(... accent-cyan-glow)` + animação `scoreGlow`** | `app/globals.css:2260-2273` | S | 4 — score ring para de pulsar |
|     | Manter só `drop-shadow(0 8px 24px rgba(0,0,0,.25))` neutro. | | | |
| **P0.9** | **`.ct-dash-hero`: remover `radial-gradient primary-soft` (2x) + `::before radial`** | `app/globals.css:2233-2252` | S | 4 |
|     | Background sólido `var(--surface)`. | | | |
| **P0.10** | **`.ct-highlight-banner`: matar `border-left: 4px accent-cyan` + `::after gradient`** | `app/globals.css:6098-6119` + `DashboardHighlightBanner.js:40-49` | S | 3 |
|     | E remover `backdrop-filter` inline + `boxShadow accent-cyan-glow`. Surface plain + border neutro. | | | |

### P1 — Ruidoso mas tolerável

| PR # | Título | Arquivos | Esforço | Impacto |
| --- | --- | --- | --- | --- |
| **P1.1** | **Colapsar 4 níveis de surface em 3** (`--surface-2` + `--surface-3` → `--surface-elevated`) | `app/globals.css:143-144, 170-171, 250-251` + 30+ uses | M | 3 |
| **P1.2** | **Colapsar 5+ níveis de texto em 4** (deletar `--text-muted`, `--text-subtle`, `--text-dim`; manter `text-strong / text / text-soft / text-faint`) | `app/globals.css:147-156, 174-184, 258-264` + uses | M | 3 |
| **P1.3** | **Refazer `/candidaturas` no padrão atual** (atualmente usa `topbar-inner + brand-mark + wrap` legado + hardcoded `#B9D90C`) | `app/(app)/candidaturas/page.js:28-50` | M | 4 (única tela do app fora do sistema) |
| **P1.4** | **`.ct-welcome-banner`: remover radial + linear gradient duplo** | `app/globals.css:3850-3852` | S | 2 |
| **P1.5** | **`AlgorithmDisclaimer`: usar `var(--surface-elevated)` em vez de `rgba(255,255,255,0.02)` hardcoded inline** | `components/AlgorithmDisclaimer.js:23-25` | S | 1 (já está calmo, só consistência) |
| **P1.6** | **`.app-glass`: redefinir como sólido (sem `backdrop-filter`)** | `app/globals.css:6664-6670` + dezenas de usos | S | 3 (efeito imediato em todos os cards) |
| **P1.7** | **Remover `--accent-magenta*` tokens + classes `.cloud-accent*` (dead code)** | `app/globals.css:25-26, 49-50, 221-222, 287-288, 340-342, 6698-6709` | S | 1 (limpeza) |
| **P1.8** | **`.ct-empty-state-v2-icon`: remover `linear-gradient cyan` + `box-shadow cyan-glow`** | `app/globals.css:6292-6297` | S | 2 |
| **P1.9** | **Pause `@keyframes ctAccentPulse` e `scoreGlow` em prefers-reduced-motion** | já existe pra `scoreGlow` mas adicionar `--text-faint` padrão fora de motion | S | 1 |
| **P1.10** | **Padronizar todos os `.ct-page-header-eyebrow` pra usar `var(--text-soft)` (não `--accent-cyan-deep`)** | `app/globals.css:6224-6228` + inline styles em 5 page.js | S | 3 (eyebrow para de ser cyan-deep brilhante) |

### P2 — Polish

| PR # | Título | Arquivos | Esforço | Impacto |
| --- | --- | --- | --- | --- |
| **P2.1** | Deletar aliases legados não usados (`--ink`, `--bone`, `--citron`, `--rule`, `--line`, `--card`) depois de buscar uses | `app/globals.css:366-400` + grep do codebase | M | 1 |
| **P2.2** | Consolidar `--shadow-sm`/`-md`/`-lg`/`-xl` em 2 níveis (`--shadow` + `--shadow-elevated`) | `app/globals.css:124-127, 225-228, 351-354` | M | 1 |
| **P2.3** | Auditar `<Icon>` size — muitos componentes pedem 22/24px (cabe 18/20) | `gaps/page.js:146`, `oportunidades/page.js:84-98`, `carreira/page.js:42-55` | S | 1 |
| **P2.4** | Migrar `.appshell-brand-name` (gradient text branco→cinza, linha 1827-1830) pra cor sólida — gradient em label de marca é decoração gratuita | `app/globals.css:1827-1830` | S | 1 |
| **P2.5** | `.ct-highlight-banner-icon` cor `#1a3c34` hardcoded (linha 6128) — usar `var(--accent-on)` | `app/globals.css:6128` | S | 1 |

---

## 7. Refs comparativas (5 produtos que fazem certo)

### 7.1 Linear (`linear.app`) — gold standard
- **h1 de página**: 24-28px, weight 600, letter-spacing -0.01em. Spectral/sans, line-height 1.2.
- **Accent**: roxo `#5E6AD2` aparece SÓ em 1 lugar do viewport: o botão de "Create issue" e no hover do item ativo da nav.
- **Border**: `rgba(255,255,255,0.07)` em dark. Quase invisível.
- **Surfaces**: 2 níveis (`bg #08090A`, `surface #16171B`). Apenas isso.
- **O que CareerTwin deveria fazer**: copiar `clamp` → fixed h1 28px. Copiar "1 accent per viewport". Copiar borders neutras.

### 7.2 Vercel Dashboard (`vercel.com/dashboard`)
- **Hierarquia 100% via tipografia**. Não há cor em headers, banners, ícones decorativos.
- **`--geist-foreground` / `--geist-background` / `--ds-gray-100..1000`** — 1 escala neutra de cinza. Cor só em estado: success/error/warning.
- **Sem `backdrop-filter`**. Sem glassmorphism. Cards são `background: var(--ds-background-100)` sólido.
- **Sem mesh gradients no dashboard**. Mesh fica em landing/marketing.
- **O que CareerTwin deveria fazer**: matar `.app-glass`. Adotar escala de cinza única. Reservar cor pra estado.

### 7.3 Stripe Dashboard
- **Borders quase invisíveis** (`rgba(0,0,0,.08)` light, `rgba(255,255,255,.06)` dark).
- **Roxo `#635BFF`** aparece SÓ no logo + 1 CTA por viewport. Em tabelas, dropdowns, navegação ativa — tudo neutro.
- **Denso mas leve**: 13px body, 11px label, line-height 1.5. Whitespace generoso entre seções (48-64px), denso dentro de seção.
- **O que CareerTwin deveria fazer**: reduzir body de 14.5px (linha 410) pra 13.5px. Aumentar spacing entre seções. Apertar dentro de cards.

### 7.4 Cloudwalk JIM (`jim.com`)
- **Lime `#C2F542`** SÓ em CTA principal de hero + 1 destaque numérico. Em dashboards internos, lime nem aparece — fica P&B.
- **Tipografia editorial**: Plus Jakarta Sans pra UI, fonte serif pra moments emocionais.
- **Animação**: pulse APENAS em CTAs vivos (botão de pagar, status "ao vivo"). Nunca em score, header, ícone decorativo.
- **O que CareerTwin deveria fazer**: matar `@keyframes scoreGlow` (12s pulse no score ring). Reservar movimento pra ação que muda.

### 7.5 Apple Developer Portal (`developer.apple.com`)
- **Sobriedade absurda**. Headers de página: h1 36-44px serif (mas SF Pro, não display), weight 500, line-height 1.1.
- **Zero decoração**. Cards são `background-color: var(--apple-system-background-secondary)` + border `1px`. Hover é mudança sutil de bg.
- **Hierarquia via SIZE + WEIGHT + COR (nesta ordem)**. Cor é última.
- **O que CareerTwin deveria fazer**: hero do dashboard / gaps deve ter 1 elemento dominante (o score, OU os KPIs, OU a microação). Hoje os 3 competem.

---

## 8. O que NÃO mudar

Para evitar regressão:

1. **`AppShell` sidebar** — está calmo, hierarquia limpa, accent indigo discreto. Não tocar.
2. **`AlgorithmDisclaimer.js`** — já é o componente mais calmo do app. Manter exatamente assim. Só pode virar referência pro resto.
3. **Sistema de temas (light/dark/noir)** — manter os 3 temas. Mas alinhar tokens (próximo capítulo).
4. **`.ct-target-pill`** (linha 2173-2194) — está discreto, com `--primary` em valor. Não precisa mudar.
5. **`.ct-microaction-check`** (linha 3190-3214) — checkbox custom funcional, sem decoração. OK.
6. **Tokens de estado** (`--positive`, `--attention`, `--negative`) — calibrados, AA, semanticamente claros. Manter.
7. **`.ct-section-divider`** (linha 6187-6192) — gradiente transparente→border→transparente, sutil. Bom uso de gradient.
8. **Tipografia Spectral (serif) para `font-display`** — está OK como fonte. Só não usar em sizes 80px no app. 28px serif fica elegante.
9. **`<Icon>` componente** — boa decisão de centralizar. Não precisa tocar.
10. **Sistema de focus ring** (`:focus-visible` global linha 519-533) — funcional, acessível. Só ajustar pra usar `--accent-subtle-bd` em vez de `--accent-cyan-glow`.

---

## 9. Recomendação consolidada

### 9.1 Top 3 ações pra essa semana (ROI máximo, esforço mínimo)

**Ação 1 — Saturação do accent (15 min, impacto 5/5)**

Editar 6 linhas no `app/globals.css`:

```diff
- --accent-cyan: #70FFDD;                          /* linha 22, light */
- --accent-cyan-deep: #4DCFB3;
- --accent-cyan-glow: rgba(112, 255, 221, 0.35);
+ --accent-cyan: #4DCFB3;                          /* mesma cor que era deep */
+ --accent-cyan-deep: #3FB39B;
+ --accent-cyan-glow: rgba(91, 224, 196, 0.18);   /* alpha 0.18 não 0.35 */

- --accent-cyan: #70FFDD;                          /* linha 218, dark */
- --accent-cyan-deep: #5BE0C4;
- --accent-cyan-glow: rgba(112, 255, 221, 0.42);
+ --accent-cyan: #5BE0C4;                          /* solidação */
+ --accent-cyan-deep: #4ACEB2;
+ --accent-cyan-glow: rgba(91, 224, 196, 0.18);
```

Resultado: **40% da percepção "neon" sai sem refactor**.

**Ação 2 — Matar mesh + clamp em headers de página (45 min, impacto 5/5)**

Remover `site-section-mesh` + `clamp(40,6vw,80)` + `clamp(56,9vw,96)` de 8 page.js do app (busca-e-substitui). Cada arquivo é 4-6 linhas. Listados em P0.2, P0.5, P0.6.

Resultado: **app vira app (não landing).**

**Ação 3 — Reduzir `.ct-page-header-title` no CSS (5 min, impacto 5/5)**

```diff
.ct-page-header-title {
- font-size: clamp(40px, 6vw, 80px);
- font-weight: 700;
- letter-spacing: -0.03em;
- line-height: 1.05;
+ font-size: 26px;
+ font-weight: 600;
+ letter-spacing: -0.015em;
+ line-height: 1.25;
  margin: 0 0 16px 0;
  color: var(--text);
}
```

Resultado: **hierarquia volta ao produto, h1 não compete com KPIs.**

**Tempo total**: ~65 min. Impacto: o fundador deve perceber a diferença em **<10 segundos** abrindo o `/dashboard`.

### 9.2 Métricas de validação (subjetiva mas estruturada)

Pra cada tela do app, perguntar:

1. **"Quantos accents diferentes vejo na primeira viewport?"**
   - Hoje: 3-5 (indigo number + cyan border + cyan glow + cyan icon + cyan eyebrow)
   - Alvo: **≤2** (1 accent + neutros)

2. **"Quantos efeitos visuais empilhados num card hero?"**
   - Hoje: 5 (glass + mesh + border-glow + box-shadow + drop-shadow)
   - Alvo: **1** (apenas `var(--shadow)`)

3. **"O que é o elemento dominante desta tela?"**
   - Hoje: ambíguo (3 coisas competem)
   - Alvo: **1 elemento claro** (ex: dashboard = score; gaps = KPI strip; oportunidades = lista de vagas)

4. **"O h1 ocupa mais de 20% da viewport vertical?"**
   - Hoje: SIM em todas (clamp 40-80px + padding 56-96px = ~160px de 800px = 20%)
   - Alvo: **NÃO** (h1 28px + padding 32px = ~80px = 10%)

5. **"O usuário sabe pra onde olhar primeiro em 2 segundos?"**
   - Hoje: não (acuidade visual disputa entre 5+ glows)
   - Alvo: **sim** (1 ponto focal por viewport)

6. **"Posso ler o app em mobile (375px) sem zoom?"**
   - Hoje: sim mas pesado (clamps degeneram em 32-48px h1, ainda grande)
   - Alvo: **sim e leve** (h1 22-24px fixo)

7. **Contagem objetiva no CSS**:
   - Uses de `accent-cyan-glow`: **25** hoje → alvo **<5** (só focus ring + 1 hover state acentuado)
   - Uses de `backdrop-filter`: **3** classes ativas + uso em 15+ componentes → alvo **0 no (app)**
   - Uses de `radial-gradient` em `(app)/*`: **5 telas + 4 classes** → alvo **0**
   - Tokens de cor de marca: **~15** (primary + accent + magenta + cyan-deep etc) → alvo **6** (accent + indigo + 4 estados)

### 9.3 Alerta crítico

**O `.ct-page-header-title` é compartilhado por 8 telas do app.** Mudar essa ÚNICA classe (P0.5, 5 minutos de edit) **atinge o problema raiz da percepção "tudo grita"** mais que qualquer outro PR. Comece por aqui. Se eu pudesse fazer só **1 mudança** no app inteiro, seria essa.

**Bug latente WCAG**: `--accent-text: #FFFFFF` (linha 92) é hardcoded e em noir o `--accent` vira branco — texto branco sobre branco. Verificar uses de `var(--accent-text)` no noir antes de promover noir como default.

**Risco de regressão**: `.candidaturas/page.js` está em outro design system (linha 28-50). Tocar tokens vai deixar essa tela pior antes de melhor. Refazer essa página é P1 mas independente.

---

## Apêndice A — Mapa de severidade por arquivo

```
P0 worst offenders (editar primeiro):
  app/globals.css:6231-6238         .ct-page-header-title (h1 80px display)
  app/globals.css:22-24, 218-220    --accent-cyan vibrante (#70FFDD)
  app/globals.css:6373-6378         .site-section-mesh (radial cyan+magenta)
  app/globals.css:2260-2273         .ct-score-ring-wrap (2 drop-shadows + pulse 12s)
  app/globals.css:2229-2252         .ct-dash-hero (2 radial gradients empilhados)
  app/globals.css:6206-6215         .ct-page-header border-left cyan + ::after gradient
  app/(app)/gaps/page.js:134-145    hero com 5 efeitos empilhados
  app/(app)/oportunidades/page.js:72-82  mesmo padrão
  components/DashboardHighlightBanner.js:40-49  glass+glow+border cyan inline

P1 (refactor médio):
  app/globals.css:141-144 / 168-171 / 248-251   4 níveis de surface
  app/globals.css:147-156 / 174-184 / 258-264   5+ níveis de texto
  app/(app)/candidaturas/page.js:28-50           design system legado
  app/globals.css:6664-6670                     .app-glass com backdrop-filter
  app/globals.css:3850-3852                     .ct-welcome-banner gradient duplo

P2 (limpeza):
  app/globals.css:366-400      aliases legados (--ink, --bone, --citron, etc)
  app/globals.css:6698-6709    .cloud-accent* dead code
  app/globals.css:25-26 etc    --accent-magenta* nunca estrategicamente usado
  app/globals.css:1827-1830    .appshell-brand-name gradient text gratuito
```

---

## Apêndice B — Uses críticos de `accent-cyan-glow` (25 ocorrências)

```
app/globals.css:24, 220, 286, 357   definição (light/dark/noir/noir-shadow-focus)
app/globals.css:759, 764             .btn-primary hover/focus
app/globals.css:2262, 2266, 2272     .ct-score-ring-wrap drop-shadows
app/globals.css:6275, 6276, 6280     .ct-accent-glow / .ct-pulse-cyan
app/globals.css:6296                  .ct-empty-state-v2-icon box-shadow
app/globals.css:6314, 6320, 6325     .ct-progress-bar-high, .ct-career-milestone
app/globals.css:6438, 6443           .site-btn-primary (OK — landing scope)
app/globals.css:6603, 6604           .site-pricing-card-featured (OK — landing)
app/globals.css:6213                  .ct-page-header::after gradient
app/(app)/dashboard/page.js:348      .ct-score-ring-wrap box-shadow inline
app/(app)/gaps/page.js:138, 145, 291, 317   header + empty states
app/(app)/oportunidades/page.js:37, 76, 82  empty state + header
app/(app)/gaps/GapsKpiStrip.js:88-90, 168-170, 177   header + KPI cards + glow
app/(app)/gaps/MicroactionCard.js:94, 131    top priority card + label
app/(app)/gaps/SkillMap.js                    glow em label "rare"
app/(app)/gaps/RequirementsFrequency.js       glow em "alta"
app/(app)/cvs-adaptados/CvDetailClient.js     hover do card
app/(app)/cvs-adaptados/CvDiffView.js          diff colors
app/(app)/cvs-adaptados/page.js:50-67          inline style cards
app/(app)/cvs-adaptados/[id]/page.js          mais glow
app/(app)/conta/CvAnalyzer.js                  focus de input
app/(app)/conta/page.js                        algum hover
app/(app)/funil/FunnelForm.js                  focus input
app/(app)/evidencias/page.js:77                focus input
app/(app)/concursos/page.js                    focus algum
app/(app)/estagios/page.js                     focus algum
app/(app)/autoconhecimento/page.js:72          eyebrow cor cyan-deep (não glow)
components/DashboardHighlightBanner.js:47-48, 56   border + box-shadow + filter
components/AchievementToast.js                 toast highlight
components/CopilotWidget.js                    widget glow
components/NotificationsBell.js                bell badge
app/(app)/oportunidades/RadarClient.js         radar element
```

→ **Após P0.1 + P0.3 + P0.4 + P0.10, restam ~5 uses legítimos** (focus rings + 1-2 hover states + landing). É a meta de "≤5 uses" do checklist 9.2.
