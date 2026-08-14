import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RolesManagerComponent } from './roles-manager.component';
import { Rol } from '../../../../shared/models/permisos.model';

function rol(over: Partial<Rol> = {}): Rol {
  return { _id: 'r1', nombre: 'Administrador', permisos: {}, ...over };
}

describe('RolesManagerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RolesManagerComponent] }).compileComponents();
  });

  it('lista los roles recibidos con su contador de permisos activos', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.componentRef.setInput('roles', [rol({ nombre: 'Administrador', permisos: { actividades: { crear: true } } })]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Administrador');
    expect(el.textContent).toContain('1/44 permisos activos');
  });

  it('muestra el mensaje vacío cuando no hay roles', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sin roles creados todavía.');
  });

  it('abrirNuevo pasa a la vista editar con el formulario vacío', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    fixture.componentInstance.abrirNuevo();
    expect(fixture.componentInstance.vista()).toBe('editar');
    expect(fixture.componentInstance.nombreForm).toBe('');
    expect(fixture.componentInstance.rolEditandoId()).toBeNull();
  });

  it('abrirEditar precarga nombre y permisos del rol', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    fixture.componentInstance.abrirEditar(rol({ _id: 'r2', nombre: 'Usuario auditor', permisos: { docCentro: { subir: true } } }));
    expect(fixture.componentInstance.vista()).toBe('editar');
    expect(fixture.componentInstance.nombreForm).toBe('Usuario auditor');
    expect(fixture.componentInstance.valoresForm).toEqual({ docCentro: { subir: true } });
    expect(fixture.componentInstance.rolEditandoId()).toBe('r2');
  });

  it('guardar sobre un rol existente emite editar con id y dto, y vuelve a la lista', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    let emitido: unknown = null;
    fixture.componentInstance.editar.subscribe((v) => (emitido = v));
    fixture.componentInstance.abrirEditar(rol({ _id: 'r2', nombre: 'Usuario auditor', permisos: {} }));
    fixture.componentInstance.nombreForm = 'Usuario auditor senior';
    fixture.componentInstance.guardar();
    expect(emitido).toEqual({ id: 'r2', dto: { nombre: 'Usuario auditor senior', permisos: {} } });
    expect(fixture.componentInstance.vista()).toBe('lista');
  });

  it('guardar sin rol seleccionado emite crear con el dto', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    let emitido: unknown = null;
    fixture.componentInstance.crear.subscribe((v) => (emitido = v));
    fixture.componentInstance.abrirNuevo();
    fixture.componentInstance.nombreForm = 'Usuario básico';
    fixture.componentInstance.guardar();
    expect(emitido).toEqual({ nombre: 'Usuario básico', permisos: {} });
  });

  it('click en Eliminar emite el id del rol', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.componentRef.setInput('roles', [rol({ _id: 'r9' })]);
    fixture.detectChanges();
    let emitido: unknown = null;
    fixture.componentInstance.eliminar.subscribe((v) => (emitido = v));
    const el = fixture.nativeElement as HTMLElement;
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Eliminar')) as HTMLButtonElement).click();
    expect(emitido).toBe('r9');
  });
});
