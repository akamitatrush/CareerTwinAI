// tests/eval/rag/alias-loader.mjs
// Resolve+load hook pra rodar lib/knowledge/retrieval.js fora do Next.
// Duas funcoes:
//   1. resolve: mapeia alias "@/*" (jsconfig paths) -> caminho real.
//   2. load: injeta o atributo `type: "json"` em imports .json, ja que
//      retrieval.js usa `import x from "./y.json"` sem o `with` clause
//      (Next transpila isso; ESM puro nao).

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as pathResolve, extname } from "node:path";
import { statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = pathResolve(__dirname, "..", "..", "..");

const EXT_CANDIDATES = [".js", ".mjs", ".ts", ".tsx", ".json", ""];

function tryResolve(basePath) {
  if (extname(basePath)) {
    try {
      statSync(basePath);
      return basePath;
    } catch {
      return null;
    }
  }
  for (const ext of EXT_CANDIDATES) {
    const candidate = basePath + ext;
    try {
      statSync(candidate);
      return candidate;
    } catch {
      // segue
    }
    const indexCandidate = pathResolve(basePath, "index" + (ext || ".js"));
    try {
      statSync(indexCandidate);
      return indexCandidate;
    } catch {
      // segue
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relPath = specifier.slice(2);
    const absPath = pathResolve(ROOT, relPath);
    const found = tryResolve(absPath);
    const target = found || absPath + ".js";
    return {
      url: pathToFileURL(target).href,
      shortCircuit: true,
      format: target.endsWith(".json") ? "json" : "module",
      // Injeta attribute pra JSON modules.
      importAttributes: target.endsWith(".json")
        ? { type: "json" }
        : context.importAttributes,
    };
  }
  // Para .json importado por path relativo (ex: "./foo.json"), tambem
  // precisa injetar attributes pra Node 22 ESM nao reclamar.
  const resolved = await nextResolve(specifier, context);
  if (resolved.url.endsWith(".json")) {
    return {
      ...resolved,
      format: "json",
      importAttributes: { type: "json" },
    };
  }
  return resolved;
}
