// Mismo wrapper que app/artists/the-warning/layout.tsx (ver su comentario):
// /map es la página central del mapa de The Warning FanMap y debe verse
// igual que esa sección — fondo negro fijo con texto blanco, independiente
// del prefers-color-scheme del SO — aunque viva en un segmento de ruta
// distinto (/map, no /artists/the-warning/*) y por lo tanto no herede ese
// layout. Se duplica acá en vez de mover /map bajo /artists/the-warning
// porque /map debe seguir siendo la entrada de nivel superior al mapa (ver
// MapExplorer): es la única pieza que hace falta repetir, una sola línea de
// JSX, así que no amerita extraer un componente compartido para evitarla.
export default function MapLayout({ children }: LayoutProps<"/map">) {
  return <div className="min-h-full bg-black text-white">{children}</div>;
}
