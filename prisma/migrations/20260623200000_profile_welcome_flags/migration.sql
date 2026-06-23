-- Welcome flow flags no Profile.
-- firstDiagnosisAt: setado uma unica vez no primeiro ScoreSnapshot persistido
-- do usuario, marca quando o gemeo "nasceu" pra UX (e baseline temporal).
-- welcomedAt: setado quando o usuario dismissa o banner welcome no /dashboard.
-- Ambos nullable: NULL = ainda nao aconteceu. Sem backfill — users antigos
-- ficam com NULL e o banner segue a logica do server component.

ALTER TABLE "Profile" ADD COLUMN "firstDiagnosisAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "welcomedAt" TIMESTAMP(3);
