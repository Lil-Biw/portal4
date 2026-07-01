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
  tamano_bytes: number;
  tipo_mime: string;
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
  notificacion?: NotificacionOpciones;
}

export interface UpdateActividadDto {
  nombre?: string;
  descripcion?: string;
  tipo_id?: string;
  centro_costo_id?: string;
  activo_ids?: string[];
  fecha?: string;
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
