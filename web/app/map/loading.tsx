// Next.js usa este archivo como límite de Suspense automático mientras
// MapPage (Server Component async) resuelve getTheWarningMapData().
export default function Loading() {
  return (
    <main className="flex w-full flex-1 items-center justify-center">
      <p>Cargando mapa...</p>
    </main>
  );
}
