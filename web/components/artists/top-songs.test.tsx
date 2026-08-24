import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ArtistTopSong } from "@/lib/api";
import { TopSongs } from "./top-songs";

function makeTopSongs(count: number): ArtistTopSong[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Song ${i + 1}`,
    timesPlayed: count - i,
  }));
}

describe("TopSongs", () => {
  it("shows the heading", () => {
    render(<TopSongs topSongs={[{ title: "S!CK", timesPlayed: 42 }]} />);

    expect(
      screen.getByRole("heading", { name: /canciones más tocadas/i }),
    ).toBeInTheDocument();
  });

  it("shows the empty state when there are no songs", () => {
    render(<TopSongs topSongs={[]} />);

    expect(
      screen.getByText(/todavía no hay canciones registradas/i),
    ).toBeInTheDocument();
  });

  it("lists songs with their title and times played", () => {
    render(
      <TopSongs
        topSongs={[
          { title: "S!CK", timesPlayed: 42 },
          { title: "MORE", timesPlayed: 38 },
        ]}
      />,
    );

    expect(screen.getByText("S!CK")).toBeInTheDocument();
    expect(screen.getByText(/42 veces/)).toBeInTheDocument();
    expect(screen.getByText("MORE")).toBeInTheDocument();
    expect(screen.getByText(/38 veces/)).toBeInTheDocument();
  });

  it("uses singular 'vez' for a song played exactly once", () => {
    render(<TopSongs topSongs={[{ title: "CHOKE", timesPlayed: 1 }]} />);

    expect(screen.getByText(/1 vez\b/)).toBeInTheDocument();
    expect(screen.queryByText(/1 veces/)).not.toBeInTheDocument();
  });

  it("uses plural 'veces' for a song played more than once", () => {
    render(<TopSongs topSongs={[{ title: "CHOKE", timesPlayed: 2 }]} />);

    expect(screen.getByText(/2 veces/)).toBeInTheDocument();
  });

  it("shows at most 10 songs even when more are given", () => {
    render(<TopSongs topSongs={makeTopSongs(15)} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.getByText("Song 1")).toBeInTheDocument();
    expect(screen.getByText("Song 10")).toBeInTheDocument();
    expect(screen.queryByText("Song 11")).not.toBeInTheDocument();
  });

  it("does not render internal ids", () => {
    const { container } = render(
      <TopSongs topSongs={[{ title: "S!CK", timesPlayed: 42 }]} />,
    );

    expect(container.innerHTML).not.toMatch(/id["']?\s*:/i);
  });
});
