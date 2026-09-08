import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ArtistSong, SongListItemInput } from "@/lib/api";
import { SongListEditor } from "./song-list-editor";

function makeSong(overrides: Partial<ArtistSong> = {}): ArtistSong {
  return {
    id: "song-1",
    title: "Automatic Sun",
    albumTitle: "XXI Century Blood",
    releaseDate: "2017-03-27",
    ...overrides,
  };
}

const songA = makeSong({ id: "song-a", title: "Automatic Sun" });
const songB = makeSong({ id: "song-b", title: "Choke" });
const songC = makeSong({ id: "song-c", title: "Qué Más Da" });
const catalog = [songA, songB, songC];

function renderEditor(overrides: {
  value?: SongListItemInput[];
  onChange?: (next: SongListItemInput[]) => void;
  maxItems?: number;
} = {}) {
  const onChange = overrides.onChange ?? vi.fn();
  render(
    <SongListEditor
      songs={catalog}
      value={overrides.value ?? []}
      onChange={onChange}
      maxItems={overrides.maxItems ?? 15}
      idPrefix="setlist"
      title="Mi Setlist"
      description="Elegí hasta 15 canciones que te gustaría escuchar en un show."
      positionLabel={(position) => `Canción ${position}`}
    />,
  );
  return onChange;
}

describe("SongListEditor", () => {
  it("shows the given title and description", () => {
    renderEditor();

    expect(screen.getByText("Mi Setlist")).toBeInTheDocument();
    expect(
      screen.getByText(/elegí hasta 15 canciones que te gustaría escuchar en un show/i),
    ).toBeInTheDocument();
  });

  it("shows matching songs from the catalog when searching", () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText(/buscar canciones/i), {
      target: { value: "auto" },
    });

    expect(screen.getByText("Automatic Sun")).toBeInTheDocument();
    expect(screen.queryByText("Choke")).not.toBeInTheDocument();
  });

  it("matches search case- and accent-insensitively", () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText(/buscar canciones/i), {
      target: { value: "que mas da" },
    });

    expect(screen.getByText("Qué Más Da")).toBeInTheDocument();
  });

  // Requisito: al agregar, se asigna automáticamente la primera posición
  // libre — acá 1, porque la lista está vacía.
  it("assigns the first free position when adding a song", () => {
    const onChange = renderEditor();

    fireEvent.change(screen.getByLabelText(/buscar canciones/i), {
      target: { value: "choke" },
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledWith([{ songId: songB.id, position: 1 }]);
  });

  it("assigns the next free position, filling gaps left by a removed song", () => {
    const onChange = vi.fn();
    renderEditor({
      value: [
        { songId: songA.id, position: 1 },
        { songId: songB.id, position: 3 },
      ],
      onChange,
    });

    fireEvent.change(screen.getByLabelText(/buscar canciones/i), {
      target: { value: "que mas da" },
    });
    fireEvent.click(screen.getByRole("button", { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledWith([
      { songId: songA.id, position: 1 },
      { songId: songB.id, position: 3 },
      { songId: songC.id, position: 2 },
    ]);
  });

  it("does not offer an already-selected song in the search results", () => {
    renderEditor({ value: [{ songId: songA.id, position: 1 }] });

    fireEvent.change(screen.getByLabelText(/buscar canciones/i), {
      target: { value: "automatic" },
    });

    expect(screen.queryByRole("button", { name: /agregar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /quitar/i })).toBeInTheDocument();
  });

  it("removes a song when clicking Quitar", () => {
    const onChange = vi.fn();
    renderEditor({
      value: [
        { songId: songA.id, position: 1 },
        { songId: songB.id, position: 2 },
      ],
      onChange,
    });

    fireEvent.click(screen.getAllByRole("button", { name: /quitar/i })[0]);

    expect(onChange).toHaveBeenCalledWith([{ songId: songB.id, position: 2 }]);
  });

  it("shows a visual counter of how many songs are selected, out of the max", () => {
    renderEditor({ value: [{ songId: songA.id, position: 1 }], maxItems: 15 });

    expect(screen.getByText("1/15")).toBeInTheDocument();
  });

  it("disables adding more once the max is reached", () => {
    const fifteen: SongListItemInput[] = Array.from({ length: 15 }, (_, i) => ({
      songId: `song-${i}`,
      position: i + 1,
    }));
    const fullCatalog = [
      ...fifteen.map((f) => makeSong({ id: f.songId, title: `Song ${f.songId}` })),
      songC,
    ];
    render(
      <SongListEditor
        songs={fullCatalog}
        value={fifteen}
        onChange={vi.fn()}
        maxItems={15}
        idPrefix="setlist"
        title="Mi Setlist"
        description="desc"
        positionLabel={(p) => `Canción ${p}`}
      />,
    );

    expect(screen.getByText("15/15")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/máximo de 15/i);
    expect(screen.getByLabelText(/buscar canciones/i)).toBeDisabled();
  });

  it("reassigns a position via the select", () => {
    const onChange = vi.fn();
    renderEditor({ value: [{ songId: songA.id, position: 1 }], onChange });

    fireEvent.change(screen.getByLabelText(/posición de automatic sun/i), {
      target: { value: "3" },
    });

    expect(onChange).toHaveBeenCalledWith([{ songId: songA.id, position: 3 }]);
  });

  // Requisito: si el usuario asigna una posición ya ocupada, se resuelve
  // de forma determinista — a quien la tenía se le da la primera libre.
  it("moves the position away from another song when reassigned, deterministically", () => {
    const onChange = vi.fn();
    renderEditor({
      value: [
        { songId: songA.id, position: 1 },
        { songId: songB.id, position: 2 },
      ],
      onChange,
    });

    fireEvent.change(screen.getByLabelText(/posición de choke/i), {
      target: { value: "1" },
    });

    expect(onChange).toHaveBeenCalledWith([
      { songId: songA.id, position: 2 },
      { songId: songB.id, position: 1 },
    ]);
  });

  it("orders songs by position", () => {
    renderEditor({
      value: [
        { songId: songC.id, position: 3 },
        { songId: songB.id, position: 1 },
        { songId: songA.id, position: 2 },
      ],
    });

    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toContain("Choke");
    expect(items[1]).toContain("Automatic Sun");
    expect(items[2]).toContain("Qué Más Da");
  });

  it("uses the given positionLabel for each option", () => {
    render(
      <SongListEditor
        songs={catalog}
        value={[{ songId: songA.id, position: 1 }]}
        onChange={vi.fn()}
        maxItems={10}
        idPrefix="favorite"
        title="Top 10"
        description="desc"
        positionLabel={(p) => `Top ${p}`}
      />,
    );

    const select = screen.getByLabelText(/posición de automatic sun/i);
    expect(select.querySelector('option[value="1"]')).toHaveTextContent("Top 1");
  });
});
