import { Test } from '@nestjs/testing';
import { MusicBrainzClient } from './musicbrainz.client';
import {
  MusicBrainzApiError,
  MusicBrainzInvalidResponseError,
} from './musicbrainz.errors';
import { MusicBrainzModule } from './musicbrainz.module';
import { MusicBrainzRateLimiter } from './musicbrainz.rate-limiter';
import {
  MusicBrainzReleaseGroupsPage,
  MusicBrainzReleaseGroupWithReleases,
  MusicBrainzReleaseWithRecordings,
} from './musicbrainz.types';

const BASE_URL = 'https://musicbrainz.org/ws/2';

// El cliente solo debe hablar HTTP contra MusicBrainz: todo se prueba
// mockeando global.fetch, nunca contra la red real (mismo criterio que
// setlist-fm.client.spec.ts).
describe('MusicBrainzClient', () => {
  let fetchMock: jest.Mock;

  const releaseGroupsPage: MusicBrainzReleaseGroupsPage = {
    'release-group-count': 1,
    'release-group-offset': 0,
    'release-groups': [
      {
        id: 'rg-1',
        title: 'XXI Century Blood',
        'primary-type': 'Album',
        'first-release-date': '2017-03-27',
      },
    ],
  };

  const releaseGroupWithReleases: MusicBrainzReleaseGroupWithReleases = {
    id: 'rg-1',
    title: 'XXI Century Blood',
    releases: [
      { id: 'release-1', title: 'XXI Century Blood', status: 'Official' },
    ],
  };

  const releaseWithRecordings: MusicBrainzReleaseWithRecordings = {
    id: 'release-1',
    title: 'XXI Century Blood',
    media: [
      {
        position: 1,
        tracks: [
          {
            id: 'track-1',
            position: 1,
            title: 'Que Mas Da',
            recording: { id: 'recording-1', title: 'Que Mas Da' },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
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

  describe('getArtistReleaseGroups', () => {
    it('returns the parsed release-groups page on a successful response', async () => {
      fetchMock.mockResolvedValue(jsonResponse(releaseGroupsPage));
      const client = new MusicBrainzClient({ baseUrl: BASE_URL });

      const result = await client.getArtistReleaseGroups('artist-mbid');

      expect(result).toEqual(releaseGroupsPage);
    });

    it('sends the User-Agent and Accept headers', async () => {
      fetchMock.mockResolvedValue(jsonResponse(releaseGroupsPage));
      const client = new MusicBrainzClient({
        baseUrl: BASE_URL,
        userAgent: 'fan-map/1.0 (test@example.com)',
      });

      await client.getArtistReleaseGroups('artist-mbid');

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/release-group?artist=artist-mbid&limit=100&offset=0&fmt=json`,
        {
          headers: {
            'User-Agent': 'fan-map/1.0 (test@example.com)',
            Accept: 'application/json',
          },
        },
      );
    });

    it('requests the given offset', async () => {
      fetchMock.mockResolvedValue(jsonResponse(releaseGroupsPage));
      const client = new MusicBrainzClient({ baseUrl: BASE_URL });

      await client.getArtistReleaseGroups('artist-mbid', 100);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('offset=100'),
        expect.any(Object),
      );
    });

    it('throws MusicBrainzApiError with the HTTP status when MusicBrainz returns an error', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: 'Not Found' }, { ok: false, status: 404 }),
      );
      const client = new MusicBrainzClient({ baseUrl: BASE_URL });

      const error = await client
        .getArtistReleaseGroups('artist-mbid')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MusicBrainzApiError);
      expect((error as MusicBrainzApiError).status).toBe(404);
    });

    it('throws MusicBrainzApiError with status 503 without retrying (MusicBrainz throttling)', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { error: 'Service Unavailable' },
          { ok: false, status: 503 },
        ),
      );
      const client = new MusicBrainzClient({ baseUrl: BASE_URL });

      const error = await client
        .getArtistReleaseGroups('artist-mbid')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(MusicBrainzApiError);
      expect((error as MusicBrainzApiError).status).toBe(503);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('throws MusicBrainzInvalidResponseError when the response body has no "release-groups" array', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ 'release-group-count': 0 }));
      const client = new MusicBrainzClient({ baseUrl: BASE_URL });

      await expect(
        client.getArtistReleaseGroups('artist-mbid'),
      ).rejects.toThrow(MusicBrainzInvalidResponseError);
    });
  });

  describe('getReleaseGroupReleases', () => {
    it('returns the parsed release-group with its releases', async () => {
      fetchMock.mockResolvedValue(jsonResponse(releaseGroupWithReleases));
      const client = new MusicBrainzClient({ baseUrl: BASE_URL });

      const result = await client.getReleaseGroupReleases('rg-1');

      expect(result).toEqual(releaseGroupWithReleases);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/release-group/rg-1?inc=releases&fmt=json`,
        expect.any(Object),
      );
    });

    it('throws MusicBrainzInvalidResponseError when the response body has no "releases" array', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 'rg-1' }));
      const client = new MusicBrainzClient({ baseUrl: BASE_URL });

      await expect(client.getReleaseGroupReleases('rg-1')).rejects.toThrow(
        MusicBrainzInvalidResponseError,
      );
    });
  });

  describe('getReleaseRecordings', () => {
    it('returns the parsed release with its media/tracks/recordings', async () => {
      fetchMock.mockResolvedValue(jsonResponse(releaseWithRecordings));
      const client = new MusicBrainzClient({ baseUrl: BASE_URL });

      const result = await client.getReleaseRecordings('release-1');

      expect(result).toEqual(releaseWithRecordings);
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/release/release-1?inc=recordings&fmt=json`,
        expect.any(Object),
      );
    });

    it('throws MusicBrainzInvalidResponseError when the response body has no "media" array', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 'release-1' }));
      const client = new MusicBrainzClient({ baseUrl: BASE_URL });

      await expect(client.getReleaseRecordings('release-1')).rejects.toThrow(
        MusicBrainzInvalidResponseError,
      );
    });
  });

  // Regression: MusicBrainzModule is imported by SongsModule, part of
  // AppModule, so MusicBrainzClient must resolve through Nest's DI container
  // (same regression guard as SetlistFmClient's equivalent test).
  it('resolves through Nest dependency injection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MusicBrainzModule],
    }).compile();

    const client = moduleRef.get(MusicBrainzClient);

    expect(client).toBeInstanceOf(MusicBrainzClient);
  });

  // Rate limiting must sit right in front of the real HTTP call, inside the
  // client itself — see musicbrainz.rate-limiter.spec.ts for the limiter's
  // own behaviour. These tests only check the wiring.
  describe('rate limiting', () => {
    function fakeRateLimiter(
      acquire: jest.Mock = jest.fn().mockResolvedValue(undefined),
    ) {
      return { acquire } as unknown as MusicBrainzRateLimiter;
    }

    it('calls rateLimiter.acquire() exactly once before making the request', async () => {
      fetchMock.mockResolvedValue(jsonResponse(releaseGroupsPage));
      const acquire = jest.fn().mockResolvedValue(undefined);
      const client = new MusicBrainzClient(
        { baseUrl: BASE_URL },
        fakeRateLimiter(acquire),
      );

      await client.getArtistReleaseGroups('artist-mbid');

      expect(acquire).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('calls acquire() once per request, in order, across multiple calls', async () => {
      fetchMock.mockResolvedValue(jsonResponse(releaseGroupsPage));
      const acquire = jest.fn().mockResolvedValue(undefined);
      const client = new MusicBrainzClient(
        { baseUrl: BASE_URL },
        fakeRateLimiter(acquire),
      );

      await client.getArtistReleaseGroups('artist-mbid', 0);
      await client.getArtistReleaseGroups('artist-mbid', 100);
      await client.getArtistReleaseGroups('artist-mbid', 200);

      expect(acquire).toHaveBeenCalledTimes(3);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });
});
