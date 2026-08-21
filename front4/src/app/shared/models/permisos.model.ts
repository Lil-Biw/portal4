import type { RolUsuario } from './usuario.model';

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
  color?: string;
  colorSuave?: string;
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
  { key: 'empresas', titulo: 'Empresas', soloInterno: true, color: '#0075a8', colorSuave: '#82c3e0', rows: [
    { key: 'crear', label: 'Crear empresa', hint: 'Alta de nuevas empresas cliente' },
    { key: 'editar', label: 'Editar empresa', hint: 'Datos generales, score smartclarity, configuración de gráfico' },
    { key: 'eliminar', label: 'Eliminar empresa', hint: 'Baja de una empresa' },
  ] },
  { key: 'docEmpresa', titulo: 'Documentos de empresa', color: '#58a8c8', colorSuave: '#a8d4e8', rows: [
    { key: 'subir', label: 'Subir documento', hint: 'Adjuntar archivos a la ficha de la empresa' },
    { key: 'editarCategoria', label: 'Editar categoría', hint: 'Reclasificar un documento ya subido' },
    { key: 'vencer', label: 'Marcar como vencido', hint: 'Forzar el estado antes de la fecha de vencimiento' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'centros', titulo: 'Centros de costo', color: '#f07c1b', colorSuave: '#f8b173', rows: [
    { key: 'crear', label: 'Crear centro' },
    { key: 'editar', label: 'Editar centro', hint: 'Datos y score smartclarity' },
    { key: 'eliminar', label: 'Eliminar centro' },
  ] },
  { key: 'docCentro', titulo: 'Documentos de centro', color: '#f5a15f', colorSuave: '#faced3', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'editarCategoria', label: 'Editar categoría' },
    { key: 'vencer', label: 'Marcar como vencido' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'proyectos', titulo: 'Proyectos', color: '#2e9e5b', colorSuave: '#7cc29a', rows: [
    { key: 'crear', label: 'Crear proyecto' },
    { key: 'editar', label: 'Editar proyecto' },
    { key: 'eliminar', label: 'Eliminar proyecto' },
  ] },
  { key: 'docProyecto', titulo: 'Documentos de proyecto', color: '#5fbb8d', colorSuave: '#a8e0c4', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'editarCategoria', label: 'Editar categoría' },
    { key: 'vencer', label: 'Marcar como vencido' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'actividades', titulo: 'Actividades', color: '#7c3aed', colorSuave: '#a67fe8', rows: [
    { key: 'crear', label: 'Crear actividad', hint: 'Ej: diferenciar sus propias actividades de las nuestras' },
    { key: 'editar', label: 'Editar actividad' },
    { key: 'eliminar', label: 'Eliminar actividad' },
  ] },
  { key: 'docActividad', titulo: 'Documentos de actividad', color: '#9f7ce8', colorSuave: '#cbb2f2', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'activos', titulo: 'Activos', color: '#0d9488', colorSuave: '#47c0b5', rows: [
    { key: 'crear', label: 'Crear activo', hint: 'Ej: agregar activos propios, separados de los nuestros' },
    { key: 'editar', label: 'Editar activo' },
    { key: 'eliminar', label: 'Eliminar activo' },
  ] },
  { key: 'docActivo', titulo: 'Documentos de activo', color: '#47c9bd', colorSuave: '#9be0d9', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'editarCategoria', label: 'Editar categoría', hint: 'Renombrar un documento ya subido' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'catalogos', titulo: 'Catálogos (tipos de actividad, activo, proyecto)', soloInterno: true, color: '#64748b', colorSuave: '#9aa7bb', rows: [
    { key: 'crear', label: 'Crear tipo', hint: 'Ícono y color — es catálogo compartido entre todas las empresas' },
    { key: 'editar', label: 'Editar tipo' },
    { key: 'eliminar', label: 'Eliminar tipo' },
  ] },
  { key: 'solicitudes', titulo: 'Solicitudes', soloInterno: true, color: '#e11d48', colorSuave: '#f0789a', rows: [
    { key: 'crear', label: 'Crear solicitud' },
    { key: 'cambiarEstado', label: 'Cambiar estado', hint: 'Aprobar, rechazar, poner en revisión' },
    { key: 'eliminar', label: 'Eliminar solicitud' },
  ] },
  { key: 'usuarios', titulo: 'Usuarios', soloInterno: true, color: '#4f46e5', colorSuave: '#8b85ec', rows: [
    { key: 'crear', label: 'Crear usuario', hint: 'Ej: sumar gente de su propia empresa sin tener que llamarnos' },
    { key: 'editar', label: 'Editar usuario' },
    { key: 'eliminar', label: 'Eliminar usuario' },
    { key: 'crearAdmin', label: 'Crear administrador', hint: '⚠ crea otra cuenta con este mismo nivel de acceso', soloAdmin: true },
  ] },
  { key: 'noticias', titulo: 'Noticias', soloInterno: true, color: '#475569', colorSuave: '#7d8ba3', rows: [
    { key: 'crear', label: 'Publicar noticia' },
    { key: 'eliminar', label: 'Eliminar noticia' },
  ] },
];

export const PERMISOS_DEFECTO_ADMIN_SMARTCLARITY: PermisosUsuario = {
  empresas: { crear: false, editar: true, eliminar: false },
  docEmpresa: { subir: true, editarCategoria: true, vencer: true, eliminar: true },
  centros: { crear: true, editar: true, eliminar: true },
  docCentro: { subir: true, editarCategoria: true, vencer: true, eliminar: true },
  proyectos: { crear: true, editar: true, eliminar: true },
  docProyecto: { subir: true, editarCategoria: true, vencer: true, eliminar: true },
  actividades: { crear: true, editar: true, eliminar: true },
  docActividad: { subir: true, eliminar: true },
  activos: { crear: true, editar: true, eliminar: true },
  docActivo: { subir: true, editarCategoria: true, eliminar: true },
  catalogos: { crear: false, editar: false, eliminar: false },
  solicitudes: { crear: true, cambiarEstado: true, eliminar: true },
  usuarios: { crear: true, editar: true, eliminar: true, crearAdmin: false },
  noticias: { crear: false, eliminar: false },
};

export const PERMISOS_DEFECTO_USUARIO: PermisosUsuario = {
  empresas: { crear: false, editar: false, eliminar: false },
  docEmpresa: { subir: true, editarCategoria: true, vencer: true, eliminar: false },
  centros: { crear: false, editar: false, eliminar: false },
  docCentro: { subir: true, editarCategoria: true, vencer: false, eliminar: true },
  proyectos: { crear: false, editar: false, eliminar: false },
  docProyecto: { subir: true, editarCategoria: true, vencer: false, eliminar: true },
  actividades: { crear: false, editar: false, eliminar: false },
  docActividad: { subir: false, eliminar: false },
  activos: { crear: false, editar: false, eliminar: false },
  docActivo: { subir: false, editarCategoria: true, eliminar: false },
  catalogos: { crear: false, editar: false, eliminar: false },
  solicitudes: { crear: false, cambiarEstado: false, eliminar: false },
  usuarios: { crear: false, editar: false, eliminar: false, crearAdmin: false },
  noticias: { crear: false, eliminar: false },
};

export function permisosPorDefectoSegunRol(rol: RolUsuario): PermisosUsuario {
  if (rol === 'super_admin' || rol === 'admin_smartclarity') {
    return PERMISOS_DEFECTO_ADMIN_SMARTCLARITY;
  }
  return PERMISOS_DEFECTO_USUARIO;
}

export function permisosIguales(a?: PermisosUsuario, b?: PermisosUsuario): boolean {
  const sa = a ?? {};
  const sb = b ?? {};
  const secciones = new Set([...Object.keys(sa), ...Object.keys(sb)]);
  for (const seccion of secciones) {
    const va = sa[seccion] ?? {};
    const vb = sb[seccion] ?? {};
    const ka = Object.keys(va);
    const kb = Object.keys(vb);
    if (ka.length !== kb.length) return false;
    for (const key of ka) if (va[key] !== vb[key]) return false;
  }
  return true;
}

export function filaAplica(seccion: PermisoSeccion, row: PermisoRow, contextoCompleto: boolean): boolean {
  if (contextoCompleto) return true;
  if (seccion.soloInterno) return false;
  if (row.soloAdmin) return false;
  return true;
}

// Convierte un objeto de permisos posiblemente incompleto (ej. un rol nunca
// tocado en el editor, que queda en `{}` porque los switches ya se veían
// "apagados" por defecto) en uno con boolean explícito en cada fila aplicable.
// Sin esto, una fila ausente cae al fallback de `tienePermiso()`/
// `PermisoAccionGuard` (permiso por defecto del ROL del usuario destino) en
// vez de quedar realmente denegada — que es exactamente lo que rompía
// "Aplicar rol": un rol "sin permisos" guardado como `{}` no le quitaba nada
// a nadie, porque cada fila ausente se resolvía con el default de su rol.
export function normalizarPermisos(
  valores: PermisosUsuario,
  contextoCompleto: boolean,
): PermisosUsuario {
  const resultado: PermisosUsuario = {};
  for (const seccion of PERM_SCHEMA) {
    for (const row of seccion.rows) {
      if (!filaAplica(seccion, row, contextoCompleto)) continue;
      resultado[seccion.key] ??= {};
      resultado[seccion.key][row.key] = valores?.[seccion.key]?.[row.key] === true;
    }
  }
  return resultado;
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
