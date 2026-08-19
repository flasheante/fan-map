import { IsBooleanString, IsOptional } from 'class-validator';

export class FindFanProfilesQueryDto {
  @IsOptional()
  @IsBooleanString()
  onMap?: string;
}
