import { Test } from '@nestjs/testing';
import { SetlistFmClient } from './setlist-fm.client';
import {
  SetlistFmApiError,
  SetlistFmConfigError,
  SetlistFmInvalidResponseError,
} from './setlist-fm.errors';
import { SetlistFmModule } from './setlist-fm.module';
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
        set: [{ song: [{ name: 'Qué Más Da' }] }],
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
});
