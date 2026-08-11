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
  ubicacion_latitud?: number;
  ubicacion_longitud?: number;
  activo: boolean;
  foto?: { tipo_mime: string; nombre: string };
  score_smartclarity?: number[];
  creado_en?: string;
  actualizado_en?: string;
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
  ubicacion_latitud?: number;
  ubicacion_longitud?: number;
}

export type UpdateCentroDto = Partial<CreateCentroDto>;
