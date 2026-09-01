"use client";

import type { ChangeEvent } from "react";
import type { Country } from "@/lib/api";
import type { TourCityOption, TourFilters } from "@/lib/tour-filters";

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

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    update({ search: event.target.value === "" ? undefined : event.target.value });
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
            value={filters.search ?? ""}
            onChange={handleSearchChange}
            placeholder="Ciudad, país, venue o año"
            className={inputClassName}
          />
        </label>

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
          className="font-warning rounded-full border border-white px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-600 disabled:hover:bg-transparent"
        >
          Limpiar filtros
        </button>
      </div>
    </section>
  );
}
