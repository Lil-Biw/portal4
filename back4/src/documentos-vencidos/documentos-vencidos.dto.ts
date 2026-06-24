import { IsString, IsOptional, IsMongoId, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDocVencidoDto {
  @IsString() nombre_display: string;
  @IsString() @IsOptional() categoria?: string;
  @IsString() tipo_mime: string;
  @IsNumber() @IsOptional() tamano_bytes?: number;
  @IsEnum(['empresa', 'centro', 'proyecto']) origen_tipo: 'empresa' | 'centro' | 'proyecto';
  @IsMongoId() empresa_id: string;
  @IsMongoId() @IsOptional() centro_id?: string;
  @IsMongoId() @IsOptional() proyecto_id?: string;
  @IsString() @IsOptional() empresa_nombre?: string;
  @IsString() @IsOptional() centro_nombre?: string;
  @IsString() @IsOptional() proyecto_nombre?: string;
  @IsOptional() @Type(() => Date) subido_en?: Date;
}
