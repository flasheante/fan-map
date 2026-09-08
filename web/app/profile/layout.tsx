// Mismo wrapper que app/map/layout.tsx: /profile es parte de la experiencia
// de The Warning FanMap y debe verse igual (fondo negro fijo, texto
// blanco), aunque viva en un segmento de ruta distinto y no herede el
// layout de /artists/the-warning.
export default function ProfileLayout({ children }: LayoutProps<"/profile">) {
  return <div className="min-h-full bg-black text-white">{children}</div>;
}
