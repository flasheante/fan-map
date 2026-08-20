import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { City, Country, FanProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateFanProfileDto } from './dto/create-fan-profile.dto';
import { UpdateFanProfileDto } from './dto/update-fan-profile.dto';
import { FindFanProfilesQueryDto } from './dto/find-fan-profiles-query.dto';

type FanProfileWithLocation = FanProfile & { city: City & { country: Country } };

@Injectable()
export class FanProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateFanProfileDto) {
    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });
    if (!city) {
      throw new BadRequestException(`City ${dto.cityId} not found`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException(`Email ${dto.email} is already in use`);
    }

    const fanProfile = (await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: dto.email } });

      return tx.fanProfile.create({
        data: {
          userId: user.id,
          cityId: dto.cityId,
          displayName: dto.displayName,
          showOnMap: dto.showOnMap ?? false,
        },
        include: { city: { include: { country: true } } },
      });
    })) as FanProfileWithLocation;

    return toFanProfileResponse(fanProfile);
  }

  async findAll(query: FindFanProfilesQueryDto) {
    const where: Prisma.FanProfileWhereInput = {};
    if (query.onMap !== undefined) {
      const onMap = query.onMap === 'true';
      where.showOnMap = onMap;
      if (onMap) {
        where.city = {
          latitude: { not: null },
          longitude: { not: null },
        };
      }
    }

    const fanProfiles = (await this.prisma.fanProfile.findMany({
      where,
      include: { city: { include: { country: true } } },
    })) as FanProfileWithLocation[];

    return fanProfiles.map(toFanProfileResponse);
  }

  async findOne(id: string) {
    const fanProfile = (await this.prisma.fanProfile.findUnique({
      where: { id },
      include: { city: { include: { country: true } } },
    })) as FanProfileWithLocation | null;

    if (!fanProfile) {
      throw new NotFoundException(`FanProfile ${id} not found`);
    }

    return toFanProfileResponse(fanProfile);
  }

  async update(id: string, dto: UpdateFanProfileDto) {
    const existing = await this.prisma.fanProfile.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`FanProfile ${id} not found`);
    }

    if (dto.cityId !== undefined) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
      });
      if (!city) {
        throw new BadRequestException(`City ${dto.cityId} not found`);
      }
    }

    const data: Prisma.FanProfileUncheckedUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.cityId !== undefined) data.cityId = dto.cityId;
    if (dto.showOnMap !== undefined) data.showOnMap = dto.showOnMap;

    const fanProfile = (await this.prisma.fanProfile.update({
      where: { id },
      data,
      include: { city: { include: { country: true } } },
    })) as FanProfileWithLocation;

    return toFanProfileResponse(fanProfile);
  }
}

function toFanProfileResponse(fanProfile: FanProfileWithLocation) {
  return {
    id: fanProfile.id,
    displayName: fanProfile.displayName,
    showOnMap: fanProfile.showOnMap,
    createdAt: fanProfile.createdAt,
    updatedAt: fanProfile.updatedAt,
    city: {
      id: fanProfile.city.id,
      name: fanProfile.city.name,
      latitude: fanProfile.city.latitude,
      longitude: fanProfile.city.longitude,
      country: {
        id: fanProfile.city.country.id,
        name: fanProfile.city.country.name,
        code: fanProfile.city.country.code,
      },
    },
  };
}
