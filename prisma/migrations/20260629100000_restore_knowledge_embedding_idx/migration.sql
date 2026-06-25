-- Restaura HNSW index em KnowledgeChunk.embedding dropado acidentalmente
-- pela migration 20260625045109_add_funnel_and_welcome.
--
-- Causa raiz: Prisma nao mapeia indices em colunas `Unsupported("vector")`,
-- entao `prisma migrate dev` ao gerar diff descartou o indice junto com
-- alteracoes nao relacionadas (welcomeEmailSentAt, nullability ajustes).
--
-- Impacto sem este indice: queries de similaridade (operador <=> cosine
-- em lib/knowledge/retrieval.js) caem para sequential scan na tabela
-- inteira a cada chamada de RAG.
--
-- Tipo restaurado identico ao original (migration 20260625000000_knowledge_chunks):
-- HNSW + vector_cosine_ops — bate com o operador <=> usado em
-- lib/knowledge/retrieval.js e dispensa tuning de `lists` (vs IVFFlat).
--
-- DROP IF EXISTS antes do CREATE garante idempotencia caso este SQL
-- seja reaplicado em ambiente que ja teve o indice restaurado manualmente.

DROP INDEX IF EXISTS "KnowledgeChunk_embedding_idx";

CREATE INDEX "KnowledgeChunk_embedding_idx"
  ON "KnowledgeChunk"
  USING hnsw ("embedding" vector_cosine_ops);
