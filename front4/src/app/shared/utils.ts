// ── Suscripción a notificaciones (admins) ────────────────────────────────────
// Misma fórmula que resolverAdminsSuscritos() en back4/common/helpers/notificar-documento.helper.ts:
// notificar_todas_empresas !== false (default histórico true) implica "recibe todo";
// si no, se revisa si el scope activo (empresa/centro/proyecto) está en sus listas puntuales.
// Solo aplica a admin_smartclarity/super_admin — el rol 'usuario' no usa estos campos.

export function usuarioEstaSuscrito(
  u: { notificar_todas_empresas?: boolean; empresas_suscritas?: unknown[]; centros_suscritos?: unknown[]; proyectos_suscritos?: unknown[] },
  empresaId?: string,
  centroId?: string,
  proyectoId?: string,
): boolean {
  if (u.notificar_todas_empresas !== false) return true;
  if (empresaId && (u.empresas_suscritas ?? []).some(id => asId(id) === empresaId)) return true;
  if (centroId && (u.centros_suscritos ?? []).some(id => asId(id) === centroId)) return true;
  if (proyectoId && (u.proyectos_suscritos ?? []).some(id => asId(id) === proyectoId)) return true;
  return false;
}

export function asId(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // Mongoose populated object: { _id: '...' }
    if ('_id' in value) return String((value as Record<string, unknown>)['_id']);
    // MongoDB extended JSON: { $oid: '...' }
    if ('$oid' in value) return String((value as Record<string, unknown>)['$oid']);
    // Mongoose ObjectId instance: has toString()
    return String(value);
  }
  return String(value);
}

// Fecha + hora en horario local (a diferencia de las fechas de calendario tipo
// fecha_inicio/fecha_fin, subido_en/creado_en/actualizado_en son instantes reales).
export function formatFechaHora(fecha?: string): string {
  if (!fecha) return '—';
  const d = new Date(fecha);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const horas = String(d.getHours()).padStart(2, '0');
  const mins  = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}, ${horas}:${mins}`;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Una actividad puede abarcar varios días (fecha → fecha_termino). Cae en un día
// del calendario si esa fecha está dentro del rango, inclusive en ambos extremos.
export function actividadEnDia(a: { fecha: string; fecha_termino?: string | null }, dateKey: string): boolean {
  const inicio = a.fecha.slice(0, 10);
  const fin    = a.fecha_termino ? a.fecha_termino.slice(0, 10) : inicio;
  return dateKey >= inicio && dateKey <= fin;
}

// Posición del día dentro del rango de una actividad multi-día, para marcar
// visualmente en el calendario que el chip continúa hacia el día siguiente/anterior.
export type PosicionRangoActividad = 'unico' | 'inicio' | 'medio' | 'fin';

export function posicionActividadEnDia(
  a: { fecha: string; fecha_termino?: string | null },
  dateKey: string,
): PosicionRangoActividad {
  const inicio = a.fecha.slice(0, 10);
  const fin    = a.fecha_termino ? a.fecha_termino.slice(0, 10) : inicio;
  if (inicio === fin)    return 'unico';
  if (dateKey === inicio) return 'inicio';
  if (dateKey === fin)    return 'fin';
  return 'medio';
}

// ── Límite de tamaño de archivo (documentos) ─────────────────────────────────
// Debe coincidir con el límite aplicado en el backend (S3Service / multer).

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function encodeQuery(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

// ── Auto-cierre de notificaciones ────────────────────────────────────────────
// Los banners de status (éxito/error) deben desaparecer solos tras un tiempo
// en vez de quedar pegados en pantalla hasta la próxima acción del usuario.

export const NOTIFY_COOLDOWN_MS = 10_000;

// ── Score documental ─────────────────────────────────────────────────────────

export interface ScoreDocumental {
  pct: number; aprobados: number; revision: number;
  vencido: number; rechazado: number; pendiente: number; total: number;
}

export function calcularScoreDocumental(
  solicitudes: { estado: string }[],
  docsActivos = 0,
  docsVencidos = 0,
): ScoreDocumental {
  if (solicitudes.length === 0 && docsActivos === 0 && docsVencidos === 0)
    return { pct: 50, aprobados: 0, revision: 0, vencido: 0, rechazado: 0, pendiente: 0, total: 0 };
  const aprobados = solicitudes.filter(s => s.estado === 'aprobado').length + docsActivos;
  const revision  = solicitudes.filter(s => s.estado === 'revision').length;
  const rechazado = solicitudes.filter(s => s.estado === 'rechazado').length;
  const pendiente = solicitudes.filter(s => s.estado === 'pendiente').length;
  const total     = solicitudes.length + docsActivos + docsVencidos;
  return {
    pct: total > 0 ? Math.round(aprobados / total * 100) : 50,
    aprobados, revision, vencido: docsVencidos, rechazado, pendiente, total,
  };
}

// Escala unificada de color para toda barra/arco/chip de porcentaje de la app
// (resumen, donut-arc, stat-chip, score documental de inicio/mi-ficha).
// Mismos cortes (75/50) y mismos colores en las tres piezas — antes divergían
// (donut usaba 75/50/25 con azul intermedio, chip usaba 80/50 con 'ok' azul).
export function porcentajeColorFn(pct: number): string {
  if (pct >= 75) return '#16a34a';
  if (pct >= 50) return '#d97706';
  return '#ef4444';
}

export function scoreChipVariantFn(pct: number): 'ok' | 'warning' | 'danger' {
  if (pct >= 75) return 'ok';
  if (pct >= 50) return 'warning';
  return 'danger';
}

export function scoreChipLabelFn(pct: number): string {
  if (pct >= 75) return 'Bueno';
  if (pct >= 50) return 'Regular';
  return 'Bajo';
}

// ── Detección automática de categoría por nombre de archivo ─────────────────

const CATEGORIA_KEYWORDS: { cat: string; kws: string[] }[] = [
  { cat: '[AGUA] Boleta/Factura',         kws: ['agua'] },
  { cat: '[COMBUSTIBLE] Boleta/Factura',  kws: ['combustible', 'bencina', 'diesel', 'gasolina', 'petroleo'] },
  { cat: '[BNE] Carpeta Tributaria',      kws: ['tributari', 'carpeta tributaria', 'sii'] },
  { cat: '[BNE] Ingresos por Ventas',     kws: ['ingreso', 'venta', 'facturacion'] },
  { cat: '[ENERGIA] Boleta/Factura/BNE',  kws: ['energia', 'energía', 'electr', 'enel', 'cge', 'saesa', 'frontel'] },
  { cat: '[GAS] Boleta/Factura',          kws: ['gas', 'metrogas', 'gasco', 'abastible'] },
  { cat: 'Auditorías',                    kws: ['auditoria', 'auditoría', 'audit', 'inspeccion', 'revision externa'] },
  { cat: 'Certificados',                  kws: ['certificado', 'certificacion', 'cert', 'titulo', 'diploma'] },
  { cat: 'Contratos',                     kws: ['contrato', 'acuerdo', 'convenio', 'adendum', 'anexo contrato'] },
  { cat: 'Informes',                      kws: ['informe', 'reporte', 'report', 'resumen ejecutivo', 'memoria'] },
  { cat: 'Lista de Activos',              kws: ['lista activo', 'inventario activo', 'registro activo', 'activos'] },
  { cat: 'OT',                            kws: ['orden de trabajo', 'orden trabajo', ' ot '] }, // ' ot ' funciona gracias al padding
  { cat: 'Planos/Diagramas',              kws: ['plano', 'diagrama', 'layout', 'croquis', 'esquema'] },
];

export function detectarCategoriaDocumento(nombreArchivo: string): string | null {
  // Pad con espacios para que los keywords con bordes de palabra funcionen al inicio y final
  const norm = ' ' + nombreArchivo
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[-_.,;()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ';

  let mejor: { cat: string; score: number } | null = null;
  for (const { cat, kws } of CATEGORIA_KEYWORDS) {
    let score = 0;
    for (const kw of kws) {
      if (norm.includes(kw)) score += kw.length;
    }
    if (score > 0 && (!mejor || score > mejor.score)) mejor = { cat, score };
  }
  return mejor?.cat ?? 'Otros';
}

export function colorEstadoSolicitud(estado: string): string {
  const map: Record<string, string> = {
    pendiente: '#0095d6', revision: '#f59e0b', aprobado: '#22c55e',
    rechazado: '#ef4444', vencido:  '#9ca3af',
  };
  return map[estado] ?? '#9ca3af';
}

export function estadoStyleFn(estado: string): string {
  const map: Record<string, string> = {
    pendiente: 'background:#fef3c7;color:#b45309',
    revision:  'background:#dbeafe;color:#1e40af',
    aprobado:  'background:#dcfce7;color:#15803d',
    rechazado: 'background:#fee2e2;color:#dc2626',
    vencido:   'background:#f3f4f6;color:#374151',
  };
  return map[estado] ?? 'background:#f3f4f6;color:#374151';
}
