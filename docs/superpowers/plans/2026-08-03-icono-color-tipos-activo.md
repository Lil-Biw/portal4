# Ícono y color personalizables en tipos de activo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a `tipos-activo` el mismo esquema de personalización de ícono (catálogo cerrado de 12 claves) + color (hex libre validado) que ya tienen `tipos-actividad` y `tipos-proyecto`.

**Architecture:** Replicar el patrón ya validado dos veces en este repo: agregar `icono: string` al schema/DTO de `tipos-activo` (backend), agregar el mismo campo al modelo TS y un resolver de compatibilidad hacia atrás (frontend), ampliar el componente de renderizado `ActivoIconoComponent` para aceptar `icono` sin perder los 5 íconos legacy ya sembrados por color, y reemplazar el selector de 6 swatches fijos del formulario de tipo por la grilla de 12 íconos + color libre. Por último, propagar `[icono]` a los 5 puntos donde hoy se pinta `<app-activo-icono>` sin ese input.

**Tech Stack:** NestJS 10 + Mongoose 8 (back4), Angular 21 standalone + signals (front4), Vitest (`@angular/build:unit-test`, corre con `npx ng test --watch=false`).

## Global Constraints

- Catálogo de íconos: exactamente estas 12 claves, en este orden, duplicado tal cual en cada módulo hermano (sin imports cruzados entre `tipos-actividad`, `tipos-proyecto`, `tipos-activo`): `calendario, check, llave, alerta, reunion, documento, herramienta, camion, electricidad, extintor, casco, limpieza`.
- Color: regex hex `^#[0-9A-Fa-f]{6}$`, validado tanto en el DTO (`@Matches`) como en el schema (`match`).
- Ícono por defecto para tipos de activo nuevos: `'herramienta'` (decisión de esta spec, distinta del `'calendario'` de actividad/proyecto).
- Los 5 íconos legacy de activo (`camara, caja-registradora, servidor, red, generador`) deben seguir dibujándose por compatibilidad hacia atrás — no son subconjunto del catálogo de 12, así que no se eliminan del `@switch`, pero tampoco son seleccionables en la grilla del formulario.
- Sin backfill/migración de documentos Mongo existentes.
- Sin librerías de íconos externas — todo SVG inline a mano, mismo estilo que los `@case` ya existentes.

---

### Task 1: Backend — `icono` en schema y DTO de `tipos-activo`

**Files:**
- Modify: `back4/src/tipos-activo/tipos-activo.schema.ts`
- Modify: `back4/src/tipos-activo/tipos-activo.dto.ts`

**Interfaces:**
- Produces: `TipoActivo.icono: string` (Mongoose, default `'herramienta'`), `TipoActivo.color: string` (ahora validado con regex hex). `ICONOS_VALIDOS` (array de 12 claves) y `CreateTipoActivoDto.icono?: string` / `CreateTipoActivoDto.color?: string` para que el frontend (Task 2+) los consuma vía HTTP.

No hay tests automatizados de backend en este repo para ningún módulo `tipos-*` (verificado: no existen `.spec.ts` en `back4/src`) — la verificación de este task es por compilación TypeScript, igual que se hizo para `tipos-actividad` y `tipos-proyecto`.

- [ ] **Step 1: Actualizar el schema**

Reemplazar el contenido de `back4/src/tipos-activo/tipos-activo.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TipoActivoDocument = TipoActivo & Document;

@Schema({ collection: 'tipos_activo', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoActivo {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#0095d6', match: /^#[0-9A-Fa-f]{6}$/ }) color: string;
  @Prop({ required: true, default: 'herramienta' }) icono: string;
}

export const TipoActivoSchema = SchemaFactory.createForClass(TipoActivo);
```

- [ ] **Step 2: Actualizar el DTO**

Reemplazar el contenido de `back4/src/tipos-activo/tipos-activo.dto.ts`:

```ts
import { IsString, IsOptional, IsIn, Matches, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export const ICONOS_VALIDOS = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export class CreateTipoActivoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsString() @IsOptional() @IsIn(ICONOS_VALIDOS) icono?: string;
}

export class UpdateTipoActivoDto extends PartialType(CreateTipoActivoDto) {}
```

- [ ] **Step 3: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso, sin errores de TypeScript (`dist/` se genera sin fallos).

- [ ] **Step 4: Commit**

```bash
git add back4/src/tipos-activo/tipos-activo.schema.ts back4/src/tipos-activo/tipos-activo.dto.ts
git commit -m "feat(back): agregar icono validado a tipos-activo"
```

---

### Task 2: Frontend — modelo compartido `TipoActivo`

**Files:**
- Modify: `front4/src/app/shared/models/activo.model.ts:11-22`

**Interfaces:**
- Consumes: nada de tasks anteriores (es el punto de entrada del lado frontend).
- Produces: `TipoActivo.icono?: string`, `CreateTipoActivoDto.icono?: string`, `UpdateTipoActivoDto` (hereda de `CreateTipoActivoDto` vía `Partial`). Todas las tasks siguientes leen `t.icono` de este tipo.

- [ ] **Step 1: Editar el modelo**

En `front4/src/app/shared/models/activo.model.ts`, reemplazar las líneas 11-22:

```ts
export interface TipoActivo {
  _id: string;
  nombre: string;
  color: string;
  icono?: string;
}

export interface CreateTipoActivoDto {
  nombre: string;
  color: string;
  icono?: string;
}

export type UpdateTipoActivoDto = Partial<CreateTipoActivoDto>;
```

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores nuevos atribuibles a este cambio (puede haber ruido preexistente no relacionado; confirmar que no aparecen errores en archivos de `features/activos` o `shared/models/activo.model.ts`).

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/shared/models/activo.model.ts
git commit -m "feat(front): agregar icono opcional al modelo TipoActivo"
```

---

### Task 3: Frontend — catálogo y resolver en `activos-icons.ts`

**Files:**
- Modify: `front4/src/app/features/activos/activos-icons.ts`
- Modify: `front4/src/app/features/activos/activos-icons.spec.ts`

**Interfaces:**
- Consumes: nada nuevo (usa `clavePorColor`, ya existente en el mismo archivo).
- Produces: `ICONOS_ACTIVO: readonly string[]` (12 claves) y `resolverIconoActivo(icono?: string, color?: string): string`. Task 4 (`ActivoIconoComponent`) llama a `resolverIconoActivo`. Task 5 (grilla del formulario) itera `ICONOS_ACTIVO`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `front4/src/app/features/activos/activos-icons.spec.ts` (después del `describe('clavePorColor', ...)` ya existente):

```ts
import { resolverIconoActivo } from './activos-icons';

describe('resolverIconoActivo', () => {
  it('usa el ícono explícito cuando es una clave válida, ignorando el color', () => {
    expect(resolverIconoActivo('extintor', '#0095d6')).toBe('extintor');
    expect(resolverIconoActivo('camion', '#ef4444')).toBe('camion');
  });

  it('cae al color cuando no viene ícono', () => {
    expect(resolverIconoActivo(undefined, '#ef4444')).toBe('camara');
    expect(resolverIconoActivo(undefined, '#0095d6')).toBe('computador');
  });

  it('cae al color cuando el ícono es una clave desconocida', () => {
    expect(resolverIconoActivo('no-existe', '#22c55e')).toBe('caja-registradora');
  });

  it('sin ícono y sin color reconocido, cae al fallback computador', () => {
    expect(resolverIconoActivo(undefined, '#ffffff')).toBe('computador');
  });
});
```

El import `resolverIconoActivo` debe quedar junto al import existente de `clavePorColor` en la cabecera del archivo (una sola línea `import { clavePorColor, resolverIconoActivo } from './activos-icons';`), no duplicado.

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `cd front4 && npx ng test --watch=false`
Expected: FAIL — `resolverIconoActivo` no existe en `./activos-icons` (error de import/compilación en `activos-icons.spec.ts`).

- [ ] **Step 3: Implementar `ICONOS_ACTIVO` y `resolverIconoActivo`**

Agregar al final de `front4/src/app/features/activos/activos-icons.ts` (después de la función `clavePorColor` existente):

```ts
export const ICONOS_ACTIVO = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export function resolverIconoActivo(icono?: string, color?: string): string {
  if (icono && (ICONOS_ACTIVO as readonly string[]).includes(icono)) {
    return icono;
  }
  return clavePorColor(color ?? '');
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `cd front4 && npx ng test --watch=false`
Expected: PASS — todos los tests de `activos-icons.spec.ts` en verde (los de `clavePorColor` ya existentes + los nuevos de `resolverIconoActivo`).

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/activos/activos-icons.ts front4/src/app/features/activos/activos-icons.spec.ts
git commit -m "feat(front): agregar catalogo ICONOS_ACTIVO y resolverIconoActivo"
```

---

### Task 4: Frontend — `ActivoIconoComponent` acepta `icono`

**Files:**
- Modify: `front4/src/app/features/activos/components/activo-icono/activo-icono.component.ts`

**Interfaces:**
- Consumes: `resolverIconoActivo(icono?, color?)` de Task 3.
- Produces: `ActivoIconoComponent` con `@Input() icono?: string` además de `@Input() color` y `@Input() size` (ya existentes). Tasks 5 y 6 pasan `[icono]="..."` a `<app-activo-icono>`.

- [ ] **Step 1: Reemplazar el archivo completo**

Contenido final de `front4/src/app/features/activos/components/activo-icono/activo-icono.component.ts`:

```ts
import { Component, Input } from '@angular/core';
import { resolverIconoActivo } from '../../activos-icons';

@Component({
  selector: 'app-activo-icono',
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
          @case ('camara') {
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          }
          @case ('caja-registradora') {
            <circle cx="8" cy="21" r="1"/>
            <circle cx="19" cy="21" r="1"/>
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
          }
          @case ('servidor') {
            <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
            <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
            <line x1="6" x2="6.01" y1="6" y2="6"/>
            <line x1="6" x2="6.01" y1="18" y2="18"/>
          }
          @case ('red') {
            <rect width="16" height="16" x="4" y="4" rx="2"/>
            <rect width="6" height="6" x="9" y="9" rx="1"/>
            <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>
          }
          @case ('generador') {
            <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
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
            <rect width="20" height="14" x="2" y="3" rx="2"/>
            <line x1="8" x2="16" y1="21" y2="21"/>
            <line x1="12" x2="12" y1="17" y2="21"/>
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
export class ActivoIconoComponent {
  @Input() color = '#0095d6';
  @Input() icono?: string;
  @Input() size  = 20;

  protected get clave(): string {
    return resolverIconoActivo(this.icono, this.color);
  }
}
```

Nota: el `@default` pasa de ser el ícono "computador" real (rect+líneas, ya existente) a servir también como fallback genérico si `clave` no matchea ningún `@case` — mismo comportamiento que tenían `ActividadIconoComponent`/`ProyectoIconoComponent` antes de esta migración, no cambia semántica.

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npx ng build`
Expected: build exitoso, sin errores en `activo-icono.component.ts` ni en los componentes que lo consumen (`activos-page`, `activos-list`, `activo-revisar-modal`, `mis-centros-page`).

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/features/activos/components/activo-icono/activo-icono.component.ts
git commit -m "feat(front): ActivoIconoComponent acepta icono, preserva 5 legacy + catalogo de 12"
```

---

### Task 5: Frontend — formulario de tipo en `activos-page` (grilla de íconos + color libre + fix de cierre de modal)

**Files:**
- Modify: `front4/src/app/features/activos/pages/activos-page.component.ts`
- Modify: `front4/src/app/features/activos/pages/activos-page.component.html:192-249`

**Interfaces:**
- Consumes: `ICONOS_ACTIVO` (Task 3), `ActivoIconoComponent` con `@Input() icono` (Task 4), `TiposActivoService.crear/actualizar(dto: CreateTipoActivoDto | UpdateTipoActivoDto)` (ya existente, sin cambios — el dto ahora simplemente lleva `icono` además de `nombre`/`color`).
- Produces: nada consumido por tasks posteriores (es una page, hoja del árbol de dependencias).

- [ ] **Step 1: Editar imports, `TipoForm` y el nuevo campo `iconosActivo`**

En `front4/src/app/features/activos/pages/activos-page.component.ts`, reemplazar la línea 15:

```ts
import { ICONOS_ACTIVO } from '../activos-icons';
```

Reemplazar las líneas 19-20:

```ts
interface TipoForm { nombre: string; color: string; icono: string; }
function emptyTipoForm(): TipoForm { return { nombre: '', color: '#0095d6', icono: 'herramienta' }; }
```

Reemplazar la línea 161 (`protected readonly coloresActivo: ColorActivo[] = COLORES_ACTIVO;`) por:

```ts
protected readonly iconosActivo = ICONOS_ACTIVO;
```

- [ ] **Step 2: Corregir `abrirEditarTipo` para poblar `icono`**

Reemplazar (línea 451-456):

```ts
abrirEditarTipo(t: TipoActivo): void {
    this.editingTipoId.set(t._id);
    this.tipoForm.set({ nombre: t.nombre, color: t.color, icono: t.icono ?? 'herramienta' });
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }
```

- [ ] **Step 3: Corregir `guardarTipo` para enviar `icono` y no cerrar el form de forma síncrona**

Reemplazar (líneas 467-475):

```ts
guardarTipo(): void {
    const f = this.tipoForm();
    if (!f.nombre.trim()) return;
    const dto = { nombre: f.nombre.trim(), color: f.color, icono: f.icono || undefined };
    const id = this.editingTipoId();
    if (id) this.tiposService.actualizar(id, dto);
    else     this.tiposService.crear(dto);
  }
```

(Se quitó el `this.cerrarTipoForm();` final — el cierre pasa a manejarse por el `effect()` del Step 4.)

- [ ] **Step 4: Agregar el `effect()` de cierre-en-éxito para el sub-formulario de tipo**

En el `constructor()` existente (líneas 246-258), que hoy solo tiene el effect que cierra el modal principal via `this.service.status()`, agregar un segundo `effect()` en el mismo constructor:

```ts
constructor() {
    effect(() => {
      if (
        this.service.status()?.type === 'ok' &&
        this.modal() !== null &&
        this.modal() !== 'buscar' &&
        this.modal() !== 'revisar' &&
        !this.subiendoDocs
      ) {
        this.cerrar();
      }
    });
    effect(() => {
      if (this.tiposService.status()?.type === 'ok' && this.showTipoForm()) {
        this.cerrarTipoForm();
      }
    });
  }
```

- [ ] **Step 5: Reemplazar el selector de swatches por la grilla de íconos + color libre en el HTML**

En `front4/src/app/features/activos/pages/activos-page.component.html`, reemplazar las líneas 203-217:

```html
            <!-- Selector de ícono/color -->
            <p style="font-size:.78rem;color:#6b7280;margin:0 0 .4rem">Ícono</p>
            <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem">
              @for (clave of iconosActivo; track clave) {
                <button type="button"
                  [title]="clave"
                  (click)="patchTipoForm('icono', clave)"
                  [style.box-shadow]="tipoForm().icono === clave ? '0 0 0 3px ' + tipoForm().color : 'none'"
                  [style.transform]="tipoForm().icono === clave ? 'scale(1.12)' : 'scale(1)'"
                  style="padding:0;border:none;background:none;cursor:pointer;
                         border-radius:12px;transition:transform .12s,box-shadow .12s;">
                  <app-activo-icono [icono]="clave" [color]="tipoForm().color" [size]="22"></app-activo-icono>
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
                placeholder="#0095d6" />
            </div>
```

- [ ] **Step 6: Propagar `icono` en el listado de tipos del mismo modal**

En el mismo archivo, reemplazar la línea 238:

```html
                    <app-activo-icono [icono]="t.icono" [color]="t.color" [size]="16"></app-activo-icono>
```

- [ ] **Step 7: Levantar el frontend y probar manualmente el flujo**

Run: `cd front4 && npm start` (en paralelo, `cd back4 && npm run start:dev` si no está corriendo)

En el navegador, como `super_admin`: ir a Activos → "Crear tipo de activo" → confirmar que aparece la grilla de 12 íconos (no los 6 swatches viejos) + selector de color libre, que "herramienta" es el ícono preseleccionado por defecto, que crear/editar un tipo con un color hex inválido muestra el error sin cerrar el modal, y que un guardado exitoso sí lo cierra.

Expected: comportamiento descrito arriba, sin errores en consola.

- [ ] **Step 8: Commit**

```bash
git add front4/src/app/features/activos/pages/activos-page.component.ts front4/src/app/features/activos/pages/activos-page.component.html
git commit -m "feat(front): grilla de 12 iconos + color libre para tipos de activo, fix cierre de modal"
```

---

### Task 6: Frontend — propagar `[icono]` a los puntos de renderizado restantes

**Files:**
- Modify: `front4/src/app/features/activos/components/activos-list/activos-list.component.html:28`
- Modify: `front4/src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.ts:22`
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.ts` (agregar método `tipoActivoIcono`)
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.html:350`
- Modify: `front4/src/app/features/activos/components/activos-form/activos-form.component.ts`

**Interfaces:**
- Consumes: `ActivoIconoComponent` con `@Input() icono` (Task 4), `TipoActivo.icono?` (Task 2).
- Produces: nada (hoja del árbol; todos estos son componentes de presentación).

- [ ] **Step 1: `activos-list.component.html` — fila de cada activo**

Reemplazar la línea 28:

```html
                    <app-activo-icono [icono]="tipo.icono" [color]="tipo.color" [size]="18"></app-activo-icono>
```

- [ ] **Step 2: `activo-revisar-modal.component.ts` — header del modal de revisión**

Reemplazar la línea 22:

```ts
          <app-activo-icono [icono]="tipoActivo.icono" [color]="tipoActivo.color" [size]="20"></app-activo-icono>
```

- [ ] **Step 3: `mis-centros-page.component.ts` — agregar helper `tipoActivoIcono`**

Después del método `tipoActivoColor` existente (líneas 216-219), agregar:

```ts
  tipoActivoIcono(a: Activo): string | undefined {
    if (typeof a.tipo_activo_id === 'object') return (a.tipo_activo_id as TipoActivo).icono;
    return undefined;
  }
```

- [ ] **Step 4: `mis-centros-page.component.html` — vista consumidor de activos del centro**

Reemplazar la línea 350:

```html
              <app-activo-icono [icono]="tipoActivoIcono(a)" [color]="tipoActivoColor(a)" [size]="20"></app-activo-icono>
```

- [ ] **Step 5: `activos-form.component.ts` — combobox de selección de tipo**

Agregar `ActivoIconoComponent` al array `imports` del `@Component` (línea 17), quedando:

```ts
  imports: [FormsModule, UploadDocumentFormComponent, ActivoIconoComponent],
```

Agregar el import correspondiente junto a los demás imports de la cabecera del archivo:

```ts
import { ActivoIconoComponent } from '../activo-icono/activo-icono.component';
```

En el template inline, reemplazar la línea 162:

```html
                      <app-activo-icono [icono]="t.icono" [color]="t.color" [size]="14"></app-activo-icono>
```

(Esto reemplaza el `<span class="tipo-combo-dot" [style.background]="t.color"></span>` — la clase CSS `.tipo-combo-dot` puede quedar sin uso en el archivo de estilos, no hace falta borrarla.)

- [ ] **Step 6: Verificar que compila**

Run: `cd front4 && npx ng build`
Expected: build exitoso, sin errores de template ni de TypeScript en los 5 archivos tocados.

- [ ] **Step 7: Correr toda la suite de tests del frontend**

Run: `cd front4 && npx ng test --watch=false`
Expected: los mismos resultados que en Task 3 (tests de `activos-icons.spec.ts` en verde) más el resto de la suite sin regresiones nuevas. (Hay una falla preexistente no relacionada en `src/app/app.spec.ts` — `should render title` — que ya fallaba antes de este plan; no es atribuible a estos cambios.)

- [ ] **Step 8: Probar manualmente en el navegador**

Con el frontend y backend corriendo, verificar en modo consumidor (`/mis-centros`, empresa con activos) que el ícono correcto aparece junto a cada activo, y en modo admin que el combobox "Tipo de activo *" del formulario de creación/edición de activo muestra el ícono de cada opción en el dropdown.

Expected: íconos visibles y coherentes con el color/ícono configurado en cada tipo, sin regresiones visuales en el listado de activos ni en el modal de revisión.

- [ ] **Step 9: Commit**

```bash
git add front4/src/app/features/activos/components/activos-list/activos-list.component.html \
        front4/src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.ts \
        front4/src/app/features/centros/pages/mis-centros-page.component.ts \
        front4/src/app/features/centros/pages/mis-centros-page.component.html \
        front4/src/app/features/activos/components/activos-form/activos-form.component.ts
git commit -m "feat(front): propagar icono de tipo de activo a listado, modal de revision, vista consumidor y combobox"
```
