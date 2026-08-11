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
});
