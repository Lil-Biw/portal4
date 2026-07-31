import { IsString, IsOptional, IsIn, Matches, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export const ICONOS_VALIDOS = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export class CreateTipoActividadDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsString() @IsOptional() @IsIn(ICONOS_VALIDOS) icono?: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class UpdateTipoActividadDto extends PartialType(CreateTipoActividadDto) {}
