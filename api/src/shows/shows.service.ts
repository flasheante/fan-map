import { Injectable, NotFoundException } from '@nestjs/common';
import { City, Country, Setlist, SetlistSong, Show } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

type ShowWithCity = Show & { city: City & { country: Country } };
type SetlistWithSongs = Setlist & { songs: SetlistSong[] };

@Injectable()
export class ShowsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByArtist(artistId: string) {
    await this.getArtistOrThrow(artistId);

    const shows = (await this.prisma.show.findMany({
      where: { artistId },
      include: { city: { include: { country: true } } },
      orderBy: { date: 'asc' },
    })) as ShowWithCity[];

    return shows.map(toShowResponse);
  }

  async findOne(artistId: string, showId: string) {
    await this.getArtistOrThrow(artistId);
    const show = await this.getShowForArtistOrThrow(artistId, showId);

    return toShowResponse(show);
  }

  // Devuelve songs: [] tanto si el Show no tiene Setlist cargado todavía
  // como si el Setlist existe pero no tiene canciones: en ambos casos es
  // 200, no 404 (el 404 se reserva a artista/show inexistente o show que
  // no pertenece al artista de la URL).
  async findSetlist(artistId: string, showId: string) {
    await this.getArtistOrThrow(artistId);
    await this.getShowForArtistOrThrow(artistId, showId);

    const setlist = (await this.prisma.setlist.findUnique({
      where: { showId },
      include: { songs: { orderBy: { position: 'asc' } } },
    })) as SetlistWithSongs | null;

    return {
      showId,
      songs: setlist ? setlist.songs.map(toSongResponse) : [],
    };
  }

  private async getArtistOrThrow(artistId: string) {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
    });
    if (!artist) {
      throw new NotFoundException(`Artist ${artistId} not found`);
    }
    return artist;
  }

  private async getShowForArtistOrThrow(artistId: string, showId: string) {
    const show = (await this.prisma.show.findUnique({
      where: { id: showId },
      include: { city: { include: { country: true } } },
    })) as ShowWithCity | null;

    if (!show || show.artistId !== artistId) {
      throw new NotFoundException(`Show ${showId} not found`);
    }
    return show;
  }
}

function toShowResponse(show: ShowWithCity) {
  return {
    id: show.id,
    date: show.date,
    venue: show.venue,
    createdAt: show.createdAt,
    updatedAt: show.updatedAt,
    city: {
      id: show.city.id,
      name: show.city.name,
      latitude: show.city.latitude,
      longitude: show.city.longitude,
      country: {
        id: show.city.country.id,
        name: show.city.country.name,
        code: show.city.country.code,
      },
    },
  };
}

function toSongResponse(song: SetlistSong) {
  return {
    id: song.id,
    position: song.position,
    title: song.title,
  };
}
