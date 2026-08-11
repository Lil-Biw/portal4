import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ImageUploadComponent } from './image-upload.component';

describe('ImageUploadComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ImageUploadComponent] }).compileComponents();
  });

  it('renderiza el título y el hint', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.componentRef.setInput('titulo', 'Logo');
    fixture.componentRef.setInput('hint', 'Opcional. JPG, PNG o SVG.');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Logo');
    expect(el.textContent).toContain('Opcional. JPG, PNG o SVG.');
  });

  it('muestra el placeholder cuando no hay initialUrl ni archivo seleccionado', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('svg')).not.toBeNull();
  });

  it('muestra la imagen cuando initialUrl viene seteado', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.componentRef.setInput('initialUrl', 'http://localhost/empresas/1/logo');
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain('/empresas/1/logo');
  });

  it('emite el archivo seleccionado al elegir uno en el input', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.detectChanges();
    const file = new File(['contenido'], 'logo.png', { type: 'image/png' });
    let emitido: File | null = null;
    fixture.componentInstance.archivoSeleccionado.subscribe((f: File | null) => { emitido = f; });
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(emitido).toBe(file);
  });

  it('vuelve a mostrar el placeholder si initialUrl cambia a null', () => {
    const fixture = TestBed.createComponent(ImageUploadComponent);
    fixture.componentRef.setInput('initialUrl', 'http://localhost/empresas/1/logo');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).not.toBeNull();

    fixture.componentRef.setInput('initialUrl', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
