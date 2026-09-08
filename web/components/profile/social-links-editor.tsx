"use client";

export interface SocialLinksValue {
  instagramUrl: string | null;
  instagramIsPublic: boolean;
  tiktokUrl: string | null;
  tiktokIsPublic: boolean;
  xUrl: string | null;
  xIsPublic: boolean;
  youtubeUrl: string | null;
  youtubeIsPublic: boolean;
  facebookUrl: string | null;
  facebookIsPublic: boolean;
}

interface SocialLinksEditorProps {
  value: SocialLinksValue;
  onChange: (next: SocialLinksValue) => void;
}

// Las 5 redes son fijas (ver decisión en el backend: 5 columnas, no una
// tabla genérica) — este array es solo para no repetir el mismo bloque de
// JSX 5 veces, no un sistema de red social configurable.
const NETWORKS: {
  key: "instagram" | "tiktok" | "x" | "youtube" | "facebook";
  label: string;
  urlField: keyof SocialLinksValue;
  isPublicField: keyof SocialLinksValue;
}[] = [
  { key: "instagram", label: "Instagram", urlField: "instagramUrl", isPublicField: "instagramIsPublic" },
  { key: "tiktok", label: "TikTok", urlField: "tiktokUrl", isPublicField: "tiktokIsPublic" },
  { key: "x", label: "X", urlField: "xUrl", isPublicField: "xIsPublic" },
  { key: "youtube", label: "YouTube", urlField: "youtubeUrl", isPublicField: "youtubeIsPublic" },
  { key: "facebook", label: "Facebook", urlField: "facebookUrl", isPublicField: "facebookIsPublic" },
];

const inputClass =
  "rounded-md border border-zinc-700 bg-black px-3 py-2 text-white placeholder:text-zinc-500";

// Cada red tiene su propio par url/isPublic — cargar una URL nunca la hace
// pública sola, isPublic se activa aparte (ver el pedido). "configurado" ≠
// "visible públicamente": son dos cosas distintas y el toggle es lo único
// que decide la segunda.
export function SocialLinksEditor({ value, onChange }: SocialLinksEditorProps) {
  function setUrl(field: keyof SocialLinksValue, url: string) {
    onChange({ ...value, [field]: url === "" ? null : url });
  }

  function setIsPublic(field: keyof SocialLinksValue, isPublic: boolean) {
    onChange({ ...value, [field]: isPublic });
  }

  return (
    <div className="flex flex-col gap-4">
      <span className="font-warning text-sm font-bold uppercase tracking-wide text-zinc-400">
        Redes sociales
      </span>
      {NETWORKS.map((network) => {
        const url = (value[network.urlField] as string | null) ?? "";
        const isPublic = value[network.isPublicField] as boolean;
        return (
          <div key={network.key} className="flex flex-col gap-1">
            <label htmlFor={`social-${network.key}-url`} className="text-sm font-medium">
              {network.label}
            </label>
            <input
              id={`social-${network.key}-url`}
              type="url"
              value={url}
              onChange={(e) => setUrl(network.urlField, e.target.value)}
              placeholder={`URL de ${network.label}`}
              className={inputClass}
            />
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(network.isPublicField, e.target.checked)}
              />
              Mostrar públicamente
            </label>
          </div>
        );
      })}
    </div>
  );
}
