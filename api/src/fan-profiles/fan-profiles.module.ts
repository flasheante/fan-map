import { Module } from '@nestjs/common';
import { FanProfilesController } from './fan-profiles.controller';
import { FanProfilesService } from './fan-profiles.service';
import { AuthModule } from '../auth/auth.module';

// AuthModule se importa por SessionAuthGuard (usado en POST /fan-profiles),
// que a su vez depende de SessionService — ambos exportados por AuthModule.
@Module({
  imports: [AuthModule],
  controllers: [FanProfilesController],
  providers: [FanProfilesService],
})
export class FanProfilesModule {}
