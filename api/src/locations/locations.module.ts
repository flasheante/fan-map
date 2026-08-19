import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CountriesController } from './countries.controller';
import { CitiesController } from './cities.controller';

@Module({
  controllers: [CountriesController, CitiesController],
  providers: [LocationsService],
})
export class LocationsModule {}
