# Documentos en MongoDB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover todo el almacenamiento de archivos del filesystem (`uploads/`) a MongoDB usando `Buffer` embebido, eliminar el módulo `documentos`, y agregar endpoints de descarga en cada módulo afectado.

**Architecture:** Se sigue el patrón ya existente en `mantenciones` (contenido como `Buffer` en subdocumento, endpoint `GET` para servir el archivo sin `.lean()`). Cada módulo gestiona sus propios archivos. El módulo `documentos` se elimina completamente. Sin migración de datos (los existentes son de prueba).

**Tech Stack:** NestJS 10, Mongoose, multer (memoryStorage), TypeScript. Sin tests configurados — verificación con `tsc --noEmit` después de cada task.

---

## Mapa de archivos

| Archivo | Acción |
|---------|--------|
| `back4/src/main.ts` | Modificar — eliminar `useStaticAssets` y el import de `path` |
| `back4/src/app.module.ts` | Modificar — eliminar `DocumentosModule` |
| `back4/src/documentos/` | Eliminar carpeta completa |
| `back4/src/clientes/clientes.schema.ts` | Modificar — `logo_url` → `logo: { contenido, tipo_mime, nombre }` |
| `back4/src/clientes/clientes.service.ts` | Modificar — `subirLogo` guarda en DB, nuevo `servirLogo`, eliminar `fs` |
| `back4/src/clientes/clientes.controller.ts` | Modificar — actualizar `POST /:id/logo`, agregar `GET /:id/logo` |
| `back4/src/centros-costos/centros-costos.schema.ts` | Modificar — `documentos[].url` → `documentos[].contenido: Buffer` |
| `back4/src/centros-costos/centros-costos.dto.ts` | Modificar — eliminar `AgregarDocumentoDto` |
| `back4/src/centros-costos/centros-costos.service.ts` | Modificar — `agregarDocumento` acepta archivo, nuevos `listarDocumentos` y `servirDocumento` |
| `back4/src/centros-costos/centros-costos.controller.ts` | Modificar — reemplazar endpoints de documentos con multipart + descarga |
| `back4/src/proyectos/proyectos.schema.ts` | Modificar — mismo patrón que centros |
| `back4/src/proyectos/proyectos.dto.ts` | Modificar — eliminar `AgregarDocumentoProyectoDto` |
| `back4/src/proyectos/proyectos.service.ts` | Modificar — mismo patrón que centros |
| `back4/src/proyectos/proyectos.controller.ts` | Modificar — mismo patrón que centros |
| `back4/src/solicitudes/solicitudes.schema.ts` | Modificar — `archivo_url/nombre` → `adjunto: { contenido, tipo_mime, nombre }` |
| `back4/src/solicitudes/solicitudes.service.ts` | Modificar — `adjuntarArchivo` guarda en DB, nuevo `servirAdjunto`, eliminar `fs` |
| `back4/src/solicitudes/solicitudes.controller.ts` | Modificar — agregar `GET /:solicitudId/adjunto` |

---

## Task 1: Eliminar módulo documentos y limpiar main.ts

**Files:**
- Delete: `back4/src/documentos/` (carpeta completa)
- Modify: `back4/src/app.module.ts`
- Modify: `back4/src/main.ts`

- [ ] **Step 1: Eliminar la carpeta documentos**

```bash
rm -rf /home/biw/Documentos/ECLARITI/PORTAL4/back4/src/documentos
```

- [ ] **Step 2: Actualizar `app.module.ts` — eliminar DocumentosModule**

Contenido completo nuevo de `back4/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { JwtAuthGuard, RolesGuard, PermisosGuard } from './common/guards/guards';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { CentrosCostosModule } from './centros-costos/centros-costos.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { PermisosModule } from './permisos/permisos.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { TiposMantencionModule } from './tipos-mantencion/tipos-mantencion.module';
import { MantencionesModule } from './mantenciones/mantenciones.module';
import { ActivosModule } from './activos/activos.module';
import { NoticiasModule } from './noticias/noticias.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes'),
    AuthModule,
    ClientesModule,
    UsuariosModule,
    CentrosCostosModule,
    ProyectosModule,
    PermisosModule,
    SolicitudesModule,
    TiposMantencionModule,
    MantencionesModule,
    ActivosModule,
    NoticiasModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermisosGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Actualizar `main.ts` — eliminar useStaticAssets**

Contenido completo nuevo de `back4/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  const origin = corsOrigin === '*'
    ? '*'
    : corsOrigin.split(',').map((item) => item.trim()).filter(Boolean);

  app.enableCors({
    origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Portal API corriendo en http://localhost:${port}/api/v1`);
}

bootstrap();
```

- [ ] **Step 4: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && git add -A && git commit -m "feat: remove documentos filesystem module and static assets"
```

---

## Task 2: Empresas — logo en MongoDB

**Files:**
- Modify: `back4/src/clientes/clientes.schema.ts`
- Modify: `back4/src/clientes/clientes.service.ts`
- Modify: `back4/src/clientes/clientes.controller.ts`

- [ ] **Step 1: Actualizar `clientes.schema.ts`**

Contenido completo:

```typescript
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
}

export const ClienteSchema = SchemaFactory.createForClass(Cliente);
ClienteSchema.index({ activo: 1 });
```

- [ ] **Step 2: Actualizar `clientes.service.ts`**

Contenido completo:

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cliente, ClienteDocument } from './clientes.schema';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';

@Injectable()
export class ClientesService {
  constructor(@InjectModel('Cliente') private clienteModel: Model<ClienteDocument>) {}

  async create(dto: CreateClienteDto) {
    const existe = await this.clienteModel.findOne({ rut: dto.rut });
    if (existe) throw new ConflictException(`Ya existe un cliente con RUT ${dto.rut}`);
    const cliente = new this.clienteModel(dto);
    return cliente.save();
  }

  async findAll(page = 1, limit = 20, soloActivos = true) {
    const filter = soloActivos ? { activo: true } : {};
    const [data, total] = await Promise.all([
      this.clienteModel.find(filter).select('-logo.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.clienteModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const cliente = await this.clienteModel.findById(id).select('-logo.contenido').lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async update(id: string, dto: UpdateClienteDto) {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .select('-logo.contenido')
      .lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return cliente;
  }

  async remove(id: string) {
    const cliente = await this.clienteModel
      .findByIdAndUpdate(id, { activo: false }, { new: true })
      .lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return { message: 'Cliente desactivado correctamente', id };
  }

  async subirLogo(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const cliente = await this.clienteModel.findById(id).lean();
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return this.clienteModel
      .findByIdAndUpdate(
        id,
        { logo: { contenido: archivo.buffer, tipo_mime: archivo.mimetype, nombre: archivo.originalname } },
        { new: true, runValidators: false },
      )
      .select('-logo.contenido')
      .lean();
  }

  async servirLogo(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
    const cliente = await this.clienteModel.findById(id);
    if (!cliente) throw new NotFoundException(`Cliente ${id} no encontrado`);
    if (!cliente.logo?.contenido) throw new NotFoundException('Este cliente no tiene logo');
    const raw = cliente.logo.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: cliente.logo.tipo_mime, nombre: cliente.logo.nombre };
  }
}
```

- [ ] **Step 3: Actualizar `clientes.controller.ts`**

Contenido completo:

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query,
  UseInterceptors, UploadedFile, BadRequestException, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ClientesService } from './clientes.service';
import { CreateClienteDto, UpdateClienteDto } from './clientes.dto';
import { Roles } from '../common/guards/guards';

@Controller('empresas')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateClienteDto) {
    return this.clientesService.create(dto);
  }

  @Get()
  findAll(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.clientesService.findAll(+page, +limit);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientesService.findOne(id);
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.clientesService.remove(id);
  }

  @Post(':id/logo')
  @Roles('super_admin')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirLogo(
    @Param('id') id: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.clientesService.subirLogo(id, archivo);
  }

  @Get(':id/logo')
  async servirLogo(@Param('id') id: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre } = await this.clientesService.servirLogo(id);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`);
    res.send(buffer);
  }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add back4/src/clientes/ && git commit -m "feat: store empresa logo as Buffer in MongoDB"
```

---

## Task 3: Centros de costos — documentos en MongoDB

**Files:**
- Modify: `back4/src/centros-costos/centros-costos.schema.ts`
- Modify: `back4/src/centros-costos/centros-costos.dto.ts`
- Modify: `back4/src/centros-costos/centros-costos.service.ts`
- Modify: `back4/src/centros-costos/centros-costos.controller.ts`

- [ ] **Step 1: Actualizar `centros-costos.schema.ts`**

Contenido completo:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CentroCostoDocument = CentroCosto & Document;

class Documento {
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) subido_por?: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}

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
  @Prop({ default: true }) activo: boolean;
  @Prop({ type: [Documento], default: [] }) documentos: Documento[];
}

export const CentroCostoSchema = SchemaFactory.createForClass(CentroCosto);
CentroCostoSchema.index({ cliente_id: 1, activo: 1 });
CentroCostoSchema.index({ cliente_id: 1, codigo: 1 }, { unique: true });
```

- [ ] **Step 2: Actualizar `centros-costos.dto.ts` — eliminar AgregarDocumentoDto**

Contenido completo:

```typescript
import {
  IsString, IsOptional, IsBoolean,
  IsMongoId, MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateCentroCostoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;
  @IsString() @MinLength(2) codigo: string;
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsString() @IsOptional() ubicacion_direccion?: string;
  @IsString() @IsOptional() ubicacion_ciudad?: string;
  @IsString() @IsOptional() ubicacion_region?: string;
  @IsString() @IsOptional() ubicacion_pais?: string;
}

export class UpdateCentroCostoDto extends PartialType(CreateCentroCostoDto) {
  @IsBoolean() @IsOptional() activo?: boolean;
}
```

- [ ] **Step 3: Actualizar `centros-costos.service.ts`**

Contenido completo:

```typescript
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CentroCostoDocument } from './centros-costos.schema';
import { CreateCentroCostoDto, UpdateCentroCostoDto } from './centros-costos.dto';

@Injectable()
export class CentrosCostosService {
  constructor(
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
  ) {}

  private toObjectId(value: string) {
    return new Types.ObjectId(value);
  }

  async create(dto: CreateCentroCostoDto) {
    const existe = await this.centroCostoModel.findOne({
      cliente_id: dto.cliente_id,
      codigo: dto.codigo,
    });
    if (existe) throw new ConflictException(`Ya existe el código ${dto.codigo} en este cliente`);
    return new this.centroCostoModel({
      ...dto,
      cliente_id: this.toObjectId(dto.cliente_id!),
    }).save();
  }

  async findAll(page = 1, limit = 20) {
    const filter = { activo: true };
    const [data, total] = await Promise.all([
      this.centroCostoModel.find(filter).select('-documentos.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCliente(cliente_id: string, page = 1, limit = 20) {
    const filter = { cliente_id: new Types.ObjectId(cliente_id), activo: true };
    const [data, total] = await Promise.all([
      this.centroCostoModel.find(filter).select('-documentos.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.centroCostoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findByIds(ids: string[]) {
    return this.centroCostoModel
      .find({ _id: { $in: ids.map(id => new Types.ObjectId(id)) }, activo: true })
      .select('-documentos.contenido')
      .lean();
  }

  async findOne(id: string) {
    const centro = await this.centroCostoModel.findById(id).select('-documentos.contenido').lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro;
  }

  async update(id: string, dto: UpdateCentroCostoDto) {
    const payload: Record<string, unknown> = { ...dto };
    if (dto.cliente_id) payload['cliente_id'] = this.toObjectId(dto.cliente_id);
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, payload, { new: true })
      .select('-documentos.contenido')
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

  async agregarDocumento(
    id: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    nombreDisplay?: string,
    usuarioId?: string,
  ) {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;

    const nuevoDoc: Record<string, unknown> = {
      nombre,
      nombre_display: nombreDisplay?.trim() || archivo.originalname,
      tipo_mime: archivo.mimetype,
      tamano_bytes: archivo.size,
      contenido: archivo.buffer,
      subido_en: new Date(),
    };
    if (usuarioId) nuevoDoc['subido_por'] = new Types.ObjectId(usuarioId);

    const centro = await this.centroCostoModel
      .findByIdAndUpdate(id, { $push: { documentos: nuevoDoc } }, { new: true })
      .select('-documentos.contenido')
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro.documentos[centro.documentos.length - 1];
  }

  async listarDocumentos(id: string) {
    const centro = await this.centroCostoModel.findById(id).select('-documentos.contenido').lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${id} no encontrado`);
    return centro.documentos;
  }

  async servirDocumento(centroId: string, docId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const centro = await this.centroCostoModel.findById(centroId);
    if (!centro) throw new NotFoundException(`Centro de costos ${centroId} no encontrado`);
    const doc = centro.documentos.find(d => String((d as any)._id) === docId);
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);
    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }

  async eliminarDocumento(centroId: string, docId: string) {
    const centro = await this.centroCostoModel
      .findByIdAndUpdate(
        centroId,
        { $pull: { documentos: { _id: new Types.ObjectId(docId) } } },
        { new: true },
      )
      .lean();
    if (!centro) throw new NotFoundException(`Centro de costos ${centroId} no encontrado`);
    return { message: 'Documento eliminado', docId };
  }
}
```

- [ ] **Step 4: Actualizar `centros-costos.controller.ts`**

Contenido completo:

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Res,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CentrosCostosService } from './centros-costos.service';
import { CreateCentroCostoDto, UpdateCentroCostoDto } from './centros-costos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros')
@UseGuards(EmpresaAccessGuard)
export class CentrosCostosController {
  constructor(private readonly centrosCostosService: CentrosCostosService) {}

  @Post()
  @Roles('super_admin')
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateCentroCostoDto) {
    return this.centrosCostosService.create({ ...dto, cliente_id: empresaId });
  }

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.centrosCostosService.findAllByCliente(empresaId, +page, +limit);
  }

  @Get(':centroId')
  findOne(@Param('centroId') centroId: string) {
    return this.centrosCostosService.findOne(centroId);
  }

  @Put(':centroId')
  @Roles('super_admin')
  update(@Param('centroId') centroId: string, @Body() dto: UpdateCentroCostoDto) {
    return this.centrosCostosService.update(centroId, dto);
  }

  @Delete(':centroId')
  @Roles('super_admin')
  remove(@Param('centroId') centroId: string) {
    return this.centrosCostosService.remove(centroId);
  }

  @Post(':centroId/documentos')
  @Roles('super_admin')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @Param('centroId') centroId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.centrosCostosService.agregarDocumento(centroId, archivo, nombreDisplay);
  }

  @Get(':centroId/documentos')
  listarDocumentos(@Param('centroId') centroId: string) {
    return this.centrosCostosService.listarDocumentos(centroId);
  }

  @Get(':centroId/documentos/:docId')
  async descargarDocumento(
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.centrosCostosService.servirDocumento(centroId, docId);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre_display)}"`);
    res.send(buffer);
  }

  @Delete(':centroId/documentos/:docId')
  @Roles('super_admin')
  eliminarDocumento(
    @Param('centroId') centroId: string,
    @Param('docId') docId: string,
  ) {
    return this.centrosCostosService.eliminarDocumento(centroId, docId);
  }
}
```

- [ ] **Step 5: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add back4/src/centros-costos/ && git commit -m "feat: store centros-costos documentos as Buffer in MongoDB"
```

---

## Task 4: Proyectos — documentos en MongoDB

**Files:**
- Modify: `back4/src/proyectos/proyectos.schema.ts`
- Modify: `back4/src/proyectos/proyectos.dto.ts`
- Modify: `back4/src/proyectos/proyectos.service.ts`
- Modify: `back4/src/proyectos/proyectos.controller.ts`

- [ ] **Step 1: Actualizar `proyectos.schema.ts`**

Contenido completo:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProyectoDocument = Proyecto & Document;

class Documento {
  @Prop({ required: true }) nombre: string;
  @Prop({ required: true }) nombre_display: string;
  @Prop({ required: true }) tipo_mime: string;
  @Prop() tamano_bytes?: number;
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) subido_por?: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}

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
  @Prop({ type: [Documento], default: [] }) documentos: Documento[];
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) creado_por?: Types.ObjectId;
}

export const ProyectoSchema = SchemaFactory.createForClass(Proyecto);
ProyectoSchema.index({ centro_costo_id: 1, estado: 1 });
ProyectoSchema.index({ cliente_id: 1, estado: 1 });
ProyectoSchema.index({ centro_costo_id: 1, codigo: 1 }, { unique: true });
```

- [ ] **Step 2: Actualizar `proyectos.dto.ts` — eliminar AgregarDocumentoProyectoDto**

Contenido completo:

```typescript
import {
  IsString, IsOptional,
  IsMongoId, IsEnum, IsDateString, MinLength,
} from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateProyectoDto {
  @IsMongoId() @IsOptional() cliente_id?: string;
  @IsMongoId() @IsOptional() centro_costo_id?: string;
  @IsString() @MinLength(2) codigo: string;
  @IsString() @MinLength(3) nombre: string;
  @IsString() @IsOptional() descripcion?: string;
  @IsEnum(['borrador', 'activo', 'cerrado']) @IsOptional() estado?: 'borrador' | 'activo' | 'cerrado';
  @IsDateString() @IsOptional() fecha_inicio?: string;
  @IsDateString() @IsOptional() fecha_fin?: string;
}

export class UpdateProyectoDto extends PartialType(CreateProyectoDto) {}
```

- [ ] **Step 3: Actualizar `proyectos.service.ts`**

Contenido completo:

```typescript
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProyectoDocument } from './proyectos.schema';
import { CreateProyectoDto, UpdateProyectoDto } from './proyectos.dto';

@Injectable()
export class ProyectosService {
  constructor(
    @InjectModel('Proyecto') private proyectoModel: Model<ProyectoDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<any>,
  ) {}

  private toObjectId(value: string) {
    return new Types.ObjectId(value);
  }

  private async validarCentroEnCliente(cliente_id: string, centro_costo_id: string) {
    const centro = await this.centroCostoModel.findOne({
      _id: this.toObjectId(centro_costo_id),
      cliente_id: this.toObjectId(cliente_id),
      activo: true,
    }).lean();
    if (!centro) throw new BadRequestException('El centro seleccionado no pertenece a la empresa indicada');
  }

  async create(dto: CreateProyectoDto, creadoPor?: string) {
    const existe = await this.proyectoModel.findOne({
      centro_costo_id: this.toObjectId(dto.centro_costo_id!),
      codigo: dto.codigo,
    });
    if (existe) throw new ConflictException(`Ya existe el código ${dto.codigo} en este centro de costos`);
    await this.validarCentroEnCliente(dto.cliente_id!, dto.centro_costo_id!);
    const doc: Record<string, unknown> = {
      ...dto,
      cliente_id: this.toObjectId(dto.cliente_id!),
      centro_costo_id: this.toObjectId(dto.centro_costo_id!),
      fecha_inicio: dto.fecha_inicio ? new Date(dto.fecha_inicio) : undefined,
      fecha_fin: dto.fecha_fin ? new Date(dto.fecha_fin) : undefined,
    };
    if (creadoPor) doc['creado_por'] = new Types.ObjectId(creadoPor);
    return new this.proyectoModel(doc).save();
  }

  async findAll(page = 1, limit = 20) {
    const filter = { estado: { $ne: 'cerrado' } };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).select('-documentos.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findAllByCentro(centro_costo_id: string, page = 1, limit = 20) {
    const filter = {
      centro_costo_id: new Types.ObjectId(centro_costo_id),
      estado: { $ne: 'cerrado' },
    };
    const [data, total] = await Promise.all([
      this.proyectoModel.find(filter).select('-documentos.contenido').skip((page - 1) * limit).limit(limit).lean(),
      this.proyectoModel.countDocuments(filter),
    ]);
    return { data, total, page, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const proyecto = await this.proyectoModel.findById(id).select('-documentos.contenido').lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto;
  }

  async update(id: string, dto: UpdateProyectoDto) {
    const proyectoActual = await this.proyectoModel.findById(id).lean();
    if (!proyectoActual) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    const clienteId = dto.cliente_id || proyectoActual.cliente_id.toString();
    const centroCostoId = dto.centro_costo_id || proyectoActual.centro_costo_id.toString();
    await this.validarCentroEnCliente(clienteId, centroCostoId);
    const payload: Record<string, unknown> = { ...dto };
    if (dto.cliente_id) payload['cliente_id'] = this.toObjectId(dto.cliente_id);
    if (dto.centro_costo_id) payload['centro_costo_id'] = this.toObjectId(dto.centro_costo_id);
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .select('-documentos.contenido')
      .lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto;
  }

  async remove(id: string) {
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, { estado: 'cerrado' }, { new: true })
      .lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return { message: 'Proyecto cerrado', id };
  }

  async agregarDocumento(
    id: string,
    archivo: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    nombreDisplay?: string,
    usuarioId?: string,
  ) {
    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const nombre = `${timestamp}_${rand}_${archivo.originalname}`;
    const nuevoDoc: Record<string, unknown> = {
      nombre,
      nombre_display: nombreDisplay?.trim() || archivo.originalname,
      tipo_mime: archivo.mimetype,
      tamano_bytes: archivo.size,
      contenido: archivo.buffer,
      subido_en: new Date(),
    };
    if (usuarioId) nuevoDoc['subido_por'] = new Types.ObjectId(usuarioId);
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(id, { $push: { documentos: nuevoDoc } }, { new: true })
      .select('-documentos.contenido')
      .lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto.documentos[proyecto.documentos.length - 1];
  }

  async listarDocumentos(id: string) {
    const proyecto = await this.proyectoModel.findById(id).select('-documentos.contenido').lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${id} no encontrado`);
    return proyecto.documentos;
  }

  async servirDocumento(proyectoId: string, docId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const proyecto = await this.proyectoModel.findById(proyectoId);
    if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    const doc = proyecto.documentos.find(d => String((d as any)._id) === docId);
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);
    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }

  async eliminarDocumento(proyectoId: string, docId: string) {
    const proyecto = await this.proyectoModel
      .findByIdAndUpdate(
        proyectoId,
        { $pull: { documentos: { _id: new Types.ObjectId(docId) } } },
        { new: true },
      )
      .lean();
    if (!proyecto) throw new NotFoundException(`Proyecto ${proyectoId} no encontrado`);
    return { message: 'Documento eliminado', docId };
  }
}
```

- [ ] **Step 4: Actualizar `proyectos.controller.ts`**

Contenido completo:

```typescript
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Res,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProyectosService } from './proyectos.service';
import { CreateProyectoDto, UpdateProyectoDto } from './proyectos.dto';
import { EmpresaAccessGuard, Roles } from '../common/guards/guards';

@Controller('empresas/:empresaId/centros/:centroId/proyectos')
@UseGuards(EmpresaAccessGuard)
export class ProyectosController {
  constructor(private readonly proyectosService: ProyectosService) {}

  @Post()
  @Roles('super_admin')
  create(
    @Param('empresaId') empresaId: string,
    @Param('centroId') centroId: string,
    @Body() dto: CreateProyectoDto,
  ) {
    return this.proyectosService.create({ ...dto, cliente_id: empresaId, centro_costo_id: centroId });
  }

  @Get()
  findAll(
    @Param('centroId') centroId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.proyectosService.findAllByCentro(centroId, +page, +limit);
  }

  @Get(':proyectoId')
  findOne(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.findOne(proyectoId);
  }

  @Put(':proyectoId')
  @Roles('super_admin')
  update(@Param('proyectoId') proyectoId: string, @Body() dto: UpdateProyectoDto) {
    return this.proyectosService.update(proyectoId, dto);
  }

  @Delete(':proyectoId')
  @Roles('super_admin')
  remove(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.remove(proyectoId);
  }

  @Post(':proyectoId/documentos')
  @Roles('super_admin')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  subirDocumento(
    @Param('proyectoId') proyectoId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
    @Body('nombre_display') nombreDisplay?: string,
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.proyectosService.agregarDocumento(proyectoId, archivo, nombreDisplay);
  }

  @Get(':proyectoId/documentos')
  listarDocumentos(@Param('proyectoId') proyectoId: string) {
    return this.proyectosService.listarDocumentos(proyectoId);
  }

  @Get(':proyectoId/documentos/:docId')
  async descargarDocumento(
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
    @Res() res: Response,
  ) {
    const { buffer, tipo_mime, nombre_display } = await this.proyectosService.servirDocumento(proyectoId, docId);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre_display)}"`);
    res.send(buffer);
  }

  @Delete(':proyectoId/documentos/:docId')
  @Roles('super_admin')
  eliminarDocumento(
    @Param('proyectoId') proyectoId: string,
    @Param('docId') docId: string,
  ) {
    return this.proyectosService.eliminarDocumento(proyectoId, docId);
  }
}
```

- [ ] **Step 5: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add back4/src/proyectos/ && git commit -m "feat: store proyectos documentos as Buffer in MongoDB"
```

---

## Task 5: Solicitudes — adjunto en MongoDB

**Files:**
- Modify: `back4/src/solicitudes/solicitudes.schema.ts`
- Modify: `back4/src/solicitudes/solicitudes.service.ts`
- Modify: `back4/src/solicitudes/solicitudes.controller.ts`

- [ ] **Step 1: Actualizar `solicitudes.schema.ts`**

Contenido completo:

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SolicitudDocument = Solicitud & Document;

@Schema({ collection: 'solicitudes', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Solicitud {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, trim: true }) tipo: string;
  @Prop({ trim: true }) descripcion?: string;
  @Prop({ type: Types.ObjectId, ref: 'Cliente', required: true }) empresa_id: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'CentroCosto' }) centro_costo_id?: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Proyecto' }) proyecto_id?: Types.ObjectId;
  @Prop({ enum: ['pendiente', 'revision', 'aprobado', 'rechazado', 'vencido'], default: 'pendiente' }) estado: string;
  @Prop({ trim: true }) motivo_rechazo?: string;
  @Prop({
    type: {
      contenido: Buffer,
      tipo_mime: String,
      nombre: String,
    },
  })
  adjunto?: { contenido: Buffer; tipo_mime: string; nombre: string };
}

export const SolicitudSchema = SchemaFactory.createForClass(Solicitud);
SolicitudSchema.index({ empresa_id: 1, estado: 1 });
SolicitudSchema.index({ empresa_id: 1, centro_costo_id: 1 });
```

- [ ] **Step 2: Actualizar `solicitudes.service.ts`**

Contenido completo:

```typescript
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SolicitudDocument } from './solicitudes.schema';
import { CentroCostoDocument } from '../centros-costos/centros-costos.schema';
import { CreateSolicitudDto, UpdateSolicitudDto, CambiarEstadoDto } from './solicitudes.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    @InjectModel('Solicitud') private solicitudModel: Model<SolicitudDocument>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('Usuario') private usuarioModel: Model<{ nombre: string; email: string; rol: string; cliente_id: Types.ObjectId; centros_asignados: Types.ObjectId[]; activo: boolean }>,
    private mailService: MailService,
  ) {}

  async create(dto: CreateSolicitudDto) {
    const doc: Record<string, unknown> = {
      ...dto,
      empresa_id: new Types.ObjectId(dto.empresa_id!),
    };
    if (dto.centro_costo_id) doc['centro_costo_id'] = new Types.ObjectId(dto.centro_costo_id);
    if (dto.proyecto_id)     doc['proyecto_id']     = new Types.ObjectId(dto.proyecto_id);
    const saved = await new this.solicitudModel(doc).save();
    if (dto.centro_costo_id) await this.notificarUsuariosCentro(dto.centro_costo_id, dto);
    return saved;
  }

  private async notificarUsuariosCentro(centroCostoId: string, dto: CreateSolicitudDto) {
    try {
      const centro = await this.centroCostoModel.findById(centroCostoId).lean();
      if (!centro) return;
      const centroObjId = new Types.ObjectId(centroCostoId);
      const usuariosCentro = await this.usuarioModel
        .find({
          cliente_id: new Types.ObjectId(String(centro.cliente_id)),
          activo: true,
          $or: [{ rol: 'admin_cliente' }, { centros_asignados: centroObjId }],
        })
        .select('nombre email').lean();
      const superAdmins = await this.usuarioModel
        .find({ rol: 'super_admin', activo: true }).select('nombre email').lean();
      const emailsVistos = new Set<string>();
      const destinatarios: { nombre: string; email: string }[] = [];
      for (const u of [...usuariosCentro, ...superAdmins]) {
        if (u.email && !emailsVistos.has(u.email)) {
          emailsVistos.add(u.email);
          destinatarios.push({ nombre: u.nombre, email: u.email });
        }
      }
      if (destinatarios.length === 0) return;
      this.logger.log(`Notificación solicitud: centro=${centroCostoId} destinatarios=${destinatarios.length}`);
      await this.mailService.notificarNuevaSolicitud({
        destinatarios,
        solicitud: { nombre: dto.nombre, tipo: dto.tipo, descripcion: dto.descripcion, centro: String(centro.nombre) },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar solicitud:', err);
    }
  }

  async findByContexto(empresaId: string, centroId?: string, proyectoId?: string, estado?: string) {
    const filter: Record<string, unknown> = { empresa_id: new Types.ObjectId(empresaId) };
    if (centroId)   filter['centro_costo_id'] = new Types.ObjectId(centroId);
    if (proyectoId) filter['proyecto_id']     = new Types.ObjectId(proyectoId);
    if (estado)     filter['estado']          = estado;
    return this.solicitudModel.find(filter).select('-adjunto.contenido').sort({ creado_en: -1 }).lean();
  }

  async update(id: string, dto: UpdateSolicitudDto) {
    const solicitud = await this.solicitudModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .select('-adjunto.contenido')
      .lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    return solicitud;
  }

  async remove(id: string) {
    const solicitud = await this.solicitudModel.findById(id).lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    await this.solicitudModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  async cambiarEstado(id: string, dto: CambiarEstadoDto) {
    const update: Record<string, unknown> = { estado: dto.estado };
    if (dto.estado === 'rechazado') {
      update['motivo_rechazo'] = dto.motivo_rechazo?.trim() ?? '';
    } else {
      update['motivo_rechazo'] = '';
    }
    const solicitud = await this.solicitudModel
      .findByIdAndUpdate(id, update, { new: true })
      .lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (dto.estado === 'rechazado' && solicitud.empresa_id) {
      await this.notificarRechazoSolicitud(solicitud);
    }
    return solicitud;
  }

  private async notificarRechazoSolicitud(solicitud: Record<string, unknown>) {
    try {
      const empresaId = String(solicitud['empresa_id']);
      const centro = solicitud['centro_costo_id']
        ? await this.centroCostoModel.findById(String(solicitud['centro_costo_id'])).lean()
        : null;
      const centroObjId = centro ? new Types.ObjectId(String(solicitud['centro_costo_id'])) : null;
      const usuariosEmpresa = await this.usuarioModel
        .find({
          cliente_id: new Types.ObjectId(empresaId),
          activo: true,
          $or: centroObjId
            ? [{ rol: 'admin_cliente' }, { centros_asignados: centroObjId }]
            : [{ rol: 'admin_cliente' }],
        })
        .select('nombre email').lean();
      if (usuariosEmpresa.length === 0) return;
      const emailsVistos = new Set<string>();
      const destinatarios: { nombre: string; email: string }[] = [];
      for (const u of usuariosEmpresa) {
        if (u.email && !emailsVistos.has(u.email)) {
          emailsVistos.add(u.email);
          destinatarios.push({ nombre: u.nombre, email: u.email });
        }
      }
      await this.mailService.notificarRechazoSolicitud({
        destinatarios,
        solicitud: {
          nombre: String(solicitud['nombre']),
          tipo: String(solicitud['tipo']),
          motivo_rechazo: String(solicitud['motivo_rechazo'] ?? ''),
          centro: centro ? String(centro.nombre) : 'Empresa',
        },
      });
    } catch (err: unknown) {
      this.logger.error('Error al notificar rechazo de solicitud:', err);
    }
  }

  async adjuntarArchivo(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const solicitud = await this.solicitudModel.findById(id).lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (!['pendiente', 'rechazado', 'vencido'].includes(solicitud.estado)) {
      throw new BadRequestException(`No se puede adjuntar un archivo a una solicitud en estado "${solicitud.estado}"`);
    }
    const TIPOS_PERMITIDOS = [
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!TIPOS_PERMITIDOS.includes(archivo.mimetype)) {
      throw new BadRequestException('Tipo de archivo no permitido. Se aceptan PDF, imágenes, Word y Excel.');
    }
    return this.solicitudModel
      .findByIdAndUpdate(
        id,
        {
          adjunto: { contenido: archivo.buffer, tipo_mime: archivo.mimetype, nombre: archivo.originalname },
          estado: 'revision',
        },
        { new: true },
      )
      .select('-adjunto.contenido')
      .lean();
  }

  async servirAdjunto(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
    const solicitud = await this.solicitudModel.findById(id);
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (!solicitud.adjunto?.contenido) throw new NotFoundException('Esta solicitud no tiene adjunto');
    const raw = solicitud.adjunto.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: solicitud.adjunto.tipo_mime, nombre: solicitud.adjunto.nombre };
  }
}
```

- [ ] **Step 3: Actualizar `solicitudes.controller.ts`**

Contenido completo:

```typescript
import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, Res,
  UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto, UpdateSolicitudDto, CambiarEstadoDto } from './solicitudes.dto';
import { EmpresaAccessGuard } from '../common/guards/guards';

@Controller('empresas/:empresaId/solicitudes')
@UseGuards(EmpresaAccessGuard)
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  create(@Param('empresaId') empresaId: string, @Body() dto: CreateSolicitudDto) {
    return this.solicitudesService.create({ ...dto, empresa_id: empresaId });
  }

  @Get()
  findAll(
    @Param('empresaId') empresaId: string,
    @Query('centroId') centroId?: string,
    @Query('proyectoId') proyectoId?: string,
    @Query('estado') estado?: string,
  ) {
    return this.solicitudesService.findByContexto(empresaId, centroId, proyectoId, estado);
  }

  @Patch(':solicitudId')
  update(@Param('solicitudId') solicitudId: string, @Body() dto: UpdateSolicitudDto) {
    return this.solicitudesService.update(solicitudId, dto);
  }

  @Delete(':solicitudId')
  remove(@Param('solicitudId') solicitudId: string) {
    return this.solicitudesService.remove(solicitudId);
  }

  @Put(':solicitudId/estado')
  cambiarEstado(@Param('solicitudId') solicitudId: string, @Body() dto: CambiarEstadoDto) {
    return this.solicitudesService.cambiarEstado(solicitudId, dto);
  }

  @Post(':solicitudId/adjuntar')
  @UseInterceptors(FileInterceptor('archivo', { storage: memoryStorage() }))
  adjuntar(
    @Param('solicitudId') solicitudId: string,
    @UploadedFile() archivo: Express.Multer.File & { buffer: Buffer },
  ) {
    if (!archivo) throw new BadRequestException('No se proporcionó archivo');
    return this.solicitudesService.adjuntarArchivo(solicitudId, archivo);
  }

  @Get(':solicitudId/adjunto')
  async servirAdjunto(@Param('solicitudId') solicitudId: string, @Res() res: Response) {
    const { buffer, tipo_mime, nombre } = await this.solicitudesService.servirAdjunto(solicitudId);
    res.setHeader('Content-Type', tipo_mime);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre)}"`);
    res.send(buffer);
  }
}
```

- [ ] **Step 4: Verificar compilación**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add back4/src/solicitudes/ && git commit -m "feat: store solicitudes adjunto as Buffer in MongoDB"
```

---

## Task 6: Build final y verificación

- [ ] **Step 1: Build completo**

```bash
cd /home/biw/Documentos/ECLARITI/PORTAL4/back4 && npm run build 2>&1 | tail -20
```

Esperado: `Successfully compiled` sin errores.

- [ ] **Step 2: Confirmar que uploads/ ya no se referencia en código fuente**

```bash
grep -r "uploads" /home/biw/Documentos/ECLARITI/PORTAL4/back4/src/ --include="*.ts"
```

Esperado: sin resultados.

- [ ] **Step 3: Confirmar que fs ya no se usa en código de producción**

```bash
grep -r "require('fs')\|from 'fs'" /home/biw/Documentos/ECLARITI/PORTAL4/back4/src/ --include="*.ts"
```

Esperado: sin resultados.

- [ ] **Step 4: Commit final si hubo ajustes**

```bash
git add -p && git commit -m "fix: post-migration build fixes"
```
