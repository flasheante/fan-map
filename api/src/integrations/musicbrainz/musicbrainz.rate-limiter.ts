// Enforces MusicBrainz's published API limit
// (https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting — "never make
// more than ONE call per second") *before* any HTTP request is made.
// Deliberately framework-free — no Prisma, no Nest decorators — so it can be
// unit-tested on its own and reused by any future caller of
// MusicBrainzClient. Same shape as SetlistFmRateLimiter (see
// setlist-fm.rate-limiter.ts), minus the daily cap: MusicBrainz publishes no
// daily budget, only the 1 req/s ceiling.
//
// Usage, right before the real fetch():
//
//   await rateLimiter.acquire();
//   const response = await fetch(url, ...);
//
// acquire() does NOT retry and does NOT talk to MusicBrainz itself — it only
// decides *when* the caller is allowed to make its own request.
export interface MusicBrainzRateLimiterOptions {
  maxRequestsPerSecond?: number;
  /** Injectable clock, for tests. Defaults to Date.now. */
  now?: () => number;
}

export const MUSICBRAINZ_MAX_REQUESTS_PER_SECOND = 1;

export class MusicBrainzRateLimiter {
  private readonly minIntervalMs: number;
  private readonly now: () => number;

  private lastGrantedAt: number | null = null;

  // Same reasoning as SetlistFmRateLimiter.queue: every acquire() is chained
  // onto this promise so overlapping callers are granted one at a time, in
  // call order, instead of racing each other to read/update lastGrantedAt.
  private queue: Promise<void> = Promise.resolve();

  constructor(options: MusicBrainzRateLimiterOptions = {}) {
    const maxRequestsPerSecond = isValidRate(options.maxRequestsPerSecond)
      ? options.maxRequestsPerSecond
      : MUSICBRAINZ_MAX_REQUESTS_PER_SECOND;
    this.minIntervalMs = 1000 / maxRequestsPerSecond;
    this.now = options.now ?? (() => Date.now());
  }

  async acquire(): Promise<void> {
    const turn = this.queue.then(() => this.grant());
    this.queue = turn;
    return turn;
  }

  private async grant(): Promise<void> {
    if (this.lastGrantedAt !== null) {
      const elapsed = this.now() - this.lastGrantedAt;
      const waitMs = this.minIntervalMs - elapsed;
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    }
    this.lastGrantedAt = this.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Guards against any maxRequestsPerSecond that would make 1000/x an invalid
// or nonsensical interval (NaN, 0, negative, or +/-Infinity) — same as
// SetlistFmRateLimiter's isValidRate.
function isValidRate(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
