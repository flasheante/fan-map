"use client";

import { BackToTheWarningLink } from "@/components/artists/back-link";
import { TheWarningLogo } from "@/components/artists/the-warning-logo";
import { useAuth } from "@/components/auth/auth-provider";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { googleLoginUrl } from "@/lib/api";

const primaryPillClass =
  "font-warning inline-block w-fit rounded-full bg-white px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-zinc-200";
const secondaryPillClass =
  "font-warning rounded-full border border-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-zinc-900";

// Edición del propio perfil de fan. Protegida por useAuth() (mismo criterio
// que JoinFlow): sin sesión no hay nada que editar, así que ProfileEditor
// (que sí pide GET /fan-profiles/me) recién se monta cuando
// status === "authenticated" — nunca antes.
//
// "Cerrar sesión" vive acá (no dentro de ProfileEditor): es una acción de
// la sesión, no del FanProfile en sí — mismo criterio que ya separa
// AuthProvider de FanProfilesService en el backend.
export default function ProfilePage() {
  const { status, user, logout } = useAuth();

  return (
    <main className="flex min-h-screen w-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-2">
        <BackToTheWarningLink />
      </div>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <TheWarningLogo height={28} />
          <span className="font-warning text-sm font-bold uppercase tracking-wide text-zinc-400">
            Mi perfil
          </span>
        </div>
        {status === "authenticated" && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">{user?.email}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className={secondaryPillClass}
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      {status === "loading" && (
        <p className="px-4 py-6 text-zinc-400">Cargando...</p>
      )}

      {status === "error" && (
        <p role="alert" className="px-4 py-6 text-red-400">
          No pudimos verificar tu sesión. Intentá de nuevo más tarde.
        </p>
      )}

      {status === "unauthenticated" && (
        <div className="flex flex-col gap-3 px-4 py-6">
          <p className="text-zinc-400">Iniciá sesión para ver y editar tu perfil.</p>
          <a href={googleLoginUrl("/profile")} className={primaryPillClass}>
            Continuar con Google
          </a>
        </div>
      )}

      {status === "authenticated" && <ProfileEditor />}
    </main>
  );
}
