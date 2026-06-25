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

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function encodeQuery(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

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

export function scoreChipVariantFn(pct: number): 'ok' | 'warning' | 'danger' {
  if (pct >= 80) return 'ok';
  if (pct >= 50) return 'warning';
  return 'danger';
}

export function scoreChipLabelFn(pct: number): string {
  if (pct >= 80) return 'Bueno';
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
