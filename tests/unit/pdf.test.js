import { describe, it, expect } from "vitest";
import { extractPdfText, MAX_PDF_BYTES, PdfError } from "@/lib/pdf";

describe("lib/pdf — defesas antes do parse", () => {
  it("rejeita arquivo vazio", async () => {
    await expect(extractPdfText(Buffer.alloc(0))).rejects.toThrow(/vazio/);
  });

  it("rejeita arquivo grande demais (limite 5 MB)", async () => {
    const big = Buffer.alloc(MAX_PDF_BYTES + 1);
    // Mesmo com magic bytes corretos, deve barrar pelo tamanho.
    big.write("%PDF-", 0);
    await expect(extractPdfText(big)).rejects.toMatchObject({ status: 413 });
  });

  it("rejeita arquivo sem magic bytes (ataque de Content-Type)", async () => {
    const fake = Buffer.from("Nao sou um PDF, mesmo que voce me chame assim.");
    await expect(extractPdfText(fake)).rejects.toMatchObject({ status: 400 });
  });

  it("rejeita Buffer invalido (string ou null)", async () => {
    await expect(extractPdfText(null)).rejects.toThrow();
    await expect(extractPdfText("nao buffer")).rejects.toThrow();
  });

  it("PdfError carrega status HTTP", () => {
    const e = new PdfError("x", 422);
    expect(e.status).toBe(422);
    expect(e.message).toBe("x");
  });
});
