import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FanProfilesService } from './fan-profiles.service';
import { CreateFanProfileDto } from './dto/create-fan-profile.dto';
import { UpdateFanProfileDto } from './dto/update-fan-profile.dto';
import { FindFanProfilesQueryDto } from './dto/find-fan-profiles-query.dto';
import { FindFavoriteSongsRankingQueryDto } from './dto/find-favorite-songs-ranking-query.dto';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('fan-profiles')
export class FanProfilesController {
  constructor(private readonly fanProfilesService: FanProfilesService) {}

  // El User se deriva exclusivamente de request.user.id (SessionAuthGuard),
  // nunca de un campo del body: un cliente no puede elegir a qué User se
  // asocia su FanProfile.
  @UseGuards(SessionAuthGuard)
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateFanProfileDto) {
    return this.fanProfilesService.create(req.user!.id, dto);
  }

  @Get()
  findAll(@Query() query: FindFanProfilesQueryDto) {
    return this.fanProfilesService.findAll(query);
  }

  // Etapa 3: el FanProfile del User autenticado, para que el frontend pueda
  // resolver "¿ya tiene perfil?" tras el login sin conocer su :id. Declarado
  // ANTES de @Get(':id') a propósito: Nest/Express matchea rutas en orden
  // de declaración, así que si fuera después, ':id' capturaría "me" como
  // id y ParseUUIDPipe lo rechazaría con 400 en vez de resolver esta ruta.
  @UseGuards(SessionAuthGuard)
  @Get('me')
  findMine(@Req() req: AuthenticatedRequest) {
    return this.fanProfilesService.findMine(req.user!.id);
  }

  // Ranking de canciones favoritas del Fan Map (mundial/país/ciudad, ver
  // FanProfilesService#findFavoriteSongsRanking) — público, sin sesión.
  // Declarado ANTES de ':id' a propósito, mismo motivo que 'me' arriba:
  // Nest/Express matchea rutas en orden de declaración, así que si fuera
  // después, ':id' capturaría "stats" como id y ParseUUIDPipe lo
  // rechazaría con 400 en vez de resolver esta ruta.
  @Get('stats/favorite-songs')
  findFavoriteSongsRanking(@Query() query: FindFavoriteSongsRankingQueryDto) {
    return this.fanProfilesService.findFavoriteSongsRanking(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fanProfilesService.findOne(id);
  }

  // Etapa 4: antes público y sin ownership check — cualquiera podía
  // modificar cualquier FanProfile conociendo su id. Igual que POST/me: el
  // owner sale de request.user.id, nunca de la URL ni del body.
  @UseGuards(SessionAuthGuard)
  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFanProfileDto,
  ) {
    return this.fanProfilesService.update(id, req.user!.id, dto);
  }
}
