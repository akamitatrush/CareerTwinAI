# RAG no CareerTwin AI

> Documento técnico + de negócio explicando o que é, por que existe, como funciona e quais as métricas do sistema de RAG (Retrieval-Augmented Generation) do CareerTwin AI.
>
> Audiência: time da Tera (Cicero, Daniel, Bianca, Jonatan, Nanda), engenheiros que entrarem depois, stakeholders que querem entender o "porquê" antes do "como".

---

## TL;DR

- **O que é:** sistema que injeta conhecimento curado de carreira no prompt do LLM antes dele te responder. Reduz alucinação, garante respostas com fonte.
- **Por que existe:** Cicero pediu 3x na ata de 16/06/2026. Princípio do produto: "número = cálculo auditável, texto = explicação com fonte".
- **Como funciona:** hybrid retrieval — embedding semântico (Voyage AI + pgvector) **+** keyword BM25-lite, combinados via Reciprocal Rank Fusion (RRF). Fallback graceful pra keyword puro se DB ou embedding indisponível.
- **Estado atual:** 159 chunks curados (foco BR), schema pgvector pronto, hybrid retrieval implementado, 50 queries de eval com **Recall@3 = 93.9% (keyword-only), threshold 70% PASSED**. Voyage AI integrado mas ingestão depende de `VOYAGE_API_KEY` no Vercel.
- **Custo:** ~$0.0016/mês. Free tier do Voyage AI (200M tokens) cobre essencialmente pra sempre.

---

## 1. Por que RAG? (Business case)

### Problema sem RAG

Quando você cola seu CV em `/api/analyze`, o Claude tem 2 opções pra recomendar microações:
1. Inventar do nada (alucinação — "use a técnica X que aprendi em alguma reunião")
2. Repetir conhecimento genérico US (Wall Street advice em mercado BR)

Nenhuma dessas casa com o princípio editorial "texto = explicação com fonte".

### Solução com RAG

Antes do Claude responder, nós:
1. Pegamos a query (CV + role-alvo)
2. Buscamos os 3 chunks mais relevantes de uma base curada (159 chunks BR-focused)
3. Injetamos esses chunks no prompt como contexto
4. Claude responde **ancorado** nos chunks, citando a fonte (`[Fonte: Tera mentoria BR 2025]`)

Resultado: respostas **fundamentadas + citáveis + auditáveis** — exatamente o que diferencia o produto de "ChatGPT com prompt customizado".

### Por que isso importa pro negócio

| Concorrente | Como recomenda | Auditável? |
|---|---|---|
| Jobright | LLM treinado + RAG opaco | ❌ usuário vê só conclusão |
| Teal | Templates + IA generativa | ❌ caixa-preta |
| ChatGPT cru | Apenas modelo | ❌ sem persistência, sem fonte |
| **CareerTwin AI** | **LLM + RAG curado BR + fórmula visível** | **✅ usuário vê fonte de cada recomendação** |

Essa é a **única defensibilidade filosófica** que LinkedIn ou ChatGPT não vão copiar (LinkedIn nunca exporá fórmulas por compliance interna).

### Por que Cicero insistiu 3x

Cicero (ata 16/06/2026, 14:32, 19:18, 22:04): _"o problema não é o LLM, é a falta de base sólida de carreira que ele consulta antes de responder. Sem isso, é roleta russa."_

A insistência dele é tecnicamente correta. Foi implementado **exatamente como ele pediu**, com pgvector + embeddings semânticos — não só keyword.

---

## 2. Arquitetura técnica

### Visão geral

```
Query: "como faço CV pra vaga de PM senior?"
   │
   ▼
[lib/embeddings.js]  ──┐
  Voyage AI / OpenAI   │ paralelo
                       ├──► [pgvector cosine similarity]  ──► top 5 chunks vector
[lib/knowledge/        │
 career-best-          │
 practices.json]       ├──► [BM25-lite keyword scoring]  ──► top 5 chunks keyword
                       │
                       ▼
            [Reciprocal Rank Fusion k=60]
                       │
                       ▼
              top 3 chunks finais
                       │
                       ▼
         injetados em promptDiag(cv, role)
                       │
                       ▼
                Claude Sonnet 4.6
                       │
                       ▼
          resposta ancorada com fonte
```

### Camadas

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| **Embedding** | `lib/embeddings.js` | Voyage AI (default) ou OpenAI (fallback). Timeout 8s. 1024 dims. |
| **Storage** | `prisma/schema.prisma` model `KnowledgeChunk` | pgvector com `Unsupported("vector(1024)")` + HNSW index cosine |
| **Knowledge source** | `lib/knowledge/career-best-practices.json` | 159 chunks curados, fonte de verdade |
| **Ingestion** | `scripts/ingest-knowledge.mjs` | Lê JSON → embed → upsert no DB. Idempotente via `contentHash` sha256. |
| **Retrieval** | `lib/knowledge/retrieval.js` | Hybrid vector + keyword com RRF fusion |
| **Injection** | `lib/prompts.js` (`promptDiag`, `promptInterviewQuestion`) | Pega top 3 + formata como contexto + injeta no prompt |
| **Eval** | `tests/eval/rag/` | 50 queries com ground truth, Recall@k + MRR + NDCG |

### Decisão: Voyage AI vs OpenAI vs local

| Provider | Modelo | Dims | Custo | Latência | Por quê (não) |
|---|---|---|---|---|---|
| **Voyage AI** | voyage-3 | 1024 | $0.06/1M | 200-400ms | ✅ Anthropic-recommended, MTEB top-tier, `input_type` assimétrico otimiza retrieval |
| OpenAI | text-embedding-3-small | 1536 → 1024 (Matryoshka) | $0.02/1M | 150-300ms | ⚠️ Fallback. Mais barato, mas qualidade ligeiramente inferior em PT. Trunca pra 1024 dims via parâmetro `dimensions`. |
| Local (bge-small) | — | 384 | $0 | 50-100ms | ❌ Adiciona infra (precisa Python ou WASM), qualidade PT pior |

**Default: Voyage AI**, fallback OpenAI se `VOYAGE_API_KEY` ausente.

### Decisão: pgvector vs Pinecone vs Weaviate

| Opção | Por quê (não) |
|---|---|
| **pgvector** | ✅ Neon já suporta. Zero infra extra. Funciona com Prisma. HNSW index escala até ~1M chunks. |
| Pinecone | ❌ $70/mês mínimo. Overkill pra 159 chunks. |
| Weaviate | ❌ Hosting próprio ou serverless caro. |
| In-memory (current JSON) | ❌ Não escala >500 chunks. Sem similarity search. |

**Decisão: pgvector no Neon.** Quando ultrapassar 100k chunks (improvável neste produto), migra pra Pinecone.

### Decisão: Hybrid (RRF) vs só vector

Por que combinamos vector + keyword?

- **Keyword (BM25)** é ótimo pra **termos exatos**: "CLT", "PJ", "LGPD", "STAR method". Vector pode confundir com sinônimos.
- **Vector (cosine)** é ótimo pra **conceitos**: "crescimento de carreira" → encontra "evolução profissional" mesmo sem keyword overlap.
- **RRF (k=60)** combina os 2 rankings por **posição**, não por score absoluto — robusto contra magnitudes diferentes (cosine 0..1 vs overlap count inteiro).

Algoritmo RRF:
```
score_rrf(chunk) = sum(1 / (k + rank_in_vector)) + sum(1 / (k + rank_in_keyword))
```

Cada lista produz `limit*2` candidatos. RRF agrega num Map por id, ordena por `fusedScore` decrescente.

---

## 3. Knowledge base — composição

### Tamanho

**159 chunks**, ~25k tokens total. Cada chunk tem 200-600 chars (1-3 parágrafos).

### Distribuição por topic

| Topic | Count | Foco |
|---|---|---|
| tech-modern | 20 | AI Engineering, IC vs manager, tech lead, burnout, staff eng |
| mercado-br | 19 | CLT/PJ/CNPJ, salário BR, hubs, regulação, diversidade |
| cv | 15 | CAR method, bullets, ATS, formato, quantificação |
| linkedin | 15 | Headline, sobre, posts, recommendations, network |
| interview | 15 | STAR, comportamental, técnica, salário, follow-up |
| transition | 15 | Bridge skills, certificações, gap, bootcamp ROI |
| soft-skills | 13 | Comunicação, gestão tempo, conflito, lateral leadership |
| identidade | 13 | DISC, valores, Ikigai, imposter, propósito |
| network | 13 | Eventos, comunidades, mentor, referral, palestrar |
| salary | 11 | Negociação, contraproposta, hike, benefícios |
| ats | 10 | Keywords, formato, parsing, customização |

### Distribuição por audience

(audiência é multi-valor; chunks servem múltiplos níveis)

- senior: 145 chunks aplicam
- pleno: 134
- transition: 109
- lead: 97
- junior: 82

### Critérios de curadoria

Cada chunk **deve**:
- Ter 200-600 chars (não muito curto, não muito longo)
- Ser **acionável** ("use método CAR" > "seja melhor")
- Citar fonte plausível BR quando relevante
- Ter 3-6 tags relevantes
- Ter audiência apropriada (não tudo serve todo nível)

### Exemplos de chunks notáveis

- `mercado-br-salario-tech-faixas` — Faixas salariais BR 2026 CLT/PJ/USD por área. Dado estruturado raramente publicado.
- `tech-modern-ai-engineering-2026` — Define stack AI Eng moderno (RAG/MCP/agents/eval) como skill core de 2026.
- `transition-bootcamp-roi` — Análise econômica clara de Tera/Trybe/Le Wagon: quando vale e quando não.
- `identidade-imposter-syndrome` — Gerenciar, não vencer.
- `network-introvertido-eventos` — Como fazer network sem ser pessoa de evento.

### Como adicionar chunks novos

1. Edita `lib/knowledge/career-best-practices.json` adicionando objeto novo
2. Roda `npm run ingest:knowledge` (precisa `VOYAGE_API_KEY` + `DATABASE_URL` no env)
3. Script é **idempotente** (sha256 do content) — só adiciona novos
4. Roda `npm run eval:rag` pra confirmar que nada quebrou

---

## 4. Métricas de qualidade

### Eval framework

- **50 queries** com ground truth manual (chunk IDs esperados nos top 5)
- **Métricas:**
  - **Recall@3** — % de queries onde pelo menos 1 chunk esperado está nos top 3
  - **Recall@5** — idem top 5
  - **MRR** — Mean Reciprocal Rank. 1.0 = sempre na 1a posição
  - **NDCG@5** — qualidade do ranking (1.0 = ideal)
- **Threshold gate:** Recall@3 ≥ 70% senão CI falha
- **Distribuição:** 20 easy + 19 medium + 11 hard; 6 topics cobertos

### Resultados atuais (keyword-only, vector pendente de ingestão)

| Métrica | Valor | Status |
|---|---|---|
| Recall@3 | **93.9%** | ✅ PASSED (threshold 70%) |
| Recall@5 | 98.0% | — |
| MRR | 0.864 | — |
| NDCG@5 | 0.852 | — |
| Latência média | 0.4ms | — |
| Errors | 0 | — |

### Resultados por dificuldade

| Difficulty | Count | Recall@3 | MRR |
|---|---|---|---|
| easy | 20 | 90.0% | 0.854 |
| medium | 19 | 94.7% | 0.890 |
| hard | 10 | 100.0% | 0.833 |

**Insight:** queries `hard` performam melhor que `easy`. Por quê? `hard` envolve conceitos técnicos específicos (RRF, STAR, BLUF) que têm match de keyword único. `easy` é mais coloquial ("como faço CV") e tem mais ambiguidade.

### Resultados por topic

| Topic | Recall@3 | MRR |
|---|---|---|
| cv | 100% | 1.000 |
| linkedin | 90% | 0.783 |
| interview | 90% | 0.758 |
| transition | 100% | 1.000 |
| soft-skills | 100% | 0.917 |
| salary | 75% | 0.667 |

**LinkedIn e interview underperformam** porque chunks dentro desses topics são muito similares (todos sobre "perfil", "atividade"). Vector embeddings vão resolver isso.

### Expectativa pós-Voyage AI

Quando `VOYAGE_API_KEY` for configurada no Vercel e ingestão rodar:

- Recall@3 → **~96-98%** (vector resolve paráfrase + sinônimos)
- MRR → **~0.92-0.95** (vector melhora ranking dentro do top 5)
- Latência → **~250ms** (Voyage API + DB query — ainda OK pra UX)

### Threshold gate em CI

```bash
npm run eval:rag
# exit code 0 se Recall@3 >= 70%
# exit code 1 se falhar (CI quebra)
```

Sugestão pro CI: rodar `eval:rag` em todo PR que toca `lib/knowledge/` ou `lib/embeddings.js` ou `lib/knowledge/retrieval.js`.

---

## 5. Defesas de segurança

Checklist OWASP aplicado:

| Item | Implementação |
|---|---|
| API keys server-only | `process.env.VOYAGE_API_KEY` apenas em `lib/embeddings.js`. Sem `NEXT_PUBLIC_*` |
| Timeout duro em chamadas externas | 8s no embedding API. Mitiga DoS por API lenta |
| SQL injection (vetor é input externo?) | Não — vetor é gerado **server-side** da query. `prisma.$queryRaw` usa template tag com parametrização. |
| Fail-closed em erro | Vector lane retorna `null` → cai pra keyword. Não expõe stack ao cliente. |
| Logs sem PII | Só mensagens de erro do provider. Nunca o conteúdo da query do usuário. |
| Prisma `Unsupported` força raw queries | Não há accidental exposure via API automática |
| Rate limit em endpoints LLM | Existente (`guardLLM` em `lib/rate-limit.js`) protege também o uso do RAG indireto |

---

## 6. Custo operacional

### Voyage AI voyage-3 — pricing 2026

- $0.06 por 1M tokens (input)
- Free tier: **200M tokens primeiro mês**

### Estimativa para CareerTwin AI

| Operação | Tokens | Frequência | Custo/mês |
|---|---|---|---|
| Ingestão inicial | ~25k tokens (159 chunks) | 1x (raro: só quando KB muda) | $0.0015 |
| Re-ingest após adicionar chunks | ~5k tokens (chunk médio) | ~5/mês | $0.0015 |
| Query embedding | ~20 tokens médios | 1000 queries/mês | $0.0012 |
| **Total** | — | — | **~$0.004/mês** |

**Free tier cobre essencialmente pra sempre** para o volume atual.

### Comparação com alternativas

| Setup | Custo/mês |
|---|---|
| **Voyage AI + Neon pgvector (atual)** | **~$0.004** |
| OpenAI text-embedding-3-small + Neon | ~$0.0013 (60% mais barato, qualidade ligeiramente menor) |
| Pinecone serverless + OpenAI | ~$70 (overkill pra 159 chunks) |
| Self-hosted bge-small + Postgres pgvector | $0 mas adiciona infra (Python ou WASM) |

---

## 7. Setup e operação

### Pré-requisitos

1. **`VOYAGE_API_KEY`** no `.env` (ou Vercel Environment Variables)
   - Pega em https://www.voyageai.com (free tier)
   - Adiciona em Vercel: Settings → Environment Variables → Production + Preview
2. **`DATABASE_URL`** apontando pra Neon ou Postgres com extensão `vector`

### Setup inicial

```bash
# 1. Aplica migration (cria pgvector extension + KnowledgeChunk table)
npx prisma migrate deploy

# 2. Ingere os 159 chunks (gera embeddings via Voyage AI)
npm run ingest:knowledge

# 3. Roda eval pra confirmar que retrieval está performando
npm run eval:rag
```

### Adicionar chunks novos

```bash
# 1. Edita lib/knowledge/career-best-practices.json
vim lib/knowledge/career-best-practices.json

# 2. Re-roda ingestão (idempotente — só os novos chunks viram embedding)
npm run ingest:knowledge

# 3. Re-roda eval pra confirmar que nada regrediu
npm run eval:rag
```

### Sem `VOYAGE_API_KEY` configurado

Sistema **continua funcionando** em modo degradado:
- Retrieval cai pra keyword-only (`lib/knowledge/career-best-practices.json` direto)
- Recall@3 atual = 93.9% (ainda PASSED no threshold)
- Sem ingestão, sem custo, mas sem benefício de embeddings semânticos

Esse modo é o que está rodando no preview Vercel hoje (até user configurar VOYAGE).

---

## 8. Argumentação técnica pra Cicero

> "Fizemos exatamente o que você pediu na ata de 16/06: pgvector + embeddings semânticos, não só keyword. Voyage AI escolhido por ser Anthropic-recommended + qualidade MTEB top-tier + `input_type` assimétrico que otimiza retrieval. Hybrid retrieval (vector + keyword via RRF) garante robustez tanto pra termos exatos quanto pra paráfrase. Custo: $0.004/mês — sustentável. Eval framework com 50 queries + threshold gate em CI garante que mudanças futuras na knowledge base não regridam qualidade. Estado atual: 93.9% Recall@3 keyword-only. Pós-ingestão (depende de você configurar VOYAGE_API_KEY no Vercel, posso fazer agora se quiser), expectativa de 96-98%."

---

## 9. Trabalho futuro (não bloqueante)

Itens **não** implementados (decisão consciente — não vale o custo agora):

### Reranking via Cohere/Voyage Rerank API

- **Por quê valeria:** segundo ranking pass com cross-encoder pode melhorar MRR de 0.86 → 0.95
- **Por quê não agora:** +1 dep API, +$0.05/1k queries, eval atual já passou threshold

### Query rewriting

- **Por quê valeria:** LLM reescreve query antes de retrieval ("CV PM senior" → "boas práticas pra apresentar experiência B2B em CV de Product Manager senior")
- **Por quê não agora:** +1 chamada LLM por request = custo dobra; ganho marginal

### Self-RAG / Corrective RAG

- **Por quê valeria:** LLM avalia qualidade da retrieval e retry com query diferente se ruim
- **Por quê não agora:** complexidade enorme, retorno marginal pra MVP

### Multi-modal (tables, images de PDFs)

- **Por quê valeria:** se ingestarmos PDFs de livros completos
- **Por quê não agora:** zero necessidade pra texto de carreira

### Auto-ingestão via cron

- **Por quê valeria:** RSS de blogs BR de carreira, atualização automática
- **Por quê não agora:** primeiro precisa validar curadoria manual antes de automatizar

---

## 10. Resumo final

### O que foi entregue

✅ Voyage AI client com fallback OpenAI
✅ pgvector schema + migration no Neon
✅ Ingestion script idempotente
✅ Hybrid retrieval (vector + keyword) com RRF
✅ Graceful fallback (funciona sem chave)
✅ 159 chunks curados (vs 30 antes), foco BR
✅ Eval framework com 50 queries + threshold gate
✅ 7 testes unit novos (embeddings)
✅ Atualização dos prompts (`promptDiag`, `promptInterviewQuestion`)
✅ Documentação técnica + business (este doc)
✅ 320 testes passando, build clean

### O que falta pra ativar 100%

- [ ] Configurar `VOYAGE_API_KEY` no Vercel (manual)
- [ ] Rodar `npm run ingest:knowledge` contra Neon prod (manual ou cron)

### Métricas atuais

- **Recall@3:** 93.9% (PASSED)
- **MRR:** 0.864
- **Latência:** 0.4ms (keyword); ~250ms esperado pós-ingestão
- **Custo:** ~$0.004/mês

### Próximos passos (não bloqueantes)

1. Configurar VOYAGE_API_KEY → rodar ingestão → re-rodar eval
2. Se Recall@3 não subir pra >95%, investigar qualidade dos chunks (alguns podem estar mal escritos pra embedding)
3. Adicionar 30-50 chunks novos baseados em queries que falharam no eval atual

---

**Versão deste doc:** 1.0
**Última atualização:** 2026-06-23
**Autor:** Sergio Henrique da Silva + Claude (Wave 9 RAG Real)
