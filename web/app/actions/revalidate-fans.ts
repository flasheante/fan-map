"use server";

import { updateTag } from "next/cache";
import { FANS_CACHE_TAG } from "@/lib/api";

// Server Action que llaman fan-form (alta) y profile-editor (edición) después
// de que la API confirma el cambio. Expira al instante los datos cacheados
// con FANS_CACHE_TAG (fans del mapa y stats) y, con ellos, las páginas ISR
// que los usan (/map, /artists/the-warning): el próximo request se
// regenera con el fan nuevo en vez de servir la versión de hasta 5 min atrás.
//
// No valida sesión: lo peor que puede hacer un llamado arbitrario es forzar
// una regeneración (un par de GET a la API), no exponer ni cambiar datos.
export async function revalidateFans(): Promise<void> {
  updateTag(FANS_CACHE_TAG);
}
