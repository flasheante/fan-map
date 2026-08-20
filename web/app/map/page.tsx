import { FanMapLoader } from "@/components/map/fan-map-loader";
import { getTheWarningMapData } from "@/lib/the-warning-fan-map";

export default async function MapPage() {
  const data = await getTheWarningMapData();

  if (data.status === "error") {
    return (
      <main className="flex h-screen w-full items-center justify-center">
        <p>No se pudo cargar el mapa. Intentá de nuevo más tarde.</p>
      </main>
    );
  }

  if (data.status === "artist-not-found") {
    return (
      <main className="flex h-screen w-full items-center justify-center">
        <p>No se encontró el artista The Warning.</p>
      </main>
    );
  }

  const { artist, fans } = data;

  return (
    <main className="flex h-screen w-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <h1 className="text-lg font-semibold">{artist.name} Fan Map</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {fans.length} {fans.length === 1 ? "fan" : "fans"} en el mapa
        </p>
      </header>
      <div className="min-h-0 flex-1">
        <FanMapLoader fans={fans} />
      </div>
    </main>
  );
}
