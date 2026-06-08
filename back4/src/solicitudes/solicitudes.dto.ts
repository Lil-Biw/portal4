import { IsString, IsOptional, IsMongoId, IsEnum, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';

export class CreateSolicitudDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @MaxLength(100) tipo: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() @IsOptional() empresa_id?: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsMongoId() @IsOptional() proyecto_id?: string;
  @IsOptional() @ValidateNested() @Type(() => NotificacionOpcionesDto) notificacion?: NotificacionOpcionesDto;
}

export class UpdateSolicitudDto {
  @IsString() @MinLength(2) @IsOptional() nombre?: string;
  @IsString() @MaxLength(100) @IsOptional() tipo?: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class CambiarEstadoDto {
  @IsEnum(['pendiente', 'revision', 'aprobado', 'rechazado', 'vencido']) estado: string;
  @IsString() @IsOptional() motivo_rechazo?: string;
  @IsOptional() @ValidateNested() @Type(() => NotificacionOpcionesDto) notificacion?: NotificacionOpcionesDto;
}
