import {
  IsString, IsEmail, IsOptional, IsBoolean,
  MinLength, ValidateNested, IsObject,
  IsArray, ArrayMinSize, ArrayMaxSize, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

class DireccionDto {
  @IsString() @IsOptional() calle?: string;
  @IsString() @IsOptional() ciudad?: string;
  @IsString() @IsOptional() region?: string;
  @IsString() @IsOptional() pais?: string;
}

export class CreateClienteDto {
  @IsString() @MinLength(3) razon_social: string;
  @IsString() @MinLength(9) rut: string;
  @IsEmail() email_contacto: string;
  @IsString() @IsOptional() telefono?: string;
  @IsObject() @IsOptional() @ValidateNested() @Type(() => DireccionDto)
  direccion?: DireccionDto;
}

export class UpdateClienteDto extends PartialType(CreateClienteDto) {
  @IsBoolean() @IsOptional() activo?: boolean;
  @IsString() @IsOptional() logo_url?: string;
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
