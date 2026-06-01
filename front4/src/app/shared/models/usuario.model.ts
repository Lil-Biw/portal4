export type RolUsuario = 'admin_cliente' | 'usuario';
export type PermisoAcceso = 'ver' | 'editar';

export interface Usuario {
  _id: string;
  cliente_id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  permiso_acceso: PermisoAcceso;
  centros_asignados: string[];
  activo: boolean;
  ultimo_acceso?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateUsuarioDto {
  cliente_id: string;
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
