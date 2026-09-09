import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArtistsService } from './artists.service';
import { PrismaService } from '../database/prisma.service';

describe('ArtistsService', () => {
  let service: ArtistsService;
  let prisma: {
    artist: { findMany: jest.Mock; findUnique: jest.Mock };
    fanProfile: { findMany: jest.Mock };
    show: { count: jest.Mock };
    setlistSong: { findMany: jest.Mock; groupBy: jest.Mock };
  };

  const theWarning = {
    id: 'artist-1',
    name: 'The Warning',
    slug: 'the-warning',
    imageUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    setlistsSyncedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      artist: {
        findMany: jest.fn().mockResolvedValue([theWarning]),
        findUnique: jest.fn().mockResolvedValue(theWarning),
      },
      fanProfile: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      show: {
        count: jest.fn().mockResolvedValue(0),
      },
      setlistSong: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ArtistsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ArtistsService>(ArtistsService);
  });

  describe('findAll', () => {
    it('returns artists ordered by name ascending', async () => {
      const result = await service.findAll();

      expect(prisma.artist.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        {
          id: theWarning.id,
          name: theWarning.name,
          slug: theWarning.slug,
          imageUrl: theWarning.imageUrl,
          createdAt: theWarning.createdAt,
          updatedAt: theWarning.updatedAt,
          setlistsSyncedAt: theWarning.setlistsSyncedAt,
        },
      ]);
    });

    it('returns an empty array when there are no artists', async () => {
      prisma.artist.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns the artist response when it exists', async () => {
      const result = await service.findOne(theWarning.id);

      expect(prisma.artist.findUnique).toHaveBeenCalledWith({
        where: { id: theWarning.id },
      });
      expect(result).toEqual({
        id: theWarning.id,
        name: theWarning.name,
        slug: theWarning.slug,
        imageUrl: theWarning.imageUrl,
        createdAt: theWarning.createdAt,
        updatedAt: theWarning.updatedAt,
        setlistsSyncedAt: theWarning.setlistsSyncedAt,
      });
    });

    it('returns imageUrl when the artist has one', async () => {
      const withImage = {
        ...theWarning,
        imageUrl: 'https://example.com/tw.jpg',
      };
      prisma.artist.findUnique.mockResolvedValue(withImage);

      const result = await service.findOne(theWarning.id);

      expect(result.imageUrl).toBe('https://example.com/tw.jpg');
    });

    // El badge "Actualizado" de /artists/the-warning depende de este campo
    // (ver setlist-fm-sync.service.ts) — null hasta la primera corrida.
    it('returns setlistsSyncedAt when the artist has synced before', async () => {
      const synced = {
        ...theWarning,
        setlistsSyncedAt: new Date('2026-09-07T02:00:00.000Z'),
      };
      prisma.artist.findUnique.mockResolvedValue(synced);

      const result = await service.findOne(theWarning.id);

      expect(result.setlistsSyncedAt).toEqual(
        new Date('2026-09-07T02:00:00.000Z'),
      );
    });

    it('throws NotFoundException when the artist does not exist', async () => {
      prisma.artist.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findFans', () => {
    const city = {
      id: 'city-1',
      name: 'Buenos Aires',
      countryId: 'country-1',
      latitude: -34.6037,
      longitude: -58.3816,
      country: { id: 'country-1', name: 'Argentina', code: 'AR' },
    };

    const fanProfile = {
      id: 'fan-1',
      userId: 'user-1',
      cityId: city.id,
      displayName: 'Visible Fan',
      showOnMap: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      city,
    };

    // Query genérica: no asume un artista en particular.
    const query = { onMap: 'true' };

    it('throws NotFoundException when the artist does not exist', async () => {
      prisma.artist.findUnique.mockResolvedValue(null);

      await expect(service.findFans(theWarning.id, query)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.fanProfile.findMany).not.toHaveBeenCalled();
    });

    it('queries FanProfiles associated to the artist via FanArtist', async () => {
      await service.findFans(theWarning.id, {});

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: { artists: { some: { artistId: theWarning.id } } },
        include: { city: { include: { country: true } } },
        orderBy: { displayName: 'asc' },
      });
    });

    it('adds showOnMap and city coordinate filters when onMap is "true"', async () => {
      await service.findFans(theWarning.id, { onMap: 'true' });

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: {
          artists: { some: { artistId: theWarning.id } },
          showOnMap: true,
          city: { latitude: { not: null }, longitude: { not: null } },
        },
        include: { city: { include: { country: true } } },
        orderBy: { displayName: 'asc' },
      });
    });

    it('adds showOnMap=false filter without coordinate filters when onMap is "false"', async () => {
      await service.findFans(theWarning.id, { onMap: 'false' });

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: {
          artists: { some: { artistId: theWarning.id } },
          showOnMap: false,
        },
        include: { city: { include: { country: true } } },
        orderBy: { displayName: 'asc' },
      });
    });

    it('returns the artist and the mapped fans', async () => {
      prisma.fanProfile.findMany.mockResolvedValue([fanProfile]);

      const result = await service.findFans(theWarning.id, query);

      expect(result).toEqual({
        artist: {
          id: theWarning.id,
          name: theWarning.name,
          slug: theWarning.slug,
          imageUrl: theWarning.imageUrl,
          createdAt: theWarning.createdAt,
          updatedAt: theWarning.updatedAt,
          setlistsSyncedAt: theWarning.setlistsSyncedAt,
        },
        fans: [
          {
            id: fanProfile.id,
            displayName: fanProfile.displayName,
            showOnMap: fanProfile.showOnMap,
            createdAt: fanProfile.createdAt,
            updatedAt: fanProfile.updatedAt,
            city: {
              id: city.id,
              name: city.name,
              latitude: city.latitude,
              longitude: city.longitude,
              country: { id: 'country-1', name: 'Argentina', code: 'AR' },
            },
          },
        ],
      });
    });

    it('returns an empty fans array when the artist has no visible fans', async () => {
      prisma.fanProfile.findMany.mockResolvedValue([]);

      const result = await service.findFans(theWarning.id, query);

      expect(result.fans).toEqual([]);
    });

    it('never exposes email or userId on the fans', async () => {
      prisma.fanProfile.findMany.mockResolvedValue([fanProfile]);

      const result = await service.findFans(theWarning.id, query);

      result.fans.forEach((fan: Record<string, unknown>) => {
        expect(fan).not.toHaveProperty('email');
        expect(fan).not.toHaveProperty('userId');
      });
    });
  });

  describe('findStats', () => {
    // Fans mínimos para ejercitar la deduplicación: dos fans comparten
    // exactamente la misma ciudad (city-1, dentro de country-1), un tercero
    // está en otra ciudad del mismo país (city-2), y un cuarto está en una
    // ciudad de otro país (city-3, country-2).
    const fansCityRows = [
      { city: { id: 'city-1', countryId: 'country-1' } },
      { city: { id: 'city-1', countryId: 'country-1' } },
      { city: { id: 'city-2', countryId: 'country-1' } },
      { city: { id: 'city-3', countryId: 'country-2' } },
    ];

    const songRows = [
      { title: 'Song A' },
      { title: 'Song A' },
      { title: 'Song B' },
    ];

    it('throws NotFoundException when the artist does not exist', async () => {
      prisma.artist.findUnique.mockResolvedValue(null);

      await expect(service.findStats('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.fanProfile.findMany).not.toHaveBeenCalled();
      expect(prisma.show.count).not.toHaveBeenCalled();
      expect(prisma.setlistSong.findMany).not.toHaveBeenCalled();
    });

    it('queries FanProfiles associated to the artist via FanArtist', async () => {
      await service.findStats(theWarning.id);

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: { artists: { some: { artistId: theWarning.id } } },
        select: { city: { select: { id: true, countryId: true } } },
      });
    });

    it('counts shows belonging to the artist', async () => {
      await service.findStats(theWarning.id);

      expect(prisma.show.count).toHaveBeenCalledWith({
        where: { artistId: theWarning.id },
      });
    });

    it('queries setlist songs scoped to the shows of the artist', async () => {
      await service.findStats(theWarning.id);

      expect(prisma.setlistSong.findMany).toHaveBeenCalledWith({
        where: { setlist: { show: { artistId: theWarning.id } } },
        select: { title: true },
      });
    });

    it('returns all zeros when the artist has no data', async () => {
      const result = await service.findStats(theWarning.id);

      expect(result).toEqual({
        fans: 0,
        countries: 0,
        cities: 0,
        shows: 0,
        songs: 0,
      });
    });

    it('counts fans related to the artist', async () => {
      prisma.fanProfile.findMany.mockResolvedValue(fansCityRows);

      const result = await service.findStats(theWarning.id);

      expect(result.fans).toBe(4);
    });

    it('deduplicates cities so a city with many fans counts once', async () => {
      prisma.fanProfile.findMany.mockResolvedValue(fansCityRows);

      const result = await service.findStats(theWarning.id);

      expect(result.cities).toBe(3);
    });

    it('deduplicates countries so a country with many fans counts once', async () => {
      prisma.fanProfile.findMany.mockResolvedValue(fansCityRows);

      const result = await service.findStats(theWarning.id);

      expect(result.countries).toBe(2);
    });

    it('returns the shows count from prisma as-is', async () => {
      prisma.show.count.mockResolvedValue(5);

      const result = await service.findStats(theWarning.id);

      expect(result.shows).toBe(5);
    });

    it('deduplicates songs so a song repeated across setlists counts once', async () => {
      prisma.setlistSong.findMany.mockResolvedValue(songRows);

      const result = await service.findStats(theWarning.id);

      expect(result.songs).toBe(2);
    });
  });

  describe('findTopSongs', () => {
    const groupedRows = [
      { title: 'S!CK', _count: { title: 42 } },
      { title: 'MORE', _count: { title: 38 } },
    ];

    it('throws NotFoundException when the artist does not exist', async () => {
      prisma.artist.findUnique.mockResolvedValue(null);

      await expect(service.findTopSongs('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.setlistSong.groupBy).not.toHaveBeenCalled();
    });

    it('groups setlist songs scoped to the shows of the artist, ordered by count desc then title asc', async () => {
      await service.findTopSongs(theWarning.id);

      expect(prisma.setlistSong.groupBy).toHaveBeenCalledWith({
        by: ['title'],
        where: { setlist: { show: { artistId: theWarning.id } } },
        _count: { title: true },
        orderBy: [{ _count: { title: 'desc' } }, { title: 'asc' }],
      });
    });

    it('maps the grouped rows to { title, timesPlayed }', async () => {
      prisma.setlistSong.groupBy.mockResolvedValue(groupedRows);

      const result = await service.findTopSongs(theWarning.id);

      expect(result).toEqual([
        { title: 'S!CK', timesPlayed: 42 },
        { title: 'MORE', timesPlayed: 38 },
      ]);
    });

    it('returns an empty array when the artist has no songs', async () => {
      const result = await service.findTopSongs(theWarning.id);

      expect(result).toEqual([]);
    });
  });
});
