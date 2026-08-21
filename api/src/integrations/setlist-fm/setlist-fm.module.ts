import { Module } from '@nestjs/common';
import { SetlistFmClient } from './setlist-fm.client';

@Module({
  providers: [SetlistFmClient],
  exports: [SetlistFmClient],
})
export class SetlistFmModule {}
