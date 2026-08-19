import { Controller, Get } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('countries')
export class CountriesController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll() {
    return this.locationsService.findAllCountries();
  }
}
