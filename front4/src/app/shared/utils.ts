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

// Las actividades multi-día siempre van primero dentro del día: así (a) no se
// las come el tope de "primeras 3" de forma inconsistente día a día, y (b) el
// chip conector (bordes rectos + margen negativo, ver .cal-event-chip--inicio/
// medio/fin) queda en la misma fila en todas las celdas que ocupa.
export function ordenarMultiDiaPrimero<T extends { fecha: string; fecha_termino?: string | null }>(
  actividades: T[],
  dateKey: string,
): T[] {
  return actividades.slice().sort((a, b) => {
    const aMulti = posicionActividadEnDia(a, dateKey) !== 'unico';
    const bMulti = posicionActividadEnDia(b, dateKey) !== 'unico';
    if (aMulti === bMulti) return 0;
    return aMulti ? -1 : 1;
  });
}

// Actividades multi-día: en vez de un chip por celda que intenta simular
// continuidad, se calculan como una barra real por semana (grid-column de
// colStart a colEnd), superpuesta arriba de las celdas de esa semana — igual
// que Google Calendar. Si varias barras se solapan en columnas, se apilan en
// filas (empaquetado greedy por intervalos).

export interface BarraMultiDia<T> { actividad: T; colStart: number; colEnd: number; fila: number; }

export function barrasMultiDiaPorSemana<T extends { fecha: string; fecha_termino?: string | null }>(
  actividades: T[],
  semana: Date[],
): { barras: BarraMultiDia<T>[]; filas: number } {
  const inicioSemana = toDateKey(semana[0]);
  const finSemana    = toDateKey(semana[semana.length - 1]);
  const claves       = semana.map(toDateKey);

  const candidatas = actividades
    .filter(a => a.fecha_termino && a.fecha.slice(0, 10) !== a.fecha_termino.slice(0, 10))
    .map(a => {
      const inicio = a.fecha.slice(0, 10);
      const fin    = a.fecha_termino!.slice(0, 10);
      if (fin < inicioSemana || inicio > finSemana) return null;
      const colStart = inicio < inicioSemana ? 0 : claves.indexOf(inicio);
      const colEnd   = fin > finSemana ? claves.length - 1 : claves.indexOf(fin);
      return { actividad: a, colStart, colEnd, fila: 0 };
    })
    .filter((x): x is BarraMultiDia<T> => x !== null)
    .sort((a, b) => a.colStart - b.colStart || a.colEnd - b.colEnd);

  // Empaquetado greedy: cada barra toma la primera fila cuya última barra ya no se solape.
  const filaFin: number[] = [];
  for (const b of candidatas) {
    let colocada = false;
    for (let f = 0; f < filaFin.length; f++) {
      if (filaFin[f] < b.colStart) { b.fila = f; filaFin[f] = b.colEnd; colocada = true; break; }
    }
    if (!colocada) { b.fila = filaFin.length; filaFin.push(b.colEnd); }
  }

  return { barras: candidatas, filas: filaFin.length || 0 };
}

// ── Grilla horaria (vistas Semana/Día) ───────────────────────────────────────
// Posiciona actividades con hora en columnas lado a lado cuando se solapan en el
// tiempo, igual que un calendario tipo Google Calendar. Actividades sin hora no
// pasan por aquí (se muestran aparte en la franja "Sin hora").

export interface BloqueHorario<T> { actividad: T; col: number; colCount: number; inicioMin: number; duracionMin: number; }

function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

// Texto de hora para chips/tooltips/detalle: "09:00" o "09:00–10:30" si hay hora_termino.
export function rangoHora(a: { hora?: string | null; hora_termino?: string | null }): string {
  if (!a.hora) return '';
  return a.hora_termino ? `${a.hora}–${a.hora_termino}` : a.hora;
}

// Si la actividad tiene hora_termino posterior a hora, se usa la duración real;
// si no, se usa una duración visual fija (para que el bloque siga siendo visible).
function duracionMinDe(a: { hora: string; hora_termino?: string | null }, duracionVisualMin: number): number {
  if (!a.hora_termino) return duracionVisualMin;
  const dur = horaAMinutos(a.hora_termino) - horaAMinutos(a.hora);
  return dur > 0 ? dur : duracionVisualMin;
}

export function layoutPorHora<T extends { hora?: string | null; hora_termino?: string | null }>(
  actividades: T[],
  duracionVisualMin = 60,
): BloqueHorario<T>[] {
  interface Seg { actividad: T; inicio: number; fin: number; col: number; }

  const segs: Seg[] = actividades
    .filter((a): a is T & { hora: string } => !!a.hora)
    .map(a => ({ actividad: a, inicio: horaAMinutos(a.hora), fin: horaAMinutos(a.hora) + duracionMinDe(a, duracionVisualMin), col: 0 }))
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);

  // Agrupar en clusters de actividades cuyo rango de tiempo se solapa (transitivamente).
  const clusters: Seg[][] = [];
  let cur: Seg[] = [];
  let curEnd = -Infinity;
  for (const s of segs) {
    if (cur.length === 0) { cur = [s]; curEnd = s.fin; continue; }
    if (s.inicio < curEnd) { cur.push(s); curEnd = Math.max(curEnd, s.fin); }
    else { clusters.push(cur); cur = [s]; curEnd = s.fin; }
  }
  if (cur.length) clusters.push(cur);

  const out: BloqueHorario<T>[] = [];
  for (const cluster of clusters) {
    const colsEnd: number[] = [];
    for (const s of cluster) {
      let placed = false;
      for (let c = 0; c < colsEnd.length; c++) {
        if (s.inicio >= colsEnd[c]) { s.col = c; colsEnd[c] = s.fin; placed = true; break; }
      }
      if (!placed) { s.col = colsEnd.length; colsEnd.push(s.fin); }
    }
    const colCount = colsEnd.length || 1;
    for (const s of cluster) out.push({ actividad: s.actividad, col: s.col, colCount, inicioMin: s.inicio, duracionMin: s.fin - s.inicio });
  }
  return out;
}

// ── Orden de listas de documentos (Recientes / Alfabético) ──────────────────
// Compartido entre documentos-admin-page y documentos-consumidor-page: ambos
// tienen varios métodos que arman listas (planas o agrupadas) de documentos
// y necesitan el mismo criterio de orden sin duplicar el comparador en cada uno.

export type OrdenDocumentos = 'alfabetico' | 'recientes';

const collatorNombreDoc = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export function ordenarPorDocumento<T>(
  items: T[],
  orden: OrdenDocumentos,
  getDoc: (item: T) => { nombre_display: string; subido_en?: string },
): T[] {
  const resultado = [...items];
  if (orden === 'recientes') {
    resultado.sort((a, b) => {
      const da = getDoc(a).subido_en, db = getDoc(b).subido_en;
      return (db ? Date.parse(db) : 0) - (da ? Date.parse(da) : 0);
    });
  } else {
    resultado.sort((a, b) => collatorNombreDoc.compare(getDoc(a).nombre_display, getDoc(b).nombre_display));
  }
  return resultado;
}

// ── Límite de tamaño de archivo (documentos) ─────────────────────────────────
// Debe coincidir con el límite aplicado en el backend (S3Service / multer).

export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Confirmación de eliminaciones ────────────────────────────────────────────
// Todos los botones de borrar del portal deben pasar por aquí antes de disparar
// la llamada HTTP, para que el usuario confirme explícitamente la acción.

export function confirmarEliminacion(nombre: string): boolean {
  return window.confirm(`¿Seguro que desea eliminar "${nombre}"? Esta acción es permanente.`);
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
  if (solicitudes.length === 0 && docsActivos === 0)
    return { pct: 50, aprobados: 0, revision: 0, vencido: docsVencidos, rechazado: 0, pendiente: 0, total: 0 };
  const aprobados = solicitudes.filter(s => s.estado === 'aprobado').length + docsActivos;
  const revision  = solicitudes.filter(s => s.estado === 'revision').length;
  const rechazado = solicitudes.filter(s => s.estado === 'rechazado').length;
  const pendiente = solicitudes.filter(s => s.estado === 'pendiente').length;
  // docsVencidos se expone para el recuadro informativo "Vencidos" pero no entra al
  // total/pct: algunas vistas (listas) nunca cargan el listado de vencidos y otras
  // (detalle) sí, así que si contara para el % el mismo centro/proyecto mostraba un
  // porcentaje distinto según la vista — bug reportado por el usuario.
  const total = solicitudes.length + docsActivos;
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
