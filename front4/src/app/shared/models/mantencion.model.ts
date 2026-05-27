export interface TipoMantencion {
  _id: string;
  nombre: string;
  color: string;
  descripcion?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface Mantencion {
  _id: string;
  nombre: string;
  descripcion?: string;
  tipo_id: TipoMantencion | string;
  centro_costo_id: string;
  activo_ids?: string[];
  fecha: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateMantencionDto {
  nombre: string;
  descripcion?: string;
  tipo_id: string;
  centro_costo_id: string;
  activo_ids?: string[];
  fecha: string;
}

export interface UpdateMantencionDto {
  nombre?: string;
  descripcion?: string;
  tipo_id?: string;
  centro_costo_id?: string;
  activo_ids?: string[];
  fecha?: string;
}

export interface CreateTipoMantencionDto {
  nombre: string;
  color?: string;
  descripcion?: string;
}

export interface UpdateTipoMantencionDto {
  nombre?: string;
  color?: string;
  descripcion?: string;
}
