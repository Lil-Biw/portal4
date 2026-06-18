import { describe, it, expect } from 'vitest';
import { clavePorColor } from './activos-icons';

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
