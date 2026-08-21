const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export interface Country {
  id: string;
  name: string;
  code: string;
}

export interface City {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: Country;
}

export interface Artist {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArtistFan {
  id: string;
  displayName: string;
  showOnMap: boolean;
  createdAt: string;
  updatedAt: string;
  city: City;
}

export interface ArtistFansResponse {
  artist: Artist;
  fans: ArtistFan[];
}

// Shape devuelto por GET /artists/:artistId/shows (ver ShowsController /
// toShowResponse): venue puede ser null cuando todavía no se cargó.
export interface ArtistShow {
  id: string;
  date: string;
  venue: string | null;
  createdAt: string;
  updatedAt: string;
  city: City;
}

// Shape devuelto por GET /artists/:artistId/shows/:showId/setlist (ver
// ShowsService.findSetlist / toSongResponse).
export interface SetlistSong {
  id: string;
  position: number;
  title: string;
}

export interface ShowSetlist {
  showId: string;
  songs: SetlistSong[];
}

// Shape devuelto por GET /countries/:countryId/cities (ver
// CitiesController): la ciudad "plana", sin el país anidado que sí trae
// ArtistFan.city / FanProfile.city.
export interface CityOption {
  id: string;
  name: string;
  countryId: string;
}

export interface FanProfileArtist {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface FanProfile {
  id: string;
  displayName: string;
  showOnMap: boolean;
  createdAt: string;
  updatedAt: string;
  city: City;
  artists: FanProfileArtist[];
}

export interface CreateFanProfileInput {
  email: string;
  displayName: string;
  cityId: string;
  showOnMap?: boolean;
  artistIds?: string[];
}

export async function getArtists(): Promise<Artist[]> {
  const res = await fetch(`${API_URL}/artists`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to fetch artists: ${res.status}`);
  }

  return res.json();
}

export async function getCountries(): Promise<Country[]> {
  const res = await fetch(`${API_URL}/countries`, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Failed to fetch countries: ${res.status}`);
  }

  return res.json();
}

export async function getCities(countryId: string): Promise<CityOption[]> {
  const res = await fetch(`${API_URL}/countries/${countryId}/cities`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch cities for country ${countryId}: ${res.status}`);
  }

  return res.json();
}

// Extrae un mensaje de error legible del body de una respuesta de Nest
// (ValidationPipe y las HttpException devuelven { message, statusCode, error }
// donde message puede ser un string o un array de strings de class-validator).
async function extractErrorMessage(res: Response): Promise<string | undefined> {
  try {
    const body = await res.json();
    if (typeof body?.message === "string") return body.message;
    if (Array.isArray(body?.message)) return body.message.join(", ");
  } catch {
    // El body no era JSON parseable; se usa el fallback genérico.
  }
  return undefined;
}

export async function createFanProfile(
  input: CreateFanProfileInput,
): Promise<FanProfile> {
  const res = await fetch(`${API_URL}/fan-profiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new Error(message ?? `Failed to create fan profile: ${res.status}`);
  }

  return res.json();
}

export async function getArtistFans(
  artistId: string,
): Promise<ArtistFansResponse> {
  const res = await fetch(`${API_URL}/artists/${artistId}/fans?onMap=true`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch fans for artist ${artistId}: ${res.status}`);
  }

  return res.json();
}

export async function getArtistShows(artistId: string): Promise<ArtistShow[]> {
  const res = await fetch(`${API_URL}/artists/${artistId}/shows`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch shows for artist ${artistId}: ${res.status}`);
  }

  return res.json();
}

// Adjunta el status HTTP al Error (a diferencia del resto de funciones de
// este archivo) para que getTheWarningShowData pueda distinguir un show
// inexistente / de otro artista (404) de otros fallos (red, 5xx).
function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export async function getArtistShow(
  artistId: string,
  showId: string,
): Promise<ArtistShow> {
  const res = await fetch(`${API_URL}/artists/${artistId}/shows/${showId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw httpError(
      `Failed to fetch show ${showId} for artist ${artistId}: ${res.status}`,
      res.status,
    );
  }

  return res.json();
}

export async function getShowSetlist(
  artistId: string,
  showId: string,
): Promise<ShowSetlist> {
  const res = await fetch(
    `${API_URL}/artists/${artistId}/shows/${showId}/setlist`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw httpError(
      `Failed to fetch setlist for show ${showId}: ${res.status}`,
      res.status,
    );
  }

  return res.json();
}
