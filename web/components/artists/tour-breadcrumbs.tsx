import Link from "next/link";
import { formatShowDate } from "@/lib/format-show-date";

const ARTIST_HREF = "/artists/the-warning";
const TOUR_HREF = "/artists/the-warning/tour";

export type TourBreadcrumbsProps =
  | { level: "tour"; artistName: string }
  | { level: "city"; artistName: string; cityName: string }
  | {
      level: "show";
      artistName: string;
      city: { id: string; name: string } | null;
      showDate: string;
    };

interface BreadcrumbLink {
  label: string;
  href: string;
}

// Arma el trail de links + el label de la página actual a partir del
// `level`. Cada nivel reutiliza los mismos dos primeros pasos (The Warning →
// Historial de shows), sin re-declarar esos hrefs en cada page/componente
// que integra el breadcrumb. En "show" sin ciudad (show.city ausente en la
// respuesta de la API) se degrada a un paso "Show" genérico en vez de
// romper: no hay a dónde linkear una ciudad que no llegó.
function buildTrail(
  props: TourBreadcrumbsProps,
): { links: BreadcrumbLink[]; current: string } {
  const artistLink: BreadcrumbLink = { label: props.artistName, href: ARTIST_HREF };
  const tourLink: BreadcrumbLink = { label: "Historial de shows", href: TOUR_HREF };

  switch (props.level) {
    case "tour":
      return { links: [artistLink], current: "Historial de shows" };
    case "city":
      return { links: [artistLink, tourLink], current: props.cityName };
    case "show": {
      if (!props.city) {
        return { links: [artistLink, tourLink], current: "Show" };
      }
      const cityLink: BreadcrumbLink = {
        label: props.city.name,
        href: `${TOUR_HREF}/${props.city.id}`,
      };
      return {
        links: [artistLink, tourLink, cityLink],
        current: formatShowDate(props.showDate),
      };
    }
  }
}

// Breadcrumb contextual del historial de The Warning (The Warning →
// Historial de shows → Ciudad → Show), reutilizado en
// /artists/the-warning/tour, /artists/the-warning/tour/:cityId y
// /artists/the-warning/shows/:showId. Cada paso anterior es un link al
// nivel correspondiente; el último representa la página actual y se
// renderiza como texto (aria-current="page"), no como link. `flex-wrap`
// evita overflow horizontal en mobile: ante poco espacio el trail pasa a
// una segunda línea en vez de desbordar.
export function TourBreadcrumbs(props: TourBreadcrumbsProps) {
  const { links, current } = buildTrail(props);

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
        {links.map((link) => (
          <li key={link.href} className="flex items-center gap-x-1.5">
            <Link
              href={link.href}
              className="font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {link.label}
            </Link>
            <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">
              /
            </span>
          </li>
        ))}
        <li
          aria-current="page"
          className="truncate font-semibold text-zinc-900 dark:text-zinc-100"
        >
          {current}
        </li>
      </ol>
    </nav>
  );
}
