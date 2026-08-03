import { describe, it, expect } from 'vitest';
import { clavePorColor, resolverIconoActivo } from './activos-icons';

describe('clavePorColor', () => {
  it('retorna clave correcta para cada color de la paleta', () => {
    expect(clavePorColor('#ef4444')).toBe('camara');
    expect(clavePorColor('#22c55e')).toBe('caja-registradora');
    expect(clavePorColor('#3b82f6')).toBe('servidor');
    expect(clavePorColor('#8b5cf6')).toBe('red');
    expect(clavePorColor('#f59e0b')).toBe('generador');
    expect(clavePorColor('#0095d6')).toBe('computador');
  });

  it('es case-insensitive', () => {
    expect(clavePorColor('#EF4444')).toBe('camara');
    expect(clavePorColor('#0095D6')).toBe('computador');
  });

  it('retorna fallback computador para color desconocido', () => {
    expect(clavePorColor('#ffffff')).toBe('computador');
    expect(clavePorColor('#123456')).toBe('computador');
  });
});

describe('resolverIconoActivo', () => {
  it('usa el ícono explícito cuando es una clave válida, ignorando el color', () => {
    expect(resolverIconoActivo('extintor', '#0095d6')).toBe('extintor');
    expect(resolverIconoActivo('camion', '#ef4444')).toBe('camion');
  });

  it('cae al color cuando no viene ícono', () => {
    expect(resolverIconoActivo(undefined, '#ef4444')).toBe('camara');
    expect(resolverIconoActivo(undefined, '#0095d6')).toBe('computador');
  });

  it('cae al color cuando el ícono es una clave desconocida', () => {
    expect(resolverIconoActivo('no-existe', '#22c55e')).toBe('caja-registradora');
  });

  it('sin ícono y sin color reconocido, cae al fallback computador', () => {
    expect(resolverIconoActivo(undefined, '#ffffff')).toBe('computador');
  });
});
