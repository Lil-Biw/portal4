import { describe, it, expect } from 'vitest';
import { resolverIconoActividad } from './actividades-icons';

describe('resolverIconoActividad', () => {
  it('usa el ícono explícito cuando es una clave válida, ignorando el color', () => {
    expect(resolverIconoActividad('extintor', '#4E9AC7')).toBe('extintor');
    expect(resolverIconoActividad('camion', '#5FAE7B')).toBe('camion');
  });

  it('cae al color cuando no viene ícono', () => {
    expect(resolverIconoActividad(undefined, '#5FAE7B')).toBe('check');
    expect(resolverIconoActividad(undefined, '#4E9AC7')).toBe('calendario');
  });

  it('cae al color cuando el ícono es una clave desconocida', () => {
    expect(resolverIconoActividad('no-existe', '#D9A24B')).toBe('llave');
  });

  it('sin ícono y sin color reconocido, cae al fallback calendario', () => {
    expect(resolverIconoActividad(undefined, '#ffffff')).toBe('calendario');
  });
});
