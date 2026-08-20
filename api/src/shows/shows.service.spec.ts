import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ShowsService } from './shows.service';
import { PrismaService } from '../database/prisma.service';

describe('ShowsService', () => {
  let service: ShowsService;
  let prisma: {
    artist: { findUnique: jest.Mock };
    show: { findMany: jest.Mock; findUnique: jest.Mock };
    setlist: { findUnique: jest.Mock };
  };

  const artist = {
    id: 'artist-1',
    name: 'The Warning',
    slug: 'the-warning',
    imageUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const city = {
    id: 'city-1',
    name: 'Ciudad de México',
    countryId: 'country-1',
    latitude: 19.4326,
    longitude: -99.1332,
    country: { id: 'country-1', name: 'México', code: 'MX' },
  };

  const show = {
    id: 'show-1',
    artistId: artist.id,
    cityId: city.id,
    date: new Date('2026-03-15T00:00:00.000Z'),
    venue: 'Foro Sol',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    city,
  };

  // segundo show, anterior en el tiempo: cubre "ordenado cronológicamente".
  const earlierShow = {
    ...show,
    id: 'show-0',
    date: new Date('2026-02-01T00:00:00.000Z'),
    venue: null,
  };

  beforeEach(async () => {
    prisma = {
      artist: { findUnique: jest.fn().mockResolvedValue(artist) },
      show: {
        findMany: jest.fn().mockResolvedValue([earlierShow, show]),
        findUnique: jest.fn().mockResolvedValue(show),
      },
      setlist: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ShowsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ShowsService>(ShowsService);
  });

  describe('findAllByArtist', () => {
    it('throws NotFoundException when the artist does not exist', async () => {
      prisma.artist.findUnique.mockResolvedValue(null);

      await expect(service.findAllByArtist('missing-artist')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.show.findMany).not.toHaveBeenCalled();
    });

    it('queries shows for the artist ordered chronologically', async () => {
      await service.findAllByArtist(artist.id);

      expect(prisma.show.findMany).toHaveBeenCalledWith({
        where: { artistId: artist.id },
        include: { city: { include: { country: true } } },
        orderBy: { date: 'asc' },
      });
    });

    it('returns an empty array when the artist has no shows', async () => {
      prisma.show.findMany.mockResolvedValue([]);

      const result = await service.findAllByArtist(artist.id);

      expect(result).toEqual([]);
    });

    it('returns shows in the order given by prisma, mapping the city', async () => {
      const result = await service.findAllByArtist(artist.id);

      expect(result).toEqual([
        {
          id: earlierShow.id,
          date: earlierShow.date,
          venue: earlierShow.venue,
          createdAt: earlierShow.createdAt,
          updatedAt: earlierShow.updatedAt,
          city: {
            id: city.id,
            name: city.name,
            latitude: city.latitude,
            longitude: city.longitude,
            country: { id: 'country-1', name: 'México', code: 'MX' },
          },
        },
        {
          id: show.id,
          date: show.date,
          venue: show.venue,
          createdAt: show.createdAt,
          updatedAt: show.updatedAt,
          city: {
            id: city.id,
            name: city.name,
            latitude: city.latitude,
            longitude: city.longitude,
            country: { id: 'country-1', name: 'México', code: 'MX' },
          },
        },
      ]);
    });

    it('never exposes artistId or cityId on the shows', async () => {
      const result = await service.findAllByArtist(artist.id);

      result.forEach((item: Record<string, unknown>) => {
        expect(item).not.toHaveProperty('artistId');
        expect(item).not.toHaveProperty('cityId');
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the artist does not exist', async () => {
      prisma.artist.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('missing-artist', show.id),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.show.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the show does not exist', async () => {
      prisma.show.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne(artist.id, 'missing-show'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the show belongs to a different artist', async () => {
      prisma.show.findUnique.mockResolvedValue({
        ...show,
        artistId: 'other-artist',
      });

      await expect(service.findOne(artist.id, show.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the show, including its city', async () => {
      const result = await service.findOne(artist.id, show.id);

      expect(prisma.show.findUnique).toHaveBeenCalledWith({
        where: { id: show.id },
        include: { city: { include: { country: true } } },
      });
      expect(result).toEqual({
        id: show.id,
        date: show.date,
        venue: show.venue,
        createdAt: show.createdAt,
        updatedAt: show.updatedAt,
        city: {
          id: city.id,
          name: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          country: { id: 'country-1', name: 'México', code: 'MX' },
        },
      });
    });
  });

  describe('findSetlist', () => {
    it('throws NotFoundException when the artist does not exist', async () => {
      prisma.artist.findUnique.mockResolvedValue(null);

      await expect(
        service.findSetlist('missing-artist', show.id),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.setlist.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the show does not exist', async () => {
      prisma.show.findUnique.mockResolvedValue(null);

      await expect(
        service.findSetlist(artist.id, 'missing-show'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.setlist.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the show belongs to a different artist', async () => {
      prisma.show.findUnique.mockResolvedValue({
        ...show,
        artistId: 'other-artist',
      });

      await expect(service.findSetlist(artist.id, show.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.setlist.findUnique).not.toHaveBeenCalled();
    });

    it('returns an empty songs array when no setlist has been entered yet', async () => {
      prisma.setlist.findUnique.mockResolvedValue(null);

      const result = await service.findSetlist(artist.id, show.id);

      expect(prisma.setlist.findUnique).toHaveBeenCalledWith({
        where: { showId: show.id },
        include: { songs: { orderBy: { position: 'asc' } } },
      });
      expect(result).toEqual({ showId: show.id, songs: [] });
    });

    it('returns an empty songs array when the setlist exists but has no songs', async () => {
      prisma.setlist.findUnique.mockResolvedValue({
        id: 'setlist-1',
        showId: show.id,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        songs: [],
      });

      const result = await service.findSetlist(artist.id, show.id);

      expect(result).toEqual({ showId: show.id, songs: [] });
    });

    it('returns the songs ordered by position', async () => {
      prisma.setlist.findUnique.mockResolvedValue({
        id: 'setlist-1',
        showId: show.id,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        songs: [
          { id: 'song-1', setlistId: 'setlist-1', title: 'Qué Más Da', position: 1 },
          { id: 'song-2', setlistId: 'setlist-1', title: 'Automatic Sun', position: 2 },
        ],
      });

      const result = await service.findSetlist(artist.id, show.id);

      expect(result).toEqual({
        showId: show.id,
        songs: [
          { id: 'song-1', position: 1, title: 'Qué Más Da' },
          { id: 'song-2', position: 2, title: 'Automatic Sun' },
        ],
      });
    });
  });
});
