import { IsString, IsOptional, IsMongoId, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateActivoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @MinLength(2) tipo_activo: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class UpdateActivoDto extends PartialType(CreateActivoDto) {}
