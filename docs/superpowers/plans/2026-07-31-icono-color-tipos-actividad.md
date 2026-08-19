# Ícono y color personalizados en tipos de actividad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir elegir un ícono (de un catálogo de 12) y un color libre para cada tipo de actividad, de forma independiente, tanto al crear como al editar, y mostrar ese ícono donde ya hay espacio (lista "todo el día" y paneles/modal de detalle, admin y consumidor).

**Architecture:** Backend agrega un campo `icono` (string validado contra una lista cerrada) independiente de `color` (que pasa de string libre sin validar a validado con regex hex). Frontend desacopla la resolución "¿qué ícono muestro?" en una función pura con fallback hacia atrás (si `icono` no viene, deriva del color como hoy), y el componente de ícono ya existente (`ActividadIconoComponent`) la usa internamente — nada que lo consume necesita saber si el ícono es explícito o derivado.

**Tech Stack:** NestJS 10 + Mongoose 8 (back4), Angular 21 standalone + signals + Vitest (front4).

## Global Constraints

- `icono` es opcional en los DTOs y en el modelo del frontend — tipos de actividad creados antes de este cambio no lo tienen y deben seguir viéndose igual que hoy (sin romper nada, sin migración de datos).
- El fallback para tipos sin `icono` es derivar la clave desde `color` con la tabla de 6 combinaciones ya existente (`clavePorColorActividad`) — ese comportamiento no cambia.
- `color` deja de estar limitado a 6 valores fijos: es libre, validado por formato hex (`^#[0-9A-Fa-f]{6}$`) en el backend.
- El catálogo de íconos válidos es exactamente estos 12, en este orden, en ambos lados (backend y frontend): `calendario, check, llave, alerta, reunion, documento, herramienta, camion, electricidad, extintor, casco, limpieza`.
- El ícono se muestra SOLO en: la lista "Todo el día" de vista Día, el panel de detalle de vista Día, y el modal de resumen/detalle (clic en Mes/Semana) — en admin y consumidor. NO se agrega a chips de vista Mes, chips "todo el día" de Semana, bloques de horario de Semana/Día, ni barras multi-día — esos se quedan solo con color (son etiquetas de una sola línea de ~20px, sin espacio para el ícono).
- No se toca `activos` ni `proyectos` (mismo patrón de ícono-derivado-de-color, pero fuera de alcance).
- Spec de referencia: `docs/superpowers/specs/2026-07-31-icono-color-tipos-actividad-design.md`.

---

## File Structure

- Modify `back4/src/tipos-actividad/tipos-actividad.schema.ts` — campo `icono`, regex en `color`.
- Modify `back4/src/tipos-actividad/tipos-actividad.dto.ts` — `icono` validado con `@IsIn`, `color` con `@Matches`.
- Modify `front4/src/app/features/actividades/actividades-icons.ts` — catálogo `ICONOS_ACTIVIDAD` + `resolverIconoActividad`.
- Create `front4/src/app/features/actividades/actividades-icons.spec.ts` — tests de `resolverIconoActividad`.
- Modify `front4/src/app/features/actividades/components/actividad-icono/actividad-icono.component.ts` — `@Input() icono`, 6 `@case` nuevos.
- Modify `front4/src/app/shared/models/actividad.model.ts` — `icono?` en `TipoActividad`/`Create`/`UpdateTipoActividadDto`.
- Modify `front4/src/app/features/actividades/pages/actividades-page.component.ts` — `TipoForm.icono`, form logic, cleanup de `coloresActividad`.
- Modify `front4/src/app/features/actividades/pages/actividades-page.component.html` — selector de ícono/color en el modal, listado, y los 3 puntos de ícono en calendario/detalle (admin).
- Modify `front4/src/app/features/actividades/pages/mis-actividades-page.component.ts` — import de `ActividadIconoComponent`.
- Modify `front4/src/app/features/actividades/pages/mis-actividades-page.component.html` — los 3 puntos de ícono en calendario/detalle (consumidor).

---

### Task 1: Backend — campo `icono` y validación de `color`

**Files:**
- Modify: `back4/src/tipos-actividad/tipos-actividad.schema.ts`
- Modify: `back4/src/tipos-actividad/tipos-actividad.dto.ts`

**Interfaces:**
- Produces: `TipoActividad.icono?: string` (Mongoose, `required: true, default: 'calendario'` — todo documento nuevo siempre lo tiene; solo los preexistentes carecen de él).
- Produces: `ICONOS_VALIDOS` (array exportado desde el DTO) — catálogo de 12 claves válidas, mismo orden que el Global Constraint de arriba.

- [ ] **Step 1: Agregar el campo al schema y validar `color`**

En `back4/src/tipos-actividad/tipos-actividad.schema.ts`, reemplazar la clase completa:

```ts
@Schema({ collection: 'tipos_actividad', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoActividad {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#4E9AC7', match: /^#[0-9A-Fa-f]{6}$/ }) color: string;
  @Prop({ required: true, default: 'calendario' }) icono: string;
  @Prop({ trim: true }) descripcion?: string;
}
```

- [ ] **Step 2: Validar `icono` y `color` en el DTO**

En `back4/src/tipos-actividad/tipos-actividad.dto.ts`, reemplazar el archivo completo:

```ts
import { IsString, IsOptional, IsIn, Matches, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export const ICONOS_VALIDOS = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export class CreateTipoActividadDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsString() @IsOptional() @IsIn(ICONOS_VALIDOS) icono?: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class UpdateTipoActividadDto extends PartialType(CreateTipoActividadDto) {}
```

`tipos-actividad.service.ts` y `tipos-actividad.controller.ts` NO se tocan —
ya pasan el DTO completo al modelo (`new this.tipoModel(dto).save()` /
`findByIdAndUpdate(id, dto, ...)`), así que `icono` fluye automáticamente
igual que `color` hoy.

- [ ] **Step 3: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: compila sin errores (`nest build` termina con código 0).

- [ ] **Step 4: Commit**

```bash
git add back4/src/tipos-actividad/tipos-actividad.schema.ts back4/src/tipos-actividad/tipos-actividad.dto.ts
git commit -m "feat(back): agregar icono a tipos de actividad y validar color"
```

---

### Task 2: Frontend — catálogo de íconos, resolución con fallback, y componente

**Files:**
- Modify: `front4/src/app/features/actividades/actividades-icons.ts`
- Create: `front4/src/app/features/actividades/actividades-icons.spec.ts`
- Modify: `front4/src/app/features/actividades/components/actividad-icono/actividad-icono.component.ts`

**Interfaces:**
- Consumes: nada de tareas anteriores (Task 1 es backend, este archivo es puro frontend/TypeScript).
- Produces: `ICONOS_ACTIVIDAD: readonly string[]` (las 12 claves), `type IconoActividad`, `resolverIconoActividad(icono?: string, color?: string): IconoActividad` — usados por Task 3, 4 y 5.
- Produces: `ActividadIconoComponent` con `@Input() icono?: string` además del `@Input() color` que ya tenía — usado por Task 3, 4 y 5.

- [ ] **Step 1: Escribir el test que falla primero**

Crear `front4/src/app/features/actividades/actividades-icons.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolverIconoActividad } from './actividades-icons';

describe('resolverIconoActividad', () => {
  it('usa el ícono explícito cuando es una clave válida, ignorando el color', () => {
    expect(resolverIconoActividad('extintor', '#4E9AC7')).toBe('extintor');
    expect(resolverIconoActividad('camion', '#5FAE7B')).toBe('camion');
  });

  it('cae al color cuando no viene ícono', () => {
    expect(resolverIconoActividad(undefined, '#5FAE7B')).toBe('check');
    expect(resolverIconoActividad(undefined, '#4E9AC7')).toBe('calendario');
  });

  it('cae al color cuando el ícono es una clave desconocida', () => {
    expect(resolverIconoActividad('no-existe', '#D9A24B')).toBe('llave');
  });

  it('sin ícono y sin color reconocido, cae al fallback calendario', () => {
    expect(resolverIconoActividad(undefined, '#ffffff')).toBe('calendario');
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd front4 && npx vitest run src/app/features/actividades/actividades-icons.spec.ts`
Expected: FAIL — `resolverIconoActividad` no existe todavía en `actividades-icons.ts`.

- [ ] **Step 3: Implementar el catálogo y la función de resolución**

En `front4/src/app/features/actividades/actividades-icons.ts`, el archivo completo queda así (se agrega todo debajo de lo que ya existe, sin borrar `ColorActividad`/`COLORES_ACTIVIDAD`/`clavePorColorActividad`):

```ts
export interface ColorActividad {
  valor: string;
  label: string;
  icono: string;
}

export const COLORES_ACTIVIDAD: ColorActividad[] = [
  { valor: '#4E9AC7', label: 'Azul',    icono: 'calendario'  },
  { valor: '#5FAE7B', label: 'Verde',   icono: 'check'       },
  { valor: '#D9A24B', label: 'Ámbar',   icono: 'llave'       },
  { valor: '#D46A63', label: 'Rojo',    icono: 'alerta'      },
  { valor: '#9B85C9', label: 'Morado',  icono: 'reunion'     },
  { valor: '#7B82C9', label: 'Índigo',  icono: 'documento'   },
];

export function clavePorColorActividad(color: string): string {
  const match = COLORES_ACTIVIDAD.find(
    c => c.valor.toLowerCase() === color.toLowerCase()
  );
  return match?.icono ?? 'calendario';
}

export const ICONOS_ACTIVIDAD = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;
export type IconoActividad = typeof ICONOS_ACTIVIDAD[number];

export function resolverIconoActividad(icono?: string, color?: string): IconoActividad {
  if (icono && (ICONOS_ACTIVIDAD as readonly string[]).includes(icono)) {
    return icono as IconoActividad;
  }
  return clavePorColorActividad(color ?? '') as IconoActividad;
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `cd front4 && npx vitest run src/app/features/actividades/actividades-icons.spec.ts`
Expected: PASS (4/4 tests).

- [ ] **Step 5: Extender el componente con el nuevo input y los 6 íconos nuevos**

En `front4/src/app/features/actividades/components/actividad-icono/actividad-icono.component.ts`,
reemplazar el archivo completo:

```ts
import { Component, Input } from '@angular/core';
import { resolverIconoActividad } from '../../actividades-icons';

@Component({
  selector: 'app-actividad-icono',
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
export class ActividadIconoComponent {
  @Input() color = '#4E9AC7';
  @Input() icono?: string;
  @Input() size  = 20;

  protected get clave(): string {
    return resolverIconoActividad(this.icono, this.color);
  }
}
```

Nota: los 6 SVG nuevos (`herramienta`, `camion`, `electricidad`, `extintor`,
`casco`, `limpieza`) son abstracciones simples hechas a mano en el mismo
estilo trazo/stroke que los 5 existentes — no son réplicas exactas de ningún
ícono de una librería. Lo que importa funcionalmente es que cada clave
renderice un SVG distinto y válido (sin errores de path); el pulido visual
exacto es secundario y se puede ajustar después sin volver a este plan.

- [ ] **Step 6: Verificar que compila y los tests siguen pasando**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json && npx vitest run src/app/features/actividades/actividades-icons.spec.ts`
Expected: sin errores de tipos; 4/4 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add front4/src/app/features/actividades/actividades-icons.ts front4/src/app/features/actividades/actividades-icons.spec.ts front4/src/app/features/actividades/components/actividad-icono/actividad-icono.component.ts
git commit -m "feat(front): catálogo de 12 íconos con fallback por color para tipos de actividad"
```

---

### Task 3: Frontend — modelo y formulario de creación/edición (admin)

**Files:**
- Modify: `front4/src/app/shared/models/actividad.model.ts`
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.ts`
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html`

**Interfaces:**
- Consumes: `ICONOS_ACTIVIDAD` y `ActividadIconoComponent` con `[icono]` (Task 2).
- Produces: `TipoActividad.icono?: string`, `CreateTipoActividadDto.icono?: string`, `UpdateTipoActividadDto.icono?: string` en el modelo — usados por Task 4 y 5.

- [ ] **Step 1: Agregar `icono` al modelo**

En `front4/src/app/shared/models/actividad.model.ts`, en las 3 interfaces
(agregar `icono?: string;` inmediatamente después de `color`/`color?:` en
cada una):

```ts
export interface TipoActividad {
  _id: string;
  nombre: string;
  color: string;
  icono?: string;
  descripcion?: string;
  creado_en?: string;
  actualizado_en?: string;
}
```
```ts
export interface CreateTipoActividadDto {
  nombre: string;
  color?: string;
  icono?: string;
  descripcion?: string;
}
```
```ts
export interface UpdateTipoActividadDto {
  nombre?: string;
  color?: string;
  icono?: string;
  descripcion?: string;
}
```

- [ ] **Step 2: Actualizar `TipoForm` y su lógica en el componente**

En `front4/src/app/features/actividades/pages/actividades-page.component.ts`:

Cambiar el import de la línea 19:
```ts
import { ICONOS_ACTIVIDAD } from '../actividades-icons';
```
(se elimina el import de `COLORES_ACTIVIDAD, ColorActividad` — ya no se usan,
ver Step 3 más abajo).

Cambiar la interfaz `TipoForm` (línea 34-38):
```ts
interface TipoForm {
  nombre: string;
  color: string;
  icono: string;
  descripcion: string;
}
```

Cambiar `emptyTipoForm` (línea 43-45):
```ts
function emptyTipoForm(): TipoForm {
  return { nombre: '', color: '#4E9AC7', icono: 'calendario', descripcion: '' };
}
```

Cambiar `abrirEditarTipo` (línea 781-786):
```ts
  abrirEditarTipo(t: TipoActividad): void {
    this.editingTipoId.set(t._id);
    this.tipoForm.set({ nombre: t.nombre, color: t.color, icono: t.icono ?? '', descripcion: t.descripcion ?? '' });
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }
```
(si el tipo es antiguo y no tiene `icono`, el form queda con `icono: ''` — el
selector de ícono no resalta ningún botón hasta que el admin elija uno; no se
fuerza una re-elección para poder guardar otros cambios).

Cambiar `guardarTipo` (línea 797-805):
```ts
  guardarTipo(): void {
    const f = this.tipoForm();
    if (!f.nombre.trim()) return;
    const dto = { nombre: f.nombre.trim(), color: f.color, icono: f.icono || undefined, descripcion: f.descripcion.trim() || undefined };
    const id = this.editingTipoId();
    if (id) this.tiposService.actualizar(id, dto);
    else     this.tiposService.crear(dto);
    this.cerrarTipoForm();
  }
```

- [ ] **Step 3: Reemplazar el campo `coloresActividad` por `iconosActividad`**

En el mismo archivo, cambiar la línea 63:
```ts
  protected readonly iconosActividad = ICONOS_ACTIVIDAD;
```
(reemplaza `protected readonly coloresActividad: ColorActividad[] = COLORES_ACTIVIDAD;` —
ya no queda ningún uso de `coloresActividad`/`ColorActividad`/`COLORES_ACTIVIDAD`
en este archivo tras el Step 4).

- [ ] **Step 4: Reemplazar el selector en el HTML del modal**

En `front4/src/app/features/actividades/pages/actividades-page.component.html`,
reemplazar el bloque completo (líneas 1107-1120, el párrafo "Selecciona un
ícono" + el `@for` de swatches):

```html
          <p style="font-size:.78rem;color:#6b7280;margin:0 0 .4rem">Ícono</p>
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem">
            @for (clave of iconosActividad; track clave) {
              <button type="button"
                [title]="clave"
                (click)="patchTipoForm('icono', clave)"
                [style.box-shadow]="tipoForm().icono === clave ? '0 0 0 3px ' + tipoForm().color : 'none'"
                [style.transform]="tipoForm().icono === clave ? 'scale(1.12)' : 'scale(1)'"
                style="padding:0;border:none;background:none;cursor:pointer;
                       border-radius:12px;transition:transform .12s,box-shadow .12s;">
                <app-actividad-icono [icono]="clave" [color]="tipoForm().color" [size]="22"></app-actividad-icono>
              </button>
            }
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
              placeholder="#4E9AC7" />
          </div>
```

Ambos inputs de color escriben al mismo campo del signal (`patchTipoForm('color', ...)`),
así que quedan sincronizados entre sí sin lógica adicional — cambiar uno
actualiza el otro en el próximo render porque los dos leen `[ngModel]="tipoForm().color"`.

- [ ] **Step 5: Mostrar el ícono en el listado de tipos ya creados**

En el mismo archivo HTML, en el bloque `<!-- Columna 2: lista de tipos -->`
(línea 1141), cambiar:

```html
<app-actividad-icono [color]="t.color" [size]="16"></app-actividad-icono>
```
por:
```html
<app-actividad-icono [icono]="t.icono" [color]="t.color" [size]="16"></app-actividad-icono>
```

- [ ] **Step 6: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: sin errores de tipos ni de build.

- [ ] **Step 7: Commit**

```bash
git add front4/src/app/shared/models/actividad.model.ts front4/src/app/features/actividades/pages/actividades-page.component.ts front4/src/app/features/actividades/pages/actividades-page.component.html
git commit -m "feat(front): selector de ícono y color libre en el formulario de tipos de actividad"
```

---

### Task 4: Frontend — mostrar el ícono en calendario/detalle (admin)

**Files:**
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html`

**Interfaces:**
- Consumes: `TipoActividad.icono` (Task 3), `ActividadIconoComponent [icono]` (Task 2), `tipoDeActividad(a)`/`detalleActividad()` ya existentes en `actividades-page.component.ts` (sin cambios — ya devuelven el `TipoActividad` completo, que ahora incluye `icono`).

- [ ] **Step 1: Pasar `[icono]` en la lista "Todo el día" de vista Día**

En `front4/src/app/features/actividades/pages/actividades-page.component.html`,
buscar (dentro del bloque "Todo el día" de la vista Día, cerca de la línea 221):

```html
<app-actividad-icono [color]="colorDeActividad(a)" [size]="18"></app-actividad-icono>
```
Reemplazar por:
```html
<app-actividad-icono [icono]="tipoDeActividad(a)?.icono" [color]="colorDeActividad(a)" [size]="18"></app-actividad-icono>
```

- [ ] **Step 2: Reemplazar el punto de color por el ícono en el panel de detalle de vista Día**

Buscar (cerca de la línea 272):
```html
<span class="cal-day-detail-dot" [style.background]="det.tipo?.color ?? '#9ca3af'"></span>
```
Reemplazar por:
```html
<app-actividad-icono [icono]="det.tipo?.icono" [color]="det.tipo?.color ?? '#9ca3af'" [size]="18"></app-actividad-icono>
```

- [ ] **Step 3: Reemplazar el punto de color por el ícono en el modal de resumen**

Buscar (cerca de la línea 442):
```html
<span class="actividad-detalle-dot" [style.background]="det.tipo?.color ?? '#9ca3af'"></span>
```
Reemplazar por:
```html
<app-actividad-icono [icono]="det.tipo?.icono" [color]="det.tipo?.color ?? '#9ca3af'" [size]="16"></app-actividad-icono>
```

- [ ] **Step 4: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: sin errores.

- [ ] **Step 5: Verificación manual en el navegador**

Run: `cd back4 && npm run start:dev` (una terminal) y `cd front4 && npm start` (otra).

Loguearse como `super_admin`, ir a Actividades → "Tipos de actividad", crear
un tipo nuevo eligiendo un ícono (por ejemplo `extintor`) y un color con el
input nativo (por ejemplo un rosa que no esté en la paleta vieja de 6).
Confirmar:
- El botón del ícono elegido se resalta en el selector, con el color elegido
  tiñendo la vista previa de todos los botones del selector.
- El tipo aparece en la lista de la derecha con ese ícono y color.
- Al editar ese mismo tipo, el form precarga el ícono y color correctos.
- Al crear una actividad con ese tipo, el ícono aparece en la lista "Todo el
  día" de vista Día (si la actividad no tiene hora), en el panel de detalle
  de vista Día, y en el modal de resumen al hacer clic desde vista Mes/Semana.
- Una actividad con un tipo creado antes de este cambio (sin `icono`) sigue
  mostrando el ícono derivado del color (comportamiento de hoy), sin romper
  ningún panel.
- Los chips de vista Mes, los chips "todo el día" de Semana, y los bloques de
  horario de Semana/Día siguen mostrando solo color, sin ícono (esperado).

Expected: todos los puntos anteriores se cumplen, sin errores en consola.

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/features/actividades/pages/actividades-page.component.html
git commit -m "feat(front): mostrar ícono de tipo de actividad en calendario/detalle (admin)"
```

---

### Task 5: Frontend — mostrar el ícono en calendario/detalle (consumidor)

**Files:**
- Modify: `front4/src/app/features/actividades/pages/mis-actividades-page.component.ts`
- Modify: `front4/src/app/features/actividades/pages/mis-actividades-page.component.html`

**Interfaces:**
- Consumes: `TipoActividad.icono` (Task 3), `ActividadIconoComponent` (Task 2), `tipoDeActividad(a)`/`colorDeActividad(a)` ya existentes en `mis-actividades-page.component.ts` (sin cambios).

- [ ] **Step 1: Importar `ActividadIconoComponent` en el componente**

En `front4/src/app/features/actividades/pages/mis-actividades-page.component.ts`,
agregar el import:
```ts
import { ActividadIconoComponent } from '../components/actividad-icono/actividad-icono.component';
```
y agregarlo al array `imports` del `@Component` (línea 17):
```ts
  imports: [FormsModule, SlicePipe, ActividadIconoComponent],
```

- [ ] **Step 2: Reemplazar el punto de color por el ícono en la lista "Todo el día"**

En `front4/src/app/features/actividades/pages/mis-actividades-page.component.html`,
buscar (cerca de la línea 203):
```html
<span class="cal-day-item-dot" [style.background]="colorDeActividad(a)"></span>
```
Reemplazar por:
```html
<app-actividad-icono [icono]="tipoDeActividad(a)?.icono" [color]="colorDeActividad(a)" [size]="18"></app-actividad-icono>
```

- [ ] **Step 3: Reemplazar el punto de color por el ícono en el panel de detalle de vista Día**

Buscar (cerca de la línea 250):
```html
<span class="cal-day-detail-dot" [style.background]="colorDeActividad(det)"></span>
```
Reemplazar por:
```html
<app-actividad-icono [icono]="tipoDeActividad(det)?.icono" [color]="colorDeActividad(det)" [size]="18"></app-actividad-icono>
```

- [ ] **Step 4: Reemplazar el punto de color por el ícono en el modal de detalle**

Buscar (cerca de la línea 362):
```html
<span class="actividad-detalle-dot" [style.background]="colorDeActividad(actividadDetalle()!)"></span>
```
Reemplazar por:
```html
<app-actividad-icono [icono]="tipoDeActividad(actividadDetalle()!)?.icono" [color]="colorDeActividad(actividadDetalle()!)" [size]="16"></app-actividad-icono>
```

- [ ] **Step 5: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json && npm run build`
Expected: sin errores.

- [ ] **Step 6: Verificación manual en el navegador**

Con backend y frontend corriendo (Task 4, Step 5), loguearse como un usuario
`usuario` (consumidor) de la empresa donde se creó la actividad de prueba de
la Task 4. Ir a "Mis actividades". Confirmar:
- El ícono aparece en la lista "Todo el día" de vista Día (si aplica), en el
  panel de detalle de vista Día, y en el modal de detalle al hacer clic desde
  vista Mes/Semana — mismo ícono y color que ve el admin.
- Una actividad con un tipo antiguo sin `icono` no se rompe (fallback por
  color, igual que antes).
- Los chips de vista Mes/Semana y bloques de horario siguen solo con color.

Expected: todos los puntos se cumplen, sin errores en consola.

- [ ] **Step 7: Commit**

```bash
git add front4/src/app/features/actividades/pages/mis-actividades-page.component.ts front4/src/app/features/actividades/pages/mis-actividades-page.component.html
git commit -m "feat(front): mostrar ícono de tipo de actividad en calendario/detalle (consumidor)"
```
