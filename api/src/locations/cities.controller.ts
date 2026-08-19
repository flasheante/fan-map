import { Controller, Get, Param } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('countries/:countryId/cities')
export class CitiesController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findByCountry(@Param('countryId') countryId: string) {
    return this.locationsService.findCitiesByCountryId(countryId);
  }
}
