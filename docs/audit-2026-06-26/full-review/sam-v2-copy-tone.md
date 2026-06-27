# Sam v2 — Copy & tone audit (2026-06-26)

Escopo: `app/**`, `components/**`, `lib/email/**`. Foco em copy visível ao usuário (não comentários de código). Auditoria research-only — zero edição.

## TL;DR

- **Jargão coach**: 3 ocorrências críticas de "jornada" (incluindo banner de dashboard) — leve para o stack, mas conflita com o posicionamento "diagnóstico, sem mentor motivacional".
- **Inconsistências terminológicas**: 8 conceitos com 2+ variantes ativas (gap/lacuna/Análise de gaps; análise/diagnóstico/avaliação; vagas/oportunidades; score/pontuação; CV/currículo; gêmeo/snapshot/diagnóstico; concluir/marcar/desfazer; refresh/atualizar/recalcular).
- **Microcopy a melhorar**: ≥12 itens (empty states genéricos, loading "Carregando…", erro raiz "Algo deu errado", "Tente novamente" replicado em 15+ endpoints sem variação útil).
- **CTAs fracos**: 4 ("Ver como funciona", "Tentar de novo", "Tentar com outro email", "Mais tarde" no Welcome).
- **PT-BR**: 1 página inteira sem acentuação (`/estagios`) + página `/funil` parcialmente sem acentos. Pequenos lapsos `e-mail` vs `email`. Mistura "match" (EN) com "aderência" (PT) no mesmo produto.
- **A11y textual**: aria-labels majoritariamente em PT-BR, mas alguns com lapsos de acento ("Caracteristicas dos assessments", "Matriz DISC com posicao do usuario") — confusão pra leitor de tela em PT-BR.

---

## 1. Tom e jargão

| Termo | Ocorrências | Arquivos:linha |
|---|---|---|
| "jornada" | 3 | `app/(app)/plano/page.js:298` ("sua jornada se constrói visualmente nesta timeline"), `app/(app)/estagios/page.js:81` ("Oportunidades pra comecar sua jornada"), `components/DashboardHighlightBanner.js:26` ("Comece sua jornada de carreira hoje") |
| "merece um copiloto" / "chegar lá" | 1 | `app/experimentar/page.js:398` ("Sua carreira merece um copiloto que te ajude a chegar lá.") — frase de marketing genérica em onboarding |
| "Comece sua jornada de carreira hoje" + "comece a evoluir" | 1 banner | `components/DashboardHighlightBanner.js:26-27` — combo coach completo no banner do dashboard |
| Promessas vagas sem âncora ("Tudo o que outras ferramentas escondem") | 1 | `components/site/SiteFeatures.js:178-180` — funciona como provocação editorial mas é a única vaga aceitável da landing |
| "Você pode reproduzir cada cálculo no papel" / "Conselho com fonte" / "Você é o cliente, não o produto" / "Sem viés comercial" | 6 quotes | `components/site/SiteFeatures.js:13,17,29,38,42,54,66,79` — itálicos como manifesto, mas "Você é o cliente, não o produto" tem cheiro de slogan ativista; ok pro tom anti-bigtech, mas marca o lado |
| Exclamações em microcopy | 2 | `components/site/WelcomeModal.js:157` ("Bem-vindo ao CareerTwin AI" + `lib/email/welcome-template.js:47` `Olá, ${first}!`), `app/(app)/cvs-adaptados/CvDetailClient.js:71` (`alert("Copiado!")`), `app/(app)/conta/CvAnalyzer.js:305` (`"Copiado!"`) — toleráveis, mas o `alert()` é o pior dos mundos |

**Pontos positivos** (anti-coach já presentes):

- Landing FAQ usa registro frio e factual (`components/site/SiteFaq.js:13-42`) — bom benchmark.
- Pricing assume tom anti-retenção: "Cobramos pelo valor real — não pela retenção forçada. Cancele quando quiser." (`SitePricing.js:138`) — coerente.
- `SiteHowItWorks.js:124-126`: "Três passos. Sem ginástica mental." — registro seco, sem mentor.
- `verify-request/page.js:71`: "Sem senha pra lembrar." — útil + casual sem ser coach.

**Sinal de alerta**: o único lugar onde o tom DESEMBESTA é `DashboardHighlightBanner.js` (variante `noStreak`) — "Comece sua jornada / Marque sua primeira microação e comece a evoluir". Quebra o resto.

---

## 2. Consistência terminológica

| Conceito | Variantes encontradas | Recomendação |
|---|---|---|
| Análise principal | `diagnóstico` (114 ocorrências) · `análise` (29) · `avaliação` (4) | **Padronizar "diagnóstico"** — já dominante; "análise" só aceito como verbo ("analisar bullets do CV"). `app/(app)/gaps/page.js:17,187` chama "Análise de lacunas"; `components/AppShell.js:17` chama "Análise de gaps". Idealmente "Diagnóstico de gaps" ou só "Gaps". |
| Espaço entre perfil e mercado | `gap` (label de menu) · `lacuna` (UI texto corrido + email cron) · `Gaps` (Welcome card) | **Padronizar "gap"** como termo curto técnico (label e KPI), permitir "lacuna" só em texto longo editorial. Hoje: `app/(app)/gaps/page.js:187` "Análise de lacunas" + `components/AppShell.js:17` "Análise de gaps" no menu lateral. Quebra reconhecimento. |
| Tarefa atômica | `microação` (UI BR) · `microacao` (cron, comentários, code paths) · `gap.microacao` (campo DB) | **Padronizar "microação"** sempre que for visível ao usuário. `app/api/cron/daily-briefing/route.js:316` "continue evoluindo as microacoes" vai pro briefing sem acento. |
| Nota composta | `score` (114+ ocorrências) · `Career Health Score` (oficial) · "pontuação" (0 — bom) · `nota` (em outros sentidos só) | **Padronizar "Career Health Score" no 1º uso, "score" nas próximas**. Hoje OK. |
| Vagas | `vagas` (label de UI) · `oportunidades` (URL `/oportunidades`, header `RADAR · OPORTUNIDADES`) · `Radar de vagas` (botão) | **A URL diz `/oportunidades` mas a UI fala "vagas" em todo lugar** (`SiteFeatures.js`, `meus-dados/page.js:135` "Salve vagas no Radar"). `app/(app)/oportunidades/page.js:100` ainda diz `RADAR · OPORTUNIDADES`. Decidir: ou renomear rota pra `/vagas`, ou padronizar UI pra "oportunidades". Inconsistência confunde o link mental ("clica em Radar de vagas → cai em /oportunidades"). |
| Currículo | `CV` (212 ocorrências) · `currículo` (~50) · `Curriculo` (sem acento em alguns comentários e em `app/api/profile/refresh/route.js:57` retornado como label `[Curriculo]`) | **Manter `CV` em UI curta (label, breadcrumb); usar "currículo" em texto longo**. `app/api/profile/refresh/route.js:57` envia `[Curriculo]` (sem acento) como tag visível ao usuário no breakdown. |
| Modelo do usuário | `gêmeo` (landing, login, dashboard) · `snapshot` (UI técnica em `/meus-dados`) · `diagnóstico` (também usado pra mesma coisa) | **Diferenciar**: "gêmeo" = o objeto persistente (perfil + histórico); "diagnóstico" = uma rodada/snapshot. Hoje `meus-dados/page.js:124` mostra "**Diagnósticos (snapshots)**" — o duplo-rótulo (snapshot entre parênteses) já confirma a confusão interna. |
| Estado das microações | `concluir` · `marcar concluído` · `desfazer conclusão` · `Refazer →` em outros contextos | OK na maior parte; só padronizar **infinitivo verbal** ("Concluir" / "Desfazer"). |
| Refresh do diagnóstico | `Refresh contínuo` (`SitePricing.js:34`) · `Atualizar diagnóstico` (botão `RefreshDiagnosisButton.js`) · `Recalcular` (banner `DashboardHighlightBanner.js:21`) · `Refaça o diagnóstico` (plano) | **Padronizar "Atualizar diagnóstico"** em CTAs visíveis; "recalcular" no texto explicativo só. |
| Aderência vaga × perfil | `match` (EN, badge nas vagas: `match {data.vaga.match}`) · `aderência` (PT, marketing) · `% das vagas` | **Decidir um**: o produto vende "aderência calculada" mas mostra "MATCH 78" no card. Em PT-BR consciente, padronizar **"aderência"** (`design-lab/page.js:97,165,228`). |

---

## 3. Português BR

**Acentos faltando em página inteira** (rolou degradação):
- `app/(app)/estagios/page.js:78-85`: `MERCADO · ESTAGIOS` (eyebrow), `Estagios abertos` (h1), "Oportunidades pra comecar sua jornada. Filtros por UF, area e modalidade.", "estagio{...}s disponiveis" (`:85`). Página inteira sem acentos — destoa muito de `/concursos` e `/oportunidades`.
- `app/(app)/funil/FunnelChart.js:93,118,169,193-194`: "Funil de candidaturas: barras horizontais decrescentes por estagio", "Label do estagio", "Linha de label abaixo: % de conversao do estagio anterior", "Cada barra mostra o volume absoluto do estagio. A porcentagem indica a taxa de conversao em relacao ao estagio anterior." — UI text + aria-label de gráfico, leitor de tela vai falar errado em PT-BR.
- `app/(app)/funil/page.js:18,84,114`: "Auto-reporte seus numeros semanais e identifique em qual estagio do funil sua busca esta parando" — `meta.description` indexável pelo Google sem acentos. Idem texto de body.
- `app/(app)/funil/FunnelForm.js:95`: "Numeros salvos. Atualizando analise..." — feedback de submit visível.
- `app/error.js:28`: "Voce nao esta perdendo dados — so essa tela travou." — error boundary raiz.
- `app/(app)/error.js:28`: "Os outros dados estao a salvo." — error boundary do (app).
- `app/(app)/autoconhecimento/page.js:103,123`: aria-labels "Caracteristicas dos assessments" e "X de Y reflexoes feitas".
- `app/(app)/autoconhecimento/[kind]/AssessmentClient.js:493,611,717`: aria-labels "Matriz DISC com posicao do usuario" / "Radar dos valores selecionados" / "Diagrama Ikigai" — alguns ok, "posicao" sem cedilha.
- `app/(app)/dashboard/page.js:371`: `aria-label={`Score atual: ${score} de 100. Projetado com microacoes feitas: ${projScore} de 100.`}` — string lida por leitor de tela com lapsos.
- `app/(app)/conta/CvAnalyzer.js:142,144,217,303,305`: "Analise IA do seu CV", "A IA identifica bullets fracos (sem metrica, verbos passivos) e propoe", "Limpar analise", "Copiar sugestao para a area de transferencia", `"Copiar sugestao"`.

**Briefing por email gerado sem acentos**:
- `app/api/cron/daily-briefing/route.js:281-319`: "Career Health Score: X/100", "Cargo-alvo: X", "Lacuna prioritaria", "Voce ainda nao tem score", "Bom dia X. ...Foco do dia: trabalhe a lacuna...", "Nenhuma vaga nova hoje — continue evoluindo as microacoes." — todo o briefing diário é gerado e exibido sem acento. Cliente final recebe email.

**Mistura `e-mail` vs `email`**:
- `e-mail`: `app/entrar/page.js:53,59,102,123,126`, `app/privacidade/page.js:148,236,619,953,954`.
- `email`: `app/meus-dados/page.js:19,161,177`, `app/admin/page.js`, `app/api/cron/outcome-survey/route.js:67`.
- **Padronizar "e-mail"** (PT-BR formal segue Aurélio/VOLP) ou aceitar "email" em todos. Hoje convivem na mesma tela.

**Português de Portugal**: zero ocorrências de `utilizador/telemóvel/ecrã/programador`. PT-BR está limpo desse ângulo. ✓

**Gírias e contrações ("pra")**:
- "pra" usado consistentemente como registro casual de marca: `entrar/page.js:148`, `experimentar/page.js:543,558`, `verify-request/page.js:71,75`, etc. Aceitável, é estilo de voz definido (não erro).

---

## 4. Microcopy

### Botões / CTAs (verbos inconsistentes)
- `app/error.js:36`: "Tentar de novo" — vago. Melhor "Recarregar tela" ou "Tentar abrir de novo".
- `app/(app)/error.js:39`: "Ir pro dashboard" + "Tentar de novo" — duplo CTA OK, mas "Ir pro dashboard" é melhor que "Voltar".
- `app/auth/verify-request/page.js:111`: "Tentar com outro email" — verbo ok, mas seguido de "Mudou de ideia? Voltar pro modo experimentar" parece redundante.
- `components/WelcomeModal.js:242`: "Mais tarde" — usado como ghost — funciona, mas é o pior nome possível pra um dismiss (sugere agendar, não fechar). Padrão melhor: "Agora não" ou "Fechar".
- `components/site/SiteHero.js:428`: "Ver como funciona" — fraco (jargão SaaS). Página tem "Como funciona" como h2 já — link âncora poderia dizer "Ver os 3 passos" ou "Ver o passo a passo".
- `components/AppShell.js:17`: "Análise de gaps" no menu vs `app/(app)/gaps/page.js:187` h1 "Análise de lacunas" — vai pra mesma rota com label diferente.

### Empty states
- `app/(app)/dashboard/page.js:266-279`: ótimo — eyebrow + h1 + lead + CTA específico ("Construir meu gêmeo →"). **Use este como template.**
- `app/(app)/plano/page.js:226-250,292-300`: `<EditorialEmpty>` com eyebrow + título + body editorial. Excelente padrão (citado em comentário linha 315-317: "substitui os 'Sem dados' planos por algo com tom de produto premium"). Mantém o tom.
- `app/admin/page.js:107-110, 343-346`: "ADMIN_PASSWORD não configurado", "Nenhum owner ativo ainda" — funcional, secundário (admin only).
- `app/(app)/evidencias/page.js:120`: "Adicione projetos, cases, publicações e certificações pra..." — ok mas "publicações" não é acent. correto? Sim, está acentuado.

### Loading states
- `app/loading.js`: usa skeleton CSS, sem texto. Bom.
- `components/NotificationsBell.js:281`: `<p className="appshell-notif-empty">Carregando...</p>` — único "Carregando..." (tres pontos ASCII) hard-coded; mistura com `app/(app)/cvs-adaptados/CvDetailClient.js:155` que usa `Carregando…` (ellipsis Unicode). **Padronizar uso de `…`**.
- `app/experimentar/page.js:657`: passos do streaming usam `label: "Calculando score determinístico"` — bom, específico. Manter padrão.

### Error messages (15+ endpoints clonam a mesma frase)
"Tente novamente em alguns segundos" aparece em (verificáveis):

| Arquivo:linha | Mensagem |
|---|---|
| `app/api/linkedin/parse/route.js:117` | "A IA não conseguiu processar o LinkedIn agora. Tente novamente em alguns segundos." |
| `app/api/me/preferences/route.js:91` | "Nao consegui salvar agora. Tente novamente em instantes." |
| `app/api/me/outcome/route.js:160` | "Não consegui registrar agora. Tente novamente em alguns segundos." |
| `app/api/me/export/route.js:42` | "Não consegui montar a exportação dos seus dados agora. Tente novamente em alguns segundos." |
| `app/api/interview/route.js:178` | "A IA não conseguiu rodar o simulador agora. Tente novamente em alguns segundos." |
| `app/api/portfolio/import/route.js:238,249` | "A IA devolveu uma resposta em formato inesperado. Tente novamente em alguns segundos." |
| `app/api/chat/route.js:155,237` | "A IA falhou no meio da resposta. Tente novamente." |
| `app/api/funnel/route.js:187` | "Nao consegui salvar agora. Tente novamente em instantes." |
| `app/api/tailor/route.js:227` | "A IA não conseguiu adaptar o currículo agora. Tente novamente em alguns segundos." |
| `app/api/profile/refresh/route.js:289,301,552` | idem |
| `app/api/analyze/route.js:190,205,482` | idem (com nuance no 190: "se persistir, o currículo pode estar muito longo ou em formato estranho.") |
| `app/(app)/concursos/page.js:356`, `app/(app)/estagios/page.js:539` | "A fonte pode estar momentaneamente indisponível. Tente novamente em alguns minutos." |
| `app/(app)/conta/page.js:301` | "Não foi possível salvar agora. Tente novamente em instantes." |

**Pontos**:
- 2 variantes de acento: "agora" vs "agora" (ok), mas "Não consegui" (cedilha) vs "Nao consegui" (sem) coexistem (`app/api/me/preferences/route.js:91` `Nao` vs `app/api/me/outcome/route.js:160` `Não`).
- "Tente novamente em alguns segundos" vs "em instantes" vs "em alguns minutos" — três relógios diferentes; usuário não sabe quanto esperar.
- Frase é honesta ("A gente já foi notificado" em `app/error.js:28`) — bom; mas no API a frase é só "tente de novo" sem dizer se já foi reportado.

### Placeholders úteis
- `app/entrar/page.js:109`: `placeholder="voce@exemplo.com"` — sem acento mas funcional (placeholder não precisa).
- `app/(app)/evidencias/EvidenceForm.js:179`: placeholder com 60+ palavras de exemplo de evidência (case real Rails/Go) — overkill em mobile, mas conceitualmente **excelente** como educacional. Bom padrão pra outros forms.
- `components/ChatModal.js:76`: `placeholder="Escreva sua pergunta…"` — ok.

### Toasts/alerts
- `app/(app)/cvs-adaptados/CvDetailClient.js:71`: `alert("Copiado!")` — usa `window.alert` nativo. Quebra a estética. Melhor toast inline.

---

## 5. A11y textual

- aria-labels majoritariamente em PT-BR. ✓
- Lapsos: `caracteristicas`, `posicao`, `microacoes` em `aria-label` (vide seção 3 acima). Leitor de tela em PT-BR pronuncia bizarramente.
- `app/(app)/oportunidades/RadarClient.js:240-270`: comentário diz "Acessivel: label visivel + aria-label redundante" — pattern bom, manter.
- Modal de evidência: `aria-label="Adicionar evidência"`, `aria-label="Fechar formulário"` — ✓ em PT-BR.
- `app/(app)/dashboard/page.js:369,473`: aria-labels dinâmicos bem-formados ("Mudar cargo-alvo, atual: X").
- Falta alt em emoji decorativo? Verificado em `aria-hidden="true"` em todos `<span>` de emoji em `WelcomeModal`, `SiteFeatures`, `DashboardHighlightBanner`. ✓

---

## 6. Email / notificações

### Welcome (`lib/email/welcome-template.js`)
- Subject: "Bem-vindo ao CareerTwin AI" — funcional, não vende ("Seu copiloto chegou" seria coach; padrão atual é melhor).
- Saudação: `Olá, ${first}!` — uso de exclamação leve, ok.
- Eyebrow no header: "Seu copiloto de carreira" (linha 88) — repete "copiloto" 2x no email; em conjunto com `app/experimentar/page.js:398` ("Sua carreira merece um copiloto"), é o slogan dominante. Decidir se "copiloto" fica ou vai pra "diagnóstico auditável" como termo-mãe.
- Lista de bullets cita "Lista de gaps específicos" (linha 106) e "Career Health Score (0–100, fórmula auditável)" (linha 105) — consistente com produto.
- CTA: "Acessar meu dashboard →" (linha 120) — pessoa-1 + ação clara. ✓
- Assinatura humana: "Sergio Hasher" + "Qualquer dúvida, responde esse email direto. Eu leio todas." (linha 130) — excelente, diferenciado, anti-bigtech. Mantém.

### Magic link (`app/auth/verify-request/page.js`)
- "Verifique sua *caixa de entrada*" (linha 64) — clara.
- "Mandamos um link mágico pra X — clica nele pra entrar. Sem senha pra lembrar." (linha 70) — registro casual, instrução clara. ✓
- "Não chegou em 1 minuto? Verifica spam ou a aba de promoções. Links expiram em 24h por segurança." (linha 100-103) — anticipação proativa do problema. **Padrão a copiar**.

### Briefing diário (cron)
- `app/api/cron/daily-briefing/route.js:276-320`: prompt + fallback determinístico todos sem acentos (vide seção 3). Saída pro usuário fica `Bom dia X. Seu score em "Y" esta em N/100. Foco do dia: trabalhe a lacuna "Z". Nenhuma vaga nova hoje — continue evoluindo as microacoes.`
- **Crítico**: briefing chega ao inbox do usuário com PT mal-formado. Posicionamento "diagnóstico auditável Brasil-first" cai quando o email tem "esta em" sem acento.

### Outcome survey (`app/api/cron/outcome-survey/route.js:81`)
- "Faz cerca de ${milestoneLabel} desde seu primeiro diagnóstico no CareerTwin." — registro neutro factual, sem cobrança. ✓

---

## 7. Legal / política

### `/privacidade` (`app/privacidade/page.js`)
- 1180+ linhas, h1 "Privacidade · LGPD by design". Tom editorial premium.
- Linha 145-148: "No CareerTwin, você paga assinatura ... nenhum [interesse] pra te vender curso, pra encaminhar seu CV pra recrutador, pra nutrir base de e-mail de parceiro." — declaração de modelo de negócio dentro da política. **Excelente, raro em concorrentes**.
- "LGPD by-design" usa anglicismo `by-design` 4x sem traduzir. Aceitável (é jargão técnico já incorporado), mas pra leitor leigo, "LGPD desde o desenho" seria mais inclusivo.
- `feature: "Fórmula do score aberta"` em tabela comparativa (linha 784) — usa "feature" (EN) em texto BR. Trocar pra "recurso" ou "característica".
- Linha 235: "Resolve o gap A09 do OWASP Top 10" — termo técnico OK em página técnica de LGPD.
- Email de contato `privacidade@careertwin.ai` (linha 820, 1114, 1134) — consistente.

### `/termos` (`app/termos/page.js:84-91`)
- "Ao criar conta ou usar o CareerTwin AI, você concorda com estes termos..." (linha 84).
- "artificial para diagnosticar perfil de carreira, sugerir lacunas..." (linha 91) — usa "lacunas" (consistente com seção 2).
- Tom sério mas legível. ✓

---

## 8. CTAs

### Landing
- `SiteHero.js:421` "Começar diagnóstico" + seta SVG — forte: verbo + objeto + direção.
- `SiteHero.js:428` "Ver como funciona" — fraco; é jargão SaaS. Sugestão: "Ver os 3 passos" / "Ver o método" / "Entender o cálculo".
- `SitePricing.js:22` "Começar grátis", `:40` "Assinar Pro", `:57` "Entrar na lista" — todos infinitivo + objeto. ✓

### App
- `WelcomeModal.js:250` "Começar diagnóstico" + `:242` "Mais tarde" — "Mais tarde" fraco como dismiss (vide seção 4).
- `DashboardHighlightBanner.js:14,21,28` CTAs por variante: "Atualizar", "Recalcular", "Ver gaps" — curtos, mas inconsistentes com o resto do produto que sempre fala "Atualizar diagnóstico".
- `RefreshDiagnosisButton.js:85` `<h3>Aplicar conquistas ao perfil?</h3>` — modal CTA. "Conquistas" é gentil (gamificado leve, não coach), funciona.
- `app/(app)/dashboard/page.js:317,321` "Construir meu gêmeo →" / "Ver como o score é calculado →" — concretos, com benefício explícito. ✓
- `app/(app)/gaps/GapsKpiStrip.js:144` "Refazer diagnóstico →" — verbo + objeto. ✓
- `components/Report.js:428` `<a className="vagac-tailor" href="/entrar">Entrar pra salvar →</a>` — excelente: ação + benefício explícito.

### Fracos / sugestões
| Local | CTA atual | Por que fraco | Sugestão |
|---|---|---|---|
| `SiteHero.js:428` | "Ver como funciona" | Jargão SaaS, vago | "Ver os 3 passos" |
| `app/error.js:36` | "Tentar de novo" | Genérico | "Recarregar tela" |
| `auth/verify-request/page.js:111` | "Tentar com outro email" | OK funcional | "Usar outro e-mail" |
| `WelcomeModal.js:242` | "Mais tarde" | Sugere agendamento, não dismiss | "Fechar" / "Agora não" |
| `app/not-found.js:20` | "Ir pro dashboard" | OK | manter |
| `app/(app)/error.js:39-40` | "Ir pro dashboard" + "Tentar de novo" | OK | manter |
| `components/site/SiteFooter.js:13` | label `"Login"` (EN) | Anglicismo em rodapé | "Entrar" |

---

## Glossário recomendado (top 20 termos)

| Termo | Variantes a evitar | Justificativa |
|---|---|---|
| **gêmeo** | digital twin, perfil, snapshot | O objeto persistente do usuário (perfil + histórico). Termo de marca. |
| **diagnóstico** | análise, avaliação | Uma rodada/snapshot. Verbo: "fazer um diagnóstico", "rodar um diagnóstico". |
| **Career Health Score** (1ª) / **score** (depois) | nota, pontuação, índice | Já é o termo-mãe. Sub-scores: "sub-score de aderência" etc. |
| **sub-score** | sub-nota, indicador | Decompõe o score; usar com hífen. |
| **gap** | lacuna (texto longo só), lapso, ponto de melhoria | Termo curto em labels (`/gaps`, "Análise de gaps"). "Lacuna" só em corpo de texto editorial. |
| **microação** | tarefa, ação, etapa, missão | Sempre acentuado, mesmo no email. Plural "microações". |
| **vaga** | oportunidade (URL OK), opening, position | Padronizar UI. URL `/oportunidades` fica por SEO, mas labels falam "vagas". |
| **aderência** | match, fit, encaixe | PT-BR consciente. "Aderência da vaga ao seu perfil: 78%". Remover "MATCH 78" do design-lab. |
| **cargo-alvo** | role, target role, cargo desejado | Hifenizado. Consistente em todo o app. |
| **CV** (UI curta) / **currículo** (texto longo) | resumé, resume | Acentuar SEMPRE em corpo de texto. |
| **fonte rastreável** | source, citação, referência | Vendido como diferencial; usar fixo. |
| **caixa-preta** | black box, black-box | Hifenizado. Anti-padrão referenciado no marketing. |
| **diagnóstico auditável** | análise transparente, score aberto | Combina termos-mãe. Frase de posicionamento. |
| **RAG curado BR** | base de conhecimento, KB | Termo técnico mantido. |
| **funil** | pipeline, kanban (só onde for kanban), trilha | Funil = `/funil` (auto-reporte). Kanban = `/candidaturas`. Diferenciar. |
| **candidatura** | application, vaga aplicada, processo | Já consistente. |
| **e-mail** | email, eletronic mail | Com hífen, conforme `app/entrar` e `app/privacidade`. Quem usa "email" se alinha. |
| **copiloto** | mentor, coach, assistente, IA | Termo de posicionamento. Manter, mas não repetir em 1 página (welcome email tem 2x). |
| **modo experimentar** | trial, modo demo, sandbox | Termo de produto traduzido. |
| **atualizar diagnóstico** | refresh, recalcular (texto explicativo só) | Verbo do botão. |

---

## Top 5 alavancas

1. **Despoluir tom coach do dashboard** (`components/DashboardHighlightBanner.js:24-31`): a variante `noStreak` ("Comece sua jornada de carreira hoje / Marque sua primeira microação e comece a evoluir") é a ÚNICA peça do produto com tom de coach motivacional, no espaço mais visível (acima do score ring). Substituir por algo factual: "Primeira microação pendente / Marque uma e o score projetado atualiza" — alinha com o resto.

2. **Acentuar o briefing diário e a página `/estagios` + `/funil`** (`app/api/cron/daily-briefing/route.js:280-319`, `app/(app)/estagios/page.js:78-85`, `app/(app)/funil/FunnelChart.js:93,193`): é o que mais quebra o posicionamento "Brasil-first auditável". Email chega ao inbox sem acentos; meta description de SEO sai sem acentos. Fix mecânico de alto leverage.

3. **Padronizar nomenclatura `gap/lacuna/Análise de gaps`** (`components/AppShell.js:17` vs `app/(app)/gaps/page.js:17,187`): menu lateral diz "Análise de gaps", h1 da página diz "Análise de lacunas". Frustra rastreio mental. Escolher um e propagar.

4. **Resolver `vagas` × `oportunidades` × `/oportunidades`** (`SiteFeatures.js`, `meus-dados/page.js:135`, `app/(app)/oportunidades/page.js:100`): a rota URL diverge da UI. Renomear rota pra `/vagas` (SEO BR aceita melhor) OU padronizar UI "Radar de oportunidades". Atual estado é o pior dos mundos.

5. **Unificar mensagens de erro de API** (15+ endpoints clonam "Tente novamente em alguns segundos/instantes/minutos" com variações ad-hoc): criar 3 categorias canônicas: (a) **rate limit/IA** — "A IA está sobrecarregada. Tente em 1-2 min."; (b) **save failure** — "Não consegui salvar. Tente em 10s."; (c) **fonte externa** — "A fonte X não respondeu. Tente em alguns minutos." Cada uma com tom seco + estimativa de tempo realista. Hoje o usuário não sabe se "alguns segundos" e "alguns minutos" são bug ou intencional.

---

## Referências de bom tom (a copiar como template)

- `app/auth/verify-request/page.js:100-103` (anticipação proativa do problema)
- `components/site/SiteFaq.js:13-42` (frio, factual, sem cobrança)
- `components/site/SitePricing.js:138` (anti-retenção como manifesto curto)
- `app/(app)/plano/page.js:226-250` (empty states editoriais com eyebrow + título + body)
- `lib/email/welcome-template.js:130` (assinatura humana 1ª pessoa)
- `app/privacidade/page.js:145-148` (transparência de modelo de negócio dentro da política)
