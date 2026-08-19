# Ícono y color personalizados en tipos de proyecto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir elegir un ícono (del mismo catálogo de 12 ya usado en tipos de actividad) y un color libre para cada tipo de proyecto, de forma independiente, tanto al crear como al editar — replicando el patrón ya implementado en `tipos-actividad`, sin diseñar íconos nuevos.

**Architecture:** Backend agrega un campo `icono` (validado contra el mismo catálogo cerrado de 12 claves) independiente de `color` (que pasa de string libre sin validar a validado con regex hex) — mismo esquema que `tipos-actividad`, duplicado en este módulo. Frontend agrega una función de resolución `resolverIconoProyecto` con fallback hacia atrás: como los 6 íconos viejos de proyecto (`carpeta, objetivo, cohete, bandera, maletin, grafico`) NO están incluidos en el catálogo de 12 reutilizado (a diferencia de actividades, donde sí lo estaban), el componente de ícono debe seguir sabiendo dibujar esos 6 además de los 12 nuevos — 18 casos en total — para no romper visualmente los 11 tipos ya sembrados que hoy no tienen `icono`.

**Tech Stack:** NestJS 10 + Mongoose 8 (back4), Angular 21 standalone + signals + Vitest (front4). `proyectos-page.component.html` y `proyecto-form.component.html` usan la sintaxis antigua `*ngIf`/`*ngFor` (no `@if`/`@for`) — los edits respetan esa convención existente en esos 2 archivos. `proyectos-list.component.html` sí usa `@if`/`@for`.

## Global Constraints

- `icono` es opcional en los DTOs y en el modelo del frontend — tipos de proyecto creados antes de este cambio (incluidos los 11 del catálogo A–K sembrado) no lo tienen y deben seguir viéndose exactamente igual que hoy (sin migración de datos).
- El catálogo **seleccionable** en el formulario es exactamente estas 12 claves, en este orden, en ambos lados (backend y frontend): `calendario, check, llave, alerta, reunion, documento, herramienta, camion, electricidad, extintor, casco, limpieza` — mismo catálogo, mismo orden, que ya existe en `tipos-actividad`.
- El componente de ícono (`ProyectoIconoComponent`) debe seguir renderizando correctamente los 6 íconos viejos (`carpeta, objetivo, cohete, bandera, maletin, grafico`) para los tipos sin `icono` — no son seleccionables en el formulario nuevo, pero deben seguir dibujándose vía el fallback de color existente (`clavePorColorProyecto`), sin caer al `@default` genérico.
- `color` deja de estar limitado a 6 valores fijos: es libre, validado por formato hex (`^#[0-9A-Fa-f]{6}$`) en el backend.
- No se toca `tipos-proyecto.catalogo.ts` ni la lógica de siembra inicial en `TiposProyectoService.onModuleInit`.
- No hay vista consumidor para `TipoProyecto` — todo el trabajo de UI es en el lado admin (`proyectos-page`, `proyecto-form`, `proyectos-list`).
- Se corrige de paso el bug de cierre síncrono del modal en `guardarTipo()` (mismo bug ya encontrado y arreglado en `tipos-actividad` — ver `docs/superpowers/plans/2026-07-31-icono-color-tipos-actividad.md`, commit `6a91840`), porque el color libre lo vuelve alcanzable aquí también.
- Spec de referencia: `docs/superpowers/specs/2026-08-03-icono-color-tipos-proyecto-design.md`.

---

## File Structure

- Modify `back4/src/tipos-proyecto/tipos-proyecto.schema.ts` — campo `icono`, regex en `color`.
- Modify `back4/src/tipos-proyecto/tipos-proyecto.dto.ts` — `icono` validado con `@IsIn`, `color` con `@Matches`.
- Modify `front4/src/app/features/proyectos/proyectos-icons.ts` — catálogo `ICONOS_PROYECTO` + `resolverIconoProyecto`.
- Create `front4/src/app/features/proyectos/proyectos-icons.spec.ts` — tests de `resolverIconoProyecto`.
- Modify `front4/src/app/features/proyectos/components/proyecto-icono/proyecto-icono.component.ts` — `@Input() icono`, 12 `@case` nuevos + 1 caso existente (`grafico`) hecho explícito.
- Modify `front4/src/app/shared/models/proyecto.model.ts` — `icono?` en `TipoProyecto`/`Create`/`UpdateTipoProyectoDto`.
- Modify `front4/src/app/features/proyectos/pages/proyectos-page.component.ts` — `TipoForm.icono`, form logic, fix del cierre de modal, cleanup del import de colores.
- Modify `front4/src/app/features/proyectos/pages/proyectos-page.component.html` — selector de ícono/color en el modal, listado de tipos, combo de filtro.
- Modify `front4/src/app/features/proyectos/components/proyecto-form/proyecto-form.component.html` — combobox de tipo con ícono.
- Modify `front4/src/app/features/proyectos/components/proyectos-list/proyectos-list.component.html` — tarjeta de proyecto con ícono (ya lo tiene vía `[color]`, solo agrega `[icono]`).

---

### Task 1: Backend — campo `icono` y validación de `color`

**Files:**
- Modify: `back4/src/tipos-proyecto/tipos-proyecto.schema.ts`
- Modify: `back4/src/tipos-proyecto/tipos-proyecto.dto.ts`

**Interfaces:**
- Produces: `TipoProyecto.icono?: string` (Mongoose, `required: true, default: 'calendario'` — todo documento nuevo siempre lo tiene; solo los 11 preexistentes del catálogo A–K carecen de él).
- Produces: `ICONOS_VALIDOS` (array exportado desde el DTO) — mismo catálogo de 12 claves que ya existe en `back4/src/tipos-actividad/tipos-actividad.dto.ts`, duplicado en este módulo (cada módulo es autocontenido, sin cross-imports entre módulos hermanos).

- [ ] **Step 1: Agregar el campo al schema y validar `color`**

En `back4/src/tipos-proyecto/tipos-proyecto.schema.ts`, reemplazar el archivo completo:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TipoProyectoDocument = TipoProyecto & Document;

@Schema({ collection: 'tipos_proyecto', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoProyecto {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#0095d6', match: /^#[0-9A-Fa-f]{6}$/ }) color: string;
  @Prop({ required: true, default: 'calendario' }) icono: string;
}

export const TipoProyectoSchema = SchemaFactory.createForClass(TipoProyecto);
```

- [ ] **Step 2: Validar `icono` y `color` en el DTO**

En `back4/src/tipos-proyecto/tipos-proyecto.dto.ts`, reemplazar el archivo completo:

```ts
import { IsString, IsOptional, IsIn, Matches, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export const ICONOS_VALIDOS = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export class CreateTipoProyectoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsString() @IsOptional() @IsIn(ICONOS_VALIDOS) icono?: string;
}

export class UpdateTipoProyectoDto extends PartialType(CreateTipoProyectoDto) {}
```

`tipos-proyecto.service.ts` y `tipos-proyecto.controller.ts` NO se tocan —
ya pasan el DTO completo al modelo (`new this.tipoModel(dto).save()` /
`findByIdAndUpdate(id, dto, { new: true })`), así que `icono` fluye
automáticamente igual que `color` hoy.

`tipos-proyecto.catalogo.ts` (los 11 tipos A–K sembrados) NO se toca — sus
documentos ya guardados en Mongo antes de este cambio no tienen `icono`
(y `onModuleInit` solo siembra si la colección está vacía, así que no vuelve
a correr sobre datos existentes).

- [ ] **Step 3: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: compila sin errores (`nest build` termina con código 0).

- [ ] **Step 4: Commit**

```bash
git add back4/src/tipos-proyecto/tipos-proyecto.schema.ts back4/src/tipos-proyecto/tipos-proyecto.dto.ts
git commit -m "feat(back): agregar icono a tipos de proyecto y validar color"
```

---

### Task 2: Frontend — catálogo de íconos, resolución con fallback, y componente

**Files:**
- Modify: `front4/src/app/features/proyectos/proyectos-icons.ts`
- Create: `front4/src/app/features/proyectos/proyectos-icons.spec.ts`
- Modify: `front4/src/app/features/proyectos/components/proyecto-icono/proyecto-icono.component.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores (Task 1 es backend, este archivo es puro frontend/TypeScript).
- Produces: `ICONOS_PROYECTO: readonly string[]` (las 12 claves seleccionables), `resolverIconoProyecto(icono?: string, color?: string): string` — usados por Task 3 y 4. La firma devuelve `string` (no un tipo angosto) porque el fallback puede devolver una de las 6 claves viejas, que están fuera del catálogo de 12.
- Produces: `ProyectoIconoComponent` con `@Input() icono?: string` además del `@Input() color` que ya tenía — usado por Task 3 y 4.

- [ ] **Step 1: Escribir el test que falla primero**

Crear `front4/src/app/features/proyectos/proyectos-icons.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolverIconoProyecto } from './proyectos-icons';

describe('resolverIconoProyecto', () => {
  it('usa el ícono explícito cuando es una clave válida, ignorando el color', () => {
    expect(resolverIconoProyecto('extintor', '#0095d6')).toBe('extintor');
    expect(resolverIconoProyecto('camion', '#22c55e')).toBe('camion');
  });

  it('cae al color cuando no viene ícono, devolviendo un ícono legacy de proyecto', () => {
    expect(resolverIconoProyecto(undefined, '#22c55e')).toBe('objetivo');
    expect(resolverIconoProyecto(undefined, '#0095d6')).toBe('carpeta');
  });

  it('cae al color cuando el ícono es una clave desconocida', () => {
    expect(resolverIconoProyecto('no-existe', '#f59e0b')).toBe('cohete');
  });

  it('sin ícono y sin color reconocido, cae al fallback legacy carpeta', () => {
    expect(resolverIconoProyecto(undefined, '#ffffff')).toBe('carpeta');
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd front4 && npx vitest run src/app/features/proyectos/proyectos-icons.spec.ts`
Expected: FAIL — `resolverIconoProyecto` no existe todavía en `proyectos-icons.ts`.

- [ ] **Step 3: Implementar el catálogo y la función de resolución**

En `front4/src/app/features/proyectos/proyectos-icons.ts`, el archivo completo queda así (se agrega todo debajo de lo que ya existe, sin borrar `ColorProyecto`/`COLORES_PROYECTO`/`clavePorColorProyecto`):

```ts
export interface ColorProyecto {
  valor: string;
  label: string;
  icono: string;
}

export const COLORES_PROYECTO: ColorProyecto[] = [
  { valor: '#0095d6', label: 'Azul',    icono: 'carpeta'  },
  { valor: '#22c55e', label: 'Verde',   icono: 'objetivo' },
  { valor: '#f59e0b', label: 'Ámbar',   icono: 'cohete'   },
  { valor: '#ef4444', label: 'Rojo',    icono: 'bandera'  },
  { valor: '#8b5cf6', label: 'Morado',  icono: 'maletin'  },
  { valor: '#6366f1', label: 'Índigo',  icono: 'grafico'  },
];

export function clavePorColorProyecto(color: string): string {
  const match = COLORES_PROYECTO.find(
    c => c.valor.toLowerCase() === color.toLowerCase()
  );
  return match?.icono ?? 'carpeta';
}

export const ICONOS_PROYECTO = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export function resolverIconoProyecto(icono?: string, color?: string): string {
  if (icono && (ICONOS_PROYECTO as readonly string[]).includes(icono)) {
    return icono;
  }
  return clavePorColorProyecto(color ?? '');
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `cd front4 && npx vitest run src/app/features/proyectos/proyectos-icons.spec.ts`
Expected: PASS (4/4 tests).

- [ ] **Step 5: Extender el componente con el nuevo input y los 12 íconos nuevos**

En `front4/src/app/features/proyectos/components/proyecto-icono/proyecto-icono.component.ts`,
reemplazar el archivo completo:

```ts
import { Component, Input } from '@angular/core';
import { resolverIconoProyecto } from '../../proyectos-icons';

@Component({
  selector: 'app-proyecto-icono',
  standalone: true,
  template: `
    <div class="icono-wrap"
         [style.width.px]="size + 20"
         [style.height.px]="size + 20"
         [style.background]="color + '26'"
         [style.border-radius.px]="10">
      <svg [attr.width]="size" [attr.height]="size"
           viewBox="0 0 24 24" fill="none"
           [attr.stroke]="color"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        @switch (clave) {
          @case ('carpeta') {
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>
          }
          @case ('objetivo') {
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="6"/>
            <circle cx="12" cy="12" r="2"/>
          }
          @case ('cohete') {
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
          }
          @case ('bandera') {
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
            <line x1="4" x2="4" y1="22" y2="15"/>
          }
          @case ('maletin') {
            <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          }
          @case ('grafico') {
            <line x1="12" x2="12" y1="20" y2="10"/>
            <line x1="18" x2="18" y1="20" y2="4"/>
            <line x1="6" x2="6" y1="20" y2="16"/>
          }
          @case ('calendario') {
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          }
          @case ('check') {
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          }
          @case ('llave') {
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          }
          @case ('alerta') {
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          }
          @case ('reunion') {
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          }
          @case ('documento') {
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          }
          @case ('herramienta') {
            <line x1="6" y1="18" x2="14" y2="10"/>
            <rect x="14" y="4" width="6" height="6" rx="1" transform="rotate(45 17 7)"/>
          }
          @case ('camion') {
            <path d="M10 17h4V5H2v12h3"/>
            <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/>
            <circle cx="7.5" cy="17.5" r="2.5"/>
            <circle cx="17.5" cy="17.5" r="2.5"/>
          }
          @case ('electricidad') {
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          }
          @case ('extintor') {
            <rect x="8" y="9" width="8" height="12" rx="2"/>
            <line x1="12" y1="9" x2="12" y2="4"/>
            <path d="M9 4h6"/>
            <line x1="12" y1="4" x2="12" y2="2"/>
            <line x1="16" y1="12" x2="19" y2="12"/>
          }
          @case ('casco') {
            <path d="M4 18v-2a8 8 0 0 1 16 0v2"/>
            <rect x="2" y="18" width="20" height="3" rx="1.5"/>
            <line x1="12" y1="8" x2="12" y2="4"/>
          }
          @case ('limpieza') {
            <line x1="18" y1="4" x2="10" y2="12"/>
            <path d="M9 13l-5 7 3 2 5-7"/>
            <line x1="9" y1="13" x2="12" y2="16"/>
            <line x1="7" y1="17" x2="10" y2="20"/>
          }
          @default {
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          }
        }
      </svg>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .icono-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `],
})
export class ProyectoIconoComponent {
  @Input() color = '#0095d6';
  @Input() icono?: string;
  @Input() size  = 20;

  protected get clave(): string {
    return resolverIconoProyecto(this.icono, this.color);
  }
}
```

Nota: los 6 casos legacy (`carpeta` a `grafico`) son exactamente el mismo
dibujo que ya existía en este archivo (el caso `grafico` antes vivía
implícito en `@default`, ahora es explícito — mismo criterio que se usó con
`documento` en `actividad-icono.component.ts`). Los 12 casos nuevos son una
copia literal de los mismos SVG ya usados en `actividad-icono.component.ts`
— no se rediseña nada.

- [ ] **Step 6: Verificar que compila y los tests siguen pasando**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/app/features/proyectos/proyectos-icons.spec.ts`
Expected: sin errores de tipos; 4/4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add front4/src/app/features/proyectos/proyectos-icons.ts front4/src/app/features/proyectos/proyectos-icons.spec.ts front4/src/app/features/proyectos/components/proyecto-icono/proyecto-icono.component.ts
git commit -m "feat(front): catálogo de 12 íconos con fallback legacy para tipos de proyecto"
```

---

### Task 3: Frontend — modelo, formulario de tipos, y fix del cierre de modal

**Files:**
- Modify: `front4/src/app/shared/models/proyecto.model.ts`
- Modify: `front4/src/app/features/proyectos/pages/proyectos-page.component.ts`
- Modify: `front4/src/app/features/proyectos/pages/proyectos-page.component.html`

**Interfaces:**
- Consumes: `ICONOS_PROYECTO` y `ProyectoIconoComponent` con `[icono]` (Task 2).
- Produces: `TipoProyecto.icono?: string`, `CreateTipoProyectoDto.icono?: string`, `UpdateTipoProyectoDto.icono?: string` en el modelo — usados por Task 4.

- [ ] **Step 1: Agregar `icono` al modelo**

En `front4/src/app/shared/models/proyecto.model.ts`, reemplazar las 3
interfaces/tipo (líneas 56-67 aprox.):

```ts
export interface TipoProyecto {
  _id: string;
  nombre: string;
  color: string;
  icono?: string;
}

export interface CreateTipoProyectoDto {
  nombre: string;
  color?: string;
  icono?: string;
}

export type UpdateTipoProyectoDto = Partial<CreateTipoProyectoDto>;
```

- [ ] **Step 2: Actualizar `TipoForm`, su lógica, y el fix del cierre de modal**

En `front4/src/app/features/proyectos/pages/proyectos-page.component.ts`:

Cambiar el import de la línea 1 (agregar `effect`):
```ts
import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
```

Cambiar el import de la línea 15:
```ts
import { ICONOS_PROYECTO } from '../proyectos-icons';
```
(se elimina el import de `COLORES_PROYECTO, ColorProyecto` — ya no se usan
tras el Step 4).

Cambiar la interfaz `TipoForm` y `emptyTipoForm` (líneas 19-20):
```ts
interface TipoForm { nombre: string; color: string; icono: string; }
function emptyTipoForm(): TipoForm { return { nombre: '', color: '#0095d6', icono: 'calendario' }; }
```

Cambiar la línea 181 (`coloresProyecto` → `iconosProyecto`):
```ts
  protected readonly iconosProyecto = ICONOS_PROYECTO;
```

Agregar un `constructor()` con el effect de cierre reactivo — este componente
no tiene constructor todavía, así que se agrega justo después de la
declaración de `puedeGestionarTipos` (después de la línea 185, antes de
`protected modal = signal<ModalMode>(null);`):

```ts
  constructor() {
    effect(() => {
      if (this.tiposService.status()?.type === 'ok' && this.showTipoForm()) {
        this.cerrarTipoForm();
      }
    });
  }
```

Cambiar `abrirEditarTipo` (dentro de la sección "Gestión de tipos"):
```ts
  protected abrirEditarTipo(t: TipoProyecto): void {
    this.editingTipoId.set(t._id);
    this.tipoForm.set({ nombre: t.nombre, color: t.color, icono: t.icono ?? '' });
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }
```

Cambiar `guardarTipo` (remueve el cierre síncrono — ahora lo cierra el
`effect()` del constructor cuando el status pase a `'ok'`):
```ts
  protected guardarTipo(): void {
    const f = this.tipoForm();
    if (!f.nombre.trim()) return;
    const dto = { nombre: f.nombre.trim(), color: f.color, icono: f.icono || undefined };
    const id = this.editingTipoId();
    if (id) this.tiposService.actualizar(id, dto);
    else     this.tiposService.crear(dto);
  }
```

- [ ] **Step 3: Reemplazar el selector de swatches por el selector de íconos + color libre**

En `front4/src/app/features/proyectos/pages/proyectos-page.component.html`,
reemplazar el bloque completo (líneas 195-206, el párrafo "Selecciona un
ícono" + el `*ngFor` de swatches) — respetando la sintaxis `*ngFor` ya usada
en este archivo:

```html
          <p style="font-size:.78rem;color:#6b7280;margin:0 0 .4rem">Ícono</p>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem">
            <button type="button" *ngFor="let clave of iconosProyecto"
              [title]="clave"
              (click)="patchTipoForm('icono', clave)"
              [style.box-shadow]="tipoForm().icono === clave ? '0 0 0 3px ' + tipoForm().color : 'none'"
              [style.transform]="tipoForm().icono === clave ? 'scale(1.12)' : 'scale(1)'"
              style="padding:0;border:none;background:none;cursor:pointer;
                     border-radius:12px;transition:transform .12s,box-shadow .12s;">
              <app-proyecto-icono [icono]="clave" [color]="tipoForm().color" [size]="22"></app-proyecto-icono>
            </button>
          </div>
          <p style="font-size:.78rem;color:#6b7280;margin:0 0 .4rem">Color</p>
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem">
            <input type="color"
              [ngModel]="tipoForm().color"
              (ngModelChange)="patchTipoForm('color', $event)"
              style="width:36px;height:36px;padding:0;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer" />
            <input type="text"
              class="tipo-input"
              style="margin-bottom:0;max-width:110px"
              [ngModel]="tipoForm().color"
              (ngModelChange)="patchTipoForm('color', $event)"
              placeholder="#0095d6" />
          </div>
```

- [ ] **Step 4: Mostrar el ícono en el listado de tipos ya creados y en el combo de filtro**

En el mismo archivo HTML: en el bloque "Columna 2: lista de tipos" (línea
224), cambiar:
```html
<app-proyecto-icono [color]="t.color" [size]="16"></app-proyecto-icono>
```
por:
```html
<app-proyecto-icono [icono]="t.icono" [color]="t.color" [size]="16"></app-proyecto-icono>
```

En el combo de filtro por tipo (línea 60), cambiar:
```html
<app-proyecto-icono [color]="t.color" [size]="14"></app-proyecto-icono>
```
por:
```html
<app-proyecto-icono [icono]="t.icono" [color]="t.color" [size]="14"></app-proyecto-icono>
```

- [ ] **Step 5: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: sin errores de tipos ni de build.

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/shared/models/proyecto.model.ts front4/src/app/features/proyectos/pages/proyectos-page.component.ts front4/src/app/features/proyectos/pages/proyectos-page.component.html
git commit -m "feat(front): selector de ícono y color libre en tipos de proyecto, con fix de cierre de modal"
```

---

### Task 4: Frontend — mostrar el ícono en el formulario de proyecto y en la tarjeta de listado

**Files:**
- Modify: `front4/src/app/features/proyectos/components/proyecto-form/proyecto-form.component.html`
- Modify: `front4/src/app/features/proyectos/components/proyectos-list/proyectos-list.component.html`

**Interfaces:**
- Consumes: `TipoProyecto.icono` (Task 3), `ProyectoIconoComponent [icono]` (Task 2).

- [ ] **Step 1: Pasar `[icono]` en el combobox de tipo del formulario de proyecto**

En `front4/src/app/features/proyectos/components/proyecto-form/proyecto-form.component.html`
(línea 90, dentro del dropdown del combobox de tipo — este archivo usa
`*ngFor`, se respeta esa sintaxis), cambiar:
```html
<app-proyecto-icono [color]="t.color" [size]="14"></app-proyecto-icono>
```
por:
```html
<app-proyecto-icono [icono]="t.icono" [color]="t.color" [size]="14"></app-proyecto-icono>
```

- [ ] **Step 2: Pasar `[icono]` en la tarjeta de proyecto del listado**

En `front4/src/app/features/proyectos/components/proyectos-list/proyectos-list.component.html`
(línea 26, dentro de `@if (tipoDeProyecto(p); as tipo)` — este archivo usa
`@if`/`@for`, se respeta esa sintaxis), cambiar:
```html
<app-proyecto-icono [color]="tipo.color" [size]="16"></app-proyecto-icono>
```
por:
```html
<app-proyecto-icono [icono]="tipo.icono" [color]="tipo.color" [size]="16"></app-proyecto-icono>
```

- [ ] **Step 3: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: sin errores.

- [ ] **Step 4: Verificación manual en el navegador**

Run: `cd back4 && npm run start:dev` (una terminal) y `cd front4 && npm start` (otra).

Loguearse como `super_admin`, ir a Proyectos → "Tipos de proyecto". Confirmar:
- Los 11 tipos ya sembrados (A. IOT – ECLARITI, B. INGENIERÍA Y AUDITORÍAS, ...)
  se siguen viendo con su ícono actual (carpeta, tintado con su propio color
  personalizado) — sin ningún cambio visual.
- Crear un tipo nuevo eligiendo un ícono del catálogo de 12 (ej. `extintor`) y
  un color con el input nativo (ej. un color que no esté en la paleta vieja
  de 6). Confirmar que el botón elegido se resalta, tintado con el color
  elegido en tiempo real.
- El tipo nuevo aparece con ese ícono en: la lista de "Tipos creados" del
  modal, el combo de filtro por tipo (arriba de la página), el combobox de
  tipo al crear/editar un proyecto, y la tarjeta del proyecto en el listado
  (una vez asignado ese tipo a algún proyecto).
- Editar ese mismo tipo nuevo: el form precarga el ícono y color correctos.
- Editar uno de los 11 tipos viejos (sin `icono`): el selector de ícono no
  resalta ningún botón (comportamiento esperado, ninguno de los 12
  seleccionables coincide con su ícono legacy); si se guarda sin tocar el
  ícono, el tipo sigue mostrando su ícono legacy (no se rompe).
- Escribir un hex inválido en el campo de texto y hacer clic en Guardar:
  el modal NO se cierra, aparece el banner de error, y los datos tecleados
  siguen ahí (verificación del fix de cierre de modal).

Expected: todos los puntos anteriores se cumplen, sin errores en consola.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/proyectos/components/proyecto-form/proyecto-form.component.html front4/src/app/features/proyectos/components/proyectos-list/proyectos-list.component.html
git commit -m "feat(front): mostrar ícono de tipo de proyecto en formulario y listado"
```
