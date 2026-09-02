import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  MusicBrainzApiError,
  MusicBrainzInvalidResponseError,
} from './musicbrainz.errors';
import { MusicBrainzRateLimiter } from './musicbrainz.rate-limiter';
import {
  MusicBrainzReleaseGroupsPage,
  MusicBrainzReleaseGroupWithReleases,
  MusicBrainzReleaseWithRecordings,
} from './musicbrainz.types';

export const MUSICBRAINZ_DEFAULT_BASE_URL = 'https://musicbrainz.org/ws/2';
// MusicBrainz's default page size for browse requests (release-group, etc.)
// is 25; 100 is the documented maximum, so this fetches the fewest possible
// pages for The Warning's ~25 release-groups today and still headroom for a
// bigger catalog later. See musicbrainz-sync.service.ts for pagination.
export const MUSICBRAINZ_BROWSE_PAGE_SIZE = 100;

// DI token for the MusicBrainzRateLimiter instance — same reasoning as
// SETLIST_FM_RATE_LIMITER (see setlist-fm.client.ts): MusicBrainzRateLimiter
// is a plain class (no @Injectable), wired in via a factory provider in
// MusicBrainzModule under this token.
export const MUSICBRAINZ_RATE_LIMITER = Symbol('MUSICBRAINZ_RATE_LIMITER');

export interface MusicBrainzClientConfig {
  baseUrl?: string;
  /**
   * Sent as the User-Agent header on every request. MusicBrainz requires a
   * descriptive User-Agent identifying the application and a way to contact
   * its maintainer (https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)
   * — requests without one risk being blocked. Defaults to a value built
   * from MUSICBRAINZ_CONTACT (see musicbrainz.module.ts) when not given.
   */
  userAgent?: string;
}

const DEFAULT_USER_AGENT = 'fan-map/0.1.0 (no contact configured)';

// Talks HTTP to the MusicBrainz Web Service — nothing else. No PrismaService,
// no domain models: callers get back MusicBrainz's own shapes
// (musicbrainz.types.ts) and map them to our domain themselves. Same
// division of responsibility as SetlistFmClient.
//
// Every request is gated by a MusicBrainzRateLimiter (see
// musicbrainz.rate-limiter.ts), called immediately before fetch() — this is
// deliberately the *only* place that happens, so no future caller of this
// client can accidentally bypass it.
@Injectable()
export class MusicBrainzClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly rateLimiter: MusicBrainzRateLimiter;

  // @Optional() here for the same reason as SetlistFmClient's constructor
  // (see its comment): MusicBrainzClientConfig is a plain interface, erased
  // to `Object` in emitted metadata, so Nest can't resolve a provider for it
  // on its own.
  constructor(
    @Optional() config: MusicBrainzClientConfig = {},
    @Optional()
    @Inject(MUSICBRAINZ_RATE_LIMITER)
    rateLimiter?: MusicBrainzRateLimiter,
  ) {
    this.baseUrl = config.baseUrl ?? MUSICBRAINZ_DEFAULT_BASE_URL;
    this.userAgent = config.userAgent ?? DEFAULT_USER_AGENT;
    this.rateLimiter = rateLimiter ?? new MusicBrainzRateLimiter();
  }

  // GET /release-group?artist={mbid} — one page of the artist's
  // release-groups (albums/EPs/singles/etc., see musicbrainz.types.ts).
  async getArtistReleaseGroups(
    artistMbid: string,
    offset = 0,
  ): Promise<MusicBrainzReleaseGroupsPage> {
    const body = await this.get(
      `/release-group?artist=${encodeURIComponent(artistMbid)}` +
        `&limit=${MUSICBRAINZ_BROWSE_PAGE_SIZE}&offset=${offset}`,
    );

    if (
      typeof body !== 'object' ||
      body === null ||
      !Array.isArray((body as Record<string, unknown>)['release-groups'])
    ) {
      throw new MusicBrainzInvalidResponseError(
        'MusicBrainz response is missing the expected "release-groups" array',
      );
    }
    return body as MusicBrainzReleaseGroupsPage;
  }

  // GET /release-group/{id}?inc=releases — the releases belonging to one
  // release-group, used to pick a representative release to read tracks
  // from (see resolveRepresentativeRelease in musicbrainz-sync.service.ts).
  async getReleaseGroupReleases(
    releaseGroupId: string,
  ): Promise<MusicBrainzReleaseGroupWithReleases> {
    const body = await this.get(
      `/release-group/${encodeURIComponent(releaseGroupId)}?inc=releases`,
    );

    if (
      typeof body !== 'object' ||
      body === null ||
      !Array.isArray((body as Record<string, unknown>).releases)
    ) {
      throw new MusicBrainzInvalidResponseError(
        'MusicBrainz response is missing the expected "releases" array',
      );
    }
    return body as MusicBrainzReleaseGroupWithReleases;
  }

  // GET /release/{id}?inc=recordings — the track listing (media + tracks +
  // recordings) of one release.
  async getReleaseRecordings(
    releaseId: string,
  ): Promise<MusicBrainzReleaseWithRecordings> {
    const body = await this.get(
      `/release/${encodeURIComponent(releaseId)}?inc=recordings`,
    );

    if (
      typeof body !== 'object' ||
      body === null ||
      !Array.isArray((body as Record<string, unknown>).media)
    ) {
      throw new MusicBrainzInvalidResponseError(
        'MusicBrainz response is missing the expected "media" array',
      );
    }
    return body as MusicBrainzReleaseWithRecordings;
  }

  private async get(path: string): Promise<unknown> {
    // Gated right before the real network call — see the class comment.
    await this.rateLimiter.acquire();

    const separator = path.includes('?') ? '&' : '?';
    const url = `${this.baseUrl}${path}${separator}fmt=json`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': this.userAgent,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await safeReadText(response);
      throw new MusicBrainzApiError(
        response.status,
        `MusicBrainz request failed with status ${response.status}: ${body}`,
      );
    }

    return response.json();
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
