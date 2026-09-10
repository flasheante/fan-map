import { SetlistFmApiError } from './setlist-fm.errors';
import {
  DEFAULT_SETLIST_FM_RETRY_DELAYS_MS,
  withSetlistFmRetry,
} from './setlist-fm-retry';

describe('withSetlistFmRetry', () => {
  function rateLimitError() {
    return new SetlistFmApiError(
      429,
      'setlist.fm request failed with status 429: {"message":"Too Many Requests"}',
    );
  }

  function fakeSleep() {
    return jest.fn<Promise<void>, [number]>().mockResolvedValue(undefined);
  }

  it('returns the result on the first try when run() succeeds', async () => {
    const run = jest.fn().mockResolvedValue('ok');
    const sleep = fakeSleep();

    const result = await withSetlistFmRetry(run, { sleep });

    expect(result).toBe('ok');
    expect(run).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('rethrows immediately, without sleeping or retrying, on a non-429 error', async () => {
    const error = new Error('setlist.fm is down');
    const run = jest.fn().mockRejectedValue(error);
    const sleep = fakeSleep();

    await expect(withSetlistFmRetry(run, { sleep })).rejects.toBe(error);

    expect(run).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('rethrows immediately on a non-429 SetlistFmApiError (e.g. 404)', async () => {
    const error = new SetlistFmApiError(404, 'not found');
    const run = jest.fn().mockRejectedValue(error);
    const sleep = fakeSleep();

    await expect(withSetlistFmRetry(run, { sleep })).rejects.toBe(error);

    expect(run).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a 429 on the default schedule and returns the eventual success', async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(rateLimitError())
      .mockRejectedValueOnce(rateLimitError())
      .mockResolvedValueOnce('ok');
    const sleep = fakeSleep();

    const result = await withSetlistFmRetry(run, { sleep });

    expect(result).toBe('ok');
    expect(run).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual(
      DEFAULT_SETLIST_FM_RETRY_DELAYS_MS.slice(0, 2),
    );
  });

  it('gives up and rethrows once every retry in the schedule is exhausted', async () => {
    const finalError = rateLimitError();
    const run = jest
      .fn()
      .mockRejectedValueOnce(rateLimitError())
      .mockRejectedValueOnce(rateLimitError())
      .mockRejectedValueOnce(rateLimitError())
      .mockRejectedValueOnce(finalError);
    const sleep = fakeSleep();

    await expect(
      withSetlistFmRetry(run, {
        delaysMs: [10, 20, 30],
        sleep,
      }),
    ).rejects.toBe(finalError);

    // 1 initial attempt + 3 retries = 4 calls, but only 3 sleeps (one per
    // retry, none after the final, exhausted attempt).
    expect(run).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([10, 20, 30]);
  });

  it('calls onRetry with the attempt number, delay, and error before each sleep', async () => {
    const firstError = rateLimitError();
    const run = jest
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockResolvedValueOnce('ok');
    const sleep = fakeSleep();
    const onRetry = jest.fn();

    await withSetlistFmRetry(run, { delaysMs: [42], sleep, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, 42, firstError);
  });

  it('respects a custom delay schedule instead of the default one', async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(rateLimitError())
      .mockResolvedValueOnce('ok');
    const sleep = fakeSleep();

    await withSetlistFmRetry(run, { delaysMs: [5], sleep });

    expect(sleep).toHaveBeenCalledWith(5);
  });
});
