import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PermisosPanelComponent } from './permisos-panel.component';

describe('PermisosPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PermisosPanelComponent] }).compileComponents();
  });

  it('renderiza las 14 secciones del catálogo', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pf-seccion').length).toBe(14);
  });

  it('marca "solo interno" en las secciones internas', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pf-seccion-nota').length).toBe(3);
  });

  it('con contextoCompleto=false deshabilita los switches de secciones soloInterno y filas soloAdmin', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    fixture.componentRef.setInput('contextoCompleto', false);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const switches = el.querySelectorAll<HTMLButtonElement>('.pf-switch');
    const deshabilitados = Array.from(switches).filter((s) => s.disabled);
    expect(deshabilitados.length).toBe(9);
  });

  it('refleja el estado activo de un permiso en aria-pressed', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    fixture.componentRef.setInput('valores', { actividades: { crear: true } });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const switches = Array.from(el.querySelectorAll<HTMLButtonElement>('.pf-switch'));
    const activos = switches.filter((s) => s.getAttribute('aria-pressed') === 'true');
    expect(activos.length).toBe(1);
  });

  it('al hacer click en un switch emite valoresChange con el nuevo estado', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    let emitido: unknown = null;
    fixture.componentInstance.valoresChange.subscribe((v) => (emitido = v));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.pf-switch') as HTMLButtonElement).click();
    expect(emitido).toEqual({ empresas: { crear: true } });
  });
});
