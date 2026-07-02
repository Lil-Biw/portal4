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
