import { IsString, IsOptional, IsMongoId, IsDateString, MinLength, IsArray, ValidateNested } from 'class-validator';
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
  @IsOptional() @ValidateNested() @Type(() => NotificacionOpcionesDto) notificacion?: NotificacionOpcionesDto;
}

export class UpdateActividadDto extends PartialType(CreateActividadDto) {}
