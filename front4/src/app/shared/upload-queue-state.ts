import { signal, Signal } from '@angular/core';

export type UploadEstado = 'subiendo' | 'listo' | 'error';

export interface UploadItem {
  id: string;
  nombre: string;
  progreso: number;
  estado: UploadEstado;
  errorMsg?: string;
}

export function createUploadQueue(): {
  items: Signal<UploadItem[]>;
  agregar(nombre: string): string;
  actualizarProgreso(id: string, progreso: number): void;
  marcarListo(id: string): void;
  marcarError(id: string, errorMsg: string): void;
  reiniciar(id: string): void;
  limpiar(): void;
} {
  const items = signal<UploadItem[]>([]);
  let nextId = 0;

  function agregar(nombre: string): string {
    const id = `upload-${nextId++}`;
    items.update(q => [...q, { id, nombre, progreso: 0, estado: 'subiendo' }]);
    return id;
  }

  function actualizarProgreso(id: string, progreso: number): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso } : i)));
  }

  function marcarListo(id: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso: 100, estado: 'listo' as const } : i)));
  }

  function marcarError(id: string, errorMsg: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, estado: 'error' as const, errorMsg } : i)));
  }

  function reiniciar(id: string): void {
    items.update(q => q.map(i => (i.id === id ? { id: i.id, nombre: i.nombre, progreso: 0, estado: 'subiendo' as const } : i)));
  }

  function limpiar(): void {
    items.set([]);
  }

  return { items, agregar, actualizarProgreso, marcarListo, marcarError, reiniciar, limpiar };
}
