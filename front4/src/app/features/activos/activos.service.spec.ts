import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ActivosService } from './activos.service';
import { CentrosService } from '../centros/centros.service';
import { CentroCosto } from '../../shared/models/centro.model';

function setupCentro(centrosService: CentrosService): void {
  centrosService.centros.set([
    { _id: 'centro1', cliente_id: 'empresa1', codigo: 'C1', nombre: 'Centro 1', activo: true } as CentroCosto,
  ]);
}

describe('ActivosService.cargarImagenActivo', () => {
  let service: ActivosService;
  let centrosService: CentrosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ActivosService);
    centrosService = TestBed.inject(CentrosService);
    httpMock = TestBed.inject(HttpTestingController);
    setupCentro(centrosService);
  });

  afterEach(() => httpMock.verify());

  it('marca la imagen como cargando y luego lista con su object URL al resolver el blob', () => {
    service.cargarImagenActivo('activo1', 'centro1', 'doc1');
    expect(service.imagenesActivo().get('doc1')?.estado).toBe('cargando');

    const req = httpMock.expectOne(
      r => r.url.includes('/empresas/empresa1/centros/centro1/activos/activo1/documentos/doc1'),
    );
    expect(req.request.method).toBe('GET');
    req.flush(new Blob(['fake-image'], { type: 'image/png' }));

    const entry = service.imagenesActivo().get('doc1');
    expect(entry?.estado).toBe('lista');
    expect(entry?.url).toMatch(/^blob:/);
  });

  it('marca la imagen como error si la descarga falla', () => {
    service.cargarImagenActivo('activo1', 'centro1', 'doc2');
    httpMock.expectOne(r => r.url.includes('/documentos/doc2'))
      .flush(new Blob(['error']), { status: 500, statusText: 'Server Error' });
    expect(service.imagenesActivo().get('doc2')?.estado).toBe('error');
  });

  it('no dispara una segunda petición si la imagen ya está en el mapa', () => {
    service.cargarImagenActivo('activo1', 'centro1', 'doc1');
    httpMock.expectOne(() => true).flush(new Blob());
    service.cargarImagenActivo('activo1', 'centro1', 'doc1');
    httpMock.expectNone(() => true);
  });
});

describe('ActivosService.resetDocumentos — limpia imágenes', () => {
  let service: ActivosService;
  let centrosService: CentrosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ActivosService);
    centrosService = TestBed.inject(CentrosService);
    httpMock = TestBed.inject(HttpTestingController);
    setupCentro(centrosService);
  });

  afterEach(() => httpMock.verify());

  it('resetDocumentos vacía el mapa de imágenes cargadas', () => {
    service.cargarImagenActivo('activo1', 'centro1', 'doc1');
    httpMock.expectOne(() => true).flush(new Blob(['x'], { type: 'image/png' }));
    expect(service.imagenesActivo().size).toBe(1);

    service.resetDocumentos();

    expect(service.imagenesActivo().size).toBe(0);
  });
});
