import type { CityOption, Region } from "./api";

// Opción del selector de provincia/estado que agrupa las ciudades sin
// región. Las del catálogo siempre tienen una, pero una ciudad cargada a
// mano puede no tenerla y tiene que poder elegirse igual.
export const NO_REGION_ID = "__no-region__";
const NO_REGION_LABEL = "Otras ciudades";

// Provincias/estados de las ciudades de un país, sin repetir y ordenadas
// por nombre. Vacío si ninguna ciudad tiene región (p. ej. Singapur): en
// ese caso se elige la ciudad directamente, sin paso intermedio.
export function getRegionOptions(cities: CityOption[]): Region[] {
  const byId = new Map<string, Region>();
  for (const city of cities) {
    if (city.region) byId.set(city.region.id, city.region);
  }
  if (byId.size === 0) return [];

  const regions = [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es"),
  );
  if (cities.some((city) => !city.region)) {
    regions.push({ id: NO_REGION_ID, name: NO_REGION_LABEL });
  }
  return regions;
}

export function filterCitiesByRegion(
  cities: CityOption[],
  regionId: string,
): CityOption[] {
  if (regionId === NO_REGION_ID) return cities.filter((city) => !city.region);
  return cities.filter((city) => city.region?.id === regionId);
}

// Región que corresponde preseleccionar para una ciudad ya elegida (al
// abrir el editor de perfil), con el mismo criterio que getRegionOptions.
export function getRegionIdForCity(
  cities: CityOption[],
  cityId: string,
): string {
  if (getRegionOptions(cities).length === 0) return "";
  const city = cities.find((c) => c.id === cityId);
  if (!city) return "";
  return city.region?.id ?? NO_REGION_ID;
}
