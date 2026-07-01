# Reestructuración de Documentos — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el almacenamiento de documentos binarios desde arrays embebidos en entidades MongoDB a colecciones separadas, eliminando el error de límite de 16MB.

**Architecture:** 5 colecciones de documentos activos (`doc_centro_costo`, `doc_cliente`, `doc_activo`, `doc_proyecto`, `doc_actividad`) + 1 colección compartida `doc_eliminados`. `DocumentosHelper` se refactoriza para operar sobre el modelo de documentos separado. Activos y Actividades migran de métodos inline a `DocumentosHelper`. El frontend de activos y actividades carga docs vía llamada separada en lugar de leerlos del objeto entidad embebido.

**Tech Stack:** NestJS, Mongoose, MongoDB, Angular 21, TypeScript

## Global Constraints

- Token de modelo Mongoose: siempre string (`'DocCentroCosto'`, `'DocEliminado'`) — nunca la clase directa
- Timestamps personalizados: `{ createdAt: 'creado_en' }` (no updatedAt en colecciones de docs)
- Sin `any` en código de producción — usar tipos explícitos o `Record<string, unknown>`
- Siempre `.lean()` en queries de lectura
- Los endpoints del backend no cambian su URL (solo cambia la implementación interna)
- Excepción: activos y actividades agregan `GET /:id/documentos` (endpoint nuevo) y cambian `:nombre` → `:docId` en delete/serve

---

## Mapa de archivos

| Acción | Archivo |
|---|---|
| Crear | `back4/src/common/schemas/doc-eliminado.schema.ts` |
| Crear | `back4/src/centros-costos/doc-centro-costo.schema.ts` |
| Crear | `back4/src/clientes/doc-cliente.schema.ts` |
| Crear | `back4/src/proyectos/doc-proyecto.schema.ts` |
| Crear | `back4/src/activos/doc-activo.schema.ts` |
| Crear | `back4/src/actividades/doc-actividad.schema.ts` |
| Modificar | `back4/src/common/helpers/documentos.helper.ts` |
| Modificar | `back4/src/centros-costos/centros-costos.schema.ts` |
| Modificar | `back4/src/centros-costos/centros-costos.module.ts` |
| Modificar | `back4/src/centros-costos/centros-costos.service.ts` |
| Modificar | `back4/src/clientes/clientes.schema.ts` |
| Modificar | `back4/src/clientes/clientes.module.ts` |
| Modificar | `back4/src/clientes/clientes.service.ts` |
| Modificar | `back4/src/proyectos/proyectos.schema.ts` |
| Modificar | `back4/src/proyectos/proyectos.module.ts` |
| Modificar | `back4/src/proyectos/proyectos.service.ts` |
| Modificar | `back4/src/activos/activos.schema.ts` |
| Modificar | `back4/src/activos/activos.module.ts` |
| Modificar | `back4/src/activos/activos.service.ts` |
| Modificar | `back4/src/activos/activos.controller.ts` |
| Modificar | `back4/src/actividades/actividades.schema.ts` |
| Modificar | `back4/src/actividades/actividades.module.ts` |
| Modificar | `back4/src/actividades/actividades.service.ts` |
| Modificar | `back4/src/actividades/actividades.controller.ts` |
| Modificar | `front4/src/app/shared/models/activo.model.ts` |
| Modificar | `front4/src/app/features/activos/activos.service.ts` |
| Modificar | `front4/src/app/features/activos/pages/activos-page.component.ts` |
| Modificar | `front4/src/app/features/actividades/actividades.service.ts` |
| Modificar | `front4/src/app/features/actividades/pages/actividades-page.component.ts` |

---

## Task 1: Crear schema DocEliminado

**Files:**
- Crear: `back4/src/common/schemas/doc-eliminado.schema.ts`

**Interfaces:**
- Produce: clase `DocEliminado`, tipo `DocEliminadoDocument`, constante `DocEliminadoSchema` — usados en Tasks 2, 3 y 4 para registrar el modelo en cada módulo

- [ ] **Step 1: Crear el archivo del schema**

```ts
// back4/src/common/schemas/doc-eliminado.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocEliminadoDocument = DocEliminado & Document;

@Schema({ collection: 'doc_eliminados', timestamps: { createdAt: 'eliminado_en' } })
export class DocEliminado {
  @Prop({ enum: ['empresa', 'centro', 'activo', 'proyecto', 'actividad'], required: true })
  origen_tipo: string;

  @Prop({ type: Types.ObjectId, required: true }) entidad_id: Types.ObjectId;
  @Prop() entidad_nombre?: string;

  @Prop({ required: true }) nombre_display: string;
  @Prop() categoria?: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
  @Prop() subido_en?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) eliminado_por?: Types.ObjectId;
}

export const DocEliminadoSchema = SchemaFactory.createForClass(DocEliminado);
DocEliminadoSchema.index({ origen_tipo: 1, entidad_id: 1 });
```

- [ ] **Step 2: Verificar que compila**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
```

Expected: sin errores relacionados con `doc-eliminado.schema.ts`

- [ ] **Step 3: Commit**

```bash
cd back4 && git add src/common/schemas/doc-eliminado.schema.ts
git commit -m "feat: agregar schema DocEliminado para documentos eliminados"
```

---

## Task 2: Refactorizar DocumentosHelper + migrar CentroCosto, Cliente, Proyecto

**Nota:** Este task debe completarse en un solo commit porque el cambio de constructor de `DocumentosHelper` rompe los tres servicios simultáneamente. Los pasos pueden hacerse en orden pero todos deben estar completos antes del commit final.

**Files:**
- Crear: `back4/src/centros-costos/doc-centro-costo.schema.ts`
- Crear: `back4/src/clientes/doc-cliente.schema.ts`
- Crear: `back4/src/proyectos/doc-proyecto.schema.ts`
- Modificar: `back4/src/common/helpers/documentos.helper.ts`
- Modificar: `back4/src/centros-costos/centros-costos.schema.ts`
- Modificar: `back4/src/centros-costos/centros-costos.module.ts`
- Modificar: `back4/src/centros-costos/centros-costos.service.ts`
- Modificar: `back4/src/clientes/clientes.schema.ts`
- Modificar: `back4/src/clientes/clientes.module.ts`
- Modificar: `back4/src/clientes/clientes.service.ts`
- Modificar: `back4/src/proyectos/proyectos.schema.ts`
- Modificar: `back4/src/proyectos/proyectos.module.ts`
- Modificar: `back4/src/proyectos/proyectos.service.ts`

**Interfaces:**
- Consume: `DocEliminadoSchema`, `DocEliminadoDocument` de Task 1
- Produce: `DocumentosHelper` con nueva firma de constructor; tres servicios migrados completamente

- [ ] **Step 1: Crear schema DocCentroCosto**

```ts
// back4/src/centros-costos/doc-centro-costo.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocCentroCostoDocument = DocCentroCosto & Document;

@Schema({ collection: 'doc_centro_costo', timestamps: { createdAt: 'creado_en' } })
export class DocCentroCosto {
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
  @Prop() categoria?: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) subido_por?: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}

export const DocCentroCostoSchema = SchemaFactory.createForClass(DocCentroCosto);
DocCentroCostoSchema.index({ centro_costo_id: 1 });
```

- [ ] **Step 2: Crear schema DocCliente**

```ts
// back4/src/clientes/doc-cliente.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocClienteDocument = DocCliente & Document;

@Schema({ collection: 'doc_cliente', timestamps: { createdAt: 'creado_en' } })
export class DocCliente {
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
  @Prop() categoria?: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) subido_por?: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}

export const DocClienteSchema = SchemaFactory.createForClass(DocCliente);
DocClienteSchema.index({ cliente_id: 1 });
```

- [ ] **Step 3: Crear schema DocProyecto**

```ts
// back4/src/proyectos/doc-proyecto.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocProyectoDocument = DocProyecto & Document;

@Schema({ collection: 'doc_proyecto', timestamps: { createdAt: 'creado_en' } })
export class DocProyecto {
  @Prop({ type: Types.ObjectId, ref: 'Proyecto', required: true }) proyecto_id: Types.ObjectId;
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
  @Prop() categoria?: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) subido_por?: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}

export const DocProyectoSchema = SchemaFactory.createForClass(DocProyecto);
DocProyectoSchema.index({ proyecto_id: 1 });
```

- [ ] **Step 4: Reescribir DocumentosHelper**

Reemplazar el contenido completo de `back4/src/common/helpers/documentos.helper.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

export interface ArchivoInput {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
}

export class DocumentosHelper {
  constructor(
    private readonly entidadModel: Model<any>,
    private readonly docModel: Model<any>,
    private readonly fkField: string,
    private readonly docEliminadoModel: Model<any>,
    private readonly origenTipo: 'empresa' | 'centro' | 'activo' | 'proyecto' | 'actividad',
    private readonly entidad: string,
  ) {}

  async agregar(
    id: string,
    archivo: ArchivoInput,
    nombreDisplay?: string,
    categoria?: string,
    usuarioId?: string,
  ): Promise<Record<string, unknown>> {
    const existe = await this.entidadModel.findById(id).lean();
    if (!existe) throw new NotFoundException(`${this.entidad} ${id} no encontrado`);

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;

    const dotIdx = archivo.originalname.lastIndexOf('.');
    const originalExt = dotIdx > 0 ? archivo.originalname.slice(dotIdx) : '';
    const rawBase = nombreDisplay?.trim() || archivo.originalname;
    const nombre_display = originalExt && !rawBase.endsWith(originalExt)
      ? rawBase + originalExt
      : rawBase;

    const nuevoDoc: Record<string, unknown> = {
      [this.fkField]: new Types.ObjectId(id),
      nombre,
      nombre_display,
      tipo_mime:    archivo.mimetype,
      tamano_bytes: archivo.size,
      contenido:    archivo.buffer,
      subido_en:    new Date(),
    };
    if (categoria) nuevoDoc['categoria'] = categoria;
    if (usuarioId) nuevoDoc['subido_por'] = new Types.ObjectId(usuarioId);

    const doc = await this.docModel.create(nuevoDoc);
    const obj = doc.toObject() as Record<string, unknown>;
    delete obj['contenido'];
    return obj;
  }

  async listar(id: string): Promise<Record<string, unknown>[]> {
    return this.docModel
      .find({ [this.fkField]: new Types.ObjectId(id) })
      .select('-contenido')
      .lean();
  }

  async servir(entidadId: string, docId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const doc = await this.docModel.findOne({
      _id: new Types.ObjectId(docId),
      [this.fkField]: new Types.ObjectId(entidadId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);
    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from((raw as { buffer: ArrayBuffer }).buffer);
    return { buffer, tipo_mime: doc.tipo_mime as string, nombre_display: doc.nombre_display as string };
  }

  async eliminar(entidadId: string, docId: string): Promise<{ message: string; docId: string }> {
    const doc = await this.docModel.findOne({
      _id: new Types.ObjectId(docId),
      [this.fkField]: new Types.ObjectId(entidadId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    await this.docEliminadoModel.create({
      origen_tipo:    this.origenTipo,
      entidad_id:     new Types.ObjectId(entidadId),
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_mime:      doc.tipo_mime,
      tamano_bytes:   doc.tamano_bytes,
      contenido:      doc.contenido,
      subido_en:      doc.subido_en,
    });

    await this.docModel.deleteOne({ _id: doc._id });
    return { message: 'Documento eliminado', docId };
  }
}
```

- [ ] **Step 5: Actualizar centros-costos.module.ts**

```ts
// back4/src/centros-costos/centros-costos.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CentroCostoSchema } from './centros-costos.schema';
import { DocCentroCostoSchema } from './doc-centro-costo.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
import { CentrosCostosController, CentrosCostosAdminController } from './centros-costos.controller';
import { CentrosCostosService } from './centros-costos.service';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'DocCentroCosto', schema: DocCentroCostoSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
    DocumentosVencidosModule,
    MailModule,
  ],
  controllers: [CentrosCostosController, CentrosCostosAdminController],
  providers: [CentrosCostosService],
  exports: [CentrosCostosService],
})
export class CentrosCostosModule {}
```

- [ ] **Step 6: Actualizar centros-costos.schema.ts — eliminar documentos embebidos**

Reemplazar el contenido del archivo:

```ts
// back4/src/centros-costos/centros-costos.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CentroCostoDocument = CentroCosto & Document;

@Schema({ collection: 'centros_costos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class CentroCosto {
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ required: true, trim: true }) codigo: string;
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ trim: true }) ubicacion_direccion?: string;
  @Prop({ trim: true }) ubicacion_ciudad?: string;
  @Prop({ trim: true }) ubicacion_region?: string;
  @Prop({ trim: true }) ubicacion_pais?: string;
  @Prop() ubicacion_latitud?: number;
  @Prop() ubicacion_longitud?: number;
  @Prop({ default: true }) activo: boolean;
  @Prop({ type: [Number], default: [5, 5, 5, 5, 5] }) score_smartclarity: number[];
}

export const CentroCostoSchema = SchemaFactory.createForClass(CentroCosto);
CentroCostoSchema.index({ cliente_id: 1, activo: 1 });
CentroCostoSchema.index({ cliente_id: 1, codigo: 1 }, { unique: true });
```

- [ ] **Step 7: Actualizar centros-costos.service.ts**

Reemplazar el contenido completo del archivo:

```ts
// back4/src/centros-costos/centros-costos.service.ts
import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CentroCostoDocument } from './centros-costos.schema';
import { CreateCentroCostoDto, UpdateCentroCostoDto } from './centros-costos.dto';
import { DocumentosHelper, ArchivoInput } from '../common/helpers/documentos.helper';
import { notificarDocumentoSubido } from '../common/helpers/notificar-documento.helper';
import { DocumentosVencidosService } from '../documentos-vencidos/documentos-vencidos.service';
import { MailService } from '../mail/mail.service';
import { NotificacionOpcionesDto } from '../common/dto/notificacion-opciones.dto';

@Injectable()
export class CentrosCostosService {
  private readonly docsHelper: DocumentosHelper;
  private readonly logger = new Logger(CentrosCostosService.name);

  constructor(
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('DocCentroCosto') private docCentroCostoModel: Model<any>,
    @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
    @InjectModel('Usuario') private readonly usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    private readonly documentosVencidosService: DocumentosVencidosService,
    private readonly mailService: MailService,
  ) {
    this.docsHelper = new DocumentosHelper(
      centroCostoModel,
      docCentroCostoModel,
      'centro_costo_id',
      docEliminadoModel,
      'centro',
      'Centro de costos',
    );
  }

  private toObjectId(value: string) {
    return new Types.ObjectId(value);
  }

  async create(dto: CreateCentroCostoDto) {
    const existe = await this.centroCostoModel.findOne({
      cliente_id: this.toObjectId(dto.cliente_id!),
      codigo: dto.codigo,
    });
    if (existe) throw new ConflictException(`El código "${dto.codigo}" ya existe en esta empresa. Usa un código distinto.`);
    try {
      return await new this.centroCostoModel({
        ...dto,
        cliente_id: this.toObjectId(dto.cliente_id!),
      }).save();
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException(`El código "${dto.codigo}" ya existe en esta empresa. Usa un código distinto.`);
      }
      throw err;
    }
  }

  async findAll(page = 1, limit = 20) {
    const filter = { activo: true };
    const [data, total] = await Promise.all([
      this.centroCostoModel.find(filter).skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(cliente_id: string, page = 1, limit = 20) {
    const filter = { cliente_id: new Types.ObjectId(cliente_id), activo: true };
    const [data, total] = await Promise.all([
      this.centroCostoModel.find(filter).skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findByIds(ids: string[]) {
    return this.centroCostoModel
      .find({ _id: { $in: ids.map(id => new Types.ObjectId(id)) }, activo: true })
      .lean();
  }

  async findOne(id: string) {
    const centro = await this.centroCostoModel.findById(id).lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro;
  }

  async update(id: string, dto: UpdateCentroCostoDto) {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.cliente_id) payload['cliente_id'] = this.toObjectId(dto.cliente_id);
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, payload, { new: true })
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro;
  }

  async remove(id: string) {
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return { message: 'Centro desactivado', id };
  }

  async updateScoreSmartclarity(centroId: string, valores: number[]) {
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(centroId, { score_smartclarity: valores }, { new: true, runValidators: true })
      .lean();
    if (!centro) throw new NotFoundException(`Centro ${centroId} no encontrado`);
    return centro;
  }

  async agregarDocumento(id: string, archivo: ArchivoInput, nombreDisplay?: string, categoria?: string, usuarioId?: string, rolUploader?: string) {
    const result = await this.docsHelper.agregar(id, archivo, nombreDisplay, categoria, usuarioId);
    if (rolUploader === 'usuario') {
      this.notificarSubidaDocumento(id, result['nombre_display'] as string, result['categoria'] as string | undefined, usuarioId)
        .catch((err: unknown) => this.logger.error('Error al notificar subida de documento (centro):', err));
    }
    return result;
  }

  private async notificarSubidaDocumento(centroId: string, nombre: string, categoria?: string, usuarioId?: string): Promise<void> {
    const centro = await this.centroCostoModel.findById(centroId).select('nombre').lean() as any;
    const contexto = centro ? `Centro: ${centro.nombre}` : 'Centro de costos';
    await notificarDocumentoSubido({
      contexto,
      nombre,
      categoria: categoria ?? 'Sin categoría',
      usuarioId,
      usuarioModel: this.usuarioModel as any,
      mailService: this.mailService,
      logger: this.logger,
    });
  }

  listarDocumentos(id: string) {
    return this.docsHelper.listar(id);
  }

  servirDocumento(centroId: string, docId: string) {
    return this.docsHelper.servir(centroId, docId);
  }

  eliminarDocumento(centroId: string, docId: string) {
    return this.docsHelper.eliminar(centroId, docId);
  }

  async vencerDocumento(
    centroId: string, docId: string,
    empresaId?: string, empresaNombre?: string, centroNombre?: string,
    notificacion?: NotificacionOpcionesDto,
  ) {
    const centro = await this.centroCostoModel.findById(centroId).lean();
    if (!centro) throw new NotFoundException(`Centro ${centroId} no encontrado`);

    const doc = await this.docCentroCostoModel.findOne({
      _id: new Types.ObjectId(docId),
      centro_costo_id: new Types.ObjectId(centroId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    const resolvedEmpresaId = empresaId ?? String(centro.cliente_id);

    await this.documentosVencidosService.crear({
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_mime:      doc.tipo_mime,
      tamano_bytes:   doc.tamano_bytes,
      contenido:      doc.contenido,
      origen_tipo:    'centro',
      empresa_id:     resolvedEmpresaId,
      centro_id:      centroId,
      empresa_nombre: empresaNombre,
      centro_nombre:  centroNombre,
      subido_en:      doc.subido_en,
    });

    await this.docCentroCostoModel.deleteOne({ _id: doc._id });

    void this.notificarVencimiento(
      resolvedEmpresaId,
      centroId,
      doc.nombre_display as string,
      doc.categoria as string,
      centroNombre ?? 'centro de costos',
      notificacion,
    );

    return { message: 'Documento marcado como vencido', docId };
  }

  private async notificarVencimiento(
    empresaIdStr: string,
    centroId: string,
    nombreDoc: string,
    categoria: string,
    contextoLabel: string,
    notificacion?: NotificacionOpcionesDto,
  ): Promise<void> {
    if (!notificacion?.notificar) return;

    try {
      const empresaId = new Types.ObjectId(empresaIdStr);
      const centroObjId = new Types.ObjectId(centroId);

      let usuariosDestino: { nombre: string; email: string }[] = [];

      if (notificacion.audiencia === 'especificos') {
        usuariosDestino = await this.usuarioModel
          .find({
            _id: { $in: (notificacion.destinatarios_ids ?? []).map(id => new Types.ObjectId(id)) },
            activo: true,
            $or: [{ cliente_id: empresaId }, { rol: 'admin_smartclarity' }],
          })
          .select('nombre email')
          .lean();
      } else {
        usuariosDestino = await this.usuarioModel
          .find({
            activo: true,
            $or: [
              { rol: 'admin_smartclarity' },
              { cliente_id: empresaId, centros_asignados: centroObjId },
            ],
          })
          .select('nombre email')
          .lean();
      }

      const superAdmins = notificacion.notificar_super_admins
        ? await this.usuarioModel.find({ rol: 'super_admin', activo: true }).select('nombre email').lean()
        : [];

      const vistos = new Set<string>();
      const destinatarios: { nombre: string; email: string }[] = [];
      for (const u of [...usuariosDestino, ...superAdmins]) {
        if (u.email && !vistos.has(u.email)) {
          vistos.add(u.email);
          destinatarios.push({ nombre: u.nombre, email: u.email });
        }
      }

      if (destinatarios.length === 0) return;

      await this.mailService.notificarDocumentoVencido({
        destinatarios,
        documento: { nombre: nombreDoc, categoria, contexto: contextoLabel },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar vencimiento de documento:', err);
    }
  }
}
```

- [ ] **Step 8: Actualizar clientes.module.ts**

```ts
// back4/src/clientes/clientes.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClienteSchema } from './clientes.schema';
import { DocClienteSchema } from './doc-cliente.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Cliente', schema: ClienteSchema },
      { name: 'DocCliente', schema: DocClienteSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
    DocumentosVencidosModule,
    MailModule,
  ],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
```

- [ ] **Step 9: Actualizar clientes.schema.ts — eliminar documentos embebidos**

Eliminar la clase `DocumentoEmpresa` y el campo `@Prop documentos`. El resto del schema no cambia:

```ts
// back4/src/clientes/clientes.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ClienteDocument = Cliente & Document;

@Schema({ collection: 'clientes', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Cliente {
  @Prop({ required: true, trim: true }) razon_social: string;
  @Prop({ required: true, unique: true, trim: true }) rut: string;
  @Prop({ required: true, lowercase: true, trim: true }) email_contacto: string;
  @Prop({ trim: true }) telefono?: string;
  @Prop({
    type: {
      calle: String,
      ciudad: String,
      region: String,
      pais: { type: String, default: 'Chile' },
    },
  })
  direccion?: {
    calle?: string;
    ciudad?: string;
    region?: string;
    pais?: string;
  };
  @Prop({ default: true }) activo: boolean;
  @Prop({
    type: {
      contenido: Buffer,
      tipo_mime: String,
      nombre: String,
    },
  })
  logo?: { contenido: Buffer; tipo_mime: string; nombre: string };
  @Prop({ type: [Number], default: [5, 5, 5, 5, 5] }) score_smartclarity: number[];
  @Prop({ default: false }) mostrar_grafico_promedio: boolean;
}

export const ClienteSchema = SchemaFactory.createForClass(Cliente);
ClienteSchema.index({ activo: 1 });
```

- [ ] **Step 10: Actualizar clientes.service.ts — inyectar modelos y migrar vencerDocumento**

Agregar las inyecciones y actualizar el constructor y `vencerDocumento`. Las líneas clave a cambiar:

Cambiar el constructor de:
```ts
constructor(
  @InjectModel('Cliente') private clienteModel: Model<ClienteDocument>,
  @InjectModel('Usuario') private readonly usuarioModel: ...,
  private readonly documentosVencidosService: DocumentosVencidosService,
  ...
) {
  this.docsHelper = new DocumentosHelper(clienteModel, 'Cliente', '-logo.contenido -documentos.contenido');
}
```

A:
```ts
constructor(
  @InjectModel('Cliente') private clienteModel: Model<ClienteDocument>,
  @InjectModel('DocCliente') private docClienteModel: Model<any>,
  @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
  @InjectModel('Usuario') private readonly usuarioModel: Model<{ nombre: string; email: string; rol: string; activo: boolean }>,
  private readonly documentosVencidosService: DocumentosVencidosService,
  private readonly mailService: MailService,
) {
  this.docsHelper = new DocumentosHelper(
    clienteModel,
    docClienteModel,
    'cliente_id',
    docEliminadoModel,
    'empresa',
    'Cliente',
  );
}
```

Eliminar el tercer argumento `'-logo.contenido -documentos.contenido'` del helper (ya no necesario).

Cambiar todas las queries de clientes que tenían `.select('-logo.contenido -documentos.contenido')` a solo `.select('-logo.contenido')`.

Reemplazar el método `vencerDocumento` completo:

```ts
async vencerDocumento(clienteId: string, docId: string, empresaNombre?: string, notificacion?: NotificacionOpcionesDto) {
  const cliente = await this.clienteModel.findById(clienteId).lean();
  if (!cliente) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);

  const doc = await this.docClienteModel.findOne({
    _id: new Types.ObjectId(docId),
    cliente_id: new Types.ObjectId(clienteId),
  });
  if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

  await this.documentosVencidosService.crear({
    nombre_display: doc.nombre_display,
    categoria:      doc.categoria,
    tipo_mime:      doc.tipo_mime,
    tamano_bytes:   doc.tamano_bytes,
    contenido:      doc.contenido,
    origen_tipo:    'empresa',
    empresa_id:     clienteId,
    empresa_nombre: empresaNombre,
    subido_en:      doc.subido_en,
  });

  await this.docClienteModel.deleteOne({ _id: doc._id });

  void this.notificarVencimiento(
    clienteId,
    doc.nombre_display as string,
    doc.categoria as string,
    empresaNombre ?? 'empresa',
    notificacion,
  );

  return { message: 'Documento marcado como vencido', docId };
}
```

- [ ] **Step 11: Actualizar proyectos.module.ts**

```ts
// back4/src/proyectos/proyectos.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProyectoSchema } from './proyectos.schema';
import { DocProyectoSchema } from './doc-proyecto.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
import { ProyectosController, ProyectosAdminController, ProyectosEmpresaController } from './proyectos.controller';
import { ProyectosService } from './proyectos.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { DocumentosVencidosModule } from '../documentos-vencidos/documentos-vencidos.module';
import { UsuarioSchema } from '../usuarios/usuarios.schema';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Proyecto', schema: ProyectoSchema },
      { name: 'DocProyecto', schema: DocProyectoSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'Usuario', schema: UsuarioSchema },
    ]),
    DocumentosVencidosModule,
    MailModule,
  ],
  controllers: [ProyectosController, ProyectosAdminController, ProyectosEmpresaController],
  providers: [ProyectosService],
  exports: [ProyectosService],
})
export class ProyectosModule {}
```

- [ ] **Step 12: Actualizar proyectos.schema.ts — eliminar documentos embebidos**

```ts
// back4/src/proyectos/proyectos.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProyectoDocument = Proyecto & Document;

@Schema({ collection: 'proyectos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Proyecto {
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) cliente_id: Types.ObjectId;
  @Prop({ required: true, trim: true }) codigo: string;
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ enum: ['borrador', 'activo', 'cerrado'], default: 'borrador' }) estado: string;
  @Prop() fecha_inicio?: Date;
  @Prop() fecha_fin?: Date;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) creado_por?: Types.ObjectId;
}

export const ProyectoSchema = SchemaFactory.createForClass(Proyecto);
ProyectoSchema.index({ centro_costo_id: 1, estado: 1 });
ProyectoSchema.index({ cliente_id: 1, estado: 1 });
ProyectoSchema.index({ centro_costo_id: 1, codigo: 1 }, { unique: true });
```

- [ ] **Step 13: Actualizar proyectos.service.ts — inyectar modelos y migrar vencerDocumento**

Cambiar el constructor:
```ts
constructor(
  @InjectModel('Proyecto') private proyectoModel: Model<ProyectoDocument>,
  @InjectModel('DocProyecto') private docProyectoModel: Model<any>,
  @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
  @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
  @InjectModel('Usuario') private readonly usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
  private readonly documentosVencidosService: DocumentosVencidosService,
  private readonly mailService: MailService,
) {
  this.docsHelper = new DocumentosHelper(
    proyectoModel,
    docProyectoModel,
    'proyecto_id',
    docEliminadoModel,
    'proyecto',
    'Proyecto',
  );
}
```

Eliminar todos los `.select('-documentos.contenido')` de las queries de proyectos.

Reemplazar `vencerDocumento`:

```ts
async vencerDocumento(
  proyectoId: string, docId: string,
  empresaId: string, centroId: string,
  empresaNombre?: string, centroNombre?: string, proyectoNombre?: string,
  notificacion?: NotificacionOpcionesDto,
) {
  const proyecto = await this.proyectoModel.findById(proyectoId).lean();
  if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);

  const doc = await this.docProyectoModel.findOne({
    _id: new Types.ObjectId(docId),
    proyecto_id: new Types.ObjectId(proyectoId),
  });
  if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

  await this.documentosVencidosService.crear({
    nombre_display:  doc.nombre_display,
    categoria:       doc.categoria,
    tipo_mime:       doc.tipo_mime,
    tamano_bytes:    doc.tamano_bytes,
    contenido:       doc.contenido,
    origen_tipo:     'proyecto',
    empresa_id:      empresaId,
    centro_id:       centroId,
    proyecto_id:     proyectoId,
    empresa_nombre:  empresaNombre,
    centro_nombre:   centroNombre,
    proyecto_nombre: proyectoNombre,
    subido_en:       doc.subido_en,
  });

  await this.docProyectoModel.deleteOne({ _id: doc._id });

  void this.notificarVencimiento(
    empresaId,
    centroId,
    doc.nombre_display as string,
    doc.categoria as string,
    proyectoNombre ?? centroNombre ?? 'proyecto',
    notificacion,
  );

  return { message: 'Documento marcado como vencido', docId };
}
```

- [ ] **Step 14: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -30
```

Expected: cero errores

- [ ] **Step 15: Probar servidor arranque y endpoints**

```bash
cd back4 && npm run start:dev
```

Luego con JWT válido en la variable `TOKEN`:

```bash
# Listar docs de un centro (espera array vacío si migración limpia)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/empresas/EMPRESA_ID/centros/CENTRO_ID/documentos

# Subir un documento de prueba
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "archivo=@/tmp/test.pdf" \
  -F "nombre_display=Test documento" \
  http://localhost:3000/api/v1/empresas/EMPRESA_ID/centros/CENTRO_ID/documentos

# Verificar que aparece en la lista
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/empresas/EMPRESA_ID/centros/CENTRO_ID/documentos

# Eliminar (usar el _id del documento devuelto)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/empresas/EMPRESA_ID/centros/CENTRO_ID/documentos/DOC_ID

# Verificar en MongoDB que está en doc_eliminados
# En MongoDB shell: db.doc_eliminados.find().pretty()
```

Expected: subida devuelve metadata del doc (sin `contenido`), lista devuelve array con el doc, eliminar devuelve `{message, docId}`, se crea registro en `doc_eliminados`

- [ ] **Step 16: Commit**

```bash
git add back4/src/centros-costos/ back4/src/clientes/ back4/src/proyectos/ back4/src/common/helpers/documentos.helper.ts
git commit -m "feat: migrar documentos de centros, clientes y proyectos a colecciones separadas"
```

---

## Task 3: Migrar Activos

**Files:**
- Crear: `back4/src/activos/doc-activo.schema.ts`
- Modificar: `back4/src/activos/activos.schema.ts`
- Modificar: `back4/src/activos/activos.module.ts`
- Modificar: `back4/src/activos/activos.service.ts`
- Modificar: `back4/src/activos/activos.controller.ts`

**Interfaces:**
- Consume: `DocumentosHelper` de Task 2, `DocEliminadoSchema` de Task 1
- Produce: endpoints `/activos/:id/documentos` (GET nuevo), `/:docId` en lugar de `/:nombre` en DELETE y GET

- [ ] **Step 1: Crear schema DocActivo**

```ts
// back4/src/activos/doc-activo.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocActivoDocument = DocActivo & Document;

@Schema({ collection: 'doc_activo', timestamps: { createdAt: 'creado_en' } })
export class DocActivo {
  @Prop({ type: Types.ObjectId, ref: 'Activo', required: true }) activo_id: Types.ObjectId;
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
  @Prop({ default: Date.now }) subido_en: Date;
}

export const DocActivoSchema = SchemaFactory.createForClass(DocActivo);
DocActivoSchema.index({ activo_id: 1 });
```

- [ ] **Step 2: Actualizar activos.schema.ts — eliminar documentos embebidos**

```ts
// back4/src/activos/activos.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActivoDocument = Activo & Document;

@Schema({ collection: 'activos', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Activo {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoActivo', required: true }) tipo_activo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ default: true }) activo: boolean;
}

export const ActivoSchema = SchemaFactory.createForClass(Activo);
ActivoSchema.index({ centro_costo_id: 1, activo: 1 });
ActivoSchema.index({ tipo_activo_id: 1 });
```

- [ ] **Step 3: Actualizar activos.module.ts**

```ts
// back4/src/activos/activos.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivoSchema } from './activos.schema';
import { DocActivoSchema } from './doc-activo.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
import { ActivosController, ActivosAdminController } from './activos.controller';
import { ActivosService } from './activos.service';
import { CentroCostoSchema } from '../centros-costos/centros-costos.schema';
import { TipoActivoSchema } from '../tipos-activo/tipos-activo.schema';
import { ActividadesModule } from '../actividades/actividades.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Activo', schema: ActivoSchema },
      { name: 'DocActivo', schema: DocActivoSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
      { name: 'CentroCosto', schema: CentroCostoSchema },
      { name: 'TipoActivo', schema: TipoActivoSchema },
    ]),
    ActividadesModule,
  ],
  controllers: [ActivosController, ActivosAdminController],
  providers: [ActivosService],
  exports: [ActivosService],
})
export class ActivosModule {}
```

- [ ] **Step 4: Actualizar activos.service.ts — reemplazar métodos inline con DocumentosHelper**

Cambiar el constructor y métodos de documentos. El resto del service (create, findAll, findOne, update, remove, findAllByEmpresa) no cambia salvo eliminar `.select('-documentos.contenido')`.

```ts
// Agregar imports nuevos al inicio:
import { DocumentosHelper, ArchivoInput } from '../common/helpers/documentos.helper';

// Cambiar constructor — agregar inyecciones y crear helper:
constructor(
  @InjectModel('Activo') private activoModel: Model<ActivoDocument>,
  @InjectModel('DocActivo') private docActivoModel: Model<any>,
  @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
  @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
  @InjectModel('TipoActivo') private tipoActivoModel: Model<any>,
  private readonly actividadesService: ActividadesService,
) {
  this.docsHelper = new DocumentosHelper(
    activoModel,
    docActivoModel,
    'activo_id',
    docEliminadoModel,
    'activo',
    'Activo',
  );
}

private readonly docsHelper: DocumentosHelper;
```

Eliminar todos los `.select('-documentos.contenido')` de los queries de activos.

Reemplazar los tres métodos inline `subirDocumento`, `eliminarDocumento`, `servirDocumento` con:

```ts
listarDocumentos(activoId: string) {
  return this.docsHelper.listar(activoId);
}

subirDocumento(activoId: string, archivo: ArchivoInput, nombreDisplay?: string) {
  return this.docsHelper.agregar(activoId, archivo, nombreDisplay);
}

servirDocumento(activoId: string, docId: string) {
  return this.docsHelper.servir(activoId, docId);
}

eliminarDocumento(activoId: string, docId: string) {
  return this.docsHelper.eliminar(activoId, docId);
}
```

- [ ] **Step 5: Actualizar activos.controller.ts — agregar GET lista y cambiar :nombre por :docId**

```ts
// Reemplazar los tres endpoints de documentos en ActivosController:

@Get(':activoId/documentos')
listarDocumentos(@Param('activoId') activoId: string) {
  return this.activosService.listarDocumentos(activoId);
}

@Post(':activoId/documentos')
@Roles('super_admin', 'admin_smartclarity')
@UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
subirDocumento(
  @Param('activoId') activoId: string,
  @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  @Body('nombre_display') nombreDisplay?: string,
) {
  if (!archivo) throw new BadRequestException('No se proporcionó archivo');
  return this.activosService.subirDocumento(activoId, archivo, nombreDisplay);
}

@Delete(':activoId/documentos/:docId')
@Roles('super_admin', 'admin_smartclarity')
eliminarDocumento(
  @Param('activoId') activoId: string,
  @Param('docId') docId: string,
) {
  return this.activosService.eliminarDocumento(activoId, docId);
}

@Get(':activoId/documentos/:docId')
async descargarDocumento(
  @Param('activoId') activoId: string,
  @Param('docId') docId: string,
  @Res() res: Response,
) {
  const { buffer, tipo_mime, nombre_display } = await this.activosService.servirDocumento(activoId, docId);
  sendFile(res, buffer, tipo_mime, nombre_display);
}
```

- [ ] **Step 6: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
```

Expected: cero errores

- [ ] **Step 7: Probar endpoints de activos**

```bash
# Listar docs de un activo
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/empresas/EMPRESA_ID/centros/CENTRO_ID/activos/ACTIVO_ID/documentos

# Subir
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "archivo=@/tmp/test.pdf" \
  http://localhost:3000/api/v1/empresas/EMPRESA_ID/centros/CENTRO_ID/activos/ACTIVO_ID/documentos

# Eliminar (DOC_ID del _id devuelto en la subida)
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/empresas/EMPRESA_ID/centros/CENTRO_ID/activos/ACTIVO_ID/documentos/DOC_ID
```

Expected: mismos resultados que Task 2

- [ ] **Step 8: Commit**

```bash
git add back4/src/activos/
git commit -m "feat: migrar documentos de activos a colección separada doc_activo"
```

---

## Task 4: Migrar Actividades

**Files:**
- Crear: `back4/src/actividades/doc-actividad.schema.ts`
- Modificar: `back4/src/actividades/actividades.schema.ts`
- Modificar: `back4/src/actividades/actividades.module.ts`
- Modificar: `back4/src/actividades/actividades.service.ts`
- Modificar: `back4/src/actividades/actividades.controller.ts`

**Interfaces:**
- Consume: `DocumentosHelper` de Task 2, `DocEliminadoSchema` de Task 1
- Produce: endpoints `GET /actividades/:id/documentos` (nuevo), `/:docId` en lugar de `/:nombre`

- [ ] **Step 1: Crear schema DocActividad**

```ts
// back4/src/actividades/doc-actividad.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DocActividadDocument = DocActividad & Document;

@Schema({ collection: 'doc_actividad', timestamps: { createdAt: 'creado_en' } })
export class DocActividad {
  @Prop({ type: Types.ObjectId, ref: 'Actividad', required: true }) actividad_id: Types.ObjectId;
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
  @Prop({ default: Date.now }) subido_en: Date;
}

export const DocActividadSchema = SchemaFactory.createForClass(DocActividad);
DocActividadSchema.index({ actividad_id: 1 });
```

- [ ] **Step 2: Actualizar actividades.schema.ts — eliminar documentos embebidos**

Eliminar la interfaz `DocActividad` (exportada) y el campo `documentos`. El resto del schema no cambia:

```ts
// back4/src/actividades/actividades.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActividadDocument = Actividad & Document;

@Schema({ collection: 'actividades', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Actividad {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ type: Types.ObjectId, ref: 'TipoActividad', required: true }) tipo_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto', required: true }) centro_costo_id: Types.ObjectId;
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Activo' }], default: [] }) activo_ids: Types.ObjectId[];
  @Prop({ required: true }) fecha: Date;
}

export const ActividadSchema = SchemaFactory.createForClass(Actividad);
ActividadSchema.index({ centro_costo_id: 1, fecha: 1 });
```

- [ ] **Step 3: Actualizar actividades.module.ts**

Leer el módulo actual y agregar los dos schemas nuevos a `MongooseModule.forFeature`. El módulo se ve así después:

```ts
// back4/src/actividades/actividades.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActividadSchema } from './actividades.schema';
import { DocActividadSchema } from './doc-actividad.schema';
import { DocEliminadoSchema } from '../common/schemas/doc-eliminado.schema';
// ... resto de imports existentes ...

@Module({
  imports: [
    MongooseModule.forFeature([
      // ... schemas existentes que ya estaban ...
      { name: 'DocActividad', schema: DocActividadSchema },
      { name: 'DocEliminado', schema: DocEliminadoSchema },
    ]),
    // ... resto de imports de módulos ...
  ],
  // ... controllers, providers, exports sin cambio ...
})
export class ActividadesModule {}
```

- [ ] **Step 4: Actualizar actividades.service.ts — reemplazar métodos inline**

Agregar imports al inicio:
```ts
import { DocumentosHelper, ArchivoInput } from '../common/helpers/documentos.helper';
```

Agregar `private readonly docsHelper: DocumentosHelper;` como propiedad de la clase.

En el constructor, agregar las dos inyecciones y la inicialización del helper:
```ts
@InjectModel('DocActividad') private docActividadModel: Model<any>,
@InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
```

Al final del constructor body:
```ts
this.docsHelper = new DocumentosHelper(
  actividadModel,
  docActividadModel,
  'actividad_id',
  docEliminadoModel,
  'actividad',
  'Actividad',
);
```

Eliminar todos los `.select('-documentos.contenido')` de los queries de actividades.

Reemplazar los tres métodos inline con:
```ts
listarDocumentos(actividadId: string) {
  return this.docsHelper.listar(actividadId);
}

subirDocumento(actividadId: string, archivo: ArchivoInput, nombreDisplay?: string) {
  return this.docsHelper.agregar(actividadId, archivo, nombreDisplay);
}

servirDocumento(actividadId: string, docId: string) {
  return this.docsHelper.servir(actividadId, docId);
}

eliminarDocumento(actividadId: string, docId: string) {
  return this.docsHelper.eliminar(actividadId, docId);
}
```

- [ ] **Step 5: Actualizar actividades.controller.ts — agregar GET lista y cambiar :nombre por :docId**

En `ActividadesController`, reemplazar los tres endpoints de documentos:

```ts
@Get(':actividadId/documentos')
listarDocumentos(@Param('actividadId') actividadId: string) {
  return this.service.listarDocumentos(actividadId);
}

@Post(':actividadId/documentos')
@Roles('super_admin', 'admin_smartclarity')
@UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
subirDocumento(
  @Param('actividadId') actividadId: string,
  @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  @Body('nombre_display') nombreDisplay?: string,
) {
  if (!archivo) throw new BadRequestException('No se proporcionó archivo');
  return this.service.subirDocumento(actividadId, archivo, nombreDisplay);
}

@Delete(':actividadId/documentos/:docId')
@Roles('super_admin', 'admin_smartclarity')
eliminarDocumento(
  @Param('actividadId') actividadId: string,
  @Param('docId') docId: string,
) {
  return this.service.eliminarDocumento(actividadId, docId);
}

@Get(':actividadId/documentos/:docId')
async descargarDocumento(
  @Param('actividadId') actividadId: string,
  @Param('docId') docId: string,
  @Res() res: Response,
) {
  const { buffer, tipo_mime, nombre_display } = await this.service.servirDocumento(actividadId, docId);
  sendFile(res, buffer, tipo_mime, nombre_display);
}
```

- [ ] **Step 6: Verificar compilación y probar**

```bash
cd back4 && npx tsc --noEmit 2>&1 | head -20
npm run start:dev
```

```bash
# Subir doc a una actividad
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "archivo=@/tmp/test.pdf" \
  http://localhost:3000/api/v1/empresas/EMPRESA_ID/centros/CENTRO_ID/actividades/ACTIVIDAD_ID/documentos

# Listar
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/empresas/EMPRESA_ID/centros/CENTRO_ID/actividades/ACTIVIDAD_ID/documentos
```

Expected: lista devuelve array con el doc subido, sin campo `contenido`

- [ ] **Step 7: Commit**

```bash
git add back4/src/actividades/
git commit -m "feat: migrar documentos de actividades a colección separada doc_actividad"
```

---

## Task 5: Frontend — Activos y Actividades

**Files:**
- Modificar: `front4/src/app/shared/models/activo.model.ts`
- Modificar: `front4/src/app/features/activos/activos.service.ts`
- Modificar: `front4/src/app/features/activos/pages/activos-page.component.ts`
- Modificar: `front4/src/app/features/actividades/actividades.service.ts`
- Modificar: `front4/src/app/features/actividades/pages/actividades-page.component.ts`

**Interfaces:**
- Consume: endpoints `GET /activos/:id/documentos`, `DELETE /activos/:id/documentos/:docId` de Task 3; equivalentes de actividades de Task 4
- Produce: `documentosActivo` y `documentosActividad` signals en cada service; `docsExistentes` en la page usa el signal

- [ ] **Step 1: Actualizar interfaces de modelos — agregar \_id**

En `front4/src/app/shared/models/activo.model.ts`, actualizar `DocActivo` y `DocActividad`:

```ts
export interface DocActivo {
  _id: string;           // NUEVO
  nombre: string;
  nombre_display: string;
  tamano_bytes: number;
  tipo_mime: string;
}

// También en la misma interfaz DocActividad:
export interface DocActividad {
  _id: string;           // NUEVO
  nombre: string;
  nombre_display: string;
  tamano_bytes: number;
  tipo_mime: string;
}
```

Eliminar `documentos?: DocActivo[]` de `Activo` y `documentos?: DocActividad[]` de `ActividadHistorialItem`.

- [ ] **Step 2: Actualizar activos.service.ts**

Agregar signal y método `listarDocumentos`:

```ts
readonly documentosActivo = signal<DocActivo[]>([]);
```

Agregar método después de `eliminarDocumento`:

```ts
listarDocumentos(activoId: string, centroId: string): void {
  const { empresaId } = this.resolverIds(centroId);
  if (!empresaId) return;
  this.http.get<DocActivo[]>(
    this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos`)
  ).subscribe({
    next: (docs) => this.documentosActivo.set(docs),
    error: () => this.documentosActivo.set([]),
  });
}
```

Actualizar `subirDocumento` — ya no actualiza el activo en la lista (backend no devuelve entidad completa), en su lugar llama `listarDocumentos`:

```ts
subirDocumento(
  activoId: string,
  centroId: string,
  archivo: File,
  nombreDisplay?: string,
  onSuccess?: () => void,
  onError?: () => void,
): void {
  const { empresaId } = this.resolverIds(centroId);
  if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
  const form = new FormData();
  form.append('archivo', archivo);
  if (nombreDisplay) form.append('nombre_display', nombreDisplay);
  this.http.post(
    this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos`),
    form
  ).subscribe({
    next: () => {
      this.status.set({ type: 'ok', text: 'Documento adjuntado correctamente' });
      this.listarDocumentos(activoId, centroId);
      onSuccess?.();
    },
    error: (err) => { this.setError(err); onError?.(); },
  });
}
```

Actualizar `eliminarDocumento` — parámetro `nombre` → `docId`:

```ts
eliminarDocumento(activoId: string, centroId: string, docId: string): void {
  const { empresaId } = this.resolverIds(centroId);
  if (!empresaId) { this.setError({ error: { message: 'Centro no encontrado' } }); return; }
  this.http.delete(
    this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${docId}`)
  ).subscribe({
    next: () => {
      this.status.set({ type: 'ok', text: 'Documento eliminado' });
      this.listarDocumentos(activoId, centroId);
    },
    error: (err) => this.setError(err),
  });
}
```

Actualizar `descargarDocumento` — parámetro `nombre` → `docId`:

```ts
descargarDocumento(activoId: string, centroId: string, docId: string, nombreDisplay?: string): void {
  const { empresaId } = this.resolverIds(centroId);
  if (!empresaId) { this.status.set({ type: 'error', text: 'Centro no encontrado' }); return; }
  const url = this.api.url(
    `/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${docId}`
  );
  this.triggerDownload(url, nombreDisplay || docId);
}
```

- [ ] **Step 3: Actualizar activos-page.component.ts**

Cambiar `docsExistentes` getter para usar el signal del service:

```ts
protected get docsExistentes(): DocActivo[] {
  return this.service.documentosActivo();
}
```

En `abrirEditar`, agregar llamada a `listarDocumentos` después de `seleccionar`:

```ts
protected abrirEditar(activo: Activo): void {
  this.editingId.set(activo._id);
  this.service.seleccionar(activo);
  this.service.listarDocumentos(activo._id, activo.centro_costo_id);
  this.modal.set('editar');
}
```

Actualizar `onDocEliminado` — recibe `docId` en lugar de `nombre`:

```ts
protected onDocEliminado(docId: string): void {
  const activo = this.activoEditando;
  if (!activo) return;
  this.service.eliminarDocumento(activo._id, activo.centro_costo_id, docId);
}
```

Actualizar `onDocDescargado` — recibe `docId` en lugar de `nombre`:

```ts
protected onDocDescargado(ev: { docId: string; nombreDisplay?: string }): void {
  const activo = this.activoEditando;
  if (!activo) return;
  this.service.descargarDocumento(activo._id, activo.centro_costo_id, ev.docId, ev.nombreDisplay);
}
```

Buscar en el template HTML (activos-page.component.html) las referencias a `doc.nombre` usadas en eventos de eliminar y descargar, y cambiarlas a `doc._id`. Ejemplo de lo que buscar en el template:

```html
<!-- Antes: -->
(eliminated)="onDocEliminado(doc.nombre)"
(downloaded)="onDocDescargado({nombre: doc.nombre, nombreDisplay: doc.nombre_display})"

<!-- Después: -->
(eliminated)="onDocEliminado(doc._id)"
(downloaded)="onDocDescargado({docId: doc._id, nombreDisplay: doc.nombre_display})"
```

- [ ] **Step 4: Actualizar actividades.service.ts**

Agregar signal `documentosActividad`:

```ts
readonly documentosActividad = signal<DocActividad[]>([]);
```

Agregar método `listarDocumentos`:

```ts
listarDocumentos(actividadId: string): void {
  const id = this.editingActividadId ?? actividadId;
  // Necesitamos empresaId y centroId — obtenerlos del contexto
  // Usar el centro de la actividad actual del service
  const actividad = this.actividades().find(a => a._id === actividadId);
  if (!actividad) { this.documentosActividad.set([]); return; }
  const centroId = asId(actividad.centro_costo_id);
  const { empresaId } = this.resolverIds(centroId);
  if (!empresaId) { this.documentosActividad.set([]); return; }
  this.http.get<DocActividad[]>(
    this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos`)
  ).subscribe({
    next: (docs) => this.documentosActividad.set(docs),
    error: () => this.documentosActividad.set([]),
  });
}
```

Actualizar `subirDocumento` — después de subir, llamar `listarDocumentos`:

```ts
subirDocumento(id: string, archivo: File, nombreDisplay?: string, onSuccess?: () => void, onError?: () => void): void {
  // ... misma lógica de URL y FormData que antes ...
  this.http.post(url, form).subscribe({
    next: () => {
      this.status.set({ type: 'ok', text: 'Documento adjuntado' });
      this.listarDocumentos(id);
      onSuccess?.();
    },
    error: (err) => { this.setError(err); onError?.(); },
  });
}
```

Actualizar `eliminarDocumento` — parámetro `nombreArchivo` → `docId`, URL cambia:

```ts
eliminarDocumento(actividadId: string, docId: string): void {
  const actividad = this.actividades().find(a => a._id === actividadId);
  if (!actividad) return;
  const centroId = asId(actividad.centro_costo_id);
  const { empresaId } = this.resolverIds(centroId);
  if (!empresaId) return;
  this.http.delete(
    this.api.url(`/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${docId}`)
  ).subscribe({
    next: () => {
      this.status.set({ type: 'ok', text: 'Documento eliminado' });
      this.listarDocumentos(actividadId);
    },
    error: (err) => this.setError(err),
  });
}
```

Actualizar `descargarDocumento` — parámetro `nombreArchivo` → `docId`:

```ts
descargarDocumento(actividadId: string, docId: string, nombreDisplay?: string): void {
  const actividad = this.actividades().find(a => a._id === actividadId);
  if (!actividad) return;
  const centroId = asId(actividad.centro_costo_id);
  const { empresaId } = this.resolverIds(centroId);
  if (!empresaId) return;
  const url = this.api.url(
    `/empresas/${empresaId}/centros/${centroId}/actividades/${actividadId}/documentos/${docId}`
  );
  this.triggerDownload(url, nombreDisplay || docId);
}
```

- [ ] **Step 5: Actualizar actividades-page.component.ts**

La línea 188 que lee `actividadEditando?.documentos`:

```ts
// Antes:
const docs = this.actividadEditando?.documentos ?? [];
return docs.length > 0 ? `${docs.length} archivo${docs.length > 1 ? 's' : ''}` : 'Sin documentos';

// Después:
const docs = this.service.documentosActividad();
return docs.length > 0 ? `${docs.length} archivo${docs.length > 1 ? 's' : ''}` : 'Sin documentos';
```

En `abrirEditar`, agregar llamada a `listarDocumentos`:

```ts
abrirEditar(a: Actividad): void {
  this.editingId.set(a._id);
  // ... resto sin cambio ...
  this.service.listarDocumentos(a._id);   // AGREGAR esta línea
}
```

En `eliminarDocActividad`, cambiar para pasar `docId`:

```ts
eliminarDocActividad(docId: string): void {
  const id = this.editingId();
  if (!id) return;
  this.service.eliminarDocumento(id, docId);
}
```

En `descargarDocActividad`, cambiar para pasar `docId`:

```ts
descargarDocActividad(docId: string, nombreDisplay?: string): void {
  const id = this.editingId();
  if (!id) return;
  this.service.descargarDocumento(id, docId, nombreDisplay);
}
```

En el template HTML (actividades-page.component.html), buscar las referencias a `doc.nombre` en eventos de eliminar y descargar y cambiarlas a `doc._id`. También cambiar la fuente de la lista de docs: donde se itere `actividadEditando?.documentos` cambiar a `service.documentosActividad()`.

- [ ] **Step 6: Verificar compilación TypeScript del frontend**

```bash
cd front4 && npx tsc --noEmit 2>&1 | head -30
```

Expected: cero errores

- [ ] **Step 7: Probar en el navegador**

```bash
cd front4 && npm start
```

1. Ir a `/` → modo admin → Activos
2. Seleccionar un activo para editar → verificar que la pestaña de documentos carga (lista vacía si no tiene docs)
3. Subir un documento → verificar que aparece en la lista
4. Descargar → verificar que el archivo se descarga correctamente
5. Eliminar → verificar que desaparece de la lista
6. Repetir pasos 2-5 con Actividades

- [ ] **Step 8: Commit**

```bash
cd front4 && git add src/app/shared/models/activo.model.ts \
  src/app/features/activos/ \
  src/app/features/actividades/
git commit -m "feat: actualizar frontend activos y actividades para cargar docs de colecciones separadas"
```
