"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  getArtists,
  getArtistSongs,
  getCities,
  getCountries,
  getMyFanProfile,
  updateFanProfile,
  type ArtistSong,
  type Artist,
  type CityOption,
  type Country,
  type FanProfile,
  type SongListItemInput,
} from "@/lib/api";
import { findArtistBySlug, THE_WARNING_SLUG } from "@/lib/the-warning-fan-map";
import { SongListEditor } from "./song-list-editor";
import { SocialLinksEditor, type SocialLinksValue } from "./social-links-editor";

const MAX_SETLIST_SONGS = 15;
const MAX_FAVORITE_SONGS = 10;

type LoadStatus = "loading" | "error" | "no-profile" | "ready";
type SaveStatus = "idle" | "saving" | "error" | "success";
type CitiesStatus = "idle" | "loading" | "loaded" | "error";

const labelClass = "text-sm font-medium";
const inputClass =
  "rounded-md border border-zinc-700 bg-black px-3 py-2 text-white placeholder:text-zinc-500";
const errorClass = "text-sm text-red-400";
const pillPrimaryClass =
  "font-warning rounded-full bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60";
const pillSecondaryClass =
  "font-warning rounded-full border border-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60";

function toSocialLinksValue(profile: FanProfile): SocialLinksValue {
  return {
    instagramUrl: profile.instagramUrl,
    instagramIsPublic: profile.instagramIsPublic,
    tiktokUrl: profile.tiktokUrl,
    tiktokIsPublic: profile.tiktokIsPublic,
    xUrl: profile.xUrl,
    xIsPublic: profile.xIsPublic,
    youtubeUrl: profile.youtubeUrl,
    youtubeIsPublic: profile.youtubeIsPublic,
    facebookUrl: profile.facebookUrl,
    facebookIsPublic: profile.facebookIsPublic,
  };
}

// Mismo mapper para las dos listas (mismo shape en ambas, ver
// FanSongListItem en lib/api.ts) — setlist y favoritas son
// independientes, pero se leen del FanProfile de la misma forma.
function toSongListItemInputs(items: FanProfile["setlistSongs"]): SongListItemInput[] {
  return items.map((item) => ({ songId: item.id, position: item.position }));
}

// Editor del propio perfil de fan (/profile): carga el FanProfile del User
// autenticado (GET /fan-profiles/me) más el catálogo canónico de canciones
// de The Warning (GET /artists/:artistId/songs, nunca un catálogo
// paralelo) y arma un único PATCH /fan-profiles/:id al guardar — mismo
// patrón "reemplazo completo" que ya usa artistIds para favoriteSongs (ver
// FanProfilesService en el backend).
//
// Solo se monta cuando useAuth().status === "authenticated" (ver
// app/profile/page.tsx) — acá adentro no hay que volver a chequear eso.
export function ProfileEditor() {
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("loading");
  const [countries, setCountries] = useState<Country[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [songs, setSongs] = useState<ArtistSong[]>([]);
  const [profile, setProfile] = useState<FanProfile | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [countryId, setCountryId] = useState("");
  const [cities, setCities] = useState<CityOption[]>([]);
  const [citiesStatus, setCitiesStatus] = useState<CitiesStatus>("idle");
  const [cityId, setCityId] = useState("");
  const [showOnMap, setShowOnMap] = useState(false);
  const [selectedArtistIds, setSelectedArtistIds] = useState<string[]>([]);
  // Dos estados completamente separados — nunca se leen ni se escriben
  // entre sí, mismo criterio de independencia que el backend (ver el
  // pedido: "no mezclar los componentes ni el estado de las dos listas").
  const [setlistSongs, setSetlistSongs] = useState<SongListItemInput[]>([]);
  const [favoriteSongs, setFavoriteSongs] = useState<SongListItemInput[]>([]);
  const [social, setSocial] = useState<SocialLinksValue>({
    instagramUrl: null,
    instagramIsPublic: false,
    tiktokUrl: null,
    tiktokIsPublic: false,
    xUrl: null,
    xIsPublic: false,
    youtubeUrl: null,
    youtubeIsPublic: false,
    facebookUrl: null,
    facebookIsPublic: false,
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  function applyProfile(loaded: FanProfile, allCountries: Country[]) {
    setProfile(loaded);
    setDisplayName(loaded.displayName);
    setCountryId(loaded.city.country.id);
    setCityId(loaded.city.id);
    setShowOnMap(loaded.showOnMap);
    setSelectedArtistIds(loaded.artists.map((a) => a.id));
    setSetlistSongs(toSongListItemInputs(loaded.setlistSongs));
    setFavoriteSongs(toSongListItemInputs(loaded.favoriteSongs));
    setSocial(toSocialLinksValue(loaded));

    const country = allCountries.find((c) => c.id === loaded.city.country.id);
    if (country) {
      getCities(country.id)
        .then((loadedCities) => {
          setCities(loadedCities);
          setCitiesStatus("loaded");
        })
        .catch(() => setCitiesStatus("error"));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [loadedCountries, loadedArtists, myProfile] = await Promise.all([
          getCountries(),
          getArtists(),
          getMyFanProfile(),
        ]);
        if (cancelled) return;

        setCountries(loadedCountries);
        setArtists(loadedArtists);

        if (!myProfile) {
          setLoadStatus("no-profile");
          return;
        }

        const theWarning = findArtistBySlug(loadedArtists, THE_WARNING_SLUG);
        const loadedSongs = theWarning ? await getArtistSongs(theWarning.id) : [];
        if (cancelled) return;

        setSongs(loadedSongs);
        applyProfile(myProfile, loadedCountries);
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
      .catch(() => setCitiesStatus("error"));
  }

  function toggleArtist(artistId: string) {
    setSelectedArtistIds((prev) =>
      prev.includes(artistId) ? prev.filter((id) => id !== artistId) : [...prev, artistId],
    );
  }

  function handleCancel() {
    if (!profile) return;
    applyProfile(profile, countries);
    setSaveStatus("idle");
    setSaveError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    setSaveStatus("saving");
    setSaveError(null);

    try {
      const updated = await updateFanProfile(profile.id, {
        displayName: displayName.trim(),
        cityId,
        showOnMap,
        artistIds: selectedArtistIds,
        setlistSongs,
        favoriteSongs,
        instagramUrl: social.instagramUrl,
        instagramIsPublic: social.instagramIsPublic,
        tiktokUrl: social.tiktokUrl,
        tiktokIsPublic: social.tiktokIsPublic,
        xUrl: social.xUrl,
        xIsPublic: social.xIsPublic,
        youtubeUrl: social.youtubeUrl,
        youtubeIsPublic: social.youtubeIsPublic,
        facebookUrl: social.facebookUrl,
        facebookIsPublic: social.facebookIsPublic,
      });
      applyProfile(updated, countries);
      setSaveStatus("success");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
      setSaveStatus("error");
    }
  }

  if (loadStatus === "loading") {
    return <p className="px-4 py-6 text-zinc-400">Cargando tu perfil...</p>;
  }

  if (loadStatus === "error") {
    return (
      <p role="alert" className="px-4 py-6 text-red-400">
        No pudimos cargar tu perfil. Intentá de nuevo más tarde.
      </p>
    );
  }

  if (loadStatus === "no-profile") {
    return (
      <div className="flex flex-col gap-3 px-4 py-6">
        <p className="text-zinc-400">Todavía no sos parte del mapa.</p>
        <Link href="/join" className={`${pillPrimaryClass} inline-block w-fit`}>
          Sumate al mapa
        </Link>
      </div>
    );
  }

  const isSaving = saveStatus === "saving";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-4 py-6">
      {profile?.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- URL arbitraria de Google, no configurada en next/image.
        <img
          src={profile.photoUrl}
          alt={`Foto de perfil de ${profile.displayName}`}
          className="h-20 w-20 rounded-full object-cover"
        />
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="profile-displayName" className={labelClass}>
          Nombre
        </label>
        <input
          id="profile-displayName"
          type="text"
          className={inputClass}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="profile-country" className={labelClass}>
          País
        </label>
        <select
          id="profile-country"
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
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="profile-city" className={labelClass}>
          Ciudad
        </label>
        <select
          id="profile-city"
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
      </div>

      <label htmlFor="profile-showOnMap" className="flex items-center gap-2 text-sm">
        <input
          id="profile-showOnMap"
          type="checkbox"
          checked={showOnMap}
          onChange={(e) => setShowOnMap(e.target.checked)}
        />
        Mostrarme en el mapa
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Artistas</legend>
        {artists.map((artist) => (
          <label
            key={artist.id}
            htmlFor={`profile-artist-${artist.id}`}
            className="flex items-center gap-2 text-sm"
          >
            <input
              id={`profile-artist-${artist.id}`}
              type="checkbox"
              checked={selectedArtistIds.includes(artist.id)}
              onChange={() => toggleArtist(artist.id)}
            />
            {artist.name}
          </label>
        ))}
      </fieldset>

      <SongListEditor
        songs={songs}
        value={setlistSongs}
        onChange={setSetlistSongs}
        maxItems={MAX_SETLIST_SONGS}
        idPrefix="setlist"
        title="Mi Setlist"
        description="Elegí hasta 15 canciones que te gustaría escuchar en un show."
        positionLabel={(position) => `Canción ${position}`}
      />

      <SongListEditor
        songs={songs}
        value={favoriteSongs}
        onChange={setFavoriteSongs}
        maxItems={MAX_FAVORITE_SONGS}
        idPrefix="favorite"
        title="Mis Favoritas — Top 10"
        description="Elegí tus 10 canciones favoritas de The Warning."
        positionLabel={(position) => `Top ${position}`}
      />

      <SocialLinksEditor value={social} onChange={setSocial} />

      {saveStatus === "error" && saveError && (
        <p role="alert" className={errorClass}>
          No pudimos guardar tu perfil: {saveError}
        </p>
      )}
      {saveStatus === "success" && (
        <p role="status" className="text-sm text-zinc-400">
          Perfil guardado.
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={isSaving} className={pillPrimaryClass}>
          {isSaving ? "Guardando..." : "Guardar"}
        </button>
        <button type="button" onClick={handleCancel} disabled={isSaving} className={pillSecondaryClass}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
