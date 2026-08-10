# Galería de fotos en modal de revisión de activos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una columna "Galería de fotos" al modal `app-activo-revisar-modal`, que muestra como miniaturas scrolleables solo los documentos del activo cuyo `tipo_mime` es una imagen, y permite abrir cada una en una pestaña nueva.

**Architecture:** Cambio 100% frontend (Angular 21 standalone, signals). El componente modal sigue siendo "tonto" (sin HTTP): filtra imágenes vía un util puro, y emite un evento por cada imagen que necesita cargarse. `ActivosService` gana un signal `imagenesActivo` (map `docId → { url, estado }`) y un método `cargarImagenActivo()` que reutiliza el endpoint de descarga existente (protegido por JWT) pidiendo un `Blob`, en vez del endpoint público que usan logo/noticias. Las páginas `activos-page` y `mis-activos-page` conectan el nuevo `@Output`/`@Input` igual que ya conectan `descargarActivoDoc`.

**Tech Stack:** Angular 21 standalone components, signals, `HttpClient` + `HttpTestingController`, Vitest.

## Global Constraints

- Sin cambios en `back4` — se reutiliza `GET /empresas/:empresaId/centros/:centroId/activos/:activoId/documentos/:docId` tal cual existe hoy.
- No se crea ningún endpoint público para imágenes: siguen protegidas por `JwtAuthGuard` + `EmpresaAccessGuard`, cargadas vía blob autenticado.
- Sin generación de thumbnails en el backend: se escala la imagen completa por CSS (`object-fit: cover`).
- Galería solo en el modal principal (`ActivoRevisarModalComponent`) — el sub-modal "Detalle de actividad" no cambia.
- Click en una miniatura abre la imagen a tamaño completo en una pestaña nueva (`window.open`), sin lightbox propio.
- Sin soporte responsive/mobile — uso pensado para escritorio.
- Sin `any`. Signals para estado reactivo, nunca `BehaviorSubject`/`Subject`. Control flow `@if`/`@for`/`@switch` (nunca `*ngIf`/`*ngFor`). Componentes standalone.
- El componente modal no inyecta servicios ni hace llamadas HTTP — toda la lógica de red vive en `ActivosService`, orquestada por `ActivosPageComponent`/`MisActivosPageComponent`.

---

### Task 1: Utils puros de galería (`esImagenDoc`, `formatoImagen`)

**Files:**
- Create: `front4/src/app/features/activos/galeria-fotos.utils.ts`
- Test: `front4/src/app/features/activos/galeria-fotos.utils.spec.ts`

**Interfaces:**
- Produces: `esImagenDoc(doc: DocActivo): boolean`, `formatoImagen(tipoMime?: string): string` — usados por Task 4.

- [ ] **Step 1: Escribir el test que falla**

```ts
// front4/src/app/features/activos/galeria-fotos.utils.spec.ts
import { describe, it, expect } from 'vitest';
import { esImagenDoc, formatoImagen } from './galeria-fotos.utils';
import { DocActivo } from '../../shared/models/activo.model';

function doc(tipo_mime?: string): DocActivo {
  return { _id: '1', nombre: 'a', nombre_display: 'a', tipo_mime };
}

describe('esImagenDoc', () => {
  it('identifica documentos de imagen por tipo_mime', () => {
    expect(esImagenDoc(doc('image/png'))).toBe(true);
    expect(esImagenDoc(doc('image/jpeg'))).toBe(true);
  });

  it('descarta documentos que no son imagen', () => {
    expect(esImagenDoc(doc('application/pdf'))).toBe(false);
    expect(esImagenDoc(doc(undefined))).toBe(false);
  });
});

describe('formatoImagen', () => {
  it('mapea mimetypes conocidos a su etiqueta corta', () => {
    expect(formatoImagen('image/jpeg')).toBe('JPG');
    expect(formatoImagen('image/png')).toBe('PNG');
    expect(formatoImagen('image/webp')).toBe('WEBP');
    expect(formatoImagen('image/gif')).toBe('GIF');
  });

  it('deriva una etiqueta desde el subtipo cuando el mimetype no está en la tabla', () => {
    expect(formatoImagen('image/bmp')).toBe('BMP');
  });

  it('retorna vacío cuando no hay mimetype', () => {
    expect(formatoImagen(undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd front4 && npx vitest run src/app/features/activos/galeria-fotos.utils.spec.ts`
Expected: FAIL — `Cannot find module './galeria-fotos.utils'`

- [ ] **Step 3: Implementación mínima**

```ts
// front4/src/app/features/activos/galeria-fotos.utils.ts
import { DocActivo } from '../../shared/models/activo.model';

const FORMATOS_IMAGEN: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'image/gif': 'GIF',
};

export function esImagenDoc(doc: DocActivo): boolean {
  return !!doc.tipo_mime?.startsWith('image/');
}

export function formatoImagen(tipoMime?: string): string {
  if (!tipoMime) return '';
  return FORMATOS_IMAGEN[tipoMime] ?? tipoMime.split('/')[1]?.toUpperCase() ?? '';
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd front4 && npx vitest run src/app/features/activos/galeria-fotos.utils.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/activos/galeria-fotos.utils.ts front4/src/app/features/activos/galeria-fotos.utils.spec.ts
git commit -m "feat(front): utils para detectar documentos de imagen y su formato"
```

---

### Task 2: Modelo — `ImagenDocEstado`

**Files:**
- Modify: `front4/src/app/shared/models/activo.model.ts`

**Interfaces:**
- Produces: `ImagenDocEstado { url: string; estado: 'cargando' | 'lista' | 'error' }` — usado por Task 3 y Task 4.

No requiere test (solo tipos). Es un solo paso porque no hay ciclo de test/implementación para una interfaz.

- [ ] **Step 1: Agregar la interfaz**

Agregar en `front4/src/app/shared/models/activo.model.ts`, inmediatamente después de la interfaz `DocActivo` (línea 9):

```ts
export interface ImagenDocEstado {
  url: string;
  estado: 'cargando' | 'lista' | 'error';
}
```

- [ ] **Step 2: Commit**

```bash
git add front4/src/app/shared/models/activo.model.ts
git commit -m "feat(front): tipo ImagenDocEstado para el cache de miniaturas de activos"
```

---

### Task 3: `ActivosService` — cache de imágenes y carga vía blob

**Files:**
- Modify: `front4/src/app/features/activos/activos.service.ts`
- Test: `front4/src/app/features/activos/activos.service.spec.ts` (nuevo archivo)

**Interfaces:**
- Consumes: `ImagenDocEstado` (Task 2).
- Produces: `ActivosService.imagenesActivo: Signal<Map<string, ImagenDocEstado>>`, `cargarImagenActivo(activoId: string, centroId: string, docId: string): void`, `resetImagenesActivo(): void` — usados por Task 5 y Task 6. `resetDocumentos()` ahora también limpia `imagenesActivo`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// front4/src/app/features/activos/activos.service.spec.ts
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
      .flush('error', { status: 500, statusText: 'Server Error' });
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
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd front4 && npx vitest run src/app/features/activos/activos.service.spec.ts`
Expected: FAIL — `service.imagenesActivo is not a function` / `cargarImagenActivo is not a function`

- [ ] **Step 3: Implementación mínima**

En `front4/src/app/features/activos/activos.service.ts`:

Modificar el import de modelos (línea 6) para incluir `ImagenDocEstado`:

```ts
import { Activo, ActividadHistorialItem, CreateActivoDto, DocActivo, DocActividad, ImagenDocEstado, UpdateActivoDto } from '../../shared/models/activo.model';
```

Agregar el nuevo signal junto a los demás (después de la línea 26, `loadingDocumentosActividad`):

```ts
  readonly imagenesActivo = signal<Map<string, ImagenDocEstado>>(new Map());
```

Agregar los métodos nuevos (por ejemplo, después de `descargarDocumento`, línea 196):

```ts
  cargarImagenActivo(activoId: string, centroId: string, docId: string): void {
    if (this.imagenesActivo().has(docId)) return;
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) return;
    this.imagenesActivo.update(map => new Map(map).set(docId, { url: '', estado: 'cargando' }));
    const url = this.api.url(
      `/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${docId}`
    );
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        this.imagenesActivo.update(map => new Map(map).set(docId, { url: objectUrl, estado: 'lista' }));
      },
      error: () => {
        this.imagenesActivo.update(map => new Map(map).set(docId, { url: '', estado: 'error' }));
      },
    });
  }

  resetImagenesActivo(): void {
    this.imagenesActivo().forEach((img) => {
      if (img.estado === 'lista' && img.url) URL.revokeObjectURL(img.url);
    });
    this.imagenesActivo.set(new Map());
  }
```

Modificar `resetDocumentos()` (línea 240-244) para que también limpie las imágenes:

```ts
  resetDocumentos(): void {
    this.documentosActivo.set([]);
    this.documentosActividad.set([]);
    this.loadingDocumentosActividad.set(false);
    this.resetImagenesActivo();
  }
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd front4 && npx vitest run src/app/features/activos/activos.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/activos/activos.service.ts front4/src/app/features/activos/activos.service.spec.ts
git commit -m "feat(front): ActivosService carga imágenes de documentos vía blob autenticado"
```

---

### Task 4: `ActivoRevisarModalComponent` — columna de galería

**Files:**
- Modify: `front4/src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.ts`
- Test: `front4/src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.spec.ts` (nuevo archivo)

**Interfaces:**
- Consumes: `esImagenDoc`, `formatoImagen` (Task 1), `ImagenDocEstado` (Task 2).
- Produces: `@Input() imagenesActivo: Map<string, ImagenDocEstado>`, `@Output() cargarImagenActivo: EventEmitter<{ docId: string }>` — consumidos por Task 5 y Task 6.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
// front4/src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.spec.ts
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
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd front4 && npx vitest run src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.spec.ts`
Expected: FAIL — `.gallery-col`/`.thumb` no existen, `cargarImagenActivo` no existe en el componente.

- [ ] **Step 3: Implementación**

En `activo-revisar-modal.component.ts`:

Actualizar los imports (líneas 1-4):

```ts
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Activo, ActividadHistorialItem, DocActivo, DocActividad, ImagenDocEstado, TipoActivo, TipoActividad } from '../../../../shared/models/activo.model';
import { ActivoIconoComponent } from '../activo-icono/activo-icono.component';
import { esImagenDoc, formatoImagen } from '../../galeria-fotos.utils';
```

Reemplazar el bloque de template desde `<!-- Documentos del activo -->` (línea 44) hasta el cierre de `<!-- Historial de actividades -->` (línea 125) por:

```html
    <div class="modal-body" [class.modal-body--split]="imagenesGaleria.length > 0">
      <div class="main-col">
        <!-- Documentos del activo -->
        @if (mostrarDocsActivo()) {
          <div class="seccion">
            <p class="sec-label">Documentos del activo</p>
            @if (!documentosActivo.length) {
              <p class="empty-text">Este activo no tiene documentos adjuntos.</p>
            } @else {
              <div class="docs-list">
                @for (doc of documentosActivo; track doc._id) {
                  <div class="doc-row">
                    <svg class="doc-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                      <path d="M14 2v6h6"/>
                    </svg>
                    <div class="doc-info">
                      <span class="doc-nombre">{{ doc.nombre_display || doc.nombre }}</span>
                      <span class="doc-meta">{{ doc.tipo_contenido === 'link' ? 'Link externo' : formatBytes(doc.tamano_bytes) }}</span>
                    </div>
                    @if (doc.tipo_contenido === 'link') {
                      <button class="btn-ghost btn-sm doc-accion-btn" (click)="abrirDoc(doc.link_url)">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <path d="M15 3h6v6"/><path d="M10 14 21 3"/>
                        </svg>
                        Ir a link
                      </button>
                    } @else {
                      <button class="btn-ghost btn-sm doc-accion-btn"
                        (click)="descargarActivoDoc.emit({ docId: doc._id, nombreDisplay: doc.nombre_display })">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Descargar
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Descripción -->
        @if (activo?.descripcion) {
          <div class="seccion">
            <p class="sec-label">Descripción</p>
            <p class="descripcion-texto">{{ activo!.descripcion }}</p>
          </div>
        }

        <!-- Historial de actividades -->
        <div class="seccion">
          <p class="sec-label">Historial de actividades</p>
          @if (loadingHistorial) {
            <p class="empty-text">Cargando historial...</p>
          } @else if (!historial.length) {
            <p class="empty-text">Este activo no ha participado en ninguna actividad.</p>
          } @else {
            <div class="historial-list">
              @for (item of historial; track item._id) {
                <div class="hist-card" role="button" tabindex="0"
                  (click)="abrirActividad(item)" (keyup.enter)="abrirActividad(item)">
                  <div class="hist-card-header">
                    <span class="hist-fecha">{{ item.fecha | date:'dd/MM/yyyy' }}</span>
                    <div class="hist-nombre-wrap">
                      <span class="hist-nombre">{{ item.nombre }}</span>
                      @if (item.descripcion) {
                        <span class="hist-desc">{{ item.descripcion }}</span>
                      }
                    </div>
                    <span class="hist-tipo"
                      [style.color]="tipoActividadColor(item)"
                      [style.background]="tipoActividadColor(item) + '18'">
                      {{ tipoActividadNombre(item) }}
                    </span>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      @if (imagenesGaleria.length > 0) {
        <div class="gallery-col">
          <p class="sec-label">Galería de fotos <span class="sec-count">({{ imagenesGaleria.length }})</span></p>
          <div class="gallery-scroll">
            @for (doc of imagenesGaleria; track doc._id) {
              <div class="thumb" role="button" tabindex="0"
                (click)="abrirImagenCompleta(doc._id)" (keyup.enter)="abrirImagenCompleta(doc._id)">
                @switch (imagenEstado(doc._id)) {
                  @case ('lista') {
                    <img class="thumb-img" [src]="imagenUrl(doc._id)" [alt]="doc.nombre_display || doc.nombre" />
                  }
                  @case ('error') {
                    <div class="thumb-fallback thumb-fallback--error">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                        <path d="M14 2v6h6"/>
                      </svg>
                    </div>
                  }
                  @default {
                    <div class="thumb-fallback thumb-fallback--loading">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                        <path d="M14 2v6h6"/>
                      </svg>
                    </div>
                  }
                }
                <span class="fmt-badge">{{ formatoImagen(doc.tipo_mime) }}</span>
                <div class="thumb-caption">{{ doc.nombre_display || doc.nombre }}</div>
              </div>
            }
          </div>
        </div>
      }
    </div>
```

Agregar estilos nuevos al final del array `styles: []` (justo antes del cierre `` `] `` de la línea 301):

```css
    .modal-body { display: grid; grid-template-columns: 1fr; column-gap: 1.25rem; }
    .modal-body--split { grid-template-columns: 1fr 220px; }
    .main-col { min-width: 0; }

    .gallery-col {
      border-left: 1px solid rgba(34,33,33,.08);
      padding-left: 1.25rem;
      display: flex; flex-direction: column; min-width: 0;
    }
    .gallery-scroll {
      display: flex; flex-direction: column; gap: .65rem;
      max-height: 60vh; overflow-y: auto; padding-right: .25rem;
    }
    .sec-count { font-weight: 600; color: #9ca3af; text-transform: none; letter-spacing: 0; }

    .thumb {
      position: relative; border-radius: 10px; overflow: hidden;
      border: 1px solid rgba(34,33,33,.08); cursor: pointer; background: #f9fafb;
    }
    .thumb-img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
    .thumb-fallback {
      width: 100%; aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center;
      background: #f3f4f6; color: #9ca3af;
    }
    .thumb-fallback--loading { animation: thumb-pulse 1.2s ease-in-out infinite; }
    .thumb-fallback--error { color: #d1d5db; }
    @keyframes thumb-pulse { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
    .fmt-badge {
      position: absolute; top: .35rem; right: .35rem;
      font-size: .62rem; font-weight: 700; letter-spacing: .02em; color: #fff;
      background: rgba(15,23,42,.65); padding: .12rem .4rem; border-radius: 5px;
    }
    .thumb-caption {
      padding: .35rem .5rem .45rem; font-size: .72rem; color: #6b7280;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
```

Actualizar la clase del componente (líneas 303-320) para implementar `OnChanges`, agregar el nuevo `@Input`/`@Output` y los métodos nuevos:

```ts
export class ActivoRevisarModalComponent implements OnChanges {
  @Input() activo: Activo | null = null;
  @Input() historial: ActividadHistorialItem[] = [];
  @Input() loadingHistorial = false;
  @Input() documentosActivo: DocActivo[] = [];
  @Input() documentosActividad: DocActividad[] = [];
  @Input() loadingDocumentosActividad = false;
  @Input() imagenesActivo: Map<string, ImagenDocEstado> = new Map();

  @Output() cerrar             = new EventEmitter<void>();
  @Output() descargarActivoDoc = new EventEmitter<DescargarActivoDocEvt>();
  @Output() descargarActividadDoc = new EventEmitter<DescargarActividadDocEvt>();
  @Output() actividadAbierta   = new EventEmitter<ActividadHistorialItem>();
  @Output() cargarImagenActivo = new EventEmitter<{ docId: string }>();

  // Abierta por defecto: este modal siempre muestra el historial de
  // actividades del activo, así que sus documentos deben verse de entrada.
  protected mostrarDocsActivo     = signal(true);
  protected mostrarDocsActividad  = signal(false);
  protected actividadSeleccionada = signal<ActividadHistorialItem | null>(null);

  protected readonly formatoImagen = formatoImagen;

  get tipoActivo(): TipoActivo | null {
    if (!this.activo) return null;
    if (typeof this.activo.tipo_activo_id === 'object') return this.activo.tipo_activo_id as TipoActivo;
    return null;
  }

  get imagenesGaleria(): DocActivo[] {
    return this.documentosActivo.filter(esImagenDoc);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['documentosActivo'] && !changes['imagenesActivo']) return;
    for (const doc of this.imagenesGaleria) {
      if (!this.imagenesActivo.has(doc._id)) {
        this.cargarImagenActivo.emit({ docId: doc._id });
      }
    }
  }

  protected imagenEstado(docId: string): 'cargando' | 'lista' | 'error' {
    return this.imagenesActivo.get(docId)?.estado ?? 'cargando';
  }

  protected imagenUrl(docId: string): string {
    return this.imagenesActivo.get(docId)?.url ?? '';
  }

  protected abrirImagenCompleta(docId: string): void {
    const url = this.imagenUrl(docId);
    if (url) window.open(url, '_blank');
  }
```

(El resto de los métodos existentes — `abrirActividad`, `cerrarActividad`, `tipoActividadNombre`, `tipoActividadColor`, `formatBytes`, `abrirDoc` — quedan sin cambios, debajo de los nuevos.)

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd front4 && npx vitest run src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.ts front4/src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.spec.ts
git commit -m "feat(front): columna de galería de fotos en activo-revisar-modal"
```

---

### Task 5: Conectar `MisActivosPageComponent` (vista consumidor)

**Files:**
- Modify: `front4/src/app/features/activos/pages/mis-activos-page.component.ts`

**Interfaces:**
- Consumes: `ActivosService.imagenesActivo`, `cargarImagenActivo()` (Task 3); `ActivoRevisarModalComponent` `[imagenesActivo]`/`(cargarImagenActivo)` (Task 4).

No aplica TDD estricto: es solo wiring entre servicio y componente ya probados, sin lógica nueva propia. Se verifica manualmente en Task 7.

- [ ] **Step 1: Conectar el modal**

En el template (líneas 49-60), agregar el nuevo `@Input`/`@Output`:

```html
          <app-activo-revisar-modal
            [activo]="activoRevisando()"
            [historial]="service.historialActivo()"
            [loadingHistorial]="service.loadingHistorial()"
            [documentosActivo]="service.documentosActivo()"
            [documentosActividad]="service.documentosActividad()"
            [loadingDocumentosActividad]="service.loadingDocumentosActividad()"
            [imagenesActivo]="service.imagenesActivo()"
            (cerrar)="cerrarRevisar()"
            (descargarActivoDoc)="onDescargarActivoDoc($event)"
            (descargarActividadDoc)="onDescargarActividadDoc($event)"
            (actividadAbierta)="onActividadAbierta($event)"
            (cargarImagenActivo)="onCargarImagenActivo($event)">
          </app-activo-revisar-modal>
```

Agregar el método (junto a `onDescargarActivoDoc`, línea 163-167):

```ts
  protected onCargarImagenActivo(ev: { docId: string }): void {
    const activo = this.activoRevisando();
    if (!activo) return;
    this.service.cargarImagenActivo(activo._id, activo.centro_costo_id, ev.docId);
  }
```

Reemplazar el `<div class="modal" ...>` (línea 48) para que el ancho reaccione a si hay imágenes:

```html
        <div class="modal" [style.max-width]="anchoModalRevisar" (click)="$event.stopPropagation()">
```

Quitar la línea `max-width: 700px;` del bloque `.modal` en `styles` (línea ~91) y agregar el getter en la clase (junto a `activoRevisando`, línea 103):

```ts
  protected get anchoModalRevisar(): string {
    const hayImagenes = this.service.documentosActivo().some(d => d.tipo_mime?.startsWith('image/'));
    return hayImagenes ? '960px' : '700px';
  }
```

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores nuevos relacionados a este archivo.

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/features/activos/pages/mis-activos-page.component.ts
git commit -m "feat(front): conectar galería de fotos en vista consumidor de activos"
```

---

### Task 6: Conectar `ActivosPageComponent` (vista admin)

**Files:**
- Modify: `front4/src/app/features/activos/pages/activos-page.component.ts`
- Modify: `front4/src/app/features/activos/pages/activos-page.component.html`

**Interfaces:**
- Consumes: igual que Task 5.

- [ ] **Step 1: Conectar el modal**

En `activos-page.component.html` (líneas 170-181), agregar el nuevo `@Input`/`@Output`:

```html
        <app-activo-revisar-modal
          [activo]="activoRevisando()"
          [historial]="service.historialActivo()"
          [loadingHistorial]="service.loadingHistorial()"
          [documentosActivo]="service.documentosActivo()"
          [documentosActividad]="service.documentosActividad()"
          [loadingDocumentosActividad]="service.loadingDocumentosActividad()"
          [imagenesActivo]="service.imagenesActivo()"
          (cerrar)="cerrar()"
          (descargarActivoDoc)="onDescargarActivoDoc($event)"
          (descargarActividadDoc)="onDescargarActividadDoc($event)"
          (actividadAbierta)="onActividadAbierta($event)"
          (cargarImagenActivo)="onCargarImagenActivo($event)">
        </app-activo-revisar-modal>
```

Reemplazar el ancho fijo del modal (línea 96) para que use un getter:

```html
    <div class="modal" [style.max-width]="modalAncho" (click)="$event.stopPropagation()">
```

- [ ] **Step 2: Agregar los métodos en el componente**

En `activos-page.component.ts`, agregar junto a `onDescargarActivoDoc` (línea 351-355):

```ts
  protected onCargarImagenActivo(ev: { docId: string }): void {
    const activo = this.activoRevisando();
    if (!activo) return;
    this.service.cargarImagenActivo(activo._id, activo.centro_costo_id, ev.docId);
  }

  protected hayImagenesGaleria(): boolean {
    return this.service.documentosActivo().some(d => d.tipo_mime?.startsWith('image/'));
  }

  protected get modalAncho(): string {
    if (this.modal() === 'tipos') return '1000px';
    if (this.modal() === 'revisar' && this.hayImagenesGaleria()) return '1120px';
    return '860px';
  }
```

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npx tsc -p tsconfig.app.json --noEmit`
Expected: sin errores nuevos relacionados a estos archivos.

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/activos/pages/activos-page.component.ts front4/src/app/features/activos/pages/activos-page.component.html
git commit -m "feat(front): conectar galería de fotos en vista admin de activos"
```

---

### Task 7: Verificación manual en navegador

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Levantar backend y frontend**

```bash
cd back4 && npm run start:dev
cd front4 && npm start
```

- [ ] **Step 2: Preparar datos de prueba**

En `/activos` (admin), abrir un activo existente (o crear uno) y, desde su formulario de edición, adjuntar al menos 2 documentos que sean imágenes (`.jpg`/`.png`) y 1 documento que no lo sea (`.pdf`), usando el flujo normal de "Agregar documento".

- [ ] **Step 3: Caso con fotos**

Click en "Revisar" sobre ese activo. Verificar:
- Aparece la columna "Galería de fotos (N)" a la derecha, con una miniatura por cada imagen adjunta (el PDF no aparece ahí, sí en "Documentos del activo").
- Cada miniatura muestra su badge de formato (JPG/PNG) en la esquina.
- Si hay más miniaturas de las que caben, la columna scrollea de forma independiente del resto del modal (el resto no se mueve).
- Click en una miniatura abre una pestaña nueva del navegador con la imagen a tamaño completo.

- [ ] **Step 4: Caso sin fotos**

Repetir sobre un activo sin documentos de imagen adjuntos. Verificar que la columna de galería no aparece y el modal se ve igual que antes del cambio.

- [ ] **Step 5: Caso de error de red**

Con las devtools abiertas, en la pestaña Network, bloquear (o tirar offline) la petición a `.../documentos/:docId` de una de las imágenes antes de que cargue, y verificar que esa miniatura puntual muestra el ícono de "no disponible" sin romper el resto de la galería ni del modal.

- [ ] **Step 6: Repetir en modo consumidor**

Repetir los pasos 3 y 4 en `/mis-activos` (modo consumidor), para confirmar que `MisActivosPageComponent` también funciona.

- [ ] **Step 7: Confirmar con el usuario**

Reportar el resultado de los pasos anteriores antes de dar la tarea por terminada.
