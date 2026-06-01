import { IsString, IsOptional, IsMongoId, IsDateString, MinLength, IsArray } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateMantencionDto {
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() tipo_id: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsArray() @IsMongoId({ each: true }) @IsOptional() activo_ids?: string[];
  @IsDateString() fecha: string;
}

export class UpdateMantencionDto extends PartialType(CreateMantencionDto) {}
