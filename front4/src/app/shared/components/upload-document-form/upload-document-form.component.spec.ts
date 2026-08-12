import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { UploadDocumentFormComponent } from './upload-document-form.component';

describe('UploadDocumentFormComponent — ocultarBotonConfirmarArchivo', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UploadDocumentFormComponent] }).compileComponents();
  });

  it('oculta el botón de confirmar en modo archivo cuando ocultarBotonConfirmarArchivo=true', () => {
    const fixture = TestBed.createComponent(UploadDocumentFormComponent);
    fixture.componentRef.setInput('modo', 'archivo');
    fixture.componentRef.setInput('ocultarBotonConfirmarArchivo', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.udf-confirm')).toBeNull();
  });

  it('muestra el botón de confirmar en modo link aunque ocultarBotonConfirmarArchivo=true', () => {
    const fixture = TestBed.createComponent(UploadDocumentFormComponent);
    fixture.componentRef.setInput('modo', 'link');
    fixture.componentRef.setInput('ocultarBotonConfirmarArchivo', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.udf-confirm')).not.toBeNull();
  });

  it('muestra el botón de confirmar en modo archivo por default (ocultarBotonConfirmarArchivo=false)', () => {
    const fixture = TestBed.createComponent(UploadDocumentFormComponent);
    fixture.componentRef.setInput('modo', 'archivo');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.udf-confirm')).not.toBeNull();
  });

  it('emite archivoChange una vez por cada archivo seleccionado en el input (selección múltiple)', () => {
    const fixture = TestBed.createComponent(UploadDocumentFormComponent);
    fixture.componentRef.setInput('modo', 'archivo');
    fixture.detectChanges();
    const emitidos: (File | null)[] = [];
    fixture.componentInstance.archivoChange.subscribe((f: File | null) => emitidos.push(f));
    const file1 = new File(['a'], 'a.pdf');
    const file2 = new File(['b'], 'b.pdf');
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file1, file2] as unknown as FileList, configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(emitidos).toEqual([file1, file2]);
  });

  it('emite archivoChange una vez por cada archivo soltado en el dropzone', () => {
    const fixture = TestBed.createComponent(UploadDocumentFormComponent);
    fixture.componentRef.setInput('modo', 'archivo');
    fixture.detectChanges();
    const emitidos: (File | null)[] = [];
    fixture.componentInstance.archivoChange.subscribe((f: File | null) => emitidos.push(f));
    const file1 = new File(['a'], 'a.pdf');
    const file2 = new File(['b'], 'b.pdf');
    const dropzone = fixture.nativeElement.querySelector('.udf-dropzone') as HTMLElement;
    const dropEvent = new Event('drop', { cancelable: true }) as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [file1, file2] }, configurable: true });
    dropzone.dispatchEvent(dropEvent);
    expect(emitidos).toEqual([file1, file2]);
  });

  it('el input de archivo acepta selección múltiple', () => {
    const fixture = TestBed.createComponent(UploadDocumentFormComponent);
    fixture.componentRef.setInput('modo', 'archivo');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
  });

  it('mostrarCamposArchivo=false oculta Nombre/Tipo en modo archivo pero no afecta modo link', () => {
    const fixture = TestBed.createComponent(UploadDocumentFormComponent);
    fixture.componentRef.setInput('modo', 'archivo');
    fixture.componentRef.setInput('mostrarCamposArchivo', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.udf-fields')).toBeNull();

    fixture.componentRef.setInput('modo', 'link');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.udf-fields')).not.toBeNull();
  });
});
