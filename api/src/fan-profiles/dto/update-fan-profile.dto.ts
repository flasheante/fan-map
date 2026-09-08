import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Un item de `setlistSongs`/`favoriteSongs` (ver UpdateFanProfileDto abajo):
// una canción del catálogo (Song.id) y su puesto dentro de esa lista.
// Etapa "Setlist + Top 10 independientes": a diferencia del viejo
// FavoriteSongInput (topPosition opcional, porque una favorita podía no
// tener puesto en el Top 10), acá `position` es obligatoria — el setlist y
// el Top 10 son listas ordenadas de punta a punta, no hay "en la lista
// pero sin puesto". El límite superior de `position` (15 o 10) lo valida
// cada campo por separado en el DTO (@Max abajo, distinto por lista); el
// máximo de elementos lo valida @ArrayMaxSize en el campo correspondiente.
export class SetlistSongInput {
  @IsUUID('4')
  songId: string;

  @IsInt()
  @Min(1)
  @Max(15)
  position: number;
}

export class FavoriteSongInput {
  @IsUUID('4')
  songId: string;

  @IsInt()
  @Min(1)
  @Max(10)
  position: number;
}

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

  // Reemplazo completo del setlist personal (mismo patrón que artistIds
  // arriba: se borra y se recrea entero, nunca un PATCH incremental por
  // canción) — hasta 15 acá. Completamente independiente de
  // `favoriteSongs`: mandar uno nunca toca al otro (ver
  // FanProfilesService#update). El resto de las reglas (canción/posición
  // duplicada, canción inexistente) se valida en el servicio, no acá.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15)
  @ValidateNested({ each: true })
  @Type(() => SetlistSongInput)
  setlistSongs?: SetlistSongInput[];

  // Reemplazo completo del Top 10 de favoritas — hasta 10, independiente
  // del setlist de arriba. Es también la fuente exclusiva de los rankings
  // del Fan Map (ver FanProfilesService#findFavoriteSongsRanking): el
  // setlist nunca participa de esos rankings.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FavoriteSongInput)
  favoriteSongs?: FavoriteSongInput[];

  // 5 redes fijas, cada una con su propio par url/isPublic — ver decisión
  // en schema.prisma. `null` explícito borra la URL (IsOptional de
  // class-validator no valida null/undefined); string vacío se rechaza
  // (@IsUrl), así una red nunca queda "configurada" con "".
  @IsOptional()
  @IsUrl()
  @MaxLength(300)
  instagramUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  instagramIsPublic?: boolean;

  @IsOptional()
  @IsUrl()
  @MaxLength(300)
  tiktokUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  tiktokIsPublic?: boolean;

  @IsOptional()
  @IsUrl()
  @MaxLength(300)
  xUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  xIsPublic?: boolean;

  @IsOptional()
  @IsUrl()
  @MaxLength(300)
  youtubeUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  youtubeIsPublic?: boolean;

  @IsOptional()
  @IsUrl()
  @MaxLength(300)
  facebookUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  facebookIsPublic?: boolean;
}
