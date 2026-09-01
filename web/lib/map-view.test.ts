import { describe, expect, it } from "vitest";
import { buildMapViewHref, parseMapView } from "./map-view";

describe("parseMapView", () => {
  it("defaults to tour when there is no view param", () => {
    expect(parseMapView(new URLSearchParams())).toBe("tour");
  });

  it("returns tour when view=tour", () => {
    expect(parseMapView(new URLSearchParams("view=tour"))).toBe("tour");
  });

  it("returns fans when view=fans", () => {
    expect(parseMapView(new URLSearchParams("view=fans"))).toBe("fans");
  });

  it("falls back to tour for an unknown view value", () => {
    expect(parseMapView(new URLSearchParams("view=banana"))).toBe("tour");
  });

  it("falls back to tour for a blank view value", () => {
    expect(parseMapView(new URLSearchParams("view="))).toBe("tour");
  });
});

describe("buildMapViewHref", () => {
  it("returns the bare pathname for the tour view when there are no other params", () => {
    expect(buildMapViewHref("/map", new URLSearchParams(), "tour")).toBe("/map");
  });

  it("adds view=fans for the fans view", () => {
    expect(buildMapViewHref("/map", new URLSearchParams(), "fans")).toBe(
      "/map?view=fans",
    );
  });

  it("drops the view param when switching to tour from an explicit view=fans", () => {
    expect(buildMapViewHref("/map", new URLSearchParams("view=fans"), "tour")).toBe(
      "/map",
    );
  });

  it("preserves search, year, countryId, cityId, dateFrom and dateTo when switching to fans", () => {
    const params = new URLSearchParams(
      "search=mexico&year=2025&countryId=country-mx&cityId=city-cdmx&dateFrom=2025-01-01&dateTo=2025-12-31",
    );

    const href = buildMapViewHref("/map", params, "fans");

    expect(href).toContain("view=fans");
    expect(href).toContain("search=mexico");
    expect(href).toContain("year=2025");
    expect(href).toContain("countryId=country-mx");
    expect(href).toContain("cityId=city-cdmx");
    expect(href).toContain("dateFrom=2025-01-01");
    expect(href).toContain("dateTo=2025-12-31");
  });

  it("preserves the same tour filters when switching back to tour from fans", () => {
    const params = new URLSearchParams("view=fans&search=mexico&year=2025");

    const href = buildMapViewHref("/map", params, "tour");

    expect(href).not.toContain("view=fans");
    expect(href).toContain("search=mexico");
    expect(href).toContain("year=2025");
  });

  it("does not mutate the given URLSearchParams", () => {
    const params = new URLSearchParams("search=mexico");
    buildMapViewHref("/map", params, "fans");

    expect(params.toString()).toBe("search=mexico");
  });
});
