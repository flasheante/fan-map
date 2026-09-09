import { Injectable, NotFoundException } from '@nestjs/common';
import { City, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SetlistFmClient } from '../integrations/setlist-fm/setlist-fm.client';
import {
  SetlistFmCity,
  SetlistFmSet,
  SetlistFmSetlist,
} from '../integrations/setlist-fm/setlist-fm.types';

// This slice only syncs one artist, manually. See AGENTS.md slice notes:
// no generic "sync any artist from HTTP" support yet, on purpose.
export const THE_WARNING_SLUG = 'the-warning';
export const THE_WARNING_SETLIST_FM_MBID =
  '7f625f35-7e53-4f08-9201-16643979484b';

// Optional progress hooks for callers that want to surface what's happening
// (currently just the CLI — see src/cli/sync-setlist-fm.ts). Purely
// observational: no hook here changes what gets fetched or persisted, and
// the default {} means existing callers/tests see no behaviour change.
export interface SetlistFmSyncProgress {
  onPageFetchStart?: (page: number) => void;
}

export interface SetlistFmSyncSummary {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  setlistsCreated: number;
  setlistsUpdated: number;
  citiesNotFound: { city: string; country: string }[];
}

interface ShowInput {
  artistId: string;
  cityId: string;
  date: Date;
  venue: string | null;
  externalId: string;
  songTitles: string[];
}

interface PersistOutcome {
  showCreated: boolean;
  setlistCreated: boolean;
  setlistUpdated: boolean;
}

// Imports the shows/setlists of The Warning from setlist.fm. A manual/internal
// operation for now (see prisma/seed.ts for how the artist itself is
// seeded) — triggered by src/cli/sync-setlist-fm.ts, not by an HTTP endpoint.
@Injectable()
export class SetlistFmSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: SetlistFmClient,
  ) {}

  async syncTheWarning(
    progress: SetlistFmSyncProgress = {},
  ): Promise<SetlistFmSyncSummary> {
    const artist = await this.prisma.artist.findUnique({
      where: { slug: THE_WARNING_SLUG },
    });
    if (!artist) {
      throw new NotFoundException(
        `Artist with slug "${THE_WARNING_SLUG}" not found`,
      );
    }

    const externalSetlists = await this.fetchAllSetlists(progress);

    const summary: SetlistFmSyncSummary = {
      fetched: externalSetlists.length,
      created: 0,
      updated: 0,
      skipped: 0,
      setlistsCreated: 0,
      setlistsUpdated: 0,
      citiesNotFound: [],
    };
    const reportedMissingCities = new Set<string>();

    for (const externalSetlist of externalSetlists) {
      const cityRef = externalSetlist.venue?.city;
      const city = cityRef ? await this.resolveCity(cityRef) : null;

      if (!city) {
        summary.skipped++;
        if (cityRef) {
          const key = `${cityRef.country.code}|${cityRef.name}`;
          if (!reportedMissingCities.has(key)) {
            reportedMissingCities.add(key);
            summary.citiesNotFound.push({
              city: cityRef.name,
              country: cityRef.country.code,
            });
          }
        }
        continue;
      }

      const outcome = await this.prisma.$transaction((tx) =>
        this.persistShow(tx, {
          artistId: artist.id,
          cityId: city.id,
          date: parseEventDate(externalSetlist.eventDate),
          venue: externalSetlist.venue.name ?? null,
          externalId: externalSetlist.id,
          songTitles: flattenSongTitles(externalSetlist.sets?.set),
        }),
      );

      if (outcome.showCreated) {
        summary.created++;
      } else {
        summary.updated++;
      }
      if (outcome.setlistCreated) summary.setlistsCreated++;
      if (outcome.setlistUpdated) summary.setlistsUpdated++;
    }

    // Sólo se llega hasta acá si el loop de arriba no tiró — si
    // fetchAllSetlists o algún persistShow fallan, la excepción corta la
    // función antes de esta línea y setlistsSyncedAt queda como estaba, sin
    // marcar como "sincronizado" algo que en realidad falló a mitad de
    // camino.
    await this.prisma.artist.update({
      where: { id: artist.id },
      data: { setlistsSyncedAt: new Date() },
    });

    return summary;
  }

  // Strictly sequential: each page is only requested after the previous one
  // has resolved. SetlistFmClient.getArtistSetlists() gates every one of
  // these calls through SetlistFmRateLimiter.acquire() (see
  // setlist-fm.client.ts) — this loop doesn't wait or throttle itself, it
  // just never issues a page N+1 request before page N has returned.
  private async fetchAllSetlists(
    progress: SetlistFmSyncProgress,
  ): Promise<SetlistFmSetlist[]> {
    const all: SetlistFmSetlist[] = [];
    let page = 1;

    for (;;) {
      progress.onPageFetchStart?.(page);
      const response = await this.client.getArtistSetlists(
        THE_WARNING_SETLIST_FM_MBID,
        page,
      );
      all.push(...response.setlist);

      if (response.setlist.length === 0 || all.length >= response.total) {
        break;
      }
      page++;
    }

    return all;
  }

  private async resolveCity(cityRef: SetlistFmCity): Promise<City | null> {
    const country = await this.prisma.country.findUnique({
      where: { code: cityRef.country.code.toUpperCase() },
    });
    if (!country) {
      return null;
    }

    return this.prisma.city.findUnique({
      where: {
        countryId_name: { countryId: country.id, name: cityRef.name },
      },
    });
  }

  // Runs inside a small, per-show transaction: the setlist.fm HTTP call has
  // already happened by the time this executes.
  private async persistShow(
    tx: Prisma.TransactionClient,
    input: ShowInput,
  ): Promise<PersistOutcome> {
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

    let setlistCreated = false;
    let setlistUpdated = false;

    if (input.songTitles.length > 0) {
      const existingSetlist = await tx.setlist.findUnique({
        where: { showId: show.id },
      });
      const setlist =
        existingSetlist ??
        (await tx.setlist.create({ data: { showId: show.id } }));

      if (existingSetlist) {
        await tx.setlistSong.deleteMany({
          where: { setlistId: setlist.id },
        });
        setlistUpdated = true;
      } else {
        setlistCreated = true;
      }

      await tx.setlistSong.createMany({
        data: input.songTitles.map((title, index) => ({
          setlistId: setlist.id,
          title,
          position: index + 1,
        })),
      });
    }

    return {
      showCreated: !existingShow,
      setlistCreated,
      setlistUpdated,
    };
  }
}

// eventDate is "dd-MM-yyyy" (see setlist-fm.types.ts).
function parseEventDate(eventDate: string): Date {
  const [day, month, year] = eventDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Songs across all sets (regular + encores), in performance order — that
// order becomes SetlistSong.position, 1-based.
function flattenSongTitles(sets: SetlistFmSet[] = []): string[] {
  return sets.flatMap((set) => set.song.map((song) => song.name));
}
