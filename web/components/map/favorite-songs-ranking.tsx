"use client";

import { useEffect, useState } from "react";
import {
  getCities,
  getCountries,
  getFavoriteSongsRanking,
  type CityOption,
  type Country,
  type FavoriteSongRankingEntry,
} from "@/lib/api";

type Scope = "world" | "country" | "city";
type RankingStatus = "loading" | "error" | "loaded";
type CatalogStatus = "loading" | "error" | "loaded";

const scopeButtonBaseClass =
  "font-warning rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors";
const scopeButtonActiveClass = "border-white bg-white text-black";
const scopeButtonInactiveClass = "border-white text-white hover:bg-zinc-900";
const selectClass =
  "rounded-md border border-zinc-700 bg-black px-3 py-1.5 text-sm text-white disabled:opacity-40";

// Ranking del Top 10 de favoritas (GET /fan-profiles/stats/favorite-songs),
// nunca del setlist personal — ver el pedido: el ranking del Fan Map se
// calcula EXCLUSIVAMENTE con favoriteSongs. Tres alcances (Mundial / País /
// Ciudad) que reusan los catálogos existentes de país/ciudad (mismo
// getCountries/getCities que ya usa ProfileEditor), sin agregar un filtro
// geográfico paralelo. Es un conteo simple de fans por canción, sin
// ponderar por posición dentro del Top 10 (así lo pide la v1).
export function FavoriteSongsRanking() {
  const [scope, setScope] = useState<Scope>("world");

  const [countries, setCountries] = useState<Country[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [countryId, setCountryId] = useState("");

  const [cities, setCities] = useState<CityOption[]>([]);
  const [citiesStatus, setCitiesStatus] = useState<CatalogStatus>("loaded");
  const [cityId, setCityId] = useState("");

  const [ranking, setRanking] = useState<FavoriteSongRankingEntry[]>([]);
  const [rankingStatus, setRankingStatus] = useState<RankingStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    getCountries()
      .then((loaded) => {
        if (!cancelled) {
          setCountries(loaded);
          setCatalogStatus("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) setCatalogStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // El "loading" del ranking se dispara acá, en los handlers de los
  // controles (no dentro del useEffect de más abajo: encadenar un
  // setState síncrono adentro de un efecto genera un render en cascada,
  // ver react-hooks/set-state-in-effect). Es inofensivo marcarlo aunque el
  // cambio termine en un alcance que todavía no tiene país/ciudad elegido
  // — el render nunca muestra "Cargando ranking..." mientras falte esa
  // elección (ver needsCountry/needsCity).
  function handleScopeChange(next: Scope) {
    setScope(next);
    setRankingStatus("loading");
    if (next === "world") {
      setCountryId("");
      setCityId("");
    }
  }

  function handleCountryChange(next: string) {
    setCountryId(next);
    setCityId("");
    setCities([]);
    setRankingStatus("loading");
    if (!next) {
      setCitiesStatus("loaded");
      return;
    }
    setCitiesStatus("loading");
    getCities(next)
      .then((loaded) => {
        setCities(loaded);
        setCitiesStatus("loaded");
      })
      .catch(() => setCitiesStatus("error"));
  }

  function handleCityChange(next: string) {
    setCityId(next);
    setRankingStatus("loading");
  }

  // El fetch del ranking depende del alcance elegido: Mundial siempre
  // dispara; País/Ciudad esperan a que se elija el país/ciudad (mismo
  // criterio que el select de ciudad en ProfileEditor, deshabilitado hasta
  // elegir país). Mientras falta esa elección el efecto no hace nada — el
  // render de abajo nunca muestra `ranking`/`rankingStatus` en ese caso
  // (ver needsCountry/needsCity).
  useEffect(() => {
    if (scope === "country" && !countryId) return;
    if (scope === "city" && !cityId) return;

    let cancelled = false;
    const filter =
      scope === "city" ? { cityId } : scope === "country" ? { countryId } : {};
    getFavoriteSongsRanking(filter)
      .then((loaded) => {
        if (!cancelled) {
          setRanking(loaded);
          setRankingStatus("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) setRankingStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [scope, countryId, cityId]);

  const needsCountry = scope === "country" && !countryId;
  const needsCity = scope === "city" && !cityId;

  return (
    <section className="border-t border-zinc-800 px-4 py-4">
      <h2 className="font-warning mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
        Ranking Top 10
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Alcance del ranking" className="flex flex-wrap gap-2">
          {(
            [
              ["world", "Mundial"],
              ["country", "País"],
              ["city", "Ciudad"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-current={scope === value ? "true" : undefined}
              onClick={() => handleScopeChange(value)}
              className={`${scopeButtonBaseClass} ${
                scope === value ? scopeButtonActiveClass : scopeButtonInactiveClass
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {(scope === "country" || scope === "city") && (
          <div className="flex flex-col gap-1">
            <label htmlFor="ranking-country" className="sr-only">
              País
            </label>
            <select
              id="ranking-country"
              className={selectClass}
              value={countryId}
              disabled={catalogStatus === "loading"}
              onChange={(e) => handleCountryChange(e.target.value)}
            >
              <option value="">
                {catalogStatus === "loading" ? "Cargando países..." : "Seleccioná un país"}
              </option>
              {countries.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {scope === "city" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="ranking-city" className="sr-only">
              Ciudad
            </label>
            <select
              id="ranking-city"
              className={selectClass}
              value={cityId}
              disabled={!countryId || citiesStatus === "loading"}
              onChange={(e) => handleCityChange(e.target.value)}
            >
              <option value="">
                {!countryId
                  ? "Seleccioná un país primero"
                  : citiesStatus === "loading"
                    ? "Cargando ciudades..."
                    : "Seleccioná una ciudad"}
              </option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mt-3">
        {catalogStatus === "error" && (
          <p role="alert" className="text-sm text-red-400">
            No pudimos cargar los países. Intentá de nuevo más tarde.
          </p>
        )}

        {needsCountry && (
          <p className="text-sm text-zinc-400">Elegí un país para ver su ranking.</p>
        )}

        {needsCity && !needsCountry && (
          <p className="text-sm text-zinc-400">Elegí una ciudad para ver su ranking.</p>
        )}

        {!needsCountry && !needsCity && rankingStatus === "loading" && (
          <p className="text-sm text-zinc-400">Cargando ranking...</p>
        )}

        {!needsCountry && !needsCity && rankingStatus === "error" && (
          <p role="alert" className="text-sm text-red-400">
            No pudimos cargar el ranking. Intentá de nuevo más tarde.
          </p>
        )}

        {!needsCountry && !needsCity && rankingStatus === "loaded" && ranking.length === 0 && (
          <p className="text-sm text-zinc-400">Todavía no hay favoritas cargadas acá.</p>
        )}

        {!needsCountry && !needsCity && rankingStatus === "loaded" && ranking.length > 0 && (
          <ol className="flex flex-col gap-1 text-sm">
            {ranking.map((entry, index) => (
              <li key={entry.songId}>
                {index + 1}. {entry.title} — {entry.count} {entry.count === 1 ? "fan" : "fans"}
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
