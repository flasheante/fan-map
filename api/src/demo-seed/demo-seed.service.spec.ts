import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { DemoSeedService, DEMO_ARTIST_SLUG } from './demo-seed.service';

describe('DemoSeedService', () => {
  let service: DemoSeedService;
  let prisma: {
    artist: { findUnique: jest.Mock };
    city: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    show: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    setlist: { findUnique: jest.Mock; create: jest.Mock };
    setlistSong: { deleteMany: jest.Mock; createMany: jest.Mock };
  };

  const artist = { id: 'artist-1', slug: 'the-warning', name: 'The Warning' };

  // Matches the 5 preferred demo cities (name + country code), each with a
  // distinct id so per-show cityId assertions are unambiguous.
  const cityRows: Record<string, { id: string; name: string }> = {
    'Mendoza|AR': { id: 'city-mendoza', name: 'Mendoza' },
    'Buenos Aires|AR': { id: 'city-ba', name: 'Buenos Aires' },
    'Ciudad de México|MX': { id: 'city-cdmx', name: 'Ciudad de México' },
    'Monterrey|MX': { id: 'city-mty', name: 'Monterrey' },
    'Los Angeles|US': { id: 'city-la', name: 'Los Angeles' },
  };

  function mockAllCitiesFound() {
    prisma.city.findFirst.mockImplementation(
      ({ where }: { where: { name: string; country: { code: string } } }) =>
        Promise.resolve(
          cityRows[`${where.name}|${where.country.code}`] ?? null,
        ),
    );
  }

  beforeEach(async () => {
    let showCounter = 0;
    let setlistCounter = 0;

    tx = {
      show: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ id: `show-${++showCounter}` }),
          ),
        update: jest.fn().mockResolvedValue({ id: 'show-1' }),
      },
      setlist: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve({ id: `setlist-${++setlistCounter}` }),
          ),
      },
      setlistSong: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma = {
      artist: { findUnique: jest.fn().mockResolvedValue(artist) },
      city: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    mockAllCitiesFound();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DemoSeedService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DemoSeedService>(DemoSeedService);
  });

  it('throws NotFoundException when The Warning does not exist', async () => {
    prisma.artist.findUnique.mockResolvedValue(null);

    await expect(service.seedDemoTheWarning()).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('looks up the artist by the "the-warning" slug', async () => {
    await service.seedDemoTheWarning();

    expect(prisma.artist.findUnique).toHaveBeenCalledWith({
      where: { slug: DEMO_ARTIST_SLUG },
    });
  });

  it('never makes an HTTP request', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await service.seedDemoTheWarning();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('resolves each demo city by name and country code, without creating any', async () => {
    await service.seedDemoTheWarning();

    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: { name: 'Mendoza', country: { code: 'AR' } },
    });
    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: { name: 'Buenos Aires', country: { code: 'AR' } },
    });
    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: { name: 'Ciudad de México', country: { code: 'MX' } },
    });
    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: { name: 'Monterrey', country: { code: 'MX' } },
    });
    expect(prisma.city.findFirst).toHaveBeenCalledWith({
      where: { name: 'Los Angeles', country: { code: 'US' } },
    });
  });

  it('reports missing cities and continues with only the ones found', async () => {
    prisma.city.findFirst.mockImplementation(
      ({ where }: { where: { name: string; country: { code: string } } }) => {
        if (where.name === 'Monterrey') return Promise.resolve(null);
        return Promise.resolve(
          cityRows[`${where.name}|${where.country.code}`] ?? null,
        );
      },
    );

    const summary = await service.seedDemoTheWarning();

    expect(summary.citiesSkipped).toEqual(['Monterrey, MX']);
    expect(tx.show.create).toHaveBeenCalledTimes(5);
  });

  it('throws when none of the demo cities exist in the catalog', async () => {
    prisma.city.findFirst.mockResolvedValue(null);

    await expect(service.seedDemoTheWarning()).rejects.toThrow();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates 5 demo shows for The Warning distributed across the available cities', async () => {
    const summary = await service.seedDemoTheWarning();

    expect(tx.show.create).toHaveBeenCalledTimes(5);
    expect(summary.shows.created).toBe(5);
    expect(summary.shows.updated).toBe(0);

    const externalIds = tx.show.create.mock.calls.map(
      ([{ data }]: [{ data: { externalId: string } }]) => data.externalId,
    );
    expect(externalIds).toEqual([
      'demo-the-warning-001',
      'demo-the-warning-002',
      'demo-the-warning-003',
      'demo-the-warning-004',
      'demo-the-warning-005',
    ]);
  });

  it('assigns each show to its preferred city and artist', async () => {
    await service.seedDemoTheWarning();

    const calls = tx.show.create.mock.calls.map(
      ([{ data }]: [
        { data: { artistId: string; cityId: string; venue: string } },
      ]) => data,
    );

    expect(calls[0]).toMatchObject({
      artistId: artist.id,
      cityId: 'city-mendoza',
      venue: 'Demo Venue — Mendoza',
    });
    expect(calls[1]).toMatchObject({
      cityId: 'city-ba',
      venue: 'Demo Arena — Buenos Aires',
    });
    expect(calls[2]).toMatchObject({
      cityId: 'city-cdmx',
      venue: 'Demo Foro — Ciudad de México',
    });
    expect(calls[3]).toMatchObject({
      cityId: 'city-mty',
      venue: 'Demo Arena — Monterrey',
    });
    expect(calls[4]).toMatchObject({
      cityId: 'city-la',
      venue: 'Demo Theater — Los Angeles',
    });
  });

  it('creates a setlist with 5-8 songs, in 1-based position order, for every show', async () => {
    await service.seedDemoTheWarning();

    expect(tx.setlist.create).toHaveBeenCalledTimes(5);

    for (const [data] of tx.setlistSong.createMany.mock.calls.map(
      (call: [{ data: { position: number; title: string }[] }]) => call,
    )) {
      const rows = data.data;
      expect(rows.length).toBeGreaterThanOrEqual(5);
      expect(rows.length).toBeLessThanOrEqual(8);
      rows.forEach((row, index) => {
        expect(row.position).toBe(index + 1);
        expect(typeof row.title).toBe('string');
      });
    }
  });

  it('makes some songs repeat across shows so /stats/songs has meaningful data', async () => {
    await service.seedDemoTheWarning();

    const allTitles = tx.setlistSong.createMany.mock.calls.flatMap(
      ([{ data }]: [{ data: { title: string }[] }]) =>
        data.map((row) => row.title),
    );
    const counts = new Map<string, number>();
    for (const title of allTitles) {
      counts.set(title, (counts.get(title) ?? 0) + 1);
    }

    expect(counts.get('S!CK')).toBeGreaterThanOrEqual(3);
    expect(counts.get('MORE')).toBeGreaterThanOrEqual(3);
    // At least a couple of titles repeat across more than one show.
    const repeated = [...counts.values()].filter((count) => count > 1);
    expect(repeated.length).toBeGreaterThanOrEqual(2);
  });

  it('is idempotent: finds each show by externalId before creating it', async () => {
    await service.seedDemoTheWarning();

    expect(tx.show.findUnique).toHaveBeenCalledWith({
      where: { externalId: 'demo-the-warning-001' },
    });
    expect(tx.show.findUnique).toHaveBeenCalledWith({
      where: { externalId: 'demo-the-warning-005' },
    });
  });

  it('updates existing shows instead of creating duplicates on a second run', async () => {
    tx.show.findUnique.mockResolvedValue({ id: 'show-1' });
    tx.setlist.findUnique.mockResolvedValue({ id: 'setlist-1' });

    const summary = await service.seedDemoTheWarning();

    expect(tx.show.create).not.toHaveBeenCalled();
    expect(tx.show.update).toHaveBeenCalledTimes(5);
    expect(summary.shows.created).toBe(0);
    expect(summary.shows.updated).toBe(5);
  });

  it('reuses the existing setlist and re-syncs its songs without duplicating SetlistSong rows', async () => {
    tx.show.findUnique.mockResolvedValue({ id: 'show-1' });
    tx.setlist.findUnique.mockResolvedValue({ id: 'setlist-1' });

    const summary = await service.seedDemoTheWarning();

    expect(tx.setlist.create).not.toHaveBeenCalled();
    expect(tx.setlistSong.deleteMany).toHaveBeenCalledTimes(5);
    expect(tx.setlistSong.createMany).toHaveBeenCalledTimes(5);
    expect(summary.setlists.created).toBe(0);
    expect(summary.setlists.updated).toBe(5);
    expect(summary.songs.created).toBe(0);
    expect(summary.songs.updated).toBeGreaterThan(0);
  });

  it('deletes existing songs before recreating them, in that order, per show', async () => {
    tx.show.findUnique.mockResolvedValue({ id: 'show-1' });
    tx.setlist.findUnique.mockResolvedValue({ id: 'setlist-1' });

    await service.seedDemoTheWarning();

    const deleteOrder = tx.setlistSong.deleteMany.mock.invocationCallOrder[0];
    const createOrder = tx.setlistSong.createMany.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });
});
