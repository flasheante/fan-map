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
// ISR: Vercel sirve el HTML cacheado y lo regenera en background cada 5 min
// (ver PUBLIC_REVALIDATE_SECONDS en lib/api.ts), así el visitante nunca
// espera el cold start de la API en Render.
export const revalidate = 300;

// Sin params prerenderizados en el build: cada ciudad/show se genera en su
// primera visita y queda cacheado (ISR on-demand).
export async function generateStaticParams() {
  return [];
}

export default async function TheWarningTourCityPage({
  params,
}: TheWarningTourCityPageProps) {
  const { cityId } = await params;
  const data = await getTheWarningTourCityData(cityId);

  // Lanzar (en vez de devolver un mensaje) para que ISR no cachee la página
  // de error: si falla una regeneración, Next sigue sirviendo la última
  // versión buena; si falla la primera, se ve app/artists/the-warning/error.tsx.
  if (data.status === "error") {
    throw new Error("No pudimos cargar el historial de shows");
  }

  if (data.status === "artist-not-found") {
    return (
      <main className="flex w-full flex-1 flex-col items-center justify-center gap-4">
        <p>No se encontró el artista.</p>
        <BackToTourMapLink />
      </main>
    );
  }

  if (data.status === "city-not-found") {
    return (
      <main className="flex w-full flex-1 flex-col items-center justify-center gap-4">
        <p>No se encontró la ciudad.</p>
        <BackToTourMapLink />
      </main>
    );
  }

  const { artist, city, shows } = data;

  return (
    <main className="flex w-full flex-1 flex-col">
      <TourCityHistory artist={artist} city={city} shows={shows} />
    </main>
  );
}
