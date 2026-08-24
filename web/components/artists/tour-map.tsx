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
import type { TourCity } from "@/lib/the-warning-tour-map";

const DEFAULT_ZOOM = 2;
const SINGLE_CITY_ZOOM = 10;

// timeZone: "UTC" porque show.date llega como medianoche UTC (fecha sin
// hora real asociada); formatear en el huso del navegador podría correr el
// día mostrado. Mismo formatter que ShowsList / ShowDetail.
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeZone: "UTC",
});

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
      {cities.map((city) => (
        <Marker key={city.id} position={[city.latitude, city.longitude]}>
          <Popup>
            <div className="flex flex-col gap-1">
              <strong>{city.name}</strong>
              <span>{city.country.name}</span>
              <span>
                {city.shows.length}{" "}
                {city.shows.length === 1 ? "show" : "shows"}
              </span>
              <ul className="mt-2 flex flex-col gap-2">
                {city.shows.map((show) => (
                  <li key={show.id} className="flex flex-col">
                    <span>{dateFormatter.format(new Date(show.date))}</span>
                    <span>{show.venue ?? "Venue a confirmar"}</span>
                    <Link
                      href={`/artists/the-warning/shows/${show.id}`}
                      className="underline underline-offset-2"
                    >
                      Ver show →
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
