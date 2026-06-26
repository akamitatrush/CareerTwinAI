// lib/logger.js
// Logger estruturado JSON-line. Console em dev, breadcrumb no Sentry (quando carregado).
// Formato: { ts, level, route, msg, ...meta } — uma linha JSON por entrada.
//
// Por que JSON-line: ingestao trivial em Datadog/Loki/CloudWatch/Vercel logs.
// Cada linha e parseavel sozinha, sem multilinha, sem cor ANSI.
//
// Seguranca: chaves marcadas como PII viram "[REDACTED]" antes de qualquer
// emit. A lista e fechada — nao tente logar campos novos que contenham PII
// sem adicionar a chave a PII_KEYS, ou crie sub-objetos que escapem ao filtro.
// Sanitize recursivo lida com objetos aninhados (ex: { user: { email } }).

const PII_KEYS = new Set([
  "email",
  "phone",
  "telefone",
  "cpf",
  "rg",
  "cv",
  "rawcv",
  "rawcvtext",
  "password",
  "senha",
  "token",
  "secret",
  "apikey",
  "authorization",
  "cookie",
  "linkedinurl",
]);

// Limite duro pra evitar log explodir em payload gigante (CV inteiro como meta).
const MAX_VALUE_LEN = 2000;

function sanitize(value, depth = 0) {
  // Defesa em profundidade: para de descer apos 6 niveis (loop / DoS de log).
  if (depth > 6) return "[...]";
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const k of Object.keys(value)) {
      if (PII_KEYS.has(k.toLowerCase())) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitize(value[k], depth + 1);
      }
    }
    return out;
  }
  if (typeof value === "string" && value.length > MAX_VALUE_LEN) {
    return value.slice(0, MAX_VALUE_LEN) + "...[truncated]";
  }
  return value;
}

function emit(level, route, msg, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    route: route || "?",
    msg: String(msg || ""),
  };
  if (meta && typeof meta === "object") {
    const sanitized = sanitize(meta);
    if (sanitized && typeof sanitized === "object") {
      Object.assign(entry, sanitized);
    }
  }

  let line;
  try {
    line = JSON.stringify(entry);
  } catch {
    // Fallback se houver cycle no meta — emite so o essencial.
    line = JSON.stringify({ ts: entry.ts, level, route: entry.route, msg: entry.msg, _err: "stringify_failed" });
  }

  if (level === "error" || level === "fatal") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }

  // Sentry breadcrumb — opcional, so se @sentry/nextjs ja inicializou.
  // No client, fica em window.Sentry; no server, em globalThis.Sentry.
  try {
    const sentry =
      (typeof globalThis !== "undefined" && globalThis.Sentry) ||
      (typeof window !== "undefined" && window.Sentry) ||
      null;
    if (sentry?.addBreadcrumb) {
      sentry.addBreadcrumb({
        category: entry.route,
        message: entry.msg,
        level: level === "fatal" ? "error" : level,
        data: meta ? sanitize(meta) : undefined,
      });
    }
  } catch {
    // Sentry nao disponivel — silencioso. Logger nao pode falhar a request.
  }
}

export const logger = {
  info: (route, msg, meta) => emit("info", route, msg, meta),
  warn: (route, msg, meta) => emit("warn", route, msg, meta),
  error: (route, msg, meta) => emit("error", route, msg, meta),
  fatal: (route, msg, meta) => emit("fatal", route, msg, meta),
};

// Exposto pra teste — nao consumir em call sites de produto.
export const _internal = { sanitize, PII_KEYS };
