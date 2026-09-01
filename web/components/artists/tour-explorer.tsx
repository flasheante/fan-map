"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Artist, ArtistShow } from "@/lib/api";
import { groupShowsByCity } from "@/lib/the-warning-tour-map";
import { calculateTourStats } from "@/lib/the-warning-tour-stats";
import {
  filterTourShows,
  getAvailableCities,
  getAvailableCountries,
  getAvailableYears,
  type TourFilters,
} from "@/lib/tour-filters";
import {
  parseTourFiltersFromSearchParams,
  tourFiltersToQueryString,
} from "@/lib/tour-filters-url";
import { ShowsList } from "./shows-list";
import { TheWarningLogo } from "./the-warning-logo";
import { TourFiltersPanel } from "./tour-filters";
import { TourMapLoader } from "./tour-map-loader";
import { TourStatsRankings, TourStatsSummary } from "./tour-stats";

interface TourExplorerProps {
  artist: Artist;
  shows: ArtistShow[];
}

// Cliente del historial de shows (/artists/the-warning/tour): recibe
// `shows` ya resuelto por el Server Component (tour/page.tsx, un único GET
// /artists/:artistId/shows) y hace todo lo demás en el cliente, sin ningún
// fetch adicional por cambio de filtro.
//
// La URL es la única fuente de verdad de los filtros (ver
// tour-filters-url.ts): no hay useState para `filters`, cada cambio se
// traduce a router.replace(...) y el siguiente render vuelve a leer
// useSearchParams(). Eso evita el loop URL → state → URL descrito en el
// pedido: sólo hay un sentido (interacción → URL → filtros derivados), y
// router.replace (nunca push) para no llenar el historial con cada
// tecleo/selección.
//
// Pipeline (ver el pedido de la Etapa C/D/E): allShows → filterTourShows →
// filteredShows → groupShowsByCity → TourCity[] → TourMap. Nunca se agrupa
// antes de filtrar.
export function TourExplorer({ artist, shows }: TourExplorerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseTourFiltersFromSearchParams(searchParams),
    [searchParams],
  );

  // Los catálogos de los selectores siempre salen de `shows` completo
  // (allShows), nunca de filteredShows: ver TourFiltersPanel, así el
  // usuario no queda atrapado en una combinación imposible.
  const years = useMemo(() => getAvailableYears(shows), [shows]);
  const countries = useMemo(() => getAvailableCountries(shows), [shows]);
  const cities = useMemo(() => getAvailableCities(shows), [shows]);

  const filteredShows = useMemo(
    () => filterTourShows(shows, filters),
    [shows, filters],
  );
  const mapCities = useMemo(() => groupShowsByCity(filteredShows), [filteredShows]);
  const stats = useMemo(() => calculateTourStats(filteredShows), [filteredShows]);

  const handleFiltersChange = useCallback(
    (next: TourFilters) => {
      const query = tourFiltersToQueryString(next);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const handleClear = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  const hasAnyShows = shows.length > 0;
  const hasFilteredShows = filteredShows.length > 0;
  const isFiltered = Object.keys(filters).length > 0;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
        <h1 className="flex items-center gap-3">
          <TheWarningLogo height={28} />
          <span className="font-warning text-sm font-bold uppercase tracking-wide text-zinc-400">
            Tour Map
          </span>
        </h1>
        <p className="text-sm text-zinc-400">
          {stats.totalCities} {stats.totalCities === 1 ? "ciudad" : "ciudades"}
          {isFiltered && hasAnyShows && (
            <>
              {" "}
              · {filteredShows.length} de {shows.length}{" "}
              {shows.length === 1 ? "show" : "shows"}
            </>
          )}
        </p>
      </header>

      <TourFiltersPanel
        filters={filters}
        years={years}
        countries={countries}
        cities={cities}
        onChange={handleFiltersChange}
        onClear={handleClear}
      />

      <TourStatsSummary stats={stats} />

      <div className="min-h-[60vh] flex-1">
        <TourMapLoader cities={mapCities} />
      </div>

      {!hasAnyShows && (
        <p className="border-t border-zinc-800 px-4 py-3 text-center text-sm text-zinc-400">
          Todavía no hay ciudades con shows de {artist.name} en el mapa.
        </p>
      )}

      {hasAnyShows && !hasFilteredShows && (
        <div className="flex flex-col items-center gap-2 border-t border-zinc-800 px-4 py-6 text-center text-sm text-zinc-400">
          <p>Ningún show de {artist.name} coincide con estos filtros.</p>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-semibold uppercase tracking-wide underline underline-offset-2"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      <TourStatsRankings stats={stats} />

      <section className="border-t border-zinc-800">
        <h2 className="font-warning px-4 pt-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
          Shows
        </h2>
        <ShowsList shows={filteredShows} />
      </section>
    </>
  );
}
