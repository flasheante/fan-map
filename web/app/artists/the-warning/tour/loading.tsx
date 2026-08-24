// Next.js usa este archivo como límite de Suspense automático mientras
// TourMapPage (Server Component async) resuelve getTheWarningTourMapData().
export default function Loading() {
  return (
    <main className="flex h-screen w-full items-center justify-center">
      <p>Cargando Tour Map...</p>
    </main>
  );
}
