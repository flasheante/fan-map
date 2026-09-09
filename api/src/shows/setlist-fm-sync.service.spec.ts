import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { SetlistFmClient } from '../integrations/setlist-fm/setlist-fm.client';
import { SetlistFmApiError } from '../integrations/setlist-fm/setlist-fm.errors';
import { SetlistFmSetlist } from '../integrations/setlist-fm/setlist-fm.types';
import {
  SetlistFmSyncService,
  THE_WARNING_SETLIST_FM_MBID,
} from './setlist-fm-sync.service';

describe('SetlistFmSyncService', () => {
  let service: SetlistFmSyncService;
  let prisma: {
    artist: { findUnique: jest.Mock; update: jest.Mock };
    country: { findUnique: jest.Mock };
    city: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    show: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    setlist: { findUnique: jest.Mock; create: jest.Mock };
    setlistSong: { deleteMany: jest.Mock; createMany: jest.Mock };
  };
  let client: { getArtistSetlists: jest.Mock };

  const artist = { id: 'artist-1', slug: 'the-warning', name: 'The Warning' };
  const country = { id: 'country-1', code: 'MX', name: 'México' };
  const city = {
    id: 'city-1',
    name: 'Ciudad de México',
    countryId: country.id,
  };

  function externalSetlist(
    overrides: Partial<SetlistFmSetlist> = {},
  ): SetlistFmSetlist {
    return {
      id: 'ext-1',
      versionId: 'v1',
      eventDate: '15-03-2026',
      artist: { mbid: THE_WARNING_SETLIST_FM_MBID, name: 'The Warning' },
      venue: {
        id: 'venue-1',
        name: 'Foro Sol',
        city: {
          id: 'sfm-city-1',
          name: 'Ciudad de México',
          country: { code: 'mx', name: 'Mexico' },
        },
      },
      sets: { set: [] },
      url: 'https://www.setlist.fm/setlist/ext-1.html',
      ...overrides,
    };
  }

  function page(setlist: SetlistFmSetlist[], total?: number) {
    return {
      setlist,
      total: total ?? setlist.length,
      page: 1,
      itemsPerPage: 20,
    };
  }

  beforeEach(async () => {
    tx = {
      show: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'show-1' }),
        update: jest.fn().mockResolvedValue({ id: 'show-1' }),
      },
      setlist: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'setlist-1' }),
      },
      setlistSong: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma = {
      artist: {
        findUnique: jest.fn().mockResolvedValue(artist),
        update: jest.fn().mockResolvedValue(artist),
      },
      country: { findUnique: jest.fn().mockResolvedValue(country) },
      city: { findUnique: jest.fn().mockResolvedValue(city) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };

    client = { getArtistSetlists: jest.fn().mockResolvedValue(page([])) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetlistFmSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: SetlistFmClient, useValue: client },
      ],
    }).compile();

    service = module.get<SetlistFmSyncService>(SetlistFmSyncService);
  });

  it('throws NotFoundException when The Warning does not exist', async () => {
    prisma.artist.findUnique.mockResolvedValue(null);

    await expect(service.syncTheWarning()).rejects.toThrow(NotFoundException);
    expect(client.getArtistSetlists).not.toHaveBeenCalled();
  });

  it('looks up the artist by the "the-warning" slug', async () => {
    await service.syncTheWarning();

    expect(prisma.artist.findUnique).toHaveBeenCalledWith({
      where: { slug: 'the-warning' },
    });
  });

  it('fetches setlists from setlist.fm using The Warning mbid', async () => {
    await service.syncTheWarning();

    expect(client.getArtistSetlists).toHaveBeenCalledWith(
      THE_WARNING_SETLIST_FM_MBID,
      1,
    );
  });

  it('paginates through all setlist.fm pages', async () => {
    client.getArtistSetlists
      .mockResolvedValueOnce(page([externalSetlist({ id: 'ext-1' })], 2))
      .mockResolvedValueOnce(page([externalSetlist({ id: 'ext-2' })], 2));

    const summary = await service.syncTheWarning();

    expect(client.getArtistSetlists).toHaveBeenNthCalledWith(
      1,
      THE_WARNING_SETLIST_FM_MBID,
      1,
    );
    expect(client.getArtistSetlists).toHaveBeenNthCalledWith(
      2,
      THE_WARNING_SETLIST_FM_MBID,
      2,
    );
    expect(summary.fetched).toBe(2);
  });

  it('makes exactly one HTTP request per page, with no extra/duplicate page fetched once every item is in', async () => {
    // 45 setlists at 20 items/page (setlist.fm's real page size) means 3
    // pages: two full ones and a partial last one. The loop must stop right
    // there — it must not issue a 4th request "to make sure" the last page
    // was empty, since `total` already tells it there's nothing left.
    const fullPage = Array.from({ length: 20 }, (_, i) =>
      externalSetlist({ id: `ext-${i}` }),
    );
    const lastPage = Array.from({ length: 5 }, (_, i) =>
      externalSetlist({ id: `ext-tail-${i}` }),
    );
    client.getArtistSetlists
      .mockResolvedValueOnce(page(fullPage, 45))
      .mockResolvedValueOnce(page(fullPage, 45))
      .mockResolvedValueOnce(page(lastPage, 45));

    const summary = await service.syncTheWarning();

    expect(client.getArtistSetlists).toHaveBeenCalledTimes(3);
    expect(summary.fetched).toBe(45);
  });

  it('stops paginating immediately and persists nothing when a later page returns 429', async () => {
    // Page 1 succeeds (and would, on its own, need a page 2 to reach
    // `total`), page 2 is rate-limited. The sync must not attempt a 3rd
    // request, must not retry page 2, and must not persist the page-1 show
    // it already fetched before the failure.
    const rateLimitError = new SetlistFmApiError(
      429,
      'setlist.fm request failed with status 429: Too Many Requests',
    );
    client.getArtistSetlists
      .mockResolvedValueOnce(page([externalSetlist({ id: 'ext-1' })], 2))
      .mockRejectedValueOnce(rateLimitError);

    await expect(service.syncTheWarning()).rejects.toBe(rateLimitError);

    expect(client.getArtistSetlists).toHaveBeenCalledTimes(2);
    expect(client.getArtistSetlists).toHaveBeenNthCalledWith(
      1,
      THE_WARNING_SETLIST_FM_MBID,
      1,
    );
    expect(client.getArtistSetlists).toHaveBeenNthCalledWith(
      2,
      THE_WARNING_SETLIST_FM_MBID,
      2,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates a new show when none exists for the external id', async () => {
    client.getArtistSetlists.mockResolvedValue(page([externalSetlist()]));

    const summary = await service.syncTheWarning();

    expect(tx.show.create).toHaveBeenCalledWith({
      data: {
        artistId: artist.id,
        cityId: city.id,
        date: new Date(Date.UTC(2026, 2, 15)),
        venue: 'Foro Sol',
        externalId: 'ext-1',
      },
    });
    expect(summary.created).toBe(1);
    expect(summary.updated).toBe(0);
  });

  it('updates an existing show instead of creating a duplicate', async () => {
    client.getArtistSetlists.mockResolvedValue(page([externalSetlist()]));
    tx.show.findUnique.mockResolvedValue({ id: 'show-1', externalId: 'ext-1' });

    const summary = await service.syncTheWarning();

    expect(tx.show.update).toHaveBeenCalledWith({
      where: { id: 'show-1' },
      data: {
        date: new Date(Date.UTC(2026, 2, 15)),
        venue: 'Foro Sol',
        cityId: city.id,
      },
    });
    expect(tx.show.create).not.toHaveBeenCalled();
    expect(summary.updated).toBe(1);
    expect(summary.created).toBe(0);
  });

  it('resolves the city by name and country code', async () => {
    client.getArtistSetlists.mockResolvedValue(page([externalSetlist()]));

    await service.syncTheWarning();

    expect(prisma.country.findUnique).toHaveBeenCalledWith({
      where: { code: 'MX' },
    });
    expect(prisma.city.findUnique).toHaveBeenCalledWith({
      where: {
        countryId_name: { countryId: country.id, name: 'Ciudad de México' },
      },
    });
  });

  it('skips the show and reports the missing city when the country is not in the catalog', async () => {
    prisma.country.findUnique.mockResolvedValue(null);
    client.getArtistSetlists.mockResolvedValue(
      page([
        externalSetlist({
          venue: {
            id: 'v',
            name: 'Some Venue',
            city: {
              id: 'c',
              name: 'Unknown City',
              country: { code: 'zz', name: 'Nowhere' },
            },
          },
        }),
      ]),
    );

    const summary = await service.syncTheWarning();

    expect(tx.show.create).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
    expect(summary.created).toBe(0);
    expect(summary.citiesNotFound).toEqual([
      { city: 'Unknown City', country: 'zz' },
    ]);
  });

  it('skips the show and reports the missing city when the city itself is not in the catalog', async () => {
    prisma.city.findUnique.mockResolvedValue(null);
    client.getArtistSetlists.mockResolvedValue(page([externalSetlist()]));

    const summary = await service.syncTheWarning();

    expect(tx.show.create).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
    expect(summary.citiesNotFound).toEqual([
      { city: 'Ciudad de México', country: 'mx' },
    ]);
  });

  it('does not create a setlist when the show has no songs yet', async () => {
    client.getArtistSetlists.mockResolvedValue(
      page([externalSetlist({ sets: { set: [] } })]),
    );

    const summary = await service.syncTheWarning();

    expect(tx.setlist.create).not.toHaveBeenCalled();
    expect(summary.setlistsCreated).toBe(0);
    expect(summary.setlistsUpdated).toBe(0);
  });

  // Regression test: setlist.fm omits the `sets` field entirely for a
  // concert with no songs logged yet, rather than sending `sets: { set: [] }`.
  it('does not create a setlist when the "sets" field is missing entirely', async () => {
    const { sets: _sets, ...withoutSets } = externalSetlist();
    client.getArtistSetlists.mockResolvedValue(page([withoutSets]));

    const summary = await service.syncTheWarning();

    expect(tx.setlist.create).not.toHaveBeenCalled();
    expect(summary.setlistsCreated).toBe(0);
    expect(summary.setlistsUpdated).toBe(0);
  });

  it('creates a setlist with its songs in position order when the show has one', async () => {
    client.getArtistSetlists.mockResolvedValue(
      page([
        externalSetlist({
          sets: {
            set: [
              { song: [{ name: 'Qué Más Da' }, { name: 'Automatic Sun' }] },
              { encore: 1, song: [{ name: 'Choke' }] },
            ],
          },
        }),
      ]),
    );

    const summary = await service.syncTheWarning();

    expect(tx.setlist.create).toHaveBeenCalledWith({
      data: { showId: 'show-1' },
    });
    expect(tx.setlistSong.createMany).toHaveBeenCalledWith({
      data: [
        { setlistId: 'setlist-1', title: 'Qué Más Da', position: 1 },
        { setlistId: 'setlist-1', title: 'Automatic Sun', position: 2 },
        { setlistId: 'setlist-1', title: 'Choke', position: 3 },
      ],
    });
    expect(summary.setlistsCreated).toBe(1);
  });

  it('replaces the songs of an existing setlist instead of duplicating them', async () => {
    client.getArtistSetlists.mockResolvedValue(
      page([
        externalSetlist({ sets: { set: [{ song: [{ name: 'New Song' }] }] } }),
      ]),
    );
    tx.show.findUnique.mockResolvedValue({ id: 'show-1' });
    tx.setlist.findUnique.mockResolvedValue({ id: 'setlist-1' });

    const summary = await service.syncTheWarning();

    expect(tx.setlist.create).not.toHaveBeenCalled();
    expect(tx.setlistSong.deleteMany).toHaveBeenCalledWith({
      where: { setlistId: 'setlist-1' },
    });
    expect(tx.setlistSong.createMany).toHaveBeenCalledWith({
      data: [{ setlistId: 'setlist-1', title: 'New Song', position: 1 }],
    });
    expect(summary.setlistsUpdated).toBe(1);
    expect(summary.setlistsCreated).toBe(0);
  });

  it('is idempotent: running twice does not duplicate shows or setlists', async () => {
    const external = externalSetlist({
      sets: { set: [{ song: [{ name: 'Song A' }] }] },
    });
    client.getArtistSetlists.mockResolvedValue(page([external]));

    const first = await service.syncTheWarning();
    expect(first.created).toBe(1);
    expect(first.setlistsCreated).toBe(1);

    // Second run: everything already exists.
    tx.show.findUnique.mockResolvedValue({ id: 'show-1' });
    tx.setlist.findUnique.mockResolvedValue({ id: 'setlist-1' });

    const second = await service.syncTheWarning();

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(second.setlistsCreated).toBe(0);
    expect(second.setlistsUpdated).toBe(1);
    expect(tx.show.create).toHaveBeenCalledTimes(1);
    expect(tx.setlist.create).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from setlist.fm without persisting anything', async () => {
    const error = new Error('setlist.fm is down');
    client.getArtistSetlists.mockRejectedValue(error);

    await expect(service.syncTheWarning()).rejects.toThrow(error);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.artist.update).not.toHaveBeenCalled();
  });

  it('propagates persistence failures instead of swallowing them', async () => {
    client.getArtistSetlists.mockResolvedValue(page([externalSetlist()]));
    const dbError = new Error('constraint violation');
    prisma.$transaction.mockRejectedValue(dbError);

    await expect(service.syncTheWarning()).rejects.toThrow(dbError);
    expect(prisma.artist.update).not.toHaveBeenCalled();
  });

  // El botón "Actualizado" de /artists/the-warning (ver artist-stats o el
  // header del historial) lee esto — ver también artists.controller y el
  // cron semanal (api/README.md).
  describe('setlistsSyncedAt', () => {
    it('stamps the artist with the current time once the run finishes without throwing', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-07T02:00:00.000Z'));
      try {
        client.getArtistSetlists.mockResolvedValue(page([]));

        await service.syncTheWarning();

        expect(prisma.artist.update).toHaveBeenCalledWith({
          where: { id: artist.id },
          data: { setlistsSyncedAt: new Date('2026-09-07T02:00:00.000Z') },
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('stamps the artist even on a run that finds nothing new (still means the check ran)', async () => {
      client.getArtistSetlists.mockResolvedValue(page([]));

      await service.syncTheWarning();

      expect(prisma.artist.update).toHaveBeenCalledTimes(1);
    });

    it('never stamps the artist when the sync run throws partway through', async () => {
      client.getArtistSetlists.mockResolvedValue(page([externalSetlist()]));
      prisma.$transaction.mockRejectedValue(new Error('constraint violation'));

      await expect(service.syncTheWarning()).rejects.toThrow();

      expect(prisma.artist.update).not.toHaveBeenCalled();
    });
  });
});
