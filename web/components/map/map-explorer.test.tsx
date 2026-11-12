import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Artist, ArtistFan } from "@/lib/api";

// Aísla MapExplorer de FanMapLoader (ver fan-map.test.tsx): acá sólo
// interesa qué le pasa MapExplorer al mapa.
vi.mock("@/components/map/fan-map-loader", () => ({
  FanMapLoader: ({ fans }: { fans: ArtistFan[] }) => (
    <div data-testid="fan-map-loader">{fans.length} fans on map</div>
  ),
}));

// El ranking (ver favorite-songs-ranking.test.tsx) tiene su propia
// cobertura completa; acá sólo interesa que se monte.
vi.mock("@/components/map/favorite-songs-ranking", () => ({
  FavoriteSongsRanking: () => <div data-testid="favorite-songs-ranking" />,
}));

const { MapExplorer } = await import("./map-explorer");

const artist: Artist = {
  id: "artist-1",
  name: "The Warning",
  slug: "the-warning",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  setlistsSyncedAt: null,
};

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

describe("MapExplorer", () => {
  it("renders the fan map with the loaded fans", () => {
    render(<MapExplorer artist={artist} fans={fans} />);

    expect(screen.getByTestId("fan-map-loader")).toHaveTextContent("2 fans on map");
  });

  it("shows the fan count header", () => {
    render(<MapExplorer artist={artist} fans={fans} />);

    expect(screen.getByText(/2 fans en el mapa/i)).toBeInTheDocument();
  });

  it("shows a singular fan count when there is exactly one fan", () => {
    render(<MapExplorer artist={artist} fans={[makeFan("fan-1")]} />);

    expect(screen.getByText(/1 fan en el mapa/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no fans", () => {
    render(<MapExplorer artist={artist} fans={[]} />);

    expect(
      screen.getByText(/todavía no hay fans de the warning en el mapa/i),
    ).toBeInTheDocument();
  });

  it("shows the favorite songs ranking", () => {
    render(<MapExplorer artist={artist} fans={fans} />);

    expect(screen.getByTestId("favorite-songs-ranking")).toBeInTheDocument();
  });

  // La navegación (Historial / Fan Map / Perfil) vive sólo en el header del
  // sitio: acá ya no hay selector de vista ni link de "Volver".
  it("does not render its own view toggle or back link", () => {
    render(<MapExplorer artist={artist} fans={fans} />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  // Responsive básico: el header (logo + branding + contador) debe apilar en
  // pantallas angostas en vez de desbordar.
  it("wraps the header instead of overflowing on narrow screens", () => {
    render(<MapExplorer artist={artist} fans={fans} />);

    expect(screen.getByRole("heading", { level: 1 }).closest("header")).toHaveClass(
      "flex-wrap",
    );
  });
});
