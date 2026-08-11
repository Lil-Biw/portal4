import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentCardListComponent } from './document-card-list.component';
import { DocumentoTarjeta } from '../../models/documento-tarjeta.model';

describe('DocumentCardListComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DocumentCardListComponent] }).compileComponents();
  });

  it('muestra el mensaje vacío cuando no hay documentos', () => {
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', []);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sin documentos');
    expect(el.querySelectorAll('.dcl-card').length).toBe(0);
  });

  it('renderiza una tarjeta por documento, con el tag "pendiente" cuando corresponde', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: '1', nombre: 'informe_final.pdf', tipoContenido: 'archivo', estado: 'listo' },
      { id: '2', nombre: 'contrato.pdf', tipoContenido: 'archivo', estado: 'pendiente' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.dcl-card').length).toBe(2);
    expect(el.textContent).toContain('informe_final.pdf');
    expect(el.textContent).toContain('pendiente');
  });

  it('muestra "Subiendo..." para documentos en estado subiendo, y oculta sus acciones y la cruz', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: '1', nombre: 'foto.jpg', tipoContenido: 'archivo', estado: 'subiendo' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Subiendo...');
    expect(el.querySelector('.dcl-acciones')).toBeNull();
    expect(el.querySelector('.dcl-x')).toBeNull();
  });

  it('atenúa la tarjeta y muestra "Eliminando..." en estado eliminando, sin cruz ni acciones', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: '1', nombre: 'foto.jpg', tipoContenido: 'archivo', estado: 'eliminando' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Eliminando...');
    expect(el.querySelector('.dcl-card')?.classList.contains('dcl-card--dim')).toBe(true);
    expect(el.querySelector('.dcl-x')).toBeNull();
    expect(el.querySelector('.dcl-acciones')).toBeNull();
  });

  it('emite eliminar con el id correcto al hacer click en la cruz', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: 'doc1', nombre: 'a.pdf', tipoContenido: 'archivo', estado: 'listo' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.detectChanges();
    let emitido = '';
    fixture.componentInstance.eliminar.subscribe((id: string) => { emitido = id; });
    (fixture.nativeElement.querySelector('.dcl-x') as HTMLButtonElement).click();
    expect(emitido).toBe('doc1');
  });

  it('emite descargar para archivos y abrirLink para links', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: 'doc1', nombre: 'a.pdf', tipoContenido: 'archivo', estado: 'listo' },
      { id: 'doc2', nombre: 'b', tipoContenido: 'link', linkUrl: 'https://x.com', estado: 'listo' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.detectChanges();
    let descargado = '';
    let abierto = '';
    fixture.componentInstance.descargar.subscribe((id: string) => { descargado = id; });
    fixture.componentInstance.abrirLink.subscribe((url: string) => { abierto = url; });
    const principales = fixture.nativeElement.querySelectorAll('.dcl-icon-btn:not(.dcl-icon-btn--warn)');
    expect(principales.length).toBe(2);
    (principales[0] as HTMLButtonElement).click();
    (principales[1] as HTMLButtonElement).click();
    expect(descargado).toBe('doc1');
    expect(abierto).toBe('https://x.com');
  });

  it('renombrar: clic en el lápiz muestra el input sin extensión, Enter emite el nombre completo', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: 'doc1', nombre: 'informe_final.pdf', tipoContenido: 'archivo', estado: 'listo' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.dcl-icon-btn--warn') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('.dcl-rename-input') as HTMLInputElement;
    expect(input.value).toBe('informe_final');

    let emitido: { id: string; nuevoNombre: string } | null = null;
    fixture.componentInstance.renombrar.subscribe((ev: { id: string; nuevoNombre: string }) => { emitido = ev; });
    input.value = 'informe_revisado';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(emitido).toEqual({ id: 'doc1', nuevoNombre: 'informe_revisado.pdf' });
    expect(fixture.nativeElement.querySelector('.dcl-rename-input')).toBeNull();
  });

  it('renombrar: Esc cancela sin emitir y sin cambiar el nombre mostrado', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: 'doc1', nombre: 'informe_final.pdf', tipoContenido: 'archivo', estado: 'listo' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.dcl-icon-btn--warn') as HTMLButtonElement).click();
    fixture.detectChanges();

    let emitido = false;
    fixture.componentInstance.renombrar.subscribe(() => { emitido = true; });
    const input = fixture.nativeElement.querySelector('.dcl-rename-input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(emitido).toBe(false);
    expect(fixture.nativeElement.querySelector('.dcl-rename-input')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('informe_final.pdf');
  });

  it('no muestra selector de categoría por defecto (mostrarCategoria=false)', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: '1', nombre: 'a.pdf', tipoContenido: 'archivo', estado: 'subiendo', categoria: 'Otros' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dcl-categoria-select')).toBeNull();
  });

  it('con mostrarCategoria=true muestra el selector en subiendo y listo, no en pendiente/error', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: '1', nombre: 'a.pdf', tipoContenido: 'archivo', estado: 'subiendo', categoria: 'Otros' },
      { id: '2', nombre: 'b.pdf', tipoContenido: 'archivo', estado: 'listo', categoria: 'Contratos' },
      { id: '3', nombre: 'c.pdf', tipoContenido: 'archivo', estado: 'pendiente' },
      { id: '4', nombre: 'd.pdf', tipoContenido: 'archivo', estado: 'error' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.componentRef.setInput('mostrarCategoria', true);
    fixture.componentRef.setInput('categorias', ['Otros', 'Contratos']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.dcl-categoria-select').length).toBe(2);
  });

  it('emite categoriaChange con el id y la categoría elegida', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: 'doc1', nombre: 'a.pdf', tipoContenido: 'archivo', estado: 'subiendo', categoria: 'Otros' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.componentRef.setInput('mostrarCategoria', true);
    fixture.componentRef.setInput('categorias', ['Otros', 'Contratos']);
    fixture.detectChanges();
    let emitido: { id: string; categoria: string } | null = null;
    fixture.componentInstance.categoriaChange.subscribe((ev: { id: string; categoria: string }) => { emitido = ev; });
    const select = fixture.nativeElement.querySelector('.dcl-categoria-select') as HTMLSelectElement;
    select.value = 'Contratos';
    select.dispatchEvent(new Event('change'));
    expect(emitido).toEqual({ id: 'doc1', categoria: 'Contratos' });
  });

  it('en estado error muestra el botón reintentar y emite el id al hacer click', () => {
    const documentos: DocumentoTarjeta[] = [
      { id: 'doc1', nombre: 'a.pdf', tipoContenido: 'archivo', estado: 'error' },
    ];
    const fixture = TestBed.createComponent(DocumentCardListComponent);
    fixture.componentRef.setInput('documentos', documentos);
    fixture.componentRef.setInput('mostrarCategoria', true);
    fixture.detectChanges();
    let emitido = '';
    fixture.componentInstance.reintentar.subscribe((id: string) => { emitido = id; });
    (fixture.nativeElement.querySelector('.dcl-retry') as HTMLButtonElement).click();
    expect(emitido).toBe('doc1');
  });
});
