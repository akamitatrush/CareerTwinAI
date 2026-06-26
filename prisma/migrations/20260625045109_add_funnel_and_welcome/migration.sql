-- DropIndex
DROP INDEX "KnowledgeChunk_embedding_idx";

-- AlterTable
ALTER TABLE "BillingEvent" ALTER COLUMN "payload" DROP NOT NULL;

-- AlterTable
ALTER TABLE "KnowledgeChunk" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "welcomeEmailSentAt" TIMESTAMP(3);
