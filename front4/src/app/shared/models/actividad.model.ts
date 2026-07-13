export interface TipoActividad {
  _id: string;
  nombre: string;
  color: string;
  descripcion?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface DocActividad {
  _id: string;
  nombre: string;
  nombre_display: string;
  tamano_bytes?: number;
  tipo_mime?: string;
  tipo_contenido?: 'archivo' | 'link';
  link_url?: string;
}

import type { Activo } from './activo.model';

export interface Actividad {
  _id: string;
  nombre: string;
  descripcion?: string;
  tipo_id: TipoActividad | string;
  centro_costo_id: string;
  activo_ids?: (Activo | string)[];
  fecha: string;
  fecha_termino?: string | null;
  // Días de antelación a la fecha en que se avisa a los admins suscritos
  // (subconjunto de [30, 15, 7, 3, 1, 0]; 0 = el día de la actividad)
  dias_recordatorio?: number[];
  creado_en?: string;
  actualizado_en?: string;
}

export interface NotificacionOpciones {
  notificar: boolean;
  audiencia?: 'todos' | 'especificos';
  destinatarios_ids?: string[];
  notificar_super_admins?: boolean;
}

export interface CreateActividadDto {
  nombre: string;
  descripcion?: string;
  tipo_id: string;
  centro_costo_id: string;
  activo_ids?: string[];
  fecha: string;
  fecha_termino?: string | null;
  dias_recordatorio?: number[];
  // Nombres de los docs pendientes de subir, para listarlos en el correo de notificación
  documentos_nombres?: string[];
  notificacion?: NotificacionOpciones;
}

export interface UpdateActividadDto {
  nombre?: string;
  descripcion?: string;
  tipo_id?: string;
  centro_costo_id?: string;
  activo_ids?: string[];
  fecha?: string;
  fecha_termino?: string | null;
  dias_recordatorio?: number[];
  notificacion?: NotificacionOpciones;
}

export interface CreateTipoActividadDto {
  nombre: string;
  color?: string;
  descripcion?: string;
}

export interface UpdateTipoActividadDto {
  nombre?: string;
  color?: string;
  descripcion?: string;
}
