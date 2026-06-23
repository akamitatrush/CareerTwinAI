-- Adiciona modelo TailoredCv pra historico de CVs adaptados pra vagas.
-- userId em CASCADE: apagar conta apaga historico. applicationId em SET NULL:
-- apagar uma Application do funil preserva o CV adaptado (so desvincula).
CREATE TABLE "TailoredCv" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "applicationId" TEXT,
  "vagaTitulo" TEXT NOT NULL,
  "vagaEmpresa" TEXT,
  "beforeText" TEXT NOT NULL,
  "afterText" TEXT NOT NULL,
  "bullets" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TailoredCv_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TailoredCv_userId_createdAt_idx" ON "TailoredCv"("userId", "createdAt");

ALTER TABLE "TailoredCv" ADD CONSTRAINT "TailoredCv_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TailoredCv" ADD CONSTRAINT "TailoredCv_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
