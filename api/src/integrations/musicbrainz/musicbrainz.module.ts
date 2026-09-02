import { Module } from '@nestjs/common';
import {
  MUSICBRAINZ_RATE_LIMITER,
  MusicBrainzClient,
} from './musicbrainz.client';
import {
  MUSICBRAINZ_MAX_REQUESTS_PER_SECOND,
  MusicBrainzRateLimiter,
} from './musicbrainz.rate-limiter';

// Reads MUSICBRAINZ_REQUESTS_PER_SECOND from the environment and converts it
// to the number MusicBrainzRateLimiter expects — same split as
// SetlistFmModule/resolveRequestsPerSecond: MusicBrainzRateLimiter itself
// stays framework/env-free, and a misconfigured env var never leaves the
// app unable to call MusicBrainz at all (falls back to the 1 req/s default).
function resolveRequestsPerSecond(raw: string | undefined): number {
  if (raw === undefined) {
    return MUSICBRAINZ_MAX_REQUESTS_PER_SECOND;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : MUSICBRAINZ_MAX_REQUESTS_PER_SECOND;
}

// MUSICBRAINZ_CONTACT (an email or a URL, e.g. a repo link) becomes part of
// the User-Agent every request sends, as MusicBrainz's own policy asks
// (https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting) — requests
// without a way to contact the maintainer risk being blocked. Never
// required to boot the app (same "never throw on missing config" stance as
// SetlistFmModule), just falls back to a generic, contact-less User-Agent.
function resolveUserAgent(contact: string | undefined): string {
  return contact
    ? `fan-map/0.1.0 (${contact})`
    : 'fan-map/0.1.0 (no contact configured)';
}

@Module({
  providers: [
    // One MusicBrainzRateLimiter instance per application context, shared by
    // every request MusicBrainzClient makes — same reasoning as
    // SETLIST_FM_RATE_LIMITER in SetlistFmModule.
    {
      provide: MUSICBRAINZ_RATE_LIMITER,
      useFactory: () =>
        new MusicBrainzRateLimiter({
          maxRequestsPerSecond: resolveRequestsPerSecond(
            process.env.MUSICBRAINZ_REQUESTS_PER_SECOND,
          ),
        }),
    },
    {
      provide: MusicBrainzClient,
      useFactory: (rateLimiter: MusicBrainzRateLimiter) =>
        new MusicBrainzClient(
          { userAgent: resolveUserAgent(process.env.MUSICBRAINZ_CONTACT) },
          rateLimiter,
        ),
      inject: [MUSICBRAINZ_RATE_LIMITER],
    },
  ],
  exports: [MusicBrainzClient],
})
export class MusicBrainzModule {}
