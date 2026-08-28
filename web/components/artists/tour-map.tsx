"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L, { type LatLngBoundsExpression, type LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { getTourCityDateRange, type TourCity } from "@/lib/the-warning-tour-map";
import { formatShowDate } from "@/lib/format-show-date";

const DEFAULT_ZOOM = 2;
const SINGLE_CITY_ZOOM = 10;

function FitBounds({ cities }: { cities: TourCity[] }) {
  const map = useMap();

  useEffect(() => {
    if (cities.length === 0) return;

    if (cities.length === 1) {
      const city = cities[0];
      map.setView([city.latitude, city.longitude], SINGLE_CITY_ZOOM);
      return;
    }

    const bounds: LatLngBoundsExpression = cities.map(
      (city): LatLngTuple => [city.latitude, city.longitude],
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [cities, map]);

  return null;
}

interface TourMapProps {
  cities: TourCity[];
}

// Este componente solo se carga en el cliente (ver tour-map-loader.tsx, que
// lo importa con next/dynamic y ssr: false): Leaflet accede a `window` al
// importarse, así que no puede evaluarse durante el server-render. Un
// marcador representa una ciudad (ya agrupada por city.id en
// getTheWarningTourMapData), no un show: el popup lista todos los shows de
// esa ciudad y linkea cada uno a su detalle
// (/artists/the-warning/shows/:showId), que a su vez muestra el setlist.
export function TourMap({ cities }: TourMapProps) {
  useEffect(() => {
    delete (
      L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown }
    )._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "/leaflet/marker-icon-2x.png",
      iconUrl: "/leaflet/marker-icon.png",
      shadowUrl: "/leaflet/marker-shadow.png",
    });
  }, []);

  if (cities.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p>Todavía no hay ciudades con shows en el mapa.</p>
      </div>
    );
  }

  const center: LatLngTuple = [cities[0].latitude, cities[0].longitude];

  return (
    <MapContainer
      center={center}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds cities={cities} />
      {cities.map((city) => {
        const { firstShow, lastShow } = getTourCityDateRange(city.shows);
        const showCount = city.shows.length;

        return (
          <Marker key={city.id} position={[city.latitude, city.longitude]}>
            <Popup>
              <div className="flex flex-col gap-2 text-sm">
                <div>
                  <strong className="text-base">{city.name}</strong>
                  <div>{city.country.name}</div>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {showCount} {showCount === 1 ? "show" : "shows"}
                  </span>
                  {firstShow && lastShow ? (
                    showCount === 1 ? (
                      <span>{formatShowDate(firstShow.date)}</span>
                    ) : (
                      <span>
                        {formatShowDate(firstShow.date)} →{" "}
                        {formatShowDate(lastShow.date)}
                      </span>
                    )
                  ) : (
                    <span>Sin shows registrados</span>
                  )}
                </div>

                {/* Sólo se etiqueta "Último show" cuando hay más de uno: con
                    un único show ya está cubierto por el bloque de arriba y
                    repetir la fecha sería redundante (ver reglas del
                    slice). */}
                {lastShow && showCount > 1 && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Último show
                    </span>
                    <span>{formatShowDate(lastShow.date)}</span>
                    <span>
                      {lastShow.venue ?? "Venue a confirmar"} · {city.name}
                    </span>
                  </div>
                )}
                {lastShow && showCount === 1 && (
                  <span>{lastShow.venue ?? "Venue a confirmar"} · {city.name}</span>
                )}

                <Link
                  href={`/artists/the-warning/tour/${city.id}`}
                  className="text-xs font-semibold uppercase tracking-wide underline underline-offset-2"
                >
                  Ver historial →
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
