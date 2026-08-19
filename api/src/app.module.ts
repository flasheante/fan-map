import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { LocationsModule } from './locations/locations.module';

@Module({
  imports: [PrismaModule, LocationsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
