export type RolUsuario = 'admin_cliente' | 'usuario';
export type PermisoAcceso = 'ver' | 'editar';

export interface Usuario {
  _id: string;
  cliente_id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  permiso_acceso: PermisoAcceso;
  activo: boolean;
  ultimo_acceso?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateUsuarioDto {
  cliente_id: string;
  nombre: string;
  email: string;
  password: string;
  rol?: RolUsuario;
  permiso_acceso?: PermisoAcceso;
}

export interface UpdateUsuarioDto {
  nombre?: string;
  email?: string;
  rol?: RolUsuario;
  permiso_acceso?: PermisoAcceso;
  permisos?: PermisoItem[];
}

export interface PermisoItem {
  centro_costo_id: string;
  tipo: PermisoAcceso;
}
