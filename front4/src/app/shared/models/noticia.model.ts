export type SeccionNoticia = 'novedades' | 'normativas' | 'anuncios';

export interface Noticia {
  _id: string;
  titulo: string;
  enlace: string;
  resumen: string;
  seccion: SeccionNoticia;
  imagen_url: string;
  creado_en: string;
}

export interface CreateNoticiaDto {
  titulo: string;
  enlace: string;
  resumen: string;
  seccion: SeccionNoticia;
}

export const SECCIONES: { value: SeccionNoticia; label: string; labelMin: string; color: string }[] = [
  { value: 'novedades',  label: 'Novedades',  labelMin: 'novedad',   color: '#0095d6' },
  { value: 'normativas', label: 'Normativas', labelMin: 'normativa', color: '#d97706' },
  { value: 'anuncios',   label: 'Anuncios',   labelMin: 'anuncio',   color: '#16a34a' },
];
