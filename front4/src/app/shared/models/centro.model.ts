export interface CentroCosto {
  _id: string;
  cliente_id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  ubicacion_direccion?: string;
  ubicacion_ciudad?: string;
  ubicacion_region?: string;
  ubicacion_pais?: string;
  activo: boolean;
  documentos?: DocumentoRef[];
  creado_en?: string;
  actualizado_en?: string;
}

export interface DocumentoRef {
  nombre: string;
  url: string;
  tipo_mime: string;
  tamano_bytes?: number;
  subido_en?: string;
}

export interface CreateCentroDto {
  cliente_id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  ubicacion_direccion?: string;
  ubicacion_ciudad?: string;
  ubicacion_region?: string;
  ubicacion_pais?: string;
}

export type UpdateCentroDto = Partial<CreateCentroDto>;
