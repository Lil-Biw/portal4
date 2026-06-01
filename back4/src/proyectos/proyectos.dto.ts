import {
  IsString, IsOptional,
  IsMongoId, IsEnum, IsDateString, MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateProyectoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsString() @MinLength(2) codigo: string;
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsEnum(['borrador', 'activo', 'cerrado']) @IsOptional() estado?: 'borrador' | 'activo' | 'cerrado';
  @IsDateString() @IsOptional() fecha_inicio?: string;
  @IsDateString() @IsOptional() fecha_fin?: string;
}

export class UpdateProyectoDto extends PartialType(CreateProyectoDto) {}

export class AgregarDocumentoProyectoDto {
  @IsString() nombre: string;
  @IsString() url: string;
  @IsString() tipo_mime: string;
  @IsOptional() tamano_bytes?: number;
}
