export interface Noticia {
  _id: string;
  titulo: string;
  enlace: string;
  resumen: string;
  imagen_url: string;
  creado_en: string;
}

export interface CreateNoticiaDto {
  titulo: string;
  enlace: string;
  resumen: string;
}
