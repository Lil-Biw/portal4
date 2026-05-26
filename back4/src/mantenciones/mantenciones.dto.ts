import { IsString, IsOptional, IsMongoId, IsDateString, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateMantencionDto {
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() tipo_id: string;
  @IsMongoId() centro_costo_id: string;
  @IsMongoId() @IsOptional() activo_id?: string;
  @IsDateString() fecha: string;
}

export class UpdateMantencionDto extends PartialType(CreateMantencionDto) {}
