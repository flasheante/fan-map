"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createFanProfile,
  getArtists,
  getCities,
  getCountries,
  type Artist,
  type CityOption,
  type Country,
} from "@/lib/api";
import { findArtistBySlug, THE_WARNING_SLUG } from "@/lib/the-warning-fan-map";

type LoadStatus = "loading" | "error" | "ready";
type CitiesStatus = "idle" | "loading" | "loaded" | "error";
type SubmitStatus = "idle" | "submitting" | "error" | "success";

interface FormErrors {
  displayName?: string;
  country?: string;
  city?: string;
  artists?: string;
}

export function FanForm() {
  const router = useRouter();
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [countries, setCountries] = useState<Country[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);

  const [countryId, setCountryId] = useState("");
  const [cities, setCities] = useState<CityOption[]>([]);
  const [citiesStatus, setCitiesStatus] = useState<CitiesStatus>("idle");
  const [cityId, setCityId] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([]);
  const [showOnMap, setShowOnMap] = useState(true);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedCountries, loadedArtists] = await Promise.all([
          getCountries(),
          getArtists(),
        ]);
        if (cancelled) return;

        setCountries(loadedCountries);
        setArtists(loadedArtists);

        const theWarning = findArtistBySlug(loadedArtists, THE_WARNING_SLUG);
        if (theWarning) {
          setSelectedArtistIds([theWarning.id]);
        }

        setLoadStatus("ready");
      } catch {
        if (!cancelled) setLoadStatus("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCountryChange(newCountryId: string) {
    setCountryId(newCountryId);
    setCityId("");
    setCities([]);
    setErrors((prev) => ({ ...prev, city: undefined }));

    if (!newCountryId) {
      setCitiesStatus("idle");
      return;
    }

    setCitiesStatus("loading");
    getCities(newCountryId)
      .then((loadedCities) => {
        setCities(loadedCities);
        setCitiesStatus("loaded");
      })
      .catch(() => {
        setCitiesStatus("error");
      });
  }

  // Cambio de navegabilidad: primer ingreso → perfil creado → /profile
  // directo, sin pantalla intermedia con link al mapa. Desde /profile la
  // persona sale al fan map (con o sin cambios de setlist/favoritas) — ver
  // el botón "Ir al mapa" en ProfileEditor.
  useEffect(() => {
    if (submitStatus === "success") {
      router.replace("/profile");
    }
  }, [submitStatus, router]);

  function toggleArtist(artistId: string) {
    setSelectedArtistIds((prev) =>
      prev.includes(artistId)
        ? prev.filter((id) => id !== artistId)
        : [...prev, artistId],
    );
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!displayName.trim()) {
      nextErrors.displayName = "Ingresá tu nombre.";
    }
    if (!countryId) {
      nextErrors.country = "Elegí tu país.";
    }
    if (!cityId) {
      nextErrors.city = "Elegí tu ciudad.";
    }
    if (selectedArtistIds.length === 0) {
      nextErrors.artists = "Seleccioná al menos un artista.";
    }
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitStatus("submitting");
    setSubmitError(null);

    try {
      await createFanProfile({
        displayName: displayName.trim(),
        cityId,
        showOnMap,
        artistIds: selectedArtistIds,
      });
      setSubmitStatus("success");
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ocurrió un error inesperado.",
      );
      setSubmitStatus("error");
    }
  }

  if (loadStatus === "loading") {
    return <p className="text-zinc-600 dark:text-zinc-400">Cargando formulario...</p>;
  }

  if (loadStatus === "error") {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        No pudimos cargar el formulario. Intentá de nuevo más tarde.
      </p>
    );
  }

  if (submitStatus === "success") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">¡Listo!</h2>
        <p className="text-zinc-600 dark:text-zinc-400">
          Tu perfil se creó correctamente. Te llevamos a tu perfil...
        </p>
      </div>
    );
  }

  const isSubmitting = submitStatus === "submitting";
  const labelClass = "text-sm font-medium";
  const inputClass =
    "rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";
  const errorClass = "text-sm text-red-600 dark:text-red-400";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="displayName" className={labelClass}>
          Nombre
        </label>
        <input
          id="displayName"
          type="text"
          className={inputClass}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        {errors.displayName && (
          <p role="alert" className={errorClass}>
            {errors.displayName}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="country" className={labelClass}>
          País
        </label>
        <select
          id="country"
          className={inputClass}
          value={countryId}
          onChange={(e) => handleCountryChange(e.target.value)}
        >
          <option value="">Seleccioná un país</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </select>
        {errors.country && (
          <p role="alert" className={errorClass}>
            {errors.country}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="city" className={labelClass}>
          Ciudad
        </label>
        {citiesStatus === "loaded" && cities.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No hay ciudades disponibles para este país.
          </p>
        ) : (
          <select
            id="city"
            className={inputClass}
            value={cityId}
            disabled={!countryId || citiesStatus === "loading"}
            onChange={(e) => setCityId(e.target.value)}
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
        )}
        {errors.city && (
          <p role="alert" className={errorClass}>
            {errors.city}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Artistas</legend>
        {artists.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No hay artistas disponibles en este momento.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {artists.map((artist) => (
              <label
                key={artist.id}
                htmlFor={`artist-${artist.id}`}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  id={`artist-${artist.id}`}
                  type="checkbox"
                  checked={selectedArtistIds.includes(artist.id)}
                  onChange={() => toggleArtist(artist.id)}
                />
                {artist.name}
              </label>
            ))}
          </div>
        )}
        {errors.artists && (
          <p role="alert" className={errorClass}>
            {errors.artists}
          </p>
        )}
      </fieldset>

      <div>
        <label htmlFor="showOnMap" className="flex items-center gap-2 text-sm">
          <input
            id="showOnMap"
            type="checkbox"
            checked={showOnMap}
            onChange={(e) => setShowOnMap(e.target.checked)}
          />
          Mostrarme en el mapa
        </label>
      </div>

      {submitStatus === "error" && submitError && (
        <p role="alert" className={errorClass}>
          No pudimos crear tu perfil: {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-foreground px-5 py-2.5 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isSubmitting ? "Enviando..." : "Crear perfil de fan"}
      </button>
    </form>
  );
}
