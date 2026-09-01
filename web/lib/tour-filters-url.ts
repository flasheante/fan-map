import type { TourFilters } from "./tour-filters";

// Nombres de query param, en el orden en que se serializan (ver
// tourFiltersToQueryString): estable y legible, no alfabético — sigue el
// mismo orden en que se declaran los campos en TourFilters.
const SEARCH = "search";
const YEAR = "year";
const COUNTRY_ID = "countryId";
const CITY_ID = "cityId";
const DATE_FROM = "dateFrom";
const DATE_TO = "dateTo";

// Puente entre TourFilters y la URL (ver tour-explorer.tsx, el único
// consumidor: la URL es la fuente de verdad, nunca un useState duplicado).
// Un valor ausente o inválido en la URL simplemente no aparece en el
// TourFilters resultante, en vez de colarse como "" / NaN — así
// filterTourShows (tour-filters.ts) no tiene que volver a validar nada.
export function parseTourFiltersFromSearchParams(
  searchParams: URLSearchParams,
): TourFilters {
  const filters: TourFilters = {};

  const search = searchParams.get(SEARCH)?.trim();
  if (search) filters.search = search;

  const yearRaw = searchParams.get(YEAR);
  if (yearRaw !== null) {
    const year = Number(yearRaw);
    if (Number.isInteger(year)) filters.year = year;
  }

  const countryId = searchParams.get(COUNTRY_ID);
  if (countryId) filters.countryId = countryId;

  const cityId = searchParams.get(CITY_ID);
  if (cityId) filters.cityId = cityId;

  const dateFrom = searchParams.get(DATE_FROM);
  if (dateFrom) filters.dateFrom = dateFrom;

  const dateTo = searchParams.get(DATE_TO);
  if (dateTo) filters.dateTo = dateTo;

  return filters;
}

// Inversa de parseTourFiltersFromSearchParams: nunca serializa un filtro
// vacío/blanco (ver test "does not serialize a blank search"), así
// `router.replace` jamás produce algo como "?search=&year=". Devuelve la
// query string sin el "?" inicial (ver tour-explorer.tsx, que lo antepone
// sólo si el resultado no está vacío).
export function tourFiltersToQueryString(filters: TourFilters): string {
  const params = new URLSearchParams();

  const search = filters.search?.trim();
  if (search) params.set(SEARCH, search);
  if (filters.year !== undefined) params.set(YEAR, String(filters.year));
  if (filters.countryId) params.set(COUNTRY_ID, filters.countryId);
  if (filters.cityId) params.set(CITY_ID, filters.cityId);
  if (filters.dateFrom) params.set(DATE_FROM, filters.dateFrom);
  if (filters.dateTo) params.set(DATE_TO, filters.dateTo);

  return params.toString();
}
