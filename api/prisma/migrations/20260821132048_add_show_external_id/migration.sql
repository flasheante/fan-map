-- AlterTable
ALTER TABLE "shows" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "shows_externalId_key" ON "shows"("externalId");

