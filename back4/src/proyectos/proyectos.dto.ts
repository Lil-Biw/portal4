import {
  IsArray, IsString, IsOptional,
  IsMongoId, IsEnum, IsDateString, MinLength,
  ValidateNested, IsIn,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';

export class CreateProyectoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;
  @IsArray() @IsMongoId({ each: true }) @IsOptional() centro_costo_ids?: string[];
  @IsMongoId() @IsOptional() tipo_proyecto_id?: string;
  @IsString() @MinLength(2) codigo: string;
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsEnum(['estancado', 'nuevo_sin_oc', 'nuevo_con_oc', 'en_ejecucion', 'cierre_pendiente', 'finalizado_facturar', 'finalizado_facturado'])
  @IsOptional()
  estado?: 'estancado' | 'nuevo_sin_oc' | 'nuevo_con_oc' | 'en_ejecucion' | 'cierre_pendiente' | 'finalizado_facturar' | 'finalizado_facturado';
  @IsDateString() @IsOptional() fecha_inicio?: string;
  // string | null: null permite borrar explícitamente una fecha_fin ya guardada
  // (el front la manda así al vaciar el campo; a diferencia de un PATCH parcial,
  // este DTO siempre representa el estado completo del formulario).
  @IsDateString() @IsOptional() fecha_fin?: string | null;
  @IsArray() @IsIn([365, 180, 30, 15, 7, 3, 1, 0], { each: true }) @IsOptional() dias_recordatorio?: number[];
}

export class UpdateProyectoDto extends PartialType(CreateProyectoDto) {}

export class VencerDocumentoProyectoDto {
  @IsString() @IsOptional() empresa_nombre?: string;
  @IsString() @IsOptional() centro_nombre?: string;
  @IsString() @IsOptional() proyecto_nombre?: string;
  @IsOptional() @ValidateNested() @Type(() => NotificacionOpcionesDto) notificacion?: NotificacionOpcionesDto;
}
