# Brand Audit — Lúthien — 2026-06-25

**Wave 9 · Brand/Visual Director · RESEARCH-ONLY**
Tema noir (preto puro + lime `#C2F542` + branco quente).
Referência: Cloudwalk + Apple BR + landing pública `app/(landing)/*`.

---

## Executive Summary

- **O app NÃO entrega a promessa visual da landing — em ~60% das páginas.** A landing usa H1 `clamp(48px, 9.5vw, 144px)`, eyebrow mono + lime, hero brutalist com 100vh, gradient mesh, parallax e marquee gigante. Já o app **default** para H1 = 26px fixo (`globals.css:6172`), eyebrow sem ambition vertical e cards sem hierarchy. Não é "premium SaaS", é "SaaS dashboardy default".
- **5 páginas têm uplift (clamp 40-80px) e 9 páginas não.** A inconsistência interna é o pior problema: o usuário vai sentir "esta tela parece de outro produto" ao navegar Dashboard → /gaps → /conta. Sem padronização, a promessa Cloudwalk é diluída.
- **O AppShell — peça que aparece em TODA tela logada — usa cor `--primary` (no noir = #FAFAFA branco) e gradient `--primary-light → --primary-deep` (no noir = #FFFFFF → #E5E5E5).** Resultado: a sidebar inteira é **branco-sobre-preto sem nenhum lime**, enquanto a landing tem lime accent em 3-5 pontos por viewport. O CareerTwin logado parece "wireframe da Apple", não "premium app brasileiro com personalidade".
- **Cores hardcoded violam brand em pontos de alto tráfego.** `WelcomeModal.js:38,44,50` usa indigo `#4F46E5`, cyan `#06B6D4`, purple `#8B5CF6` — sem nenhuma relação com lime. `app/candidaturas/page.js:33` usa `#B9D90C` (verde-tóxico, NÃO o lime `#C2F542` canônico).
- **Microcopy genérico em 70% dos CTAs.** Botões "Salvar nome", "Salvar cargo-alvo", "Filtrar", "Salvar", "Sair". A landing usa "Começar diagnóstico grátis", "Ver como funciona" — específica, narrativa. Logado vira corporate-bland.

---

## Páginas que MAIS destoam da landing (priorizadas)

1. **`/candidaturas`** — `app/candidaturas/page.js:27-90` — Header tipo "brand-bar" antigo, sem eyebrow, sem H1 ambicioso. Logo hardcoded `#B9D90C` (verde errado). Stats sem hierarchy editorial. Vibe = SaaS Salesforce 2018, NÃO Cloudwalk.
2. **`/conta`** — `app/(app)/conta/page.js:279-286` — Header `<div class="ct-gaps-header">` sem eyebrow, sem typography clamp, H1 26px. Em 7 cards listados sequencialmente sem variation, parece "config screen" de qualquer SaaS (Stripe-like).
3. **`/meus-dados`** — `app/meus-dados/page.js:99-100` — H1 = `hero` (font-size 32px hardcoded). Topbar `Link>brand-name` mistura linguagem visual da home efêmera (não AppShell). Sub-headers usando "01, 02, 03, 04" + ⎘ aleatório. Parece DOC, não app.
4. **`/entrar`** — `app/entrar/page.js:51` — `<h1 className="hero" style={{ fontSize: 38 }}>`. Landing usa 144px no hero, página de entrada 38px. Right-card usa `var(--serif)` para `<h2>` (linha 188) — **não bate** com a tipografia sans Plus Jakarta da landing. Eyebrow "Por que criar conta?" usa `var(--alert)` (rosa coral) ao invés de lime — quebra brand.
5. **`/oportunidades`, `/gaps`, `/concursos`, `/funil`, `/transparencia`** — Todas usam `<h1 className="ct-page-header-title">` que = 26px fixo (`globals.css:6172`). Eyebrow cinza-mono em vez de lime-mono. Resultado: 5 das telas mais críticas do produto têm header sub-Cloudwalk.

---

## Páginas que já têm vibe coerente

- **`/dashboard`** — `app/(app)/dashboard/page.js:139-150` — clamp(40-80px), eyebrow lime "Dashboard · Bom te ver de volta", typography ambitious. Score ring com glow cyan.
- **`/carreira`** — `app/(app)/carreira/page.js:71-91` — Mesmo uplift, eyebrow + H1 clamp + sub clamp.
- **`/plano`** — `app/(app)/plano/page.js:126-163` — Eyebrow lime, H1 clamp(40-80px), spacing generoso.
- **`/autoconhecimento`** — `app/(app)/autoconhecimento/page.js:65-117` — Hero eyebrow + H1 + sub + stats list (`~5min`, `100%`, `∞`) num Apple-style premium.
- **`/evidencias`** — clamp 40-80px aplicado (gist via grep).
- **`/transparencia`** — `app/(app)/transparencia/page.js` é **conteúdo excelente** (worked example, formulas) mas o H1 da página = 26px (default `.ct-page-header-title`). Conteúdo ✓, hero ✗.

---

## Findings

### P0 — Quebra brand promise

**P0.1 — Default `.ct-page-header-title` é 26px** (`app/globals.css:6171-6173`).
Atinge: `/gaps`, `/oportunidades`, `/concursos`, `/funil`, `/transparencia`. Landing usa clamp(48-144px) — gap >5x. Sintoma: user vem da landing com hero brutalist e cai numa página onde o H1 mal se diferencia do body.

**P0.2 — AppShell logo brand-mark usa `--primary-light` → `--primary-deep`** (`components/AppShell.js:86`).
No noir esses tokens resolvem para `#FFFFFF → #E5E5E5` (`app/globals.css:259-262`). Resultado: o logo do produto na sidebar (12+ horas de tela do beta tester) é **branco-cinza sem lime**. Mensagem visual: "produto comum". A landing usa lime accent no dot do eyebrow + accent glow no CTA — esse vocabulário não chega na sidebar.

**P0.3 — `.appshell-nav-item.active` colore com `--primary` em vez de `--accent-cyan`** (`app/globals.css:1862-1867`).
No tema noir `--primary = #FAFAFA` (branco). Active nav item branco-sobre-cinza-claro. Cloudwalk usa lime EM ITEM ATIVO. App = sem cor de marca em nenhum estado da navegação.

**P0.4 — `WelcomeModal.js` usa paleta indigo/cyan/purple hardcoded** (`components/WelcomeModal.js:38, 44, 50`).
Cores `#4F46E5`, `#06B6D4`, `#8B5CF6`. Primeiro contato do usuário com produto logado mostra paleta de **outro produto**. Ironicamente é uma modal cujo título é literalmente "Bem-vindo ao CareerTwin AI" e seu visual contradiz o brand.

**P0.5 — `/candidaturas` logo hardcoded `#B9D90C`** (`app/candidaturas/page.js:33`).
NÃO é o lime canônico `#C2F542` definido em `globals.css:274`. Tom verde mais escuro/sujo. Inconsistência: o mesmo logo na AppShell aparece com cor totalmente diferente.

### P1 — Detalhe Cloudwalk faltando

**P1.1 — Nenhum equivalente ao `SiteStackMarquee` no app.** A landing tem palavras-chave gigantes UPPERCASE rolando horizontalmente (`components/site/SiteStackMarquee.js:96-101`, clamp 32-64px). Página `/dashboard` ou `/transparencia` poderiam ter um marquee "Score auditável · LGPD · RAG · BR-first · ..." entre seções pra reforçar marca.

**P1.2 — Stats grandes sem counter-up.** Dashboard mostra `{score}` mas é estático. Landing usa `SiteMetrics` com counter animado no scroll. /transparencia tem stats RAG (Recall@3, 159 chunks) que mereciam counter-up.

**P1.3 — Hero ambicioso ausente em /entrar.** Landing hero = 100vh + parallax + SVG trajectory + scroll cue. /entrar (porta de entrada do produto pago) = wrap padrão com hero 38px. Conversão visual = oportunidade desperdiçada.

**P1.4 — Lime accent usado demais em "qualquer cyan-glow"** (`app/(app)/conta/page.js:247-261`). A landing usa lime accent em **1-2 pontos por viewport máximo** (eyebrow dot + CTA principal). O app logado, ao tentar ser "premium", aplica `var(--accent-cyan-glow)` em hover de TODO card (`.conta-glass-card:hover`, `.tailor-card-glass:hover`, `.ct-glass-hover:hover`). Resultado: o lime perde valor. Cloudwalk = restrição. App = abundância.

**P1.5 — Cursor glow / microinterações sutis ausentes no app.** Landing tem `SiteCursorGlow.js`. App não tem. Em `/dashboard` ou `/transparencia` (showcase do moat), um glow sutil seguindo cursor reforçaria "produto vivo, premium".

**P1.6 — `var(--font-display)` não está consistentemente em uso.** `.ct-page-header-title` usa `--font-display` (`globals.css:6172`), mas o brand-name `.appshell-brand-name` (`globals.css:1801-1810`) usa só `font-weight: 800` sem font-family — herda Plus Jakarta. Não há contraste tipográfico entre "tipo display" e "tipo body". Cloudwalk explora isso pra criar peso editorial.

### P2 — Microcopy genérico

| Onde | Texto atual | Sugestão (brand-aligned) |
|---|---|---|
| `/conta` botão | "Salvar nome" | "Atualizar perfil" |
| `/conta` botão | "Salvar cargo-alvo" | "Travar cargo-alvo" |
| `/conta` botão | "Sair" | "Encerrar sessão" |
| `/conta` botão | "Apagar tudo definitivamente" | "Excluir gêmeo · irreversível" |
| `/concursos` botão | "Filtrar" | "Aplicar filtros" |
| `/meus-dados` h1 | "Seus dados, sob seu controle." | "Você controla cada byte." |
| `/entrar` h1 | "Entrar" | "Ative seu gêmeo." |
| `/entrar` eyebrow | "Por que criar conta?" | "O que você ganha" |
| `/candidaturas` brand-sub | "funil + tracking" | "TODA candidatura · ZERO PLANILHA" (mono UPPERCASE Cloudwalk-style) |
| `/cvs-adaptados` empty | "Nenhum CV adaptado ainda" | "Seu portfólio de CVs adaptados começa aqui." |
| `/oportunidades` sub | "Vagas reais matched ao seu perfil. Match em %, transparente." | "Vagas reais. Match % auditável. Sem caixa-preta." (pilares!) |
| `/transparencia` h1 sub | "Toda nota tem fórmula explícita..." | OK — coerente com brand. Mas H1 default 26px desperdiça o conteúdo. |
| AppShell brand-tag | "SEU GÊMEO DE CARREIRA" | "GÊMEO · AUDITÁVEL · BRASIL" (encaixa 4 pilares) |

**Pilares NÃO comunicados no logado:**
- **Transparência:** existe na /transparencia mas não vaza pra resto.
- **Independência editorial:** zero menção fora da landing (`/transparencia` toca, mas sutil).
- **BR-first concreto:** mencionado em /concursos eyebrow, em lugar nenhum mais.
- **Workflow opinionated:** nunca verbalizado in-app.

### P3 — Detail polish

**P3.1 — Border radius inconsistente.** `--radius-lg = 14px` no design-system mas `WelcomeModal.js:175` usa `borderRadius: 10`, `SiteHero.js:212` usa `borderRadius: 999` (pill). Conta mistura `borderRadius: 8` (inputs) com `var(--radius-lg)` em cards. Ambíguo.

**P3.2 — Box-shadow não-padronizado.** `/oportunidades` PageHeader inline shadow `0 8px 24px -6px var(--accent-cyan-glow)`; `/concursos` filter form `0 0 0 1px var(--accent-cyan), 0 6px 24px -10px var(--accent-cyan-glow)`. Diferentes em cada arquivo. Falta `--shadow-cyan-glow` token.

**P3.3 — `/entrar` aside usa `var(--serif)` para H2** (`app/entrar/page.js:188`). A landing inteira é Plus Jakarta Sans + JetBrains Mono. Serif no aside cria dissonância tipográfica.

**P3.4 — `/concursos` filter form** (`page.js:92-209`) usa estilo inline pesado com props condicionais (`uf ? activeBorder : idleBorder`). Boring boxy select+text+button = vibe "filtro de e-commerce 2015". Cloudwalk faria isso brutalist (UPPERCASE labels, mono font, sem borders ou borders heavy 2px).

**P3.5 — Tabela `/funil` HistoryTable** (`page.js:215-279`) usa `<table>` com `background: var(--surface-2)` no thead. Sem `font-variant-numeric: tabular-nums` consistente, sem hierarquia. Cloudwalk teria stats com display font + alinhamento decimal.

**P3.6 — `/dashboard` `SubScoresCol` retorna 4 barras horizontais idênticas** (`page.js:504-578`). Sem ranking visual (a "Aderência" pesa 40% e visualmente tem o mesmo peso que "Experiência" 10%). Cloudwalk daria peso visual coerente com peso semântico.

**P3.7 — WelcomeBanner do /dashboard** (`page.js:287-333`) usa classe `ct-welcome-banner` — visual de "info-banner Bootstrap" tradicional. Não tem ambition. Poderia ser um hero secundário com clamp() type.

**P3.8 — Empty states inconsistentes.**
- `/cvs-adaptados:92-99` usa `ct-dash-empty` (estilo A)
- `/oportunidades:37-44` usa `ct-empty-state-v2` (estilo B)
- `/concursos:340-376` usa `ct-empty-state-v2` (B)
- `/gaps:330-344` usa `ct-dash-empty` (A)
- `/plano:198` usa `<div style={{ padding: 28 }}>` (inline, estilo C)

Três flavors de empty state coexistindo. Brand exige UM.

**P3.9 — `.appshell-lgpd-card` usa `var(--primary-soft)` gradient** (`globals.css:1879-1888`). No noir = cinza muito escuro, perde a vibe "card de destaque" que tem no light theme. No noir, deveria ser `var(--accent-cyan-glow)` background.

**P3.10 — `proc-headline` no /experimentar** (`page.js:694-698`) define `font-family: var(--font-display)` inline com font-size 22. Estilos repetidos manualmente em vez de via `.ct-page-header-title` token.

---

## Recomendações por página

| Página | Estado atual | Ação |
|---|---|---|
| `/dashboard` | Header com clamp uplift ✓, mas SubScoresCol sem peso visual diferenciado | Manter header. Aplicar peso visual nas 4 barras (Aderência 40% = barra mais espessa/alta) |
| `/gaps` | Header default 26px | Aplicar uplift inline (clamp 40-80px) IGUAL `/carreira:71-91` |
| `/oportunidades` | Header default 26px, sub usa "Match em %, transparente" — perde pilar | Uplift typography + sub: "Vagas reais. Match % auditável. Sem caixa-preta." |
| `/concursos` | Header default + filter form boxy + selects estilo legacy | Uplift typography + filter brutalist (labels mono UPPERCASE, sem borders nos inputs, apenas underline) |
| `/funil` | Header default. Tabela sem typography ambition | Uplift typography + table com display font no número, mono nos labels |
| `/transparencia` | Conteúdo premium ✓ mas H1 default | Uplift H1 pra clamp(40-80px). Adicionar marquee entre WhyItMatters e Footer com keywords "AUDITÁVEL · CIENTÍFICO · BRASIL" |
| `/conta` | Header simples + 7 cards iguais | Uplift typography. Subdividir cards em sections com section-eyebrow lime ("IDENTIDADE", "OBJETIVO", "DADOS", "PRIVACIDADE") |
| `/cvs-adaptados` | Header simples, cards uniformes | Uplift typography + card hero do CV mais recente em destaque (display font no título) |
| `/candidaturas` | Topbar legacy + brand-mark hardcoded | Migrar pra layout `ct-page-header` padrão + uplift inline + STATS counter-up |
| `/meus-dados` | hero 32px hardcoded + sec head numerado | Uplift typography. Substituir "01-04" por section-eyebrow lime + display font |
| `/entrar` | Hero 38px + serif H2 | Uplift hero pra clamp(48-96px). Trocar serif por Plus Jakarta. Substituir `var(--alert)` (rosa) por `var(--accent-cyan)` (lime) no eyebrow |
| `/autoconhecimento` | ✓ Uplift OK | Manter. Considerar refazer disclaimer (P3) com tom mais editorial |
| `/carreira` | ✓ Uplift OK | Manter |
| `/plano` | ✓ Uplift OK | Manter. Score chart poderia ganhar destaque "+5pts este mês" tipo Apple Health |
| `/experimentar` | Onboarding com brand panel ✓ mas heavy CSS inline | OK no curto prazo. Migrar inline pra tokens |
| `/admin` | Não auditei a fundo, mas espera-se default 26px | Não-prioritário (uso interno) |
| **AppShell** | Brand-mark + nav active = branco sem lime | **CRÍTICO:** trocar `--primary` por `--accent-cyan` nas regras de nav active + brand-mark gradient |
| **WelcomeModal** | 3 cores hardcoded fora do brand | **CRÍTICO:** substituir indigo/cyan/purple por accent-cyan + tons de cinza neutro |

---

## Roteiro de teste manual

- [ ] Abrir `/` (landing) em tema noir. Snapshot mental do feel: hero gigante, lime accent, marquee, parallax.
- [ ] Acessar `/dashboard`. Verificar se vibe persiste — sidebar branca quebra? Score ring tem o glow lime?
- [ ] Clicar item da nav `/gaps`. Comparar feel do H1 vs landing. **Atual:** quebra forte (clamp 144px → 26px).
- [ ] Navegar `/dashboard → /carreira → /plano → /autoconhecimento`. Comparar header — ✓ devem ser consistentes (têm uplift).
- [ ] Navegar `/dashboard → /gaps → /concursos → /conta`. **Atual:** quebra hierarquia visual a cada clique.
- [ ] Abrir CopilotWidget (FAB inferior direito). Funciona como detail-polish ✓.
- [ ] Forçar primeiro login (limpar localStorage `ct_welcome_shown`). Ver WelcomeModal. **Atual:** paleta indigo/cyan/purple = brand-break instantâneo.
- [ ] Acessar `/candidaturas` direto. **Atual:** topbar legacy + logo verde-tóxico hardcoded.
- [ ] Acessar `/entrar` em sessão anônima. **Atual:** hero pequeno demais, eyebrow rosa em vez de lime, h2 serif.
- [ ] Acessar `/meus-dados`. **Atual:** hero 32px + sections numeradas "01-04" estilo doc.
- [ ] Acessar `/transparencia`. **Atual:** conteúdo é showcase do moat mas hero subdimensionado.
- [ ] Verificar foco-state em qualquer botão primário. Box-shadow `0 0 0 3px var(--accent-cyan-glow)` ✓.
- [ ] Hover em qualquer card do `/dashboard`. **Atual:** glow cyan aparece em demasia (P1.4).

---

## Microcopy sugerido (top 10 substituições)

| # | Onde | Antes | Depois |
|---|---|---|---|
| 1 | `/entrar` H1 | "Entrar" | "Ative seu gêmeo." |
| 2 | AppShell brand-tag | "SEU GÊMEO DE CARREIRA" | "GÊMEO · AUDITÁVEL · BRASIL" |
| 3 | `/candidaturas` brand-sub | "funil + tracking" | "TODA CANDIDATURA · ZERO PLANILHA" |
| 4 | `/conta` H1 | "Sua conta" | "Suas configurações." (ou eyebrow "CONTA" + H1 ambitious) |
| 5 | `/conta` save name button | "Salvar nome" | "Atualizar perfil →" |
| 6 | `/meus-dados` H1 | "Seus dados, sob seu controle." | "Você controla cada byte." |
| 7 | `/cvs-adaptados` empty | "Nenhum CV adaptado ainda" | "Seu portfólio de CVs começa aqui." |
| 8 | `/oportunidades` sub | "Match em %, transparente." | "Match auditável. Vagas reais. Sem caixa-preta." |
| 9 | `/concursos` H1 sub | "Vagas no setor público brasileiro filtradas..." | "O mercado público BR, sem viés de curso." |
| 10 | WelcomeModal subtitle | "Seu copiloto de carreira em 3 passos simples." | "3 passos. Sem caixa-preta." |

---

## Notas de honestidade (anti-bias)

- **Dashboard, Carreira, Plano, Autoconhecimento, Evidências já estão coerentes** — não preciso refazer. Esses receberam o "Arwen uplift" (clamp + eyebrow lime + spacing generoso).
- **Glassmorphism (`app-glass`) ✓.** Funciona bem no noir, é elemento de continuidade com a landing.
- **CopilotWidget ✓.** Detail polish bem feito (`CopilotWidget.js:343-352`).
- **`/transparencia` ✓ no conteúdo.** É literalmente o showcase do moat. Só falta uplift visual no H1.
- **Score ring `/dashboard` ✓.** Glow cyan + gradient OK.
- **Não há "azuis errados".** O perigo seria se algum componente trouxesse blue/teal genérico. Não encontrei (exceto WelcomeModal hardcoded e candidaturas hardcoded — pontuais).
- **Lúthien NÃO compete com Galadriel (design system) ou Arwen (polish).** Meu fix #1 (AppShell `--primary` → `--accent-cyan` no active) provavelmente cabe a Galadriel. O foco aqui é mapear o gap; a execução é outra wave.

---

## Prioridade de ação (se executar só 3 coisas)

1. **Trocar default `.ct-page-header-title` para `clamp(40px, 6vw, 80px)`** em `globals.css:6171`. Atinge 5 páginas de uma vez. **ROI: máximo.**
2. **AppShell brand-mark + nav active = lime accent.** `components/AppShell.js:86` (BrandMark gradient) + `app/globals.css:1862-1877` (`.appshell-nav-item.active`). **ROI: presença visual contínua em 100% do tempo logado.**
3. **Substituir paleta hardcoded do `WelcomeModal` por accent-cyan + neutros.** Primeiro contato = lima identidade do produto. **ROI: experiência inaugural.**

---

*Lúthien · a mais bela elfa · Wave 9 · pra trazer a beleza da landing pro app logado.*
