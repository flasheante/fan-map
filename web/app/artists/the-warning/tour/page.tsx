import { BackToTheWarningLink } from "@/components/artists/back-link";
import { TourMapLoader } from "@/components/artists/tour-map-loader";
import { getTheWarningTourMapData } from "@/lib/the-warning-tour-map";

// Tour Map público de The Warning: reutiliza getTheWarningTourMapData
// (mismo resolutor por slug que /map y /artists/the-warning, sin
// hardcodear el UUID del artista), que agrupa GET
// /artists/:artistId/shows por ciudad. Cada marcador es una ciudad, no un
// show; el popup linkea a /artists/the-warning/shows/:showId, que ya
// muestra el detalle y el setlist.
export default async function TourMapPage() {
  const data = await getTheWarningTourMapData();

  if (data.status === "error") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No pudimos cargar el Tour Map. Intentá de nuevo más tarde.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  if (data.status === "artist-not-found") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No se encontró el artista.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  const { artist, cities } = data;

  return (
    <main className="flex h-screen w-full flex-col">
      <div className="border-b px-4 py-2">
        <BackToTheWarningLink />
      </div>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">{artist.name} Tour Map</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {cities.length} {cities.length === 1 ? "ciudad" : "ciudades"}
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <TourMapLoader cities={cities} />
      </div>
      {cities.length === 0 && (
        <p className="border-t px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Todavía no hay ciudades con shows de {artist.name} en el mapa.
        </p>
      )}
    </main>
  );
}
