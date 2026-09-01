import type { ArtistShow, Country } from "./api";

// Modelo único de filtros del historial de shows (Tour Map, Tour Stats,
// Tour City History y la búsqueda comparten esta misma forma, ver
// filterTourShows más abajo): evita que cada componente interprete los
// filtros a su manera. Genérico a propósito — sin nada de "the-warning"
// acá — para no atar la lógica de filtrado/búsqueda a un único artista
// (ver /artists/:artistSlug/tour a futuro).
export interface TourFilters {
  search?: string;
  year?: number;
  countryId?: string;
  cityId?: string;
  dateFrom?: string; // ISO date (yyyy-mm-dd) o datetime, límite inferior inclusive
  dateTo?: string; // ISO date (yyyy-mm-dd) o datetime, límite superior inclusive
}

// Quita diacríticos (acentos) y normaliza mayúsculas/espacios, para que
// "Mexico" encuentre "México" y viceversa, sin importar mayúsculas o
// espacios de más al inicio/final. NFD separa cada letra acentuada en
// base + marca de acento combinante (rango Unicode U+0300-U+036F), que se
// descarta después.
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// Campos de texto donde matchea la búsqueda libre: ciudad, país, venue y el
// año (como texto, ver test "matches by year as text") de cada show. `venue`
// puede ser null (ver ArtistShow en api.ts); se omite en ese caso en vez de
// romper.
function searchableText(show: ArtistShow): string {
  const year = new Date(show.date).getUTCFullYear();
  const parts = [show.city.name, show.city.country.name, show.venue, String(year)];
  return normalize(parts.filter((part): part is string => Boolean(part)).join(" "));
}

function matchesSearch(show: ArtistShow, search: string): boolean {
  const query = normalize(search);
  if (!query) return true;
  return searchableText(show).includes(query);
}

function matchesYear(show: ArtistShow, year: number): boolean {
  return new Date(show.date).getUTCFullYear() === year;
}

function matchesDateFrom(show: ArtistShow, dateFrom: string): boolean {
  return new Date(show.date).getTime() >= new Date(dateFrom).getTime();
}

function matchesDateTo(show: ArtistShow, dateTo: string): boolean {
  return new Date(show.date).getTime() <= new Date(dateTo).getTime();
}

// Función pura reutilizable: no muta `shows` (ver test "does not mutate the
// original shows array", mismo criterio que calculateTourStats en
// the-warning-tour-stats.ts) y combina todos los filtros presentes con
// semántica AND — un show debe cumplir cada filtro provisto, no alguno de
// ellos. Un filtro ausente (undefined) no descarta nada; `search` vacío o
// sólo espacios se trata igual que ausente.
export function filterTourShows(
  shows: ArtistShow[],
  filters: TourFilters,
): ArtistShow[] {
  const { search, year, countryId, cityId, dateFrom, dateTo } = filters;

  return shows.filter((show) => {
    if (search !== undefined && !matchesSearch(show, search)) return false;
    if (year !== undefined && !matchesYear(show, year)) return false;
    if (countryId !== undefined && show.city.country.id !== countryId) return false;
    if (cityId !== undefined && show.city.id !== cityId) return false;
    if (dateFrom !== undefined && !matchesDateFrom(show, dateFrom)) return false;
    if (dateTo !== undefined && !matchesDateTo(show, dateTo)) return false;
    return true;
  });
}

// Ciudad "opción de selector": aplana country a countryId/countryName (en
// vez de anidarlo, como hace City en api.ts) porque es lo único que el
// panel de filtros necesita para mostrar "Ciudad, País" y desambiguar
// homónimos (ver test "keeps same-named cities from different countries").
export interface TourCityOption {
  id: string;
  name: string;
  countryId: string;
  countryName: string;
}

// Los tres catálogos de abajo (años/países/ciudades) siempre se calculan
// sobre `shows` sin filtrar (allShows, ver tour-explorer.tsx): así el
// usuario nunca queda "atrapado" sin ver una opción que dejó de aparecer
// en los resultados por otro filtro ya aplicado.

// Años con al menos un show, ascendente. El año se deriva en UTC (mismo
// criterio que findShowsByYear en the-warning-tour-stats.ts).
export function getAvailableYears(shows: ArtistShow[]): number[] {
  const years = new Set(shows.map((show) => new Date(show.date).getUTCFullYear()));
  return Array.from(years).sort((a, b) => a - b);
}

// Países con al menos un show, uno por country.id, ordenados por nombre.
export function getAvailableCountries(shows: ArtistShow[]): Country[] {
  const byId = new Map<string, Country>();
  for (const show of shows) {
    byId.set(show.city.country.id, show.city.country);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Ciudades con al menos un show, una por city.id (nunca por nombre: ver
// TourCityOption y el test de homónimos), ordenadas por nombre y, en
// empate, por país.
export function getAvailableCities(shows: ArtistShow[]): TourCityOption[] {
  const byId = new Map<string, TourCityOption>();
  for (const show of shows) {
    const { city } = show;
    byId.set(city.id, {
      id: city.id,
      name: city.name,
      countryId: city.country.id,
      countryName: city.country.name,
    });
  }
  return Array.from(byId.values()).sort(
    (a, b) => a.name.localeCompare(b.name) || a.countryName.localeCompare(b.countryName),
  );
}
