import { BackToTheWarningLink } from "@/components/artists/back-link";
import { TourBreadcrumbs } from "@/components/artists/tour-breadcrumbs";
import { TourExplorer } from "@/components/artists/tour-explorer";
import { getTheWarningTourMapData } from "@/lib/the-warning-tour-map";

// Tour Map público de The Warning: reutiliza getTheWarningTourMapData
// (mismo resolutor por slug que /map y /artists/the-warning, sin
// hardcodear el UUID del artista) para un único GET
// /artists/:artistId/shows. Todo lo que depende de filtros/búsqueda
// (header, panel de filtros, stats, mapa, lista) vive en TourExplorer
// (Client Component): la URL es la fuente de verdad de esos filtros, así
// que este Server Component no necesita saber nada de ellos — sólo resuelve
// los shows una vez y se los pasa.
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

  const { artist, shows } = data;

  return (
    <main className="flex h-screen w-full flex-col overflow-y-auto">
      <div className="border-b border-zinc-800 px-4 py-2">
        <TourBreadcrumbs level="tour" artistName={artist.name} />
      </div>
      <TourExplorer artist={artist} shows={shows} />
    </main>
  );
}
