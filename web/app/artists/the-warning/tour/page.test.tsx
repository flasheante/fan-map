import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist } from "@/lib/api";
import type {
  TheWarningTourMapData,
  TourCity,
} from "@/lib/the-warning-tour-map";

const { getTheWarningTourMapData } = vi.hoisted(() => ({
  getTheWarningTourMapData: vi.fn(),
}));

vi.mock("@/lib/the-warning-tour-map", () => ({ getTheWarningTourMapData }));

vi.mock("@/components/artists/tour-map-loader", () => ({
  TourMapLoader: ({ cities }: { cities: TourCity[] }) => (
    <div data-testid="tour-map-loader">{cities.length} cities on map</div>
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

async function renderPage(data: TheWarningTourMapData) {
  getTheWarningTourMapData.mockResolvedValue(data);
  render(await TourMapPage());
}

describe("TourMapPage", () => {
  beforeEach(() => {
    getTheWarningTourMapData.mockReset();
  });

  it("delegates data loading to getTheWarningTourMapData", async () => {
    await renderPage({ status: "ok", artist, cities: [] });

    expect(getTheWarningTourMapData).toHaveBeenCalledTimes(1);
  });

  it("shows an error message when the data could not be loaded", async () => {
    await renderPage({ status: "error" });

    expect(
      screen.getByText(/no pudimos cargar el tour map/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tour-map-loader")).not.toBeInTheDocument();
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

  it("offers a way back to the artist page when The Warning is not found", async () => {
    await renderPage({ status: "artist-not-found" });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  it("shows the Tour Map heading identifying The Warning", async () => {
    await renderPage({ status: "ok", artist, cities: [] });

    expect(
      screen.getByRole("heading", { name: /the warning.*tour map/i }),
    ).toBeInTheDocument();
  });

  it("shows a friendly empty state when the artist has no shows/cities", async () => {
    await renderPage({ status: "ok", artist, cities: [] });

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
    await renderPage({ status: "ok", artist, cities });

    expect(screen.getByText(/2 ciudades/i)).toBeInTheDocument();
    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent(
      "2 cities on map",
    );
  });

  it("offers a way back to the artist page on success", async () => {
    await renderPage({ status: "ok", artist, cities: [] });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });
});
