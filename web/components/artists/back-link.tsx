import Link from "next/link";

// Enlace de "volver" reutilizado en los estados sin datos de artista (error,
// artist-not-found, show-not-found, /join, /map) de las páginas de The
// Warning: ninguna pantalla debe dejar al usuario sin forma de volver, y el
// texto fijo mantiene el foco exclusivamente en The Warning aun cuando no
// hay un Artist cargado para tomar el nombre dinámicamente (a diferencia de
// ShowDetail, que sí lo tiene).
export function BackToTheWarningLink() {
  return (
    <Link
      href="/artists/the-warning"
      className="text-sm font-medium underline underline-offset-2"
    >
      ← Volver a The Warning
    </Link>
  );
}
