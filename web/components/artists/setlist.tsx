import type { SetlistSong } from "@/lib/api";

interface SetlistProps {
  songs: SetlistSong[];
}

export function Setlist({ songs }: SetlistProps) {
  if (songs.length === 0) {
    return (
      <p className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Setlist todavía no disponible.
      </p>
    );
  }

  // El backend ya ordena por position, pero se ordena también acá para no
  // depender de ese detalle de implementación.
  const sortedSongs = [...songs].sort((a, b) => a.position - b.position);

  return (
    <ol className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      {sortedSongs.map((song) => (
        <li key={song.id} className="flex gap-3 px-4 py-2 text-sm">
          <span className="w-6 text-right text-zinc-500 dark:text-zinc-400">
            {song.position}
          </span>
          <span>{song.title}</span>
        </li>
      ))}
    </ol>
  );
}
