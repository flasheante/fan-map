import { getArtistStats, getArtists, type Artist, type ArtistStats } from "./api";
import { findArtistBySlug, THE_WARNING_SLUG } from "./the-warning-fan-map";

export type TheWarningStatsData =
  | { status: "error" }
  | { status: "artist-not-found" }
  | { status: "ok"; artist: Artist; stats: ArtistStats };

// Mismo flujo que getTheWarningMapData / getTheWarningShowsData: GET
// /artists, ubicar "the-warning" por slug (sin hardcodear su UUID,
// reutilizando THE_WARNING_SLUG / findArtistBySlug) y luego GET
// /artists/:artistId/stats.
//
// `artists` es opcional: si se pasa (ver app/artists/the-warning/page.tsx,
// que lo comparte con getTheWarningMapData y getTheWarningShowsData para no
// volver a pedirlo), se usa tal cual en lugar de volver a pedirlo.
export async function getTheWarningStatsData(
  artists?: Artist[],
): Promise<TheWarningStatsData> {
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
    const stats = await getArtistStats(artist.id);
    return { status: "ok", artist, stats };
  } catch {
    return { status: "error" };
  }
}
