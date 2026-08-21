import Link from "next/link";
import type { Artist, ArtistShow } from "@/lib/api";

interface ShowDetailProps {
  artist: Artist;
  show: ArtistShow;
}

// timeZone: "UTC" porque show.date llega como medianoche UTC (fecha sin
// hora real asociada); formatear en el huso del navegador podría correr el
// día mostrado. Mismo formatter que ShowsList.
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeZone: "UTC",
});

export function ShowDetail({ artist, show }: ShowDetailProps) {
  return (
    <header className="flex flex-col gap-2 border-b px-4 py-4">
      <Link
        href="/artists/the-warning"
        className="text-sm font-medium underline underline-offset-2"
      >
        ← Volver a {artist.name}
      </Link>
      <h1 className="text-lg font-semibold">{artist.name}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {dateFormatter.format(new Date(show.date))}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {show.venue ?? "Venue a confirmar"} · {show.city.name},{" "}
        {show.city.country.name}
      </p>
    </header>
  );
}
