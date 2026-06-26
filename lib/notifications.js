// Helpers pra criar notificacoes in-app sem boilerplate em cada call site.
// Cada evento importante (microacao concluida, novo snapshot, status de
// candidatura alterado, digest enviado) chama notify(). Se faltarem campos
// obrigatorios ou der erro de DB, falhamos silencioso (return null) — a acao
// principal NAO pode quebrar por falta de notificacao.

import { prisma } from "@/lib/db";

// Lista canonica dos kinds aceitos. Mantida em sync com enum NotificationKind
// no schema.prisma e migration. Validamos no servidor antes de tocar no DB
// pra falhar cedo (sem stack trace prisma) caso o caller use um kind invalido.
const VALID_KINDS = new Set([
  "GAP_COMPLETED",
  "PLAN_ITEM_COMPLETED",
  "SCORE_UPDATED",
  "DIGEST_SENT",
  "APPLICATION_STATUS",
  "WELCOME",
  "DAILY_BRIEFING",
  "ACHIEVEMENT_UNLOCKED",
]);

// Tetos defensivos pra evitar payload abusivo (cv injetado em titulo etc).
// title/body sao renderizados textualmente — nao ha HTML/markdown — mas
// manter tamanho razoavel evita degradar UI do drawer e custo de armazenamento.
const MAX_TITLE = 200;
const MAX_BODY = 2000;
const MAX_LINK = 500;

function clamp(value, max) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export async function notify({ userId, kind, title, body, link, meta }) {
  if (!userId || typeof userId !== "string") return null;
  if (!kind || !VALID_KINDS.has(kind)) return null;
  const safeTitle = clamp(title, MAX_TITLE);
  if (!safeTitle) return null;

  try {
    return await prisma.notification.create({
      data: {
        userId,
        kind,
        title: safeTitle,
        body: clamp(body, MAX_BODY),
        link: clamp(link, MAX_LINK),
        meta: meta && typeof meta === "object" ? meta : null,
      },
    });
  } catch (e) {
    // Falha silenciosa: nao queremos derrubar fluxo de gap/analyze/status
    // se o INSERT de notificacao falhar (DB lento, schema desatualizado etc).
    console.error("notify falhou:", e?.message);
    return null;
  }
}

// Templates: factories que devolvem o payload pronto para notify(). Mantem
// strings centralizadas (i18n futuro), garante que kind e link batem com o
// evento, e evita typo espalhado pelos call sites.
export const NotificationTemplates = {
  gapCompleted: ({ habilidade, pts, gapId }) => ({
    kind: "GAP_COMPLETED",
    title: `Microação concluída: ${habilidade}`,
    body: `+${pts || 4} pontos no teu score`,
    link: "/dashboard",
    meta: { gapId, pts: pts ?? null },
  }),
  scoreUpdated: ({ overall, delta }) => ({
    kind: "SCORE_UPDATED",
    title: `Novo diagnóstico salvo — score ${overall}`,
    body:
      typeof delta === "number" && delta !== 0
        ? `Variação de ${delta > 0 ? "+" : ""}${delta} desde o último`
        : "",
    link: "/dashboard",
    meta: { overall, delta: delta ?? null },
  }),
  digestSent: ({ vagasCount }) => ({
    kind: "DIGEST_SENT",
    title: `${vagasCount} vagas novas pra você`,
    body: "Enviamos por email também. Confere o radar.",
    link: "/oportunidades",
    meta: { vagasCount },
  }),
  applicationStatus: ({ titulo, empresa, fromStatus, toStatus }) => ({
    kind: "APPLICATION_STATUS",
    title: `${titulo}${empresa ? ` (${empresa})` : ""}`,
    body: `Atualizada: ${fromStatus} → ${toStatus}`,
    link: "/candidaturas",
    meta: { titulo, empresa, fromStatus, toStatus },
  }),
  welcome: () => ({
    kind: "WELCOME",
    title: "Bem-vindo ao CareerTwin AI",
    body: "Cola seu currículo e diz o cargo-alvo pra começar.",
    link: "/dashboard",
  }),
  // dailyBriefing: cron diario gera briefing personalizado (subject + summary
  // curto vindo do LLM). Body e clampado em MAX_BODY (2000) pelo notify();
  // passamos um slice de ate ~200 chars pra preview no drawer.
  dailyBriefing: ({ subject, summary }) => ({
    kind: "DAILY_BRIEFING",
    title: subject,
    body: summary,
    link: "/dashboard",
  }),
  // achievementUnlocked: gerada apos grantAchievement bem-sucedido. icon (emoji)
  // entra no titulo pra render compacto no drawer. meta carrega kind + points
  // pra UI poder disparar toast/confetti quando ve kind=ACHIEVEMENT_UNLOCKED.
  achievementUnlocked: ({ title, desc, icon, kind, points }) => ({
    kind: "ACHIEVEMENT_UNLOCKED",
    title: `${icon} ${title}`,
    body: desc,
    link: "/conta",
    meta: { achievementKind: kind || null, points: points ?? null, icon: icon || null },
  }),
};
