import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

// `userId` deliberadamente no es un campo: el User se deriva exclusivamente
// de request.user.id (poblado por SessionAuthGuard), nunca del body — ver
// FanProfilesController#create. Antes tampoco existía `userId` acá, pero sí
// `email`, que cumplía ese mismo rol (elegía/creaba el User); se eliminó por
// la misma razón al integrar Auth.
export class CreateFanProfileDto {
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
