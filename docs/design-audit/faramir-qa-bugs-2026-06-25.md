# QA Audit — Faramir — 2026-06-25

**Branch:** `redesign/claude-design` · **Modo:** RESEARCH-ONLY · **Foco:** bugs visuais/funcionais (não polish, não design system).

---

## Executive Summary

- **CRÍTICO — tema noir quebra TODOS os botões `.btn-primary` e `.ct-conta-btn.primary` do app.** Em noir, `--primary-light/--primary/--primary-deep` viraram branco/branco/cinza-claro, e o CSS força `color: #FFF` hardcoded. Botão fica BRANCO COM TEXTO BRANCO. Afeta dashboard, conta, modais (Welcome/Interview/Outcome/Chat/Tailor), /candidaturas, /experimentar, /carreira, /gaps (Concluir microação), /cvs-adaptados, error pages, etc. Token `--on-primary: #000` foi DEFINIDO em noir (`globals.css:334`) mas NENHUM CSS o consome.
- **CRÍTICO — "Ver vagas no meu gêmeo" leva ao lugar errado.** Botão em `app/candidaturas/KanbanClient.js:146` aponta para `/meu-gemeo`, que é um redirect 307 para `/dashboard` (`app/meu-gemeo/page.js:6`). Dashboard NÃO tem listagem de vagas. Founder reportou. Deveria ser `/oportunidades`.
- **CRÍTICO — Modal genérico (`components/Modal.js`) tem z-index 100, mas drawer de notificações e toast de achievement têm 9000/9500.** Se user abre notificação ou toast aparece e em seguida clica em "Adaptar CV"/"Praticar entrevista"/"Conversar com gêmeo", o modal abre POR BAIXO do drawer. Confirmado lendo `app/globals.css:1371` vs `3730/3731/2680`.
- **CRÍTICO — Dead link `/linkedin`.** `app/(app)/estagios/page.js:116` linka para `/linkedin`, rota não existe. 404 garantido. Texto âncora: "/linkedin".
- **ALTO — Theme toggle sobrepõe ações do mobile header.** `.theme-toggle` (z-index 100, fixed top:20px right:20px) cobre o avatar e o sininho de notificações na navegação mobile (`appshell-mobile-header`, z-index 5 sticky). `globals.css:544-548` vs `1959-1969`.
- **ALTO — sem rota direta para `/conta` na nav.** O `appshell-user` (sidebar) renderiza avatar + nome + cargo-alvo + bell mas **NÃO** é clicável; não existe menu/dropdown de usuário. User só chega em `/conta` via "Cargo-alvo pill" do header ou deep-links no texto. Este é provavelmente o "perfil esquisito" do founder.

---

## Bugs reportados pelo founder (verificados)

### "Botão Ver vagas no Meu Gêmeo ilegível"

**Status:** CONFIRMADO — não é só ilegibilidade, é **destino errado + ilegibilidade combinados**.

- **Arquivo:** `app/candidaturas/KanbanClient.js:146-148`
- **Código:**
  ```jsx
  <Link href="/meu-gemeo" className="btn btn-primary" style={{ textDecoration: "none" }}>
    Ver vagas no meu gêmeo →
  </Link>
  ```
- **Causa raiz 1 — destino:** `/meu-gemeo` redireciona para `/dashboard` (`app/meu-gemeo/page.js:6` → `redirect("/dashboard")`). Dashboard NÃO lista vagas. O fluxo "ver vagas" está em `/oportunidades`.
- **Causa raiz 2 — ilegibilidade no noir:** `.btn-primary` em noir tem gradient branco→branco (porque `--primary-light=#FFFFFF`, `--primary=#FAFAFA`) e `color: #FFF` hardcoded em `app/globals.css:734`. Texto fica invisível.
- **Fix sugerido:**
  - Mudar href para `/oportunidades` (que é o Radar de vagas real).
  - Ajustar `.btn-primary` para usar `color: var(--on-primary, #fff)`. Em noir, o alias `--on-primary` já existe = `#000` (`globals.css:334`).

### "Candidaturas poluído"

**Status:** CONFIRMADO como problema visual.

- **Arquivo:** `app/candidaturas/KanbanClient.js` (página inteira) + `app/candidaturas/page.js`.
- **Problemas detectados:**
  1. **Brand SVG com cor hardcoded** `stroke="#B9D90C"` (lime) — `app/candidaturas/page.js:33`. Em noir o accent virou `#C2F542` (lime parecido) mas em LIGHT/DARK gera dissonância com o brand-mark do AppShell que usa `linear-gradient(--primary-light, --primary-deep)`.
  2. **Link "Voltar pro gêmeo"** (`page.js:46`) volta para `/meu-gemeo` → redireciona pro `/dashboard`. Texto promete "gêmeo" e destino é dashboard — incoerente.
  3. **Empty hero hardcoded de dashed border + surface-2** (`KanbanClient.js:272`). Em noir, `var(--border-strong)` é `rgba(255,255,255,.22)` e `--surface-2: #121212`. Card empty + 6 colunas + stats + form de "Nova candidatura" + linha de empty + KanbanColumn — TUDO empilhado em mobile pequeno. Em `<700px` o kanban vira 1 coluna (`KanbanClient.js:256`), criando scroll muito longo.
  4. **3 botões secundários "tool-btn / btn-primary / btn-ghost"** misturados sem hierarquia clara no topo.
  5. **Cores de "Recusada" e "Desistida"** sem distinção visual (`STATUS_LABEL` em KanbanClient.js:25-26).
- **Fix sugerido:**
  - Substituir `stroke="#B9D90C"` por `var(--accent-cyan)` ou `currentColor`.
  - Refatorar header pra ter apenas título + 1 ação primária + back nativo.
  - Reduzir empty hero (apenas título + 1 CTA + 1 fallback).
  - Diferenciar status "REJECTED" e "WITHDRAWN" com cor visual.

### "Radar poluído"

**Status:** PRECISA TESTE MANUAL para confirmar "poluído", mas vejo razões prováveis.

- **Arquivo:** `app/(app)/oportunidades/page.js`, `app/(app)/oportunidades/RadarClient.js`
- **Problemas detectados (alta confiança via leitura):**
  1. **Page header com mesh + box-shadow + filter drop-shadow + glow** — 3 efeitos visuais simultâneos no `<PageHeader>` (`page.js:69-131`). Lê-se carregado.
  2. **Filters bar com app-glass + shadow-md** (`RadarClient.js:65-68`) — outro container glass.
  3. **Sources strip** (`RadarClient.js:128-154`) — uma lista horizontal de N chips ("23 Adzuna · 4 Greenhouse · 12 Lever · 8 Workable...") **logo abaixo** dos filtros. Empilhado, fica visualmente apertado.
  4. **Banner "illustrative"** (`RadarClient.js:100-125`) — terceiro bloco de info antes de listar vagas.
  5. **JobCard com app-glass + boxShadow customizado + fit-ring SVG + chips de skills (até 5 visíveis) + breakdown expansível + drop-shadow filter quando high-fit** (`RadarClient.js:316-441`). Cada card carrega 5+ chips, 1 anel SVG colorido, ações, "Por que esse match?".
  6. **`isHighFit` aplica `borderLeft: 3px solid var(--accent-cyan)` + boxShadow cyan-glow + drop-shadow no ring** — 3 emphasis visuais no mesmo card. Em noir, accent-cyan virou lime, dá amarelo-fluorescente sobre fundo preto.
- **Fix sugerido:**
  - Considerar mover sources strip pra inline com filtros (ou em hover/tooltip), economizando 1 row vertical.
  - Reduzir efeitos visuais redundantes: glass OU mesh, glow OU drop-shadow, não tudo junto.
  - Limitar chips de skills no card resumido a 3 (não 5).

### "Perfil do usuário esquisito"

**Status:** CONFIRMADO — múltiplos problemas distintos.

- **Arquivos:** `components/AppShell.js`, `app/(app)/conta/page.js`
- **Problemas detectados:**
  1. **Avatar do sidebar não é clicável** (`AppShell.js:234-244`). É só um `<div>` decorativo com inicial. NÃO há link pra `/conta`, NÃO há logout. User precisa adivinhar que o cargo-alvo pill no topo do dashboard leva a `/conta`.
  2. **Item "Conta" / "Perfil" NÃO está no NAV** (`AppShell.js:9-75`). Itens são: Dashboard, Gaps, Oportunidades, Concursos, Estágios, Funil, Carreira, Plano, Transparência, Autoconhecimento, CVs Adaptados, Candidaturas. **Sem "Minha conta", "Configurações", "Logout".**
  3. **Avatar nunca usa `user.image`**. `appshell-user .appshell-avatar` (`AppShell.js:235-237`) renderiza só `{initial}`. Se user faz login OAuth (LinkedIn), a `image` que vem do provider é IGNORADA. Mesmo em `/conta` o avatar usa só inicial (`app/(app)/conta/page.js:325-327`).
  4. **Mobile header** (`AppShell.js:266-276`) tem avatar com `aria-hidden="true"` mas `title={userName}` — `title` é hidden de SR mas SR vai ignorar o `aria-hidden`. Inconsistência a11y.
  5. **`.ct-profile-avatar`** (linha 2323 do globals.css) usa `--avatar-from/to` que muda por tema — OK aqui. Mas o texto interno é `color: #fff` hardcoded. Em noir, `--avatar-to: #E5E5E5` (cinza claro) + texto branco = baixíssimo contraste sobre a parte mais clara do gradient.
  6. **`/conta` página** (`app/(app)/conta/page.js`): vários `<section class="ct-conta-card app-glass conta-glass-card">` empilhados sem agrupamento claro. 6 cards seguidos: Perfil, Cargo-alvo, CV-AI (condicional), Stats, Achievements, Notificações, Privacidade, Sessão. **8 cards, em mobile vira lista interminável.**
  7. **Theme toggle (P&B/sol/lua) flutua no top-right do viewport** mas não está integrado ao "perfil do usuário". User não associa o toggle com sua conta. Isolado.
- **Fix sugerido:**
  - Tornar `.appshell-user` um link/button que abra menu (conta/logout/theme).
  - Adicionar item "Conta" no NAV (com ícone usuário).
  - Renderizar `user.image` quando existir (com fallback pra inicial).
  - Agrupar `/conta` em abas/seções colapsáveis em vez de 8 cards lineares.

---

## Findings novos (não reportados pelo founder)

### P0 — Quebrado em prod / ilegível

#### B-001 — `.btn-primary` invisível em noir (TODO o app)
- **Arquivo:** `app/globals.css:732-735`
- **Causa:** gradient `var(--primary-light) → var(--primary)` em noir vira `#FFFFFF → #FAFAFA` (`globals.css:258-262`). `color: #FFF` hardcoded na linha 734. Sem override de noir.
- **Confiança:** ALTA — confirmado por leitura tanto do tema noir quanto da regra base e ausência de override.
- **Impacto:** Botões "Salvar candidatura", "Adicionar ao funil", "Enviar mensagem", "Começar diagnóstico", "Definir cargo-alvo", "Concluir", "Tentar de novo" (error.js), "Ver meu gêmeo →" — todos esses ficam BRANCO COM TEXTO BRANCO em noir.
- **Lista parcial de pontos afetados (encontrados via grep):**
  - `app/candidaturas/KanbanClient.js:146,164,189`
  - `app/entrar/page.js:113`
  - `app/experimentar/page.js:542,682`
  - `app/(app)/dashboard/page.js:274`
  - `app/(app)/carreira/page.js:139`
  - `app/(app)/dashboard/RefreshDiagnosisButton.js:106,177`
  - `app/(app)/dashboard/DailyQuestCard.js:100`
  - `app/meus-dados/page.js:222`
  - `app/not-found.js:16`
  - `app/error.js:36`, `app/(app)/error.js:36`, `app/global-error.js:44`
  - `components/InterviewModal.js:93`
  - `components/LinkedinImportButton.js:80`
  - `components/PortfolioImportButton.js:96,151`
  - `components/OnboardingChat.js:142`
  - `components/WelcomeModal.js:247`
  - `components/OutcomeSurveyModal.js:279`
  - `components/ChatModal.js:78`
- **Fix sugerido:** trocar `color: #FFF` por `color: var(--on-primary, #fff)` em `.btn-primary` (linha 734), `.ct-conta-btn.primary` (linha 2648), `.ct-microaction-cta` (linha 3223). Em noir o token `--on-primary` já é `#000`.

#### B-002 — `.ct-conta-btn.primary` mesmo bug em /conta
- **Arquivo:** `app/globals.css:2646-2654`
- **Mesmo padrão de B-001.** "Salvar nome", "Salvar cargo-alvo", "Baixar meus dados" — todos invisíveis em noir.

#### B-003 — `.ct-microaction-cta` mesmo bug em /gaps
- **Arquivo:** `app/globals.css:3221-3234`
- **Mesmo padrão.** Botão "Concluir microação" em `/gaps` fica invisível em noir.

#### B-004 — `.ct-onb-brand` brand panel quase invisível em noir
- **Arquivo:** `app/globals.css:3452-3463`
- **Causa:** gradient usa `--primary-light / --primary / --primary-deep` (todos brancos/quase-brancos em noir) + `#1F1F4F` indigo escuro hardcoded no último stop. Background fica quase branco com tinta indigo bem no canto, e `color: #fff` no texto.
- **Impacto:** `/experimentar` (`app/experimentar/page.js:344`) tem o brand panel ocupando metade da tela. Em noir, fica painel branco com texto branco e ilustração de pessoas em rgba branco invisível.
- **Confiança:** ALTA via leitura.

#### B-005 — Modal abre debaixo de notification drawer
- **Arquivo:** `components/Modal.js:50` (`.modal-overlay`) vs `app/globals.css:1371` (z-index 100) vs `app/globals.css:3730-3731` (notif drawer z-index 9000/9001) vs `app/globals.css:2680` (achievement toast z-index 9500).
- **Causa:** o modal compartilhado (ChatModal, InterviewModal, OutcomeSurveyModal, WelcomeModal) usa `.modal-overlay` com z-index 100. Drawer e toast usam 9000+.
- **Impacto:** se notification drawer está aberto ou um achievement toast acabou de aparecer, e user clica em "Adaptar CV"/"Praticar entrevista"/qualquer modal — modal abre por baixo. UX quebrada.
- **Confiança:** ALTA — z-indexes documentados, sem `:has()` ou portal trick que esconda o drawer no momento do modal.
- **Fix sugerido:** subir `.modal-overlay` para z-index 10000 (acima de tudo). Ou ao abrir modal, fechar notif drawer.

#### B-006 — Theme toggle sobrepõe avatar/bell no mobile header
- **Arquivo:** `app/globals.css:544-548` (.theme-toggle: fixed top:20px right:20px z-index:100) vs `app/globals.css:1959-1969` (appshell-mobile-header sticky z-index:5).
- **Causa:** posição fixa do theme-toggle no canto superior direito colide visualmente com `.appshell-mobile-actions` (`AppShell.js:266-276`) que contém o `NotificationsBell compact` e o `appshell-avatar`. Ambos disputam o canto direito.
- **Impacto:** mobile: usuário não consegue clicar no avatar (que de qualquer forma não faz nada — B-007) e o bell ou fica atrás do toggle (z-index 100 > 5) ou recebe clicks errados.
- **Confiança:** ALTA — geometria de `position: fixed; top:20px; right:20px;` colide com o canto right do mobile header em qualquer viewport.

#### B-007 — Dead link `/linkedin`
- **Arquivo:** `app/(app)/estagios/page.js:116-118`
- **Causa:** `<Link href="/linkedin">` mas não existe `app/linkedin/`. Verificado.
- **Impacto:** 404 garantido. Confiança: ALTA.

#### B-008 — `.btn-primary` SEM classe `.btn` ⇒ botão "pelado" (sem padding/border-radius)
- **Arquivos:** `app/not-found.js:16`, `app/error.js:36`, `app/global-error.js:44`, `app/(app)/error.js:36`, `app/(app)/dashboard/DailyQuestCard.js:100`, `app/(app)/carreira/page.js:139`.
- **Causa:** `className="btn-primary"` (sem `btn `) — `.btn` (linha 711) tem padding/border-radius/font, `.btn-primary` só sobrescreve background/color/border. Sem `.btn`, o botão renderiza como `<button>` puro com background gradient mas sem padding/border-radius/font-weight.
- **Impacto:** botões em error pages e em "Definir cargo-alvo" do `/carreira` aparecem visualmente sem padding (caixa colada no texto, sem altura).
- **Confiança:** ALTA — confirmado lendo CSS.

### P1 — Visualmente errado mas funciona

#### B-009 — Avatar nunca renderiza imagem mesmo quando disponível
- **Arquivos:** `components/AppShell.js:235-244,269-275`, `app/(app)/conta/page.js:325-327`
- **Causa:** Implementação só usa inicial. O `user.image` (vem do OAuth/LinkedIn ou foto que user possa subir) é ignorado.
- **Impacto:** se LinkedIn provider devolve foto, ela nunca aparece. Feeling de "perfil esquisito" do founder.
- **Confiança:** ALTA.

#### B-010 — Mobile header `aria-hidden="true"` no avatar com `title`
- **Arquivo:** `components/AppShell.js:269-275`
- **Causa:** combina `aria-hidden=true` (oculta de SR) com `title={userName}` (tooltip nativo, lido por SR em mouse-hover/focus). Inconsistente.
- **Impacto:** Screen readers podem comportar-se diferente; mais sutil — não impede uso.

#### B-011 — `appshell-user` (sidebar) não é clicável
- **Arquivo:** `components/AppShell.js:234-245`
- **Causa:** wrapper `<div className="appshell-user">` não é `<Link>` nem `<button>`. Avatar + nome + cargo-alvo + bell juntos, mas o conjunto não vira interativo. O `NotificationsBell` é o único clicável.
- **Impacto:** user não tem affordance pra acessar conta/logout pela sidebar. Reforço da queixa "perfil esquisito".
- **Confiança:** ALTA.

#### B-012 — Brand SVG hardcoded lime/indigo no /candidaturas
- **Arquivo:** `app/candidaturas/page.js:33`
- **Causa:** `stroke="#B9D90C"` (lime fora dos tokens, próximo ao Cloudwalk noir accent mas não igual).
- **Impacto:** brand-mark diferente do AppShell (que usa gradient indigo via `--primary-light/--primary-deep`). Em noir o SVG fica lime sobre preto OK, mas em light/dark conflita com a brand-mark do AppShell que é indigo.
- **Confiança:** ALTA.

#### B-013 — Brand SVG `stroke="#fff"` em /experimentar e AppShell
- **Arquivos:** `components/AppShell.js:100` (dentro de gradient indigo, ok), `app/experimentar/page.js:347` (dentro de `.ct-onb-brand-mark-icon` cujo background eu não verifiquei).
- **Impacto AppShell:** OK porque o `BrandMark` tem background gradient `--primary-light → --primary-deep`. EM NOIR, esse gradient vira BRANCO. O SVG `stroke="#fff"` em cima fica invisível.
- **Confiança:** ALTA.

#### B-014 — `color: #fff` em `/privacidade` (email button)
- **Arquivo:** `app/privacidade/page.js:1121-1122`
- **Causa:** `background: var(--accent-cyan-deep)` + `color: "#fff"`. Em noir `--accent-cyan-deep: #A8DB28` (lime escuro). Lime + branco = contraste baixo.
- **Confiança:** ALTA.

#### B-015 — Tooltip `.info-tip::after` z-index 50 atrás de drawers/modals
- **Arquivo:** `app/globals.css:606`
- **Causa:** tooltip tem `z-index:50`. Modal=100, drawer=9000. Não conflita com modal aberto (modal cobre), mas pode ficar atrás de elementos sticky do header.
- **Impacto:** baixo — só se tooltip surge enquanto drawer está aberto.

#### B-016 — Botão "Sair" (logout) genérico sem cor de aviso
- **Arquivo:** `app/(app)/conta/page.js:620-624`
- **Causa:** botão "Sair" usa `.ct-conta-btn` (variante neutra). Não tem affordance de ação destrutiva (mesmo sem ser destrutiva, é uma transição importante).
- **Impacto:** menor — mas usuário sai sem clareza visual.

#### B-017 — Mobile nav scroll horizontal com 13 itens
- **Arquivo:** `components/AppShell.js:9-75` (13 itens NAV) + `app/globals.css:1972-1978` (mobile-nav é `overflow-x: auto`)
- **Causa:** mobile NAV tem 13 itens horizontais em scroll. Mas não há indicador visual de "tem mais" — `::-webkit-scrollbar { display: none }` esconde.
- **Impacto:** user pode não descobrir os últimos itens em mobile.
- **Confiança:** ALTA.

#### B-018 — `aria-modal="false"` no Copilot panel
- **Arquivo:** `components/CopilotWidget.js:342`
- **Causa:** `role="dialog"` + `aria-modal="false"` — pode ser intencional (não trava o resto), mas screen readers podem deixar usuário "preso" sem entender o relacionamento.
- **Impacto:** menor a11y.

### P2 — Inconsistente mas aceitável

#### B-019 — Bell e Copilot drawer disputam canto inferior direito
- **Arquivos:** `app/globals.css:3730-3731` (notif drawer z-index 9000/9001, posicionada top:0 right:0 width:400px height:100vh) + `app/globals.css:5273` (FAB Copilot z-index 90, bottom:24px right:24px) + `app/globals.css:5302` (Copilot panel z-index 89, bottom:92px right:24px).
- **Causa:** se notif drawer está aberto (cobre tela inteira da direita), o FAB Copilot (z-index 90) fica DEBAIXO do drawer (z-index 9001). Isso é INTENCIONAL para evitar 2 drawers concorrendo, mas… o FAB **ainda é visível** abaixo do drawer porque a drawer-bg é fixed sobre tudo só com scrim parcial? Não — `--scrim` em noir é `rgba(0,0,0,0.7)`, e drawer tem `background: var(--surface)` opaco. FAB fica oculto, ok. Mas user pode esperar abrir o copilot enquanto vê notificação.
- **Impacto:** moderado UX. Aceitável.

#### B-020 — Hover state em `.kanban-card` ausente
- **Arquivo:** `app/candidaturas/KanbanClient.js:262-263` (CSS scoped)
- **Causa:** `.kanban-card` tem `transition: opacity .15s` mas nenhum `:hover` definido.
- **Impacto:** card não dá feedback visual ao passar mouse. Usuário pode achar que não é clicável (de fato, só o select e o link `ver vaga ↗` são).
- **Confiança:** ALTA.

#### B-021 — Disabled state em select sem cor visual
- **Arquivo:** `app/candidaturas/KanbanClient.js:226-228`
- **Causa:** `<select disabled={busyId === it.id}>` mas só seta opacity do card pai (linha 209). Select nativo em si não recebe styling de disabled.
- **Impacto:** menor — opacity do card já sinaliza.

#### B-022 — `defaultChecked` em toggle digest sem indicador de "salvando"
- **Arquivo:** `app/(app)/conta/page.js:554-563`
- **Causa:** checkbox + botão "Salvar preferência". Sem loading state no submit.
- **Impacto:** menor — formulário Server Action é rápido.

### P3 — Polish (anotado, não focar)

- B-023 — `aria-hidden="true"` no avatar do sidebar mas com `title`. Esperado: ou avatar tem aria-label legível ou nada.
- B-024 — Theme-toggle `width:38px; height:38px` em desktop; mobile aumenta pra 44px (linha 5939 globals.css) mas posição fixa colide com hamburger area.
- B-025 — Loading state ausente em "Apagar candidatura" — `confirm()` nativo (`KanbanClient.js:79`) é UX ruim.

---

## Sobreposições detectadas (z-index)

| Componente | z-index | Conflito potencial com |
|---|---|---|
| `.theme-toggle` (fixed top-right) | 100 | `.appshell-mobile-header` (5) — toggle sobrepõe avatar/bell em mobile |
| `.modal-overlay` (`components/Modal.js`) | 100 | `.appshell-notif-drawer` (9001), `.ct-achievement-toast` (9500), `.ct-tailor-modal-bg` (9000) — modal abre POR BAIXO |
| `.info-tip::after` | 50 | qualquer modal/drawer aberto (modal=100+, drawer=9000) |
| `.ct-copilot-fab` | 90 | `.appshell-notif-drawer` (9001) — fab some sob drawer |
| `.ct-copilot-panel` | 89 | igual ao acima |
| `.appshell-notif-drawer-bg` / `.appshell-notif-drawer` | 9000 / 9001 | normal |
| `.ct-tailor-modal-bg` | 9000 | normal |
| `.ct-achievement-toast` | 9500 | maior que drawer — ok |

**Hierarquia consistente NÃO existe.** Modal genérico (z=100) está absurdamente baixo. Tailor-modal (especializado) tá em 9000. Inconsistência interna.

---

## Dead links encontrados

| href | Arquivo:linha | Status |
|---|---|---|
| `/linkedin` | `app/(app)/estagios/page.js:116` | **404 — rota não existe** |
| `/meu-gemeo` | `app/candidaturas/KanbanClient.js:141,146`, `app/candidaturas/page.js:30,46`, `app/(app)/dashboard/page.js` (via Welcome banner), `app/experimentar/page.js:682` | Redirect → /dashboard. **Semanticamente errado** quando o texto promete "vagas/gêmeo" — destino é dashboard genérico |
| Todas as outras rotas (`/dashboard`, `/gaps`, `/oportunidades`, `/concursos`, `/estagios`, `/funil`, `/carreira`, `/plano`, `/transparencia`, `/autoconhecimento`, `/cvs-adaptados`, `/candidaturas`, `/conta`, `/meus-dados`, `/privacidade`, `/termos`, `/entrar`, `/experimentar`, `/evidencias`) | múltiplos | OK — rotas existem em `app/` |
| `/admin` | sem links no app | rota existe mas é "escondida" (acesso direto por URL). Esperado se for admin-only — não-bug por design. |

---

## Botões ilegíveis por tema

| Botão | Light | Dark | Noir | Causa |
|---|---|---|---|---|
| `.btn-primary` | OK (indigo + white) | OK (purple-light + white) | **INVISÍVEL — white+white** | `color: #FFF` hardcoded em `globals.css:734`, sem override noir |
| `.ct-conta-btn.primary` | OK | OK | **INVISÍVEL** | mesmo padrão, `globals.css:2648` |
| `.ct-microaction-cta` | OK | OK | **INVISÍVEL** | `globals.css:3223` |
| `.ct-onb-brand` panel + texto | OK | OK | **TEXTO INVISÍVEL — branco/branco** | gradient usa `--primary-light` que é #FFF em noir + `color: #fff` (`globals.css:3456`) |
| `BrandMark` SVG `stroke="#fff"` | OK | OK | **STROKE INVISÍVEL** | gradient brand vira branco em noir, SVG branco em cima invisível (`AppShell.js:100`) |
| `/privacidade` email button | OK | OK | **BAIXO CONTRASTE** | `background: --accent-cyan-deep` (lime escuro) + `color: #fff` (`page.js:1121`) |
| `/candidaturas` brand stroke `#B9D90C` | (descolado da identidade) | (descolado) | OK (combina com lime accent) | hardcoded — `page.js:33` |
| `.kanban-empty` "vazia por enquanto" | OK | OK | OK (var(--text-subtle)) | — |
| `.btn-ghost` | OK | OK | OK (surface + text) | usa tokens corretamente |
| `.btn` puro (sem classe primary/ghost) | OK | OK | OK | — |

---

## Estados de botão (matriz)

| Componente | Hover | Active | Disabled | Loading |
|---|---|---|---|---|
| `.btn-primary` | OK (lift + cyan glow) | OK (scale 0.98) | OK (opacity 0.5 + cursor) | ❌ ausente |
| `.btn-ghost` | OK (lift + border tint) | OK | OK (via .btn:disabled) | ❌ ausente |
| `.ct-conta-btn` | OK | ❌ ausente | ❌ ausente | ❌ ausente |
| `.ct-conta-btn.primary` | OK (gradient shift) | ❌ ausente | ❌ ausente | ❌ ausente |
| `.theme-toggle` | OK (lift + primary) | OK (scale 0.96) | N/A | N/A |
| `.kanban-card` | ❌ ausente | ❌ ausente | OK (via opacity prop) | OK (busyId opacity) |
| `.kanban-card select` | ❌ ausente | ❌ ausente | parcial (opacity card) | parcial |
| `.kanban-x` | OK (color alert + border) | ❌ ausente | ❌ ausente | ❌ ausente |
| `.appshell-nav-item` | provável (não verifiquei CSS) | ❌ | N/A | N/A |
| `.ct-copilot-fab` | provável | provável | OK (no disabled — sempre on) | N/A |
| `.ct-copilot-send` | depende | OK | OK (`disabled` aplica opacity?) | ❌ |
| `.ct-microaction-cta` | OK | OK (scale 0.98) | OK (opacity .6) | ❌ ausente |

**Padrão:** botões primários têm hover/active OK, mas **nenhum botão de form tem spinner/loading state CSS dedicado**. Implementações usam `disabled` + texto trocado (ex: KanbanClient `setBusyId`).

---

## Mobile breaking points

| Página | Viewport | Problema |
|---|---|---|
| Todas (logado) | qualquer | Theme-toggle (top:20px right:20px fixed) sobrepõe avatar/bell do mobile-header |
| `/candidaturas` | ≤700px | Kanban vira 1 coluna — 6 columns empilhadas + form de Nova + stats + empty hero = scroll muito longo |
| `/candidaturas` | ≤880px | Header tem brand + "Voltar pro gêmeo" + stats, sem flex-wrap claro |
| `/oportunidades` | mobile | filters-bar com 3 selects em row pode estourar; sources strip horizontal sem indicador |
| `/conta` | mobile | 8 cards empilhados — scroll interminável |
| `/dashboard` | mobile | hero do score-ring (172px svg) + sub-scores ocupa toda a tela; mediana bar pode quebrar |
| `/carreira` | mobile | header gigante com `clamp(40px,6vw,80px)` no h1 — em viewport pequeno, h1 muito alto (40px) ocupa tela inteira |
| `/funil` | mobile | SVG do funnel chart é `width="100%"` com `viewBox 0 0 1000 H` — fica miúdo, label fica pequeno |
| `/experimentar` | mobile | brand panel `.ct-onb-brand` tem `min-height: 640px` — em mobile ocupa mais que o viewport |

---

## Roteiro de teste manual

- [ ] **Abrir /dashboard em noir → ver "Atualizar diagnóstico" (`.btn-primary`) — confirmar que texto branco sobre fundo branco está invisível.**
- [ ] **Abrir /candidaturas vazio em noir → clicar em "Ver vagas no meu gêmeo →" — confirmar 1) texto invisível 2) destino vai pro /dashboard (não para /oportunidades como o texto promete).**
- [ ] **Abrir notificação (sino) → enquanto está aberta, clicar em "Adaptar CV" (Tailor) em qualquer lugar — verificar se modal aparece atrás do drawer.**
- [ ] **Tab por /candidaturas → verificar se algum botão sem feedback (kanban-card, kanban-x, brand do header).**
- [ ] **Resize navegador pra 375px em todas as páginas principais (/dashboard, /candidaturas, /conta, /experimentar, /oportunidades).**
- [ ] **No mobile, verificar se theme-toggle sobrepõe avatar/bell — tentar clicar no avatar.**
- [ ] **Trocar para tema dark → noir → light em sequência rápida, observar flash-of-wrong-theme em qualquer página.**
- [ ] **Acessar /estagios → clicar no link "/linkedin" — confirmar 404.**
- [ ] **Ir em /not-found (digitar URL random) → observar se "Voltar pra home" tem padding/altura corretos (B-008).**
- [ ] **Em qualquer error boundary trigger → mesmo teste do botão "Tentar de novo".**
- [ ] **Abrir /carreira sem cargo-alvo → testar botão "Definir cargo-alvo" (`btn-primary` sem `btn`).**
- [ ] **Abrir /experimentar em noir → confirmar que brand panel à esquerda fica branco com texto branco.**
- [ ] **No /conta, tentar mudar nome → observar se Server Action dá feedback de sucesso ou só revalidate silencioso.**
- [ ] **Tentar abrir Copilot widget enquanto notif drawer aberto — observar comportamento.**
- [ ] **OAuth login: confirmar se `user.image` aparece em algum lugar do app (provavelmente não).**

---

## Recomendações priorizadas

### Imediato (P0 — antes de showcase)

1. **Adicionar override de `.btn-primary` no noir** (e variantes): em `app/globals.css`, adicionar bloco `:root[data-theme="noir"] .btn-primary, :root[data-theme="noir"] .ct-conta-btn.primary, :root[data-theme="noir"] .ct-microaction-cta { color: var(--on-primary); }`. Ou trocar `color: #FFF` por `color: var(--on-primary, #fff)` em todas as definições primary.
2. **Corrigir destino de "Ver vagas no meu gêmeo"** em `KanbanClient.js:146` → `/oportunidades`. Mudar texto para "Ver vagas no Radar →" se quiser ser mais explícito.
3. **Subir z-index de `.modal-overlay`** para 10000 (ou portal pra fora do drawer).
4. **Mover ou esconder `.theme-toggle` no mobile** quando há `appshell-mobile-header` (talvez colocar dentro do header como mais um botão de actions).
5. **Corrigir dead link `/linkedin`** — ou criar rota stub `/linkedin` que orienta o user, ou remover o link de `estagios/page.js:116`.
6. **Override de `.ct-onb-brand` em noir** — definir gradient diferente OU usar `--primary` original sempre (não atrelar a tema).
7. **`BrandMark` SVG** — trocar `stroke="#fff"` por `stroke="currentColor"` e setar color no wrapper, OU definir gradient brand fixo (não dependente do tema).

### Curto prazo (P1 — sprint atual)

8. **Adicionar item "Conta" ao NAV do AppShell** (sidebar e mobile), OU tornar `.appshell-user` clicável que abre dropdown com "Conta", "Logout", "Theme".
9. **Renderizar `user.image`** quando disponível (`AppShell.js`, `conta/page.js`).
10. **Adicionar `:hover` ao `.kanban-card`** com leve lift/border-color.
11. **Trocar `className="btn-primary"` por `className="btn btn-primary"`** em `not-found.js`, `error.js`, `global-error.js`, `(app)/error.js`, `DailyQuestCard.js:100`, `carreira/page.js:139`.
12. **`/candidaturas` brand SVG:** trocar `stroke="#B9D90C"` por `stroke="currentColor"` ou `stroke="var(--accent-cyan)"`.
13. **`/privacidade` email button:** trocar `color: "#fff"` por `color: var(--accent-on-cyan, #08313F)`.
14. **Adicionar indicador "scroll" no mobile-nav** (gradient fade direito) quando há mais itens.

### Médio prazo (P2)

15. **Refatorar `/conta`** em abas (Perfil · Notificações · Privacidade · Sessão) em vez de 8 cards empilhados.
16. **Consolidar z-index com camadas nominais** (ex.: `--z-modal: 10000`, `--z-drawer: 9000`, `--z-toast: 9500`, `--z-fab: 90`, `--z-toggle: 100`) e usar via tokens.
17. **Adicionar loading-state ao framework de botões** — talvez `.btn[aria-busy="true"]` com spinner pseudo-element.
18. **Diminuir efeitos visuais simultâneos no /oportunidades** (escolher entre mesh OU glass, entre cyan-glow OR drop-shadow).

---

## Observação metodológica

Este audit foi RESEARCH-ONLY — nenhum teste foi rodado, nenhum commit feito. Todas as evidências saíram da leitura direta de:

- `app/globals.css` (tokens, button classes, z-indexes, mobile breakpoints)
- `app/meu-gemeo/page.js` (confirmação do redirect)
- `app/candidaturas/{page.js,KanbanClient.js}` (botão "Ver vagas")
- `app/(app)/{dashboard,oportunidades,conta,carreira,estagios,funil}/page.js`
- `components/{AppShell,Modal,CopilotWidget,NotificationsBell,ThemeToggle,WelcomeModal,...}.js`
- `app/{layout,error,not-found,global-error,privacidade,admin}.js`

Bugs marcados como "CONFIRMADO" foram verificados por **leitura cruzada** de pelo menos 2 arquivos (CSS + uso). Bugs marcados "PRECISA TESTE MANUAL" são suspeitas de alta confiança que dependem de renderização (ex.: aglomeração visual em `/oportunidades`).
