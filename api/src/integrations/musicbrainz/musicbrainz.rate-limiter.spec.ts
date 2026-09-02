import { MusicBrainzRateLimiter } from './musicbrainz.rate-limiter';

// MusicBrainzRateLimiter is a small, framework-free abstraction (no Prisma,
// no Nest) that MusicBrainzClient calls right before every real HTTP request
// to MusicBrainz. Same test shape as setlist-fm.rate-limiter.spec.ts, minus
// the daily-cap tests (MusicBrainz publishes no daily budget).
describe('MusicBrainzRateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('grants the first acquire() immediately, with no wait', async () => {
    const limiter = new MusicBrainzRateLimiter();
    const granted = jest.fn();

    void limiter.acquire().then(granted);
    await jest.advanceTimersByTimeAsync(0);

    expect(granted).toHaveBeenCalledTimes(1);
  });

  it('defaults the per-second limit to 1 request/second', async () => {
    const limiter = new MusicBrainzRateLimiter();
    await limiter.acquire();

    const granted = jest.fn();
    void limiter.acquire().then(granted);

    await jest.advanceTimersByTimeAsync(999);
    expect(granted).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(granted).toHaveBeenCalledTimes(1);
  });

  it('runs several acquire() calls strictly sequentially, spaced by the interval', async () => {
    const limiter = new MusicBrainzRateLimiter();
    const grantedAt: number[] = [];
    const start = Date.now();
    const record = () => grantedAt.push(Date.now() - start);

    const calls = [
      limiter.acquire().then(record),
      limiter.acquire().then(record),
      limiter.acquire().then(record),
    ];

    await jest.advanceTimersByTimeAsync(2000);
    await Promise.all(calls);

    expect(grantedAt).toEqual([0, 1000, 2000]);
  });

  it('never grants two acquire() calls at the same instant, even when requested concurrently', async () => {
    const limiter = new MusicBrainzRateLimiter();
    const grantedAt: number[] = [];
    const start = Date.now();

    const calls = Array.from({ length: 4 }, () =>
      limiter.acquire().then(() => grantedAt.push(Date.now() - start)),
    );

    await jest.advanceTimersByTimeAsync(3000);
    await Promise.all(calls);

    expect(grantedAt).toHaveLength(4);
    const sorted = [...grantedAt].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(1000);
    }
  });

  // Configurable requests/second (MUSICBRAINZ_REQUESTS_PER_SECOND). The env
  // var itself is read at the composition root (MusicBrainzModule), not
  // here — same split as SetlistFmRateLimiter/SetlistFmModule.
  it('accepts a custom requests-per-second rate', async () => {
    const limiter = new MusicBrainzRateLimiter({ maxRequestsPerSecond: 2 });
    await limiter.acquire();

    const granted = jest.fn();
    void limiter.acquire().then(granted);

    await jest.advanceTimersByTimeAsync(499);
    expect(granted).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(granted).toHaveBeenCalledTimes(1);
  });

  it('falls back to the default rate for an invalid maxRequestsPerSecond (zero, negative, NaN)', async () => {
    for (const invalid of [0, -1, NaN]) {
      const limiter = new MusicBrainzRateLimiter({
        maxRequestsPerSecond: invalid,
      });
      await limiter.acquire();

      const granted = jest.fn();
      void limiter.acquire().then(granted);

      await jest.advanceTimersByTimeAsync(999);
      expect(granted).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(1);
      expect(granted).toHaveBeenCalledTimes(1);
    }
  });
});
