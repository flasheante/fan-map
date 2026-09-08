"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";

const pillClass =
  "rounded-full bg-white px-5 py-2.5 text-black transition-colors hover:bg-zinc-200";

// Botón "Join the FanMap" del header de /artists/the-warning: si el
// usuario ya está logueado no tiene sentido invitarlo a sumarse de nuevo,
// así que pasa a decir "Profile" y llevar a /profile. Mientras el estado
// de auth todavía está resolviendo (status === "loading") se muestra igual
// que deslogueado — evita que el botón "salte" de un texto a otro apenas
// carga la página. Si está logueado pero todavía no creó su FanProfile,
// /profile ya sabe mostrar el CTA a /join (ver ProfileEditor).
export function JoinOrProfileLink() {
  const { status } = useAuth();

  if (status === "authenticated") {
    return (
      <Link href="/profile" className={pillClass}>
        Profile
      </Link>
    );
  }

  return (
    <Link href="/join" className={pillClass}>
      Join the FanMap
    </Link>
  );
}
