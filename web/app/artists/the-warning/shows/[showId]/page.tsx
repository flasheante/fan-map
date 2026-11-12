import { BackToTheWarningLink } from "@/components/artists/back-link";
import { Setlist } from "@/components/artists/setlist";
import { ShowDetail } from "@/components/artists/show-detail";
import { getTheWarningShowData } from "@/lib/the-warning-show";

interface TheWarningShowPageProps {
  params: Promise<{ showId: string }>;
}

// Página de detalle de un show de The Warning. Reutiliza
// getTheWarningShowData (mismo resolutor por slug que /artists/the-warning):
// GET /artists, buscar "the-warning" por slug (sin hardcodear su UUID) y
// luego, con el showId de la URL, GET /artists/:artistId/shows/:showId y
// GET /artists/:artistId/shows/:showId/setlist en paralelo.
// ISR: Vercel sirve el HTML cacheado y lo regenera en background cada 5 min
// (ver PUBLIC_REVALIDATE_SECONDS en lib/api.ts), así el visitante nunca
// espera el cold start de la API en Render.
export const revalidate = 300;

// Sin params prerenderizados en el build: cada ciudad/show se genera en su
// primera visita y queda cacheado (ISR on-demand).
export async function generateStaticParams() {
  return [];
}

export default async function TheWarningShowPage({
  params,
}: TheWarningShowPageProps) {
  const { showId } = await params;
  const data = await getTheWarningShowData(showId);

  // Lanzar (en vez de devolver un mensaje) para que ISR no cachee la página
  // de error: si falla una regeneración, Next sigue sirviendo la última
  // versión buena; si falla la primera, se ve app/artists/the-warning/error.tsx.
  if (data.status === "error") {
    throw new Error("No pudimos cargar el show");
  }

  if (data.status === "artist-not-found") {
    return (
      <main className="flex w-full flex-1 flex-col items-center justify-center gap-4">
        <p>No se encontró el artista.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  if (data.status === "show-not-found") {
    return (
      <main className="flex w-full flex-1 flex-col items-center justify-center gap-4">
        <p>No se encontró el show.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  const { artist, show, setlist } = data;

  return (
    <main className="flex w-full flex-1 flex-col">
      <ShowDetail artist={artist} show={show} />
      <section>
        <h2 className="font-warning px-4 pt-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
          Setlist
        </h2>
        <Setlist songs={setlist.songs} />
      </section>
    </main>
  );
}
