import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateFanProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;

  @IsOptional()
  @IsBoolean()
  showOnMap?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  artistIds?: string[];
}
