import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ArtistsService } from './artists.service';
import { PrismaService } from '../database/prisma.service';

describe('ArtistsService', () => {
  let service: ArtistsService;
  let prisma: {
    artist: { findMany: jest.Mock; findUnique: jest.Mock };
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
});
