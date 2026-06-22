# Review: Implementation Bugs (Report.js + Home)

## TL;DR
O bug do "44 / sub-scores em 0" reportado pelo owner não é um glitch transitório de animação — é arquitetural: o gauge usa `liveOverall` (calculado direto de `diag.sub_scores`) enquanto cada sub-score é gateado por um state `reveal` que começa em 0 e literalmente injeta a string "0" no DOM. Isso quebra SEO, screen reader, copy-paste e usuários com JS off ou animações desabilitadas (`prefers-reduced-motion`). Outros achados: o `match: 0` nas vagas é semanticamente legítimo (vem de cálculo determinístico) mas é renderizado sem contexto/cor diferenciada, parecendo bug; texto do rodapé está completo no source — provavelmente truncamento visual por overflow horizontal em viewports estreitos; e a lógica do wizard tem race com SSR/hidratação.

---

## Bug A1: Sub-scores mostram "0" durante o reveal (HIGH)

- **Onde:** `components/Report.js:33`, `:38-48`, `:132`, `:138`, `:140`
- **Causa raiz:**
  - Linha 33: `const [reveal, setReveal] = useState(0);` — estado inicial é zero.
  - Linha 38-48: `useEffect` enfileira `requestAnimationFrame` + 5 `setTimeout` (320/540/760/980/1200 ms) para escalar `reveal` de 1 até 6.
  - Linha 132: `const ssRevealed = reveal >= 2 + idx;`
  - Linha 140: `<span className="ss-val">{ssRevealed ? v : 0}</span>` — quando `ssRevealed` é falso, renderiza o **literal numérico `0`**, não o valor real.
  - Linha 138: mesmo padrão na barra (`width: ssRevealed ? v + "%" : "0%"`), mas aí é só CSS visual.
- **Impacto:**
  - **SEO/crawler estático:** bot que não roda JS (ou roda mas não espera 1.2s) vê quatro "0".
  - **Screen reader:** o nó de texto muda de "0" para o valor real após delay. Em leitores que anunciam mudanças (modo browse ou aria-live ancestral), você ouve "0... 0... 0... 72". Mesmo sem aria-live, o snapshot inicial lido é "0".
  - **Copy-paste durante animação (≤1.2s):** se o usuário copiar a tela inteira nesse intervalo, sai "0".
  - **JS desabilitado / `prefers-reduced-motion`:** `globals.css:113` zera todas as transições com `!important`, mas a animação aqui é via `setTimeout` em JS — quem desabilitou animação ainda paga o preço do delay. E se JS estiver off (caso patológico), fica "0" pra sempre.
  - **Inconsistência interna grave:** o `gauge-num` (linha 116) e `seam-score` (linha 80) já mostram `liveOverall` **sem gating** — então o usuário vê 44 no gauge e 0/0/0/0 logo abaixo. É exatamente o sintoma reportado pelo owner.
- **Fix recomendado:**
  - **Opção 1 (preferida): renderizar valor real desde sempre, animar via CSS.**
    Trocar `{ssRevealed ? v : 0}` por `{v}`. A barra (`ss-fill`) pode continuar animando largura (zero → v%) via `transition: width` que já existe na linha 534 do CSS. O número deve ser estático e correto. Para reaproveitar o efeito de "rise/fade" das barras, usar `transition: opacity` no `.ss` (já existe em `globals.css:521-522`, basta remover o gating em JS e deixar a classe `.ss-revealed` aplicada via `useEffect` curtinho ou animar com `@keyframes` direto). Prós: sem regressão SEO/a11y, valor sempre correto, código mais simples. Contra: leve perda de "drama" sequencial das 4 barras, mas pode ser recuperado com `transition-delay` no CSS.
  - **Opção 2: `useLayoutEffect` zerando o reveal antes do paint.** Trocar `useEffect` por `useLayoutEffect` e setar `reveal = 5` (todos revelados) sincronamente; depois, opcionalmente, fazer fade-in com CSS. Prós: mínimo refactor. Contra: continua sendo "client-only" — o HTML inicial via SSR (este componente é `"use client"`, mas Next ainda renderiza no servidor a primeira passada do tree até o client boundary; a página `app/page.js` é `"use client"` então não há SSR útil aqui, mas o problema de copy-paste/SR continua menos crítico).
  - **Opção 3: SSR do valor inicial + `dangerouslySetInnerHTML` ou `noscript` fallback.** Exagero pro caso — não vale o custo.
- **Recomendação final:** **Opção 1**. O número é cálculo determinístico que veio do servidor (`diag.sub_scores[k].valor`), não há razão para esconder isso. A animação é puro brilho — deve ser desacoplada do estado-fonte-da-verdade.

---

## Bug A2: "0 match" em cards de vaga (MEDIUM)

- **Onde:** `components/Report.js:247` (`<span className="match-num">{v.match}</span>`)
- **Causa raiz:** O cálculo em `lib/skills-taxonomy.js:76-90` retorna `match: 0` quando não há overlap entre `profileSkills` e `jobSkills` (linha 79: `if (!p.size || !j.size) return { match: 0, ... }`). Não é bug do cálculo — é renderização sem contexto.
- **Impacto:**
  - Visualmente o "0 match" parece um bug (especialmente porque o `.match-num` tem fundo `var(--accent)` verde-lima, com a mesma ênfase de matches altos — vide `globals.css:680-690`).
  - O usuário pode pensar que a vaga apareceu por engano. Pior: parece inconsistente com a copy da seção (`"Vagas onde você tem chance real"`, linha 209) — se o match é 0, não há "chance real".
  - As vagas com match 0 só aparecem se o sort em `app/api/opportunities/route.js:87` (`b.match - a.match`) deixar empatadas no topo após o slice de 3.
- **Investigação adicional:** O filtro de vagas não exclui `match === 0`. Em mercados pequenos / cargo muito específico, as 3 vagas no top podem todas ser 0.
- **Fix recomendado:**
  - **Opção 1 (preferida):** filtrar `enriched = enriched.filter((j) => j.match > 0)` antes do sort no `route.js:87`. Se sobrar zero vaga, cai no fluxo "nenhuma vaga voltou" (`Report.js:186`). Prós: alinha com o promessa da seção.
  - **Opção 2:** renderização condicional no card. Em `Report.js:247`, se `v.match === 0`, esconder o pill e mostrar uma badge "match indireto" ou similar. Prós: preserva exposição da vaga. Contra: pode parecer trapaça.
  - **Opção 3:** mostrar `match` mas com classe diferente (cinza) quando ≤ 20%, deixando claro visualmente.
- **Recomendação final:** **Opção 1**. A seção promete "chance real"; vagas com 0% não cumprem o contrato. Se sobrarem só vagas 0, mostre o estado vazio honesto.

---

## Bug A3: Texto cortado no rodapé (LOW — provavelmente visual, não no source)

- **Onde:** `components/Report.js:299-310`, `.transp` em `app/globals.css:806-815`
- **Investigação:** Lendo o source na linha 308 (`Princípio do produto: número = cálculo, texto = explicação com fonte.`), o texto está **completo** — não há truncate em JS nem `text-overflow: ellipsis` no CSS da `.transp`. A classe tem `max-width: 62ch` (linha 811), o que é apenas largura máxima, não corte.
- **Hipótese 1 (mais provável):** O owner viu o texto cortado por screenshot/seleção em viewport estreito onde o `.rep-foot` (linha 799-805) tem `display: flex; justify-content: space-between; flex-wrap: wrap` — em larguras médias, o botão "Construir outro gêmeo" fica na mesma linha e o `<p>` é espremido. Como `<p>` não tem `min-width: 0` e nem `flex-shrink: 1` explícito, em alguns navegadores a quebra de palavra falha em palavras compostas com pontuação (`explicação.`).
- **Hipótese 2:** O footer aparece em duas variantes — quando `footerNote` prop é passada (em `app/meu-gemeo/page.js:97-103`) é um React fragment com `<Link>`; quando não, é o texto longo. Em ambos os casos, o source está íntegro.
- **Hipótese 3 (revisitar):** `app/page.js:401` tem `<style jsx global>` com regras que conflitam com a `globals.css`. Não vi override de `.transp` lá, mas valeria conferir live (não posso rodar).
- **Fix recomendado:**
  - **Opção 1 (preferida):** ajustar `.rep-foot` (linha 803) adicionando `align-items: flex-start` e dando ao `.transp` `flex: 1 1 320px`, garantindo quebra antes do botão concorrer pelo espaço. Adicionar `word-break: normal; overflow-wrap: anywhere;` na `.transp`.
  - **Opção 2:** quebrar `.rep-foot` em duas linhas explícitas em viewports < 768px via media query.
- **Recomendação final:** **Opção 1**. Sem mexer no markup, só ajuste de CSS.

---

## Outros bugs encontrados (priorizados)

### B1: Wizard pode reaparecer em SSR/hidratação inicial (LOW)
- **Onde:** `app/page.js:22-29`
- **Causa:** `const [showWizard, setShowWizard] = useState(false);` + `useEffect` que lê `localStorage` e seta para `true` se não encontrou flag. Como o estado inicial é `false`, **o HTML servidor não renderiza o wizard nunca**. No client, depois do paint, ele aparece com um "pop-in" se for primeira visita. Não é bug funcional, mas é uma piscada visual e o wizard pode parecer "reaparecer indevidamente" se o usuário voltar e o `useEffect` rodar de novo após algum reset de localStorage por outro código (não vi nenhum, mas é frágil). Confirmei: não há outro lugar que escreva `ct_seen_wizard_v1`.
- **Fix:** inicializar o estado lendo localStorage com `useState(() => { ... })` com guard de `typeof window`, ou aceitar o pop-in (atual). Para evitar erro de hidratação, o atual padrão (`useState(false)` + `useEffect`) é o correto em Next.js — só não é ideal de UX.

### B2: Inconsistência: gauge não usa o gate `reveal`, sub-scores usam (HIGH — relacionado a A1)
- **Onde:** `Report.js:80` (`{liveOverall}`), `Report.js:116` (`{liveOverall}`), vs. `Report.js:140` (`{ssRevealed ? v : 0}`).
- **Causa:** Decisão inconsistente — `liveOverall` é renderizado sempre, enquanto `v` (sub-scores) é gateado. Isso é exatamente o que causou o sintoma reportado: 44 no gauge, 0 abaixo.
- **Fix:** parte do mesmo refactor do A1 (Opção 1).

### B3: `liveOverall` recalculado em todo render mesmo sem `completed` mudar (LOW)
- **Onde:** `Report.js:52-64`
- **Causa:** `baseVals`, `liveVals`, `liveOverall` são recriados a cada render. Mexer em `open[k]` (abrir/fechar accordion) força recálculo de todos os scores. Não tem custo real (4 multiplicações), mas mistura concerns.
- **Fix:** `useMemo` para `liveOverall` e `liveVals` com deps `[diag, completed]`. Não é bloqueante.

### B4: `gauge-arc` animação CSS depende do paint inicial (LOW)
- **Onde:** `Report.js:114`, `globals.css:472`
- **Causa:** O `strokeDashoffset = CIRC` no início (linha 66: `gaugeOff = animated ? ... : CIRC`) e a transição CSS de 1.1s anima o arco. Funciona bem, mas se `animated` for `false` no primeiro paint (SSR ou primeira passada do client), o arco fica vazio. Em `prefers-reduced-motion`, `globals.css:113` desliga a transição — então o arco aparece direto na posição final, mas o número `liveOverall` (linha 116) já estava lá. Sem regressão grave.

### B5: `splitSrc` usa regex que pode falhar com colchetes aninhados (LOW)
- **Onde:** `Report.js:13-17`
- **Causa:** `s.match(/\[(.+?)\]\s*$/)` — match não-guloso até último `]`. Se a explicação tiver `"texto [com [colchete] interno] [Fonte]"`, capta `Fonte` correto, mas se for `"texto [tudo aqui]"`, capta `tudo aqui` como fonte. Confia que o LLM sempre coloca `[Fonte]` no final — frágil mas funciona com prompts atuais.
- **Fix:** validar formato esperado, ou usar lista fixa de fontes (`[Currículo]`, `[Mercado]`, `[Base de Vagas]`) com regex específica.

### B6: Modais sem trap de foco / restore (MEDIUM a11y)
- **Onde:** `Report.js:313-315` (`InterviewModal`, `ChatModal`, `TailorModal`)
- **Causa:** Não consegui verificar internamente sem abrir os arquivos, mas o padrão "monte modal por boolean, sem `<dialog>` nativo nem `aria-modal`" é comum em Next + JSX manual. Vale auditar separadamente.

### B7: `gauge-num` e `seam-score` não têm `aria-label` (MEDIUM a11y)
- **Onde:** `Report.js:80`, `Report.js:116`
- **Causa:** Screen reader lê só "44" sem contexto ("44 de quê"). O número é isolado em `<div>` / `<span>`.
- **Fix:** envolver com `aria-label="Career Health Score: 44 de 100"` ou usar `<span class="sr-only">` antes.

### B8: `ss-fill` width não recalcula em re-medição (LOW)
- **Onde:** `Report.js:138`
- **Causa:** width inline em string, transição CSS. Se `liveVals[k]` mudar (gap completado), a transição não é fluida porque o `style` recalcula em string. Não tem flicker visível.

### B9: Botão "Concluir +pts" toggle silencioso (LOW UX/a11y)
- **Onde:** `Report.js:176`
- **Causa:** Não tem `aria-pressed` para indicar estado "toggle". Screen reader não anuncia "concluída" como toggle.
- **Fix:** `aria-pressed={done}`.

### B10: `v.url` aberto em `_blank` sem feedback se for null (LOW)
- **Onde:** `Report.js:255-258`
- **Causa:** já tem `{v.url && ...}` — ok. Sem bug.

---

## Acessibilidade (consolidado)

- **A1, B2, B7:** sub-scores e gauge sem `aria-label`/contexto; valores aparecem como "0" durante reveal. **Crítico.**
- **B6:** modais sem `role="dialog" aria-modal="true"` e sem focus trap. **Crítico — auditar separadamente.**
- **B9:** botão de concluir microação não anuncia estado toggle. **Médio.**
- **Foco visível:** `globals.css:117-119` tem `:focus-visible` outline 2px — global, bom. Mas o `.tool-btn` (linha 1 do botão "Treinar entrevista" em Report.js:93) usa `currentColor` no SVG e o contraste do outline pode falhar em modo escuro. Não verificado.
- **Tooltip do `info-tip` (`app/page.js:182-189`):** abre em `:focus` (globals.css:185) mas o `::after` pseudo-element não é lido por screen reader como conteúdo (não está no DOM acessível). O `aria-label` na linha 185 só dá o título, não o texto do `data-tip`. **Bug a11y: o tooltip é invisível para screen reader.**

## Performance

- **B3:** recálculos a cada toggle de accordion. Trivial, não bloqueia.
- **Page.js useEffect L38-47 (`fetch /api/auth/session`):** pode ser cacheado entre navegações, mas não há `swr`/`react-query`. Em desenvolvimento, vai bater em toda mount da home. Não crítico.
- **`useEffect` L24-29 e L38-47 e L50-57 separados:** três useEffect em sequência, com deps `[]` ou `[stage]`. Ok.
- **Não vi loops infinitos.** Os timers no `useEffect` de reveal têm cleanup correto (linha 44-47).
- **`liveOverall`/`liveVals` recalculados:** ver B3. Não impacta UX.

---

## Inconsistências encontradas

1. **`liveOverall` aparece em 3 lugares (gauge, seam, headline-delta) sem gate; sub-scores têm gate** — A1/B2.
2. **`splitSrc` regex permissiva** — B5, frágil mas tolerável.
3. **`opp?.illustrative` vs `opp?.sources?.length`:** `Report.js:303-307` — texto do rodapé tem três variantes (illustrative, com sources, nenhum). Se `opp.illustrative` for `true` E `opp.sources.length > 0`, mostra só "ilustrativas" e omite as fontes. Provavelmente é o esperado, mas pode confundir.
4. **`effortClass` (linha 18-20) usa `String.replace` em range Unicode** — `[̀-ͯ]` parece um bloco de marcas diacríticas, mas a edição inline no source pode ter "comido" caracteres. Funciona pra remover acento de "Médio" → "Medio". Não bug, só leitura ruim.
