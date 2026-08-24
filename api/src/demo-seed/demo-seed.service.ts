import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

// Local, offline demo dataset for The Warning: enough shows/setlists to
// exercise /artists/:id, /artists/:id/shows, .../setlist and
// .../stats(/songs) without depending on setlist.fm (see
// SetlistFmSyncService for the real sync). Triggered manually by
// scripts/seed-demo.ts (`npm run seed:demo`), never by an HTTP endpoint.
//
// IMPORTANT: the song titles below are demo data only, picked (and
// deliberately repeated across shows) to give /stats/songs something
// interesting to aggregate — they are NOT the real historical setlists of
// any actual The Warning show.
export const DEMO_ARTIST_SLUG = 'the-warning';

interface DemoCityDef {
  name: string;
  countryCode: string;
  venueLabel: string;
}

interface DemoShowDef {
  externalId: string;
  date: string; // yyyy-MM-dd
  songTitles: string[];
}

// Preference order from the slice spec. Looked up by name + country code
// against the existing catalog (see LocationsService/prisma/seed.ts) —
// never created here.
const DEMO_CITIES: DemoCityDef[] = [
  { name: 'Mendoza', countryCode: 'AR', venueLabel: 'Demo Venue' },
  { name: 'Buenos Aires', countryCode: 'AR', venueLabel: 'Demo Arena' },
  { name: 'Ciudad de México', countryCode: 'MX', venueLabel: 'Demo Foro' },
  { name: 'Monterrey', countryCode: 'MX', venueLabel: 'Demo Arena' },
  { name: 'Los Angeles', countryCode: 'US', venueLabel: 'Demo Theater' },
];

// Song titles repeat across shows on purpose (S!CK and MORE in 4 shows each,
// CHOKE and Automatic Sun in 3, etc.) so GET /artists/:id/stats/songs has
// meaningful "times played" data to rank.
const DEMO_SHOWS: DemoShowDef[] = [
  {
    externalId: 'demo-the-warning-001',
    date: '2024-03-15',
    songTitles: [
      'S!CK',
      'MORE',
      'CHOKE',
      'DISCIPLE',
      'XXI Century Blood',
      'EVOLVE',
    ],
  },
  {
    externalId: 'demo-the-warning-002',
    date: '2024-06-20',
    songTitles: ['S!CK', 'MORE', 'CHOKE', 'Automatic Sun', 'ERROR', 'Sharks'],
  },
  {
    externalId: 'demo-the-warning-003',
    date: '2025-01-18',
    songTitles: ['S!CK', 'MORE', 'Automatic Sun', 'MONEY', 'Z', 'Martirio'],
  },
  {
    externalId: 'demo-the-warning-004',
    date: '2025-08-23',
    songTitles: [
      'S!CK',
      'Automatic Sun',
      'DISCIPLE',
      'Qué Más Da',
      'Hell You Call A Dream',
    ],
  },
  {
    externalId: 'demo-the-warning-005',
    date: '2026-03-15',
    songTitles: ['MORE', 'CHOKE', 'MONEY', 'Qué Más Da', 'Narcisista'],
  },
];

export interface DemoSeedSummary {
  artist: string;
  shows: { created: number; updated: number };
  setlists: { created: number; updated: number };
  songs: { created: number; updated: number };
  citiesSkipped: string[];
}

interface ResolvedCity {
  id: string;
  name: string;
  venueLabel: string;
}

interface PersistShowInput {
  artistId: string;
  cityId: string;
  date: Date;
  venue: string;
  externalId: string;
  songTitles: string[];
}

interface PersistShowOutcome {
  showCreated: boolean;
  setlistCreated: boolean;
  setlistUpdated: boolean;
  songsCount: number;
}

@Injectable()
export class DemoSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async seedDemoTheWarning(): Promise<DemoSeedSummary> {
    const artist = await this.prisma.artist.findUnique({
      where: { slug: DEMO_ARTIST_SLUG },
    });
    if (!artist) {
      throw new NotFoundException(
        `Artist with slug "${DEMO_ARTIST_SLUG}" not found. Run the base ` +
          'catalog seed first (prisma/seed.ts) — this command never ' +
          'creates the artist itself.',
      );
    }

    const summary: DemoSeedSummary = {
      artist: artist.name,
      shows: { created: 0, updated: 0 },
      setlists: { created: 0, updated: 0 },
      songs: { created: 0, updated: 0 },
      citiesSkipped: [],
    };

    const resolvedCities = await this.resolveCities(summary.citiesSkipped);
    if (resolvedCities.length === 0) {
      throw new Error(
        'None of the demo cities exist in the catalog. Seed cities first ' +
          '(see prisma/seed.ts) before running seed:demo.',
      );
    }

    for (let i = 0; i < DEMO_SHOWS.length; i++) {
      const showDef = DEMO_SHOWS[i];
      // Round-robins over whatever cities actually resolved, so all 5 demo
      // shows are still created even if some preferred cities are missing.
      const city = resolvedCities[i % resolvedCities.length];

      const outcome = await this.prisma.$transaction((tx) =>
        this.persistShow(tx, {
          artistId: artist.id,
          cityId: city.id,
          date: parseIsoDate(showDef.date),
          venue: `${city.venueLabel} — ${city.name}`,
          externalId: showDef.externalId,
          songTitles: showDef.songTitles,
        }),
      );

      if (outcome.showCreated) {
        summary.shows.created++;
      } else {
        summary.shows.updated++;
      }

      if (outcome.setlistCreated) {
        summary.setlists.created++;
        summary.songs.created += outcome.songsCount;
      } else if (outcome.setlistUpdated) {
        summary.setlists.updated++;
        summary.songs.updated += outcome.songsCount;
      }
    }

    return summary;
  }

  private async resolveCities(citiesSkipped: string[]): Promise<ResolvedCity[]> {
    const resolved: ResolvedCity[] = [];

    for (const cityDef of DEMO_CITIES) {
      const city = await this.prisma.city.findFirst({
        where: {
          name: cityDef.name,
          country: { code: cityDef.countryCode },
        },
      });

      if (city) {
        resolved.push({
          id: city.id,
          name: city.name,
          venueLabel: cityDef.venueLabel,
        });
      } else {
        citiesSkipped.push(`${cityDef.name}, ${cityDef.countryCode}`);
      }
    }

    return resolved;
  }

  // Same idempotent shape as SetlistFmSyncService.persistShow: find-or-create
  // the Show by externalId, find-or-create its Setlist, then replace the
  // Setlist's songs wholesale (delete + recreate) so re-running never
  // duplicates SetlistSong rows regardless of whether the demo data changed.
  private async persistShow(
    tx: Prisma.TransactionClient,
    input: PersistShowInput,
  ): Promise<PersistShowOutcome> {
    const existingShow = await tx.show.findUnique({
      where: { externalId: input.externalId },
    });

    const show = existingShow
      ? await tx.show.update({
          where: { id: existingShow.id },
          data: {
            date: input.date,
            venue: input.venue,
            cityId: input.cityId,
          },
        })
      : await tx.show.create({
          data: {
            artistId: input.artistId,
            cityId: input.cityId,
            date: input.date,
            venue: input.venue,
            externalId: input.externalId,
          },
        });

    const existingSetlist = await tx.setlist.findUnique({
      where: { showId: show.id },
    });
    const setlist =
      existingSetlist ??
      (await tx.setlist.create({ data: { showId: show.id } }));

    await tx.setlistSong.deleteMany({ where: { setlistId: setlist.id } });
    await tx.setlistSong.createMany({
      data: input.songTitles.map((title, index) => ({
        setlistId: setlist.id,
        title,
        position: index + 1,
      })),
    });

    return {
      showCreated: !existingShow,
      setlistCreated: !existingSetlist,
      setlistUpdated: !!existingSetlist,
      songsCount: input.songTitles.length,
    };
  }
}

// date is "yyyy-MM-dd".
function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
