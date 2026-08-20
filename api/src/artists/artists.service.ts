import { Injectable, NotFoundException } from '@nestjs/common';
import { Artist } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

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
