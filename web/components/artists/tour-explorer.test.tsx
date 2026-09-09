import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Artist, ArtistShow, City } from "@/lib/api";
import type { TourCity } from "@/lib/the-warning-tour-map";

const { useRouter, usePathname, useSearchParams } = vi.hoisted(() => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter, usePathname, useSearchParams }));

// Mismo mock que tour/page.test.tsx y tour-city-history.test.tsx: TourMapLoader
// carga Leaflet vía next/dynamic (ssr: false), así que acá sólo se verifica
// qué TourCity[] recibe, no el mapa en sí.
vi.mock("@/components/artists/tour-map-loader", () => ({
  TourMapLoader: ({ cities }: { cities: TourCity[] }) => (
    <div data-testid="tour-map-loader">
      {cities.map((city) => `${city.name} (${city.shows.length})`).join(", ")}
    </div>
  ),
}));

const { TourExplorer } = await import("./tour-explorer");

const PATHNAME = "/artists/the-warning/tour";

const artist: Artist = {
  id: "artist-1",
  name: "The Warning",
  slug: "the-warning",
  imageUrl: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  setlistsSyncedAt: "2026-09-07T02:00:00.000Z",
};

const argentina = { id: "country-ar", name: "Argentina", code: "AR" };
const mexico = { id: "country-mx", name: "México", code: "MX" };

const mendoza: City = {
  id: "city-mendoza",
  name: "Mendoza",
  latitude: -32.8895,
  longitude: -68.8458,
  country: argentina,
};

const monterrey: City = {
  id: "city-mty",
  name: "Monterrey",
  latitude: 25.6866,
  longitude: -100.3161,
  country: mexico,
};

function makeShow(overrides: Partial<ArtistShow> = {}): ArtistShow {
  return {
    id: "show-1",
    date: "2024-03-15T00:00:00.000Z",
    venue: "Pepsi Center",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: mendoza,
    ...overrides,
  };
}

const twoCityShows = [
  makeShow({ id: "show-mza-2023", date: "2023-05-01T00:00:00.000Z", city: mendoza }),
  makeShow({ id: "show-mty-2024", date: "2024-06-01T00:00:00.000Z", city: monterrey, venue: "Arena Monterrey" }),
];

function setup(search = "") {
  const replace = vi.fn();
  useRouter.mockReturnValue({ replace, push: vi.fn() });
  usePathname.mockReturnValue(PATHNAME);
  useSearchParams.mockReturnValue(new URLSearchParams(search));
  return { replace };
}

describe("TourExplorer", () => {
  beforeEach(() => {
    useRouter.mockReset();
    usePathname.mockReset();
    useSearchParams.mockReset();
  });

  it("renders the Tour Map heading and the filters panel", () => {
    setup();
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(
      screen.getByRole("heading", { name: /tour map/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/año/i)).toBeInTheDocument();
  });

  // Pedido: "Actualizado" con fecha y hora de la última corrida del sync,
  // debajo del mapa y alineado a la derecha.
  it("shows when the setlist.fm sync was last updated", () => {
    setup();
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByText(/actualizado/i)).toBeInTheDocument();
  });

  it("right-aligns the 'Actualizado' message", () => {
    setup();
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByText(/actualizado/i)).toHaveClass("text-right");
  });

  it("shows nothing when the artist has never synced yet", () => {
    setup();
    render(
      <TourExplorer
        artist={{ ...artist, setlistsSyncedAt: null }}
        shows={twoCityShows}
      />,
    );

    expect(screen.queryByText(/actualizado/i)).not.toBeInTheDocument();
  });

  it("shows the total city count when no filters are applied", () => {
    setup();
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByText(/2 ciudades/i)).toBeInTheDocument();
    expect(screen.queryByText(/de 2 shows/i)).not.toBeInTheDocument();
  });

  it("shows every show on the map and in the list when there are no filters", () => {
    setup();
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent("Mendoza (1)");
    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent("Monterrey (1)");
    expect(screen.getByText(/pepsi center/i)).toBeInTheDocument();
    expect(screen.getByText(/arena monterrey/i)).toBeInTheDocument();
  });

  it("filters the map, stats and list to shows matching the year query param", () => {
    setup("year=2024");
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    // Sólo queda el show de Monterrey (2024): el mapa no debe mostrar Mendoza.
    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent("Monterrey (1)");
    expect(screen.getByTestId("tour-map-loader")).not.toHaveTextContent("Mendoza");
    expect(screen.queryByText(/pepsi center/i)).not.toBeInTheDocument();
    expect(screen.getByText(/arena monterrey/i)).toBeInTheDocument();
  });

  it("shows the filtered-vs-total count when a filter narrows the results", () => {
    setup("year=2024");
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByText(/1 ciudad(?!es)/i)).toBeInTheDocument();
    expect(screen.getByText(/1 de 2 shows/i)).toBeInTheDocument();
  });

  it("combines a text search with a structured filter", () => {
    setup("search=arena&countryId=country-mx");
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent("Monterrey (1)");
    expect(screen.getByTestId("tour-map-loader")).not.toHaveTextContent("Mendoza");
  });

  it("reflects the query params in the filters panel controls", () => {
    setup("year=2024&countryId=country-mx");
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByLabelText(/año/i)).toHaveValue("2024");
    expect(screen.getByLabelText(/país/i)).toHaveValue("country-mx");
  });

  it("shows the original empty state when the artist has no shows at all", () => {
    setup();
    render(<TourExplorer artist={artist} shows={[]} />);

    expect(
      screen.getByText(/todavía no hay ciudades con shows de the warning/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/coincide con estos filtros/i),
    ).not.toBeInTheDocument();
  });

  it("shows a no-results state (not the generic empty state) when filters exclude every show", () => {
    setup("countryId=country-xx");
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByText(/coincide con estos filtros/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/todavía no hay ciudades con shows de the warning/i),
    ).not.toBeInTheDocument();
    // El mapa no debe seguir mostrando markers viejos.
    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent("");
  });

  it("clears every filter from the no-results state", () => {
    const { replace } = setup("countryId=country-xx");
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    fireEvent.click(screen.getAllByRole("button", { name: /limpiar filtros/i })[0]);

    expect(replace).toHaveBeenCalledWith(PATHNAME, { scroll: false });
  });

  it("calls router.replace (never router.push) with the new query string when a filter changes", () => {
    const { replace } = setup();
    render(<TourExplorer artist={artist} shows={twoCityShows} />);

    fireEvent.change(screen.getByLabelText(/año/i), { target: { value: "2024" } });

    expect(replace).toHaveBeenCalledWith(`${PATHNAME}?year=2024`, { scroll: false });
  });

  it("replaces to the bare pathname (no trailing '?') when the last filter is cleared", () => {
    // El campo de búsqueda debouncea antes de propagar a la URL (ver
    // tour-filters.tsx), así que hay que avanzar los timers para que el
    // router.replace llegue a dispararse.
    vi.useFakeTimers();
    try {
      const { replace } = setup("search=monterrey");
      render(<TourExplorer artist={artist} shows={twoCityShows} />);

      fireEvent.change(screen.getByLabelText(/buscar/i), { target: { value: "" } });
      vi.runAllTimers();

      expect(replace).toHaveBeenCalledWith(PATHNAME, { scroll: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("updates its output when the search params change externally (back/forward navigation)", () => {
    setup("year=2024");
    const { rerender } = render(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByTestId("tour-map-loader")).not.toHaveTextContent("Mendoza");

    useSearchParams.mockReturnValue(new URLSearchParams(""));
    rerender(<TourExplorer artist={artist} shows={twoCityShows} />);

    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent("Mendoza (1)");
    expect(screen.getByTestId("tour-map-loader")).toHaveTextContent("Monterrey (1)");
  });
});
