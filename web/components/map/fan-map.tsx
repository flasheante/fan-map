"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L, { type LatLngBoundsExpression, type LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ArtistFan } from "@/lib/api";

const DEFAULT_ZOOM = 2;
const SINGLE_FAN_ZOOM = 10;

function FitBounds({ fans }: { fans: ArtistFan[] }) {
  const map = useMap();

  useEffect(() => {
    if (fans.length === 0) return;

    if (fans.length === 1) {
      const fan = fans[0];
      map.setView([fan.city.latitude, fan.city.longitude], SINGLE_FAN_ZOOM);
      return;
    }

    const bounds: LatLngBoundsExpression = fans.map(
      (fan): LatLngTuple => [fan.city.latitude, fan.city.longitude],
    );
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [fans, map]);

  return null;
}

interface FanMapProps {
  fans: ArtistFan[];
}

// Este componente solo se carga en el cliente (ver app/map/page.tsx, que lo
// importa con next/dynamic y ssr: false): Leaflet accede a `window` al
// importarse, así que no puede evaluarse durante el server-render.
export function FanMap({ fans }: FanMapProps) {
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

  // El caller ya pide GET /artists/:artistId/fans?onMap=true (ver
  // getArtistFans en lib/api.ts), que en el backend filtra por showOnMap +
  // ciudad con coordenadas. Este filtro es una segunda barrera, no la
  // primera: el Fan Map nunca debe confiar en que todo lo que le llega ya
  // es público, así que jamás pinta un marker para showOnMap=false aunque
  // por lo que sea llegara uno.
  const visibleFans = fans.filter((fan) => fan.showOnMap);

  if (visibleFans.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p>Todavía no hay fans visibles en el mapa.</p>
      </div>
    );
  }

  const center: LatLngTuple = [
    visibleFans[0].city.latitude,
    visibleFans[0].city.longitude,
  ];

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
      <FitBounds fans={visibleFans} />
      {visibleFans.map((fan) => (
        <Marker
          key={fan.id}
          position={[fan.city.latitude, fan.city.longitude]}
        >
          <Popup>
            <strong>{fan.displayName}</strong>
            <br />
            {fan.city.name}, {fan.city.country.name}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
