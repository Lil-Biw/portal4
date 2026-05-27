# Mantenciones: Activos Múltiples + Detalle Consumidor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir asociar múltiples activos a una mantención (admin) y mostrar un modal de detalle con historial al hacer clic en una mantención (consumidor).

**Architecture:** El backend cambia `activo_id` (ObjectId único) por `activo_ids` (array de ObjectIds) en schema, DTO y service. El frontend actualiza el modelo, el formulario admin (checkboxes en vez de select), y agrega modal de detalle en la vista consumidor con historial calculado client-side.

**Tech Stack:** NestJS + Mongoose (backend), Angular 21 standalone + signals (frontend)

---

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `back4/src/mantenciones/mantenciones.schema.ts` | `activo_id?` → `activo_ids: []` |
| `back4/src/mantenciones/mantenciones.dto.ts` | `activo_id?` → `activo_ids?: string[]` |
| `back4/src/mantenciones/mantenciones.service.ts` | Convertir `activo_ids` a ObjectIds en create/update |
| `front4/src/app/shared/models/mantencion.model.ts` | `activo_id?` → `activo_ids?: string[]` en interfaces |
| `front4/src/app/features/mantenciones/pages/mantenciones-page.component.ts` | Form interface, lógica de checkboxes |
| `front4/src/app/features/mantenciones/pages/mantenciones-page.component.html` | Reemplazar `<select>` de activo por checkboxes |
| `front4/src/app/features/mantenciones/pages/mis-mantenciones-page.component.ts` | Signal detalle, computed historial, inyectar ActivosService |
| `front4/src/app/features/mantenciones/pages/mis-mantenciones-page.component.html` | Click en chips + modal detalle |

---

### Task 1: Backend — Schema y DTO

**Files:**
- Modify: `back4/src/mantenciones/mantenciones.schema.ts`
- Modify: `back4/src/mantenciones/mantenciones.dto.ts`

- [ ] **Step 1: Actualizar schema**

Reemplaza todo el contenido de `back4/src/mantenciones/mantenciones.schema.ts`:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MantencionDocument = Mantencion & Document;

@Schema({ collection: 'mantenciones', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Mantencion {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoMantencion', required: true }) tipo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Activo' }], default: [] }) activo_ids: Types.ObjectId[];
  @Prop({ required: true }) fecha: Date;
}

export const MantencionSchema = SchemaFactory.createForClass(Mantencion);
MantencionSchema.index({ centro_costo_id: 1, fecha: 1 });
```

- [ ] **Step 2: Actualizar DTO**

Reemplaza todo el contenido de `back4/src/mantenciones/mantenciones.dto.ts`:

```typescript
import { IsString, IsOptional, IsMongoId, IsDateString, MinLength, IsArray } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateMantencionDto {
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() tipo_id: string;
  @IsMongoId() centro_costo_id: string;
  @IsArray() @IsMongoId({ each: true }) @IsOptional() activo_ids?: string[];
  @IsDateString() fecha: string;
}

export class UpdateMantencionDto extends PartialType(CreateMantencionDto) {}
```

- [ ] **Step 3: Commit**

```bash
cd back4
git add src/mantenciones/mantenciones.schema.ts src/mantenciones/mantenciones.dto.ts
git commit -m "feat(mantenciones): cambiar activo_id por activo_ids array en schema y DTO"
```

---

### Task 2: Backend — Service

**Files:**
- Modify: `back4/src/mantenciones/mantenciones.service.ts`

- [ ] **Step 1: Actualizar create y update para convertir activo_ids**

Reemplaza todo el contenido de `back4/src/mantenciones/mantenciones.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MantencionDocument } from './mantenciones.schema';
import { CreateMantencionDto, UpdateMantencionDto } from './mantenciones.dto';

@Injectable()
export class MantencionesService {
  constructor(
    @InjectModel('Mantencion') private mantencionModel: Model<MantencionDocument>,
  ) {}

  findAll(centroCostoId?: string, desde?: string, hasta?: string) {
    const filter: Record<string, unknown> = {};
    if (centroCostoId) filter['centro_costo_id'] = new Types.ObjectId(centroCostoId);
    if (desde || hasta) {
      filter['fecha'] = {};
      if (desde) (filter['fecha'] as Record<string, Date>)['$gte'] = new Date(desde);
      if (hasta) (filter['fecha'] as Record<string, Date>)['$lte'] = new Date(hasta);
    }
    return this.mantencionModel
      .find(filter)
      .populate('tipo_id')
      .sort({ fecha: 1 })
      .lean();
  }

  async findOne(id: string) {
    const m = await this.mantencionModel.findById(id).populate('tipo_id').lean();
    if (!m) throw new NotFoundException(`Mantención ${id} no encontrada`);
    return m;
  }

  async create(dto: CreateMantencionDto) {
    const m = await new this.mantencionModel({
      ...dto,
      tipo_id: new Types.ObjectId(dto.tipo_id),
      centro_costo_id: new Types.ObjectId(dto.centro_costo_id),
      activo_ids: (dto.activo_ids ?? []).map(id => new Types.ObjectId(id)),
      fecha: new Date(dto.fecha),
    }).save();
    return this.mantencionModel.findById(m._id).populate('tipo_id').lean();
  }

  async update(id: string, dto: UpdateMantencionDto) {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.tipo_id) payload['tipo_id'] = new Types.ObjectId(dto.tipo_id);
    if (dto.centro_costo_id) payload['centro_costo_id'] = new Types.ObjectId(dto.centro_costo_id);
    if (dto.fecha) payload['fecha'] = new Date(dto.fecha);
    if (dto.activo_ids !== undefined) {
      payload['activo_ids'] = dto.activo_ids.map(aid => new Types.ObjectId(aid));
    }

    const m = await this.mantencionModel
      .findByIdAndUpdate(id, payload, { new: true })
      .populate('tipo_id')
      .lean();
    if (!m) throw new NotFoundException(`Mantención ${id} no encontrada`);
    return m;
  }

  async remove(id: string) {
    const m = await this.mantencionModel.findByIdAndDelete(id).lean();
    if (!m) throw new NotFoundException(`Mantención ${id} no encontrada`);
    return { message: 'Mantención eliminada', id };
  }
}
```

- [ ] **Step 2: Verificar que el servidor levanta sin errores**

```bash
cd back4
npm run start:dev
```

Esperado: servidor en `http://localhost:3000/api/v1` sin errores de compilación.

- [ ] **Step 3: Commit**

```bash
git add src/mantenciones/mantenciones.service.ts
git commit -m "feat(mantenciones): convertir activo_ids a ObjectIds en create/update"
```

---

### Task 3: Frontend — Modelo

**Files:**
- Modify: `front4/src/app/shared/models/mantencion.model.ts`

- [ ] **Step 1: Actualizar interfaces**

Reemplaza todo el contenido de `front4/src/app/shared/models/mantencion.model.ts`:

```typescript
export interface TipoMantencion {
  _id: string;
  nombre: string;
  color: string;
  descripcion?: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface Mantencion {
  _id: string;
  nombre: string;
  descripcion?: string;
  tipo_id: TipoMantencion | string;
  centro_costo_id: string;
  activo_ids?: string[];
  fecha: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateMantencionDto {
  nombre: string;
  descripcion?: string;
  tipo_id: string;
  centro_costo_id: string;
  activo_ids?: string[];
  fecha: string;
}

export interface UpdateMantencionDto {
  nombre?: string;
  descripcion?: string;
  tipo_id?: string;
  centro_costo_id?: string;
  activo_ids?: string[];
  fecha?: string;
}

export interface CreateTipoMantencionDto {
  nombre: string;
  color?: string;
  descripcion?: string;
}

export interface UpdateTipoMantencionDto {
  nombre?: string;
  color?: string;
  descripcion?: string;
}
```

- [ ] **Step 2: Commit**

```bash
cd front4
git add src/app/shared/models/mantencion.model.ts
git commit -m "feat(mantenciones): modelo activo_ids array en interfaces frontend"
```

---

### Task 4: Frontend Admin — Lógica del formulario

**Files:**
- Modify: `front4/src/app/features/mantenciones/pages/mantenciones-page.component.ts`

El archivo actualmente tiene la interfaz `MantencionForm` con `activo_id: string`. Hay que cambiarla a `activo_ids: string[]` y ajustar todos los métodos que la usan.

- [ ] **Step 1: Cambiar la interfaz MantencionForm y emptyForm**

En `mantenciones-page.component.ts`, líneas 19–37, reemplaza la interfaz y función:

```typescript
interface MantencionForm {
  nombre: string;
  descripcion: string;
  tipo_id: string;
  empresa_id: string;
  centro_costo_id: string;
  activo_ids: string[];
  fecha: string;
}

function emptyForm(fecha = ''): MantencionForm {
  return { nombre: '', descripcion: '', tipo_id: '', empresa_id: '', centro_costo_id: '', activo_ids: [], fecha };
}
```

- [ ] **Step 2: Cambiar patchForm para manejar activo_ids**

Reemplaza el método `patchForm` (actualmente en línea ~236):

```typescript
patchForm(field: keyof MantencionForm, value: string | string[]): void {
  if (field === 'centro_costo_id') {
    this.form.update(f => ({ ...f, centro_costo_id: value as string, activo_ids: [] }));
  } else {
    this.form.update(f => ({ ...f, [field]: value }));
  }
}

toggleActivo(activoId: string): void {
  this.form.update(f => {
    const ids = f.activo_ids.includes(activoId)
      ? f.activo_ids.filter(id => id !== activoId)
      : [...f.activo_ids, activoId];
    return { ...f, activo_ids: ids };
  });
}
```

- [ ] **Step 3: Cambiar abrirEditar para cargar activo_ids**

Reemplaza el método `abrirEditar` (actualmente en línea ~213):

```typescript
abrirEditar(m: Mantencion): void {
  this.editingId.set(m._id);
  const centroId = asId(m.centro_costo_id);
  const centro = this.centrosService.centros().find(c => asId(c._id) === centroId);
  this.form.set({
    nombre:          m.nombre,
    descripcion:     m.descripcion ?? '',
    tipo_id:         asId(typeof m.tipo_id === 'object' ? (m.tipo_id as TipoMantencion)._id : m.tipo_id),
    empresa_id:      centro ? asId(centro.cliente_id) : '',
    centro_costo_id: centroId,
    activo_ids:      m.activo_ids ?? [],
    fecha:           m.fecha.slice(0, 10),
  });
  this.showModal.set(true);
  this.service.clearStatus();
}
```

- [ ] **Step 4: Cambiar guardar para enviar activo_ids**

Reemplaza el método `guardar` (actualmente en línea ~244):

```typescript
guardar(): void {
  const f = this.form();
  if (!f.nombre.trim() || !f.tipo_id || !f.centro_costo_id || !f.fecha) return;
  const dto = {
    nombre:          f.nombre.trim(),
    descripcion:     f.descripcion.trim() || undefined,
    tipo_id:         f.tipo_id,
    centro_costo_id: f.centro_costo_id,
    activo_ids:      f.activo_ids.length > 0 ? f.activo_ids : undefined,
    fecha:           f.fecha,
  };
  const id = this.editingId();
  if (id) this.service.actualizar(id, dto);
  else    this.service.crear(dto);
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/features/mantenciones/pages/mantenciones-page.component.ts
git commit -m "feat(mantenciones): formulario admin usa activo_ids array con toggle"
```

---

### Task 5: Frontend Admin — Template checkboxes

**Files:**
- Modify: `front4/src/app/features/mantenciones/pages/mantenciones-page.component.html`

- [ ] **Step 1: Reemplazar el campo activo en el modal**

En `mantenciones-page.component.html`, reemplaza el bloque `@if (form().centro_costo_id && activosParaCentro().length > 0)` (líneas 226–236):

```html
@if (form().centro_costo_id && activosParaCentro().length > 0) {
  <div class="field">
    <label>Activos (opcional)</label>
    <div style="display:flex;flex-direction:column;gap:.35rem;max-height:160px;overflow-y:auto;border:1px solid rgba(34,33,33,.2);border-radius:8px;padding:.5rem .75rem">
      @for (a of activosParaCentro(); track a._id) {
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.875rem;color:#374151">
          <input
            type="checkbox"
            [checked]="form().activo_ids.includes(a._id)"
            (change)="toggleActivo(a._id)"
            style="accent-color:#0095d6;width:15px;height:15px" />
          <span>{{ a.nombre }}</span>
          <span style="font-size:.75rem;color:#9ca3af">{{ a.tipo_activo }}</span>
        </label>
      }
    </div>
  </div>
}
```

- [ ] **Step 2: Verificar en el navegador (dev server)**

```bash
cd front4
npm start
```

Abrir `http://localhost:4200`, ir a Mantenciones (admin), crear/editar una mantención con un centro que tenga activos. Verificar que aparece la lista de checkboxes y se pueden seleccionar varios.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/mantenciones/pages/mantenciones-page.component.html
git commit -m "feat(mantenciones): checkboxes multi-activo en formulario admin"
```

---

### Task 6: Frontend Consumidor — Modal detalle (lógica)

**Files:**
- Modify: `front4/src/app/features/mantenciones/pages/mis-mantenciones-page.component.ts`

- [ ] **Step 1: Agregar imports y ActivosService**

Al inicio del archivo, agrega `ActivosService` al import:

```typescript
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MantencionesService } from '../mantenciones.service';
import { TiposMantencionService } from '../tipos-mantencion.service';
import { CentrosService } from '../../centros/centros.service';
import { ActivosService } from '../../activos/activos.service';
import { ConsumidorContextService } from '../../../profile/consumidor-context.service';
import { Mantencion, TipoMantencion } from '../../../shared/models/mantencion.model';
import { asId, toDateKey } from '../../../shared/utils';
```

- [ ] **Step 2: Inyectar ActivosService y agregar signals de detalle**

En la clase `MisMantencionesPageComponent`, después de `private readonly ctx = inject(ConsumidorContextService);`, agrega:

```typescript
protected readonly activosService = inject(ActivosService);

protected mantencionDetalle = signal<Mantencion | null>(null);

protected activosDetalle = computed(() => {
  const m = this.mantencionDetalle();
  if (!m || !m.activo_ids?.length) return [];
  return this.activosService.activos().filter(a => m.activo_ids!.includes(asId(a._id)));
});

protected historialDetalle = computed(() => {
  const m = this.mantencionDetalle();
  if (!m) return [];
  const tipoId   = asId(typeof m.tipo_id === 'object' ? (m.tipo_id as TipoMantencion)._id : m.tipo_id as string);
  const centroId = asId(m.centro_costo_id);
  return this.service.mantenciones()
    .filter(x =>
      x._id !== m._id &&
      asId(typeof x.tipo_id === 'object' ? (x.tipo_id as TipoMantencion)._id : x.tipo_id as string) === tipoId &&
      asId(x.centro_costo_id) === centroId
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 5);
});

protected centroNombre(m: Mantencion): string {
  return this.centrosService.centros().find(c => asId(c._id) === asId(m.centro_costo_id))?.nombre ?? '';
}

protected tipoDeMantencion(m: Mantencion): TipoMantencion | null {
  if (typeof m.tipo_id === 'object') return m.tipo_id as TipoMantencion;
  return this.tiposService.tipos().find(t => t._id === asId(m.tipo_id as string)) ?? null;
}

abrirDetalle(m: Mantencion): void { this.mantencionDetalle.set(m); }
cerrarDetalle(): void { this.mantencionDetalle.set(null); }
```

- [ ] **Step 3: Agregar ActivosService.cargar() en ngOnInit**

Reemplaza `ngOnInit`:

```typescript
ngOnInit(): void {
  this.tiposService.cargar();
  this.service.cargar();
  this.centrosService.cargar();
  this.activosService.cargar();
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/features/mantenciones/pages/mis-mantenciones-page.component.ts
git commit -m "feat(mantenciones): lógica modal detalle consumidor con historial y activos"
```

---

### Task 7: Frontend Consumidor — Template modal detalle

**Files:**
- Modify: `front4/src/app/features/mantenciones/pages/mis-mantenciones-page.component.html`

- [ ] **Step 1: Agregar (click) a los chips del calendario**

En el HTML, en la **vista mes** (línea ~51), reemplaza el `<div class="cal-event-chip">` (solo lectura):

```html
@for (m of mantencionesEnDia(cell.date); track m._id) {
  <div
    class="cal-event-chip"
    [style.background]="colorDeMantencion(m)"
    [title]="m.nombre"
    style="cursor:pointer"
    (click)="$event.stopPropagation(); abrirDetalle(m)">
    {{ m.nombre }}
  </div>
}
```

En la **vista semana** (línea ~73), igual:

```html
@for (m of mantencionesEnDia(day); track m._id) {
  <div
    class="cal-event-chip"
    [style.background]="colorDeMantencion(m)"
    [title]="m.nombre"
    style="cursor:pointer"
    (click)="abrirDetalle(m)">
    {{ m.nombre }}
  </div>
}
```

- [ ] **Step 2: Agregar el modal al final del HTML**

Agrega al final del archivo, después de la leyenda de tipos:

```html
<!-- Modal detalle mantención -->
@if (mantencionDetalle() !== null) {
  @let m = mantencionDetalle()!;
  @let tipo = tipoDeMantencion(m);
  <div class="modal-overlay" (click)="cerrarDetalle()">
    <div class="modal-box" (click)="$event.stopPropagation()">

      <!-- Encabezado con color del tipo -->
      <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.25rem">
        @if (tipo) {
          <span style="display:inline-block;width:14px;height:14px;border-radius:50%;flex-shrink:0"
                [style.background]="tipo.color"></span>
        }
        <div style="flex:1">
          <h3 style="margin:0;font-size:1.1rem;font-weight:700;color:#1f2937">{{ m.nombre }}</h3>
          <span style="font-size:.8rem;color:#6b7280">{{ m.fecha.slice(0,10) }}</span>
        </div>
        <button
          style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#6b7280;padding:0 .25rem;line-height:1"
          (click)="cerrarDetalle()">&#x2715;</button>
      </div>

      <!-- Info -->
      <div style="display:flex;flex-direction:column;gap:.6rem;margin-bottom:1.25rem">
        <div style="display:flex;gap:.5rem;font-size:.875rem">
          <span style="color:#6b7280;min-width:90px">Tipo</span>
          <span style="color:#1f2937;font-weight:600">{{ tipo?.nombre ?? '—' }}</span>
        </div>
        <div style="display:flex;gap:.5rem;font-size:.875rem">
          <span style="color:#6b7280;min-width:90px">Centro</span>
          <span style="color:#1f2937">{{ centroNombre(m) }}</span>
        </div>
        @if (m.descripcion) {
          <div style="display:flex;gap:.5rem;font-size:.875rem">
            <span style="color:#6b7280;min-width:90px">Descripción</span>
            <span style="color:#374151">{{ m.descripcion }}</span>
          </div>
        }
      </div>

      <!-- Activos asociados -->
      @if (activosDetalle().length > 0) {
        <div style="margin-bottom:1.25rem">
          <p style="font-size:.8rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 .5rem">
            Activos asociados
          </p>
          <div style="display:flex;flex-direction:column;gap:.35rem">
            @for (a of activosDetalle(); track a._id) {
              <div style="display:flex;align-items:center;gap:.5rem;padding:.35rem .6rem;background:#f9fafb;border-radius:6px;font-size:.875rem">
                <span style="color:#1f2937;font-weight:500">{{ a.nombre }}</span>
                <span style="color:#9ca3af;font-size:.75rem">{{ a.tipo_activo }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Historial -->
      @if (historialDetalle().length > 0) {
        <div>
          <p style="font-size:.8rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 .5rem">
            Historial (mismo tipo · mismo centro)
          </p>
          <div style="display:flex;flex-direction:column;gap:.3rem">
            @for (h of historialDetalle(); track h._id) {
              <div style="display:flex;align-items:center;justify-content:space-between;padding:.3rem .6rem;background:#f9fafb;border-radius:6px;font-size:.83rem">
                <span style="color:#374151">{{ h.nombre }}</span>
                <span style="color:#9ca3af">{{ h.fecha.slice(0,10) }}</span>
              </div>
            }
          </div>
        </div>
      }

    </div>
  </div>
}
```

- [ ] **Step 3: Verificar en el navegador**

Con `npm start` activo, ir a Mis Mantenciones (modo consumidor). Hacer clic en un chip de mantención. Verificar que:
- Se abre el modal con nombre, fecha, tipo, centro
- Si la mantención tiene activos, aparecen listados
- Si hay otras mantenciones del mismo tipo en el mismo centro, aparecen en historial
- Hacer clic fuera del modal lo cierra

- [ ] **Step 4: Commit**

```bash
git add src/app/features/mantenciones/pages/mis-mantenciones-page.component.html
git commit -m "feat(mantenciones): modal detalle consumidor con activos e historial"
```

---

### Task 8: Push y verificación en Vercel

- [ ] **Step 1: Push backend**

```bash
cd back4
git push
```

Vercel redeploya automáticamente. Esperar ~1 minuto.

- [ ] **Step 2: Push frontend**

```bash
cd front4
git add -A
git push
```

- [ ] **Step 3: Verificar en producción**

1. Crear una mantención en admin seleccionando 2+ activos — verificar que se guardan
2. Editar esa mantención — verificar que los checkboxes muestran los activos ya seleccionados
3. En consumidor, hacer clic en esa mantención — verificar modal con activos e historial
