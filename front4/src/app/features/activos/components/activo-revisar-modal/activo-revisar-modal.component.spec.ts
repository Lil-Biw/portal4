import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ActivoRevisarModalComponent } from './activo-revisar-modal.component';
import { DocActivo, ImagenDocEstado } from '../../../../shared/models/activo.model';

function docActivo(over: Partial<DocActivo> = {}): DocActivo {
  return { _id: 'd1', nombre: 'a.png', nombre_display: 'a.png', tipo_contenido: 'archivo', ...over };
}

describe('ActivoRevisarModalComponent — galería de fotos', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ActivoRevisarModalComponent] }).compileComponents();
  });

  it('no renderiza la columna de galería si no hay documentos de imagen', () => {
    const fixture = TestBed.createComponent(ActivoRevisarModalComponent);
    fixture.componentRef.setInput('documentosActivo', [docActivo({ tipo_mime: 'application/pdf' })]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.gallery-col')).toBeNull();
  });

  it('renderiza una miniatura por cada documento de imagen, con su badge de formato', () => {
    const fixture = TestBed.createComponent(ActivoRevisarModalComponent);
    fixture.componentRef.setInput('documentosActivo', [
      docActivo({ _id: 'd1', tipo_mime: 'image/png' }),
      docActivo({ _id: 'd2', tipo_mime: 'image/jpeg' }),
      docActivo({ _id: 'd3', tipo_mime: 'application/pdf' }),
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.thumb').length).toBe(2);
    expect(el.textContent).toContain('PNG');
    expect(el.textContent).toContain('JPG');
  });

  it('emite cargarImagenActivo por cada imagen que todavía no está en imagenesActivo', () => {
    const fixture = TestBed.createComponent(ActivoRevisarModalComponent);
    const emitidos: string[] = [];
    fixture.componentInstance.cargarImagenActivo.subscribe((ev: { docId: string }) => emitidos.push(ev.docId));
    fixture.componentRef.setInput('documentosActivo', [
      docActivo({ _id: 'd1', tipo_mime: 'image/png' }),
      docActivo({ _id: 'd2', tipo_mime: 'image/jpeg' }),
    ]);
    fixture.detectChanges();
    expect(emitidos.sort()).toEqual(['d1', 'd2']);
  });

  it('no reemite para una imagen que ya figura en imagenesActivo', () => {
    const fixture = TestBed.createComponent(ActivoRevisarModalComponent);
    const emitidos: string[] = [];
    fixture.componentInstance.cargarImagenActivo.subscribe((ev: { docId: string }) => emitidos.push(ev.docId));
    const mapa = new Map<string, ImagenDocEstado>([['d1', { url: 'blob:x', estado: 'lista' }]]);
    fixture.componentRef.setInput('imagenesActivo', mapa);
    fixture.componentRef.setInput('documentosActivo', [docActivo({ _id: 'd1', tipo_mime: 'image/png' })]);
    fixture.detectChanges();
    expect(emitidos).toEqual([]);
  });

  it('al hacer click en una miniatura lista, abre su url en una pestaña nueva', () => {
    const fixture = TestBed.createComponent(ActivoRevisarModalComponent);
    const mapa = new Map<string, ImagenDocEstado>([['d1', { url: 'blob:abc', estado: 'lista' }]]);
    fixture.componentRef.setInput('imagenesActivo', mapa);
    fixture.componentRef.setInput('documentosActivo', [docActivo({ _id: 'd1', tipo_mime: 'image/png' })]);
    fixture.detectChanges();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    (fixture.nativeElement.querySelector('.thumb') as HTMLElement).click();
    expect(openSpy).toHaveBeenCalledWith('blob:abc', '_blank');
    openSpy.mockRestore();
  });
});
