import { IsString, IsOptional, IsMongoId, IsEnum, MinLength, MaxLength } from 'class-validator';

export class CreateSolicitudDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @MaxLength(100) tipo: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() @IsOptional() empresa_id?: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsMongoId() @IsOptional() proyecto_id?: string;
}

export class UpdateSolicitudDto {
  @IsString() @MinLength(2) @IsOptional() nombre?: string;
  @IsString() @MaxLength(100) @IsOptional() tipo?: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class CambiarEstadoDto {
  @IsEnum(['pendiente', 'revision', 'aprobado', 'rechazado', 'vencido']) estado: string;
  @IsString() @IsOptional() motivo_rechazo?: string;
}
