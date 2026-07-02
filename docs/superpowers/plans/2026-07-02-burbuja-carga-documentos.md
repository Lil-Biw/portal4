# Burbuja de progreso de carga de documentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el feedback binario "nada → terminado" de la subida de documentos por una burbuja flotante que muestra, por archivo, el % de progreso real y un check al terminar — corrigiendo el bug donde subir dos archivos seguidos mezcla el orden de las notificaciones.

**Architecture:** `DocumentosService.subir()` pasa de un `.subscribe()` interno de una sola vez a devolver un `Observable<HttpEvent<DocumentoItem>>` con `reportProgress: true`. Cada página (`documentos-admin-page`, `documentos-consumidor-page`) mantiene su propia cola de subidas vía una función de estado `createUploadQueue()` (mismo patrón que `createCalendarState()` ya usado en el proyecto) y renderiza un componente presentacional nuevo `UploadBubbleComponent`.

**Tech Stack:** Angular 21 standalone, signals, RxJS (`HttpClient` events), Vitest + `@angular/core/testing` (TestBed) para tests, `HttpClientTestingModule`/`HttpTestingController` para el service.

## Global Constraints

- Alcance: solo `DocumentosAdminPageComponent` y `DocumentosConsumidorPageComponent`. No tocar Activos/Actividades/Solicitudes.
- La burbuja es local a la página (no un overlay global de la app).
- El progreso debe ser el % real de bytes subidos (`HttpEventType.UploadProgress`), no un spinner indeterminado.
- La burbuja permanece visible hasta que el usuario la cierra manualmente (sin auto-ocultado).
- Cada subida nueva agrega una fila a la cola; nunca sobrescribe el estado de una subida anterior.
- No usar `any`; sin `BehaviorSubject`/`Subject`, usar signals.
- Reutilizar el patrón de error ya usado en los services: `err?.error?.message` del backend, con fallback genérico.

---

### Task 1: Estado de cola de subidas — `createUploadQueue()`

**Files:**
- Create: `front4/src/app/shared/upload-queue-state.ts`
- Test: `front4/src/app/shared/upload-queue-state.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export type UploadEstado = 'subiendo' | 'listo' | 'error';

  export interface UploadItem {
    id: string;
    nombre: string;
    progreso: number;      // 0-100
    estado: UploadEstado;
    errorMsg?: string;
  }

  export function createUploadQueue(): {
    items: Signal<UploadItem[]>;
    agregar(nombre: string): string;                       // devuelve el id generado
    actualizarProgreso(id: string, progreso: number): void;
    marcarListo(id: string): void;
    marcarError(id: string, errorMsg: string): void;
    reiniciar(id: string): void;                            // para reintentar: vuelve a 'subiendo', progreso 0, limpia errorMsg
    limpiar(): void;
  }
  ```
  Usado por Task 3 (`UploadBubbleComponent`, vía el tipo `UploadItem`) y Tasks 5/6 (páginas, vía `createUploadQueue()`).

- [ ] **Step 1: Escribir el test que falla**

Crear `front4/src/app/shared/upload-queue-state.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createUploadQueue } from './upload-queue-state';

describe('createUploadQueue', () => {
  it('agrega un item en estado subiendo con progreso 0', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('factura.pdf');
    expect(queue.items()).toEqual([
      { id, nombre: 'factura.pdf', progreso: 0, estado: 'subiendo' },
    ]);
  });

  it('nunca sobrescribe un item existente al agregar uno nuevo', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf');
    const id2 = queue.agregar('b.pdf');
    expect(id1).not.toBe(id2);
    expect(queue.items().map(i => i.nombre)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('actualiza el progreso del item correcto', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf');
    const id2 = queue.agregar('b.pdf');
    queue.actualizarProgreso(id2, 40);
    expect(queue.items().find(i => i.id === id1)?.progreso).toBe(0);
    expect(queue.items().find(i => i.id === id2)?.progreso).toBe(40);
  });

  it('marca un item como listo con progreso 100', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf');
    queue.actualizarProgreso(id, 60);
    queue.marcarListo(id);
    expect(queue.items().find(i => i.id === id)).toEqual({
      id, nombre: 'a.pdf', progreso: 100, estado: 'listo',
    });
  });

  it('marca un item como error con mensaje', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf');
    queue.marcarError(id, 'Archivo demasiado grande');
    const item = queue.items().find(i => i.id === id);
    expect(item?.estado).toBe('error');
    expect(item?.errorMsg).toBe('Archivo demasiado grande');
  });

  it('reinicia un item en error de vuelta a subiendo, progreso 0, sin errorMsg', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf');
    queue.marcarError(id, 'Error de red');
    queue.reiniciar(id);
    expect(queue.items().find(i => i.id === id)).toEqual({
      id, nombre: 'a.pdf', progreso: 0, estado: 'subiendo',
    });
  });

  it('limpiar vacía la cola', () => {
    const queue = createUploadQueue();
    queue.agregar('a.pdf');
    queue.agregar('b.pdf');
    queue.limpiar();
    expect(queue.items()).toEqual([]);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `cd front4 && npx ng test --include='src/app/shared/upload-queue-state.spec.ts'`
Expected: FAIL — `Cannot find module './upload-queue-state'`

- [ ] **Step 3: Implementar `createUploadQueue()`**

Crear `front4/src/app/shared/upload-queue-state.ts`:

```ts
import { signal, Signal } from '@angular/core';

export type UploadEstado = 'subiendo' | 'listo' | 'error';

export interface UploadItem {
  id: string;
  nombre: string;
  progreso: number;
  estado: UploadEstado;
  errorMsg?: string;
}

export function createUploadQueue(): {
  items: Signal<UploadItem[]>;
  agregar(nombre: string): string;
  actualizarProgreso(id: string, progreso: number): void;
  marcarListo(id: string): void;
  marcarError(id: string, errorMsg: string): void;
  reiniciar(id: string): void;
  limpiar(): void;
} {
  const items = signal<UploadItem[]>([]);
  let nextId = 0;

  function agregar(nombre: string): string {
    const id = `upload-${nextId++}`;
    items.update(q => [...q, { id, nombre, progreso: 0, estado: 'subiendo' }]);
    return id;
  }

  function actualizarProgreso(id: string, progreso: number): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso } : i)));
  }

  function marcarListo(id: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso: 100, estado: 'listo' as const } : i)));
  }

  function marcarError(id: string, errorMsg: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, estado: 'error' as const, errorMsg } : i)));
  }

  function reiniciar(id: string): void {
    items.update(q => q.map(i => (i.id === id ? { id: i.id, nombre: i.nombre, progreso: 0, estado: 'subiendo' as const } : i)));
  }

  function limpiar(): void {
    items.set([]);
  }

  return { items, agregar, actualizarProgreso, marcarListo, marcarError, reiniciar, limpiar };
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `cd front4 && npx ng test --include='src/app/shared/upload-queue-state.spec.ts'`
Expected: PASS — 7 tests verdes

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/shared/upload-queue-state.ts front4/src/app/shared/upload-queue-state.spec.ts
git commit -m "feat(front): agregar createUploadQueue para cola de subidas por archivo"
```

---

### Task 2: `DocumentosService.subir()` con progreso real por bytes

**Files:**
- Modify: `front4/src/app/features/documentos/documentos.service.ts:171-214` (método `subir`) y línea 1-7 (imports)
- Test: `front4/src/app/features/documentos/documentos.service.spec.ts` (nuevo)

**Interfaces:**
- Consumes: ninguno de tasks previas.
- Produces: `DocumentosService.subir(...): Observable<HttpEvent<DocumentoItem>>` — usado por Tasks 3 y 4 (páginas).

- [ ] **Step 1: Escribir el test que falla**

Crear `front4/src/app/features/documentos/documentos.service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `cd front4 && npx ng test --include='src/app/features/documentos/documentos.service.spec.ts'`
Expected: FAIL — el tipo de retorno actual de `subir()` es `void`, no hay nada que suscribir; el test debería fallar al llamar `.subscribe` sobre `undefined`.

- [ ] **Step 3: Reescribir `subir()` para devolver el stream de eventos HTTP**

En `front4/src/app/features/documentos/documentos.service.ts`, cambiar los imports del encabezado (líneas 1-7):

```ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, forkJoin, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { Status } from '../../shared/models/status.model';
import { asId, NOTIFY_COOLDOWN_MS } from '../../shared/utils';
```

Reemplazar el método `subir` completo (líneas 171-214) por:

```ts
  subir(
    file: File,
    tipo: DocTipo,
    empresaId?: string,
    centroId?: string,
    proyectoId?: string,
    nombreDisplay?: string,
    categoria?: string,
  ): Observable<HttpEvent<DocumentoItem>> {
    if (!empresaId) return throwError(() => new Error('Empresa no seleccionada'));
    if (tipo === 'centro' && !centroId) return throwError(() => new Error('Selecciona un centro de costos primero.'));
    if (tipo === 'proyecto' && (!centroId || !proyectoId)) return throwError(() => new Error('Selecciona un proyecto primero.'));

    const form = new FormData();
    form.append('archivo', file);
    if (nombreDisplay) form.append('nombre_display', nombreDisplay);
    if (categoria) form.append('categoria', categoria);

    let url: string;
    if (tipo === 'empresa') {
      url = this.api.url(`/empresas/${empresaId}/documentos`);
    } else if (tipo === 'proyecto' && centroId && proyectoId) {
      url = this.api.url(`/empresas/${empresaId}/centros/${centroId}/proyectos/${proyectoId}/documentos`);
    } else if (tipo === 'centro' && centroId) {
      url = this.api.url(`/empresas/${empresaId}/centros/${centroId}/documentos`);
    } else {
      return throwError(() => new Error('Contexto insuficiente para subir documento'));
    }

    return this.http.post<DocumentoItem>(url, form, { reportProgress: true, observe: 'events' }).pipe(
      tap(event => {
        if (event.type === HttpEventType.Response) {
          if (tipo === 'empresa') this.cargarEmpresa(empresaId);
          else if (tipo === 'centro' && centroId) this.cargarCentro(empresaId, centroId);
          else if (tipo === 'proyecto' && centroId && proyectoId) this.cargarProyecto(empresaId, centroId, proyectoId);
        }
      }),
    );
  }
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `cd front4 && npx ng test --include='src/app/features/documentos/documentos.service.spec.ts'`
Expected: PASS — 3 tests verdes

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/documentos/documentos.service.ts front4/src/app/features/documentos/documentos.service.spec.ts
git commit -m "feat(back-front): DocumentosService.subir reporta progreso real por bytes"
```

---

### Task 3: `UploadBubbleComponent`

**Files:**
- Create: `front4/src/app/shared/components/upload-bubble/upload-bubble.component.ts`
- Test: `front4/src/app/shared/components/upload-bubble/upload-bubble.component.spec.ts`

**Interfaces:**
- Consumes: `UploadItem`, `UploadEstado` de `../../upload-queue-state` (Task 1).
- Produces: componente `<app-upload-bubble [items]="..." (cerrar)="..." (reintentar)="..."/>`, usado por Tasks 5 y 6.

- [ ] **Step 1: Escribir el test que falla**

Crear `front4/src/app/shared/components/upload-bubble/upload-bubble.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { UploadBubbleComponent } from './upload-bubble.component';
import { UploadItem } from '../../upload-queue-state';

describe('UploadBubbleComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UploadBubbleComponent] }).compileComponents();
  });

  it('no renderiza nada cuando la lista de items está vacía', () => {
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.upload-bubble')).toBeNull();
  });

  it('renderiza una fila por item con el % para los que están subiendo', () => {
    const items: UploadItem[] = [
      { id: '1', nombre: 'a.pdf', progreso: 40, estado: 'subiendo' },
      { id: '2', nombre: 'b.pdf', progreso: 100, estado: 'listo' },
    ];
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const filas = el.querySelectorAll('.upload-item');
    expect(filas.length).toBe(2);
    expect(el.textContent).toContain('a.pdf');
    expect(el.textContent).toContain('40%');
    expect(el.textContent).toContain('b.pdf');
  });

  it('muestra el mensaje de error y un botón reintentar para items en error', () => {
    const items: UploadItem[] = [
      { id: '1', nombre: 'c.pdf', progreso: 0, estado: 'error', errorMsg: 'Archivo muy grande' },
    ];
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Archivo muy grande');
    expect(el.querySelector('.item-retry')).not.toBeNull();
  });

  it('emite reintentar con el id correcto al hacer click en el botón', () => {
    const items: UploadItem[] = [
      { id: 'x1', nombre: 'c.pdf', progreso: 0, estado: 'error', errorMsg: 'Error de red' },
    ];
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    let emitido = '';
    fixture.componentInstance.reintentar.subscribe((id: string) => { emitido = id; });
    (fixture.nativeElement.querySelector('.item-retry') as HTMLButtonElement).click();
    expect(emitido).toBe('x1');
  });

  it('emite cerrar al hacer click en el botón de cierre', () => {
    const items: UploadItem[] = [{ id: '1', nombre: 'a.pdf', progreso: 10, estado: 'subiendo' }];
    const fixture = TestBed.createComponent(UploadBubbleComponent);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    let cerrado = false;
    fixture.componentInstance.cerrar.subscribe(() => { cerrado = true; });
    (fixture.nativeElement.querySelector('.bubble-close') as HTMLButtonElement).click();
    expect(cerrado).toBe(true);
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `cd front4 && npx ng test --include='src/app/shared/components/upload-bubble/upload-bubble.component.spec.ts'`
Expected: FAIL — `Cannot find module './upload-bubble.component'`

- [ ] **Step 3: Implementar `UploadBubbleComponent`**

Crear `front4/src/app/shared/components/upload-bubble/upload-bubble.component.ts`:

```ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UploadItem } from '../../upload-queue-state';

@Component({
  selector: 'app-upload-bubble',
  standalone: true,
  template: `
    @if (items.length > 0) {
      <div class="upload-bubble">
        <div class="bubble-head">
          <div class="bubble-head-title">
            Subiendo documentos
            <span class="count">{{ items.length }}</span>
          </div>
          <button class="bubble-close" type="button" aria-label="Cerrar" title="Cerrar" (click)="cerrar.emit()">&times;</button>
        </div>

        <div class="bubble-list">
          @for (item of items; track item.id) {
            <div class="upload-item">
              @if (item.estado === 'subiendo') {
                <div class="item-icon uploading" [style.--pct]="item.progreso"><span>{{ item.progreso }}%</span></div>
                <div class="item-body">
                  <div class="item-name">{{ item.nombre }}</div>
                  <div class="progress-track"><div class="progress-fill" [style.width.%]="item.progreso"></div></div>
                </div>
              } @else if (item.estado === 'listo') {
                <div class="item-icon done">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div class="item-body">
                  <div class="item-name">{{ item.nombre }}</div>
                  <div class="item-meta">Subido correctamente</div>
                </div>
              } @else {
                <div class="item-icon error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <div class="item-body">
                  <div class="item-name">{{ item.nombre }}</div>
                  <div class="item-meta error-text">{{ item.errorMsg }}</div>
                </div>
                <button class="item-retry" type="button" (click)="reintentar.emit(item.id)">Reintentar</button>
              }
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .upload-bubble {
      position: fixed;
      right: 1.5rem;
      bottom: 1.5rem;
      width: 340px;
      background: #fff;
      border-radius: 14px;
      box-shadow: 0 12px 32px rgba(15,23,42,.16), 0 2px 8px rgba(15,23,42,.08);
      overflow: hidden;
      font-size: .875rem;
      z-index: 1000;
    }
    .bubble-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .75rem 1rem;
      background: rgba(0,149,214,.06);
      border-bottom: 1px solid rgba(0,149,214,.15);
    }
    .bubble-head-title {
      display: flex;
      align-items: center;
      gap: .5rem;
      font-weight: 700;
      color: #0075a8;
    }
    .bubble-head-title .count {
      font-size: .72rem;
      font-weight: 700;
      color: #0095d6;
      background: rgba(0,149,214,.12);
      padding: .1rem .5rem;
      border-radius: 999px;
    }
    .bubble-close {
      border: none;
      background: transparent;
      color: #6b7280;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background .15s, color .15s;
    }
    .bubble-close:hover { background: rgba(34,33,33,.08); color: #1f2937; }
    .bubble-list {
      display: flex;
      flex-direction: column;
      max-height: 280px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(0,0,0,.13) transparent;
    }
    .bubble-list::-webkit-scrollbar { width: 4px; }
    .bubble-list::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 4px; }
    .upload-item {
      display: flex;
      align-items: center;
      gap: .7rem;
      padding: .7rem 1rem;
      border-bottom: 1px solid rgba(34,33,33,.06);
    }
    .upload-item:last-child { border-bottom: none; }
    .item-icon {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .item-icon svg { width: 17px; height: 17px; }
    .item-icon.uploading {
      background: conic-gradient(#0095d6 calc(var(--pct) * 1%), rgba(0,149,214,.14) 0);
      position: relative;
    }
    .item-icon.uploading::after {
      content: "";
      position: absolute;
      inset: 4px;
      background: #fff;
      border-radius: 50%;
    }
    .item-icon.uploading span {
      position: relative;
      z-index: 1;
      font-size: .62rem;
      font-weight: 800;
      color: #0075a8;
      font-variant-numeric: tabular-nums;
    }
    .item-icon.done { background: rgba(16,185,129,.14); color: #10b981; }
    .item-icon.error { background: rgba(239,68,68,.12); color: #ef4444; }
    .item-body { min-width: 0; flex: 1; }
    .item-name {
      font-weight: 600;
      color: #1f2937;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .item-meta { font-size: .76rem; color: #6b7280; margin-top: .15rem; }
    .item-meta.error-text { color: #ef4444; font-weight: 600; }
    .progress-track {
      margin-top: .35rem;
      height: 4px;
      border-radius: 999px;
      background: rgba(0,149,214,.12);
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #0095d6, #0075a8);
      transition: width .2s ease;
    }
    .item-retry {
      border: 1px solid rgba(239,68,68,.3);
      background: rgba(239,68,68,.06);
      color: #ef4444;
      font-size: .72rem;
      font-weight: 700;
      padding: .25rem .55rem;
      border-radius: 6px;
      cursor: pointer;
      flex-shrink: 0;
      white-space: nowrap;
    }
    @media (prefers-reduced-motion: reduce) {
      .progress-fill { transition: none; }
    }
  `],
})
export class UploadBubbleComponent {
  @Input() items: UploadItem[] = [];
  @Output() cerrar = new EventEmitter<void>();
  @Output() reintentar = new EventEmitter<string>();
}
```

- [ ] **Step 4: Ejecutar el test y verificar que pasa**

Run: `cd front4 && npx ng test --include='src/app/shared/components/upload-bubble/upload-bubble.component.spec.ts'`
Expected: PASS — 5 tests verdes

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/shared/components/upload-bubble/
git commit -m "feat(front): agregar UploadBubbleComponent presentacional"
```

---

### Task 4: Integrar la burbuja en `DocumentosAdminPageComponent`

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`

**Interfaces:**
- Consumes: `createUploadQueue()` (Task 1), `DocumentosService.subir()` devolviendo `Observable<HttpEvent<DocumentoItem>>` (Task 2), `UploadBubbleComponent` (Task 3).

No hay test automatizado en este task: es cableado de UI sobre unidades ya cubiertas por tests (Tasks 1-3), y el resto de `documentos-admin-page.component.ts` no tiene precedente de tests de componente en este proyecto (solo `app.spec.ts` prueba el shell raíz). Se verifica manualmente en el navegador (Task 6).

- [ ] **Step 1: Actualizar imports y agregar los imports del componente**

En `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`, reemplazar las líneas 1-11 por:

```ts
import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem } from '../documentos.service';
import { ClientesService } from '../../clientes/clientes.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { SolicitudesService, CreateSolicitudDto, UpdateSolicitudDto, EstadoSolicitud, Solicitud } from '../../solicitudes/solicitudes.service';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { AuthService } from '../../auth/auth.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { UploadBubbleComponent } from '../../../shared/components/upload-bubble/upload-bubble.component';
import { createUploadQueue } from '../../../shared/upload-queue-state';
import { asId, detectarCategoriaDocumento } from '../../../shared/utils';
```

Actualizar el decorador `@Component` (línea ~30-35):

```ts
@Component({
  selector: 'app-documentos-admin-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, UploadBubbleComponent],
  templateUrl: './documentos-admin-page.component.html',
})
```

- [ ] **Step 2: Agregar el estado de la cola y el contexto de reintento**

Dentro de la clase `DocumentosAdminPageComponent`, junto a `protected panels: Record<DocTipo, PanelState> = {...}` (línea ~132), agregar:

```ts
  protected readonly uploadQueue = createUploadQueue();
  private readonly retryContext = new Map<string, {
    file: File; tipo: DocTipo; empresaId: string; centroId?: string; proyectoId?: string;
    nombreDisplay?: string; categoria?: string;
  }>();
```

- [ ] **Step 3: Reemplazar `confirmarSubida` y agregar los métodos de subida/reintento/cierre**

Reemplazar el método `confirmarSubida` existente (líneas 433-447) por:

```ts
  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    if (!p.selectedFile) return;
    const ctx = {
      file: p.selectedFile,
      tipo,
      empresaId: this.selectedEmpresaId,
      centroId: (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined,
      proyectoId: (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined,
      nombreDisplay: p.nombreInput || undefined,
      categoria: p.categoriaInput || undefined,
    };
    const id = this.uploadQueue.agregar(ctx.nombreDisplay || ctx.file.name);
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);

    p.selectedFile = null;
    p.nombreInput = '';
    p.showUpload = false;
  }

  reintentarSubida(id: string): void {
    const ctx = this.retryContext.get(id);
    if (!ctx) return;
    this.uploadQueue.reiniciar(id);
    this.ejecutarSubida(id, ctx);
  }

  cerrarUploadBubble(): void {
    this.uploadQueue.limpiar();
    this.retryContext.clear();
  }

  private ejecutarSubida(id: string, ctx: {
    file: File; tipo: DocTipo; empresaId: string; centroId?: string; proyectoId?: string;
    nombreDisplay?: string; categoria?: string;
  }): void {
    this.service.subir(ctx.file, ctx.tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
      .subscribe({
        next: (event: HttpEvent<DocumentoItem>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadQueue.actualizarProgreso(id, Math.round((100 * event.loaded) / event.total));
          } else if (event.type === HttpEventType.Response) {
            this.uploadQueue.marcarListo(id);
          }
        },
        error: (err) => {
          const raw = err?.error?.message;
          const text = Array.isArray(raw) ? raw.join('. ') : (raw ?? err?.message ?? 'Error al cargar');
          this.uploadQueue.marcarError(id, text);
        },
      });
  }
```

- [ ] **Step 4: Agregar `<app-upload-bubble>` al final del template**

En `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`, agregar al final del archivo (después del último `}` de cierre):

```html
<app-upload-bubble
  [items]="uploadQueue.items()"
  (cerrar)="cerrarUploadBubble()"
  (reintentar)="reintentarSubida($event)">
</app-upload-bubble>
```

- [ ] **Step 5: Verificar que el proyecto compila**

Run: `cd front4 && npx ng build`
Expected: build exitoso sin errores de tipo (en particular, sin referencias colgantes a la vieja firma `void` de `subir()`)

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-admin-page.component.ts front4/src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front): burbuja de progreso de carga en Documentos (admin)"
```

---

### Task 5: Integrar la burbuja en `DocumentosConsumidorPageComponent`

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts`
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html`

**Interfaces:**
- Consumes: los mismos que Task 4 (`createUploadQueue()`, `DocumentosService.subir()`, `UploadBubbleComponent`).

Mismo criterio que Task 4: sin test de componente dedicado, verificación manual en Task 6.

- [ ] **Step 1: Actualizar imports y el decorador del componente**

En `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts`, reemplazar las líneas 1-11 por:

```ts
import { Component, OnInit, inject, signal, computed, effect, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { DocumentosService, DocTipo, CATEGORIAS_DOCUMENTO, DocumentoItem } from '../documentos.service';
import { CentrosService } from '../../centros/centros.service';
import { ProyectosService } from '../../proyectos/proyectos.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { SolicitudesService, EstadoSolicitud, Solicitud } from '../../solicitudes/solicitudes.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { UploadBubbleComponent } from '../../../shared/components/upload-bubble/upload-bubble.component';
import { createUploadQueue } from '../../../shared/upload-queue-state';
import { asId, detectarCategoriaDocumento } from '../../../shared/utils';
```

Actualizar el decorador `@Component` (líneas ~23-28):

```ts
@Component({
  selector: 'app-documentos-consumidor-page',
  standalone: true,
  imports: [NgTemplateOutlet, FormsModule, StatusBannerComponent, UploadBubbleComponent],
  templateUrl: './documentos-consumidor-page.component.html',
})
```

- [ ] **Step 2: Agregar el estado de la cola y el contexto de reintento**

Junto a `protected panels: Record<DocTipo, PanelState> = {...}` (línea ~60), agregar:

```ts
  protected readonly uploadQueue = createUploadQueue();
  private readonly retryContext = new Map<string, {
    file: File; tipo: DocTipo; empresaId: string; centroId?: string; proyectoId?: string;
    nombreDisplay?: string; categoria?: string;
  }>();
```

- [ ] **Step 3: Reemplazar `confirmarSubida` y agregar los métodos de subida/reintento/cierre**

Reemplazar el método `confirmarSubida` existente (líneas 330-345) por:

```ts
  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    if (!p.selectedFile) return;
    const ctx = {
      file: p.selectedFile,
      tipo,
      empresaId: this.consumidorContext.empresaSeleccionada()?._id ?? '',
      centroId: this.selectedCentroIdC() || undefined,
      proyectoId: this.selectedProyectoIdC() || undefined,
      nombreDisplay: p.nombreInput || undefined,
      categoria: p.categoriaInput || undefined,
    };
    const id = this.uploadQueue.agregar(ctx.nombreDisplay || ctx.file.name);
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);

    p.selectedFile = null;
    p.nombreInput = '';
    p.showUpload = false;
  }

  reintentarSubida(id: string): void {
    const ctx = this.retryContext.get(id);
    if (!ctx) return;
    this.uploadQueue.reiniciar(id);
    this.ejecutarSubida(id, ctx);
  }

  cerrarUploadBubble(): void {
    this.uploadQueue.limpiar();
    this.retryContext.clear();
  }

  private ejecutarSubida(id: string, ctx: {
    file: File; tipo: DocTipo; empresaId: string; centroId?: string; proyectoId?: string;
    nombreDisplay?: string; categoria?: string;
  }): void {
    this.service.subir(ctx.file, ctx.tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
      .subscribe({
        next: (event: HttpEvent<DocumentoItem>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadQueue.actualizarProgreso(id, Math.round((100 * event.loaded) / event.total));
          } else if (event.type === HttpEventType.Response) {
            this.uploadQueue.marcarListo(id);
          }
        },
        error: (err) => {
          const raw = err?.error?.message;
          const text = Array.isArray(raw) ? raw.join('. ') : (raw ?? err?.message ?? 'Error al cargar');
          this.uploadQueue.marcarError(id, text);
        },
      });
  }
```

- [ ] **Step 4: Agregar `<app-upload-bubble>` al final del template**

En `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html`, agregar al final del archivo (después del último `}` de cierre):

```html
<app-upload-bubble
  [items]="uploadQueue.items()"
  (cerrar)="cerrarUploadBubble()"
  (reintentar)="reintentarSubida($event)">
</app-upload-bubble>
```

- [ ] **Step 5: Verificar que el proyecto compila**

Run: `cd front4 && npx ng build`
Expected: build exitoso sin errores de tipo

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html
git commit -m "feat(front): burbuja de progreso de carga en Documentos (consumidor)"
```

---

### Task 6: Verificación manual end-to-end

**Files:** ninguno (solo verificación en navegador)

- [ ] **Step 1: Levantar el frontend**

Run: `cd front4 && npm start`
Expected: `ng serve` sirviendo en `http://localhost:4200`

- [ ] **Step 2: Verificar el flujo en modo admin**

1. Ir a `http://localhost:4200/documentos`, iniciar sesión como admin, seleccionar una empresa.
2. Abrir el panel de subida (tab "Empresa"), seleccionar un archivo y confirmar la subida.
3. Confirmar que aparece la burbuja abajo a la derecha con el archivo en estado "subiendo" y el % subiendo hasta 100, luego el check "Subido correctamente".
4. Repetir la subida con un segundo archivo antes de que termine el primero (o justo después) y confirmar que aparecen **dos filas independientes**, cada una con su propio progreso — no una sobrescribe a la otra.
5. Cerrar la burbuja con la X y confirmar que desaparece y no reaparece sola.

- [ ] **Step 3: Verificar el flujo en modo consumidor**

1. Cambiar a modo consumidor (o iniciar sesión como usuario), ir a `/documentos`, seleccionar empresa/centro/proyecto según corresponda.
2. Repetir los mismos pasos 2-5 de arriba y confirmar el mismo comportamiento.

- [ ] **Step 4: Verificar el estado de error**

1. Con las DevTools abiertas, simular una falla de red (throttling "Offline" en Network) y subir un archivo.
2. Confirmar que la fila pasa a estado error con mensaje y botón "Reintentar".
3. Restaurar la red, hacer click en "Reintentar" y confirmar que la fila vuelve a "subiendo" y termina en "listo".

- [ ] **Step 5: Ejecutar toda la suite de tests una vez más**

Run: `cd front4 && npm test`
Expected: todos los tests (incluyendo los nuevos de Tasks 1-3) en verde

---

## Self-Review

- **Cobertura del spec:** progreso real por bytes (Task 2) ✓, cola por archivo que no se sobrescribe (Task 1) ✓, componente burbuja con estados subiendo/listo/error (Task 3) ✓, integrado solo en admin/consumidor (Tasks 4-5) ✓, cierre manual sin auto-ocultado (Task 3, sin temporizador) ✓, reintento en error (Tasks 3-5) ✓.
- **Placeholders:** ninguno — todos los steps incluyen código completo.
- **Consistencia de tipos:** `UploadItem`/`UploadEstado` definidos una sola vez en Task 1 y reutilizados sin renombrar en Tasks 3-5; `createUploadQueue()` expone exactamente los mismos nombres de métodos (`agregar`, `actualizarProgreso`, `marcarListo`, `marcarError`, `reiniciar`, `limpiar`) usados por las páginas; `DocumentosService.subir()` mantiene la misma firma de parámetros de entrada (solo cambia el tipo de retorno), por lo que las llamadas existentes en ambas páginas solo necesitan envolver el resultado en `.subscribe()` en lugar de que el service lo haga internamente.
