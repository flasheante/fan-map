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
    fanProfile: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    fanProfile: { update: jest.Mock };
    fanArtist: { deleteMany: jest.Mock; createMany: jest.Mock };
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

  const createdFanProfile = {
    id: 'profile-1',
    userId,
    cityId: 'city-1',
    displayName: 'Fan Name',
    showOnMap: false,
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
  };

  // city-2 tiene coordenadas nulas: representa una ciudad sin geocodificar.
  const secondFanProfile = {
    id: 'profile-2',
    userId: 'user-2',
    cityId: 'city-2',
    displayName: 'Second Fan',
    showOnMap: true,
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
    artists: [],
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
    };

    prisma = {
      city: { findUnique: jest.fn().mockResolvedValue(city) },
      artist: {
        findMany: jest.fn().mockResolvedValue([artistA]),
      },
      fanProfile: {
        findUnique: jest.fn().mockResolvedValue(createdFanProfile),
        findMany: jest
          .fn()
          .mockResolvedValue([createdFanProfile, secondFanProfile]),
        create: jest.fn().mockResolvedValue(createdFanProfile),
        update: jest.fn().mockResolvedValue(createdFanProfile),
      },
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

    // Case 2 & 3 (Etapa 2): crea el FanProfile para el User autenticado, sin
    // crear ningún User — esa responsabilidad es de Auth.
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
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
    });

    // Case 4: POST /fan-profiles ya no crea/upsertea ningún User. El mock de
    // PrismaService no tiene `user` en absoluto: si el service intentara
    // llamar a `this.prisma.user.findUnique/create/upsert`, esto explotaría
    // con un TypeError en vez de resolver.
    it('does not create or look up a User', async () => {
      expect(prisma).not.toHaveProperty('user');

      await expect(service.create(userId, dto)).resolves.toBeDefined();
    });

    // Case 3: showOnMap por defecto es false.
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

    // Case 4 & 10: la respuesta no incluye email/userId, e incluye city y country.
    it('returns a response without email or userId, including city and country', async () => {
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
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
    });

    // Case 5: cityId inexistente devuelve 400.
    it('throws BadRequestException when the city does not exist', async () => {
      prisma.city.findUnique.mockResolvedValue(null);

      await expect(service.create(userId, dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.fanProfile.create).not.toHaveBeenCalled();
    });

    // Case 3 (Etapa 2): el User autenticado ya tiene un FanProfile → 409.
    // Reemplaza el viejo chequeo de email duplicado (ya no aplica: el email
    // no participa en la creación).
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

      it('creates no FanArtist rows when artistIds is an empty array', async () => {
        await service.create(userId, { ...dto, artistIds: [] });

        expect(prisma.artist.findMany).not.toHaveBeenCalled();
        expect(prisma.fanProfile.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ artists: { create: [] } }),
          }),
        );
      });

      it('deduplicates repeated artistIds before validating and creating', async () => {
        prisma.artist.findMany.mockResolvedValue([artistA]);

        await service.create(userId, {
          ...dto,
          artistIds: [artistA.id, artistA.id],
        });

        expect(prisma.artist.findMany).toHaveBeenCalledWith({
          where: { id: { in: [artistA.id] } },
          select: { id: true },
        });
        expect(prisma.fanProfile.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              artists: { create: [{ artistId: artistA.id }] },
            }),
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
    // Caso exitoso: devuelve el perfil sin email/userId, incluyendo city, country y artists.
    it('returns a response without email or userId, including city, country and artists', async () => {
      const result = await service.findOne(createdFanProfile.id);

      expect(prisma.fanProfile.findUnique).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
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
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
    });

    it('returns an empty artists array for a fan profile that follows no artists', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(secondFanProfile);

      const result = await service.findOne(secondFanProfile.id);

      expect(result.artists).toEqual([]);
    });

    // Caso: FanProfile inexistente devuelve 404.
    it('throws NotFoundException when the fan profile does not exist', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // Etapa 3: GET /fan-profiles/me — resuelve el FanProfile del User
  // autenticado (request.user.id), no de un :id de la URL. Ver justificación
  // en el informe: no había forma de obtener esto con los endpoints
  // existentes sin exponer userId como filtro público.
  describe('findMine', () => {
    it('looks up the fan profile by userId and returns it without email or userId', async () => {
      const result = await service.findMine(userId);

      expect(prisma.fanProfile.findUnique).toHaveBeenCalledWith({
        where: { userId },
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
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
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
    });

    it('throws NotFoundException when the authenticated user has no fan profile', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(null);

      await expect(service.findMine(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    // Caso 2: actualiza solamente los campos enviados.
    it('updates only the provided fields when artistIds is not sent', async () => {
      await service.update(createdFanProfile.id, userId, { displayName: 'New Name' });

      expect(prisma.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: { displayName: 'New Name' },
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    // Caso 3: puede actualizar displayName.
    it('updates displayName', async () => {
      const updated = { ...createdFanProfile, displayName: 'New Name' };
      prisma.fanProfile.update.mockResolvedValue(updated);

      const result = await service.update(createdFanProfile.id, userId, {
        displayName: 'New Name',
      });

      expect(result.displayName).toBe('New Name');
    });

    // Caso 4: puede actualizar cityId.
    it('updates cityId after validating the city exists', async () => {
      const newCity = {
        id: 'city-2',
        name: 'Cordoba',
        countryId: 'country-1',
      };
      prisma.city.findUnique.mockResolvedValue(newCity);

      await service.update(createdFanProfile.id, userId, { cityId: 'city-2' });

      expect(prisma.city.findUnique).toHaveBeenCalledWith({
        where: { id: 'city-2' },
      });
      expect(prisma.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: { cityId: 'city-2' },
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
    });

    // Caso 5: puede actualizar showOnMap.
    it('updates showOnMap', async () => {
      await service.update(createdFanProfile.id, userId, { showOnMap: true });

      expect(prisma.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: { showOnMap: true },
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
    });

    // Caso: puede actualizar varios campos a la vez.
    it('updates multiple fields at once', async () => {
      await service.update(createdFanProfile.id, userId, {
        displayName: 'New Name',
        showOnMap: true,
      });

      expect(prisma.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: { displayName: 'New Name', showOnMap: true },
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
    });

    // Caso 6: cityId inexistente devuelve 400.
    it('throws BadRequestException when the new cityId does not reference an existing city', async () => {
      prisma.city.findUnique.mockResolvedValue(null);

      await expect(
        service.update(createdFanProfile.id, userId, { cityId: 'missing-city' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.fanProfile.update).not.toHaveBeenCalled();
    });

    // Caso 7: FanProfile inexistente devuelve 404.
    it('throws NotFoundException when the fan profile does not exist', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing-id', userId, { displayName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.fanProfile.update).not.toHaveBeenCalled();
    });

    // Etapa 4 — hallazgo crítico de la auditoría: PATCH no verificaba
    // ownership. userId viene de request.user.id (ver controller); si no
    // coincide con el dueño del FanProfile, 403 y ni siquiera se valida
    // cityId/artistIds (fail fast, sin filtrar info a quien no es dueño).
    it('throws ForbiddenException when the authenticated user does not own the fan profile', async () => {
      await expect(
        service.update(createdFanProfile.id, 'someone-else', {
          displayName: 'Hijacked Name',
          cityId: 'city-2',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.fanProfile.update).not.toHaveBeenCalled();
      // Fail fast: ni siquiera llega a validar el cityId enviado.
      expect(prisma.city.findUnique).not.toHaveBeenCalled();
    });

    // Caso 12 & 13: la respuesta mantiene el shape de GET, sin email ni userId.
    it('returns a response without email or userId, including city, country and artists', async () => {
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
      expect(tx.fanArtist.createMany).not.toHaveBeenCalled();
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
      expect(tx.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: {},
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
    });

    it('clears all associations when artistIds is an empty array', async () => {
      await service.update(createdFanProfile.id, userId, { artistIds: [] });

      expect(prisma.artist.findMany).not.toHaveBeenCalled();
      expect(tx.fanArtist.deleteMany).toHaveBeenCalledWith({
        where: { fanProfileId: createdFanProfile.id },
      });
      expect(tx.fanArtist.createMany).not.toHaveBeenCalled();
    });

    it('deduplicates repeated artistIds before validating and replacing', async () => {
      prisma.artist.findMany.mockResolvedValue([artistB]);

      await service.update(createdFanProfile.id, userId, {
        artistIds: [artistB.id, artistB.id],
      });

      expect(prisma.artist.findMany).toHaveBeenCalledWith({
        where: { id: { in: [artistB.id] } },
        select: { id: true },
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
  });

  describe('findAll', () => {
    // Sin filtro: devuelve todos los perfiles.
    it('returns all fan profiles when no filter is provided', async () => {
      const result = await service.findAll({});

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
      expect(result).toHaveLength(2);
    });

    // onMap=true: filtra showOnMap=true Y ciudad con coordenadas no nulas.
    it('filters by showOnMap=true and non-null city coordinates when onMap is "true"', async () => {
      await service.findAll({ onMap: 'true' });

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: {
          showOnMap: true,
          city: { latitude: { not: null }, longitude: { not: null } },
        },
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
    });

    // onMap=false: filtra showOnMap=false, sin agregar filtros de coordenadas.
    it('filters by showOnMap=false without adding coordinate filters when onMap is "false"', async () => {
      await service.findAll({ onMap: 'false' });

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: { showOnMap: false },
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
    });

    // sin onMap: no agrega filtros de coordenadas.
    it('does not add coordinate filters when onMap is not provided', async () => {
      await service.findAll({});

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: {},
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
    });

    // onMap=true: un perfil visible cuya ciudad no tiene coordenadas no debe
    // aparecer (el filtro se resuelve en la base, simulado acá vía el mock).
    it('excludes a visible profile without coordinates from the onMap=true result', async () => {
      prisma.fanProfile.findMany.mockResolvedValue([]);

      const result = await service.findAll({ onMap: 'true' });

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: {
          showOnMap: true,
          city: { latitude: { not: null }, longitude: { not: null } },
        },
        include: {
          city: { include: { country: true } },
          artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
        },
      });
      expect(result).toEqual([]);
    });

    // onMap=true: un perfil visible cuya ciudad sí tiene coordenadas aparece.
    it('includes a visible profile with coordinates in the onMap=true result', async () => {
      const visibleWithCoords = {
        ...createdFanProfile,
        showOnMap: true,
        city: createdFanProfile.city,
      };
      prisma.fanProfile.findMany.mockResolvedValue([visibleWithCoords]);

      const result = await service.findAll({ onMap: 'true' });

      expect(result).toEqual([
        {
          id: visibleWithCoords.id,
          displayName: visibleWithCoords.displayName,
          showOnMap: true,
          createdAt: visibleWithCoords.createdAt,
          updatedAt: visibleWithCoords.updatedAt,
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
        },
      ]);
    });

    // Mapea correctamente city/country/artists para cada perfil.
    it('maps city, country and artists correctly for each profile', async () => {
      const result = await service.findAll({});

      expect(result).toEqual([
        {
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
        },
        {
          id: secondFanProfile.id,
          displayName: secondFanProfile.displayName,
          showOnMap: secondFanProfile.showOnMap,
          createdAt: secondFanProfile.createdAt,
          updatedAt: secondFanProfile.updatedAt,
          city: {
            id: secondFanProfile.city.id,
            name: secondFanProfile.city.name,
            latitude: secondFanProfile.city.latitude,
            longitude: secondFanProfile.city.longitude,
            country: { id: 'country-1', name: 'Argentina', code: 'AR' },
          },
          artists: [],
        },
      ]);
    });

    // Nunca expone email ni userId.
    it('never exposes email or userId', async () => {
      const result = await service.findAll({});

      result.forEach((profile) => {
        expect(profile).not.toHaveProperty('email');
        expect(profile).not.toHaveProperty('userId');
      });
    });
  });
});
