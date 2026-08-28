import type { ReactNode } from "react";
import Link from "next/link";
import { formatShowDate } from "@/lib/format-show-date";
import type { TourStats as TourStatsData } from "@/lib/the-warning-tour-stats";

interface TourStatsProps {
  stats: TourStatsData;
}

const EMPTY_PLACEHOLDER = "Todavía no hay shows cargados.";

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-zinc-800 px-4 py-2">
      <span className="text-lg font-semibold">{value}</span>
      <span className="font-warning text-xs font-bold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
    </div>
  );
}

function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-warning text-xs font-bold uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

function showsLabel(count: number): string {
  return `${count} ${count === 1 ? "show" : "shows"}`;
}

// Mitad "de arriba" del resumen estadístico del Tour Map (ver tour/page.tsx):
// totales, primer/último show y los "con más shows" (país/ciudad/año). Se
// muestra antes del mapa; TourStatsRankings (shows por año + ranking de
// ciudades) se muestra después, para que el mapa quede arriba de esos
// desgloses largos en vez de empujarlos fuera de la vista inicial.
export function TourStatsSummary({ stats }: TourStatsProps) {
  const {
    totalShows,
    totalCities,
    totalCountries,
    totalVenues,
    firstShow,
    lastShow,
    topCountry,
    topCity,
    topYear,
  } = stats;

  return (
    <section className="flex flex-col gap-4 border-b border-zinc-800 px-4 py-4">
      <h2 className="font-warning text-sm font-bold uppercase tracking-wide text-zinc-400">
        Historial de shows
      </h2>
      <div className="flex flex-wrap gap-3">
        <StatPill value={totalShows} label={totalShows === 1 ? "show" : "shows"} />
        <StatPill
          value={totalCities}
          label={totalCities === 1 ? "ciudad" : "ciudades"}
        />
        <StatPill
          value={totalCountries}
          label={totalCountries === 1 ? "país" : "países"}
        />
        <StatPill
          value={totalVenues}
          label={totalVenues === 1 ? "venue" : "venues"}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatRow label="Primer show">
          {firstShow
            ? `${formatShowDate(firstShow.date)} · ${firstShow.city.name}`
            : EMPTY_PLACEHOLDER}
        </StatRow>
        <StatRow label="Último show">
          {lastShow
            ? `${formatShowDate(lastShow.date)} · ${lastShow.city.name}`
            : EMPTY_PLACEHOLDER}
        </StatRow>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatRow label="País con más shows">
          {topCountry
            ? `${topCountry.name} · ${showsLabel(topCountry.showCount)}`
            : EMPTY_PLACEHOLDER}
        </StatRow>
        <StatRow label="Ciudad con más shows">
          {topCity
            ? `${topCity.name} · ${showsLabel(topCity.showCount)}`
            : EMPTY_PLACEHOLDER}
        </StatRow>
        <StatRow label="Año con más shows">
          {topYear
            ? `${topYear.year} · ${showsLabel(topYear.showCount)}`
            : EMPTY_PLACEHOLDER}
        </StatRow>
      </div>
    </section>
  );
}

// Mitad "de abajo" del resumen estadístico del Tour Map: desglose completo
// de shows por año y el ranking de ciudades (listas potencialmente largas).
// Ver TourStatsSummary de arriba para la mitad que va antes del mapa.
export function TourStatsRankings({ stats }: TourStatsProps) {
  const { showsByYear, citiesRanking } = stats;

  return (
    <section className="grid grid-cols-1 gap-4 border-b border-zinc-800 px-4 py-4 sm:grid-cols-2">
      <StatRow label="Shows por año">
        {showsByYear.length > 0 ? (
          <ul data-testid="shows-by-year" className="flex flex-col gap-1">
            {showsByYear.map((entry) => (
              <li
                key={entry.year}
                data-testid="year-row"
                className="flex items-center justify-between gap-2 font-normal"
              >
                <span>{entry.year}</span>
                <span className="text-zinc-400">
                  {showsLabel(entry.showCount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          EMPTY_PLACEHOLDER
        )}
      </StatRow>
      <StatRow label="Ciudades">
        {citiesRanking.length > 0 ? (
          <ul data-testid="cities-ranking" className="flex flex-col gap-1">
            {citiesRanking.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 font-normal">
                <Link
                  href={`/artists/the-warning/tour/${entry.id}`}
                  className="underline underline-offset-2"
                >
                  {entry.name} · {entry.country.name}
                </Link>
                <span className="text-zinc-400">
                  {showsLabel(entry.showCount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          EMPTY_PLACEHOLDER
        )}
      </StatRow>
    </section>
  );
}
