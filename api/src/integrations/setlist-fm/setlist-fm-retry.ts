import { SetlistFmApiError } from './setlist-fm.errors';

// Retries a setlist.fm operation that failed with a 429, on a fixed backoff
// schedule — for src/cli/sync-setlist-fm.ts, which runs unattended (weekly
// GitHub Actions cron, plus ad-hoc workflow_dispatch) with nobody watching to
// re-run it by hand. SetlistFmClient and SetlistFmRateLimiter deliberately do
// NOT retry (see their own file comments, and the "without retrying" tests in
// setlist-fm.client.spec.ts / setlist-fm-sync.service.spec.ts) — this is the
// one layer that does, and only for 429.
//
// A 429 here almost never means *this run's* own pacing was wrong: the
// in-process rate limiter enforces setlist.fm's published 2 req/s and
// 1,440/day budget from a cold start every run, and The Warning's setlist
// history is a handful of pages — nowhere near either ceiling. It means the
// real, server-side budget was already spent before this run started (e.g.
// an earlier manual workflow_dispatch test run earlier the same day) or the
// calling IP (GitHub Actions runners share IP ranges across unrelated jobs)
// is already rate-limited independently of this app. Neither clears
// instantly, so the backoff is deliberately coarse (30s / 90s / 5min) rather
// than a tight exponential ramp — this isn't smoothing out a burst, it's
// giving a shared/blocked resource a real chance to free up before giving up
// and letting the run fail, to be picked up by next week's scheduled run (or
// a manual retry).
export const DEFAULT_SETLIST_FM_RETRY_DELAYS_MS = [30_000, 90_000, 300_000];

export interface SetlistFmRetryOptions {
  delaysMs?: number[];
  onRetry?: (
    attempt: number,
    delayMs: number,
    error: SetlistFmApiError,
  ) => void;
  /** Injectable delay, for tests. Defaults to a real setTimeout-based sleep. */
  sleep?: (ms: number) => Promise<void>;
}

// run() is called again from scratch on each retry (not resumed) — safe here
// because SetlistFmSyncService.syncTheWarning() only starts persisting once
// *all* pages have fetched successfully, so a 429 partway through a
// multi-page fetch has nothing persisted yet to duplicate (see the "stops
// paginating immediately and persists nothing" test).
export async function withSetlistFmRetry<T>(
  run: () => Promise<T>,
  options: SetlistFmRetryOptions = {},
): Promise<T> {
  const delaysMs = options.delaysMs ?? DEFAULT_SETLIST_FM_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const isRateLimited =
        error instanceof SetlistFmApiError && error.status === 429;
      if (!isRateLimited || attempt >= delaysMs.length) {
        throw error;
      }
      const delayMs = delaysMs[attempt];
      options.onRetry?.(attempt + 1, delayMs, error);
      await sleep(delayMs);
    }
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
