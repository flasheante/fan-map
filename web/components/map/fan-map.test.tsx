import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArtistFan } from "@/lib/api";

const mockMap = { setView: vi.fn(), fitBounds: vi.fn() };

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

const { FanMap } = await import("./fan-map");

function makeFan(overrides: Partial<ArtistFan> = {}): ArtistFan {
  return {
    id: "fan-1",
    displayName: "Fan One",
    showOnMap: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    city: {
      id: "city-1",
      name: "Monterrey",
      latitude: 25.6866,
      longitude: -100.3161,
      country: { id: "country-1", name: "Mexico", code: "MX" },
    },
    ...overrides,
  };
}

describe("FanMap", () => {
  beforeEach(() => {
    mockMap.setView.mockReset();
    mockMap.fitBounds.mockReset();
  });

  it("shows an empty-state message and no map when there are no fans", () => {
    render(<FanMap fans={[]} />);

    expect(
      screen.getByText("Todavía no hay fans visibles en el mapa."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("map-container")).not.toBeInTheDocument();
  });

  it("renders one marker per fan with a popup showing displayName, city and country", () => {
    const fans = [
      makeFan({
        id: "fan-1",
        displayName: "Fan One",
        city: {
          id: "city-1",
          name: "Monterrey",
          latitude: 25.6866,
          longitude: -100.3161,
          country: { id: "country-1", name: "Mexico", code: "MX" },
        },
      }),
      makeFan({
        id: "fan-2",
        displayName: "Fan Two",
        city: {
          id: "city-2",
          name: "Madrid",
          latitude: 40.4168,
          longitude: -3.7038,
          country: { id: "country-2", name: "Spain", code: "ES" },
        },
      }),
    ];

    render(<FanMap fans={fans} />);

    const markers = screen.getAllByTestId("marker");
    expect(markers).toHaveLength(2);
    expect(markers[0]).toHaveAttribute(
      "data-position",
      JSON.stringify([25.6866, -100.3161]),
    );
    expect(markers[1]).toHaveAttribute(
      "data-position",
      JSON.stringify([40.4168, -3.7038]),
    );

    expect(screen.getByText("Fan One")).toBeInTheDocument();
    expect(screen.getByText(/Monterrey, Mexico/)).toBeInTheDocument();
    expect(screen.getByText("Fan Two")).toBeInTheDocument();
    expect(screen.getByText(/Madrid, Spain/)).toBeInTheDocument();
  });

  it("centers the map on the single fan when there is exactly one", () => {
    const fan = makeFan();
    render(<FanMap fans={[fan]} />);

    expect(mockMap.setView).toHaveBeenCalledWith(
      [fan.city.latitude, fan.city.longitude],
      expect.any(Number),
    );
    expect(mockMap.fitBounds).not.toHaveBeenCalled();
  });

  it("fits the bounds to every fan when there is more than one", () => {
    const fans = [
      makeFan({ id: "fan-1" }),
      makeFan({
        id: "fan-2",
        city: {
          id: "city-2",
          name: "Madrid",
          latitude: 40.4168,
          longitude: -3.7038,
          country: { id: "country-2", name: "Spain", code: "ES" },
        },
      }),
    ];
    render(<FanMap fans={fans} />);

    expect(mockMap.fitBounds).toHaveBeenCalledWith(
      [
        [fans[0].city.latitude, fans[0].city.longitude],
        [fans[1].city.latitude, fans[1].city.longitude],
      ],
      expect.any(Object),
    );
    expect(mockMap.setView).not.toHaveBeenCalled();
  });
});
