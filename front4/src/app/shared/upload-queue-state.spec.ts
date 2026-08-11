import { describe, it, expect } from 'vitest';
import { createUploadQueue } from './upload-queue-state';

describe('createUploadQueue', () => {
  it('agrega un item en estado subiendo con progreso 0, tipo y categoría', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('factura.pdf', 'archivo', 'Contratos');
    expect(queue.items()).toEqual([
      { id, nombre: 'factura.pdf', progreso: 0, estado: 'subiendo', kind: 'archivo', categoria: 'Contratos' },
    ]);
  });

  it('nunca sobrescribe un item existente al agregar uno nuevo', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf', 'archivo');
    const id2 = queue.agregar('b.pdf', 'link');
    expect(id1).not.toBe(id2);
    expect(queue.items().map(i => i.nombre)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('actualiza el progreso del item correcto', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf', 'archivo');
    const id2 = queue.agregar('b.pdf', 'archivo');
    queue.actualizarProgreso(id2, 40);
    expect(queue.items().find(i => i.id === id1)?.progreso).toBe(0);
    expect(queue.items().find(i => i.id === id2)?.progreso).toBe(40);
  });

  it('marca un item como listo con progreso 100 y guarda el docUrl', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf', 'archivo', 'Otros');
    queue.actualizarProgreso(id, 60);
    queue.marcarListo(id, 'https://s3/a.pdf');
    expect(queue.items().find(i => i.id === id)).toEqual({
      id, nombre: 'a.pdf', progreso: 100, estado: 'listo', kind: 'archivo', categoria: 'Otros', docUrl: 'https://s3/a.pdf',
    });
  });

  it('marca un item como error con mensaje', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf', 'archivo');
    queue.marcarError(id, 'Archivo demasiado grande');
    const item = queue.items().find(i => i.id === id);
    expect(item?.estado).toBe('error');
    expect(item?.errorMsg).toBe('Archivo demasiado grande');
  });

  it('actualiza la categoría de un item existente', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf', 'archivo', 'Otros');
    queue.actualizarCategoria(id, 'Contratos');
    expect(queue.items().find(i => i.id === id)?.categoria).toBe('Contratos');
  });

  it('quitar saca solo el item indicado', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf', 'archivo');
    const id2 = queue.agregar('b.pdf', 'archivo');
    queue.quitar(id1);
    expect(queue.items().map(i => i.id)).toEqual([id2]);
  });

  it('reinicia un item en error de vuelta a subiendo, progreso 0, sin errorMsg, preservando kind y categoría', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf', 'archivo', 'Contratos');
    queue.marcarError(id, 'Error de red');
    queue.reiniciar(id);
    expect(queue.items().find(i => i.id === id)).toEqual({
      id, nombre: 'a.pdf', progreso: 0, estado: 'subiendo', kind: 'archivo', categoria: 'Contratos',
    });
  });

  it('limpiar vacía la cola', () => {
    const queue = createUploadQueue();
    queue.agregar('a.pdf', 'archivo');
    queue.agregar('b.pdf', 'archivo');
    queue.limpiar();
    expect(queue.items()).toEqual([]);
  });
});
