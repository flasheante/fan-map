import { describe, expect, it } from "vitest";
import {
  parseTourFiltersFromSearchParams,
  tourFiltersToQueryString,
} from "./tour-filters-url";
import type { TourFilters } from "./tour-filters";

describe("parseTourFiltersFromSearchParams", () => {
  it("returns an empty filters object for empty search params", () => {
    expect(parseTourFiltersFromSearchParams(new URLSearchParams(""))).toEqual({});
  });

  it("parses search", () => {
    const params = new URLSearchParams("search=monterrey");
    expect(parseTourFiltersFromSearchParams(params)).toEqual({ search: "monterrey" });
  });

  it("url-decodes search (spaces, accents)", () => {
    const params = new URLSearchParams("search=ciudad+de+m%C3%A9xico");
    expect(parseTourFiltersFromSearchParams(params)).toEqual({
      search: "ciudad de méxico",
    });
  });

  it("omits search when it is an empty or blank string", () => {
    expect(parseTourFiltersFromSearchParams(new URLSearchParams("search="))).toEqual({});
    expect(
      parseTourFiltersFromSearchParams(new URLSearchParams("search=%20%20")),
    ).toEqual({});
  });

  it("parses a valid year", () => {
    expect(parseTourFiltersFromSearchParams(new URLSearchParams("year=2025"))).toEqual({
      year: 2025,
    });
  });

  it("ignores a non-numeric year", () => {
    expect(parseTourFiltersFromSearchParams(new URLSearchParams("year=abc"))).toEqual({});
  });

  it("ignores a non-integer year", () => {
    expect(parseTourFiltersFromSearchParams(new URLSearchParams("year=2025.5"))).toEqual({});
  });

  it("parses countryId and cityId as-is", () => {
    const params = new URLSearchParams("countryId=country-mx&cityId=city-mty");
    expect(parseTourFiltersFromSearchParams(params)).toEqual({
      countryId: "country-mx",
      cityId: "city-mty",
    });
  });

  it("parses dateFrom and dateTo as-is", () => {
    const params = new URLSearchParams("dateFrom=2024-01-01&dateTo=2025-12-31");
    expect(parseTourFiltersFromSearchParams(params)).toEqual({
      dateFrom: "2024-01-01",
      dateTo: "2025-12-31",
    });
  });

  it("parses every field combined", () => {
    const params = new URLSearchParams(
      "search=mexico&year=2025&countryId=country-mx&cityId=city-mty&dateFrom=2024-01-01&dateTo=2025-12-31",
    );

    expect(parseTourFiltersFromSearchParams(params)).toEqual({
      search: "mexico",
      year: 2025,
      countryId: "country-mx",
      cityId: "city-mty",
      dateFrom: "2024-01-01",
      dateTo: "2025-12-31",
    });
  });

  it("ignores unknown query params", () => {
    const params = new URLSearchParams("search=mexico&utm_source=newsletter");
    expect(parseTourFiltersFromSearchParams(params)).toEqual({ search: "mexico" });
  });
});

describe("tourFiltersToQueryString", () => {
  it("returns an empty string for empty filters", () => {
    expect(tourFiltersToQueryString({})).toBe("");
  });

  it("does not serialize a blank search", () => {
    expect(tourFiltersToQueryString({ search: "" })).toBe("");
    expect(tourFiltersToQueryString({ search: "   " })).toBe("");
  });

  it("serializes a single field", () => {
    expect(tourFiltersToQueryString({ search: "mexico" })).toBe("search=mexico");
    expect(tourFiltersToQueryString({ year: 2025 })).toBe("year=2025");
  });

  it("serializes every field in a stable, readable order", () => {
    const filters: TourFilters = {
      dateTo: "2025-12-31",
      dateFrom: "2024-01-01",
      cityId: "city-mty",
      countryId: "country-mx",
      year: 2025,
      search: "mexico",
    };

    expect(tourFiltersToQueryString(filters)).toBe(
      "search=mexico&year=2025&countryId=country-mx&cityId=city-mty&dateFrom=2024-01-01&dateTo=2025-12-31",
    );
  });

  it("url-encodes special characters", () => {
    expect(tourFiltersToQueryString({ search: "ciudad de méxico" })).toBe(
      "search=ciudad+de+m%C3%A9xico",
    );
  });

  it("round-trips through parseTourFiltersFromSearchParams", () => {
    const filters: TourFilters = {
      search: "méxico",
      year: 2024,
      countryId: "country-mx",
      cityId: "city-mty",
      dateFrom: "2024-01-01",
      dateTo: "2025-12-31",
    };

    const roundTripped = parseTourFiltersFromSearchParams(
      new URLSearchParams(tourFiltersToQueryString(filters)),
    );

    expect(roundTripped).toEqual(filters);
  });
});
