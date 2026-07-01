export type EstadoProyecto = 'borrador' | 'activo' | 'cerrado';

export interface Proyecto {
  _id: string;
  centro_costo_id: string;
  cliente_id: string;
  tipo_proyecto_id?: string | TipoProyecto;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: EstadoProyecto;
  fecha_inicio?: string;
  fecha_fin?: string;
  creado_por?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateProyectoDto {
  centro_costo_id: string;
  cliente_id: string;
  tipo_proyecto_id?: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado?: EstadoProyecto;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export type UpdateProyectoDto = Partial<CreateProyectoDto>;

export interface TipoProyecto {
  _id: string;
  nombre: string;
  color: string;
}

export interface CreateTipoProyectoDto {
  nombre: string;
  color?: string;
}

export type UpdateTipoProyectoDto = Partial<CreateTipoProyectoDto>;
