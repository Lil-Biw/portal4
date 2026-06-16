# Tipos de Activo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un catálogo predefinido de `TipoActivo` (nombre + color) gestionable solo por super_admin, con botón junto a "Crear activo", reemplazando el campo `tipo_activo` string libre por una FK.

**Architecture:** Nuevo módulo NestJS `tipos-activo` (copia exacta del patrón de `tipos-actividad`). El schema de `activos` cambia `tipo_activo: string` → `tipo_activo_id: ObjectId ref TipoActivo`. Frontend: nuevo `TiposActivoService`, panel inline en `activos-page`, select en el form.

**Tech Stack:** NestJS + Mongoose (backend), Angular 21 standalone + signals (frontend).

---

## Archivos a crear/modificar

**Backend — crear:**
- `back4/src/tipos-activo/tipos-activo.schema.ts`
- `back4/src/tipos-activo/tipos-activo.dto.ts`
- `back4/src/tipos-activo/tipos-activo.service.ts`
- `back4/src/tipos-activo/tipos-activo.controller.ts`
- `back4/src/tipos-activo/tipos-activo.module.ts`
- `back4/scripts/migrate-tipos-activo.js`

**Backend — modificar:**
- `back4/src/activos/activos.schema.ts` — campo tipo_activo_id
- `back4/src/activos/activos.dto.ts` — campo tipo_activo_id
- `back4/src/activos/activos.service.ts` — populate tipo_activo_id
- `back4/src/activos/activos.module.ts` — importar TipoActivoSchema
- `back4/src/app.module.ts` — importar TiposActivoModule

**Frontend — crear:**
- `front4/src/app/features/activos/tipos-activo.service.ts`

**Frontend — modificar:**
- `front4/src/app/shared/models/activo.model.ts` — TipoActivo + campo tipo_activo_id
- `front4/src/app/features/activos/components/activos-form/activos-form.component.ts` — select tipos
- `front4/src/app/features/activos/components/activos-list/activos-list.component.ts` — input tipos
- `front4/src/app/features/activos/components/activos-list/activos-list.component.html` — color dot
- `front4/src/app/features/activos/pages/activos-page.component.ts` — panel tipos
- `front4/src/app/features/activos/pages/activos-page.component.html` — botón + panel

---

## Task 1: Módulo backend `tipos-activo`

**Files:**
- Create: `back4/src/tipos-activo/tipos-activo.schema.ts`
- Create: `back4/src/tipos-activo/tipos-activo.dto.ts`
- Create: `back4/src/tipos-activo/tipos-activo.service.ts`
- Create: `back4/src/tipos-activo/tipos-activo.controller.ts`
- Create: `back4/src/tipos-activo/tipos-activo.module.ts`

- [ ] **Step 1: Crear `tipos-activo.schema.ts`**

```ts
// back4/src/tipos-activo/tipos-activo.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TipoActivoDocument = TipoActivo & Document;

@Schema({ collection: 'tipos_activo', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoActivo {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#0095d6' }) color: string;
}

export const TipoActivoSchema = SchemaFactory.createForClass(TipoActivo);
```

- [ ] **Step 2: Crear `tipos-activo.dto.ts`**

```ts
// back4/src/tipos-activo/tipos-activo.dto.ts
import { IsString, IsOptional, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateTipoActivoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() color?: string;
}

export class UpdateTipoActivoDto extends PartialType(CreateTipoActivoDto) {}
```

- [ ] **Step 3: Crear `tipos-activo.service.ts`**

```ts
// back4/src/tipos-activo/tipos-activo.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TipoActivoDocument } from './tipos-activo.schema';
import { CreateTipoActivoDto, UpdateTipoActivoDto } from './tipos-activo.dto';

@Injectable()
export class TiposActivoService {
  constructor(
    @InjectModel('TipoActivo') private tipoModel: Model<TipoActivoDocument>,
  ) {}

  findAll() {
    return this.tipoModel.find().sort({ nombre: 1 }).lean();
  }

  async findOne(id: string) {
    const tipo = await this.tipoModel.findById(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de activo ${id} no encontrado`);
    return tipo;
  }

  create(dto: CreateTipoActivoDto) {
    return new this.tipoModel(dto).save();
  }

  async update(id: string, dto: UpdateTipoActivoDto) {
    const tipo = await this.tipoModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!tipo) throw new NotFoundException(`Tipo de activo ${id} no encontrado`);
    return tipo;
  }

  async remove(id: string) {
    const tipo = await this.tipoModel.findByIdAndDelete(id).lean();
    if (!tipo) throw new NotFoundException(`Tipo de activo ${id} no encontrado`);
    return { message: 'Tipo eliminado', id };
  }
}
```

- [ ] **Step 4: Crear `tipos-activo.controller.ts`**

```ts
// back4/src/tipos-activo/tipos-activo.controller.ts
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { TiposActivoService } from './tipos-activo.service';
import { CreateTipoActivoDto, UpdateTipoActivoDto } from './tipos-activo.dto';
import { Roles } from '../common/guards/guards';

@Controller('tipos-activo')
export class TiposActivoController {
  constructor(private readonly service: TiposActivoService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(id); }

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateTipoActivoDto) { return this.service.create(dto); }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateTipoActivoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
```

- [ ] **Step 5: Crear `tipos-activo.module.ts`**

```ts
// back4/src/tipos-activo/tipos-activo.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TipoActivoSchema } from './tipos-activo.schema';
import { TiposActivoController } from './tipos-activo.controller';
import { TiposActivoService } from './tipos-activo.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'TipoActivo', schema: TipoActivoSchema }]),
  ],
  controllers: [TiposActivoController],
  providers: [TiposActivoService],
  exports: [TiposActivoService],
})
export class TiposActivoModule {}
```

- [ ] **Step 6: Registrar en `app.module.ts`**

En `back4/src/app.module.ts`, añadir el import:

```ts
import { TiposActivoModule } from './tipos-activo/tipos-activo.module';
```

Y en el array `imports`:

```ts
TiposActivoModule,
```

Añadirlo después de `TiposActividadModule`.

- [ ] **Step 7: Commit**

```bash
git add back4/src/tipos-activo/ back4/src/app.module.ts
git commit -m "feat(backend): módulo tipos-activo con CRUD y guard super_admin"
```

---

## Task 2: Actualizar schema y service de activos (backend)

**Files:**
- Modify: `back4/src/activos/activos.schema.ts`
- Modify: `back4/src/activos/activos.dto.ts`
- Modify: `back4/src/activos/activos.service.ts`
- Modify: `back4/src/activos/activos.module.ts`

- [ ] **Step 1: Actualizar `activos.schema.ts`**

Reemplazar el campo `tipo_activo` por `tipo_activo_id`:

```ts
// back4/src/activos/activos.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export interface DocActivo {
  nombre: string;
  nombre_display: string;
  tamano_bytes: number;
  tipo_mime: string;
  contenido?: Buffer;
}

export type ActivoDocument = Activo & Document;

@Schema({ collection: 'activos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Activo {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoActivo', required: true }) tipo_activo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ default: true }) activo: boolean;
  @Prop({
    type: [{
      nombre:         { type: String, required: true },
      nombre_display: { type: String, required: true },
      tamano_bytes:   { type: Number, required: true },
      tipo_mime:      { type: String, required: true },
      contenido:      { type: Buffer, required: true },
    }],
    default: [],
  })
  documentos: DocActivo[];
}

export const ActivoSchema = SchemaFactory.createForClass(Activo);
ActivoSchema.index({ centro_costo_id: 1, activo: 1 });
ActivoSchema.index({ tipo_activo_id: 1 });
```

- [ ] **Step 2: Actualizar `activos.dto.ts`**

```ts
// back4/src/activos/activos.dto.ts
import { IsString, IsOptional, IsMongoId, MinLength } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateActivoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsMongoId() tipo_activo_id: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsString() @IsOptional() descripcion?: string;
}

export class UpdateActivoDto extends PartialType(CreateActivoDto) {}
```

- [ ] **Step 3: Actualizar `activos.service.ts`**

Añadir `.populate('tipo_activo_id')` en `findAll`, `findAllByEmpresa`, `findOne` y `update`. También actualizar `create` para convertir `tipo_activo_id` a `ObjectId`:

```ts
// back4/src/activos/activos.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activo, ActivoDocument } from './activos.schema';
import { CreateActivoDto, UpdateActivoDto } from './activos.dto';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';

@Injectable()
export class ActivosService {
  constructor(
    @InjectModel('Activo') private activoModel: Model<ActivoDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
  ) {}

  async findAll(centroCostoId?: string) {
    const filter: Record<string, unknown> = { activo: true };
    if (centroCostoId) {
      filter['centro_costo_id'] = {
        $in: [centroCostoId, new Types.ObjectId(centroCostoId)],
      };
    }
    return this.activoModel.find(filter).populate('tipo_activo_id').select('-documentos.contenido').lean();
  }

  async findAllByEmpresa(empresaId: string, centroCostoId?: string) {
    const centros = await this.centroCostoModel
      .find({ cliente_id: new Types.ObjectId(empresaId), activo: true })
      .select('_id')
      .lean();
    const centroIds = centros.map((c) => c._id);
    const filter: Record<string, unknown> = {
      activo: true,
      centro_costo_id: { $in: centroIds },
    };
    if (centroCostoId) {
      filter['centro_costo_id'] = {
        $in: [
          ...centroIds,
          new Types.ObjectId(centroCostoId),
          centroCostoId,
        ],
      };
    }
    return this.activoModel.find(filter).populate('tipo_activo_id').select('-documentos.contenido').lean();
  }

  async findOne(id: string) {
    const activo = await this.activoModel.findById(id).populate('tipo_activo_id').select('-documentos.contenido').lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async create(dto: CreateActivoDto) {
    const activo = new this.activoModel({
      ...dto,
      tipo_activo_id: new Types.ObjectId(dto.tipo_activo_id),
      centro_costo_id: new Types.ObjectId(dto.centro_costo_id),
    });
    return activo.save();
  }

  async update(id: string, dto: UpdateActivoDto) {
    const updateData: Record<string, unknown> = { ...dto };
    if (dto.tipo_activo_id) updateData['tipo_activo_id'] = new Types.ObjectId(dto.tipo_activo_id);
    const activo = await this.activoModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate('tipo_activo_id')
      .select('-documentos.contenido')
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return activo;
  }

  async remove(id: string) {
    const activo = await this.activoModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .select('-documentos.contenido')
      .lean();
    if (!activo) throw new NotFoundException(`Activo ${id} no encontrado`);
    return { message: 'Activo desactivado correctamente', id };
  }

  async subirDocumento(
    id: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    nombreDisplay?: string,
  ) {
    const a = await this.activoModel.findById(id).lean();
    if (!a) throw new NotFoundException(`Activo ${id} no encontrado`);

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;

    const docEntry = {
      nombre,
      nombre_display: nombreDisplay?.trim() || archivo.originalname,
      tamano_bytes:   archivo.size,
      tipo_mime:      archivo.mimetype,
      contenido:      archivo.buffer,
    };

    return this.activoModel
      .findByIdAndUpdate(id, { $push: { documentos: docEntry } }, { new: true })
      .select('-documentos.contenido')
      .lean();
  }

  async eliminarDocumento(id: string, nombre: string) {
    const a = await this.activoModel.findById(id).lean();
    if (!a) throw new NotFoundException(`Activo ${id} no encontrado`);

    return this.activoModel
      .findByIdAndUpdate(id, { $pull: { documentos: { nombre } } }, { new: true })
      .select('-documentos.contenido')
      .lean();
  }

  async servirDocumento(id: string, nombre: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const a = await this.activoModel.findById(id);
    if (!a) throw new NotFoundException(`Activo ${id} no encontrado`);

    const doc = a.documentos.find(d => d.nombre === nombre);
    if (!doc) throw new NotFoundException(`Documento ${nombre} no encontrado`);

    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);

    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }
}
```

- [ ] **Step 4: Actualizar `activos.module.ts`**

Añadir `TipoActivoSchema` al `MongooseModule.forFeature`:

```ts
// back4/src/activos/activos.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivoSchema } from './activos.schema';
import { ActivosController } from './activos.controller';
import { ActivosAdminController } from './activos-admin.controller';
import { ActivosService } from './activos.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { TipoActivoSchema } from '../tipos-activo/tipos-activo.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: 'Activo', schema: ActivoSchema },
    { name: 'CentroCosto', schema: CentroCostoSchema },
    { name: 'TipoActivo', schema: TipoActivoSchema },
  ])],
  controllers: [ActivosController, ActivosAdminController],
  providers: [ActivosService],
  exports: [ActivosService],
})
export class ActivosModule {}
```

- [ ] **Step 5: Commit**

```bash
git add back4/src/activos/
git commit -m "feat(backend): activos usa tipo_activo_id FK con populate a TipoActivo"
```

---

## Task 3: Script de migración de datos

**Files:**
- Create: `back4/scripts/migrate-tipos-activo.js`

- [ ] **Step 1: Crear el script**

```js
// back4/scripts/migrate-tipos-activo.js
// Ejecutar UNA sola vez antes de desplegar: node scripts/migrate-tipos-activo.js
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

async function migrate() {
  await mongoose.connect(MONGODB_URI);
  console.log('Conectado a MongoDB');

  const db = mongoose.connection.db;
  const activos = db.collection('activos');
  const tiposActivo = db.collection('tipos_activo');

  // Obtener todos los activos con campo tipo_activo (legacy string)
  const docs = await activos.find({ tipo_activo: { $exists: true } }).toArray();
  console.log(`Activos con tipo_activo legacy: ${docs.length}`);

  if (docs.length === 0) {
    console.log('Nada que migrar.');
    await mongoose.disconnect();
    return;
  }

  // Crear mapa de nombre → ObjectId
  const nombreToId = new Map();
  const nombresUnicos = [...new Set(docs.map(d => d.tipo_activo))];

  for (const nombre of nombresUnicos) {
    const existente = await tiposActivo.findOne({ nombre });
    if (existente) {
      nombreToId.set(nombre, existente._id);
      console.log(`Tipo existente reutilizado: ${nombre}`);
    } else {
      const result = await tiposActivo.insertOne({ nombre, color: '#0095d6', creado_en: new Date(), actualizado_en: new Date() });
      nombreToId.set(nombre, result.insertedId);
      console.log(`Tipo creado: ${nombre}`);
    }
  }

  // Actualizar activos: añadir tipo_activo_id y eliminar tipo_activo
  let actualizados = 0;
  for (const doc of docs) {
    const tipoId = nombreToId.get(doc.tipo_activo);
    await activos.updateOne(
      { _id: doc._id },
      { $set: { tipo_activo_id: tipoId }, $unset: { tipo_activo: '' } }
    );
    actualizados++;
  }

  console.log(`\nMigración completa: ${actualizados} activos actualizados.`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Ejecutar la migración** (con el backend detenido)

```bash
cd back4
node scripts/migrate-tipos-activo.js
```

Salida esperada: lista de tipos creados/reutilizados y "Migración completa: N activos actualizados."

- [ ] **Step 3: Commit**

```bash
git add back4/scripts/migrate-tipos-activo.js
git commit -m "feat(backend): script de migración tipo_activo string → tipo_activo_id FK"
```

---

## Task 4: Modelo frontend actualizado

**Files:**
- Modify: `front4/src/app/shared/models/activo.model.ts`

- [ ] **Step 1: Actualizar el modelo**

```ts
// front4/src/app/shared/models/activo.model.ts
export interface DocActivo {
  nombre: string;
  nombre_display: string;
  tamano_bytes: number;
  tipo_mime: string;
}

export interface TipoActivo {
  _id: string;
  nombre: string;
  color: string;
}

export interface CreateTipoActivoDto {
  nombre: string;
  color: string;
}

export type UpdateTipoActivoDto = Partial<CreateTipoActivoDto>;

export interface Activo {
  _id: string;
  nombre: string;
  tipo_activo_id: string | TipoActivo;
  centro_costo_id: string;
  descripcion?: string;
  activo: boolean;
  documentos?: DocActivo[];
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateActivoDto {
  nombre: string;
  tipo_activo_id: string;
  centro_costo_id: string;
  descripcion?: string;
}

export type UpdateActivoDto = Partial<CreateActivoDto>;
```

- [ ] **Step 2: Commit**

```bash
git add front4/src/app/shared/models/activo.model.ts
git commit -m "feat(frontend): modelo TipoActivo + campo tipo_activo_id en Activo"
```

---

## Task 5: Service frontend `TiposActivoService`

**Files:**
- Create: `front4/src/app/features/activos/tipos-activo.service.ts`

- [ ] **Step 1: Crear el service**

```ts
// front4/src/app/features/activos/tipos-activo.service.ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { TipoActivo, CreateTipoActivoDto, UpdateTipoActivoDto } from '../../shared/models/activo.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class TiposActivoService {
  private readonly http = inject(HttpClient);
  private readonly api  = inject(ApiService);

  readonly tipos   = signal<TipoActivo[]>([]);
  readonly loading = signal(false);
  readonly status  = signal<Status | null>(null);

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    this.status.set({ type: 'error', text: err?.error?.message ?? 'Error inesperado' });
  }

  cargar(): void {
    this.loading.set(true);
    this.http.get<TipoActivo[]>(this.api.url('/tipos-activo')).subscribe({
      next:  data => { this.tipos.set(data); this.loading.set(false); },
      error: err  => { this.loading.set(false); this.setError(err); },
    });
  }

  crear(dto: CreateTipoActivoDto): void {
    this.http.post<TipoActivo>(this.api.url('/tipos-activo'), dto).subscribe({
      next:  tipo => { this.tipos.update(list => [...list, tipo]); this.status.set({ type: 'ok', text: 'Tipo creado correctamente' }); },
      error: err  => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateTipoActivoDto): void {
    this.http.put<TipoActivo>(this.api.url(`/tipos-activo/${id}`), dto).subscribe({
      next:  updated => { this.tipos.update(list => list.map(t => t._id === id ? updated : t)); this.status.set({ type: 'ok', text: 'Tipo actualizado correctamente' }); },
      error: err     => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/tipos-activo/${id}`)).subscribe({
      next:  () => { this.tipos.update(list => list.filter(t => t._id !== id)); this.status.set({ type: 'ok', text: 'Tipo eliminado' }); },
      error: err => this.setError(err),
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add front4/src/app/features/activos/tipos-activo.service.ts
git commit -m "feat(frontend): TiposActivoService con CRUD y signals"
```

---

## Task 6: Actualizar `activos-form.component.ts`

**Files:**
- Modify: `front4/src/app/features/activos/components/activos-form/activos-form.component.ts`

- [ ] **Step 1: Reemplazar el componente completo**

El cambio clave: añadir `@Input() tipos: TipoActivo[] = []`, cambiar `form.tipo_activo` por `form.tipo_activo_id`, y reemplazar el `<input type="text">` del tipo por un `<select>`.

```ts
// front4/src/app/features/activos/components/activos-form/activos-form.component.ts
import {
  Component, EventEmitter, Input, OnChanges, Output,
  SimpleChanges, computed, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Activo, CreateActivoDto, DocActivo, TipoActivo } from '../../../../shared/models/activo.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { asId } from '../../../../shared/utils';

export interface DocPendiente { file: File; nombre: string; }

@Component({
  selector: 'app-activos-form',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .form-dos-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem 2rem;
      align-items: start;
    }
    .col-params { display: flex; flex-direction: column; gap: .75rem; }
    .col-docs   { display: flex; flex-direction: column; gap: .5rem; }
    .col-docs h4 {
      margin: 0 0 .4rem;
      font-size: .85rem;
      font-weight: 700;
      color: #374151;
    }
    .doc-lista {
      max-height: 180px;
      overflow-y: auto;
      border: 1px solid rgba(34,33,33,.15);
      border-radius: 8px;
      padding: .35rem .6rem;
      margin-bottom: .35rem;
    }
    .doc-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: .4rem;
      padding: .3rem 0;
      border-bottom: 1px solid #f3f4f6;
      font-size: .81rem;
    }
    .doc-item:last-child { border-bottom: none; }
    .doc-nombre {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #1f2937;
    }
    .doc-acciones { display: flex; gap: .3rem; flex-shrink: 0; }
    .doc-empty { font-size: .8rem; color: #9ca3af; padding: .3rem 0; }
    .doc-upload { display: flex; flex-direction: column; gap: .35rem; margin-top: .25rem; }
    .doc-file-input {
      font-size: .8rem;
      padding: .25rem;
      border: 1px solid rgba(34,33,33,.2);
      border-radius: .375rem;
      width: 100%;
      box-sizing: border-box;
    }
    .doc-nombre-input {
      font-size: .82rem;
      padding: .35rem .55rem;
      border: 1px solid rgba(34,33,33,.2);
      border-radius: .375rem;
      width: 100%;
      box-sizing: border-box;
    }
    .form-footer {
      display: flex;
      justify-content: flex-end;
      gap: .5rem;
      margin-top: 1.25rem;
      padding-top: 1rem;
      border-top: 1px solid #f3f4f6;
    }
    @media (max-width: 600px) {
      .form-dos-col { grid-template-columns: 1fr; }
    }
  `],
  template: `
    <form (ngSubmit)="enviar()">
      <div class="form-dos-col">

        <!-- ── Columna izquierda: parámetros ── -->
        <div class="col-params">
          @if (!centroFijo) {
            <div class="field">
              <label>Empresa *</label>
              <select [ngModel]="empresaId()" name="empresa_id" (ngModelChange)="onEmpresaChange($event)">
                <option value="">Selecciona una empresa</option>
                @for (e of clientes; track e._id) {
                  <option [value]="e._id">{{ e.razon_social }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label>Centro de costos *</label>
              <select [(ngModel)]="form.centro_costo_id" name="centro_costo_id" [disabled]="!empresaId()" required>
                <option value="">{{ empresaId() ? 'Selecciona un centro' : 'Primero selecciona una empresa' }}</option>
                @for (c of centrosFiltrados(); track c._id) {
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
            <select [(ngModel)]="form.tipo_activo_id" name="tipo_activo_id" required>
              <option value="">Selecciona un tipo</option>
              @for (t of tipos; track t._id) {
                <option [value]="t._id">{{ t.nombre }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label>Descripción</label>
            <input type="text" [(ngModel)]="form.descripcion" name="descripcion" placeholder="Descripción opcional" />
          </div>
        </div>

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
                @for (doc of docsExistentes; track doc.nombre) {
                  <div class="doc-item">
                    <span class="doc-nombre" [title]="doc.nombre_display">{{ doc.nombre_display }}</span>
                    <div class="doc-acciones">
                      <button type="button" class="btn-ghost btn-sm" (click)="onDescargarDoc(doc.nombre, doc.nombre_display)">↓</button>
                      <button type="button" class="btn-danger btn-sm" (click)="onEliminarDoc(doc.nombre)">✕</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <p class="doc-empty">Sin documentos adjuntos.</p>
            }
          }

          <!-- Upload -->
          <div class="doc-upload">
            @if (fileInputVisible()) {
              <input type="file" class="doc-file-input" (change)="onFileSelected($event)" />
            }
            <input type="text" class="doc-nombre-input"
              [(ngModel)]="nombreInput" name="doc_nombre"
              placeholder="Nombre del documento (opcional)" />
            @if (!editingId) {
              <button type="button" class="btn-ghost btn-sm"
                (click)="agregarPendiente()" [disabled]="!fileSelected">
                + Agregar a la lista
              </button>
            } @else {
              <button type="button" class="btn-primary btn-sm"
                (click)="subirExistente()" [disabled]="!fileSelected">
                Adjuntar
              </button>
            }
          </div>
        </div>

      </div>

      <!-- Footer -->
      <div class="form-footer">
        <button type="button" class="btn-ghost" (click)="cancelar.emit()">Cancelar</button>
        <button type="submit" class="btn-primary"
          [disabled]="!form.nombre || !form.tipo_activo_id || (!centroFijo && !form.centro_costo_id)">
          {{ submitLabel }}
        </button>
      </div>
    </form>
  `,
})
export class ActivosFormComponent implements OnChanges {
  @Input() initial: Activo | null = null;
  @Input() centroFijo: CentroCosto | null = null;
  @Input() centros: CentroCosto[] = [];
  @Input() clientes: Cliente[] = [];
  @Input() tipos: TipoActivo[] = [];
  @Input() editingId: string | null = null;
  @Input() docsPendientes: DocPendiente[] = [];
  @Input() docsExistentes: DocActivo[] = [];
  @Input() submitLabel = 'Guardar activo';

  @Output() submitted       = new EventEmitter<CreateActivoDto>();
  @Output() cancelar        = new EventEmitter<void>();
  @Output() docAgregado     = new EventEmitter<DocPendiente>();
  @Output() docQuitado      = new EventEmitter<number>();
  @Output() docSubido       = new EventEmitter<DocPendiente>();
  @Output() docEliminado    = new EventEmitter<string>();
  @Output() docDescargado   = new EventEmitter<{ nombre: string; nombreDisplay?: string }>();

  empresaId = signal('');
  form: CreateActivoDto = { nombre: '', tipo_activo_id: '', centro_costo_id: '', descripcion: '' };

  fileSelected: File | null = null;
  nombreInput = '';
  fileInputVisible = signal(true);

  private _centros = signal<CentroCosto[]>([]);

  centrosFiltrados = computed(() => {
    if (!this.empresaId()) return [];
    return this._centros().filter(c => asId(c.cliente_id) === this.empresaId());
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['centros']) {
      this._centros.set(this.centros);
    }
    if (changes['initial']) {
      if (this.initial) {
        const tipoId = typeof this.initial.tipo_activo_id === 'object'
          ? (this.initial.tipo_activo_id as TipoActivo)._id
          : this.initial.tipo_activo_id as string;
        this.form = {
          nombre:          this.initial.nombre,
          tipo_activo_id:  tipoId,
          centro_costo_id: this.initial.centro_costo_id,
          descripcion:     this.initial.descripcion ?? '',
        };
        const centro = this.centros.find(c => asId(c._id) === asId(this.initial!.centro_costo_id));
        this.empresaId.set(centro ? asId(centro.cliente_id) : '');
      } else {
        this.form = {
          nombre:          '',
          tipo_activo_id:  '',
          centro_costo_id: this.centroFijo?._id ?? '',
          descripcion:     '',
        };
        this.empresaId.set('');
      }
      if (this.centroFijo) {
        this.form.centro_costo_id = this.centroFijo._id;
      }
    }
  }

  onEmpresaChange(empresaId: string): void {
    this.empresaId.set(empresaId);
    this.form.centro_costo_id = '';
  }

  onFileSelected(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.fileSelected = file;
    if (file && !this.nombreInput) {
      this.nombreInput = file.name.replace(/\.[^/.]+$/, '');
    }
  }

  agregarPendiente(): void {
    if (!this.fileSelected) return;
    this.docAgregado.emit({
      file: this.fileSelected,
      nombre: this.nombreInput || this.fileSelected.name,
    });
    this.fileSelected = null;
    this.nombreInput = '';
    this.fileInputVisible.set(false);
    setTimeout(() => this.fileInputVisible.set(true), 0);
  }

  subirExistente(): void {
    if (!this.fileSelected) return;
    this.docSubido.emit({
      file: this.fileSelected,
      nombre: this.nombreInput || this.fileSelected.name,
    });
    this.fileSelected = null;
    this.nombreInput = '';
    this.fileInputVisible.set(false);
    setTimeout(() => this.fileInputVisible.set(true), 0);
  }

  onQuitarDoc(index: number): void    { this.docQuitado.emit(index); }
  onEliminarDoc(nombre: string): void { this.docEliminado.emit(nombre); }
  onDescargarDoc(nombre: string, nombreDisplay: string): void {
    this.docDescargado.emit({ nombre, nombreDisplay });
  }

  enviar(): void {
    if (!this.form.nombre || !this.form.tipo_activo_id || !this.form.centro_costo_id) return;
    const dto: CreateActivoDto = {
      nombre:          this.form.nombre.trim(),
      tipo_activo_id:  this.form.tipo_activo_id,
      centro_costo_id: this.form.centro_costo_id,
    };
    if (this.form.descripcion?.trim()) dto.descripcion = this.form.descripcion.trim();
    this.submitted.emit(dto);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add front4/src/app/features/activos/components/activos-form/
git commit -m "feat(frontend): activos-form usa select de TipoActivo en lugar de texto libre"
```

---

## Task 7: Actualizar `activos-list.component`

**Files:**
- Modify: `front4/src/app/features/activos/components/activos-list/activos-list.component.ts`
- Modify: `front4/src/app/features/activos/components/activos-list/activos-list.component.html`

- [ ] **Step 1: Añadir `@Input() tipos` y helper en el TS**

En `activos-list.component.ts`, añadir el import de `TipoActivo`, el `@Input() tipos`, actualizar `_tipos` signal y añadir el método `tipoDeActivo`:

```ts
// front4/src/app/features/activos/components/activos-list/activos-list.component.ts
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, signal } from '@angular/core';
import { Activo, TipoActivo } from '../../../../shared/models/activo.model';
import { CentroCosto } from '../../../../shared/models/centro.model';
import { Cliente } from '../../../../shared/models/cliente.model';
import { asId } from '../../../../shared/utils';

interface GrupoCentro  { centro: CentroCosto; activos: Activo[]; }
interface GrupoEmpresa { empresa: Cliente; centros: GrupoCentro[]; }

@Component({
  selector: 'app-activos-list',
  standalone: true,
  templateUrl: './activos-list.component.html',
})
export class ActivosListComponent implements OnChanges {
  @Input() activos: Activo[]      = [];
  @Input() centros: CentroCosto[] = [];
  @Input() clientes: Cliente[]    = [];
  @Input() tipos: TipoActivo[]    = [];
  @Input() mostrarAcciones = true;
  @Output() editado   = new EventEmitter<Activo>();
  @Output() eliminado = new EventEmitter<string>();

  private _activos  = signal<Activo[]>([]);
  private _centros  = signal<CentroCosto[]>([]);
  private _clientes = signal<Cliente[]>([]);
  private _tipos    = signal<TipoActivo[]>([]);

  ngOnChanges(_: SimpleChanges): void {
    this._activos.set(this.activos);
    this._centros.set(this.centros);
    this._clientes.set(this.clientes);
    this._tipos.set(this.tipos);
  }

  grupos = computed((): GrupoEmpresa[] => {
    const map = new Map<string, GrupoEmpresa>();

    for (const activo of this._activos()) {
      const centro = this._centros().find(c => asId(c._id) === asId(activo.centro_costo_id));
      if (!centro) continue;

      const empresaId = asId(centro.cliente_id);
      const empresa   = this._clientes().find(e => asId(e._id) === empresaId);
      if (!empresa) continue;

      if (!map.has(empresaId)) {
        map.set(empresaId, { empresa, centros: [] });
      }
      const ge = map.get(empresaId)!;

      let gc = ge.centros.find(x => asId(x.centro._id) === asId(centro._id));
      if (!gc) {
        gc = { centro, activos: [] };
        ge.centros.push(gc);
      }
      gc.activos.push(activo);
    }

    return Array.from(map.values());
  });

  totalActivos(ge: GrupoEmpresa): number {
    return ge.centros.reduce((sum, gc) => sum + gc.activos.length, 0);
  }

  centroNombre(a: Activo): string {
    return this._centros().find(c => asId(c._id) === asId(a.centro_costo_id))?.nombre ?? '';
  }

  tipoDeActivo(a: Activo): TipoActivo | null {
    if (typeof a.tipo_activo_id === 'object') return a.tipo_activo_id as TipoActivo;
    return this._tipos().find(t => t._id === asId(a.tipo_activo_id as string)) ?? null;
  }
}
```

- [ ] **Step 2: Actualizar el HTML para mostrar punto de color y nombre del tipo**

Reemplazar la línea `<span class="rut">{{ a.tipo_activo }}</span>` con el punto de color + nombre del tipo:

```html
<!-- front4/src/app/features/activos/components/activos-list/activos-list.component.html -->
@if (grupos().length === 0) {
  <p class="empty">Sin activos registrados.</p>
}

<div class="grupos">
  @for (ge of grupos(); track ge.empresa._id) {
    <div class="grupo-empresa">

      <!-- Cabecera empresa -->
      <div class="grupo-header">
        <span class="grupo-label">{{ ge.empresa.razon_social }}</span>
        <span class="grupo-count">{{ totalActivos(ge) }} activo{{ totalActivos(ge) !== 1 ? 's' : '' }}</span>
      </div>

      <div class="grupo-body" style="gap:.75rem">
        @for (gc of ge.centros; track gc.centro._id) {
          <div class="grupo-centro">
            <!-- Cabecera centro -->
            <div class="grupo-header grupo-header--centro">
              <span class="grupo-label grupo-label--centro">{{ gc.centro.nombre }}</span>
              <span class="grupo-count">Cód. {{ gc.centro.codigo }}</span>
            </div>

            <!-- Activos del centro -->
            <div class="grupo-body list">
              @for (a of gc.activos; track a._id) {
                <div class="card">
                  <div class="card-main">
                    <strong>{{ a.nombre }}</strong>
                    @let tipo = tipoDeActivo(a);
                    @if (tipo) {
                      <span class="rut" style="display:flex;align-items:center;gap:.4rem">
                        <span style="width:10px;height:10px;border-radius:50%;flex-shrink:0"
                          [style.background]="tipo.color"></span>
                        {{ tipo.nombre }}
                      </span>
                    }
                    @if (a.descripcion) {
                      <span class="email">{{ a.descripcion }}</span>
                    }
                  </div>
                  @if (mostrarAcciones) {
                    <div class="card-actions">
                      <button class="btn-ghost btn-sm" (click)="editado.emit(a)">Editar</button>
                      <button class="btn-danger"       (click)="eliminado.emit(a._id)">Eliminar</button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }
      </div>

    </div>
  }
</div>
```

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/features/activos/components/activos-list/
git commit -m "feat(frontend): activos-list muestra tipo con punto de color"
```

---

## Task 8: Actualizar `activos-page.component`

**Files:**
- Modify: `front4/src/app/features/activos/pages/activos-page.component.ts`
- Modify: `front4/src/app/features/activos/pages/activos-page.component.html`

- [ ] **Step 1: Actualizar el TS de la page**

```ts
// front4/src/app/features/activos/pages/activos-page.component.ts
import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivosService } from '../activos.service';
import { TiposActivoService } from '../tipos-activo.service';
import { CentrosService } from '../../centros/centros.service';
import { ClientesService } from '../../clientes/clientes.service';
import { AuthService } from '../../auth/auth.service';
import { StatusBannerComponent } from '../../../shared/components/status-banner/status-banner.component';
import { ActivosFormComponent, DocPendiente } from '../components/activos-form/activos-form.component';
import { ActivosListComponent } from '../components/activos-list/activos-list.component';
import { Activo, CreateActivoDto, DocActivo, TipoActivo } from '../../../shared/models/activo.model';

type ModalMode = 'crear' | 'editar' | 'buscar' | null;

interface TipoForm { nombre: string; color: string; }
function emptyTipoForm(): TipoForm { return { nombre: '', color: '#0095d6' }; }

@Component({
  selector: 'app-activos-page',
  standalone: true,
  imports: [FormsModule, StatusBannerComponent, ActivosFormComponent, ActivosListComponent],
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
      max-width: 860px;
      max-height: 90vh;
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
    .tipos-section {
      border: 1px solid rgba(34,33,33,.1);
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(15,23,42,.04);
      overflow: hidden;
      margin-top: 1.25rem;
    }
    .tipos-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: .85rem 1rem;
      cursor: pointer;
      user-select: none;
      transition: background .1s;
    }
    .tipos-header:hover { background: rgba(34,33,33,.02); }
    .tipos-title { margin: 0; font-size: .95rem; font-weight: 700; color: #1f2937; }
    .tipos-chevron { font-size: .8rem; color: #9ca3af; }
    .tipos-empty { padding: 1rem; color: #9ca3af; font-size: .85rem; margin: 0; }
    .tipos-list { display: flex; flex-direction: column; gap: 0; padding: 0 1rem 1rem; }
    .tipo-item {
      display: flex;
      align-items: center;
      gap: .6rem;
      padding: .55rem 0;
      border-bottom: 1px solid rgba(34,33,33,.06);
    }
    .tipo-item:last-child { border-bottom: none; }
    .tipo-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .tipo-nombre { font-size: .85rem; font-weight: 600; color: #1f2937; }
    .tipo-actions { display: flex; gap: .35rem; margin-left: auto; flex-shrink: 0; }
    .tipo-form-inline {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: .6rem;
      padding: .75rem 1rem;
      background: #f9fafb;
      border-top: 1px solid rgba(34,33,33,.06);
      border-bottom: 1px solid rgba(34,33,33,.06);
    }
    .tipo-input {
      padding: .45rem .7rem;
      border: 1px solid rgba(34,33,33,.2);
      border-radius: 8px;
      font-size: .85rem;
      font-family: inherit;
      min-width: 160px;
    }
    .tipo-input:focus { outline: 2px solid #0095d6; border-color: transparent; }
  `],
})
export class ActivosPageComponent implements OnInit {
  protected readonly service         = inject(ActivosService);
  protected readonly tiposService    = inject(TiposActivoService);
  protected readonly centrosService  = inject(CentrosService);
  protected readonly clientesService = inject(ClientesService);
  private readonly authService       = inject(AuthService);

  protected puedeGestionarTipos = computed(() =>
    this.authService.usuarioActual()?.rol === 'super_admin'
  );

  protected modal     = signal<ModalMode>(null);
  protected busqueda  = signal('');
  protected editingId = signal<string | null>(null);

  protected docsPendientes: DocPendiente[] = [];
  protected subiendoDocs = false;

  protected activosFiltrados = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    if (!q) return this.service.activos();
    return this.service.activos().filter(a => {
      const tipo = this.tipoDeActivo(a);
      return a.nombre.toLowerCase().includes(q) ||
        (tipo?.nombre ?? '').toLowerCase().includes(q);
    });
  });

  protected get activoEditando(): Activo | null {
    const id = this.editingId();
    return id ? this.service.activos().find(a => a._id === id) ?? null : null;
  }

  protected get docsExistentes(): DocActivo[] {
    return this.activoEditando?.documentos ?? [];
  }

  constructor() {
    effect(() => {
      if (
        this.service.status()?.type === 'ok' &&
        this.modal() !== null &&
        this.modal() !== 'buscar' &&
        !this.subiendoDocs
      ) {
        this.cerrar();
      }
    });
  }

  ngOnInit(): void {
    this.centrosService.cargar();
    this.service.cargar();
    this.clientesService.cargar();
    this.tiposService.cargar();
  }

  protected tipoDeActivo(a: Activo): TipoActivo | null {
    if (typeof a.tipo_activo_id === 'object') return a.tipo_activo_id as TipoActivo;
    return this.tiposService.tipos().find(t => t._id === (a.tipo_activo_id as string)) ?? null;
  }

  protected abrirCrear(): void {
    this.editingId.set(null);
    this.docsPendientes = [];
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
    this.editingId.set(activo._id);
    this.service.seleccionar(activo);
    this.modal.set('editar');
  }

  protected cerrar(): void {
    this.modal.set(null);
    this.editingId.set(null);
    this.docsPendientes = [];
    this.subiendoDocs = false;
    this.service.seleccionado.set(null);
    this.service.clearStatus();
  }

  protected crear(dto: CreateActivoDto): void {
    this.service.crear(dto, (nuevo) => {
      if (this.docsPendientes.length === 0) return;
      this.subiendoDocs = true;
      this.editingId.set(nuevo._id);
      this.subirDocsPendientesSecuencial(nuevo._id, dto.centro_costo_id, 0);
    });
  }

  protected actualizar(dto: CreateActivoDto): void {
    const id = this.service.seleccionado()?._id;
    if (id) this.service.actualizar(id, dto);
  }

  protected eliminar(id: string): void {
    const activo = this.service.activos().find(a => a._id === id);
    if (activo) this.service.seleccionar(activo);
    this.service.eliminar(id);
  }

  protected editarDesdeBuscar(activo: Activo): void {
    this.service.seleccionar(activo);
    this.editingId.set(activo._id);
    this.modal.set('editar');
  }

  protected onDocAgregado(doc: DocPendiente): void {
    this.docsPendientes = [...this.docsPendientes, doc];
  }

  protected onDocQuitado(index: number): void {
    this.docsPendientes = this.docsPendientes.filter((_, i) => i !== index);
  }

  protected onDocSubido(doc: DocPendiente): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.service.subirDocumento(activo._id, activo.centro_costo_id, doc.file, doc.nombre);
  }

  protected onDocEliminado(nombre: string): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.service.eliminarDocumento(activo._id, activo.centro_costo_id, nombre);
  }

  protected onDocDescargado(ev: { nombre: string; nombreDisplay?: string }): void {
    const activo = this.activoEditando;
    if (!activo) return;
    this.service.descargarDocumento(activo._id, activo.centro_costo_id, ev.nombre, ev.nombreDisplay);
  }

  private subirDocsPendientesSecuencial(activoId: string, centroId: string, index: number): void {
    if (index >= this.docsPendientes.length) {
      this.docsPendientes = [];
      this.subiendoDocs = false;
      this.cerrar();
      return;
    }
    const { file, nombre } = this.docsPendientes[index];
    this.service.subirDocumento(activoId, centroId, file, nombre,
      () => this.subirDocsPendientesSecuencial(activoId, centroId, index + 1),
      () => { this.subiendoDocs = false; },
    );
  }

  // ── Gestión de tipos ──────────────────────────────────────────────
  protected showTipos     = signal(false);
  protected showTipoForm  = signal(false);
  protected editingTipoId = signal<string | null>(null);
  protected tipoForm      = signal<TipoForm>(emptyTipoForm());

  toggleTipos(): void { this.showTipos.update(v => !v); }

  abrirNuevoTipo(): void {
    this.editingTipoId.set(null);
    this.tipoForm.set(emptyTipoForm());
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  abrirEditarTipo(t: TipoActivo): void {
    this.editingTipoId.set(t._id);
    this.tipoForm.set({ nombre: t.nombre, color: t.color });
    this.showTipoForm.set(true);
    this.tiposService.clearStatus();
  }

  cerrarTipoForm(): void {
    this.showTipoForm.set(false);
    this.editingTipoId.set(null);
  }

  patchTipoForm(field: keyof TipoForm, value: string): void {
    this.tipoForm.update(f => ({ ...f, [field]: value }));
  }

  guardarTipo(): void {
    const f = this.tipoForm();
    if (!f.nombre.trim()) return;
    const dto = { nombre: f.nombre.trim(), color: f.color };
    const id = this.editingTipoId();
    if (id) this.tiposService.actualizar(id, dto);
    else     this.tiposService.crear(dto);
    this.cerrarTipoForm();
  }

  eliminarTipo(id: string): void { this.tiposService.eliminar(id); }
}
```

- [ ] **Step 2: Actualizar el HTML de la page**

```html
<!-- front4/src/app/features/activos/pages/activos-page.component.html -->

<!-- Encabezado -->
<div class="page-header">
  <h2>Activos</h2>
  <div class="header-actions">
    @if (puedeGestionarTipos()) {
      <button class="btn-ghost" (click)="toggleTipos()">Tipos</button>
    }
    <button class="btn-ghost" (click)="abrirBuscar()">Buscar</button>
    <button class="btn-primary" (click)="abrirCrear()">+ Crear</button>
  </div>
</div>

<app-status-banner [status]="service.status()"></app-status-banner>

<app-activos-list
  [activos]="service.activos()"
  [centros]="centrosService.centros()"
  [clientes]="clientesService.clientes()"
  [tipos]="tiposService.tipos()"
  (editado)="abrirEditar($event)"
  (eliminado)="eliminar($event)">
</app-activos-list>

<!-- Panel tipos -->
@if (puedeGestionarTipos()) {
  <div class="tipos-section">
    <div class="tipos-header" (click)="toggleTipos()">
      <h3 class="tipos-title">Tipos de activo ({{ tiposService.tipos().length }})</h3>
      <div style="display:flex;align-items:center;gap:.5rem">
        <button class="btn-ghost btn-sm" (click)="$event.stopPropagation(); abrirNuevoTipo()">+ Nuevo tipo</button>
        <span class="tipos-chevron">{{ showTipos() ? '▲' : '▼' }}</span>
      </div>
    </div>

    @if (showTipos()) {
      <app-status-banner [status]="tiposService.status()"></app-status-banner>

      @if (showTipoForm()) {
        <div class="tipo-form-inline">
          <input
            class="tipo-input"
            type="text"
            placeholder="Nombre del tipo"
            [ngModel]="tipoForm().nombre"
            (ngModelChange)="patchTipoForm('nombre', $event)" />
          <div style="display:flex;align-items:center;gap:.5rem">
            <input
              type="color"
              [ngModel]="tipoForm().color"
              (ngModelChange)="patchTipoForm('color', $event)"
              style="width:36px;height:36px;border:none;padding:0;cursor:pointer;border-radius:6px" />
            <span style="font-size:.78rem;color:#6b7280">{{ tipoForm().color }}</span>
          </div>
          <div style="display:flex;gap:.5rem">
            <button class="btn-primary btn-sm" (click)="guardarTipo()">Guardar</button>
            <button class="btn-ghost btn-sm" (click)="cerrarTipoForm()">Cancelar</button>
          </div>
        </div>
      }

      @if (tiposService.tipos().length === 0) {
        <p class="tipos-empty">No hay tipos definidos. Crea uno para comenzar.</p>
      } @else {
        <div class="tipos-list">
          @for (t of tiposService.tipos(); track t._id) {
            <div class="tipo-item">
              <span class="tipo-dot" [style.background]="t.color"></span>
              <span class="tipo-nombre">{{ t.nombre }}</span>
              <div class="tipo-actions">
                <button class="btn-ghost btn-sm" (click)="abrirEditarTipo(t)">Editar</button>
                <button class="btn-danger btn-sm" (click)="eliminarTipo(t._id)">Eliminar</button>
              </div>
            </div>
          }
        </div>
      }
    }
  </div>
}

<!-- Modal -->
@if (modal() !== null) {
  <div class="modal-backdrop" (click)="cerrar()">
    <div class="modal" (click)="$event.stopPropagation()">

      <!-- Crear -->
      @if (modal() === 'crear') {
        <div class="modal-header">
          <h3>Nuevo activo</h3>
          <button class="modal-close" (click)="cerrar()">&#x2715;</button>
        </div>
        <app-status-banner [status]="service.status()"></app-status-banner>
        <app-activos-form
          submitLabel="Crear activo"
          [centros]="centrosService.centros()"
          [clientes]="clientesService.clientes()"
          [tipos]="tiposService.tipos()"
          [editingId]="null"
          [docsPendientes]="docsPendientes"
          [docsExistentes]="[]"
          (submitted)="crear($event)"
          (cancelar)="cerrar()"
          (docAgregado)="onDocAgregado($event)"
          (docQuitado)="onDocQuitado($event)">
        </app-activos-form>
      }

      <!-- Editar -->
      @if (modal() === 'editar') {
        <div class="modal-header">
          <h3>Editar activo</h3>
          <button class="modal-close" (click)="cerrar()">&#x2715;</button>
        </div>
        <app-status-banner [status]="service.status()"></app-status-banner>
        <app-activos-form
          [initial]="service.seleccionado()"
          [centros]="centrosService.centros()"
          [clientes]="clientesService.clientes()"
          [tipos]="tiposService.tipos()"
          [editingId]="editingId()"
          [docsPendientes]="[]"
          [docsExistentes]="docsExistentes"
          submitLabel="Guardar cambios"
          (submitted)="actualizar($event)"
          (cancelar)="cerrar()"
          (docSubido)="onDocSubido($event)"
          (docEliminado)="onDocEliminado($event)"
          (docDescargado)="onDocDescargado($event)">
        </app-activos-form>
      }

      <!-- Buscar -->
      @if (modal() === 'buscar') {
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
          [centros]="centrosService.centros()"
          [clientes]="clientesService.clientes()"
          [tipos]="tiposService.tipos()"
          (editado)="editarDesdeBuscar($event)"
          (eliminado)="eliminar($event)">
        </app-activos-list>
      }

    </div>
  </div>
}
```

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/features/activos/pages/
git commit -m "feat(frontend): activos-page con panel de tipos de activo y botón Tipos"
```

---

## Task 9: Verificación final

- [ ] **Step 1: Arrancar el backend**

```bash
cd back4 && npm run start:dev
```

Verificar que el servidor arranca sin errores y que el endpoint responde:
```bash
# (con token JWT válido)
curl http://localhost:3000/api/v1/tipos-activo
# Esperado: []
```

- [ ] **Step 2: Arrancar el frontend**

```bash
cd front4 && npm start
```

Verificar en `http://localhost:4200` (logueado como super_admin):
- Página Activos muestra botón "Tipos" junto a "Buscar" y "+ Crear"
- Clic en "Tipos" despliega el panel
- "+ Nuevo tipo" abre el form inline con nombre + color picker
- Crear un tipo y verificar que aparece en la lista con su punto de color
- Abrir "+ Crear activo" y verificar que el campo tipo usa el select con los tipos creados
- Crear un activo con un tipo y verificar que aparece en la lista con punto de color

- [ ] **Step 3: Commit final si todo OK**

```bash
git add -A
git commit -m "chore: verificación tipos-activo completa"
```
