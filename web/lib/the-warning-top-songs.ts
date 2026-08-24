import {
  getArtistTopSongs,
  getArtists,
  type Artist,
  type ArtistTopSong,
} from "./api";
import { findArtistBySlug, THE_WARNING_SLUG } from "./the-warning-fan-map";

export type TheWarningTopSongsData =
  | { status: "error" }
  | { status: "artist-not-found" }
  | { status: "ok"; artist: Artist; topSongs: ArtistTopSong[] };

// Mismo flujo que getTheWarningStatsData: GET /artists, ubicar "the-warning"
// por slug (sin hardcodear su UUID, reutilizando THE_WARNING_SLUG /
// findArtistBySlug) y luego GET /artists/:artistId/stats/songs.
//
// `artists` es opcional: si se pasa (ver app/artists/the-warning/page.tsx,
// que lo comparte con getTheWarningMapData, getTheWarningShowsData y
// getTheWarningStatsData para no volver a pedirlo), se usa tal cual en lugar
// de volver a pedirlo.
export async function getTheWarningTopSongsData(
  artists?: Artist[],
): Promise<TheWarningTopSongsData> {
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
    const topSongs = await getArtistTopSongs(artist.id);
    return { status: "ok", artist, topSongs };
  } catch {
    return { status: "error" };
  }
}
