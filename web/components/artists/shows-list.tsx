import Link from "next/link";
import type { ArtistShow } from "@/lib/api";
import { formatShowDate } from "@/lib/format-show-date";

interface ShowsListProps {
  shows: ArtistShow[];
}

// Cada show linkea a su página de detalle (/artists/the-warning/shows/:id),
// que a su vez resuelve el setlist por separado.
export function ShowsList({ shows }: ShowsListProps) {
  if (shows.length === 0) {
    return (
      <p className="px-4 py-3 text-center text-sm text-zinc-400">
        Todavía no hay shows cargados.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-800">
      {shows.map((show) => (
        <li key={show.id}>
          <Link
            href={`/artists/the-warning/shows/${show.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium">
              {formatShowDate(show.date)}
            </span>
            <span className="text-sm text-zinc-400">
              {show.venue ?? "Venue a confirmar"} · {show.city.name},{" "}
              {show.city.country.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
