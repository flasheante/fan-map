import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistShow } from "@/lib/api";
import type { TourCityInfo } from "@/lib/the-warning-tour-city";
import type { TheWarningTourCityData } from "@/lib/the-warning-tour-city";

// Se mockea @/lib/the-warning-tour-city (mismo patrón que
// shows/[showId]/page.test.tsx con @/lib/the-warning-show), no @/lib/api
// directamente: la resolución del artista por slug, el GET
// /artists/:artistId/shows y el filtrado por cityId ya están cubiertos en
// the-warning-tour-city.test.ts. Esta página solo debe delegar en ella (con
// el cityId de la URL) y renderizar lo que devuelve.
const { getTheWarningTourCityData } = vi.hoisted(() => ({
  getTheWarningTourCityData: vi.fn(),
}));

vi.mock("@/lib/the-warning-tour-city", () => ({ getTheWarningTourCityData }));

vi.mock("@/components/artists/tour-city-history", () => ({
  TourCityHistory: ({
    artist,
    city,
    shows,
  }: {
    artist: Artist;
    city: TourCityInfo;
    shows: ArtistShow[];
  }) => (
    <div data-testid="tour-city-history">
      {artist.name} — {city.name} — {shows.length} shows
    </div>
  ),
}));

const { default: TheWarningTourCityPage } = await import("./page");

function makeArtist(overrides: Partial<Artist> = {}): Artist {
  return {
    id: "artist-1",
    name: "The Warning",
    slug: "the-warning",
    imageUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeCity(overrides: Partial<TourCityInfo> = {}): TourCityInfo {
  return {
    id: "city-1",
    name: "Mendoza",
    country: { name: "Argentina", code: "AR" },
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

async function renderPage(cityId: string, data: TheWarningTourCityData) {
  getTheWarningTourCityData.mockResolvedValue(data);
  render(await TheWarningTourCityPage({ params: Promise.resolve({ cityId }) }));
}

describe("TheWarningTourCityPage", () => {
  beforeEach(() => {
    getTheWarningTourCityData.mockReset();
  });

  it("resolves the city data using the cityId from the URL", async () => {
    await renderPage("city-1", {
      status: "ok",
      artist: makeArtist(),
      city: makeCity(),
      shows: [makeShow()],
    });

    expect(getTheWarningTourCityData).toHaveBeenCalledWith("city-1");
  });

  it("shows an error message when the data could not be loaded", async () => {
    await renderPage("city-1", { status: "error" });

    expect(
      screen.getByText(/no pudimos cargar el historial/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tour-city-history")).not.toBeInTheDocument();
  });

  it("offers a way back to the Tour Map when the data could not be loaded", async () => {
    await renderPage("city-1", { status: "error" });

    expect(
      screen.getByRole("link", { name: /volver al tour map/i }),
    ).toHaveAttribute("href", "/artists/the-warning/tour");
  });

  it("shows a not-found state when The Warning doesn't exist", async () => {
    await renderPage("city-1", { status: "artist-not-found" });

    expect(screen.getByText(/no se encontró el artista/i)).toBeInTheDocument();
    expect(screen.queryByTestId("tour-city-history")).not.toBeInTheDocument();
  });

  it("offers a way back to the Tour Map when The Warning is not found", async () => {
    await renderPage("city-1", { status: "artist-not-found" });

    expect(
      screen.getByRole("link", { name: /volver al tour map/i }),
    ).toHaveAttribute("href", "/artists/the-warning/tour");
  });

  it("shows a friendly not-found state when the city doesn't exist", async () => {
    await renderPage("missing-city", { status: "city-not-found" });

    expect(screen.getByText(/no se encontró la ciudad/i)).toBeInTheDocument();
    expect(screen.queryByTestId("tour-city-history")).not.toBeInTheDocument();
  });

  it("offers a way back to the Tour Map when the city doesn't exist", async () => {
    await renderPage("missing-city", { status: "city-not-found" });

    expect(
      screen.getByRole("link", { name: /volver al tour map/i }),
    ).toHaveAttribute("href", "/artists/the-warning/tour");
  });

  it("renders the city history on success", async () => {
    const artist = makeArtist();
    const city = makeCity();
    const shows = [makeShow({ id: "show-1" }), makeShow({ id: "show-2" })];

    await renderPage(city.id, { status: "ok", artist, city, shows });

    expect(screen.getByTestId("tour-city-history")).toHaveTextContent(
      "The Warning — Mendoza — 2 shows",
    );
  });

  // TourCityHistory es quien arma el breadcrumb The Warning / Historial de
  // shows / <ciudad> (ver tour-city-history.test.tsx para su cobertura);
  // esta page test sólo verifica que le llega el artist y la ciudad
  // resueltos por getTheWarningTourCityData, sin requests adicionales.
  it("passes the artist and city to TourCityHistory so it can build the breadcrumb", async () => {
    const artist = makeArtist({ name: "The Warning" });
    const city = makeCity({ name: "Buenos Aires" });

    await renderPage(city.id, {
      status: "ok",
      artist,
      city,
      shows: [makeShow()],
    });

    expect(screen.getByTestId("tour-city-history")).toHaveTextContent(
      "The Warning — Buenos Aires",
    );
    expect(getTheWarningTourCityData).toHaveBeenCalledTimes(1);
  });
});
