import { IsString, IsOptional, IsMongoId, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateActivoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsMongoId() tipo_activo_id: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class UpdateActivoDto extends PartialType(CreateActivoDto) {}
