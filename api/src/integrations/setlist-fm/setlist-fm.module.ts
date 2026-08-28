import { Module } from '@nestjs/common';
import { SETLIST_FM_RATE_LIMITER, SetlistFmClient } from './setlist-fm.client';
import {
  SETLIST_FM_MAX_REQUESTS_PER_SECOND,
  SetlistFmRateLimiter,
} from './setlist-fm.rate-limiter';

// Reads SETLIST_FM_REQUESTS_PER_SECOND from the environment and converts it
// to the number SetlistFmRateLimiter expects. This is the one place env
// parsing happens — SetlistFmRateLimiter itself stays framework/env-free
// (see setlist-fm.rate-limiter.ts) and just gets handed a plain number.
// Falls back to the 2 req/s default (silently, never throwing) for anything
// that isn't a finite, positive number: unset, unparseable, zero, or
// negative — a misconfigured env var should never leave the app unable to
// call setlist.fm at all.
function resolveRequestsPerSecond(raw: string | undefined): number {
  if (raw === undefined) {
    return SETLIST_FM_MAX_REQUESTS_PER_SECOND;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : SETLIST_FM_MAX_REQUESTS_PER_SECOND;
}

@Module({
  providers: [
    // One SetlistFmRateLimiter instance per application context, shared by
    // every request SetlistFmClient makes — this is what makes the req/s
    // and 1,440/day budgets apply across the whole sync run (and any other
    // future caller), not per-call. SetlistFmRateLimiter is a plain class
    // (framework-free, unit-tested on its own), so it's wired in as a
    // factory provider under SETLIST_FM_RATE_LIMITER rather than via
    // useClass.
    {
      provide: SETLIST_FM_RATE_LIMITER,
      useFactory: () =>
        new SetlistFmRateLimiter({
          maxRequestsPerSecond: resolveRequestsPerSecond(
            process.env.SETLIST_FM_REQUESTS_PER_SECOND,
          ),
          maxRequestsPerDay: 1440,
        }),
    },
    SetlistFmClient,
  ],
  exports: [SetlistFmClient],
})
export class SetlistFmModule {}
