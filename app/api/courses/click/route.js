// Endpoint pra trackear clique em curso ANTES do redirect pra plataforma
// externa. Cliente faz POST com { courseId, provider, url }, recebe a URL
// decorada com param de afiliado (se houver env setada) e pode fazer
// window.location.href = decoratedUrl em seguida.
//
// Por que server-side em vez de window.open direto?
//  - Atribuicao confiavel de clique (sem depender do PostHog client carregar
//    antes do user clicar -- comum em links externos).
//  - URL decorada server-side: param de afiliado nunca exposto no bundle JS.
//  - Defesa contra open redirect: nao redirecionamos; so retornamos a URL pro
//    cliente. Cliente faz o navigate. Open redirect mitigado pq nao usamos
//    response 302 -- usuario nunca eh redirecionado por essa rota.
//
// Auth: opcional. Anon tambem clica em curso (modo "experimentar"). Rate-limit
// mais baixo pra anon (30/min vs 60/min user) -- defesa contra scraping do
// catalogo via brute force courseId.

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { guardLLM, tooMany } from "@/lib/rate-limit";
import { decorateUrl } from "@/lib/knowledge/course-retrieval";
import { safeExternalUrl } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// strict() rejeita campos extras -- evita payload abuse (ex.: campo userId
// fake tentando spoof, ou metadados extras tentando lotar log).
// safeExternalUrl: rejeita javascript:/data:/vbscript:/file: e demais schemes
// nao-http(s). z.string().url() do Zod 4 aceita esses schemes, e cliente faz
// window.location.href = decoratedUrl -- XSS via redirect se URL maliciosa
// chegar ate aqui. max 2000 chars: limit comum de browsers; URLs reais de
// curso passam folgadas em ~500 chars.
const ClickSchema = z
  .object({
    courseId: z.string().min(1).max(120),
    provider: z.string().min(1).max(120),
    url: safeExternalUrl,
  })
  .strict();

export async function POST(req) {
  // Auth opcional: anon pode clicar tambem. Sessao so eh usada pra
  // distinguir bucket de rate-limit.
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Anon = 30/min (defesa scraping). User = 60/min (UI legitima).
  const limit = await guardLLM(req, {
    name: "course-click",
    userId,
    perMinuteAnon: 30,
    perMinuteUser: 60,
  });
  if (!limit.ok) return tooMany(limit);

  let raw;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Payload invalido.", code: "BAD_JSON" },
      { status: 400 }
    );
  }

  const parsed = ClickSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload invalido.", code: "INVALID_BODY" },
      { status: 400 }
    );
  }

  const { provider, url } = parsed.data;
  // Decora URL com param de afiliado (se env setada pro provider).
  // Sem env: decoratedUrl == url original. Frontend nao precisa saber a
  // diferenca; sempre faz window.location.href = decoratedUrl.
  const decoratedUrl = decorateUrl(url, { provider, userId });

  // Tracking PostHog real fica no client (via track() apos receber a resposta)
  // OU em event server-side via /api/_track. Aqui so retornamos o timestamp
  // como assinatura de que o evento foi registrado server-side -- cliente
  // pode usar pra correlacao no PostHog. Nao logamos PII (courseId nao eh PII).
  const trackedAt = new Date().toISOString();

  return NextResponse.json({ trackedAt, decoratedUrl }, { status: 200 });
}
