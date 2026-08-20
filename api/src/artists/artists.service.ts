import { Injectable, NotFoundException } from '@nestjs/common';
import { Artist, City, Country, FanProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { FindArtistFansQueryDto } from './dto/find-artist-fans-query.dto';

type FanProfileWithCity = FanProfile & { city: City & { country: Country } };

@Injectable()
export class ArtistsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const artists = await this.prisma.artist.findMany({
      orderBy: { name: 'asc' },
    });

    return artists.map(toArtistResponse);
  }

  async findOne(id: string) {
    const artist = await this.prisma.artist.findUnique({ where: { id } });

    if (!artist) {
      throw new NotFoundException(`Artist ${id} not found`);
    }

    return toArtistResponse(artist);
  }

  // Fans de un artista visibles en el mapa: asociados vía FanArtist al
  // artista indicado. El filtro onMap sigue la misma semántica que
  // FanProfilesService.findAll (showOnMap + ciudad con coordenadas).
  async findFans(artistId: string, query: FindArtistFansQueryDto) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
    });
    if (!artist) {
      throw new NotFoundException(`Artist ${artistId} not found`);
    }

    const where: Prisma.FanProfileWhereInput = {
      artists: { some: { artistId } },
    };
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

    const fans = (await this.prisma.fanProfile.findMany({
      where,
      include: { city: { include: { country: true } } },
      orderBy: { displayName: 'asc' },
    })) as FanProfileWithCity[];

    return {
      artist: toArtistResponse(artist),
      fans: fans.map(toArtistFanResponse),
    };
  }
}

function toArtistResponse(artist: Artist) {
  return {
    id: artist.id,
    name: artist.name,
    slug: artist.slug,
    imageUrl: artist.imageUrl,
    createdAt: artist.createdAt,
    updatedAt: artist.updatedAt,
  };
}

function toArtistFanResponse(fanProfile: FanProfileWithCity) {
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
