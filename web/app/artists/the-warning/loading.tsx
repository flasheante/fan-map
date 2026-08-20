// Next.js usa este archivo como límite de Suspense automático mientras
// TheWarningArtistPage (Server Component async) resuelve getTheWarningMapData().
export default function Loading() {
  return (
    <main className="flex h-screen w-full items-center justify-center">
      <p>Cargando artista...</p>
    </main>
  );
}
