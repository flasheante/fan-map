"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { getMyFanProfile, googleLoginUrl, type FanProfile } from "@/lib/api";
import { FanForm } from "@/components/join/fan-form";

type ProfileCheckStatus = "idle" | "loading" | "has-profile" | "no-profile" | "error";

// Orquesta los 4 estados de /join pedidos por la Etapa 3: no autenticado →
// login; autenticado sin FanProfile → formulario; autenticado con
// FanProfile → continuar; loading → sin flicker de ningún otro estado.
// No toca /map ni /artists/the-warning: la UI de auth queda contenida acá.
export function JoinFlow() {
  const { status, user, logout } = useAuth();
  const [profileStatus, setProfileStatus] = useState<ProfileCheckStatus>("idle");

  useEffect(() => {
    if (status !== "authenticated") return;

    // No hace falta setProfileStatus("loading") sincrónico acá: el estado
    // inicial ya es "idle", y el render trata "idle" igual que "loading"
    // (ver más abajo) — evita el cascading render que marca react-hooks.
    let cancelled = false;

    getMyFanProfile()
      .then((profile: FanProfile | null) => {
        if (cancelled) return;
        setProfileStatus(profile ? "has-profile" : "no-profile");
      })
      .catch(() => {
        if (cancelled) return;
        setProfileStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  if (status === "loading") {
    return <p className="text-zinc-600 dark:text-zinc-400">Cargando...</p>;
  }

  if (status === "unauthenticated") {
    return (
      <a
        href={googleLoginUrl()}
        className="rounded-full bg-foreground px-5 py-2.5 text-center font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Continuar con Google
      </a>
    );
  }

  if (status === "error") {
    return (
      <p role="alert" className="text-red-600 dark:text-red-400">
        No pudimos verificar tu sesión. Intentá de nuevo más tarde.
      </p>
    );
  }

  // status === "authenticated" de acá en más.
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        <span>{user?.email}</span>
        <button
          type="button"
          onClick={() => void logout()}
          className="underline underline-offset-2"
        >
          Cerrar sesión
        </button>
      </div>

      {(profileStatus === "idle" || profileStatus === "loading") && (
        <p className="text-zinc-600 dark:text-zinc-400">Cargando...</p>
      )}

      {profileStatus === "error" && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          No pudimos verificar tu perfil de fan. Intentá de nuevo más tarde.
        </p>
      )}

      {profileStatus === "has-profile" && (
        <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-semibold">Ya sos parte del mapa</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Tu perfil de fan ya está creado.
          </p>
          <Link href="/map?view=fans" className="font-medium underline underline-offset-2">
            Ver el mapa
          </Link>
        </div>
      )}

      {profileStatus === "no-profile" && <FanForm />}
    </div>
  );
}
