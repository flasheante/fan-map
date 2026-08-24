import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TourCity } from "@/lib/the-warning-tour-map";

const mockMap = { setView: vi.fn(), fitBounds: vi.fn() };

// Mismo mock que fan-map.test.tsx: react-leaflet y leaflet acceden a
// `window` al importarse, así que se reemplazan por versiones simples que
// sólo exponen lo que el componente necesita para poder testearlo en jsdom.
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: ({
    children,
    position,
  }: {
    children: React.ReactNode;
    position: [number, number];
  }) => (
    <div data-testid="marker" data-position={JSON.stringify(position)}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popup">{children}</div>
  ),
  useMap: () => mockMap,
}));

vi.mock("leaflet", () => ({
  default: {
    Icon: {
      Default: {
        prototype: {},
        mergeOptions: vi.fn(),
      },
    },
  },
}));

const { TourMap } = await import("./tour-map");

const MENDOZA_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const BUENOS_AIRES_ID = "9c858901-8a57-4791-81fe-4c455b099bc9";
const SHOW_A_ID = "b1e1a1a1-1111-4111-8111-111111111111";
const SHOW_B_ID = "b2e2a2a2-2222-4222-8222-222222222222";
const SHOW_C_ID = "c3e3a3a3-3333-4333-8333-333333333333";

function makeCity(overrides: Partial<TourCity> = {}): TourCity {
  return {
    id: MENDOZA_ID,
    name: "Mendoza",
    latitude: -32.8895,
    longitude: -68.8458,
    country: { name: "Argentina", code: "AR" },
    shows: [
      {
        id: SHOW_A_ID,
        date: "2024-03-15T00:00:00.000Z",
        venue: "Demo Venue",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        city: {
          id: MENDOZA_ID,
          name: "Mendoza",
          latitude: -32.8895,
          longitude: -68.8458,
          country: { id: "country-ar", name: "Argentina", code: "AR" },
        },
      },
    ],
    ...overrides,
  };
}

describe("TourMap", () => {
  beforeEach(() => {
    mockMap.setView.mockReset();
    mockMap.fitBounds.mockReset();
  });

  it("shows an empty-state message and no map when there are no cities", () => {
    render(<TourMap cities={[]} />);

    expect(
      screen.getByText(/todavía no hay ciudades/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("map-container")).not.toBeInTheDocument();
  });

  it("renders one marker per city, not one per show", () => {
    const cities = [
      makeCity({
        id: MENDOZA_ID,
        name: "Mendoza",
        shows: [
          { ...makeCity().shows[0], id: SHOW_A_ID },
          { ...makeCity().shows[0], id: SHOW_B_ID },
        ],
      }),
      makeCity({
        id: BUENOS_AIRES_ID,
        name: "Buenos Aires",
        latitude: -34.6037,
        longitude: -58.3816,
        shows: [{ ...makeCity().shows[0], id: SHOW_C_ID }],
      }),
    ];

    render(<TourMap cities={cities} />);

    const markers = screen.getAllByTestId("marker");
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveAttribute(
      "data-position",
      JSON.stringify([-32.8895, -68.8458]),
    );
    expect(markers[1]).toHaveAttribute(
      "data-position",
      JSON.stringify([-34.6037, -58.3816]),
    );
  });

  it("shows the city name, country and show count in the popup", () => {
    const city = makeCity({
      shows: [
        { ...makeCity().shows[0], id: SHOW_A_ID },
        { ...makeCity().shows[0], id: SHOW_B_ID },
      ],
    });

    render(<TourMap cities={[city]} />);

    expect(screen.getByText("Mendoza")).toBeInTheDocument();
    expect(screen.getByText("Argentina")).toBeInTheDocument();
    expect(screen.getByText(/2 shows/i)).toBeInTheDocument();
  });

  it("lists every show of a city with multiple shows, with date and venue", () => {
    const city = makeCity({
      shows: [
        {
          id: SHOW_A_ID,
          date: "2024-03-15T00:00:00.000Z",
          venue: "Demo Venue",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          city: {
            id: MENDOZA_ID,
            name: "Mendoza",
            latitude: -32.8895,
            longitude: -68.8458,
            country: { id: "country-ar", name: "Argentina", code: "AR" },
          },
        },
        {
          id: SHOW_B_ID,
          date: "2025-08-20T00:00:00.000Z",
          venue: "Demo Arena",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          city: {
            id: MENDOZA_ID,
            name: "Mendoza",
            latitude: -32.8895,
            longitude: -68.8458,
            country: { id: "country-ar", name: "Argentina", code: "AR" },
          },
        },
      ],
    });

    render(<TourMap cities={[city]} />);

    expect(screen.getByText(/15 de marzo de 2024/i)).toBeInTheDocument();
    expect(screen.getByText("Demo Venue")).toBeInTheDocument();
    expect(screen.getByText(/20 de agosto de 2025/i)).toBeInTheDocument();
    expect(screen.getByText("Demo Arena")).toBeInTheDocument();
  });

  it("links each show to its detail page without exposing UUIDs in visible text", () => {
    const city = makeCity({
      shows: [
        { ...makeCity().shows[0], id: SHOW_A_ID },
        { ...makeCity().shows[0], id: SHOW_B_ID },
      ],
    });

    const { container } = render(<TourMap cities={[city]} />);

    const links = screen.getAllByRole("link", { name: /ver show/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      "href",
      `/artists/the-warning/shows/${SHOW_A_ID}`,
    );
    expect(links[1]).toHaveAttribute(
      "href",
      `/artists/the-warning/shows/${SHOW_B_ID}`,
    );

    expect(container.textContent).not.toContain(SHOW_A_ID);
    expect(container.textContent).not.toContain(SHOW_B_ID);
    expect(container.textContent).not.toContain(MENDOZA_ID);
  });

  it("centers the map on the single city when there is exactly one", () => {
    const city = makeCity();
    render(<TourMap cities={[city]} />);

    expect(mockMap.setView).toHaveBeenCalledWith(
      [city.latitude, city.longitude],
      expect.any(Number),
    );
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
  });

  it("fits the bounds to every city when there is more than one", () => {
    const cities = [
      makeCity({ id: MENDOZA_ID }),
      makeCity({
        id: BUENOS_AIRES_ID,
        name: "Buenos Aires",
        latitude: -34.6037,
        longitude: -58.3816,
      }),
    ];
    render(<TourMap cities={cities} />);

    expect(mockMap.fitBounds).toHaveBeenCalledWith(
      [
        [cities[0].latitude, cities[0].longitude],
        [cities[1].latitude, cities[1].longitude],
      ],
      expect.any(Object),
    );
    expect(mockMap.setView).not.toHaveBeenCalled();
  });
});
