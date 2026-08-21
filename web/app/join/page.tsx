import { BackToTheWarningLink } from "@/components/artists/back-link";
import { FanForm } from "@/components/join/fan-form";

export default function JoinPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <BackToTheWarningLink />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Sumate al mapa de fans</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Registrate para aparecer en el mapa de fans de tus artistas
          favoritos.
        </p>
      </header>
      <FanForm />
    </main>
  );
}
