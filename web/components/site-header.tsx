"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { TheWarningLogo } from "@/components/artists/the-warning-logo";

export type SiteSection = "tour" | "fans" | "profile" | null;

// Sección activa del header según la URL. Sólo usa el pathname (no los
// query params) para no necesitar useSearchParams, que en las páginas ISR
// obligaría a envolver el header en Suspense y lo sacaría del HTML estático.
// /artists/the-warning (la home del artista) no marca ninguna: se llega por
// el logo.
export function getActiveSection(pathname: string): SiteSection {
  if (
    pathname.startsWith("/artists/the-warning/tour") ||
    pathname.startsWith("/artists/the-warning/shows")
  ) {
    return "tour";
  }
  if (pathname === "/map" || pathname.startsWith("/map/")) return "fans";
  if (pathname === "/profile" || pathname === "/join") return "profile";
  return null;
}

const NAV_LINKS = [
  { section: "tour", href: "/artists/the-warning/tour", label: "Historial de shows" },
  { section: "fans", href: "/map", label: "Fan Map" },
] as const;

const pillBase =
  "rounded-full border px-5 py-2.5 transition-colors whitespace-nowrap";
const pillActive = "border-white bg-white text-black";
const pillInactive = "border-white text-white hover:bg-zinc-900";

// Header único de todo el sitio (salvo la landing "/", que tiene su propio
// hero): logo que vuelve a la home del artista, "Historial de shows",
// "Fan Map" y "Perfil"/"Sumate al Fan Map", con la sección actual marcada
// (aria-current="page"). Queda fijo arriba (sticky) para que se pueda
// cambiar de sección desde cualquier lado sin depender de "Volver".
//
// En mobile, "Historial de shows" y "Fan Map" van detrás de un botón de
// menú de 44px (tamaño táctil recomendado) y sólo el botón de perfil queda
// siempre visible.
export function SiteHeader() {
  const pathname = usePathname();
  const { status } = useAuth();
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

  if (pathname === "/") return null;

  const active = getActiveSection(pathname);
  // Mientras la sesión resuelve se muestra como deslogueado, para que el
  // botón no "salte" de un texto a otro apenas carga la página.
  const profileLink =
    status === "authenticated"
      ? { href: "/profile", label: "Perfil", short: null }
      : { href: "/join", label: "Sumate al Fan Map", short: "Sumate" };

  return (
    // z-index por encima de los paneles y controles de Leaflet (hasta 1000).
    <header className="sticky top-0 z-[1100] border-b border-zinc-800 bg-black text-white">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <Link href="/artists/the-warning" aria-label="The Warning — inicio">
          <TheWarningLogo height={22} />
        </Link>

        <nav
          ref={containerRef}
          aria-label="Principal"
          className="font-warning relative flex items-center gap-3 text-sm font-bold uppercase tracking-wide"
        >
          <div className="hidden items-center gap-3 sm:flex">
            {NAV_LINKS.map((link) => {
              const isActive = active === link.section;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`${pillBase} ${isActive ? pillActive : pillInactive}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-nav-menu"
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

          {/* Mismo estilo que el resto del menú (relleno = sección actual):
              si fuera siempre blanco se confundiría con "estás acá". */}
          <Link
            href={profileLink.href}
            // Un solo nombre accesible aunque haya texto corto y largo.
            aria-label={profileLink.label}
            aria-current={active === "profile" ? "page" : undefined}
            className={`${pillBase} ${active === "profile" ? pillActive : pillInactive}`}
          >
            {profileLink.short ? (
              <>
                <span className="sm:hidden">{profileLink.short}</span>
                <span className="hidden sm:inline">{profileLink.label}</span>
              </>
            ) : (
              profileLink.label
            )}
          </Link>

          {open && (
            <div
              id="site-nav-menu"
              className="absolute right-0 top-full z-10 mt-2 flex w-56 flex-col gap-1 rounded-2xl border border-zinc-800 bg-black p-2 sm:hidden"
            >
              {NAV_LINKS.map((link) => {
                const isActive = active === link.section;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`rounded-xl px-4 py-3 text-left transition-colors ${
                      isActive ? "bg-white text-black" : "hover:bg-zinc-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
