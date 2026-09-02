import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { MusicBrainzClient } from '../integrations/musicbrainz/musicbrainz.client';
import {
  MusicBrainzReleaseGroup,
  MusicBrainzReleaseGroupWithReleases,
  MusicBrainzReleaseWithRecordings,
} from '../integrations/musicbrainz/musicbrainz.types';
import {
  MusicBrainzSyncService,
  THE_WARNING_MUSICBRAINZ_MBID,
} from './musicbrainz-sync.service';

describe('MusicBrainzSyncService', () => {
  let service: MusicBrainzSyncService;
  let prisma: {
    artist: { findUnique: jest.Mock };
    song: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let client: {
    getArtistReleaseGroups: jest.Mock;
    getReleaseGroupReleases: jest.Mock;
    getReleaseRecordings: jest.Mock;
  };

  const artist = { id: 'artist-1', slug: 'the-warning', name: 'The Warning' };

  function releaseGroup(
    overrides: Partial<MusicBrainzReleaseGroup> = {},
  ): MusicBrainzReleaseGroup {
    return {
      id: 'rg-1',
      title: 'XXI Century Blood',
      'primary-type': 'Album',
      'first-release-date': '2017-03-27',
      ...overrides,
    };
  }

  function releaseGroupsPage(
    releaseGroups: MusicBrainzReleaseGroup[],
    count?: number,
  ) {
    return {
      'release-group-count': count ?? releaseGroups.length,
      'release-group-offset': 0,
      'release-groups': releaseGroups,
    };
  }

  function releasesFor(
    releaseGroupId: string,
  ): MusicBrainzReleaseGroupWithReleases {
    return {
      id: releaseGroupId,
      title: 'irrelevant',
      releases: [
        {
          id: `release-${releaseGroupId}`,
          title: 'irrelevant',
          status: 'Official',
        },
      ],
    };
  }

  function recordingsFor(
    releaseId: string,
    tracks: { title: string; recordingId: string }[],
  ): MusicBrainzReleaseWithRecordings {
    return {
      id: releaseId,
      title: 'irrelevant',
      media: [
        {
          position: 1,
          tracks: tracks.map((t, i) => ({
            id: `track-${i}`,
            position: i + 1,
            title: t.title,
            recording: { id: t.recordingId, title: t.title },
          })),
        },
      ],
    };
  }

  beforeEach(() => {
    prisma = {
      artist: { findUnique: jest.fn().mockResolvedValue(artist) },
      song: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    client = {
      getArtistReleaseGroups: jest
        .fn()
        .mockResolvedValue(releaseGroupsPage([])),
      getReleaseGroupReleases: jest.fn(),
      getReleaseRecordings: jest.fn(),
    };

    service = new MusicBrainzSyncService(
      prisma as unknown as PrismaService,
      client as unknown as MusicBrainzClient,
    );
  });

  it('throws NotFoundException when The Warning does not exist', async () => {
    prisma.artist.findUnique.mockResolvedValue(null);

    await expect(service.syncTheWarning()).rejects.toThrow(NotFoundException);
    expect(client.getArtistReleaseGroups).not.toHaveBeenCalled();
  });

  it('looks up the artist by the "the-warning" slug', async () => {
    await service.syncTheWarning();

    expect(prisma.artist.findUnique).toHaveBeenCalledWith({
      where: { slug: 'the-warning' },
    });
  });

  it('fetches release-groups using The Warning MusicBrainz mbid', async () => {
    await service.syncTheWarning();

    expect(client.getArtistReleaseGroups).toHaveBeenCalledWith(
      THE_WARNING_MUSICBRAINZ_MBID,
      0,
    );
  });

  it('paginates through all release-group pages by offset', async () => {
    const first = Array.from({ length: 100 }, (_, i) =>
      releaseGroup({ id: `rg-${i}`, 'primary-type': 'Other' }),
    );
    const second = [releaseGroup({ id: 'rg-tail', 'primary-type': 'Other' })];
    client.getArtistReleaseGroups
      .mockResolvedValueOnce(releaseGroupsPage(first, 101))
      .mockResolvedValueOnce(releaseGroupsPage(second, 101));

    const summary = await service.syncTheWarning();

    expect(client.getArtistReleaseGroups).toHaveBeenNthCalledWith(
      1,
      THE_WARNING_MUSICBRAINZ_MBID,
      0,
    );
    expect(client.getArtistReleaseGroups).toHaveBeenNthCalledWith(
      2,
      THE_WARNING_MUSICBRAINZ_MBID,
      100,
    );
    expect(summary.releaseGroupsFetched).toBe(101);
  });

  it('keeps studio albums, EPs and singles, and skips everything else', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([
        releaseGroup({ id: 'album', 'primary-type': 'Album' }),
        releaseGroup({ id: 'ep', 'primary-type': 'EP' }),
        releaseGroup({ id: 'single', 'primary-type': 'Single' }),
        releaseGroup({ id: 'broadcast', 'primary-type': 'Broadcast' }),
        releaseGroup({ id: 'other', 'primary-type': 'Other' }),
        releaseGroup({ id: 'no-type', 'primary-type': null }),
      ]),
    );
    client.getReleaseGroupReleases.mockImplementation((id: string) =>
      Promise.resolve(releasesFor(id)),
    );
    client.getReleaseRecordings.mockResolvedValue(recordingsFor('r', []));

    const summary = await service.syncTheWarning();

    expect(client.getReleaseGroupReleases).toHaveBeenCalledTimes(3);
    expect(client.getReleaseGroupReleases).toHaveBeenCalledWith('album');
    expect(client.getReleaseGroupReleases).toHaveBeenCalledWith('ep');
    expect(client.getReleaseGroupReleases).toHaveBeenCalledWith('single');
    expect(summary.releaseGroupsSkipped).toBe(3);
  });

  it('skips a live/compilation/remix edition of an album (secondary-types)', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([
        releaseGroup({ id: 'studio', 'primary-type': 'Album' }),
        releaseGroup({
          id: 'live',
          'primary-type': 'Album',
          'secondary-types': ['Live'],
        }),
        releaseGroup({
          id: 'comp',
          'primary-type': 'Album',
          'secondary-types': ['Compilation'],
        }),
      ]),
    );
    client.getReleaseGroupReleases.mockImplementation((id: string) =>
      Promise.resolve(releasesFor(id)),
    );
    client.getReleaseRecordings.mockResolvedValue(recordingsFor('r', []));

    const summary = await service.syncTheWarning();

    expect(client.getReleaseGroupReleases).toHaveBeenCalledTimes(1);
    expect(client.getReleaseGroupReleases).toHaveBeenCalledWith('studio');
    expect(summary.releaseGroupsSkipped).toBe(2);
  });

  it('picks the Official release to read tracks from, ignoring non-Official ones', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([releaseGroup()]),
    );
    client.getReleaseGroupReleases.mockResolvedValue({
      id: 'rg-1',
      title: 'irrelevant',
      releases: [
        { id: 'promo-release', title: 'irrelevant', status: 'Promotion' },
        { id: 'official-release', title: 'irrelevant', status: 'Official' },
      ],
    });
    client.getReleaseRecordings.mockResolvedValue(
      recordingsFor('official-release', []),
    );

    await service.syncTheWarning();

    expect(client.getReleaseRecordings).toHaveBeenCalledWith(
      'official-release',
    );
  });

  it('falls back to the first release when none is marked Official', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([releaseGroup()]),
    );
    client.getReleaseGroupReleases.mockResolvedValue({
      id: 'rg-1',
      title: 'irrelevant',
      releases: [{ id: 'only-release', title: 'irrelevant' }],
    });
    client.getReleaseRecordings.mockResolvedValue(
      recordingsFor('only-release', []),
    );

    await service.syncTheWarning();

    expect(client.getReleaseRecordings).toHaveBeenCalledWith('only-release');
  });

  it('skips a release-group with no releases at all, without failing the sync', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([releaseGroup()]),
    );
    client.getReleaseGroupReleases.mockResolvedValue({
      id: 'rg-1',
      title: 'irrelevant',
      releases: [],
    });

    const summary = await service.syncTheWarning();

    expect(client.getReleaseRecordings).not.toHaveBeenCalled();
    expect(summary.tracksFetched).toBe(0);
  });

  it('creates a new Song for each track, mapping album title and release date from the release-group', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([
        releaseGroup({
          id: 'rg-1',
          title: 'XXI Century Blood',
          'first-release-date': '2017-03-27',
        }),
      ]),
    );
    client.getReleaseGroupReleases.mockResolvedValue(releasesFor('rg-1'));
    client.getReleaseRecordings.mockResolvedValue(
      recordingsFor('release-rg-1', [
        { title: 'Automatic Sun', recordingId: 'rec-1' },
        { title: 'Choke', recordingId: 'rec-2' },
      ]),
    );

    const summary = await service.syncTheWarning();

    expect(prisma.song.create).toHaveBeenCalledWith({
      data: {
        artistId: artist.id,
        title: 'Automatic Sun',
        albumTitle: 'XXI Century Blood',
        releaseDate: new Date(Date.UTC(2017, 2, 27)),
        mbid: 'rec-1',
      },
    });
    expect(prisma.song.create).toHaveBeenCalledWith({
      data: {
        artistId: artist.id,
        title: 'Choke',
        albumTitle: 'XXI Century Blood',
        releaseDate: new Date(Date.UTC(2017, 2, 27)),
        mbid: 'rec-2',
      },
    });
    expect(summary.tracksFetched).toBe(2);
    expect(summary.created).toBe(2);
    expect(summary.updated).toBe(0);
  });

  it('updates an existing Song instead of creating a duplicate (matched by mbid)', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([releaseGroup({ id: 'rg-1' })]),
    );
    client.getReleaseGroupReleases.mockResolvedValue(releasesFor('rg-1'));
    client.getReleaseRecordings.mockResolvedValue(
      recordingsFor('release-rg-1', [{ title: 'Choke', recordingId: 'rec-2' }]),
    );
    prisma.song.findUnique.mockResolvedValue({ id: 'song-1', mbid: 'rec-2' });

    const summary = await service.syncTheWarning();

    expect(prisma.song.update).toHaveBeenCalledWith({
      where: { mbid: 'rec-2' },
      data: {
        title: 'Choke',
        albumTitle: 'XXI Century Blood',
        releaseDate: new Date(Date.UTC(2017, 2, 27)),
      },
    });
    expect(prisma.song.create).not.toHaveBeenCalled();
    expect(summary.updated).toBe(1);
    expect(summary.created).toBe(0);
  });

  it('dedupes the same song title across releases, keeping the earliest release', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([
        releaseGroup({
          id: 'single',
          title: 'Choke (Single)',
          'primary-type': 'Single',
          'first-release-date': '2021-05-21',
        }),
        releaseGroup({
          id: 'album',
          title: 'ERROR',
          'primary-type': 'Album',
          'first-release-date': '2022-06-24',
        }),
      ]),
    );
    client.getReleaseGroupReleases.mockImplementation((id: string) =>
      Promise.resolve(releasesFor(id)),
    );
    client.getReleaseRecordings.mockImplementation((releaseId: string) =>
      Promise.resolve(
        releaseId === 'release-single'
          ? recordingsFor('release-single', [
              { title: 'Choke', recordingId: 'rec-single' },
            ])
          : recordingsFor('release-album', [
              { title: 'Choke', recordingId: 'rec-album' },
            ]),
      ),
    );

    const summary = await service.syncTheWarning();

    expect(prisma.song.create).toHaveBeenCalledTimes(1);
    expect(prisma.song.create).toHaveBeenCalledWith({
      data: {
        artistId: artist.id,
        title: 'Choke',
        albumTitle: 'Choke (Single)',
        releaseDate: new Date(Date.UTC(2021, 4, 21)),
        mbid: 'rec-single',
      },
    });
    expect(summary.duplicateTracksSkipped).toBe(1);
    expect(summary.tracksFetched).toBe(2);
  });

  it('dedupes titles case- and accent-insensitively', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([
        releaseGroup({
          id: 'a',
          title: 'Album A',
          'first-release-date': '2020-01-01',
        }),
        releaseGroup({
          id: 'b',
          title: 'Album B',
          'first-release-date': '2021-01-01',
        }),
      ]),
    );
    client.getReleaseGroupReleases.mockImplementation((id: string) =>
      Promise.resolve(releasesFor(id)),
    );
    client.getReleaseRecordings.mockImplementation((releaseId: string) =>
      Promise.resolve(
        releaseId === 'release-a'
          ? recordingsFor('release-a', [
              { title: 'Qué Más Da', recordingId: 'rec-a' },
            ])
          : recordingsFor('release-b', [
              { title: 'QUE MAS DA', recordingId: 'rec-b' },
            ]),
      ),
    );

    const summary = await service.syncTheWarning();

    expect(prisma.song.create).toHaveBeenCalledTimes(1);
    expect(summary.duplicateTracksSkipped).toBe(1);
  });

  it('is idempotent: running twice does not duplicate songs', async () => {
    client.getArtistReleaseGroups.mockResolvedValue(
      releaseGroupsPage([releaseGroup({ id: 'rg-1' })]),
    );
    client.getReleaseGroupReleases.mockResolvedValue(releasesFor('rg-1'));
    client.getReleaseRecordings.mockResolvedValue(
      recordingsFor('release-rg-1', [{ title: 'Choke', recordingId: 'rec-2' }]),
    );

    const first = await service.syncTheWarning();
    expect(first.created).toBe(1);

    prisma.song.findUnique.mockResolvedValue({ id: 'song-1', mbid: 'rec-2' });
    const second = await service.syncTheWarning();

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(prisma.song.create).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from MusicBrainz without persisting anything', async () => {
    const error = new Error('MusicBrainz is down');
    client.getArtistReleaseGroups.mockRejectedValue(error);

    await expect(service.syncTheWarning()).rejects.toThrow(error);
    expect(prisma.song.create).not.toHaveBeenCalled();
  });
});
