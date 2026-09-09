import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Artist, ArtistShow } from "@/lib/api";
import { ShowDetail } from "./show-detail";

function makeArtist(overrides: Partial<Artist> = {}): Artist {
  return {
    id: "artist-1",
    name: "The Warning",
    slug: "the-warning",
    imageUrl: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    setlistsSyncedAt: null,
    ...overrides,
  };
}

function makeShow(overrides: Partial<ArtistShow> = {}): ArtistShow {
  return {
    id: "show-1",
    date: "2026-06-01T00:00:00.000Z",
    venue: "Foro Sol",
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

describe("ShowDetail", () => {
  it("shows the artist's name", () => {
    render(<ShowDetail artist={makeArtist()} show={makeShow()} />);

    expect(
      screen.getByRole("heading", { name: "The Warning" }),
    ).toBeInTheDocument();
  });

  it("shows the date", () => {
    render(<ShowDetail artist={makeArtist()} show={makeShow()} />);

    // getAllByText: la fecha también aparece como paso actual del
    // breadcrumb (ver "renders the tour breadcrumbs..." más abajo).
    expect(
      screen.getAllByText(/1 de junio de 2026/i).length,
    ).toBeGreaterThan(0);
  });

  it("shows the venue", () => {
    render(
      <ShowDetail artist={makeArtist()} show={makeShow({ venue: "Foro Sol" })} />,
    );

    expect(screen.getByText(/foro sol/i)).toBeInTheDocument();
  });

  it("shows the city", () => {
    render(<ShowDetail artist={makeArtist()} show={makeShow()} />);

    // getAllByText: la ciudad también aparece como link del breadcrumb
    // (ver "renders the tour breadcrumbs..." más abajo).
    expect(screen.getAllByText(/monterrey/i).length).toBeGreaterThan(0);
  });

  it("shows the country", () => {
    render(<ShowDetail artist={makeArtist()} show={makeShow()} />);

    expect(screen.getByText(/mexico/i)).toBeInTheDocument();
  });

  it('shows "Venue a confirmar" when the venue is missing', () => {
    render(<ShowDetail artist={makeArtist()} show={makeShow({ venue: null })} />);

    expect(screen.getByText(/venue a confirmar/i)).toBeInTheDocument();
  });

  it("renders the tour breadcrumbs, linking back to the artist, the tour history and the city", () => {
    const show = makeShow();
    render(<ShowDetail artist={makeArtist()} show={show} />);

    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(
      within(nav).getByRole("link", { name: "The Warning" }),
    ).toHaveAttribute("href", "/artists/the-warning");
    expect(
      within(nav).getByRole("link", { name: "Historial de shows" }),
    ).toHaveAttribute("href", "/artists/the-warning/tour");
    expect(
      within(nav).getByRole("link", { name: "Monterrey" }),
    ).toHaveAttribute("href", `/artists/the-warning/tour/${show.city.id}`);
    expect(
      within(nav).getByText(/1 de junio de 2026/i),
    ).toHaveAttribute("aria-current", "page");
  });

  it("falls back to a plain breadcrumb when the show has no city, without breaking", () => {
    const show = makeShow({ city: undefined as unknown as ArtistShow["city"] });
    render(<ShowDetail artist={makeArtist()} show={show} />);

    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(
      within(nav).getByRole("link", { name: "The Warning" }),
    ).toHaveAttribute("href", "/artists/the-warning");
    expect(within(nav).getByText("Show")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("doesn't render any internal id", () => {
    const show = makeShow();
    render(<ShowDetail artist={makeArtist()} show={show} />);

    expect(screen.queryByText(show.id)).not.toBeInTheDocument();
    expect(screen.queryByText(show.city.id)).not.toBeInTheDocument();
  });
});
