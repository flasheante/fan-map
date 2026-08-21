// Next.js usa este archivo como límite de Suspense automático mientras
// TheWarningShowPage (Server Component async) resuelve getTheWarningShowData().
export default function Loading() {
  return (
    <main className="flex h-screen w-full items-center justify-center">
      <p>Cargando show...</p>
    </main>
  );
}
