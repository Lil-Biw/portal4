import { describe, it, expect } from 'vitest';
import { PERM_SCHEMA, filaAplica, contarPermisosActivos, PermisosUsuario } from './permisos.model';

describe('filaAplica', () => {
  it('permite todas las filas cuando contextoCompleto es true', () => {
    const seccionInterna = PERM_SCHEMA.find((s) => s.key === 'empresas')!;
    expect(filaAplica(seccionInterna, seccionInterna.rows[0], true)).toBe(true);
  });

  it('deshabilita las filas de una sección soloInterno cuando contextoCompleto es false', () => {
    const seccionInterna = PERM_SCHEMA.find((s) => s.key === 'empresas')!;
    expect(filaAplica(seccionInterna, seccionInterna.rows[0], false)).toBe(false);
  });

  it('deshabilita una fila soloAdmin dentro de una sección normal cuando contextoCompleto es false', () => {
    const seccionUsuarios = PERM_SCHEMA.find((s) => s.key === 'usuarios')!;
    const filaCrearAdmin = seccionUsuarios.rows.find((r) => r.key === 'crearAdmin')!;
    expect(filaAplica(seccionUsuarios, filaCrearAdmin, false)).toBe(false);
  });

  it('permite una fila normal de una sección no interna cuando contextoCompleto es false', () => {
    const seccionCentros = PERM_SCHEMA.find((s) => s.key === 'centros')!;
    const filaCrear = seccionCentros.rows.find((r) => r.key === 'crear')!;
    expect(filaAplica(seccionCentros, filaCrear, false)).toBe(true);
  });
});

describe('contarPermisosActivos', () => {
  it('con contextoCompleto=true cuenta las 44 filas totales del catálogo', () => {
    const { total } = contarPermisosActivos({}, true);
    expect(total).toBe(44);
  });

  it('con contextoCompleto=false excluye secciones soloInterno y filas soloAdmin (29 filas)', () => {
    const { total } = contarPermisosActivos({}, false);
    expect(total).toBe(29);
  });

  it('cuenta correctamente los activos cuando todo está en true', () => {
    const valores: PermisosUsuario = {};
    for (const seccion of PERM_SCHEMA) {
      valores[seccion.key] = {};
      for (const row of seccion.rows) valores[seccion.key][row.key] = true;
    }
    expect(contarPermisosActivos(valores, true)).toEqual({ activos: 44, total: 44 });
  });

  it('no cuenta como activa una clave ausente en el objeto de valores', () => {
    expect(contarPermisosActivos({ actividades: { crear: true } }, true).activos).toBe(1);
  });
});
