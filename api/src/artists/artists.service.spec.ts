import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArtistsService } from './artists.service';
import { PrismaService } from '../database/prisma.service';

describe('ArtistsService', () => {
  let service: ArtistsService;
  let prisma: {
    artist: { findMany: jest.Mock; findUnique: jest.Mock };
    fanProfile: { findMany: jest.Mock };
  };

  const theWarning = {
    id: 'artist-1',
    name: 'The Warning',
    slug: 'the-warning',
    imageUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
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

      await expect(
        service.findFans(theWarning.id, query),
      ).rejects.toThrow(NotFoundException);
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
});
