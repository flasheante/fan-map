import Image from "next/image";

// Proporción real del PNG fuente (public/the-warning-logo.png): 300x136.
const LOGO_ASPECT_RATIO = 300 / 136;

interface TheWarningLogoProps {
  className?: string;
  /**
   * Alto del logo en px. El ancho se deriva de LOGO_ASPECT_RATIO para no
   * deformarlo.
   */
  height?: number;
}

// Wordmark de The Warning (PNG con fondo transparente, pensado para fondo
// negro — ver layout.tsx de /artists/the-warning). Reemplaza al antiguo
// `<h1>{artist.name}</h1>` en las cabeceras de esta sección: mismo alt "The
// Warning" que el texto que reemplaza, para no romper los tests que buscan
// el heading por accessible name (getByRole("heading", { name: "The
// Warning" }) sigue funcionando porque el alt de la imagen participa en el
// cálculo del accessible name).
export function TheWarningLogo({ className, height = 32 }: TheWarningLogoProps) {
  return (
    <Image
      src="/the-warning-logo.png"
      alt="The Warning"
      width={Math.round(height * LOGO_ASPECT_RATIO)}
      height={height}
      className={className}
      priority
    />
  );
}
