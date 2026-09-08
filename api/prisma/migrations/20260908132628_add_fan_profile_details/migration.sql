-- AlterTable
ALTER TABLE "fan_profiles" ADD COLUMN     "facebookIsPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "instagramIsPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "tiktokIsPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tiktokUrl" TEXT,
ADD COLUMN     "xIsPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "xUrl" TEXT,
ADD COLUMN     "youtubeIsPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "youtubeUrl" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googlePhotoUrl" TEXT;

-- CreateTable
CREATE TABLE "fan_profile_songs" (
    "fanProfileId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "topPosition" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fan_profile_songs_pkey" PRIMARY KEY ("fanProfileId","songId"),
    -- Rango fijo (1-10), independiente de la lógica de negocio: el máximo
    -- de 15 favoritas y de 10 posiciones en sí se valida en la aplicación
    -- (ver FanProfilesService), no acá — un CHECK no puede contar filas de
    -- otras filas, solo esta columna de esta fila.
    CONSTRAINT "fan_profile_songs_topPosition_check" CHECK ("topPosition" IS NULL OR ("topPosition" >= 1 AND "topPosition" <= 10))
);

-- CreateIndex
CREATE INDEX "fan_profile_songs_songId_idx" ON "fan_profile_songs"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "fan_profile_songs_fanProfileId_topPosition_key" ON "fan_profile_songs"("fanProfileId", "topPosition");

-- AddForeignKey
ALTER TABLE "fan_profile_songs" ADD CONSTRAINT "fan_profile_songs_fanProfileId_fkey" FOREIGN KEY ("fanProfileId") REFERENCES "fan_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fan_profile_songs" ADD CONSTRAINT "fan_profile_songs_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
