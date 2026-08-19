# Tarjetas de documentos: modales más anchos y grilla en Documentos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensanchar el modal de "Editar activo" (3 tarjetas/fila) y el wizard de actividades (4 tarjetas/fila), y reemplazar las listas de filas de documentos ya subidos del módulo Documentos (admin + consumidor) por una grilla de tarjetas (`app-documento-card`) que se ajusta al ancho disponible.

**Architecture:** Los cambios 1-2 son ajustes de CSS puntuales (no tocan lógica). El cambio 3 introduce un componente presentacional nuevo, `DocumentoCardComponent` (standalone, sin dependencias de servicios), que reemplaza el markup de fila duplicado en 8 vistas de `documentos-admin-page` y 5 de `documentos-consumidor-page`. Cada página sigue iterando su propio array y llamando a sus propios métodos existentes (no se tocan services); solo cambia qué HTML se renderiza por documento.

**Tech Stack:** Angular 21 standalone components, control flow `@if`/`@for`, Vitest para tests de componentes.

## Global Constraints

- Sin `any` en TypeScript nuevo.
- Componentes standalone, sin `NgModule`.
- Angular 18+ control flow (`@if`/`@for`) — nunca `*ngIf`/`*ngFor`.
- No modificar `document-card-list` ni `DocumentoTarjeta` (son de otro dominio: estado de subida en curso).
- No modificar services ni endpoints — solo templates y el componente nuevo.
- `DocumentoCardComponent` vive en `features/documentos/components/` (uso exclusivo de ese feature), no en `shared/`.

---

### Task 1: Ensanchar el modal "Editar activo" (3 tarjetas por fila)

**Files:**
- Modify: `front4/src/app/features/activos/pages/activos-page.component.ts:52`
- Modify: `front4/src/app/features/activos/components/activos-form/activos-form.component.ts:22-27`

**Interfaces:** Ninguna — cambio de CSS puro, no afecta `@Input`/`@Output` de ningún componente.

- [ ] **Step 1: Ensanchar el contenedor del modal**

En `front4/src/app/features/activos/pages/activos-page.component.ts`, dentro del bloque `styles` del componente, la clase `.modal` tiene hoy:

```css
    .modal {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15,23,42,.18);
      width: 100%;
      max-width: 860px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 1.5rem;
    }
```

Cambiar `max-width: 860px;` por `max-width: 960px;`.

- [ ] **Step 2: Dar más ancho a la columna de documentos sin agrandar el formulario**

En `front4/src/app/features/activos/components/activos-form/activos-form.component.ts`, la clase `.form-dos-col` tiene hoy:

```css
    .form-dos-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem 2rem;
    }
```

(el rango exacto de líneas puede variar levemente; ubicarla por el selector `.form-dos-col`). Cambiar `grid-template-columns: 1fr 1fr;` por `grid-template-columns: minmax(300px, 360px) 1fr;` — el formulario (columna izquierda) queda acotado a 300-360px y la columna de documentos (`.col-docs`, derecha) se lleva el resto del ancho ganado en el Step 1.

No tocar la regla de colapso a una columna en viewports angostos (`@media` que cambia a `1fr` bajo 600px) si existe — solo la regla de dos columnas.

- [ ] **Step 3: Verificar visualmente**

Levantar el frontend (`cd front4 && npm start`), ir a `/activos` (modo admin), abrir "Editar" sobre un activo con 4+ documentos adjuntos, y confirmar que caben 3 tarjetas por fila antes de pasar a la segunda línea. Si sobra o falta espacio, ajustar `max-width` del modal en incrementos de 20-40px (no el ancho de las tarjetas, que es fijo en `document-card-list`).

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/activos/pages/activos-page.component.ts front4/src/app/features/activos/components/activos-form/activos-form.component.ts
git commit -m "feat(front4): ensanchar modal de activos para 3 tarjetas de documento por fila"
```

---

### Task 2: Ensanchar el wizard de actividades (4 tarjetas por fila)

**Files:**
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.css:676-682`

**Interfaces:** Ninguna — cambio de CSS puro.

- [ ] **Step 1: Ensanchar `.modal-box--wizard`**

En `front4/src/app/features/actividades/pages/actividades-page.component.css`, la regla es hoy:

```css
.modal-box--wizard {
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 0;
  gap: 0;
}
```

Cambiar `max-width: 560px;` por `max-width: 700px;`. (Cálculo: el contenido interno vive en `.wz-body { padding: 1.25rem 1.5rem; }`, es decir 48px de padding horizontal; 4 tarjetas de 150px + 3 gaps de `.7rem` (11.2px) necesitan ≈634px, más los 48px de padding ≈ 682px — 700px deja un margen pequeño.)

- [ ] **Step 2: Verificar visualmente**

Con el frontend corriendo, ir a `/actividades` (admin), abrir el wizard de crear/editar actividad, ir al paso de documentos con 5+ documentos adjuntos, y confirmar que caben 4 tarjetas por fila. Ajustar `max-width` en incrementos de 20-40px si hace falta.

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/features/actividades/pages/actividades-page.component.css
git commit -m "feat(front4): ensanchar wizard de actividades para 4 tarjetas de documento por fila"
```

---

### Task 3: Crear `DocumentoCardComponent`

**Files:**
- Create: `front4/src/app/features/documentos/components/documento-card/documento-card.component.ts`
- Test: `front4/src/app/features/documentos/components/documento-card/documento-card.component.spec.ts`

**Interfaces:**
- Produces: `DocumentoCardComponent` (selector `app-documento-card`), standalone, con:
  - `@Input() nombre: string`
  - `@Input() categoria: string`
  - `@Input() tipoContenido: 'archivo' | 'link'`
  - `@Input() fechaSubida: string` (ya formateada por el caller, ej. `formatFechaHora(doc.subido_en)`; el componente antepone "Subido: ")
  - `@Input() subidoPor?: string`
  - `@Input() badges: string[]` (chips secundarios ya formateados, ej. `'Centro · Fundo San Rafael'`)
  - `@Input() vencidoEn?: string` (ya formateado; el componente antepone "Vencido: ")
  - `@Input() categorias: string[]` (opciones del menú "Cambiar categoría")
  - `@Input() mostrarCambiarCategoria: boolean` (default `false`)
  - `@Input() mostrarMarcarVencido: boolean` (default `false`)
  - `@Input() mostrarEliminar: boolean` (default `false`)
  - `@Output() abrir: EventEmitter<void>`
  - `@Output() cambiarCategoria: EventEmitter<string>`
  - `@Output() marcarVencido: EventEmitter<void>`
  - `@Output() eliminar: EventEmitter<void>`

- [ ] **Step 1: Escribir el componente**

Crear `front4/src/app/features/documentos/components/documento-card/documento-card.component.ts`:

```ts
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

@Component({
  selector: 'app-documento-card',
  standalone: true,
  styles: [`
    .dc-card {
      position: relative; width: 190px; background: #fff; border: 1px solid #e5e7eb;
      border-radius: 10px; padding: .75rem; box-shadow: 0 1px 3px rgba(0,0,0,.05);
      display: flex; flex-direction: column; gap: .5rem;
    }
    .dc-top { display: flex; align-items: flex-start; gap: .5rem; min-width: 0; }
    .dc-info { min-width: 0; overflow: hidden; flex: 1; }
    .dc-nombre {
      margin: 0; font-size: .78rem; color: #1f2937; line-height: 1.3; font-weight: 500;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; word-break: break-word;
    }
    .dc-chips { display: flex; align-items: center; gap: .3rem; flex-wrap: wrap; margin-top: .3rem; }
    .dc-categoria {
      font-size: .62rem; font-weight: 600; padding: .15rem .45rem; border-radius: 999px;
      background: #e0e7ff; color: #3730a3; white-space: nowrap;
    }
    .dc-link {
      font-size: .6rem; font-weight: 600; padding: .1rem .4rem; border-radius: 999px;
      background: #ecfdf5; color: #047857;
    }
    .dc-meta { display: flex; flex-direction: column; gap: .2rem; margin-top: .3rem; }
    .dc-badge {
      font-size: .6rem; font-weight: 600; padding: .1rem .4rem; border-radius: 999px;
      background: #f1f5f9; color: #475569; align-self: flex-start;
    }
    .dc-badge--vencido { background: #fef2f2; color: #dc2626; }
    .dc-acciones { display: flex; gap: .35rem; padding-top: .5rem; border-top: 1px solid #eef2f5; }
    .dc-btn {
      width: 26px; height: 26px; border-radius: 6px; border: none; background: #eff6ff;
      color: #0095d6; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .dc-btn--danger { background: #fef2f2; color: #dc2626; }
    .dc-btn--menu { background: #eef2ff; color: #4f46e5; }
    .dc-menu-wrap { position: relative; margin-left: auto; }
    .dc-menu-backdrop { position: fixed; inset: 0; z-index: 60; }
    .dc-menu {
      position: absolute; top: 32px; right: 0; background: #fff; border: 1px solid #e5e7eb;
      border-radius: 8px; box-shadow: 0 8px 24px rgba(15,23,42,.14); z-index: 61;
      min-width: 190px; max-height: 240px; overflow-y: auto; padding: .25rem;
    }
    .dc-menu-label { margin: .3rem .5rem; font-size: .68rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; }
    .dc-menu-item { padding: .4rem .65rem; font-size: .8rem; border-radius: 6px; cursor: pointer; color: #374151; }
    .dc-menu-item:hover { background: #f9fafb; }
    .dc-menu-item--activo { font-weight: 700; color: #3730a3; background: #eef2ff; }
    .dc-menu-item--warn { color: #d97706; }
  `],
  template: `
    <div class="dc-card">
      <div class="dc-top">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:.1rem"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <div class="dc-info">
          <p class="dc-nombre" [title]="nombre">{{ nombre }}</p>
          <div class="dc-chips">
            @if (categoria) { <span class="dc-categoria">{{ categoria }}</span> }
            @if (tipoContenido === 'link') { <span class="dc-link">🔗 Link</span> }
          </div>
          @if (badges.length || fechaSubida || subidoPor || vencidoEn) {
            <div class="dc-meta">
              @for (b of badges; track b) { <span class="dc-badge">{{ b }}</span> }
              @if (fechaSubida) { <span class="dc-badge">Subido: {{ fechaSubida }}</span> }
              @if (subidoPor) { <span class="dc-badge">{{ subidoPor }}</span> }
              @if (vencidoEn) { <span class="dc-badge dc-badge--vencido">Vencido: {{ vencidoEn }}</span> }
            </div>
          }
        </div>
      </div>
      <div class="dc-acciones">
        <button type="button" class="dc-btn" [title]="tipoContenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrir.emit()">
          @if (tipoContenido === 'link') {
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          }
        </button>
        @if (mostrarEliminar) {
          <button type="button" class="dc-btn dc-btn--danger" title="Eliminar" (click)="eliminar.emit()">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        }
        @if (mostrarCambiarCategoria || mostrarMarcarVencido) {
          <div class="dc-menu-wrap">
            <button type="button" class="dc-btn dc-btn--menu" title="Más acciones" (click)="menuAbierto.set(!menuAbierto())">⋮</button>
            @if (menuAbierto()) {
              <div class="dc-menu-backdrop" (click)="menuAbierto.set(false)"></div>
              <div class="dc-menu">
                @if (mostrarCambiarCategoria) {
                  <p class="dc-menu-label">Cambiar categoría</p>
                  @for (cat of categorias; track cat) {
                    <div class="dc-menu-item" [class.dc-menu-item--activo]="cat === categoria" (click)="onCambiarCategoria(cat)">{{ cat }}</div>
                  }
                }
                @if (mostrarMarcarVencido) {
                  <div class="dc-menu-item dc-menu-item--warn" (click)="onMarcarVencido()">Marcar vencido</div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class DocumentoCardComponent {
  @Input() nombre = '';
  @Input() categoria = '';
  @Input() tipoContenido: 'archivo' | 'link' = 'archivo';
  @Input() fechaSubida = '';
  @Input() subidoPor?: string;
  @Input() badges: string[] = [];
  @Input() vencidoEn?: string;
  @Input() categorias: string[] = [];
  @Input() mostrarCambiarCategoria = false;
  @Input() mostrarMarcarVencido = false;
  @Input() mostrarEliminar = false;

  @Output() abrir = new EventEmitter<void>();
  @Output() cambiarCategoria = new EventEmitter<string>();
  @Output() marcarVencido = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<void>();

  protected menuAbierto = signal(false);

  onCambiarCategoria(cat: string): void {
    this.menuAbierto.set(false);
    this.cambiarCategoria.emit(cat);
  }

  onMarcarVencido(): void {
    this.menuAbierto.set(false);
    this.marcarVencido.emit();
  }
}
```

- [ ] **Step 2: Escribir los tests**

Crear `front4/src/app/features/documentos/components/documento-card/documento-card.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentoCardComponent } from './documento-card.component';

describe('DocumentoCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DocumentoCardComponent] }).compileComponents();
  });

  it('muestra nombre, categoría y chip de link cuando corresponde', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'contrato.pdf');
    fixture.componentRef.setInput('categoria', 'Contratos');
    fixture.componentRef.setInput('tipoContenido', 'link');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('contrato.pdf');
    expect(el.textContent).toContain('Contratos');
    expect(el.textContent).toContain('Link');
  });

  it('no muestra el chip de categoría cuando está vacía (caso documentos vencidos sin categoría)', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('categoria', '');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dc-categoria')).toBeNull();
  });

  it('renderiza los badges, la fecha de subida y quién subió', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('badges', ['Empresa · AgroSur', 'Centro · Fundo San Rafael']);
    fixture.componentRef.setInput('fechaSubida', '10 ago 2026, 09:00');
    fixture.componentRef.setInput('subidoPor', 'Andrés Root');
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Empresa · AgroSur');
    expect(text).toContain('Centro · Fundo San Rafael');
    expect(text).toContain('Subido: 10 ago 2026, 09:00');
    expect(text).toContain('Andrés Root');
  });

  it('renderiza "Vencido: <fecha>" cuando se pasa vencidoEn', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('vencidoEn', '1 ago 2026');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Vencido: 1 ago 2026');
  });

  it('emite abrir al hacer clic en el botón principal', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.abrir.subscribe(() => { emitido = true; });
    (fixture.nativeElement.querySelector('.dc-btn') as HTMLButtonElement).click();
    expect(emitido).toBe(true);
  });

  it('oculta el botón eliminar cuando mostrarEliminar es false, lo muestra y emite cuando es true', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('mostrarEliminar', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dc-btn--danger')).toBeNull();

    fixture.componentRef.setInput('mostrarEliminar', true);
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.eliminar.subscribe(() => { emitido = true; });
    (fixture.nativeElement.querySelector('.dc-btn--danger') as HTMLButtonElement).click();
    expect(emitido).toBe(true);
  });

  it('sin mostrarCambiarCategoria ni mostrarMarcarVencido, no muestra el botón de menú', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.dc-btn--menu')).toBeNull();
  });

  it('el menú abre con "Cambiar categoría" y emite la categoría elegida', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('categoria', 'Otros');
    fixture.componentRef.setInput('categorias', ['Otros', 'Contratos']);
    fixture.componentRef.setInput('mostrarCambiarCategoria', true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.dc-btn--menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.dc-menu-item');
    expect(items.length).toBe(2);
    let emitido = '';
    fixture.componentInstance.cambiarCategoria.subscribe((c: string) => { emitido = c; });
    (items[1] as HTMLElement).click();
    expect(emitido).toBe('Contratos');
    expect(fixture.nativeElement.querySelector('.dc-menu')).toBeNull();
  });

  it('el menú muestra "Marcar vencido" y lo emite', () => {
    const fixture = TestBed.createComponent(DocumentoCardComponent);
    fixture.componentRef.setInput('nombre', 'x.pdf');
    fixture.componentRef.setInput('mostrarMarcarVencido', true);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.dc-btn--menu') as HTMLButtonElement).click();
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.marcarVencido.subscribe(() => { emitido = true; });
    (fixture.nativeElement.querySelector('.dc-menu-item--warn') as HTMLElement).click();
    expect(emitido).toBe(true);
  });
});
```

- [ ] **Step 3: Correr los tests**

Run: `cd front4 && npx vitest run src/app/features/documentos/components/documento-card/documento-card.component.spec.ts`
Expected: 9 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/documentos/components/documento-card/
git commit -m "feat(front4): agregar DocumentoCardComponent para grilla de documentos"
```

---

### Task 4: Documentos admin — migrar el bloque "Todos" (búsqueda cascada)

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts` (agregar import)
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html:465-542`

**Interfaces:**
- Consumes: `DocumentoCardComponent` de Task 3 — selector `app-documento-card`, inputs/outputs listados ahí.
- Consumes (ya existentes en `documentos-admin-page.component.ts`, no se tocan): `filasTodos()`, `categorias`, `puedeVencer()`, `formatFechaHora`, `abrirDocumento(doc)`, `seleccionarCategoriaTodos(url, categoria)`, `abrirModalVencer(doc, centroIdReal?, proyectoIdReal?, empresaIdReal?, tipoReal?)`, `eliminarEnTodos(url)`.

- [ ] **Step 1: Registrar el componente en la página**

En `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`, agregar el import:

```ts
import { DocumentoCardComponent } from '../components/documento-card/documento-card.component';
```

Y agregarlo al array `imports` del `@Component`:

```ts
imports: [FormsModule, StatusBannerComponent, UploadBubbleComponent, UploadDocumentFormComponent, DocumentoCardComponent],
```

- [ ] **Step 2: Reemplazar el bloque "Todos"**

En `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`, ubicar (dentro de la vista `tabJerarquia() === 'todos'`) el siguiente bloque exacto:

```html
              <div style="border:1px solid #e5e7eb;border-radius:8px">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (fila of filasTodos(); track fila.doc._id + '|' + fila.empresaId + '|' + (fila.centroId || '') + '|' + (fila.proyectoId || '')) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ fila.doc.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ fila.doc.nombre_display }}</span>
                          @if (fila.doc.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa · {{ fila.empresaNombre }}</span>
                          @if (fila.centroId) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro · {{ fila.centroNombre }}</span>
                          }
                          @if (fila.proyectoId) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto · {{ fila.proyectoNombre }}</span>
                          }
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(fila.doc.subido_en) }}</span>
                          @if (fila.doc.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ fila.doc.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.35rem;flex-shrink:0">
                      <button (click)="abrirDocumento(fila.doc)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        @if (fila.doc.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                        {{ fila.doc.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                      </button>
                      <div style="position:relative">
                        <button title="Cambiar categoría" (click)="toggleCategoriaMenu(fila.doc._id)"
                                style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                        </button>
                        @if (categoriaMenuAbierto() === fila.doc._id) {
                          <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                          <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                            @for (cat of categorias; track cat) {
                              <div (click)="seleccionarCategoriaTodos(fila.doc.url, cat)"
                                   style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                   [style.font-weight]="cat === fila.doc.categoria ? '700' : '400'"
                                   [style.color]="cat === fila.doc.categoria ? '#3730a3' : '#374151'"
                                   [style.background]="cat === fila.doc.categoria ? '#eef2ff' : 'transparent'">
                                {{ cat }}
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (puedeVencer()) {
                      <button (click)="abrirModalVencer(fila.doc, fila.centroId, fila.proyectoId, fila.empresaId, fila.tipo)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Marcar vencido
                      </button>
                      }
                      <button (click)="eliminarEnTodos(fila.doc.url)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                }
              </div>
```

Reemplazarlo por:

```html
              <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                @for (fila of filasTodos(); track fila.doc._id + '|' + fila.empresaId + '|' + (fila.centroId || '') + '|' + (fila.proyectoId || '')) {
                  <app-documento-card
                    [nombre]="fila.doc.nombre_display"
                    [categoria]="fila.doc.categoria"
                    [tipoContenido]="fila.doc.tipo_contenido ?? 'archivo'"
                    [fechaSubida]="formatFechaHora(fila.doc.subido_en)"
                    [subidoPor]="fila.doc.subido_por_nombre"
                    [badges]="['Empresa · ' + fila.empresaNombre, fila.centroId ? 'Centro · ' + fila.centroNombre : '', fila.proyectoId ? 'Proyecto · ' + fila.proyectoNombre : ''].filter(b => b)"
                    [categorias]="categorias"
                    [mostrarCambiarCategoria]="true"
                    [mostrarMarcarVencido]="puedeVencer()"
                    [mostrarEliminar]="true"
                    (abrir)="abrirDocumento(fila.doc)"
                    (cambiarCategoria)="seleccionarCategoriaTodos(fila.doc.url, $event)"
                    (marcarVencido)="abrirModalVencer(fila.doc, fila.centroId, fila.proyectoId, fila.empresaId, fila.tipo)"
                    (eliminar)="eliminarEnTodos(fila.doc.url)" />
                }
              </div>
```

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p .` (o `npm run build` si el proyecto no tiene `tsc` directo — usar el comando de build configurado)
Expected: sin errores de tipos ni de template.

- [ ] **Step 4: Verificar visualmente**

`npm start`, ir a `/documentos` (admin) → tab "Todos", confirmar que los documentos se ven como tarjetas (con chip de categoría, chips de empresa/centro/proyecto, fecha, autor) y que Descargar/Abrir enlace, cambiar categoría (menú "⋮"), Marcar vencido y Eliminar siguen funcionando igual que antes.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-admin-page.component.ts front4/src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front4): migrar vista Documentos/Todos (admin) a grilla de tarjetas"
```

---

### Task 5: Documentos admin — migrar bloques de nivel empresa

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html` (dos bloques: `docsFiltrados(docTipo)` y `docsEmpresaTodas()`)

**Interfaces:** Igual que Task 4 (usa el mismo `DocumentoCardComponent`, ya registrado en `imports`). Métodos existentes usados: `docsFiltrados(docTipo)`, `docsEmpresaTodas()`, `centroNombre` (getter), `proyectoNombre` (getter), `seleccionarCategoria(url, categoria, tipo)`, `seleccionarCategoriaTodasEmpresas(url, categoria, tipo)`, `eliminar(url, tipo)`, `eliminarEnTodasEmpresas(url, empresaId)`.

- [ ] **Step 1: Reemplazar el bloque `docsFiltrados(docTipo)`**

Ubicar este bloque exacto (vista específica empresa/centro/proyecto cuando no es "todos"):

```html
              <div style="border:1px solid #e5e7eb;border-radius:8px">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (d of docsFiltrados(docTipo); track d._id) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ d.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ d.nombre_display }}</span>
                          @if (d.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          @if (docTipo === 'empresa') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa</span>
                          } @else if (docTipo === 'centro') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro{{ centroNombre ? ' · ' + centroNombre : '' }}</span>
                          } @else if (docTipo === 'proyecto') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto{{ proyectoNombre ? ' · ' + proyectoNombre : '' }}</span>
                          }
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                          @if (d.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.35rem;flex-shrink:0">
                      <button (click)="abrirDocumento(d)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        @if (d.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                        {{ d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                      </button>
                      <div style="position:relative">
                        <button title="Cambiar categoría" (click)="toggleCategoriaMenu(d._id)"
                                style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                        </button>
                        @if (categoriaMenuAbierto() === d._id) {
                          <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                          <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                            @for (cat of categorias; track cat) {
                              <div (click)="seleccionarCategoria(d.url, cat, docTipo)"
                                   style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                   [style.font-weight]="cat === d.categoria ? '700' : '400'"
                                   [style.color]="cat === d.categoria ? '#3730a3' : '#374151'"
                                   [style.background]="cat === d.categoria ? '#eef2ff' : 'transparent'">
                                {{ cat }}
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (puedeVencer()) {
                      <button (click)="abrirModalVencer(d)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Marcar vencido
                      </button>
                      }
                      <button (click)="eliminar(d.url, docTipo)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                }
              </div>
```

Reemplazarlo por:

```html
              <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                @for (d of docsFiltrados(docTipo); track d._id) {
                  <app-documento-card
                    [nombre]="d.nombre_display"
                    [categoria]="d.categoria"
                    [tipoContenido]="d.tipo_contenido ?? 'archivo'"
                    [fechaSubida]="formatFechaHora(d.subido_en)"
                    [subidoPor]="d.subido_por_nombre"
                    [badges]="[docTipo === 'empresa' ? 'Empresa' : docTipo === 'centro' ? ('Centro' + (centroNombre ? ' · ' + centroNombre : '')) : ('Proyecto' + (proyectoNombre ? ' · ' + proyectoNombre : ''))]"
                    [categorias]="categorias"
                    [mostrarCambiarCategoria]="true"
                    [mostrarMarcarVencido]="puedeVencer()"
                    [mostrarEliminar]="true"
                    (abrir)="abrirDocumento(d)"
                    (cambiarCategoria)="seleccionarCategoria(d.url, $event, docTipo)"
                    (marcarVencido)="abrirModalVencer(d)"
                    (eliminar)="eliminar(d.url, docTipo)" />
                }
              </div>
```

- [ ] **Step 2: Reemplazar el bloque `docsEmpresaTodas()`**

Ubicar este bloque exacto (vista "todas las empresas", nivel empresa):

```html
              <div style="border:1px solid #e5e7eb;border-radius:8px">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (fila of docsEmpresaTodas(); track fila.doc._id) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ fila.doc.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ fila.doc.nombre_display }}</span>
                          @if (fila.doc.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa · {{ fila.empresaNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(fila.doc.subido_en) }}</span>
                          @if (fila.doc.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ fila.doc.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.35rem;flex-shrink:0">
                      <button (click)="abrirDocumento(fila.doc)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        @if (fila.doc.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                        {{ fila.doc.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                      </button>
                      <div style="position:relative">
                        <button title="Cambiar categoría" (click)="toggleCategoriaMenu(fila.doc._id)"
                                style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                        </button>
                        @if (categoriaMenuAbierto() === fila.doc._id) {
                          <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                          <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                            @for (cat of categorias; track cat) {
                              <div (click)="seleccionarCategoriaTodasEmpresas(fila.doc.url, cat, 'empresa')"
                                   style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                   [style.font-weight]="cat === fila.doc.categoria ? '700' : '400'"
                                   [style.color]="cat === fila.doc.categoria ? '#3730a3' : '#374151'"
                                   [style.background]="cat === fila.doc.categoria ? '#eef2ff' : 'transparent'">
                                {{ cat }}
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (puedeVencer()) {
                      <button (click)="abrirModalVencer(fila.doc, undefined, undefined, fila.empresaId, 'empresa')"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Marcar vencido
                      </button>
                      }
                      <button (click)="eliminarEnTodasEmpresas(fila.doc.url, fila.empresaId)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                }
              </div>
```

Reemplazarlo por:

```html
              <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                @for (fila of docsEmpresaTodas(); track fila.doc._id) {
                  <app-documento-card
                    [nombre]="fila.doc.nombre_display"
                    [categoria]="fila.doc.categoria"
                    [tipoContenido]="fila.doc.tipo_contenido ?? 'archivo'"
                    [fechaSubida]="formatFechaHora(fila.doc.subido_en)"
                    [subidoPor]="fila.doc.subido_por_nombre"
                    [badges]="['Empresa · ' + fila.empresaNombre]"
                    [categorias]="categorias"
                    [mostrarCambiarCategoria]="true"
                    [mostrarMarcarVencido]="puedeVencer()"
                    [mostrarEliminar]="true"
                    (abrir)="abrirDocumento(fila.doc)"
                    (cambiarCategoria)="seleccionarCategoriaTodasEmpresas(fila.doc.url, $event, 'empresa')"
                    (marcarVencido)="abrirModalVencer(fila.doc, undefined, undefined, fila.empresaId, 'empresa')"
                    (eliminar)="eliminarEnTodasEmpresas(fila.doc.url, fila.empresaId)" />
                }
              </div>
```

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 4: Verificar visualmente**

`/documentos` (admin) → seleccionar una empresa específica, tab "Empresa", confirmar tarjetas + acciones. Luego cambiar a "Todos los centros"/selector "todos" a nivel empresa (`selectedEmpresaId === 'todos'`) y repetir la verificación.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front4): migrar vistas Documentos/Empresa (admin) a grilla de tarjetas"
```

---

### Task 6: Documentos admin — migrar bloques de nivel centro

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html` (dos bloques: `filteredDocsPorCentro()` y `docsCentroTodas()`)

**Interfaces:** Igual patrón. Métodos usados: `filteredDocsPorCentro()`, `docsCentroTodas()`, `seleccionarCategoria(url, categoria, 'centro')`, `seleccionarCategoriaTodasEmpresas(url, categoria, 'centro')`, `abrirModalVencer(d, item.centroId)` / `abrirModalVencer(fila.doc, fila.centroId, undefined, fila.empresaId, 'centro')`, `eliminarEnTodosCentros(url)`, `eliminarCentroEnTodasEmpresas(url, empresaId, centroId)`.

- [ ] **Step 1: Reemplazar el bloque interno de `filteredDocsPorCentro() → item.docs`**

Este bloque está anidado dentro de `@for (item of filteredDocsPorCentro(); track item.nombre) { <p>{{ item.nombre }}</p> ... }` — **no tocar** el `@for (item of ...)` externo ni el `<p>` con el nombre del centro, solo el `<div style="border:1px solid #e5e7eb;border-radius:8px">...</div>` interno. Ubicar este bloque exacto:

```html
                <div style="border:1px solid #e5e7eb;border-radius:8px">
                  <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                    <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                    <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                  </div>
                  @for (d of item.docs; track d._id) {
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                      <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div style="min-width:0;overflow:hidden">
                          <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                            <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ d.categoria }}</span>
                            <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ d.nombre_display }}</span>
                            @if (d.tipo_contenido === 'link') {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                            }
                          </div>
                          <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro · {{ item.nombre }}</span>
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                            @if (d.subido_por_nombre) {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
                            }
                          </div>
                        </div>
                      </div>
                      <div style="display:flex;gap:.3rem;flex-shrink:0">
                        <button (click)="abrirDocumento(d)"
                                style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                          @if (d.tipo_contenido === 'link') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          }
                          {{ d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                        </button>
                        <div style="position:relative">
                          <button title="Cambiar categoría" (click)="toggleCategoriaMenu(d._id)"
                                  style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                          </button>
                          @if (categoriaMenuAbierto() === d._id) {
                            <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                            <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                              @for (cat of categorias; track cat) {
                                <div (click)="seleccionarCategoria(d.url, cat, 'centro')"
                                     style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                     [style.font-weight]="cat === d.categoria ? '700' : '400'"
                                     [style.color]="cat === d.categoria ? '#3730a3' : '#374151'"
                                     [style.background]="cat === d.categoria ? '#eef2ff' : 'transparent'">
                                  {{ cat }}
                                </div>
                              }
                            </div>
                          }
                        </div>
                        @if (puedeVencer()) {
                        <button (click)="abrirModalVencer(d, item.centroId)"
                                style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Marcar vencido
                        </button>
                        }
                        <button (click)="eliminarEnTodosCentros(d.url)"
                                style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  }
                </div>
```

Reemplazarlo por:

```html
                <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                  @for (d of item.docs; track d._id) {
                    <app-documento-card
                      [nombre]="d.nombre_display"
                      [categoria]="d.categoria"
                      [tipoContenido]="d.tipo_contenido ?? 'archivo'"
                      [fechaSubida]="formatFechaHora(d.subido_en)"
                      [subidoPor]="d.subido_por_nombre"
                      [badges]="['Centro · ' + item.nombre]"
                      [categorias]="categorias"
                      [mostrarCambiarCategoria]="true"
                      [mostrarMarcarVencido]="puedeVencer()"
                      [mostrarEliminar]="true"
                      (abrir)="abrirDocumento(d)"
                      (cambiarCategoria)="seleccionarCategoria(d.url, $event, 'centro')"
                      (marcarVencido)="abrirModalVencer(d, item.centroId)"
                      (eliminar)="eliminarEnTodosCentros(d.url)" />
                  }
                </div>
```

- [ ] **Step 2: Reemplazar el bloque `docsCentroTodas()`**

Ubicar este bloque exacto:

```html
              <div style="border:1px solid #e5e7eb;border-radius:8px">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (fila of docsCentroTodas(); track fila.doc._id) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ fila.doc.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ fila.doc.nombre_display }}</span>
                          @if (fila.doc.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa · {{ fila.empresaNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro · {{ fila.centroNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(fila.doc.subido_en) }}</span>
                          @if (fila.doc.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ fila.doc.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.3rem;flex-shrink:0">
                      <button (click)="abrirDocumento(fila.doc)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        @if (fila.doc.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                        {{ fila.doc.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                      </button>
                      <div style="position:relative">
                        <button title="Cambiar categoría" (click)="toggleCategoriaMenu(fila.doc._id)"
                                style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                        </button>
                        @if (categoriaMenuAbierto() === fila.doc._id) {
                          <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                          <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                            @for (cat of categorias; track cat) {
                              <div (click)="seleccionarCategoriaTodasEmpresas(fila.doc.url, cat, 'centro')"
                                   style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                   [style.font-weight]="cat === fila.doc.categoria ? '700' : '400'"
                                   [style.color]="cat === fila.doc.categoria ? '#3730a3' : '#374151'"
                                   [style.background]="cat === fila.doc.categoria ? '#eef2ff' : 'transparent'">
                                {{ cat }}
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (puedeVencer()) {
                      <button (click)="abrirModalVencer(fila.doc, fila.centroId, undefined, fila.empresaId, 'centro')"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Marcar vencido
                      </button>
                      }
                      <button (click)="eliminarCentroEnTodasEmpresas(fila.doc.url, fila.empresaId, fila.centroId)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                }
              </div>
```

Reemplazarlo por:

```html
              <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                @for (fila of docsCentroTodas(); track fila.doc._id) {
                  <app-documento-card
                    [nombre]="fila.doc.nombre_display"
                    [categoria]="fila.doc.categoria"
                    [tipoContenido]="fila.doc.tipo_contenido ?? 'archivo'"
                    [fechaSubida]="formatFechaHora(fila.doc.subido_en)"
                    [subidoPor]="fila.doc.subido_por_nombre"
                    [badges]="['Empresa · ' + fila.empresaNombre, 'Centro · ' + fila.centroNombre]"
                    [categorias]="categorias"
                    [mostrarCambiarCategoria]="true"
                    [mostrarMarcarVencido]="puedeVencer()"
                    [mostrarEliminar]="true"
                    (abrir)="abrirDocumento(fila.doc)"
                    (cambiarCategoria)="seleccionarCategoriaTodasEmpresas(fila.doc.url, $event, 'centro')"
                    (marcarVencido)="abrirModalVencer(fila.doc, fila.centroId, undefined, fila.empresaId, 'centro')"
                    (eliminar)="eliminarCentroEnTodasEmpresas(fila.doc.url, fila.empresaId, fila.centroId)" />
                }
              </div>
```

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 4: Verificar visualmente**

`/documentos` (admin) → tab "Centro de costos", con una empresa seleccionada y con "Todos los centros" (`selectedEmpresaId === 'todos'`), confirmar tarjetas + acciones en ambas variantes.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front4): migrar vistas Documentos/Centro (admin) a grilla de tarjetas"
```

---

### Task 7: Documentos admin — migrar bloques de nivel proyecto

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html` (dos bloques: `filteredDocsPorProyecto()` y `docsProyectoTodas()`)

**Interfaces:** Igual patrón. Métodos usados: `filteredDocsPorProyecto()`, `docsProyectoTodas()`, `seleccionarCategoria(url, categoria, 'proyecto')`, `seleccionarCategoriaTodasEmpresas(url, categoria, 'proyecto')`, `abrirModalVencer(d, undefined, item.proyectoId)` / `abrirModalVencer(fila.doc, fila.centroId, fila.proyectoId, fila.empresaId, 'proyecto')`, `eliminarEnTodosProyectos(url)`, `eliminarProyectoEnTodasEmpresas(url, empresaId, centroId, proyectoId)`.

- [ ] **Step 1: Reemplazar el bloque interno de `filteredDocsPorProyecto() → item.docs`**

Igual que en Task 6: está anidado dentro de `@for (item of filteredDocsPorProyecto(); track item.nombre) { <p>{{item.nombre}}</p> @if (item.centroNombres) {<p>Centro: ...</p>} ... }` — no tocar el `@for (item of ...)` externo ni los `<p>` de encabezado, solo el `<div style="border:1px solid #e5e7eb;border-radius:8px">...</div>` interno. Ubicar este bloque exacto:

```html
                <div style="border:1px solid #e5e7eb;border-radius:8px">
                  <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                    <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                    <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                  </div>
                  @for (d of item.docs; track d._id) {
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                      <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div style="min-width:0;overflow:hidden">
                          <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                            <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ d.categoria }}</span>
                            <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ d.nombre_display }}</span>
                            @if (d.tipo_contenido === 'link') {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                            }
                          </div>
                          <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto · {{ item.nombre }}</span>
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                            @if (d.subido_por_nombre) {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
                            }
                          </div>
                        </div>
                      </div>
                      <div style="display:flex;gap:.3rem;flex-shrink:0">
                        <button (click)="abrirDocumento(d)"
                                style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                          @if (d.tipo_contenido === 'link') {
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                          } @else {
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          }
                          {{ d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                        </button>
                        <div style="position:relative">
                          <button title="Cambiar categoría" (click)="toggleCategoriaMenu(d._id)"
                                  style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                          </button>
                          @if (categoriaMenuAbierto() === d._id) {
                            <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                            <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                              @for (cat of categorias; track cat) {
                                <div (click)="seleccionarCategoria(d.url, cat, 'proyecto')"
                                     style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                     [style.font-weight]="cat === d.categoria ? '700' : '400'"
                                     [style.color]="cat === d.categoria ? '#3730a3' : '#374151'"
                                     [style.background]="cat === d.categoria ? '#eef2ff' : 'transparent'">
                                  {{ cat }}
                                </div>
                              }
                            </div>
                          }
                        </div>
                        @if (puedeVencer()) {
                        <button (click)="abrirModalVencer(d, undefined, item.proyectoId)"
                                style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          Marcar vencido
                        </button>
                        }
                        <button (click)="eliminarEnTodosProyectos(d.url)"
                                style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  }
                </div>
```

Reemplazarlo por:

```html
                <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                  @for (d of item.docs; track d._id) {
                    <app-documento-card
                      [nombre]="d.nombre_display"
                      [categoria]="d.categoria"
                      [tipoContenido]="d.tipo_contenido ?? 'archivo'"
                      [fechaSubida]="formatFechaHora(d.subido_en)"
                      [subidoPor]="d.subido_por_nombre"
                      [badges]="['Proyecto · ' + item.nombre]"
                      [categorias]="categorias"
                      [mostrarCambiarCategoria]="true"
                      [mostrarMarcarVencido]="puedeVencer()"
                      [mostrarEliminar]="true"
                      (abrir)="abrirDocumento(d)"
                      (cambiarCategoria)="seleccionarCategoria(d.url, $event, 'proyecto')"
                      (marcarVencido)="abrirModalVencer(d, undefined, item.proyectoId)"
                      (eliminar)="eliminarEnTodosProyectos(d.url)" />
                  }
                </div>
```

- [ ] **Step 2: Reemplazar el bloque `docsProyectoTodas()`**

Ubicar este bloque exacto:

```html
              <div style="border:1px solid #e5e7eb;border-radius:8px">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;border-top-left-radius:8px;border-top-right-radius:8px">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (fila of docsProyectoTodas(); track fila.doc._id) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ fila.doc.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ fila.doc.nombre_display }}</span>
                          @if (fila.doc.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa · {{ fila.empresaNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro · {{ fila.centroNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto · {{ fila.proyectoNombre }}</span>
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(fila.doc.subido_en) }}</span>
                          @if (fila.doc.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ fila.doc.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.3rem;flex-shrink:0">
                      <button (click)="abrirDocumento(fila.doc)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        @if (fila.doc.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                        {{ fila.doc.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar' }}
                      </button>
                      <div style="position:relative">
                        <button title="Cambiar categoría" (click)="toggleCategoriaMenu(fila.doc._id)"
                                style="width:32px;height:32px;border-radius:7px;border:none;background:#eef2ff;color:#4f46e5;cursor:pointer;display:flex;align-items:center;justify-content:center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m20.59 13.41-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/></svg>
                        </button>
                        @if (categoriaMenuAbierto() === fila.doc._id) {
                          <div style="position:fixed;inset:0;z-index:60" (click)="categoriaMenuAbierto.set(null)"></div>
                          <div style="position:absolute;top:36px;right:0;background:#fff;border:1px solid #e5e7eb;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:61;min-width:190px;max-height:240px;overflow-y:auto;padding:.25rem">
                            @for (cat of categorias; track cat) {
                              <div (click)="seleccionarCategoriaTodasEmpresas(fila.doc.url, cat, 'proyecto')"
                                   style="padding:.4rem .65rem;font-size:.8rem;border-radius:6px;cursor:pointer"
                                   [style.font-weight]="cat === fila.doc.categoria ? '700' : '400'"
                                   [style.color]="cat === fila.doc.categoria ? '#3730a3' : '#374151'"
                                   [style.background]="cat === fila.doc.categoria ? '#eef2ff' : 'transparent'">
                                {{ cat }}
                              </div>
                            }
                          </div>
                        }
                      </div>
                      @if (puedeVencer()) {
                      <button (click)="abrirModalVencer(fila.doc, fila.centroId, fila.proyectoId, fila.empresaId, 'proyecto')"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fffbeb;color:#d97706;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Marcar vencido
                      </button>
                      }
                      <button (click)="eliminarProyectoEnTodasEmpresas(fila.doc.url, fila.empresaId, fila.centroId, fila.proyectoId)"
                              style="padding:.35rem .65rem;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;font-size:.72rem;font-weight:600;white-space:nowrap">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Eliminar
                      </button>
                    </div>
                  </div>
                }
              </div>
```

Reemplazarlo por:

```html
              <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                @for (fila of docsProyectoTodas(); track fila.doc._id) {
                  <app-documento-card
                    [nombre]="fila.doc.nombre_display"
                    [categoria]="fila.doc.categoria"
                    [tipoContenido]="fila.doc.tipo_contenido ?? 'archivo'"
                    [fechaSubida]="formatFechaHora(fila.doc.subido_en)"
                    [subidoPor]="fila.doc.subido_por_nombre"
                    [badges]="['Empresa · ' + fila.empresaNombre, 'Centro · ' + fila.centroNombre, 'Proyecto · ' + fila.proyectoNombre]"
                    [categorias]="categorias"
                    [mostrarCambiarCategoria]="true"
                    [mostrarMarcarVencido]="puedeVencer()"
                    [mostrarEliminar]="true"
                    (abrir)="abrirDocumento(fila.doc)"
                    (cambiarCategoria)="seleccionarCategoriaTodasEmpresas(fila.doc.url, $event, 'proyecto')"
                    (marcarVencido)="abrirModalVencer(fila.doc, fila.centroId, fila.proyectoId, fila.empresaId, 'proyecto')"
                    (eliminar)="eliminarProyectoEnTodasEmpresas(fila.doc.url, fila.empresaId, fila.centroId, fila.proyectoId)" />
                }
              </div>
```

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 4: Verificar visualmente**

`/documentos` (admin) → tab "Proyectos", con una empresa seleccionada y con "Todos los proyectos" (`selectedEmpresaId === 'todos'`), confirmar tarjetas + acciones en ambas variantes.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front4): migrar vistas Documentos/Proyecto (admin) a grilla de tarjetas"
```

---

### Task 8: Documentos admin — migrar el bloque de vencidos

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html:1086-1136`

**Interfaces:** Usa `service.documentosVencidos()`, `formatFechaHora`, `abrirDocumento`. Este bloque no tiene ni cambiar categoría, ni marcar vencido, ni eliminar (es la lista de ya vencidos, solo lectura + acceso al archivo).

- [ ] **Step 1: Reemplazar el bloque**

Ubicar este bloque exacto (dentro de `@if (tabDocAdmin() === 'vencidos') { ... @if (service.documentosVencidos().length === 0) { ... } @else { ... } }` — **no tocar** el mensaje "Mostrando los últimos 20..." ni las condiciones que envuelven el bloque, solo lo siguiente):

```html
              <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                <div style="display:grid;grid-template-columns:1fr auto auto;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;gap:1rem">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Fechas</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (v of service.documentosVencidos(); track v._id) {
                  <div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6;gap:1rem">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          @if (v.categoria) {
                            <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ v.categoria }}</span>
                          }
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ v.nombre_display }}</span>
                          @if (v.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem">
                          @if (v.origen_tipo === 'empresa') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa{{ v.empresa_nombre ? ' · ' + v.empresa_nombre : '' }}</span>
                          } @else if (v.origen_tipo === 'centro') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro{{ v.centro_nombre ? ' · ' + v.centro_nombre : '' }}</span>
                          } @else if (v.origen_tipo === 'proyecto') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto{{ v.proyecto_nombre ? ' · ' + v.proyecto_nombre : '' }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:.15rem;flex-shrink:0;text-align:right">
                      @if (v.subido_en) {
                        <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569;align-self:flex-end">Subido: {{ formatFechaHora(v.subido_en) }}</span>
                      }
                      @if (v.subido_por_nombre) {
                        <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e;align-self:flex-end">{{ v.subido_por_nombre }}</span>
                      }
                      <span style="font-size:.72rem;color:#dc2626;font-weight:600">Vencido: {{ formatFechaHora(v.vencido_en) }}</span>
                    </div>
                    <button [title]="v.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(v)"
                            style="width:32px;height:32px;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                      @if (v.tipo_contenido === 'link') {
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      } @else {
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      }
                    </button>
                  </div>
                }
              </div>
```

Reemplazarlo por:

```html
              <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                @for (v of service.documentosVencidos(); track v._id) {
                  <app-documento-card
                    [nombre]="v.nombre_display"
                    [categoria]="v.categoria ?? ''"
                    [tipoContenido]="v.tipo_contenido ?? 'archivo'"
                    [fechaSubida]="v.subido_en ? formatFechaHora(v.subido_en) : ''"
                    [subidoPor]="v.subido_por_nombre"
                    [vencidoEn]="formatFechaHora(v.vencido_en)"
                    [badges]="[
                      v.origen_tipo === 'empresa' ? ('Empresa' + (v.empresa_nombre ? ' · ' + v.empresa_nombre : '')) :
                      v.origen_tipo === 'centro' ? ('Centro' + (v.centro_nombre ? ' · ' + v.centro_nombre : '')) :
                      v.origen_tipo === 'proyecto' ? ('Proyecto' + (v.proyecto_nombre ? ' · ' + v.proyecto_nombre : '')) : ''
                    ].filter(b => b)"
                    (abrir)="abrirDocumento(v)" />
                }
              </div>
```

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 3: Verificar visualmente**

`/documentos` (admin) → tab "Vencidos" con una empresa seleccionada y documentos vencidos existentes, confirmar tarjetas con "Vencido: fecha" y que Descargar/Abrir enlace funciona.

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front4): migrar vista Documentos/Vencidos (admin) a grilla de tarjetas"
```

---

### Task 9: Documentos consumidor — migrar bloques "Todos" y por-tipo

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts` (agregar import)
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html` (dos bloques: `filasTodos()` y `docsFiltrados(docTipo)`)

**Interfaces:**
- Consumes: `DocumentoCardComponent` (Task 3).
- Consumes (ya existentes en `documentos-consumidor-page.component.ts`): `filasTodos()`, `docsFiltrados(docTipo)`, `formatFechaHora`, `abrirDocumento(doc)`, `eliminarEnTodos(url)`, `eliminar(url, docTipo)`, `centroNombreC` (getter), `proyectoNombreC` (getter). El consumidor **no** tiene cambiar categoría ni marcar vencido — `mostrarCambiarCategoria`/`mostrarMarcarVencido` quedan en su default `false` (no se bindean).

- [ ] **Step 1: Registrar el componente en la página**

En `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts`, agregar el import:

```ts
import { DocumentoCardComponent } from '../components/documento-card/documento-card.component';
```

Y agregarlo al array `imports`:

```ts
imports: [NgTemplateOutlet, FormsModule, StatusBannerComponent, UploadBubbleComponent, UploadDocumentFormComponent, DocumentoCardComponent],
```

- [ ] **Step 2: Reemplazar el bloque `filasTodos()`**

Ubicar este bloque exacto:

```html
              <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (fila of filasTodos(); track fila.doc._id) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ fila.doc.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ fila.doc.nombre_display }}</span>
                          @if (fila.doc.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          @if (fila.centroId) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro · {{ fila.centroNombre }}</span>
                          }
                          @if (fila.proyectoId) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto · {{ fila.proyectoNombre }}</span>
                          }
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(fila.doc.subido_en) }}</span>
                          @if (fila.doc.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ fila.doc.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.35rem;flex-shrink:0">
                      <button [title]="fila.doc.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(fila.doc)"
                              style="width:32px;height:32px;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:flex;align-items:center;justify-content:center">
                        @if (fila.doc.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                      </button>
                      <button title="Eliminar" (click)="eliminarEnTodos(fila.doc.url)"
                              style="width:32px;height:32px;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:flex;align-items:center;justify-content:center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                }
              </div>
```

Reemplazarlo por:

```html
              <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                @for (fila of filasTodos(); track fila.doc._id) {
                  <app-documento-card
                    [nombre]="fila.doc.nombre_display"
                    [categoria]="fila.doc.categoria"
                    [tipoContenido]="fila.doc.tipo_contenido ?? 'archivo'"
                    [fechaSubida]="formatFechaHora(fila.doc.subido_en)"
                    [subidoPor]="fila.doc.subido_por_nombre"
                    [badges]="[fila.centroId ? 'Centro · ' + fila.centroNombre : '', fila.proyectoId ? 'Proyecto · ' + fila.proyectoNombre : ''].filter(b => b)"
                    [mostrarEliminar]="true"
                    (abrir)="abrirDocumento(fila.doc)"
                    (eliminar)="eliminarEnTodos(fila.doc.url)" />
                }
              </div>
```

- [ ] **Step 3: Reemplazar el bloque `docsFiltrados(docTipo)`**

Ubicar este bloque exacto (dentro de `@if (puedeGestionarDocumento) { ... }`):

```html
              <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (d of docsFiltrados(docTipo); track d._id) {
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ d.categoria }}</span>
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ d.nombre_display }}</span>
                          @if (d.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                          @if (docTipo === 'empresa') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa</span>
                          } @else if (docTipo === 'centro') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro{{ centroNombreC ? ' · ' + centroNombreC : '' }}</span>
                          } @else if (docTipo === 'proyecto') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto{{ proyectoNombreC ? ' · ' + proyectoNombreC : '' }}</span>
                          }
                          <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                          @if (d.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.35rem;flex-shrink:0">
                      <button [title]="d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(d)"
                              style="width:32px;height:32px;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:flex;align-items:center;justify-content:center">
                        @if (d.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                      </button>
<button title="Eliminar" (click)="eliminar(d.url, docTipo)"
                              style="width:32px;height:32px;border-radius:7px;border:none;background:#fef2f2;color:#dc2626;cursor:pointer;display:flex;align-items:center;justify-content:center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                      </button>
                    </div>
                  </div>
                }
              </div>
```

Reemplazarlo por:

```html
              <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                @for (d of docsFiltrados(docTipo); track d._id) {
                  <app-documento-card
                    [nombre]="d.nombre_display"
                    [categoria]="d.categoria"
                    [tipoContenido]="d.tipo_contenido ?? 'archivo'"
                    [fechaSubida]="formatFechaHora(d.subido_en)"
                    [subidoPor]="d.subido_por_nombre"
                    [badges]="[docTipo === 'empresa' ? 'Empresa' : docTipo === 'centro' ? ('Centro' + (centroNombreC ? ' · ' + centroNombreC : '')) : ('Proyecto' + (proyectoNombreC ? ' · ' + proyectoNombreC : ''))]"
                    [mostrarEliminar]="true"
                    (abrir)="abrirDocumento(d)"
                    (eliminar)="eliminar(d.url, docTipo)" />
                }
              </div>
```

- [ ] **Step 4: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 5: Verificar visualmente**

Cambiar a modo consumidor (o iniciar sesión como `usuario`), ir a `/documentos` → tab "Todos" y tab por tipo (Empresa/Centro/Proyecto), confirmar tarjetas + Descargar/Abrir enlace + Eliminar (cuando `puedeGestionarDocumento` es true para ese usuario).

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html
git commit -m "feat(front4): migrar vistas Documentos/Todos y por-tipo (consumidor) a grilla de tarjetas"
```

---

### Task 10: Documentos consumidor — migrar bloques de centro, proyecto y vencidos

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html` (tres bloques: `filteredDocsPorCentro()`, `filteredDocsPorProyecto()`, `documentosVencidos()`)

**Interfaces:** Igual patrón, sin acciones de escritura (solo `abrir`) en los tres bloques.

- [ ] **Step 1: Reemplazar el bloque interno de `filteredDocsPorCentro() → item.docs`**

Anidado dentro de `@for (item of filteredDocsPorCentro(); track item.nombre) { <p>{{item.nombre}}</p> ... }` — no tocar el `@for` externo ni el `<p>`. Ubicar este bloque exacto:

```html
                <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                  <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb">
                    <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                    <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                  </div>
                  @for (d of item.docs; track d._id) {
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                      <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div style="min-width:0;overflow:hidden">
                          <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                            <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ d.categoria }}</span>
                            <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ d.nombre_display }}</span>
                            @if (d.tipo_contenido === 'link') {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                            }
                          </div>
                          <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro · {{ item.nombre }}</span>
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                            @if (d.subido_por_nombre) {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
                            }
                          </div>
                        </div>
                      </div>
                      <button [title]="d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(d)"
                              style="width:32px;height:32px;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        @if (d.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                      </button>
                    </div>
                  }
                </div>
```

Reemplazarlo por:

```html
                <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                  @for (d of item.docs; track d._id) {
                    <app-documento-card
                      [nombre]="d.nombre_display"
                      [categoria]="d.categoria"
                      [tipoContenido]="d.tipo_contenido ?? 'archivo'"
                      [fechaSubida]="formatFechaHora(d.subido_en)"
                      [subidoPor]="d.subido_por_nombre"
                      [badges]="['Centro · ' + item.nombre]"
                      (abrir)="abrirDocumento(d)" />
                  }
                </div>
```

- [ ] **Step 2: Reemplazar el bloque interno de `filteredDocsPorProyecto() → item.docs`**

Anidado dentro de `@for (item of filteredDocsPorProyecto(); track item.nombre) { <p>{{item.nombre}}</p> @if (item.centroNombres) {<p>Centro: ...</p>} ... }` — no tocar el `@for` externo ni los `<p>`. Ubicar este bloque exacto:

```html
                <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                  <div style="display:flex;justify-content:space-between;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb">
                    <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                    <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                  </div>
                  @for (d of item.docs; track d._id) {
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6">
                      <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <div style="min-width:0;overflow:hidden">
                          <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                            <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ d.categoria }}</span>
                            <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ d.nombre_display }}</span>
                            @if (d.tipo_contenido === 'link') {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                            }
                          </div>
                          <div style="margin-top:.2rem;display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto · {{ item.nombre }}</span>
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                            @if (d.subido_por_nombre) {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
                            }
                          </div>
                        </div>
                      </div>
                      <button [title]="d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(d)"
                              style="width:32px;height:32px;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                        @if (d.tipo_contenido === 'link') {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        } @else {
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                      </button>
                    </div>
                  }
                </div>
```

Reemplazarlo por:

```html
                <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                  @for (d of item.docs; track d._id) {
                    <app-documento-card
                      [nombre]="d.nombre_display"
                      [categoria]="d.categoria"
                      [tipoContenido]="d.tipo_contenido ?? 'archivo'"
                      [fechaSubida]="formatFechaHora(d.subido_en)"
                      [subidoPor]="d.subido_por_nombre"
                      [badges]="['Proyecto · ' + item.nombre]"
                      (abrir)="abrirDocumento(d)" />
                  }
                </div>
```

- [ ] **Step 3: Reemplazar el bloque de vencidos**

Ubicar este bloque exacto (dentro de `@if (tabDocConsumidor() === 'vencidos') { ... @else { ... } }`):

```html
              <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
                <div style="display:grid;grid-template-columns:1fr auto auto;padding:.5rem 1rem;background:#f9fafb;border-bottom:1px solid #e5e7eb;gap:1rem">
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Documento</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Fechas</span>
                  <span style="font-size:.7rem;font-weight:700;color:#9ca3af;letter-spacing:.07em;text-transform:uppercase">Acciones</span>
                </div>
                @for (v of service.documentosVencidos(); track v._id) {
                  <div style="display:grid;grid-template-columns:1fr auto auto;align-items:center;padding:.6rem 1rem;border-bottom:1px solid #f3f4f6;gap:1rem">
                    <div style="display:flex;align-items:center;gap:.6rem;min-width:0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <div style="min-width:0;overflow:hidden">
                        <div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
                          @if (v.categoria) {
                            <span style="font-size:.7rem;font-weight:600;padding:.2rem .55rem;border-radius:999px;background:#e0e7ff;color:#3730a3;white-space:nowrap;flex-shrink:0">{{ v.categoria }}</span>
                          }
                          <span style="font-size:.875rem;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ v.nombre_display }}</span>
                          @if (v.tipo_contenido === 'link') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#ecfdf5;color:#047857;flex-shrink:0">🔗 Link</span>
                          }
                        </div>
                        <div style="margin-top:.2rem">
                          @if (v.origen_tipo === 'empresa') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(0,149,214,.1);color:#0095d6">Empresa</span>
                          } @else if (v.origen_tipo === 'centro') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(16,185,129,.1);color:#059669">Centro{{ v.centro_nombre ? ' · ' + v.centro_nombre : '' }}</span>
                          } @else if (v.origen_tipo === 'proyecto') {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:rgba(245,158,11,.1);color:#d97706">Proyecto{{ v.proyecto_nombre ? ' · ' + v.proyecto_nombre : '' }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:.15rem;flex-shrink:0;text-align:right">
                      @if (v.subido_en) {
                        <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f1f5f9;color:#475569;align-self:flex-end">Subido: {{ formatFechaHora(v.subido_en) }}</span>
                      }
                      @if (v.subido_por_nombre) {
                        <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e;align-self:flex-end">{{ v.subido_por_nombre }}</span>
                      }
                      <span style="font-size:.72rem;color:#dc2626;font-weight:600">Vencido: {{ formatFechaHora(v.vencido_en) }}</span>
                    </div>
                    <button [title]="v.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(v)"
                            style="width:32px;height:32px;border-radius:7px;border:none;background:#eff6ff;color:#0095d6;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                      @if (v.tipo_contenido === 'link') {
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      } @else {
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      }
                    </button>
                  </div>
                }
              </div>
```

Reemplazarlo por:

```html
              <div style="display:flex;flex-wrap:wrap;gap:.7rem">
                @for (v of service.documentosVencidos(); track v._id) {
                  <app-documento-card
                    [nombre]="v.nombre_display"
                    [categoria]="v.categoria ?? ''"
                    [tipoContenido]="v.tipo_contenido ?? 'archivo'"
                    [fechaSubida]="v.subido_en ? formatFechaHora(v.subido_en) : ''"
                    [subidoPor]="v.subido_por_nombre"
                    [vencidoEn]="formatFechaHora(v.vencido_en)"
                    [badges]="[
                      v.origen_tipo === 'empresa' ? 'Empresa' :
                      v.origen_tipo === 'centro' ? ('Centro' + (v.centro_nombre ? ' · ' + v.centro_nombre : '')) :
                      v.origen_tipo === 'proyecto' ? ('Proyecto' + (v.proyecto_nombre ? ' · ' + v.proyecto_nombre : '')) : ''
                    ].filter(b => b)"
                    (abrir)="abrirDocumento(v)" />
                }
              </div>
```

- [ ] **Step 4: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p .`
Expected: sin errores.

- [ ] **Step 5: Verificar visualmente**

Modo consumidor, `/documentos` → tab "Centro de costos" con "Todos los centros", tab "Proyectos" con "Todos los proyectos", y tab "Vencidos". Confirmar tarjetas de solo lectura (sin botón eliminar) y que Descargar/Abrir enlace funciona en los tres.

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html
git commit -m "feat(front4): migrar vistas Documentos/Centro, Proyecto y Vencidos (consumidor) a grilla de tarjetas"
```

---

## Verificación final

- [ ] Correr toda la suite de frontend: `cd front4 && npm test` — debe pasar sin regresiones (incluye los tests nuevos de `DocumentoCardComponent`).
- [ ] Correr `cd front4 && npx tsc --noEmit -p .` una vez más sobre el árbol completo, sin errores.
- [ ] Recorrido manual en navegador cubriendo las 13 vistas migradas (8 admin + 5 consumidor) más los dos modales ensanchados, confirmando que ninguna acción (Descargar, Abrir enlace, Cambiar categoría, Marcar vencido, Eliminar) se perdió.
