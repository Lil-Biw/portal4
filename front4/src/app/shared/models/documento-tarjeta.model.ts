export type EstadoDocumentoTarjeta = 'listo' | 'subiendo' | 'pendiente' | 'eliminando' | 'error';

export interface DocumentoTarjeta {
  id: string;
  nombre: string;
  tipoContenido: 'archivo' | 'link';
  linkUrl?: string;
  estado: EstadoDocumentoTarjeta;
  categoria?: string;
}
