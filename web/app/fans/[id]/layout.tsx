// Mismo wrapper que app/profile/layout.tsx y app/map/layout.tsx: el perfil
// público de un fan es parte de la experiencia de The Warning FanMap.
export default function FanProfileLayout({ children }: LayoutProps<"/fans/[id]">) {
  return <div className="min-h-full bg-black text-white">{children}</div>;
}
