import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { UploadBubbleComponent } from './upload-bubble.component';
import { UploadItem } from '../../upload-queue-state';

describe('UploadBubbleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UploadBubbleComponent] }).compileComponents();
  });

  it('no renderiza nada cuando la lista de items está vacía', () => {
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.upload-bubble')).toBeNull();
  });

  it('renderiza una fila por item con el % para los que están subiendo', () => {
    const items: UploadItem[] = [
      { id: '1', nombre: 'a.pdf', progreso: 40, estado: 'subiendo', kind: 'archivo' },
      { id: '2', nombre: 'b.pdf', progreso: 100, estado: 'listo', kind: 'archivo' },
    ];
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const filas = el.querySelectorAll('.upload-item');
    expect(filas.length).toBe(2);
    expect(el.textContent).toContain('a.pdf');
    expect(el.textContent).toContain('40%');
    expect(el.textContent).toContain('b.pdf');
  });

  it('muestra el mensaje de error y un botón reintentar para items en error', () => {
    const items: UploadItem[] = [
      { id: '1', nombre: 'c.pdf', progreso: 0, estado: 'error', errorMsg: 'Archivo muy grande', kind: 'archivo' },
    ];
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Archivo muy grande');
    expect(el.querySelector('.item-retry')).not.toBeNull();
  });

  it('emite reintentar con el id correcto al hacer click en el botón', () => {
    const items: UploadItem[] = [
      { id: 'x1', nombre: 'c.pdf', progreso: 0, estado: 'error', errorMsg: 'Error de red', kind: 'archivo' },
    ];
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    let emitido = '';
    fixture.componentInstance.reintentar.subscribe((id: string) => { emitido = id; });
    (fixture.nativeElement.querySelector('.item-retry') as HTMLButtonElement).click();
    expect(emitido).toBe('x1');
  });

  it('emite cerrar al hacer click en el botón de cierre', () => {
    const items: UploadItem[] = [{ id: '1', nombre: 'a.pdf', progreso: 10, estado: 'subiendo', kind: 'archivo' }];
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    let cerrado = false;
    fixture.componentInstance.cerrar.subscribe(() => { cerrado = true; });
    (fixture.nativeElement.querySelector('.bubble-close') as HTMLButtonElement).click();
    expect(cerrado).toBe(true);
  });
});
