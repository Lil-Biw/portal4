import { describe, it, expect } from 'vitest';
import { contarNivelEnArbol } from './documentos-admin-page.component';
import { NodoBusqueda, DocBusquedaItem } from '../documentos.service';

function doc(id: string): DocBusquedaItem {
  return { _id: id, nombre_display: `${id}.pdf`, url: 'http://x' };
}

function nodo(partial: Partial<NodoBusqueda> & { _id: string; nivel: NodoBusqueda['nivel'] }): NodoBusqueda {
  return {
    nombre: partial._id,
    empresa_id: 'e1',
    empresa_nombre: 'Empresa 1',
    documentos: [],
    centros: [],
    proyectos: [],
    ...partial,
  };
}

describe('contarNivelEnArbol', () => {
  it('cuenta los documentos propios de cada nivel, ignorando los de otros niveles', () => {
    const arbol: NodoBusqueda[] = [
      nodo({
        _id: 'e1', nivel: 'empresa', documentos: [doc('d1'), doc('d2')],
        centros: [
          nodo({ _id: 'c1', nivel: 'centro', documentos: [doc('d3')] }),
        ],
      }),
    ];
    expect(contarNivelEnArbol(arbol, 'empresa')).toBe(2);
    expect(contarNivelEnArbol(arbol, 'centro')).toBe(1);
    expect(contarNivelEnArbol(arbol, 'proyecto')).toBe(0);
  });

  it('suma documentos de varias empresas y centros', () => {
    const arbol: NodoBusqueda[] = [
      nodo({
        _id: 'e1', nivel: 'empresa', documentos: [doc('d1')],
        centros: [
          nodo({ _id: 'c1', nivel: 'centro', documentos: [doc('d2'), doc('d3')] }),
          nodo({ _id: 'c2', nivel: 'centro', documentos: [doc('d4')] }),
        ],
      }),
      nodo({ _id: 'e2', nivel: 'empresa', documentos: [doc('d5')] }),
    ];
    expect(contarNivelEnArbol(arbol, 'empresa')).toBe(2);
    expect(contarNivelEnArbol(arbol, 'centro')).toBe(3);
  });

  it('dedupea un proyecto que aparece repetido bajo varios centros (mismos documentos)', () => {
    const docsProyecto = [doc('p1'), doc('p2')];
    const arbol: NodoBusqueda[] = [
      nodo({
        _id: 'e1', nivel: 'empresa', documentos: [],
        centros: [
          nodo({
            _id: 'c1', nivel: 'centro', documentos: [],
            proyectos: [nodo({ _id: 'py1', nivel: 'proyecto', documentos: docsProyecto })],
          }),
          nodo({
            _id: 'c2', nivel: 'centro', documentos: [],
            proyectos: [nodo({ _id: 'py1', nivel: 'proyecto', documentos: docsProyecto })],
          }),
        ],
      }),
    ];
    // py1 aparece 2 veces (una por cada centro) con los mismos 2 documentos:
    // el conteo debe ser 2, no 4.
    expect(contarNivelEnArbol(arbol, 'proyecto')).toBe(2);
  });

  it('devuelve 0 con un árbol vacío', () => {
    expect(contarNivelEnArbol([], 'empresa')).toBe(0);
  });
});
