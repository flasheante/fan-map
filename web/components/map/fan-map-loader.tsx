"use client";

import dynamic from "next/dynamic";
import type { FanProfileOnMap } from "@/lib/api";

// Leaflet accede a `window` al importarse, por lo que el mapa solo puede
// cargarse en el cliente. `next/dynamic` con `ssr: false` solo puede
// invocarse desde un Client Component, de ahí este wrapper.
const FanMap = dynamic(
  () => import("./fan-map").then((mod) => mod.FanMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <p>Cargando mapa...</p>
      </div>
    ),
  },
);

interface FanMapLoaderProps {
  fans: FanProfileOnMap[];
}

export function FanMapLoader({ fans }: FanMapLoaderProps) {
  return <FanMap fans={fans} />;
}
