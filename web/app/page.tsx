import Link from "next/link";

// Landing mínima para la demo de The Warning FanMap. Página estática, sin
// llamadas al backend: solo dos CTAs hacia rutas ya existentes
// (/artists/the-warning y /join), sin ningún id hardcodeado.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
        THE WARNING FANMAP
      </h1>
      <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
        El mapa de fans de The Warning.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/artists/the-warning"
          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          EXPLORAR FANMAP
        </Link>
        <Link
          href="/join"
          className="rounded-full border border-solid border-black/[.08] px-6 py-3 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          SUMATE AL FANMAP
        </Link>
      </div>
    </main>
  );
}
