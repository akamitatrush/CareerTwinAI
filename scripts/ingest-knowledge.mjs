#!/usr/bin/env node
// scripts/ingest-knowledge.mjs
// Le lib/knowledge/career-best-practices.json (e futuros JSONs), gera embeddings
// via lib/embeddings.js e UPSERTa em KnowledgeChunk.
//
// Idempotente: contentHash = sha256(content)[0..32] garante que rodar 2x nao
// duplica. Hash novo => chunk novo (ou atualizacao do mesmo `id`).
//
// Uso:
//   node scripts/ingest-knowledge.mjs           # ingere o que falta
//   node scripts/ingest-knowledge.mjs --dry     # so loga, nao chama embed nem DB
//
// Custo (Voyage voyage-3, $0.06/1M tokens):
//   30 chunks x ~200 tokens medios = 6k tokens = $0.00036. Negligivel.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { embedTexts, isEmbeddingAvailable } from "../lib/embeddings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Cada source vira um array de chunks no shape canonico (id, topic, audience,
// content, source, tags). Adicione mais JSONs aqui no futuro sem mexer no loop.
const SOURCES = [
  { file: "lib/knowledge/career-best-practices.json", parse: (raw) => raw },
];

function hash(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}

async function loadAllChunks() {
  const all = [];
  for (const src of SOURCES) {
    const path = resolve(ROOT, src.file);
    const raw = JSON.parse(await readFile(path, "utf-8"));
    const items = src.parse(raw);
    if (!Array.isArray(items)) continue;
    for (const c of items) {
      if (!c.content || !c.id) continue;
      all.push({
        id: c.id,
        contentHash: hash(c.content),
        topic: c.topic || "general",
        audience: Array.isArray(c.audience) ? c.audience : [],
        content: c.content,
        source: c.source || "unknown",
        tags: Array.isArray(c.tags) ? c.tags : [],
      });
    }
  }
  return all;
}

async function main() {
  const isDry = process.argv.includes("--dry");

  if (!isEmbeddingAvailable()) {
    console.error(
      "ERRO: defina VOYAGE_API_KEY (recomendado) ou OPENAI_API_KEY no .env"
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const chunks = await loadAllChunks();
  console.log(`Carregados ${chunks.length} chunks dos JSONs.`);

  // Skip chunks que ja existem com o MESMO hash (= conteudo nao mudou).
  // Se conteudo foi editado, hash muda e cai no path de re-embed.
  const existing = await prisma.knowledgeChunk.findMany({
    where: { contentHash: { in: chunks.map((c) => c.contentHash) } },
    select: { contentHash: true },
  });
  const existingHashes = new Set(existing.map((e) => e.contentHash));

  const toIngest = chunks.filter((c) => !existingHashes.has(c.contentHash));
  console.log(
    `${toIngest.length} chunks novos pra ingerir. ${existingHashes.size} ja indexados.`
  );

  if (toIngest.length === 0) {
    console.log("Nada novo. Saindo.");
    await prisma.$disconnect();
    return;
  }

  if (isDry) {
    console.log("--dry: nao gera embeddings nem grava.");
    for (const c of toIngest.slice(0, 5)) {
      console.log(`  - ${c.id} (${c.topic}) ${c.contentHash.slice(0, 8)}…`);
    }
    if (toIngest.length > 5) console.log(`  …+${toIngest.length - 5}`);
    await prisma.$disconnect();
    return;
  }

  // Batch de 50 — Voyage permite ate 128, mas 50 deixa margem de seguranca
  // pro tamanho total da request (cada chunk pode ter ate ~600 chars).
  const BATCH = 50;
  for (let i = 0; i < toIngest.length; i += BATCH) {
    const batch = toIngest.slice(i, i + BATCH);
    console.log(`Embed batch ${i / BATCH + 1}: ${batch.length} chunks…`);
    const texts = batch.map((c) => c.content);
    const vectors = await embedTexts(texts, { inputType: "document" });
    if (vectors.length !== batch.length) {
      throw new Error(
        `Vector count mismatch: ${vectors.length} vs ${batch.length}`
      );
    }

    // Insert via $executeRaw — Prisma nao suporta tipo vector direto. Cada
    // valor de array/vector usa cast explicito (::text[] e ::vector) pra
    // evitar parsing ambiguo. ON CONFLICT(id) faz upsert idempotente.
    for (let j = 0; j < batch.length; j++) {
      const c = batch[j];
      const vec = vectors[j];
      // Formato Postgres vector: "[v1,v2,...]" como string literal.
      const vecLiteral = `[${vec.join(",")}]`;
      await prisma.$executeRaw`
        INSERT INTO "KnowledgeChunk" (id, "contentHash", topic, audience, content, source, tags, embedding, "createdAt", "updatedAt")
        VALUES (
          ${c.id},
          ${c.contentHash},
          ${c.topic},
          ${c.audience}::text[],
          ${c.content},
          ${c.source},
          ${c.tags}::text[],
          ${vecLiteral}::vector,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          "contentHash" = EXCLUDED."contentHash",
          topic = EXCLUDED.topic,
          audience = EXCLUDED.audience,
          content = EXCLUDED.content,
          source = EXCLUDED.source,
          tags = EXCLUDED.tags,
          embedding = EXCLUDED.embedding,
          "updatedAt" = NOW()
      `;
    }
  }

  const total = await prisma.knowledgeChunk.count();
  console.log(`Ingestao concluida. Total no DB: ${total}.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Falhou:", e);
  process.exit(1);
});
