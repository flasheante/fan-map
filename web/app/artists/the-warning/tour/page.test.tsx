import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistShow } from "@/lib/api";
import type {
  TheWarningTourMapData,
  TourCity,
} from "@/lib/the-warning-tour-map";
import type { TourStats as TourStatsData } from "@/lib/the-warning-tour-stats";

const { getTheWarningTourMapData } = vi.hoisted(() => ({
  getTheWarningTourMapData: vi.fn(),
}));

const { getArtistShows } = vi.hoisted(() => ({
  getArtistShows: vi.fn(),
}));

vi.mock("@/lib/the-warning-tour-map", () => ({ getTheWarningTourMapData }));

// Guarda de regresión: la página no debe llamar a getArtistShows por su
// cuenta, sino reutilizar el array `shows` que ya devuelve
// getTheWarningTourMapData (ver the-warning-tour-map.ts) para calcular las
// estadísticas vía calculateTourStats, sin un segundo GET
// /artists/:artistId/shows.
vi.mock("@/lib/api", () => ({ getArtistShows }));

vi.mock("@/components/artists/tour-map-loader", () => ({
  TourMapLoader: ({ cities }: { cities: TourCity[] }) => (
    <div data-testid="tour-map-loader">{cities.length} cities on map</div>
  ),
}));

// No se mockea calculateTourStats: dejarlo real permite que estos tests
// verifiquen que las estadísticas mostradas surgen del mismo array `shows`
// que devuelve getTheWarningTourMapData (ver the-warning-tour-stats.test.ts
// para la cobertura del cálculo en sí).
vi.mock("@/components/artists/tour-stats", () => ({
  TourStats: ({ stats }: { stats: TourStatsData }) => (
    <div data-testid="tour-stats">
      {stats.totalShows} shows / {stats.totalCities} cities /{" "}
      {stats.totalCountries} countries
    </div>
  ),
}));

const { default: TourMapPage } = await import("./page");

const artist: Artist = {
  id: "artist-1",
  name: "The Warning",
  slug: "the-warning",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function makeCity(overrides: Partial<TourCity> = {}): TourCity {
  return {
    id: "city-1",
    name: "Mendoza",
    latitude: -32.8895,
    longitude: -68.8458,
    country: { name: "Argentina", code: "AR" },
    shows: [],
    ...overrides,
  };
}

function makeShow(overrides: Partial<ArtistShow> = {}): ArtistShow {
  return {
    id: "show-1",
    date: "2024-03-15T00:00:00.000Z",
    venue: "Demo Venue",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: "city-1",
      name: "Mendoza",
      latitude: -32.8895,
      longitude: -68.8458,
      country: { id: "country-ar", name: "Argentina", code: "AR" },
    },
    ...overrides,
  };
}

async function renderPage(data: TheWarningTourMapData) {
  getTheWarningTourMapData.mockResolvedValue(data);
  render(await TourMapPage());
}

describe("TourMapPage", () => {
  beforeEach(() => {
    getTheWarningTourMapData.mockReset();
    getArtistShows.mockReset();
  });

  it("delegates data loading to getTheWarningTourMapData", async () => {
    await renderPage({ status: "ok", artist, cities: [], shows: [] });

    expect(getTheWarningTourMapData).toHaveBeenCalledTimes(1);
  });

  it("shows an error message when the data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(
      screen.getByText(/no pudimos cargar el tour map/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tour-map-loader")).not.toBeInTheDocument();
  });

  it("does not render the stats summary when the data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(screen.queryByTestId("tour-stats")).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page when the data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("shows a not-found message when The Warning is not in the artists list", async () => {
    await renderPage({ status: "artist-not-found" });

    expect(screen.getByText(/no se encontró el artista/i)).toBeInTheDocument();
    expect(screen.queryByTestId("tour-map-loader")).not.toBeInTheDocument();
  });

  it("does not render the stats summary when The Warning is not found", async () => {
    await renderPage({ status: "artist-not-found" });

    expect(screen.queryByTestId("tour-stats")).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page when The Warning is not found", async () => {
    await renderPage({ status: "artist-not-found" });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("shows the Tour Map heading identifying The Warning", async () => {
    await renderPage({ status: "ok", artist, cities: [], shows: [] });

    expect(
      screen.getByRole("heading", { name: /the warning.*tour map/i }),
    ).toBeInTheDocument();
  });

  it("shows a friendly empty state when the artist has no shows/cities", async () => {
    await renderPage({ status: "ok", artist, cities: [], shows: [] });

    expect(screen.getByText(/0 ciudades/i)).toBeInTheDocument();
    expect(screen.getByTestId("tour-map-loader")).toBeInTheDocument();
    expect(
      screen.getByText(/todavía no hay ciudades/i),
    ).toBeInTheDocument();
  });

  it("shows the city count and the map when there are cities", async () => {
    const cities = [
      makeCity({ id: "city-1", name: "Mendoza" }),
      makeCity({ id: "city-2", name: "Buenos Aires" }),
    ];
    await renderPage({ status: "ok", artist, cities, shows: [] });

    expect(screen.getByText(/2 ciudades/i)).toBeInTheDocument();
    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent(
      "2 cities on map",
    );
  });

  it("renders the tour breadcrumbs on success, linking back to the artist page", async () => {
    await renderPage({ status: "ok", artist, cities: [], shows: [] });

    expect(
      screen.getByRole("navigation", { name: /breadcrumb/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "The Warning" }),
    ).toHaveAttribute("href", "/artists/the-warning");
    expect(screen.getByText("Historial de shows")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders the tour stats summary computed from the shows returned by getTheWarningTourMapData", async () => {
    const shows = [
      makeShow({
        id: "show-1",
        city: {
          id: "city-mendoza",
          name: "Mendoza",
          latitude: -32.8895,
          longitude: -68.8458,
          country: { id: "country-ar", name: "Argentina", code: "AR" },
        },
      }),
      makeShow({
        id: "show-2",
        city: {
          id: "city-ba",
          name: "Buenos Aires",
          latitude: -34.6037,
          longitude: -58.3816,
          country: { id: "country-ar", name: "Argentina", code: "AR" },
        },
      }),
    ];

    await renderPage({ status: "ok", artist, cities: [], shows });

    expect(screen.getByTestId("tour-stats")).toHaveTextContent(
      "2 shows / 2 cities / 1 countries",
    );
  });

  it("does not make a second getArtistShows call to compute the stats", async () => {
    const shows = [makeShow({ id: "show-1" }), makeShow({ id: "show-2" })];

    await renderPage({ status: "ok", artist, cities: [], shows });

    expect(getArtistShows).not.toHaveBeenCalled();
  });

  it("keeps the Tour Map working alongside the stats summary", async () => {
    const cities = [
      makeCity({ id: "city-1", name: "Mendoza" }),
      makeCity({ id: "city-2", name: "Buenos Aires" }),
    ];
    const shows = [makeShow({ id: "show-1" }), makeShow({ id: "show-2" })];

    await renderPage({ status: "ok", artist, cities, shows });

    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent(
      "2 cities on map",
    );
    expect(screen.getByTestId("tour-stats")).toBeInTheDocument();
  });
});
