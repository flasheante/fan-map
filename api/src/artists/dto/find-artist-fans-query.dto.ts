import { IsBooleanString, IsOptional } from 'class-validator';

export class FindArtistFansQueryDto {
  @IsOptional()
  @IsBooleanString()
  onMap?: string;
}
