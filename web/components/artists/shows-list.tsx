import Link from "next/link";
import type { ArtistShow } from "@/lib/api";

interface ShowsListProps {
  shows: ArtistShow[];
}

// timeZone: "UTC" porque show.date llega como medianoche UTC (fecha sin
// hora real asociada); formatear en el huso del navegador podría correr el
// día mostrado.
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeZone: "UTC",
});

// Cada show linkea a su página de detalle (/artists/the-warning/shows/:id),
// que a su vez resuelve el setlist por separado.
export function ShowsList({ shows }: ShowsListProps) {
  if (shows.length === 0) {
    return (
      <p className="px-4 py-3 text-center text-sm text-zinc-600 dark:text-zinc-400">
        Todavía no hay shows cargados.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
      {shows.map((show) => (
        <li key={show.id}>
          <Link
            href={`/artists/the-warning/shows/${show.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-900"
          >
            <span className="text-sm font-medium">
              {dateFormatter.format(new Date(show.date))}
            </span>
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {show.venue ?? "Venue a confirmar"} · {show.city.name},{" "}
              {show.city.country.name}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
