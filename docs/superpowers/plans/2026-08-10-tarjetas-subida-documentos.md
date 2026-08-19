# Rediseño tarjetas de subida de documentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el botón "Adjuntar" (que la gente olvida tocar) por auto-subida al seleccionar archivo, y reemplazar la lista de documentos por una grilla de tarjetas con renombrar en línea, en **actividades** y **activos** (los dos lugares del componente compartido que no requieren elegir una categoría antes de subir).

**Architecture:** Dos piezas nuevas compartidas — `DocumentoTarjeta` (modelo) y `DocumentCardListComponent` (dumb, grilla de tarjetas) — más un `@Input` nuevo en `UploadDocumentFormComponent` para ocultar su botón de confirmar en modo archivo. Backend: método genérico `DocumentosHelper.renombrar()` reutilizado por `actividades` y `activos`, expuesto vía `PATCH .../documentos/:docId`. Cada página feature combina sus documentos reales (señal del service) con tarjetas locales efímeras ("subiendo", "eliminando") en un getter, sin usar `computed()` (evita el bug de staleness que ya existe en `resumenDocumentosLista`, que no se toca en este plan).

**Tech Stack:** Angular 21 standalone + signals, Vitest + TestBed + HttpTestingController (frontend). NestJS 10 + Mongoose (backend, sin test runner configurado — se verifica con `npm run build` + prueba manual).

## Global Constraints

- Sin `any` en código nuevo (front y back).
- Componentes standalone, Angular control flow (`@if`/`@for`/`@empty`), nunca `*ngIf`/`*ngFor`.
- Estado reactivo con signals; los arrays mutables tipo `docsPendientes` que ya existían como propiedades planas (no signal) se mantienen así por consistencia con el patrón actual del archivo — no se migran a signal en este plan.
- Backend: `.lean()` en lecturas, `NotFoundException` si no existe, sin registrar schemas de otro módulo.
- Alcance de este plan: **solo actividades y activos**. Las páginas de Documentos (admin/consumidor) siguen con el botón "Adjuntar" tal cual — no se tocan (usan selección de categoría antes de subir, que este diseño no contempla).
- Ancho de tarjeta ~150px, nombre máx. 3 líneas con `title` para el nombre completo, cruz de eliminar 100% dentro del padding de la tarjeta (nunca sobre el borde), sin ícono de tipo de archivo, sin confirmación al eliminar.
- Renombrar edita solo el nombre sin extensión; la extensión original se vuelve a concatenar sola al guardar.

---

## File Structure

```
back4/src/common/helpers/documentos.helper.ts          MODIFY — + renombrar()
back4/src/actividades/actividades.service.ts            MODIFY — + renombrarDocumento()
back4/src/actividades/actividades.controller.ts          MODIFY — + PATCH route
back4/src/activos/activos.service.ts                     MODIFY — + renombrarDocumento()
back4/src/activos/activos.controller.ts                  MODIFY — + PATCH route

front4/src/app/shared/models/documento-tarjeta.model.ts              CREATE
front4/src/app/shared/components/document-card-list/
  document-card-list.component.ts                                    CREATE
  document-card-list.component.spec.ts                                CREATE
front4/src/app/shared/components/upload-document-form/
  upload-document-form.component.ts                                   MODIFY — + ocultarBotonConfirmarArchivo
  upload-document-form.component.spec.ts                              CREATE

front4/src/app/features/actividades/actividades.service.ts            MODIFY — + renombrarDocumento, callbacks en eliminarDocumento
front4/src/app/features/actividades/actividades.service.spec.ts       CREATE
front4/src/app/features/actividades/pages/
  actividades-page.component.ts                                       MODIFY
  actividades-page.component.html                                     MODIFY

front4/src/app/features/activos/activos.service.ts                    MODIFY — + renombrarDocumento, callbacks en eliminarDocumento
front4/src/app/features/activos/activos.service.spec.ts               MODIFY — se agregan tests al final del archivo existente
front4/src/app/features/activos/components/activos-form/
  activos-form.component.ts                                           MODIFY
front4/src/app/features/activos/pages/activos-page.component.ts       MODIFY
```

---

### Task 1: Backend — `DocumentosHelper.renombrar()`

**Files:**
- Modify: `back4/src/common/helpers/documentos.helper.ts:155-166` (justo después de `actualizarCategoria`, antes de `listar`)

**Interfaces:**
- Produces: `DocumentosHelper.renombrar(entidadId: string, docId: string, nombreDisplay: string): Promise<Record<string, unknown>>` — usado por Task 2 y Task 3.

- [ ] **Step 1: Agregar el método, mirror exacto de `actualizarCategoria`**

Insertar inmediatamente después del cierre de `actualizarCategoria` (línea 166) y antes de `async listar(...)`:

```ts
  async renombrar(entidadId: string, docId: string, nombreDisplay: string): Promise<Record<string, unknown>> {
    const doc = await this.docModel
      .findOneAndUpdate(
        { _id: this.docOid(docId), [this.fkField]: this.entidadOid(entidadId) },
        { nombre_display: nombreDisplay },
        { new: true },
      )
      .select('-contenido')
      .lean<Record<string, unknown> | null>();
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);
    return doc;
  }
```

- [ ] **Step 2: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add back4/src/common/helpers/documentos.helper.ts
git commit -m "feat(back4): agregar DocumentosHelper.renombrar()"
```

---

### Task 2: Backend — Endpoint de renombrar en Actividades

**Files:**
- Modify: `back4/src/actividades/actividades.service.ts:355-357` (justo después de `eliminarDocumento`)
- Modify: `back4/src/actividades/actividades.controller.ts:82-89` (justo después de `eliminarDocumento`, antes de `descargarDocumento`)

**Interfaces:**
- Consumes: `DocumentosHelper.renombrar(entidadId, docId, nombreDisplay)` (Task 1).
- Produces: ruta `PATCH /empresas/:empresaId/centros/:centroId/actividades/:actividadId/documentos/:docId` con body `{ nombre_display: string }` — usada por Task 7 (frontend).

- [ ] **Step 1: Agregar el método en el service**

En `back4/src/actividades/actividades.service.ts`, inmediatamente después de:

```ts
  eliminarDocumento(actividadId: string, docId: string) {
    return this.docsHelper.eliminar(actividadId, docId);
  }
```

agregar:

```ts

  renombrarDocumento(actividadId: string, docId: string, nombreDisplay: string) {
    return this.docsHelper.renombrar(actividadId, docId, nombreDisplay);
  }
```

- [ ] **Step 2: Agregar la ruta en el controller**

En `back4/src/actividades/actividades.controller.ts`, inmediatamente después de:

```ts
  @Delete(':actividadId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  eliminarDocumento(
    @Param('actividadId') actividadId: string,
    @Param('docId') docId: string,
  ) {
    return this.service.eliminarDocumento(actividadId, docId);
  }
```

agregar (el decorador `Patch` ya está disponible: agregar `Patch` al import de `@nestjs/common` en la línea 2, junto a `Get, Post, Put, Delete`):

```ts

  @Patch(':actividadId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  renombrarDocumento(
    @Param('actividadId') actividadId: string,
    @Param('docId') docId: string,
    @Body('nombre_display') nombreDisplay: string,
  ) {
    if (!nombreDisplay?.trim()) throw new BadRequestException('Debes indicar un nombre');
    return this.service.renombrarDocumento(actividadId, docId, nombreDisplay.trim());
  }
```

La línea de import queda:

```ts
import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, Req, Res, UseGuards,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
```

- [ ] **Step 3: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso.

- [ ] **Step 4: Verificación manual contra el servidor local**

Run: `cd back4 && npm run start:dev` (dejar corriendo), y en otra terminal, con un token válido y un `docId` real de una actividad de prueba:

```bash
curl -X PATCH "http://localhost:3000/api/v1/empresas/<empresaId>/centros/<centroId>/actividades/<actividadId>/documentos/<docId>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"nombre_display":"prueba_renombrada.pdf"}'
```

Expected: `200 OK` con el documento actualizado, `nombre_display` cambiado. Un `docId` inexistente debe responder `404`.

- [ ] **Step 5: Commit**

```bash
git add back4/src/actividades/actividades.service.ts back4/src/actividades/actividades.controller.ts
git commit -m "feat(back4): endpoint PATCH para renombrar documentos de actividad"
```

---

### Task 3: Backend — Endpoint de renombrar en Activos

**Files:**
- Modify: `back4/src/activos/activos.service.ts:111-113` (justo después de `eliminarDocumento`)
- Modify: `back4/src/activos/activos.controller.ts:69-76` (justo después de `eliminarDocumento`)

**Interfaces:**
- Consumes: `DocumentosHelper.renombrar(entidadId, docId, nombreDisplay)` (Task 1).
- Produces: ruta `PATCH /empresas/:empresaId/centros/:centroId/activos/:activoId/documentos/:docId` con body `{ nombre_display: string }` — usada por Task 8 (frontend).

- [ ] **Step 1: Agregar el método en el service**

En `back4/src/activos/activos.service.ts`, después de:

```ts
  eliminarDocumento(activoId: string, docId: string) {
    return this.docsHelper.eliminar(activoId, docId);
  }
```

agregar:

```ts

  renombrarDocumento(activoId: string, docId: string, nombreDisplay: string) {
    return this.docsHelper.renombrar(activoId, docId, nombreDisplay);
  }
```

- [ ] **Step 2: Agregar la ruta en el controller**

En `back4/src/activos/activos.controller.ts`, agregar `Patch` al import (línea 2: `Controller, Get, Post, Put, Patch, Delete,`) y, después de:

```ts
  @Delete(':activoId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  eliminarDocumento(
    @Param('activoId') activoId: string,
    @Param('docId') docId: string,
  ) {
    return this.activosService.eliminarDocumento(activoId, docId);
  }
```

agregar:

```ts

  @Patch(':activoId/documentos/:docId')
  @Roles('super_admin', 'admin_smartclarity')
  renombrarDocumento(
    @Param('activoId') activoId: string,
    @Param('docId') docId: string,
    @Body('nombre_display') nombreDisplay: string,
  ) {
    if (!nombreDisplay?.trim()) throw new BadRequestException('Debes indicar un nombre');
    return this.activosService.renombrarDocumento(activoId, docId, nombreDisplay.trim());
  }
```

- [ ] **Step 3: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso.

- [ ] **Step 4: Verificación manual** (igual que Task 2 Step 4, pero contra `.../activos/<activoId>/documentos/<docId>`)

- [ ] **Step 5: Commit**

```bash
git add back4/src/activos/activos.service.ts back4/src/activos/activos.controller.ts
git commit -m "feat(back4): endpoint PATCH para renombrar documentos de activo"
```

---

### Task 4: Frontend — Modelo `DocumentoTarjeta`

**Files:**
- Create: `front4/src/app/shared/models/documento-tarjeta.model.ts`

**Interfaces:**
- Produces: `DocumentoTarjeta`, `EstadoDocumentoTarjeta` — usados por Task 5, 9, 10.

- [ ] **Step 1: Crear el archivo**

```ts
export type EstadoDocumentoTarjeta = 'listo' | 'subiendo' | 'pendiente' | 'eliminando' | 'error';

export interface DocumentoTarjeta {
  id: string;
  nombre: string;
  tipoContenido: 'archivo' | 'link';
  linkUrl?: string;
  estado: EstadoDocumentoTarjeta;
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores (el archivo no se usa todavía, pero debe ser TS válido).

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/shared/models/documento-tarjeta.model.ts
git commit -m "feat(front4): agregar modelo DocumentoTarjeta"
```

---

### Task 5: Frontend — `DocumentCardListComponent`

**Files:**
- Create: `front4/src/app/shared/components/document-card-list/document-card-list.component.ts`
- Create: `front4/src/app/shared/components/document-card-list/document-card-list.component.spec.ts`

**Interfaces:**
- Consumes: `DocumentoTarjeta`, `EstadoDocumentoTarjeta` (Task 4).
- Produces: selector `app-document-card-list`, `@Input() documentos: DocumentoTarjeta[]`, `@Output() descargar: EventEmitter<string>`, `@Output() abrirLink: EventEmitter<string>`, `@Output() eliminar: EventEmitter<string>`, `@Output() renombrar: EventEmitter<{ id: string; nuevoNombre: string }>` — usados por Task 9 y 10.

- [ ] **Step 1: Escribir el test (falla porque el componente no existe)**

`front4/src/app/shared/components/document-card-list/document-card-list.component.spec.ts`:

```ts
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
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd front4 && npx vitest run src/app/shared/components/document-card-list/document-card-list.component.spec.ts`
Expected: FAIL — `Cannot find module './document-card-list.component'`.

- [ ] **Step 3: Implementar el componente**

`front4/src/app/shared/components/document-card-list/document-card-list.component.ts`:

```ts
import {
  AfterViewChecked, Component, ElementRef, EventEmitter,
  Input, Output, ViewChild, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentoTarjeta } from '../../models/documento-tarjeta.model';

function extensionDe(nombre: string): string {
  const idx = nombre.lastIndexOf('.');
  return idx > 0 ? nombre.slice(idx) : '';
}

function sinExtension(nombre: string): string {
  const idx = nombre.lastIndexOf('.');
  return idx > 0 ? nombre.slice(0, idx) : nombre;
}

@Component({
  selector: 'app-document-card-list',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .dcl-grid { display: flex; flex-wrap: wrap; gap: .7rem; }
    .dcl-card {
      position: relative; width: 150px; background: #fff; border: 1px solid #d7e6ee;
      border-radius: 10px; padding: 1.5rem .55rem .55rem; box-shadow: 0 1px 3px rgba(0,0,0,.05);
      display: flex; flex-direction: column; align-items: center; text-align: center;
    }
    .dcl-card--dim { opacity: .55; }
    .dcl-card--error { border-color: #f1c3bb; background: #fef8f7; }
    .dcl-nombre {
      margin: 0; font-size: .74rem; color: #1a2733; line-height: 1.3;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow: hidden; min-height: 2.9em; word-break: break-word;
    }
    .dcl-card--error .dcl-nombre { color: #c0392b; }
    .dcl-tag {
      display: block; margin-top: .2rem; font-size: .6rem; text-transform: uppercase;
      letter-spacing: .04em; color: #0075a8;
    }
    .dcl-acciones {
      display: flex; gap: .4rem; margin-top: .5rem; padding-top: .45rem;
      border-top: 1px solid #eef2f5; width: 100%; justify-content: center;
    }
    .dcl-icon-btn {
      width: 24px; height: 24px; border-radius: 5px; border: 1px solid #e2e8f0;
      background: #fbfcfd; display: flex; align-items: center; justify-content: center;
      font-size: .72rem; color: #5b7484; cursor: pointer; padding: 0;
    }
    .dcl-icon-btn--warn { color: #0075a8; }
    .dcl-x {
      position: absolute; top: .4rem; right: .4rem; width: 18px; height: 18px;
      border-radius: 50%; border: none; background: transparent; cursor: pointer; padding: 0;
    }
    .dcl-x::before, .dcl-x::after {
      content: ''; position: absolute; top: 50%; left: 50%; width: 9px; height: 1.6px;
      background: #a94442; border-radius: 1px;
    }
    .dcl-x::before { transform: translate(-50%, -50%) rotate(45deg); }
    .dcl-x::after  { transform: translate(-50%, -50%) rotate(-45deg); }
    .dcl-x:hover { background: #fdecea; }
    .dcl-rename-input {
      margin-top: .2rem; width: 96%; font-size: .72rem; border: 1px solid #0095d6;
      border-radius: 5px; padding: .2rem .3rem; outline: none; box-sizing: border-box; text-align: center;
    }
    .dcl-rename-hint { margin: .15rem 0 0; font-size: .6rem; color: #8697a3; }
    .dcl-spinner {
      display: inline-block; width: 11px; height: 11px; border: 2px solid #eadde0;
      border-top-color: #0095d6; border-radius: 50%; margin-right: .3rem; vertical-align: -1.5px;
      animation: dcl-spin .65s linear infinite;
    }
    @keyframes dcl-spin { to { transform: rotate(360deg); } }
    .dcl-empty { font-size: .8rem; color: #9ca3af; padding: .3rem 0; }
  `],
  template: `
    <div class="dcl-grid">
      @for (doc of documentos; track doc.id) {
        <div class="dcl-card" [class.dcl-card--dim]="doc.estado === 'eliminando'" [class.dcl-card--error]="doc.estado === 'error'">
          @if (doc.estado === 'listo' || doc.estado === 'pendiente' || doc.estado === 'error') {
            <button type="button" class="dcl-x" (click)="eliminar.emit(doc.id)" [attr.aria-label]="'Eliminar ' + doc.nombre"></button>
          }
          @if (renombrandoId() === doc.id) {
            <input #renameInput class="dcl-rename-input" [ngModel]="nombreEditado()" (ngModelChange)="nombreEditado.set($event)"
                   (keydown.enter)="confirmarRenombre(doc)" (keydown.escape)="cancelarRenombre()" />
            <p class="dcl-rename-hint">Enter guarda · Esc cancela</p>
          } @else if (doc.estado === 'subiendo') {
            <p class="dcl-nombre"><span class="dcl-spinner"></span>Subiendo...</p>
          } @else if (doc.estado === 'eliminando') {
            <p class="dcl-nombre"><span class="dcl-spinner"></span>Eliminando...</p>
          } @else if (doc.estado === 'error') {
            <p class="dcl-nombre">Error al subir</p>
          } @else {
            <p class="dcl-nombre" [title]="doc.nombre">
              {{ doc.nombre }}
              @if (doc.estado === 'pendiente') { <span class="dcl-tag">pendiente</span> }
            </p>
          }
          @if (doc.estado === 'listo') {
            <div class="dcl-acciones">
              @if (doc.tipoContenido === 'link') {
                <button type="button" class="dcl-icon-btn" (click)="abrirLink.emit(doc.linkUrl!)" aria-label="Ir al link">↗</button>
              } @else {
                <button type="button" class="dcl-icon-btn" (click)="descargar.emit(doc.id)" aria-label="Descargar">⬇</button>
              }
              <button type="button" class="dcl-icon-btn dcl-icon-btn--warn" (click)="iniciarRenombre(doc)" aria-label="Renombrar">✎</button>
            </div>
          }
        </div>
      } @empty {
        <p class="dcl-empty">Sin documentos.</p>
      }
    </div>
  `,
})
export class DocumentCardListComponent implements AfterViewChecked {
  @Input() documentos: DocumentoTarjeta[] = [];

  @Output() descargar = new EventEmitter<string>();
  @Output() abrirLink = new EventEmitter<string>();
  @Output() eliminar  = new EventEmitter<string>();
  @Output() renombrar = new EventEmitter<{ id: string; nuevoNombre: string }>();

  @ViewChild('renameInput') private renameInputRef?: ElementRef<HTMLInputElement>;
  private renameInputFocused = false;

  protected renombrandoId = signal<string | null>(null);
  protected nombreEditado = signal('');

  ngAfterViewChecked(): void {
    if (this.renombrandoId() && this.renameInputRef && !this.renameInputFocused) {
      const el = this.renameInputRef.nativeElement;
      el.focus();
      el.select();
      this.renameInputFocused = true;
    }
    if (!this.renombrandoId()) this.renameInputFocused = false;
  }

  iniciarRenombre(doc: DocumentoTarjeta): void {
    this.renombrandoId.set(doc.id);
    this.nombreEditado.set(sinExtension(doc.nombre));
  }

  confirmarRenombre(doc: DocumentoTarjeta): void {
    const nuevo = this.nombreEditado().trim();
    this.renombrandoId.set(null);
    if (!nuevo) return;
    const nuevoNombre = nuevo + extensionDe(doc.nombre);
    if (nuevoNombre === doc.nombre) return;
    this.renombrar.emit({ id: doc.id, nuevoNombre });
  }

  cancelarRenombre(): void {
    this.renombrandoId.set(null);
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd front4 && npx vitest run src/app/shared/components/document-card-list/document-card-list.component.spec.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/shared/components/document-card-list/
git commit -m "feat(front4): agregar DocumentCardListComponent"
```

---

### Task 6: Frontend — `UploadDocumentFormComponent`: ocultar botón confirmar en modo archivo

**Files:**
- Modify: `front4/src/app/shared/components/upload-document-form/upload-document-form.component.ts:178-191, 227-231`
- Create: `front4/src/app/shared/components/upload-document-form/upload-document-form.component.spec.ts`

**Interfaces:**
- Produces: `@Input() ocultarBotonConfirmarArchivo: boolean` (default `false`) — usado por Task 9 y 10.

- [ ] **Step 1: Escribir el test (falla porque el input no existe)**

`front4/src/app/shared/components/upload-document-form/upload-document-form.component.spec.ts`:

```ts
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd front4 && npx vitest run src/app/shared/components/upload-document-form/upload-document-form.component.spec.ts`
Expected: FAIL — el botón sigue presente en los 3 casos (siempre visible hoy), el primer test falla porque `.udf-confirm` no es `null`.

- [ ] **Step 3: Agregar el input y condicionar el bloque de botones**

En `upload-document-form.component.ts`, agregar junto a los demás `@Input`:

```ts
  @Input() ocultarBotonConfirmarArchivo = false;
```

(agregarlo después de `@Input() confirmLoading = false;`, línea 231).

Envolver el bloque `.udf-buttons` (líneas 178-191) en un `@if`:

```html
      @if (modo === 'link' || !ocultarBotonConfirmarArchivo) {
        <div class="udf-buttons">
          <button type="button" class="btn-primary udf-confirm" (click)="confirmar.emit()"
                  [disabled]="confirmDisabled || confirmLoading">
            @if (confirmLoading) {
              <span class="udf-spinner"></span> Subiendo...
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {{ confirmLabel }}
            }
          </button>
          @if (showCancel) {
            <button type="button" class="btn-ghost udf-cancel" [disabled]="confirmLoading" (click)="cancelar.emit()">{{ cancelLabel }}</button>
          }
        </div>
      }
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd front4 && npx vitest run src/app/shared/components/upload-document-form/upload-document-form.component.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Correr el resto de la suite para descartar regresiones**

Run: `cd front4 && npx vitest run`
Expected: todos los tests existentes siguen en verde (el input nuevo tiene default `false`, así que ningún consumidor actual cambia de comportamiento todavía).

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/shared/components/upload-document-form/
git commit -m "feat(front4): ocultarBotonConfirmarArchivo en UploadDocumentFormComponent"
```

---

### Task 7: Frontend — `ActividadesService`: renombrarDocumento + callbacks en eliminarDocumento

**Files:**
- Modify: `front4/src/app/features/actividades/actividades.service.ts:168-181`
- Create: `front4/src/app/features/actividades/actividades.service.spec.ts`

**Interfaces:**
- Consumes: ruta backend `PATCH .../actividades/:id/documentos/:docId` (Task 2).
- Produces: `renombrarDocumento(actividadId: string, docId: string, nuevoNombre: string): void`; `eliminarDocumento(actividadId: string, docId: string, onSuccess?: () => void, onError?: () => void): void` — usados por Task 9.

- [ ] **Step 1: Escribir los tests (fallan: `renombrarDocumento` no existe, `eliminarDocumento` no acepta callbacks)**

`front4/src/app/features/actividades/actividades.service.spec.ts`:

```ts
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
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd front4 && npx vitest run src/app/features/actividades/actividades.service.spec.ts`
Expected: FAIL — `renombrarDocumento` no es una función; el segundo/tercer test fallan por exceso de argumentos en `eliminarDocumento`.

- [ ] **Step 3: Implementar**

Reemplazar en `actividades.service.ts`:

```ts
  eliminarDocumento(actividadId: string, docId: string): void {
    const centroId = this.actividades().find(a => a._id === actividadId)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.delete(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${docId}`)
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Documento eliminado' });
        this.listarDocumentos(actividadId);
      },
      error: err => this.setError(err),
    });
  }
```

por:

```ts
  eliminarDocumento(actividadId: string, docId: string, onSuccess?: () => void, onError?: () => void): void {
    const centroId = this.actividades().find(a => a._id === actividadId)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.delete(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${docId}`)
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Documento eliminado' });
        this.listarDocumentos(actividadId);
        onSuccess?.();
      },
      error: err => { this.setError(err); onError?.(); },
    });
  }

  renombrarDocumento(actividadId: string, docId: string, nuevoNombre: string): void {
    const centroId = this.actividades().find(a => a._id === actividadId)?.centro_costo_id;
    const empresaId = centroId ? this.getEmpresaId(centroId) : undefined;
    if (!empresaId || !centroId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.patch(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${docId}`),
      { nombre_display: nuevoNombre }
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Documento renombrado' });
        this.listarDocumentos(actividadId);
      },
      error: err => this.setError(err),
    });
  }
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `cd front4 && npx vitest run src/app/features/actividades/actividades.service.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/actividades/actividades.service.ts front4/src/app/features/actividades/actividades.service.spec.ts
git commit -m "feat(front4): ActividadesService.renombrarDocumento + callbacks en eliminarDocumento"
```

---

### Task 8: Frontend — `ActivosService`: renombrarDocumento + callbacks en eliminarDocumento

**Files:**
- Modify: `front4/src/app/features/activos/activos.service.ts:177-189`
- Modify: `front4/src/app/features/activos/activos.service.spec.ts` (agregar al final del archivo existente)

**Interfaces:**
- Consumes: ruta backend `PATCH .../activos/:id/documentos/:docId` (Task 3).
- Produces: `renombrarDocumento(activoId: string, centroId: string, docId: string, nuevoNombre: string): void`; `eliminarDocumento(activoId: string, centroId: string, docId: string, onSuccess?: () => void, onError?: () => void): void` — usados por Task 10.

- [ ] **Step 1: Leer el final del archivo de test existente para saber dónde insertar**

Run: `tail -n 20 front4/src/app/features/activos/activos.service.spec.ts`
(el archivo ya tiene un `describe('ActivosService.cargarImagenActivo', ...)` con su propio `setupCentro`; se agrega un `describe` nuevo al final, fuera del anterior, con su propio `beforeEach`.)

- [ ] **Step 2: Agregar los tests (fallan: `renombrarDocumento` no existe, `eliminarDocumento` no acepta callbacks)**

Agregar al final de `front4/src/app/features/activos/activos.service.spec.ts`:

```ts

describe('ActivosService — documentos', () => {
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

  it('renombrarDocumento hace PATCH con el nuevo nombre y refresca la lista', () => {
    service.renombrarDocumento('activo1', 'centro1', 'doc1', 'nuevo_nombre.pdf');
    const req = httpMock.expectOne(
      r => r.url.includes('/activos/activo1/documentos/doc1') && r.method === 'PATCH',
    );
    expect(req.request.body).toEqual({ nombre_display: 'nuevo_nombre.pdf' });
    req.flush({});
    httpMock.expectOne(r => r.url.includes('/activos/activo1/documentos') && r.method === 'GET').flush([]);
  });

  it('eliminarDocumento llama onSuccess cuando el servidor confirma', () => {
    let called = false;
    service.eliminarDocumento('activo1', 'centro1', 'doc1', () => { called = true; });
    httpMock.expectOne(r => r.url.includes('/activos/activo1/documentos/doc1') && r.method === 'DELETE').flush({});
    httpMock.expectOne(r => r.url.includes('/activos/activo1/documentos') && r.method === 'GET').flush([]);
    expect(called).toBe(true);
  });

  it('eliminarDocumento llama onError si el servidor falla', () => {
    let called = false;
    service.eliminarDocumento('activo1', 'centro1', 'doc1', undefined, () => { called = true; });
    httpMock.expectOne(r => r.url.includes('/activos/activo1/documentos/doc1') && r.method === 'DELETE')
      .flush({ message: 'error' }, { status: 500, statusText: 'Server Error' });
    expect(called).toBe(true);
  });
});
```

(`setupCentro` ya está definido arriba en el archivo y es reutilizable tal cual.)

- [ ] **Step 3: Correr los tests y verificar que fallan**

Run: `cd front4 && npx vitest run src/app/features/activos/activos.service.spec.ts`
Expected: FAIL en los 3 tests nuevos (los preexistentes de `cargarImagenActivo` siguen en verde).

- [ ] **Step 4: Implementar**

Reemplazar en `activos.service.ts`:

```ts
  eliminarDocumento(activoId: string, centroId: string, docId: string): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.delete(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${docId}`)
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Documento eliminado' });
        this.listarDocumentos(activoId, centroId);
      },
      error: (err) => this.setError(err),
    });
  }
```

por:

```ts
  eliminarDocumento(activoId: string, centroId: string, docId: string, onSuccess?: () => void, onError?: () => void): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.delete(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${docId}`)
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Documento eliminado' });
        this.listarDocumentos(activoId, centroId);
        onSuccess?.();
      },
      error: (err) => { this.setError(err); onError?.(); },
    });
  }

  renombrarDocumento(activoId: string, centroId: string, docId: string, nuevoNombre: string): void {
    const { empresaId } = this.resolverIds(centroId);
    if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
    this.http.patch(
      this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${docId}`),
      { nombre_display: nuevoNombre }
    ).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Documento renombrado' });
        this.listarDocumentos(activoId, centroId);
      },
      error: (err) => this.setError(err),
    });
  }
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `cd front4 && npx vitest run src/app/features/activos/activos.service.spec.ts`
Expected: PASS, todos los tests del archivo (los preexistentes + los 3 nuevos).

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/features/activos/activos.service.ts front4/src/app/features/activos/activos.service.spec.ts
git commit -m "feat(front4): ActivosService.renombrarDocumento + callbacks en eliminarDocumento"
```

---

### Task 9: Frontend — Integración en Actividades (auto-subida + tarjetas)

**Files:**
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.ts:1-19` (imports), `:436-561` (bloque de documentos)
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html:846-940` (paso 3)

**Interfaces:**
- Consumes: `DocumentCardListComponent` (Task 5), `ocultarBotonConfirmarArchivo` (Task 6), `ActividadesService.renombrarDocumento`/`eliminarDocumento` (Task 7), `DocumentoTarjeta` (Task 4).
- Produces: nada consumido por otras tasks — es el último eslabón para actividades.

No hay test runner para esta página (no existe `actividades-page.component.spec.ts`, y crear uno de cero para el componente completo del wizard excede el alcance de este cambio). La verificación es manual en el navegador (Step 4).

- [ ] **Step 1: Agregar los imports**

En `actividades-page.component.ts`, agregar:

```ts
import { DocumentCardListComponent } from '../../../shared/components/document-card-list/document-card-list.component';
import { DocumentoTarjeta } from '../../../shared/models/documento-tarjeta.model';
```

y en el array `imports` del `@Component`, agregar `DocumentCardListComponent`:

```ts
  imports: [FormsModule, StatusBannerComponent, ActividadIconoComponent, UploadDocumentFormComponent, DocumentCardListComponent],
```

- [ ] **Step 2: Reemplazar el bloque de estado y métodos de documentos (líneas 436-561)**

Reemplazar todo el bloque desde `protected docsPendientes: { file?: File; linkUrl?: string; nombre: string }[] = [];` (línea 436) hasta el cierre de `subirDocsPendientesSecuencial` (línea 561) por:

```ts
  protected docsPendientes: { localId: string; file?: File; linkUrl?: string; nombre: string }[] = [];
  protected docLinkInput = '';
  protected docModo = signal<'archivo' | 'link'>('archivo');
  protected subiendoDocs = false;
  protected subiendoCards    = signal<{ id: string; nombre: string }[]>([]);
  protected eliminandoDocIds = signal<Set<string>>(new Set());

  protected pendienteLinkInput = '';
  protected pendienteModo = signal<'archivo' | 'link'>('archivo');

  private nuevoIdLocal(prefijo: string): string {
    return `${prefijo}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  setPendienteModo(modo: 'archivo' | 'link'): void {
    if (this.pendienteModo() === modo) return;
    this.pendienteModo.set(modo);
    this.pendienteLinkInput = '';
  }

  setDocModo(modo: 'archivo' | 'link'): void {
    if (this.docModo() === modo) return;
    this.docModo.set(modo);
    this.docLinkInput = '';
  }

  pendienteLinkInvalido(): boolean {
    const link = this.pendienteLinkInput.trim();
    if (!link) return false;
    return !/^https?:\/\/.+/i.test(link);
  }

  docLinkInvalido(): boolean {
    const link = this.docLinkInput.trim();
    if (!link) return false;
    return !/^https?:\/\/.+/i.test(link);
  }

  onPendienteArchivoChange(file: File | null): void {
    if (!file) return;
    this.docsPendientes.push({ localId: this.nuevoIdLocal('pend'), file, nombre: file.name });
  }

  agregarDocPendienteLink(): void {
    const link = this.pendienteLinkInput.trim();
    if (!link || this.pendienteLinkInvalido()) return;
    this.docsPendientes.push({ localId: this.nuevoIdLocal('pend'), linkUrl: link, nombre: link });
    this.pendienteLinkInput = '';
  }

  quitarDocPendiente(localId: string): void {
    this.docsPendientes = this.docsPendientes.filter(d => d.localId !== localId);
  }

  protected get docsPendientesTarjetas(): DocumentoTarjeta[] {
    return this.docsPendientes.map(d => ({
      id: d.localId,
      nombre: d.nombre,
      tipoContenido: d.linkUrl ? 'link' : 'archivo',
      linkUrl: d.linkUrl,
      estado: 'pendiente' as const,
    }));
  }

  onDocArchivoChange(file: File | null): void {
    if (!file) return;
    const id = this.editingId();
    if (!id) return;
    const tempId = this.nuevoIdLocal('subiendo');
    this.subiendoCards.update(list => [...list, { id: tempId, nombre: file.name }]);
    const limpiar = () => this.subiendoCards.update(list => list.filter(c => c.id !== tempId));
    this.service.subirDocumento(id, file, undefined, limpiar, limpiar);
  }

  agregarDocLink(): void {
    const id = this.editingId();
    if (!id) return;
    const link = this.docLinkInput.trim();
    if (!link || this.docLinkInvalido()) return;
    this.service.subirDocumentoLink(id, link);
    this.docLinkInput = '';
  }

  protected get documentosTarjetas(): DocumentoTarjeta[] {
    const subidos: DocumentoTarjeta[] = this.service.documentosActividad().map(doc => ({
      id: doc._id,
      nombre: doc.nombre_display,
      tipoContenido: doc.tipo_contenido ?? 'archivo',
      linkUrl: doc.link_url,
      estado: this.eliminandoDocIds().has(doc._id) ? 'eliminando' as const : 'listo' as const,
    }));
    const subiendo: DocumentoTarjeta[] = this.subiendoCards().map(c => ({
      id: c.id,
      nombre: c.nombre,
      tipoContenido: 'archivo' as const,
      estado: 'subiendo' as const,
    }));
    return [...subidos, ...subiendo];
  }

  eliminarDocActividad(docId: string): void {
    const id = this.editingId();
    if (!id) return;
    this.eliminandoDocIds.update(set => new Set(set).add(docId));
    const limpiar = () => this.eliminandoDocIds.update(set => {
      const copia = new Set(set);
      copia.delete(docId);
      return copia;
    });
    this.service.eliminarDocumento(id, docId, limpiar, limpiar);
  }

  renombrarDocActividad(ev: { id: string; nuevoNombre: string }): void {
    const id = this.editingId();
    if (!id) return;
    this.service.renombrarDocumento(id, ev.id, ev.nuevoNombre);
  }

  descargarDocActividad(docId: string, nombreDisplay?: string): void {
    const id = this.editingId();
    if (!id) return;
    this.service.descargarDocumento(id, docId, nombreDisplay);
  }

  abrirDocActividad(linkUrl: string): void {
    window.open(linkUrl, '_blank');
  }

  descargarDocResumen(actividadId: string, docId: string, nombreDisplay?: string): void {
    this.service.descargarDocumento(actividadId, docId, nombreDisplay);
  }

  get actividadEditando() {
    const id = this.editingId();
    return id ? this.service.actividades().find(a => a._id === id) ?? null : null;
  }

  private subirDocsPendientesSecuencial(actividadId: string, index: number): void {
    if (index >= this.docsPendientes.length) {
      this.docsPendientes = [];
      this.subiendoDocs = false;
      this.cerrarModal();
      return;
    }
    const { file, linkUrl, nombre } = this.docsPendientes[index];
    const onSuccess = () => { this.subirDocsPendientesSecuencial(actividadId, index + 1); };
    const onError = () => { this.subiendoDocs = false; };
    if (linkUrl) {
      this.service.subirDocumentoLink(actividadId, linkUrl, nombre, onSuccess, onError);
    } else if (file) {
      this.service.subirDocumento(actividadId, file, nombre, onSuccess, onError);
    }
  }
```

Nota: `descargarDocActividad`, `abrirDocActividad`, `descargarDocResumen` y `get actividadEditando` no cambian de código — se transcriben tal cual para que el bloque reemplazado quede completo y compilable (estaban entre medio del bloque original).

`docId: string` en `descargarDocActividad(docId: string, ...)` sigue siendo compatible con `(descargar)="descargarDocActividad($event)"` del nuevo template, que ahora solo pasa el `docId` (el `nombreDisplay` ya no se pasa desde la tarjeta — queda `undefined`, y `descargarDocumento` ya maneja ese caso usando `docId` como nombre de fallback, ver `actividades.service.ts:195`).

- [ ] **Step 3: Reemplazar el bloque HTML del paso 3 (líneas 846-940)**

Reemplazar todo el bloque `@if (paso() === 3) { ... }` por:

```html
      <!-- ── PASO 3: Documentos ──────────────────────────────────── -->
      @if (paso() === 3) {
        <div class="wz-secciones">
          <div class="wz-seccion">
          <p class="wz-seccion-titulo">
            Documentos adjuntos
            @if (!editingId() && docsPendientesTarjetas.length > 0) {
              <span class="wz-badge">{{ docsPendientesTarjetas.length }}</span>
            }
            @if (editingId() && documentosTarjetas.length > 0) {
              <span class="wz-badge">{{ documentosTarjetas.length }}</span>
            }
          </p>
          @if (!editingId()) {
            <app-document-card-list
              [documentos]="docsPendientesTarjetas"
              (eliminar)="quitarDocPendiente($event)" />
          } @else {
            <app-document-card-list
              [documentos]="documentosTarjetas"
              (descargar)="descargarDocActividad($event)"
              (abrirLink)="abrirDocActividad($event)"
              (eliminar)="eliminarDocActividad($event)"
              (renombrar)="renombrarDocActividad($event)" />
          }
          </div>

          <div class="wz-seccion">
            <p class="wz-seccion-titulo">Agregar documento</p>
            @if (!editingId()) {
              <app-upload-document-form
                style="display:block"
                [mostrarTipoDocumento]="false"
                [mostrarNombre]="false"
                [ocultarBotonConfirmarArchivo]="true"
                [modo]="pendienteModo()" (modoChange)="setPendienteModo($event)"
                [archivo]="null" (archivoChange)="onPendienteArchivoChange($event)"
                [(link)]="pendienteLinkInput"
                [linkInvalido]="pendienteLinkInvalido()"
                confirmLabel="+ Agregar a la lista"
                [showCancel]="false"
                [confirmDisabled]="!pendienteLinkInput.trim() || pendienteLinkInvalido()"
                (confirmar)="agregarDocPendienteLink()" />
            } @else {
              <app-upload-document-form
                style="display:block"
                [mostrarTipoDocumento]="false"
                [mostrarNombre]="false"
                [ocultarBotonConfirmarArchivo]="true"
                [modo]="docModo()" (modoChange)="setDocModo($event)"
                [archivo]="null" (archivoChange)="onDocArchivoChange($event)"
                [(link)]="docLinkInput"
                [linkInvalido]="docLinkInvalido()"
                confirmLabel="Adjuntar"
                [showCancel]="false"
                [confirmDisabled]="!docLinkInput.trim() || docLinkInvalido()"
                (confirmar)="agregarDocLink()" />
            }
          </div>
        </div>
```

(mantener el `}` de cierre que ya existe después, línea 940 original — no listado acá porque no cambia.)

- [ ] **Step 4: Verificación manual en el navegador**

Run: `cd back4 && npm run start:dev` (si no sigue corriendo de Task 2) y `cd front4 && npm start`, abrir `http://localhost:4200`, entrar como admin a **Actividades**.

Probar:
1. Crear actividad nueva → paso 3 → seleccionar un archivo: debe aparecer una tarjeta con tag "pendiente" **sin** click en ningún botón "Adjuntar".
2. Completar la creación → el documento pendiente debe subirse solo y aparecer en la actividad ya creada.
3. Editar una actividad existente → paso 3 → seleccionar un archivo: debe aparecer brevemente "Subiendo..." y luego la tarjeta final con Descargar/Renombrar.
4. Click en el lápiz de una tarjeta → aparece el input sin extensión, enter guarda, la tarjeta muestra el nombre nuevo.
5. Click en la cruz de una tarjeta → muestra "Eliminando..." brevemente y desaparece.
6. Modo "Adjuntar link" → sigue mostrando el botón "Adjuntar" (no desaparece), y al confirmar el link aparece como tarjeta.

Expected: los 6 puntos se comportan como se describe, sin errores en la consola del navegador.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/actividades/pages/actividades-page.component.ts front4/src/app/features/actividades/pages/actividades-page.component.html
git commit -m "feat(front4): auto-subida y tarjetas de documentos en el wizard de actividades"
```

---

### Task 10: Frontend — Integración en Activos (auto-subida + tarjetas)

**Files:**
- Modify: `front4/src/app/features/activos/components/activos-form/activos-form.component.ts` (imports, CSS líneas 34-61, template líneas 103-236, clase líneas 251-421)
- Modify: `front4/src/app/features/activos/pages/activos-page.component.ts` (handlers de documentos, líneas 404-434)

**Interfaces:**
- Consumes: `DocumentCardListComponent` (Task 5), `ocultarBotonConfirmarArchivo` (Task 6), `ActivosService.renombrarDocumento`/`eliminarDocumento` (Task 8), `DocumentoTarjeta` (Task 4).

Igual que Task 9, no hay spec de componente existente para `ActivosFormComponent`/`ActivosPageComponent`; verificación manual en Step 4.

- [ ] **Step 1: `activos-form.component.ts` — imports y CSS**

Agregar imports:

```ts
import { DocumentCardListComponent } from '../../../../shared/components/document-card-list/document-card-list.component';
import { DocumentoTarjeta } from '../../../../shared/models/documento-tarjeta.model';
```

En el array `imports` del `@Component`:

```ts
  imports: [FormsModule, UploadDocumentFormComponent, ActivoIconoComponent, DocumentCardListComponent],
```

Eliminar del bloque `styles` (líneas 34-61) las reglas `.doc-lista`, `.doc-item`, `.doc-item:last-child`, `.doc-nombre`, `.doc-acciones`, `.doc-empty` (quedan sin uso, las reemplaza el CSS interno de `DocumentCardListComponent`).

- [ ] **Step 2: `activos-form.component.ts` — reemplazar el bloque `col-docs` del template (líneas 180-236)**

Reemplazar:

```html
        <!-- ── Columna derecha: documentos ── -->
        <div class="col-docs">
          <h4>Documentos adjuntos</h4>

          @if (!editingId) {
            <!-- Modo creación: lista pendientes -->
            @if (docsPendientes.length > 0) {
              <div class="doc-lista">
                @for (doc of docsPendientes; track $index) {
                  <div class="doc-item">
                    <span class="doc-nombre" [title]="doc.nombre">{{ doc.nombre }}</span>
                    <div class="doc-acciones">
                      <button type="button" class="btn-danger btn-sm" (click)="onQuitarDoc($index)">Quitar</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="doc-empty">Sin documentos pendientes.</p>
            }
          } @else {
            <!-- Modo edición: lista existentes -->
            @if (docsExistentes.length > 0) {
              <div class="doc-lista">
                @for (doc of docsExistentes; track doc._id) {
                  <div class="doc-item">
                    <span class="doc-nombre" [title]="doc.nombre_display">{{ doc.nombre_display }}</span>
                    <div class="doc-acciones">
                      @if (doc.tipo_contenido === 'link') {
                        <button type="button" class="btn-ghost btn-sm" (click)="onAbrirDoc(doc.link_url!)">↗</button>
                      } @else {
                        <button type="button" class="btn-ghost btn-sm" (click)="onDescargarDoc(doc._id, doc.nombre_display)">↓</button>
                      }
                      <button type="button" class="btn-danger btn-sm" (click)="onEliminarDoc(doc._id)">✕</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="doc-empty">Sin documentos adjuntos.</p>
            }
          }

          <!-- Upload -->
          <app-upload-document-form
            style="display:block"
            [mostrarTipoDocumento]="false"
            [modo]="modo()" (modoChange)="setModo($event)"
            [archivo]="fileSelected" (archivoChange)="onArchivoChange($event)"
            [(link)]="linkInput"
            [(nombre)]="nombreInput"
            [linkInvalido]="linkInvalido()"
            [confirmLabel]="editingId ? 'Adjuntar' : '+ Agregar a la lista'"
            [showCancel]="false"
            [confirmDisabled]="modo()==='archivo' ? !fileSelected : (!linkInput.trim() || linkInvalido())"
            (confirmar)="editingId ? subirExistente() : agregarPendiente()" />
        </div>
```

por:

```html
        <!-- ── Columna derecha: documentos ── -->
        <div class="col-docs">
          <h4>Documentos adjuntos</h4>

          @if (!editingId) {
            <app-document-card-list
              [documentos]="docsPendientesTarjetas"
              (eliminar)="docQuitado.emit($event)" />
          } @else {
            <app-document-card-list
              [documentos]="docsExistentesTarjetas"
              (descargar)="onDescargarDocId($event)"
              (abrirLink)="onAbrirDoc($event)"
              (eliminar)="onEliminarDoc($event)"
              (renombrar)="docRenombrado.emit($event)" />
          }

          <!-- Upload -->
          <app-upload-document-form
            style="display:block"
            [mostrarTipoDocumento]="false"
            [mostrarNombre]="false"
            [ocultarBotonConfirmarArchivo]="true"
            [modo]="modo()" (modoChange)="setModo($event)"
            [archivo]="null" (archivoChange)="onArchivoChange($event)"
            [(link)]="linkInput"
            [linkInvalido]="linkInvalido()"
            [confirmLabel]="editingId ? 'Adjuntar' : '+ Agregar a la lista'"
            [showCancel]="false"
            [confirmDisabled]="!linkInput.trim() || linkInvalido()"
            (confirmar)="editingId ? subirLinkExistente() : agregarLinkPendiente()" />
        </div>
```

- [ ] **Step 3: `activos-form.component.ts` — actualizar la clase**

Cambiar la interfaz exportada:

```ts
export interface DocPendiente { file?: File; linkUrl?: string; nombre: string; }
```

por:

```ts
export interface DocPendiente { localId?: string; file?: File; linkUrl?: string; nombre: string; }
```

Agregar `@Input` nuevos (junto a `@Input() docsExistentes: DocActivo[] = [];`):

```ts
  @Input() subiendoCards: { id: string; nombre: string }[] = [];
  @Input() eliminandoDocIds: Set<string> = new Set();
```

Cambiar la firma de dos `@Output`:

```ts
  @Output() docQuitado      = new EventEmitter<number>();
```
por
```ts
  @Output() docQuitado      = new EventEmitter<string>();
```

y agregar uno nuevo junto a los demás `@Output`:

```ts
  @Output() docRenombrado   = new EventEmitter<{ id: string; nuevoNombre: string }>();
```

Eliminar las propiedades `fileSelected: File | null = null;` y `nombreInput = '';` (ya no se usan: el `archivo` del formulario ahora se pasa como literal `null` y el nombre se maneja después vía renombrar).

Reemplazar:

```ts
  onArchivoChange(file: File | null): void {
    this.fileSelected = file;
    if (file && !this.nombreInput) {
      this.nombreInput = file.name.replace(/\.[^/.]+$/, '');
    }
  }

  agregarPendiente(): void {
    if (this.modo() === 'link') {
      const link = this.linkInput.trim();
      if (!link || this.linkInvalido()) return;
      this.docAgregado.emit({ linkUrl: link, nombre: this.nombreInput || link });
    } else {
      if (!this.fileSelected) return;
      this.docAgregado.emit({ file: this.fileSelected, nombre: this.nombreInput || this.fileSelected.name });
    }
    this.fileSelected = null;
    this.nombreInput = '';
    this.linkInput = '';
  }

  subirExistente(): void {
    if (this.modo() === 'link') {
      const link = this.linkInput.trim();
      if (!link || this.linkInvalido()) return;
      this.docSubido.emit({ linkUrl: link, nombre: this.nombreInput || link });
    } else {
      if (!this.fileSelected) return;
      this.docSubido.emit({ file: this.fileSelected, nombre: this.nombreInput || this.fileSelected.name });
    }
    this.fileSelected = null;
    this.nombreInput = '';
    this.linkInput = '';
  }

  onQuitarDoc(index: number): void    { this.docQuitado.emit(index); }
  onEliminarDoc(docId: string): void  { this.docEliminado.emit(docId); }
  onDescargarDoc(docId: string, nombreDisplay: string): void {
    this.docDescargado.emit({ docId, nombreDisplay });
  }
```

por:

```ts
  private nuevoLocalId(): string {
    return `pend-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  protected get docsPendientesTarjetas(): DocumentoTarjeta[] {
    return this.docsPendientes.map(d => ({
      id: d.localId!,
      nombre: d.nombre,
      tipoContenido: d.linkUrl ? 'link' : 'archivo',
      linkUrl: d.linkUrl,
      estado: 'pendiente' as const,
    }));
  }

  protected get docsExistentesTarjetas(): DocumentoTarjeta[] {
    const existentes: DocumentoTarjeta[] = this.docsExistentes.map(doc => ({
      id: doc._id,
      nombre: doc.nombre_display,
      tipoContenido: doc.tipo_contenido ?? 'archivo',
      linkUrl: doc.link_url,
      estado: this.eliminandoDocIds.has(doc._id) ? 'eliminando' as const : 'listo' as const,
    }));
    const subiendo: DocumentoTarjeta[] = this.subiendoCards.map(c => ({
      id: c.id,
      nombre: c.nombre,
      tipoContenido: 'archivo' as const,
      estado: 'subiendo' as const,
    }));
    return [...existentes, ...subiendo];
  }

  onArchivoChange(file: File | null): void {
    if (!file) return;
    if (this.editingId) {
      this.docSubido.emit({ file, nombre: file.name });
    } else {
      this.docAgregado.emit({ localId: this.nuevoLocalId(), file, nombre: file.name });
    }
  }

  agregarLinkPendiente(): void {
    const link = this.linkInput.trim();
    if (!link || this.linkInvalido()) return;
    this.docAgregado.emit({ localId: this.nuevoLocalId(), linkUrl: link, nombre: link });
    this.linkInput = '';
  }

  subirLinkExistente(): void {
    const link = this.linkInput.trim();
    if (!link || this.linkInvalido()) return;
    this.docSubido.emit({ linkUrl: link, nombre: link });
    this.linkInput = '';
  }

  onEliminarDoc(docId: string): void  { this.docEliminado.emit(docId); }
  onDescargarDoc(docId: string, nombreDisplay: string): void {
    this.docDescargado.emit({ docId, nombreDisplay });
  }
  onDescargarDocId(docId: string): void {
    const doc = this.docsExistentes.find(d => d._id === docId);
    this.docDescargado.emit({ docId, nombreDisplay: doc?.nombre_display });
  }
```

(`onAbrirDoc(url: string)` no cambia — ya recibe el string directo, igual que el nuevo `(abrirLink)`.)

- [ ] **Step 2: `activos-page.component.ts` — actualizar los handlers**

Reemplazar:

```ts
  protected onDocQuitado(index: number): void {
    this.docsPendientes = this.docsPendientes.filter((_, i) => i !== index);
  }
```

por:

```ts
  protected onDocQuitado(localId: string): void {
    this.docsPendientes = this.docsPendientes.filter(d => d.localId !== localId);
  }
```

Agregar, junto a `onDocEliminado`/`onDocDescargado`:

```ts
  protected subiendoCards    = signal<{ id: string; nombre: string }[]>([]);
  protected eliminandoDocIds = signal<Set<string>>(new Set());

  protected onDocRenombrado(ev: { id: string; nuevoNombre: string }): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.activosService.renombrarDocumento(activo._id, activo.centro_costo_id, ev.id, ev.nuevoNombre);
  }
```

Actualizar `onDocSubido` y `onDocEliminado` para usar los signals nuevos en vez de `subiendoDocs`:

```ts
  protected onDocSubido(doc: DocPendiente): void {
    const activo = this.activoEditando;
    if (!activo) return;
    const tempId = `subiendo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.subiendoCards.update(list => [...list, { id: tempId, nombre: doc.nombre }]);
    const limpiar = () => this.subiendoCards.update(list => list.filter(c => c.id !== tempId));
    if (doc.linkUrl) {
      this.activosService.subirDocumentoLink(activo._id, activo.centro_costo_id, doc.linkUrl, doc.nombre, limpiar, limpiar);
    } else if (doc.file) {
      this.activosService.subirDocumento(activo._id, activo.centro_costo_id, doc.file, doc.nombre, limpiar, limpiar);
    }
  }

  protected onDocEliminado(docId: string): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.eliminandoDocIds.update(set => new Set(set).add(docId));
    const limpiar = () => this.eliminandoDocIds.update(set => {
      const copia = new Set(set);
      copia.delete(docId);
      return copia;
    });
    this.activosService.eliminarDocumento(activo._id, activo.centro_costo_id, docId, limpiar, limpiar);
  }
```

Nota: `this.service` en el resto del archivo es `ActivosService` inyectado como `activosService` — usar el nombre exacto que ya usa el archivo (`this.activosService`, confirmado en `onDocEliminado`/`onDocDescargado` existentes).

Wire el nuevo `(renombrar)` en el template de `activos-page.component.ts` (donde se usa `<app-activos-form>`), agregando junto a los demás `(doc*)`:

```html
(docRenombrado)="onDocRenombrado($event)"
[subiendoCards]="subiendoCards()"
[eliminandoDocIds]="eliminandoDocIds()"
```

- [ ] **Step 4: Verificación manual en el navegador**

Con backend y frontend corriendo, entrar a **Activos** como admin y repetir los mismos 6 pasos de Task 9 Step 4, adaptados a Activos (crear activo con documento pendiente, editar activo existente con auto-subida, renombrar, eliminar, modo link).

Expected: mismo comportamiento que actividades, sin errores en consola.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/activos/components/activos-form/activos-form.component.ts front4/src/app/features/activos/pages/activos-page.component.ts
git commit -m "feat(front4): auto-subida y tarjetas de documentos en el formulario de activos"
```

---

## Self-Review

**Cobertura del spec:** auto-subida sin botón (Tasks 6, 9, 10) ✓; tarjetas en vez de lista, ancho ~150px, nombre 3 líneas + title (Task 5) ✓; sin ícono de tipo (Task 5) ✓; cruz dentro del padding (Task 5) ✓; eliminar directo con estado "Eliminando..." (Tasks 5, 9, 10) ✓; renombrar en línea sin extensión (Task 5) ✓; error de subida con borde rojo reutilizando la cruz (Task 5, estado `'error'` deja la cruz visible) — nota: ningún caller dispara `estado: 'error'` todavía porque `subirDocumento`/`subirDocumentoLink` no exponen ese fallo por-tarjeta hoy (el error general ya lo muestra `StatusBannerComponent` vía `service.status()`); se deja el estado listo en el modelo/componente para un fast-follow, documentado acá en vez de dejarlo implícito. Caso "pendiente" (actividad nueva sin ID) (Tasks 9, 10) ✓. Backend rename genérico + rutas actividades/activos (Tasks 1-3) ✓.

**Fuera de alcance confirmado con el usuario:** Documentos (admin/consumidor) siguen con botón "Adjuntar" manual — no tocado.

**Placeholders:** ninguno — cada step tiene código completo, sin "TBD" ni "similar a Task N" sin repetir el código.

**Consistencia de tipos:** `DocumentoTarjeta.estado` (Task 4) se usa igual en `DocumentCardListComponent` (Task 5), en el getter `documentosTarjetas`/`docsPendientesTarjetas` de actividades (Task 9) y `docsExistentesTarjetas`/`docsPendientesTarjetas` de activos (Task 10). `renombrar` emite siempre `{ id, nuevoNombre }` en los tres lugares. `eliminarDocumento(..., onSuccess?, onError?)` tiene la misma forma en `ActividadesService` (Task 7) y `ActivosService` (Task 8).

---

## Fast-follow (no incluido en este plan)

- Aplicar el mismo patrón de tarjetas a Documentos (admin/consumidor), resolviendo antes cómo elegir la categoría sin el botón de confirmar manual.
- Estado `'error'` por tarjeta cuando falla una subida individual (hoy el error se ve en el `StatusBannerComponent` general, no en la tarjeta puntual).
