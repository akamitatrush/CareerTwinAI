# Candidatos de Rebrand — Verificação de Disponibilidade

Verificado em 2026-06-22. Critério: `.com.br` livre, sem colisão com produto de carreira/HR, sem marca dominante em outro segmento.

Método usado: o utilitário `whois` não está instalado nesta máquina. Para o `.com.br` confirmei status via endpoint público da Registro.br (`https://registro.br/v2/ajax/avail/raw/{dominio}`), que devolve JSON com `publication_status`, `expiration_date` e `nameservers`. Para `.com / .app / .io / .ai` usei `host` (resolução DNS) — uma resposta com endereço IP é forte indício de registro, e `NXDOMAIN` é forte indício de livre, mas não é tão autoritativo quanto WHOIS. Onde houve `NXDOMAIN`, deixei marcado como "livre?" com nota.

Resultado curto: **nenhum dos 12 nomes passa no critério principal**. Todos os 12 `.com.br` estão registrados e publicados (com nameservers ativos e expirações futuras). Não há shortlist GREEN.

## Veredito rápido

| Nome | .com.br | .com | .app | Produto-conflito | Veredito |
|---|---|---|---|---|---|
| Avatar | tomado (exp. 2027-12) | tomado | tomado | Cameron/Disney/Marvel + termo genérico de UX | RED |
| Réplica | tomado (exp. 2028-05) | tomado | tomado | Replika.ai (AI companion) — colisão funcional direta | RED |
| Mirante | tomado (exp. 2028-08) | tomado | tomado | Grupo Mirante (Globo MA) — TV/jornal regional | RED |
| Bússola | tomado (exp. 2026-11) | tomado | tomado | UOL Bússola (vertical de conteúdo de negócios) | RED |
| Norte | tomado | tomado | tomado | Grupo Nortearh (consultoria RH/coaching) — colisão direta | RED |
| Tino | tomado (exp. 2028-12) | tomado | livre? (NXDOMAIN) | sem conflito forte achado | RED (só pelo .com.br) |
| Faro | tomado (exp. 2027-10) | tomado | tomado | cidade em Portugal + Grafana Faro (obs. dev) | RED |
| Dossiê | tomado (exp. 2026-07) | tomado | tomado | uso genérico em RH ("dossiê profissional") | RED |
| Sumário | tomado (exp. 2027-04) | tomado | livre? (NXDOMAIN) | termo super genérico | RED |
| Memorando | tomado (exp. 2026-08) | tomado | tomado | Memorado (brain-training, Berlim, $1.3M seed) — colisão de som | RED |
| Salto | tomado (exp. 2026-11) | tomado | tomado | "Salto para o Futuro" (MEC/TV Escola) — colisão em educação | RED |
| Trilho | tomado (exp. 2026-06) | tomado | tomado | "trilhas de carreira" é jargão saturado em RH/L&D BR | RED |

## Shortlist recomendada

**Não há.** Os 12 nomes falham no critério `.com.br` livre. Todos retornaram `publication_status: published` na Registro.br, com nameservers configurados e expirações futuras (vide tabela). Isso significa que comprar o domínio brasileiro exigiria negociação com o atual titular (caro e incerto), ou aceitar uma TLD secundária — o que vai contra o critério explicito do briefing.

Recomendação prática: voltar pro brainstorm com regras adicionais.

- **Composições** (duas raízes coladas, sem hífen): `Rumora`, `Trilho.io` não rola, mas `Trilhar`, `Norteia`, `Bussolar`. Palavras únicas e curtas em PT estão saturadas porque `.com.br` é mercado maduro desde anos 2000.
- **Neologismos com sufixo**: `-ly`, `-ai`, `-mente`, `-er`. Ex.: `Faroly`, `Tinor`, `Bussoly` (testar disponibilidade).
- **Tupi-guarani** com sentido próximo ("direção", "caminho", "olhar"): `Yara` (já tomado em fintech), `Tapera`, `Pira`. Cuidado com apropriação cultural — pedir revisão.
- **Verbos no imperativo**: `Decola`, `Aponta`, `Mira`. Já saturados, mas vale checar variações.
- **Termo composto curto**: `Carreirômetro`, `Faro de Carreira` (slogan, não marca). Pouco brandable.

Se forem manter as 12 originais, alternativa é assumir um domínio diferente do `.com.br`. Os menos hostis (com pelo menos uma TLD principal indicando NXDOMAIN no DNS) foram:

- **Tino** — `.app` deu NXDOMAIN. Som curto, sem colisão de produto encontrada. Significa "tato/discernimento" em PT — combina com copiloto de carreira.
- **Sumário** — `.app` deu NXDOMAIN. Mas o termo é genérico demais; não vira marca.
- **Memorando** — `.io` e `.ai` deram NXDOMAIN. Mas tem colisão fonética com "Memorado" (brain-training alemã).

Nenhum desses é GREEN. São apenas "menos vermelhos".

## Detalhe por candidato

### 1. Avatar
- **`.com.br`:** tomado (exp. 2027-12-05, NS ns1045.ui-dns.de).
- **`.com`:** tomado (resolve a 34.110.155.89, Google).
- **`.app`:** tomado.
- **Conflito:** James Cameron, Disney/Pandora, Marvel — colisão de SEO catastrófica. Termo também é jargão técnico para foto/persona de usuário.
- **Veredito:** RED. Mesmo se domínios estivessem livres, seria insustentável de fazer SEO.

### 2. Réplica
- **`.com.br`:** tomado (exp. 2028-05-02, NS Terra Empresas).
- **`.com`:** tomado.
- **`.app`:** tomado.
- **Conflito:** Replika.ai (AI companion / "clone digital", milhões de usuários, popular no Brasil desde 2017). Colisão FUNCIONAL direta — "réplica" como copiloto IA é exatamente o pitch do Replika.
- **Veredito:** RED. Pior nome da lista pro contexto de IA.

### 3. Mirante
- **`.com.br`:** tomado (exp. 2028-08, status published).
- **`.com`:** tomado (parking).
- **`.app`:** tomado.
- **Conflito:** Grupo Mirante (afiliada Globo no Maranhão — TV, jornal, rádio). Não é carreira, mas é uma marca regional forte com mais de 30 anos.
- **Veredito:** RED.

### 4. Bússola
- **`.com.br`:** tomado (exp. 2026-11, NS dominio-a-venda.com). Indica domínio reservado pra revenda — possivelmente caro.
- **`.com`:** tomado.
- **`.app`:** tomado.
- **Conflito:** UOL Bússola (vertical editorial de economia/negócios do UOL). Marca já estabelecida em mídia BR.
- **Veredito:** RED.

### 5. Norte
- **`.com.br`:** tomado (Locaweb, status published).
- **`.com`:** tomado (Cloudflare).
- **`.app`:** tomado.
- **Conflito:** Grupo Nortearh — consultoria de RH, mentoria e coaching empresarial, 20+ anos de mercado. Colisão de categoria direta.
- **Veredito:** RED. Pior nome da lista pro contexto de RH/carreira BR.

### 6. Tino
- **`.com.br`:** tomado (exp. 2028-12, NS Google Domains).
- **`.com`:** tomado.
- **`.app`:** NXDOMAIN — provavelmente livre, mas precisa confirmar via WHOIS.
- **`.io`:** tomado.
- **`.ai`:** tomado.
- **Conflito:** Sem produto BR de carreira encontrado. "Tino" em PT = discernimento, juízo — combina bem com IA-copiloto.
- **Veredito:** RED apenas pelo `.com.br`. **É o melhor candidato a "se você aceitar não usar .com.br"** — `.app` provavelmente livre, sem colisão de marca, sentido pertinente.

### 7. Faro
- **`.com.br`:** tomado (exp. 2027-10, NS HostGator).
- **`.com`:** tomado.
- **`.app`:** tomado.
- **Conflito:** Faro é cidade em Portugal (turismo, voos), Grafana Faro (obs. front-end) — colisão tech relevante pro nicho de desenvolvedor. "Faro" também é jargão policial.
- **Veredito:** RED.

### 8. Dossiê
- **`.com.br`:** tomado (exp. 2026-07, NS auto.dns.br — provavelmente Registro.br default, baixa atividade).
- **`.com`:** tomado.
- **`.app`:** tomado.
- **Conflito:** "Dossiê profissional" é termo genérico estabelecido em RH BR (vide sertms.com). Sem produto único forte, mas o termo carrega conotação burocrática/investigativa.
- **Veredito:** RED. Soa antiquado pra IA-copiloto.

### 9. Sumário
- **`.com.br`:** tomado (exp. 2027-04, NS auto.dns.br).
- **`.com`:** tomado.
- **`.app`:** NXDOMAIN — provavelmente livre.
- **`.io`:** tomado.
- **`.ai`:** tomado.
- **Conflito:** Termo genérico ("table of contents"). Não tem produto-conflito forte, mas também não vira marca — soa como índice de livro, não como copiloto.
- **Veredito:** RED. Falha por nome genérico, não só por domínio.

### 10. Memorando
- **`.com.br`:** tomado (exp. 2026-08, NS auto.dns.br).
- **`.com`:** tomado.
- **`.app`:** tomado.
- **`.io`:** NXDOMAIN — provavelmente livre.
- **`.ai`:** NXDOMAIN — provavelmente livre.
- **Conflito:** Memorado (brain-training Berlim, $1.3M seed via TechCrunch). Não é o mesmo nome, mas fonética colide em busca por voz e digitação rápida. Termo também é burocrático/corporativo.
- **Veredito:** RED.

### 11. Salto
- **`.com.br`:** tomado (exp. 2026-11, NS auto.dns.br).
- **`.com`:** tomado.
- **`.app`:** tomado.
- **Conflito:** "Salto para o Futuro" — programa do MEC/TV Escola desde 1991, marca consolidada em educação BR (categoria adjacente!). Colisão de SEO em buscas tipo "salto carreira".
- **Veredito:** RED. Risco alto de canibalização de SEO em queries educacionais.

### 12. Trilho
- **`.com.br`:** tomado (exp. 2026-06-20 — expira em ~2 dias! Vale acompanhar o drop, mas pode renovar automaticamente).
- **`.com`:** tomado.
- **`.app`:** tomado.
- **`.io`:** NXDOMAIN.
- **Conflito:** "Trilha de carreira", "trilha de aprendizagem" são termos saturadíssimos em L&D/RH BR (Sebrae, Pitágoras, Unopar, EadBox etc.). "Trilho" é variante, mas SEO vai bater no mesmo cluster.
- **Veredito:** RED. Único caso onde a expiração próxima (`2026-06-20`) merece monitoramento — se cair pra drop em ~junho/2026, vale uma 2ª avaliação. Ainda assim, problema de SEO contra "trilhas de carreira" persiste.

## Observações gerais

1. **Saturação do `.com.br` em palavras únicas de PT-BR.** Os 12 nomes são substantivos comuns/curtos do português; todos estão registrados há anos. Isso é padrão de mercado maduro — o `.com.br` foi colonizado por cybersquatters e empresas desde fim dos anos 90. Para um produto novo em 2026, monolexemas em PT estão praticamente esgotados.

2. **NS `auto.dns.br` aparece em vários domínios "dormentes"** (sumario, memorando, salto, trilho, dossie). Esses são domínios registrados mas sem hospedagem ativa — provavelmente parking ou retenção especulativa. Não tornam o nome livre, mas indicam dono potencialmente disposto a vender (ou esquecer e deixar cair).

3. **Expirações curtas merecem watchdog.** Trilho.com.br expira 2026-06-20 (dois dias após esta análise), Dossiê expira 2026-07-01, Memorando 2026-08-21, Bússola e Salto em 2026-11-20. Vale colocar alertas (ex.: ExpiredDomains.net, DropCatch) — se não renovarem, entram em janela de drop ~60-90 dias depois.

4. **Colisões de categoria fatais**: Norte (Grupo Nortearh, RH), Réplica (Replika, AI), Salto ("Salto para o Futuro", educação). Esses três queimam SEO e não devem voltar nem em rebrand futuro.

5. **Marcas regionais de mídia BR** ocupam vários nomes de geografia/observação: Mirante (Globo MA), Bússola (UOL). Padrão típico — veículos antigos pegaram domínios curtos cedo.

6. **Padrão útil pra próxima rodada**: nomes compostos (`carreira+verbo`, `verbo+suffixo`), neologismos com sufixo (`-ly`, `-ai`, `-mente`), ou pegar de fora do PT-BR (tupi, anglicismo, latinismo). Single-word PT no `.com.br` é caça impossível em 2026.

7. **Limitação metodológica**: confirmei `.com.br` por API da Registro.br (autoritativo). Para `.com / .app / .io / .ai` usei DNS resolution via `host` — uma resposta com IP confirma uso, mas `NXDOMAIN` não é prova absoluta de "livre" (pode ser domínio registrado sem zona DNS configurada). Para os 5 casos NXDOMAIN (tino.app, sumario.app, memorando.io, memorando.ai, trilho.io, dossie.io), recomendo confirmação WHOIS antes de registrar. Tentei `rdap.org` mas retornou 403; instalar `whois` localmente resolve.

---

# Variante: Twin AI mantido (verificação adicional)

Verificado em 2026-06-22. 10 candidatos que mantêm "Twin AI" como sufixo, mudando apenas o prefixo. Método idêntico ao bloco anterior: Registro.br API pro `.com.br` (autoritativo) e `host` (DNS) pros demais TLDs. NXDOMAIN é forte indício de "livre" mas não prova WHOIS — confirmar antes de registrar.

**Resultado curto:** todos os 10 `.com.br` estão LIVRES (`status:0` na API do Registro.br). Composição "prefixo+twin" furou a saturação do `.com.br` que afetou os 12 monolexemas da rodada anterior — esse é o achado mais importante. Os blockers agora migraram pro plano internacional (`.com`/`.ai`/`.io`) e pra colisão de produto.

## Veredito rápido

| Nome combinado | .com.br | .com | .ai | .app | .io | Produto-conflito | Veredito |
|---|---|---|---|---|---|---|---|
| carreiratwin | livre | NXDOMAIN | NXDOMAIN | NXDOMAIN | NXDOMAIN | nenhum | GREEN |
| jornadatwin | livre | NXDOMAIN | NXDOMAIN | NXDOMAIN | NXDOMAIN | nenhum | GREEN |
| dossietwin | livre | NXDOMAIN | NXDOMAIN | NXDOMAIN | NXDOMAIN | "dossiê" soa burocrático | YELLOW |
| nortetwin | livre | NXDOMAIN | NXDOMAIN | NXDOMAIN | NXDOMAIN | Grupo Nortearh (RH BR) — categoria | YELLOW |
| rumotwin | livre | NXDOMAIN | NXDOMAIN | NXDOMAIN | NXDOMAIN | Rumo Logística (Cosan, B3) — SEO | YELLOW |
| farotwin | livre | NXDOMAIN | NXDOMAIN | NXDOMAIN | NXDOMAIN | Grafana Faro (obs. front-end) | YELLOW |
| pivottwin | livre | NXDOMAIN | NXDOMAIN | NXDOMAIN | NXDOMAIN | Wild Things Pivot Twin (surf fin, AU) | GREEN |
| talenttwin | livre | parking (Atom) | **ATIVO HR** | NXDOMAIN | mesmo IP do .ai | TalentTwin.ai (HR/talent, "launching soon") | RED |
| skilltwin | livre | HugeDomains parking | ativo | "coming soon" | NXDOMAIN | SkillTwins (football, marca consolidada) + parking caro | RED |
| protwin | livre | ativo (NetSol) | ativo (parking) | ativo (CF) | NXDOMAIN | ProTwinAI.com (coaches/consultants — colisão funcional direta!) + SEKO/Horizon/Powertrain | RED |

## Shortlist Twin AI (apenas GREENs)

Três nomes saíram GREEN, sem colisão de produto/SEO encontrada:

1. **CarreiraTwin AI** — semanticamente perfeito (carreira é o domínio do produto), `.com.br` + as 4 TLDs internacionais principais todas NXDOMAIN, zero produto homônimo achado no Google. Único pequeno desconforto: redundância com o domínio (CareerTwin já existe em US/IN, traduzir pra PT pode parecer "versão regional" de algo gringo). Tradeoff: ganha SEO local, perde diferenciação.

2. **JornadaTwin AI** — "jornada" virou a palavra-mãe da UX no Brasil (jornada do usuário, jornada do cliente, jornada do funcionário). Combina com o discurso de plano de 3 semanas / kanban / Career Health Score como progresso ao longo do tempo. Domínio limpo em todas as TLDs, sem colisão.

3. **PivotTwin AI** — "pivot" como ato de virada de carreira é narrativa central do produto (laid-off → reinventou). `.com.br` livre, internacionais NXDOMAIN. Colisão única é a Pivot Twin (prancha de surf da Wild Things, AU, nicho microscópico) — risco baixíssimo de confusão. Único downside: "pivot" tem peso anglicista (Pivotal Tracker/Software descontinuado em 2024, Lean Startup jargão).

**Recomendação intuitiva:** **JornadaTwin AI**. "Jornada" carrega o pitch do produto sem explicar (vs. "carreira", que é literal demais e gruda na categoria). Funciona em pt-BR sem soar traduzido. "Pivot" é segunda escolha — mais ousado mas mais anglicista.

## Detalhe por candidato

### 1. CarreiraTwin AI
- **`.com.br`** (carreiratwin.com.br): livre (`status:0`, Registro.br).
- **`.com`**: NXDOMAIN.
- **`.ai`**: NXDOMAIN.
- **`.app`**: NXDOMAIN.
- **`.io`**: NXDOMAIN.
- **Conflito de produto:** nenhum encontrado. Busca por "CarreiraTwin" retornou apenas portais genéricos de carreira (Itaú, Win Carreira, Santos Brasil) sem colisão.
- **Prefixo "Carreira" como marca:** termo descritivo da categoria (igual a "career" em EN); difícil registrar como marca isolada no INPI. Combinado com "Twin AI", vira marca composta registrável.
- **Veredito:** GREEN. Domínios todos disponíveis, zero colisão. Único risco é estratégico, não jurídico: "carreira" é palavra do meio (próxima a "salary", "emprego") — descritiva demais pode prejudicar diferenciação.

### 2. JornadaTwin AI
- **`.com.br`** (jornadatwin.com.br): livre (`status:0`).
- **`.com`**: NXDOMAIN.
- **`.ai`**: NXDOMAIN.
- **`.app`**: NXDOMAIN.
- **`.io`**: NXDOMAIN.
- **Conflito de produto:** nenhum encontrado.
- **Prefixo "Jornada" como marca:** "jornada" no INPI tem dezenas de marcas (Jornada Educativa, Jornada Mais etc.) — mas como palavra comum, ninguém detém monopólio. Combinado com Twin AI é distintivo.
- **Veredito:** GREEN. Melhor sinal/ruído do top-3. Encaixa no idioma do produto (plano de 3 semanas = jornada).

### 3. DossieTwin AI
- **`.com.br`** (dossietwin.com.br): livre.
- **`.com`**: NXDOMAIN.
- **`.ai`**: NXDOMAIN.
- **`.app`**: NXDOMAIN.
- **`.io`**: NXDOMAIN.
- **Conflito de produto:** nenhum encontrado.
- **Prefixo "Dossiê" como marca:** termo carrega conotação investigativa/burocrática ("dossiê do candidato" = relatório de check); meio dissonante com IA-copiloto/coaching. Mantém peso técnico de "Career Health Score", mas perde calor.
- **Veredito:** YELLOW. Tecnicamente GREEN no domínio, mas o termo envelhece o branding. Útil se o pitch for "auditoria + score" mais que "coaching + plano".

### 4. NorteTwin AI
- **`.com.br`** (nortetwin.com.br): livre.
- **`.com`**: NXDOMAIN.
- **`.ai`**: NXDOMAIN.
- **`.app`**: NXDOMAIN.
- **`.io`**: NXDOMAIN.
- **Conflito de produto:** Grupo Nortearh (consultoria RH/coaching BR, 20+ anos) — não é homônimo, mas é categoria adjacente e "norte" + RH cria ruído de SEO. Também colide com "Twin AI" da rodada anterior (Norte saiu RED por isso).
- **Prefixo "Norte" como marca:** super genérico ("dar norte", "norte da carreira"); muito usado em coaching/RH no Brasil.
- **Veredito:** YELLOW. Domínios livres, mas a categoria já tem Nortearh ocupando um pedaço da mente do consumidor de RH. Risco médio.

### 5. RumoTwin AI
- **`.com.br`** (rumotwin.com.br): livre.
- **`.com`**: NXDOMAIN.
- **`.ai`**: NXDOMAIN.
- **`.app`**: NXDOMAIN.
- **`.io`**: NXDOMAIN.
- **Conflito de produto:** Rumo Logística S.A. (grupo Cosan, listada na B3, ~30k funcionários) — não é categoria, mas é uma das maiores empresas do Brasil. Buscar "Rumo carreira" cai no Trabalhe Conosco deles primeiro. SEO travado.
- **Prefixo "Rumo" como marca:** "rumo à" é jargão de coaching saturado ("rumo ao sucesso", "rumo à liderança").
- **Veredito:** YELLOW. Domínios livres, mas competir com a Rumo S.A. em busca orgânica é guerra perdida pros primeiros 6-12 meses.

### 6. FaroTwin AI
- **`.com.br`** (farotwin.com.br): livre.
- **`.com`**: NXDOMAIN.
- **`.ai`**: NXDOMAIN.
- **`.app`**: NXDOMAIN.
- **`.io`**: NXDOMAIN.
- **Conflito de produto:** nenhum produto homônimo. Mas Grafana Faro (observability para front-end) é referência tech para dev — qualquer dev sênior buscando "Faro" cai lá. "Faro" também é cidade em Portugal (turismo).
- **Prefixo "Faro" como marca:** evoca radar/olfato/detecção (combina com gap analysis). Mas o termo cruza com tech existente.
- **Veredito:** YELLOW. Domínios todos NXDOMAIN, sem produto-conflito direto em carreira, mas SEO de tech vai dividir com Grafana.

### 7. PivotTwin AI
- **`.com.br`** (pivottwin.com.br): livre.
- **`.com`**: NXDOMAIN.
- **`.ai`**: NXDOMAIN.
- **`.app`**: NXDOMAIN.
- **`.io`**: NXDOMAIN.
- **Conflito de produto:** Wild Things Pivot Twin (prancha de surf, Austrália, nicho) — risco zero de confusão fora da bolha surf. Pivot International é manufatura. Nenhum produto de carreira.
- **Prefixo "Pivot" como marca:** carrega herança Lean Startup ("pivot the product"); Pivotal Tracker foi descontinuado em 2024. Termo já tem cultura no nicho startup BR.
- **Veredito:** GREEN. Domínios todos NXDOMAIN, sem colisão de carreira, narrativa "pivot de carreira" alinha com pitch do produto.

### 8. TalentTwin AI
- **`.com.br`** (talenttwin.com.br): livre.
- **`.com`**: tomado, resolve a 52.20.84.62 (AWS); o domínio está parked no Atom (atom.com/lpd/name/talenttwin.com) — comprável, mas caro.
- **`.ai`**: **TOMADO E ATIVO**. talenttwin.ai resolve a IPs Amazon Lightsail (13.248.243.5, 76.223.105.230); página mostra "Launching Soon" com formulário de email — produto pré-lançamento em HR/talento. **Colisão funcional direta.**
- **`.app`**: NXDOMAIN.
- **`.io`**: tomado, mesmos IPs do `.ai` (mesmo dono).
- **Conflito de produto:** TalentTwin AI (US, HR/talent). "Talent" é categoria saturada (~100 produtos em HR-tech).
- **Veredito:** RED. Conflito direto com produto pré-lançamento no mesmo nicho — mesmo problema do CareerTwin atual.

### 9. SkillTwin AI
- **`.com.br`** (skilltwin.com.br): livre.
- **`.com`**: tomado, parking HugeDomains (revenda; típico = US$ 1k-5k).
- **`.ai`**: tomado e ativo (34.216.117.25 — AWS us-west).
- **`.app`**: tomado, "website coming soon".
- **`.io`**: NXDOMAIN.
- **Conflito de produto:** SkillTwins (futebol — irmãos suecos El-Zein, marca consolidada com canal de YouTube e camps) — colisão fonética/visual em busca, especialmente perigosa pra audiência jovem. Também `@skilltwin` no Twitter já tem dono.
- **Veredito:** RED. `.com` em parking caro + `.ai` ativo + marca esportiva consolidada com plural ("SkillTwins") — coquetel ruim.

### 10. ProTwin AI
- **`.com.br`** (protwin.com.br): livre.
- **`.com`**: ativo (Network Solutions, MX em oxcs.net — provavelmente parking de revendedor).
- **`.ai`**: ativo (registrar-servers.com forwarding — parked).
- **`.app`**: ativo, hospedado em Cloudflare (172.67.159.134) — produto desconhecido.
- **`.io`**: NXDOMAIN.
- **Conflito de produto:** **ProTwinAI.com já existe** ("ProTwin – Meet your other self", IA para coaches/consultants/creators — colisão funcional muito próxima de copiloto de carreira). Plus: ProTwin by SEKO (limpeza HACCP), PROTWIN Horizon Europe (alimento plant-based), ProTwin by American Powertrain (clutches), KUHN ProTwin Slinger (espalhador de esterco). Cinco marcas concorrentes pela mesma palavra.
- **Veredito:** RED. Pior namespace pollution dos 10. ProTwinAI.com é literalmente "IA-copiloto/twin para profissionais" — colisão estratégica.

## Observações gerais (Twin AI)

1. **Composição quebra a saturação do `.com.br`.** Os 10 prefixos+twin estão TODOS livres no Registro.br, contra 12/12 tomados na rodada anterior de monolexemas PT. Padrão claro: composições escapam do cybersquatting histórico que cobriu palavras únicas. Recomendação geral pra próximas iterações — sempre testar prefixo+sufixo, mesmo que pareça menos elegante.

2. **Twin AI namespace está se enchendo rápido.** Em 7 dos 10 candidatos, o `.ai`/`.io` é NXDOMAIN — mas em 3 (`talenttwin`, `skilltwin`, `protwin`) já tem produto/parking. Padrão: termos comuns em EN do nicho HR (`talent`, `skill`, `pro`) já foram pegos por concorrentes ou squatters. Termos pt-BR (`carreira`, `jornada`, `dossie`, `norte`, `rumo`, `faro`) e termo neutro EN (`pivot`) sobreviveram. **Janela de captura é agora.**

3. **NXDOMAIN não é prova absoluta de "livre".** Pros 7 GREEN/YELLOW com NXDOMAIN em todas TLDs internacionais, recomendo confirmar via WHOIS (registrador) antes de registrar. Um domínio pode estar registrado sem zona DNS configurada (raro com TLDs novos, mas possível). Verba sugerida: ~US$ 200 (registrar todos os 4 TLDs do nome escolhido — `.com.br` + `.com` + `.ai` + `.app` — defensive registration).

4. **Categoria "Twin AI" + HR-adjacente já tem ocupantes.** TalentTwin.ai (US, "launching soon"), ProTwinAI.com (coaches), Replika (AI companion). O sufixo "Twin AI" como tropo está virando crowded. Diferencial vai vir do prefixo PT-BR (jornada, carreira) — ninguém fora do Brasil vai brigar por isso.

5. **Trademark INPI ainda precisa ser verificado.** Esta análise cobre apenas domínio + colisão web. Recomendo busca paga no INPI (R$ 60) pros 3 GREEN antes de fechar — "Jornada", "Pivot" e "Carreira" são raízes comuns; verificar classes Nice 9 (software), 35 (RH/recruiting), 41 (educação) e 42 (SaaS).

6. **Limitação metodológica idêntica à rodada anterior**: WHOIS não instalado; usei Registro.br API (autoritativa pro `.com.br`) e `host` (DNS) pros demais TLDs. WebFetch pra confirmar conteúdo dos sites ativos (TalentTwin.ai, SkillTwin.app, HugeDomains, Atom). Algumas tentativas falharam (protwin.com timeout, protwin.app 403, skilltwin.ai timeout) — dados confirmados por busca cruzada no Google.
