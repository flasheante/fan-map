// Enforces setlist.fm's published API limits
// (https://api.setlist.fm/docs/1.0/index.html) *before* any HTTP request is
// made: max 2 requests/second, max 1,440 requests/day. Deliberately
// framework-free — no Prisma, no Nest decorators — so it can be unit-tested
// on its own and reused by any future caller of SetlistFmClient.
//
// Usage, right before the real fetch():
//
//   await rateLimiter.acquire();
//   const response = await fetch(url, ...);
//
// acquire() does NOT retry and does NOT talk to setlist.fm itself — it only
// decides *when* the caller is allowed to make its own request, and refuses
// outright once the daily budget is spent. It has no opinion on what the
// caller does with a 429 once granted.
export interface SetlistFmRateLimiterOptions {
  maxRequestsPerSecond?: number;
  maxRequestsPerDay?: number;
  /** Injectable clock, for tests. Defaults to Date.now. */
  now?: () => number;
}

export const SETLIST_FM_MAX_REQUESTS_PER_SECOND = 2;
export const SETLIST_FM_MAX_REQUESTS_PER_DAY = 1440;

export class SetlistFmRateLimiter {
  private readonly minIntervalMs: number;
  private readonly maxRequestsPerDay: number;
  private readonly now: () => number;

  private lastGrantedAt: number | null = null;
  private requestsGrantedToday = 0;

  // Every acquire() call is chained onto this promise, so overlapping
  // callers are decided one at a time, in call order, instead of racing each
  // other to read/update lastGrantedAt and requestsGrantedToday. This is
  // what guarantees strictly sequential pagination and rules out two
  // acquire()s ever being granted at the same instant.
  private queue: Promise<void> = Promise.resolve();

  constructor(options: SetlistFmRateLimiterOptions = {}) {
    const maxRequestsPerSecond =
      options.maxRequestsPerSecond ?? SETLIST_FM_MAX_REQUESTS_PER_SECOND;
    this.minIntervalMs = 1000 / maxRequestsPerSecond;
    this.maxRequestsPerDay =
      options.maxRequestsPerDay ?? SETLIST_FM_MAX_REQUESTS_PER_DAY;
    this.now = options.now ?? (() => Date.now());
  }

  /** Number of requests granted so far (for tests/inspection). */
  get requestsGrantedTodayCount(): number {
    return this.requestsGrantedToday;
  }

  // Resolves once it is this caller's turn to make an HTTP request, having
  // waited as long as necessary to respect the per-second limit. Rejects
  // immediately, without waiting and without granting anything, once the
  // daily limit has already been used up — the caller must not perform the
  // HTTP request in that case.
  async acquire(): Promise<void> {
    const turn = this.queue.then(() => this.grant());
    // Keep the queue chain alive even if this turn rejected (daily limit),
    // so a rejection here doesn't wedge every acquire() queued behind it.
    this.queue = turn.then(
      () => undefined,
      () => undefined,
    );
    return turn;
  }

  private async grant(): Promise<void> {
    if (this.requestsGrantedToday >= this.maxRequestsPerDay) {
      throw new Error(
        `setlist.fm daily rate limit reached: ${this.maxRequestsPerDay} requests already used. ` +
          'Refusing to make another request; try again on the next sync run.',
      );
    }

    if (this.lastGrantedAt !== null) {
      const elapsed = this.now() - this.lastGrantedAt;
      const waitMs = this.minIntervalMs - elapsed;
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    }

    // Counts as "used" the instant permission is granted — before the
    // caller's fetch() runs — because a granted request is a real HTTP
    // request the caller is now committed to making.
    this.requestsGrantedToday++;
    this.lastGrantedAt = this.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
