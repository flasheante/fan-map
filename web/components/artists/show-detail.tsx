import type { Artist, ArtistShow } from "@/lib/api";
import { formatShowDate } from "@/lib/format-show-date";
import { TheWarningLogo } from "./the-warning-logo";
import { TourBreadcrumbs } from "./tour-breadcrumbs";

interface ShowDetailProps {
  artist: Artist;
  show: ArtistShow;
}

export function ShowDetail({ artist, show }: ShowDetailProps) {
  // show.city.* está tipado como obligatorio (ver ArtistShow en lib/api.ts),
  // pero se accede de forma defensiva: si la respuesta de la API llegara
  // sin ciudad, ni el breadcrumb ni esta cabecera deben romperse.
  const city = show.city as ArtistShow["city"] | null | undefined;

  return (
    <header className="flex flex-col gap-2 border-b border-zinc-800 px-4 py-4">
      <TourBreadcrumbs
        level="show"
        artistName={artist.name}
        city={city ? { id: city.id, name: city.name } : null}
        showDate={show.date}
      />
      <h1>
        <TheWarningLogo height={24} />
      </h1>
      <p className="text-sm text-zinc-400">{formatShowDate(show.date)}</p>
      <p className="text-sm text-zinc-400">
        {show.venue ?? "Venue a confirmar"}
        {city ? ` · ${city.name}, ${city.country.name}` : ""}
      </p>
    </header>
  );
}
