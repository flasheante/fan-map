import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { LocationsModule } from './locations/locations.module';
import { FanProfilesModule } from './fan-profiles/fan-profiles.module';
import { ArtistsModule } from './artists/artists.module';
import { ShowsModule } from './shows/shows.module';
import { DemoSeedModule } from './demo-seed/demo-seed.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    LocationsModule,
    FanProfilesModule,
    ArtistsModule,
    ShowsModule,
    DemoSeedModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
