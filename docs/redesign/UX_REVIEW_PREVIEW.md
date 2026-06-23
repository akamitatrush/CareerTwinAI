# UX Review — Preview Claude Design (2026-06-22)

## TL;DR

O sistema visual ja esta majoritariamente certo: paleta Indigo Sereno aplicada com consistencia, tipografia Spectral+Plus Jakarta sustenta a vibe "editorial calma", e a sidebar/AppShell e solido. Tres problemas pegam o olho: (1) a tela `/conta` esta fora do sistema visual — usa tokens legados (`--ink`, `--rule`, `--accent`) e fontes erradas (Bricolage, Inter) que nao existem mais como display, criando uma quebra dura quando o usuario navega pra la; (2) o `/dashboard` perde dois elementos do mock que pagavam o "porque confiar" (a comparacao com a mediana de contratados e o "voce esta a X pontos" no card do score) — sem isso, o numero do score fica solto; (3) hovers/focos sao quase inexistentes nos `ct-action-card`, `ct-job-card`, `ct-kpi-card`, `ct-source-card` e `ct-rail-card` — tudo parece estatico, sem affordance de "clicavel" mesmo em itens que sao link.

## Principios que devem nortear o polish

- **Densidade calma.** O mock usa espaco generoso (radius 14-18, padding 18-28, gap 14-22). Manter respiro entre secoes e dentro de cards — o app nao e dashboard de monitoramento de servidor.
- **Hierarquia por tipografia, nao por cor.** Spectral italic pra eyebrow/lede, Plus Jakarta 700-800 pra titulos. Cor primaria so pra valores numericos e CTAs reais.
- **Cor com proposito semantico.** Indigo = scoring/CTA, verde sereno = "voce tem", ambar = "atencao/falta", damasco = avatar. Nunca misturar (ex: badge de "verificado" no `/conta` esta usando `chip tgt` antigo).
- **Affordance honesta.** Se algo e clicavel, hover precisa demonstrar (border-color, lift sutil, ou underline). Se nao e clicavel, nao pode ter `cursor: pointer`.
- **Numero + porque.** Todo numero grande no produto vem com texto explicativo curto. O mock faz isso 5x (subscore tem `why`+`source`, action tem `why`+`impact`, KPI tem label, score tem baseline). Manter esse padrao em tudo.
- **Skeleton > spinner.** Loading do `RadarClient` ja faz skeleton certo. Estender pra outras pags com chamadas async.
- **Empty state convida.** Tres empties existem (`/dashboard`, `/gaps`, `/oportunidades`) — todos com CTA pra `/meu-gemeo`. Manter o tom, mas adicionar ilustracao ou icone pra dar peso visual (hoje sao soh texto centralizado).

## 20 melhorias priorizadas (HIGH → LOW)

### HIGH-impact (1-7)

**1. `/conta` esta inteira fora do sistema visual.**
- **Onde:** `app/conta/page.js:161-583` — usa classes `sec`, `sec-head`, `sec-no`, `sec-title`, `sec-sub`, `hero`, `hero-lede`, `topbar-inner`, `brand`, `tool-btn`, `chip tgt`. Estilos inline com `Bricolage Grotesque`, `Inter`, `JetBrains Mono` e tokens `--ink`, `--ink-faint`, `--rule`, `--accent`, `--surface`. Tudo isso e da direcao visual antiga ("Sienna" / pre-Claude Design).
- **Problema:** O usuario sai de qualquer outra tela (que segue Indigo Sereno + Spectral + Jakarta) e cai numa tela que parece de OUTRO produto. BrandMark da logo usa `stroke="#B9D90C"` (linha 506) — verde-limao que nao existe na paleta nova. Avatar usa `var(--accent)` que mapeia pra primary, mas avatar deveria usar `--avatar-from/--avatar-to` (gradient damasco) como `appshell-avatar` em todas as outras telas.
- **Por que e HIGH:** Quebra de consistencia mais grave do app inteiro. Telefona "produto inacabado". Numa avaliacao senior, e o primeiro red-flag.
- **Fix sugerido:** Refazer a tela usando o mesmo header pattern de `/gaps` (titulo Spectral + sub-text), substituir `sec` por `ct-section-card` (criar variante), trocar `StatCard` inline por `ct-kpi-card`, avatar usar `appshell-avatar` (gradient damasco), remover o `Header` interno (sidebar do AppShell ja faz isso), botoes `btn-primary` continuam mas precisam alinhar com a paleta indigo. Microcopy ja esta otima — soh trocar o invólucro.
- **Esforco:** L (3-4h)

**2. Dashboard hero perde a "ancora do porque confiar" do mock.**
- **Onde:** `app/(app)/dashboard/page.js:134-204` (ScoreRingCol). O mock (`fonte/CareerTwin AI.dc.html:257-264`) tem um bloco DENTRO do score-col mostrando "Mediana de contratados: 78 / Voce esta a 6 pontos da mediana" com mini-bar comparativa.
- **Problema:** Sem essa comparacao, o numero "72/100" fica solto — o usuario nao sabe se 72 e bom ou ruim. O mock resolve isso com o mini-gauge "voce esta a X pontos da mediana".
- **Por que e HIGH:** O score e o elemento mais importante da tela. Sem contexto, vira numero arbitrario. O `ct-score-baseline` ("Baseado em 142 vagas reais") ajuda mas nao calibra.
- **Fix sugerido:** Adicionar abaixo do `ct-score-baseline` (linha 198) uma secao com top-border 1px de `--border`, contendo: label "Mediana de contratados" + valor + mini-bar 200x6 mostrando "voce" (indigo) vs "mediana" (marker damasco) + texto "Voce esta a X pontos da mediana". Dados ja existem ou podem ser calculados de snapshots reais.
- **Esforco:** M (1-2h)

**3. Cards "clicaveis" sem hover/affordance.**
- **Onde:** `globals.css:1635` (`.ct-action-card`), `globals.css:1755` (`.ct-job-card`), `globals.css:1674` (`.ct-kpi-card`), `globals.css:1554` (`.ct-source-card`), `globals.css:1707` (`.ct-rail-card`). Nenhum tem `:hover` definido.
- **Problema:** `ct-action-card` tem CTA "Comecar →" que e link, mas o card inteiro nao reage; usuario espera clicar no card todo (padrao Linear/Notion). `ct-job-card` mesmo problema com "Ver vaga original" — o card nao da feedback. `ct-kpi-card` nao e clicavel mas tem `border` que poderia receber sutil reforco de hover pra dar vida.
- **Por que e HIGH:** App inteiro parece estatico. Falta a vibracao de "produto pulsante" que Linear/Stripe entregam. Quebra a sensacao Claude Design.
- **Fix sugerido:** Adicionar transition + hover pattern uniforme: `transition: border-color 150ms, box-shadow 150ms, transform 150ms` + no hover `border-color: var(--primary-tint); box-shadow: 0 4px 12px -4px rgba(52,53,126,.12); transform: translateY(-1px);`. Em cards que sao link, envolver com `<Link>` e dar cursor pointer.
- **Esforco:** S (30min)

**4. `/transparencia` mistura header inline com `ct-*` patterns — falta de coesao.**
- **Onde:** `app/(app)/transparencia/page.js:51-86` — header com estilos inline (`fontFamily: var(--font-display)`, etc) ao inves de usar `ct-gaps-header` ou criar `ct-transp-header`. H2s nas linhas 90-99, 116-125 tambem inline.
- **Problema:** Quebra a "regra implicita" do codebase: telas usam classes `ct-*`. Esta e a unica que mistura inline + classes. Dificulta manutencao + cria inconsistencia visual sutil (font-size 26 vs `ct-gaps-title` que tambem e 26 — duplicado).
- **Por que e HIGH:** Tecnico, mas reflete na consistencia visual (qualquer ajuste futuro vai precisar mudar dois lugares).
- **Fix sugerido:** Extrair header pro padrao `ct-gaps-header` + `ct-gaps-title` + `ct-gaps-sub` (que ja servem como base reusavel pros titulos secundarios), e criar classes `ct-transp-section-h2` se necessario. Reduzir styles inline a zero.
- **Esforco:** S (30min)

**5. Tela `/conta` exibe header duplicado quando dentro do AppShell.**
- **Onde:** `app/conta/page.js:162` chama `<Header>` (definido em 495-533) que renderiza brand+logo+breadcrumb. Mas `/conta` esta fora da rota `(app)` (esta em `app/conta/`, nao em `app/(app)/conta/`), entao nao tem AppShell — confirmando isso, nao tem sidebar.
- **Problema:** O usuario perde o contexto de navegacao quando entra em `/conta`. Volta pra `/meu-gemeo` por um link minusculo no header. Comparado as outras telas (que tem sidebar+nav fixa), parece "sub-pagina marginalizada". Pior ainda: sidebar do AppShell tem botao "Conta" (`appshell-nav` item) que levaria pra ca — mas la nao tem AppShell.
- **Por que e HIGH:** UX de navegacao quebra. Usuario perde affordance de voltar pra `/dashboard` direto.
- **Fix sugerido:** Mover `app/conta/page.js` pra `app/(app)/conta/page.js` pra herdar AppShell. Apagar funcao `Header` interna. Refazer com padrao das outras telas.
- **Esforco:** M (1-2h, pode bater com fix 1)
- **Nota:** AppShell.js NAV nao inclui "Conta" — adicionar ou manter como acesso por avatar/menu lateral.

**6. Empty states sao todos texto puro — sem peso visual.**
- **Onde:** `globals.css:1597-1599` define `.ct-dash-empty` com so background+border+padding+text-align. Usado em `app/(app)/dashboard/page.js:114`, `gaps/page.js:166,179`, `oportunidades/page.js:39,103,117`.
- **Problema:** "Seu gemeo ainda esta em branco" — texto vazado num card vazio. Comparado a empty states de Linear (icone + texto + CTA + bg ilustrativo) ou Notion (ilustracao SVG), o nosso parece "erro 404 estilizado".
- **Por que e HIGH:** Empty states sao oportunidade de conversao. Usuario novo VAI ver isso. Hoje, sai com sensacao "vazio sem rumo".
- **Fix sugerido:** Adicionar SVG icone 48-60px no topo (paleta indigo, traco fino), aumentar padding (40-48px), titulo Spectral italic eyebrow + h2 forte, dar lift sutil ao CTA, considerar gradient sutil no background (`linear-gradient(180deg, var(--primary-soft) 0%, var(--surface) 60%)`).
- **Esforco:** M (1h pra criar variante reusavel)

**7. Filtros do `/oportunidades` usam `<select>` nativo sem polish.**
- **Onde:** `app/(app)/oportunidades/RadarClient.js:136-198`. `FilterSelect`/`FilterNumber` embrulha `<select>` num botao mas o select nativo aparece on click — dropdown OS-default sem styling.
- **Problema:** Em macOS/Linux/Windows o `<select>` nativo tem visual radicalmente diferente do design system. Quebra o "Linear-grade" prometido.
- **Por que e HIGH:** Filtro e a primeira interacao da tela. Cliclou — dropdown feio aparece. UX-tax visivel.
- **Fix sugerido:** Substituir por Headless UI Listbox ou Radix Select com estilos `ct-filter-menu`, opcoes com hover indigo-soft, item selecionado com checkmark.
- **Esforco:** M (2h por filtro inicial, depois copy-paste)

### MED-impact (8-15)

**8. Sub-scores no `/dashboard` perdem tag/pill colorida do mock.**
- **Onde:** `app/(app)/dashboard/page.js:244-260` vs mock (`fonte/CareerTwin AI.dc.html:274-284` com `sub.pillStyle` + `sub.tag`).
- **Problema:** O mock tem uma `<span style="{{ sub.pillStyle }}">{{ sub.tag }}</span>` ao lado de cada sub-score (provavel "forte", "atencao", "ok") que da leitura semantica rapida. Preview so tem barra.
- **Fix sugerido:** Adicionar pill ao lado do label baseado em faixa de valor (>=70 verde "forte", 50-69 indigo "ok", <50 ambar "atencao").
- **Esforco:** S (30min)

**9. KPI strip do `/gaps` nao tem variacao de cor sutil entre cards.**
- **Onde:** `app/(app)/gaps/page.js:192-227`. So 2 dos 4 KPIs tem `color="attention"|"primary"`.
- **Problema:** Quatro cards visualmente identicos exceto numero. Dificulta scan. Mock varia cor do NUMERO (atencao/primary).
- **Fix sugerido:** Confirmar que o codigo ja varia (`KPICard` tem `color`) — mas verificar visualmente se o impacto e suficiente. Considerar tambem cor sutil no label do KPI mais critico (high priority gaps em ambar muted).
- **Esforco:** S (15min)

**10. Hover dos itens da sidebar e sutil demais.**
- **Onde:** `globals.css:1359` — `.appshell-nav-item:hover { color: var(--text); background: var(--surface-2); }`. Surface-2 (`#FAF9F5`) e quase identico a surface (`#FFFFFF`).
- **Problema:** Em monitor calibrado, o hover quase nao se ve. Linear/Notion tem hover mais definido (10-15% darker da bg).
- **Fix sugerido:** Trocar pra `background: var(--primary-soft)` no hover + adicionar `transition: all 120ms` (hoje so transition de cor).
- **Esforco:** S (5min)

**11. `ct-job-card` no mobile quebra o anel de fit pra full-width.**
- **Onde:** `globals.css:1756` — `@media (max-width: 720px) { .ct-job-card { grid-template-columns: 44px 1fr; } .ct-job-fit { grid-column: 1 / -1; flex-direction: row; gap: 10px; align-items: center; } }`.
- **Problema:** O fit ring vai pra baixo do card em mobile, mas com `grid-column: 1 / -1` ele fica esticado/centralizado. Sem teste em viewport pequeno, o anel "perdido" no rodape parece fora de lugar.
- **Fix sugerido:** Em mobile, mover o anel pro TOPO direito do card (mesma grid cell que logo) reduzindo pra 40px, ou inline-position depois do role. Mantem hierarquia "isto e match X%".
- **Esforco:** M (1h, precisa testar)

**12. Plano: chart com 1 ponto soh mostra texto, sem nenhuma visualizacao.**
- **Onde:** `app/(app)/plano/page.js:162-168`. Quando `points.length === 1`, mostra texto em vez de chart.
- **Problema:** Usuario novo (1 snapshot) ve area gigante em branco com texto "Voce tem 1 snapshot ate agora...". Subutiliza o espaco do card.
- **Fix sugerido:** Renderizar grafico com 1 ponto centralizado + linha horizontal pontilhada na altura do score + texto "Snapshot inicial: 72" como referencia. Visualmente mostra "comecou aqui". E "antecipa" o que vai acontecer quando tiver mais pontos.
- **Esforco:** M (1h)

**13. Timeline do `/plano` nao tem icone visual no dot da application_event.**
- **Onde:** `app/(app)/plano/page.js:362-372`. iconMap para `application_event` usa path de mala (`M3 7a2 2...`) — ok. Mas em mobile (`globals.css:1741-1744`), o dot vira 24x24 — provavel que o icon SVG dentro fique apertado.
- **Problema:** Em mobile, dots ficam menores mas o SVG mantem 13x13 — borda apertada.
- **Fix sugerido:** Reduzir SVG pra 11x11 em mobile via `@media` + dot stroke-width 2.4 (em vez de 2.6).
- **Esforco:** S (15min)

**14. Transparencia: PrincipleCard ocupa muita altura sem chamar atencao pro CTA implicito.**
- **Onde:** `app/(app)/transparencia/page.js:136-189`. Card gradient com 2 cols mas sem nenhum link/cta pra "ver formula".
- **Problema:** Card e visualmente lindo (gradient indigo) mas nao guia. O usuario rola e ve a formula — mas se nao rolar, perde.
- **Fix sugerido:** Adicionar mini-CTA no final do card "Ver a formula completa abaixo ↓" com smooth-scroll pra `<h2>` da formula. Da peso de "tem mais aqui".
- **Esforco:** S (20min)

**15. Cargo-alvo pill no header vira `<select>` no `/conta` — affordance dividida.**
- **Onde:** Dashboard (`page.js:60-80`) e Gaps (`page.js:120-140`) usam `<Link href="/conta">` com pill. Mas em `/conta` mesmo, o targetRole tem form proprio.
- **Problema:** Usuario clica no pill esperando edit inline rapido. Vai pra `/conta`, rola ate secao 02, edita. 3 cliques pro que deveria ser 1.
- **Fix sugerido:** Implementar edit-in-place no pill (clica → vira input → enter salva). Ou abrir modal centralizado. Mantem pill como link pra usuarios que querem ver mais opcoes.
- **Esforco:** L (2-3h)

### LOW-impact (16-20)

**16. `.ct-fit-num` no `JobCard` nao tem cor adaptativa por faixa de fit.**
- **Onde:** `globals.css:1774` e `RadarClient.js:303`. O ring SVG tem cor adaptativa (`fit >= 70 ? positive : ...`) mas o numero CENTRAL fica `var(--text)`.
- **Problema:** Inconsistencia sutil: ring verde mas numero preto. Mock provavel pinta tudo na cor.
- **Fix sugerido:** Pintar `ct-fit-num` com mesma `fitColor`. Adicionar prop ou className.
- **Esforco:** S (10min)

**17. `ct-skill-chip` no `/dashboard` tem styling diferente do `/gaps`.**
- **Onde:** `globals.css:1662` (`.ct-skill-chip`) — background `surface-2`. No `/gaps` skill rail (`globals.css:1713` `.ct-skill-chip.have`) — verde positive. Em telas diferentes, mesma palavra "Python" pode aparecer cinza ou verde.
- **Problema:** Consistencia visual — usuario aprende "verde = tenho" no `/gaps` mas no dashboard a chip e neutra. Sub-otimo pra reconhecimento rapido.
- **Fix sugerido:** Padronizar: chip de "skills do perfil" sempre verde no `.have` style; chip neutra so pra tags genericas (ex: job-chip de local/salario).
- **Esforco:** S (15min)

**18. Tooltips ausentes em truncated strings.**
- **Onde:** `.appshell-user-role` (`globals.css:1414-1420`) tem `text-overflow: ellipsis`. Em mobile com cargo-alvo longo ("Engenheira de Software Senior em ML Platform"), corta. Tem `title={targetRole}` no `AppShell.js:224` mas nao em outros pontos.
- **Problema:** Truncamento em `ct-rail-missing-name`, `ct-profile-loc`, `ct-job-role` (sem ellipsis configurado) — texto pode quebrar feio.
- **Fix sugerido:** Adicionar `text-overflow: ellipsis; white-space: nowrap; overflow: hidden` + `title` attribute nos elementos relevantes.
- **Esforco:** S (15min)

**19. `/transparencia` LGPDBanner usa mesmo pattern do AppShell sidebar — duplica visualmente.**
- **Onde:** `app/(app)/transparencia/page.js:322-349` (`.ct-lgpd-banner`) e `components/AppShell.js:195-216` (`.appshell-lgpd-card`). Ambos sao indigo-soft + indigo-tint border + icone escudo + texto sobre LGPD.
- **Problema:** Usuario na pagina de transparencia ve banner duplicado (um na sidebar, outro no rodape do conteudo). Duplicacao sem ganho.
- **Fix sugerido:** Em `/transparencia`, dar mais peso/contraste ao banner (talvez gradient sutil ou maior) e remover redundancia conceitual — ou esconder sidebar LGPD card so nessa pagina.
- **Esforco:** S (15min)

**20. Sem `motion-safe` checks em animacoes de skeleton e bar-fill.**
- **Onde:** `globals.css:149` tem `@media (prefers-reduced-motion: reduce){ *{animation:none!important; transition:none!important;} }` que pega geral — bom. Mas verificar se transitions de bar (`ct-ss-bar-fill` 800ms, `ct-req-bar-fill` 600ms) entram nesse override (entram, ok). So que skeleton (`ctShim` 1.4s) tambem para — entao loading vira "card cinza estatico" sem affordance.
- **Problema:** Usuario com prefer-reduced-motion ve "tela travada" no loading do RadarClient.
- **Fix sugerido:** Adicionar fallback skeleton com border pulsante MUITO sutil (opacity .9 ↔ 1, 1.4s) ou trocar pra texto "Carregando vagas..." quando reduced-motion ativo.
- **Esforco:** S (20min)

## Por tela — review focado

### /dashboard (`app/(app)/dashboard/page.js`)

- **Pontos fortes:** Hero ring com gradient indigo + numero tabular bem feito. Header com Spectral italic eyebrow ("Bom te ver de volta") + Plus Jakarta bold ("Ola, Mariana") aplica direcao visual perfeitamente. Pill de cargo-alvo no canto e elegante. Two-col actions + profile snapshot funciona.
- **Pontos fracos:** (a) score ring sem ancora "mediana de contratados" (mock tem); (b) sub-scores sem pill de tag (mock tem `sub.tag`); (c) profile snapshot avatar usa initial — sem upload visual de foto; (d) sem hover affordance nos action cards.
- **Quick wins (S):** Adicionar pill no sub-score (#8), hover no action card (#3), padronizar skill chip (#17).
- **Melhorias estruturais (M-L):** Mediana de contratados gauge (#2), evolver hover dos cards (#3).

### /gaps (`app/(app)/gaps/page.js`)

- **Pontos fortes:** KPI strip clara, 4 cards com numeros grandes legiveis. Requirements list usa dot+name+status pill (pattern claro "you have / missing"). Skill rail direita esta organizada.
- **Pontos fracos:** (a) Lista de 18 requirements pode ficar longa sem agrupamento ou filtro; (b) bar-fill tem cor mas falta gradiente sutil; (c) row tem `padding-left: 18` no foot mas nao no head — leve descompasso visual; (d) "ordenado por frequencia" subtitle e pequeno demais (`.ct-req-sub` 11px).
- **Quick wins (S):** Padronizar bar gradient (verde/ambar com gradient como indigo), aumentar `.ct-req-sub`, padronizar padding interno do row.
- **Melhorias estruturais (M-L):** Adicionar filtro "mostrar so faltantes / so que tenho" (cima da lista), agrupamento por categoria de skill (technical/soft/tool).

### /oportunidades (`app/(app)/oportunidades/page.js` + `RadarClient.js`)

- **Pontos fortes:** Loading skeleton implementado certo (`ct-loading-skeleton`). Job card tem hierarquia clara (logo+titulo+meta+tags+why+actions+ring). Cor adaptativa no ring por fit.
- **Pontos fracos:** (a) Selects nativos quebram (#7); (b) tags `have`/`missing` no card podem ficar muitas — sem limit visual ate 3+2 (codigo tem); (c) `cursor: pointer` no `.ct-filter-btn` mas o select dentro abre dropdown OS — UX confusa; (d) sem ordenacao visivel ("mais recentes" / "maior match") fora do filtro de aderencia min.
- **Quick wins (S):** Padronizar fit-num color (#16), tooltips no truncated job role.
- **Melhorias estruturais (M-L):** Trocar select por dropdown custom (#7), adicionar sort visible.

### /plano (`app/(app)/plano/page.js`)

- **Pontos fortes:** Chart SVG manual e elegante e proporcional. Logica de escala adaptativa (`span = max(10, rawMax-rawMin)`) e madura — evita "linha lisa" e "expansao demais". Timeline com dot colorido por type + tag colorida e legivel. Density boa.
- **Pontos fracos:** (a) Chart com 1 ponto so vira "texto" — desperdicio (#12); (b) timeline em mobile pode apertar a coluna de data (`70px`); (c) sem zoom/hover no chart pra ver detalhes do snapshot; (d) sem filtro por type (gap/plan/diagnosis/application).
- **Quick wins (S):** Reduzir SVG dot em mobile (#13).
- **Melhorias estruturais (M-L):** Render single-point gracefully (#12), adicionar tooltip no hover dos pontos do chart.

### /transparencia (`app/(app)/transparencia/page.js`)

- **Pontos fortes:** PrincipleCard com gradient indigo + 2 cols (calculo / explicacao) e o card visualmente mais bonito do app. FormulaTable com peso + label + bar + texto explicativo cobre transparencia bem. DataSourcesGrid 3 cards limpa. LGPDBanner fecha bem.
- **Pontos fracos:** (a) Mistura inline + classes (#4); (b) PrincipleCard ocupa muito sem CTA (#14); (c) LGPDBanner duplica com sidebar (#19); (d) sem visualizacao alternativa da formula (ex: pie chart dos pesos pra quem nao quer ler tabela).
- **Quick wins (S):** Mini-CTA no PrincipleCard (#14), refinar LGPD vs sidebar (#19).
- **Melhorias estruturais (M-L):** Extrair classes (#4).

### /conta (`app/conta/page.js`)

- **Pontos fortes:** Server actions com Zod strict (`.strict()`) sao corretas. Microcopy em pt-BR e excelente ("Email e fixo — para trocar, fale com o suporte"). Estrutura logica em 6 secoes numeradas e clara.
- **Pontos fracos:** TUDO visual. Esta tela inteira foi escrita ANTES da Direcao Indigo Sereno. Usa Bricolage, Inter, `--ink`, `--rule`, `--accent` (que mapeia mas mantem visual antigo), Header proprio (sem AppShell), avatar cores erradas (`accent` em vez de `avatar-from/to`), forms com border-radius 4 (vs `radius-sm: 8` do sistema novo), botoes `tool-btn` (do sistema antigo).
- **Quick wins (S):** Nenhum, refactor inevitavel.
- **Melhorias estruturais (M-L):** Refactor inteiro (#1, #5). Esta e a maior divida visual do app.

## Padroes transversais detectados

- **Empty states:** Consistentes no codigo (`.ct-dash-empty`) mas falhos no visual — text-only, sem icone/ilustracao. Carente de "convite" (#6).
- **Loading states:** Apenas `RadarClient` tem skeleton (`.ct-loading-skeleton` + `.ct-skel-card` + `ctShim`). `/dashboard`, `/gaps`, `/plano`, `/transparencia` sao server components — sem skeleton porque streaming. OK em principio, mas durante navegacao client-side o usuario ve "flash branco" porque nao tem `loading.js`. Adicionar `app/(app)/{rota}/loading.js` com skeleton seria win medio.
- **Error states:** `RadarClient` exibe error inline. `/conta` mostra banner `.err` quando `searchParams.erro === "1"`. Outras rotas confiam em fallback Next padrao — sem error boundary customizado por rota.
- **Hover/focus:** Hover ausente em quase tudo (#3, #10). Focus-visible esta global (`globals.css:153-156`) — outline 2px var(--text) — funcional mas visualmente agressivo (preto solido em vez de indigo).
- **Tipografia:** Sistema dual Spectral+Plus Jakarta funciona MUITO bem onde aplicado. Mas `/conta` usa Bricolage+Inter — quebra. Tamanhos sao consistentes nos `ct-*`: 11-13 sub-text, 13.5-15.5 body, 18-28 titulos, 26-48 numeros tabulares. Bom.
- **Cores semanticas:** Aplicacao consistente (indigo=score/CTA, verde=positive, ambar=attention, damasco=avatar). Exceto em `/conta` (#1).

## Comparacao com mock

**Onde o preview esta MELHOR que o mock:**
- Skeleton de loading no `RadarClient` (mock nao mostra esse estado).
- Empty states com texto pt-BR humano (mock e placeholder).
- Logica de chart adaptativa em `ScoreChart` (#12 do plano) — mais robusta que o SVG hardcoded do mock.
- Defesa contra dados ausentes (`ct-formula-row` mostra "—" se snapshot vazio; `gaps` tem `noTarget`/`noJobs` separados).

**Onde esta PIOR que o mock:**
- Mediana de contratados no `/dashboard` hero (#2) — mock tem, preview perdeu.
- Pill de tag em sub-scores (#8) — mock tem, preview soh barra.
- `/conta` inteiro — mock provavel nao tinha essa tela (ou tinha diferente).
- Filtros do `/oportunidades` com select nativo (#7) — mock tem visual custom mas e fake (`<button>` com `<strong>` dentro, sem dropdown real).

**Onde IGUAL:**
- Toda a estrutura visual de header, KPI strip, requirements list, skill rail, timeline. Job card. Formula table. Principle card. Data sources grid.

## Recomendacoes pra o proximo polish

1. **Refazer `/conta` no sistema Indigo Sereno (HIGH-1).** E a maior divida visual do app. Sozinho, esse refactor sobe o "score percebido" do produto inteiro porque cobre rota frequente (config de cargo, LGPD, logout).
2. **Adicionar hover/focus pattern uniforme em todos `ct-*-card` (HIGH-3).** 30min de trabalho que faz o app "respirar" — diferenca entre "produto polido" e "produto OK".
3. **Reincorporar mediana-de-contratados no dashboard hero (HIGH-2).** Da contexto ao score, calibra expectativa, e visualmente bonito.
4. **Padronizar empty states com icone + CTA reforcado (HIGH-6).** Empty states sao oportunidade de conversao — hoje sao texto vazado.
5. **Trocar selects nativos do `/oportunidades` por dropdown custom (HIGH-7).** Filtro e primeira interacao da tela; UX-tax visivel hoje.

Tempo total estimado pra atacar as 5 frentes: **8-12h focadas**. Resultado seria um app que passa por Linear/Stripe-grade na vibe Claude Design.
