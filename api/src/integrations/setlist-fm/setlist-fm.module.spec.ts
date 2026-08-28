import { Test } from '@nestjs/testing';
import { SETLIST_FM_RATE_LIMITER } from './setlist-fm.client';
import { SetlistFmModule } from './setlist-fm.module';
import { SetlistFmRateLimiter } from './setlist-fm.rate-limiter';

// Covers the composition-root wiring: SetlistFmModule reads
// SETLIST_FM_REQUESTS_PER_SECOND from process.env and uses it to build the
// shared SetlistFmRateLimiter instance. SetlistFmRateLimiter's own behaviour
// (once built with a given maxRequestsPerSecond) is covered on its own in
// setlist-fm.rate-limiter.spec.ts — these tests only check that the env var
// is read, converted, defaulted and passed through correctly.
describe('SetlistFmModule', () => {
  const ORIGINAL_ENV = process.env.SETLIST_FM_REQUESTS_PER_SECOND;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (ORIGINAL_ENV === undefined) {
      delete process.env.SETLIST_FM_REQUESTS_PER_SECOND;
    } else {
      process.env.SETLIST_FM_REQUESTS_PER_SECOND = ORIGINAL_ENV;
    }
  });

  // Builds the module, pulls out the shared rate limiter, and asserts the
  // minimum interval it enforces between two acquire() calls — this is the
  // only externally observable behaviour of "what requestsPerSecond it was
  // built with", since minIntervalMs itself is private.
  async function getConfiguredRateLimiter(): Promise<SetlistFmRateLimiter> {
    const moduleRef = await Test.createTestingModule({
      imports: [SetlistFmModule],
    }).compile();
    return moduleRef.get(SETLIST_FM_RATE_LIMITER);
  }

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

  it('builds a shared SetlistFmRateLimiter, resolvable via SETLIST_FM_RATE_LIMITER', async () => {
    delete process.env.SETLIST_FM_REQUESTS_PER_SECOND;
    const limiter = await getConfiguredRateLimiter();

    expect(limiter).toBeInstanceOf(SetlistFmRateLimiter);
  });

  it('defaults to 2 req/s (500ms interval) when SETLIST_FM_REQUESTS_PER_SECOND is not set', async () => {
    delete process.env.SETLIST_FM_REQUESTS_PER_SECOND;
    const limiter = await getConfiguredRateLimiter();

    await expectMinInterval(limiter, 500);
  });

  it('honours SETLIST_FM_REQUESTS_PER_SECOND=0.5 (2000ms interval)', async () => {
    process.env.SETLIST_FM_REQUESTS_PER_SECOND = '0.5';
    const limiter = await getConfiguredRateLimiter();

    await expectMinInterval(limiter, 2000);
  });

  it('honours SETLIST_FM_REQUESTS_PER_SECOND=1 (1000ms interval)', async () => {
    process.env.SETLIST_FM_REQUESTS_PER_SECOND = '1';
    const limiter = await getConfiguredRateLimiter();

    await expectMinInterval(limiter, 1000);
  });

  it.each(['not-a-number', '0', '-3'])(
    'falls back to the 2 req/s default when SETLIST_FM_REQUESTS_PER_SECOND=%s is invalid',
    async (invalidValue) => {
      process.env.SETLIST_FM_REQUESTS_PER_SECOND = invalidValue;
      const limiter = await getConfiguredRateLimiter();

      await expectMinInterval(limiter, 500);
    },
  );

  it(
    'keeps the daily limit at 1440 regardless of SETLIST_FM_REQUESTS_PER_SECOND',
    async () => {
      process.env.SETLIST_FM_REQUESTS_PER_SECOND = '1000';
      const limiter = await getConfiguredRateLimiter();

      // Advances by 500ms each time — enough to clear the *current* 2 req/s
      // default's interval regardless of whether SETLIST_FM_REQUESTS_PER_SECOND
      // has been wired up yet, so this test exercises the daily cap itself
      // rather than tripping over the per-second interval.
      for (let i = 0; i < 1440; i++) {
        await limiter.acquire();
        await jest.advanceTimersByTimeAsync(500);
      }
      expect(limiter.requestsGrantedTodayCount).toBe(1440);

      await expect(limiter.acquire()).rejects.toThrow(/1440/);
    },
    30000,
  );
});
