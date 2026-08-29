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

// Shape devuelto por GET /artists/:artistId/stats (ver ArtistsService.findStats).
export interface ArtistStats {
  fans: number;
  countries: number;
  cities: number;
  shows: number;
  songs: number;
}

// Shape devuelto por GET /artists/:artistId/stats/songs (ver
// ArtistsService.findTopSongs), ya ordenado por timesPlayed desc / title asc.
export interface ArtistTopSong {
  title: string;
  timesPlayed: number;
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
  displayName: string;
  cityId: string;
  showOnMap?: boolean;
  artistIds?: string[];
}

// Shape devuelto por GET /auth/me (ver SessionService.PublicUser /
// AuthController#me): solo id + email, nunca datos de OAuth.
export interface CurrentUser {
  id: string;
  email: string;
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

// POST /fan-profiles requiere sesión (SessionAuthGuard): el User se
// resuelve server-side de la cookie (request.user.id), nunca de un campo
// del body — por eso CreateFanProfileInput no tiene email ni userId, y por
// eso credentials: "include" es obligatorio acá (web y api son orígenes
// distintos incluso en dev, ver CORS en api/src/main.ts). El body se arma
// campo por campo (no `JSON.stringify(input)` directo) para que ni un
// `email`/`userId` colado en el objeto de entrada llegue a viajar.
export async function createFanProfile(
  input: CreateFanProfileInput,
): Promise<FanProfile> {
  const body: CreateFanProfileInput = {
    displayName: input.displayName,
    cityId: input.cityId,
    ...(input.showOnMap !== undefined ? { showOnMap: input.showOnMap } : {}),
    ...(input.artistIds !== undefined ? { artistIds: input.artistIds } : {}),
  };

  const res = await fetch(`${API_URL}/fan-profiles`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new Error(message ?? `Failed to create fan profile: ${res.status}`);
  }

  return res.json();
}

// GET /auth/me: 200 = sesión válida (User), 401 = sin sesión (no es un
// error, es el estado "no autenticado"), cualquier otro código es un
// fallo real de la API y no se silencia.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const res = await fetch(`${API_URL}/auth/me`, {
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 401) return null;

  if (!res.ok) {
    throw new Error(`Failed to fetch current user: ${res.status}`);
  }

  return res.json();
}

// POST /auth/logout invalida la Session server-side. No toca la cookie
// httpOnly desde JS (no se puede, y no hace falta: el backend la limpia
// con Set-Cookie en la respuesta) — el frontend solo debe olvidar el user
// del estado en memoria (ver AuthProvider).
export async function logout(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to log out: ${res.status}`);
  }
}

// URL de inicio del flujo de Google OAuth. Es una navegación de página
// completa (<a href={googleLoginUrl()}>), no un fetch: el backend hace el
// redirect a Google y de vuelta, y termina seteando la cookie de sesión.
export function googleLoginUrl(): string {
  return `${API_URL}/auth/google`;
}

// GET /fan-profiles/me: el FanProfile del User autenticado. 404 = tiene
// sesión pero todavía no completó su perfil; 401 = no hay sesión (se trata
// igual que "no hay perfil que mostrar" para este helper, ver AuthProvider
// para el estado de autenticación en sí). Cualquier otro código es un
// fallo real y no se silencia.
export async function getMyFanProfile(): Promise<FanProfile | null> {
  const res = await fetch(`${API_URL}/fan-profiles/me`, {
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 404 || res.status === 401) return null;

  if (!res.ok) {
    throw new Error(`Failed to fetch current fan profile: ${res.status}`);
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

export async function getArtistStats(artistId: string): Promise<ArtistStats> {
  const res = await fetch(`${API_URL}/artists/${artistId}/stats`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch stats for artist ${artistId}: ${res.status}`);
  }

  return res.json();
}

export async function getArtistTopSongs(
  artistId: string,
): Promise<ArtistTopSong[]> {
  const res = await fetch(`${API_URL}/artists/${artistId}/stats/songs`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch top songs for artist ${artistId}: ${res.status}`,
    );
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
