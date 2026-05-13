export type EstadoProyecto = 'borrador' | 'activo' | 'cerrado';

export interface Proyecto {
  _id: string;
  centro_costo_id: string;
  cliente_id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: EstadoProyecto;
  fecha_inicio?: string;
  fecha_fin?: string;
  documentos?: DocumentoRef[];
  creado_por?: string;
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

export interface CreateProyectoDto {
  centro_costo_id: string;
  cliente_id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado?: EstadoProyecto;
  fecha_inicio?: string;
  fecha_fin?: string;
}

export type UpdateProyectoDto = Partial<CreateProyectoDto>;
