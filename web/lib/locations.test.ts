import { describe, expect, it } from "vitest";
import type { CityOption } from "./api";
import {
  filterCitiesByRegion,
  getRegionIdForCity,
  getRegionOptions,
  NO_REGION_ID,
} from "./locations";

const cordobaRegion = { id: "region-cba", name: "Córdoba" };
const buenosAiresRegion = { id: "region-ba", name: "Buenos Aires" };

function city(id: string, region: CityOption["region"]): CityOption {
  return { id, name: id, countryId: "country-ar", region };
}

const laPlata = city("la-plata", buenosAiresRegion);
const marDelPlata = city("mar-del-plata", buenosAiresRegion);
const cordoba = city("cordoba", cordobaRegion);
const orphan = city("orphan", null);

describe("getRegionOptions", () => {
  it("returns each region once, sorted by name", () => {
    expect(getRegionOptions([cordoba, laPlata, marDelPlata])).toEqual([
      buenosAiresRegion,
      cordobaRegion,
    ]);
  });

  it("returns no regions when no city has one", () => {
    expect(getRegionOptions([orphan, city("other", null)])).toEqual([]);
  });

  it("adds a trailing 'Otras ciudades' option when some cities have no region", () => {
    expect(getRegionOptions([orphan, cordoba])).toEqual([
      cordobaRegion,
      { id: NO_REGION_ID, name: "Otras ciudades" },
    ]);
  });
});

describe("filterCitiesByRegion", () => {
  const cities = [cordoba, laPlata, orphan, marDelPlata];

  it("keeps only the cities of the given region", () => {
    expect(filterCitiesByRegion(cities, buenosAiresRegion.id)).toEqual([
      laPlata,
      marDelPlata,
    ]);
  });

  it("returns the cities without region for the 'Otras ciudades' option", () => {
    expect(filterCitiesByRegion(cities, NO_REGION_ID)).toEqual([orphan]);
  });
});

describe("getRegionIdForCity", () => {
  it("returns the region of the selected city", () => {
    expect(getRegionIdForCity([cordoba, laPlata], laPlata.id)).toBe(
      buenosAiresRegion.id,
    );
  });

  it("returns the 'Otras ciudades' option for a city without region in a country with regions", () => {
    expect(getRegionIdForCity([cordoba, orphan], orphan.id)).toBe(NO_REGION_ID);
  });

  it("returns an empty id when the country has no regions", () => {
    expect(getRegionIdForCity([orphan], orphan.id)).toBe("");
  });

  it("returns an empty id when the city is not in the list", () => {
    expect(getRegionIdForCity([cordoba], "missing")).toBe("");
  });
});
