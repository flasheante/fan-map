import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistShow } from "@/lib/api";
import type { TheWarningTourMapData } from "@/lib/the-warning-tour-map";

const { getTheWarningTourMapData } = vi.hoisted(() => ({
  getTheWarningTourMapData: vi.fn(),
}));

vi.mock("@/lib/the-warning-tour-map", () => ({ getTheWarningTourMapData }));

// TourExplorer (Client Component) es donde vive todo lo que depende de
// filtros/búsqueda: header, panel de filtros, stats, mapa y lista (ver
// tour-explorer.test.tsx para esa cobertura). Acá sólo interesa que la
// página server-side delega la carga de datos y le pasa artist/shows tal
// cual, sin volver a tocarlos.
vi.mock("@/components/artists/tour-explorer", () => ({
  TourExplorer: ({ artist, shows }: { artist: Artist; shows: ArtistShow[] }) => (
    <div data-testid="tour-explorer">
      {artist.name} / {shows.length} shows
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
  setlistsSyncedAt: null,
};

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
    expect(screen.queryByTestId("tour-explorer")).not.toBeInTheDocument();
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
    expect(screen.queryByTestId("tour-explorer")).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page when The Warning is not found", async () => {
    await renderPage({ status: "artist-not-found" });

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
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

  it("passes the artist and the full, unfiltered shows list to TourExplorer", async () => {
    const shows = [makeShow({ id: "show-1" }), makeShow({ id: "show-2" })];

    await renderPage({ status: "ok", artist, cities: [], shows });

    expect(screen.getByTestId("tour-explorer")).toHaveTextContent(
      "The Warning / 2 shows",
    );
  });

  it("renders TourExplorer after the breadcrumbs", async () => {
    await renderPage({ status: "ok", artist, cities: [], shows: [] });

    const breadcrumb = screen.getByRole("navigation", { name: /breadcrumb/i });
    const explorer = screen.getByTestId("tour-explorer");

    expect(
      breadcrumb.compareDocumentPosition(explorer) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
