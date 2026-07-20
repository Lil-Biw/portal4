import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpEventType } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DocumentosService } from './documentos.service';

describe('DocumentosService.subir', () => {
  let service: DocumentosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocumentosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('reporta progreso y responde con éxito, recargando los documentos de la empresa', () => {
    const file = new File(['contenido'], 'doc.pdf', { type: 'application/pdf' });
    const progresos: number[] = [];
    let completo = false;

    service.subir(file, 'empresa', 'emp1').subscribe(event => {
      if (event.type === HttpEventType.UploadProgress && event.total) {
        progresos.push(Math.round((100 * event.loaded) / event.total));
      }
      if (event.type === HttpEventType.Response) completo = true;
    });

    const req = httpMock.expectOne(r => r.url.includes('/empresas/emp1/documentos') && r.method === 'POST');
    expect(req.request.reportProgress).toBe(true);

    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    req.flush({ _id: 'doc1' });

    expect(progresos).toEqual([50]);
    expect(completo).toBe(true);

    // subir() debe recargar el listado de documentos de la empresa al completar
    httpMock.expectOne(r => r.url.includes('/empresas/emp1/documentos') && r.method === 'GET').flush([]);
  });

  it('rechaza el observable con un error legible cuando falta empresaId', () => {
    const file = new File(['x'], 'a.pdf');
    let mensaje = '';
    service.subir(file, 'empresa').subscribe({ error: (err) => { mensaje = err.message; } });
    expect(mensaje).toBe('Empresa no seleccionada');
    httpMock.expectNone(() => true);
  });

  it('rechaza el observable cuando falta el centro para tipo centro', () => {
    const file = new File(['x'], 'a.pdf');
    let mensaje = '';
    service.subir(file, 'centro', 'emp1').subscribe({ error: (err) => { mensaje = err.message; } });
    expect(mensaje).toBe('Selecciona un centro de costos primero.');
    httpMock.expectNone(() => true);
  });
});

describe('DocumentosService.buscarCascada', () => {
  let service: DocumentosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocumentosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('pega a /documentos/busqueda-total con nivel, categorias y nombre, y arma la URL de cada documento según su nivel', () => {
    service.buscarCascada('centro', ['Contrato', 'Factura'], 'acme');

    const req = httpMock.expectOne(r => r.url.includes('/documentos/busqueda-total'));
    const url = new URL(req.request.url);
    expect(url.searchParams.get('nivel')).toBe('centro');
    expect(url.searchParams.get('categorias')).toBe('Contrato,Factura');
    expect(url.searchParams.get('nombre')).toBe('acme');

    req.flush([
      {
        _id: 'centro1', nombre: 'Centro Norte', nivel: 'centro',
        empresa_id: 'emp1', empresa_nombre: 'Empresa Acme',
        documentos: [{ _id: 'doc1', nombre_display: 'Contrato Centro Norte', categoria: 'Contrato' }],
        centros: [],
        proyectos: [{
          _id: 'proy1', nombre: 'Proyecto Cableado', nivel: 'proyecto',
          empresa_id: 'emp1', empresa_nombre: 'Empresa Acme', centro_id: 'centro1', centro_nombre: 'Centro Norte',
          documentos: [{ _id: 'doc2', nombre_display: 'Contrato Cableado', categoria: 'Contrato' }],
          centros: [], proyectos: [],
        }],
      },
    ]);

    const arbol = service.busquedaCascada();
    expect(arbol[0].documentos[0].url).toContain('/empresas/emp1/centros/centro1/documentos/doc1');
    expect(arbol[0].proyectos[0].documentos[0].url).toContain('/empresas/emp1/centros/centro1/proyectos/proy1/documentos/doc2');
  });

  it('omite categorias y nombre del query string cuando no se pasan', () => {
    service.buscarCascada('empresa');
    const req = httpMock.expectOne(r => r.url.includes('/documentos/busqueda-total'));
    const url = new URL(req.request.url);
    expect(url.searchParams.get('nivel')).toBe('empresa');
    expect(url.searchParams.has('categorias')).toBe(false);
    expect(url.searchParams.has('nombre')).toBe(false);
    req.flush([]);
  });
});
