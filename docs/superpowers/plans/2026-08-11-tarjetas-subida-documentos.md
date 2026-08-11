# Tarjetas al subir documentos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el módulo Documentos (admin/consumidor), reemplazar el flujo de subida de un archivo a la vez (nombre/tipo manuales + botón Confirmar) por auto-subida multi-archivo con tarjetas persistentes (tipo editable, "×" para borrar) y un botón "Subir"/"Terminar".

**Architecture:** Se reutiliza y extiende la cola de subida ya existente (`upload-queue-state.ts`) como fuente de datos de las tarjetas — no se crea un array paralelo. `document-card-list` (compartido con Activos/Actividades) gana un tipo de documento opcional, apagado por defecto, así que esas dos features no cambian. El modo "Adjuntar link" no se toca.

**Tech Stack:** Angular 21 standalone, signals, Vitest.

## Global Constraints

- Sin `any` en TypeScript nuevo.
- Angular 18+ control flow (`@if`/`@for`) — nunca `*ngIf`/`*ngFor`.
- Todo lo nuevo en `document-card-list` y `upload-document-form` es opt-in con default que reproduce el comportamiento actual — Activos/Actividades no cambian.
- No se toca el modo "Adjuntar link" de Documentos (campos, botón Confirmar, burbuja para ese tipo de item).
- No se toca la lista de documentos ya subidos (filas) en ninguna vista.
- No se cambia el backend ni los endpoints existentes.

---

### Task 1: Extender `upload-queue-state.ts`

**Files:**
- Modify: `front4/src/app/shared/upload-queue-state.ts`
- Modify: `front4/src/app/shared/upload-queue-state.spec.ts`

**Interfaces:**
- Produces: `UploadKind = 'archivo' | 'link'`; `UploadItem` gana `kind: UploadKind`, `categoria?: string`, `docUrl?: string`; `createUploadQueue()` gana `agregar(nombre, kind, categoria?)` (firma extendida, antes solo `agregar(nombre)`), `marcarListo(id, docUrl?)` (antes `marcarListo(id)`), `actualizarCategoria(id, categoria)`, `quitar(id)`.

- [ ] **Step 1: Reemplazar el contenido de `upload-queue-state.ts`**

```ts
import { signal, Signal } from '@angular/core';

export type UploadEstado = 'subiendo' | 'listo' | 'error';
export type UploadKind = 'archivo' | 'link';

export interface UploadItem {
  id: string;
  nombre: string;
  progreso: number;
  estado: UploadEstado;
  errorMsg?: string;
  kind: UploadKind;
  categoria?: string;
  docUrl?: string;
}

export function createUploadQueue(): {
  items: Signal<UploadItem[]>;
  agregar(nombre: string, kind: UploadKind, categoria?: string): string;
  actualizarProgreso(id: string, progreso: number): void;
  marcarListo(id: string, docUrl?: string): void;
  marcarError(id: string, errorMsg: string): void;
  actualizarCategoria(id: string, categoria: string): void;
  quitar(id: string): void;
  reiniciar(id: string): void;
  limpiar(): void;
} {
  const items = signal<UploadItem[]>([]);
  let nextId = 0;

  function agregar(nombre: string, kind: UploadKind, categoria?: string): string {
    const id = `upload-${nextId++}`;
    items.update(q => [...q, { id, nombre, progreso: 0, estado: 'subiendo', kind, categoria }]);
    return id;
  }

  function actualizarProgreso(id: string, progreso: number): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso } : i)));
  }

  function marcarListo(id: string, docUrl?: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso: 100, estado: 'listo' as const, docUrl } : i)));
  }

  function marcarError(id: string, errorMsg: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, estado: 'error' as const, errorMsg } : i)));
  }

  function actualizarCategoria(id: string, categoria: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, categoria } : i)));
  }

  function quitar(id: string): void {
    items.update(q => q.filter(i => i.id !== id));
  }

  function reiniciar(id: string): void {
    items.update(q => q.map(i => (i.id === id ? { ...i, progreso: 0, estado: 'subiendo' as const, errorMsg: undefined } : i)));
  }

  function limpiar(): void {
    items.set([]);
  }

  return { items, agregar, actualizarProgreso, marcarListo, marcarError, actualizarCategoria, quitar, reiniciar, limpiar };
}
```

Nota: `reiniciar` ahora preserva `kind`/`categoria`/`docUrl` vía spread (antes reconstruía el objeto desde cero con solo `id`/`nombre`/`progreso`/`estado`) — necesario para que un reintento no pierda de qué tipo era el item ni la categoría elegida.

- [ ] **Step 2: Reemplazar el contenido de `upload-queue-state.spec.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createUploadQueue } from './upload-queue-state';

describe('createUploadQueue', () => {
  it('agrega un item en estado subiendo con progreso 0, tipo y categoría', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('factura.pdf', 'archivo', 'Contratos');
    expect(queue.items()).toEqual([
      { id, nombre: 'factura.pdf', progreso: 0, estado: 'subiendo', kind: 'archivo', categoria: 'Contratos' },
    ]);
  });

  it('nunca sobrescribe un item existente al agregar uno nuevo', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf', 'archivo');
    const id2 = queue.agregar('b.pdf', 'link');
    expect(id1).not.toBe(id2);
    expect(queue.items().map(i => i.nombre)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('actualiza el progreso del item correcto', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf', 'archivo');
    const id2 = queue.agregar('b.pdf', 'archivo');
    queue.actualizarProgreso(id2, 40);
    expect(queue.items().find(i => i.id === id1)?.progreso).toBe(0);
    expect(queue.items().find(i => i.id === id2)?.progreso).toBe(40);
  });

  it('marca un item como listo con progreso 100 y guarda el docUrl', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf', 'archivo', 'Otros');
    queue.actualizarProgreso(id, 60);
    queue.marcarListo(id, 'https://s3/a.pdf');
    expect(queue.items().find(i => i.id === id)).toEqual({
      id, nombre: 'a.pdf', progreso: 100, estado: 'listo', kind: 'archivo', categoria: 'Otros', docUrl: 'https://s3/a.pdf',
    });
  });

  it('marca un item como error con mensaje', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf', 'archivo');
    queue.marcarError(id, 'Archivo demasiado grande');
    const item = queue.items().find(i => i.id === id);
    expect(item?.estado).toBe('error');
    expect(item?.errorMsg).toBe('Archivo demasiado grande');
  });

  it('actualiza la categoría de un item existente', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf', 'archivo', 'Otros');
    queue.actualizarCategoria(id, 'Contratos');
    expect(queue.items().find(i => i.id === id)?.categoria).toBe('Contratos');
  });

  it('quitar saca solo el item indicado', () => {
    const queue = createUploadQueue();
    const id1 = queue.agregar('a.pdf', 'archivo');
    const id2 = queue.agregar('b.pdf', 'archivo');
    queue.quitar(id1);
    expect(queue.items().map(i => i.id)).toEqual([id2]);
  });

  it('reinicia un item en error de vuelta a subiendo, progreso 0, sin errorMsg, preservando kind y categoría', () => {
    const queue = createUploadQueue();
    const id = queue.agregar('a.pdf', 'archivo', 'Contratos');
    queue.marcarError(id, 'Error de red');
    queue.reiniciar(id);
    expect(queue.items().find(i => i.id === id)).toEqual({
      id, nombre: 'a.pdf', progreso: 0, estado: 'subiendo', kind: 'archivo', categoria: 'Contratos',
    });
  });

  it('limpiar vacía la cola', () => {
    const queue = createUploadQueue();
    queue.agregar('a.pdf', 'archivo');
    queue.agregar('b.pdf', 'archivo');
    queue.limpiar();
    expect(queue.items()).toEqual([]);
  });
});
```

- [ ] **Step 3: Correr los tests**

Run: `cd front4 && npm test -- --watch=false`
Expected: todos los tests de `upload-queue-state.spec.ts` en verde (9 tests). El resto de la suite puede fallar en dos sitios esperados y no relacionados con este paso — ver Step 4.

- [ ] **Step 4: Confirmar que las llamadas existentes a `agregar`/`marcarListo` en las páginas de Documentos ahora no compilan (esperado en este punto)**

Run: `cd front4 && npx tsc --noEmit -p .`
Expected: errores de tipos en `documentos-admin-page.component.ts` y `documentos-consumidor-page.component.ts` (llamadas a `uploadQueue.agregar(nombreParaCola)` con un solo argumento). Es esperado — se corrige en las Tareas 4 y 5. No solucionar aquí.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/shared/upload-queue-state.ts front4/src/app/shared/upload-queue-state.spec.ts
git commit -m "feat(front4): extender upload-queue-state con kind, categoria y docUrl"
```

---

### Task 2: Extender `document-card-list` con tipo de documento opcional

**Files:**
- Modify: `front4/src/app/shared/models/documento-tarjeta.model.ts`
- Modify: `front4/src/app/shared/components/document-card-list/document-card-list.component.ts`
- Modify: `front4/src/app/shared/components/document-card-list/document-card-list.component.spec.ts`

**Interfaces:**
- Produces: `DocumentoTarjeta.categoria?: string`; `DocumentCardListComponent` gana `@Input() mostrarCategoria = false`, `@Input() categorias: readonly string[] = []`, `@Output() categoriaChange = new EventEmitter<{ id: string; categoria: string }>()`, `@Output() reintentar = new EventEmitter<string>()`.
- Consumes: nada nuevo — sigue sin inyectar servicios.

- [ ] **Step 1: Extender el modelo**

En `front4/src/app/shared/models/documento-tarjeta.model.ts`, el archivo completo pasa a ser:

```ts
export type EstadoDocumentoTarjeta = 'listo' | 'subiendo' | 'pendiente' | 'eliminando' | 'error';

export interface DocumentoTarjeta {
  id: string;
  nombre: string;
  tipoContenido: 'archivo' | 'link';
  linkUrl?: string;
  estado: EstadoDocumentoTarjeta;
  categoria?: string;
}
```

- [ ] **Step 2: Extender el componente**

En `front4/src/app/shared/components/document-card-list/document-card-list.component.ts`:

Agregar a la sección `styles` (después de la regla `.dcl-tag`, antes de `.dcl-acciones`):

```css
    .dcl-categoria-select {
      margin-top: .3rem; width: 96%; font-size: .68rem; border: 1px solid #d7e6ee;
      border-radius: 5px; padding: .2rem .3rem; outline: none; box-sizing: border-box;
      background: #fff; color: #1a2733; font-family: inherit;
    }
    .dcl-retry {
      margin-top: .3rem; width: 96%; font-size: .68rem; border: 1px solid #f1c3bb;
      border-radius: 5px; padding: .25rem .3rem; background: #fef8f7; color: #c0392b;
      cursor: pointer; font-family: inherit;
    }
```

En el `template`, dentro del `@for (doc of documentos; track doc.id) { <div class="dcl-card" ...> ... }`, insertar el siguiente bloque **inmediatamente después** del `@if (renombrandoId() === doc.id) { ... } @else if (...) { ... }` (el bloque que termina con el `@if (doc.estado === 'pendiente') { <span class="dcl-tag">pendiente</span> }` y su `}` de cierre) y **antes** de `@if (doc.estado === 'listo') { <div class="dcl-acciones"> ... }`:

```html
          @if (mostrarCategoria && (doc.estado === 'subiendo' || doc.estado === 'listo')) {
            <select class="dcl-categoria-select" [value]="doc.categoria"
                    (change)="onCategoriaChange(doc, $event)">
              @for (cat of categorias; track cat) { <option [value]="cat">{{ cat }}</option> }
            </select>
          }
          @if (doc.estado === 'error') {
            <button type="button" class="dcl-retry" (click)="reintentar.emit(doc.id)">↻ Reintentar</button>
          }
```

Al final de la clase `DocumentCardListComponent`, agregar los nuevos `@Input`/`@Output` (junto a los existentes) y el método:

```ts
  @Input() mostrarCategoria = false;
  @Input() categorias: readonly string[] = [];
  @Output() categoriaChange = new EventEmitter<{ id: string; categoria: string }>();
  @Output() reintentar = new EventEmitter<string>();
```

```ts
  onCategoriaChange(doc: DocumentoTarjeta, event: Event): void {
    const categoria = (event.target as HTMLSelectElement).value;
    this.categoriaChange.emit({ id: doc.id, categoria });
  }
```

(Ubicar los nuevos `@Input`/`@Output` junto a los existentes al inicio de la clase, y `onCategoriaChange` junto a los otros métodos como `iniciarRenombre`/`confirmarRenombre`.)

- [ ] **Step 3: Agregar tests**

Al final de `front4/src/app/shared/components/document-card-list/document-card-list.component.spec.ts` (dentro del mismo `describe`, después del último `it` existente, antes del `});` final), agregar:

```ts
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
```

- [ ] **Step 4: Correr los tests**

Run: `cd front4 && npm test -- --watch=false`
Expected: los tests nuevos y los existentes de `document-card-list.component.spec.ts` pasan (los existentes no deben requerir cambios — `mostrarCategoria` por defecto es `false`).

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/shared/models/documento-tarjeta.model.ts front4/src/app/shared/components/document-card-list/
git commit -m "feat(front4): agregar tipo de documento opcional a document-card-list"
```

---

### Task 3: Multi-archivo y campos ocultables en `upload-document-form`

**Files:**
- Modify: `front4/src/app/shared/components/upload-document-form/upload-document-form.component.ts`
- Modify: `front4/src/app/shared/components/upload-document-form/upload-document-form.component.spec.ts`

**Interfaces:**
- Produces: `@Input() mostrarCamposArchivo = true` (nuevo); `onFileSelected`/`onDrop` ahora emiten `archivoChange` una vez por archivo en vez de solo el primero. `@Output() archivoChange` conserva su tipo (`EventEmitter<File | null>`).

- [ ] **Step 1: Multi-archivo — reemplazar `onFileSelected`/`onDrop`**

Ubicar en la clase `UploadDocumentFormComponent`:

```ts
  onFileSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    (ev.target as HTMLInputElement).value = '';
    if (file) this.archivoChange.emit(file);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const file = ev.dataTransfer?.files?.[0] ?? null;
    if (file) this.archivoChange.emit(file);
  }
```

Reemplazar por:

```ts
  onFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const files = input.files;
    if (files) { for (let i = 0; i < files.length; i++) this.archivoChange.emit(files[i]); }
    input.value = '';
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    const files = ev.dataTransfer?.files;
    if (files) { for (let i = 0; i < files.length; i++) this.archivoChange.emit(files[i]); }
  }
```

- [ ] **Step 2: Agregar `multiple` al input de archivo**

Ubicar en el template:

```html
          <input #fileInput type="file" style="display:none" [attr.accept]="accept || null" (change)="onFileSelected($event)" />
```

Reemplazar por:

```html
          <input #fileInput type="file" multiple style="display:none" [attr.accept]="accept || null" (change)="onFileSelected($event)" />
```

- [ ] **Step 3: Nuevo `@Input() mostrarCamposArchivo` — ocultar campos solo en modo archivo**

Ubicar (dentro del bloque `@if (modo === 'archivo') { ... }` del template, después del `</div>` que cierra `.udf-dropzone`):

```html
        @if (mostrarTipoDocumento) {
          <div class="udf-fields">
            <label class="udf-field">
              <span class="udf-label">Nombre del archivo</span>
              <input type="text" class="udf-input" [(ngModel)]="nombre" (ngModelChange)="nombreChange.emit($event)" placeholder="Nombre del documento" />
            </label>
            <label class="udf-field">
              <span class="udf-label">Tipo de documento</span>
              <select class="udf-select" [(ngModel)]="categoria" (ngModelChange)="categoriaChange.emit($event)">
                @for (cat of categorias; track cat) { <option [value]="cat">{{ cat }}</option> }
              </select>
            </label>
          </div>
        } @else if (mostrarNombre) {
          <label class="udf-field udf-field--full">
            <span class="udf-label">Nombre del documento (opcional)</span>
            <input type="text" class="udf-input" [(ngModel)]="nombre" (ngModelChange)="nombreChange.emit($event)" placeholder="Nombre del documento" />
          </label>
        }
      } @else {
```

Reemplazar por (mismo bloque, cada condición gana `mostrarCamposArchivo &&`; el `} @else {` que sigue, del modo link, no cambia):

```html
        @if (mostrarCamposArchivo && mostrarTipoDocumento) {
          <div class="udf-fields">
            <label class="udf-field">
              <span class="udf-label">Nombre del archivo</span>
              <input type="text" class="udf-input" [(ngModel)]="nombre" (ngModelChange)="nombreChange.emit($event)" placeholder="Nombre del documento" />
            </label>
            <label class="udf-field">
              <span class="udf-label">Tipo de documento</span>
              <select class="udf-select" [(ngModel)]="categoria" (ngModelChange)="categoriaChange.emit($event)">
                @for (cat of categorias; track cat) { <option [value]="cat">{{ cat }}</option> }
              </select>
            </label>
          </div>
        } @else if (mostrarCamposArchivo && mostrarNombre) {
          <label class="udf-field udf-field--full">
            <span class="udf-label">Nombre del documento (opcional)</span>
            <input type="text" class="udf-input" [(ngModel)]="nombre" (ngModelChange)="nombreChange.emit($event)" placeholder="Nombre del documento" />
          </label>
        }
      } @else {
```

Nota: el modo `'archivo'` sigue teniendo su propio botón "Confirmar subida" ocultable — eso ya lo controla el `@Input() ocultarBotonConfirmarArchivo` existente (sin cambios); Documentos lo pondrá en `true` en la Tarea 4/5, no hace falta tocarlo aquí.

- [ ] **Step 4: Declarar el nuevo `@Input`**

Ubicar:

```ts
  @Input() categorias: readonly string[] = [];
  @Input() mostrarTipoDocumento = true;
  @Input() mostrarNombre = true;
```

Reemplazar por:

```ts
  @Input() categorias: readonly string[] = [];
  @Input() mostrarTipoDocumento = true;
  @Input() mostrarNombre = true;
  @Input() mostrarCamposArchivo = true;
```

- [ ] **Step 5: Agregar tests**

Al final de `front4/src/app/shared/components/upload-document-form/upload-document-form.component.spec.ts` (dentro del `describe` existente, antes del `});` final), agregar:

```ts
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
```

- [ ] **Step 6: Correr los tests**

Run: `cd front4 && npm test -- --watch=false`
Expected: los tests nuevos y los 3 existentes de `upload-document-form.component.spec.ts` pasan.

- [ ] **Step 7: Commit**

```bash
git add front4/src/app/shared/components/upload-document-form/
git commit -m "feat(front4): soporte multi-archivo y mostrarCamposArchivo en upload-document-form"
```

---

### Task 4: Documentos admin — flujo de subida con tarjetas

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`

**Interfaces:**
- Consumes: `DocumentCardListComponent` (Task 2), `mostrarCamposArchivo`/multi-archivo de `upload-document-form` (Task 3), `agregar(nombre, kind, categoria?)`/`marcarListo(id, docUrl?)`/`actualizarCategoria(id, categoria)`/`quitar(id)` de `upload-queue-state` (Task 1).

- [ ] **Step 1: Imports**

Ubicar:

```ts
import { UploadDocumentFormComponent } from '../../../shared/components/upload-document-form/upload-document-form.component';
import { createUploadQueue } from '../../../shared/upload-queue-state';
```

Reemplazar por:

```ts
import { UploadDocumentFormComponent } from '../../../shared/components/upload-document-form/upload-document-form.component';
import { DocumentCardListComponent } from '../../../shared/components/document-card-list/document-card-list.component';
import { DocumentoTarjeta } from '../../../shared/models/documento-tarjeta.model';
import { createUploadQueue } from '../../../shared/upload-queue-state';
```

Ubicar:

```ts
  imports: [FormsModule, StatusBannerComponent, UploadBubbleComponent, UploadDocumentFormComponent],
```

Reemplazar por:

```ts
  imports: [FormsModule, StatusBannerComponent, UploadBubbleComponent, UploadDocumentFormComponent, DocumentCardListComponent],
```

- [ ] **Step 2: `toggleUpload` — limpiar tarjetas de archivo al cerrar**

Ubicar:

```ts
  toggleUpload(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showUpload = !p.showUpload;
    if (!p.showUpload) { p.selectedFile = null; p.nombreInput = ''; p.linkInput = ''; p.modoUpload = 'archivo'; }
  }
```

Reemplazar por:

```ts
  toggleUpload(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showUpload = !p.showUpload;
    if (!p.showUpload) {
      p.selectedFile = null; p.nombreInput = ''; p.linkInput = ''; p.modoUpload = 'archivo';
      this.uploadQueue.items().filter(i => i.kind === 'archivo').forEach(i => this.uploadQueue.quitar(i.id));
    }
  }
```

- [ ] **Step 3: `onArchivoChange` — auto-subida por archivo**

Ubicar:

```ts
  onArchivoChange(file: File | null, tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.selectedFile = file;
    if (file) {
      if (!p.nombreInput) p.nombreInput = file.name;
      p.categoriaInput = detectarCategoriaDocumento(file.name)!;
    }
  }
```

Reemplazar por:

```ts
  onArchivoChange(file: File | null, tipo: DocTipo): void {
    if (!file) return;
    const categoria = detectarCategoriaDocumento(file.name) ?? 'Otros';
    const id = this.uploadQueue.agregar(file.name, 'archivo', categoria);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      this.uploadQueue.marcarError(id, `El archivo pesa ${formatBytes(file.size)} y supera el límite de 20 MB. Selecciona uno más liviano.`);
      return;
    }
    const empresaId = this.selectedEmpresaId;
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;
    const ctx: UploadCtx = { kind: 'archivo', file, tipo, empresaId, centroId, proyectoId, categoria };
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);
  }
```

- [ ] **Step 4: `confirmarSubida` — solo modo link (el modo archivo ya no pasa por acá; su botón está oculto)**

Ubicar:

```ts
  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    const empresaId = this.selectedEmpresaId;
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;

    let ctx: UploadCtx;
    let nombreParaCola: string;
    if (p.modoUpload === 'link') {
      const link = p.linkInput.trim();
      if (!link || this.linkInvalido(tipo)) return;
      ctx = { kind: 'link', linkUrl: link, tipo, empresaId, centroId, proyectoId, nombreDisplay: p.nombreInput || undefined, categoria: p.categoriaInput || undefined };
      nombreParaCola = p.nombreInput || link;
    } else {
      if (!p.selectedFile || this.archivoDemasiadoGrande(tipo)) return;
      ctx = { kind: 'archivo', file: p.selectedFile, tipo, empresaId, centroId, proyectoId, nombreDisplay: p.nombreInput || undefined, categoria: p.categoriaInput || undefined };
      nombreParaCola = p.nombreInput || p.selectedFile.name;
    }

    const id = this.uploadQueue.agregar(nombreParaCola);
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);

    p.selectedFile = null;
    p.nombreInput = '';
    p.linkInput = '';
    p.showUpload = false;
  }
```

Reemplazar por:

```ts
  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    const empresaId = this.selectedEmpresaId;
    const centroId = (this.selectedCentroId && this.selectedCentroId !== 'todos') ? this.selectedCentroId : undefined;
    const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;

    const link = p.linkInput.trim();
    if (!link || this.linkInvalido(tipo)) return;
    const ctx: UploadCtx = { kind: 'link', linkUrl: link, tipo, empresaId, centroId, proyectoId, nombreDisplay: p.nombreInput || undefined, categoria: p.categoriaInput || undefined };
    const nombreParaCola = p.nombreInput || link;

    const id = this.uploadQueue.agregar(nombreParaCola, 'link', ctx.categoria);
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);

    p.selectedFile = null;
    p.nombreInput = '';
    p.linkInput = '';
    p.showUpload = false;
  }
```

- [ ] **Step 5: `ejecutarSubida` — capturar `docUrl` al terminar**

Ubicar:

```ts
    this.service.subir(ctx.file, ctx.tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
      .subscribe({
        next: (event: HttpEvent<DocumentoItem>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadQueue.actualizarProgreso(id, Math.round((100 * event.loaded) / event.total));
          } else if (event.type === HttpEventType.Response) {
            this.uploadQueue.marcarListo(id);
            this.retryContext.delete(id);
          }
        },
        error: onError,
      });
```

Reemplazar por:

```ts
    this.service.subir(ctx.file, ctx.tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
      .subscribe({
        next: (event: HttpEvent<DocumentoItem>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadQueue.actualizarProgreso(id, Math.round((100 * event.loaded) / event.total));
          } else if (event.type === HttpEventType.Response) {
            this.uploadQueue.marcarListo(id, event.body?.url);
            this.retryContext.delete(id);
          }
        },
        error: onError,
      });
```

- [ ] **Step 6: Nuevos métodos para las tarjetas**

Agregar, junto a `onArchivoChange` (mismo bloque/zona de la clase):

```ts
  tarjetasArchivoSubiendo(tipo: DocTipo): DocumentoTarjeta[] {
    return this.uploadQueue.items()
      .filter(i => i.kind === 'archivo')
      .map(i => ({
        id: i.id,
        nombre: i.nombre,
        tipoContenido: 'archivo' as const,
        estado: i.estado,
        categoria: i.categoria,
      }));
  }

  onCategoriaTarjetaChange(event: { id: string; categoria: string }, tipo: DocTipo): void {
    this.uploadQueue.actualizarCategoria(event.id, event.categoria);
    const item = this.uploadQueue.items().find(i => i.id === event.id);
    if (item?.estado === 'listo' && item.docUrl) {
      this.service.actualizarCategoria(item.docUrl, event.categoria, tipo);
    }
  }

  onEliminarTarjeta(id: string, tipo: DocTipo): void {
    const item = this.uploadQueue.items().find(i => i.id === id);
    if (item?.estado === 'listo' && item.docUrl) {
      this.eliminar(item.docUrl, tipo);
    }
    this.uploadQueue.quitar(id);
  }
```

- [ ] **Step 7: Template — ocultar campos de archivo, insertar tarjetas**

Ubicar:

```html
            @if (panels[docTipo].showUpload) {
              <app-upload-document-form
                style="display:block;margin-bottom:1rem"
                [modo]="panels[docTipo].modoUpload" (modoChange)="setModoUpload(docTipo, $event)"
                [archivo]="panels[docTipo].selectedFile" (archivoChange)="onArchivoChange($event, docTipo)"
                [(link)]="panels[docTipo].linkInput"
                [(nombre)]="panels[docTipo].nombreInput"
                [(categoria)]="panels[docTipo].categoriaInput"
                [categorias]="categorias"
                [archivoInvalido]="archivoDemasiadoGrande(docTipo)"
                [mensajeArchivoInvalido]="mensajeArchivoDemasiadoGrande(docTipo)"
                [linkInvalido]="linkInvalido(docTipo)"
                [confirmDisabled]="panels[docTipo].modoUpload === 'archivo'
                  ? (!panels[docTipo].selectedFile || archivoDemasiadoGrande(docTipo))
                  : (!panels[docTipo].linkInput.trim() || linkInvalido(docTipo))"
                (confirmar)="confirmarSubida(docTipo)"
                (cancelar)="toggleUpload(docTipo)" />
            }
```

Reemplazar por:

```html
            @if (panels[docTipo].showUpload) {
              <app-upload-document-form
                style="display:block;margin-bottom:1rem"
                [modo]="panels[docTipo].modoUpload" (modoChange)="setModoUpload(docTipo, $event)"
                [archivo]="panels[docTipo].selectedFile" (archivoChange)="onArchivoChange($event, docTipo)"
                [(link)]="panels[docTipo].linkInput"
                [(nombre)]="panels[docTipo].nombreInput"
                [(categoria)]="panels[docTipo].categoriaInput"
                [categorias]="categorias"
                [mostrarCamposArchivo]="false"
                [ocultarBotonConfirmarArchivo]="true"
                [archivoInvalido]="archivoDemasiadoGrande(docTipo)"
                [mensajeArchivoInvalido]="mensajeArchivoDemasiadoGrande(docTipo)"
                [linkInvalido]="linkInvalido(docTipo)"
                [confirmDisabled]="panels[docTipo].modoUpload === 'archivo'
                  ? (!panels[docTipo].selectedFile || archivoDemasiadoGrande(docTipo))
                  : (!panels[docTipo].linkInput.trim() || linkInvalido(docTipo))"
                (confirmar)="confirmarSubida(docTipo)"
                (cancelar)="toggleUpload(docTipo)" />

              @if (tarjetasArchivoSubiendo(docTipo).length > 0) {
                <div style="margin-bottom:1rem">
                  <app-document-card-list
                    [documentos]="tarjetasArchivoSubiendo(docTipo)"
                    [mostrarCategoria]="true"
                    [categorias]="categorias"
                    (categoriaChange)="onCategoriaTarjetaChange($event, docTipo)"
                    (eliminar)="onEliminarTarjeta($event, docTipo)"
                    (reintentar)="reintentarSubida($event)" />
                </div>
              }
            }
```

- [ ] **Step 8: Botón "Subir"/"Terminar"**

Ubicar:

```html
                  <button class="btn-primary" style="flex:1;font-size:.8rem;padding:.4rem .5rem;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:.35rem" (click)="toggleUpload(docTipoActual)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    Subir
                  </button>
```

Reemplazar por:

```html
                  <button class="btn-primary" style="flex:1;font-size:.8rem;padding:.4rem .5rem;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:.35rem" (click)="toggleUpload(docTipoActual)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    {{ panels[docTipoActual].showUpload ? 'Terminar' : 'Subir' }}
                  </button>
```

- [ ] **Step 9: Burbuja de subida — solo items de link**

Ubicar:

```html
<app-upload-bubble
  [items]="uploadQueue.items()"
  (cerrar)="cerrarUploadBubble()"
  (reintentar)="reintentarSubida($event)">
</app-upload-bubble>
```

Reemplazar por:

```html
<app-upload-bubble
  [items]="itemsLinkParaBurbuja()"
  (cerrar)="cerrarUploadBubble()"
  (reintentar)="reintentarSubida($event)">
</app-upload-bubble>
```

Agregar el método (junto a `cerrarUploadBubble`):

```ts
  itemsLinkParaBurbuja() {
    return this.uploadQueue.items().filter(i => i.kind === 'link');
  }
```

- [ ] **Step 10: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p .`
Expected: sin errores (esto también valida que Task 1 quedó bien integrada aquí).

- [ ] **Step 11: Correr la suite completa**

Run: `cd front4 && npm test -- --watch=false`
Expected: sin regresiones respecto a la corrida después de la Tarea 3.

- [ ] **Step 12: Verificar visualmente**

`npm start`, ir a `/documentos` (admin), abrir una empresa/centro/proyecto, clic en "Subir", soltar 2-3 archivos juntos: deben aparecer como tarjetas con spinner, tipo detectado y editable; al terminar de subir, cada tarjeta pasa a "listo" (con ✓) y sigue visible; el botón dice "Terminar"; clic en "Terminar" cierra el panel y los documentos ya aparecen en la lista de filas de abajo. Probar también "×" sobre una tarjeta lista (debe borrar el documento) y cambiar el tipo de una tarjeta en subiendo (debe reflejarse en la fila final). Confirmar que "Adjuntar link" sigue funcionando exactamente igual que antes.

- [ ] **Step 13: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-admin-page.component.ts front4/src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front4): tarjetas de subida multi-archivo en Documentos (admin)"
```

---

### Task 5: Documentos consumidor — flujo de subida con tarjetas

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts`
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html`

**Interfaces:** mismas que la Tarea 4. La lógica es idéntica a la página admin; solo cambia cómo se obtienen `empresaId`/`centroId`/`proyectoId` (ya está resuelto así en el código existente de esta página) y los nombres `tabConsumidorActiva()`/`tabDocConsumidor()` en vez de `tabAdminActiva()`/`tabDocAdmin()` (no aplica a los bloques que se tocan aquí, que ya están dentro del contexto correcto).

- [ ] **Step 1: Imports**

Ubicar:

```ts
import { UploadBubbleComponent } from '../../../shared/components/upload-bubble/upload-bubble.component';
```

y

```ts
import { createUploadQueue } from '../../../shared/upload-queue-state';
```

(son dos líneas de import separadas, no necesariamente contiguas — ubicar cada una). Después de la línea de `UploadDocumentFormComponent`, agregar:

```ts
import { DocumentCardListComponent } from '../../../shared/components/document-card-list/document-card-list.component';
import { DocumentoTarjeta } from '../../../shared/models/documento-tarjeta.model';
```

Ubicar:

```ts
  imports: [NgTemplateOutlet, FormsModule, StatusBannerComponent, UploadBubbleComponent, UploadDocumentFormComponent],
```

Reemplazar por:

```ts
  imports: [NgTemplateOutlet, FormsModule, StatusBannerComponent, UploadBubbleComponent, UploadDocumentFormComponent, DocumentCardListComponent],
```

- [ ] **Step 2: `toggleUpload` — limpiar tarjetas de archivo al cerrar**

Ubicar:

```ts
  toggleUpload(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showUpload = !p.showUpload;
    if (!p.showUpload) { p.selectedFile = null; p.nombreInput = ''; p.linkInput = ''; p.modoUpload = 'archivo'; }
  }
```

Reemplazar por:

```ts
  toggleUpload(tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.showUpload = !p.showUpload;
    if (!p.showUpload) {
      p.selectedFile = null; p.nombreInput = ''; p.linkInput = ''; p.modoUpload = 'archivo';
      this.uploadQueue.items().filter(i => i.kind === 'archivo').forEach(i => this.uploadQueue.quitar(i.id));
    }
  }
```

- [ ] **Step 3: `onArchivoChange` — auto-subida por archivo**

Ubicar:

```ts
  onArchivoChange(file: File | null, tipo: DocTipo): void {
    const p = this.panels[tipo];
    p.selectedFile = file;
    if (file) {
      if (!p.nombreInput) p.nombreInput = file.name;
      p.categoriaInput = detectarCategoriaDocumento(file.name)!;
    }
  }
```

Reemplazar por:

```ts
  onArchivoChange(file: File | null, tipo: DocTipo): void {
    if (!file) return;
    const categoria = detectarCategoriaDocumento(file.name) ?? 'Otros';
    const id = this.uploadQueue.agregar(file.name, 'archivo', categoria);
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      this.uploadQueue.marcarError(id, `El archivo pesa ${formatBytes(file.size)} y supera el límite de 20 MB. Selecciona uno más liviano.`);
      return;
    }
    const empresaId = this.consumidorContext.empresaSeleccionada()?._id ?? '';
    const centroId = this.selectedCentroIdC() || undefined;
    const proyectoId = this.selectedProyectoIdC() || undefined;
    const ctx: UploadCtx = { kind: 'archivo', file, tipo, empresaId, centroId, proyectoId, categoria };
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);
  }
```

- [ ] **Step 4: `confirmarSubida` — solo modo link**

Ubicar:

```ts
  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    const empresaId = this.consumidorContext.empresaSeleccionada()?._id ?? '';
    const centroId = this.selectedCentroIdC() || undefined;
    const proyectoId = this.selectedProyectoIdC() || undefined;

    let ctx: UploadCtx;
    let nombreParaCola: string;
    if (p.modoUpload === 'link') {
      const link = p.linkInput.trim();
      if (!link || this.linkInvalido(tipo)) return;
      ctx = { kind: 'link', linkUrl: link, tipo, empresaId, centroId, proyectoId, nombreDisplay: p.nombreInput || undefined, categoria: p.categoriaInput || undefined };
      nombreParaCola = p.nombreInput || link;
    } else {
      if (!p.selectedFile || this.archivoDemasiadoGrande(tipo)) return;
      ctx = { kind: 'archivo', file: p.selectedFile, tipo, empresaId, centroId, proyectoId, nombreDisplay: p.nombreInput || undefined, categoria: p.categoriaInput || undefined };
      nombreParaCola = p.nombreInput || p.selectedFile.name;
    }

    const id = this.uploadQueue.agregar(nombreParaCola);
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);

    p.selectedFile = null;
    p.nombreInput = '';
    p.linkInput = '';
    p.showUpload = false;
  }
```

Reemplazar por:

```ts
  confirmarSubida(tipo: DocTipo): void {
    const p = this.panels[tipo];
    const empresaId = this.consumidorContext.empresaSeleccionada()?._id ?? '';
    const centroId = this.selectedCentroIdC() || undefined;
    const proyectoId = this.selectedProyectoIdC() || undefined;

    const link = p.linkInput.trim();
    if (!link || this.linkInvalido(tipo)) return;
    const ctx: UploadCtx = { kind: 'link', linkUrl: link, tipo, empresaId, centroId, proyectoId, nombreDisplay: p.nombreInput || undefined, categoria: p.categoriaInput || undefined };
    const nombreParaCola = p.nombreInput || link;

    const id = this.uploadQueue.agregar(nombreParaCola, 'link', ctx.categoria);
    this.retryContext.set(id, ctx);
    this.ejecutarSubida(id, ctx);

    p.selectedFile = null;
    p.nombreInput = '';
    p.linkInput = '';
    p.showUpload = false;
  }
```

- [ ] **Step 5: `ejecutarSubida` — capturar `docUrl` al terminar**

Ubicar:

```ts
    this.service.subir(ctx.file, ctx.tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
      .subscribe({
        next: (event: HttpEvent<DocumentoItem>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadQueue.actualizarProgreso(id, Math.round((100 * event.loaded) / event.total));
          } else if (event.type === HttpEventType.Response) {
            this.uploadQueue.marcarListo(id);
            this.retryContext.delete(id);
          }
        },
        error: onError,
      });
```

Reemplazar por:

```ts
    this.service.subir(ctx.file, ctx.tipo, ctx.empresaId, ctx.centroId, ctx.proyectoId, ctx.nombreDisplay, ctx.categoria)
      .subscribe({
        next: (event: HttpEvent<DocumentoItem>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.uploadQueue.actualizarProgreso(id, Math.round((100 * event.loaded) / event.total));
          } else if (event.type === HttpEventType.Response) {
            this.uploadQueue.marcarListo(id, event.body?.url);
            this.retryContext.delete(id);
          }
        },
        error: onError,
      });
```

- [ ] **Step 6: Nuevos métodos para las tarjetas**

Agregar, junto a `onArchivoChange`:

```ts
  tarjetasArchivoSubiendo(tipo: DocTipo): DocumentoTarjeta[] {
    return this.uploadQueue.items()
      .filter(i => i.kind === 'archivo')
      .map(i => ({
        id: i.id,
        nombre: i.nombre,
        tipoContenido: 'archivo' as const,
        estado: i.estado,
        categoria: i.categoria,
      }));
  }

  onCategoriaTarjetaChange(event: { id: string; categoria: string }, tipo: DocTipo): void {
    this.uploadQueue.actualizarCategoria(event.id, event.categoria);
    const item = this.uploadQueue.items().find(i => i.id === event.id);
    if (item?.estado === 'listo' && item.docUrl) {
      this.service.actualizarCategoria(item.docUrl, event.categoria, tipo);
    }
  }

  onEliminarTarjeta(id: string, tipo: DocTipo): void {
    const item = this.uploadQueue.items().find(i => i.id === id);
    if (item?.estado === 'listo' && item.docUrl) {
      this.eliminar(item.docUrl, tipo);
    }
    this.uploadQueue.quitar(id);
  }

  itemsLinkParaBurbuja() {
    return this.uploadQueue.items().filter(i => i.kind === 'link');
  }
```

- [ ] **Step 7: Template — ocultar campos de archivo, insertar tarjetas**

Ubicar:

```html
              <app-upload-document-form
                style="display:block;margin-bottom:1rem"
                [mostrarAviso]="true"
                [modo]="panels[docTipo].modoUpload" (modoChange)="setModoUpload(docTipo, $event)"
                [archivo]="panels[docTipo].selectedFile" (archivoChange)="onArchivoChange($event, docTipo)"
                [(link)]="panels[docTipo].linkInput"
                [(nombre)]="panels[docTipo].nombreInput"
                [(categoria)]="panels[docTipo].categoriaInput"
                [categorias]="categorias"
                [archivoInvalido]="archivoDemasiadoGrande(docTipo)"
                [mensajeArchivoInvalido]="mensajeArchivoDemasiadoGrande(docTipo)"
                [linkInvalido]="linkInvalido(docTipo)"
                [confirmDisabled]="panels[docTipo].modoUpload === 'archivo'
                  ? (!panels[docTipo].selectedFile || archivoDemasiadoGrande(docTipo))
                  : (!panels[docTipo].linkInput.trim() || linkInvalido(docTipo))"
                (confirmar)="confirmarSubida(docTipo)"
                (cancelar)="toggleUpload(docTipo)" />
            }
```

Reemplazar por:

```html
              <app-upload-document-form
                style="display:block;margin-bottom:1rem"
                [mostrarAviso]="true"
                [modo]="panels[docTipo].modoUpload" (modoChange)="setModoUpload(docTipo, $event)"
                [archivo]="panels[docTipo].selectedFile" (archivoChange)="onArchivoChange($event, docTipo)"
                [(link)]="panels[docTipo].linkInput"
                [(nombre)]="panels[docTipo].nombreInput"
                [(categoria)]="panels[docTipo].categoriaInput"
                [categorias]="categorias"
                [mostrarCamposArchivo]="false"
                [ocultarBotonConfirmarArchivo]="true"
                [archivoInvalido]="archivoDemasiadoGrande(docTipo)"
                [mensajeArchivoInvalido]="mensajeArchivoDemasiadoGrande(docTipo)"
                [linkInvalido]="linkInvalido(docTipo)"
                [confirmDisabled]="panels[docTipo].modoUpload === 'archivo'
                  ? (!panels[docTipo].selectedFile || archivoDemasiadoGrande(docTipo))
                  : (!panels[docTipo].linkInput.trim() || linkInvalido(docTipo))"
                (confirmar)="confirmarSubida(docTipo)"
                (cancelar)="toggleUpload(docTipo)" />

              @if (tarjetasArchivoSubiendo(docTipo).length > 0) {
                <div style="margin-bottom:1rem">
                  <app-document-card-list
                    [documentos]="tarjetasArchivoSubiendo(docTipo)"
                    [mostrarCategoria]="true"
                    [categorias]="categorias"
                    (categoriaChange)="onCategoriaTarjetaChange($event, docTipo)"
                    (eliminar)="onEliminarTarjeta($event, docTipo)"
                    (reintentar)="reintentarSubida($event)" />
                </div>
              }
            }
```

- [ ] **Step 8: Botón "Subir"/"Terminar"**

Ubicar:

```html
              <button class="btn-primary" style="flex:1;font-size:.8rem;padding:.4rem .5rem;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:.35rem" (click)="toggleUpload(docTipoActual)">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Subir
              </button>
```

Reemplazar por:

```html
              <button class="btn-primary" style="flex:1;font-size:.8rem;padding:.4rem .5rem;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:.35rem" (click)="toggleUpload(docTipoActual)">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {{ panels[docTipoActual].showUpload ? 'Terminar' : 'Subir' }}
              </button>
```

- [ ] **Step 9: Burbuja de subida — solo items de link**

Ubicar:

```html
<app-upload-bubble
  [items]="uploadQueue.items()"
  (cerrar)="cerrarUploadBubble()"
  (reintentar)="reintentarSubida($event)">
</app-upload-bubble>
```

Reemplazar por:

```html
<app-upload-bubble
  [items]="itemsLinkParaBurbuja()"
  (cerrar)="cerrarUploadBubble()"
  (reintentar)="reintentarSubida($event)">
</app-upload-bubble>
```

- [ ] **Step 10: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 11: Correr la suite completa**

Run: `cd front4 && npm test -- --watch=false`
Expected: sin regresiones.

- [ ] **Step 12: Verificar visualmente**

Modo consumidor, `/documentos`, mismo recorrido que en el Step 12 de la Tarea 4 (soltar varios archivos, tarjetas, cambiar tipo, "×", "Terminar", modo link intacto).

- [ ] **Step 13: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html
git commit -m "feat(front4): tarjetas de subida multi-archivo en Documentos (consumidor)"
```

---

## Verificación final

- [ ] `cd front4 && npm test -- --watch=false` — sin regresiones sobre la línea base (80 passed / 1 falla preexistente no relacionada en `app.spec.ts`), más todos los tests nuevos de las Tareas 1-3.
- [ ] `cd front4 && npx tsc --noEmit -p .` — limpio.
- [ ] Recorrido manual completo en admin y consumidor: multi-archivo, tipo auto-detectado y editable, "×" borra según estado, "↻" reintenta un error, botón "Subir"/"Terminar", modo link sin cambios, Activos/Actividades sin cambios visibles (confirmar abriendo sus modales).
