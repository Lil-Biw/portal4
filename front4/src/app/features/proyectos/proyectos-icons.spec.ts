import { describe, it, expect } from 'vitest';
import { resolverIconoProyecto } from './proyectos-icons';

describe('resolverIconoProyecto', () => {
  it('usa el ícono explícito cuando es una clave válida, ignorando el color', () => {
    expect(resolverIconoProyecto('extintor', '#0095d6')).toBe('extintor');
    expect(resolverIconoProyecto('camion', '#22c55e')).toBe('camion');
  });

  it('cae al color cuando no viene ícono, devolviendo un ícono legacy de proyecto', () => {
    expect(resolverIconoProyecto(undefined, '#22c55e')).toBe('objetivo');
    expect(resolverIconoProyecto(undefined, '#0095d6')).toBe('carpeta');
  });

  it('cae al color cuando el ícono es una clave desconocida', () => {
    expect(resolverIconoProyecto('no-existe', '#f59e0b')).toBe('cohete');
  });

  it('sin ícono y sin color reconocido, cae al fallback legacy carpeta', () => {
    expect(resolverIconoProyecto(undefined, '#ffffff')).toBe('carpeta');
  });
});
