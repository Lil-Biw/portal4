// Presets de `usuario.permisos` por rol. Fuente única de verdad para:
//  - UsuariosService.create/update (permisos por defecto al crear o cambiar rol)
//  - PermisoAccionGuard (fallback cuando una acción no está configurada
//    explícitamente en `usuario.permisos`, para que las acciones que se agregan
//    al catálogo después no dejen bloqueadas a cuentas existentes).

// Default de `permisos` para usuarios nuevos que no reciben uno explícito al
// crearse (CreateUsuarioDto no tiene campo `permisos`). Sin esto, el schema le
// pondría `{}` y PermisoAccionGuard bloquearía al usuario nuevo de TODO hasta
// que alguien le abra el modal de Permisos a mano. Mismo criterio que
// back4/scripts/migrate-backfill-permisos-existentes.js: el equivalente exacto
// de lo que ese rol podía hacer antes de PermisoAccionGuard, no el preset
// "Administrador" completo (le daría más de lo que un admin_smartclarity nuevo
// tuvo nunca) ni acceso extra a un 'usuario' nuevo.
export const PERMISOS_DEFECTO_ADMIN_SMARTCLARITY: Record<string, Record<string, boolean>> = {
  empresas: { crear: false, editar: true, eliminar: false },
  docEmpresa: { subir: true, editarCategoria: true, vencer: true, eliminar: true },
  centros: { crear: true, editar: true, eliminar: true },
  docCentro: { subir: true, editarCategoria: true, vencer: true, eliminar: true },
  proyectos: { crear: true, editar: true, eliminar: true },
  docProyecto: { subir: true, editarCategoria: true, vencer: true, eliminar: true },
  actividades: { crear: true, editar: true, eliminar: true },
  docActividad: { subir: true, editarCategoria: true, eliminar: true },
  activos: { crear: true, editar: true, eliminar: true },
  docActivo: { subir: true, editarCategoria: true, eliminar: true },
  catalogos: { crear: false, editar: false, eliminar: false },
  solicitudes: { crear: true, cambiarEstado: true, eliminar: true },
  usuarios: { crear: true, editar: true, eliminar: true, crearAdmin: false },
  noticias: { crear: false, eliminar: false },
};

export const PERMISOS_DEFECTO_USUARIO: Record<string, Record<string, boolean>> = {
  empresas: { crear: false, editar: false, eliminar: false },
  docEmpresa: { subir: true, editarCategoria: true, vencer: true, eliminar: false },
  centros: { crear: false, editar: false, eliminar: false },
  docCentro: { subir: true, editarCategoria: true, vencer: false, eliminar: true },
  proyectos: { crear: false, editar: false, eliminar: false },
  docProyecto: { subir: true, editarCategoria: true, vencer: false, eliminar: true },
  actividades: { crear: false, editar: false, eliminar: false },
  docActividad: { subir: false, editarCategoria: true, eliminar: false },
  activos: { crear: false, editar: false, eliminar: false },
  docActivo: { subir: false, editarCategoria: true, eliminar: false },
  catalogos: { crear: false, editar: false, eliminar: false },
  solicitudes: { crear: false, cambiarEstado: false, eliminar: false },
  usuarios: { crear: false, editar: false, eliminar: false, crearAdmin: false },
  noticias: { crear: false, eliminar: false },
};

export function permisosPorDefectoSegunRol(rol?: string): Record<string, Record<string, boolean>> {
  if (rol === 'super_admin' || rol === 'admin_smartclarity') return PERMISOS_DEFECTO_ADMIN_SMARTCLARITY;
  return PERMISOS_DEFECTO_USUARIO;
}