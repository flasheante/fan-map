import { Injectable, NotFoundException } from '@nestjs/common';
import { Artist, City, Country, FanProfile, Prisma, Song } from '@prisma/client';
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

  // Estadísticas agregadas de un artista: fans/países/ciudades vienen de los
  // FanProfiles asociados vía FanArtist (misma relación que findFans, sin el
  // filtro onMap); shows y songs vienen de los Show del artista y las
  // SetlistSong de sus Setlists. País y ciudad se deduplican por id, canción
  // por título (no hay catálogo de Song todavía, ver schema.prisma).
  async findStats(artistId: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
    });
    if (!artist) {
      throw new NotFoundException(`Artist ${artistId} not found`);
    }

    const [fans, showsCount, songs] = await Promise.all([
      this.prisma.fanProfile.findMany({
        where: { artists: { some: { artistId } } },
        select: { city: { select: { id: true, countryId: true } } },
      }),
      this.prisma.show.count({ where: { artistId } }),
      this.prisma.setlistSong.findMany({
        where: { setlist: { show: { artistId } } },
        select: { title: true },
      }),
    ]);

    const cityIds = new Set(fans.map((fan) => fan.city.id));
    const countryIds = new Set(fans.map((fan) => fan.city.countryId));
    const songTitles = new Set(songs.map((song) => song.title));

    return {
      fans: fans.length,
      countries: countryIds.size,
      cities: cityIds.size,
      shows: showsCount,
      songs: songTitles.size,
    };
  }

  // Canciones más tocadas de un artista: agrupa las SetlistSong de sus shows
  // por title exacto (no hay catálogo de Song todavía, ver findStats) y
  // cuenta apariciones con una agregación de Prisma. Orden determinista:
  // timesPlayed desc y, en empate, title asc.
  async findTopSongs(artistId: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
    });
    if (!artist) {
      throw new NotFoundException(`Artist ${artistId} not found`);
    }

    const grouped = await this.prisma.setlistSong.groupBy({
      by: ['title'],
      where: { setlist: { show: { artistId } } },
      _count: { title: true },
      orderBy: [{ _count: { title: 'desc' } }, { title: 'asc' }],
    });

    return grouped.map((row) => ({
      title: row.title,
      timesPlayed: row._count.title,
    }));
  }

  // Catálogo canónico de canciones del artista (sincronizado desde
  // MusicBrainz, ver src/songs/musicbrainz-sync.service.ts) — no el
  // ranking de canciones tocadas en vivo (eso es findTopSongs, sobre
  // SetlistSong). Público y de solo lectura: es la fuente para que el
  // frontend arme el picker de favoritas del perfil de fan (ver el
  // pedido: "buscar canciones"), sin exponer nada privado.
  async findSongs(artistId: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
    });
    if (!artist) {
      throw new NotFoundException(`Artist ${artistId} not found`);
    }

    const songs = await this.prisma.song.findMany({
      where: { artistId },
      orderBy: { title: 'asc' },
    });

    return songs.map(toArtistSongResponse);
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

function toArtistSongResponse(song: Song) {
  return {
    id: song.id,
    title: song.title,
    albumTitle: song.albumTitle,
    releaseDate: song.releaseDate,
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
