# Acessibilidade — Audit Preview Claude Design (2026-06-22)

Auditoria das 6 telas autenticadas + AppShell + tela de login do branch
`redesign/claude-design`. Critério: WCAG 2.1 AA. Sem ferramenta automatizada
rodada — análise de código + cálculo manual de contraste a partir dos hex em
`globals.css`.

---

## TL;DR

O preview tem base decente (focus-visible global, `prefers-reduced-motion`
honrado, `aria-current="page"` no nav, `role="progressbar"` na transparência),
mas falha em três frentes que cortam usuários reais: **contraste de texto
secundário** (token `--text-faint` falha AA em ~10 lugares), **inputs sem
label visível em filtros** do Radar, e **inexistência de `aria-live` em
regions dinâmicas** (loading do Radar, contagem de vagas). Estimo que **~55%
das telas passariam um scan automatizado tipo axe-core**, mas nenhuma delas
fica isenta de quick wins. Top 3 críticos: contraste de `--text-faint`,
ausência de `<main>` semântico em várias páginas, e select de filtros que é
botão envolvendo botão (semântica quebrada).

---

## Problemas CRÍTICOS (bloqueiam usuários de tecnologia assistiva)

### 1. Contraste insuficiente em `--text-faint` sobre superfícies claras

- **Onde:** `globals.css:74` (definição `--text-faint: #9893A4`), aplicado em
  ~30 lugares: `ct-score-of`, `ct-score-baseline`, `ct-ss-source`,
  `ct-actions-sub`, `ct-profile-field-label`, `ct-req-sub`, `ct-req-pct`,
  `ct-rail-sub`, `ct-chart-sub`, `ct-timeline-date`, `ct-filters-count`,
  `ct-fit-label` (dashboard, gaps, plano, oportunidades, transparência).
- **Critério WCAG violado:** 1.4.3 Contrast (Minimum) — AA.
- **Impacto:** `#9893A4` sobre `#FFFFFF` ≈ 3.0:1; sobre `--surface-2`
  (`#FAF9F5`) ≈ 2.9:1. Mínimo AA pra texto normal é 4.5:1. Usuários com
  baixa visão (catarata inicial, daltonismo de contraste, leitura em sol
  direto) perdem legibilidade de labels, datas, fontes, percentuais — i.e.
  da maior parte do "metadado" das telas.
- **Fix:** Trocar `--text-faint` light pra `#6E6A7A` (≈ 5.1:1) ou usar
  `--text-soft` (#797585, ≈ 5.0:1) em textos < 16px. Manter `--text-faint`
  só pra texto >= 18px bold (large text, AA = 3:1).

### 2. Falta `<main>` semântico em 5 telas

- **Onde:** `app/(app)/dashboard/page.js:52`, `gaps/page.js:111`,
  `oportunidades/page.js:30,60`, `plano/page.js:113`, `transparencia/page.js:49`
  — todas usam `<div className="app-container">` como wrapper principal,
  sem landmark.
- **Critério WCAG violado:** 1.3.1 Info and Relationships, 4.1.2 Name/Role/Value;
  e prática ARIA Landmarks Roles.
- **Impacto:** Usuários de NVDA/VoiceOver/JAWS usam o atalho "skip to main
  content" (tecla `D` ou `R` em NVDA, `VO+U` em VO). Sem `<main>`, eles caem
  no `<aside>` (sidebar) ou no `<body>` direto e têm que tabular tudo. Em
  contraste, `/conta/page.js:161` usa `<main className="wrap">` — está
  certo.
- **Fix:** Substituir `<div className="app-container">` por
  `<main className="app-container">` em todas as 5 páginas. Zero estilo
  muda.

### 3. Filtros do Radar — `<button>` envolvendo `<select>`

- **Onde:** `app/(app)/oportunidades/RadarClient.js:138-165` (`FilterSelect`)
  e `:168-197` (`FilterNumber`).
- **Critério WCAG violado:** 4.1.1 Parsing, 4.1.2 Name, Role, Value, 2.1.1
  Keyboard. HTML inválido: `<button>` não pode conter `<select>`.
- **Impacto:** Comportamento de teclado/screen reader fica imprevisível.
  Em Chrome, clicar no botão envolvedor não abre o select; em Firefox, o
  select dentro de button quebra o reconhecimento de role. Usuários de
  teclado podem ficar travados no botão sem nunca alcançar o select. Tab
  ordem fica ambígua. Além disso, o ícone chevron decorativo está fora do
  `<select>`, então clicar nele não abre o menu.
- **Fix:** Substituir o `<button>` envolvendo `<select>` por um `<label>`
  visualmente estilizado igual button. O `<select>` mantém appearance:none
  + a chevron como `background-image` ou pseudo-elemento `::after` do label.
  Padrão "custom select" acessível: select real é o controle, o "botão" é
  só visual.

---

## Problemas IMPORTANTES (deteriora experiência)

### 4. Sem `aria-live` em regions dinâmicas

- **Onde:** `RadarClient.js:61-67` (contagem "X vagas compatíveis"),
  `:111-114` (skeleton loading), `:103-108` (erro).
- **Critério:** 4.1.3 Status Messages (AA).
- **Impacto:** Quando user muda filtro, vagas atualizam silenciosamente.
  Screen reader não anuncia "buscando", "5 vagas encontradas" ou erro.
- **Fix:** Envelopar a contagem + lista em `<div aria-live="polite"
  aria-busy={loading}>`. Erro em `role="alert"`.

### 5. SVGs decorativos sem `aria-hidden`

- **Onde:** Quase todos os SVGs inline em
  `dashboard/page.js` (chevron linha 68, trend arrow 181, info 386,
  asterisk 305), `gaps/page.js` (chevron 127), `RadarClient.js` (chevron
  152, 184, checks 228, plus 245), `plano/page.js` (timeline icon 391),
  `AppShell.js` — alguns têm `aria-hidden="true"` (NavIcon, BrandMark,
  appshell-avatar), mas a maioria nas páginas não.
- **Critério:** 1.1.1 Non-text Content (A).
- **Impacto:** SR fala "imagem" no meio do conteúdo sem propósito. Ruído
  cognitivo, especialmente em listas de KPI e action cards.
- **Fix:** Adicionar `aria-hidden="true"` em todos os SVG puramente
  decorativos. Se for informativo (raro aqui), adicionar `<title>`
  filho + `role="img"` + `aria-labelledby`.

### 6. Score ring SVG sem rótulo acessível

- **Onde:** `dashboard/page.js:144-177` (anel grande do score), `:280-302`
  (anel de fit por vaga em `RadarClient.js`).
- **Critério:** 1.1.1, 4.1.2.
- **Impacto:** SR não recebe "Score 72 de 100" — só o `<div>` com número
  que pode ou não ser lido como contexto isolado. Falta semântica de
  "progresso atual".
- **Fix:** Envelopar SVG em `<div role="img" aria-label="Saúde da carreira:
  72 de 100">` ou usar `role="progressbar" aria-valuenow={score}
  aria-valuemin="0" aria-valuemax="100" aria-label="...">`.
  `transparencia/page.js:217-228` já faz isso direito para a `ct-formula-bar`
  — replicar o padrão.

### 7. Filtros (sem `<fieldset>`/`<legend>`) e contagem de vagas isolada

- **Onde:** `RadarClient.js:60-88` — três filtros num `<div>` sem
  agrupamento semântico.
- **Critério:** 1.3.1.
- **Impacto:** SR não sabe que os 3 controles formam um grupo "Filtros
  de busca". User de teclado tem que tabular esperando o que vem.
- **Fix:** Usar `<form role="search">` ou `<fieldset><legend>Filtros</legend>`.

### 8. Checkbox sem `<label htmlFor>` em `/conta`

- **Onde:** `app/conta/page.js:426-440` — `<label>` envolve o input,
  mas sem `htmlFor`, e o `<span>` com texto não tem `id`.
- **Critério:** 1.3.1, 3.3.2 (Labels or Instructions).
- **Impacto:** Wrap implícito funciona na maioria dos casos, mas falha
  em alguns SRs (Dragon NaturallySpeaking, comando "click receber digest").
- **Fix:** `<input id="digestEnabled">` + `<label htmlFor="digestEnabled">`.

### 9. Skip link inexistente

- **Onde:** Toda a app. `AppShell.js` renderiza sidebar antes de `{children}`.
- **Critério:** 2.4.1 Bypass Blocks (A).
- **Impacto:** User de teclado precisa tabular pelos 6 itens do nav + bloco
  LGPD + user info antes de chegar ao conteúdo em CADA navegação.
- **Fix:** Adicionar `<a className="skip-link" href="#main-content">Pular
  pra conteúdo</a>` no topo do AppShell. Estilizar com `position:absolute;
  top:-100px; &:focus { top: 0 }`.

### 10. Animações sem cobertura completa em `prefers-reduced-motion`

- **Onde:** `globals.css:149` cobre `*{animation:none; transition:none}` —
  mas o CSS `.ct-ss-bar-fill` (linha 1624) usa `transition: width 800ms`
  e o skeleton `ctShim` (linha 1779) usa `animation`. A regra `!important`
  global pega esses, mas as transformações inline (`stroke-dashoffset`
  animado via React) e mudanças de tema (`var(--transition-theme)`) podem
  passar.
- **Critério:** 2.3.3 Animation from Interactions (AAA, nice-to-have),
  2.2.2 Pause/Stop/Hide (A se houver autoplay).
- **Impacto:** Skeleton shimmer + ring fill podem causar desconforto em
  usuários com vestibular disorder.
- **Fix:** Já está coberto pelo `*` global — testar manualmente que
  ringfill e shimmer realmente param. OK na prática.

### 11. Login: erro/sucesso silencioso

- **Onde:** `app/entrar/page.js:57-61` — div `note-line` mostra "Se houver
  uma conta com esse e-mail...", mas sem `role="status"`.
- **Critério:** 4.1.3 Status Messages.
- **Impacto:** Após submit, user de SR não escuta confirmação.
- **Fix:** Adicionar `role="status"` ou `aria-live="polite"` no `note-line`
  que aparece via `enviado=1`.

### 12. Headings sem hierarquia em `/transparencia`

- **Onde:** `transparencia/page.js:62-72` (h1) + 90-103 (h2) + 116-126 (h2)
  está OK; mas dentro do `PrincipleCard:155` há `ct-principle-title` (div)
  que parece h3 visualmente mas é um `<div>`. Mesmo padrão em
  `dashboard/page.js:213` (`ct-subscores-title` div).
- **Critério:** 1.3.1, 2.4.6 Headings and Labels.
- **Impacto:** User de SR usa H+H+H pra navegar; perde landmarks.
- **Fix:** Trocar divs que funcionam como heading por `<h3>` (ou
  `role="heading" aria-level="3"`).

---

## Quick wins (1h consertam vários)

Lista de fixes de 5-15 min cada — dispatcháveis em agente único:

1. **Adicionar `aria-hidden="true"` em ~25 SVGs decorativos** (5 min × 6
   arquivos). Padrão: todo SVG dentro de um `<button>` ou `<Link>` com
   texto irmão. Arquivos: `dashboard/page.js`, `gaps/page.js`,
   `RadarClient.js`, `plano/page.js`, `transparencia/page.js` (já tem
   alguns), `conta/page.js`.
2. **Trocar `<div className="app-container">` por `<main className="...">`
   em 5 telas** (1 min cada).
3. **Adicionar skip link no `AppShell.js`** (5 min) + CSS no globals.
4. **Adicionar `role="img" aria-label="Score X de 100"` nos dois SVG rings**
   (Dashboard + cada job card no Radar).
5. **Adicionar `aria-live="polite"` no wrapper de vagas do RadarClient** +
   `role="alert"` no error block.
6. **Adicionar `id` + `htmlFor` no checkbox de digest em `/conta`**.
7. **Adicionar `role="status"` no `note-line` de `/entrar` com `enviado=1`**.
8. **Adicionar `<title>CareerTwin AI - {Nome da página}</title>` confirmado
   em todas via `metadata` export** — já está OK em todas as 6 telas
   auditadas (positivo, manter).
9. **Marcar texto "CARGO-ALVO" com role correto:** o `ct-target-pill` é
   `<Link>` mas o conteúdo visual é `LABEL: VALUE chevron` — adicionar
   `aria-label="Cargo-alvo: {targetRole}. Clique pra editar"` no Link.
10. **Trocar tokens `--text-faint` por `--text-soft` em sub-12px** (busca
    global + replace). Manter `--text-faint` apenas em texto >= 14px bold.

---

## Tabela de issues por tela

| Tela | Críticos | Importantes | Quick wins | Score AA estimado |
|---|---|---|---|---|
| Dashboard | 2 (contraste, sem `<main>`) | 3 (SVGs, ring sem label, headings div) | 5 | 55% |
| Gaps | 2 (contraste, sem `<main>`) | 2 (SVGs decorativos, sub heading div) | 4 | 60% |
| Oportunidades | 3 (contraste, sem `<main>`, button>select) | 3 (aria-live, fieldset, ring sem label) | 6 | 40% |
| Plano | 2 (contraste, sem `<main>`) | 2 (SVGs, timeline data não anunciada) | 4 | 60% |
| Transparência | 1 (sem `<main>`) | 2 (PrincipleCard usa div como heading, SVGs) | 3 | 75% |
| Conta | 1 (checkbox sem htmlFor) | 2 (avatar com `aria-hidden` mas falta alt no img) | 3 | 70% |
| AppShell | 0 críticos | 2 (sem skip link, mobile nav scroll horizontal sem hint) | 3 | 70% |
| Entrar | 0 críticos | 2 (sem role=status, separador `aria-hidden` OK) | 2 | 80% |

Score estimado conta com manualmente sanar os critérios "automáticos" tipo
axe-core/Lighthouse — não inclui critérios subjetivos como redação clara,
reading flow lógico (que estão bons).

---

## Contrast issues detectados

Cálculos baseados em hex literais do `globals.css` (light theme). Ratios
estimados via fórmula WCAG (luminância relativa).

| Token + base | Hex | Ratio est. | Tamanho | Veredito AA |
|---|---|---|---|---|
| `--text-faint` sobre `--surface` | #9893A4 / #FFFFFF | ~3.0:1 | 11-12px normal | **FAIL** |
| `--text-faint` sobre `--surface-2` | #9893A4 / #FAF9F5 | ~2.9:1 | 11-12px | **FAIL** |
| `--text-faint` sobre `--bg` | #9893A4 / #F6F5F2 | ~2.9:1 | 11px | **FAIL** |
| `--text-soft` sobre `--surface` | #797585 / #FFFFFF | ~5.0:1 | 11-15px | PASS |
| `--text-muted` sobre `--surface` | #514E5C / #FFFFFF | ~8.5:1 | qualquer | PASS AAA |
| `--primary` sobre `--surface` | #4F4FB0 / #FFFFFF | ~6.0:1 | qualquer | PASS |
| `--primary` sobre `--primary-soft` (nav active) | #4F4FB0 / #EEEEFB | ~5.4:1 | 13px bold | PASS |
| `--attention` sobre `--surface` | #B6822A / #FFFFFF | ~3.5:1 | 13px | **FAIL** normal, OK large bold |
| `--attention` sobre `--attention-soft` | #B6822A / #FBF6EC | ~3.4:1 | 11px | **FAIL** |
| `--attention-deep` sobre `--attention-soft` | #7A6326 / #FBF6EC | ~6.0:1 | qualquer | PASS |
| `--positive` sobre `--surface` | #1E9C7E / #FFFFFF | ~3.2:1 | 11-13px | **FAIL** texto, OK UI component |
| `--positive-deep` sobre `--positive-soft` | #1E7E66 / #ECF6F0 | ~4.7:1 | 11px | borderline PASS |
| White sobre `--primary` (botão) | #FFF / #4F4FB0 | ~6.0:1 | 14px | PASS |
| White sobre `--accent` (mark, button-primary) | #FFF / #4F4FB0 | ~6.0:1 | qualquer | PASS |
| `--primary-light` (avatar dot) | #6E6EC8 ⇆ #ECF6F0 | ~3.5:1 | 7×7px UI | OK (UI) |

**O que não testei (precisa ferramenta dedicada):**
- Dark theme — só verifiquei light. `--text-faint` no dark (`#6F6A80` sobre
  `#1A1A26`) parece pior, ~2.5:1, precisa confirmar.
- Color blindness (deuteranopia, protanopia) — não testei. Combinação
  positive-soft (verde) + attention-soft (amarelo) nos dots de gap pode ser
  problemática.
- Focus indicator contrast (2px outline `var(--text)` sobre fundos
  variados) — visualmente está bom mas não foi medido em todos os contextos.
- Animações lendo SR — `aria-live` regions interagem com tempo de
  renderização, precisa screen reader real.

---

## Padrões positivos que devem ser preservados

- `:focus-visible` global em `button, a, input, textarea` com outline visível
  (`globals.css:153-156`). Ótimo padrão moderno.
- `@media (prefers-reduced-motion: reduce)` aplicado em `*` (linha 149).
- `aria-current="page"` no nav ativo do AppShell (linhas 186 e 266).
- `role="progressbar"` + `aria-valuemin/max/now/label` em
  `transparencia/page.js:218-223`. Replicar esse padrão nos rings de score.
- `aria-hidden="true"` em SVGs decorativos do AppShell (BrandMark, NavIcon,
  avatar, LGPD shield).
- `<aside aria-label="Navegação principal">` no AppShell linha 142.
- `<aside aria-label="Por que criar conta">` em `/entrar` linha 173.
- Schemas Zod `.strict()` em server actions de `/conta` (anti
  mass-assignment) — não é a11y mas é segurança limpa.
- Páginas têm `metadata.title` definido (encontrável por SR via H1+title).
- HTML `lang="pt-BR"` assumindo que está no `app/layout.js` (não revisado
  aqui — confirmar).
- Form de digest tem label envolvente correto pra screen readers básicos
  (mesmo sem `htmlFor`).
- `mark` element com contraste OK (`--accent` background).

---

## Recomendação de fix priorizado

Ordem sugerida (esforço × impacto):

**Sprint 1 (1-2h, impacto alto, esforço baixo):**

1. Trocar `--text-faint` light pra `#6E6A7A` em `globals.css:74`. Find/replace
   global. Resolve ~30 violações de contraste em 1 commit.
2. Adicionar `<main>` em 5 telas (`force-dynamic` exports não mudam).
3. Adicionar skip link no `AppShell.js`.
4. `aria-hidden="true"` em SVGs decorativos (busca por `<svg` sem `aria-`
   próximo + filtro manual).

**Sprint 2 (2-3h, impacto médio):**

5. Refatorar `FilterSelect`/`FilterNumber` no RadarClient: usar `<label>` ao
   invés de `<button>` wrappando `<select>`.
6. Adicionar `aria-live="polite"` no wrapper de vagas do Radar +
   `role="alert"` no error.
7. Adicionar `role="img" aria-label` nos SVG rings de score (Dashboard +
   JobCard).

**Sprint 3 (esforço médio, impacto incremental):**

8. Verificar dark theme contrast e ajustar `--text-faint` dark.
9. Trocar `<div>` que age como heading por `<h3>` em PrincipleCard,
   SubScoresTitle, ActionsTitle.
10. Validar com axe-core em CI (não está no escopo, mas marca pra próxima
    iteração).
11. Testar manualmente com VoiceOver / NVDA / TalkBack.

**Backlog (nice-to-have):**

- Color-blind testing (Sim Daltonism, Stark figma plugin).
- Adicionar `<fieldset><legend>Filtros</legend>` no Radar.
- Avatar `<img alt="Avatar de {nome}">` em vez de `alt="Avatar"` em
  `/conta:204`.
- Documentar a11y standards em CONTRIBUTING.

---

## Observações finais

- O código tem boa intenção de a11y (focus-visible global,
  prefers-reduced-motion, aria-current, role=progressbar pontual). O que
  falta é **consistência** — alguns componentes seguem o padrão, outros
  não.
- O maior ganho rápido é a troca de `--text-faint` light: 1 linha de CSS,
  resolve ~30 violações.
- Auditoria não substitui teste com user real. Recomendado teste com 1
  usuário de SR (NVDA/JAWS) pra validar antes de release.
