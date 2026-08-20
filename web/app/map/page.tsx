import { FanMapLoader } from "@/components/map/fan-map-loader";
import { getFanProfilesOnMap } from "@/lib/api";

export default async function MapPage() {
  let fans;

  try {
    fans = await getFanProfilesOnMap();
  } catch {
    return (
      <main className="flex h-screen w-full items-center justify-center">
        <p>No se pudo cargar el mapa. Intentá de nuevo más tarde.</p>
      </main>
    );
  }

  return (
    <main className="h-screen w-full">
      <FanMapLoader fans={fans} />
    </main>
  );
}
