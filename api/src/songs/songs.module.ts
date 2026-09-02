import { Module } from '@nestjs/common';
import { MusicBrainzModule } from '../integrations/musicbrainz/musicbrainz.module';
import { MusicBrainzSyncService } from './musicbrainz-sync.service';

@Module({
  imports: [MusicBrainzModule],
  providers: [MusicBrainzSyncService],
  exports: [MusicBrainzSyncService],
})
export class SongsModule {}
