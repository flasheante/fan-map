import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistFan, ArtistShow } from "@/lib/api";
import type { TheWarningMapData } from "@/lib/the-warning-fan-map";
import type { TheWarningTourMapData } from "@/lib/the-warning-tour-map";

const { getArtists, getTheWarningTourMapData, getTheWarningMapData } = vi.hoisted(
  () => ({
    getArtists: vi.fn(),
    getTheWarningTourMapData: vi.fn(),
    getTheWarningMapData: vi.fn(),
  }),
);

vi.mock("@/lib/api", () => ({ getArtists }));
vi.mock("@/lib/the-warning-tour-map", () => ({ getTheWarningTourMapData }));
vi.mock("@/lib/the-warning-fan-map", () => ({ getTheWarningMapData }));

// MapExplorer (Client Component) es donde vive todo lo que depende de la
// vista (toggle, TourExplorer, FanMapLoader — ver map-explorer.test.tsx para
// esa cobertura). Acá sólo interesa que la página server-side resuelve
// ambos datasets con un único GET /artists compartido y se los pasa tal
// cual.
vi.mock("@/components/map/map-explorer", () => ({
  MapExplorer: ({
    artist,
    shows,
    fans,
  }: {
    artist: Artist;
    shows: ArtistShow[];
    fans: ArtistFan[];
  }) => (
    <div data-testid="map-explorer">
      {artist.name} / {shows.length} shows / {fans.length} fans
    </div>
  ),
}));

const { default: MapPage } = await import("./page");

const artist: Artist = {
  id: "artist-1",
  name: "The Warning",
  slug: "the-warning",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const artists = [artist];

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

function makeFan(overrides: Partial<ArtistFan> = {}): ArtistFan {
  return {
    id: "fan-1",
    displayName: "Fan 1",
    showOnMap: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: "city-2",
      name: "Monterrey",
      latitude: 25.6866,
      longitude: -100.3161,
      country: { id: "country-mx", name: "Mexico", code: "MX" },
    },
    ...overrides,
  };
}

async function renderPage(
  tourData: TheWarningTourMapData,
  fanData: TheWarningMapData,
) {
  getArtists.mockResolvedValue(artists);
  getTheWarningTourMapData.mockResolvedValue(tourData);
  getTheWarningMapData.mockResolvedValue(fanData);
  render(await MapPage());
}

describe("MapPage", () => {
  beforeEach(() => {
    getArtists.mockReset();
    getTheWarningTourMapData.mockReset();
    getTheWarningMapData.mockReset();
  });

  it("shows an error message when GET /artists fails", async () => {
    getArtists.mockRejectedValue(new Error("network error"));
    render(await MapPage());

    expect(screen.getByText(/no se pudo cargar el mapa/i)).toBeInTheDocument();
    expect(screen.queryByTestId("map-explorer")).not.toBeInTheDocument();
  });

  it("shows an error message when the tour dataset fails to load", async () => {
    await renderPage({ status: "error" }, { status: "ok", artist, fans: [] });

    expect(screen.getByText(/no se pudo cargar el mapa/i)).toBeInTheDocument();
  });

  it("shows an error message when the fan dataset fails to load", async () => {
    await renderPage(
      { status: "ok", artist, cities: [], shows: [] },
      { status: "error" },
    );

    expect(screen.getByText(/no se pudo cargar el mapa/i)).toBeInTheDocument();
  });

  it("offers a way back to the artist page on error", async () => {
    getArtists.mockRejectedValue(new Error("network error"));
    render(await MapPage());

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("shows a not-found message when the artist is missing from either dataset", async () => {
    await renderPage(
      { status: "artist-not-found" },
      { status: "ok", artist, fans: [] },
    );

    expect(
      screen.getByText(/no se encontró el artista the warning/i),
    ).toBeInTheDocument();
  });

  it("resolves GET /artists once and shares it with both datasets", async () => {
    await renderPage(
      { status: "ok", artist, cities: [], shows: [] },
      { status: "ok", artist, fans: [] },
    );

    expect(getArtists).toHaveBeenCalledTimes(1);
    expect(getTheWarningTourMapData).toHaveBeenCalledWith(artists);
    expect(getTheWarningMapData).toHaveBeenCalledWith(artists);
  });

  it("renders MapExplorer with the resolved artist, shows and fans", async () => {
    const shows = [makeShow()];
    const fans = [makeFan(), makeFan({ id: "fan-2" })];

    await renderPage(
      { status: "ok", artist, cities: [], shows },
      { status: "ok", artist, fans },
    );

    expect(screen.getByTestId("map-explorer")).toHaveTextContent(
      "The Warning / 1 shows / 2 fans",
    );
  });
});
