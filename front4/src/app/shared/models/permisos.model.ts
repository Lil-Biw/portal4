export interface PermisoRow {
  key: string;
  label: string;
  hint?: string;
  soloAdmin?: boolean;
}

export interface PermisoSeccion {
  key: string;
  titulo: string;
  soloInterno?: boolean;
  rows: PermisoRow[];
}

export type PermisosUsuario = Record<string, Record<string, boolean>>;

export interface Rol {
  _id: string;
  nombre: string;
  permisos: PermisosUsuario;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateRolDto {
  nombre: string;
  permisos: PermisosUsuario;
}

export interface UpdateRolDto {
  nombre?: string;
  permisos?: PermisosUsuario;
}

export const PERM_SCHEMA: PermisoSeccion[] = [
  { key: 'empresas', titulo: 'Empresas', soloInterno: true, rows: [
    { key: 'crear', label: 'Crear empresa', hint: 'Alta de nuevas empresas cliente' },
    { key: 'editar', label: 'Editar empresa', hint: 'Datos generales, score smartclarity, configuración de gráfico' },
    { key: 'eliminar', label: 'Eliminar empresa', hint: 'Baja de una empresa' },
  ] },
  { key: 'docEmpresa', titulo: 'Documentos de empresa', rows: [
    { key: 'subir', label: 'Subir documento', hint: 'Adjuntar archivos a la ficha de la empresa' },
    { key: 'editarCategoria', label: 'Editar categoría', hint: 'Reclasificar un documento ya subido' },
    { key: 'vencer', label: 'Marcar como vencido', hint: 'Forzar el estado antes de la fecha de vencimiento' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'centros', titulo: 'Centros de costo', rows: [
    { key: 'crear', label: 'Crear centro' },
    { key: 'editar', label: 'Editar centro', hint: 'Datos y score smartclarity' },
    { key: 'eliminar', label: 'Eliminar centro' },
  ] },
  { key: 'docCentro', titulo: 'Documentos de centro', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'editarCategoria', label: 'Editar categoría' },
    { key: 'vencer', label: 'Marcar como vencido' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'proyectos', titulo: 'Proyectos', rows: [
    { key: 'crear', label: 'Crear proyecto' },
    { key: 'editar', label: 'Editar proyecto' },
    { key: 'eliminar', label: 'Eliminar proyecto' },
  ] },
  { key: 'docProyecto', titulo: 'Documentos de proyecto', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'editarCategoria', label: 'Editar categoría' },
    { key: 'vencer', label: 'Marcar como vencido' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'actividades', titulo: 'Actividades', rows: [
    { key: 'crear', label: 'Crear actividad', hint: 'Ej: diferenciar sus propias actividades de las nuestras' },
    { key: 'editar', label: 'Editar actividad' },
    { key: 'eliminar', label: 'Eliminar actividad' },
  ] },
  { key: 'docActividad', titulo: 'Documentos de actividad', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'activos', titulo: 'Activos', rows: [
    { key: 'crear', label: 'Crear activo', hint: 'Ej: agregar activos propios, separados de los nuestros' },
    { key: 'editar', label: 'Editar activo' },
    { key: 'eliminar', label: 'Eliminar activo' },
  ] },
  { key: 'docActivo', titulo: 'Documentos de activo', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'catalogos', titulo: 'Catálogos (tipos de actividad, activo, proyecto)', soloInterno: true, rows: [
    { key: 'crear', label: 'Crear tipo', hint: 'Ícono y color — es catálogo compartido entre todas las empresas' },
    { key: 'editar', label: 'Editar tipo' },
    { key: 'eliminar', label: 'Eliminar tipo' },
  ] },
  { key: 'solicitudes', titulo: 'Solicitudes', rows: [
    { key: 'crear', label: 'Crear solicitud' },
    { key: 'cambiarEstado', label: 'Cambiar estado', hint: 'Aprobar, rechazar, poner en revisión' },
    { key: 'eliminar', label: 'Eliminar solicitud' },
  ] },
  { key: 'usuarios', titulo: 'Usuarios', rows: [
    { key: 'crear', label: 'Crear usuario', hint: 'Ej: sumar gente de su propia empresa sin tener que llamarnos' },
    { key: 'editar', label: 'Editar usuario' },
    { key: 'eliminar', label: 'Eliminar usuario' },
    { key: 'crearAdmin', label: 'Crear administrador', hint: '⚠ crea otra cuenta con este mismo nivel de acceso', soloAdmin: true },
  ] },
  { key: 'noticias', titulo: 'Noticias', soloInterno: true, rows: [
    { key: 'crear', label: 'Publicar noticia' },
    { key: 'eliminar', label: 'Eliminar noticia' },
  ] },
];

export function filaAplica(seccion: PermisoSeccion, row: PermisoRow, contextoCompleto: boolean): boolean {
  if (contextoCompleto) return true;
  if (seccion.soloInterno) return false;
  if (row.soloAdmin) return false;
  return true;
}

export function contarPermisosActivos(
  valores: PermisosUsuario,
  contextoCompleto: boolean,
): { activos: number; total: number } {
  let activos = 0;
  let total = 0;
  for (const seccion of PERM_SCHEMA) {
    for (const row of seccion.rows) {
      if (!filaAplica(seccion, row, contextoCompleto)) continue;
      total++;
      if (valores?.[seccion.key]?.[row.key]) activos++;
    }
  }
  return { activos, total };
}
