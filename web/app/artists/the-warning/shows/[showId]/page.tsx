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
export default async function TheWarningShowPage({
  params,
}: TheWarningShowPageProps) {
  const { showId } = await params;
  const data = await getTheWarningShowData(showId);

  if (data.status === "error") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No pudimos cargar el show. Intentá de nuevo más tarde.</p>
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

  if (data.status === "show-not-found") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No se encontró el show.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  const { artist, show, setlist } = data;

  return (
    <main className="flex min-h-screen w-full flex-col">
      <ShowDetail artist={artist} show={show} />
      <section>
        <h2 className="px-4 pt-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Setlist
        </h2>
        <Setlist songs={setlist.songs} />
      </section>
    </main>
  );
}
