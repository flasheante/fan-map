import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ShowsService } from './shows.service';

@Controller('artists/:artistId/shows')
export class ShowsController {
  constructor(private readonly showsService: ShowsService) {}

  @Get()
  findAll(@Param('artistId', ParseUUIDPipe) artistId: string) {
    return this.showsService.findAllByArtist(artistId);
  }

  @Get(':showId')
  findOne(
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @Param('showId', ParseUUIDPipe) showId: string,
  ) {
    return this.showsService.findOne(artistId, showId);
  }

  @Get(':showId/setlist')
  findSetlist(
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @Param('showId', ParseUUIDPipe) showId: string,
  ) {
    return this.showsService.findSetlist(artistId, showId);
  }
}
