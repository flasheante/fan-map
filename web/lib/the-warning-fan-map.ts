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
//
// `artists` es opcional: si se pasa (ver app/artists/the-warning/page.tsx,
// que lo comparte con getTheWarningShowsData para no duplicar el GET
// /artists), se usa tal cual en lugar de volver a pedirlo.
export async function getTheWarningMapData(
  artists?: Artist[],
): Promise<TheWarningMapData> {
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
    const { fans } = await getArtistFans(artist.id);
    return { status: "ok", artist, fans };
  } catch {
    return { status: "error" };
  }
}
