import { PermisosUsuario } from './permisos.model';

export type RolUsuario = 'super_admin' | 'admin_smartclarity' | 'usuario';
export type PermisoAcceso = 'ver' | 'editar';

export interface Usuario {
  _id: string;
  cliente_id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  permiso_acceso: PermisoAcceso;
  centros_asignados: string[];
  permisos?: PermisosUsuario;
  activo: boolean;
  ultimo_acceso?: string;
  creado_en?: string;
  actualizado_en?: string;
  notificar_todas_empresas?: boolean;
  empresas_suscritas?: string[];
  centros_suscritos?: string[];
  proyectos_suscritos?: string[];
}

export interface SuscripcionesDto {
  notificar_todas_empresas: boolean;
  empresas_suscritas: string[];
  centros_suscritos: string[];
  proyectos_suscritos: string[];
}

export interface CreateUsuarioDto {
  cliente_id?: string;
  nombre: string;
  email: string;
  rol?: RolUsuario;
  permiso_acceso?: PermisoAcceso;
  centros_asignados?: string[];
}

export interface UpdateUsuarioDto {
  nombre?: string;
  email?: string;
  rol?: RolUsuario;
  permiso_acceso?: PermisoAcceso;
  centros_asignados?: string[];
}
