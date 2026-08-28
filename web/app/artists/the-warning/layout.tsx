// Layout compartido por toda la sección pública de The Warning
// (/artists/the-warning, /tour, /tour/:cityId, /shows/:showId): fondo negro
// fijo con texto blanco, independiente del prefers-color-scheme del SO —a
// diferencia del resto del sitio (ver app/globals.css), esta sección es la
// página de marca de la banda y siempre debe verse igual, como el
// nav/merch site de referencia (fondo negro, tipografía bold en mayúsculas).
// Por eso los componentes de esta sección ya no usan el patrón
// `text-zinc-X dark:text-zinc-Y`: quedan fijos en el valor pensado para
// fondo oscuro. La fuente bold/uppercase (`font-warning`, ver @theme inline
// en globals.css) se carga en el layout raíz, no acá, porque la landing
// "/" también la usa.
export default function TheWarningLayout({ children }: LayoutProps<"/artists/the-warning">) {
  return <div className="min-h-full bg-black text-white">{children}</div>;
}
