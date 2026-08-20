-- CreateTable
CREATE TABLE "fan_artists" (
    "fanProfileId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fan_artists_pkey" PRIMARY KEY ("fanProfileId","artistId")
);

-- CreateIndex
CREATE INDEX "fan_artists_artistId_idx" ON "fan_artists"("artistId");

-- AddForeignKey
ALTER TABLE "fan_artists" ADD CONSTRAINT "fan_artists_fanProfileId_fkey" FOREIGN KEY ("fanProfileId") REFERENCES "fan_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fan_artists" ADD CONSTRAINT "fan_artists_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
