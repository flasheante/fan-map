import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MusicBrainzClient } from '../integrations/musicbrainz/musicbrainz.client';
import {
  MusicBrainzRelease,
  MusicBrainzReleaseGroup,
} from '../integrations/musicbrainz/musicbrainz.types';

// This slice only syncs one artist, manually — same "one artist, no generic
// sync" scope as SetlistFmSyncService (see AGENTS.md slice notes referenced
// from src/cli/sync-setlist-fm.ts).
export const THE_WARNING_SLUG = 'the-warning';
// setlist.fm's own "mbid" field (see THE_WARNING_SETLIST_FM_MBID in
// setlist-fm-sync.service.ts) already IS a MusicBrainz artist id — setlist.fm
// uses MusicBrainz identifiers for artists — so this is the very same id,
// duplicated here rather than imported: this module has no reason to depend
// on the shows/setlist.fm slice just for a string constant.
export const THE_WARNING_MUSICBRAINZ_MBID =
  '7f625f35-7e53-4f08-9201-16643979484b';

// Only these count as "canonical studio catalog" for a fan setlist-builder:
// excludes "Broadcast" and "Other", and (via hasNoExcludedSecondaryType
// below) any Live/Compilation/Remix/Soundtrack edition of an album that
// would otherwise duplicate its songs under a second listing.
const KEPT_PRIMARY_TYPES = new Set(['Album', 'EP', 'Single']);
const EXCLUDED_SECONDARY_TYPES = new Set([
  'Live',
  'Compilation',
  'Remix',
  'Soundtrack',
  'Interview',
  'Audiobook',
  'Spokenword',
  'Demo',
  'Mixtape/Street',
]);

export interface MusicBrainzSyncProgress {
  onReleaseGroupFetchStart?: (title: string) => void;
}

export interface MusicBrainzSyncSummary {
  releaseGroupsFetched: number;
  releaseGroupsSkipped: number;
  tracksFetched: number;
  duplicateTracksSkipped: number;
  created: number;
  updated: number;
}

interface CandidateTrack {
  title: string;
  albumTitle: string;
  releaseDate: Date | null;
  mbid: string;
}

// Imports the song catalog of The Warning from MusicBrainz. A manual/internal
// operation, same shape as SetlistFmSyncService: triggered by
// src/cli/sync-musicbrainz.ts, not by an HTTP endpoint.
//
// Pipeline: getArtistReleaseGroups (all pages) → filter to studio
// albums/EPs/singles → per kept release-group, getReleaseGroupReleases →
// pick one representative release → getReleaseRecordings → flatten tracks →
// dedupe by normalized title, keeping the earliest release → upsert Song
// rows keyed by the recording's MusicBrainz id (Song.mbid), so re-running
// this never duplicates a song.
@Injectable()
export class MusicBrainzSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: MusicBrainzClient,
  ) {}

  async syncTheWarning(
    progress: MusicBrainzSyncProgress = {},
  ): Promise<MusicBrainzSyncSummary> {
    const artist = await this.prisma.artist.findUnique({
      where: { slug: THE_WARNING_SLUG },
    });
    if (!artist) {
      throw new NotFoundException(
        `Artist with slug "${THE_WARNING_SLUG}" not found`,
      );
    }

    const releaseGroups = await this.fetchAllReleaseGroups();
    const kept = releaseGroups
      .filter(isKeptReleaseGroup)
      .sort(byFirstReleaseDateAscending);

    const summary: MusicBrainzSyncSummary = {
      releaseGroupsFetched: releaseGroups.length,
      releaseGroupsSkipped: releaseGroups.length - kept.length,
      tracksFetched: 0,
      duplicateTracksSkipped: 0,
      created: 0,
      updated: 0,
    };

    const seenTitles = new Set<string>();
    const candidates: CandidateTrack[] = [];

    for (const releaseGroup of kept) {
      progress.onReleaseGroupFetchStart?.(releaseGroup.title);

      const { releases } = await this.client.getReleaseGroupReleases(
        releaseGroup.id,
      );
      const release = pickRepresentativeRelease(releases);
      if (!release) continue;

      const { media } = await this.client.getReleaseRecordings(release.id);
      const tracks = media.flatMap((medium) => medium.tracks);

      for (const track of tracks) {
        summary.tracksFetched++;
        const normalizedTitle = normalizeTitle(track.title);

        if (seenTitles.has(normalizedTitle)) {
          summary.duplicateTracksSkipped++;
          continue;
        }
        seenTitles.add(normalizedTitle);

        candidates.push({
          title: track.title,
          albumTitle: releaseGroup.title,
          releaseDate: parsePartialDate(releaseGroup['first-release-date']),
          mbid: track.recording.id,
        });
      }
    }

    for (const candidate of candidates) {
      const outcome = await this.upsertSong(artist.id, candidate);
      if (outcome === 'created') summary.created++;
      else summary.updated++;
    }

    return summary;
  }

  // Strictly sequential across pages, same criterion as
  // SetlistFmSyncService.fetchAllSetlists: MusicBrainzClient gates every
  // call through MusicBrainzRateLimiter.acquire() (see
  // musicbrainz.client.ts) — this loop doesn't throttle itself, it just
  // never issues offset N+1 before offset N has returned.
  private async fetchAllReleaseGroups(): Promise<MusicBrainzReleaseGroup[]> {
    const all: MusicBrainzReleaseGroup[] = [];
    let offset = 0;

    for (;;) {
      const response = await this.client.getArtistReleaseGroups(
        THE_WARNING_MUSICBRAINZ_MBID,
        offset,
      );
      const page = response['release-groups'];
      all.push(...page);

      if (page.length === 0 || all.length >= response['release-group-count']) {
        break;
      }
      offset += page.length;
    }

    return all;
  }

  private async upsertSong(
    artistId: string,
    candidate: CandidateTrack,
  ): Promise<'created' | 'updated'> {
    const existing = await this.prisma.song.findUnique({
      where: { mbid: candidate.mbid },
    });

    if (existing) {
      await this.prisma.song.update({
        where: { mbid: candidate.mbid },
        data: {
          title: candidate.title,
          albumTitle: candidate.albumTitle,
          releaseDate: candidate.releaseDate,
        },
      });
      return 'updated';
    }

    await this.prisma.song.create({
      data: {
        artistId,
        title: candidate.title,
        albumTitle: candidate.albumTitle,
        releaseDate: candidate.releaseDate,
        mbid: candidate.mbid,
      },
    });
    return 'created';
  }
}

function isKeptReleaseGroup(releaseGroup: MusicBrainzReleaseGroup): boolean {
  const primaryType = releaseGroup['primary-type'];
  if (!primaryType || !KEPT_PRIMARY_TYPES.has(primaryType)) return false;

  const secondaryTypes = releaseGroup['secondary-types'] ?? [];
  return !secondaryTypes.some((type) => EXCLUDED_SECONDARY_TYPES.has(type));
}

function byFirstReleaseDateAscending(
  a: MusicBrainzReleaseGroup,
  b: MusicBrainzReleaseGroup,
): number {
  const dateA = parsePartialDate(a['first-release-date']);
  const dateB = parsePartialDate(b['first-release-date']);
  // A release-group with no usable date sorts last: it must never "win" the
  // duplicate-title dedup above over one that does have a date.
  if (!dateA && !dateB) return 0;
  if (!dateA) return 1;
  if (!dateB) return -1;
  return dateA.getTime() - dateB.getTime();
}

// Prefers the "Official" release (the actual retail/streaming release, not
// a promo or bootleg) to read the track listing from; falls back to the
// first release when none is marked Official rather than skipping the
// release-group entirely.
function pickRepresentativeRelease(
  releases: MusicBrainzRelease[],
): MusicBrainzRelease | null {
  return (
    releases.find((release) => release.status === 'Official') ??
    releases[0] ??
    null
  );
}

// MusicBrainz dates can be partial ("", "2026", "2026-08", "2026-08-28") —
// see MusicBrainzReleaseGroup['first-release-date']. Missing month/day
// default to January/1st, which only matters for ordering (see
// byFirstReleaseDateAscending), never displayed at that granularity.
function parsePartialDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const [year, month, day] = raw.split('-').map(Number);
  if (!Number.isInteger(year)) return null;
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

// Quita diacríticos y normaliza mayúsculas/espacios para deduplicar títulos
// equivalentes entre distintas grabaciones (ej. una versión de single y la
// de álbum del mismo tema) — mismo criterio que normalize() en
// web/lib/tour-filters.ts, reimplementado acá porque api/ y web/ no
// comparten paquete.
function normalizeTitle(title: string): string {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}
