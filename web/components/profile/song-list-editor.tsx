"use client";

import { useMemo, useState } from "react";
import type { ArtistSong, SongListItemInput } from "@/lib/api";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

const pillClass =
  "font-warning rounded-full border border-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

interface SongListEditorProps {
  songs: ArtistSong[];
  value: SongListItemInput[];
  onChange: (next: SongListItemInput[]) => void;
  /** 15 para el setlist, 10 para el Top 10 — ver el pedido de la etapa. */
  maxItems: number;
  /** Prefiere ids de DOM únicos: ambos editores conviven en la misma página. */
  idPrefix: string;
  title: string;
  description: string;
  /** Texto de cada opción del selector de posición, ej. "Canción 3" / "Top 3". */
  positionLabel: (position: number) => string;
}

// Editor genérico de una lista posicionada de canciones del catálogo
// (Song, ver web/lib/api.ts — nunca un catálogo paralelo), hasta
// `maxItems`. Reutilizado tal cual para el setlist personal (15) y el Top
// 10 de favoritas (10, ver ProfileEditor) — son dos instancias
// completamente independientes: cada una recibe su propio `value` y
// `onChange`, sin ningún estado compartido entre ellas.
//
// A diferencia del viejo FavoriteSongsEditor (topPosition opcional, una
// favorita podía no tener puesto en el Top 10), acá TODA canción en la
// lista tiene una posición — no hay "en la lista pero sin puesto". Al
// agregar una canción se le asigna automáticamente la primera posición
// libre (1..maxItems); el selector de posición deja reasignarla a mano.
export function SongListEditor({
  songs,
  value,
  onChange,
  maxItems,
  idPrefix,
  title,
  description,
  positionLabel,
}: SongListEditorProps) {
  const [search, setSearch] = useState("");

  const songById = useMemo(() => {
    const map = new Map<string, ArtistSong>();
    for (const song of songs) map.set(song.id, song);
    return map;
  }, [songs]);

  const selectedIds = useMemo(() => new Set(value.map((v) => v.songId)), [value]);
  const atLimit = value.length >= maxItems;

  const results = useMemo(() => {
    if (!search.trim()) return [];
    const query = normalize(search);
    return songs
      .filter((song) => !selectedIds.has(song.id) && normalize(song.title).includes(query))
      .slice(0, 20);
  }, [songs, search, selectedIds]);

  function nextFreePosition(): number {
    const used = new Set(value.map((v) => v.position));
    for (let position = 1; position <= maxItems; position++) {
      if (!used.has(position)) return position;
    }
    return maxItems;
  }

  function addSong(songId: string) {
    if (atLimit || selectedIds.has(songId)) return;
    onChange([...value, { songId, position: nextFreePosition() }]);
  }

  function removeSong(songId: string) {
    onChange(value.filter((v) => v.songId !== songId));
  }

  // Elegir una posición ya usada por otra canción se la saca a esa otra
  // (nunca dos canciones comparten posición, ni acá ni en el backend):
  // a la que tenía esa posición se le asigna la primera que quede libre,
  // así nunca hay dos filas con el mismo valor, ni siquiera un instante.
  // Reordenar es simplemente volver a llamar esto con la posición nueva.
  function setPosition(songId: string, position: number) {
    const occupant = value.find((v) => v.songId !== songId && v.position === position);
    if (!occupant) {
      onChange(value.map((v) => (v.songId === songId ? { ...v, position } : v)));
      return;
    }

    // Posiciones que van a seguir ocupadas por el resto de las canciones
    // (todas menos la que se mueve y la que hay que reacomodar), más la
    // posición nueva de la que se mueve — el resto de 1..maxItems queda
    // libre para reacomodar al ocupante anterior.
    const stillOccupied = new Set(
      value
        .filter((v) => v.songId !== songId && v.songId !== occupant.songId)
        .map((v) => v.position),
    );
    stillOccupied.add(position);
    let freePosition = 1;
    while (stillOccupied.has(freePosition) && freePosition <= maxItems) freePosition++;

    onChange(
      value.map((v) => {
        if (v.songId === songId) return { ...v, position };
        if (v.songId === occupant.songId) return { ...v, position: freePosition };
        return v;
      }),
    );
  }

  const ordered = useMemo(
    () => [...value].sort((a, b) => a.position - b.position),
    [value],
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-warning text-sm font-bold uppercase tracking-wide text-zinc-400">
          {title}
        </h2>
        <p className="text-sm text-zinc-500">{description}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`text-xs font-semibold uppercase tracking-wide ${
            atLimit ? "text-white" : "text-zinc-400"
          }`}
        >
          {value.length}/{maxItems}
        </span>
      </div>

      {atLimit && (
        <p role="status" className="text-xs text-zinc-400">
          Llegaste al máximo de {maxItems} canciones. Quitá alguna para agregar otra.
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-search`} className="text-sm font-medium">
          Buscar canciones
        </label>
        <input
          id={`${idPrefix}-search`}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en el catálogo de The Warning"
          disabled={atLimit}
          className="rounded-md border border-zinc-700 bg-black px-3 py-2 text-white placeholder:text-zinc-500 disabled:opacity-40"
        />
        {results.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-md border border-zinc-800 p-2">
            {results.map((song) => (
              <li key={song.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{song.title}</span>
                <button
                  type="button"
                  onClick={() => addSong(song.id)}
                  disabled={atLimit}
                  className={pillClass}
                >
                  Agregar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <ul className="flex flex-col gap-2">
          {ordered.map((item) => {
            const song = songById.get(item.songId);
            return (
              <li
                key={item.songId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 px-3 py-2"
              >
                <span className="text-sm">{song?.title ?? item.songId}</span>
                <div className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`${idPrefix}-position-${item.songId}`}>
                    Posición de {song?.title ?? item.songId}
                  </label>
                  <select
                    id={`${idPrefix}-position-${item.songId}`}
                    value={item.position}
                    onChange={(e) => setPosition(item.songId, Number(e.target.value))}
                    className="rounded-md border border-zinc-700 bg-black px-2 py-1 text-sm text-white"
                  >
                    {Array.from({ length: maxItems }, (_, i) => i + 1).map((position) => (
                      <option key={position} value={position}>
                        {positionLabel(position)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeSong(item.songId)}
                    className={pillClass}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
