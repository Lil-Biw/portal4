import {
  IsString, IsEmail, IsOptional, IsBoolean,
  IsEnum, IsMongoId, MinLength, IsArray, ValidateNested,
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';

export class PermisoUsuarioDto {
  @IsMongoId() centro_costo_id: string;
  @IsEnum(['ver', 'editar']) tipo: 'ver' | 'editar';
}

export class CreateUsuarioDto {
  @IsMongoId() cliente_id: string;
  @IsString() @MinLength(3) nombre: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsEnum(['admin_cliente', 'usuario']) @IsOptional() rol?: string;
  @IsEnum(['ver', 'editar']) @IsOptional() permiso_acceso?: 'ver' | 'editar';
  @IsArray() @ValidateNested({ each: true }) @Type(() => PermisoUsuarioDto) @IsOptional() permisos?: PermisoUsuarioDto[];
}

export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['cliente_id', 'password'] as const),
) {
  @IsBoolean() @IsOptional() activo?: boolean;
}

export class CambiarPasswordDto {
  @IsString() @MinLength(8) password_actual: string;
  @IsString() @MinLength(8) password_nueva: string;
}
