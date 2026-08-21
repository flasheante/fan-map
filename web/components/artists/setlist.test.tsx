import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { SetlistSong } from "@/lib/api";
import { Setlist } from "./setlist";

describe("Setlist", () => {
  it("shows each song with its position and title", () => {
    const songs: SetlistSong[] = [
      { id: "song-1", position: 1, title: "Choke" },
      { id: "song-2", position: 2, title: "Qué Más Quieres" },
    ];

    render(<Setlist songs={songs} />);

    expect(screen.getByText("Choke")).toBeInTheDocument();
    expect(screen.getByText("Qué Más Quieres")).toBeInTheDocument();
  });

  it("respects the position order even if songs arrive unsorted", () => {
    const songs: SetlistSong[] = [
      { id: "song-2", position: 2, title: "Qué Más Quieres" },
      { id: "song-1", position: 1, title: "Choke" },
    ];

    render(<Setlist songs={songs} />);

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Choke");
    expect(items[1]).toHaveTextContent("Qué Más Quieres");
  });

  it('shows "Setlist todavía no disponible." when there are no songs', () => {
    render(<Setlist songs={[]} />);

    expect(
      screen.getByText(/setlist todavía no disponible\./i),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
