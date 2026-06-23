# RAG Retrieval Evaluation

Mede qualidade da retrieval do RAG-lite contra ground truth manual em
`queries.json`. Roda em ~1s (BM25 in-memory); pode rodar em pre-commit,
CI ou local antes de mergear PR que toca a retrieval ou a knowledge base.

## Como rodar

```bash
npm run eval:rag         # markdown report (default)
npm run eval:rag:json    # JSON estruturado pra ingestar em CI
```

Sem npm script, pode rodar direto:

```bash
node tests/eval/rag/run-eval.mjs
node tests/eval/rag/run-eval.mjs --json > result.json
```

## Metricas

- **Recall@3**: percentual de queries onde pelo menos 1 chunk esperado
  esta nos top 3 retornados. Threshold do gate.
- **Recall@5**: idem mas top 5. Sinal de "ta perto mas nao priorizou".
- **MRR (Mean Reciprocal Rank)**: 1/posicao do primeiro hit. Top1=1.0,
  top2=0.5, top3=0.33. Mede ranking.
- **NDCG@5**: qualidade do ranking normalizada. 1.0 = ideal (hits no
  topo), 0 = nenhum hit. Considera posicao de TODOS os hits.

## Threshold gate

Recall@3 >= 70% -> PASSED (exit 0). Senao, exit 1 (CI falha).

70% e o piso pre-embeddings. Pos-Voyage AI esperamos 85%+ no easy/medium,
hard pode ficar em 70-80%.

## Como adicionar query nova

Edita `queries.json`. Adiciona objeto:

```json
{
  "id": "q-NN-NNN",
  "query": "texto da pergunta em portugues natural",
  "expectedChunkIds": ["id-chunk-relevante-1", "id-chunk-relevante-2"],
  "topic": "cv | linkedin | interview | transition | soft-skills | salary | ats",
  "audience": "junior | pleno | senior | lead | transition | null",
  "difficulty": "easy | medium | hard"
}
```

`expectedChunkIds` precisa referenciar ids que **existem** em
`lib/knowledge/career-best-practices.json`. Se chunk ainda nao foi
escrito, deixa array vazio e adiciona `"pending": true` — eval pula.

## Distribuicao atual

- 50 queries (49 ativas, 1 pending)
- Por topic: cv(10), linkedin(10), interview(10), transition(10),
  soft-skills(6), salary(4)
- Por dificuldade: easy(20), medium(19), hard(11)
- Cobertura: queries em PT coloquial, jargao (STAR, BLUF, ATS-friendly,
  CLT vs PJ), sinonimos (curriculo/CV/resume), abreviacoes

## Quando rodar

- Apos qualquer mudanca em `lib/knowledge/retrieval.js`
- Apos adicionar/remover chunks em `career-best-practices.json`
- Antes de mergear PR que toca RAG
- Pos-migration pra embeddings (Voyage AI / pgvector) — comparar antes/depois

## Como interpretar regressao

| Sinal | Provavel causa |
|---|---|
| Easy caiu | Token novo no chunk quebrou match keyword |
| Hard caiu | Sinonimo/parafrase nao mapeada |
| MRR < Recall | Chunks certos aparecem, mas mal rankeados |
| Latency > 100ms | Algo virou O(n*m) — checar score function |
| Topic X com 0% recall | Falta chunk ou tags estao erradas |

## Limitacoes conhecidas

- **Ground truth manual**: queries refletem o que o autor achou
  relevante. Pode haver chunks tambem corretos que nao estao na lista.
- **Relevancia binaria**: NDCG assume "relevante ou nao", sem nuance.
  Nao distingue chunk 100% on-topic de chunk parcialmente util.
- **BM25-lite atual**: keyword exato com normalizacao NFD. Sinonimos
  ("CV" vs "curriculo") so funcionam se ambos estao nas tags do chunk.
