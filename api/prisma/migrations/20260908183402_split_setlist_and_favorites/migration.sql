/*
  Warnings:

  - You are about to drop the `fan_profile_songs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "fan_profile_songs" DROP CONSTRAINT "fan_profile_songs_fanProfileId_fkey";

-- DropForeignKey
ALTER TABLE "fan_profile_songs" DROP CONSTRAINT "fan_profile_songs_songId_fkey";

-- DropTable
DROP TABLE "fan_profile_songs";

-- CreateTable
CREATE TABLE "fan_profile_setlist_songs" (
    "fanProfileId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fan_profile_setlist_songs_pkey" PRIMARY KEY ("fanProfileId","songId"),
    -- Rango fijo (1-15), independiente de la lógica de negocio: el máximo
    -- de 15 canciones en sí se valida en la aplicación (ver
    -- FanProfilesService), no acá — un CHECK no puede contar filas de
    -- otras filas, solo esta columna de esta fila.
    CONSTRAINT "fan_profile_setlist_songs_position_check" CHECK ("position" >= 1 AND "position" <= 15)
);

-- CreateTable
CREATE TABLE "fan_profile_favorite_songs" (
    "fanProfileId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fan_profile_favorite_songs_pkey" PRIMARY KEY ("fanProfileId","songId"),
    -- Idem, rango fijo (1-10) — el máximo de 10 favoritas se valida en la
    -- aplicación.
    CONSTRAINT "fan_profile_favorite_songs_position_check" CHECK ("position" >= 1 AND "position" <= 10)
);

-- CreateIndex
CREATE INDEX "fan_profile_setlist_songs_songId_idx" ON "fan_profile_setlist_songs"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "fan_profile_setlist_songs_fanProfileId_position_key" ON "fan_profile_setlist_songs"("fanProfileId", "position");

-- CreateIndex
CREATE INDEX "fan_profile_favorite_songs_songId_idx" ON "fan_profile_favorite_songs"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "fan_profile_favorite_songs_fanProfileId_position_key" ON "fan_profile_favorite_songs"("fanProfileId", "position");

-- AddForeignKey
ALTER TABLE "fan_profile_setlist_songs" ADD CONSTRAINT "fan_profile_setlist_songs_fanProfileId_fkey" FOREIGN KEY ("fanProfileId") REFERENCES "fan_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fan_profile_setlist_songs" ADD CONSTRAINT "fan_profile_setlist_songs_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fan_profile_favorite_songs" ADD CONSTRAINT "fan_profile_favorite_songs_fanProfileId_fkey" FOREIGN KEY ("fanProfileId") REFERENCES "fan_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fan_profile_favorite_songs" ADD CONSTRAINT "fan_profile_favorite_songs_songId_fkey" FOREIGN KEY ("songId") REFERENCES "songs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
