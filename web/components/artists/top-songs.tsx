import type { ArtistTopSong } from "@/lib/api";

interface TopSongsProps {
  topSongs: ArtistTopSong[];
}

const MAX_SONGS = 10;

function timesPlayedLabel(timesPlayed: number): string {
  return timesPlayed === 1 ? "1 vez" : `${timesPlayed} veces`;
}

// Componente puramente presentacional: recibe el ArtistTopSong[] ya resuelto
// (ver getTheWarningTopSongsData) y no hace fetch ni conoce el artista.
// Muestra como máximo MAX_SONGS canciones; el orden (timesPlayed desc, title
// asc en empate) ya viene dado por la API.
export function TopSongs({ topSongs }: TopSongsProps) {
  const visibleSongs = topSongs.slice(0, MAX_SONGS);

  return (
    <section>
      <h2 className="font-warning px-4 pt-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
        Canciones más tocadas
      </h2>
      {visibleSongs.length === 0 ? (
        <p className="px-4 py-3 text-center text-sm text-zinc-400">
          Todavía no hay canciones registradas.
        </p>
      ) : (
        <ol className="flex flex-col divide-y divide-zinc-800">
          {visibleSongs.map((song, index) => (
            <li
              key={song.title}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <span className="flex items-baseline gap-1 text-sm font-medium">
                <span className="text-zinc-400">{index + 1}.</span>
                <span>{song.title}</span>
              </span>
              <span className="text-sm text-zinc-400">
                {timesPlayedLabel(song.timesPlayed)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
