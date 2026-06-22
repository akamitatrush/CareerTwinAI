import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractPdfText, MAX_PDF_BYTES, PdfError } from "@/lib/pdf";
import { extractDocxText, isDocx, isLegacyDoc, MAX_DOCX_BYTES, DocxError } from "@/lib/docx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upload de CV em PDF ou DOCX. Exige sessao (vai persistir no Profile do dono).
// Defesas (skill seguranca-careertwin):
//  - auth() na rota (escopa por dono).
//  - limite de tamanho ANTES de bufferizar (Content-Length curto-circuita).
//  - magic bytes (%PDF- ou PK\x03\x04) detectam tipo real — Content-Type/nome
//    de arquivo NAO sao confiaveis.
//  - .doc antigo (OLE2 binario) e detectado e rejeitado com mensagem amigavel
//    (precisaria libreoffice/antiword — nao roda em Vercel serverless).
//  - extracao em lib/{pdf,docx}.js, processamento em memoria.
//  - nome de arquivo do cliente NAO usado em path.
//  - registra DataSource CV_PDF|CV_DOCX + Consent com payloadHash (sha256 do
//    TEXTO, nao do binario — politica de minimizacao).
const MAX_BYTES = Math.max(MAX_PDF_BYTES, MAX_DOCX_BYTES); // 5 MB pra ambos

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
  if (lenHeader && lenHeader > MAX_BYTES) {
    return NextResponse.json(
      { error: "Arquivo grande demais. O limite é de 5 MB.", code: "FILE_TOO_LARGE" },
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
      { error: "Selecione um arquivo PDF ou DOCX antes de enviar.", code: "FILE_MISSING" },
      { status: 400 }
    );
  }
  // Limite tambem pelo size do File (defesa em camada).
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Arquivo grande demais. O limite é de 5 MB.", code: "FILE_TOO_LARGE" },
      { status: 413 }
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Dispatch por magic bytes — Content-Type e nome de arquivo do cliente nao
  // sao confiaveis. Detectamos o tipo REAL dos primeiros bytes.
  const isPdf = buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
  const isLegacy = isLegacyDoc(buf);
  const docxDetected = isDocx(buf);

  if (isLegacy) {
    return NextResponse.json(
      {
        error: ".doc antigo (Word 97-2003) não é suportado. Abra no Word e salve como .docx, ou exporte como PDF.",
        code: "DOC_LEGACY_UNSUPPORTED",
      },
      { status: 415 }
    );
  }

  let text;
  let kind; // ConsentSource value
  let labelType;

  if (isPdf) {
    kind = "CV_PDF";
    labelType = "PDF";
    try {
      text = await extractPdfText(buf);
    } catch (e) {
      if (e instanceof PdfError) {
        const code =
          e.status === 413
            ? "FILE_TOO_LARGE"
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
  } else if (docxDetected) {
    kind = "CV_DOCX";
    labelType = "DOCX";
    try {
      text = await extractDocxText(buf);
    } catch (e) {
      if (e instanceof DocxError) {
        const code =
          e.status === 413
            ? "FILE_TOO_LARGE"
            : e.status === 415
              ? "DOC_LEGACY_UNSUPPORTED"
              : e.status === 422
                ? "DOCX_NO_TEXT"
                : e.status === 500
                  ? "DOCX_PARSER_UNAVAILABLE"
                  : "DOCX_INVALID";
        return NextResponse.json({ error: e.message, code }, { status: e.status });
      }
      console.error("upload: docx falhou", e?.message);
      return NextResponse.json(
        { error: "Não consegui processar este DOCX. Tente outro arquivo.", code: "DOCX_INVALID" },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json(
      {
        error: "Formato não reconhecido. Envie PDF ou DOCX (Word 2007+).",
        code: "FILE_FORMAT_UNSUPPORTED",
      },
      { status: 415 }
    );
  }

  // Salva no Profile do dono (sobrescreve, nao acumula).
  const payloadHash = createHash("sha256").update(text).digest("hex");
  const label = `CV em ${labelType} (${(file.size / 1024).toFixed(1)} KB)`;
  try {
    await prisma.$transaction([
      prisma.profile.upsert({
        where: { userId },
        create: { userId, rawCv: text },
        update: { rawCv: text },
      }),
      prisma.dataSource.create({
        data: { userId, kind, label, sizeBytes: file.size },
      }),
      prisma.consent.create({
        data: { userId, source: kind, payloadHash },
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
  return NextResponse.json({ ok: true, text, length: text.length, format: labelType });
}
