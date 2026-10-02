-- AlterTable
ALTER TABLE "cities" ADD COLUMN     "regionId" TEXT;

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regions_countryId_idx" ON "regions"("countryId");

-- CreateIndex
CREATE UNIQUE INDEX "regions_countryId_code_key" ON "regions"("countryId", "code");

-- CreateIndex
CREATE INDEX "cities_regionId_idx" ON "cities"("regionId");

-- AddForeignKey
ALTER TABLE "regions" ADD CONSTRAINT "regions_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
