"use server";

// Server actions de /conta — extraidos pra permitir invocacao direta de client
// components (TargetRoleForm) e poder RETORNAR estado (em vez de so redirect).
//
// Decisao de design (P0.3 do po-oportunidades-auditoria 2026-06-30):
//  - updateTargetRole agora retorna `{ ok, roleChanged, oldRole, newRole, code? }`
//    em vez de so redirecionar. Cliente decide o que fazer depois (disparar
//    /api/profile/refresh sincrono pra resincronizar ScoreSnapshot.role).
//  - Sem `redirect("/conta?erro=1")` — cliente apresenta o erro inline.
//  - LGPD: audit log identico, sem revelar o cargo no meta.
//
// Defesas mantidas (skill seguranca-careertwin):
//  - auth() obrigatoria; userId vem SEMPRE da sessao (anti IDOR)
//  - Zod strict (rejeita campos extras — anti mass-assignment)
//  - Audit log PROFILE_UPDATED (meta sem valor sensivel)

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const TargetRoleSchema = z
  .object({ targetRole: z.string().trim().max(80) })
  .strict();

function getActorIpFromHeaders(h) {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}

function normalizeRole(s) {
  // Compara roles ignorando whitespace de borda + caixa.
  // "Product Manager" === "  product manager  ".
  return String(s || "").trim().toLowerCase();
}

/**
 * Salva targetRole no Profile. Retorna estado pra cliente decidir proximo passo.
 *
 * @param {{targetRole: string}} input
 * @returns {Promise<{
 *   ok: boolean,
 *   roleChanged: boolean,
 *   oldRole: string|null,
 *   newRole: string|null,
 *   code?: "UNAUTHORIZED"|"INVALID_INPUT"|"PERSIST_FAILED",
 *   message?: string,
 * }>}
 */
export async function updateTargetRole(input) {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      roleChanged: false,
      oldRole: null,
      newRole: null,
      code: "UNAUTHORIZED",
      message: "Sessao expirada. Faca login de novo.",
    };
  }
  const userId = session.user.id;

  const parsed = TargetRoleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      roleChanged: false,
      oldRole: null,
      newRole: null,
      code: "INVALID_INPUT",
      message: "Cargo-alvo invalido (max 80 caracteres).",
    };
  }
  const newRole = parsed.data.targetRole || "";

  // Le valor anterior pra detectar mudanca real (evita refresh desnecessario
  // quando user clicou Salvar sem trocar nada).
  let oldRole = null;
  try {
    const existing = await prisma.profile.findUnique({
      where: { userId },
      select: { targetRole: true },
    });
    oldRole = existing?.targetRole ?? null;
  } catch {
    // Nao bloqueia o save por isso — pior caso: roleChanged=true falso positivo
    // (cliente dispara refresh redundante; nao quebra nada).
    oldRole = null;
  }

  try {
    await prisma.profile.upsert({
      where: { userId },
      update: { targetRole: newRole || null },
      create: { userId, targetRole: newRole || null },
    });
    const h = headers();
    await audit({
      userId,
      action: "PROFILE_UPDATED",
      actorIp: getActorIpFromHeaders(h),
      target: `Profile:${userId}`,
      meta: { field: "targetRole", cleared: !newRole },
    });
  } catch {
    return {
      ok: false,
      roleChanged: false,
      oldRole,
      newRole,
      code: "PERSIST_FAILED",
      message: "Nao foi possivel salvar agora. Tente de novo.",
    };
  }

  // Mudou se valor normalizado difere. "Edge case: oldRole=null -> newRole="X"
  // = roleChanged true (primeira vez setando)". Tambem cobre limpar (X -> "").
  const roleChanged = normalizeRole(oldRole) !== normalizeRole(newRole);

  // Cargo-alvo afeta varias paginas (header pill, /oportunidades, /gaps).
  // revalidatePath pra refletir imediato apos retorno.
  revalidatePath("/conta");

  return {
    ok: true,
    roleChanged,
    oldRole: oldRole || null,
    newRole: newRole || null,
  };
}
