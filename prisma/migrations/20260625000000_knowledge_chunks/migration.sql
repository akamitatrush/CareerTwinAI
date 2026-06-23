-- RAG real: pgvector + Voyage AI embeddings.
-- vector(1024) casa com voyage-3 (Anthropic-recommended). OpenAI fallback
-- (text-embedding-3-small) trunca de 1536 pra 1024 via parametro `dimensions`.
-- HNSW index com cosine ops cobre query <=> em sub-ms ate centenas de milhares
-- de chunks; nao precisa de tuning de listas (vs IVFFlat).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "KnowledgeChunk" (
  "id" TEXT NOT NULL,
  "contentHash" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "audience" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "content" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "embedding" vector(1024),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeChunk_contentHash_key" ON "KnowledgeChunk"("contentHash");
CREATE INDEX "KnowledgeChunk_topic_idx" ON "KnowledgeChunk"("topic");
CREATE INDEX "KnowledgeChunk_embedding_idx" ON "KnowledgeChunk"
  USING hnsw ("embedding" vector_cosine_ops);
