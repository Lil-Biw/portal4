# Orden por nivel en tab "Todos" de Documentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side sort-order selector (4 chips: Alfabético / Nivel empresa / Nivel centro / Nivel proyecto) to the "Todos" tab of Documentos (admin), so results can be grouped by hierarchy level instead of only alphabetically.

**Architecture:** A pure, exported comparator function (`ordenarFilasTodos`) replaces the fixed `.sort()` call inside the existing `filasTodos` computed in `documentos-admin-page.component.ts`. A new signal (`ordenTodos`) holds the active mode and is read by that computed. Four new chip buttons in the template call `ordenTodos.set(...)` directly, following the same pattern the file already uses for `tabDocAdmin.set('activos')`.

**Tech Stack:** Angular 21 standalone component, signals, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Sort is 100% client-side over the already-fetched `filasTodos` — no new HTTP calls, no changes to `DocumentosService.buscarCascada`.
- Default mode on load is `'alfabetico'`, matching current behavior exactly (spec: `docs/superpowers/specs/2026-07-22-orden-nivel-documentos-todos-design.md`).
- Group order per mode (spec, section "Requisitos"):
  - `nivel_empresa`: `empresa → centro → proyecto`
  - `nivel_centro`: `centro → proyecto → empresa`
  - `nivel_proyecto`: `proyecto → empresa → centro`
- Secondary sort within every group (all 3 "nivel X" modes) is always the same fixed chain: `empresaNombre → centroNombre → proyectoNombre → doc.nombre_display`, using the existing `collatorNombre` (`Intl.Collator('es', { sensitivity: 'base', numeric: true })`).
- No persistence (no localStorage, no query params) — resets to `'alfabetico'` on every page load, same as the other filters in this view.
- No `any` types (per `front4/CLAUDE.md`).

---

### Task 1: Extract `ordenarFilasTodos` as a pure, tested function

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts:29-42` (interface block) and `:413` (sort call inside `filasTodos` computed)
- Create: `front4/src/app/features/documentos/pages/documentos-admin-page.sort.spec.ts`

**Interfaces:**
- Consumes: `DocBusquedaItem` (from `../documentos.service`, already imported at line 4), `DocTipo` (same import).
- Produces (exported from `documentos-admin-page.component.ts`, consumed by Task 2 and by the test file):
  - `export interface FilaDocTodos { tipo: DocTipo; empresaId: string; empresaNombre: string; centroId?: string; centroNombre?: string; proyectoId?: string; proyectoNombre?: string; doc: DocBusquedaItem; }`
  - `export type OrdenTodos = 'alfabetico' | 'nivel_empresa' | 'nivel_centro' | 'nivel_proyecto';`
  - `export function ordenarFilasTodos(filas: FilaDocTodos[], modo: OrdenTodos): FilaDocTodos[]`

- [ ] **Step 1: Write the failing test file**

Create `front4/src/app/features/documentos/pages/documentos-admin-page.sort.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ordenarFilasTodos, FilaDocTodos, OrdenTodos } from './documentos-admin-page.component';

function fila(partial: Partial<FilaDocTodos> & { tipo: FilaDocTodos['tipo']; empresaNombre: string; doc: { nombre_display: string } }): FilaDocTodos {
  return {
    empresaId: 'e1',
    doc: { _id: partial.doc.nombre_display, nombre_display: partial.doc.nombre_display, url: 'http://x' },
    ...partial,
  } as FilaDocTodos;
}

describe('ordenarFilasTodos', () => {
  it('modo alfabetico ordena solo por nombre de documento, ignorando el tipo', () => {
    const filas = [
      fila({ tipo: 'proyecto', empresaNombre: 'Zeta', doc: { nombre_display: 'Beta.pdf' } }),
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'Alfa.pdf' } }),
    ];
    const resultado = ordenarFilasTodos(filas, 'alfabetico');
    expect(resultado.map(f => f.doc.nombre_display)).toEqual(['Alfa.pdf', 'Beta.pdf']);
  });

  it('modo nivel_empresa agrupa empresa -> centro -> proyecto', () => {
    const filas = [
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', proyectoNombre: 'P1', doc: { nombre_display: 'doc1' } }),
      fila({ tipo: 'centro', empresaNombre: 'Alfa', centroNombre: 'C1', doc: { nombre_display: 'doc2' } }),
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'doc3' } }),
    ];
    const resultado = ordenarFilasTodos(filas, 'nivel_empresa');
    expect(resultado.map(f => f.tipo)).toEqual(['empresa', 'centro', 'proyecto']);
  });

  it('modo nivel_centro agrupa centro -> proyecto -> empresa', () => {
    const filas = [
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'doc1' } }),
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', proyectoNombre: 'P1', doc: { nombre_display: 'doc2' } }),
      fila({ tipo: 'centro', empresaNombre: 'Alfa', centroNombre: 'C1', doc: { nombre_display: 'doc3' } }),
    ];
    const resultado = ordenarFilasTodos(filas, 'nivel_centro');
    expect(resultado.map(f => f.tipo)).toEqual(['centro', 'proyecto', 'empresa']);
  });

  it('modo nivel_proyecto agrupa proyecto -> empresa -> centro', () => {
    const filas = [
      fila({ tipo: 'centro', empresaNombre: 'Alfa', centroNombre: 'C1', doc: { nombre_display: 'doc1' } }),
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'doc2' } }),
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', proyectoNombre: 'P1', doc: { nombre_display: 'doc3' } }),
    ];
    const resultado = ordenarFilasTodos(filas, 'nivel_proyecto');
    expect(resultado.map(f => f.tipo)).toEqual(['proyecto', 'empresa', 'centro']);
  });

  it('dentro de un grupo ordena por la cadena jerarquica completa: empresa -> centro -> proyecto -> documento', () => {
    const filas = [
      fila({ tipo: 'proyecto', empresaNombre: 'Zeta', centroNombre: 'C1', proyectoNombre: 'PZ', doc: { nombre_display: 'docZ' } }),
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', centroNombre: 'C2', proyectoNombre: 'PA1', doc: { nombre_display: 'docA2' } }),
      fila({ tipo: 'proyecto', empresaNombre: 'Alfa', centroNombre: 'C1', proyectoNombre: 'PA2', doc: { nombre_display: 'docA1' } }),
    ];
    // modo nivel_proyecto: el grupo 'proyecto' va primero: dentro de él, orden por empresa, luego centro, luego proyecto, luego doc.
    const resultado = ordenarFilasTodos(filas, 'nivel_proyecto');
    expect(resultado.map(f => f.doc.nombre_display)).toEqual(['docA1', 'docA2', 'docZ']);
  });

  it('no muta el arreglo original', () => {
    const original = [
      fila({ tipo: 'proyecto', empresaNombre: 'Zeta', doc: { nombre_display: 'Beta.pdf' } }),
      fila({ tipo: 'empresa', empresaNombre: 'Alfa', doc: { nombre_display: 'Alfa.pdf' } }),
    ];
    const copia = [...original];
    ordenarFilasTodos(original, 'alfabetico');
    expect(original).toEqual(copia);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd front4 && npx ng test --watch=false`
Expected: FAIL — the new `documentos-admin-page.sort.spec.ts` file errors because `ordenarFilasTodos` (and `FilaDocTodos`, `OrdenTodos`) are not exported yet from `documentos-admin-page.component.ts` (import error / undefined). (There is one pre-existing unrelated failure in `app.spec.ts` — ignore it, it's not part of this change.)

- [ ] **Step 3: Implement `ordenarFilasTodos` and export the types**

In `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`, replace lines 29-42:

```ts
type FiltroTipo = DocTipo | 'todos';

const collatorNombre = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

interface FilaDocTodos {
  tipo: DocTipo;
  empresaId: string;
  empresaNombre: string;
  centroId?: string;
  centroNombre?: string;
  proyectoId?: string;
  proyectoNombre?: string;
  doc: DocBusquedaItem;
}
```

with:

```ts
type FiltroTipo = DocTipo | 'todos';

const collatorNombre = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export interface FilaDocTodos {
  tipo: DocTipo;
  empresaId: string;
  empresaNombre: string;
  centroId?: string;
  centroNombre?: string;
  proyectoId?: string;
  proyectoNombre?: string;
  doc: DocBusquedaItem;
}

export type OrdenTodos = 'alfabetico' | 'nivel_empresa' | 'nivel_centro' | 'nivel_proyecto';

const RANGOS_POR_MODO: Record<Exclude<OrdenTodos, 'alfabetico'>, DocTipo[]> = {
  nivel_empresa:  ['empresa', 'centro', 'proyecto'],
  nivel_centro:   ['centro', 'proyecto', 'empresa'],
  nivel_proyecto: ['proyecto', 'empresa', 'centro'],
};

export function ordenarFilasTodos(filas: FilaDocTodos[], modo: OrdenTodos): FilaDocTodos[] {
  const resultado = [...filas];
  if (modo === 'alfabetico') {
    resultado.sort((a, b) => collatorNombre.compare(a.doc.nombre_display, b.doc.nombre_display));
    return resultado;
  }
  const rango = RANGOS_POR_MODO[modo];
  resultado.sort((a, b) =>
    (rango.indexOf(a.tipo) - rango.indexOf(b.tipo)) ||
    collatorNombre.compare(a.empresaNombre, b.empresaNombre) ||
    collatorNombre.compare(a.centroNombre ?? '', b.centroNombre ?? '') ||
    collatorNombre.compare(a.proyectoNombre ?? '', b.proyectoNombre ?? '') ||
    collatorNombre.compare(a.doc.nombre_display, b.doc.nombre_display)
  );
  return resultado;
}
```

Do **not** touch the `filasTodos` computed yet (line 378-415) — that's Task 2. At this point `ordenarFilasTodos` exists but is unused outside the test file, which is expected.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd front4 && npx ng test --watch=false`
Expected: PASS — the 6 new tests in `documentos-admin-page.sort.spec.ts` are green (the pre-existing unrelated `app.spec.ts` failure noted in Step 2 may still be present — that's fine, it's out of scope for this change).

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/features/documentos/pages/documentos-admin-page.component.ts src/app/features/documentos/pages/documentos-admin-page.sort.spec.ts
git commit -m "feat(front): extraer ordenarFilasTodos como función pura y testeada"
```

---

### Task 2: Wire `ordenTodos` signal into the `filasTodos` computed

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts:90` (signals block) and `:378-415` (`filasTodos` computed)

**Interfaces:**
- Consumes: `ordenarFilasTodos(filas: FilaDocTodos[], modo: OrdenTodos): FilaDocTodos[]` and `OrdenTodos` from Task 1 (same file, no import needed — same module).
- Produces: `protected ordenTodos = signal<OrdenTodos>('alfabetico')` — a public (protected) signal that Task 3's template reads and calls `.set(...)` on.

- [ ] **Step 1: Add the `ordenTodos` signal**

Right after line 90 (`protected tabJerarquia = signal<'todos' | 'empresa' | 'centro' | 'proyecto'>('todos');`) in `documentos-admin-page.component.ts`, add:

```ts
  protected ordenTodos = signal<OrdenTodos>('alfabetico');
```

- [ ] **Step 2: Replace the fixed sort in `filasTodos` with `ordenarFilasTodos`**

Replace, at the end of the `filasTodos` computed (currently lines 413-414):

```ts
    filas.sort((a, b) => collatorNombre.compare(a.doc.nombre_display, b.doc.nombre_display));
    return filas;
```

with:

```ts
    return ordenarFilasTodos(filas, this.ordenTodos());
```

The full computed should now read (for context — only the last two lines change):

```ts
  protected filasTodos = computed<FilaDocTodos[]>(() => {
    // Un Proyecto puede pertenecer a varios centros, así que aparece una vez por cada
    // centro en el árbol (ver documentos-busqueda.service.ts) — sus documentos vienen
    // repetidos (mismo _id) tantas veces como centros comparta. Se deduplica manteniendo
    // la primera aparición: si no, el mismo _id en 2+ filas hace que el menú de
    // categoría (indexado por doc._id) se abra en todas a la vez.
    const vistos = new Set<string>();
    const filas: FilaDocTodos[] = [];
    for (const empresa of this.service.busquedaCascada()) {
      for (const doc of empresa.documentos) {
        if (vistos.has(doc._id)) continue;
        vistos.add(doc._id);
        filas.push({ tipo: 'empresa', empresaId: empresa._id, empresaNombre: empresa.nombre, doc });
      }
      for (const centro of empresa.centros) {
        for (const doc of centro.documentos) {
          if (vistos.has(doc._id)) continue;
          vistos.add(doc._id);
          filas.push({ tipo: 'centro', empresaId: centro.empresa_id, empresaNombre: empresa.nombre, centroId: centro._id, centroNombre: centro.nombre, doc });
        }
        for (const proyecto of centro.proyectos) {
          for (const doc of proyecto.documentos) {
            if (vistos.has(doc._id)) continue;
            vistos.add(doc._id);
            filas.push({
              tipo: 'proyecto',
              empresaId: proyecto.empresa_id, empresaNombre: empresa.nombre,
              centroId: proyecto.centro_id, centroNombre: centro.nombre,
              proyectoId: proyecto._id, proyectoNombre: proyecto.nombre,
              doc,
            });
          }
        }
      }
    }
    return ordenarFilasTodos(filas, this.ordenTodos());
  });
```

- [ ] **Step 3: Verify the existing sort tests still pass and the project compiles**

Run: `cd front4 && npx ng test --watch=false && npx tsc --noEmit -p tsconfig.app.json`
Expected: the 6 tests in `documentos-admin-page.sort.spec.ts` PASS (pre-existing unrelated `app.spec.ts` failure aside); `tsc --noEmit` exits with no errors (confirms `ordenTodos`, `ordenarFilasTodos`, `OrdenTodos` are wired with matching types and nothing else in the file broke).

- [ ] **Step 4: Commit**

```bash
cd front4
git add src/app/features/documentos/pages/documentos-admin-page.component.ts
git commit -m "feat(front): conectar ordenTodos signal al computed filasTodos"
```

---

### Task 3: Add the 4 sort chips to the "Todos" panel UI

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html:130-146`

**Interfaces:**
- Consumes: `ordenTodos: WritableSignal<OrdenTodos>` (protected field on the component, from Task 2) — template calls `ordenTodos()` to read and `ordenTodos.set('alfabetico' | 'nivel_empresa' | 'nivel_centro' | 'nivel_proyecto')` to write, exactly like the existing `tabDocAdmin.set('activos')` call at line 383 of the same file.

- [ ] **Step 1: Add the chip row to the template**

In `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`, replace lines 130-146:

```html
    <!-- Panel: Todos (resumen, sin selección) -->
    @if (tabJerarquia() === 'todos') {
      <div style="padding:1rem">
        <div style="border-left:4px solid #7c3aed;border-radius:8px;background:#fafbfc;padding:.75rem .85rem;display:flex;align-items:center;gap:.75rem">
          <div style="width:38px;height:38px;border-radius:9px;background:rgba(124,58,237,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7c3aed">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
              <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
              <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
            </svg>
          </div>
          <div>
            <p style="margin:0 0 .15rem;font-size:.9rem;font-weight:700;color:#1f2937">Todos los documentos</p>
            <p style="margin:0;font-size:.75rem;color:#6b7280">Empresas, centros de costos y proyectos · {{ filasTodos().length }} documentos</p>
          </div>
        </div>
      </div>
    }
```

with:

```html
    <!-- Panel: Todos (resumen, sin selección) -->
    @if (tabJerarquia() === 'todos') {
      <div style="padding:1rem">
        <div style="border-left:4px solid #7c3aed;border-radius:8px;background:#fafbfc;padding:.75rem .85rem;display:flex;align-items:center;gap:.75rem">
          <div style="width:38px;height:38px;border-radius:9px;background:rgba(124,58,237,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#7c3aed">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/>
              <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/>
              <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>
            </svg>
          </div>
          <div>
            <p style="margin:0 0 .15rem;font-size:.9rem;font-weight:700;color:#1f2937">Todos los documentos</p>
            <p style="margin:0;font-size:.75rem;color:#6b7280">Empresas, centros de costos y proyectos · {{ filasTodos().length }} documentos</p>
          </div>
        </div>
        <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.65rem">
          <span style="font-size:.72rem;font-weight:600;color:#6b7280;align-self:center;margin-right:.15rem">Ordenar por:</span>
          <button
            style="padding:.3rem .65rem;border-style:solid;border-width:1px;border-radius:999px;font-size:.75rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap"
            [style.background]="ordenTodos() === 'alfabetico' ? 'rgba(124,58,237,.08)' : 'transparent'"
            [style.color]="ordenTodos() === 'alfabetico' ? '#7c3aed' : '#6b7280'"
            [style.borderColor]="ordenTodos() === 'alfabetico' ? 'rgba(124,58,237,.3)' : '#e5e7eb'"
            (click)="ordenTodos.set('alfabetico')">
            Alfabético
          </button>
          <button
            style="padding:.3rem .65rem;border-style:solid;border-width:1px;border-radius:999px;font-size:.75rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap"
            [style.background]="ordenTodos() === 'nivel_empresa' ? 'rgba(124,58,237,.08)' : 'transparent'"
            [style.color]="ordenTodos() === 'nivel_empresa' ? '#7c3aed' : '#6b7280'"
            [style.borderColor]="ordenTodos() === 'nivel_empresa' ? 'rgba(124,58,237,.3)' : '#e5e7eb'"
            (click)="ordenTodos.set('nivel_empresa')">
            Nivel empresa
          </button>
          <button
            style="padding:.3rem .65rem;border-style:solid;border-width:1px;border-radius:999px;font-size:.75rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap"
            [style.background]="ordenTodos() === 'nivel_centro' ? 'rgba(124,58,237,.08)' : 'transparent'"
            [style.color]="ordenTodos() === 'nivel_centro' ? '#7c3aed' : '#6b7280'"
            [style.borderColor]="ordenTodos() === 'nivel_centro' ? 'rgba(124,58,237,.3)' : '#e5e7eb'"
            (click)="ordenTodos.set('nivel_centro')">
            Nivel centro
          </button>
          <button
            style="padding:.3rem .65rem;border-style:solid;border-width:1px;border-radius:999px;font-size:.75rem;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap"
            [style.background]="ordenTodos() === 'nivel_proyecto' ? 'rgba(124,58,237,.08)' : 'transparent'"
            [style.color]="ordenTodos() === 'nivel_proyecto' ? '#7c3aed' : '#6b7280'"
            [style.borderColor]="ordenTodos() === 'nivel_proyecto' ? 'rgba(124,58,237,.3)' : '#e5e7eb'"
            (click)="ordenTodos.set('nivel_proyecto')">
            Nivel proyecto
          </button>
        </div>
      </div>
    }
```

- [ ] **Step 2: Run the full front-end unit test suite**

Run: `cd front4 && npx ng test --watch=false`
Expected: same result as Task 2 Step 3 — the 6 `documentos-admin-page.sort.spec.ts` tests PASS, no new regressions (pre-existing unrelated `app.spec.ts` failure aside).

- [ ] **Step 3: Manual verification in the browser**

Run: `cd front4 && npm start`, open `http://localhost:4200`, log in as admin, go to Documentos, select the "Todos" tab (needs at least one empresa with documents at empresa/centro/proyecto level to see grouping — use `back4/scripts/seed-demo-data.js` if the local DB is empty).

Checklist:
- [ ] Default view on entering "Todos" shows the "Alfabético" chip highlighted and documents sorted by name.
- [ ] Clicking "Nivel empresa" re-orders the list so all empresa-level docs appear first, then centro-level, then proyecto-level — with no network request fired (check DevTools Network tab: no new call to `/documentos/busqueda-total`).
- [ ] Clicking "Nivel centro" shows centro-level docs first, then proyecto, then empresa.
- [ ] Clicking "Nivel proyecto" shows proyecto-level docs first, then empresa, then centro.
- [ ] Within any "Nivel X" group containing 2+ empresas or centros, the sub-order follows empresa → centro → proyecto → nombre de documento (spot-check with the seeded data).
- [ ] Switching between chips repeatedly doesn't break the "cambiar categoría" menu or the "Abrir/Descargar" buttons on any row.

- [ ] **Step 4: Commit**

```bash
cd front4
git add src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front): agregar selector de orden por nivel en tab Todos de Documentos"
```
