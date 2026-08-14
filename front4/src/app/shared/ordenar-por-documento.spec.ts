import { describe, it, expect } from 'vitest';
import { ordenarPorDocumento } from './utils';

interface Item { nombre_display: string; subido_en?: string; }

describe('ordenarPorDocumento', () => {
  it('modo alfabetico ordena por nombre_display con collator es', () => {
    const items: Item[] = [
      { nombre_display: 'Zeta.pdf' },
      { nombre_display: 'alfa.pdf' },
      { nombre_display: 'Beta.pdf' },
    ];
    const resultado = ordenarPorDocumento(items, 'alfabetico', i => i);
    expect(resultado.map(i => i.nombre_display)).toEqual(['alfa.pdf', 'Beta.pdf', 'Zeta.pdf']);
  });

  it('modo recientes ordena por subido_en descendente, sin fecha al final', () => {
    const items: Item[] = [
      { nombre_display: 'viejo.pdf', subido_en: '2026-01-01T00:00:00.000Z' },
      { nombre_display: 'nuevo.pdf', subido_en: '2026-06-01T00:00:00.000Z' },
      { nombre_display: 'sin_fecha.pdf' },
    ];
    const resultado = ordenarPorDocumento(items, 'recientes', i => i);
    expect(resultado.map(i => i.nombre_display)).toEqual(['nuevo.pdf', 'viejo.pdf', 'sin_fecha.pdf']);
  });

  it('usa el accesor getDoc para ordenar items envueltos (ej. filas agregadas)', () => {
    const filas = [
      { doc: { nombre_display: 'Zeta.pdf' } as Item, empresaId: 'e1' },
      { doc: { nombre_display: 'Alfa.pdf' } as Item, empresaId: 'e2' },
    ];
    const resultado = ordenarPorDocumento(filas, 'alfabetico', f => f.doc);
    expect(resultado.map(f => f.doc.nombre_display)).toEqual(['Alfa.pdf', 'Zeta.pdf']);
  });

  it('no muta el arreglo original', () => {
    const items: Item[] = [{ nombre_display: 'Zeta.pdf' }, { nombre_display: 'Alfa.pdf' }];
    const copia = [...items];
    ordenarPorDocumento(items, 'alfabetico', i => i);
    expect(items).toEqual(copia);
  });
});
