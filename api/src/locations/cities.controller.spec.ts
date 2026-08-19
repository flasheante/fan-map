import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CitiesController } from './cities.controller';
import { LocationsService } from './locations.service';

describe('CitiesController', () => {
  let controller: CitiesController;
  let service: { findCitiesByCountryId: jest.Mock };

  beforeEach(async () => {
    service = {
      findCitiesByCountryId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CitiesController],
      providers: [{ provide: LocationsService, useValue: service }],
    }).compile();

    controller = module.get<CitiesController>(CitiesController);
  });

  it('returns the cities for the given country from the service', async () => {
    const cities = [
      { id: 'c1', name: 'Buenos Aires', countryId: 'country-1' },
      { id: 'c2', name: 'Rosario', countryId: 'country-1' },
    ];
    service.findCitiesByCountryId.mockResolvedValue(cities);

    const result = await controller.findByCountry('country-1');

    expect(service.findCitiesByCountryId).toHaveBeenCalledWith('country-1');
    expect(result).toBe(cities);
  });

  it('propagates the NotFoundException thrown by the service', async () => {
    service.findCitiesByCountryId.mockRejectedValue(
      new NotFoundException('Country not found'),
    );

    await expect(controller.findByCountry('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
