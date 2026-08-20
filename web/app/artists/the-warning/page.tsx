import Link from "next/link";
import { FanMapLoader } from "@/components/map/fan-map-loader";
import { getTheWarningMapData } from "@/lib/the-warning-fan-map";

// Página pública de The Warning. Reutiliza getTheWarningMapData (mismo
// resolutor por slug que usa /map): GET /artists, buscar "the-warning" por
// slug y luego GET /artists/:artistId/fans?onMap=true. Vive en una ruta
// estática por ahora (sin [slug] genérico) hasta que haya más de un artista
// que la necesite.
export default async function TheWarningArtistPage() {
  const data = await getTheWarningMapData();

  if (data.status === "error") {
    return (
      <main className="flex h-screen w-full items-center justify-center">
        <p>
          No pudimos cargar la página del artista. Intentá de nuevo más
          tarde.
        </p>
      </main>
    );
  }

  if (data.status === "artist-not-found") {
    return (
      <main className="flex h-screen w-full items-center justify-center">
        <p>No se encontró el artista.</p>
      </main>
    );
  }

  const { artist, fans } = data;

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
      <div className="min-h-0 flex-1">
        <FanMapLoader fans={fans} />
      </div>
      {fans.length === 0 && (
        <p className="border-t px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Todavía no hay fans de {artist.name} en el mapa. ¡Sumate y sé el
          primero!
        </p>
      )}
    </main>
  );
}
