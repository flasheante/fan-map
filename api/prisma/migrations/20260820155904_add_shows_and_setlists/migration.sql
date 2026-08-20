-- CreateTable
CREATE TABLE "shows" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setlists" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setlist_songs" (
    "id" TEXT NOT NULL,
    "setlistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "setlist_songs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "setlist_songs_position_positive" CHECK ("position" > 0)
);

-- CreateIndex
CREATE INDEX "shows_artistId_idx" ON "shows"("artistId");

-- CreateIndex
CREATE INDEX "shows_cityId_idx" ON "shows"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "setlists_showId_key" ON "setlists"("showId");

-- CreateIndex
CREATE INDEX "setlist_songs_setlistId_idx" ON "setlist_songs"("setlistId");

-- CreateIndex
CREATE UNIQUE INDEX "setlist_songs_setlistId_position_key" ON "setlist_songs"("setlistId", "position");

-- AddForeignKey
ALTER TABLE "shows" ADD CONSTRAINT "shows_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "artists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shows" ADD CONSTRAINT "shows_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setlists" ADD CONSTRAINT "setlists_showId_fkey" FOREIGN KEY ("showId") REFERENCES "shows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setlist_songs" ADD CONSTRAINT "setlist_songs_setlistId_fkey" FOREIGN KEY ("setlistId") REFERENCES "setlists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
