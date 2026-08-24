import { Module } from '@nestjs/common';
import { SETLIST_FM_RATE_LIMITER, SetlistFmClient } from './setlist-fm.client';
import { SetlistFmRateLimiter } from './setlist-fm.rate-limiter';

@Module({
  providers: [
    // One SetlistFmRateLimiter instance per application context, shared by
    // every request SetlistFmClient makes — this is what makes the 2 req/s
    // and 1,440/day budgets apply across the whole sync run (and any other
    // future caller), not per-call. SetlistFmRateLimiter is a plain class
    // (framework-free, unit-tested on its own), so it's wired in as a
    // factory provider under SETLIST_FM_RATE_LIMITER rather than via
    // useClass.
    {
      provide: SETLIST_FM_RATE_LIMITER,
      useFactory: () => new SetlistFmRateLimiter(),
    },
    SetlistFmClient,
  ],
  exports: [SetlistFmClient],
})
export class SetlistFmModule {}
