import { SetlistFmRateLimiter } from './setlist-fm.rate-limiter';

// SetlistFmRateLimiter is a small, framework-free abstraction (no Prisma, no
// Nest) that SetlistFmClient calls right before every real HTTP request to
// setlist.fm. These tests exercise it in isolation, with Jest fake timers so
// nothing here actually sleeps for real.
describe('SetlistFmRateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('grants the first acquire() immediately, with no wait', async () => {
    const limiter = new SetlistFmRateLimiter();
    const granted = jest.fn();

    void limiter.acquire().then(granted);
    await jest.advanceTimersByTimeAsync(0);

    expect(granted).toHaveBeenCalledTimes(1);
  });

  it('makes the second acquire() wait for the minimum interval (2 req/s -> 500ms)', async () => {
    const limiter = new SetlistFmRateLimiter();
    await limiter.acquire();

    const granted = jest.fn();
    void limiter.acquire().then(granted);

    await jest.advanceTimersByTimeAsync(499);
    expect(granted).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(granted).toHaveBeenCalledTimes(1);
  });

  it('runs several acquire() calls strictly sequentially, spaced by the interval', async () => {
    const limiter = new SetlistFmRateLimiter();
    const grantedAt: number[] = [];
    const start = Date.now();
    const record = () => grantedAt.push(Date.now() - start);

    const calls = [
      limiter.acquire().then(record),
      limiter.acquire().then(record),
      limiter.acquire().then(record),
      limiter.acquire().then(record),
    ];

    await jest.advanceTimersByTimeAsync(1500);
    await Promise.all(calls);

    expect(grantedAt).toEqual([0, 500, 1000, 1500]);
  });

  it('never grants two acquire() calls at the same instant, even when requested concurrently', async () => {
    const limiter = new SetlistFmRateLimiter();
    const grantedAt: number[] = [];
    const start = Date.now();

    const calls = Array.from({ length: 5 }, () =>
      limiter.acquire().then(() => grantedAt.push(Date.now() - start)),
    );

    await jest.advanceTimersByTimeAsync(2000);
    await Promise.all(calls);

    expect(grantedAt).toHaveLength(5);
    const sorted = [...grantedAt].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(500);
    }
  });

  it('rejects once the (custom) daily limit has been reached, without waiting', async () => {
    // maxRequestsPerSecond is turned way up here so the test isn't gated by
    // per-second spacing too — the daily cap is what's under test.
    const limiter = new SetlistFmRateLimiter({
      maxRequestsPerSecond: 1000,
      maxRequestsPerDay: 3,
    });

    await limiter.acquire();
    await jest.advanceTimersByTimeAsync(10);
    await limiter.acquire();
    await jest.advanceTimersByTimeAsync(10);
    await limiter.acquire();

    await expect(limiter.acquire()).rejects.toThrow(/daily/i);
  });

  it('does not increment the counter for a request that failed the daily limit check', async () => {
    const limiter = new SetlistFmRateLimiter({
      maxRequestsPerSecond: 1000,
      maxRequestsPerDay: 1,
    });

    await limiter.acquire();
    expect(limiter.requestsGrantedTodayCount).toBe(1);

    await expect(limiter.acquire()).rejects.toThrow();
    expect(limiter.requestsGrantedTodayCount).toBe(1);

    await expect(limiter.acquire()).rejects.toThrow();
    expect(limiter.requestsGrantedTodayCount).toBe(1);
  });

  it('defaults the daily limit to 1440 requests', async () => {
    const limiter = new SetlistFmRateLimiter({ maxRequestsPerSecond: 1000 });

    for (let i = 0; i < 1440; i++) {
      await limiter.acquire();
      await jest.advanceTimersByTimeAsync(1);
    }
    expect(limiter.requestsGrantedTodayCount).toBe(1440);

    await expect(limiter.acquire()).rejects.toThrow(/1440/);
  });

  it('defaults the per-second limit to 2 requests/second', async () => {
    const limiter = new SetlistFmRateLimiter();
    await limiter.acquire();

    const granted = jest.fn();
    void limiter.acquire().then(granted);

    await jest.advanceTimersByTimeAsync(499);
    expect(granted).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(granted).toHaveBeenCalledTimes(1);
  });
});
