import { describe, it, expect } from 'vitest';
import { esImagenDoc, formatoImagen } from './galeria-fotos.utils';
import { DocActivo } from '../../shared/models/activo.model';

function doc(tipo_mime?: string): DocActivo {
  return { _id: '1', nombre: 'a', nombre_display: 'a', tipo_mime };
}

describe('esImagenDoc', () => {
  it('identifica documentos de imagen por tipo_mime', () => {
    expect(esImagenDoc(doc('image/png'))).toBe(true);
    expect(esImagenDoc(doc('image/jpeg'))).toBe(true);
  });

  it('descarta documentos que no son imagen', () => {
    expect(esImagenDoc(doc('application/pdf'))).toBe(false);
    expect(esImagenDoc(doc(undefined))).toBe(false);
  });
});

describe('formatoImagen', () => {
  it('mapea mimetypes conocidos a su etiqueta corta', () => {
    expect(formatoImagen('image/jpeg')).toBe('JPG');
    expect(formatoImagen('image/png')).toBe('PNG');
    expect(formatoImagen('image/webp')).toBe('WEBP');
    expect(formatoImagen('image/gif')).toBe('GIF');
  });

  it('deriva una etiqueta desde el subtipo cuando el mimetype no está en la tabla', () => {
    expect(formatoImagen('image/bmp')).toBe('BMP');
  });

  it('retorna vacío cuando no hay mimetype', () => {
    expect(formatoImagen(undefined)).toBe('');
  });
});
