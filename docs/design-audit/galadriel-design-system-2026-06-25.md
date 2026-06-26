# Design System Audit — Galadriel — 2026-06-25

Auditor: Galadriel (Wave 9, RESEARCH-ONLY)
Branch: `redesign/claude-design`
Escopo: `app/(app)/`, `app/admin/`, `app/entrar/`, `app/meus-dados/`, `app/meu-gemeo/`, `app/experimentar/`, `components/` (exclui `components/site/` e `app/(landing)/`)
Tokens base: `app/globals.css` (6640 linhas, 1002 classes `.ct-*`)

---

## Executive Summary

- **Coexistem DOIS sistemas de header** que produzem H1 visualmente irmãos a aparências completamente diferentes. Páginas "Wave 8 uplift" (`/dashboard`, `/carreira`, `/plano`, `/evidencias`, `/autoconhecimento`) usam H1 inline `clamp(40px, 6vw, 80px)` em Plus Jakarta Sans bold; o resto (`/concursos`, `/oportunidades`, `/funil`, `/estagios`, `/gaps`, `/transparencia`, `/cvs-adaptados/*`, `/admin`, `/conta`) usa `.ct-page-header-title` com 26px em Spectral serif. **3x de diferença de tamanho de H1 ao trocar de aba** — P0.
- **Coexistem TRÊS sistemas de botão primário sem aliasing claro**: `.btn .btn-primary` (legacy indigo, radius-md, 11x20), `.site-btn-primary` (cyan gradient, radius-pill, 16x32) e cadeias custom `.ct-tailor-btn-*`, `.ct-evidence-btn-*`, `.ct-conta-btn.*`. Cada página injeta `<style>` runtime pra "corrigir" o legacy pro look novo via overrides com `!important`. P0.
- **Padding/margin de seção é COPY-PASTE em 6 arquivos diferentes**: `paddingTop: "clamp(56px, 9vw, 96px)"` e variações duplicados inline em cada page.js novo, com Dashboard divergindo pra `clamp(48px, 8vw, 96px)` (8px de diferença sem motivo). P1.
- **Border-radius é uma feira**: `8px` hardcoded 30+ vezes em concursos/estagios/admin/CvAnalyzer; `6px`, `10px`, `12px`, `14px`, `16px`, `20px` espalhados; tokens `--radius-sm/md/lg/xl` existem mas raramente são usados em inline styles. P0.
- **Cores fora do sistema de tokens em fluxos críticos**: WelcomeModal (`#4F46E5`, `#06B6D4`, `#8B5CF6` hardcoded — quebra em noir), CvDiffView (`rgba(34,197,94...)`, `#ff2dd1` — não tem variante noir), funil page (`#E5A93C`, `#F0C44A`). Founder vendo o app em noir vê magenta brilhante saindo do nada. P0.
- **Mais de 10 `<style dangerouslySetInnerHTML>` injetados em runtime** dentro de pages (`CvAnalyzer`, `CvDiffView`, `cvs-adaptados`, `evidencias`, `estagios`, `concursos`, `admin`, `FunnelForm`). É CSS escondido fora do design system, impossível de auditar e duplicado. P1.

**Veredito honesto:** O design system existe e é robusto (tokens, classes `.site-*`, `.app-glass`, paleta noir bem feita), mas o app inteiro **ignora ele em 60-70% dos lugares**. As 8 waves anteriores deixaram débito significativo na convergência. **A inconsistência é gritante o suficiente pra ser perceptível a olho nu navegando entre 3 telas.**

---

## Findings

### P0 - Critical (quebra design system, visível em qualquer navegação)

- **Dois sistemas de H1 coexistindo, 3x de diferença de tamanho** (`app/(app)/dashboard/page.js:139-150`, `app/(app)/carreira/page.js:70-92`, `app/(app)/plano/page.js:139-162`, `app/(app)/evidencias/page.js:48-72`, `app/(app)/autoconhecimento/page.js:78-102` vs `app/(app)/concursos/page.js:76`, `app/(app)/oportunidades/page.js:101`, `app/(app)/funil/page.js:80-82`, `app/(app)/estagios/page.js:79`, `app/(app)/gaps/page.js:187`, `app/(app)/cvs-adaptados/[id]/page.js:106`, `app/(app)/cvs-adaptados/page.js:83`, `app/(app)/transparencia/page.js:70-72`, `app/(app)/conta/page.js:281`, `app/admin/page.js:99,278`) — H1 vai de `clamp(40px, 6vw, 80px)` Plus Jakarta Sans em 5 páginas pra 26px Spectral serif em 9 páginas. **Founder navegando de `/dashboard` (H1 gigante) pra `/oportunidades` (H1 pequeno) sente quebra de produto.**
  - **Fix sugerido**: criar `.app-h-display` em `globals.css` (clamp 40-80, Plus Jakarta Sans, weight 700, letter-spacing -0.03em, line-height 1.05) e substituir TODOS os H1 de página por essa classe, retirando inline styles. `.ct-page-header-title` vira alias pra `.app-h-display` (ou some).
  - **Token alternativo**: já temos `.site-h1` (clamp 40-72, Plus Jakarta Sans). Por que não usar a mesma classe? Resposta provável: medo de cross-contaminar landing/app. Solução: clonar como `.app-h1` ou (preferível) usar `.site-h1` direto — está em `globals.css`, é só semântica.

- **Dois (ou três) sistemas de botão primário coexistindo no MESMO app** (`app/globals.css:732-752` define `.btn-primary` indigo radius-md; `app/globals.css:6350-6380` define `.site-btn-primary` cyan radius-pill; `app/(app)/conta/CvAnalyzer.js:93-120`, `app/(app)/evidencias/page.js:87-102`, `app/(app)/cvs-adaptados/page.js:41+`, `app/(app)/cvs-adaptados/[id]/page.js:66+`, `app/(app)/cvs-adaptados/CvDiffView.js:53+` injetam `<style dangerouslySetInnerHTML>` em runtime que sobrescreve `.btn-primary` ou `.ct-conta-btn.primary` pra ficar cyan gradient). Resultado: `/dashboard` mostra botão "Atualizar diagnóstico" indigo (`.btn-primary` puro em `RefreshDiagnosisButton.js:106`), `/evidencias` mostra botão cyan gradient (override inline). Hover/active/focus divergem.
  - **Fix sugerido**: deletar `.btn-primary` indigo OU rebrandeá-lo com gradient cyan (`linear-gradient(140deg, var(--accent-cyan) 0%, var(--accent-cyan-deep) 100%)`) no próprio `globals.css`. Eliminar todos os `<style>{...}` que reescrevem botão. Manter `.site-btn-primary` como única primária.
  - **Token alternativo**: `--accent-cyan`, `--accent-cyan-deep`, `--accent-on-cyan`, `--radius-pill` já existem. Só falta unificar a classe.

- **Cores hardcoded fora do sistema de tokens, quebra em noir** (`components/WelcomeModal.js:38,44,50` = `#4F46E5`, `#06B6D4`, `#8B5CF6`; `app/(app)/cvs-adaptados/CvDiffView.js:117-119,338-355,382-396,433-435,445` = `rgba(34,197,94,0.18)`, `rgba(239,68,68,0.18)`, `rgba(234,179,8,0.18)`, `#ff2dd1`; `app/(app)/funil/page.js:144-145,170-171` = `#E5A93C`, `#F0C44A`, `rgba(229,169,60,...)`; `app/(app)/funil/FunnelForm.js:250-269` = `rgba(220,80,80,...)`, `rgba(80,200,150,...)`). Tema noir (default!) tem tokens próprios pra positive/negative/attention — esses hex bypassam tudo. Founder vendo `/cvs-adaptados/[id]` em noir vê verde Tailwind brilhante e magenta `#ff2dd1` que não existem em mais lugar nenhum.
  - **Fix sugerido**: substituir hex por tokens: `#4F46E5` → `var(--primary)`, verde diff → `var(--positive-soft)`, vermelho diff → `var(--negative-soft)`, amarelo diff → `var(--attention-soft)`, `#ff2dd1` → `var(--accent-magenta)` (que em noir vira branco — não brilha mais).
  - **Token alternativo**: paleta semântica completa já existe em light/dark/noir; só é preciso usar.

- **Border-radius caos: 30+ ocorrências de `borderRadius: 8` inline + mistura 5/6/8/10/12/14/16/20** (`app/(app)/concursos/page.js:116,140,167,183,273,366`, `app/(app)/estagios/page.js:163,203,241,302,394,549`, `app/admin/page.js:138,168`, `app/(app)/transparencia/page.js:316,718,729`, `components/PortfolioImportButton.js:77,88,131`, `components/LinkedinImportButton.js:72`, `components/OutcomeSurveyModal.js:168,212,233`, `components/Report.js:292`, `components/WelcomeModal.js:175`). Tokens `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px`, `--radius-xl: 20px` existem em `globals.css:99-103`.
  - **Fix sugerido**: search-and-replace mecânico: `borderRadius: 6/8` → `"var(--radius-sm)"`, `borderRadius: 10/12` → `"var(--radius-md)"`, `borderRadius: 14/16` → `"var(--radius-lg)"`, `borderRadius: 20+` → `"var(--radius-xl)"`. Inputs/selects ficam todos em `--radius-sm` (6px) por consistência.

### P1 - High

- **Page header padding inline copy-pasted em 6 arquivos com Dashboard divergindo** (`app/(app)/dashboard/page.js:121-122` usa `clamp(48px, 8vw, 96px)` pro top; `app/(app)/carreira/page.js:36`, `app/(app)/plano/page.js:120`, `app/(app)/evidencias/page.js:42`, `app/(app)/autoconhecimento/page.js:60` usam `clamp(56px, 9vw, 96px)`). Diferença de 8px no minimum não vai ser percebida individualmente, mas é débito de DRY — cada novo onboarding de página copia inline.
  - **Fix sugerido**: criar `.app-page-hero { padding-top: clamp(56px, 9vw, 96px); padding-bottom: clamp(32px, 5vw, 64px); margin-bottom: clamp(32px, 5vw, 64px); }` em `globals.css`. Pages aplicam só a classe. Dashboard provavelmente queria 48 mínimo de propósito (header fica mais alto que outras pages porque tem score ring grande logo abaixo) — manter ou alinhar é decisão de design, mas precisa ser registrada.

- **Eyebrow letter-spacing inconsistente** (`app/(app)/dashboard/page.js:131`, `app/(app)/carreira/page.js:62`, `app/(app)/plano/page.js:131`, `app/(app)/autoconhecimento/page.js:70` usam `0.14em`; `app/globals.css:3566` `.ct-onb-brand-eyebrow` usa `0.16em`; `app/globals.css:2369` outro componente usa `0.06em`; `app/(app)/transparencia/page.js:296,674` mistura `.12em` e `.14em`). Não é gritante mas em telas com várias eyebrows uma do lado da outra fica "vibrante demais" sem motivo.
  - **Fix sugerido**: token `--tracking-eyebrow: 0.14em;` em `:root` e usar everywhere; ou criar classe `.app-eyebrow` que centraliza font-size/weight/letter-spacing/text-transform/color.

- **Page sub-text inline duplicado 5x com clamp idêntico** (`app/(app)/carreira/page.js:85`, `app/(app)/plano/page.js:154`, `app/(app)/evidencias/page.js:63`, `app/(app)/autoconhecimento/page.js:93`, `app/(app)/dashboard/page.js` não — usa estrutura diferente) — `fontSize: "clamp(16px, 1.4vw, 19px)"`, `lineHeight: 1.5` ou `1.55` (varia!), `color: "var(--text-muted)"`, `maxWidth: "60ch"` ou `"62ch"` (varia também).
  - **Fix sugerido**: classe `.app-page-sub` em globals com clamp 16-19, line-height 1.55, max-width 62ch, color text-muted.

- **`<style dangerouslySetInnerHTML>` injetados runtime em 10+ pages** (`app/(app)/cvs-adaptados/page.js:41`, `app/(app)/cvs-adaptados/[id]/page.js:66`, `app/(app)/cvs-adaptados/CvDiffView.js:53`, `app/(app)/cvs-adaptados/CvDetailClient.js:80`, `app/(app)/conta/CvAnalyzer.js:93`, `app/(app)/conta/page.js:263+` (style tag), `app/(app)/evidencias/page.js:78`, `app/(app)/estagios/page.js:470`, `app/(app)/concursos/page.js:314`, `app/(app)/funil/FunnelForm.js:118`, `app/admin/page.js:179`). Cada um define CSS específico de página — botões, hovers, transitions — que deveria viver em globals ou em CSS modules. Difícil de auditar, fácil de divergir, alguns usam `!important` (e.g. `app/(app)/evidencias/page.js:88,90`).
  - **Fix sugerido**: extrair tudo pra globals como classes nomeadas (`.cv-analyzer-card`, `.evidence-form`, etc) ou criar `.module.css` per page. Eliminar `!important`.

- **`.ct-target-pill` definido 2x** (`app/globals.css:2136-2157` define styling completo; `app/globals.css:2808-2814` redefine `transition` e `:hover` — sobrescreve a primeira). Provavelmente vestígio de iteração — segunda definição "ganha" mas dificulta manutenção.
  - **Fix sugerido**: consolidar numa definição única.

- **Cards usam fontes diferentes pro mesmo papel** (`app/globals.css:2339` `.ct-gaps-title` = `var(--font-display)` Spectral serif 26px; `app/globals.css:6171` `.ct-page-header-title` = `var(--font-display)` Spectral serif 26px — mesma fonte/tamanho mas duas classes; em paralelo pages novas usam Plus Jakarta Sans inline). Tipograficamente: legacy = serif, novo = sans-serif. Já citado em P0 mas fonte-família é distinto issue.
  - **Fix sugerido**: definir cargo: H1 de página = Plus Jakarta Sans bold (sansérif moderna alinhada a Cloudwalk). Spectral fica reservada pra display em landing/marketing. Atualizar todas as classes.

### P2 - Medium

- **Inline `padding: 28` (3x), `padding: 16` em CV cards, `padding: 24px` em evidence form, `padding: "18px 16px"` em welcome cards** — paddings de card variam por página. `app-glass` é consistente (radius-lg) mas o padding interno não tem token.
  - **Fix sugerido**: convencionar `.app-glass-card { padding: 24px; }` ou criar `--space-card-md: 24px` token. Aceitar débito se diversidade de cards for proposital.

- **Letter-spacing global: 11 valores diferentes** (0.01, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16) ao longo de `globals.css`. Pra eyebrow/uppercase está em 0.06-0.16 sem padrão. Para H1, -0.025 a -0.05.
  - **Fix sugerido**: 3 tokens — `--tracking-tight: -0.03em` (H1/H2), `--tracking-normal: 0`, `--tracking-wide: 0.14em` (eyebrows/UPPERCASE).

- **Modals e Toasts: shadow inline duplicado** (`components/AchievementToast.js:66`, `components/DashboardHighlightBanner.js:48`, `components/CopilotWidget.js:351`, `components/NotificationsBell.js:227`) — todos usam `var(--shadow-md/lg), 0 0 24px var(--accent-cyan-glow)` em variantes ligeiramente diferentes (12px vs 24px de glow radius). Não é P0 porque o token base é o mesmo.
  - **Fix sugerido**: criar `--shadow-accent-glow: var(--shadow-lg), 0 0 24px var(--accent-cyan-glow);` token.

- **Body font-size em pages: 13, 13.5, 14, 14.5, 15, 16, 18px** sem regra clara. `.site-body` = 16, `.site-body-sm` = 14, mas o app raramente usa essas classes — recriam tudo inline.
  - **Fix sugerido**: usar `.site-body`, `.site-body-sm`, `.site-body-lg` no app também (rebatizar como `.app-body-*` se preferir clareza), eliminar inline `fontSize: 13.5` etc.

- **`outline: none` espalhado** em 7 pages com substituição manual de `box-shadow` (`app/(app)/evidencias/page.js:83,100`, `app/(app)/cvs-adaptados/page.js:66`, `app/(app)/conta/CvAnalyzer.js:117`, `app/(app)/cvs-adaptados/CvDiffView.js:63`, `app/(app)/funil/FunnelForm.js:120`, `app/(app)/cvs-adaptados/CvDetailClient.js:99`, `app/(app)/conta/page.js:263`). `globals.css:514-521` já garante focus-visible global com `--shadow-focus` — esses overrides individuais são redundantes ou divergentes.
  - **Fix sugerido**: confiar no global focus-visible. Remover os overrides individuais a menos que o componente realmente precise (ex: input dentro de card escuro).

- **`/meus-dados/page.js` usa classes legacy completamente fora do design system atual** (`.hero`, `.tool-btn`, `.sec`, `.brand`, `.meus-dados-sec` — `app/meus-dados/page.js:87-244`). É a tela LGPD — usuário entra pra exportar/apagar dados, momento crítico de confiança, e visualmente parece um app antigo grudado no novo.
  - **Fix sugerido**: refactor completo pra usar `.ct-page-header` + `.app-glass` (ou esperar Wave 10). Aceitar débito apenas se a página tiver baixa-frequência de acesso.

- **`/entrar/page.js` usa tokens `--rule`, `--ink-faint`, `--ink-soft`, `--mono`** que parecem ser legacy de outro design system (`app/entrar/page.js:81,141,146,163`, vs `--border`, `--text-faint`, `--text-soft`, `--font-mono` que são o padrão atual). Se esses tokens não estiverem definidos hoje em `globals.css`, fallback é browser default (cinza/serif/etc) — quebra silenciosa.
  - **Verificar**: `grep "^\s*--ink-faint\|--rule\|--mono\b" globals.css` retorna vazio. Esses tokens NÃO existem mais → texto fica cor de default browser em vários pontos da página de login.
  - **Fix sugerido**: migrar `--ink-*` → `--text-*`, `--rule` → `--border`, `--mono` → `--font-mono`.

### P3 - Polish

- **SVG strokeWidth varia entre 1.8, 2, 2.2, 2.4, 2.5, 2.6** sem critério. Maioria está em 2 (default), mas chart e badges usam 2.6 (`app/(app)/dashboard/page.js:450`). Não é gritante mas atrapalha "voice" consistente dos ícones.
  - **Fix sugerido**: padrão 2 (default), 1.8 pra ícones grandes (header), 2.5 pra micro-ícones (badges).

- **`<svg width="13" height="13">` / `15`/`19`/`22` etc.** — 5 tamanhos de ícone diferentes em uso. Tokens não existem.
  - **Fix sugerido**: `--icon-xs: 12, --icon-sm: 16, --icon-md: 20, --icon-lg: 24`. SVGs herdam `currentColor`.

- **Score Ring em dashboard usa `boxShadow` inline com `borderRadius: "50%"` inline** (`app/(app)/dashboard/page.js:362`). Já tem CSS dedicado pra `.ct-score-ring-wrap`. Inline override aqui é desnecessário.

- **Comentário "Galadriel polishing CSS em paralelo" aparece em 5+ pages** (`app/(app)/dashboard/page.js:117`, `app/(app)/carreira/page.js:32`, `app/(app)/plano/page.js:114`, etc.) — todos esperando o trabalho que estou fazendo agora. Indica que as 8 waves anteriores assumiam essa task; o trabalho está pendente.

---

## Análise por eixo

### Spacing (P0-P1)

| Página | Padding-top header | Padding-bottom header | Margin-bottom header |
|---|---|---|---|
| `/dashboard` | `clamp(48px, 8vw, 96px)` inline | `clamp(32px, 5vw, 64px)` inline | (sem mb) |
| `/carreira` | `clamp(56px, 9vw, 96px)` inline | `clamp(32px, 5vw, 64px)` inline | `clamp(32px, 5vw, 64px)` inline |
| `/plano` | `clamp(56px, 9vw, 96px)` inline | `clamp(32px, 5vw, 64px)` inline | `clamp(32px, 5vw, 64px)` inline |
| `/evidencias` | `clamp(56px, 9vw, 96px)` inline | `clamp(32px, 5vw, 64px)` inline | `clamp(32px, 5vw, 64px)` inline |
| `/autoconhecimento` | `clamp(56px, 9vw, 96px)` inline | `clamp(32px, 5vw, 64px)` inline | `clamp(32px, 5vw, 64px)` inline |
| `/concursos` | (header CSS classe — 24px 28px) | (24px 28px) | 24px |
| `/oportunidades` | (header CSS classe — 24px 28px) | (24px 28px) | 24px |
| `/funil` | (header CSS classe) | (idem) | 24px |
| `/estagios` | (header CSS classe) | (idem) | 24px |
| `/gaps` | (header CSS classe) | (idem) | 24px |
| `/transparencia` | (header CSS classe) | (idem) | 24px |
| `/conta` | (header CSS sem inline) | (idem) | 24px |
| `/admin` | (header CSS classe) | (idem) | 24px |

Resumo: pages "Wave 8 uplift" têm header ~50-100px de respiração; outras têm 24px. Diferença gritante.

**Ideal**: 1 classe `.app-page-hero` com clamp 56-96 top, 32-64 bottom, 32-64 mb. Páginas legadas migram pra ela.

### Typography (P0)

| Página | H1 size | H1 font-family | H1 weight | Letter-spacing |
|---|---|---|---|---|
| `/dashboard` | `clamp(40px, 6vw, 80px)` inline | Plus Jakarta Sans inline | 700 inline | -0.03em inline |
| `/carreira` | `clamp(40px, 6vw, 80px)` inline | Plus Jakarta Sans inline | 700 inline | -0.03em inline |
| `/plano` | `clamp(40px, 6vw, 80px)` inline | Plus Jakarta Sans inline | 700 inline | -0.03em inline |
| `/evidencias` | `clamp(40px, 6vw, 80px)` inline | (herda Plus Jakarta?) inline | 700 inline | -0.03em inline |
| `/autoconhecimento` | `clamp(40px, 6vw, 80px)` inline | (herda) inline | 700 inline | -0.03em inline |
| `/concursos` | 26px (via `.ct-page-header-title`) | Spectral serif | 700 | -0.5px |
| `/oportunidades` | 26px (idem) | Spectral serif | 700 | -0.5px |
| `/funil` | 26px (idem) | Spectral serif | 700 | -0.5px |
| `/estagios` | 26px (idem) | Spectral serif | 700 | -0.5px |
| `/gaps` | 26px (idem) | Spectral serif | 700 | -0.5px |
| `/transparencia` | 26px (idem) | Spectral serif | 700 | -0.5px |
| `/cvs-adaptados` | 26px (via `.ct-gaps-title`) | Spectral serif | 700 | -0.6px |
| `/cvs-adaptados/[id]` | 26px (idem) | Spectral serif | 700 | -0.5px |
| `/conta` | 26px (`.ct-gaps-title`) | Spectral serif | 700 | -0.6px |
| `/admin` | 26px | Spectral serif | 700 | -0.5px |
| `/entrar` | 38px (inline `.hero`) | (herda body) | (herda) | (default) |
| `/meus-dados` | 32px (inline `.hero`) | (herda) | (herda) | (default) |
| `/experimentar` | `clamp(34px, 3.8vw, 40px)` (`.ct-onb-brand-title`) | Spectral serif | 600 | -0.025em |

Resumo: H1 oscila entre 26 e 80px. Fonte oscila entre Spectral serif e Plus Jakarta Sans. Founder vai sentir.

### Color (P0)

Hex hardcoded em código (excluindo fallbacks `var(--token, #fallback)` que são pattern legítimo):

| Arquivo | Linha | Valor | Contexto | Por que importa |
|---|---|---|---|---|
| `app/admin/page.js` | 166 | `#08313F` | color sobre cyan button | OK — é o `--accent-on-cyan` literal |
| `app/(app)/funil/page.js` | 144-145, 170-171 | `#E5A93C`, `#F0C44A`, `rgba(229,169,60,...)` | bottleneck banner border + gradient | Não tem token; quebra em noir |
| `app/(app)/funil/FunnelForm.js` | 250-251, 266-267 | `rgba(220,80,80,.08/.25)`, `rgba(80,200,150,.10/.3)` | error/success states | `--negative-soft`, `--positive-soft` existem |
| `app/(app)/cvs-adaptados/CvDiffView.js` | 117-119, 338-355, 382-396, 433-435, 445 | `rgba(34,197,94,...)`, `rgba(239,68,68,...)`, `rgba(234,179,8,...)`, `#ff2dd1` | diff highlight | Tailwind colors hardcoded; sem variante noir |
| `components/AppShell.js` | 90, 100 | `rgba(52,53,126,.45)`, `rgba(255,255,255,.18)`, `#fff` | logo brand mark shadow | aceitável (icon assets podem ser fixos) |
| `components/SkillGraph.js` | 327 | `#FFFFFF` | text fill no node | em noir `--text-strong` = `#FFFFFF` mesmo; OK |
| `components/WelcomeModal.js` | 38, 44, 50, 175-208 | `#4F46E5`, `#06B6D4`, `#8B5CF6`, `#E5E7EB`, `#F8FAFC`, `#0F172A`, `#475569` | 3 cards de produto | INDIGO/CYAN/VIOLET sólidos quebram em noir; fallbacks `var(--text, #0F172A)` quase certos de não disparar (token existe), mas accents `c.accent` são puros hex |
| `app/(app)/concursos/page.js` + estagios | múltiplos | hexes via `var(--accent-on-cyan, #08313F)` | fallback chain | OK |

### Radius/Shadow (P0)

Borderradius hardcoded inline (sem token):

- `6px`: 10 ocorrências (`components/PortfolioImportButton.js:88`, `transparencia/page.js:316`, etc)
- `8px`: 30+ ocorrências (concursos x6, estagios x7, admin x3, transparencia x2, components x3, etc)
- `10px`: 5 ocorrências (`WelcomeModal:175`, etc)
- `12px`: 3 ocorrências
- `14px`: 0 inline (usado só em CSS via token)
- `16px`: 4 ocorrências (`evidencias` style block, AppShell)
- `20px`: 0 inline

Token mapping correto seria:
- 4-6px → `--radius-sm` (6)
- 8-10px → `--radius-md` (10) 
- 12-14px → `--radius-lg` (14)
- 16-20px → `--radius-xl` (20)
- 999px → `--radius-pill`

Box-shadow: já melhor — `var(--shadow-sm/md/lg)` é usado em globals. Inline shadows são quase sempre o "underglow cyan" (`0 8px 24px -6px var(--accent-cyan-glow)`) e variações, que poderiam virar token `--shadow-cyan-glow-md`.

### States (P1)

- **Focus**: `globals.css:514-521` garante `:focus-visible` global com `box-shadow: var(--shadow-focus)`. Bom. Mas 7 pages têm `outline: none` overrides redundantes ou com box-shadow diferente — risco de a11y issue se algum override não tiver replacement válido.
- **Hover lift em botões**: 
  - `.btn-primary:hover` em `globals.css:738-743` faz `transform: translateY(-1px)` + box-shadow.
  - `.site-btn-primary:hover` em `globals.css:6372-6376` também `translateY(-1px)` + box-shadow + brightness.
  - `.ct-evidence-btn-primary:hover` (style injected) também `translateY(-1px)`.
  - `.cv-analyzer-glass .ct-conta-btn.primary:hover` também `translateY(-1px)`.
  Resultado: o lift é consistente em magnitude (-1px) mas a SOMBRA varia (cores diferentes de glow, sizes diferentes). Founder hover-testando todos sente que "alguns brilham mais que outros".
- **Active state**: alguns têm `transform: scale(0.98)`, outros `translateY(0)`, outros nada. Caos médio.
- **Disabled**: `.btn:disabled` global em `globals.css:729-730` cobre `.btn .btn-primary` e `.btn-ghost`. Botões custom (`.ct-tailor-btn-*`, `.ct-conta-btn`, `.ct-evidence-btn-*`) implementam disabled individualmente (alguns sim, alguns não — `ct-evidence-btn-primary` style injected define `:disabled` opacity? verificar).

---

## Roteiro de teste manual (founder confirma visualmente)

- [ ] Abrir `/dashboard` em **noir** e medir o gap visual header→primeiro card. Comparar com `/oportunidades` (legacy header).
- [ ] Abrir `/dashboard`, `/carreira`, `/plano` em sequência — H1 deve sentir "mesmo produto" (devia ter ~mesmo tamanho).
- [ ] Abrir `/oportunidades` logo depois de `/dashboard` — sentir o salto de H1 80→26px. Esse é o problema P0 principal.
- [ ] Hover em todos os botões primários (lista abaixo) e verificar se TODOS têm o mesmo lift + mesma cor de glow:
  - `/dashboard` → "Atualizar diagnóstico" (`btn btn-primary` legacy, indigo)
  - `/evidencias` → "Salvar evidência" (override cyan)
  - `/conta` → CvAnalyzer "Analisar CV" (`ct-conta-btn.primary` overridden cyan)
  - `/cvs-adaptados/[id]` → "Copiar" (custom)
  - `/concursos` → botão de filtro submit (inline cyan gradient)
- [ ] Abrir modal WelcomeModal (limpar localStorage `ct.welcome.seen.v1`) em **noir** — confirmar se 3 cards aparecem com `#4F46E5`/`#06B6D4`/`#8B5CF6` brilhantes (devia ser monocromático em noir).
- [ ] Abrir `/cvs-adaptados/[id]` (com diff) em **noir** — verificar se highlights verde/vermelho ficam "iluminados" sobre fundo preto (cores Tailwind são pra light theme).
- [ ] Abrir `/funil` e registrar entrada com error — banner vermelho com `rgba(220,80,80,...)` vs banner positive cyan — confirmar se cores batem com o resto do app.
- [ ] Abrir `/entrar` em **noir** — verificar se textos com `var(--ink-soft, var(--ink-faint))` aparecem (esses tokens não existem mais → será o fallback do browser, provavelmente cor herdada).
- [ ] Abrir `/meus-dados` — verificar se "destoa" das outras páginas do app (classes `.hero`, `.brand`, `.sec` são legacy).
- [ ] Tab through `/conta` page e verificar focus ring em cada input — todos deveriam ter o mesmo cyan glow `--shadow-focus`. Olhar se algum override em CvAnalyzer style block divergiu.
- [ ] Comparar border-radius de `/concursos` filter inputs (8px) com `/evidencias` form inputs (provavelmente var(--radius-sm) = 6px) — diferença de 2px é visível ao olho treinado.

---

## Recomendações priorizadas

### Quick wins (1-2h cada, ROI altíssimo)

1. **Unificar H1 de página (P0)**: criar `.app-h-display` em `globals.css` com tokens já existentes; substituir todos os 14 H1 (5 inline clamp + 9 `.ct-page-header-title`/`.ct-gaps-title`). É o gain visual mais alto.
2. **Substituir `borderRadius: 8` inline por `var(--radius-sm)` ou `var(--radius-md)`** via sed-like search (30+ ocorrências). Mecânico, baixíssimo risco.
3. **Substituir `#4F46E5`/`#06B6D4`/`#8B5CF6` em WelcomeModal por `var(--primary)`/`var(--accent-cyan)`/`var(--accent-magenta)`**. Garante que noir não vai mostrar indigo/cyan/violet sólidos.
4. **Substituir `rgba(220,80,80,...)`/`rgba(80,200,150,...)` em FunnelForm por tokens `--negative-*`/`--positive-*`**. Idem.
5. **Migrar `/entrar` de `--ink-*`/`--rule`/`--mono` pros tokens atuais**. Bug latente — texto pode estar com cor errada hoje.
6. **Consolidar `.ct-target-pill` (definido 2x em globals)**. Cosmético mas confunde.

### Refactor maior (1 dia)

7. **Unificar botões primários**: deletar `.btn-primary` indigo OU rebrandeá-lo pra cyan gradient (preferível: rebrandear pra não quebrar 30+ uses). Eliminar todos os `<style>{...}` que sobrescrevem `.btn-primary`/`.ct-conta-btn.primary`. Manter `.site-btn-primary` se já está sendo usado em landing — caso contrário, apenas `.btn .btn-primary` cyan unificado.
8. **Criar `.app-page-hero` class** que substitui o copy-paste de `paddingTop: "clamp(...)"` em 5 pages.
9. **Migrar `/concursos`, `/oportunidades`, `/funil`, `/estagios`, `/gaps`, `/transparencia`, `/cvs-adaptados`, `/conta`, `/admin` pra usar `.app-h-display` + `.app-page-hero`** — depois do passo 1+8 isso é mecânico.
10. **Extrair `<style dangerouslySetInnerHTML>` de 10+ pages pra `globals.css` ou módulos CSS dedicados**. Eliminar `!important`.

### Aceitar débito (não faz ROI agora)

- `/meus-dados` legacy (`.hero`, `.brand`, `.sec`): página de baixa-frequência (usuário entra 1-2x na vida pra exportar/apagar). Aceitar visual antigo até Wave 10+.
- `/experimentar` usa `.ct-onb-brand-title` clamp 34-40 em vez do clamp 40-80 das outras: é onboarding (fluxo único de entrada), pode ter typography própria intencional. **Confirmar com founder** — se intencional, OK; se não, alinhar.
- Letter-spacing micro-variações (0.04/0.05/0.06): não é gritante a olho nu. Tokenizar só se for fazer pass mecânica.
- SVG strokeWidth (1.8/2/2.4): polish puro, ignorar.

### Aviso ético

- Apesar de identificar P0/P1 grandes, **o sistema base está bem desenhado** — tokens semânticos (positive/negative/attention/accent-cyan/accent-magenta), 3 temas funcionais (light/dark/noir), classes utilitárias `.app-glass`, `.site-h-display`, etc. **O problema é cobertura, não fundação.** As 8 waves anteriores criaram bons artefatos mas não fecharam a migração — pages novas usam o sistema novo, pages antigas continuam com classes legacy, e os style blocks injetados são o "remendo" entre eles.
- Founder ler "1002 classes `.ct-*` em globals.css" pode soar alarmante, mas isso reflete um produto rico (gaps, microactions, achievement toasts, skill graph, copilot, funil, evidências, CVs adaptados, etc.). Reduzir esse número não é fim em si — é colher 50% via consolidação de duplicatas (`.ct-page-header-title` + `.ct-gaps-title` + inline H1 = 1 classe).
