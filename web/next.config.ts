import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  // Proxy server-side de /api/* hacia la API (Render en prod, ver
  // lib/api.ts#SESSION_API_URL para el porqué): el browser sólo le habla a
  // este mismo origin, así que la cookie de sesión — y la del roundtrip de
  // Google — quedan first-party en vez de cross-site entre vercel.app y
  // onrender.com. Sin esto, un navegador que bloquea cookies de terceros
  // (incógnito por default, Safari siempre) descarta la cookie apenas el
  // front intenta usarla, y el login "pega" en Google pero la app nunca ve
  // la sesión.
  //
  // Cubre TODA la API (no sólo /auth) a propósito: una vez que la cookie de
  // sesión queda scopeada a este origin, cualquier otro pedido con
  // credentials:"include" (POST /fan-profiles, GET /fan-profiles/me, etc.)
  // tiene que pasar por acá también para poder mandarla — quedarse sólo con
  // /api/auth/* dejaría esas otras rutas sin la cookie igual.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
