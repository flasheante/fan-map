"use client";

// Límite de error de la sección de The Warning. Las páginas de esta sección
// son ISR (ver `revalidate` en cada page.tsx) y lanzan cuando la API falla
// en vez de devolver un mensaje, para que Next no cachee la página de error
// y siga sirviendo la última versión buena. Esto sólo se ve si falla la
// primera generación (o el render en el cliente).
export default function TheWarningError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
      <p>No pudimos cargar la página. Intentá de nuevo más tarde.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900"
      >
        Reintentar
      </button>
    </main>
  );
}
