import { BackToTourMapLink } from "@/components/artists/back-link";
import { TourCityHistory } from "@/components/artists/tour-city-history";
import { getTheWarningTourCityData } from "@/lib/the-warning-tour-city";

interface TheWarningTourCityPageProps {
  params: Promise<{ cityId: string }>;
}

// Historial de shows de The Warning en una ciudad del Tour Map. Reutiliza
// getTheWarningTourCityData (mismo resolutor por slug que el resto de
// páginas de The Warning): GET /artists, buscar "the-warning" por slug (sin
// hardcodear su UUID) y luego GET /artists/:artistId/shows, filtrando por
// el cityId de la URL. No hay endpoint de detalle de ciudad: una ciudad sin
// shows es indistinguible de una inexistente (ver the-warning-tour-city.ts).
export default async function TheWarningTourCityPage({
  params,
}: TheWarningTourCityPageProps) {
  const { cityId } = await params;
  const data = await getTheWarningTourCityData(cityId);

  if (data.status === "error") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No pudimos cargar el historial de shows. Intentá de nuevo más tarde.</p>
        <BackToTourMapLink />
      </main>
    );
  }

  if (data.status === "artist-not-found") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No se encontró el artista.</p>
        <BackToTourMapLink />
      </main>
    );
  }

  if (data.status === "city-not-found") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No se encontró la ciudad.</p>
        <BackToTourMapLink />
      </main>
    );
  }

  const { artist, city, shows } = data;

  return (
    <main className="flex min-h-screen w-full flex-col">
      <TourCityHistory artist={artist} city={city} shows={shows} />
    </main>
  );
}
