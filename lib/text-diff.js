// lib/text-diff.js
//
// Algoritmo de diff puro JS pra comparar CV original vs adaptado.
// SEM dependencia externa (sem npm `diff`, sem `jsdiff`). Implementacao
// baseada em LCS (Longest Common Subsequence) via programacao dinamica.
//
// Por que LCS e nao Myers?
//  - CVs sao curtos (<5k chars, ~200 linhas). O(n*m) com n,m<=200 = 40k
//    operacoes na pior hipotese. Inviavel? Nao: roda em <1ms.
//  - Myers e ~O((n+m)*D) onde D = numero de edits. Otimo pra arquivos
//    grandes (10k+ linhas) mas adiciona ~80 linhas de complexidade pra
//    ganhar 0ms em CVs. Trade-off ruim aqui.
//  - LCS via DP eh classico (CLRS cap. 15.4), facil de auditar e testar.
//
// Output: array de operacoes { type: "equal"|"insert"|"delete", value: string }
// Granularidade: linha (diffLines) ou palavra (diffWords).
//
// Nao trata move (linha que mudou de lugar). Sempre como delete+insert.
// Pra CV isso e ate desejavel: usuario quer ver "essa linha foi reescrita".

// ---- LCS table (programacao dinamica) ----
// Constroi matriz (n+1)x(m+1) onde C[i][j] = comprimento da LCS dos primeiros
// i tokens de a e primeiros j tokens de b. Padrao classico CLRS 15.4.
function buildLcsTable(a, b) {
  const n = a.length;
  const m = b.length;
  // Aloca matriz como array unidimensional (n+1)*(m+1) — economiza alocacao
  // de n arrays. Index: C[i*(m+1)+j].
  const rowLen = m + 1;
  const C = new Int32Array((n + 1) * rowLen);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        C[i * rowLen + j] = C[(i - 1) * rowLen + (j - 1)] + 1;
      } else {
        const top = C[(i - 1) * rowLen + j];
        const left = C[i * rowLen + (j - 1)];
        C[i * rowLen + j] = top >= left ? top : left;
      }
    }
  }
  return { C, rowLen };
}

// Backtrack na matriz LCS pra extrair operacoes. Comeca em (n, m) e anda
// pra (0, 0) escolhendo:
//   - a[i-1] === b[j-1]: equal, anda diagonal
//   - C[i-1][j] >= C[i][j-1]: delete a[i-1], anda pra cima
//   - else: insert b[j-1], anda pra esquerda
//
// Resultado fica em ordem invertida — precisamos reverter no final.
function backtrack(a, b, C, rowLen) {
  const ops = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: "equal", value: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || C[(i - 1) * rowLen + j] < C[i * rowLen + (j - 1)])) {
      ops.push({ type: "insert", value: b[j - 1] });
      j--;
    } else {
      // i > 0 garantido — invariante do loop (i>0 || j>0) + condicao acima
      ops.push({ type: "delete", value: a[i - 1] });
      i--;
    }
  }
  ops.reverse();
  return ops;
}

// Quebra texto em linhas. Normaliza \r\n e \r (Mac classic) pra \n primeiro,
// senao um CV salvo no Windows mostra cada linha como "modificada" so por
// causa de \r — falso positivo grosseiro.
function splitLines(text) {
  if (text == null || text === "") return [];
  const normalized = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.split("\n");
}

// ---- API publica ----

// diffLines(a, b): retorna lista de operacoes em granularidade linha-a-linha.
// Use no main view (lado-a-lado / unified).
export function diffLines(a, b) {
  const linesA = splitLines(a);
  const linesB = splitLines(b);
  // Edge cases: ambos vazios → []; um vazio → so insert ou delete.
  if (linesA.length === 0 && linesB.length === 0) return [];
  if (linesA.length === 0) {
    return linesB.map((v) => ({ type: "insert", value: v }));
  }
  if (linesB.length === 0) {
    return linesA.map((v) => ({ type: "delete", value: v }));
  }
  const { C, rowLen } = buildLcsTable(linesA, linesB);
  return backtrack(linesA, linesB, C, rowLen);
}

// diffWords(a, b): granularidade palavra-a-palavra dentro de uma linha.
// Use pra renderizar mudancas inline (riscar palavra removida, marcar
// palavra inserida em verde) quando uma linha foi "alterada" (delete+insert
// consecutivos no diffLines).
//
// Tokenizacao: split por whitespace preservando o whitespace como token
// proprio. Isso garante que "Engenheiro Backend" -> "Engenheiro Sr Backend"
// nao apague o espaco e nao bagunce o render.
export function diffWords(a, b) {
  const tokensA = tokenizeWords(a);
  const tokensB = tokenizeWords(b);
  if (tokensA.length === 0 && tokensB.length === 0) return [];
  if (tokensA.length === 0) {
    return tokensB.map((v) => ({ type: "insert", value: v }));
  }
  if (tokensB.length === 0) {
    return tokensA.map((v) => ({ type: "delete", value: v }));
  }
  const { C, rowLen } = buildLcsTable(tokensA, tokensB);
  return backtrack(tokensA, tokensB, C, rowLen);
}

// Tokenizer word-level: separa em runs de palavra vs whitespace, preserva
// ambos. Unicode-aware (\p{L}, \p{N}) pra portugues com acentos (Engenharia,
// Análise, Implementação). Sem regex u flag, \p escapes nao funcionam — usamos
// /u no construtor.
function tokenizeWords(text) {
  if (text == null || text === "") return [];
  const s = String(text);
  // Match: sequencia de letras/numeros/_ OU sequencia de nao-letras (whitespace
  // e pontuacao). Preserva tudo.
  const re = /[\p{L}\p{N}_]+|[^\p{L}\p{N}_]+/gu;
  return s.match(re) || [];
}

// lineStats(diff): conta tipos de mudanca. Util pra summary card no detail.
// "changed" = pares delete+insert consecutivos (heuristica: linha alterada).
// "untouched" = equal lines.
//
// Modo de calcular changed: percorre, quando ve um delete seguido de insert
// (ou insert seguido de delete), conta 1 changed e pula ambos. Garante que
// pares sao contabilizados como uma alteracao so, nao duas.
export function lineStats(diff) {
  if (!Array.isArray(diff)) {
    return { lines: 0, added: 0, removed: 0, changed: 0, untouched: 0 };
  }
  let added = 0;
  let removed = 0;
  let changed = 0;
  let untouched = 0;
  let i = 0;
  while (i < diff.length) {
    const op = diff[i];
    const next = diff[i + 1];
    // Heuristica: delete imediatamente seguido por insert (ou vice-versa) = changed.
    // Cobre o caso "linha foi reescrita" sem dupla-contar.
    if (op.type === "delete" && next && next.type === "insert") {
      changed++;
      i += 2;
      continue;
    }
    if (op.type === "insert" && next && next.type === "delete") {
      changed++;
      i += 2;
      continue;
    }
    if (op.type === "insert") added++;
    else if (op.type === "delete") removed++;
    else if (op.type === "equal") untouched++;
    i++;
  }
  const lines = added + removed + changed + untouched;
  return { lines, added, removed, changed, untouched };
}

// changePercent(stats): % de linhas tocadas (added+removed+changed) sobre o
// total. Util pro KPI "% mudou". Retorna 0 se total=0 (evita /0).
export function changePercent(stats) {
  if (!stats || stats.lines === 0) return 0;
  const touched = stats.added + stats.removed + stats.changed;
  return Math.round((touched / stats.lines) * 100);
}

// alignSideBySide(diff): transforma o stream de ops em linhas alinhadas pra
// render lado-a-lado. Cada item: { left: string|null, right: string|null,
// type: "equal"|"insert"|"delete"|"changed", words?: diff word-level }.
//
// Pares delete+insert consecutivos viram 1 linha "changed" com words diff.
// equal vira { left: x, right: x, type: equal }.
// insert sozinho: { left: null, right: x, type: insert }.
// delete sozinho: { left: x, right: null, type: delete }.
export function alignSideBySide(diff) {
  if (!Array.isArray(diff)) return [];
  const rows = [];
  let i = 0;
  while (i < diff.length) {
    const op = diff[i];
    const next = diff[i + 1];
    if (op.type === "equal") {
      rows.push({ left: op.value, right: op.value, type: "equal" });
      i++;
      continue;
    }
    if (op.type === "delete" && next && next.type === "insert") {
      rows.push({
        left: op.value,
        right: next.value,
        type: "changed",
        words: diffWords(op.value, next.value),
      });
      i += 2;
      continue;
    }
    if (op.type === "insert" && next && next.type === "delete") {
      // Caso simetrico — ainda conta como changed na direcao "linha foi reescrita"
      rows.push({
        left: next.value,
        right: op.value,
        type: "changed",
        words: diffWords(next.value, op.value),
      });
      i += 2;
      continue;
    }
    if (op.type === "delete") {
      rows.push({ left: op.value, right: null, type: "delete" });
    } else {
      // insert sozinho
      rows.push({ left: null, right: op.value, type: "insert" });
    }
    i++;
  }
  return rows;
}
