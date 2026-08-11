import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ActividadesService } from './actividades.service';
import { CentrosService } from '../centros/centros.service';
import { CentroCosto } from '../../shared/models/centro.model';
import { Actividad } from '../../shared/models/actividad.model';

function setup(centrosService: CentrosService, service: ActividadesService): void {
  centrosService.centros.set([
    { _id: 'centro1', cliente_id: 'empresa1', codigo: 'C1', nombre: 'Centro 1', activo: true } as CentroCosto,
  ]);
  service.actividades.set([
    { _id: 'act1', centro_costo_id: 'centro1' } as Actividad,
  ]);
}

describe('ActividadesService — documentos', () => {
  let service: ActividadesService;
  let centrosService: CentrosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ActividadesService);
    centrosService = TestBed.inject(CentrosService);
    httpMock = TestBed.inject(HttpTestingController);
    setup(centrosService, service);
  });

  afterEach(() => httpMock.verify());

  it('renombrarDocumento hace PATCH con el nuevo nombre y refresca la lista', () => {
    service.renombrarDocumento('act1', 'doc1', 'nuevo_nombre.pdf');
    const req = httpMock.expectOne(
      r => r.url.includes('/actividades/act1/documentos/doc1') && r.method === 'PATCH',
    );
    expect(req.request.body).toEqual({ nombre_display: 'nuevo_nombre.pdf' });
    req.flush({});
    httpMock.expectOne(r => r.url.includes('/actividades/act1/documentos') && r.method === 'GET').flush([]);
  });

  it('eliminarDocumento llama onSuccess cuando el servidor confirma', () => {
    let called = false;
    service.eliminarDocumento('act1', 'doc1', () => { called = true; });
    httpMock.expectOne(r => r.url.includes('/actividades/act1/documentos/doc1') && r.method === 'DELETE').flush({});
    httpMock.expectOne(r => r.url.includes('/actividades/act1/documentos') && r.method === 'GET').flush([]);
    expect(called).toBe(true);
  });

  it('eliminarDocumento llama onError si el servidor falla', () => {
    let called = false;
    service.eliminarDocumento('act1', 'doc1', undefined, () => { called = true; });
    httpMock.expectOne(r => r.url.includes('/actividades/act1/documentos/doc1') && r.method === 'DELETE')
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });
    expect(called).toBe(true);
  });
});
