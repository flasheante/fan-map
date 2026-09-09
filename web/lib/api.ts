const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// Base para los pedidos que dependen de la cookie de sesión (todo lo que
// manda `credentials: "include"`, más googleLoginUrl). Nunca la URL directa
// de la API: web (Vercel) y api (Render) son sitios distintos, y con
// `credentials: "include"` eso los vuelve pedidos cross-site — que es
// exactamente lo que un navegador en modo incógnito (o con protección
// contra cookies de terceros) bloquea, sin importar SameSite=None. El
// resultado era login que "pegaba" pero la app nunca veía la sesión.
//
// Acá SÍ hace falta que sea relativa (nunca absoluta): un fetch relativo
// desde el browser resuelve contra el propio origin (fan-map-five.vercel.app
// en prod), y next.config.ts reescribe /api/:path* hacia la API del lado
// del servidor — el browser nunca le habla a Render directamente, así que
// para él deja de ser cross-site y la cookie (incluida la que planta el
// propio roundtrip de Google) queda first-party.
//
// El resto de las funciones de este archivo (getArtists, getCountries,
// getArtistShows, etc.) no llevan cookie — no necesitan el proxy, y
// corriendo server-side (RSC) una URL relativa ni siquiera resolvería, así
// que siguen usando API_URL tal cual.
const SESSION_API_URL = "/api";

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

// Una canción dentro de una de las dos listas posicionadas de un fan — el
// setlist personal (hasta 15) o el Top 10 de favoritas (hasta 10). Mismo
// shape para ambas: `position` siempre presente, ambas son listas
// ordenadas de punta a punta, nunca "en la lista pero sin puesto" (ver
// FanProfileSetlistSong / FanProfileFavoriteSong en el backend — dos
// tablas independientes, no una sola con un topPosition opcional). Mismo
// shape en la vista propia y la pública: ambas listas son siempre
// públicas (ver FanProfilesService).
export interface FanSongListItem {
  id: string;
  title: string;
  albumTitle: string | null;
  position: number;
}

// Redes sociales ya filtradas por privacidad — solo trae las claves de las
// redes configuradas Y marcadas públicas (ver toPublicFanProfileResponse
// en el backend). Una clave ausente = esa red no se muestra.
export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  x?: string;
  youtube?: string;
  facebook?: string;
}

// Shape devuelto por GET /fan-profiles/me, POST y PATCH /fan-profiles
// (toOwnFanProfileResponse en el backend): el dueño ve las 5 redes
// completas, configuradas o no, públicas o no — nunca se usa para mostrar
// el perfil de otro user.
export interface FanProfile {
  id: string;
  displayName: string;
  showOnMap: boolean;
  createdAt: string;
  updatedAt: string;
  city: City;
  artists: FanProfileArtist[];
  // Heredada del login de Google — ver AuthService#findOrCreateFromGoogle.
  // Siempre pública si existe (sin toggle propio).
  photoUrl: string | null;
  // Dos listas completamente independientes — ver FanSongListItem arriba.
  // Una canción puede estar en ninguna, una o ambas a la vez.
  setlistSongs: FanSongListItem[];
  favoriteSongs: FanSongListItem[];
  instagramUrl: string | null;
  instagramIsPublic: boolean;
  tiktokUrl: string | null;
  tiktokIsPublic: boolean;
  xUrl: string | null;
  xIsPublic: boolean;
  youtubeUrl: string | null;
  youtubeIsPublic: boolean;
  facebookUrl: string | null;
  facebookIsPublic: boolean;
}

// Shape devuelto por GET /fan-profiles/:id y GET /fan-profiles
// (toPublicFanProfileResponse en el backend): cualquiera puede pedirlo,
// sin sesión — nunca incluye email/userId ni una red marcada privada.
export interface PublicFanProfile {
  id: string;
  displayName: string;
  showOnMap: boolean;
  createdAt: string;
  updatedAt: string;
  city: City;
  artists: FanProfileArtist[];
  photoUrl: string | null;
  setlistSongs: FanSongListItem[];
  favoriteSongs: FanSongListItem[];
  social: SocialLinks;
}

export interface CreateFanProfileInput {
  displayName: string;
  cityId: string;
  showOnMap?: boolean;
  artistIds?: string[];
}

// Un item de setlistSongs/favoriteSongs en el body de PATCH — mismo shape
// que SetlistSongInput/FavoriteSongInput en el backend (ver
// update-fan-profile.dto.ts): `position` siempre obligatoria, ambas listas
// están ordenadas de punta a punta.
export interface SongListItemInput {
  songId: string;
  position: number;
}

// Body de PATCH /fan-profiles/:id — todo opcional, mismo criterio que
// UpdateFanProfileDto: enviar un campo lo reemplaza, no enviarlo lo deja
// como está. `setlistSongs` y `favoriteSongs` son cada uno un reemplazo
// completo de su propia colección (mismo patrón que artistIds) — son dos
// listas completamente independientes, mandar una nunca toca a la otra.
export interface UpdateFanProfileInput {
  displayName?: string;
  cityId?: string;
  showOnMap?: boolean;
  artistIds?: string[];
  setlistSongs?: SongListItemInput[];
  favoriteSongs?: SongListItemInput[];
  instagramUrl?: string | null;
  instagramIsPublic?: boolean;
  tiktokUrl?: string | null;
  tiktokIsPublic?: boolean;
  xUrl?: string | null;
  xIsPublic?: boolean;
  youtubeUrl?: string | null;
  youtubeIsPublic?: boolean;
  facebookUrl?: string | null;
  facebookIsPublic?: boolean;
}

// Shape devuelto por GET /artists/:artistId/songs (ver
// ArtistsService#findSongs): el catálogo canónico sincronizado desde
// MusicBrainz (src/songs/musicbrainz-sync.service.ts), no el ranking de
// canciones tocadas en vivo (eso es ArtistTopSong, más abajo).
export interface ArtistSong {
  id: string;
  title: string;
  albumTitle: string | null;
  releaseDate: string | null;
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

  const res = await fetch(`${SESSION_API_URL}/fan-profiles`, {
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
  const res = await fetch(`${SESSION_API_URL}/auth/me`, {
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
  const res = await fetch(`${SESSION_API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to log out: ${res.status}`);
  }
}

// URL de inicio del flujo de Google OAuth. Es una navegación de página
// completa (<a href={googleLoginUrl(returnTo)}>), no un fetch: el backend
// hace el redirect a Google y de vuelta, y termina seteando la cookie de
// sesión.
//
// `returnTo` es el path del propio front al que volver una vez logueado
// (ej. "/join", "/profile") — sin esto, GET /auth/google/callback siempre
// redirige a la raíz del sitio sin importar desde dónde se inició el login,
// así que la persona se loguea bien pero "aparece" en la landing en vez de
// donde estaba (bug reportado — ver auth.controller.ts en la API, que es
// quien lo valida y quien realmente decide a dónde volver).
export function googleLoginUrl(returnTo: string): string {
  return `${SESSION_API_URL}/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}

// GET /fan-profiles/me: el FanProfile del User autenticado. 404 = tiene
// sesión pero todavía no completó su perfil; 401 = no hay sesión (se trata
// igual que "no hay perfil que mostrar" para este helper, ver AuthProvider
// para el estado de autenticación en sí). Cualquier otro código es un
// fallo real y no se silencia.
export async function getMyFanProfile(): Promise<FanProfile | null> {
  const res = await fetch(`${SESSION_API_URL}/fan-profiles/me`, {
    credentials: "include",
    cache: "no-store",
  });

  if (res.status === 404 || res.status === 401) return null;

  if (!res.ok) {
    throw new Error(`Failed to fetch current fan profile: ${res.status}`);
  }

  return res.json();
}

// GET /fan-profiles/:id: perfil público de cualquier fan, sin sesión — ver
// PublicFanProfile arriba. 404 = no existe.
function fanProfileHttpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

export async function getFanProfile(id: string): Promise<PublicFanProfile> {
  const res = await fetch(`${API_URL}/fan-profiles/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw fanProfileHttpError(
      `Failed to fetch fan profile ${id}: ${res.status}`,
      res.status,
    );
  }

  return res.json();
}

// PATCH /fan-profiles/:id: mismo criterio de ownership que createFanProfile
// (credentials:"include" obligatorio, request.user.id del lado del
// backend decide el dueño — nunca un campo del body).
export async function updateFanProfile(
  id: string,
  input: UpdateFanProfileInput,
): Promise<FanProfile> {
  const res = await fetch(`${SESSION_API_URL}/fan-profiles/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const message = await extractErrorMessage(res);
    throw new Error(message ?? `Failed to update fan profile: ${res.status}`);
  }

  return res.json();
}

export async function getArtistSongs(artistId: string): Promise<ArtistSong[]> {
  const res = await fetch(`${API_URL}/artists/${artistId}/songs`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch songs for artist ${artistId}: ${res.status}`);
  }

  return res.json();
}

// Shape devuelto por GET /fan-profiles/stats/favorite-songs (ver
// FanProfilesService#findFavoriteSongsRanking): ranking del Fan Map,
// calculado exclusivamente a partir del Top 10 de favoritas de los fans
// visibles en el mapa (showOnMap=true) — el setlist personal nunca
// participa. Ya viene ordenado del backend: count DESC, title ASC como
// desempate. Nunca trae datos de usuarios, solo lo necesario para el
// ranking.
export interface FavoriteSongRankingEntry {
  songId: string;
  title: string;
  albumTitle: string | null;
  count: number;
}

export interface FavoriteSongsRankingFilter {
  countryId?: string;
  cityId?: string;
}

// Sin filtro: ranking mundial. Con cityId, ese gana sobre countryId si se
// pasaran los dos juntos (ver el backend) — la UI del Fan Map solo debería
// mandar uno de los dos por vez (mundial/país/ciudad son mutuamente
// excluyentes, ver components/map/favorite-songs-ranking.tsx).
export async function getFavoriteSongsRanking(
  filter: FavoriteSongsRankingFilter = {},
): Promise<FavoriteSongRankingEntry[]> {
  const params = new URLSearchParams();
  if (filter.cityId) params.set("cityId", filter.cityId);
  else if (filter.countryId) params.set("countryId", filter.countryId);

  const query = params.toString();
  const res = await fetch(
    `${API_URL}/fan-profiles/stats/favorite-songs${query ? `?${query}` : ""}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch favorite songs ranking: ${res.status}`);
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
