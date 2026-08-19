import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAllCountries() {
    return this.prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findCitiesByCountryId(countryId: string) {
    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
    });

    if (!country) {
      throw new NotFoundException(`Country ${countryId} not found`);
    }

    return this.prisma.city.findMany({
      where: { countryId },
      orderBy: { name: 'asc' },
    });
  }
}
