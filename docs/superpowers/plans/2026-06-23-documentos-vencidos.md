# Documentos Vencidos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una colección separada `documentos_vencidos` en MongoDB, endpoints para mover documentos activos a ella, y un tab "Vencidos" read-only en las páginas de documentos del portal.

**Architecture:** Nuevo módulo NestJS `documentos-vencidos` con su propio schema/service/controller. Los controllers de clientes, centros-costos y proyectos reciben un nuevo endpoint `PATCH .../documentos/:docId/vencer` que extrae la metadata del subdocumento, lo elimina del array `documentos[]` y lo inserta en la colección `documentos_vencidos`. El frontend extiende `DocumentosService` con un signal `documentosVencidos` y métodos `cargarVencidos`/`marcarVencido`, y ambas páginas (admin y consumidor) reciben el tab pequeño y el botón.

**Tech Stack:** NestJS + Mongoose (backend), Angular 21 standalone + signals (frontend)

## Global Constraints

- Sin `any` en ningún archivo — usar tipos explícitos o `Record<string, unknown>`
- Angular 18+ control flow: `@if`, `@for`, `@let` — nunca `*ngIf`/`*ngFor`
- Todos los componentes son standalone
- Signals para estado reactivo — no `BehaviorSubject`
- `@Schema` timestamps: `{ createdAt: 'creado_en', updatedAt: 'actualizado_en' }`
- Nombres de tokens Mongoose siempre string: `'DocumentoVencido'`
- Trabajar desde `back4/` para backend y `front4/` para frontend
- Arrancar backend con `npm run start:dev` en `back4/`

---

## File Map

**Crear:**
- `back4/src/documentos-vencidos/documentos-vencidos.schema.ts`
- `back4/src/documentos-vencidos/documentos-vencidos.dto.ts`
- `back4/src/documentos-vencidos/documentos-vencidos.service.ts`
- `back4/src/documentos-vencidos/documentos-vencidos.controller.ts`
- `back4/src/documentos-vencidos/documentos-vencidos.module.ts`

**Modificar:**
- `back4/src/app.module.ts` — importar `DocumentosVencidosModule`
- `back4/src/clientes/clientes.service.ts` — método `vencerDocumento`
- `back4/src/clientes/clientes.controller.ts` — endpoint PATCH vencer
- `back4/src/clientes/clientes.module.ts` — importar `DocumentosVencidosModule`
- `back4/src/centros-costos/centros-costos.service.ts` — método `vencerDocumento`
- `back4/src/centros-costos/centros-costos.controller.ts` — endpoint PATCH vencer
- `back4/src/centros-costos/centros-costos.module.ts` — importar `DocumentosVencidosModule`
- `back4/src/proyectos/proyectos.service.ts` — método `vencerDocumento`
- `back4/src/proyectos/proyectos.controller.ts` — endpoint PATCH vencer
- `back4/src/proyectos/proyectos.module.ts` — importar `DocumentosVencidosModule`
- `front4/src/app/features/documentos/documentos.service.ts` — tipo + signal + métodos
- `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts` — tab + marcarVencido
- `front4/src/app/features/documentos/pages/documentos-admin-page.component.html` — tab + botón
- `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts` — tab + marcarVencido
- `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html` — tab + botón

---

## Task 1: Módulo documentos-vencidos (schema + dto + service + controller + module)

**Files:**
- Create: `back4/src/documentos-vencidos/documentos-vencidos.schema.ts`
- Create: `back4/src/documentos-vencidos/documentos-vencidos.dto.ts`
- Create: `back4/src/documentos-vencidos/documentos-vencidos.service.ts`
- Create: `back4/src/documentos-vencidos/documentos-vencidos.controller.ts`
- Create: `back4/src/documentos-vencidos/documentos-vencidos.module.ts`
- Modify: `back4/src/app.module.ts`

**Interfaces:**
- Produces: `DocumentosVencidosService.crear(dto)` y `DocumentosVencidosService.listarUltimos20(empresaId, centroId?, proyectoId?)`
- Produces: `GET /documentos-vencidos?empresaId=&centroId=&proyectoId=`

- [ ] **Step 1: Crear el schema**

Crear `back4/src/documentos-vencidos/documentos-vencidos.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocumentoVencidoDocument = DocumentoVencido & Document;

@Schema({ collection: 'documentos_vencidos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class DocumentoVencido {
  @Prop({ required: true }) nombre_display: string;
  @Prop({ trim: true }) categoria?: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop() tamano_bytes?: number;
  @Prop({ required: true, enum: ['empresa', 'centro', 'proyecto'] }) origen_tipo: string;
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) empresa_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto' }) centro_id?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Proyecto' }) proyecto_id?: Types.ObjectId;
  @Prop() empresa_nombre?: string;
  @Prop() centro_nombre?: string;
  @Prop() proyecto_nombre?: string;
  @Prop() subido_en?: Date;
  @Prop({ default: Date.now }) vencido_en: Date;
}

export const DocumentoVencidoSchema = SchemaFactory.createForClass(DocumentoVencido);
DocumentoVencidoSchema.index({ empresa_id: 1 });
DocumentoVencidoSchema.index({ vencido_en: -1 });
```

- [ ] **Step 2: Crear el DTO**

Crear `back4/src/documentos-vencidos/documentos-vencidos.dto.ts`:

```ts
import { IsString, IsOptional, IsMongoId, IsEnum, IsNumber, IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDocVencidoDto {
  @IsString() nombre_display: string;
  @IsString() @IsOptional() categoria?: string;
  @IsString() tipo_mime: string;
  @IsNumber() @IsOptional() tamano_bytes?: number;
  @IsEnum(['empresa', 'centro', 'proyecto']) origen_tipo: 'empresa' | 'centro' | 'proyecto';
  @IsMongoId() empresa_id: string;
  @IsMongoId() @IsOptional() centro_id?: string;
  @IsMongoId() @IsOptional() proyecto_id?: string;
  @IsString() @IsOptional() empresa_nombre?: string;
  @IsString() @IsOptional() centro_nombre?: string;
  @IsString() @IsOptional() proyecto_nombre?: string;
  @IsOptional() @Type(() => Date) subido_en?: Date;
}
```

- [ ] **Step 3: Crear el service**

Crear `back4/src/documentos-vencidos/documentos-vencidos.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocumentoVencido, DocumentoVencidoDocument } from './documentos-vencidos.schema';
import { CreateDocVencidoDto } from './documentos-vencidos.dto';

@Injectable()
export class DocumentosVencidosService {
  constructor(
    @InjectModel('DocumentoVencido') private readonly model: Model<DocumentoVencidoDocument>,
  ) {}

  crear(dto: CreateDocVencidoDto) {
    const doc = new this.model({
      ...dto,
      empresa_id:  new Types.ObjectId(dto.empresa_id),
      centro_id:   dto.centro_id   ? new Types.ObjectId(dto.centro_id)   : undefined,
      proyecto_id: dto.proyecto_id ? new Types.ObjectId(dto.proyecto_id) : undefined,
    });
    return doc.save();
  }

  listarUltimos20(empresaId: string, centroId?: string, proyectoId?: string) {
    const filter: Record<string, unknown> = { empresa_id: new Types.ObjectId(empresaId) };
    if (proyectoId) {
      filter['proyecto_id'] = new Types.ObjectId(proyectoId);
      filter['origen_tipo'] = 'proyecto';
    } else if (centroId) {
      filter['centro_id'] = new Types.ObjectId(centroId);
      filter['origen_tipo'] = 'centro';
    } else {
      filter['origen_tipo'] = 'empresa';
    }
    return this.model.find(filter).sort({ vencido_en: -1 }).limit(20).lean();
  }
}
```

- [ ] **Step 4: Crear el controller**

Crear `back4/src/documentos-vencidos/documentos-vencidos.controller.ts`:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { DocumentosVencidosService } from './documentos-vencidos.service';

@Controller('documentos-vencidos')
export class DocumentosVencidosController {
  constructor(private readonly service: DocumentosVencidosService) {}

  @Get()
  listar(
    @Query('empresaId') empresaId: string,
    @Query('centroId')   centroId?: string,
    @Query('proyectoId') proyectoId?: string,
  ) {
    return this.service.listarUltimos20(empresaId, centroId, proyectoId);
  }
}
```

- [ ] **Step 5: Crear el module**

Crear `back4/src/documentos-vencidos/documentos-vencidos.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentoVencidoSchema } from './documentos-vencidos.schema';
import { DocumentosVencidosController } from './documentos-vencidos.controller';
import { DocumentosVencidosService } from './documentos-vencidos.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'DocumentoVencido', schema: DocumentoVencidoSchema }])],
  controllers: [DocumentosVencidosController],
  providers: [DocumentosVencidosService],
  exports: [DocumentosVencidosService],
})
export class DocumentosVencidosModule {}
```

- [ ] **Step 6: Registrar en app.module.ts**

En `back4/src/app.module.ts`, agregar:

```ts
// Agregar import al inicio:
import { DocumentosVencidosModule } from './documentos-vencidos/documentos-vencidos.module';

// Agregar en el array imports del @Module (al final, antes del cierre):
DocumentosVencidosModule,
```

- [ ] **Step 7: Verificar que el servidor arranca sin errores**

```bash
cd back4 && npm run start:dev
```

Esperar a que diga `Application is running on: http://[::1]:3000/api/v1`. Si hay errores de compilación TypeScript, corregirlos antes de continuar.

- [ ] **Step 8: Verificar el endpoint GET**

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/v1/documentos-vencidos?empresaId=<validMongoId>"
```

Debe retornar `[]` (array vacío ya que no hay vencidos aún). Si falla con 401 es esperado si el token no es válido — lo importante es que no dé 404 ni error de compilación.

- [ ] **Step 9: Commit**

```bash
cd back4 && git add src/documentos-vencidos/ src/app.module.ts
git commit -m "feat(back): módulo documentos-vencidos — schema, service, controller, module"
```

---

## Task 2: Endpoint vencer en clientes

**Files:**
- Modify: `back4/src/clientes/clientes.service.ts`
- Modify: `back4/src/clientes/clientes.controller.ts`
- Modify: `back4/src/clientes/clientes.module.ts`

**Interfaces:**
- Consumes: `DocumentosVencidosService.crear(dto: CreateDocVencidoDto)` de Task 1
- Produces: `PATCH /empresas/:id/documentos/:docId/vencer` con body `{ empresa_nombre?: string }`

- [ ] **Step 1: Agregar DTO VencerDocumentoDto**

En `back4/src/clientes/clientes.dto.ts`, agregar al final:

```ts
import { IsString, IsOptional } from 'class-validator';

export class VencerDocumentoEmpresaDto {
  @IsString() @IsOptional() empresa_nombre?: string;
}
```

- [ ] **Step 2: Agregar método vencerDocumento en clientes.service.ts**

En `back4/src/clientes/clientes.service.ts`:

Agregar import:
```ts
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';
```

Modificar el constructor para inyectar el service:
```ts
constructor(
  @InjectModel('Cliente') private clienteModel: Model<ClienteDocument>,
  private readonly documentosVencidosService: DocumentosVencidosService,
) {
  this.docsHelper = new DocumentosHelper(clienteModel, 'Cliente', '-logo.contenido -documentos.contenido');
}
```

Agregar el método al final de la clase (antes del cierre `}`):
```ts
async vencerDocumento(clienteId: string, docId: string, empresaNombre?: string) {
  const cliente = await this.clienteModel.findById(clienteId);
  if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
  const doc = cliente.documentos.find((d: any) => String(d._id) === docId);
  if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

  await this.documentosVencidosService.crear({
    nombre_display: doc.nombre_display,
    categoria:      doc.categoria,
    tipo_mime:      doc.tipo_mime,
    tamano_bytes:   doc.tamano_bytes,
    origen_tipo:    'empresa',
    empresa_id:     clienteId,
    empresa_nombre: empresaNombre,
    subido_en:      doc.subido_en,
  });

  await this.clienteModel.findByIdAndUpdate(
    clienteId,
    { $pull: { documentos: { _id: doc._id } } },
  );

  return { message: 'Documento marcado como vencido', docId };
}
```

- [ ] **Step 3: Agregar endpoint PATCH en clientes.controller.ts**

Agregar import del DTO (en la línea de imports del DTO existente):
```ts
import { CreateClienteDto, UpdateClienteDto, UpdateScoreSmartclarityDto, UpdateConfigGraficoDto, VencerDocumentoEmpresaDto } from './clientes.dto';
```

Agregar el endpoint antes del cierre de la clase `}`:
```ts
@Patch(':id/documentos/:docId/vencer')
@Roles('super_admin', 'admin_smartclarity', 'usuario')
async vencerDocumento(
  @Param('id') id: string,
  @Param('docId') docId: string,
  @Body() dto: VencerDocumentoEmpresaDto,
  @Req() req: Request,
) {
  this.assertEmpresaPermitida((req as any).user as JwtUser, id);
  return this.clientesService.vencerDocumento(id, docId, dto.empresa_nombre);
}
```

- [ ] **Step 4: Importar DocumentosVencidosModule en clientes.module.ts**

```ts
// Agregar import al inicio:
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';

// Agregar en el array imports del @Module:
imports: [
  MongooseModule.forFeature([{ name: 'Cliente', schema: ClienteSchema }]),
  DocumentosVencidosModule,
],
```

- [ ] **Step 5: Verificar compilación**

```bash
cd back4 && npm run start:dev
```

Sin errores de TypeScript. El servidor debe arrancar.

- [ ] **Step 6: Probar el endpoint manualmente**

Con un docId válido de un cliente existente:
```bash
curl -X PATCH \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"empresa_nombre":"Empresa Test"}' \
  "http://localhost:3000/api/v1/empresas/<clienteId>/documentos/<docId>/vencer"
```

Debe retornar `{ "message": "Documento marcado como vencido", "docId": "..." }`.

Verificar en MongoDB que el doc ya no está en `clientes.documentos` y que existe en `documentos_vencidos`.

- [ ] **Step 7: Commit**

```bash
git add back4/src/clientes/
git commit -m "feat(back): endpoint PATCH vencer documento de empresa"
```

---

## Task 3: Endpoint vencer en centros-costos

**Files:**
- Modify: `back4/src/centros-costos/centros-costos.service.ts`
- Modify: `back4/src/centros-costos/centros-costos.controller.ts`
- Modify: `back4/src/centros-costos/centros-costos.module.ts`

**Interfaces:**
- Consumes: `DocumentosVencidosService.crear(dto: CreateDocVencidoDto)` de Task 1
- Produces: `PATCH /empresas/:empresaId/centros/:centroId/documentos/:docId/vencer`

- [ ] **Step 1: Agregar VencerDocumentoCentroDto en centros-costos.dto.ts**

En `back4/src/centros-costos/centros-costos.dto.ts`, agregar al final:

```ts
import { IsString, IsOptional, IsMongoId } from 'class-validator';

export class VencerDocumentoCentroDto {
  @IsMongoId() @IsOptional() empresaId?: string;
  @IsString() @IsOptional() empresa_nombre?: string;
  @IsString() @IsOptional() centro_nombre?: string;
}
```

- [ ] **Step 2: Agregar método vencerDocumento en centros-costos.service.ts**

Agregar import:
```ts
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';
```

Modificar el constructor:
```ts
constructor(
  @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
  private readonly documentosVencidosService: DocumentosVencidosService,
) {
  this.docsHelper = new DocumentosHelper(centroCostoModel, 'Centro de costos');
}
```

Agregar el método:
```ts
async vencerDocumento(centroId: string, docId: string, empresaId?: string, empresaNombre?: string, centroNombre?: string) {
  const centro = await this.centroCostoModel.findById(centroId);
  if (!centro) throw new NotFoundException(`Centro ${centroId} no encontrado`);
  const doc = centro.documentos.find((d: any) => String(d._id) === docId);
  if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

  const resolvedEmpresaId = empresaId ?? String(centro.cliente_id);

  await this.documentosVencidosService.crear({
    nombre_display: doc.nombre_display,
    categoria:      doc.categoria,
    tipo_mime:      doc.tipo_mime,
    tamano_bytes:   doc.tamano_bytes,
    origen_tipo:    'centro',
    empresa_id:     resolvedEmpresaId,
    centro_id:      centroId,
    empresa_nombre: empresaNombre,
    centro_nombre:  centroNombre,
    subido_en:      doc.subido_en,
  });

  await this.centroCostoModel.findByIdAndUpdate(
    centroId,
    { $pull: { documentos: { _id: doc._id } } },
  );

  return { message: 'Documento marcado como vencido', docId };
}
```

- [ ] **Step 3: Agregar endpoint PATCH en centros-costos.controller.ts**

En la clase `CentrosCostosController` (la que usa `@Controller('empresas/:empresaId/centros')`), agregar el import del DTO:

```ts
import { CreateCentroCostoDto, UpdateCentroCostoDto, VencerDocumentoCentroDto } from './centros-costos.dto';
```

Y agregar el endpoint antes del cierre de la clase:
```ts
@Patch(':centroId/documentos/:docId/vencer')
@Roles('super_admin', 'admin_smartclarity', 'usuario')
vencerDocumento(
  @Param('empresaId') empresaId: string,
  @Param('centroId') centroId: string,
  @Param('docId') docId: string,
  @Body() dto: VencerDocumentoCentroDto,
) {
  return this.centrosCostosService.vencerDocumento(centroId, docId, empresaId, dto.empresa_nombre, dto.centro_nombre);
}
```

Nota: el `empresaId` viene del path param del `@Controller('empresas/:empresaId/centros')`.

- [ ] **Step 4: Importar DocumentosVencidosModule en centros-costos.module.ts**

```ts
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';

// En @Module imports:
imports: [
  MongooseModule.forFeature([{ name: 'CentroCosto', schema: CentroCostoSchema }]),
  DocumentosVencidosModule,
],
```

- [ ] **Step 5: Verificar compilación y commit**

```bash
cd back4 && npm run start:dev
# Sin errores TypeScript

git add back4/src/centros-costos/
git commit -m "feat(back): endpoint PATCH vencer documento de centro de costos"
```

---

## Task 4: Endpoint vencer en proyectos

**Files:**
- Modify: `back4/src/proyectos/proyectos.service.ts`
- Modify: `back4/src/proyectos/proyectos.controller.ts`
- Modify: `back4/src/proyectos/proyectos.module.ts`

**Interfaces:**
- Consumes: `DocumentosVencidosService.crear(dto: CreateDocVencidoDto)` de Task 1
- Produces: `PATCH /empresas/:empresaId/centros/:centroId/proyectos/:proyectoId/documentos/:docId/vencer`

- [ ] **Step 1: Agregar VencerDocumentoProyectoDto en proyectos.dto.ts**

En `back4/src/proyectos/proyectos.dto.ts`, agregar al final:

```ts
import { IsString, IsOptional } from 'class-validator';

export class VencerDocumentoProyectoDto {
  @IsString() @IsOptional() empresa_nombre?: string;
  @IsString() @IsOptional() centro_nombre?: string;
  @IsString() @IsOptional() proyecto_nombre?: string;
}
```

- [ ] **Step 2: Agregar método vencerDocumento en proyectos.service.ts**

Agregar import:
```ts
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';
```

Modificar el constructor (el service ya inyecta dos modelos):
```ts
constructor(
  @InjectModel('Proyecto') private proyectoModel: Model<ProyectoDocument>,
  @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
  private readonly documentosVencidosService: DocumentosVencidosService,
) {
  this.docsHelper = new DocumentosHelper(proyectoModel, 'Proyecto');
}
```

Agregar el método:
```ts
async vencerDocumento(
  proyectoId: string, docId: string,
  empresaId: string, centroId: string,
  empresaNombre?: string, centroNombre?: string, proyectoNombre?: string,
) {
  const proyecto = await this.proyectoModel.findById(proyectoId);
  if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
  const doc = proyecto.documentos.find((d: any) => String(d._id) === docId);
  if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

  await this.documentosVencidosService.crear({
    nombre_display:  doc.nombre_display,
    categoria:       doc.categoria,
    tipo_mime:       doc.tipo_mime,
    tamano_bytes:    doc.tamano_bytes,
    origen_tipo:     'proyecto',
    empresa_id:      empresaId,
    centro_id:       centroId,
    proyecto_id:     proyectoId,
    empresa_nombre:  empresaNombre,
    centro_nombre:   centroNombre,
    proyecto_nombre: proyectoNombre,
    subido_en:       doc.subido_en,
  });

  await this.proyectoModel.findByIdAndUpdate(
    proyectoId,
    { $pull: { documentos: { _id: doc._id } } },
  );

  return { message: 'Documento marcado como vencido', docId };
}
```

- [ ] **Step 3: Agregar endpoint PATCH en proyectos.controller.ts**

En la clase `ProyectosController` (la que usa `@Controller('empresas/:empresaId/centros/:centroId/proyectos')`), agregar el import del DTO:

```ts
import { CreateProyectoDto, UpdateProyectoDto, VencerDocumentoProyectoDto } from './proyectos.dto';
```

Y agregar el endpoint:
```ts
@Patch(':proyectoId/documentos/:docId/vencer')
@Roles('super_admin', 'admin_smartclarity', 'usuario')
vencerDocumento(
  @Param('empresaId')  empresaId:  string,
  @Param('centroId')   centroId:   string,
  @Param('proyectoId') proyectoId: string,
  @Param('docId')      docId:      string,
  @Body() dto: VencerDocumentoProyectoDto,
) {
  return this.proyectosService.vencerDocumento(
    proyectoId, docId, empresaId, centroId,
    dto.empresa_nombre, dto.centro_nombre, dto.proyecto_nombre,
  );
}
```

- [ ] **Step 4: Importar DocumentosVencidosModule en proyectos.module.ts**

```ts
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';

// En @Module imports:
imports: [
  MongooseModule.forFeature([
    { name: 'Proyecto', schema: ProyectoSchema },
    { name: 'CentroCosto', schema: CentroCostoSchema },
  ]),
  DocumentosVencidosModule,
],
```

- [ ] **Step 5: Verificar compilación y commit**

```bash
cd back4 && npm run start:dev
# Sin errores TypeScript

git add back4/src/proyectos/
git commit -m "feat(back): endpoint PATCH vencer documento de proyecto"
```

---

## Task 5: Frontend — DocumentosService

**Files:**
- Modify: `front4/src/app/features/documentos/documentos.service.ts`

**Interfaces:**
- Produces: `DocumentoVencidoItem` interface
- Produces: `documentosVencidos = signal<DocumentoVencidoItem[]>([])`
- Produces: `cargarVencidos(empresaId, centroId?, proyectoId?): void`
- Produces: `marcarVencido(docUrl, tipo, empresaId, centroId?, proyectoId?, empresaNombre?, centroNombre?, proyectoNombre?): void`

- [ ] **Step 1: Agregar tipo DocumentoVencidoItem y actualizar el service**

En `front4/src/app/features/documentos/documentos.service.ts`, agregar el tipo y los nuevos miembros. El archivo completo actualizado:

Agregar al final de los exports (después de `export type DocTipo`):

```ts
export interface DocumentoVencidoItem {
  _id: string;
  nombre_display: string;
  categoria?: string;
  tipo_mime: string;
  tamano_bytes?: number;
  subido_en?: string;
  vencido_en: string;
  origen_tipo: 'empresa' | 'centro' | 'proyecto';
  empresa_nombre?: string;
  centro_nombre?: string;
  proyecto_nombre?: string;
}
```

Agregar en la clase `DocumentosService`, después de la línea `readonly uploadStatus`:

```ts
readonly documentosVencidos = signal<DocumentoVencidoItem[]>([]);
```

Agregar los métodos `cargarVencidos` y `marcarVencido` al final de la clase (antes del cierre `}`):

```ts
cargarVencidos(empresaId: string, centroId?: string, proyectoId?: string): void {
  const params: Record<string, string> = { empresaId };
  if (centroId)   params['centroId']   = centroId;
  if (proyectoId) params['proyectoId'] = proyectoId;
  const qs = new URLSearchParams(params).toString();
  this.http.get<DocumentoVencidoItem[]>(this.api.url(`/documentos-vencidos?${qs}`)).subscribe({
    next:  (v) => this.documentosVencidos.set(v),
    error: ()  => this.documentosVencidos.set([]),
  });
}

marcarVencido(
  docUrl: string,
  tipo: DocTipo,
  empresaId: string,
  centroId?: string,
  proyectoId?: string,
  empresaNombre?: string,
  centroNombre?: string,
  proyectoNombre?: string,
): void {
  const body: Record<string, string> = {};
  if (empresaNombre) body['empresa_nombre'] = empresaNombre;
  if (centroNombre)  body['centro_nombre']  = centroNombre;
  if (proyectoNombre) body['proyecto_nombre'] = proyectoNombre;

  this.http.patch(docUrl + '/vencer', body).subscribe({
    next: () => {
      this.setUploadStatus(tipo, { type: 'ok', text: 'Documento marcado como vencido' });
      if (tipo === 'empresa') this.cargarEmpresa(empresaId);
      else if (tipo === 'centro'   && centroId)              this.cargarCentro(empresaId, centroId);
      else if (tipo === 'proyecto' && centroId && proyectoId) this.cargarProyecto(empresaId, centroId, proyectoId);
      this.cargarVencidos(empresaId, centroId, proyectoId);
    },
    error: (err) => {
      const raw = err?.error?.message;
      const text = Array.isArray(raw) ? raw.join('. ') : (raw ?? 'Error al marcar como vencido');
      this.setUploadStatus(tipo, { type: 'error', text });
    },
  });
}
```

- [ ] **Step 2: Verificar que el proyecto frontend compila**

```bash
cd front4 && npm start
```

Sin errores de TypeScript en la consola. Si hay errores, corregirlos.

- [ ] **Step 3: Commit**

```bash
git add front4/src/app/features/documentos/documentos.service.ts
git commit -m "feat(front): DocumentosService — tipo DocumentoVencidoItem, cargarVencidos, marcarVencido"
```

---

## Task 6: Frontend — Página Admin (TS + HTML)

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`

**Interfaces:**
- Consumes: `service.documentosVencidos()`, `service.cargarVencidos(...)`, `service.marcarVencido(...)` de Task 5

- [ ] **Step 1: Actualizar el tipo del signal tabAdminActiva en el .ts**

En `documentos-admin-page.component.ts`, cambiar la línea:

```ts
// Antes:
protected tabAdminActiva  = signal<'documentacion' | 'solicitudes'>('documentacion');

// Después:
protected tabAdminActiva  = signal<'documentacion' | 'solicitudes' | 'vencidos'>('documentacion');
```

- [ ] **Step 2: Agregar método cargarVencidosAdmin en el .ts**

Agregar al final de la clase (antes del cierre `}`):

```ts
cargarVencidosAdmin(): void {
  const empresaId  = this.selectedEmpresaId;
  const centroId   = (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined;
  const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;
  if (!empresaId) return;
  this.service.cargarVencidos(empresaId, centroId, proyectoId);
}

marcarVencidoAdmin(docUrl: string): void {
  const tipo      = this.docTipoActual;
  const empresaId = this.selectedEmpresaId;
  const centroId   = (this.selectedCentroId   && this.selectedCentroId   !== 'todos') ? this.selectedCentroId   : undefined;
  const proyectoId = (this.selectedProyectoId && this.selectedProyectoId !== 'todos') ? this.selectedProyectoId : undefined;
  this.service.marcarVencido(
    docUrl, tipo, empresaId, centroId, proyectoId,
    this.empresaNombre, this.centroNombre, this.proyectoNombre,
  );
}
```

- [ ] **Step 3: Agregar el tab "Vencidos" en el HTML**

En `documentos-admin-page.component.html`, localizar el bloque del sub-tab strip (alrededor de la línea 222). Actualmente contiene dos botones: "Documentación" y "Solicitudes".

Agregar el tercer botón entre "Documentación" y "Solicitudes". El tab Vencidos usa `flex:none` con padding reducido para ser visualmente más pequeño:

```html
<!-- Agregar entre el botón Documentación y el botón Solicitudes: -->
<button
  style="flex:none;padding:.45rem .75rem;border-style:solid;border-width:1px;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:.35rem"
  [style.background]="tabAdminActiva() === 'vencidos' ? 'rgba(239,68,68,.08)' : 'transparent'"
  [style.color]="tabAdminActiva() === 'vencidos' ? '#dc2626' : '#6b7280'"
  [style.borderColor]="tabAdminActiva() === 'vencidos' ? 'rgba(239,68,68,.2)' : 'transparent'"
  (click)="tabAdminActiva.set('vencidos'); cargarVencidosAdmin()">
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
  Vencidos
</button>
```

- [ ] **Step 4: Agregar botón "Vencer" en la lista de documentos activos**

En el HTML, localizar la lista de documentos activos (alrededor de la línea 321, el `@for (d of docsFiltrados(docTipo)...)`). El bloque de botones actualmente es:

```html
<div style="display:flex;gap:.5rem">
  <button class="btn-ghost"  style="font-size:.78rem;padding:.35rem .7rem" (click)="service.descargar(d.url, d.nombre_display)">Descargar</button>
  <button class="btn-danger" style="font-size:.78rem;padding:.35rem .7rem" (click)="eliminar(d.url, docTipo)">Eliminar</button>
</div>
```

Reemplazar por:

```html
<div style="display:flex;gap:.5rem">
  <button class="btn-ghost"  style="font-size:.78rem;padding:.35rem .7rem" (click)="service.descargar(d.url, d.nombre_display)">Descargar</button>
  <button style="font-size:.78rem;padding:.35rem .7rem;border-radius:.375rem;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.06);color:#dc2626;cursor:pointer" (click)="marcarVencidoAdmin(d.url)">Vencer</button>
  <button class="btn-danger" style="font-size:.78rem;padding:.35rem .7rem" (click)="eliminar(d.url, docTipo)">Eliminar</button>
</div>
```

- [ ] **Step 5: Agregar la vista del tab Vencidos en el HTML**

Después del bloque `} <!-- fin documentacion -->` (alrededor de la línea 380) y antes del bloque `@if (tabAdminActiva() === 'solicitudes')`, agregar:

```html
<!-- ── VENCIDOS ──────────────────────────────────────────── -->
@if (tabAdminActiva() === 'vencidos') {
  <p style="margin:0 0 .75rem;font-size:.8rem;color:#6b7280">Mostrando los últimos 20 documentos vencidos de este contexto.</p>
  @if (service.documentosVencidos().length === 0) {
    <p class="empty">Sin documentos vencidos.</p>
  }
  @for (v of service.documentosVencidos(); track v._id) {
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid rgba(34,33,33,.07)">
      <div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:0">
        @if (v.categoria) {
          <span style="font-size:.7rem;font-weight:600;padding:.2rem .5rem;border-radius:999px;background:#fee2e2;color:#991b1b;white-space:nowrap">{{ v.categoria }}</span>
        }
        <span style="font-size:.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ v.nombre_display }}</span>
      </div>
      <div style="display:flex;gap:.75rem;align-items:center;flex-shrink:0;margin-left:.75rem">
        @if (v.subido_en) {
          <span style="font-size:.75rem;color:#9ca3af">Subido: {{ formatFecha(v.subido_en) }}</span>
        }
        <span style="font-size:.75rem;color:#dc2626">Vencido: {{ formatFecha(v.vencido_en) }}</span>
      </div>
    </div>
  }
} <!-- fin vencidos -->
```

- [ ] **Step 6: Verificar visualmente en el navegador**

```bash
cd front4 && npm start
```

1. Ir a `/documentos` en modo admin
2. Seleccionar una empresa con documentos
3. Verificar que aparece el tab pequeño "Vencidos" junto a "Documentación"
4. Verificar que cada documento en Documentación tiene el botón "Vencer"
5. Hacer clic en "Vencer" en un documento — debe desaparecer de la lista
6. Hacer clic en el tab "Vencidos" — debe aparecer el documento vencido con fecha

- [ ] **Step 7: Commit**

```bash
git add front4/src/app/features/documentos/pages/documentos-admin-page.component.ts
git add front4/src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front): admin — tab Vencidos y botón Vencer en documentación"
```

---

## Task 7: Frontend — Página Consumidor (TS + HTML)

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts`
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html`

**Interfaces:**
- Consumes: `service.documentosVencidos()`, `service.cargarVencidos(...)`, `service.marcarVencido(...)` de Task 5

- [ ] **Step 1: Actualizar el tipo del signal tabConsumidorActiva**

En `documentos-consumidor-page.component.ts`:

```ts
// Antes:
protected tabConsumidorActiva = signal<'documentacion' | 'solicitudes'>('documentacion');

// Después:
protected tabConsumidorActiva = signal<'documentacion' | 'solicitudes' | 'vencidos'>('documentacion');
```

- [ ] **Step 2: Agregar métodos cargarVencidosConsumidor y marcarVencidoConsumidor**

Agregar al final de la clase (antes del cierre `}`):

```ts
cargarVencidosConsumidor(): void {
  const empresa = this.consumidorContext.empresaSeleccionada();
  if (!empresa) return;
  const centroId   = (this.selectedCentroIdC()   && this.selectedCentroIdC()   !== 'todos') ? this.selectedCentroIdC()   : undefined;
  const proyectoId = (this.selectedProyectoIdC() && this.selectedProyectoIdC() !== 'todos') ? this.selectedProyectoIdC() : undefined;
  this.service.cargarVencidos(empresa._id, centroId, proyectoId);
}

marcarVencidoConsumidor(docUrl: string): void {
  const empresa = this.consumidorContext.empresaSeleccionada();
  if (!empresa) return;
  const tipo       = this.docTipoActual;
  const centroId   = (this.selectedCentroIdC()   && this.selectedCentroIdC()   !== 'todos') ? this.selectedCentroIdC()   : undefined;
  const proyectoId = (this.selectedProyectoIdC() && this.selectedProyectoIdC() !== 'todos') ? this.selectedProyectoIdC() : undefined;
  this.service.marcarVencido(
    docUrl, tipo, empresa._id, centroId, proyectoId,
    this.empresaNombreC, this.centroNombreC, this.proyectoNombreC,
  );
}
```

- [ ] **Step 3: Agregar tab "Vencidos" en el HTML del consumidor**

En `documentos-consumidor-page.component.html`, localizar el sub-tab strip (alrededor de la línea 239, donde está el botón "Documentación"). El tab Vencidos va entre Documentación y Solicitudes, con el mismo estilo pequeño que en la página admin:

```html
<!-- Agregar entre el botón Documentación y el botón Solicitudes: -->
<button
  style="flex:none;padding:.45rem .75rem;border-style:solid;border-width:1px;border-radius:8px;font-size:.78rem;font-weight:600;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;justify-content:center;gap:.35rem"
  [style.background]="tabConsumidorActiva() === 'vencidos' ? 'rgba(239,68,68,.08)' : 'transparent'"
  [style.color]="tabConsumidorActiva() === 'vencidos' ? '#dc2626' : '#6b7280'"
  [style.borderColor]="tabConsumidorActiva() === 'vencidos' ? 'rgba(239,68,68,.2)' : 'transparent'"
  (click)="tabConsumidorActiva.set('vencidos'); cargarVencidosConsumidor()">
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
  Vencidos
</button>
```

- [ ] **Step 4: Agregar botón "Vencer" en la lista de documentos activos del consumidor**

En `documentos-consumidor-page.component.html`, localizar la sección `@if (puedeGestionarDocumento)` con el `@for (d of docsFiltrados(docTipo)...)`. El bloque de botones del documento actualmente tiene Descargar y Eliminar. Reemplazar con:

```html
<div style="display:flex;gap:.5rem">
  <button class="btn-ghost"  style="font-size:.78rem;padding:.35rem .7rem" (click)="service.descargar(d.url, d.nombre_display)">Descargar</button>
  <button style="font-size:.78rem;padding:.35rem .7rem;border-radius:.375rem;border:1px solid rgba(239,68,68,.3);background:rgba(239,68,68,.06);color:#dc2626;cursor:pointer" (click)="marcarVencidoConsumidor(d.url)">Vencer</button>
  <button class="btn-danger" style="font-size:.78rem;padding:.35rem .7rem" (click)="eliminar(d.url, docTipo)">Eliminar</button>
</div>
```

- [ ] **Step 5: Agregar la vista del tab Vencidos en el HTML consumidor**

Después del bloque `} <!-- fin documentacion -->` (alrededor de la línea 399) y antes del bloque `@if (tabConsumidorActiva() === 'solicitudes')`, agregar:

```html
<!-- ── VENCIDOS ──────────────────────────────────────────── -->
@if (tabConsumidorActiva() === 'vencidos') {
  <p style="margin:0 0 .75rem;font-size:.8rem;color:#6b7280">Mostrando los últimos 20 documentos vencidos de este contexto.</p>
  @if (service.documentosVencidos().length === 0) {
    <p class="empty">Sin documentos vencidos.</p>
  }
  @for (v of service.documentosVencidos(); track v._id) {
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.6rem 0;border-bottom:1px solid rgba(34,33,33,.07)">
      <div style="display:flex;align-items:center;gap:.5rem;flex:1;min-width:0">
        @if (v.categoria) {
          <span style="font-size:.7rem;font-weight:600;padding:.2rem .5rem;border-radius:999px;background:#fee2e2;color:#991b1b;white-space:nowrap">{{ v.categoria }}</span>
        }
        <span style="font-size:.875rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ v.nombre_display }}</span>
      </div>
      <div style="display:flex;gap:.75rem;align-items:center;flex-shrink:0;margin-left:.75rem">
        @if (v.subido_en) {
          <span style="font-size:.75rem;color:#9ca3af">Subido: {{ formatFecha(v.subido_en) }}</span>
        }
        <span style="font-size:.75rem;color:#dc2626">Vencido: {{ formatFecha(v.vencido_en) }}</span>
      </div>
    </div>
  }
} <!-- fin vencidos -->
```

- [ ] **Step 6: Verificar visualmente en el navegador en modo consumidor**

```bash
cd front4 && npm start
```

1. Cambiar a modo consumidor
2. Seleccionar una empresa
3. Ir a `/documentos`
4. Verificar que aparece el tab "Vencidos" pequeño
5. Verificar el botón "Vencer" en los documentos
6. Marcar un documento como vencido y verificar que aparece en el tab Vencidos

- [ ] **Step 7: Commit final**

```bash
git add front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts
git add front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html
git commit -m "feat(front): consumidor — tab Vencidos y botón Vencer en documentación"
```

---

## Self-Review

**Cobertura del spec:**
- ✅ Nueva colección `documentos_vencidos` separada (Task 1)
- ✅ Solo metadata, sin buffer binario (Tasks 1-4: el campo `contenido` nunca se copia)
- ✅ `empresa_id`, `centro_id`, `proyecto_id`, `origen_tipo` para identificar origen (Task 1 schema)
- ✅ `PATCH .../vencer` en los tres niveles (Tasks 2, 3, 4)
- ✅ `GET /documentos-vencidos` retorna últimos 20 (Task 1: `.limit(20).sort({ vencido_en: -1 })`)
- ✅ Tab pequeño "Vencidos" junto a "Documentación" en admin y consumidor (Tasks 6, 7)
- ✅ Botón "Vencer" en documentos activos, ambas páginas (Tasks 6, 7)
- ✅ Tab read-only: sin descargar, sin eliminar (Tasks 6, 7)
- ✅ Ambos perfiles pueden vencer: `@Roles('super_admin', 'admin_smartclarity', 'usuario')` (Tasks 2, 3, 4)

**Consistencia de tipos:**
- `DocumentoVencidoItem` definido en Task 5, consumido en Tasks 6 y 7 via `service.documentosVencidos()`
- `cargarVencidosAdmin()` y `cargarVencidosConsumidor()` llaman `service.cargarVencidos(empresaId, centroId?, proyectoId?)`
- `marcarVencidoAdmin(docUrl)` y `marcarVencidoConsumidor(docUrl)` llaman `service.marcarVencido(...)`
- Firma de `service.marcarVencido` en Task 5 coincide con llamadas en Tasks 6 y 7
