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

  // Configurable requests/second (SETLIST_FM_REQUESTS_PER_SECOND). The env
  // var itself is read at the composition root (SetlistFmModule), not here —
  // these tests only cover what SetlistFmRateLimiter does with whatever
  // number it's constructed with.
  describe('configurable requests per second', () => {
    // Waits up to (but not including) the expected interval, asserting the
    // second acquire() is still pending, then crosses it and asserts it
    // resolves — i.e. the minimum interval is exactly `intervalMs`.
    async function expectMinInterval(
      limiter: SetlistFmRateLimiter,
      intervalMs: number,
    ) {
      await limiter.acquire();

      const granted = jest.fn();
      void limiter.acquire().then(granted);

      await jest.advanceTimersByTimeAsync(intervalMs - 1);
      expect(granted).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      expect(granted).toHaveBeenCalledTimes(1);
    }

    it('with no maxRequestsPerSecond given, keeps the 2 req/s default (500ms interval)', async () => {
      const limiter = new SetlistFmRateLimiter();
      await expectMinInterval(limiter, 500);
    });

    it('0.5 req/s means a minimum interval of 2000ms (one request every 2s)', async () => {
      const limiter = new SetlistFmRateLimiter({ maxRequestsPerSecond: 0.5 });
      await expectMinInterval(limiter, 2000);
    });

    it('1 req/s means a minimum interval of 1000ms', async () => {
      const limiter = new SetlistFmRateLimiter({ maxRequestsPerSecond: 1 });
      await expectMinInterval(limiter, 1000);
    });

    it('2 req/s means a minimum interval of 500ms', async () => {
      const limiter = new SetlistFmRateLimiter({ maxRequestsPerSecond: 2 });
      await expectMinInterval(limiter, 500);
    });

    // Invalid configuration must never produce an invalid (NaN, zero,
    // negative, or infinite) interval — it falls back to the 2 req/s
    // default instead of, say, waiting forever or not waiting at all.
    it.each([
      ['NaN', NaN],
      ['zero', 0],
      ['negative', -1],
    ])(
      'falls back to the 2 req/s default when maxRequestsPerSecond is %s',
      async (_label, invalidValue) => {
        const limiter = new SetlistFmRateLimiter({
          maxRequestsPerSecond: invalidValue,
        });
        await expectMinInterval(limiter, 500);
      },
    );

    it('the daily limit of 1440 keeps working unchanged regardless of the per-second rate', async () => {
      const limiter = new SetlistFmRateLimiter({ maxRequestsPerSecond: 0.5 });

      for (let i = 0; i < 1440; i++) {
        await limiter.acquire();
        await jest.advanceTimersByTimeAsync(2000);
      }
      expect(limiter.requestsGrantedTodayCount).toBe(1440);

      await expect(limiter.acquire()).rejects.toThrow(/1440/);
    });
  });
});
