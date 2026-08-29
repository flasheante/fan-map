import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Artist, City, Country, FanArtist, FanProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateFanProfileDto } from './dto/create-fan-profile.dto';
import { UpdateFanProfileDto } from './dto/update-fan-profile.dto';
import { FindFanProfilesQueryDto } from './dto/find-fan-profiles-query.dto';

type FanProfileWithRelations = FanProfile & {
  city: City & { country: Country };
  artists: (FanArtist & { artist: Artist })[];
};

const FAN_PROFILE_INCLUDE = {
  city: { include: { country: true } },
  artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
} satisfies Prisma.FanProfileInclude;

@Injectable()
export class FanProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  // El User asociado ya existe: lo garantiza SessionAuthGuard (userId viene
  // de request.user.id, resuelto de una sesión válida) — ver
  // FanProfilesController#create. Esta capa no crea ni busca User por
  // email; esa responsabilidad es de Auth (AuthService#findOrCreateFromGoogle).
  async create(userId: string, dto: CreateFanProfileDto) {
    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });
    if (!city) {
      throw new BadRequestException(`City ${dto.cityId} not found`);
    }

    const existingProfile = await this.prisma.fanProfile.findUnique({
      where: { userId },
    });
    if (existingProfile) {
      throw new ConflictException('User already has a fan profile');
    }

    const artistIds = dto.artistIds ? Array.from(new Set(dto.artistIds)) : [];
    await this.validateArtistsExist(artistIds);

    const fanProfile = (await this.prisma.fanProfile.create({
      data: {
        userId,
        cityId: dto.cityId,
        displayName: dto.displayName,
        showOnMap: dto.showOnMap ?? false,
        artists: {
          create: artistIds.map((artistId) => ({ artistId })),
        },
      },
      include: FAN_PROFILE_INCLUDE,
    })) as FanProfileWithRelations;

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
      include: FAN_PROFILE_INCLUDE,
    })) as FanProfileWithRelations[];

    return fanProfiles.map(toFanProfileResponse);
  }

  async findOne(id: string) {
    const fanProfile = (await this.prisma.fanProfile.findUnique({
      where: { id },
      include: FAN_PROFILE_INCLUDE,
    })) as FanProfileWithRelations | null;

    if (!fanProfile) {
      throw new NotFoundException(`FanProfile ${id} not found`);
    }

    return toFanProfileResponse(fanProfile);
  }

  // Etapa 3: soporte de GET /fan-profiles/me — el FanProfile del User
  // autenticado (request.user.id), nunca de un :id de la URL. userId es
  // @unique en el modelo, así que esto es un lookup 1:1 como findOne.
  async findMine(userId: string) {
    const fanProfile = (await this.prisma.fanProfile.findUnique({
      where: { userId },
      include: FAN_PROFILE_INCLUDE,
    })) as FanProfileWithRelations | null;

    if (!fanProfile) {
      throw new NotFoundException('Fan profile not found');
    }

    return toFanProfileResponse(fanProfile);
  }

  // Etapa 4 (hardening): antes cualquiera podía PATCHear cualquier
  // FanProfile por id, sin sesión ni ownership check. userId viene de
  // request.user.id (SessionAuthGuard, ver controller) y se valida ANTES
  // que cityId/artistIds — fail fast, sin filtrarle a quien no es dueño si
  // el resto del payload era válido.
  async update(id: string, userId: string, dto: UpdateFanProfileDto) {
    const existing = await this.prisma.fanProfile.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`FanProfile ${id} not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not own this fan profile');
    }

    if (dto.cityId !== undefined) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
      });
      if (!city) {
        throw new BadRequestException(`City ${dto.cityId} not found`);
      }
    }

    let artistIds: string[] | undefined;
    if (dto.artistIds !== undefined) {
      artistIds = Array.from(new Set(dto.artistIds));
      await this.validateArtistsExist(artistIds);
    }

    const data: Prisma.FanProfileUncheckedUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.cityId !== undefined) data.cityId = dto.cityId;
    if (dto.showOnMap !== undefined) data.showOnMap = dto.showOnMap;

    const fanProfile = (
      artistIds === undefined
        ? await this.prisma.fanProfile.update({
            where: { id },
            data,
            include: FAN_PROFILE_INCLUDE,
          })
        : await this.prisma.$transaction(async (tx) => {
            await tx.fanArtist.deleteMany({ where: { fanProfileId: id } });
            if (artistIds!.length > 0) {
              await tx.fanArtist.createMany({
                data: artistIds!.map((artistId) => ({
                  fanProfileId: id,
                  artistId,
                })),
              });
            }

            return tx.fanProfile.update({
              where: { id },
              data,
              include: FAN_PROFILE_INCLUDE,
            });
          })
    ) as FanProfileWithRelations;

    return toFanProfileResponse(fanProfile);
  }

  // Valida que todos los artistIds referencien artistas existentes. Genérico:
  // no asume ningún artista en particular (p. ej. The Warning) ni una
  // cantidad fija de artistas en el sistema.
  private async validateArtistsExist(artistIds: string[]) {
    if (artistIds.length === 0) return;

    const found = await this.prisma.artist.findMany({
      where: { id: { in: artistIds } },
      select: { id: true },
    });

    if (found.length !== artistIds.length) {
      const foundIds = new Set(found.map((artist) => artist.id));
      const missing = artistIds.filter((id) => !foundIds.has(id));
      throw new BadRequestException(
        `Artist(s) not found: ${missing.join(', ')}`,
      );
    }
  }
}

function toFanProfileResponse(fanProfile: FanProfileWithRelations) {
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
    artists: fanProfile.artists.map((fanArtist) => ({
      id: fanArtist.artist.id,
      name: fanArtist.artist.name,
      slug: fanArtist.artist.slug,
      imageUrl: fanArtist.artist.imageUrl,
    })),
  };
}
