import Link from "next/link";
import { TheWarningLogo } from "@/components/artists/the-warning-logo";

// Landing mínima para la demo de The Warning FanMap. Página estática, sin
// llamadas al backend: solo dos CTAs hacia rutas ya existentes
// (/artists/the-warning y /join), sin ningún id hardcodeado. Mismo fondo
// negro + logo + tipografía bold/uppercase que /artists/the-warning (ver su
// layout.tsx): es la puerta de entrada a esa misma marca, no una landing
// genérica.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-black px-4 py-16 text-center text-white">
      <h1 className="flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
        <TheWarningLogo height={40} />{" "}
        <span className="font-warning text-3xl font-black uppercase tracking-tight sm:text-5xl">
          FanMap
        </span>
      </h1>
      <p className="max-w-md text-base text-zinc-400 sm:text-lg">
        El mapa de fans de The Warning.
      </p>
      <div className="font-warning flex w-full max-w-xs flex-col gap-3 text-sm font-bold uppercase tracking-wide sm:w-auto sm:flex-row">
        <Link
          href="/artists/the-warning"
          className="rounded-full bg-white px-6 py-3 text-black transition-colors hover:bg-zinc-200"
        >
          Explorar FanMap
        </Link>
        <Link
          href="/join"
          className="rounded-full border border-white px-6 py-3 transition-colors hover:bg-zinc-900"
        >
          Sumate al FanMap
        </Link>
      </div>
    </main>
  );
}
