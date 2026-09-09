"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import type { Country } from "@/lib/api";
import type { TourCityOption, TourFilters } from "@/lib/tour-filters";

// Cuánto esperar sin tipeo antes de propagar la búsqueda a la URL (ver
// handleSearchChange más abajo).
const SEARCH_DEBOUNCE_MS = 300;

interface TourFiltersPanelProps {
  filters: TourFilters;
  years: number[];
  countries: Country[];
  cities: TourCityOption[];
  onChange: (filters: TourFilters) => void;
  onClear: () => void;
}

// Valor de las opciones "Todos"/"Todas" en los <select>: nunca colisiona con
// un id real (los UUID de country/city nunca son string vacío).
const ALL_VALUE = "";

const inputClassName =
  "rounded-md border border-zinc-700 bg-transparent px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400 focus:outline-none";
const labelClassName =
  "font-warning flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-zinc-400";

function hasActiveFilters(filters: TourFilters): boolean {
  return Object.values(filters).some((value) => value !== undefined && value !== "");
}

// "Avanzados" = todo menos `search`, que tiene su propio input siempre
// visible (ver advancedOpen más arriba).
const ADVANCED_FILTER_KEYS = ["year", "countryId", "cityId", "dateFrom", "dateTo"] as const;

function countActiveAdvancedFilters(filters: TourFilters): number {
  return ADVANCED_FILTER_KEYS.filter((key) => {
    const value = filters[key];
    return value !== undefined && value !== "";
  }).length;
}

function hasActiveAdvancedFilters(filters: TourFilters): boolean {
  return countActiveAdvancedFilters(filters) > 0;
}

// Panel de filtros del historial de shows (Tour Map): puramente
// presentacional/controlado (ver TourFiltersPanelProps) — no lee la URL ni
// llama a filterTourShows, sólo refleja `filters` y avisa cambios vía
// `onChange`/`onClear`. tour-explorer.tsx es el único responsable de
// convertir esos cambios en query params (ver tour-filters-url.ts) y de
// filtrar los shows.
//
// years/countries/cities siempre llegan derivados de la colección completa
// de shows (allShows, ver getAvailableYears/getAvailableCountries/
// getAvailableCities en tour-filters.ts), nunca de los ya filtrados: así
// cambiar un filtro no le esconde al usuario opciones que sigue pudiendo
// elegir. Cada ciudad se identifica por su `id` (nunca por nombre) y se
// etiqueta "Ciudad, País" para no confundir homónimos (ver
// tour-filters.test.tsx, "disambiguates cities with the same name").
export function TourFiltersPanel({
  filters,
  years,
  countries,
  cities,
  onChange,
  onClear,
}: TourFiltersPanelProps) {
  function update(partial: Partial<TourFilters>) {
    onChange({ ...filters, ...partial });
  }

  // El campo de búsqueda tiene su propio estado local en vez de leer
  // `filters.search` directo (como hacen año/país/ciudad/fechas): cada
  // `update()` dispara un router.replace en tour-explorer.tsx, y esa
  // navegación es asincrónica. Si el input quedara controlado 1:1 por
  // `filters.search`, tipear rápido dispara una navegación por tecla y,
  // en cuanto una de esas resuelve con un valor más viejo que lo que el
  // usuario ya tipeó, React pisa el input con ese valor desactualizado —
  // se "comen" letras (ver bug reportado: "tipeo y no funciona"). Acá el
  // input siempre refleja lo que se tipeó al instante, y sólo se
  // propaga a la URL con debounce.
  const [searchValue, setSearchValue] = useState(filters.search ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtros "avanzados" (todo menos Buscar) plegados por default en mobile:
  // 5 selects/inputs uno debajo del otro antes del primer resultado eran
  // demasiado scroll para llegar al historial (ver auditoría mobile). Desde
  // sm: siempre se ven en fila, sin importar este estado (ver
  // advancedFieldsClassName más abajo). Arranca abierto si ya llega algún
  // filtro avanzado activo (ej. volviendo con back/forward), para no
  // esconderle a la persona un filtro que ella misma eligió.
  const [advancedOpen, setAdvancedOpen] = useState(() => hasActiveAdvancedFilters(filters));
  const advancedFiltersCount = useMemo(() => countActiveAdvancedFilters(filters), [filters]);

  // Resincroniza cuando `filters.search` cambia por afuera del debounce
  // propio: "Limpiar filtros", back/forward, u otro filtro que también
  // pasa por handleFiltersChange.
  useEffect(() => {
    setSearchValue(filters.search ?? "");
  }, [filters.search]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      update({ search: value === "" ? undefined : value });
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleYearChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    update({ year: value === ALL_VALUE ? undefined : Number(value) });
  }

  function handleCountryChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    update({ countryId: value === ALL_VALUE ? undefined : value });
  }

  function handleCityChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    update({ cityId: value === ALL_VALUE ? undefined : value });
  }

  function handleDateFromChange(event: ChangeEvent<HTMLInputElement>) {
    update({ dateFrom: event.target.value === "" ? undefined : event.target.value });
  }

  function handleDateToChange(event: ChangeEvent<HTMLInputElement>) {
    update({ dateTo: event.target.value === "" ? undefined : event.target.value });
  }

  return (
    <section
      aria-label="Filtros del historial de shows"
      className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-3"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className={`${labelClassName} min-w-[200px] flex-1`}>
          Buscar
          <input
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            placeholder="Ciudad, país, venue o año"
            className={inputClassName}
          />
        </label>

        <button
          type="button"
          onClick={() => setAdvancedOpen((value) => !value)}
          aria-expanded={advancedOpen}
          aria-controls="tour-advanced-filters"
          className="font-warning inline-flex min-h-10 items-center justify-center gap-1.5 self-start rounded-full border border-white px-4 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-zinc-900 sm:hidden"
        >
          {advancedOpen ? "Ocultar filtros" : "Filtros"}
          {advancedFiltersCount > 0 && (
            <span
              aria-hidden="true"
              className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-black"
            >
              {advancedFiltersCount}
            </span>
          )}
        </button>

        {/* Año/País/Ciudad/Desde/Hasta + Limpiar filtros: plegados por
            default en mobile detrás del botón "Filtros" de arriba (ver
            advancedOpen). Desde sm: `sm:contents` disuelve este wrapper y
            sus hijos vuelven a ser ítems directos de la fila de filtros, con
            el mismo wrap de siempre — nunca hay una segunda implementación
            del layout desktop. */}
        <div
          id="tour-advanced-filters"
          className={`${advancedOpen ? "flex" : "hidden"} w-full flex-col gap-3 sm:contents`}
        >
          <label className={`${labelClassName} min-w-[110px]`}>
            Año
            <select
              value={filters.year !== undefined ? String(filters.year) : ALL_VALUE}
              onChange={handleYearChange}
              className={inputClassName}
            >
              <option value={ALL_VALUE}>Todos</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className={`${labelClassName} min-w-[140px]`}>
            País
            <select
              value={filters.countryId ?? ALL_VALUE}
              onChange={handleCountryChange}
              className={inputClassName}
            >
              <option value={ALL_VALUE}>Todos</option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label className={`${labelClassName} min-w-[160px]`}>
            Ciudad
            <select
              value={filters.cityId ?? ALL_VALUE}
              onChange={handleCityChange}
              className={inputClassName}
            >
              <option value={ALL_VALUE}>Todas</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}, {city.countryName}
                </option>
              ))}
            </select>
          </label>

          <label className={`${labelClassName} min-w-[130px]`}>
            Desde
            <input
              type="date"
              value={filters.dateFrom ?? ""}
              onChange={handleDateFromChange}
              className={inputClassName}
            />
          </label>

          <label className={`${labelClassName} min-w-[130px]`}>
            Hasta
            <input
              type="date"
              value={filters.dateTo ?? ""}
              onChange={handleDateToChange}
              className={inputClassName}
            />
          </label>

          <button
            type="button"
            onClick={onClear}
            disabled={!hasActiveFilters(filters)}
            className="font-warning inline-flex min-h-10 items-center justify-center rounded-full border border-white px-4 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-600 disabled:hover:bg-transparent"
          >
            Limpiar filtros
          </button>
        </div>
      </div>
    </section>
  );
}
