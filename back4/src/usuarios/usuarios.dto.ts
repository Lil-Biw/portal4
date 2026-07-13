import {
  IsString, IsEmail, IsOptional, IsBoolean,
  IsEnum, IsMongoId, IsArray, MinLength,
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';

export class CreateUsuarioDto {
  @IsMongoId() @IsOptional() cliente_id?: string;
  @IsString() nombre: string;
  @IsEmail() email: string;
  @IsEnum(['super_admin', 'admin_smartclarity', 'usuario']) @IsOptional() rol?: string;
  @IsEnum(['ver', 'editar']) @IsOptional() permiso_acceso?: 'ver' | 'editar';
  @IsArray() @IsMongoId({ each: true }) @IsOptional() centros_asignados?: string[];
}

export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['cliente_id'] as const),
) {
  @IsBoolean() @IsOptional() activo?: boolean;
}

export class CambiarPasswordDto {
  @IsString() @MinLength(1) password_actual: string;
  @IsString() @MinLength(8) password_nueva: string;
}

export class SuscripcionesDto {
  @IsBoolean() notificar_todas_empresas: boolean;
  @IsArray() @IsMongoId({ each: true }) @IsOptional() empresas_suscritas?: string[];
  @IsArray() @IsMongoId({ each: true }) @IsOptional() centros_suscritos?: string[];
  @IsArray() @IsMongoId({ each: true }) @IsOptional() proyectos_suscritos?: string[];
}
