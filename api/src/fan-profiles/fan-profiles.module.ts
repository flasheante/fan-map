import { Module } from '@nestjs/common';
import { FanProfilesController } from './fan-profiles.controller';
import { FanProfilesService } from './fan-profiles.service';

@Module({
  controllers: [FanProfilesController],
  providers: [FanProfilesService],
})
export class FanProfilesModule {}
