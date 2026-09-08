import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Artist,
  City,
  Country,
  FanArtist,
  FanProfile,
  FanProfileFavoriteSong,
  FanProfileSetlistSong,
  Prisma,
  Song,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateFanProfileDto } from './dto/create-fan-profile.dto';
import {
  FavoriteSongInput,
  SetlistSongInput,
  UpdateFanProfileDto,
} from './dto/update-fan-profile.dto';
import { FindFanProfilesQueryDto } from './dto/find-fan-profiles-query.dto';
import { FindFavoriteSongsRankingQueryDto } from './dto/find-favorite-songs-ranking-query.dto';

type FanProfileWithRelations = FanProfile & {
  city: City & { country: Country };
  artists: (FanArtist & { artist: Artist })[];
  setlistSongs: (FanProfileSetlistSong & { song: Song })[];
  favoriteSongs: (FanProfileFavoriteSong & { song: Song })[];
  user: { googlePhotoUrl: string | null };
};

// `user` seleccionado explícitamente por campo — nunca `user: true` — para
// que un futuro campo agregado a User (ej. email ya vive ahí) no se filtre
// acá por accidente: solo googlePhotoUrl es candidato a la respuesta
// pública (ver toPublicFanProfileResponse/toOwnFanProfileResponse).
//
// setlistSongs y favoriteSongs son dos relaciones independientes (ver
// schema.prisma: FanProfileSetlistSong / FanProfileFavoriteSong) —
// position es siempre NOT NULL en ambas (nunca "en la lista pero sin
// puesto"), así que ordenar por position alcanza, sin desempate.
const FAN_PROFILE_INCLUDE = {
  city: { include: { country: true } },
  artists: { include: { artist: true }, orderBy: { artist: { name: 'asc' } } },
  setlistSongs: { include: { song: true }, orderBy: { position: 'asc' } },
  favoriteSongs: { include: { song: true }, orderBy: { position: 'asc' } },
  user: { select: { googlePhotoUrl: true } },
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

    return toOwnFanProfileResponse(fanProfile);
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

    return fanProfiles.map(toPublicFanProfileResponse);
  }

  // Vista pública (cualquiera puede pedir cualquier :id, sin sesión) — a
  // diferencia de findMine(), nunca expone una red social marcada como
  // privada. Ver toPublicFanProfileResponse.
  async findOne(id: string) {
    const fanProfile = (await this.prisma.fanProfile.findUnique({
      where: { id },
      include: FAN_PROFILE_INCLUDE,
    })) as FanProfileWithRelations | null;

    if (!fanProfile) {
      throw new NotFoundException(`FanProfile ${id} not found`);
    }

    return toPublicFanProfileResponse(fanProfile);
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

    return toOwnFanProfileResponse(fanProfile);
  }

  // Etapa 4 (hardening): antes cualquiera podía PATCHear cualquier
  // FanProfile por id, sin sesión ni ownership check. userId viene de
  // request.user.id (SessionAuthGuard, ver controller) y se valida ANTES
  // que cityId/artistIds/setlistSongs/favoriteSongs — fail fast, sin
  // filtrarle a quien no es dueño si el resto del payload era válido.
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

    // setlistSongs y favoriteSongs se validan y se reemplazan cada uno por
    // completo, de forma totalmente independiente — mandar uno nunca debe
    // tocar al otro. Ambos se validan ANTES de tocar la base (mismo
    // fail-fast que artistIds arriba).
    if (dto.setlistSongs !== undefined) {
      await this.validateSongEntries(dto.setlistSongs);
    }
    if (dto.favoriteSongs !== undefined) {
      await this.validateSongEntries(dto.favoriteSongs);
    }

    const data: Prisma.FanProfileUncheckedUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.cityId !== undefined) data.cityId = dto.cityId;
    if (dto.showOnMap !== undefined) data.showOnMap = dto.showOnMap;
    if (dto.instagramUrl !== undefined) data.instagramUrl = dto.instagramUrl;
    if (dto.instagramIsPublic !== undefined) data.instagramIsPublic = dto.instagramIsPublic;
    if (dto.tiktokUrl !== undefined) data.tiktokUrl = dto.tiktokUrl;
    if (dto.tiktokIsPublic !== undefined) data.tiktokIsPublic = dto.tiktokIsPublic;
    if (dto.xUrl !== undefined) data.xUrl = dto.xUrl;
    if (dto.xIsPublic !== undefined) data.xIsPublic = dto.xIsPublic;
    if (dto.youtubeUrl !== undefined) data.youtubeUrl = dto.youtubeUrl;
    if (dto.youtubeIsPublic !== undefined) data.youtubeIsPublic = dto.youtubeIsPublic;
    if (dto.facebookUrl !== undefined) data.facebookUrl = dto.facebookUrl;
    if (dto.facebookIsPublic !== undefined) data.facebookIsPublic = dto.facebookIsPublic;

    const needsTransaction =
      artistIds !== undefined ||
      dto.setlistSongs !== undefined ||
      dto.favoriteSongs !== undefined;

    const fanProfile = (
      !needsTransaction
        ? await this.prisma.fanProfile.update({
            where: { id },
            data,
            include: FAN_PROFILE_INCLUDE,
          })
        : await this.prisma.$transaction(async (tx) => {
            if (artistIds !== undefined) {
              await tx.fanArtist.deleteMany({ where: { fanProfileId: id } });
              if (artistIds.length > 0) {
                await tx.fanArtist.createMany({
                  data: artistIds.map((artistId) => ({
                    fanProfileId: id,
                    artistId,
                  })),
                });
              }
            }

            // Reemplazo completo del setlist, sin tocar favoriteSongs para
            // nada — ni siquiera se lee la tabla de favoritas acá.
            if (dto.setlistSongs !== undefined) {
              await tx.fanProfileSetlistSong.deleteMany({
                where: { fanProfileId: id },
              });
              if (dto.setlistSongs.length > 0) {
                await tx.fanProfileSetlistSong.createMany({
                  data: dto.setlistSongs.map((entry) => ({
                    fanProfileId: id,
                    songId: entry.songId,
                    position: entry.position,
                  })),
                });
              }
            }

            // Reemplazo completo del Top 10, sin tocar setlistSongs para
            // nada — misma independencia que arriba, en el otro sentido.
            if (dto.favoriteSongs !== undefined) {
              await tx.fanProfileFavoriteSong.deleteMany({
                where: { fanProfileId: id },
              });
              if (dto.favoriteSongs.length > 0) {
                await tx.fanProfileFavoriteSong.createMany({
                  data: dto.favoriteSongs.map((entry) => ({
                    fanProfileId: id,
                    songId: entry.songId,
                    position: entry.position,
                  })),
                });
              }
            }

            return tx.fanProfile.update({
              where: { id },
              data,
              include: FAN_PROFILE_INCLUDE,
            });
          })
    ) as FanProfileWithRelations;

    return toOwnFanProfileResponse(fanProfile);
  }

  // Rankings del Fan Map: cuántos fans (con showOnMap=true, mismo alcance
  // que ya usa el resto del Fan Map — un fan que se ocultó del mapa no
  // debería influir en un ranking público que es parte de esa misma
  // experiencia) tienen cada canción en su Top 10. Exclusivamente
  // FanProfileFavoriteSong — el setlist personal nunca participa acá (ver
  // el pedido). Sin countryId/cityId: ranking mundial. Con cityId: ese
  // gana sobre countryId si ambos vinieran juntos (no debería pasar desde
  // la UI, que ofrece mundial/país/ciudad como mutuamente excluyentes).
  //
  // Primera versión: la posición dentro del Top 10 no pondera (un #1 y un
  // #10 valen lo mismo), tal como pide el pedido — es simplemente "cuántos
  // fans la tienen en su Top 10", no una suma ponderada por puesto.
  async findFavoriteSongsRanking(query: FindFavoriteSongsRankingQueryDto) {
    const where: Prisma.FanProfileFavoriteSongWhereInput = {
      fanProfile: {
        showOnMap: true,
        ...(query.cityId
          ? { cityId: query.cityId }
          : query.countryId
            ? { city: { countryId: query.countryId } }
            : {}),
      },
    };

    const grouped = await this.prisma.fanProfileFavoriteSong.groupBy({
      by: ['songId'],
      where,
      _count: { songId: true },
    });

    if (grouped.length === 0) return [];

    const countBySongId = new Map(
      grouped.map((row) => [row.songId, row._count.songId]),
    );
    const songs = await this.prisma.song.findMany({
      where: { id: { in: grouped.map((row) => row.songId) } },
    });

    return songs
      .map((song) => ({
        songId: song.id,
        title: song.title,
        albumTitle: song.albumTitle,
        count: countBySongId.get(song.id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
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

  // Validación compartida por setlistSongs y favoriteSongs (mismo shape
  // {songId, position} en ambas, ver update-fan-profile.dto.ts): canción
  // duplicada, posición duplicada, canción inexistente en el catálogo. El
  // máximo de elementos y el rango de position (1-15 vs 1-10) ya los
  // valida el DTO por separado para cada campo — acá no hace falta
  // repetirlos.
  private async validateSongEntries(
    entries: SetlistSongInput[] | FavoriteSongInput[],
  ) {
    const songIds = entries.map((entry) => entry.songId);
    if (new Set(songIds).size !== songIds.length) {
      throw new BadRequestException('Duplicate songId in the list');
    }

    const positions = entries.map((entry) => entry.position);
    if (new Set(positions).size !== positions.length) {
      throw new BadRequestException('Duplicate position in the list');
    }

    if (songIds.length === 0) return;

    const found = await this.prisma.song.findMany({
      where: { id: { in: songIds } },
      select: { id: true },
    });
    if (found.length !== songIds.length) {
      const foundIds = new Set(found.map((song) => song.id));
      const missing = songIds.filter((songId) => !foundIds.has(songId));
      throw new BadRequestException(
        `Song(s) not found: ${missing.join(', ')}`,
      );
    }
  }
}

// Campos que valen igual en la vista pública y la propia — arma solo lo
// que no depende de privacidad (id/nombre/ciudad/artistas/foto/setlist/Top
// 10): foto, setlist y Top 10 son siempre públicos (ver decisión de la
// etapa), así que viven acá y no en cada vista por separado.
function toBaseFanProfileFields(fanProfile: FanProfileWithRelations) {
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
    // Heredada del login de Google (ver AuthService#findOrCreateFromGoogle)
    // — nunca un archivo propio, solo la URL que Google aloja. Siempre
    // pública si existe (decisión de la etapa: sin toggle propio).
    photoUrl: fanProfile.user.googlePhotoUrl,
    // Dos listas independientes (ver schema.prisma): un tema puede estar
    // en ninguna, una o ambas. Siempre públicas (decisión de la etapa: sin
    // toggle propio), siempre con position (nunca null).
    setlistSongs: fanProfile.setlistSongs.map((entry) => ({
      id: entry.song.id,
      title: entry.song.title,
      albumTitle: entry.song.albumTitle,
      position: entry.position,
    })),
    favoriteSongs: fanProfile.favoriteSongs.map((entry) => ({
      id: entry.song.id,
      title: entry.song.title,
      albumTitle: entry.song.albumTitle,
      position: entry.position,
    })),
  };
}

// Vista pública (GET /fan-profiles, GET /fan-profiles/:id): `social` solo
// trae las redes configuradas Y marcadas públicas — nunca una clave con
// valor null/vacío, así el frontend puede ocultar la sección entera
// chequeando `Object.keys(social).length` (ver el pedido: "no mostrar
// secciones vacías"). Jamás incluye email/userId ni una red privada.
function toPublicFanProfileResponse(fanProfile: FanProfileWithRelations) {
  const social: Record<string, string> = {};
  if (fanProfile.instagramUrl && fanProfile.instagramIsPublic) {
    social.instagram = fanProfile.instagramUrl;
  }
  if (fanProfile.tiktokUrl && fanProfile.tiktokIsPublic) {
    social.tiktok = fanProfile.tiktokUrl;
  }
  if (fanProfile.xUrl && fanProfile.xIsPublic) {
    social.x = fanProfile.xUrl;
  }
  if (fanProfile.youtubeUrl && fanProfile.youtubeIsPublic) {
    social.youtube = fanProfile.youtubeUrl;
  }
  if (fanProfile.facebookUrl && fanProfile.facebookIsPublic) {
    social.facebook = fanProfile.facebookUrl;
  }

  return {
    ...toBaseFanProfileFields(fanProfile),
    social,
  };
}

// Vista propia (POST/PATCH /fan-profiles, GET /fan-profiles/me): expone
// las 5 redes completas (url + isPublic), configuradas o no, públicas o
// no — el dueño necesita ver/editar todo lo suyo, incluso lo que decidió
// ocultar. Nunca se usa para responder a otro usuario.
function toOwnFanProfileResponse(fanProfile: FanProfileWithRelations) {
  return {
    ...toBaseFanProfileFields(fanProfile),
    instagramUrl: fanProfile.instagramUrl,
    instagramIsPublic: fanProfile.instagramIsPublic,
    tiktokUrl: fanProfile.tiktokUrl,
    tiktokIsPublic: fanProfile.tiktokIsPublic,
    xUrl: fanProfile.xUrl,
    xIsPublic: fanProfile.xIsPublic,
    youtubeUrl: fanProfile.youtubeUrl,
    youtubeIsPublic: fanProfile.youtubeIsPublic,
    facebookUrl: fanProfile.facebookUrl,
    facebookIsPublic: fanProfile.facebookIsPublic,
  };
}
