# CareerTwin AI — Documentação de Produto

> Copiloto de empregabilidade em pt-BR. Cola o currículo, diz o cargo que quer, recebe um diagnóstico auditável + vagas reais + plano executável.

---

## Sumário

1. [O que é](#o-que-é)
2. [Pra quem é](#pra-quem-é)
3. [O que o produto entrega](#o-que-o-produto-entrega)
4. [Jornada do usuário](#jornada-do-usuário)
5. [Funcionalidades em detalhe](#funcionalidades-em-detalhe)
6. [Princípios editoriais](#princípios-editoriais)
7. [Diferenciais](#diferenciais)
8. [Limitações conhecidas](#limitações-conhecidas)
9. [Modelo de negócio (planejado)](#modelo-de-negócio-planejado)
10. [FAQ](#faq)

---

## O que é

CareerTwin AI cria um **gêmeo digital da carreira** do usuário a partir de três fontes possíveis (CV em texto/PDF, perfil LinkedIn colado, portfólio GitHub) e compara com o que o mercado de fato pede para o cargo desejado. O retorno não é genérico: cada número tem fonte, cada lacuna tem microação concreta, cada vaga sugerida vem com a explicação do match e o link da publicação original.

**Em uma frase**: "Cole o que você é hoje, diga onde quer chegar — recebe a distância em números auditáveis e o caminho dividido em microações."

---

## Pra quem é

| Persona | Cenário típico |
|---|---|
| **Profissional em recolocação** (28-45a, demitido nos últimos 6 meses) | Precisa de clareza objetiva sobre onde está, o que falta, e onde aplicar primeiro. |
| **Profissional em evolução** (PJ → CLT, dev → tech lead, analista → coordenador) | Quer mapear o gap pro próximo nível e adaptar o LinkedIn/CV pra parecer "pronto pro próximo passo". |
| **Transição de área** (marketing → produto, financeiro → dados) | Precisa entender quais skills do passado se aproveitam e quais lacunas atacar primeiro. |
| **Recém-formado** (1º emprego ou júnior buscando pleno) | Sem perspectiva, recebe um diagnóstico de skills + plano de evolução. |
| **B2B futuro** (universidades, consultorias, RHs) | Acompanhar coorte de alunos/clientes em evolução de empregabilidade. |

---

## O que o produto entrega

```mermaid
mindmap
  root((CareerTwin AI))
    Diagnóstico
      Perfil estruturado
      Career Health Score
      4 sub-scores ponderados
      Gaps priorizados
    Radar de vagas
      Adzuna BR
      Jooble
      Greenhouse ATS
      Match calculado
    Ferramentas
      Adaptador de CV
      Simulador entrevista STAR/CAR
      Chat com o gêmeo
      Tracking de candidaturas
    Acompanhamento
      Histórico de score
      Funil kanban
      Métricas conversão
      Email semanal
    LGPD
      Consent por fonte
      Export JSON
      Apagar tudo
```

---

## Jornada do usuário

```mermaid
journey
    title Jornada principal — primeira sessão
    section Descoberta
      Abre a home: 5: User
      Vê eyebrow "Beta · MVP funcional": 4: User
      Lê o hero "Construa o gêmeo da sua carreira": 5: User
    section Setup
      Cola CV ou importa LinkedIn: 5: User
      Digita cargo-alvo: 5: User
    section Análise
      Vê loading com narrativa (passos descritos): 5: User
      Aguarda 15-30s: 3: User
    section Diagnóstico
      Vê o score com fórmula visível: 5: User
      Expande sub-scores: 5: User
      Lê gaps com microações: 5: User
      Marca microação como feita → score sobe: 5: User
    section Ação
      Vê vagas reais ordenadas por match: 5: User
      Clica Adaptar currículo: 4: User
      Clica + Salvar candidatura: 5: User
      Vai pra /candidaturas: 5: User
    section Profundidade
      Treina entrevista STAR: 4: User
      Conversa com o gêmeo: 4: User
```

---

## Funcionalidades em detalhe

### 1. Diagnóstico (`/api/analyze`)

**Input**: currículo (texto, mín. 60 chars) + cargo-alvo
**Output**: perfil estruturado + Career Health Score (0-100) + 4 sub-scores + 3-4 gaps com prioridade

**Career Health Score** é calculado **em código**, não pela IA (`lib/score.js`):

```
Score = (Aderência × 0.40) + (Habilidades × 0.30) + (Perfil × 0.20) + (Experiência × 0.10)
```

A IA só **explica** cada sub-score. O número é determinístico. O usuário pode auditar.

**Gaps**: cada lacuna vem com:
- Habilidade (ex.: "Threat modeling")
- Por que importa (com fonte)
- Frequência nas vagas analisadas (ex.: "72%")
- Microação concreta (ex.: "Curso de threat modeling — 4h")
- Impacto se feita (ex.: "+5 em relevância de habilidades")

### 2. Opportunity Radar (`/api/opportunities`)

Busca vagas reais em **paralelo** com timeout 6s:
- **Adzuna BR** (cobertura ampla, traz salário)
- **Jooble** (agregador)
- **Greenhouse ATS** (boards públicos: nubank, stone, etc.)

Match calculado em código (`lib/skills-taxonomy.js`):
1. Extrai skills do `titulo + descrição` da vaga
2. Compara com skills do perfil
3. Calcula `match = |skills∩| / max(|perfil|, |vaga|) × 100`

A IA só justifica o porquê do match em uma frase. Não inventa número.

Sem chave de vagas configurada → fallback com vagas ilustrativas etiquetadas como tal.

### 3. Adaptador de currículo (`/api/tailor`)

Reescreve o CV adaptado pra uma vaga específica. Princípio: **autenticidade**.

- Bullets marcados como `"reorganizacao"` (vem do que já está no CV)
- Bullets marcados como `"nova"` (sugestão que o usuário precisa confirmar)
- Nunca inventa número ou conquista

### 4. Simulador de entrevista (`/api/interview`)

Dois modos:
- **`action: "question"`** — gera pergunta contextual ao cargo e às lacunas, com tipo (comportamental/técnica) e dica
- **`action: "evaluate"`** — avalia resposta usando STAR (Situação, Tarefa, Ação, Resultado) ou CAR (Contexto, Ação, Resultado). Retorna: elementos presentes, faltando, feedback, versão melhorada, **alerta de autenticidade** (se a versão sugerida inventou algo)

O alerta de autenticidade é defesa contra "treinar e mentir" — o produto se recusa a fabricar conquistas do usuário.

### 5. Chat com o gêmeo (`/api/chat`)

Conversa livre em até 5 frases por resposta. O "gêmeo" responde só com base em perfil + lacunas — não inventa fatos do usuário.

### 6. Tracking de candidaturas (`/candidaturas`)

Kanban com 6-7 estados:
```
SAVED → APPLIED → SCREENING → INTERVIEW → OFFER / REJECTED / WITHDRAWN
```

Cada mudança gera `ApplicationEvent` (timeline auditável). Datas-chave (`appliedAt`, `offerAt`, `rejectedAt`) marcadas automaticamente.

**Métricas no topo**: total · aplicadas · entrevistas · ofertas — com **taxa de conversão entre etapas**. Essa é a única métrica do pitch (`entrevistas conquistadas`) que cumpre o prometido.

### 7. Histórico de score (`/meu-gemeo`)

Cada novo diagnóstico cria um `ScoreSnapshot` imutável. A página mostra a evolução em barras — só funciona pra ver tendência se o usuário refaz o diagnóstico periodicamente (com CV atualizado).

### 8. Imports

| Origem | Como funciona |
|---|---|
| **CV em texto** | Textarea, validação Zod (60-40k chars) |
| **CV em PDF** | Upload, magic-bytes check, pdf-parse, sandbox, sanitização |
| **LinkedIn** | Cola texto (Sobre + Experiência + Skills), IA estrutura em campos |
| **Portfólio GitHub** | Usuário → API pública GitHub (60 req/h) → 10 repos mais relevantes → IA resume stack |
| **Portfólio URL** | Fetch público com timeout, anti-SSRF (IPv4+IPv6 privados bloqueados), anti DNS-rebinding, parse HTML básico |

### 9. Weekly digest (`/api/cron/digest`)

Toda segunda 12h UTC (9h BRT), Vercel Cron dispara o endpoint. Para cada usuário com `digestEnabled=true` e `lastDigestAt > 7 dias`:
1. Busca vagas pro `targetRole`
2. Filtra match ≥ 60%
3. Envia top 5 por email HTML via Resend

Toggle em `/meus-dados`. Email tem link pra desativar e pro funil.

### 10. LGPD por construção (`/meus-dados`)

- **Lista**: snapshots, candidaturas, fontes de dado, consentimentos
- **Toggle**: email semanal on/off (server action)
- **Baixar tudo**: `/api/me/export` retorna JSON com User + Profile + Snapshots + Gaps + PlanItems + Applications + Consents
- **Apagar tudo**: confirmação digitando "APAGAR" → cascade delete em tudo + logout

---

## Princípios editoriais

Estes são os 4 princípios que regem o que entra no produto:

1. **Número = cálculo. Texto = explicação com fonte.**
   Toda explicação termina com a fonte entre colchetes: `[Currículo]`, `[Mercado]`, `[Base de Vagas]`.

2. **Transparência radical.**
   A fórmula do score é visível na UI. Os sub-scores são expandíveis. O cálculo de match é auditável.

3. **Autenticidade preservada.**
   A IA é treinada a NÃO inventar conquistas. Onde faltar dado mensurável, ela usa o marcador `[adicione aqui um resultado mensurável real]` em vez de fabricar.

4. **LGPD não é checklist — é arquitetura.**
   Cada fonte de dado cria um `Consent` com `payloadHash`. Apagar é cascade real. Export é JSON portável.

---

## Diferenciais

Comparado a alternativas no mercado brasileiro:

| | LinkedIn | Catho/InfoJobs | Coaches | **CareerTwin AI** |
|---|---|---|---|---|
| Análise de CV com IA | ❌ | ❌ | manual, caro | ✅ auditável |
| Score auditável | ❌ | ❌ | subjetivo | ✅ fórmula visível |
| Vagas reais BR | ✅ | ✅ | ❌ | ✅ + match calculado |
| Skill gap concreto | ❌ | ❌ | ✅ manual | ✅ IA + microações |
| Simulador entrevista | ❌ | ❌ | ✅ caro | ✅ STAR/CAR + alerta autenticidade |
| Funil de candidaturas | parcial | ❌ | ❌ | ✅ com conversão |
| Email digest | spam | spam | ❌ | ✅ relevante |
| LGPD por construção | ❌ | ❌ | n/a | ✅ |
| Preço | grátis/$$$ | $ | $$$ | grátis (futuro: $) |

---

## Limitações conhecidas

São transparentes — vale o usuário saber.

- **Sonnet 4.6 é lento** (15-30s por diagnóstico). Migração pra Haiku 4.5 reduz latência mas baixa qualidade. Trade-off em aberto.
- **Skills taxonomy é manual** (`lib/skills-taxonomy.js`, ~25 entradas). Match perde precisão fora desse dicionário. Futuro: embeddings ou DB próprio.
- **Plano de 3 semanas é o mesmo formato sempre** — sem personalização por tempo disponível.
- **Sem mobile nativo** — funciona responsivo no mobile mas não tem app.
- **Cron sem painel admin** — só log Vercel + email. Não tem dashboard interno de "quantos digests foram enviados".
- **Custo LLM não cobrado** — usuário paga $0, Anthropic cobra ~$0.02 por diagnóstico. Sem billing ainda.
- **Sem retry de PDF mal-formado** — se o PDF é escaneado (imagem), parse falha sem OCR.
- **Sem comparação com pares** — não há "perfis como o seu têm score X".

---

## Modelo de negócio (planejado)

### B2C — Freemium

| Plano | Preço | Limites |
|---|---|---|
| Free | R$ 0 | 3 diagnósticos/mês · sem digest · sem adaptador de CV |
| Plus | R$ 29/mês | Ilimitado · digest semanal · adaptador · histórico ilimitado |
| Pro | R$ 49/mês | Tudo do Plus · simulador de entrevista ilimitado · prioridade no LLM |

### B2B — Seats (planejado, ainda não implementado)

| Plano | Preço estimado | Público |
|---|---|---|
| Universidade | R$ 800/mês por turma de 30 | Faculdades acompanhando alunos em fim de curso |
| Consultoria | R$ 1.500/mês por consultor + R$ 30/cliente | Consultorias de outplacement / coaching |
| Empresa | R$ 3.000/mês | RHs em programas de mobilidade interna |

---

## FAQ

**O CareerTwin guarda meu CV?**
Só se você logar. No modo "experimentar" nada sai do seu navegador (a chamada à IA não persiste). Se você criar conta, o CV vai pro banco — mas pode apagar tudo em 1 clique em `/meus-dados`.

**A IA inventa coisa sobre mim?**
Não devia. Os prompts são explícitos contra alucinação, toda explicação cita fonte, e o simulador de entrevista tem alerta dedicado pra avisar quando a sugestão assume algo não comprovado. Mas LLMs erram — sempre verifique antes de mandar o CV pra alguém.

**Posso confiar no Career Health Score?**
O número em si é determinístico (fórmula em código). A qualidade da entrada (`sub_scores`) depende da IA. Vale como **direção**, não como "nota oficial".

**Funciona pra área não-tech?**
Sim. O produto não pressupõe área. Já testamos com PM, marketing, jurídico, comercial. O dicionário de skills é mais forte em tech ainda, mas a IA cobre o resto razoavelmente.

**Posso usar pra recolocação executiva?**
Sim, mas pra cargos C-level a qualidade depende muito de como o CV está estruturado. Vale colar o LinkedIn + experiências detalhadas em parágrafos.

**Como é gerado o número?**
A fórmula está visível na UI: `Score = (Aderência × .40) + (Habilidades × .30) + (Perfil × .20) + (Experiência × .10)`. Cada sub-score vai de 0 a 100, calculado pela IA com base no seu CV e no cargo. O score final é a média ponderada — feita em código JavaScript, não pela IA.

**Posso apagar minha conta?**
Sim. `/meus-dados` → "Apagar tudo definitivamente" → digita APAGAR → confirma. Cascade delete em tudo. Não fica nada em sombra.

**A IA é da OpenAI?**
Não, é da Anthropic (Claude Sonnet 4.6). Trocável pra OpenAI por env. Toda chamada acontece no servidor — sua chave nunca vai pro navegador.

**Vocês me mandam spam?**
Não. O único email automático é o digest semanal de vagas — e você pode desligar a qualquer momento em `/meus-dados`.

---

## Próximas releases

Ver [CHANGELOG.md](../CHANGELOG.md) pro histórico e [README.md#roadmap](../README.md#-roadmap) pro roadmap planejado.

---

*Documentação atualizada com a release v0.4. Última revisão: 2026-06-22.*
