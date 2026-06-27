# Arwen v2 — Visual consistency audit (2026-06-26)

Research-only audit do design system pós-Wave 10. Foco em débito sistêmico:
tokens vs hex hardcoded, escala de spacing/radius, drift tipográfico,
adesão ao `.app-glass`, accent usage entre app e site, e iconografia.

Escopo: `app/` + `components/`. Cobre temas light/dark/noir.

---

## TL;DR

- **Hex hardcoded**: ~14 ocorrências problemáticas (excluindo fallbacks `var(--x, #hex)` e comentários). Maior risco: `WelcomeModal.js` carrega paleta inteira hardcoded; `funil/page.js` e `design-lab/page.js` usam hex que não respeitam noir.
- **Spacing drift**: ~22 ocorrências fora da escala 8/16/24/32. Padding `13px 14px` / `14px 22px` / `22px` e gaps com 7/14/18 reaparecem em vários lugares.
- **Typography drift**: 4 sistemas de H1 convivem (`hero` + `fontSize:38` hardcoded, `ct-page-header-title`, `ct-gaps-title 26px Spectral`, `ct-self-kind-title`). Eyebrow oscila entre `.14em` (10x) e `.18em` (9x) — spec diz 0.18em.
- **Border-radius drift**: 16 ocorrências de `5px`, 13 de `10px`, 11 de `2px`, 3 de `7px`, 1 de `11px`, 1 de `13px` no globals.css — não batem com a escala `--radius-sm 6 / md 10 / lg 14 / xl 20 / pill 999` que a Wave A definiu.
- **Glass re-implementations**: 4 lugares re-implementam glass sem `.app-glass` (CopilotWidget, SiteNav 2x, SiteHero), 2 hardcodam blur `18px`/`20px` em vez de token. Total: 6.
- **Accent usage**: `--site-accent` está corretamente isolado em `components/site/*`. `--accent-cyan` / `--accent-cyan-deep` / `--accent-cyan-glow` usados em ~30 lugares do app interno — todos OK pós-Wave 10. Gradient bicolor cyan→magenta **só** aparece em 1 lugar (globals.css:6649, decorativo no site).
- **Contraste por tema**: principais buracos catalogados — `#FFFFFF` hardcoded em SkillGraph quebra em noir; gradient `#F0C44A → #E5A93C` em `funil/page.js` não responde a tema; `#0F0F0E` em email cron OK (email tem fundo próprio).
- **Iconografia**: 15 stroke-widths distintos. Padrão `2` (29x) é dominante mas `1.6` (15x), `2.4` (9x), `2.6` (6x) somam quase metade. Tamanhos consistentes 16/20/24 não são respeitados — aparece 22, 17, 19, 28, 14.

---

## 1. Hex hardcoded por categoria

Excluindo comentários, fallbacks `var(--token, #hex)` válidos, SVGs decorativos do hero da landing e o template HTML do email cron (cron envia email externo — paleta própria justificável).

### 1.1 Tabela agregada
| Cor | Ocorrências | Token recomendado | Severidade |
|---|---|---|---|
| `#B9D90C` (lime legado) | 4 | `var(--accent-cyan)` (light/dark) ou `var(--accent-cyan)` noir (já é lime) | media — quebra em light/dark |
| `#08313F` (teal escuro) | 4 (e mais como fallback) | `var(--accent-on-cyan)` | baixa — todos têm fallback, mas em CSS direto não tem |
| `#4F46E5`, `#06B6D4`, `#8B5CF6` (paleta avatar WelcomeModal) | 3 | mover pra `--avatar-*` tokens | alta — quebra em noir |
| `#FFFFFF` / `#fff` (texto sobre primary) | 3 | `var(--on-primary)` | alta — invisível em noir |
| `#E5A93C` / `#F0C44A` (gradient amarelo funil) | 3 | criar `--accent-warm` ou usar `--attention` | media — fixo, ignora tema |
| `#ff2dd1` (diff highlight CvDiffView) | 2 | `var(--accent-magenta)` | baixa |
| `#0F0F0E` (bg email) | 1 (template email) | OK manter — email é silo isolado | n/a |
| `#0E3D2A` (stroke check experimentar) | 1 | OK — sobre lime fixo no SVG ilustrativo | baixa |
| `#fff` (stroke SVG experimentar) | 1 | OK — sobre indigo fixo no SVG ilustrativo | baixa |
| `#B9B9EC` (stroke SVG experimentar) | 1 | `var(--primary-tint)` | media |
| `#2A2D36` (stroke ring design-lab) | 1 | `var(--surface-3)` | baixa — design-lab é sandbox |

### 1.2 Ocorrências críticas `arquivo:linha`

- `components/WelcomeModal.js:38` — `accent: "#4F46E5"`
- `components/WelcomeModal.js:44` — `accent: "#06B6D4"`
- `components/WelcomeModal.js:50` — `accent: "#8B5CF6"`
  → 3 cores fixas pra avatars da pop-up. Nenhuma delas existe em tokens. Em noir, esses indigo/cyan/violet vibram dissonantes do P&B Cloudwalk.

- `components/SkillGraph.js:327` — `text: "#FFFFFF"` no `VARIANT_COLORS.have`
  → `--positive` em noir = `#E5E5E5`. Texto branco sobre cinza claro perde contraste. Deveria ser `var(--on-primary)` ou `var(--text-strong)` dependendo do tema (em noir `--on-primary` = `#000`, o que é o correto).

- `app/(app)/funil/page.js:144-145` — `#E5A93C` / `#F0C44A`
- `app/(app)/funil/page.js:170` — `"linear-gradient(140deg, #F0C44A 0%, #E5A93C 100%)"`
  → Gradient amarelo fixo, ignora tema. Em noir vira "color leak" no P&B editorial.

- `app/(app)/candidaturas/page.js:33` — `stroke="#B9D90C"` no SVG do ícone
  → Lime hardcoded. Em light/dark deveria ser `var(--accent-cyan)` (cyan, não lime); em noir já é lime mas o ícone deveria responder ao token, não estar fixo.

- `app/(app)/cvs-adaptados/CvDiffView.js:347` — `borderLeft: "3px solid #ff2dd1"`
- `app/(app)/cvs-adaptados/CvDiffView.js:445` — idem
  → Magenta hardcoded. Existe `--accent-magenta` (#B924FF light/dark, #FAFAFA noir). Trocar.

- `app/design-lab/page.js:124` — `stroke="#2A2D36"`
- `app/design-lab/page.js:127,181` — `stroke="#B9D90C"`, `stroke="#FF6A3D"`
  → Design-lab é sandbox de exploração visual, justificável manter hex pra reproduzir conceitos. **Excluir do débito.**

- `app/experimentar/page.js:347,382,428` — strokes `#fff`, `#0E3D2A`, `#B9B9EC`
  → Os 2 primeiros são sobre fundos fixos (cyan indigo gradient do SVG ilustrativo), aceitáveis. O `#B9B9EC` é tom indigo claro — deveria ser `var(--primary-tint)`.

### 1.3 Fallbacks `var(--x, #hex)` — não são bugs, mas vale auditoria

Estes são corretos (fallback caso CSS var falhe), porém vários têm fallback OBSOLETO (cor pré-Wave A):
- `app/termos/page.js:15-67` — fallbacks `#F6F5F2`, `#1F1D33`, `#514E5C`, `#797585`, `#E7E4EC` — todos são paleta bege "Direção 0", abandonada pela Wave A. Deveriam ser atualizados ou removidos.
- `components/WelcomeModal.js:176,177,198,207,221` — fallbacks `#E5E7EB`, `#F8FAFC`, `#0F172A`, `#475569` (Tailwind slate) — não combinam com `--bg`/`--text` do projeto.

---

## 2. Spacing drift

Escala alvo: **8/16/24/32/40/48/56/64/80/96** (com 4/12/20 como tolerados para nuance fina).

### 2.1 Ocorrências fora da escala

- `app/(app)/funil/FunnelForm.js:114` — `padding: 22`
- `app/termos/page.js:58` — `paddingLeft: 22`
- `app/privacidade/page.js:304` — `padding: "1px 6px"`
- `app/privacidade/page.js:286` — `gap: 7`
- `app/privacidade/page.js:308` — `marginRight: 4`
- `app/(app)/concursos/page.js:367` — `padding: "9px 18px"`
- `app/(app)/estagios/page.js:303,550` — `padding: "9px 18px"` (2x)
- `app/(app)/transparencia/page.js:300` — `padding: "3px 9px"`
- `app/entrar/page.js:286` — `padding:13px 14px`
- `app/entrar/page.js:319` — `padding:14px 22px`
- `app/entrar/page.js:330` — `margin:18px 0 22px`
- `app/entrar/page.js:387` — `gap:18px`
- `app/entrar/page.js:390` — `gap:14px`
- `app/entrar/page.js:417` — `margin:22px 0 0`
- `app/experimentar/page.js:694` — `margin: 18px 0 22px`
- `app/privacidade/page.js:1161` — `marginTop: 40` (OK na escala)
- `app/admin/page.js:336` — `marginBottom: 18`
- `app/admin/page.js:336` — duplicada
- `app/(app)/funil/page.js:196` — `marginTop: 8` (OK)
- Vários `gap: 14` em `privacidade/page.js:243, 482, 626, 1179` (4 ocorrências) — `14` não está na escala (alvos próximos: 12 ou 16)
- Vários `gap: 7`, `gap: 9`, `padding: 22` em globals.css em utilitários `.ct-formula-bar` (`margin-bottom: 7px`), `.ct-skill-chip` (`padding: 4px 9px`), `.ct-action-tag` (`padding: 4px 9px`, `gap: 5px`)

Total: **~22 ocorrências fora da escala** (≥4 em arquivos de produção, ignorando design-lab).

### 2.2 Padrão: `13/14/18/22` é o que mais escapa
- `14px` por si só é tolerado (existe na escala estendida), mas combinado com `22` ou `18` cria saltos não-rítmicos.
- `9 18` (3 ocorrências em `concursos`+`estagios`) é o padrão de tab/chip vindo de copy-paste; deveria ser `8 16` ou `12 20`.

---

## 3. Typography drift

### 3.1 H1 — 4 sistemas convivem

| Sistema | Onde | Tamanho |
|---|---|---|
| `.ct-page-header-title` (canônico Wave 10A) | 9 páginas | `clamp(40px, 6vw, 80px)` |
| `.ct-gaps-title` (legado pré-Wave 10A) | 4 páginas (cvs-adaptados/page, conta/page, gaps/page indirectly) | `26px` Spectral fixo |
| `.ct-self-kind-title` | 1 página (autoconhecimento/[kind]) | (definido linha 4325) |
| `<h1 className="hero" style={{ fontSize: XX }}>` | `meus-dados:100`, `entrar:51`, `auth/verify-request:63` | hardcoded 32/38 |

→ `ct-gaps-title` tem comentário no globals.css linha 6232 dizendo "Wave 10A — H1 sistema unificado com /dashboard, /carreira, /plano. Substitui o legado 26px Spectral fixo (10 paginas usavam essa classe)". A unificação está **incompleta**: cvs-adaptados/page.js:83 e conta/page.js:281 ainda usam `ct-gaps-title`.

### 3.2 Eyebrow — letter-spacing inconsistente

Spec: **0.18em** + mono 11px uppercase.

Distribuição real (inventário em 40 chamadas):
- `0.14em` — 14x (mais comum)
- `0.18em` — 10x (spec)
- `0.06em` — 9x
- `0.16em` — 5x
- `0.1em`, `0.08em`, `0.04em`, `0.02em` — caudas

→ `dashboard/page.js:131`, `autoconhecimento/page.js:70`, `carreira/page.js:62`, `plano/page.js:131` usam **0.14em** (não-spec) no que é claramente um eyebrow.
→ `entrar/page.js:178`, `plano/page.js:330`, `privacidade/page.js:1172` usam `0.18em` (spec).
→ `admin/page.js:363-370` usam `0.06em` em table headers (admin, OK como hierarquia diferente).

### 3.3 Body — drift discreto

`fontSize` inventário (top valores): `14` (48x), `13` (41x), `11` (38x), `12` (35x), `13.5` (16x), `15` (13x), `11.5` (13x).
→ `13.5px`, `11.5px`, `10.5px` são "pixel pushing" — somam **31 ocorrências** que poderiam consolidar em `13`/`11`/`10`.
→ Spec body 14-17px: várias páginas usam 12-13 como body (não-eyebrow). Aceitável pra metadata/labels, mas `concursos/page.js:142,169,185` usam `14` pra inputs (correto) e `13` pra body (limite inferior).

### 3.4 Display fonts misturados

- `app/api/cron/outcome-survey/route.js:79` — `'Helvetica Neue',serif` (template email, OK isolado).
- `globals.css:2382` — `.ct-gaps-title { font-family: var(--font-display) }` → Spectral serif. **Quebra a hierarquia**: outros H1 (`.ct-page-header-title`) usam Plus Jakarta Sans. Inconsistência tipográfica.

---

## 4. Border-radius

Escala canônica: `--radius-sm 6 / --radius-md 10 / --radius-lg 14 / --radius-xl 20 / --radius-pill 999`. CTAs/inputs/cards deveriam usar tokens; avatars usam `50%`.

### 4.1 Inventário globals.css (top valores)
| Valor | Ocorrências | Avaliação |
|---|---|---|
| `5px` | 16 | **OFF-SCALE** — barras de progresso (`.ct-formula-bar`, `.ct-ss-bar`, `.ct-mediana-bar`, etc) |
| `50%` | 13 | OK (avatars/dots) |
| `10px` | 13 | OK (`--radius-md`) |
| `2px` | 11 | **OFF-SCALE** — separadores/highlights internos |
| `999px` | 7 | OK (pills) |
| `8px` | 5 | OFF-SCALE (perto de `--radius-sm 6`) |
| `6px` | 5 | OK (`--radius-sm`) |
| `4px` | 5 | OFF-SCALE (chips muito pequenos) |
| `16px` | 4 | OFF-SCALE (perto de `--radius-lg 14`) |
| `9px` | 3 | OFF-SCALE (action numbers, `.ct-action-num`) |
| `12px` | 3 | OFF-SCALE (perto de `--radius-md 10`) |
| `7px` | 2 | OFF-SCALE (chips) |
| `3px` | 2 | OFF-SCALE |
| `11px`, `13px`, `14px`, `28px` | 1 cada | OFF-SCALE |

Total OFF-SCALE em globals.css: **~60 ocorrências**.

### 4.2 Inventário app/components inline
| Valor | Ocorrências |
|---|---|
| `8` | 16 |
| `999` | 10 |
| `6` | 9 |
| `16` | 4 |
| `12` | 4 |
| `10` | 4 |
| `20` | 2 |
| `4`, `3`, `24`, `18` | 1 cada |

Inline está mais alinhado, mas `8` (16x) ainda escapa (`--radius-sm` é 6).

### 4.3 Casos cirúrgicos
- `app/(app)/cvs-adaptados/CvDiffView.js:159` — `borderRadius: 3` (chip)
- `components/site/SiteHero.js:157` — `borderRadius: 18` (badge anchor)
- `globals.css:2142,2366,2375` — `.ct-profile-avatar` raio 13px, `.ct-skill-chip` raio 7px, `.ct-action-tag` raio 7px

### 4.4 Conclusão
A escala de radius foi definida mas **nunca consumida**. `--radius-sm/md/lg/xl/pill` são citados em ~10 lugares em globals.css; o resto é numérico hardcoded. Maior dívida sistêmica do design system.

---

## 5. Glass re-implementations

`.app-glass` (globals.css:6657) já existe e é usado corretamente em:
- `app/entrar/page.js:173`
- `app/meus-dados/page.js:107,158,183,215,229`
- `app/experimentar/page.js:344,438,628`

Re-implementações inline (NÃO usam `.app-glass`):

1. **`components/CopilotWidget.js:344-348`** — `backdropFilter: "blur(var(--app-glass-blur))"` + bg/border inline. Poderia usar `.app-glass`. O comentário admite a duplicação ("Refresh visual: glassmorphism sobre o painel"). **DUPLICAÇÃO.**

2. **`components/DashboardHighlightBanner.js:45`** — `backdropFilter: "blur(var(--app-glass-blur))"` inline + bg/border próprios. **DUPLICAÇÃO.**

3. **`components/NotificationsBell.js:252`** — `backdropFilter: "blur(var(--app-glass-blur))"` inline. **DUPLICAÇÃO.**

4. **`components/AchievementToast.js:63`** — idem. **DUPLICAÇÃO.**

5. **`components/site/SiteNav.js:35,156`** — `backdropFilter: "saturate(140%) blur(18px)"` e `"blur(18px)"`. **BLUR HARDCODED** (deveria ser `var(--site-glass-blur)` ou utilitário site).

6. **`components/site/SiteHero.js:159`** — `backdropFilter: "blur(20px)"`. **BLUR HARDCODED**.

7. **`app/meus-dados/page.js:252-253`** — fallback `var(--app-glass-bg, var(--surface))` inline pra elemento dentro de um `.app-glass`. Tolerável, mas pode usar classe filha.

**Total: 6 re-implementações + 2 blur hardcoded.**

Recomendação: criar `.site-glass` análogo a `.app-glass` (já existe em globals.css linhas 6582-6591 como `.site-glass-card` e `.site-glass-card-bordered`), e migrar os 4 componentes do app pra `.app-glass`.

---

## 6. Accent usage

### 6.1 `--site-accent` corretamente isolado em landing

Ocorrências em `components/site/*`: ~40. **Nenhuma fuga** detectada (grep sobre app interior por `--site-accent` retornou zero). Isolamento do silo landing-vs-app está saudável.

### 6.2 `--accent-cyan*` espalhado pelo app interior

Ocorrências em `app/(app)/*` + componentes app-specific: ~40 (carreira, plano, autoconhecimento, oportunidades, gaps, dashboard, funil, cvs-adaptados, evidencias). Todos com fallback ou consistentes. **OK pós-Wave 10.**

### 6.3 Gradient bicolor cyan→magenta

Grep: `linear-gradient.*magenta` retorna **1 match** em produção:
- `app/globals.css:6649` — `background-image: linear-gradient(135deg, var(--site-accent) 0%, var(--site-accent-magenta) 100%);` — provavelmente o `.site-text-gradient`. **Decorativo no site, OK.**

Não há gradient bicolor remanescente no app interior. **Limpo.**

### 6.4 `var(--accent)` alias legado

`--accent` é alias pra `--primary` (indigo light/dark, branco noir). É usado em ~300 lugares e funciona como esperado pós-Wave A. Sem ação.

---

## 7. Contraste por tema

### 7.1 Casos que quebram em noir

1. **`components/SkillGraph.js:327`** — `text: "#FFFFFF"` no variant `have`. Em noir `--positive` = `#E5E5E5` (quase branco). Texto branco sobre cinza claro = contraste ~1.2:1. **FAIL grave.**

2. **`app/(app)/funil/page.js:144-170`** — `#F0C44A` / `#E5A93C` gradient amarelo. Noir é P&B Cloudwalk; cor cremosa vibra dissonante. Também: texto que assume cor escura sobre amarelo pode quebrar se vier de `var(--text)` (noir = quase branco).

3. **`components/WelcomeModal.js:38,44,50`** — `accent` indigo/cyan/violet hardcoded. Em noir, três cores vibrantes destoam do P&B. Não é "contrast fail" stricto, mas é **brand fail**.

4. **`app/(app)/candidaturas/page.js:33`** — `stroke="#B9D90C"` (lime). Em **light** (bg `#F4F6FA` cinza-azul claro), lime tem contraste ~2.1:1. **FAIL pra texto, marginal pra ícone**.

5. **`app/(app)/cvs-adaptados/CvDiffView.js:347,445`** — `borderLeft: "3px solid #ff2dd1"` (magenta). 3px é uma faixa lateral, não texto; em noir vibra demais. Deveria ser `var(--accent-magenta)` (noir = `#FAFAFA`, vira branco discreto).

### 7.2 Tokens-com-fallback de paleta legada (não quebram, mas confundem)

- `app/termos/page.js:15-67` — fallbacks `#F6F5F2` (bege Direção 0), `#1F1D33`, `#797585`, `#E7E4EC`. Em prod o var sobrescreve — funciona. Em ambientes que não carregam CSS (PDF print, email screenshot), volta paleta velha. **Limpar quando possível.**

### 7.3 Comentários do globals.css confirmam fixes Wave 10A

`globals.css:151-156, 184-187, 285-287` indicam que `--text-muted`, `--text-faint`, `--site-fg-dim` foram corrigidos pra atingir 4.6:1 AA. Isso cobre 90% dos tokens. Os 5 casos acima são os pontos restantes onde **não há token** — só hex hardcoded.

---

## 8. Iconografia

### 8.1 SVGs inline vs componentes

`<svg|<path` em `app/(app)/` + `components/`: ~180 ocorrências. **Não há componente `<Icon>` central**. Cada SVG é re-escrito em cada uso. Cataloguei zero uso de pacote tipo `lucide-react` (no package.json não vi import).

Implicações:
- Stroke-width oscila (ver 8.3).
- Tamanhos não-padronizados (ver 8.2).
- Manutenção difícil — mudar paleta de ícones obriga tocar 180 lugares.

### 8.2 Tamanhos

Padrão alvo: **16 / 20 / 24**.

Tamanhos detectados (`width=`/`height=`):
- `width="22"` em `funil/page.js:177,181`, `experimentar/page.js:347` — não padrão
- `width="17"` em `experimentar/page.js:428` — não padrão
- `width="19"` em `candidaturas/page.js:33` — não padrão
- `width="28"` em `concursos/page.js:343` — não padrão (pode ser 24 ou 32)
- `width="14"` em `globals.css:616` (info-tip), `SiteHero.js:570` — borderline
- `width="120"` em `Report.js:144` — é um ring/gauge, não icon
- `width="15"` em `Report.js:222` — não padrão

### 8.3 Stroke-width

Distribuição (em 85 SVGs com `strokeWidth` explícito):
- `2` — 29x (padrão Lucide-like)
- `1.6` — 15x (vem do landing/site)
- `2.4` — 9x
- `2.6` — 6x
- `1.8` — 5x
- `1.2` — 4x
- `1` — 4x
- `2.5` — 3x
- `2.2` — 2x
- `1.5` — 2x
- `1.9`, `1.4` — 1x cada
- Outliers: `13`, `9`, `6` — devem ser typos ou attrs de elementos não-icon (rect dimensions confundidas com strokes)

Recomendação: **padronizar em `1.5`/`2`/`2.5`** (Lucide) e criar `<Icon>` wrapper. **15 valores distintos é insustentável.**

---

## Top 5 alavancas

1. **Consolidar H1 — substituir `ct-gaps-title`/`ct-self-kind-title`/`<h1 className="hero">` por `ct-page-header-title`.**
   - Toca: `cvs-adaptados/page.js:83`, `conta/page.js:281`, `autoconhecimento/[kind]/page.js:102`, `meus-dados/page.js:100`, `entrar/page.js:51`, `auth/verify-request/page.js:63`.
   - Impacto: hierarquia tipográfica única em todo o app. Remove 3 sistemas legados.

2. **Adotar a escala de radius (`--radius-sm/md/lg/xl/pill`) no globals.css e migrar os ~60 numéricos hardcoded.**
   - Foco: barras de progresso (`5px` → `--radius-sm 6`), chips (`7px` → `--radius-sm`), action-tag (`7px` → `--radius-sm`), `.ct-profile-avatar 13px` → `--radius-md 10` ou `--radius-lg 14`.
   - Impacto: design system "fechado" — toda revisão futura muda 1 token, não 60 lugares.

3. **Criar `<Icon>` wrapper + padronizar 3 stroke-widths (1.5 / 2 / 2.5) e 3 sizes (16/20/24).**
   - Remove 15 stroke-widths distintos, 7 sizes não-padrão.
   - Impacto: tema responsivo a `currentColor` automatic; manutenção de 1 componente em vez de 180 SVGs.

4. **Eliminar 6 glass re-implementations inline → `.app-glass` (app) / `.site-glass-card` (site).**
   - Migrar: `CopilotWidget.js:344`, `DashboardHighlightBanner.js:45`, `NotificationsBell.js:252`, `AchievementToast.js:63`, `SiteNav.js:35,156` (usar var), `SiteHero.js:159` (usar var).
   - Impacto: trocar token de blur ajusta tudo de uma vez. Hoje hardcoded `18px`/`20px` em 3 lugares do site.

5. **Trocar 5 hex de paleta hardcoded por tokens semânticos:**
   - `SkillGraph.js:327` (`#FFFFFF` → `var(--on-primary)`)
   - `WelcomeModal.js:38,44,50` (paleta avatar → tokens `--avatar-from/to/accent-1/2/3`)
   - `funil/page.js:144,145,170` (gradient amarelo → criar `--accent-warm` ou usar `--attention`)
   - `cvs-adaptados/CvDiffView.js:347,445` (`#ff2dd1` → `var(--accent-magenta)`)
   - `candidaturas/page.js:33` (`#B9D90C` stroke → `var(--accent-cyan)`)
   - Impacto: 3 temas estáveis. Atualmente noir tem 5 vazamentos visuais conhecidos.

---

## Apêndice: arquivos consultados

- `app/globals.css` (6710 linhas) — tokens, utilitários, theme overrides
- `app/(app)/**/*.js` — app interior (dashboard, plano, carreira, autoconhecimento, oportunidades, gaps, funil, cvs-adaptados, evidencias, concursos, estagios, transparencia, conta, candidaturas, autoconhecimento/[kind])
- `app/(landing)/page.js` + `components/site/*` — landing pública
- `app/entrar/page.js`, `app/meus-dados/page.js`, `app/privacidade/page.js`, `app/admin/page.js`, `app/termos/page.js`, `app/experimentar/page.js`, `app/auth/verify-request/page.js`, `app/design-lab/page.js`
- `components/` — AppShell, ChatModal, CopilotWidget, DashboardHighlightBanner, InterviewModal, NotificationsBell, OutcomeSurveyModal, OnboardingChat, Report, SkillGraph, ThemeToggle, WelcomeModal, AchievementToast

Excluídos do escopo:
- `app/api/cron/outcome-survey/route.js` (template email — silo isolado, paleta própria justificável)
- `app/design-lab/*` (sandbox de exploração visual)
- SVGs decorativos do hero da landing (gradients de logo)
