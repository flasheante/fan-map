"use client";

import Link from "next/link";
import type { MapView } from "@/lib/map-view";

interface MapViewToggleProps {
  activeView: MapView;
  tourHref: string;
  fansHref: string;
}

const baseButtonClassName =
  "font-warning rounded-full border px-5 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors";
const activeButtonClassName = "border-white bg-white text-black";
const inactiveButtonClassName =
  "border-white text-white hover:bg-zinc-900";

// Selector de vista de /map (Historial / Fan Map), mismo lenguaje visual que
// los botones de /artists/the-warning (rounded-full, font-warning). Es
// puramente presentacional: recibe los hrefs ya calculados por map-view.ts
// (ver map-explorer.tsx) y no lee ni escribe la URL por su cuenta. Usa
// `<Link replace>` en lugar de router.push/replace manual: nunca agrega una
// entrada al historial al cambiar de vista, como pide el pedido.
export function MapViewToggle({ activeView, tourHref, fansHref }: MapViewToggleProps) {
  return (
    <nav
      aria-label="Vista del mapa"
      className="flex flex-wrap gap-3 border-b border-zinc-800 px-4 py-3"
    >
      <Link
        href={tourHref}
        replace
        aria-current={activeView === "tour" ? "page" : undefined}
        className={`${baseButtonClassName} ${
          activeView === "tour" ? activeButtonClassName : inactiveButtonClassName
        }`}
      >
        Historial
      </Link>
      <Link
        href={fansHref}
        replace
        aria-current={activeView === "fans" ? "page" : undefined}
        className={`${baseButtonClassName} ${
          activeView === "fans" ? activeButtonClassName : inactiveButtonClassName
        }`}
      >
        Fan Map
      </Link>
    </nav>
  );
}
