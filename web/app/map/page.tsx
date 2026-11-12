import { BackToTheWarningLink } from "@/components/artists/back-link";
import { MapExplorer } from "@/components/map/map-explorer";
import { getTheWarningMapData } from "@/lib/the-warning-fan-map";

// ISR: Vercel sirve el HTML cacheado y lo regenera en background cada 5 min
// (ver PUBLIC_REVALIDATE_SECONDS en lib/api.ts). Los fans nuevos aparecen al
// instante igual: crear/editar un perfil invalida FANS_CACHE_TAG (ver
// app/actions/revalidate-fans.ts).
export const revalidate = 300;

// Fan Map de The Warning. Antes /map tenía también la vista "Historial"
// (?view=tour) con un selector propio; ahora el header del sitio
// (components/site-header.tsx) es la única navegación y el historial vive
// sólo en /artists/the-warning/tour — next.config.ts redirige ?view=tour ahí
// para no romper links viejos. ?view=fans se sigue aceptando (se ignora).
export default async function MapPage() {
  const data = await getTheWarningMapData();

  // Lanzar (en vez de devolver un mensaje) para que ISR no cachee la página
  // de error: si falla una regeneración, Next sigue sirviendo la última
  // versión buena; si falla la primera, se ve app/map/error.tsx.
  if (data.status === "error") {
    throw new Error("No se pudo cargar el Fan Map");
  }

  if (data.status === "artist-not-found") {
    return (
      <main className="flex w-full flex-1 flex-col items-center justify-center gap-4">
        <p>No se encontró el artista The Warning.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  const { artist, fans } = data;

  return (
    <main className="flex w-full flex-1 flex-col">
      <MapExplorer artist={artist} fans={fans} />
    </main>
  );
}
