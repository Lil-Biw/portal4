import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PermisosFormComponent } from './permisos-form.component';
import { Usuario } from '../../../../shared/models/usuario.model';
import { Rol } from '../../../../shared/models/permisos.model';

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    _id: 'u1', cliente_id: 'c1', nombre: 'Jorge Muñoz', email: 'jorge@example.com',
    rol: 'usuario', permiso_acceso: 'ver', centros_asignados: [], activo: true, ...over,
  };
}

describe('PermisosFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PermisosFormComponent] }).compileComponents();
  });

  it('muestra el nombre, el chip de rol y el email del usuario', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ nombre: 'Camila Rojas', rol: 'admin_smartclarity', email: 'camila@eclariti.com' }));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Camila Rojas');
    expect(el.textContent).toContain('Admin SmartClarity');
    expect(el.textContent).toContain('camila@eclariti.com');
  });

  it('con un usuario rol=usuario, el contador excluye las secciones internas (34 filas)', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ rol: 'usuario' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.contador.total).toBe(34);
  });

  it('con un usuario admin_smartclarity, el contador incluye todo el catálogo (43 filas)', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ rol: 'admin_smartclarity' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.contador.total).toBe(43);
  });

  it('parte de los permisos existentes del usuario', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ permisos: { actividades: { crear: true } } }));
    fixture.detectChanges();
    expect(fixture.componentInstance.contador.activos).toBe(1);
  });

  it('aplicarRol reemplaza los valores actuales por el preset del rol elegido', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    const rol: Rol = { _id: 'r1', nombre: 'Administrador', permisos: { actividades: { crear: true, editar: true } } };
    fixture.componentRef.setInput('usuario', usuario());
    fixture.componentRef.setInput('roles', [rol]);
    fixture.detectChanges();
    fixture.componentInstance.aplicarRol('r1');
    expect(fixture.componentInstance.valores).toEqual({ actividades: { crear: true, editar: true } });
  });

  it('aplicarRol filtra los permisos no aplicables cuando el usuario destino es rol=usuario', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    const rol: Rol = {
      _id: 'r1',
      nombre: 'Administrador',
      permisos: { actividades: { crear: true }, empresas: { crear: true, editar: true, eliminar: true } },
    };
    fixture.componentRef.setInput('usuario', usuario({ rol: 'usuario' }));
    fixture.componentRef.setInput('roles', [rol]);
    fixture.detectChanges();
    fixture.componentInstance.aplicarRol('r1');
    expect(fixture.componentInstance.valores['actividades']?.['crear']).toBe(true);
    expect(fixture.componentInstance.valores['empresas']).toBeUndefined();
  });

  it('al hacer click en Guardar permisos emite guardado con los valores actuales', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ permisos: { actividades: { crear: true } } }));
    fixture.detectChanges();
    let emitido: unknown = null;
    fixture.componentInstance.guardado.subscribe((v) => (emitido = v));
    const el = fixture.nativeElement as HTMLElement;
    const guardarBtn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Guardar permisos')) as HTMLButtonElement;
    guardarBtn.click();
    expect(emitido).toEqual({ actividades: { crear: true } });
  });

  it('al hacer click en Cancelar emite cancelado', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario());
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.cancelado.subscribe(() => (emitido = true));
    const el = fixture.nativeElement as HTMLElement;
    const cancelarBtn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Cancelar')) as HTMLButtonElement;
    cancelarBtn.click();
    expect(emitido).toBe(true);
  });
});
