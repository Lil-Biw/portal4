import { IsMongoId, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export const CATEGORIAS_DOCUMENTO = [
  'Contrato',
  'Factura',
  'Boleta',
  'Recibo',
  'Certificado',
  'Informe',
  'Otro',
] as const;

export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

export class SubirDocumentoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;
  @IsEnum(['empresa', 'centro', 'proyecto']) tipo: 'empresa' | 'centro' | 'proyecto';
  @IsMongoId() @IsOptional() centro_id?: string;
  @IsMongoId() @IsOptional() proyecto_id?: string;
  @IsOptional() empresa_nombre?: string;
  @IsOptional() centro_nombre?: string;
  @IsOptional() proyecto_nombre?: string;
  @IsOptional() @IsString() @MaxLength(200) nombre_display?: string;
  @IsOptional() @IsEnum(CATEGORIAS_DOCUMENTO) categoria?: CategoriaDocumento;
}
