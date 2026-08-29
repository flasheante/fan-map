"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getCurrentUser, logout as logoutRequest, type CurrentUser } from "@/lib/api";

// "error" es un cuarto estado deliberado, distinto de "unauthenticated":
// getCurrentUser() ya distingue 401 (null → no autenticado) de un fallo
// real de la API (throw, ver lib/api.ts) — si lo colapsáramos en
// "unauthenticated" la UI empujaría al usuario a loguearse de nuevo cuando
// en realidad la API está caída.
export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Único lugar que sabe "quién está logueado": todo lo demás consume
// useAuth(). No persiste nada en localStorage/sessionStorage — el único
// estado de sesión real es la cookie httpOnly que ya administra la API
// (ver SessionAuthGuard); esto solo cachea en memoria lo que devolvió
// GET /auth/me para esta carga de página.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        setStatus(currentUser ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
