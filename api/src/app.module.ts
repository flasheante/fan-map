import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { LocationsModule } from './locations/locations.module';
import { FanProfilesModule } from './fan-profiles/fan-profiles.module';
import { ArtistsModule } from './artists/artists.module';

@Module({
  imports: [PrismaModule, LocationsModule, FanProfilesModule, ArtistsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
