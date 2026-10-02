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

  // Each city carries its region (province/state) so the client can build
  // the region picker and filter cities by it without another request.
  // region is null for cities without one (see City.regionId).
  async findCitiesByCountryId(countryId: string) {
    const country = await this.prisma.country.findUnique({
      where: { id: countryId },
    });

    if (!country) {
      throw new NotFoundException(`Country ${countryId} not found`);
    }

    return this.prisma.city.findMany({
      where: { countryId },
      include: { region: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
  }
}
