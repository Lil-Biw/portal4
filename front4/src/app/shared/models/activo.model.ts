export interface Activo {
  _id: string;
  nombre: string;
  tipo_activo: string;
  centro_costo_id: string;
  descripcion?: string;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateActivoDto {
  nombre: string;
  tipo_activo: string;
  centro_costo_id: string;
  descripcion?: string;
}

export type UpdateActivoDto = Partial<CreateActivoDto>;
