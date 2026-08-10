import { DocActivo } from '../../shared/models/activo.model';

const FORMATOS_IMAGEN: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/gif': 'GIF',
};

export function esImagenDoc(doc: DocActivo): boolean {
  return !!doc.tipo_mime?.startsWith('image/');
}

export function formatoImagen(tipoMime?: string): string {
  if (!tipoMime) return '';
  return FORMATOS_IMAGEN[tipoMime] ?? tipoMime.split('/')[1]?.toUpperCase() ?? '';
}
