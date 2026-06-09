import {
  IsString, IsOptional, IsBoolean,
  IsMongoId, MinLength,
  IsArray, ArrayMinSize, ArrayMaxSize, IsInt, Min, Max,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateCentroCostoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;
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

export class UpdateScoreSmartclarityDto {
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(10, { each: true })
  valores: number[];
}
