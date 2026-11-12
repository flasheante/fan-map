import { Suspense } from "react";
import { BackToTheWarningLink } from "@/components/artists/back-link";
import { TourBreadcrumbs } from "@/components/artists/tour-breadcrumbs";
import { TourExplorer } from "@/components/artists/tour-explorer";
import { TourExplorerFallback } from "@/components/artists/tour-explorer-fallback";
import { getTheWarningTourMapData } from "@/lib/the-warning-tour-map";

// Tour Map público de The Warning: reutiliza getTheWarningTourMapData
// (mismo resolutor por slug que /map y /artists/the-warning, sin
// hardcodear el UUID del artista) para un único GET
// /artists/:artistId/shows. Todo lo que depende de filtros/búsqueda
// (header, panel de filtros, stats, mapa, lista) vive en TourExplorer
// (Client Component): la URL es la fuente de verdad de esos filtros, así
// que este Server Component no necesita saber nada de ellos — sólo resuelve
// los shows una vez y se los pasa.
// ISR: Vercel sirve el HTML cacheado y lo regenera en background cada 5 min
// (ver PUBLIC_REVALIDATE_SECONDS en lib/api.ts), así el visitante nunca
// espera el cold start de la API en Render.
export const revalidate = 300;

export default async function TourMapPage() {
  const data = await getTheWarningTourMapData();

  // Lanzar (en vez de devolver un mensaje) para que ISR no cachee la página
  // de error: si falla una regeneración, Next sigue sirviendo la última
  // versión buena; si falla la primera, se ve app/artists/the-warning/error.tsx.
  if (data.status === "error") {
    throw new Error("No pudimos cargar el Tour Map");
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
      {/* TourExplorer usa useSearchParams(): sin este Suspense, en una página
          estática todo hasta loading.tsx se renderizaría sólo en el cliente. */}
      <Suspense fallback={<TourExplorerFallback />}>
        <TourExplorer artist={artist} shows={shows} />
      </Suspense>
    </main>
  );
}
