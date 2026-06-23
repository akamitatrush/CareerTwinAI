import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN;

// Whitelist de rotas onde o BODY contem PII e nao deve ser enviado pro Sentry SaaS.
// Inclui todas as rotas que recebem texto de CV/perfil/portfolio/chat livre.
// Auditoria 05-ai-llm-security.md (LLM02): faltavam `/api/portfolio/import` e
// `/api/opportunities` — vazavam perfil + lacunas inteiras quando dispara erro.
const PII_SENSITIVE_ROUTES = [
  "/api/analyze",
  "/api/chat",
  "/api/cv/upload",
  "/api/interview",
  "/api/tailor",
  "/api/me/export",
  "/api/linkedin/parse",
  "/api/portfolio/import",
  "/api/opportunities",
];

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.05,
    environment: process.env.NODE_ENV || "production",

    beforeSend(event, _hint) {
      const url = event.request?.url || "";
      if (PII_SENSITIVE_ROUTES.some((r) => url.includes(r))) {
        if (event.request) {
          delete event.request.data;
        }
      }
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        // x-cron-secret tambem nao deve viajar pro Sentry
        delete event.request.headers["x-cron-secret"];
      }
      return event;
    },
  });
}
