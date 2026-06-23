// Extrai texto de .docx — SO no servidor.
// Aplicado da skill seguranca-careertwin:
//  - magic bytes ZIP (PK\x03\x04) — .docx é um container ZIP.
//  - limite de tamanho (5 MB) checado ANTES de processar.
//  - parse em try/catch; arquivo malformado → throw generico (fail closed).
//  - mammoth roda em memoria, sem temp files no disco.
//
// .doc antigo (binario OLE2, %D0CF) NAO e suportado. Mammoth requer .docx.
// Para .doc antigo precisaria libreoffice/antiword (binarios nativos que nao
// rodam em Vercel serverless). Detectamos e rejeitamos com mensagem amigavel
// pedindo pra exportar como PDF ou converter no Word.

export const MAX_DOCX_BYTES = 5 * 1024 * 1024; // 5 MB
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04"
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]); // .doc antigo

export class DocxError extends Error {
  constructor(msg, status = 400) {
    super(msg);
    this.status = status;
  }
}

function hasMagic(buf, magic) {
  if (!buf || buf.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buf[i] !== magic[i]) return false;
  }
  return true;
}

// True se for .doc antigo (binario OLE2 do Word 97-2003).
export function isLegacyDoc(buf) {
  return hasMagic(buf, OLE_MAGIC);
}

// True se for .docx (ZIP container).
export function isDocx(buf) {
  return hasMagic(buf, ZIP_MAGIC);
}

export async function extractDocxText(buf) {
  if (!Buffer.isBuffer(buf)) throw new DocxError("Arquivo invalido.", 400);
  if (buf.length === 0) throw new DocxError("Arquivo vazio.", 400);
  if (buf.length > MAX_DOCX_BYTES) {
    throw new DocxError("Arquivo grande demais (limite 5 MB).", 413);
  }
  if (isLegacyDoc(buf)) {
    throw new DocxError(
      ".doc antigo (Word 97-2003) nao e suportado. Abra no Word e salve como .docx, ou exporte como PDF.",
      415
    );
  }
  if (!isDocx(buf)) {
    throw new DocxError("Arquivo nao parece um .docx valido.", 400);
  }
  let mammoth;
  try {
    // mammoth e ESM/CJS hibrido — carregamento preguicoso pra nao pesar em
    // rotas que nao usam DOCX.
    mammoth = await import("mammoth");
  } catch (e) {
    console.error("mammoth import falhou:", e?.message);
    throw new DocxError("Parser indisponivel.", 500);
  }
  try {
    const result = await mammoth.extractRawText({ buffer: buf });
    const text = String(result?.value || "").trim();
    if (!text || text.length < 20) {
      throw new DocxError("Nao consegui ler texto do .docx (talvez esteja vazio ou so com imagens).", 422);
    }
    return text;
  } catch (e) {
    if (e instanceof DocxError) throw e;
    console.error("mammoth falhou:", e?.message);
    throw new DocxError("Falha ao processar o .docx.", 400);
  }
}
