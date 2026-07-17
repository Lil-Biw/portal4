# Tag "quién subió" en documentos (admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar quién subió cada documento (nombre del usuario) junto a la fecha de subida, en las 4 vistas de `documentos-admin-page` (lista principal, todos-centros, todos-proyectos, vencidos).

**Architecture:** El backend ya guarda `subido_por` (ObjectId → Usuario) en los documentos al subirlos, pero nunca lo expone en la API. Se agrega una función compartida que resuelve en batch `subido_por` → nombre de usuario, se aplica en los 3 endpoints de listado de documentos (empresa/centro/proyecto) y se extiende el flujo de "vencidos" (schema + persistencia al marcar vencido + resolución al listar) para que también lleve el dato. En el frontend se agrega el campo a las interfaces existentes y un pill visual en las 4 vistas de `documentos-admin-page`.

**Tech Stack:** NestJS 10 + Mongoose 8 (backend), Angular 21 standalone + signals (frontend).

## Global Constraints

- Alcance: **solo** `documentos-admin-page.component.html` — `documentos-consumidor-page` no se toca.
- Color del pill: `background:#f0fdfa;color:#0f766e` (teal), mismo tamaño/forma que los pills existentes: `font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px`.
- Si el documento no tiene `subido_por_nombre` (documentos antiguos o subidos sin usuario), el pill se omite — nunca mostrar un placeholder tipo "Desconocido".
- **Este backend no tiene infraestructura de tests** (no hay `jest`, ni script `test`, ni ningún `*.spec.ts` en `back4/`). No se introduce infraestructura de tests nueva — la verificación de cada tarea de backend es `npm run build` (typecheck vía `nest build`) más verificación manual al final del plan. El frontend sí usa Vitest, pero este cambio no agrega lógica nueva (solo campos de interfaz + interpolación en template), así que no amerita specs nuevos — se verifica visualmente en el paso manual final.
- No hay backfill de `subido_por` para documentos ya existentes sin ese dato.

---

### Task 1: Backend — función compartida `resolverSubidoPorNombre`

**Files:**
- Modify: `back4/src/common/helpers/documentos.helper.ts`

**Interfaces:**
- Produces: `resolverSubidoPorNombre(docs: Record<string, unknown>[], usuarioModel: Model<any>): Promise<Record<string, unknown>[]>` — usado por Tasks 2 y 3.

- [ ] **Step 1: Agregar la función al final de `documentos.helper.ts`**

El archivo ya importa `Model` desde `'mongoose'` en la línea 2, no hace falta agregar imports. Agregar al final del archivo (después del cierre de la clase `DocumentosHelper`, línea 207):

```ts
// Resuelve en batch subido_por (ObjectId) -> nombre de usuario, para listados de
// documentos. Un solo find() con $in, no N+1. Si un doc no tiene subido_por, o el
// usuario no existe, se omite el campo (nunca se agrega un placeholder).
export async function resolverSubidoPorNombre(
  docs: Record<string, unknown>[],
  usuarioModel: Model<any>,
): Promise<Record<string, unknown>[]> {
  const ids = [...new Set(
    docs.map(d => d['subido_por']).filter(Boolean).map(String)
  )];
  if (!ids.length) return docs;

  const usuarios = await usuarioModel
    .find({ _id: { $in: ids } })
    .select('nombre')
    .lean();
  const nombreMap = new Map(usuarios.map(u => [String((u as any)._id), (u as any).nombre]));

  return docs.map(d => {
    const nombre = d['subido_por'] ? nombreMap.get(String(d['subido_por'])) : undefined;
    return nombre ? { ...d, subido_por_nombre: nombre } : d;
  });
}
```

- [ ] **Step 2: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
cd back4
git add src/common/helpers/documentos.helper.ts
git commit -m "feat(back): agregar resolverSubidoPorNombre para listados de documentos"
```

---

### Task 2: Backend — exponer `subido_por_nombre` en los 3 listados de documentos

**Files:**
- Modify: `back4/src/clientes/clientes.service.ts:6,144-146`
- Modify: `back4/src/centros-costos/centros-costos.service.ts:6,148-150`
- Modify: `back4/src/proyectos/proyectos.service.ts:6,258-260`

**Interfaces:**
- Consumes: `resolverSubidoPorNombre(docs, usuarioModel)` de Task 1.
- Produces: `listarDocumentos(id: string): Promise<Record<string, unknown>[]>` en los 3 servicios (antes era síncrono, devolvía la promesa de Mongoose directo — ahora es `async` explícito, mismo comportamiento observable para quien lo llama vía `await`/promise).

- [ ] **Step 1: `clientes.service.ts` — importar la función y usarla**

Cambiar el import de la línea 6:
```ts
import { DocumentosHelper, DocumentoInput } from '../common/helpers/documentos.helper';
```
por:
```ts
import { DocumentosHelper, DocumentoInput, resolverSubidoPorNombre } from '../common/helpers/documentos.helper';
```

Reemplazar el método de las líneas 144-146:
```ts
  listarDocumentos(id: string) {
    return this.docsHelper.listar(id);
  }
```
por:
```ts
  async listarDocumentos(id: string) {
    const docs = await this.docsHelper.listar(id);
    return resolverSubidoPorNombre(docs, this.usuarioModel as any);
  }
```

- [ ] **Step 2: `centros-costos.service.ts` — mismo cambio**

Cambiar el import de la línea 6:
```ts
import { DocumentosHelper, DocumentoInput } from '../common/helpers/documentos.helper';
```
por:
```ts
import { DocumentosHelper, DocumentoInput, resolverSubidoPorNombre } from '../common/helpers/documentos.helper';
```

Reemplazar el método de las líneas 148-150:
```ts
  listarDocumentos(id: string) {
    return this.docsHelper.listar(id);
  }
```
por:
```ts
  async listarDocumentos(id: string) {
    const docs = await this.docsHelper.listar(id);
    return resolverSubidoPorNombre(docs, this.usuarioModel as any);
  }
```

- [ ] **Step 3: `proyectos.service.ts` — mismo cambio**

Cambiar el import de la línea 6:
```ts
import { DocumentosHelper, DocumentoInput } from '../common/helpers/documentos.helper';
```
por:
```ts
import { DocumentosHelper, DocumentoInput, resolverSubidoPorNombre } from '../common/helpers/documentos.helper';
```

Reemplazar el método de las líneas 258-260:
```ts
  listarDocumentos(id: string) {
    return this.docsHelper.listar(id);
  }
```
por:
```ts
  async listarDocumentos(id: string) {
    const docs = await this.docsHelper.listar(id);
    return resolverSubidoPorNombre(docs, this.usuarioModel as any);
  }
```

- [ ] **Step 4: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 5: Commit**

```bash
cd back4
git add src/clientes/clientes.service.ts src/centros-costos/centros-costos.service.ts src/proyectos/proyectos.service.ts
git commit -m "feat(back): exponer subido_por_nombre en listarDocumentos (empresa/centro/proyecto)"
```

---

### Task 3: Backend — persistir y resolver `subido_por` en documentos vencidos

**Files:**
- Modify: `back4/src/documentos-vencidos/documentos-vencidos.schema.ts`
- Modify: `back4/src/documentos-vencidos/documentos-vencidos.dto.ts`
- Modify: `back4/src/documentos-vencidos/documentos-vencidos.module.ts`
- Modify: `back4/src/documentos-vencidos/documentos-vencidos.service.ts`
- Modify: `back4/src/clientes/clientes.service.ts:166-179` (el `crear({...})` dentro de `vencerDocumento`)
- Modify: `back4/src/centros-costos/centros-costos.service.ts:181-196` (ídem)
- Modify: `back4/src/proyectos/proyectos.service.ts:292-309` (ídem)

**Interfaces:**
- Consumes: `resolverSubidoPorNombre(docs, usuarioModel)` de Task 1.
- Produces: `DocumentosVencidosService.listarUltimos20(...)` devuelve documentos con `subido_por_nombre` cuando aplica — usado por `GET /documentos-vencidos`.

- [ ] **Step 1: Schema — agregar el campo**

En `documentos-vencidos.schema.ts`, agregar tras la línea 22 (`@Prop() proyecto_nombre?: string;`):
```ts
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) subido_por?: Types.ObjectId;
```

- [ ] **Step 2: DTO — agregar el campo**

En `documentos-vencidos.dto.ts`, agregar el import de `Types` (el archivo no lo importa hoy):
```ts
import { IsString, IsOptional, IsMongoId, IsEnum, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';
```

Y agregar el campo tras la línea 20 (`@IsOptional() @Type(() => Date) subido_en?: Date;`):
```ts
  @IsOptional() subido_por?: Types.ObjectId | string;
```

(Sin `@IsMongoId()`: este DTO solo se usa para llamadas internas entre servicios — `DocumentosVencidosController` no expone un `POST` — así que no necesita validación estricta de request HTTP.)

- [ ] **Step 3: Module — registrar el modelo `Usuario`**

En `documentos-vencidos.module.ts`, agregar el import:
```ts
import { UsuarioSchema } from '../usuarios/usuarios.schema';
```

Y cambiar:
```ts
  imports: [MongooseModule.forFeature([{ name: 'DocumentoVencido', schema: DocumentoVencidoSchema }])],
```
por:
```ts
  imports: [MongooseModule.forFeature([
    { name: 'DocumentoVencido', schema: DocumentoVencidoSchema },
    { name: 'Usuario', schema: UsuarioSchema },
  ])],
```

- [ ] **Step 4: Service — inyectar `usuarioModel`, persistir `subido_por` en `crear()`, resolverlo en `listarUltimos20`**

En `documentos-vencidos.service.ts`, cambiar los imports:
```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocumentoVencido, DocumentoVencidoDocument } from './documentos-vencidos.schema';
import { CreateDocVencidoDto } from './documentos-vencidos.dto';
import { S3Service } from '../common/s3/s3.service';
import { resolverSubidoPorNombre } from '../common/helpers/documentos.helper';
```

Cambiar el constructor (líneas 10-13):
```ts
  constructor(
    @InjectModel('DocumentoVencido') private readonly model: Model<DocumentoVencidoDocument>,
    @InjectModel('Usuario') private readonly usuarioModel: Model<any>,
    private readonly s3Service: S3Service,
  ) {}
```

Cambiar `crear()` (líneas 15-23):
```ts
  crear(dto: CreateDocVencidoDto) {
    const doc = new this.model({
      ...dto,
      empresa_id:  new Types.ObjectId(dto.empresa_id),
      centro_id:   dto.centro_id   ? new Types.ObjectId(dto.centro_id)   : undefined,
      proyecto_id: dto.proyecto_id ? new Types.ObjectId(dto.proyecto_id) : undefined,
      subido_por:  dto.subido_por  ? new Types.ObjectId(dto.subido_por)  : undefined,
    });
    return doc.save();
  }
```

Cambiar `listarUltimos20()` (líneas 25-40):
```ts
  async listarUltimos20(empresaId: string, centroId?: string, proyectoId?: string, tipo?: string) {
    if (!empresaId || !Types.ObjectId.isValid(empresaId)) return [];
    const filter: Record<string, unknown> = { empresa_id: new Types.ObjectId(empresaId) };
    if (proyectoId && Types.ObjectId.isValid(proyectoId)) {
      filter['proyecto_id'] = new Types.ObjectId(proyectoId);
      filter['origen_tipo'] = 'proyecto';
    } else if (centroId && Types.ObjectId.isValid(centroId)) {
      filter['centro_id'] = new Types.ObjectId(centroId);
      filter['origen_tipo'] = tipo === 'proyecto' ? 'proyecto' : 'centro';
    } else if (tipo === 'proyecto' || tipo === 'centro') {
      filter['origen_tipo'] = tipo;
    } else {
      filter['origen_tipo'] = 'empresa';
    }
    const docs = await this.model.find(filter).sort({ vencido_en: -1 }).limit(20).select('-contenido').lean();
    return resolverSubidoPorNombre(docs, this.usuarioModel);
  }
```

- [ ] **Step 5: `clientes.service.ts` — pasar `subido_por` al marcar vencido**

En el `crear({...})` dentro de `vencerDocumento` (líneas 166-179), agregar `subido_por: doc.subido_por,` tras `s3_key: doc.s3_key,`:
```ts
    await this.documentosVencidosService.crear({
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_contenido: doc.tipo_contenido as 'archivo' | 'link' | undefined,
      link_url:       doc.link_url,
      tipo_mime:      doc.tipo_mime,
      tamano_bytes:   doc.tamano_bytes,
      contenido:      doc.contenido,
      s3_key:         doc.s3_key,
      subido_por:     doc.subido_por,
      origen_tipo:    'empresa',
      empresa_id:     clienteId,
      empresa_nombre: empresaNombre,
      subido_en:      doc.subido_en,
    });
```

- [ ] **Step 6: `centros-costos.service.ts` — pasar `subido_por` al marcar vencido**

En el `crear({...})` dentro de `vencerDocumento` (líneas 181-196), agregar `subido_por: doc.subido_por,` tras `s3_key: doc.s3_key,`:
```ts
    await this.documentosVencidosService.crear({
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_contenido: doc.tipo_contenido as 'archivo' | 'link' | undefined,
      link_url:       doc.link_url,
      tipo_mime:      doc.tipo_mime,
      tamano_bytes:   doc.tamano_bytes,
      contenido:      doc.contenido,
      s3_key:         doc.s3_key,
      subido_por:     doc.subido_por,
      origen_tipo:    'centro',
      empresa_id:     resolvedEmpresaId,
      centro_id:      centroId,
      empresa_nombre: empresaNombre,
      centro_nombre:  centroNombre,
      subido_en:      doc.subido_en,
    });
```

- [ ] **Step 7: `proyectos.service.ts` — pasar `subido_por` al marcar vencido**

En el `crear({...})` dentro de `vencerDocumento` (líneas 292-309), agregar `subido_por: doc.subido_por,` tras `s3_key: doc.s3_key,`:
```ts
    await this.documentosVencidosService.crear({
      nombre_display:  doc.nombre_display,
      categoria:       doc.categoria,
      tipo_contenido:  doc.tipo_contenido as 'archivo' | 'link' | undefined,
      link_url:        doc.link_url,
      tipo_mime:       doc.tipo_mime,
      tamano_bytes:    doc.tamano_bytes,
      contenido:       doc.contenido,
      s3_key:          doc.s3_key,
      subido_por:      doc.subido_por,
      origen_tipo:     'proyecto',
      empresa_id:      empresaId,
      centro_id:       centroId,
      proyecto_id:     proyectoId,
      empresa_nombre:  empresaNombre,
      centro_nombre:   centroNombre,
      proyecto_nombre: proyectoNombre,
      subido_en:       doc.subido_en,
    });
```

- [ ] **Step 8: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 9: Commit**

```bash
cd back4
git add src/documentos-vencidos/ src/clientes/clientes.service.ts src/centros-costos/centros-costos.service.ts src/proyectos/proyectos.service.ts
git commit -m "feat(back): persistir y resolver subido_por en documentos vencidos"
```

---

### Task 4: Frontend — interfaces + tag visual en las 4 vistas

**Files:**
- Modify: `front4/src/app/features/documentos/documentos.service.ts:28-58`
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html` (4 bloques: ~371, ~428, ~489, ~559-564)

**Interfaces:**
- Consumes: `subido_por_nombre?: string` que ahora devuelve el backend (Tasks 2 y 3).

- [ ] **Step 1: Agregar el campo a las interfaces**

En `documentos.service.ts`, cambiar `DocumentoItem` (líneas 28-39):
```ts
export interface DocumentoItem {
  _id: string;
  nombre: string;
  nombre_display: string;
  url: string;
  tipo_mime: string;
  tamano_bytes?: number;
  subido_en?: string;
  subido_por_nombre?: string;
  categoria?: string;
  tipo_contenido?: 'archivo' | 'link';
  link_url?: string;
}
```

Y `DocumentoVencidoItem` (líneas 43-58):
```ts
export interface DocumentoVencidoItem {
  _id: string;
  nombre_display: string;
  categoria?: string;
  tipo_mime: string;
  tamano_bytes?: number;
  subido_en?: string;
  subido_por_nombre?: string;
  vencido_en: string;
  origen_tipo: 'empresa' | 'centro' | 'proyecto';
  empresa_nombre?: string;
  centro_nombre?: string;
  proyecto_nombre?: string;
  url: string;
  tipo_contenido?: 'archivo' | 'link';
  link_url?: string;
}
```

- [ ] **Step 2: Bloque "lista principal" — agregar el pill**

En `documentos-admin-page.component.html`, la fila (línea ~371) hoy es:
```html
                          <span style="font-size:.68rem;color:#9ca3af">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.35rem;flex-shrink:0">
                      <button [title]="d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(d)"
```
(este es el bloque que empieza tras `@if (docTipo === 'empresa') { ... } @else if ... @else if ...`, dentro de `@for (d of docsFiltrados(docTipo); track d._id)`)

Reemplazar por:
```html
                          <span style="font-size:.68rem;color:#9ca3af">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                          @if (d.subido_por_nombre) {
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div style="display:flex;gap:.35rem;flex-shrink:0">
                      <button [title]="d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(d)"
```

- [ ] **Step 3: Bloque "todos centros" — agregar el pill**

La fila (línea ~428) hoy es:
```html
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#eff6ff;color:#1d4ed8">Centro · {{ item.nombre }}</span>
                            <span style="font-size:.68rem;color:#9ca3af">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                          </div>
                        </div>
                      </div>
                      <div style="display:flex;gap:.3rem;flex-shrink:0">
                        <button [title]="d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(d)"
```
(dentro de `@for (item of filteredDocsPorCentro(); ...)` → `@for (d of item.docs; track d._id)`)

Reemplazar por:
```html
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#eff6ff;color:#1d4ed8">Centro · {{ item.nombre }}</span>
                            <span style="font-size:.68rem;color:#9ca3af">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                            @if (d.subido_por_nombre) {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
                            }
                          </div>
                        </div>
                      </div>
                      <div style="display:flex;gap:.3rem;flex-shrink:0">
                        <button [title]="d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(d)"
```

- [ ] **Step 4: Bloque "todos proyectos" — agregar el pill**

La fila (línea ~489) hoy es:
```html
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f5f3ff;color:#6d28d9">Proyecto · {{ item.nombre }}</span>
                            <span style="font-size:.68rem;color:#9ca3af">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                          </div>
                        </div>
                      </div>
                      <div style="display:flex;gap:.3rem;flex-shrink:0">
                        <button [title]="d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(d)"
```
(dentro de `@for (item of filteredDocsPorProyecto(); ...)` → `@for (d of item.docs; track d._id)`)

Reemplazar por:
```html
                            <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f5f3ff;color:#6d28d9">Proyecto · {{ item.nombre }}</span>
                            <span style="font-size:.68rem;color:#9ca3af">Subido: {{ formatFechaHora(d.subido_en) }}</span>
                            @if (d.subido_por_nombre) {
                              <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e">{{ d.subido_por_nombre }}</span>
                            }
                          </div>
                        </div>
                      </div>
                      <div style="display:flex;gap:.3rem;flex-shrink:0">
                        <button [title]="d.tipo_contenido === 'link' ? 'Abrir enlace' : 'Descargar'" (click)="abrirDocumento(d)"
```

- [ ] **Step 5: Bloque "vencidos" — agregar el pill**

El bloque (líneas ~559-564) hoy es:
```html
                    <div style="display:flex;flex-direction:column;gap:.15rem;flex-shrink:0;text-align:right">
                      @if (v.subido_en) {
                        <span style="font-size:.72rem;color:#9ca3af">Subido: {{ formatFechaHora(v.subido_en) }}</span>
                      }
                      <span style="font-size:.72rem;color:#dc2626;font-weight:600">Vencido: {{ formatFechaHora(v.vencido_en) }}</span>
                    </div>
```

Reemplazar por:
```html
                    <div style="display:flex;flex-direction:column;gap:.15rem;flex-shrink:0;text-align:right">
                      @if (v.subido_en) {
                        <span style="font-size:.72rem;color:#9ca3af">Subido: {{ formatFechaHora(v.subido_en) }}</span>
                      }
                      @if (v.subido_por_nombre) {
                        <span style="font-size:.68rem;font-weight:600;padding:.15rem .45rem;border-radius:999px;background:#f0fdfa;color:#0f766e;align-self:flex-end">{{ v.subido_por_nombre }}</span>
                      }
                      <span style="font-size:.72rem;color:#dc2626;font-weight:600">Vencido: {{ formatFechaHora(v.vencido_en) }}</span>
                    </div>
```

- [ ] **Step 6: Verificar que compila**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores de TypeScript. (El template usa `d.subido_por_nombre`/`v.subido_por_nombre`, ya tipados como opcionales en las interfaces del Step 1 — Angular valida los templates en el build completo, no en `tsc --noEmit`; el build completo se verifica manualmente en la Task 5.)

- [ ] **Step 7: Commit**

```bash
cd front4
git add src/app/features/documentos/documentos.service.ts src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front): mostrar tag de usuario que subió el documento (admin)"
```

---

### Task 5: Verificación manual end-to-end

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Levantar backend y frontend**

Run: `cd back4 && npm run start:dev` (terminal 1)
Run: `cd front4 && npm start` (terminal 2)
Expected: backend en `http://localhost:3000/api/v1`, frontend en `http://localhost:4200`.

- [ ] **Step 2: Verificar el build completo del frontend (valida los templates)**

Run: `cd front4 && npm run build`
Expected: build exitoso — esto sí valida los bindings `d.subido_por_nombre`/`v.subido_por_nombre` contra las interfaces (a diferencia de `tsc --noEmit`, que no compila templates Angular).

- [ ] **Step 3: Subir un documento nuevo y confirmar el pill**

En el navegador, loguear como `super_admin` o `admin_smartclarity`, ir a Documentos → seleccionar una empresa → subir un documento nuevo en cualquier nivel (empresa/centro/proyecto).
Expected: la fila del documento recién subido muestra, junto al pill de fecha ("Subido: ..."), un nuevo pill teal con el nombre del usuario logueado.

- [ ] **Step 4: Confirmar que documentos antiguos no rompen**

Revisar un documento subido antes de este cambio (sin `subido_por` guardado).
Expected: la fila se ve igual que antes — sin pill de usuario, sin placeholder, sin errores en consola del navegador.

- [ ] **Step 5: Confirmar el pill en "todos centros" / "todos proyectos"**

Cambiar a la pestaña "Todos los centros" y "Todos los proyectos" de la misma empresa.
Expected: el documento subido en el Step 3 muestra el mismo pill de usuario en ambas vistas agregadas.

- [ ] **Step 6: Marcar el documento como vencido y confirmar que el pill persiste**

Usar el botón "Marcar vencido" sobre el documento subido en el Step 3, luego ir a la pestaña "Vencidos".
Expected: el documento aparece en la lista de vencidos con el pill de usuario junto a "Subido: ..." y antes de "Vencido: ...".

- [ ] **Step 7: Confirmar que `documentos-consumidor-page` no cambió**

Cambiar a modo consumidor (o loguear con un usuario `usuario`) y revisar la lista de documentos.
Expected: no aparece ningún pill de usuario — solo el pill de fecha, igual que antes del cambio.
