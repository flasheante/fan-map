// Next.js usa este archivo como límite de Suspense automático mientras
// TourMapPage (Server Component async) resuelve getTheWarningTourMapData().
export default function Loading() {
  return (
    <main className="flex w-full flex-1 items-center justify-center">
      <p>Cargando Tour Map...</p>
    </main>
  );
}
