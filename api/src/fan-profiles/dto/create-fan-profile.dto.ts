import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateFanProfileDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  displayName: string;

  @IsUUID()
  cityId: string;

  @IsOptional()
  @IsBoolean()
  showOnMap?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  artistIds?: string[];
}
