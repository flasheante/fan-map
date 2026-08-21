import {
  getArtistShow,
  getArtists,
  getShowSetlist,
  type Artist,
  type ArtistShow,
  type ShowSetlist,
} from "./api";
import { findArtistBySlug, THE_WARNING_SLUG } from "./the-warning-fan-map";

export type TheWarningShowData =
  | { status: "error" }
  | { status: "artist-not-found" }
  | { status: "show-not-found" }
  | { status: "ok"; artist: Artist; show: ArtistShow; setlist: ShowSetlist };

function isNotFound(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err as Error & { status?: unknown }).status === 404
  );
}

// Mismo flujo que getTheWarningShowsData: GET /artists, ubicar "the-warning"
// por slug (sin hardcodear su UUID, reutilizando THE_WARNING_SLUG /
// findArtistBySlug) y luego, una vez resuelto el artistId, GET
// /artists/:artistId/shows/:showId y GET
// /artists/:artistId/shows/:showId/setlist en paralelo. Un 404 en el show
// (inexistente o de otro artista, según ShowsService) se distingue de otros
// fallos vía el status adjunto por getArtistShow/getShowSetlist.
export async function getTheWarningShowData(
  showId: string,
): Promise<TheWarningShowData> {
  let artists: Artist[];
  try {
    artists = await getArtists();
  } catch {
    return { status: "error" };
  }

  const artist = findArtistBySlug(artists, THE_WARNING_SLUG);
  if (!artist) {
    return { status: "artist-not-found" };
  }

  try {
    const [show, setlist] = await Promise.all([
      getArtistShow(artist.id, showId),
      getShowSetlist(artist.id, showId),
    ]);
    return { status: "ok", artist, show, setlist };
  } catch (err) {
    if (isNotFound(err)) {
      return { status: "show-not-found" };
    }
    return { status: "error" };
  }
}
