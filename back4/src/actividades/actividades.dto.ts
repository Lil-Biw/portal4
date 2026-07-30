import { IsString, IsOptional, IsMongoId, IsDateString, MinLength, IsArray, ValidateNested, IsIn, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';

export class CreateActividadDto {
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() tipo_id: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsArray() @IsMongoId({ each: true }) @IsOptional() activo_ids?: string[];
  @IsDateString() fecha: string;
  @IsDateString() @IsOptional() fecha_termino?: string | null;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) hora?: string;
  @IsOptional() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) hora_termino?: string;
  @IsArray() @IsIn([365, 180, 30, 15, 7, 3, 1, 0], { each: true }) @IsOptional() dias_recordatorio?: number[];
  // Nombres de los documentos que el front subirá inmediatamente después de crear
  // la actividad; solo se usan en el correo de notificación, no se persisten.
  @IsArray() @IsString({ each: true }) @IsOptional() documentos_nombres?: string[];
  @IsOptional() @ValidateNested() @Type(() => NotificacionOpcionesDto) notificacion?: NotificacionOpcionesDto;
}

export class UpdateActividadDto extends PartialType(CreateActividadDto) {}
