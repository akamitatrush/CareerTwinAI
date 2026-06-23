// PATCH /api/me/preferences — atualiza preferencias de notificacao do user.
// Hoje: digestEnabled (toggle que liga/desliga digest semanal + daily briefing).
//
// Seguranca:
//  - auth() obrigatorio. userId vem SEMPRE da sessao, nunca do body (anti-IDOR).
//  - Body Zod .strict() — rejeita campos extras (anti mass-assignment).
//  - Atualiza com where: { id: session.user.id } — escopo de dono na query.
//  - Audit PROFILE_UPDATED com chave alterada (meta: { digestEnabled: true/false }).
//  - Erro generico ao cliente; detalhe so no log do servidor.

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// .strict() rejeita campos extras. Cada campo opcional — caller pode atualizar
// 1 ou mais ao mesmo tempo. Nenhum campo expoe userId/email/etc (mass-assignment).
const PreferencesBody = z
  .object({
    digestEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((d) => Object.keys(d).length > 0, {
    message: "ao menos um campo precisa ser enviado",
  });

export async function PATCH(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: "Voce precisa estar logado para atualizar preferencias.",
        code: "UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "Nao consegui entender o que foi enviado. Tente de novo.",
        code: "BAD_JSON",
      },
      { status: 400 }
    );
  }

  const parsed = PreferencesBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Preferencias invalidas — envie um booleano em digestEnabled.",
        code: "INVALID_INPUT",
      },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: { digestEnabled: true },
    });

    // Audit: chave alterada (boolean novo). Nao logamos PII — so o flag.
    await audit({
      userId: session.user.id,
      action: "PROFILE_UPDATED",
      target: `User:${session.user.id}`,
      req,
      meta: { digestEnabled: updated.digestEnabled },
    });

    return NextResponse.json({ ok: true, preferences: updated });
  } catch (e) {
    console.error("preferences PATCH falhou:", e?.message);
    return NextResponse.json(
      {
        error: "Nao consegui salvar agora. Tente novamente em instantes.",
        code: "PERSIST_FAILED",
      },
      { status: 500 }
    );
  }
}
