import { getArtistShows, getArtists, type Artist, type ArtistShow } from "./api";
import { findArtistBySlug, THE_WARNING_SLUG } from "./the-warning-fan-map";

export type TheWarningShowsData =
  | { status: "error" }
  | { status: "artist-not-found" }
  | { status: "ok"; artist: Artist; shows: ArtistShow[] };

// Mismo flujo que getTheWarningMapData: GET /artists, ubicar "the-warning"
// por slug (sin hardcodear su UUID, reutilizando THE_WARNING_SLUG /
// findArtistBySlug) y luego GET /artists/:artistId/shows.
//
// `artists` es opcional: si se pasa (ver app/artists/the-warning/page.tsx,
// que lo comparte con getTheWarningMapData para no duplicar el GET
// /artists), se usa tal cual en lugar de volver a pedirlo.
export async function getTheWarningShowsData(
  artists?: Artist[],
): Promise<TheWarningShowsData> {
  let resolvedArtists: Artist[];
  if (artists) {
    resolvedArtists = artists;
  } else {
    try {
      resolvedArtists = await getArtists();
    } catch {
      return { status: "error" };
    }
  }

  const artist = findArtistBySlug(resolvedArtists, THE_WARNING_SLUG);
  if (!artist) {
    return { status: "artist-not-found" };
  }

  try {
    const shows = await getArtistShows(artist.id);
    return { status: "ok", artist, shows };
  } catch {
    return { status: "error" };
  }
}
