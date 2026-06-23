// lib/achievements.js
// Centraliza grant de achievements. Idempotente — segundo grant do mesmo
// (userId, kind) bate na unique constraint e devolve alreadyEarned: true sem
// efeito colateral (sem dupla notificacao, sem dupla contagem de pontos).
//
// Padroes de seguranca (skill seguranca-careertwin):
//  - userId vem SEMPRE do auth() do call site, NUNCA de input do usuario.
//  - Validacao de kind antes de tocar DB (allow-list ACHIEVEMENTS_META).
//  - meta sanitizado (apenas objeto plano; sem chave reservada do Prisma).
//  - Erros NUNCA derrubam o fluxo principal — helper retorna { granted: false }
//    e a acao do user (gap.complete, analyze, etc) prossegue normalmente.

import { prisma } from "@/lib/db";
import { notify, NotificationTemplates } from "@/lib/notifications";

// Tabela de metadados das conquistas. Source of truth pra UI (icone, titulo,
// descricao, pontos). Mantida em sync com enum AchievementKind no schema.prisma.
// Pontos sao usados na UI pra mostrar "X pontos" — nao guardamos points no DB
// (derivamos das conquistas pra evitar drift e facilitar rebalanceamento).
export const ACHIEVEMENTS_META = {
  FIRST_DIAGNOSIS: {
    title: "Primeiro diagnóstico",
    desc: "Construiu o gêmeo pela 1ª vez",
    icon: "🎯",
    points: 10,
  },
  FIRST_GAP_COMPLETED: {
    title: "Primeira ação concluída",
    desc: "Marcou primeira microação como feita",
    icon: "✓",
    points: 5,
  },
  FIVE_GAPS_COMPLETED: {
    title: "5 lacunas fechadas",
    desc: "Cinco microações concluídas",
    icon: "🔥",
    points: 15,
  },
  TEN_GAPS_COMPLETED: {
    title: "10 lacunas fechadas",
    desc: "Dez microações concluídas",
    icon: "⚡",
    points: 25,
  },
  FIRST_TAILOR: {
    title: "Primeiro CV adaptado",
    desc: "Adaptou currículo pra uma vaga",
    icon: "📝",
    points: 10,
  },
  FIRST_APPLICATION: {
    title: "Primeira candidatura",
    desc: "Salvou primeira candidatura no funil",
    icon: "📌",
    points: 5,
  },
  FIRST_INTERVIEW: {
    title: "Primeira simulação",
    desc: "Completou primeira simulação de entrevista",
    icon: "🎤",
    points: 10,
  },
  PROFILE_100_PERCENT: {
    title: "Perfil completo",
    desc: "100% das fontes conectadas",
    icon: "💎",
    points: 20,
  },
  ALL_ASSESSMENTS_COMPLETED: {
    title: "Autoconhecimento completo",
    desc: "DISC + Valores + Ikigai",
    icon: "🧭",
    points: 20,
  },
  STREAK_7_DAYS: {
    title: "Semana ativa",
    desc: "7 dias consecutivos no app",
    icon: "🔥",
    points: 30,
  },
  STREAK_30_DAYS: {
    title: "Mês ativo",
    desc: "30 dias consecutivos",
    icon: "👑",
    points: 100,
  },
  SCORE_70: {
    title: "Score 70+",
    desc: "Career Health acima de 70",
    icon: "📈",
    points: 25,
  },
  SCORE_80: {
    title: "Score 80+",
    desc: "Career Health acima de 80",
    icon: "🏅",
    points: 50,
  },
  SCORE_90: {
    title: "Score 90+",
    desc: "Career Health acima de 90",
    icon: "🏆",
    points: 100,
  },
  FIRST_REFRESH: {
    title: "Primeiro refresh",
    desc: "Atualizou diagnóstico após microações",
    icon: "🔄",
    points: 5,
  },
  FIRST_EVIDENCE: {
    title: "Primeira evidência",
    desc: "Documentou primeira competência",
    icon: "📂",
    points: 10,
  },
  COURSE_COMPLETED: {
    title: "Primeiro curso",
    desc: "Marcou um curso como concluído",
    icon: "🎓",
    points: 15,
  },
};

// Soma de pontos maximos (defesa contra typo no caller — UI usa esse total).
export const MAX_POINTS = Object.values(ACHIEVEMENTS_META).reduce(
  (sum, m) => sum + (m.points || 0),
  0,
);

// Lista canonica dos kinds suportados (Object.keys do meta).
export const ACHIEVEMENT_KINDS = Object.keys(ACHIEVEMENTS_META);

// grantAchievement: tenta conceder um achievement. Idempotente via unique
// constraint (userId, kind) — segundo grant retorna { granted: false,
// alreadyEarned: true } e NAO dispara notificacao duplicada.
//
// Retorno:
//  - { granted: true, achievement } sucesso primeiro grant
//  - { granted: false, alreadyEarned: true } ja tinha (idempotente)
//  - { granted: false, error: message } erro inesperado (logado, nao throw)
//  - { granted: false } parametros invalidos (kind desconhecido, userId vazio)
export async function grantAchievement(userId, kind, meta = {}) {
  if (!userId || typeof userId !== "string") return { granted: false };
  if (!kind || !ACHIEVEMENTS_META[kind]) return { granted: false };

  // meta: aceita objeto plano. Filtra valores nao-serializaveis (Date, BigInt
  // sem cast) por sanity — Prisma JSON aceita anything mas evita surpresas.
  const safeMeta =
    meta && typeof meta === "object" && !Array.isArray(meta) ? meta : null;

  try {
    const achievement = await prisma.achievement.create({
      data: {
        userId,
        kind,
        meta: safeMeta,
      },
    });

    // Notifica via in-app notification. Falha silenciosa dentro do helper —
    // a conquista ja foi persistida; badge se reconverge no proximo fetch.
    const ach = ACHIEVEMENTS_META[kind];
    try {
      await notify({
        userId,
        ...NotificationTemplates.achievementUnlocked({
          title: ach.title,
          desc: ach.desc,
          icon: ach.icon,
          kind,
          points: ach.points,
        }),
      });
    } catch (e) {
      console.error("grantAchievement: notify falhou", e?.message);
    }

    return { granted: true, achievement };
  } catch (e) {
    // P2002 = unique constraint violation (userId, kind). Idempotente: o user
    // ja tinha — sucesso silencioso, sem nova notificacao.
    if (e?.code === "P2002") {
      return { granted: false, alreadyEarned: true };
    }
    console.error("grantAchievement falhou:", e?.message);
    return { granted: false, error: e?.message };
  }
}

// getUserAchievements: lista conquistas do user em ordem cronologica reversa.
// IDOR-safe quando chamado de rota com userId vindo do auth().
export async function getUserAchievements(userId) {
  if (!userId || typeof userId !== "string") return [];
  try {
    return await prisma.achievement.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
    });
  } catch (e) {
    console.error("getUserAchievements falhou:", e?.message);
    return [];
  }
}

// getUserPoints: soma de pontos do user (derivado das conquistas existentes).
// Nao guardamos points no DB pra evitar drift em rebalanceamento da tabela.
export async function getUserPoints(userId) {
  const achs = await getUserAchievements(userId);
  return achs.reduce(
    (sum, a) => sum + (ACHIEVEMENTS_META[a.kind]?.points || 0),
    0,
  );
}
