import Link from "next/link";
import { ArtistStatsSummary } from "@/components/artists/artist-stats";
import { ShowsList } from "@/components/artists/shows-list";
import { TopSongs } from "@/components/artists/top-songs";
import { FanMapLoader } from "@/components/map/fan-map-loader";
import { getArtists } from "@/lib/api";
import { getTheWarningMapData } from "@/lib/the-warning-fan-map";
import { getTheWarningShowsData } from "@/lib/the-warning-shows";
import { getTheWarningStatsData } from "@/lib/the-warning-stats";
import { getTheWarningTopSongsData } from "@/lib/the-warning-top-songs";

// Página pública de The Warning. Pide GET /artists una sola vez acá y
// comparte el resultado con getTheWarningMapData, getTheWarningShowsData,
// getTheWarningStatsData y getTheWarningTopSongsData (mismo resolutor por
// slug que usa /map, sin hardcodear su UUID) para que no lo vuelva a pedir
// cada una por su cuenta; luego GET /artists/:artistId/fans?onMap=true, GET
// /artists/:artistId/shows, GET /artists/:artistId/stats y GET
// /artists/:artistId/stats/songs corren en paralelo. Vive en una ruta
// estática por ahora (sin [slug] genérico) hasta que haya más de un artista
// que la necesite.
export default async function TheWarningArtistPage() {
  let artists;
  try {
    artists = await getArtists();
  } catch {
    return (
      <main className="flex h-screen w-full items-center justify-center">
        <p>
          No pudimos cargar la página del artista. Intentá de nuevo más
          tarde.
        </p>
      </main>
    );
  }

  const [mapData, showsData, statsData, topSongsData] = await Promise.all([
    getTheWarningMapData(artists),
    getTheWarningShowsData(artists),
    getTheWarningStatsData(artists),
    getTheWarningTopSongsData(artists),
  ]);

  if (
    mapData.status === "error" ||
    showsData.status === "error" ||
    statsData.status === "error" ||
    topSongsData.status === "error"
  ) {
    return (
      <main className="flex h-screen w-full items-center justify-center">
        <p>
          No pudimos cargar la página del artista. Intentá de nuevo más
          tarde.
        </p>
      </main>
    );
  }

  if (
    mapData.status === "artist-not-found" ||
    showsData.status === "artist-not-found" ||
    statsData.status === "artist-not-found" ||
    topSongsData.status === "artist-not-found"
  ) {
    return (
      <main className="flex h-screen w-full items-center justify-center">
        <p>No se encontró el artista.</p>
      </main>
    );
  }

  const { artist, fans } = mapData;
  const { shows } = showsData;
  const { stats } = statsData;
  const { topSongs } = topSongsData;

  return (
    <main className="flex h-screen w-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          {artist.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- imageUrl es un dominio arbitrario, no configurado en next/image
            <img
              src={artist.imageUrl}
              alt={artist.name}
              className="h-12 w-12 rounded-full object-cover"
            />
          )}
          <div>
            <h1 className="text-lg font-semibold">{artist.name}</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {fans.length} {fans.length === 1 ? "fan" : "fans"} en el mapa
            </p>
          </div>
        </div>
        <Link
          href="/join"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Join the FanMap
        </Link>
      </header>
      <ArtistStatsSummary stats={stats} />
      <div className="min-h-0 flex-1">
        <FanMapLoader fans={fans} />
      </div>
      {fans.length === 0 && (
        <p className="border-t px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Todavía no hay fans de {artist.name} en el mapa. ¡Sumate y sé el
          primero!
        </p>
      )}
      <section className="max-h-64 overflow-y-auto border-t">
        <h2 className="px-4 pt-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Shows
        </h2>
        <ShowsList shows={shows} />
      </section>
      <div className="max-h-64 overflow-y-auto border-t">
        <TopSongs topSongs={topSongs} />
      </div>
    </main>
  );
}
