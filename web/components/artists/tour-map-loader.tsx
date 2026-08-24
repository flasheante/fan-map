"use client";

import dynamic from "next/dynamic";
import type { TourCity } from "@/lib/the-warning-tour-map";

// Leaflet accede a `window` al importarse, por lo que el mapa solo puede
// cargarse en el cliente. `next/dynamic` con `ssr: false` solo puede
// invocarse desde un Client Component, de ahí este wrapper (mismo patrón
// que components/map/fan-map-loader.tsx).
const TourMap = dynamic(
  () => import("./tour-map").then((mod) => mod.TourMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <p>Cargando mapa...</p>
      </div>
    ),
  },
);

interface TourMapLoaderProps {
  cities: TourCity[];
}

export function TourMapLoader({ cities }: TourMapLoaderProps) {
  return <TourMap cities={cities} />;
}
