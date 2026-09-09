"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { JoinOrProfileLink } from "./join-or-profile-link";

const navLinkClass =
  "rounded-full border border-white px-5 py-2.5 transition-colors hover:bg-zinc-900";

interface NavLink {
  href: string;
  label: string;
}

const LINKS: NavLink[] = [
  { href: "/artists/the-warning/tour", label: "Historial de shows" },
  { href: "/map?view=fans", label: "Fan Map" },
];

// Nav del header de /artists/the-warning. En sm+ se ven los tres links en
// fila (Historial de shows, Fan Map, Join/Profile), como antes. Por debajo
// de sm, "Historial de shows" y "Fan Map" ya no entran en una fila sin
// comerse buena parte de la primera pantalla del celular (ver auditoría
// mobile) — quedan detrás de un botón de menú de 44px (tamaño táctil
// recomendado) y sólo el CTA principal (JoinOrProfileLink) queda siempre
// visible.
export function ArtistNav() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={containerRef}
      className="font-warning relative flex items-center gap-3 text-sm font-bold uppercase tracking-wide"
    >
      <div className="hidden items-center gap-3 sm:flex">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={navLinkClass}>
            {link.label}
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="artist-nav-menu"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-white sm:hidden"
      >
        <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <path d="M3 5.5h14M3 10h14M3 14.5h14" />
        </svg>
      </button>

      <JoinOrProfileLink />

      {open && (
        <div
          id="artist-nav-menu"
          className="absolute right-0 top-full z-10 mt-2 flex w-56 flex-col gap-1 rounded-2xl border border-zinc-800 bg-black p-2 sm:hidden"
        >
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-left transition-colors hover:bg-zinc-900"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
