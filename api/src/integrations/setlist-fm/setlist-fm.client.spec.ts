import { Test } from '@nestjs/testing';
import { SetlistFmClient } from './setlist-fm.client';
import {
  SetlistFmApiError,
  SetlistFmConfigError,
  SetlistFmInvalidResponseError,
} from './setlist-fm.errors';
import { SetlistFmModule } from './setlist-fm.module';
import { SetlistFmRateLimiter } from './setlist-fm.rate-limiter';
import { SetlistFmSetlistsPage } from './setlist-fm.types';

// El cliente solo debe hablar HTTP contra setlist.fm: todo se prueba
// mockeando global.fetch, nunca contra la red real.
describe('SetlistFmClient', () => {
  let fetchMock: jest.Mock;

  const page: SetlistFmSetlistsPage = {
    setlist: [
      {
        id: 'abc123',
        versionId: 'v1',
        eventDate: '15-03-2026',
        artist: { mbid: 'artist-mbid', name: 'The Warning' },
        venue: {
          id: 'venue-1',
          name: 'Foro Sol',
          city: {
            id: 'city-1',
            name: 'Ciudad de México',
            country: { code: 'mx', name: 'Mexico' },
          },
        },
        sets: { set: [{ song: [{ name: 'Qué Más Da' }] }] },
        url: 'https://www.setlist.fm/setlist/abc123.html',
      },
    ],
    total: 1,
    page: 1,
    itemsPerPage: 20,
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    delete process.env.SETLIST_FM_API_KEY;
  });

  function jsonResponse(
    body: unknown,
    init?: { ok?: boolean; status?: number },
  ) {
    return {
      ok: init?.ok ?? true,
      status: init?.status ?? 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    };
  }

  it('returns the parsed setlists page on a successful response', async () => {
    fetchMock.mockResolvedValue(jsonResponse(page));
    const client = new SetlistFmClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.setlist.fm/rest/1.0',
    });

    const result = await client.getArtistSetlists('artist-mbid');

    expect(result).toEqual(page);
  });

  it('sends the api key and JSON accept header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(page));
    const client = new SetlistFmClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.setlist.fm/rest/1.0',
    });

    await client.getArtistSetlists('artist-mbid');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.setlist.fm/rest/1.0/artist/artist-mbid/setlists?p=1',
      {
        headers: {
          'x-api-key': 'test-key',
          Accept: 'application/json',
        },
      },
    );
  });

  it('requests the given page number', async () => {
    fetchMock.mockResolvedValue(jsonResponse(page));
    const client = new SetlistFmClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.setlist.fm/rest/1.0',
    });

    await client.getArtistSetlists('artist-mbid', 3);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.setlist.fm/rest/1.0/artist/artist-mbid/setlists?p=3',
      expect.any(Object),
    );
  });

  it('falls back to SETLIST_FM_API_KEY from the environment when no apiKey is given', async () => {
    process.env.SETLIST_FM_API_KEY = 'env-key';
    fetchMock.mockResolvedValue(jsonResponse(page));
    const client = new SetlistFmClient({
      baseUrl: 'https://api.setlist.fm/rest/1.0',
    });

    await client.getArtistSetlists('artist-mbid');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-api-key': 'env-key' }),
      }),
    );
  });

  it('throws SetlistFmConfigError and never calls fetch when no api key is configured', async () => {
    const client = new SetlistFmClient({
      baseUrl: 'https://api.setlist.fm/rest/1.0',
    });

    await expect(client.getArtistSetlists('artist-mbid')).rejects.toThrow(
      SetlistFmConfigError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws SetlistFmApiError with the HTTP status when setlist.fm returns an error', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'Not Found' }, { ok: false, status: 404 }),
    );
    const client = new SetlistFmClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.setlist.fm/rest/1.0',
    });

    const error = await client
      .getArtistSetlists('artist-mbid')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SetlistFmApiError);
    expect((error as SetlistFmApiError).status).toBe(404);
  });

  it('throws SetlistFmApiError with status 429 when setlist.fm rate-limits the request, without retrying', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { message: 'Too Many Requests' },
        { ok: false, status: 429 },
      ),
    );
    const client = new SetlistFmClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.setlist.fm/rest/1.0',
    });

    const error = await client
      .getArtistSetlists('artist-mbid')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(SetlistFmApiError);
    expect((error as SetlistFmApiError).status).toBe(429);
    // The client itself has no retry/backoff logic: one 429 means one fetch
    // call. Any retrying is (currently) the caller's problem, if anyone's.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws SetlistFmInvalidResponseError when the response body has no setlist array', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ total: 0, page: 1, itemsPerPage: 20 }),
    );
    const client = new SetlistFmClient({
      apiKey: 'test-key',
      baseUrl: 'https://api.setlist.fm/rest/1.0',
    });

    await expect(client.getArtistSetlists('artist-mbid')).rejects.toThrow(
      SetlistFmInvalidResponseError,
    );
  });

  // Regression: SetlistFmModule is imported by ShowsModule, which is part of
  // AppModule, so SetlistFmClient must resolve through Nest's DI container
  // (not just via a plain `new`) or every module/e2e test that boots
  // AppModule fails to compile.
  it('resolves through Nest dependency injection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SetlistFmModule],
    }).compile();

    const client = moduleRef.get(SetlistFmClient);

    expect(client).toBeInstanceOf(SetlistFmClient);
  });

  // Rate limiting must sit right in front of the real HTTP call, inside the
  // client itself — see setlist-fm.rate-limiter.spec.ts for the limiter's
  // own behaviour (2 req/s, 1,440/day). These tests only check the wiring:
  // the client always asks the limiter first, and never calls fetch() when
  // the limiter refuses.
  describe('rate limiting', () => {
    function fakeRateLimiter(
      acquire: jest.Mock = jest.fn().mockResolvedValue(undefined),
    ) {
      return { acquire } as unknown as SetlistFmRateLimiter;
    }

    it('calls rateLimiter.acquire() exactly once before making the request', async () => {
      fetchMock.mockResolvedValue(jsonResponse(page));
      const acquire = jest.fn().mockResolvedValue(undefined);
      const client = new SetlistFmClient(
        { apiKey: 'test-key', baseUrl: 'https://api.setlist.fm/rest/1.0' },
        fakeRateLimiter(acquire),
      );

      await client.getArtistSetlists('artist-mbid');

      expect(acquire).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('calls acquire() once per request, in order, across multiple calls', async () => {
      fetchMock.mockResolvedValue(jsonResponse(page));
      const acquire = jest.fn().mockResolvedValue(undefined);
      const client = new SetlistFmClient(
        { apiKey: 'test-key', baseUrl: 'https://api.setlist.fm/rest/1.0' },
        fakeRateLimiter(acquire),
      );

      await client.getArtistSetlists('artist-mbid', 1);
      await client.getArtistSetlists('artist-mbid', 2);
      await client.getArtistSetlists('artist-mbid', 3);

      expect(acquire).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('never calls fetch when acquire() rejects because the daily limit was reached', async () => {
      const dailyLimitError = new Error(
        'setlist.fm daily rate limit reached: 1440 requests already used.',
      );
      const acquire = jest.fn().mockRejectedValue(dailyLimitError);
      const client = new SetlistFmClient(
        { apiKey: 'test-key', baseUrl: 'https://api.setlist.fm/rest/1.0' },
        fakeRateLimiter(acquire),
      );

      await expect(client.getArtistSetlists('artist-mbid')).rejects.toBe(
        dailyLimitError,
      );

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('still throws SetlistFmApiError on a 429 once granted, with no retry', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { message: 'Too Many Requests' },
          { ok: false, status: 429 },
        ),
      );
      const acquire = jest.fn().mockResolvedValue(undefined);
      const client = new SetlistFmClient(
        { apiKey: 'test-key', baseUrl: 'https://api.setlist.fm/rest/1.0' },
        fakeRateLimiter(acquire),
      );

      const error = await client
        .getArtistSetlists('artist-mbid')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(SetlistFmApiError);
      expect((error as SetlistFmApiError).status).toBe(429);
      expect(acquire).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
