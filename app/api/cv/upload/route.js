import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractPdfText, MAX_PDF_BYTES, PdfError } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upload de CV em PDF. Exige sessao (vai persistir no Profile do dono).
// Defesas (skill seguranca-careertwin):
//  - auth() na rota (escopa por dono).
//  - limite de tamanho ANTES de bufferizar (Content-Length curto-circuita).
//  - magic bytes + extracao em lib/pdf.js.
//  - nome de arquivo do cliente NAO usado em path (processamento em memoria).
//  - registra DataSource CV_PDF + Consent com payloadHash (sha256 do TEXTO,
//    nao do binario — alinha com a politica de minimizacao: nao guardamos o PDF).
export async function POST(req) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Você precisa estar logado para enviar seu currículo. Acesse /entrar.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
  const userId = session.user.id;

  // Limite por header (curto-circuita antes de ler bytes).
  const lenHeader = Number(req.headers.get("content-length") || "0");
  if (lenHeader && lenHeader > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "Arquivo grande demais. O limite é de 5 MB.", code: "PDF_TOO_LARGE" },
      { status: 413 }
    );
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Não consegui ler o arquivo enviado. Tente de novo.", code: "BAD_FORM" },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Selecione um arquivo PDF antes de enviar.", code: "FILE_MISSING" },
      { status: 400 }
    );
  }
  // Limite tambem pelo size do File (defesa em camada com o header).
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: "Arquivo grande demais. O limite é de 5 MB.", code: "PDF_TOO_LARGE" },
      { status: 413 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  let text;
  try {
    text = await extractPdfText(buf);
  } catch (e) {
    if (e instanceof PdfError) {
      // Mensagens do PdfError já são pt-BR; adicionamos um code amigável.
      const code =
        e.status === 413
          ? "PDF_TOO_LARGE"
          : e.status === 422
            ? "PDF_NO_TEXT"
            : e.status === 500
              ? "PDF_PARSER_UNAVAILABLE"
              : "PDF_INVALID";
      return NextResponse.json({ error: e.message, code }, { status: e.status });
    }
    console.error("upload: pdf falhou", e?.message);
    return NextResponse.json(
      { error: "Não consegui processar este PDF. Tente outro arquivo.", code: "PDF_INVALID" },
      { status: 400 }
    );
  }

  // Salva no Profile do dono (sobrescreve, nao acumula).
  const payloadHash = createHash("sha256").update(text).digest("hex");
  const label = `CV em PDF (${(file.size / 1024).toFixed(1)} KB)`;
  try {
    await prisma.$transaction([
      prisma.profile.upsert({
        where: { userId },
        create: { userId, rawCv: text },
        update: { rawCv: text },
      }),
      prisma.dataSource.create({
        data: { userId, kind: "CV_PDF", label, sizeBytes: file.size },
      }),
      prisma.consent.create({
        data: { userId, source: "CV_PDF", payloadHash },
      }),
    ]);
  } catch (e) {
    console.error("upload: persistencia falhou", e?.message);
    return NextResponse.json(
      {
        error: "Li seu currículo, mas não consegui salvar agora. Atualize a página e tente de novo.",
        code: "PERSIST_FAILED",
      },
      { status: 500 }
    );
  }

  // Devolve o TEXTO (nao o binario) — o front segue para o fluxo de analyze.
  return NextResponse.json({ ok: true, text, length: text.length });
}
