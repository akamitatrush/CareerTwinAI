// Extrai texto de PDF — SO no servidor (nao expor pdf-parse ao cliente).
// Aplicado da skill seguranca-careertwin:
//  - magic bytes %PDF- antes de tudo (nao confiar em Content-Type/nome de arquivo).
//  - limite de tamanho (5 MB) checado ANTES de ler tudo na memoria.
//  - parse em try/catch; PDF malformado → throw generico (fail closed).
//  - nunca usar nome de arquivo do cliente para path em disco (processa em memoria).

export const MAX_PDF_BYTES = 5 * 1024 * 1024; // 5 MB
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"

export class PdfError extends Error {
  constructor(msg, status = 400) {
    super(msg);
    this.status = status;
  }
}

function hasMagic(buf) {
  if (!buf || buf.length < PDF_MAGIC.length) return false;
  for (let i = 0; i < PDF_MAGIC.length; i++) {
    if (buf[i] !== PDF_MAGIC[i]) return false;
  }
  return true;
}

export async function extractPdfText(buf) {
  if (!Buffer.isBuffer(buf)) throw new PdfError("Arquivo invalido.", 400);
  if (buf.length === 0) throw new PdfError("Arquivo vazio.", 400);
  if (buf.length > MAX_PDF_BYTES) {
    throw new PdfError("Arquivo grande demais (limite 5 MB).", 413);
  }
  if (!hasMagic(buf)) {
    throw new PdfError("Arquivo nao parece um PDF valido.", 400);
  }
  let pdfParse;
  try {
    // pdf-parse e CJS; carregamento preguicoso para nao pesar em rotas que nao usam PDF.
    pdfParse = (await import("pdf-parse")).default;
  } catch (e) {
    console.error("pdf-parse import falhou:", e?.message);
    throw new PdfError("Parser indisponivel.", 500);
  }
  try {
    const out = await pdfParse(buf);
    const text = String(out?.text || "").trim();
    if (!text || text.length < 20) {
      // PDFs so de imagem (scan) caem aqui — OCR ficou fora do escopo desta fase.
      throw new PdfError("Nao consegui ler texto do PDF (talvez seja um scan).", 422);
    }
    return text;
  } catch (e) {
    if (e instanceof PdfError) throw e;
    console.error("pdf-parse falhou:", e?.message);
    throw new PdfError("Falha ao processar o PDF.", 400);
  }
}
