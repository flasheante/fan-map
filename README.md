# Fan Map

Mapa mundial de fans de **The Warning**: cada fan se ubica en su ciudad, arma
su perfil (setlist personal, top 10 de canciones favoritas, redes sociales) y
puede ver el historial de shows y setlists reales de la banda, sincronizado
automáticamente desde [setlist.fm](https://www.setlist.fm/) y
[MusicBrainz](https://musicbrainz.org/).

## Resumen

El repo tiene dos proyectos independientes (no es un monorepo con
workspaces, cada uno tiene su propio `package.json`):

| Carpeta | Qué es | Stack |
| --- | --- | --- |
| [`api/`](api) | Backend REST | NestJS 11 + Prisma 7 + PostgreSQL |
| [`web/`](web) | Frontend | Next.js 16 (App Router) + React 19 + Leaflet (mapa) + Tailwind |

### Funcionalidad principal

- **Login con Google** (OAuth) y sesión por cookie firmada.
- **Perfil de fan**: ciudad, nombre a mostrar, visibilidad en el mapa, hasta
  5 redes sociales (cada una con su propio toggle de "pública").
- **Setlist personal** (hasta 15 canciones, con orden) y **Top 10** de
  canciones favoritas — independientes entre sí.
- **Mapa de fans** por ciudad/país, con rankings de canciones favoritas
  (mundial / país / ciudad) armados a partir de esos Top 10.
- **Historial de shows y setlists de The Warning**, sincronizado desde
  setlist.fm (`npm run sync:setlist-fm`, corre también solo cada semana vía
  GitHub Actions — ver `.github/workflows/sync-setlist-fm.yml`).
- **Catálogo de canciones** de la banda, sincronizado desde MusicBrainz
  (`npm run sync:musicbrainz`), como fuente para el setlist/top 10 del fan.

## Requisitos previos

- **Node.js 24** (la CI usa esa versión — ver `.github/workflows/`). Node 20+
  debería andar igual para desarrollo local.
- **Docker** (o una instancia propia de PostgreSQL 17 — ver más abajo si no
  querés usar Docker).
- Una cuenta de **Google Cloud** para crear credenciales OAuth (solo si vas a
  probar el login; el resto de la app funciona sin esto).
- Opcional, solo si vas a correr las sincronizaciones reales en vez de los
  datos de prueba: una API key de
  [setlist.fm](https://www.setlist.fm/settings/apps) (MusicBrainz no
  necesita key).

## Instalación

### 1. Clonar y levantar la base de datos

```bash
git clone https://github.com/flasheante/fan-map.git
cd fan-map
docker compose up -d
```

Esto levanta Postgres 17 en `localhost:5432` (db/user/pass: `fan_map` /
`fan_map` / `fan_map`, ver `docker-compose.yml`). También levanta un Redis en
`localhost:6379`, incluido para uso futuro — hoy ningún servicio de la app lo
usa todavía, así que no hace falta tenerlo corriendo para nada de lo de
abajo.

Si preferís no usar Docker, cualquier Postgres 17 accesible sirve: solo
necesitás su `DATABASE_URL` para el paso siguiente.

### 2. Backend (`api/`)

```bash
cd api
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

- `npx prisma migrate dev` aplica las migraciones existentes (no crea una
  nueva si no cambiaste el schema).
- `npx prisma db seed` corre `prisma/seed.ts`: carga el catálogo de
  países/ciudades que usa el resto de la app para resolver ubicaciones, y
  crea el artista "The Warning" (`slug: the-warning`) — **sin este paso el
  resto de la app no tiene ciudades para elegir ni artista para sincronizar
  shows**.
- La API queda escuchando en `http://localhost:3000` (`PORT` en `.env` para
  cambiarlo).

Con eso ya podés correr la API y probar los endpoints que no dependen de
datos reales de shows (perfiles, ciudades, países). Para tener shows,
setlists y canciones sin necesitar las API keys reales, corré en su lugar
(o además):

```bash
npm run seed:demo
```

Carga datos de ejemplo de shows/setlists de The Warning directamente en la
base, sin llamar a setlist.fm ni MusicBrainz. Para los datos reales en vez
de los de ejemplo, completá `SETLIST_FM_API_KEY` en `.env` (ver el propio
`.env.example` para cómo conseguirla) y corré:

```bash
npm run sync:musicbrainz
npm run sync:setlist-fm
```

### 3. Frontend (`web/`)

En otra terminal:

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

Queda en `http://localhost:3001` — abrilo ahí, no en el puerto de la API.
`next.config.ts` proxea `/api/*` hacia `NEXT_PUBLIC_API_URL` (por defecto
`http://localhost:3000`, la API del paso anterior) para que la cookie de
sesión quede en el mismo origin que el frontend.

### 4. Login con Google (opcional)

El resto de la app funciona sin esto, pero `GET /auth/google` lo necesita:

1. Creá un "OAuth client ID" (tipo *Web application*) en la
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Agregalo como *Authorized redirect URI*:
   `http://localhost:3001/api/auth/google/callback` (nota: el puerto del
   **web**, no el de la API — ver el comentario de `GOOGLE_CALLBACK_URL` en
   `api/.env.example` para el porqué).
3. En `api/.env`, completá `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y
   `GOOGLE_CALLBACK_URL` con esa misma URL.

## Variables de entorno

Cada proyecto trae su propio ejemplo con explicaciones línea por línea — son
la referencia real, esto es solo el resumen:

- [`api/.env.example`](api/.env.example): `DATABASE_URL`, claves de
  setlist.fm/MusicBrainz, credenciales de Google OAuth, `SESSION_SECRET` y
  el resto de la config de sesión.
- [`web/.env.local.example`](web/.env.local.example): `NEXT_PUBLIC_API_URL`.

## Tests

```bash
# api
cd api
npm run test        # unitarios
npm run test:e2e     # end-to-end (necesita la base de datos levantada)
npm run test:cov     # con cobertura

# web
cd web
npm run test         # vitest
```

## Deploy

No hay nada de infra en el repo (se configura directo en cada plataforma):

- **API**: [Render](https://render.com).
- **Web**: [Vercel](https://vercel.com).
- **Sync semanal de setlist.fm**: GitHub Actions
  (`.github/workflows/sync-setlist-fm.yml`), corre los lunes de madrugada;
  también se puede disparar a mano desde la pestaña *Actions* del repo.

## Estructura del repo

```
fan-map/
├── docker-compose.yml   # Postgres + Redis para desarrollo local
├── api/                 # Backend NestJS (ver api/README.md — boilerplate de Nest)
└── web/                 # Frontend Next.js (ver web/README.md — boilerplate de create-next-app)
```

Los `README.md` dentro de `api/` y `web/` son los que genera cada framework
por defecto (Nest CLI / `create-next-app`) y no están actualizados con nada
específico de este proyecto — este archivo es la referencia real.
