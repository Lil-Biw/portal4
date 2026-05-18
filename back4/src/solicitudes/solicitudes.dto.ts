import { IsString, IsOptional, IsMongoId, IsEnum, MinLength } from 'class-validator';

export class CreateSolicitudDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() tipo: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() empresa_id: string;
  @IsMongoId() @IsOptional() centro_id?: string;
  @IsMongoId() @IsOptional() proyecto_id?: string;
}

export class CambiarEstadoDto {
  @IsEnum(['pendiente', 'revision', 'aprobado', 'rechazado']) estado: string;
}
