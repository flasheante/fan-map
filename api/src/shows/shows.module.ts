import { Module } from '@nestjs/common';
import { SetlistFmModule } from '../integrations/setlist-fm/setlist-fm.module';
import { ShowsController } from './shows.controller';
import { ShowsService } from './shows.service';
import { SetlistFmSyncService } from './setlist-fm-sync.service';

@Module({
  imports: [SetlistFmModule],
  controllers: [ShowsController],
  providers: [ShowsService, SetlistFmSyncService],
  exports: [SetlistFmSyncService],
})
export class ShowsModule {}
