export type EstadoNewsletter =
  | 'borrador'
  | 'pendiente_aprobacion'
  | 'aprobado'
  | 'rechazado'
  | 'enviado';

export interface ImagenNewsletter {
  _id: string;
  url: string;
}

export interface BloqueNewsletter {
  titulo: string;
  cuerpo: string;
  imagenes: ImagenNewsletter[];
}

export interface Newsletter {
  _id: string;
  titulo: string;
  tagline: string;
  bloques: BloqueNewsletter[];
  estado: EstadoNewsletter;
  aprobador_email: string;
  aprobado_por?: string;
  aprobado_en?: string;
  motivo_rechazo: string;
  enviado_en?: string;
  creado_en: string;
}

export interface BloqueNewsletterDto {
  titulo: string;
  cuerpo: string;
}

export interface CreateNewsletterDto {
  titulo: string;
  tagline?: string;
  bloques: BloqueNewsletterDto[];
}

export type UpdateNewsletterDto = Partial<CreateNewsletterDto>;

export interface ImagenSubidaRespuesta {
  _id: string;
  url: string;
}

export interface SugerenciaNewsletter {
  _id: string;
  mensaje: string;
  categoria: string;
  autor_id: { _id: string; nombre: string; email: string; rol: string };
  creado_en: string;
}

export const NEWSLETTER_COLOR = '#162640';

export const ESTADO_LABEL: Record<EstadoNewsletter, string> = {
  borrador: 'Borrador',
  pendiente_aprobacion: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  enviado: 'Enviado',
};

export const ESTADO_ICON: Record<EstadoNewsletter, string> = {
  borrador: '📝',
  pendiente_aprobacion: '⏳',
  aprobado: '✅',
  rechazado: '❌',
  enviado: '📤',
};

export const CATEGORIAS_SUGERENCIA = ['Cumpleaños', 'Proyecto', 'Capacitación', 'Logro', 'Otro'];
