import { describe, it, expect } from 'vitest';
import { createUploadQueue } from './upload-queue-state';

describe('createUploadQueue', () => {
  it('agrega un item en estado subiendo con progreso 0', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('factura.pdf');
    expect(queue.items()).toEqual([
      { id, nombre: 'factura.pdf', progreso: 0, estado: 'subiendo' },
    ]);
  });

  it('nunca sobrescribe un item existente al agregar uno nuevo', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf');
    const id2 = queue.agregar('b.pdf');
    expect(id1).not.toBe(id2);
    expect(queue.items().map(i => i.nombre)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('actualiza el progreso del item correcto', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf');
    const id2 = queue.agregar('b.pdf');
    queue.actualizarProgreso(id2, 40);
    expect(queue.items().find(i => i.id === id1)?.progreso).toBe(0);
    expect(queue.items().find(i => i.id === id2)?.progreso).toBe(40);
  });

  it('marca un item como listo con progreso 100', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf');
    queue.actualizarProgreso(id, 60);
    queue.marcarListo(id);
    expect(queue.items().find(i => i.id === id)).toEqual({
      id, nombre: 'a.pdf', progreso: 100, estado: 'listo',
    });
  });

  it('marca un item como error con mensaje', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf');
    queue.marcarError(id, 'Archivo demasiado grande');
    const item = queue.items().find(i => i.id === id);
    expect(item?.estado).toBe('error');
    expect(item?.errorMsg).toBe('Archivo demasiado grande');
  });

  it('reinicia un item en error de vuelta a subiendo, progreso 0, sin errorMsg', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf');
    queue.marcarError(id, 'Error de red');
    queue.reiniciar(id);
    expect(queue.items().find(i => i.id === id)).toEqual({
      id, nombre: 'a.pdf', progreso: 0, estado: 'subiendo',
    });
  });

  it('limpiar vacía la cola', () => {
    const queue = createUploadQueue();
    queue.agregar('a.pdf');
    queue.agregar('b.pdf');
    queue.limpiar();
    expect(queue.items()).toEqual([]);
  });
});
