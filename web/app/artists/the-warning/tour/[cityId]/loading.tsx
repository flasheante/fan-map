// Next.js usa este archivo como límite de Suspense automático mientras
// TheWarningTourCityPage (Server Component async) resuelve
// getTheWarningTourCityData().
export default function Loading() {
  return (
    <main className="flex h-screen w-full items-center justify-center">
      <p>Cargando historial...</p>
    </main>
  );
}
