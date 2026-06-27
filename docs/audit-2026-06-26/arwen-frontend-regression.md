# Frontend Regression Audit — Arwen — 2026-06-26

> Wave 11 / Auditoria Defensiva pós Wave 10A. RESEARCH-ONLY.
> Branch `redesign/claude-design`. Foco: o que QUEBROU nas 4 mudanças da Wave 10A
> (Galadriel, Faramir, Gwaihir, Éowyn).
>
> Commits investigados:
> - 4b20db0 Galadriel — tokens AA + --on-primary + H1 sistema unificado
> - 60f8096 Faramir — 9 bugs JSX/CSS
> - e773e6b Gwaihir — SrcChip restaurado em MicroactionCard + RadarClient
> - 6926723 Éowyn — /candidaturas movido pra (app), links /meu-gemeo

---

## Executive Summary

- **A Wave 10A criou um regression P0 em noir tema:** `.btn-primary` foi corrigido,
  mas DEZENAS de outros componentes (FAB do copilot, bolhas do chat, send btn,
  CTA bars em /transparencia/Report, dashboard tile, etc) seguem com
  `background: var(--primary); color: white;` hardcoded — em noir, `--primary`
  é `#FAFAFA` (branco), resultado: **FAB invisível, bolhas brancas com texto
  branco, ações primárias do Report sumidas.** Galadriel resolveu o sintoma
  mais visível (botão) mas deixou o vetor causal espalhado.
- **H1 system unificado funciona para títulos curtos mas QUEBRA o flex do
  `.ct-page-header` quando o título tem >25 chars** em viewport médio — o
  H1 de 80px desktop empurra o icon-ball (44px) + target-pill pra layouts
  estranhos em /transparencia, /admin (480px container), /carreira, /gaps.
- **Mobile: theme-toggle e Copilot FAB colidem no mesmo canto.**
  `.theme-toggle` mobile = bottom:20px right:20px z:100; `.ct-copilot-fab`
  mobile = bottom:18px right:18px z:90. Toggle (44px) cobre o FAB (48px)
  — efetivamente esconde o copilot widget no celular.
- **/candidaturas dentro do AppShell: nav duplicada visualmente** — sidebar
  com brand+logo + topbar-inner com brand+logo + botão "Voltar dashboard"
  redundante (já temos sidebar). Éowyn flaggou no commit.
- **SrcChip introduzido com `whiteSpace: "nowrap"` e `marginLeft: 8px`**
  inline — provoca line-break com gap visível quando `porque` termina
  perto do limite do card. Tooltip via `title=` não funciona em mobile.

**Veredito antecipado:** Wave 10A foi **PARCIALMENTE positivo**. Resolveu
3 P0 (skip-link, btn-primary, modal-z, BrandMark) mas introduziu 1 P0 novo
(theme-toggle vs FAB mobile) e deixou um campo minado de `color: white` /
`color: #fff` espalhado pelo CSS que ainda quebra em noir.

---

## Findings novos (introduzidos ou tornados visíveis pela Wave 10A)

### P0 — Quebrou em produção

**P0-1. Theme-toggle mobile sobrepõe Copilot FAB (regressão direta do Faramir Bug 7)**
- Evidência: `app/globals.css:556-560` (theme-toggle desktop top:20 right:20 z:100);
  `app/globals.css:5993-5998` (mobile override: top:auto **bottom:20px**);
  `app/globals.css:5322-5323` (copilot FAB bottom:24 right:24 z:90);
  `app/globals.css:5348` (FAB mobile override: **bottom:18px right:18px**).
- Sintoma: em mobile (<=720px), ambos vivem no canto inferior-direito com 0px
  de gap entre eles. Theme-toggle (44x44) tem `z-index: 100`, FAB (48x48) tem
  `z-index: 90`. Toggle PINTA POR CIMA do FAB.
- Causa: Faramir Bug 7 (`60f8096`) moveu o theme-toggle pra bottom:20px sem
  acomodar o FAB que já estava lá. Comentário do código diz "fica acima do
  copilot widget mas longe do header" — mas "longe" é literalmente 0 pixels.
- Impacto: usuário mobile **não consegue acessar o Copilot Widget** (feature
  central do app pós-Sprint 1). Aperta no canto → abre theme switcher.
- Fix sugerido: theme-toggle mobile → `bottom: 92px` (acima do FAB);
  ou theme-toggle vai pra `bottom: 20px LEFT: 20px`; ou colapsa em menu.

**P0-2. ~25+ usos de `color: white` ou `color: #fff` sobre `background: var(--primary)` ainda invisíveis em noir (Galadriel fix incompleto)**
- Evidência (apenas amostra):
  - `app/globals.css:5235` `.ct-report-cta-primary { background: var(--primary); color: white }`
  - `app/globals.css:5304` `.ct-report-footer-cta { background: var(--primary); color: white }`
  - `app/globals.css:5325` `.ct-copilot-fab { background: var(--primary); color: white }`
  - `app/globals.css:5424` `.ct-copilot-msg.user .ct-copilot-msg-bubble { background: var(--primary); color: white }`
  - `app/globals.css:5462` `.ct-copilot-send { background: var(--primary); color: white }`
- Sintoma: em noir, `--primary: #FAFAFA` (branco). White text on white bg = **invisível**.
- Causa: commit `4b20db0` corrigiu `.btn-primary` (linha 749) e `.ct-onb-brand`
  (linha 3506) mas deixou todas as outras ocorrências sem tokenizar. O comment
  da própria Galadriel diz "corrige ~25 botoes invisiveis em noir" mas só
  fixou 2.
- Impacto: **FAB do Copilot fica BRANCO INVISÍVEL em noir** (background
  branco com SVG branco). Bolha de mensagem do user no chat invisível. Botão
  send do chat invisível. CTAs primárias do Report (link de retorno, etc.)
  invisíveis. Fix simbólico em btn-primary deixa a impressão de "consertado",
  mas o app inteiro em noir tem buracos pretos onde deveriam ter botões.
- Fix sugerido: substituir todas as ocorrências `color: white` / `color: #fff`
  quando o background é `var(--primary)` por `color: var(--on-primary, #fff)`.
  Total: `grep -c "color: #fff\\|color: white" globals.css` retorna 29.

**P0-3. `.ct-page-header-title` 80px overflow em containers estreitos (/admin login)**
- Evidência: `app/admin/page.js:89` `<main className="app-container" style={{ maxWidth: 480, margin: "60px auto" }}>` envolve um `.ct-page-header` com flex de
  icon (44px) + content com H1 agora 6vw clamp(40-80px). Em desktop 1440px,
  6vw = 86.4 → capped em 80px. H1 de 80px dentro de container de 480px com
  icon de 44px ao lado = **wrap forçado ou overflow horizontal**.
- Causa: Galadriel (`4b20db0` linha 6232-6240) trocou H1 de 26px fixo para
  clamp(40-80px) sem considerar containers com max-width pequeno.
- Impacto: tela de senha do /admin renderiza H1 quebrado em 2-3 linhas, ou
  sai do container e gera scroll horizontal.
- Fix sugerido: `.ct-page-header-title` ganhar `container-type: inline-size`
  + `font-size: clamp(28px, 8cqi, 80px)` — ou container override para
  `/admin login` específico.

**P0-4. /candidaturas dentro do AppShell renderiza topbar-inner próprio (duplica nav)**
- Evidência: `app/(app)/candidaturas/page.js:29-50` mantém `<header className="topbar-inner">` com `<div className="brand">` (mini logo CareerTwin) + botão
  "Voltar ao dashboard".
- Causa: Éowyn (`6926723`) movou o arquivo mas não removeu o topbar interno.
  Commit registra: "candidaturas/page.js ainda tem topbar-inner proprio dentro
  do AppShell (nav duplicada visualmente). Polish em proxima onda".
- Impacto: usuário desktop vê 2× brand "CareerTwin" lado a lado (sidebar +
  topbar-inner) + botão "Voltar dashboard" redundante (sidebar já tem link
  Dashboard). Em mobile, 2x mobile header (AppShell + topbar-inner).
- Fix sugerido: remover `<header className="topbar-inner">` inteiro do
  candidaturas/page.js (já flagado pelo Éowyn).

### P1 — Visualmente errado mas funciona

**P1-1. `.ct-page-header` flex com H1 80px desbalanceia layout em todas as 8 páginas**
- Evidência: `app/(app)/oportunidades/page.js:99-105` (.ct-page-header flex
  com icon 44px + H1 + target-pill à direita); `app/(app)/transparencia/page.js:51-82`
  (icon + H1 "Como funciona o Career Health Score" 38 chars); `app/(app)/funil/page.js:63-87`;
  `app/(app)/concursos/page.js`; `app/(app)/estagios/page.js`; `app/(app)/gaps/page.js`;
  `app/(app)/cvs-adaptados/[id]/page.js`; `app/admin/page.js:90-101`.
- Sintoma: H1 que era 26px Spectral fixo virou clamp(40-80px) Plus Jakarta.
  Em viewport 1280-1920px, H1 ocupa 76-80px de altura. Icon-ball (44px) fica
  flutuando à esquerda; target-pill (32-40px) à direita parece "perdido".
  Eyebrow + H1 + sub ficam com proporção desbalanceada vs o icon.
- Impacto: page-header que era um "cinto" sólido visual (24px padding +
  layout compacto) agora vira um "hero" gigante chupando 200-300px de altura.
  /transparencia e /carreira ficam aceitáveis (são páginas tese);
  /oportunidades, /funil, /concursos, /estagios ficam over-the-top — H1
  "Concursos públicos abertos" de 80px parece um landing page.
- Fix sugerido: 2 variantes de `.ct-page-header-title` — uma "page" (clamp
  40-80px, para landing/tese) e uma "tool" (clamp 28-42px, para listagens
  como /oportunidades, /funil). Ou ancorar pelo container do `.ct-page-header`.

**P1-2. Title "Onde sua busca esta parando?" em /funil sem acento (apenas regressão de UX)**
- Evidência: `app/(app)/funil/page.js:80-82`.
- Sintoma: o título tem "esta" em vez de "está". H1 agora 80px chama atenção
  para o erro de acentuação.
- Causa: pré-existente, mas a Wave 10A amplificou a visibilidade (era 26px,
  agora 80px).
- Impacto: percepção de qualidade. Acento ausente em H1 hero é visto.
- Fix sugerido: corrigir o título em `funil/page.js:81` para "Onde sua busca
  está parando?".

**P1-3. `.appshell-avatar` `color: #fff` hardcoded — initial branco em noir**
- Evidência: `app/globals.css:1954` `.appshell-avatar { color: #fff; ... }`.
- Sintoma: avatar é gradiente `linear-gradient(140deg, var(--avatar-from), var(--avatar-to))`.
  Em noir: `--avatar-from: #2A2A2A` (preto), `--avatar-to: #E5E5E5` (light gray).
  Initial "S" pintada em #fff puro: na metade `#2A2A2A` fica visível (~4.7:1),
  na metade `#E5E5E5` fica praticamente invisível (~1.2:1).
- Causa: Faramir só tocou em `BrandMark` SVG, deixou avatar legado.
- Impacto: na sidebar, no mobile header e no `appshell-user-link` (atalho
  pra /conta) a inicial do user fica difícil de ler em noir.
- Fix sugerido: `.appshell-avatar { color: var(--on-primary, #fff); }` ou
  cor sólida que funcione (`var(--text-strong)` sobre superfície clara).

**P1-4. Carreira page tem H1 inline `style={{fontSize: "clamp(40px, 6vw, 80px)"...}}` agora redundante (override do override)**
- Evidência: `app/(app)/carreira/page.js:70-81` H1 com `className="ct-page-header-title"` + `style={{ fontSize: "clamp(40px, 6vw, 80px)", fontWeight: 700,
  letterSpacing: "-0.03em", lineHeight: 1.05, ... }}`. Idêntico ao CSS de
  Galadriel.
- Sintoma: estilos inline duplicam o CSS que agora é o sistema. Comentário do
  carreira diz: "Style inline pra garantir vibe premium independente do
  .ct-page-header-title atual (Galadriel polishing em paralelo)."
- Impacto: limpeza pendente — Galadriel já alinhou, inline é dead code,
  mas continua funcionando.
- Fix sugerido: remover style inline em `carreira/page.js:73-78` agora que
  o CSS sistema bate. Mesmo em `:60-66` (eyebrow) e `:83-89` (sub).

**P1-5. Achievement toast `z-index: 9500` acima do Modal `9100` — design intencional ou bug?**
- Evidência: `app/globals.css:2728` `.ct-achievement-toast { z-index: 9500 }`
  vs Modal 9100.
- Cenário: usuário completa microação → AchievementToast aparece → enquanto
  ainda visível, abre WelcomeModal / Tailor / Interview / Chat → toast fica
  por cima do modal.
- Impacto: confuso visualmente. Toast era pra ser non-blocking; modal é
  blocker. Modal por cima do toast seria a expectativa.
- Causa: Faramir subiu modal de 100→9100 mas não rebalanceou toast.
- Fix sugerido: trocar toast para 8500 (acima da maioria mas abaixo de
  modal); OU dismissir toast automaticamente quando modal abre.

**P1-6. `.appshell-mobile-header` z-index 5 — abaixo do `.theme-toggle` mobile z-index 100 (toggle pode cobrir badge da bell)**
- Evidência: `app/globals.css:2009` `.appshell-mobile-header { z-index: 5 }`;
  `app/globals.css:556-560` `.theme-toggle { z-index: 100 }`.
- Cenário pré-Wave-10A: theme-toggle estava em `top:20 right:20` (cobrindo
  topo do mobile header onde fica avatar+bell). Faramir resolveu movendo pro
  `bottom:20`. Z-index 100 do toggle continua, agora só relevante vs FAB
  (P0-1 acima).
- Impacto: pré-existente, mas exposto pelo Faramir bug 7.
- Fix sugerido: parte do fix de P0-1.

### P2 — Polish que regrediu

**P2-1. SrcChip: `whiteSpace: "nowrap"` + `marginLeft: 8` causa overflow do parágrafo em mobile**
- Evidência: `components/SrcChip.js:30-45` style inline.
- Cenário: `porque` longo termina perto do limite do card. `<span class="src-chip">` com `nowrap` + `display: inline-flex` força reflow para próxima linha. Em viewport estreito (320-380px), o chip pode vazar do card.
- Impacto: layout shift no card de microação / vaga.
- Fix sugerido: testar em viewport 320px. Adicionar `max-width: 100%` ao chip
  ou mudar para `display: inline-block` com fallback wrap.

**P2-2. SrcChip tooltip via `title=` invisível em mobile**
- Evidência: `components/SrcChip.js:28` `title={title || \`Fonte: ${label}\`}`.
- Sintoma: mobile não tem hover. Label "[Curriculo]"/"[Mercado]" é o texto
  visível; tooltip "Fonte: Curriculo" só aparece em desktop.
- Impacto: redundância em desktop, ausência em mobile. Aceitável (label já
  é informativo) mas chip perde affordance "tem mais info aqui".
- Fix sugerido: nenhum (low priority). Em V2, considerar popover on tap.

**P2-3. Skip link nova cor (`var(--text)` bg / `var(--bg)` color) sem teste visual em focus state**
- Evidência: `app/globals.css:2568-2585`.
- Cenário: skip link aparece em `:focus` no canto sup. esquerdo. Em light:
  text=#1A1B2E (preto), bg=#F4F6FA (cinza claro) → fundo preto, texto cinza.
  Em dark: text=#F0F2F6, bg=#0D1117 → fundo branco, texto preto.
- Impacto: design correto e legível, mas é uma mudança visual brusca (era
  indigo+branco antes). Pode parecer "estranho" em testes manuais.
- Fix sugerido: nenhum (intencional Galadriel).

**P2-4. `.ct-onb-brand` color `var(--on-primary)` em noir = #000 sobre gradient que vai de #FFF até #1F1F4F**
- Evidência: `app/globals.css:3501-3506`.
- Cenário: gradient noir vai de `--primary-light` (#FFFFFF) até `#1F1F4F`
  (hardcoded indigo escuro no final do linear-gradient). Texto agora é #000
  (var --on-primary noir). Na metade #FFFFFF/#FAFAFA: bem legível (~21:1).
  Na metade #1F1F4F: contraste 1.7:1 — **FAIL grave**.
- Impacto: parte do texto no onboarding (lado esquerdo do /entrar) fica
  ilegível em noir contra a base escura do gradient.
- Fix sugerido: gradient noir não deve ter `#1F1F4F` no final — usar
  `var(--primary-deep)` (#E5E5E5 em noir) consistente.

**P2-5. `.ct-page-header-icon` 44px ao lado de H1 80px parece "miniatura"**
- Evidência: `app/globals.css:6217-6222` icon 44x44 vs `.ct-page-header-title` clamp(40-80px).
- Sintoma: o ícone que antes equilibrava o H1 (26px vs 44px = icon dominava)
  agora é dominado (80px H1 vs 44px icon = icon parece pequeno).
- Impacto: hierarquia visual invertida vs design original. Estética
  prejudicada.
- Fix sugerido: aumentar icon para `clamp(44px, 4vw, 64px)` para acompanhar
  o H1; ou esconder icon em viewports grandes.

### P3 — Hipóteses não confirmadas (PRECISA TESTE MANUAL)

**P3-1. ChatModal com SrcChip nas mensagens do chat?**
- Não verificado: o LLM gera `[Curriculo]/[Mercado]/[RAG]` em respostas do
  Copilot? Se sim, SrcChip precisaria ser aplicado lá também. Por ora,
  apenas MicroactionCard e RadarClient têm SrcChip.

**P3-2. Mobile dropdown / tooltip interaction com noir + new --text-faint**
- Não verificado: dark `--text-faint` agora #8A8FA0 é quase idêntico a
  `--text-muted` #8A8FA1. Hierarquia muted > faint colapsou em dark. 40
  ocorrências de `var(--text-faint)` no globals.css podem virar
  indistinguíveis de `var(--text-muted)`.

**P3-3. Reduced motion + theme-toggle**
- Não verificado: em `prefers-reduced-motion`, o theme-toggle mobile fica
  visível ainda no canto bottom-right? Animação desligada não muda
  position.

**P3-4. `.ct-tailor-modal-bg` z-index 9000 abaixo do notif drawer 9001**
- Pré-existente (não introduzido por Wave 10A). Cenário: notif drawer aberto
  + clica em "Adaptar CV" no toast/notif → TailorModal abre por BAIXO do
  drawer. Não confirmei se KanbanClient/Notification fluxo permite isso.

---

## Auditoria por eixo

### 1. H1 system unification — IMPACTO ALTO

8 páginas usam `.ct-page-header-title`:
- `app/(app)/oportunidades/page.js:101` "Radar de vagas" (13 chars)
- `app/(app)/transparencia/page.js:70-72` "Como funciona o Career Health Score" (38 chars)
- `app/(app)/funil/page.js:80-82` "Onde sua busca esta parando?" (28 chars, sem acento)
- `app/(app)/concursos/page.js` "Concursos públicos abertos" (26 chars)
- `app/(app)/estagios/page.js` "Estagios abertos" (16 chars)
- `app/(app)/gaps/page.js` "Análise de lacunas" (18 chars)
- `app/(app)/cvs-adaptados/[id]/page.js` "Comparação antes / depois" (25 chars)
- `app/admin/page.js:99,278` "Senha necessária" + "Quem testou e o que fizeram"
- `app/privacidade/page.js:51` "Seus dados, suas regras" (23 chars)

**Findings:**
- /admin (P0-3) — container 480px x H1 80px = layout break
- /transparencia, /funil, /oportunidades — H1 desproporcional ao corpo (P1-1)
- /carreira (P1-4) — inline style duplicando CSS sistema

Layout do `.ct-page-header` flex foi calibrado para H1 26px. Aumentar pra
80px sem ajustar icon (44px) e padding gera desbalanceamento sistêmico.

### 2. --on-primary aplicado — INCOMPLETO

Tokenizado em:
- `.btn-primary` (749, 767)
- `.ct-onb-brand` (3506)

Hardcoded `color: white` ou `color: #fff` sobre `background: var(--primary)`
em pelo menos:
- `.ct-report-cta-primary` (5235)
- `.ct-report-footer-cta` (5304)
- `.ct-copilot-fab` (5325) — **P0**
- `.ct-copilot-msg.user .ct-copilot-msg-bubble` (5424) — **P0**
- `.ct-copilot-send` (5462) — **P0**
- `.ct-onb-step-item.active .ct-onb-step-n` (3680)
- 22 outros lugares com `color: #fff` que precisam de auditoria caso-a-caso

Galadriel resolveu o componente mais auditado, mas o vetor causal está
espalhado. Em noir o app tem buracos brancos.

### 3. Modal z-index hierarchy

Hierarquia atual (após Wave 10A):
- `.theme-toggle`: 100 (problema, ver eixo 4)
- `.ct-copilot-fab`: 90, `.ct-copilot-panel`: 89
- `.modal-overlay` (Modal core): **9100** (Wave 10A)
- `.appshell-notif-drawer-bg`: 9000
- `.appshell-notif-drawer`: 9001
- `.ct-tailor-modal-bg`: 9000 (legado — fica atrás do notif drawer)
- `.ct-achievement-toast`: 9500
- `.ct-skip-link`: 9999

Análise:
- Modal acima de notif drawer: ✓ correto (Wave 10A fix)
- Tailor modal: ✗ ainda em 9000 (mesmo problema do Modal pré-fix)
- Achievement toast acima de Modal: ⚠ debatível (P1-5)

### 4. Theme toggle mobile — **P0-1**

`bottom: 20px right: 20px` mobile colide com FAB do Copilot (mesmo canto).
Toggle z-index 100 > FAB z-index 90 → toggle bloqueia FAB.

Faramir comentou: "fica acima do copilot widget mas longe do header" — mas
literalmente NÃO está longe do FAB. Falta de coordenação com Sprint 1.

### 5. /candidaturas reroute

Imports: relativos OK (`./KanbanClient` ainda funciona dentro do route group).
Path: URL `/candidaturas` preservada (route group `(app)` não afeta URL).
Auth: `(app)/layout.js` faz gating — OK.
AppShell wrap: agora aplica → P0-4 (topbar-inner duplica nav).
PROTECTED_PREFIXES: já contém `/candidaturas`, sem mudança.

Links legacy:
- `/meu-gemeo` mantido em 5 lugares intencionalmente (entrar, landing, etc).
- `/meu-gemeo` redireciona pra `/dashboard` que requer auth.
- experimentar (anônimo) → `/candidaturas` → será bloqueado por auth.
  Pre-existente, não Wave 10A.

KanbanClient: continua igual (linha 141 já tem link `/oportunidades` Radar
"Ver vagas no Radar →" via btn-primary).

### 6. SrcChip — RECUPERADO BEM, COM PEQUENOS POLISH

- Componente sólido: pure functional, sem useEffect, sem state.
- React escapa label (XSS safe).
- Tokens semânticos (--text-muted, --surface-2, --border, --radius-sm).
- Edge cases tratados (src vazio → null, replace de colchetes seguro).

Concerns:
- `whiteSpace: "nowrap"` + `marginLeft: 8` (P2-1) — overflow mobile potencial.
- Tooltip `title=` invisível em touch (P2-2).
- Cor `--text-muted` sobre `--surface-2`:
  - Light: #5A5F6D / #F8FAFC = 5.7:1 ✓
  - Dark: #8A8FA1 / #1F2530 = 5.8:1 ✓ (mas idêntico ao muted)
  - Noir: rgba(250,250,250,0.65) / #121212 ≈ 5.4:1 ✓

Integração:
- `MicroactionCard.js:71-78` match/regex para extrair fonte: regex correta,
  mas se `gap.porque` tem caractere especial, regex falha silencioso e
  chip não renderiza. Aceitável (chip é nice-to-have).
- `RadarClient.js:370-384` IIFE pra inline a lógica — funciona, mas poderia
  ser extraído pra função helper.

### 7. Console errors potenciais

- AppShell.js useEffect com deps `[]` na linha 156 — listener de media query,
  setMounted no mount. Deps vazias OK aqui (não há closure stale).
- Nenhum novo useEffect introduzido em Wave 10A componentes.
- Não há `<Image>` sem alt nas mudanças (SrcChip SVG tem aria-hidden).
- `<img>` em AppShell:251 `<img className="appshell-avatar" src={user.image} alt="" ... aria-hidden="true">` — alt vazio decorativo é OK porque o nome do user vem do texto adjacente.

Imports não usados após Wave 10A:
- `app/(app)/candidaturas/page.js` `import Link from "next/link"` — usado.
- Sem imports órfãos visíveis.

Tokens não existentes em inline style:
- Não vi `var(--token-inexistente)` nas mudanças.
- SrcChip usa fallbacks (`var(--text-muted, var(--text-soft))`) que defendem
  contra ausência.

---

## Itens da Wave 9 que CONTINUAM em aberto (não cobertos pela 10A)

Da minha audit anterior (`arwen-polish-2026-06-25.md`):

- **P0-A. Modal core (Modal.js) glassmorphism** — NÃO resolvido. Modal segue
  com `border: 1px solid var(--text)` (preto/branco puro), `blur(3px)`,
  border-radius `--radius-sm` (6px). Faramir só subiu z-index, não tocou
  no visual.
- **P0-B. modal-x / 4 close buttons sem hover lift / active feedback** — não tocado.
- **P0-C. Hover lift inconsistente** — não tocado.
- **P0-D. Chip system 2 filosofias** — não tocado.
- **P1-A. Loading spinner inline em botões** — não tocado.
- **P1-B. Focus state unificado em inputs** — não tocado.
- **P1-C. Backdrop blur fraco no modal** — não tocado.
- **P1-D. Notif drawer sem blur** — não tocado.
- **P2-A. Reveals no /app/ entram secos** — não tocado.
- **P2-B. Microação done sem confetti** — não tocado.
- **P2-F. ThemeToggle sem animação de troca** — não tocado.
- **P3-A. Border-radius hard-coded** — não tocado.
- **P3-G. WelcomeModal cards inline-style** — não tocado.
- **P3-H. Drawer notification item "novo" redundante** — não tocado.

Wave 10A focou em foundation (tokens AA, on-primary, H1 system) e bug
fixes específicos. Polish granular do Wave 9 ficou para Wave 11+.

---

## Roteiro de teste manual (founder confirma)

Priorizado por probabilidade de break:

- [ ] **Mobile DOM real**: abrir /dashboard em viewport 375px, conferir
  visualmente se theme-toggle e Copilot FAB estão um SOBRE o outro no canto
  bottom-right. Apertar no canto: o que abre? (P0-1)
- [ ] **Noir + Copilot**: trocar tema pra noir, abrir Copilot Widget.
  - FAB visível? (P0-2)
  - Bolhas de mensagem do USER visíveis? (deveria ter fundo branco com texto branco)
  - Botão send (seta) visível? (P0-2)
- [ ] **Noir + /transparencia ou /privacidade**: rolar até CTAs primárias
  (.ct-report-cta-primary). Texto visível? (P0-2)
- [ ] **Desktop 1440p + /admin login** sem estar logado: H1 "Senha necessária"
  quebra layout? Overflow horizontal? (P0-3)
- [ ] **Desktop + /candidaturas**: ver se aparecem 2x logo CareerTwin
  (sidebar + topbar-inner)? Botão "Voltar dashboard" redundante? (P0-4)
- [ ] **Desktop + /oportunidades**: H1 "Radar de vagas" 80px com icon 44px
  + target-pill — layout balanceado ou icon parece miniatura? (P1-1, P2-5)
- [ ] **/funil** título "Onde sua busca esta parando?" — falta acento (P1-2)
- [ ] **Noir + sidebar avatar com inicial**: cor da inicial legível no
  gradient? (P1-3)
- [ ] **Mobile + microação card** com porque longo: SrcChip rendera dentro
  do card ou vaza? (P2-1)
- [ ] **Achievement toast + Modal**: completar microação, abrir TailorModal
  durante o toast. Toast por cima do modal? (P1-5)
- [ ] **Light + dark + noir tab**: cada title de page header tem proporção
  esperada vs corpo do card?
- [ ] **Onboarding /entrar em noir**: lado esquerdo (gradient brand) tem
  texto preto legível? Em qual ponto do gradient fica ilegível? (P2-4)

---

## Veredito

**Wave 10A foi PARCIALMENTE positivo.**

**Positivo (líquido):**
- Foundation de tokens AA: 3 contrastes corrigidos (--text-muted light,
  --text-faint light, --text-faint dark) — 60+ pontos de UI ganharam AA.
- Modal z-index hierarquia limpa: 9100 acima dos drawers, hierarquia
  semântica documentada.
- BrandMark e ct-onb-brand tokenizados pra noir (estética premium correta).
- SrcChip restaurado: moat #1 do produto (fonte rastreável) volta a ser
  visível em microactions e radar.
- /candidaturas no AppShell: consistência de jornada do usuário logado.
- Skip-link agora funciona em noir.

**Negativo (introduzido ou exposto):**
- **P0-1** (criado): theme-toggle mobile bloqueia Copilot FAB — features
  centrais do app inacessíveis em mobile.
- **P0-2** (não-cobertura): `color: white`/`#fff` sobre `var(--primary)`
  espalhado em 25+ regras — noir ainda tem zonas brancas invisíveis. O fix
  do `btn-primary` é teatro de segurança visual.
- **P0-3** (exposto): /admin login com container 480px quebra com H1 80px.
- **P0-4** (deixado em aberto): /candidaturas com topbar-inner duplica nav
  com AppShell.
- P1-1: H1 system unificado quebra balanço visual em 4 páginas com listagem.

**Recomendação:** Wave 11 deve consolidar **antes** de seguir adiante:
1. Tokenizar TODAS as 25+ ocorrências `color: white|#fff` sobre `var(--primary)` (≤30min, alto ROI).
2. Resolver theme-toggle mobile vs FAB (≤15min, blocker mobile).
3. Adicionar variant `.ct-page-header-title.tool` ou ajustar `clamp` p/ não capar em 80px globalmente (≤30min).
4. Remover topbar-inner de /candidaturas (≤10min).

Total ~1h30 pra fechar o que Wave 10A abriu. Sem isso, o app em noir +
mobile tem mais sintomas de "MVP quebrado" do que tinha antes.

— Arwen, filha de Elrond. Wave 11 / Auditoria Defensiva. RESEARCH-ONLY.
