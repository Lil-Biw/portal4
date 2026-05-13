import {
  IsString, IsOptional, IsBoolean,
  IsMongoId, IsUrl, IsNumber, MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateCentroCostoDto {
  @IsMongoId() cliente_id: string;
  @IsString() @MinLength(2) codigo: string;
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsString() @IsOptional() ubicacion_direccion?: string;
  @IsString() @IsOptional() ubicacion_ciudad?: string;
  @IsString() @IsOptional() ubicacion_region?: string;
  @IsString() @IsOptional() ubicacion_pais?: string;
}

export class UpdateCentroCostoDto extends PartialType(CreateCentroCostoDto) {
  @IsBoolean() @IsOptional() activo?: boolean;
}

export class AgregarDocumentoDto {
  @IsString() nombre: string;
  @IsUrl() url: string;
  @IsString() tipo_mime: string;
  @IsNumber() @IsOptional() tamano_bytes?: number;
}
