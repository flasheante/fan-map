import { BackToTheWarningLink } from "@/components/artists/back-link";
import { getFanProfileView } from "@/lib/fan-profile-view";

interface FanProfilePageProps {
  params: Promise<{ id: string }>;
}

const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
  facebook: "Facebook",
};

// Vista pública del perfil de un fan (/fans/:id). Server Component: un
// único GET /fan-profiles/:id (ver getFanProfileView), sin sesión — es lo
// que ya devuelve toPublicFanProfileResponse en el backend, así que esta
// página nunca decide privacidad por su cuenta, solo oculta secciones
// vacías (ver el pedido: "no mostrar secciones vacías").
export default async function FanProfilePage({ params }: FanProfilePageProps) {
  const { id } = await params;
  const data = await getFanProfileView(id);

  if (data.status === "error") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No pudimos cargar este perfil. Intentá de nuevo más tarde.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  if (data.status === "not-found") {
    return (
      <main className="flex h-screen w-full flex-col items-center justify-center gap-4">
        <p>No se encontró este perfil.</p>
        <BackToTheWarningLink />
      </main>
    );
  }

  const { profile } = data;
  const socialEntries = Object.entries(profile.social);
  // Dos listas completamente independientes (ver lib/api.ts): el Top 10 de
  // favoritas y el setlist personal. Ninguna depende de la otra — una
  // canción puede estar en ambas, en una sola, o en ninguna. Ambas ya
  // vienen con `position` siempre presente, solo hace falta ordenar.
  const topSongs = [...profile.favoriteSongs].sort((a, b) => a.position - b.position);
  const setlistSongs = [...profile.setlistSongs].sort((a, b) => a.position - b.position);

  return (
    <main className="flex min-h-screen w-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-2">
        <BackToTheWarningLink />
      </div>

      <header className="flex flex-wrap items-center gap-4 border-b border-zinc-800 px-4 py-6">
        {profile.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- URL arbitraria de Google, no configurada en next/image.
          <img
            src={profile.photoUrl}
            alt={`Foto de perfil de ${profile.displayName}`}
            className="h-16 w-16 rounded-full object-cover"
          />
        )}
        <div>
          <h1 className="font-warning text-lg font-bold uppercase tracking-wide">
            {profile.displayName}
          </h1>
          <p className="text-sm text-zinc-400">
            {profile.city.name}, {profile.city.country.name}
          </p>
        </div>
      </header>

      {profile.artists.length > 0 && (
        <section className="border-b border-zinc-800 px-4 py-4">
          <h2 className="font-warning mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
            Artistas
          </h2>
          <ul className="flex flex-wrap gap-2">
            {profile.artists.map((artist) => (
              <li
                key={artist.id}
                className="font-warning rounded-full border border-white px-3 py-1 text-xs font-bold uppercase tracking-wide"
              >
                {artist.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {socialEntries.length > 0 && (
        <section className="border-b border-zinc-800 px-4 py-4">
          <h2 className="font-warning mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
            Social
          </h2>
          <ul className="flex flex-wrap gap-3">
            {socialEntries.map(([network, url]) => (
              <li key={network}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-warning rounded-full border border-white px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-zinc-900"
                >
                  {SOCIAL_LABELS[network] ?? network}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topSongs.length > 0 && (
        <section className="border-b border-zinc-800 px-4 py-4">
          <h2 className="font-warning mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
            Top 10
          </h2>
          <ol className="flex flex-col gap-1 text-sm">
            {topSongs.map((song) => (
              <li key={song.id}>
                {song.position}. {song.title}
              </li>
            ))}
          </ol>
        </section>
      )}

      {setlistSongs.length > 0 && (
        <section className="px-4 py-4">
          <h2 className="font-warning mb-2 text-sm font-bold uppercase tracking-wide text-zinc-400">
            Mi Setlist
          </h2>
          <ol className="flex flex-col gap-1 text-sm">
            {setlistSongs.map((song) => (
              <li key={song.id}>
                {song.position}. {song.title}
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
