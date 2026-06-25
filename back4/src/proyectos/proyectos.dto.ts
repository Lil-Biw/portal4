import {
  IsString, IsOptional,
  IsMongoId, IsEnum, IsDateString, MinLength,
  ValidateNested,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';

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

export class VencerDocumentoProyectoDto {
  @IsString() @IsOptional() empresa_nombre?: string;
  @IsString() @IsOptional() centro_nombre?: string;
  @IsString() @IsOptional() proyecto_nombre?: string;
  @IsOptional() @ValidateNested() @Type(() => NotificacionOpcionesDto) notificacion?: NotificacionOpcionesDto;
}
