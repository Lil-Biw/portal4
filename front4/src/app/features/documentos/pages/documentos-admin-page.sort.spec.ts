import { describe, it, expect } from 'vitest';
import { ordenarFilasTodos, FilaDocTodos, OrdenTodos } from './documentos-admin-page.component';

function fila(partial: Omit<Partial<FilaDocTodos>, 'doc'> & { tipo: FilaDocTodos['tipo']; empresaNombre: string; doc: { nombre_display: string; subido_en?: string } }): FilaDocTodos {
  return {
    empresaId: 'e1',
    ...partial,
    doc: { _id: partial.doc.nombre_display, nombre_display: partial.doc.nombre_display, subido_en: partial.doc.subido_en, url: 'http://x' },
  } as FilaDocTodos;
}

describe('ordenarFilasTodos', () => {
  it('modo alfabetico ordena solo por nombre de documento, ignorando el tipo', () => {
    const filas = [
      fila({ tipo: 'proyecto', empresaNombre: 'Zeta', doc: { nombre_display: 'Beta.pdf' } }),
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'Alfa.pdf' } }),
    ];
    const resultado = ordenarFilasTodos(filas, 'alfabetico');
    expect(resultado.map(f => f.doc.nombre_display)).toEqual(['Alfa.pdf', 'Beta.pdf']);
  });

  it('modo nivel_empresa agrupa empresa -> centro -> proyecto', () => {
    const filas = [
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', proyectoNombre: 'P1', doc: { nombre_display: 'doc1' } }),
      fila({ tipo: 'centro', empresaNombre: 'Alfa', centroNombre: 'C1', doc: { nombre_display: 'doc2' } }),
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'doc3' } }),
    ];
    const resultado = ordenarFilasTodos(filas, 'nivel_empresa');
    expect(resultado.map(f => f.tipo)).toEqual(['empresa', 'centro', 'proyecto']);
  });

  it('modo nivel_centro agrupa centro -> proyecto -> empresa', () => {
    const filas = [
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'doc1' } }),
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', proyectoNombre: 'P1', doc: { nombre_display: 'doc2' } }),
      fila({ tipo: 'centro', empresaNombre: 'Alfa', centroNombre: 'C1', doc: { nombre_display: 'doc3' } }),
    ];
    const resultado = ordenarFilasTodos(filas, 'nivel_centro');
    expect(resultado.map(f => f.tipo)).toEqual(['centro', 'proyecto', 'empresa']);
  });

  it('modo nivel_proyecto agrupa proyecto -> empresa -> centro', () => {
    const filas = [
      fila({ tipo: 'centro', empresaNombre: 'Alfa', centroNombre: 'C1', doc: { nombre_display: 'doc1' } }),
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'doc2' } }),
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', proyectoNombre: 'P1', doc: { nombre_display: 'doc3' } }),
    ];
    const resultado = ordenarFilasTodos(filas, 'nivel_proyecto');
    expect(resultado.map(f => f.tipo)).toEqual(['proyecto', 'empresa', 'centro']);
  });

  it('dentro de un grupo ordena por la cadena jerarquica completa: empresa -> centro -> proyecto -> documento', () => {
    const filas = [
      fila({ tipo: 'proyecto', empresaNombre: 'Zeta', centroNombre: 'C1', proyectoNombre: 'PZ', doc: { nombre_display: 'docZ' } }),
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', centroNombre: 'C2', proyectoNombre: 'PA1', doc: { nombre_display: 'docA2' } }),
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', centroNombre: 'C1', proyectoNombre: 'PA2', doc: { nombre_display: 'docA1' } }),
    ];
    // modo nivel_proyecto: el grupo 'proyecto' va primero: dentro de él, orden por empresa, luego centro, luego proyecto, luego doc.
    const resultado = ordenarFilasTodos(filas, 'nivel_proyecto');
    expect(resultado.map(f => f.doc.nombre_display)).toEqual(['docA1', 'docA2', 'docZ']);
  });

  it('modo recientes ordena por fecha de subida descendente, documentos sin fecha al final', () => {
    const filas = [
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'viejo.pdf', subido_en: '2026-01-01T00:00:00.000Z' } }),
      fila({ tipo: 'centro', empresaNombre: 'Alfa', doc: { nombre_display: 'nuevo.pdf', subido_en: '2026-06-01T00:00:00.000Z' } }),
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', doc: { nombre_display: 'sin_fecha.pdf' } }),
    ];
    const resultado = ordenarFilasTodos(filas, 'recientes');
    expect(resultado.map(f => f.doc.nombre_display)).toEqual(['nuevo.pdf', 'viejo.pdf', 'sin_fecha.pdf']);
  });

  it('no muta el arreglo original', () => {
    const original = [
      fila({ tipo: 'proyecto', empresaNombre: 'Zeta', doc: { nombre_display: 'Beta.pdf' } }),
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'Alfa.pdf' } }),
    ];
    const copia = [...original];
    ordenarFilasTodos(original, 'alfabetico');
    expect(original).toEqual(copia);
  });
});
