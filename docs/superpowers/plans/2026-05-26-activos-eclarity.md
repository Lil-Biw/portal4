# Activos, Eclarity y campo activo en mantenciones — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar pestaña Eclarity al sidebar, crear entidad Activos (backend + frontend), botón de agregar activo desde centros admin, recuadro 5 en mis-centros consumidor, y campo activo_id opcional en mantenciones.

**Architecture:** Activos es un módulo NestJS independiente (patrón clientes/) con array plano como respuesta. El frontend sigue el patrón service+signals. El sidebar extiende NavItem para soportar enlaces externos. El campo activo_id en mantenciones es opcional y se filtra client-side.

**Tech Stack:** NestJS + Mongoose (backend), Angular 21 standalone + signals (frontend), MongoDB.

---

## Mapa de archivos

### Nuevos
| Archivo | Responsabilidad |
|---|---|
| `back4/src/activos/activos.schema.ts` | Schema Mongoose, colección `activos` |
| `back4/src/activos/activos.dto.ts` | CreateActivoDto, UpdateActivoDto |
| `back4/src/activos/activos.service.ts` | CRUD + soft delete |
| `back4/src/activos/activos.controller.ts` | Endpoints REST |
| `back4/src/activos/activos.module.ts` | Módulo NestJS |
| `front4/src/app/shared/models/activo.model.ts` | Interfaces Activo, CreateActivoDto |
| `front4/src/app/features/activos/activos.service.ts` | Signals + HTTP |
| `front4/src/app/features/activos/components/activos-form/activos-form.component.ts` | Dumb form |
| `front4/src/app/features/activos/components/activos-list/activos-list.component.ts` | Dumb list |
| `front4/src/app/features/activos/pages/activos-page.component.ts` | Smart page admin |
| `front4/src/app/features/activos/pages/activos-page.component.html` | Template admin |

### Modificados
| Archivo | Cambio |
|---|---|
| `back4/src/app.module.ts` | Registrar ActivosModule |
| `back4/src/mantenciones/mantenciones.schema.ts` | Campo opcional `activo_id` |
| `back4/src/mantenciones/mantenciones.dto.ts` | Campo opcional `activo_id` |
| `front4/src/app/layout/sidebar/sidebar.component.ts` | NavItem externo + ítem Eclarity + ítem Activos |
| `front4/src/app/app.routes.ts` | Ruta `/activos` |
| `front4/src/app/shared/models/mantencion.model.ts` | Campo `activo_id?` en interfaces |
| `front4/src/app/features/centros/components/centros-list/centros-list.component.ts` | @Output agregarActivo |
| `front4/src/app/features/centros/components/centros-list/centros-list.component.html` | Botón "+ Activo" |
| `front4/src/app/features/centros/pages/centros-page.component.ts` | Modal activo + ActivosService |
| `front4/src/app/features/centros/pages/centros-page.component.html` | Modal activo |
| `front4/src/app/features/centros/pages/mis-centros-page.component.ts` | Inyectar ActivosService |
| `front4/src/app/features/centros/pages/mis-centros-page.component.html` | Recuadro 5 ACTIVOS |
| `front4/src/app/features/mantenciones/pages/mantenciones-page.component.ts` | activo_id + computed |
| `front4/src/app/features/mantenciones/pages/mantenciones-page.component.html` | Selector activo |

---

## Task 1: Sidebar — Pestaña Eclarity

**Files:**
- Modify: `front4/src/app/layout/sidebar/sidebar.component.ts`

- [ ] **Step 1: Extender NavItem y agregar ítems Eclarity**

Editar `sidebar.component.ts`. Cambiar la interfaz `NavItem` en la línea 10 para soportar enlaces externos, y agregar el ítem Eclarity al final de ambos menús.

Reemplazar la interfaz en la línea 10:
```ts
interface NavItem { label: string; route?: string; icon?: string; external?: boolean; href?: string; }
```

En el array `adminItems` (línea 217 aprox), agregar al final:
```ts
{ label: 'Eclarity', href: 'https://app.clarityenergy.cl/loginv5/', external: true, icon: 'eclarity' },
```

En el array `consumidorItems` (línea 229 aprox), agregar al final:
```ts
{ label: 'Eclarity', href: 'https://app.clarityenergy.cl/loginv5/', external: true, icon: 'eclarity' },
```

- [ ] **Step 2: Agregar icono eclarity al mapa ICONS**

En el objeto `ICONS` (línea 12 aprox), agregar una entrada `eclarity` que retorna un `<img>`:
```ts
eclarity: `<img src="/logotipo_eclarity.png" width="16" height="16" style="object-fit:contain;display:block" alt="Eclarity" />`,
```

- [ ] **Step 3: Actualizar el template para soportar enlaces externos**

En el template del componente (dentro de `template: \`...\``), localizar el bloque `@for (item of menuItems; track item.route)` y reemplazarlo para manejar ítems externos. El bloque actual (aprox línea 50) empieza con:
```html
@for (item of menuItems; track item.route) {
  <a
    class="item"
    [routerLink]="item.route"
    routerLinkActive="active">
```

Reemplazar por:
```html
@for (item of menuItems; track item.label) {
  @if (item.external) {
    <a
      class="item"
      [href]="item.href"
      target="_blank"
      rel="noopener">
      @if (item.icon) {
        <span class="icon" [innerHTML]="getIcon(item.icon)"></span>
      }
      {{ item.label }}
    </a>
  } @else {
    <a
      class="item"
      [routerLink]="item.route"
      routerLinkActive="active">
      @if (item.icon) {
        <span class="icon" [innerHTML]="getIcon(item.icon)"></span>
      }
      {{ item.label }}
    </a>
  }
  <!-- Breadcrumb de centro seleccionado bajo "Centro de costos" -->
  @if (item.route === '/mis-centros' && centroSeleccionado()) {
    <div class="sub-item">
      <span class="sub-icon">↳</span>
      <span class="sub-label">{{ centroSeleccionado()!.nombre }}</span>
    </div>
  }
  <!-- Breadcrumb de proyecto seleccionado bajo "Proyectos" -->
  @if (item.route === '/mis-proyectos' && proyectoSeleccionado()) {
    @if (centroDelProyecto) {
      <div class="sub-item">
        <span class="sub-icon">↳</span>
        <span class="sub-label">{{ centroDelProyecto }}</span>
      </div>
    }
    <div class="sub-item sub-item--project">
      <span class="sub-icon">↳</span>
      <span class="sub-label">{{ proyectoSeleccionado()!.nombre }}</span>
    </div>
  }
}
```

- [ ] **Step 4: Verificar compilación frontend**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4 && npm run build 2>&1 | tail -20
```
Esperado: sin errores de compilación TypeScript.

- [ ] **Step 5: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add front4/src/app/layout/sidebar/sidebar.component.ts
git commit -m "feat(sidebar): agregar pestaña Eclarity con enlace externo en ambos modos"
```

---

## Task 2: Backend — Módulo Activos

**Files:**
- Create: `back4/src/activos/activos.schema.ts`
- Create: `back4/src/activos/activos.dto.ts`
- Create: `back4/src/activos/activos.service.ts`
- Create: `back4/src/activos/activos.controller.ts`
- Create: `back4/src/activos/activos.module.ts`
- Modify: `back4/src/app.module.ts`

- [ ] **Step 1: Crear schema**

Crear `back4/src/activos/activos.schema.ts`:
```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivoDocument = Activo & Document;

@Schema({ collection: 'activos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Activo {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, trim: true }) tipo_activo: string;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ default: true }) activo: boolean;
}

export const ActivoSchema = SchemaFactory.createForClass(Activo);
ActivoSchema.index({ centro_costo_id: 1, activo: 1 });
```

- [ ] **Step 2: Crear DTO**

Crear `back4/src/activos/activos.dto.ts`:
```ts
import { IsString, IsOptional, IsMongoId, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateActivoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @MinLength(2) tipo_activo: string;
  @IsMongoId() centro_costo_id: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class UpdateActivoDto extends PartialType(CreateActivoDto) {}
```

- [ ] **Step 3: Crear service**

Crear `back4/src/activos/activos.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Activo, ActivoDocument } from './activos.schema';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';

@Injectable()
export class ActivosService {
  constructor(@InjectModel('Activo') private activoModel: Model<ActivoDocument>) {}

  async findAll(centroCostoId?: string) {
    const filter: Record<string, unknown> = { activo: true };
    if (centroCostoId) filter['centro_costo_id'] = centroCostoId;
    return this.activoModel.find(filter).lean();
  }

  async findOne(id: string) {
    const activo = await this.activoModel.findById(id).lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async create(dto: CreateActivoDto) {
    const activo = new this.activoModel(dto);
    return activo.save();
  }

  async update(id: string, dto: UpdateActivoDto) {
    const activo = await this.activoModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async remove(id: string) {
    const activo = await this.activoModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return { message: 'Activo desactivado correctamente', id };
  }
}
```

- [ ] **Step 4: Crear controller**

Crear `back4/src/activos/activos.controller.ts`:
```ts
import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ActivosService } from './activos.service';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';

@Controller('activos')
export class ActivosController {
  constructor(private readonly activosService: ActivosService) {}

  @Get()
  findAll(@Query('centro_costo_id') centroCostoId?: string) {
    return this.activosService.findAll(centroCostoId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.activosService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateActivoDto) {
    return this.activosService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateActivoDto) {
    return this.activosService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.activosService.remove(id);
  }
}
```

- [ ] **Step 5: Crear module**

Crear `back4/src/activos/activos.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivoSchema } from './activos.schema';
import { ActivosController } from './activos.controller';
import { ActivosService } from './activos.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Activo', schema: ActivoSchema }])],
  controllers: [ActivosController],
  providers: [ActivosService],
  exports: [ActivosService],
})
export class ActivosModule {}
```

- [ ] **Step 6: Registrar en app.module.ts**

En `back4/src/app.module.ts`, agregar el import al inicio del archivo:
```ts
import { ActivosModule } from './activos/activos.module';
```

Y agregar `ActivosModule` al array `imports` del `@Module`, después de `MantencionesModule`:
```ts
MantencionesModule,
ActivosModule,
NoticiasModule,
```

- [ ] **Step 7: Verificar compilación backend**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npm run build 2>&1 | tail -20
```
Esperado: `Successfully compiled` sin errores.

- [ ] **Step 8: Probar endpoints con servidor**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npm run start:dev &
sleep 5
curl -s http://localhost:3000/api/v1/activos | head -20
```
Esperado: `[]` (array vacío, sin error 404).

```bash
curl -s -X POST http://localhost:3000/api/v1/activos \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Caldera principal","tipo_activo":"Maquinaria","centro_costo_id":"000000000000000000000001"}' | head -40
```
Esperado: error de validación MongoDB (ObjectId inválido) o `{"nombre":"Caldera principal"...}` si hay un centro válido. No debe ser 500.

- [ ] **Step 9: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add back4/src/activos/ back4/src/app.module.ts
git commit -m "feat(backend): agregar módulo Activos con CRUD y soft delete"
```

---

## Task 3: Backend — Campo activo_id en Mantenciones

**Files:**
- Modify: `back4/src/mantenciones/mantenciones.schema.ts`
- Modify: `back4/src/mantenciones/mantenciones.dto.ts`

- [ ] **Step 1: Agregar campo al schema**

En `back4/src/mantenciones/mantenciones.schema.ts`, agregar el campo `activo_id` como opcional después de `centro_costo_id`:
```ts
@Prop({ type: Types.ObjectId, ref: 'Activo' }) activo_id?: Types.ObjectId;
```

El schema completo queda:
```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MantencionDocument = Mantencion & Document;

@Schema({ collection: 'mantenciones', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Mantencion {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoMantencion', required: true }) tipo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Activo' }) activo_id?: Types.ObjectId;
  @Prop({ required: true }) fecha: Date;
}

export const MantencionSchema = SchemaFactory.createForClass(Mantencion);
MantencionSchema.index({ centro_costo_id: 1, fecha: 1 });
```

- [ ] **Step 2: Agregar campo al DTO**

En `back4/src/mantenciones/mantenciones.dto.ts`, agregar `activo_id` como opcional:
```ts
import { IsString, IsOptional, IsMongoId, IsDateString, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateMantencionDto {
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsMongoId() tipo_id: string;
  @IsMongoId() centro_costo_id: string;
  @IsMongoId() @IsOptional() activo_id?: string;
  @IsDateString() fecha: string;
}

export class UpdateMantencionDto extends PartialType(CreateMantencionDto) {}
```

- [ ] **Step 3: Verificar compilación backend**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npm run build 2>&1 | tail -10
```
Esperado: `Successfully compiled` sin errores.

- [ ] **Step 4: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add back4/src/mantenciones/mantenciones.schema.ts back4/src/mantenciones/mantenciones.dto.ts
git commit -m "feat(backend): agregar campo activo_id opcional en mantenciones"
```

---

## Task 4: Frontend — Modelo y service de Activos

**Files:**
- Create: `front4/src/app/shared/models/activo.model.ts`
- Create: `front4/src/app/features/activos/activos.service.ts`

- [ ] **Step 1: Crear modelo**

Crear `front4/src/app/shared/models/activo.model.ts`:
```ts
export interface Activo {
  _id: string;
  nombre: string;
  tipo_activo: string;
  centro_costo_id: string;
  descripcion?: string;
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateActivoDto {
  nombre: string;
  tipo_activo: string;
  centro_costo_id: string;
  descripcion?: string;
}

export type UpdateActivoDto = Partial<CreateActivoDto>;
```

- [ ] **Step 2: Actualizar modelo de Mantencion para incluir activo_id**

En `front4/src/app/shared/models/mantencion.model.ts`, agregar `activo_id?: string` a las interfaces:

```ts
export interface Mantencion {
  _id: string;
  nombre: string;
  descripcion?: string;
  tipo_id: TipoMantencion | string;
  centro_costo_id: string;
  activo_id?: string;
  fecha: string;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateMantencionDto {
  nombre: string;
  descripcion?: string;
  tipo_id: string;
  centro_costo_id: string;
  activo_id?: string;
  fecha: string;
}

export interface UpdateMantencionDto {
  nombre?: string;
  descripcion?: string;
  tipo_id?: string;
  centro_costo_id?: string;
  activo_id?: string;
  fecha?: string;
}
```

- [ ] **Step 3: Crear activos.service.ts**

Crear directorio y archivo:
```bash
mkdir -p /home/biw/Documentos/ECLARITI/PORTAL4/front4/src/app/features/activos
```

Crear `front4/src/app/features/activos/activos.service.ts`:
```ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Activo, CreateActivoDto, UpdateActivoDto } from '../../shared/models/activo.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class ActivosService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  readonly activos      = signal<Activo[]>([]);
  readonly seleccionado = signal<Activo | null>(null);
  readonly status       = signal<Status | null>(null);
  readonly loading      = signal(false);

  cargar(centroCostoId?: string): void {
    this.loading.set(true);
    const url = centroCostoId
      ? this.api.url(`/activos?centro_costo_id=${centroCostoId}`)
      : this.api.url('/activos');
    this.http.get<Activo[]>(url).subscribe({
      next: (res) => { this.activos.set(res); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateActivoDto): void {
    this.http.post<Activo>(this.api.url('/activos'), dto).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo creado correctamente' });
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateActivoDto): void {
    this.http.put<Activo>(this.api.url(`/activos/${id}`), dto).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo actualizado' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/activos/${id}`)).subscribe({
      next: () => {
        this.status.set({ type: 'ok', text: 'Activo eliminado' });
        this.seleccionado.set(null);
        this.cargar();
      },
      error: (err) => this.setError(err),
    });
  }

  seleccionar(activo: Activo): void {
    this.seleccionado.set(activo);
    this.clearStatus();
  }

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4 && npm run build 2>&1 | tail -10
```
Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add front4/src/app/shared/models/activo.model.ts \
        front4/src/app/shared/models/mantencion.model.ts \
        front4/src/app/features/activos/activos.service.ts
git commit -m "feat(frontend): agregar modelo Activo, service y activo_id en mantencion model"
```

---

## Task 5: Frontend — Componentes dumb de Activos

**Files:**
- Create: `front4/src/app/features/activos/components/activos-form/activos-form.component.ts`
- Create: `front4/src/app/features/activos/components/activos-list/activos-list.component.ts`

- [ ] **Step 1: Crear directorios**

```bash
mkdir -p /home/biw/Documentos/ECLARITI/PORTAL4/front4/src/app/features/activos/components/activos-form
mkdir -p /home/biw/Documentos/ECLARITI/PORTAL4/front4/src/app/features/activos/components/activos-list
```

- [ ] **Step 2: Crear activos-form.component.ts**

Crear `front4/src/app/features/activos/components/activos-form/activos-form.component.ts`:
```ts
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Activo, CreateActivoDto } from '../../../../shared/models/activo.model';
import { CentroCosto } from '../../../../shared/models/centro.model';

@Component({
  selector: 'app-activos-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form class="form-grid" (ngSubmit)="enviar()">
      @if (!centroFijo) {
        <div class="field">
          <label>Centro de costos *</label>
          <select [(ngModel)]="form.centro_costo_id" name="centro_costo_id" required>
            <option value="">Selecciona un centro</option>
            @for (c of centros; track c._id) {
              <option [value]="c._id">{{ c.nombre }}</option>
            }
          </select>
        </div>
      } @else {
        <div class="field">
          <label>Centro de costos</label>
          <input type="text" [value]="centroFijo.nombre" disabled />
        </div>
      }
      <div class="field">
        <label>Nombre *</label>
        <input type="text" [(ngModel)]="form.nombre" name="nombre" required placeholder="Ej: Caldera principal" />
      </div>
      <div class="field">
        <label>Tipo de activo *</label>
        <input type="text" [(ngModel)]="form.tipo_activo" name="tipo_activo" required placeholder="Ej: Maquinaria, Vehículo, Infraestructura" />
      </div>
      <div class="field">
        <label>Descripción</label>
        <input type="text" [(ngModel)]="form.descripcion" name="descripcion" placeholder="Descripción opcional" />
      </div>
      <button type="submit" class="btn-primary" [disabled]="!form.nombre || !form.tipo_activo || (!centroFijo && !form.centro_costo_id)">
        {{ submitLabel }}
      </button>
    </form>
  `,
})
export class ActivosFormComponent implements OnChanges {
  @Input() initial: Activo | null = null;
  @Input() centroFijo: CentroCosto | null = null;
  @Input() centros: CentroCosto[] = [];
  @Input() submitLabel = 'Guardar activo';
  @Output() submitted = new EventEmitter<CreateActivoDto>();

  form: CreateActivoDto = { nombre: '', tipo_activo: '', centro_costo_id: '', descripcion: '' };

  ngOnChanges(): void {
    if (this.initial) {
      this.form = {
        nombre: this.initial.nombre,
        tipo_activo: this.initial.tipo_activo,
        centro_costo_id: this.initial.centro_costo_id,
        descripcion: this.initial.descripcion ?? '',
      };
    } else {
      this.form = {
        nombre: '',
        tipo_activo: '',
        centro_costo_id: this.centroFijo?._id ?? '',
        descripcion: '',
      };
    }
    if (this.centroFijo) {
      this.form.centro_costo_id = this.centroFijo._id;
    }
  }

  enviar(): void {
    if (!this.form.nombre || !this.form.tipo_activo || !this.form.centro_costo_id) return;
    const dto: CreateActivoDto = {
      nombre:          this.form.nombre.trim(),
      tipo_activo:     this.form.tipo_activo.trim(),
      centro_costo_id: this.form.centro_costo_id,
    };
    if (this.form.descripcion?.trim()) dto.descripcion = this.form.descripcion.trim();
    this.submitted.emit(dto);
  }
}
```

- [ ] **Step 3: Crear activos-list.component.ts**

Crear `front4/src/app/features/activos/components/activos-list/activos-list.component.ts`:
```ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Activo } from '../../../../shared/models/activo.model';

@Component({
  selector: 'app-activos-list',
  standalone: true,
  template: `
    @if (activos.length === 0) {
      <p class="empty">Sin activos registrados.</p>
    } @else {
      <div class="list">
        @for (a of activos; track a._id) {
          <div class="card" style="display:flex;align-items:center;justify-content:space-between;gap:1rem">
            <div>
              <strong style="display:block;font-size:.9rem;color:#1f2937">{{ a.nombre }}</strong>
              <span style="font-size:.78rem;color:#6b7280">{{ a.tipo_activo }}</span>
              @if (a.descripcion) {
                <span style="display:block;font-size:.78rem;color:#9ca3af">{{ a.descripcion }}</span>
              }
            </div>
            @if (mostrarAcciones) {
              <div style="display:flex;gap:.5rem;flex-shrink:0">
                <button class="btn-ghost btn-sm" (click)="editado.emit(a)">Editar</button>
                <button class="btn-danger btn-sm" (click)="eliminado.emit(a._id)">Eliminar</button>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class ActivosListComponent {
  @Input() activos: Activo[] = [];
  @Input() mostrarAcciones = true;
  @Output() editado   = new EventEmitter<Activo>();
  @Output() eliminado = new EventEmitter<string>();
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4 && npm run build 2>&1 | tail -10
```
Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add front4/src/app/features/activos/components/
git commit -m "feat(frontend): agregar componentes dumb activos-form y activos-list"
```

---

## Task 6: Frontend — Página admin de Activos y ruta

**Files:**
- Create: `front4/src/app/features/activos/pages/activos-page.component.ts`
- Create: `front4/src/app/features/activos/pages/activos-page.component.html`
- Modify: `front4/src/app/app.routes.ts`
- Modify: `front4/src/app/layout/sidebar/sidebar.component.ts`

- [ ] **Step 1: Crear directorio y template HTML**

```bash
mkdir -p /home/biw/Documentos/ECLARITI/PORTAL4/front4/src/app/features/activos/pages
```

Crear `front4/src/app/features/activos/pages/activos-page.component.html`:
```html
<!-- Encabezado -->
<div class="page-header">
  <h2>Activos</h2>
  <div class="header-actions">
    <button class="btn-ghost" (click)="abrirBuscar()">Buscar</button>
    <button class="btn-primary" (click)="abrirCrear()">+ Crear</button>
  </div>
</div>

<app-status-banner [status]="service.status()"></app-status-banner>

<app-activos-list
  [activos]="service.activos()"
  (editado)="abrirEditar($event)"
  (eliminado)="eliminar($event)">
</app-activos-list>

<!-- Modal -->
<div class="modal-backdrop" *ngIf="modal() !== null" (click)="cerrar()">
  <div class="modal" (click)="$event.stopPropagation()">

    <!-- Crear -->
    <ng-container *ngIf="modal() === 'crear'">
      <div class="modal-header">
        <h3>Nuevo activo</h3>
        <button class="modal-close" (click)="cerrar()">&#x2715;</button>
      </div>
      <app-status-banner [status]="service.status()"></app-status-banner>
      <app-activos-form
        submitLabel="Crear activo"
        [centros]="centrosService.centros()"
        (submitted)="crear($event)">
      </app-activos-form>
    </ng-container>

    <!-- Editar -->
    <ng-container *ngIf="modal() === 'editar'">
      <div class="modal-header">
        <h3>Editar activo</h3>
        <button class="modal-close" (click)="cerrar()">&#x2715;</button>
      </div>
      <app-status-banner [status]="service.status()"></app-status-banner>
      <app-activos-form
        [initial]="service.seleccionado()"
        [centros]="centrosService.centros()"
        submitLabel="Guardar cambios"
        (submitted)="actualizar($event)">
      </app-activos-form>
    </ng-container>

    <!-- Buscar -->
    <ng-container *ngIf="modal() === 'buscar'">
      <div class="modal-header">
        <h3>Buscar activo</h3>
        <button class="modal-close" (click)="cerrar()">&#x2715;</button>
      </div>
      <input
        class="search-input"
        type="text"
        placeholder="Nombre o tipo..."
        [ngModel]="busqueda()"
        (ngModelChange)="busqueda.set($event)"
        autofocus />
      <app-activos-list
        [activos]="activosFiltrados()"
        (editado)="editarDesdeBuscar($event)"
        (eliminado)="eliminar($event)">
      </app-activos-list>
    </ng-container>

  </div>
</div>
```

- [ ] **Step 2: Crear activos-page.component.ts**

Crear `front4/src/app/features/activos/pages/activos-page.component.ts`:
```ts
import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivosService } from '../activos.service';
import { CentrosService } from '../../centros/centros.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { ActivosFormComponent } from '../components/activos-form/activos-form.component';
import { ActivosListComponent } from '../components/activos-list/activos-list.component';
import { Activo, CreateActivoDto } from '../../../shared/models/activo.model';

type ModalMode = 'crear' | 'editar' | 'buscar' | null;

@Component({
  selector: 'app-activos-page',
  standalone: true,
  imports: [NgIf, FormsModule, StatusBannerComponent, ActivosFormComponent, ActivosListComponent],
  templateUrl: './activos-page.component.html',
  styles: [`
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .page-header h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #1f2937; }
    .header-actions { display: flex; gap: .6rem; }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15,23,42,.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(15,23,42,.18);
      width: 100%;
      max-width: 640px;
      max-height: 85vh;
      overflow-y: auto;
      padding: 1.5rem;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
    }
    .modal-header h3 { margin: 0; font-size: 1.1rem; font-weight: 700; }
    .modal-close {
      background: none;
      border: none;
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
      color: #6b7280;
      padding: 0 .25rem;
    }
    .modal-close:hover { color: #1f2937; }
    .search-input {
      width: 100%;
      padding: .65rem .9rem;
      border-radius: 8px;
      border: 1px solid rgba(34,33,33,.2);
      font-size: .9rem;
      font-family: inherit;
      margin-bottom: 1rem;
      box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: #0095d6; }
  `],
})
export class ActivosPageComponent implements OnInit {
  protected readonly service       = inject(ActivosService);
  protected readonly centrosService = inject(CentrosService);

  protected modal    = signal<ModalMode>(null);
  protected busqueda = signal('');

  protected activosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.activos();
    return this.service.activos().filter(a =>
      a.nombre.toLowerCase().includes(q) || a.tipo_activo.toLowerCase().includes(q)
    );
  });

  constructor() {
    effect(() => {
      if (this.service.status()?.type === 'ok' && this.modal() !== null && this.modal() !== 'buscar') {
        this.cerrar();
      }
    });
  }

  ngOnInit(): void {
    this.service.cargar();
    this.centrosService.cargar();
  }

  protected abrirCrear(): void {
    this.service.seleccionado.set(null);
    this.service.clearStatus();
    this.modal.set('crear');
  }

  protected abrirBuscar(): void {
    this.busqueda.set('');
    this.service.clearStatus();
    this.modal.set('buscar');
  }

  protected abrirEditar(activo: Activo): void {
    this.service.seleccionar(activo);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.service.seleccionado.set(null);
    this.service.clearStatus();
  }

  protected crear(dto: CreateActivoDto): void   { this.service.crear(dto); }

  protected actualizar(dto: CreateActivoDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto);
  }

  protected eliminar(id: string): void { this.service.eliminar(id); }

  protected editarDesdeBuscar(activo: Activo): void {
    this.service.seleccionar(activo);
    this.modal.set('editar');
  }
}
```

- [ ] **Step 3: Agregar ruta /activos en app.routes.ts**

En `front4/src/app/app.routes.ts`, agregar la ruta dentro del bloque `children`, en la sección `// ── Admin`, después de la ruta `usuarios`:
```ts
{
  path: 'activos',
  loadComponent: () =>
    import('./features/activos/pages/activos-page.component').then(m => m.ActivosPageComponent),
},
```

- [ ] **Step 4: Agregar ítem Activos al sidebar admin**

En `front4/src/app/layout/sidebar/sidebar.component.ts`, en el array `adminItems`, agregar después de `Usuarios`:
```ts
{ label: 'Activos', route: '/activos' },
```

El array `adminItems` completo queda:
```ts
private readonly adminItems: NavItem[] = [
  { label: 'Empresas',          route: '/empresa' },
  { label: 'Centro de costos',  route: '/centros' },
  { label: 'Proyectos',         route: '/proyectos' },
  { label: 'Mantenciones',      route: '/mantenciones' },
  { label: 'Documentos',        route: '/documentos' },
  { label: 'Noticias',          route: '/noticias' },
  { label: 'Usuarios',          route: '/usuarios' },
  { label: 'Activos',           route: '/activos' },
  { label: 'Ayuda',             route: '/ayuda' },
  { label: 'Resumen general',   route: '/resumen' },
  { label: 'Eclarity', href: 'https://app.clarityenergy.cl/loginv5/', external: true, icon: 'eclarity' },
];
```

- [ ] **Step 5: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4 && npm run build 2>&1 | tail -10
```
Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add front4/src/app/features/activos/pages/ \
        front4/src/app/app.routes.ts \
        front4/src/app/layout/sidebar/sidebar.component.ts
git commit -m "feat(frontend): página admin de activos, ruta /activos e ítem en sidebar"
```

---

## Task 7: Frontend — Botón "+ Activo" en centros admin

**Files:**
- Modify: `front4/src/app/features/centros/components/centros-list/centros-list.component.ts`
- Modify: `front4/src/app/features/centros/components/centros-list/centros-list.component.html`
- Modify: `front4/src/app/features/centros/pages/centros-page.component.ts`
- Modify: `front4/src/app/features/centros/pages/centros-page.component.html`

- [ ] **Step 1: Agregar @Output agregarActivo en centros-list.component.ts**

En `front4/src/app/features/centros/components/centros-list/centros-list.component.ts`, agregar el import de `CentroCosto` ya está, solo agregar el output. En la sección de outputs (línea 19 aprox), agregar:
```ts
@Output() agregarActivo = new EventEmitter<CentroCosto>();
```

El bloque de outputs queda:
```ts
@Output() editado       = new EventEmitter<CentroCosto>();
@Output() eliminado     = new EventEmitter<string>();
@Output() verCentro     = new EventEmitter<CentroCosto>();
@Output() agregarActivo = new EventEmitter<CentroCosto>();
```

- [ ] **Step 2: Agregar botón en centros-list.component.html**

En `front4/src/app/features/centros/components/centros-list/centros-list.component.html`, en la sección `.card-actions` (línea 25-29), agregar el botón "+ Activo" antes de "Editar":
```html
<div class="card-actions">
  <button class="btn-ghost btn-sm" (click)="verCentro.emit(c)">Ver centro</button>
  <button class="btn-ghost btn-sm" (click)="agregarActivo.emit(c)">+ Activo</button>
  <button class="btn-ghost btn-sm" (click)="editado.emit(c)">Editar</button>
  <button class="btn-danger"       (click)="eliminado.emit(c._id)">Eliminar</button>
</div>
```

- [ ] **Step 3: Actualizar centros-page.component.ts**

En `front4/src/app/features/centros/pages/centros-page.component.ts`:

1. Agregar los imports necesarios al inicio del archivo:
```ts
import { ActivosService } from '../../activos/activos.service';
import { ActivosFormComponent } from '../../activos/components/activos-form/activos-form.component';
import { CentroCosto } from '../../../shared/models/centro.model';
import { CreateActivoDto } from '../../../shared/models/activo.model';
```

2. Cambiar `type ModalMode` para incluir `'activo'`:
```ts
type ModalMode = 'crear' | 'editar' | 'buscar' | 'activo' | null;
```

3. En el array `imports` del `@Component`, agregar `ActivosFormComponent`:
```ts
imports: [NgIf, FormsModule, StatusBannerComponent, CentroFormComponent, CentrosListComponent, ActivosFormComponent],
```

4. En la clase `CentrosPageComponent`, agregar inyección y signals:
```ts
protected readonly activosService = inject(ActivosService);
protected centroParaActivo = signal<CentroCosto | null>(null);
```

5. Agregar método `abrirAgregarActivo`:
```ts
protected abrirAgregarActivo(centro: CentroCosto): void {
  this.centroParaActivo.set(centro);
  this.activosService.clearStatus();
  this.modal.set('activo');
}
```

6. Actualizar `cerrar()` para limpiar `centroParaActivo`:
```ts
protected cerrar(): void {
  this.modal.set(null);
  this.service.seleccionado.set(null);
  this.service.clearStatus();
  this.centroParaActivo.set(null);
  this.activosService.clearStatus();
}
```

7. Agregar método `crearActivo`:
```ts
protected crearActivo(dto: CreateActivoDto): void {
  this.activosService.crear(dto);
}
```

8. Agregar effect en el constructor para cerrar el modal de activo al éxito:
```ts
constructor() {
  effect(() => {
    if (this.activosService.status()?.type === 'ok' && this.modal() === 'activo') {
      this.cerrar();
    }
  });
}
```

9. Agregar `.cargar()` de activos en `ngOnInit` NO es necesario — el modal de activo solo crea, y tras crear, el service llama `cargar()` internamente.

- [ ] **Step 4: Agregar modal de activo en centros-page.component.html**

En `front4/src/app/features/centros/pages/centros-page.component.html`, agregar el handler `(agregarActivo)` en el tag `app-centros-list`:
```html
<app-centros-list
  [centros]="service.centros()"
  [clientes]="clientesService.clientes()"
  (editado)="abrirEditar($event)"
  (eliminado)="eliminar($event)"
  (verCentro)="irACentro($event)"
  (agregarActivo)="abrirAgregarActivo($event)">
</app-centros-list>
```

Y dentro del `<div class="modal">` (el elemento que contiene los `ng-container`), agregar un nuevo bloque después del último `ng-container`:
```html
<!-- Agregar activo a un centro -->
<ng-container *ngIf="modal() === 'activo'">
  <div class="modal-header">
    <h3>Nuevo activo — {{ centroParaActivo()?.nombre }}</h3>
    <button class="modal-close" (click)="cerrar()">&#x2715;</button>
  </div>
  <app-status-banner [status]="activosService.status()"></app-status-banner>
  <app-activos-form
    submitLabel="Crear activo"
    [centroFijo]="centroParaActivo()"
    (submitted)="crearActivo($event)">
  </app-activos-form>
</ng-container>
```

- [ ] **Step 5: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4 && npm run build 2>&1 | tail -10
```
Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add front4/src/app/features/centros/
git commit -m "feat(frontend): botón agregar activo desde centros admin con modal"
```

---

## Task 8: Frontend — Recuadro 5 "ACTIVOS" en mis-centros (consumidor)

**Files:**
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.ts`
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.html`

- [ ] **Step 1: Inyectar ActivosService en mis-centros-page.component.ts**

Abrir `front4/src/app/features/centros/pages/mis-centros-page.component.ts` y revisar los imports actuales. Agregar:
```ts
import { ActivosService } from '../../activos/activos.service';
```

En la clase del componente, agregar la inyección:
```ts
protected readonly activosService = inject(ActivosService);
```

En el método `seleccionarCentro(c)` (o donde se establece `centroActivo`), agregar la carga de activos. Buscar la línea donde se llama a `this.consumidorContext.seleccionarCentro(c)` o donde se setea el centro activo, y agregar después:
```ts
this.activosService.cargar(asId(c._id));
```

- [ ] **Step 2: Agregar recuadro 5 en el template**

En `front4/src/app/features/centros/pages/mis-centros-page.component.html`, localizar el bloque final de la vista detalle que contiene los recuadros de "Documentos del centro" y "Solicitudes documentales" (el `<div style="display:grid;grid-template-columns:1fr 1fr...` de la línea 224 aprox).

Agregar un nuevo recuadro debajo de ese grid, dentro del `@if (centroActivo)` pero después del grid de documentos/solicitudes:
```html
<!-- Recuadro 5: Activos del centro -->
<div class="card" style="margin-top:1rem">
  <h3 style="margin:0 0 .75rem;font-size:.95rem;font-weight:700;color:#1f2937">Activos del centro</h3>
  @if (activosService.loading()) {
    <p style="color:#9ca3af;font-size:.85rem;margin:0">Cargando activos...</p>
  } @else if (activosService.activos().length === 0) {
    <p style="color:#9ca3af;font-size:.85rem;margin:0">Sin activos registrados para este centro.</p>
  } @else {
    <div style="display:flex;flex-direction:column;gap:.4rem">
      @for (a of activosService.activos(); track a._id) {
        <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .65rem;border-radius:8px;border:1px solid rgba(34,33,33,.08)">
          <div>
            <span style="display:block;font-size:.84rem;font-weight:600;color:#1f2937">{{ a.nombre }}</span>
            <span style="font-size:.74rem;color:#6b7280">{{ a.tipo_activo }}</span>
            @if (a.descripcion) {
              <span style="display:block;font-size:.74rem;color:#9ca3af">{{ a.descripcion }}</span>
            }
          </div>
        </div>
      }
    </div>
  }
</div>
```

- [ ] **Step 3: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4 && npm run build 2>&1 | tail -10
```
Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add front4/src/app/features/centros/pages/mis-centros-page.component.ts \
        front4/src/app/features/centros/pages/mis-centros-page.component.html
git commit -m "feat(frontend): recuadro 5 ACTIVOS en detalle de centro consumidor"
```

---

## Task 9: Frontend — Campo activo en form de mantenciones

**Files:**
- Modify: `front4/src/app/features/mantenciones/pages/mantenciones-page.component.ts`
- Modify: `front4/src/app/features/mantenciones/pages/mantenciones-page.component.html`

- [ ] **Step 1: Agregar activo_id al MantencionForm e inyectar ActivosService**

En `front4/src/app/features/mantenciones/pages/mantenciones-page.component.ts`:

1. Agregar import de `ActivosService` y `Activo`:
```ts
import { ActivosService } from '../../activos/activos.service';
import { Activo } from '../../../shared/models/activo.model';
```

2. Agregar `activo_id` a la interfaz `MantencionForm` (línea 18 aprox):
```ts
interface MantencionForm {
  nombre: string;
  descripcion: string;
  tipo_id: string;
  empresa_id: string;
  centro_costo_id: string;
  activo_id: string;
  fecha: string;
}
```

3. Actualizar `emptyForm` (línea 33 aprox):
```ts
function emptyForm(fecha = ''): MantencionForm {
  return { nombre: '', descripcion: '', tipo_id: '', empresa_id: '', centro_costo_id: '', activo_id: '', fecha };
}
```

4. Inyectar `ActivosService` en la clase (junto a las otras inyecciones, línea 51 aprox):
```ts
protected readonly activosService = inject(ActivosService);
```

5. Agregar computed `activosParaCentro` justo después de `centrosParaEmpresa`:
```ts
protected activosParaCentro = computed(() => {
  const centroId = this.form().centro_costo_id;
  if (!centroId) return [] as Activo[];
  return this.activosService.activos().filter(a => a.centro_costo_id === centroId);
});
```

6. En `ngOnInit`, agregar carga de activos:
```ts
ngOnInit(): void {
  this.service.cargar();
  this.tiposService.cargar();
  this.centrosService.cargar();
  this.clientesService.cargar();
  this.activosService.cargar();
}
```

7. En `patchForm`, cuando cambia `centro_costo_id`, resetear `activo_id`. Actualizar `patchForm` (línea 228 aprox):
```ts
patchForm(field: keyof MantencionForm, value: string): void {
  this.form.update(f => {
    const updated = { ...f, [field]: value };
    if (field === 'centro_costo_id') updated.activo_id = '';
    return updated;
  });
}
```

8. En `guardar()` (línea 232 aprox), incluir `activo_id` en el dto:
```ts
guardar(): void {
  const f = this.form();
  if (!f.nombre.trim() || !f.tipo_id || !f.centro_costo_id || !f.fecha) return;
  const dto: Record<string, unknown> = {
    nombre:          f.nombre.trim(),
    descripcion:     f.descripcion.trim() || undefined,
    tipo_id:         f.tipo_id,
    centro_costo_id: f.centro_costo_id,
    fecha:           f.fecha,
  };
  if (f.activo_id) dto['activo_id'] = f.activo_id;
  const id = this.editingId();
  if (id) this.service.actualizar(id, dto as any);
  else    this.service.crear(dto as any);
}
```

   Nota: el service acepta `CreateMantencionDto` que ya tiene `activo_id?: string` — si el service no acepta `any`, actualizar la firma de `MantencionesService.crear/actualizar` para usar la interfaz actualizada de `mantencion.model.ts`.

9. En `abrirEditar`, agregar `activo_id` al form (línea 206 aprox):
```ts
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
    activo_id:       m.activo_id ?? '',
    fecha:           m.fecha.slice(0, 10),
  });
  this.showModal.set(true);
  this.service.clearStatus();
}
```

- [ ] **Step 2: Agregar selector de activo en el template del modal**

En `front4/src/app/features/mantenciones/pages/mantenciones-page.component.html`, dentro del modal (`<!-- ══ MODAL MANTENCIÓN ═══════════════════════════════════════════════════ -->`), localizar el selector de centro (el `<div class="field">` que contiene el `<select>` de `centro_costo_id`). Agregar el selector de activo inmediatamente después:

```html
@if (form().centro_costo_id && activosParaCentro().length > 0) {
  <div class="field">
    <label>Activo (opcional)</label>
    <select
      [ngModel]="form().activo_id"
      (ngModelChange)="patchForm('activo_id', $event)"
      name="activo_id">
      <option value="">— Sin activo —</option>
      @for (a of activosParaCentro(); track a._id) {
        <option [value]="a._id">{{ a.nombre }} ({{ a.tipo_activo }})</option>
      }
    </select>
  </div>
}
```

- [ ] **Step 3: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4 && npm run build 2>&1 | tail -10
```
Esperado: sin errores. Si hay error de tipos en `guardar()`, actualizar `MantencionesService` para aceptar `CreateMantencionDto` importando la interfaz actualizada (ya tiene `activo_id?`).

- [ ] **Step 4: Commit final**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4
git add front4/src/app/features/mantenciones/pages/
git commit -m "feat(frontend): selector de activo en form de mantenciones con filtro por centro"
```

---

## Verificación final

- [ ] **Levantar backend y frontend**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npm run start:dev &
cd /home/biw/Documentos/ECLARITI/PORTAL4/front4 && npm start
```

- [ ] **Checklist manual**

1. Sidebar modo admin: aparece ítem "Activos" y pestaña "Eclarity" al final.
2. Sidebar modo consumidor: aparece pestaña "Eclarity" al final.
3. Clic en Eclarity → abre `https://app.clarityenergy.cl/loginv5/` en nueva pestaña.
4. En `/centros` (admin), cada centro tiene botón "+ Activo" → abre modal con nombre del centro en título.
5. Crear activo desde el modal del centro → el activo queda guardado (verificar en `/activos`).
6. En `/activos` (admin): crear, editar, eliminar activos funciona correctamente.
7. En modo consumidor, `/mis-centros`, seleccionar un centro → recuadro 5 "Activos del centro" aparece al final del detalle.
8. En `/mantenciones` (admin), al crear una mantención: seleccionar empresa → aparece selector de centro → seleccionar centro con activos → aparece selector de activo opcional.
9. Al cambiar el centro en el form, el selector de activo se resetea.
