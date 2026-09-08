import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FanProfilesService } from './fan-profiles.service';
import { PrismaService } from '../database/prisma.service';

describe('FanProfilesService', () => {
  let service: FanProfilesService;
  let prisma: {
    city: { findUnique: jest.Mock };
    artist: { findMany: jest.Mock };
    song: { findMany: jest.Mock };
    fanProfile: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    fanProfileFavoriteSong: { groupBy: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    fanProfile: { update: jest.Mock };
    fanArtist: { deleteMany: jest.Mock; createMany: jest.Mock };
    fanProfileSetlistSong: { deleteMany: jest.Mock; createMany: jest.Mock };
    fanProfileFavoriteSong: { deleteMany: jest.Mock; createMany: jest.Mock };
  };

  const userId = 'user-1';

  const dto = {
    displayName: 'Fan Name',
    cityId: 'city-1',
  };

  const city = {
    id: 'city-1',
    name: 'Buenos Aires',
    countryId: 'country-1',
    latitude: -34.6037,
    longitude: -58.3816,
  };

  const artistA = {
    id: 'artist-a',
    name: 'The Warning',
    slug: 'the-warning',
    imageUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const artistB = {
    id: 'artist-b',
    name: 'Other Artist',
    slug: 'other-artist',
    imageUrl: 'https://example.com/other.jpg',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const songA = {
    id: 'song-a',
    artistId: 'artist-a',
    title: 'Automatic Sun',
    albumTitle: 'XXI Century Blood',
    releaseDate: new Date('2017-03-27T00:00:00.000Z'),
    mbid: 'mbid-a',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const songB = {
    id: 'song-b',
    artistId: 'artist-a',
    title: 'Choke',
    albumTitle: 'ERROR',
    releaseDate: new Date('2022-06-24T00:00:00.000Z'),
    mbid: 'mbid-b',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const songC = {
    id: 'song-c',
    artistId: 'artist-a',
    title: 'Qué Más Da',
    albumTitle: null,
    releaseDate: null,
    mbid: 'mbid-c',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  // Defaults de un FanProfile "en blanco": sin redes, sin setlist, sin
  // favoritas, sin foto — así cada test solo tiene que overridear lo que
  // le importa.
  const blankSocial = {
    instagramUrl: null,
    instagramIsPublic: false,
    tiktokUrl: null,
    tiktokIsPublic: false,
    xUrl: null,
    xIsPublic: false,
    youtubeUrl: null,
    youtubeIsPublic: false,
    facebookUrl: null,
    facebookIsPublic: false,
  };

  const createdFanProfile = {
    id: 'profile-1',
    userId,
    cityId: 'city-1',
    displayName: 'Fan Name',
    showOnMap: false,
    ...blankSocial,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    city: {
      id: 'city-1',
      name: 'Buenos Aires',
      countryId: 'country-1',
      latitude: -34.6037,
      longitude: -58.3816,
      country: { id: 'country-1', name: 'Argentina', code: 'AR' },
    },
    artists: [
      {
        fanProfileId: 'profile-1',
        artistId: 'artist-a',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        artist: artistA,
      },
    ],
    setlistSongs: [] as unknown[],
    favoriteSongs: [] as unknown[],
    user: { googlePhotoUrl: null as string | null },
  };

  // city-2 tiene coordenadas nulas: representa una ciudad sin geocodificar.
  const secondFanProfile = {
    id: 'profile-2',
    userId: 'user-2',
    cityId: 'city-2',
    displayName: 'Second Fan',
    showOnMap: true,
    ...blankSocial,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    city: {
      id: 'city-2',
      name: 'Cordoba',
      countryId: 'country-1',
      latitude: null,
      longitude: null,
      country: { id: 'country-1', name: 'Argentina', code: 'AR' },
    },
    artists: [] as unknown[],
    setlistSongs: [] as unknown[],
    favoriteSongs: [] as unknown[],
    user: { googlePhotoUrl: null as string | null },
  };

  const INCLUDE = {
    city: { include: { country: true } },
    artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
    setlistSongs: { include: { song: true }, orderBy: { position: 'asc' } },
    favoriteSongs: { include: { song: true }, orderBy: { position: 'asc' } },
    user: { select: { googlePhotoUrl: true } },
  };

  beforeEach(async () => {
    tx = {
      fanProfile: {
        update: jest.fn().mockResolvedValue(createdFanProfile),
      },
      fanArtist: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      fanProfileSetlistSong: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      fanProfileFavoriteSong: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    prisma = {
      city: { findUnique: jest.fn().mockResolvedValue(city) },
      artist: {
        findMany: jest.fn().mockResolvedValue([artistA]),
      },
      // Filtra el catálogo fijo [songA, songB, songC] por el `where.id.in`
      // recibido, como haría Postgres — así cada test no tiene que
      // overridear el mock solo porque pidió un subconjunto distinto de
      // canciones (ver validateSongEntries en el service, que compara
      // found.length contra songIds.length).
      song: {
        findMany: jest.fn().mockImplementation(
          ({ where }: { where: { id: { in: string[] } } }) => {
            const catalog = [songA, songB, songC];
            return Promise.resolve(
              catalog.filter((song) => where.id.in.includes(song.id)),
            );
          },
        ),
      },
      fanProfile: {
        findUnique: jest.fn().mockResolvedValue(createdFanProfile),
        findMany: jest
          .fn()
          .mockResolvedValue([createdFanProfile, secondFanProfile]),
        create: jest.fn().mockResolvedValue(createdFanProfile),
        update: jest.fn().mockResolvedValue(createdFanProfile),
      },
      fanProfileFavoriteSong: { groupBy: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FanProfilesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FanProfilesService>(FanProfilesService);
  });

  describe('create', () => {
    beforeEach(() => {
      // Sin conflicto por defecto: el User autenticado todavía no tiene
      // FanProfile (ver chequeo de unicidad en el service).
      prisma.fanProfile.findUnique.mockResolvedValue(null);
    });

    it('creates the FanProfile for the given userId', async () => {
      await service.create(userId, dto);

      expect(prisma.fanProfile.create).toHaveBeenCalledWith({
        data: {
          userId,
          cityId: dto.cityId,
          displayName: dto.displayName,
          showOnMap: false,
          artists: { create: [] },
        },
        include: INCLUDE,
      });
    });

    it('does not create or look up a User', async () => {
      expect(prisma).not.toHaveProperty('user');

      await expect(service.create(userId, dto)).resolves.toBeDefined();
    });

    it('defaults showOnMap to false when not provided', async () => {
      await service.create(userId, dto);

      expect(prisma.fanProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ showOnMap: false }),
        }),
      );
    });

    it('uses the provided showOnMap value when given', async () => {
      await service.create(userId, { ...dto, showOnMap: true });

      expect(prisma.fanProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ showOnMap: true }),
        }),
      );
    });

    it('returns the own-profile shape, without email or userId', async () => {
      const result = await service.create(userId, dto);

      expect(result).toEqual({
        id: createdFanProfile.id,
        displayName: createdFanProfile.displayName,
        showOnMap: createdFanProfile.showOnMap,
        createdAt: createdFanProfile.createdAt,
        updatedAt: createdFanProfile.updatedAt,
        city: {
          id: city.id,
          name: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          country: { id: 'country-1', name: 'Argentina', code: 'AR' },
        },
        artists: [
          { id: artistA.id, name: artistA.name, slug: artistA.slug, imageUrl: artistA.imageUrl },
        ],
        photoUrl: null,
        setlistSongs: [],
        favoriteSongs: [],
        instagramUrl: null,
        instagramIsPublic: false,
        tiktokUrl: null,
        tiktokIsPublic: false,
        xUrl: null,
        xIsPublic: false,
        youtubeUrl: null,
        youtubeIsPublic: false,
        facebookUrl: null,
        facebookIsPublic: false,
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
    });

    it('throws BadRequestException when the city does not exist', async () => {
      prisma.city.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.fanProfile.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the user already has a fan profile', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(createdFanProfile);

      await expect(service.create(userId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.fanProfile.create).not.toHaveBeenCalled();
    });

    describe('create with artistIds', () => {
      it('creates FanArtist rows for the given artistIds', async () => {
        prisma.artist.findMany.mockResolvedValue([artistA, artistB]);

        await service.create(userId, {
          ...dto,
          artistIds: [artistA.id, artistB.id],
        });

        expect(prisma.artist.findMany).toHaveBeenCalledWith({
          where: { id: { in: [artistA.id, artistB.id] } },
          select: { id: true },
        });
        expect(prisma.fanProfile.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              artists: { create: [{ artistId: artistA.id }, { artistId: artistB.id }] },
            }),
          }),
        );
      });

      it('creates no FanArtist rows when artistIds is not provided', async () => {
        await service.create(userId, dto);

        expect(prisma.artist.findMany).not.toHaveBeenCalled();
        expect(prisma.fanProfile.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ artists: { create: [] } }),
          }),
        );
      });

      it('throws BadRequestException when an artistId does not reference an existing artist', async () => {
        prisma.artist.findMany.mockResolvedValue([artistA]);

        await expect(
          service.create(userId, {
            ...dto,
            artistIds: [artistA.id, 'missing-artist'],
          }),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.fanProfile.create).not.toHaveBeenCalled();
      });
    });
  });

  describe('findOne', () => {
    it('returns the public-profile shape, without email or userId', async () => {
      const result = await service.findOne(createdFanProfile.id);

      expect(prisma.fanProfile.findUnique).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        include: INCLUDE,
      });
      expect(result).toEqual({
        id: createdFanProfile.id,
        displayName: createdFanProfile.displayName,
        showOnMap: createdFanProfile.showOnMap,
        createdAt: createdFanProfile.createdAt,
        updatedAt: createdFanProfile.updatedAt,
        city: {
          id: city.id,
          name: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          country: { id: 'country-1', name: 'Argentina', code: 'AR' },
        },
        artists: [
          { id: artistA.id, name: artistA.name, slug: artistA.slug, imageUrl: artistA.imageUrl },
        ],
        photoUrl: null,
        setlistSongs: [],
        favoriteSongs: [],
        social: {},
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
      expect(result).not.toHaveProperty('instagramUrl');
      expect(result).not.toHaveProperty('instagramIsPublic');
    });

    it('throws NotFoundException when the fan profile does not exist', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('includes the Google photo URL when the user has one', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue({
        ...createdFanProfile,
        user: { googlePhotoUrl: 'https://lh3.googleusercontent.com/a/photo.jpg' },
      });

      const result = await service.findOne(createdFanProfile.id);

      expect(result.photoUrl).toBe('https://lh3.googleusercontent.com/a/photo.jpg');
    });

    it('exposes only the social links marked public', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue({
        ...createdFanProfile,
        instagramUrl: 'https://instagram.com/fan',
        instagramIsPublic: true,
        tiktokUrl: 'https://tiktok.com/@fan',
        tiktokIsPublic: false,
      });

      const result = await service.findOne(createdFanProfile.id);

      expect(result.social).toEqual({ instagram: 'https://instagram.com/fan' });
    });

    // Requisito central de esta etapa: setlist y Top 10 son dos listas
    // independientes, ambas siempre públicas, cada una con su propio
    // `position` (nunca null).
    it('includes setlistSongs and favoriteSongs as two independent, positioned lists', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue({
        ...createdFanProfile,
        setlistSongs: [
          { fanProfileId: 'profile-1', songId: songA.id, position: 1, createdAt: new Date(), song: songA },
          { fanProfileId: 'profile-1', songId: songB.id, position: 2, createdAt: new Date(), song: songB },
        ],
        favoriteSongs: [
          { fanProfileId: 'profile-1', songId: songC.id, position: 1, createdAt: new Date(), song: songC },
        ],
      });

      const result = await service.findOne(createdFanProfile.id);

      expect(result.setlistSongs).toEqual([
        { id: songA.id, title: songA.title, albumTitle: songA.albumTitle, position: 1 },
        { id: songB.id, title: songB.title, albumTitle: songB.albumTitle, position: 2 },
      ]);
      expect(result.favoriteSongs).toEqual([
        { id: songC.id, title: songC.title, albumTitle: songC.albumTitle, position: 1 },
      ]);
    });
  });

  describe('findMine', () => {
    it('looks up the fan profile by userId and returns the own-profile shape', async () => {
      const result = await service.findMine(userId);

      expect(prisma.fanProfile.findUnique).toHaveBeenCalledWith({
        where: { userId },
        include: INCLUDE,
      });
      expect(result).toEqual({
        id: createdFanProfile.id,
        displayName: createdFanProfile.displayName,
        showOnMap: createdFanProfile.showOnMap,
        createdAt: createdFanProfile.createdAt,
        updatedAt: createdFanProfile.updatedAt,
        city: {
          id: city.id,
          name: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          country: { id: 'country-1', name: 'Argentina', code: 'AR' },
        },
        artists: [
          { id: artistA.id, name: artistA.name, slug: artistA.slug, imageUrl: artistA.imageUrl },
        ],
        photoUrl: null,
        setlistSongs: [],
        favoriteSongs: [],
        instagramUrl: null,
        instagramIsPublic: false,
        tiktokUrl: null,
        tiktokIsPublic: false,
        xUrl: null,
        xIsPublic: false,
        youtubeUrl: null,
        youtubeIsPublic: false,
        facebookUrl: null,
        facebookIsPublic: false,
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
    });

    it('throws NotFoundException when the authenticated user has no fan profile', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(null);

      await expect(service.findMine(userId)).rejects.toThrow(NotFoundException);
    });

    it('exposes every social field, including private ones, for the owner', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue({
        ...createdFanProfile,
        instagramUrl: 'https://instagram.com/fan',
        instagramIsPublic: false,
      });

      const result = await service.findMine(userId);

      expect(result.instagramUrl).toBe('https://instagram.com/fan');
      expect(result.instagramIsPublic).toBe(false);
    });
  });

  describe('update', () => {
    it('updates only the provided fields when artistIds/setlistSongs/favoriteSongs are not sent', async () => {
      await service.update(createdFanProfile.id, userId, { displayName: 'New Name' });

      expect(prisma.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: { displayName: 'New Name' },
        include: INCLUDE,
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates displayName', async () => {
      const updated = { ...createdFanProfile, displayName: 'New Name' };
      prisma.fanProfile.update.mockResolvedValue(updated);

      const result = await service.update(createdFanProfile.id, userId, {
        displayName: 'New Name',
      });

      expect(result.displayName).toBe('New Name');
    });

    it('updates cityId after validating the city exists', async () => {
      const newCity = { id: 'city-2', name: 'Cordoba', countryId: 'country-1' };
      prisma.city.findUnique.mockResolvedValue(newCity);

      await service.update(createdFanProfile.id, userId, { cityId: 'city-2' });

      expect(prisma.city.findUnique).toHaveBeenCalledWith({ where: { id: 'city-2' } });
      expect(prisma.fanProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: createdFanProfile.id },
          data: { cityId: 'city-2' },
        }),
      );
    });

    it('throws BadRequestException when the new cityId does not reference an existing city', async () => {
      prisma.city.findUnique.mockResolvedValue(null);

      await expect(
        service.update(createdFanProfile.id, userId, { cityId: 'missing-city' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.fanProfile.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the fan profile does not exist', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing-id', userId, { displayName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.fanProfile.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the authenticated user does not own the fan profile', async () => {
      await expect(
        service.update(createdFanProfile.id, 'someone-else', {
          displayName: 'Hijacked Name',
          cityId: 'city-2',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.fanProfile.update).not.toHaveBeenCalled();
      expect(prisma.city.findUnique).not.toHaveBeenCalled();
    });

    it('returns the own-profile shape, without email or userId', async () => {
      const result = await service.update(createdFanProfile.id, userId, {
        displayName: 'New Name',
      });

      expect(result).toEqual({
        id: createdFanProfile.id,
        displayName: createdFanProfile.displayName,
        showOnMap: createdFanProfile.showOnMap,
        createdAt: createdFanProfile.createdAt,
        updatedAt: createdFanProfile.updatedAt,
        city: {
          id: city.id,
          name: city.name,
          latitude: city.latitude,
          longitude: city.longitude,
          country: { id: 'country-1', name: 'Argentina', code: 'AR' },
        },
        artists: [
          { id: artistA.id, name: artistA.name, slug: artistA.slug, imageUrl: artistA.imageUrl },
        ],
        photoUrl: null,
        setlistSongs: [],
        favoriteSongs: [],
        instagramUrl: null,
        instagramIsPublic: false,
        tiktokUrl: null,
        tiktokIsPublic: false,
        xUrl: null,
        xIsPublic: false,
        youtubeUrl: null,
        youtubeIsPublic: false,
        facebookUrl: null,
        facebookIsPublic: false,
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
    });
  });

  describe('update with artistIds', () => {
    it('validates that all artistIds exist before mutating anything', async () => {
      prisma.artist.findMany.mockResolvedValue([artistA]);

      await expect(
        service.update(createdFanProfile.id, userId, {
          artistIds: [artistA.id, 'missing-artist'],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.fanArtist.deleteMany).not.toHaveBeenCalled();
    });

    it('replaces the FanArtist rows inside a transaction', async () => {
      prisma.artist.findMany.mockResolvedValue([artistB]);

      await service.update(createdFanProfile.id, userId, { artistIds: [artistB.id] });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.fanArtist.deleteMany).toHaveBeenCalledWith({
        where: { fanProfileId: createdFanProfile.id },
      });
      expect(tx.fanArtist.createMany).toHaveBeenCalledWith({
        data: [{ fanProfileId: createdFanProfile.id, artistId: artistB.id }],
      });
    });

    it('leaves existing associations untouched when artistIds is not sent', async () => {
      await service.update(createdFanProfile.id, userId, { displayName: 'New Name' });

      expect(tx.fanArtist.deleteMany).not.toHaveBeenCalled();
      expect(tx.fanArtist.createMany).not.toHaveBeenCalled();
    });

    // Independencia: tocar artistIds no debe tocar setlistSongs/favoriteSongs.
    it('does not touch setlistSongs or favoriteSongs when only artistIds is sent', async () => {
      prisma.artist.findMany.mockResolvedValue([artistB]);

      await service.update(createdFanProfile.id, userId, { artistIds: [artistB.id] });

      expect(tx.fanProfileSetlistSong.deleteMany).not.toHaveBeenCalled();
      expect(tx.fanProfileFavoriteSong.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('update with setlistSongs', () => {
    it('validates that all songIds exist before mutating anything', async () => {
      prisma.song.findMany.mockResolvedValue([songA]);

      await expect(
        service.update(createdFanProfile.id, userId, {
          setlistSongs: [{ songId: songA.id, position: 1 }, { songId: 'missing-song', position: 2 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.fanProfileSetlistSong.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects a duplicate songId within the same request', async () => {
      await expect(
        service.update(createdFanProfile.id, userId, {
          setlistSongs: [{ songId: songA.id, position: 1 }, { songId: songA.id, position: 2 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a duplicate position within the same request', async () => {
      await expect(
        service.update(createdFanProfile.id, userId, {
          setlistSongs: [
            { songId: songA.id, position: 1 },
            { songId: songB.id, position: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('replaces the FanProfileSetlistSong rows inside a transaction, in one position order', async () => {
      await service.update(createdFanProfile.id, userId, {
        setlistSongs: [
          { songId: songA.id, position: 1 },
          { songId: songB.id, position: 2 },
        ],
      });

      expect(prisma.song.findMany).toHaveBeenCalledWith({
        where: { id: { in: [songA.id, songB.id] } },
        select: { id: true },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.fanProfileSetlistSong.deleteMany).toHaveBeenCalledWith({
        where: { fanProfileId: createdFanProfile.id },
      });
      expect(tx.fanProfileSetlistSong.createMany).toHaveBeenCalledWith({
        data: [
          { fanProfileId: createdFanProfile.id, songId: songA.id, position: 1 },
          { fanProfileId: createdFanProfile.id, songId: songB.id, position: 2 },
        ],
      });
    });

    it('clears the whole setlist when setlistSongs is an empty array', async () => {
      await service.update(createdFanProfile.id, userId, { setlistSongs: [] });

      expect(prisma.song.findMany).not.toHaveBeenCalled();
      expect(tx.fanProfileSetlistSong.deleteMany).toHaveBeenCalledWith({
        where: { fanProfileId: createdFanProfile.id },
      });
      expect(tx.fanProfileSetlistSong.createMany).not.toHaveBeenCalled();
    });

    it('reorders the setlist by replacing the whole set with new positions', async () => {
      await service.update(createdFanProfile.id, userId, {
        setlistSongs: [
          { songId: songA.id, position: 2 },
          { songId: songB.id, position: 1 },
        ],
      });

      expect(tx.fanProfileSetlistSong.createMany).toHaveBeenCalledWith({
        data: [
          { fanProfileId: createdFanProfile.id, songId: songA.id, position: 2 },
          { fanProfileId: createdFanProfile.id, songId: songB.id, position: 1 },
        ],
      });
    });

    it('leaves the existing setlist untouched when setlistSongs is not sent', async () => {
      await service.update(createdFanProfile.id, userId, { displayName: 'New Name' });

      expect(tx.fanProfileSetlistSong.deleteMany).not.toHaveBeenCalled();
      expect(tx.fanProfileSetlistSong.createMany).not.toHaveBeenCalled();
    });

    // Requisito central: tocar el setlist nunca debe tocar las favoritas.
    it('does not touch favoriteSongs when only setlistSongs is sent', async () => {
      await service.update(createdFanProfile.id, userId, {
        setlistSongs: [{ songId: songA.id, position: 1 }],
      });

      expect(tx.fanProfileFavoriteSong.deleteMany).not.toHaveBeenCalled();
      expect(tx.fanProfileFavoriteSong.createMany).not.toHaveBeenCalled();
    });
  });

  describe('update with favoriteSongs', () => {
    it('validates that all songIds exist before mutating anything', async () => {
      prisma.song.findMany.mockResolvedValue([songA]);

      await expect(
        service.update(createdFanProfile.id, userId, {
          favoriteSongs: [{ songId: songA.id, position: 1 }, { songId: 'missing-song', position: 2 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(tx.fanProfileFavoriteSong.deleteMany).not.toHaveBeenCalled();
    });

    it('rejects a duplicate songId within the same request', async () => {
      await expect(
        service.update(createdFanProfile.id, userId, {
          favoriteSongs: [{ songId: songA.id, position: 1 }, { songId: songA.id, position: 2 }],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.song.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a duplicate position within the same request', async () => {
      await expect(
        service.update(createdFanProfile.id, userId, {
          favoriteSongs: [
            { songId: songA.id, position: 1 },
            { songId: songB.id, position: 1 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('replaces the FanProfileFavoriteSong rows inside a transaction', async () => {
      await service.update(createdFanProfile.id, userId, {
        favoriteSongs: [
          { songId: songA.id, position: 1 },
          { songId: songB.id, position: 2 },
        ],
      });

      expect(prisma.song.findMany).toHaveBeenCalledWith({
        where: { id: { in: [songA.id, songB.id] } },
        select: { id: true },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(tx.fanProfileFavoriteSong.deleteMany).toHaveBeenCalledWith({
        where: { fanProfileId: createdFanProfile.id },
      });
      expect(tx.fanProfileFavoriteSong.createMany).toHaveBeenCalledWith({
        data: [
          { fanProfileId: createdFanProfile.id, songId: songA.id, position: 1 },
          { fanProfileId: createdFanProfile.id, songId: songB.id, position: 2 },
        ],
      });
    });

    it('clears all favorites when favoriteSongs is an empty array', async () => {
      await service.update(createdFanProfile.id, userId, { favoriteSongs: [] });

      expect(prisma.song.findMany).not.toHaveBeenCalled();
      expect(tx.fanProfileFavoriteSong.deleteMany).toHaveBeenCalledWith({
        where: { fanProfileId: createdFanProfile.id },
      });
      expect(tx.fanProfileFavoriteSong.createMany).not.toHaveBeenCalled();
    });

    it('reorders the Top 10 by replacing the whole set with new positions', async () => {
      await service.update(createdFanProfile.id, userId, {
        favoriteSongs: [
          { songId: songA.id, position: 2 },
          { songId: songB.id, position: 1 },
        ],
      });

      expect(tx.fanProfileFavoriteSong.createMany).toHaveBeenCalledWith({
        data: [
          { fanProfileId: createdFanProfile.id, songId: songA.id, position: 2 },
          { fanProfileId: createdFanProfile.id, songId: songB.id, position: 1 },
        ],
      });
    });

    it('leaves existing favorites untouched when favoriteSongs is not sent', async () => {
      await service.update(createdFanProfile.id, userId, { displayName: 'New Name' });

      expect(tx.fanProfileFavoriteSong.deleteMany).not.toHaveBeenCalled();
      expect(tx.fanProfileFavoriteSong.createMany).not.toHaveBeenCalled();
    });

    // Requisito central: tocar las favoritas nunca debe tocar el setlist.
    it('does not touch setlistSongs when only favoriteSongs is sent', async () => {
      await service.update(createdFanProfile.id, userId, {
        favoriteSongs: [{ songId: songA.id, position: 1 }],
      });

      expect(tx.fanProfileSetlistSong.deleteMany).not.toHaveBeenCalled();
      expect(tx.fanProfileSetlistSong.createMany).not.toHaveBeenCalled();
    });

    // Independencia total, en un solo PATCH: mandar ambas listas a la vez
    // reemplaza cada una por su cuenta, sin cruzarse.
    it('replaces both lists independently when both are sent in the same request', async () => {
      await service.update(createdFanProfile.id, userId, {
        setlistSongs: [{ songId: songA.id, position: 1 }],
        favoriteSongs: [{ songId: songB.id, position: 1 }],
      });

      expect(tx.fanProfileSetlistSong.createMany).toHaveBeenCalledWith({
        data: [{ fanProfileId: createdFanProfile.id, songId: songA.id, position: 1 }],
      });
      expect(tx.fanProfileFavoriteSong.createMany).toHaveBeenCalledWith({
        data: [{ fanProfileId: createdFanProfile.id, songId: songB.id, position: 1 }],
      });
    });
  });

  describe('update with social links', () => {
    it('updates a social URL and its isPublic flag together', async () => {
      await service.update(createdFanProfile.id, userId, {
        instagramUrl: 'https://instagram.com/fan',
        instagramIsPublic: true,
      });

      expect(prisma.fanProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { instagramUrl: 'https://instagram.com/fan', instagramIsPublic: true },
        }),
      );
    });

    it('clears a social URL when explicitly set to null', async () => {
      await service.update(createdFanProfile.id, userId, { youtubeUrl: null });

      expect(prisma.fanProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { youtubeUrl: null } }),
      );
    });
  });

  describe('findAll', () => {
    it('returns all fan profiles when no filter is provided', async () => {
      const result = await service.findAll({});

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: {},
        include: INCLUDE,
      });
      expect(result).toHaveLength(2);
    });

    it('filters by showOnMap=true and non-null city coordinates when onMap is "true"', async () => {
      await service.findAll({ onMap: 'true' });

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            showOnMap: true,
            city: { latitude: { not: null }, longitude: { not: null } },
          },
        }),
      );
    });

    it('never exposes email, userId, or the individual social fields', async () => {
      const result = await service.findAll({});

      result.forEach((profile) => {
        expect(profile).not.toHaveProperty('email');
        expect(profile).not.toHaveProperty('userId');
        expect(profile).not.toHaveProperty('instagramUrl');
      });
    });
  });

  describe('findFavoriteSongsRanking', () => {
    function groupRow(songId: string, count: number) {
      return { songId, _count: { songId: count } };
    }

    it('returns an empty ranking when nobody has favorited anything', async () => {
      prisma.fanProfileFavoriteSong.groupBy.mockResolvedValue([]);

      const result = await service.findFavoriteSongsRanking({});

      expect(result).toEqual([]);
      expect(prisma.song.findMany).not.toHaveBeenCalled();
    });

    it('counts fans per song, ordered by count DESC', async () => {
      prisma.fanProfileFavoriteSong.groupBy.mockResolvedValue([
        groupRow(songA.id, 3),
        groupRow(songB.id, 7),
      ]);
      prisma.song.findMany.mockResolvedValue([songA, songB]);

      const result = await service.findFavoriteSongsRanking({});

      expect(result).toEqual([
        { songId: songB.id, title: songB.title, albumTitle: songB.albumTitle, count: 7 },
        { songId: songA.id, title: songA.title, albumTitle: songA.albumTitle, count: 3 },
      ]);
    });

    // Desempate: count DESC, title ASC.
    it('breaks a count tie by title ASC', async () => {
      prisma.fanProfileFavoriteSong.groupBy.mockResolvedValue([
        groupRow(songB.id, 5), // "Choke"
        groupRow(songA.id, 5), // "Automatic Sun"
      ]);
      prisma.song.findMany.mockResolvedValue([songB, songA]);

      const result = await service.findFavoriteSongsRanking({});

      expect(result.map((row) => row.songId)).toEqual([songA.id, songB.id]);
    });

    it('scopes the ranking worldwide (no filters) to fans with showOnMap=true', async () => {
      await service.findFavoriteSongsRanking({});

      expect(prisma.fanProfileFavoriteSong.groupBy).toHaveBeenCalledWith({
        by: ['songId'],
        where: { fanProfile: { showOnMap: true } },
        _count: { songId: true },
      });
    });

    it('scopes the ranking by countryId when given', async () => {
      await service.findFavoriteSongsRanking({ countryId: 'country-1' });

      expect(prisma.fanProfileFavoriteSong.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            fanProfile: { showOnMap: true, city: { countryId: 'country-1' } },
          },
        }),
      );
    });

    it('scopes the ranking by cityId when given', async () => {
      await service.findFavoriteSongsRanking({ cityId: 'city-1' });

      expect(prisma.fanProfileFavoriteSong.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fanProfile: { showOnMap: true, cityId: 'city-1' } },
        }),
      );
    });

    it('prefers cityId over countryId when both are given', async () => {
      await service.findFavoriteSongsRanking({ countryId: 'country-1', cityId: 'city-1' });

      expect(prisma.fanProfileFavoriteSong.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { fanProfile: { showOnMap: true, cityId: 'city-1' } },
        }),
      );
    });

    // Requisito central: el ranking sale exclusivamente de
    // FanProfileFavoriteSong — nunca de FanProfileSetlistSong.
    it('never reads from the setlist table', async () => {
      await service.findFavoriteSongsRanking({});

      expect(prisma.fanProfileFavoriteSong.groupBy).toHaveBeenCalled();
      // El único mock de "song list" del setlist es prisma.song.findMany,
      // que acá se usa solo para resolver título/álbum de lo agrupado — no
      // hay ningún acceso a fanProfileSetlistSong en todo el mock de
      // PrismaService (ni siquiera está definido), así que si el service
      // alguna vez lo tocara, esto explotaría con un TypeError.
      expect(prisma).not.toHaveProperty('fanProfileSetlistSong');
    });
  });
});
