import { BackToTheWarningLink } from "@/components/artists/back-link";
import { TheWarningLogo } from "@/components/artists/the-warning-logo";
import { TourBreadcrumbs } from "@/components/artists/tour-breadcrumbs";
import { TourMapLoader } from "@/components/artists/tour-map-loader";
import { TourStatsRankings, TourStatsSummary } from "@/components/artists/tour-stats";
import { getTheWarningTourMapData } from "@/lib/the-warning-tour-map";
import { calculateTourStats } from "@/lib/the-warning-tour-stats";

// Tour Map público de The Warning: reutiliza getTheWarningTourMapData
// (mismo resolutor por slug que /map y /artists/the-warning, sin
// hardcodear el UUID del artista), que agrupa GET
// /artists/:artistId/shows por ciudad. Cada marcador es una ciudad, no un
// show; el popup linkea a /artists/the-warning/shows/:showId, que ya
// muestra el detalle y el setlist. El resumen estadístico (TourStats) se
// calcula con calculateTourStats sobre el mismo `data.shows` que ya trajo
// getTheWarningTourMapData, sin un segundo GET /artists/:artistId/shows.
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

  const { artist, cities, shows } = data;
  const stats = calculateTourStats(shows);

  return (
    <main className="flex h-screen w-full flex-col overflow-y-auto">
      <div className="border-b border-zinc-800 px-4 py-2">
        <TourBreadcrumbs level="tour" artistName={artist.name} />
      </div>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
        <h1 className="flex items-center gap-3">
          <TheWarningLogo height={28} />
          <span className="font-warning text-sm font-bold uppercase tracking-wide text-zinc-400">
            Tour Map
          </span>
        </h1>
        <p className="text-sm text-zinc-400">
          {stats.totalCities} {stats.totalCities === 1 ? "ciudad" : "ciudades"}
        </p>
      </header>
      <TourStatsSummary stats={stats} />
      <div className="min-h-[60vh] flex-1">
        <TourMapLoader cities={cities} />
      </div>
      {cities.length === 0 && (
        <p className="border-t border-zinc-800 px-4 py-3 text-center text-sm text-zinc-400">
          Todavía no hay ciudades con shows de {artist.name} en el mapa.
        </p>
      )}
      <TourStatsRankings stats={stats} />
    </main>
  );
}
