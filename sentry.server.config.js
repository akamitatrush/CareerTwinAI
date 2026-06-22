import * as Sentry from "@sentry/nextjs";

const DSN = process.env.SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.05,
    environment: process.env.NODE_ENV || "production",

    beforeSend(event, hint) {
      const url = event.request?.url || "";
      const sensitiveRoutes = [
        "/api/analyze",
        "/api/chat",
        "/api/cv/upload",
        "/api/interview",
        "/api/tailor",
        "/api/me/export",
        "/api/linkedin/parse",
      ];
      if (sensitiveRoutes.some((r) => url.includes(r))) {
        if (event.request) {
          delete event.request.data;
        }
      }
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });
}
