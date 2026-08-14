import { signal, Signal } from '@angular/core';

export type UploadEstado = 'subiendo' | 'listo' | 'error';
export type UploadKind = 'archivo' | 'link';

export interface UploadItem {
  id: string;
  nombre: string;
  progreso: number;
  estado: UploadEstado;
  errorMsg?: string;
  kind: UploadKind;
  categoria?: string;
  docUrl?: string;
}

export function createUploadQueue(): {
  items: Signal<UploadItem[]>;
  agregar(nombre: string, kind: UploadKind, categoria?: string): string;
  actualizarProgreso(id: string, progreso: number): void;
  marcarListo(id: string, docUrl?: string): void;
  marcarError(id: string, errorMsg: string): void;
  actualizarCategoria(id: string, categoria: string): void;
  actualizarNombre(id: string, nombre: string): void;
  quitar(id: string): void;
  reiniciar(id: string): void;
  limpiar(): void;
} {
  const items = signal<UploadItem[]>([]);
  let nextId = 0;

  function agregar(nombre: string, kind: UploadKind, categoria?: string): string {
    const id = `upload-${nextId++}`;
    items.update(q => [...q, { id, nombre, progreso: 0, estado: 'subiendo', kind, categoria }]);
    return id;
  }

  function actualizarProgreso(id: string, progreso: number): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso } : i)));
  }

  function marcarListo(id: string, docUrl?: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso: 100, estado: 'listo' as const, docUrl } : i)));
  }

  function marcarError(id: string, errorMsg: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, estado: 'error' as const, errorMsg } : i)));
  }

  function actualizarCategoria(id: string, categoria: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, categoria } : i)));
  }

  function actualizarNombre(id: string, nombre: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, nombre } : i)));
  }

  function quitar(id: string): void {
    items.update(q => q.filter(i => i.id !== id));
  }

  function reiniciar(id: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso: 0, estado: 'subiendo' as const, errorMsg: undefined } : i)));
  }

  function limpiar(): void {
    items.set([]);
  }

  return { items, agregar, actualizarProgreso, marcarListo, marcarError, actualizarCategoria, actualizarNombre, quitar, reiniciar, limpiar };
}
