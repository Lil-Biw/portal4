export type EstadoProyecto =
  | 'estancado'
  | 'nuevo_sin_oc'
  | 'nuevo_con_oc'
  | 'en_ejecucion'
  | 'cierre_pendiente'
  | 'finalizado_facturar'
  | 'finalizado_facturado';

export const ESTADO_PROYECTO_LABEL: Record<EstadoProyecto, string> = {
  estancado:            'Estancado',
  nuevo_sin_oc:         'Nuevos por Programar / Sin OC',
  nuevo_con_oc:         'Nuevos por Programar / Con OC',
  en_ejecucion:         'En ejecución',
  cierre_pendiente:     'Cierre pendiente / Validación Interna',
  finalizado_facturar:  'Finalizado / Listo para facturar',
  finalizado_facturado: 'Finalizado y facturado',
};

export interface Proyecto {
  _id: string;
  centro_costo_ids: string[];
  cliente_id: string;
  tipo_proyecto_id?: string | TipoProyecto;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado: EstadoProyecto;
  fecha_inicio?: string;
  fecha_fin?: string;
  // Días de antelación a fecha_fin en que se avisa a los admins suscritos
  // (subconjunto de [365, 180, 30, 15, 7, 3, 1, 0]; 0 = el día de término)
  dias_recordatorio?: number[];
  creado_por?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateProyectoDto {
  centro_costo_ids: string[];
  cliente_id: string;
  tipo_proyecto_id?: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  estado?: EstadoProyecto;
  fecha_inicio?: string;
  // null = borrar explícitamente una fecha_fin ya guardada (distinto de
  // "no enviar el campo", que en un PUT deja el valor anterior intacto).
  fecha_fin?: string | null;
  dias_recordatorio?: number[];
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
