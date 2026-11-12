// Next.js usa este archivo como límite de Suspense automático mientras
// TheWarningShowPage (Server Component async) resuelve getTheWarningShowData().
export default function Loading() {
  return (
    <main className="flex w-full flex-1 items-center justify-center">
      <p>Cargando show...</p>
    </main>
  );
}
