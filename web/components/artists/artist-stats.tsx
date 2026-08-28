import type { ArtistStats } from "@/lib/api";

interface ArtistStatsSummaryProps {
  stats: ArtistStats;
}

const STAT_ITEMS: { key: keyof ArtistStats; label: string }[] = [
  { key: "fans", label: "Fans" },
  { key: "countries", label: "Países" },
  { key: "cities", label: "Ciudades" },
  { key: "shows", label: "Shows" },
  { key: "songs", label: "Canciones" },
];

// Componente puramente presentacional: recibe el ArtistStats ya resuelto
// (ver getTheWarningStatsData) y no hace fetch ni conoce el artista. Todos
// los valores se muestran siempre, incluido 0 — no hay estado vacío propio,
// a diferencia de ShowsList: un artista sin datos simplemente tiene ceros.
export function ArtistStatsSummary({ stats }: ArtistStatsSummaryProps) {
  return (
    <dl className="grid grid-cols-3 gap-4 border-t border-zinc-800 px-4 py-3 sm:grid-cols-5">
      {STAT_ITEMS.map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center gap-1 text-center">
          <dd className="text-xl font-semibold">{stats[key]}</dd>
          <dt className="font-warning text-xs font-bold uppercase tracking-wide text-zinc-400">
            {label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
