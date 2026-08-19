import { Test, TestingModule } from '@nestjs/testing';
import { CountriesController } from './countries.controller';
import { LocationsService } from './locations.service';

describe('CountriesController', () => {
  let controller: CountriesController;
  let service: { findAllCountries: jest.Mock };

  beforeEach(async () => {
    service = {
      findAllCountries: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CountriesController],
      providers: [{ provide: LocationsService, useValue: service }],
    }).compile();

    controller = module.get<CountriesController>(CountriesController);
  });

  it('returns the countries from the service', async () => {
    const countries = [
      { id: '1', name: 'Argentina', code: 'AR' },
      { id: '2', name: 'Brazil', code: 'BR' },
    ];
    service.findAllCountries.mockResolvedValue(countries);

    const result = await controller.findAll();

    expect(service.findAllCountries).toHaveBeenCalled();
    expect(result).toBe(countries);
  });
});
