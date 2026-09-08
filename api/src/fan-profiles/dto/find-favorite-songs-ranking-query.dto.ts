import { IsOptional, IsUUID } from 'class-validator';

// GET /fan-profiles/stats/favorite-songs. Ambos opcionales — sin ninguno,
// ranking mundial; con cityId, ese gana sobre countryId si llegaran los
// dos juntos (ver FanProfilesService#findFavoriteSongsRanking). Un id
// desconocido no es un error acá: devuelve un ranking vacío, mismo
// criterio "de solo lectura" que el resto de filtros de esta API (ver
// FindFanProfilesQueryDto).
export class FindFavoriteSongsRankingQueryDto {
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @IsOptional()
  @IsUUID()
  cityId?: string;
}
