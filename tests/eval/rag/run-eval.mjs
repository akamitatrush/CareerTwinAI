#!/usr/bin/env node
// tests/eval/rag/run-eval.mjs
// Roda queries contra retrieval, mede recall@3, recall@5, MRR, NDCG@5.
// Saida: markdown report (default) ou JSON estruturado (--json).
//
// Uso:
//   node tests/eval/rag/run-eval.mjs
//   node tests/eval/rag/run-eval.mjs --json > result.json
//
// Exit codes:
//   0 — eval rodou, threshold passou
//   1 — eval rodou, threshold falhou (recall@3 < 70%)
//   2 — eval crashou (erro inesperado)

import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { register } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..", "..", "..");

// Registra resolve hook pra alias "@/*" do Next.js (jsconfig paths).
// O arquivo lib/knowledge/retrieval.js importa "@/lib/embeddings", que ESM
// puro nao resolve — Next normalmente transpila isso. Aqui mapeamos
// "@/x" -> file://<ROOT>/x antes do default resolver atuar.
register(pathToFileURL(resolve(__dirname, "alias-loader.mjs")).href);

// === Metricas ===

// Recall@k binario: 1 se algum chunk esperado esta nos top k, senao 0.
// Retorna null pra queries sem ground truth (filtradas downstream).
function recallAtK(retrievedIds, expectedIds, k) {
  if (!expectedIds || expectedIds.length === 0) return null;
  const top = retrievedIds.slice(0, k);
  const hit = expectedIds.some((id) => top.includes(id));
  return hit ? 1 : 0;
}

// Mean Reciprocal Rank: 1/posicao do primeiro hit (1-indexed). 0 se nao
// achou. Penaliza ranking ruim: top1=1.0, top2=0.5, top3=0.33.
function reciprocalRank(retrievedIds, expectedIds) {
  if (!expectedIds || expectedIds.length === 0) return null;
  for (let i = 0; i < retrievedIds.length; i++) {
    if (expectedIds.includes(retrievedIds[i])) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

// Normalized DCG@k: qualidade do ranking. Para relevancia binaria, dcg
// soma 1/log2(pos+1) pra cada hit; idcg e o mesmo com hits empilhados no
// topo. Resultado em [0, 1]; 1 = ranking ideal.
function ndcgAtK(retrievedIds, expectedIds, k) {
  if (!expectedIds || expectedIds.length === 0) return null;
  let dcg = 0;
  for (let i = 0; i < Math.min(k, retrievedIds.length); i++) {
    if (expectedIds.includes(retrievedIds[i])) {
      dcg += 1 / Math.log2(i + 2);
    }
  }
  let idcg = 0;
  const idealHits = Math.min(expectedIds.length, k);
  for (let i = 0; i < idealHits; i++) {
    idcg += 1 / Math.log2(i + 2);
  }
  return idcg > 0 ? dcg / idcg : 0;
}

function avg(arr) {
  const vals = arr.filter((v) => typeof v === "number");
  return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// === Runner ===
async function main() {
  const isJson = process.argv.includes("--json");

  const queries = JSON.parse(
    await readFile(resolve(__dirname, "queries.json"), "utf-8"),
  );
  // Active = tem ground truth e nao esta marcada como pending.
  // Pending = chunk esperado ainda nao existe na knowledge base — eval
  // ignora pra nao penalizar score injustamente.
  const active = queries.filter(
    (q) => !q.pending && Array.isArray(q.expectedChunkIds) && q.expectedChunkIds.length > 0,
  );

  // Import dinamico: deixa o erro de modulo subir como crash de eval (exit 2)
  // em vez de quebrar parse do script. Path = file URL pra ESM em Node.
  const retrievalPath = resolve(ROOT, "lib/knowledge/retrieval.js");
  const { retrieveKnowledge } = await import(pathToFileURL(retrievalPath).href);

  const results = [];
  for (const q of active) {
    const t0 = Date.now();
    let retrieved;
    try {
      // Promise.resolve cobre os 2 casos: retrieval sync (interface atual)
      // ou async (interface futura). Sem este wrap, sync funciona mas async
      // retornaria Promise nao-resolvida pra .map().
      retrieved = await Promise.resolve(
        retrieveKnowledge({
          query: q.query,
          topic: q.topic,
          audience: q.audience,
          limit: 5,
        }),
      );
    } catch (e) {
      results.push({
        ...q,
        error: e.message,
        retrievedIds: [],
        latencyMs: Date.now() - t0,
      });
      continue;
    }
    const ids = Array.isArray(retrieved) ? retrieved.map((r) => r.id) : [];
    results.push({
      ...q,
      retrievedIds: ids,
      r3: recallAtK(ids, q.expectedChunkIds, 3),
      r5: recallAtK(ids, q.expectedChunkIds, 5),
      mrr: reciprocalRank(ids, q.expectedChunkIds),
      ndcg5: ndcgAtK(ids, q.expectedChunkIds, 5),
      latencyMs: Date.now() - t0,
    });
  }

  const summary = {
    timestamp: new Date().toISOString(),
    totalQueries: queries.length,
    activeQueries: active.length,
    skipped: queries.length - active.length,
    avgRecallAt3: avg(results.map((r) => r.r3)),
    avgRecallAt5: avg(results.map((r) => r.r5)),
    avgMRR: avg(results.map((r) => r.mrr)),
    avgNDCG5: avg(results.map((r) => r.ndcg5)),
    avgLatencyMs: avg(results.map((r) => r.latencyMs)),
    errors: results.filter((r) => r.error).length,
    threshold: {
      recallAt3: 0.7,
      passed: null,
    },
  };
  summary.threshold.passed = summary.avgRecallAt3 >= summary.threshold.recallAt3;

  // Quebra por dificuldade — sinal de onde o retrieval falha (easy ja
  // deve ser ~100%; hard e o que vai melhorar com embeddings).
  const byDifficulty = {};
  for (const d of ["easy", "medium", "hard"]) {
    const subset = results.filter((r) => r.difficulty === d);
    if (subset.length === 0) continue;
    byDifficulty[d] = {
      count: subset.length,
      recallAt3: avg(subset.map((r) => r.r3)),
      recallAt5: avg(subset.map((r) => r.r5)),
      mrr: avg(subset.map((r) => r.mrr)),
    };
  }
  summary.byDifficulty = byDifficulty;

  // Quebra por topic — onde investir em chunks novos ou termos.
  const byTopic = {};
  for (const r of results) {
    const t = r.topic || "_unknown";
    (byTopic[t] = byTopic[t] || []).push(r);
  }
  const byTopicAgg = {};
  for (const [t, rs] of Object.entries(byTopic)) {
    byTopicAgg[t] = {
      count: rs.length,
      recallAt3: avg(rs.map((r) => r.r3)),
      mrr: avg(rs.map((r) => r.mrr)),
    };
  }
  summary.byTopic = byTopicAgg;

  if (isJson) {
    process.stdout.write(JSON.stringify({ summary, results }, null, 2));
    if (!summary.threshold.passed) process.exitCode = 1;
    return;
  }

  // Markdown report
  let md = `# RAG Retrieval Eval - ${summary.timestamp}\n\n`;
  md += `**Total queries**: ${summary.totalQueries} `;
  md += `(${summary.activeQueries} active, ${summary.skipped} skipped)\n\n`;

  md += `## Summary\n\n`;
  md += `| Metric | Value | Threshold |\n|---|---|---|\n`;
  md += `| Recall@3 | **${(summary.avgRecallAt3 * 100).toFixed(1)}%** | >=70% |\n`;
  md += `| Recall@5 | ${(summary.avgRecallAt5 * 100).toFixed(1)}% | - |\n`;
  md += `| MRR | ${summary.avgMRR.toFixed(3)} | - |\n`;
  md += `| NDCG@5 | ${summary.avgNDCG5.toFixed(3)} | - |\n`;
  md += `| Avg latency | ${summary.avgLatencyMs.toFixed(1)}ms | - |\n`;
  md += `| Errors | ${summary.errors} | 0 |\n\n`;
  md += `**Threshold gate**: ${summary.threshold.passed ? "PASSED" : "FAILED"}\n\n`;

  md += `## By difficulty\n\n`;
  md += `| Difficulty | Count | Recall@3 | Recall@5 | MRR |\n|---|---|---|---|---|\n`;
  for (const [d, m] of Object.entries(byDifficulty)) {
    md += `| ${d} | ${m.count} | ${(m.recallAt3 * 100).toFixed(1)}% | `;
    md += `${(m.recallAt5 * 100).toFixed(1)}% | ${m.mrr.toFixed(3)} |\n`;
  }
  md += `\n`;

  md += `## By topic\n\n`;
  md += `| Topic | Count | Recall@3 | MRR |\n|---|---|---|---|\n`;
  for (const [t, m] of Object.entries(byTopicAgg)) {
    md += `| ${t} | ${m.count} | ${(m.recallAt3 * 100).toFixed(1)}% | `;
    md += `${m.mrr.toFixed(3)} |\n`;
  }
  md += `\n`;

  md += `## Worst queries (recall@3 = 0)\n\n`;
  const worst = results.filter((r) => r.r3 === 0).slice(0, 10);
  if (worst.length === 0) {
    md += `_nenhuma — todas queries tiveram pelo menos 1 hit no top 3._\n\n`;
  } else {
    for (const w of worst) {
      md += `- **${w.id}** (${w.difficulty}/${w.topic}): "${w.query}"\n`;
      md += `  - Expected: \`${w.expectedChunkIds.join(", ")}\`\n`;
      md += `  - Retrieved: \`${(w.retrievedIds || []).slice(0, 5).join(", ") || "(empty)"}\`\n`;
    }
    md += `\n`;
  }

  if (summary.errors > 0) {
    md += `## Errors\n\n`;
    for (const e of results.filter((r) => r.error)) {
      md += `- **${e.id}**: ${e.error}\n`;
    }
    md += `\n`;
  }

  process.stdout.write(md);

  if (!summary.threshold.passed) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("Eval crashou:", e);
  process.exit(2);
});
