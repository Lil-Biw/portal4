import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentoCardComponent } from './documento-card.component';

describe('DocumentoCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DocumentoCardComponent] }).compileComponents();
  });

  it('muestra nombre, categoría y chip de link cuando corresponde', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'contrato.pdf');
    fixture.componentRef.setInput('categoria', 'Contratos');
    fixture.componentRef.setInput('tipoContenido', 'link');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('contrato.pdf');
    expect(el.textContent).toContain('Contratos');
    expect(el.textContent).toContain('Link');
  });

  it('no muestra el chip de categoría cuando está vacía (caso documentos vencidos sin categoría)', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('categoria', '');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dc-categoria')).toBeNull();
  });

  it('renderiza los badges, la fecha de subida y quién subió', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('badges', ['Empresa · AgroSur', 'Centro · Fundo San Rafael']);
    fixture.componentRef.setInput('fechaSubida', '10 ago 2026, 09:00');
    fixture.componentRef.setInput('subidoPor', 'Andrés Root');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Empresa · AgroSur');
    expect(text).toContain('Centro · Fundo San Rafael');
    expect(text).toContain('Subido: 10 ago 2026, 09:00');
    expect(text).toContain('Andrés Root');
  });

  it('renderiza "Vencido: <fecha>" cuando se pasa vencidoEn', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('vencidoEn', '1 ago 2026');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Vencido: 1 ago 2026');
  });

  it('emite abrir al hacer clic en el botón principal', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.abrir.subscribe(() => { emitido = true; });
    (fixture.nativeElement.querySelector('.dc-btn') as HTMLButtonElement).click();
    expect(emitido).toBe(true);
  });

  it('oculta el botón eliminar cuando mostrarEliminar es false, lo muestra y emite cuando es true', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('mostrarEliminar', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dc-btn--danger')).toBeNull();

    fixture.componentRef.setInput('mostrarEliminar', true);
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.eliminar.subscribe(() => { emitido = true; });
    (fixture.nativeElement.querySelector('.dc-btn--danger') as HTMLButtonElement).click();
    expect(emitido).toBe(true);
  });

  it('sin mostrarCambiarCategoria ni mostrarMarcarVencido, no muestra el botón de menú', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dc-btn--menu')).toBeNull();
  });

  it('el menú abre con "Cambiar categoría" y emite la categoría elegida', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('categoria', 'Otros');
    fixture.componentRef.setInput('categorias', ['Otros', 'Contratos']);
    fixture.componentRef.setInput('mostrarCambiarCategoria', true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.dc-btn--menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.dc-menu-item');
    expect(items.length).toBe(2);
    let emitido = '';
    fixture.componentInstance.cambiarCategoria.subscribe((c: string) => { emitido = c; });
    (items[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(emitido).toBe('Contratos');
    expect(fixture.nativeElement.querySelector('.dc-menu')).toBeNull();
  });

  it('el menú muestra "Marcar vencido" y lo emite', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('mostrarMarcarVencido', true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.dc-btn--menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.marcarVencido.subscribe(() => { emitido = true; });
    (fixture.nativeElement.querySelector('.dc-menu-item--warn') as HTMLElement).click();
    expect(emitido).toBe(true);
  });
});
