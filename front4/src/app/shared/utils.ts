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
