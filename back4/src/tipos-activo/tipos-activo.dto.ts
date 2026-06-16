import { IsString, IsOptional, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateTipoActivoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() color?: string;
}

export class UpdateTipoActivoDto extends PartialType(CreateTipoActivoDto) {}
