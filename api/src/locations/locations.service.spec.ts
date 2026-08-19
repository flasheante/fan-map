import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { PrismaService } from '../database/prisma.service';

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: {
    country: { findMany: jest.Mock; findUnique: jest.Mock };
    city: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      country: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      city: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  describe('findAllCountries', () => {
    it('returns countries ordered by name ascending', async () => {
      const countries = [
        { id: '1', name: 'Argentina', code: 'AR' },
        { id: '2', name: 'Brazil', code: 'BR' },
      ];
      prisma.country.findMany.mockResolvedValue(countries);

      const result = await service.findAllCountries();

      expect(prisma.country.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
      });
      expect(result).toBe(countries);
    });
  });

  describe('findCitiesByCountryId', () => {
    it('returns cities ordered by name ascending when the country exists', async () => {
      const country = { id: 'country-1', name: 'Argentina', code: 'AR' };
      const cities = [
        { id: 'c1', name: 'Buenos Aires', countryId: 'country-1' },
        { id: 'c2', name: 'Rosario', countryId: 'country-1' },
      ];
      prisma.country.findUnique.mockResolvedValue(country);
      prisma.city.findMany.mockResolvedValue(cities);

      const result = await service.findCitiesByCountryId('country-1');

      expect(prisma.country.findUnique).toHaveBeenCalledWith({
        where: { id: 'country-1' },
      });
      expect(prisma.city.findMany).toHaveBeenCalledWith({
        where: { countryId: 'country-1' },
        orderBy: { name: 'asc' },
      });
      expect(result).toBe(cities);
    });

    it('throws NotFoundException when the country does not exist', async () => {
      prisma.country.findUnique.mockResolvedValue(null);

      await expect(
        service.findCitiesByCountryId('missing-country'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.city.findMany).not.toHaveBeenCalled();
    });
  });
});
