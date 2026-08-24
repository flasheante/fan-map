import type { ReactNode } from "react";
import type { TourStats as TourStatsData } from "@/lib/the-warning-tour-stats";

interface TourStatsProps {
  stats: TourStatsData;
}

// timeZone: "UTC" porque show.date llega como medianoche UTC (fecha sin
// hora real asociada); formatear en el huso del navegador podría correr el
// día mostrado. Mismo formatter que ShowsList / ShowDetail / TourMap.
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeZone: "UTC",
});

const EMPTY_PLACEHOLDER = "Todavía no hay shows cargados.";

function StatPill({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border px-4 py-2">
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

function StatRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

// Resumen estadístico del historial de shows, mostrado arriba del Tour Map
// (ver tour/page.tsx). Puramente presentacional: recibe stats ya calculadas
// (calculateTourStats, en the-warning-tour-stats.ts) y no hace fetch. Cada
// campo puede venir en null (historial vacío) y se resuelve con un
// placeholder en vez de romper el render.
export function TourStats({ stats }: TourStatsProps) {
  const {
    totalShows,
    totalCities,
    totalCountries,
    firstShow,
    lastShow,
    topCountry,
    topCity,
  } = stats;

  return (
    <section className="flex flex-col gap-4 border-b px-4 py-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
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
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatRow label="Primer show">
          {firstShow
            ? `${dateFormatter.format(new Date(firstShow.date))} · ${firstShow.city.name}`
            : EMPTY_PLACEHOLDER}
        </StatRow>
        <StatRow label="Último show">
          {lastShow
            ? `${dateFormatter.format(new Date(lastShow.date))} · ${lastShow.city.name}`
            : EMPTY_PLACEHOLDER}
        </StatRow>
      </div>
      <StatRow label="País con más shows">
        {topCountry
          ? `${topCountry.name} · ${topCountry.showCount} ${topCountry.showCount === 1 ? "show" : "shows"}`
          : EMPTY_PLACEHOLDER}
      </StatRow>
      <StatRow label="Ciudad con más shows">
        {topCity
          ? `${topCity.name} · ${topCity.showCount} ${topCity.showCount === 1 ? "show" : "shows"}`
          : EMPTY_PLACEHOLDER}
      </StatRow>
    </section>
  );
}
