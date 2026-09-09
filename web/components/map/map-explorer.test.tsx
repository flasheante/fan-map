import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistFan, ArtistShow } from "@/lib/api";

const { usePathname, useSearchParams } = vi.hoisted(() => ({
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname, useSearchParams }));

// Aísla MapExplorer de TourExplorer (ver tour-explorer.test.tsx para esa
// cobertura) y de FanMapLoader (ver fan-map.test.tsx): acá sólo interesa
// qué vista se monta y qué le pasa MapExplorer a cada una.
vi.mock("@/components/artists/tour-explorer", () => ({
  TourExplorer: ({ artist, shows }: { artist: Artist; shows: ArtistShow[] }) => (
    <div data-testid="tour-explorer">
      {artist.name} / {shows.length} shows
    </div>
  ),
}));

vi.mock("@/components/map/fan-map-loader", () => ({
  FanMapLoader: ({ fans }: { fans: ArtistFan[] }) => (
    <div data-testid="fan-map-loader">{fans.length} fans on map</div>
  ),
}));

// El ranking (ver favorite-songs-ranking.test.tsx) tiene su propia
// cobertura completa; acá sólo interesa que se monte en la vista de fans.
vi.mock("@/components/map/favorite-songs-ranking", () => ({
  FavoriteSongsRanking: () => <div data-testid="favorite-songs-ranking" />,
}));

const { MapExplorer } = await import("./map-explorer");

const PATHNAME = "/map";

const artist: Artist = {
  id: "artist-1",
  name: "The Warning",
  slug: "the-warning",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  setlistsSyncedAt: null,
};

const shows: ArtistShow[] = [
  {
    id: "show-1",
    date: "2024-03-15T00:00:00.000Z",
    venue: "Pepsi Center",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: "city-1",
      name: "Mendoza",
      latitude: -32.8895,
      longitude: -68.8458,
      country: { id: "country-ar", name: "Argentina", code: "AR" },
    },
  },
];

function makeFan(id: string): ArtistFan {
  return {
    id,
    displayName: `Fan ${id}`,
    showOnMap: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: "city-1",
      name: "Monterrey",
      latitude: 25.6866,
      longitude: -100.3161,
      country: { id: "country-mx", name: "Mexico", code: "MX" },
    },
  };
}

const fans = [makeFan("fan-1"), makeFan("fan-2")];

function setup(search: string) {
  usePathname.mockReturnValue(PATHNAME);
  useSearchParams.mockReturnValue(new URLSearchParams(search));
}

describe("MapExplorer", () => {
  it("renders the tour view by default (no view param)", () => {
    setup("");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(screen.getByTestId("tour-explorer")).toHaveTextContent(
      "The Warning / 1 shows",
    );
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
  });

  it("renders the tour view for an explicit view=tour", () => {
    setup("view=tour");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(screen.getByTestId("tour-explorer")).toBeInTheDocument();
  });

  it("renders the fans view for view=fans", () => {
    setup("view=fans");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(screen.getByTestId("fan-map-loader")).toHaveTextContent(
      "2 fans on map",
    );
    expect(screen.queryByTestId("tour-explorer")).not.toBeInTheDocument();
  });

  it("falls back to the tour view for an unknown view value", () => {
    setup("view=banana");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(screen.getByTestId("tour-explorer")).toBeInTheDocument();
    expect(screen.queryByTestId("fan-map-loader")).not.toBeInTheDocument();
  });

  it("shows the fan count header on the fans view", () => {
    setup("view=fans");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(screen.getByText(/2 fans en el mapa/i)).toBeInTheDocument();
  });

  it("shows a singular fan count when there is exactly one fan", () => {
    setup("view=fans");
    render(<MapExplorer artist={artist} shows={shows} fans={[makeFan("fan-1")]} />);

    expect(screen.getByText(/1 fan en el mapa/i)).toBeInTheDocument();
  });

  it("shows an empty state on the fans view when there are no fans", () => {
    setup("view=fans");
    render(<MapExplorer artist={artist} shows={shows} fans={[]} />);

    expect(
      screen.getByText(/todavía no hay fans de the warning en el mapa/i),
    ).toBeInTheDocument();
  });

  it("renders a toggle with links to both views, preserving tour filters in both hrefs", () => {
    setup("view=fans&search=mexico&year=2025");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    const tourLink = screen.getByRole("link", { name: /historial/i });
    const fansLink = screen.getByRole("link", { name: /fan map/i });

    expect(tourLink.getAttribute("href")).not.toContain("view=fans");
    expect(tourLink.getAttribute("href")).toContain("search=mexico");
    expect(tourLink.getAttribute("href")).toContain("year=2025");

    expect(fansLink.getAttribute("href")).toContain("view=fans");
    expect(fansLink.getAttribute("href")).toContain("search=mexico");
    expect(fansLink.getAttribute("href")).toContain("year=2025");
  });

  it("marks the active view on the toggle", () => {
    setup("view=fans");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(screen.getByRole("link", { name: /fan map/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("shows the favorite songs ranking on the fans view", () => {
    setup("view=fans");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(screen.getByTestId("favorite-songs-ranking")).toBeInTheDocument();
  });

  it("does not show the favorite songs ranking on the tour view", () => {
    setup("view=tour");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(screen.queryByTestId("favorite-songs-ranking")).not.toBeInTheDocument();
  });

  it("offers a way back to the artist page", () => {
    setup("");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(
      screen.getByRole("link", { name: /volver a the warning/i }),
    ).toHaveAttribute("href", "/artists/the-warning");
  });

  // Responsive básico: el header de la vista Fan Map (logo + branding +
  // contador) debe apilar en pantallas angostas en vez de desbordar, mismo
  // criterio que el toggle (ver map-view-toggle.test.tsx).
  it("wraps the fans view header instead of overflowing on narrow screens", () => {
    setup("view=fans");
    render(<MapExplorer artist={artist} shows={shows} fans={fans} />);

    expect(screen.getByRole("heading", { level: 1 }).closest("header")).toHaveClass(
      "flex-wrap",
    );
  });
});
