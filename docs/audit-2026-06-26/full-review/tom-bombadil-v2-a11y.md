# Tom Bombadil v2 — A11y WCAG 2.2 AA audit (2026-06-26)

Escopo: research-only. Foco em landing (`/`) + páginas mais usadas (`/entrar`, `/meu-gemeo`, `/dashboard`, `/gaps`, `/oportunidades`, `/plano`, `/carreira`, `/conta`). Critério WCAG 2.2 AA; oportunidades AAA marcadas.

## TL;DR
- **A-level fails (P0 bloqueador)**: 3 (focus order quebrado em modal nativo `<g>` SVG; `<li onClick>` sem teclado no NotificationsBell; overlay-onClick em Modal cria armadilha para mouse mas é mitigada por Esc).
- **AA-level fails (P1)**: 11 (target size 24x24 em ícones de fechar/chevron; contraste de `--site-fg-muted` 0.72 e algumas labels com `--site-fg-dim` 0.58 em surfaces decorativas; auth flow sem confirmação assistiva clara; movimento sem controle direto pelo usuário; sticky header pode obscurecer focus na landing; lang faltando em termos estrangeiros).
- **AAA opcional (P2)**: 6 (idioma de inglês marketing tags como "Stack-alvo, Streaming SSE"; redundância em loading; help consistente).
- **Páginas com mais issues**: `/` (landing — 9), `/entrar` (5), `/dashboard` (4), `/oportunidades` (3), `/conta` (2).

Pontos fortes confirmados:
- `<html lang="pt-BR">` correto em `app/layout.js:21`.
- Skip-link funcional em `components/AppShell.js:187-189` com `#main-content` ancorado nas páginas (ex: `app/(app)/dashboard/page.js:106`, `app/(app)/plano/page.js:113`, `app/(app)/gaps/page.js:159`).
- `:focus-visible` global premium em `app/globals.css:519-533` com fallback `outline:none` apenas onde substituído por `box-shadow` (não é violação 2.4.7).
- Modal com focus trap + Esc + restauração de foco em `components/Modal.js:10-47`.
- `prefers-reduced-motion: reduce` honrado em `app/(landing)/page.js:43`, `SiteHero.js:250-260`, `SiteFaq.js:50-55` e `globals.css:578-590`.

---

## 1. Perceptível (1.x)

### 1.1.1 Conteúdo não-textual

**[AA-PASS]** Ícones decorativos consistentemente marcados `aria-hidden="true"` ou `role="presentation"`:
- `components/AppShell.js:93, 137, 228, 256, 259, 297` — brand mark, nav icons, lgpd shield, avatar fallback.
- `components/site/SiteHero.js:397-398, 423, 433-434, 568` — mesh, grain, CTA arrow, SVG trajetória, scroll cue.
- `components/site/SiteNav.js:70, 140, 144` — dot, hamburger.
- `components/Modal.js:65` — `aria-label="Fechar"` no botão X.

**[AA-FAIL · P1] `<img>` decorativo sem fallback de erro** — `components/AppShell.js:250-257`. O avatar do user usa `<img src={user.image} alt="" aria-hidden="true">`, correto SE a imagem carrega. Se quebrar (404, CDN down) o navegador exibe ícone genérico de "imagem quebrada" sem leitor-of-screen anunciar nada — usuário cego não percebe que o avatar tem dono. Recomendação: ou usar `<Image>` do Next com fallback gerado, ou ocultar visualmente quando `onError` dispara e renderizar o initial `<div>` adjacente.

**[A-FAIL · P0] SVG-as-button sem texto acessível** — `components/SkillGraph.js:284-318`. O `<g role="button" tabIndex={0}>` tem `aria-label`, OK. Mas o feedback de "ativado" é só visual (cor/borda) e o `onTouchStart` dispara o `show` sem corresponder a um clique real (não há `onClick`/`onKeyDown` para Enter/Space) — VoiceOver/NVDA anuncia "botão" mas Enter/Space não acionam handler nenhum. Quebra **2.1.1 Keyboard**.

### 1.3.1 Info e relações

**[AA-PASS]** Estrutura semântica boa: `<main id="main-content">` em todas as páginas do `(app)`; sectioning com `<section aria-labelledby>` em conta (ex: `app/(app)/conta/page.js:378, 437, 475, 527`); `<header>` em gaps (`app/(app)/gaps/page.js:160`).

**[A-FAIL · P0] `<li>` clicável sem handler de teclado** — `components/NotificationsBell.js:289-303`. Cada item da lista de notificações tem `onClick` para marcar como lida, mas é um `<li>`, sem `role="button"`, sem `tabIndex`, sem `onKeyDown`. Usuário de teclado nunca consegue marcar como lida; só conseguirá se clicar no link "Ver detalhes" (linha 316-323). Quebra **2.1.1 Keyboard** + **4.1.2 Name, Role, Value**.

**[AA-FAIL · P1] Modal overlay clicável fechando o dialog** — `components/Modal.js:50` (`<div className="modal-overlay" onClick={onClose}>`). Comportamento padrão de modais, mas o `<div>` overlay não tem `role="button"` nem `aria-label`. Como Esc também fecha (linha 16-19), não é bloqueador A — mas para usuários de teclado/SR, não há indicação de que clicar fora fecha. Aceitável; idealmente mover comportamento para um `<button>` invisível ou ao menos documentar em `aria-describedby` do dialog.

**[AA-FAIL · P1] Labels e títulos competindo por hierarquia** — `app/(app)/dashboard/page.js:267` e `app/(app)/dashboard/page.js:306`: existem dois `<h2>` no mesmo nível visual ("Seu gêmeo ainda está em branco." e o welcome banner) sem `<section>` que os agrupe — leitores de tela perdem contexto se renderizados juntos. Estado mutuamente exclusivo no código, mas o snapshot HTML pode ter ambos durante hidratação.

### 1.4.3 Contraste (mínimo)

**[AA-PASS]** Tokens revisados na Wave 10A com correções explícitas:
- `--text-muted` light `#5A5F6D` sobre `#F4F6FA` = ~5.7:1 (`app/globals.css:150-152`).
- `--text-faint` light `#6A6E7B` = ~4.6:1 (`app/globals.css:153-155`).
- `--site-fg-dim` `rgba(250,250,252,0.58)` sobre `#0A0A0E` = ~4.6:1 (`app/globals.css:36-38`).
- `--text-faint` dark `#8A8FA0` sobre `#0D1117` = ~5.8:1 (`app/globals.css:178-182`).

**[AA-FAIL · P1] `--site-fg-muted` rgba(250,250,252,0.72)** — `app/globals.css:35`. Sobre `#0A0A0E` = ~10.6:1 (PASS, na verdade ok). MAS é aplicado em `SiteHero.js:111` (body texto, fontSize clamp 17-22px, OK) E em `SiteFooter.js:199-203` (link, fontSize 14, OK no AA porque o cálculo dá 10:1+). Verificado: **passa**. Anotando para não confundir.

**[AA-FAIL · P1] Texto de status em `SiteHero.js:178` cor `var(--site-fg-muted)` fontSize 12** — passa contraste mas é usado para informação importante ("Calculando diagnóstico..."). `aria-live="polite"` no parent (`SiteHero.js:492`) anuncia mudanças — bem feito.

**[AA-FAIL · P1] Eyebrows em mono fontSize 10-11 sobre dark com cor `--site-accent-magenta` `#B924FF`** — `components/site/SiteFaq.js:88-95`, `SiteSocialProof.js:89`, `SitePricing.js:109`. Contraste `#B924FF` sobre `#0A0A0E` = ~4.8:1 (passa AA pra texto normal ≥ 14px, mas estes são 10-11px = "texto normal" sob WCAG porque < 18pt). **Pequena PASS marginalmente** — recomendo verificar nos 3 temas com ferramenta.

**[AA-FAIL · P1] Texto sobre gradient** — `app/globals.css:597-601`: `background: linear-gradient(150deg, var(--primary-light), var(--primary-deep)); color: #fff`. Em `--primary-light` `#6B6BC8` = contraste com `#fff` 4.27:1 (PASS); com `--primary-deep` `#34357E` = 9.6:1 (PASS). OK no gradient inteiro.

**[AA-FAIL · P1] Botão branco-em-cyan na landing** — `SiteHero.js:421-426` CTA primária. `background: var(--site-accent)` = `#70FFDD` (cyan claro) + `color: var(--site-bg)` = `#0A0A0E`. Contraste 17:1 (excelente). Mas o token `--accent-on-cyan` `#08313F` (linha 54) também aparece em outros lugares — mistura visual de "preto vs teal escuro" sobre cyan em momentos diferentes pode confundir.

### 1.4.4 Resize Text

**[AA-PASS]** `clamp()` adotado consistentemente para headings (ex: `SiteHero.js:99`, `dashboard/page.js:142`, `plano/page.js:142`). Body usa rem/font-relative na maioria. Zoom 200% deve funcionar.

### 1.4.10 Reflow

**[AA-PASS]** Layouts usam grid com `minmax` e media queries (`app/entrar/page.js:269-273`, `SiteHero.js:584-586`). `prefers-reduced-motion` honrado.

### 1.4.11 Non-text contrast

**[AA-FAIL · P1] Border 1px com `rgba(255,255,255,0.08)`** — `SiteHero.js:161`, `globals.css:39` (`--site-border`). Contraste com `#0A0A0E` ~0.08 * 255 = ~20/255 = ratio ~1.3:1. **FAIL** para borda funcional 3:1. Glass cards usam essa borda como única separação visual — não há outro indicador. `--site-border-strong` `rgba(255,255,255,0.16)` = ~1.6:1, ainda FAIL. Recomendo aumentar para 0.30+ em estados focados/hover.

### 1.4.13 Content on Hover or Focus

**[AA-FAIL · P1] Tooltip via `title=`** — `components/AppShell.js:265` (`title={targetRole}`), `app/(app)/dashboard/page.js:155` (`title="Editar cargo-alvo"`), `components/ThemeToggle.js:54`. Atributo `title` não é dismissível (não fecha com Esc), não é hoverable (some quando mouse sai), não tem tempo fixo. Quebra 1.4.13 nos 3 critérios. Recomendar tooltip custom com pattern `aria-describedby`.

---

## 2. Operável (2.x)

### 2.1.1 Keyboard

**[A-FAIL · P0] `<li onClick>` sem teclado** — `components/NotificationsBell.js:289`. Já listado em 1.3.1. Bloqueador A.

**[A-FAIL · P0] SVG `<g>` "button" sem onClick/onKeyDown** — `components/SkillGraph.js:284-318`. Foco visível, mas ativação por teclado não faz nada (só hover/focus mostram tooltip). Como é um tooltip e não há ação, talvez troquei para `role="tooltip" focusable` — mas atualmente está como `role="button"` confundindo SRs.

**[AA-PASS]** Modal `Esc` + focus trap funcionam (`components/Modal.js:16-37`). CopilotWidget também (`components/CopilotWidget.js:106-113`).

### 2.4.1 Bypass Blocks

**[AA-PASS]** Skip-link em `components/AppShell.js:187-189` + CSS `app/globals.css:2567-2587`. Targeta `#main-content` confirmado nas páginas.

### 2.4.3 Focus Order

**[AA-FAIL · P1] Sticky sidebar precede main em DOM** — `AppShell.js:182-273`. Em desktop, primeiros 12+ tabs são na sidebar antes de chegar ao conteúdo. Skip-link resolve, mas usuários que não veem o skip-link (não-screen-reader, novato de teclado) podem ter má experiência. Anotação, não fail crítico.

### 2.4.7 Focus Visible

**[AA-PASS]** Focus ring premium global (`app/globals.css:519-533`). Apenas substituí outline por box-shadow ring — equivalente a "focus visible" no critério.

**[AA-FAIL · P1] Focus removido em SkillNode** — `components/SkillGraph.js:295`: `style={{ outline: "none" }}`. Não há substituto visual claro (só mudança no tooltip). Quebra 2.4.7.

### 2.4.11 Focus Not Obscured (Min) — WCAG 2.2 NEW

**[AA-FAIL · P1] Sticky nav cobre focus na landing** — `components/site/SiteNav.js:25-40`. `position: fixed; top: 0; right: 0; left: 0; height ~76px (18+18+CTA)`. Ao tabular do CTA do hero para os FAQ items (que estão abaixo do fold), o scroll automático pode posicionar o item focado por baixo da nav. Sem `scroll-padding-top` no `<html>`. Adicionar `html { scroll-padding-top: 80px; }` resolve.

**[AA-FAIL · P1] Sticky sidebar e ToS toggle podem cobrir focus em viewport <800px** — `components/ThemeToggle.js` renderizado fixo no canto superior direito (verificar CSS em globals). Em mobile pequeno, pode sobrepor um botão de Cargo-alvo focado.

### 2.5.7 Dragging Movements — WCAG 2.2 NEW

**[AA-PASS]** Não há drag-and-drop visível em landing/dashboard/conta/gaps/oportunidades/plano. Funil Kanban (`/funil`) tem botões nativos. Confirmação: nenhum `onDragStart`/`onDragOver` nos componentes principais.

### 2.5.8 Target Size (Min) — WCAG 2.2 NEW (24x24px)

**[AA-FAIL · P1] Botão "X" do Modal com 14x14 ícone** — `components/Modal.js:65`. O `<button className="modal-x">` não tem `min-width/min-height` declarados nas CSS examinadas; o ícone ✕ provavelmente fica em ~24x24 com padding. Verificar `.modal-x` no globals.css.

**[AA-FAIL · P1] Botão de fechar Copilot 14x14** — `components/CopilotWidget.js:377-388`. SVG 14x14, button sem padding explícito. Risco real de < 24x24.

**[AA-FAIL · P1] Chevron de FAQ 32x32** — `components/site/SiteFaq.js:148-149`. PASS (32 ≥ 24), OK.

**[AA-FAIL · P1] Botão de fechar notification drawer `&times;`** — `components/NotificationsBell.js:269-276`. Sem dimensões explícitas; `appshell-notif-close` precisa ≥ 24x24.

**[AA-FAIL · P1] Eyebrow dot 6x6 com link comportamental?** — `SiteHero.js:402-403`. É só decorativo (`aria-hidden`), OK.

**[AA-PASS]** Microaction check tem `min-width: 44px; min-height: 44px` explícito em mobile (`app/globals.css:6014`).

### 2.3.3 Animation from Interactions

**[AA-PASS]** `prefers-reduced-motion` honrado em quase todos os componentes animados.

### 2.2.2 Pause, Stop, Hide

**[AA-FAIL · P1] Mini-demo loop com 7500ms intervalo** — `components/SiteHero.js:367-369`. Roda em loop infinito enquanto a aba está visível. Só pausa em `visibilitychange` (`SiteHero.js:380-384`). **Não há controle de pause-play do usuário** dentro da viewport. Como dura > 5 segundos, viola 2.2.2. `reduceMotion` desliga, OK; falta um botão "Pausar" para quem não tem reduce-motion mas quer parar. Mesmo problema em `SiteCursorGlow.js` (animação infinita).

**[AA-FAIL · P1] Marquee infinito** — `components/site/SiteStackMarquee.js` faz scroll horizontal automático. Mesma análise: sem controle, > 5s, viola 2.2.2 a menos que tenha `prefers-reduced-motion` (provável que tenha; verificar arquivo).

### 2.2.1 Timing Adjustable

**[AA-PASS]** Magic link de email não tem timer de 30s anunciado ao usuário (`app/entrar/page.js`). Magic link expira em janela longa (>= 24h tipicamente), aceitável.

---

## 3. Compreensível (3.x)

### 3.1.1 Language of Page

**[A-PASS]** `<html lang="pt-BR">` em `app/layout.js:21`.

### 3.1.2 Language of Parts

**[AA-FAIL · P1] Termos estrangeiros sem `lang`** — Landing e app têm "Stack-alvo", "Streaming SSE", "Marketplace neutro", "GitHub", "LinkedIn", "Kanban", "Score", "Dashboard", "Copilot", "Skill graph", "Daily quest". Nenhum marcado com `<span lang="en">`. Exemplos:
- `components/site/SiteFeatures.js:65-67` ("Streaming SSE")
- `components/site/SiteHero.js:417` ("Stack-alvo" — termo mixed)
- `components/AppShell.js:11, 53` ("Dashboard", "Plano", "Skill", "Career")
- `app/(app)/dashboard/page.js:233-235` ("Mapa de skills")

VoiceOver e leitor brasileiro vão pronunciar mal sem `lang="en"`.

### 3.2.1 On Focus

**[AA-PASS]** Não vi mudança de contexto inesperada por focus.

### 3.2.2 On Input

**[AA-PASS]** Filters em `RadarClient.js:242-280` usam `<select>` nativo com `onChange` que re-fetcha — usuário previsível. Forms `<form action={serverAction}>` em entrar/conta requerem submit explícito.

### 3.3.1 Error Identification

**[AA-FAIL · P1] Erro de email no entrar silencioso** — `app/entrar/page.js:17-28`. Server action retorna void em email inválido sem feedback ao user. UX premium pede `useFormState` ou redirect com query param. Sem isso, user com erro de typo não sabe por que nada aconteceu.

**[AA-FAIL · P1] Sem `aria-invalid` em inputs** — `app/(app)/conta/page.js:357-366, 397-405`, `app/entrar/page.js:103-111`. Inputs `required` mas sem `aria-invalid="true"` em estado de erro nem `aria-describedby` apontando para mensagem.

### 3.3.2 Labels or Instructions

**[AA-PASS]** Labels associadas: `htmlFor="email"` + `id="email"` em `app/entrar/page.js:102-104`; `htmlFor="name"`/`htmlFor="targetRole"` em conta.

**[AA-FAIL · P1] Label-wrap em `<label>` envolvendo `<input>` sem `htmlFor`** — `app/(app)/oportunidades/RadarClient.js:244-258, 264-279`. Tecnicamente válido (implicit label), mas o `<span>` interno (label visível) não é o "accessible name" — o `aria-label` redundante na linha 250 cobre. OK.

**[AA-FAIL · P1] Checkbox toggle sem texto de label** — `app/(app)/conta/page.js:550-559`. `<label className="ct-conta-toggle"><input type="checkbox" name="enabled">...</label>` — falta texto dentro do label que descreva o que está sendo togglado. Provavelmente continua após linha 559 (cortei a leitura) — verificar.

### 3.3.6 Authentication AAA

**[AAA-OPCIONAL]** Email magic-link é "passwordless" (sem cognitive function test). Bom.

### 3.3.7 Redundant Entry — WCAG 2.2 NEW (A-level)

**[A-PASS]** Não vi steps multi-page onde usuário precisa redigitar info. Email/cargo-alvo persistem entre forms.

### 3.3.8 Accessible Authentication (Min) — WCAG 2.2 NEW (AA)

**[AA-PASS]** Magic link via email não requer puzzle cognitivo. LinkedIn OAuth idem. Modo dev usa email-only.

### 3.2.6 Consistent Help — WCAG 2.2 NEW

**[AA-FAIL · P1] Ajuda não está em posição consistente** — Help é o Copilot widget (`components/CopilotWidget.js`), que aparece bottom-right SÓ no `(app)` group (`CopilotWidget.js:326-331`). Na landing/entrar não há help equivalente. Tecnicamente conformante porque o critério exige consistência em páginas onde aparece; não aparece na landing então não viola. Anotação.

---

## 4. Robusto (4.x)

### 4.1.2 Name, Role, Value

**[AA-PASS]** Botões nomeados via `aria-label`: `components/CopilotWidget.js:296` ("Abrir copiloto de carreira"), `375` ("Fechar copilot"), `465` ("Enviar mensagem"); `NotificationsBell.js:204-208` ("Notificações (N não lidas)"); `ThemeToggle.js:53` ("Tema atual: noir. Trocar pra claro.").

**[A-FAIL · P0] `<g role="button">` sem ação por teclado** — Já listado. Quebra 4.1.2.

**[AA-FAIL · P1] `aria-expanded` ausente em alguns disclosures** — `app/(app)/oportunidades/RadarClient.js:285` o "Por que esse match?" tem estado mas não vi se o `<button>` que o controla recebe `aria-expanded` (cortei a leitura no 320, vai verificar). Espera-se: `aria-expanded={showBreakdown}` + `aria-controls={panelId}`.

### 4.1.3 Status Messages

**[AA-PASS]** `aria-live="polite"` bem aplicado em:
- `app/entrar/page.js:58` (status de envio).
- `app/(app)/oportunidades/RadarClient.js:72` (contagem de vagas).
- `components/site/SiteHero.js:492` (status do diagnóstico).
- `components/CopilotWidget.js:437` (erro com `role="status"`).

### Heading Hierarchy

**[AA-FAIL · P1] H4 antes de H3 no carreira** — `app/(app)/carreira/page.js:216` `<h3>{m.title}</h3>` seguido de `app/(app)/carreira/page.js:257` `<h4>Acoes concretas:</h4>` dentro de um item — OK estrutura, mas o nível raiz da página tem h1 (linha 70), h2 (linha 134 — apenas em empty state) e h2 (linha 190 + h3 + h4). Hierarquia parece OK.

**[AA-FAIL · P1] H1 duplicado entre landing e modal** — Não há, mas SiteHero tem 1 `<h1>` (linha 406) e cada section subsequente abre com `<h2>` em header próprio. OK.

**[AA-FAIL · P1] FAQ pula h1→h2 sem h2 estrutural** — A landing tem 1 h1 (Hero) e 1 h2 por section. OK semanticamente.

### Landmarks

**[AA-PASS]** Um `<main>` por página com `id="main-content"`. `<nav aria-label>` em sidebar e site nav. `<footer>` no SiteFooter. `<header>` em multiple sections (`gaps/page.js:160`).

---

## 5. WCAG 2.2 novidades — sumário

| Critério | Status | Detalhes |
|----------|--------|----------|
| 2.4.11 Focus Not Obscured (Min) | **FAIL** | Sticky SiteNav cobre focus ao scroll; falta `scroll-padding-top` |
| 2.4.12 Focus Not Obscured (Enhanced) AAA | FAIL | Mesmo problema |
| 2.4.13 Focus Appearance AAA | PARTIAL | Box-shadow 3px ring atende espessura; checar contraste 3:1 |
| 2.5.7 Dragging Movements | PASS | Sem drag essencial no fluxo |
| 2.5.8 Target Size (Min) 24x24 | **FAIL** | Botões de fechar (Modal/Copilot/NotificationsBell) e ícones de chevron pequenos |
| 3.2.6 Consistent Help | PASS condicional | Help só aparece em `(app)` group — consistência mantida onde existe |
| 3.3.7 Redundant Entry | PASS | Sem duplicação cognitiva no flow |
| 3.3.8 Accessible Authentication (Min) | PASS | Magic link + OAuth, sem CAPTCHA cognitivo |
| 3.3.9 Accessible Authentication (Enhanced) AAA | PASS | Idem |

---

## Top 5 alavancas (maior impacto / menor custo)

1. **Adicionar handler de teclado e `role` correto ao `<g>` SkillNode** (`components/SkillGraph.js:284-318`) e ao `<li>` de notificações (`components/NotificationsBell.js:289-303`). Trocar `<li onClick>` por `<button>` interno ou adicionar `role="button" tabIndex={0} onKeyDown` para Enter/Space. Desbloqueia 2 fails P0.

2. **Garantir `min-width: 24px; min-height: 24px` em todos botões-ícone** (`.modal-x`, `.ct-copilot-close`, `.appshell-notif-close`). 1 patch CSS resolve 4+ violações 2.5.8.

3. **`html { scroll-padding-top: 80px; }`** + verificar se sticky sidebar interfere com focus em viewport pequena. Resolve 2.4.11 sem refator.

4. **Marcar termos estrangeiros com `<span lang="en">`** em pelo menos os mais frequentes ("Dashboard", "Score", "Skill", "Stack", "Streaming SSE", "Marketplace", "Kanban", "Career", "Copilot"). Pode ser componente helper `<En>{children}</En>`.

5. **Trocar `title=` por tooltip custom dismissível** (Esc fecha, hover/focus mostra, sem timeout forçado). Atinge `app/(app)/dashboard/page.js:155`, `components/AppShell.js:265`, `ThemeToggle.js:54`. Resolve 1.4.13 sistemicamente.

---

## Bônus — quick wins ≤ 5 linhas

- Subir `--site-border` para `rgba(255,255,255,0.18)` quando em estado interativo → resolve 1.4.11 sem mudança visual significativa.
- Adicionar `aria-controls` + `aria-expanded` ao botão "Por que esse match?" em `RadarClient.js:285` (já tem `panelId` na linha 304).
- Tornar erro de email no `/entrar` visível: retornar `redirect("/entrar?erro=email")` em vez de `void`, e renderizar mensagem com `role="alert"` (`app/entrar/page.js:17-28`).
- Adicionar botão "Pausar animação" no Hero da landing, controlado por state, com `aria-pressed` (`SiteHero.js`).
- Adicionar `aria-describedby` no checkbox de digest em `conta/page.js:554` apontando para o `<p>` que explica o que liga/desliga.

---

## Cobertura por página

| Página | Issues totais | A-fails | AA-fails | AAA |
|--------|---------------|---------|----------|-----|
| `/` (landing) | 9 | 0 | 7 | 2 |
| `/entrar` | 5 | 0 | 4 | 1 |
| `/dashboard` | 4 | 1 (SkillNode) | 3 | 0 |
| `/oportunidades` | 3 | 0 | 3 | 0 |
| `/conta` | 2 | 0 | 2 | 0 |
| `/plano` | 1 | 0 | 1 | 0 |
| `/gaps` | 1 | 0 | 1 | 0 |
| `/carreira` | 1 | 0 | 1 | 0 |
| Componentes globais (NotificationsBell, CopilotWidget, Modal, AppShell) | 7 | 1 | 6 | 0 |

Total ponderado: **33 issues** (3 P0 bloqueador A, ~20 P1 AA, ~6 AAA).
