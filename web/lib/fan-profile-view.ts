import { getFanProfile, type PublicFanProfile } from "./api";

export type FanProfileViewData =
  | { status: "error" }
  | { status: "not-found" }
  | { status: "ok"; profile: PublicFanProfile };

// Resuelve el perfil público de un fan para /fans/:id (ver
// getFanProfile en lib/api.ts, que ya distingue 404 vía httpError con
// `status`). Mismo patrón "status discriminado" que el resto de páginas de
// The Warning (ej. getTheWarningShowData) en vez de dejar que la página
// haga try/catch por su cuenta.
export async function getFanProfileView(id: string): Promise<FanProfileViewData> {
  try {
    const profile = await getFanProfile(id);
    return { status: "ok", profile };
  } catch (err) {
    if (err instanceof Error && (err as Error & { status?: number }).status === 404) {
      return { status: "not-found" };
    }
    return { status: "error" };
  }
}
