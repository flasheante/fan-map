import { BackToTheWarningLink } from "@/components/artists/back-link";
import { MapExplorer } from "@/components/map/map-explorer";
import { getArtists } from "@/lib/api";
import { getTheWarningMapData } from "@/lib/the-warning-fan-map";
import { getTheWarningTourMapData } from "@/lib/the-warning-tour-map";

// Entrada principal al mapa: resuelve GET /artists una sola vez acá y lo
// comparte con getTheWarningTourMapData y getTheWarningMapData (mismo
// resolutor por slug que usan /artists/the-warning y
// /artists/the-warning/tour, sin hardcodear el UUID del artista), así un
// único GET /artists alcanza para ambos datasets aunque el usuario sólo vea
// una vista a la vez. Todo lo que depende de la vista activa (Historial vs
// Fan Map, ver lib/map-view.ts) vive en MapExplorer (Client Component): este
// Server Component no sabe nada de `view`, sólo resuelve los datos una vez y
// se los pasa.
export default async function MapPage() {
  let artists;
  try {
    artists = await getArtists();
  } catch {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No se pudo cargar el mapa. Intentá de nuevo más tarde.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  const [tourData, fanData] = await Promise.all([
    getTheWarningTourMapData(artists),
    getTheWarningMapData(artists),
  ]);

  if (tourData.status === "error" || fanData.status === "error") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No se pudo cargar el mapa. Intentá de nuevo más tarde.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  if (tourData.status === "artist-not-found" || fanData.status === "artist-not-found") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No se encontró el artista The Warning.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  const { artist, shows } = tourData;
  const { fans } = fanData;

  return (
    <main className="flex h-screen w-full flex-col overflow-y-auto">
      <MapExplorer artist={artist} shows={shows} fans={fans} />
    </main>
  );
}
