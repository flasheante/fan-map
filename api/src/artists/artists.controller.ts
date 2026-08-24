import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ArtistsService } from './artists.service';
import { FindArtistFansQueryDto } from './dto/find-artist-fans-query.dto';

@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Get()
  findAll() {
    return this.artistsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.artistsService.findOne(id);
  }

  @Get(':artistId/fans')
  findFans(
    @Param('artistId', ParseUUIDPipe) artistId: string,
    @Query() query: FindArtistFansQueryDto,
  ) {
    return this.artistsService.findFans(artistId, query);
  }

  @Get(':artistId/stats')
  findStats(@Param('artistId', ParseUUIDPipe) artistId: string) {
    return this.artistsService.findStats(artistId);
  }

  @Get(':artistId/stats/songs')
  findTopSongs(@Param('artistId', ParseUUIDPipe) artistId: string) {
    return this.artistsService.findTopSongs(artistId);
  }
}
