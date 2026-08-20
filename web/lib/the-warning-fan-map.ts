import { getArtistFans, getArtists, type Artist, type ArtistFan } from "./api";

export const THE_WARNING_SLUG = "the-warning";

export function findArtistBySlug(
  artists: Artist[],
  slug: string,
): Artist | undefined {
  return artists.find((artist) => artist.slug === slug);
}

export type TheWarningMapData =
  | { status: "error" }
  | { status: "artist-not-found" }
  | { status: "ok"; artist: Artist; fans: ArtistFan[] };

// Orquesta el flujo pedido: GET /artists, ubicar "the-warning" por slug (sin
// hardcodear su UUID) y luego GET /artists/:artistId/fans?onMap=true.
export async function getTheWarningMapData(): Promise<TheWarningMapData> {
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
    const { fans } = await getArtistFans(artist.id);
    return { status: "ok", artist, fans };
  } catch {
    return { status: "error" };
  }
}
