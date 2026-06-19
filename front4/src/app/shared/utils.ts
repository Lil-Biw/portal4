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

export function calcularScoreDocumental(solicitudes: { estado: string }[]): ScoreDocumental {
  if (solicitudes.length === 0)
    return { pct: 0, aprobados: 0, revision: 0, vencido: 0, rechazado: 0, pendiente: 0, total: 0 };
  const aprobados = solicitudes.filter(s => s.estado === 'aprobado').length;
  const revision  = solicitudes.filter(s => s.estado === 'revision').length;
  const vencido   = solicitudes.filter(s => s.estado === 'vencido').length;
  const rechazado = solicitudes.filter(s => s.estado === 'rechazado').length;
  const pendiente = solicitudes.filter(s => s.estado === 'pendiente').length;
  return {
    pct: Math.round((aprobados / solicitudes.length) * 100),
    aprobados, revision, vencido, rechazado, pendiente,
    total: solicitudes.length,
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
