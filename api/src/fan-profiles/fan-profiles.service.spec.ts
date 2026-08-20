import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { FanProfilesService } from './fan-profiles.service';
import { PrismaService } from '../database/prisma.service';

describe('FanProfilesService', () => {
  let service: FanProfilesService;
  let prisma: {
    city: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    fanProfile: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    user: { create: jest.Mock };
    fanProfile: { create: jest.Mock };
  };

  const dto = {
    email: 'fan@example.com',
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
  const createdUser = { id: 'user-1', email: dto.email };
  const createdFanProfile = {
    id: 'profile-1',
    userId: 'user-1',
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
  };

  beforeEach(async () => {
    tx = {
      user: { create: jest.fn().mockResolvedValue(createdUser) },
      fanProfile: { create: jest.fn().mockResolvedValue(createdFanProfile) },
    };

    prisma = {
      city: { findUnique: jest.fn().mockResolvedValue(city) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      fanProfile: {
        findUnique: jest.fn().mockResolvedValue(createdFanProfile),
        findMany: jest
          .fn()
          .mockResolvedValue([createdFanProfile, secondFanProfile]),
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

  // Case 2: Crea User y FanProfile.
  it('creates the User and the FanProfile inside a transaction', async () => {
    await service.create(dto);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.user.create).toHaveBeenCalledWith({
      data: { email: dto.email },
    });
    expect(tx.fanProfile.create).toHaveBeenCalledWith({
      data: {
        userId: createdUser.id,
        cityId: dto.cityId,
        displayName: dto.displayName,
        showOnMap: false,
      },
      include: { city: { include: { country: true } } },
    });
  });

  // Case 3: showOnMap por defecto es false.
  it('defaults showOnMap to false when not provided', async () => {
    await service.create(dto);

    expect(tx.fanProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ showOnMap: false }),
      }),
    );
  });

  it('uses the provided showOnMap value when given', async () => {
    await service.create({ ...dto, showOnMap: true });

    expect(tx.fanProfile.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ showOnMap: true }),
      }),
    );
  });

  // Case 4 & 10: la respuesta no incluye email/userId, e incluye city y country.
  it('returns a response without email or userId, including city and country', async () => {
    const result = await service.create(dto);

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
    });
    expect(result).not.toHaveProperty('userId');
    expect(result).not.toHaveProperty('email');
  });

  // Case 5: cityId inexistente devuelve 400.
  it('throws BadRequestException when the city does not exist', async () => {
    prisma.city.findUnique.mockResolvedValue(null);

    await expect(service.create(dto)).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Case 6: email duplicado devuelve 409.
  it('throws ConflictException when the email is already in use', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing', ...dto });

    await expect(service.create(dto)).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  describe('findOne', () => {
    // Caso exitoso: devuelve el perfil sin email/userId, incluyendo city y country.
    it('returns a response without email or userId, including city and country', async () => {
      const result = await service.findOne(createdFanProfile.id);

      expect(prisma.fanProfile.findUnique).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        include: { city: { include: { country: true } } },
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
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
    });

    // Caso: FanProfile inexistente devuelve 404.
    it('throws NotFoundException when the fan profile does not exist', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    // Caso 2: actualiza solamente los campos enviados.
    it('updates only the provided fields', async () => {
      await service.update(createdFanProfile.id, { displayName: 'New Name' });

      expect(prisma.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: { displayName: 'New Name' },
        include: { city: { include: { country: true } } },
      });
    });

    // Caso 3: puede actualizar displayName.
    it('updates displayName', async () => {
      const updated = { ...createdFanProfile, displayName: 'New Name' };
      prisma.fanProfile.update.mockResolvedValue(updated);

      const result = await service.update(createdFanProfile.id, {
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

      await service.update(createdFanProfile.id, { cityId: 'city-2' });

      expect(prisma.city.findUnique).toHaveBeenCalledWith({
        where: { id: 'city-2' },
      });
      expect(prisma.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: { cityId: 'city-2' },
        include: { city: { include: { country: true } } },
      });
    });

    // Caso 5: puede actualizar showOnMap.
    it('updates showOnMap', async () => {
      await service.update(createdFanProfile.id, { showOnMap: true });

      expect(prisma.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: { showOnMap: true },
        include: { city: { include: { country: true } } },
      });
    });

    // Caso: puede actualizar varios campos a la vez.
    it('updates multiple fields at once', async () => {
      await service.update(createdFanProfile.id, {
        displayName: 'New Name',
        showOnMap: true,
      });

      expect(prisma.fanProfile.update).toHaveBeenCalledWith({
        where: { id: createdFanProfile.id },
        data: { displayName: 'New Name', showOnMap: true },
        include: { city: { include: { country: true } } },
      });
    });

    // Caso 6: cityId inexistente devuelve 400.
    it('throws BadRequestException when the new cityId does not reference an existing city', async () => {
      prisma.city.findUnique.mockResolvedValue(null);

      await expect(
        service.update(createdFanProfile.id, { cityId: 'missing-city' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.fanProfile.update).not.toHaveBeenCalled();
    });

    // Caso 7: FanProfile inexistente devuelve 404.
    it('throws NotFoundException when the fan profile does not exist', async () => {
      prisma.fanProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { displayName: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.fanProfile.update).not.toHaveBeenCalled();
    });

    // Caso 12 & 13: la respuesta mantiene el shape de GET, sin email ni userId.
    it('returns a response without email or userId, including city and country', async () => {
      const result = await service.update(createdFanProfile.id, {
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
      });
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('email');
    });
  });

  describe('findAll', () => {
    // Sin filtro: devuelve todos los perfiles.
    it('returns all fan profiles when no filter is provided', async () => {
      const result = await service.findAll({});

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: {},
        include: { city: { include: { country: true } } },
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
        include: { city: { include: { country: true } } },
      });
    });

    // onMap=false: filtra showOnMap=false, sin agregar filtros de coordenadas.
    it('filters by showOnMap=false without adding coordinate filters when onMap is "false"', async () => {
      await service.findAll({ onMap: 'false' });

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: { showOnMap: false },
        include: { city: { include: { country: true } } },
      });
    });

    // sin onMap: no agrega filtros de coordenadas.
    it('does not add coordinate filters when onMap is not provided', async () => {
      await service.findAll({});

      expect(prisma.fanProfile.findMany).toHaveBeenCalledWith({
        where: {},
        include: { city: { include: { country: true } } },
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
        include: { city: { include: { country: true } } },
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
        },
      ]);
    });

    // Mapea correctamente city/country para cada perfil.
    it('maps city and country correctly for each profile', async () => {
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
