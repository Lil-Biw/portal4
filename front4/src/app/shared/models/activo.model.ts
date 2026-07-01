export interface DocActivo {
  _id: string;
  nombre: string;
  nombre_display: string;
  tamano_bytes: number;
  tipo_mime: string;
}

export interface TipoActivo {
  _id: string;
  nombre: string;
  color: string;
}

export interface CreateTipoActivoDto {
  nombre: string;
  color: string;
}

export type UpdateTipoActivoDto = Partial<CreateTipoActivoDto>;

export interface Activo {
  _id: string;
  nombre: string;
  tipo_activo_id: string | TipoActivo;
  centro_costo_id: string;
  descripcion?: string;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateActivoDto {
  nombre: string;
  tipo_activo_id: string;
  centro_costo_id: string;
  descripcion?: string;
}

export type UpdateActivoDto = Partial<CreateActivoDto>;

export interface TipoActividad {
  _id: string;
  nombre: string;
  color?: string;
}

export interface DocActividad {
  _id: string;
  nombre: string;
  nombre_display: string;
  tamano_bytes: number;
  tipo_mime: string;
}

export interface ActividadHistorialItem {
  _id: string;
  nombre: string;
  descripcion?: string;
  tipo_id: TipoActividad | string;
  centro_costo_id: string;
  fecha: string;
  creado_en?: string;
}
