import { getArtistShows, getArtists, type Artist, type ArtistShow } from "./api";
import { findArtistBySlug, THE_WARNING_SLUG } from "./the-warning-fan-map";

// Ciudad resuelta para el historial (ver getTheWarningTourCityData): a
// diferencia de TourCity (the-warning-tour-map.ts) no incluye
// latitude/longitude porque esta página no dibuja un mapa.
export interface TourCityInfo {
  id: string;
  name: string;
  country: { name: string; code: string };
}

export type TheWarningTourCityData =
  | { status: "error" }
  | { status: "artist-not-found" }
  | { status: "city-not-found" }
  | { status: "ok"; artist: Artist; city: TourCityInfo; shows: ArtistShow[] };

// Mismo flujo que getTheWarningTourMapData: GET /artists, ubicar
// "the-warning" por slug (sin hardcodear su UUID) y luego GET
// /artists/:artistId/shows, filtrando por el cityId recibido en vez de
// agrupar por ciudad. No existe un endpoint de detalle de ciudad: la
// info de la ciudad (nombre, país) se toma del primer show que matchea, así
// que una ciudad sin shows es indistinguible de una ciudad inexistente y
// ambas resuelven en "city-not-found".
export async function getTheWarningTourCityData(
  cityId: string,
): Promise<TheWarningTourCityData> {
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

  let shows: ArtistShow[];
  try {
    shows = await getArtistShows(artist.id);
  } catch {
    return { status: "error" };
  }

  const cityShows = shows.filter((show) => show.city.id === cityId);
  if (cityShows.length === 0) {
    return { status: "city-not-found" };
  }

  const { city } = cityShows[0];
  return {
    status: "ok",
    artist,
    city: {
      id: city.id,
      name: city.name,
      country: { name: city.country.name, code: city.country.code },
    },
    shows: cityShows,
  };
}
