# Fan Map

A world map of **The Warning** fans: each fan pins their city, builds a
profile (personal setlist, top 10 favorite songs, social links), and can
browse the band's real show/setlist history, synced automatically from
[setlist.fm](https://www.setlist.fm/) and [MusicBrainz](https://musicbrainz.org/).

## Overview

The repo has two independent projects (not an npm-workspaces monorepo — each
has its own `package.json`):

| Folder | What it is | Stack |
| --- | --- | --- |
| [`api/`](api) | REST backend | NestJS 11 + Prisma 7 + PostgreSQL |
| [`web/`](web) | Frontend | Next.js 16 (App Router) + React 19 + Leaflet (map) + Tailwind |

### Main features

- **Google login** (OAuth) with a signed-cookie session.
- **Fan profile**: city, display name, map visibility, up to 5 social links
  (each with its own "public" toggle).
- **Personal setlist** (up to 15 songs, ordered) and **top 10** favorite
  songs — independent of each other.
- **Fan map** by city/country, with favorite-song rankings (worldwide /
  country / city) built from those top 10s.
- **The Warning's show/setlist history**, synced from setlist.fm
  (`npm run sync:setlist-fm`, also runs on its own weekly via GitHub Actions
  — see `.github/workflows/sync-setlist-fm.yml`).
- **Song catalog** for the band, synced from MusicBrainz
  (`npm run sync:musicbrainz`), as the source for a fan's setlist/top 10.

## Prerequisites

- **Node.js 24** (what CI uses — see `.github/workflows/`). Node 20+ should
  work fine for local development too.
- **Docker** (or your own PostgreSQL 17 instance — see below if you'd rather
  not use Docker).
- A **Google Cloud** account to create OAuth credentials (only needed to try
  the login flow; the rest of the app works without it).
- Optional, only if you want to run the real syncs instead of the sample
  data: a [setlist.fm](https://www.setlist.fm/settings/apps) API key
  (MusicBrainz needs no key).

## Installation

### 1. Clone and start the database

```bash
git clone https://github.com/flasheante/fan-map.git
cd fan-map
docker compose up -d
```

This starts Postgres 17 on `localhost:5432` (db/user/password: `fan_map` /
`fan_map` / `fan_map`, see `docker-compose.yml`). It also starts a Redis on
`localhost:6379`, included for future use — no service in the app uses it
yet, so you don't need it running for anything below.

If you'd rather not use Docker, any reachable Postgres 17 works: you just
need its `DATABASE_URL` for the next step.

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

- `npx prisma migrate dev` applies the existing migrations (it won't create
  a new one unless you changed the schema).
- `npx prisma db seed` runs `prisma/seed.ts`: loads the country/city catalog
  the rest of the app uses to resolve locations, and creates the "The
  Warning" artist (`slug: the-warning`) — **without this step the rest of
  the app has no cities to pick from and no artist to sync shows for**.
- The API listens on `http://localhost:3000` (`PORT` in `.env` to change
  it).

At this point you can run the API and try the endpoints that don't depend on
real show data (profiles, cities, countries). To have shows, setlists and
songs without needing the real API keys, run this instead (or in addition):

```bash
npm run seed:demo
```

Loads sample The Warning shows/setlists straight into the database, without
calling setlist.fm or MusicBrainz. For real data instead of the sample data,
fill in `SETLIST_FM_API_KEY` in `.env` (see `.env.example` itself for how to
get one) and run:

```bash
npm run sync:musicbrainz
npm run sync:setlist-fm
```

### 3. Frontend (`web/`)

In another terminal:

```bash
cd web
cp .env.local.example .env.local
npm install
npm run dev
```

It runs on `http://localhost:3001` — open it there, not on the API's port.
`next.config.ts` proxies `/api/*` to `NEXT_PUBLIC_API_URL` (defaults to
`http://localhost:3000`, the API from the previous step) so the session
cookie stays on the same origin as the frontend.

### 4. Google login (optional)

The rest of the app works without this, but `GET /auth/google` needs it:

1. Create an "OAuth client ID" (type *Web application*) in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add this as an *Authorized redirect URI*:
   `http://localhost:3001/api/auth/google/callback` (note: the **web**
   app's port, not the API's — see the `GOOGLE_CALLBACK_URL` comment in
   `api/.env.example` for why).
3. In `api/.env`, fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and
   `GOOGLE_CALLBACK_URL` with that same URL.

## Environment variables

Each project ships its own example file with line-by-line explanations —
those are the real reference, this is just the summary:

- [`api/.env.example`](api/.env.example): `DATABASE_URL`, setlist.fm/MusicBrainz
  keys, Google OAuth credentials, `SESSION_SECRET` and the rest of the
  session config.
- [`web/.env.local.example`](web/.env.local.example): `NEXT_PUBLIC_API_URL`.

## Tests

```bash
# api
cd api
npm run test        # unit
npm run test:e2e     # end-to-end (needs the database running)
npm run test:cov     # with coverage

# web
cd web
npm run test         # vitest
```

## Deployment

There's no infra-as-code in the repo (each platform is configured directly):

- **API**: [Render](https://render.com).
- **Web**: [Vercel](https://vercel.com).
- **Weekly setlist.fm sync**: GitHub Actions
  (`.github/workflows/sync-setlist-fm.yml`), runs early Monday mornings;
  can also be triggered manually from the repo's *Actions* tab.

## Repo structure

```
fan-map/
├── docker-compose.yml   # Postgres + Redis for local development
├── api/                 # NestJS backend (see api/README.md — Nest boilerplate)
└── web/                 # Next.js frontend (see web/README.md — create-next-app boilerplate)
```

The `README.md` files inside `api/` and `web/` are each framework's default
(Nest CLI / `create-next-app`) and haven't been updated with anything
project-specific — this file is the real reference.
