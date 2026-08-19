import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { FanProfilesService } from './fan-profiles.service';
import { CreateFanProfileDto } from './dto/create-fan-profile.dto';
import { UpdateFanProfileDto } from './dto/update-fan-profile.dto';

@Controller('fan-profiles')
export class FanProfilesController {
  constructor(private readonly fanProfilesService: FanProfilesService) {}

  @Post()
  create(@Body() dto: CreateFanProfileDto) {
    return this.fanProfilesService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.fanProfilesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFanProfileDto,
  ) {
    return this.fanProfilesService.update(id, dto);
  }
}
