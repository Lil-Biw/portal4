# Almacenamiento de documentos en S3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mover el almacenamiento de archivos de documentos (activos, centros de costo,
proyectos, clientes, actividades, adjuntos de solicitudes) de `Buffer` en MongoDB a
Amazon S3, guardando solo la referencia (`s3_key`) en Mongo. `clientes.logo` queda
fuera de alcance — sigue en Mongo sin cambios.

**Architecture:** Un `S3Service` (`common/s3/`) global, wrapper delgado sobre
`@aws-sdk/client-s3`, expone `subir`/`descargar`/`eliminar`. `DocumentosHelper`
(compartido por 5 módulos) recibe esa instancia y la usa para subir en `agregar()` y
leer en `servir()`, cayendo a `contenido` (Buffer) cuando el documento es legacy y no
tiene `s3_key`. `solicitudes.service.ts` replica el mismo patrón para su
subdocumento `adjunto`, que no pasa por `DocumentosHelper`.

**Tech Stack:** NestJS 10, Mongoose 8, `@aws-sdk/client-s3` (v3), `@nestjs/config`.

## Global Constraints

- Bucket: `sc-portal-clientes-archivos-390866253693-us-east-2-an`
- Región: `us-east-2`
- Credenciales AWS vía default credential provider chain (env vars en `.env` para
  desarrollo local, IAM role en producción si aplica) — nunca hardcodeadas en código.
- Sin migración de documentos existentes: los que ya tienen `contenido` (Buffer) en
  Mongo se siguen sirviendo desde ahí indefinidamente.
- `clientes.logo` no se toca en absoluto en este plan.
- Estructura de keys: `documentos/{origenTipo}/{entidadId}/{timestamp}_{rand}_{nombreOriginal}`
  para documentos vía `DocumentosHelper`, y `solicitudes/{solicitudId}/{timestamp}_{rand}_{nombreOriginal}`
  para el adjunto de solicitudes.
- **Sin framework de tests en el proyecto** (no hay Jest instalado, ver
  `back4/package.json`). En vez de introducir uno de cero (decisión mayor fuera de
  alcance de este cambio), la verificación de cada tarea se hace: (a) con un script
  `tsx` standalone para el `S3Service` (mismo patrón que
  `back4/scripts/test-mail-all.ts`), y (b) con `curl` contra el servidor NestJS
  corriendo en modo dev para los flujos de subir/servir/eliminar documento.
- No se cambia ningún contrato de API (rutas, payloads, respuestas) — el frontend no
  requiere cambios.

---

### Task 1: Dependencia AWS SDK + variables de entorno

**Files:**
- Modify: `back4/package.json`
- Modify: `back4/.env.example`
- Modify: `back4/.env` (agregar placeholders localmente; **no** commitear valores reales)

**Interfaces:**
- Produces: variables de entorno `AWS_REGION`, `S3_BUCKET_NAME`,
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` disponibles vía `ConfigService`.

- [ ] **Step 1: Instalar el SDK**

```bash
cd back4 && npm install @aws-sdk/client-s3
```

- [ ] **Step 2: Agregar las variables a `.env.example`**

Agregar al final de `back4/.env.example`:

```
# AWS S3 — almacenamiento de documentos
AWS_REGION=us-east-2
S3_BUCKET_NAME=sc-portal-clientes-archivos-390866253693-us-east-2-an
AWS_ACCESS_KEY_ID=<access_key_de_un_usuario_IAM_con_permisos_s3:PutObject/GetObject_sobre_el_bucket>
AWS_SECRET_ACCESS_KEY=<secret_key_correspondiente>
```

- [ ] **Step 3: Agregar las mismas variables a `back4/.env` local**

Completar `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` con credenciales reales de un
usuario IAM (no se commitea, `.env` ya está en `.gitignore` — confirmar con
`git check-ignore back4/.env` antes de continuar).

- [ ] **Step 4: Verificar que el proyecto sigue compilando**

```bash
cd back4 && npx tsc --noEmit
```

Expected: sin errores (la dependencia nueva no se usa todavía, solo se instaló).

- [ ] **Step 5: Commit**

```bash
git add back4/package.json back4/package-lock.json back4/.env.example
git commit -m "chore(back): agregar @aws-sdk/client-s3 y variables de entorno para S3"
```

---

### Task 2: `S3Service` + `S3Module` + script de verificación manual

**Files:**
- Create: `back4/src/common/s3/s3.service.ts`
- Create: `back4/src/common/s3/s3.module.ts`
- Create: `back4/scripts/test-s3.ts`
- Modify: `back4/src/app.module.ts`

**Interfaces:**
- Produces: `S3Service.subir(key: string, buffer: Buffer, mimetype: string): Promise<void>`,
  `S3Service.descargar(key: string): Promise<Buffer>` (lanza `NotFoundException` si la
  key no existe), `S3Service.eliminar(key: string): Promise<void>`.
- Consumes: `ConfigService` de `@nestjs/config` (ya usado en `auth.module.ts` con el
  mismo patrón).

- [ ] **Step 1: Crear `S3Service`**

```ts
// back4/src/common/s3/s3.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('S3_BUCKET_NAME') ?? '';
    this.client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
    });
  }

  async subir(key: string, buffer: Buffer, mimetype: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );
  }

  async descargar(key: string): Promise<Buffer> {
    let response;
    try {
      response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === 'NoSuchKey' || name === 'NotFound') {
        throw new NotFoundException(`Archivo no encontrado en S3: ${key}`);
      }
      throw err;
    }
    const stream = response.Body as AsyncIterable<Uint8Array>;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async eliminar(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
```

- [ ] **Step 2: Crear `S3Module` como módulo global**

```ts
// back4/src/common/s3/s3.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3Service } from './s3.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
```

`@Global()` evita tener que importar `S3Module` en cada uno de los 6 módulos que lo
necesitan (activos, centros-costos, proyectos, clientes, actividades, solicitudes) —
se registra una sola vez en `AppModule`.

- [ ] **Step 3: Registrar `S3Module` en `AppModule`**

En `back4/src/app.module.ts`, agregar el import y registrarlo antes de los módulos de
negocio:

```ts
import { S3Module } from './common/s3/s3.module';
```

y en el array `imports`, justo después de `MongooseModule.forRoot(...)`:

```ts
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes'),
    S3Module,
    AuthModule,
```

- [ ] **Step 4: Script de verificación manual (round-trip real contra S3)**

```ts
// back4/scripts/test-s3.ts
/**
 * Verifica que las credenciales y el bucket de S3 funcionan: sube un archivo de
 * prueba, lo descarga, compara el contenido, y lo borra.
 *
 * Ejecutar desde back4/:
 *   npx tsx scripts/test-s3.ts
 */
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const bucket = process.env.S3_BUCKET_NAME ?? '';
const region = process.env.AWS_REGION ?? '';

if (!bucket || !region) {
  console.error('ERROR: S3_BUCKET_NAME o AWS_REGION no están definidos en .env');
  process.exit(1);
}

async function main() {
  const client = new S3Client({ region });
  const key = `documentos/_test/${Date.now()}_test.txt`;
  const contenido = Buffer.from('hola desde test-s3.ts');

  console.log(`Subiendo ${key} a bucket ${bucket}...`);
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: contenido, ContentType: 'text/plain' }));

  console.log('Descargando...');
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const stream = res.Body as AsyncIterable<Uint8Array>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const descargado = Buffer.concat(chunks);

  if (!descargado.equals(contenido)) {
    console.error('FALLÓ: el contenido descargado no coincide con el subido');
    process.exit(1);
  }
  console.log('OK: contenido coincide.');

  console.log('Borrando objeto de prueba...');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));

  console.log('S3 OK: subida, descarga y borrado funcionan correctamente.');
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
```

- [ ] **Step 5: Correr el script y confirmar el resultado**

```bash
cd back4 && npx tsx scripts/test-s3.ts
```

Expected: termina con `S3 OK: subida, descarga y borrado funcionan correctamente.`
Si falla por credenciales o permisos, corregir `.env` antes de continuar — todo lo
que sigue depende de que esto funcione.

- [ ] **Step 6: Commit**

```bash
git add back4/src/common/s3 back4/src/app.module.ts back4/scripts/test-s3.ts
git commit -m "feat(back): agregar S3Service y S3Module para almacenamiento de documentos"
```

---

### Task 3: Schemas — `contenido` opcional + `s3_key`

**Files:**
- Modify: `back4/src/activos/doc-activo.schema.ts`
- Modify: `back4/src/centros-costos/doc-centro-costo.schema.ts`
- Modify: `back4/src/proyectos/doc-proyecto.schema.ts`
- Modify: `back4/src/clientes/doc-cliente.schema.ts`
- Modify: `back4/src/actividades/doc-actividad.schema.ts`
- Modify: `back4/src/common/schemas/doc-eliminado.schema.ts`
- Modify: `back4/src/documentos-vencidos/documentos-vencidos.schema.ts`
- Modify: `back4/src/documentos-vencidos/documentos-vencidos.dto.ts`
- Modify: `back4/src/solicitudes/solicitudes.schema.ts`

**Interfaces:**
- Produces: campo `s3_key?: string` en los 7 schemas listados y en
  `Solicitud.adjunto`, y `contenido` pasa de `required: true` a opcional en todos
  ellos donde antes era requerido.

- [ ] **Step 1: `doc-activo.schema.ts`**

Reemplazar:
```ts
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
```
por:
```ts
  @Prop({ type: Buffer }) contenido?: Buffer;
  @Prop() s3_key?: string;
```

- [ ] **Step 2: mismo cambio en `doc-centro-costo.schema.ts`, `doc-proyecto.schema.ts`,
  `doc-cliente.schema.ts`, `doc-actividad.schema.ts`**

Idéntico reemplazo de:
```ts
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
```
por:
```ts
  @Prop({ type: Buffer }) contenido?: Buffer;
  @Prop() s3_key?: string;
```
en cada uno de los 4 archivos.

- [ ] **Step 3: `doc-eliminado.schema.ts`**

Reemplazar:
```ts
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
```
por:
```ts
  @Prop({ type: Buffer }) contenido?: Buffer;
  @Prop() s3_key?: string;
```

- [ ] **Step 4: `documentos-vencidos.schema.ts`**

`contenido` ya es opcional. Agregar la nueva propiedad justo debajo:
```ts
  @Prop({ type: Buffer }) contenido?: Buffer;
  @Prop() s3_key?: string;
```

- [ ] **Step 5: `documentos-vencidos.dto.ts`**

Agregar el campo al DTO, debajo de `contenido`:
```ts
  @IsOptional() contenido?: Buffer;
  @IsString() @IsOptional() s3_key?: string;
```

- [ ] **Step 6: `solicitudes.schema.ts`**

Reemplazar:
```ts
  @Prop({
    type: {
      contenido: Buffer,
      tipo_mime: String,
      nombre: String,
    },
  })
  adjunto?: { contenido: Buffer; tipo_mime: string; nombre: string };
```
por:
```ts
  @Prop({
    type: {
      contenido: Buffer,
      s3_key: String,
      tipo_mime: String,
      nombre: String,
    },
  })
  adjunto?: { contenido?: Buffer; s3_key?: string; tipo_mime: string; nombre: string };
```

- [ ] **Step 7: Verificar que compila**

```bash
cd back4 && npx tsc --noEmit
```

Expected: sin errores. (Puede haber errores en servicios que todavía leen
`contenido` como no-opcional — se resuelven en las tareas siguientes; si aparecen
acá, son en archivos fuera de los tocados en este task y se solucionan en el task
correspondiente).

- [ ] **Step 8: Commit**

```bash
git add back4/src/activos/doc-activo.schema.ts \
        back4/src/centros-costos/doc-centro-costo.schema.ts \
        back4/src/proyectos/doc-proyecto.schema.ts \
        back4/src/clientes/doc-cliente.schema.ts \
        back4/src/actividades/doc-actividad.schema.ts \
        back4/src/common/schemas/doc-eliminado.schema.ts \
        back4/src/documentos-vencidos/documentos-vencidos.schema.ts \
        back4/src/documentos-vencidos/documentos-vencidos.dto.ts \
        back4/src/solicitudes/solicitudes.schema.ts
git commit -m "feat(back): agregar campo s3_key y volver opcional contenido en schemas de documentos"
```

---

### Task 4: `DocumentosHelper` — subir a S3, servir desde S3 con fallback legacy

**Files:**
- Modify: `back4/src/common/helpers/documentos.helper.ts`

**Interfaces:**
- Consumes: `S3Service.subir`, `S3Service.descargar` (de Task 2).
- Produces: `DocumentosHelper` ahora recibe `S3Service` como último parámetro del
  constructor: `new DocumentosHelper(entidadModel, docModel, fkField, docEliminadoModel, origenTipo, entidad, s3Service)`.
  `agregar()`, `servir()`, `eliminar()` mantienen las mismas firmas públicas.

- [ ] **Step 1: Reescribir el archivo completo**

```ts
// back4/src/common/helpers/documentos.helper.ts
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { S3Service } from '../s3/s3.service';

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
    private readonly s3: S3Service,
  ) {}

  private buildKey(entidadId: string, nombre: string): string {
    return `documentos/${this.origenTipo}/${entidadId}/${nombre}`;
  }

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

    const s3Key = this.buildKey(id, nombre);
    await this.s3.subir(s3Key, archivo.buffer, archivo.mimetype);

    const nuevoDoc: Record<string, unknown> = {
      [this.fkField]: new Types.ObjectId(id),
      nombre,
      nombre_display,
      tipo_mime:    archivo.mimetype,
      tamano_bytes: archivo.size,
      s3_key:       s3Key,
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
      .sort({ nombre_display: 1 })
      .lean();
  }

  async servir(entidadId: string, docId: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const doc = await this.docModel.findOne({
      _id: new Types.ObjectId(docId),
      [this.fkField]: new Types.ObjectId(entidadId),
    });
    if (!doc) throw new NotFoundException(`Documento ${docId} no encontrado`);

    if (doc.s3_key) {
      const buffer = await this.s3.descargar(doc.s3_key as string);
      return { buffer, tipo_mime: doc.tipo_mime as string, nombre_display: doc.nombre_display as string };
    }

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
      s3_key:         doc.s3_key,
      subido_en:      doc.subido_en,
    });

    await this.docModel.deleteOne({ _id: doc._id });
    return { message: 'Documento eliminado', docId };
  }
}
```

Nota: el objeto en S3 **no se borra** en `eliminar()` — queda huérfano hasta una
futura purga (documentado como limitación aceptada en el spec).

- [ ] **Step 2: Verificar compilación (fallará hasta Task 5, es esperado)**

```bash
cd back4 && npx tsc --noEmit
```

Expected: errores en los 6 archivos que instancian `new DocumentosHelper(...)` con 6
argumentos en vez de 7 (`activos.service.ts`, `centros-costos.service.ts`,
`proyectos.service.ts`, `clientes.service.ts`, `actividades.service.ts`,
`solicitudes.service.ts`). Se resuelven en el Task 5. No hacer commit todavía si
`tsc` falla — pasar directo al Task 5 antes de commitear ambos juntos, o commitear
este archivo solo si tu flujo de trabajo prefiere commits atómicos por archivo (en
ese caso el build roto es temporal y se arregla en el próximo commit).

- [ ] **Step 3: Commit**

```bash
git add back4/src/common/helpers/documentos.helper.ts
git commit -m "feat(back): DocumentosHelper sube a S3 y sirve con fallback a Buffer legacy"
```

---

### Task 5: Inyectar `S3Service` en los 5 servicios que usan `DocumentosHelper`

**Files:**
- Modify: `back4/src/activos/activos.service.ts`
- Modify: `back4/src/centros-costos/centros-costos.service.ts`
- Modify: `back4/src/proyectos/proyectos.service.ts`
- Modify: `back4/src/clientes/clientes.service.ts`
- Modify: `back4/src/actividades/actividades.service.ts`

**Interfaces:**
- Consumes: `S3Service` (Task 2, disponible globalmente vía `S3Module`),
  `DocumentosHelper` constructor de 7 argumentos (Task 4).

- [ ] **Step 1: `activos.service.ts`**

Agregar el import:
```ts
import { S3Service } from '../common/s3/s3.service';
```

En el constructor, agregar el parámetro `private readonly s3Service: S3Service,` al
final de la lista de parámetros existente, y pasar `s3Service` como 7º argumento:

```ts
  constructor(
    @InjectModel('Activo') private activoModel: Model<ActivoDocument>,
    @InjectModel('DocActivo') private docActivoModel: Model<any>,
    @InjectModel('DocEliminado') private docEliminadoModel: Model<any>,
    @InjectModel('CentroCosto') private centroCostoModel: Model<CentroCostoDocument>,
    @InjectModel('TipoActivo') private tipoActivoModel: Model<any>,
    private readonly s3Service: S3Service,
  ) {
    this.docsHelper = new DocumentosHelper(
      activoModel,
      docActivoModel,
      'activo_id',
      docEliminadoModel,
      'activo',
      'Activo',
      s3Service,
    );
  }
```

- [ ] **Step 2: `centros-costos.service.ts`**

Mismo patrón: agregar import de `S3Service`, agregar
`private readonly s3Service: S3Service,` al constructor, y `s3Service` como 7º
argumento de `new DocumentosHelper(...)`:

```ts
    private readonly s3Service: S3Service,
  ) {
    this.docsHelper = new DocumentosHelper(
      centroCostoModel,
      docCentroCostoModel,
      'centro_costo_id',
      docEliminadoModel,
      'centro',
      'Centro de costos',
      s3Service,
    );
  }
```

- [ ] **Step 3: `proyectos.service.ts`**

Mismo patrón:

```ts
    private readonly s3Service: S3Service,
  ) {
    this.docsHelper = new DocumentosHelper(
      proyectoModel,
      docProyectoModel,
      'proyecto_id',
      docEliminadoModel,
      'proyecto',
      'Proyecto',
      s3Service,
    );
```

(mantener los parámetros ya existentes del constructor que siguen después, como
`usuarioModel`, `documentosVencidosService`, `mailService`, `logger` — solo se agrega
`s3Service` y se pasa al `DocumentosHelper`).

- [ ] **Step 4: `clientes.service.ts`**

Mismo patrón:

```ts
    private readonly s3Service: S3Service,
  ) {
    this.docsHelper = new DocumentosHelper(
      clienteModel,
      docClienteModel,
      'cliente_id',
      docEliminadoModel,
      'empresa',
      'Cliente',
      s3Service,
    );
  }
```

- [ ] **Step 5: `actividades.service.ts`**

Mismo patrón:

```ts
    private mailService: MailService,
    private readonly s3Service: S3Service,
  ) {
    this.docsHelper = new DocumentosHelper(
      actividadModel,
      docActividadModel,
      'actividad_id',
      docEliminadoModel,
      'actividad',
      'Actividad',
      s3Service,
    );
  }
```

- [ ] **Step 6: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit
```

Expected: sin errores relacionados a `DocumentosHelper` en estos 5 archivos. (Los de
`solicitudes.service.ts` se resuelven en el Task 6).

- [ ] **Step 7: Commit**

```bash
git add back4/src/activos/activos.service.ts \
        back4/src/centros-costos/centros-costos.service.ts \
        back4/src/proyectos/proyectos.service.ts \
        back4/src/clientes/clientes.service.ts \
        back4/src/actividades/actividades.service.ts
git commit -m "feat(back): inyectar S3Service en servicios que usan DocumentosHelper"
```

---

### Task 6: `solicitudes.service.ts` — adjunto vía S3

**Files:**
- Modify: `back4/src/solicitudes/solicitudes.service.ts`

**Interfaces:**
- Consumes: `S3Service` (Task 2), `DocumentosHelper` constructor de 7 argumentos
  (Task 4).
- Produces: `adjuntarArchivo()` sigue devolviendo el mismo shape (documento sin
  `adjunto.contenido`); `servirAdjunto()` sigue devolviendo
  `{ buffer, tipo_mime, nombre }`.

- [ ] **Step 1: Agregar import y parámetro de constructor**

Agregar:
```ts
import { S3Service } from '../common/s3/s3.service';
```

En el constructor, agregar `private readonly s3Service: S3Service,` después de
`mailService`, y pasar `s3Service` como 7º argumento a los 3 `new DocumentosHelper(...)`:

```ts
    private mailService: MailService,
    private readonly s3Service: S3Service,
  ) {
    this.docsEmpresa  = new DocumentosHelper(this.clienteModel as unknown as Model<any>, this.docClienteModel, 'cliente_id', this.docEliminadoModel, 'empresa', 'Cliente', s3Service);
    this.docsCentro   = new DocumentosHelper(this.centroCostoModel as unknown as Model<any>, this.docCentroCostoModel, 'centro_costo_id', this.docEliminadoModel, 'centro', 'CentroCosto', s3Service);
    this.docsProyecto = new DocumentosHelper(this.proyectoModel as unknown as Model<any>, this.docProyectoModel, 'proyecto_id', this.docEliminadoModel, 'proyecto', 'Proyecto', s3Service);
  }
```

- [ ] **Step 2: `adjuntarArchivo()` sube a S3 en vez de guardar Buffer**

Reemplazar el cuerpo del método (después de las validaciones de estado y tipo MIME
que no cambian):

```ts
  async adjuntarArchivo(id: string, archivo: { originalname: string; buffer: Buffer; mimetype: string }) {
    const solicitud = await this.solicitudModel.findById(id).lean();
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (!['pendiente', 'rechazado'].includes(solicitud.estado)) {
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

    const timestamp = Date.now();
    const rand = Math.random().toString(36).substring(7);
    const s3Key = `solicitudes/${id}/${timestamp}_${rand}_${archivo.originalname}`;
    await this.s3Service.subir(s3Key, archivo.buffer, archivo.mimetype);

    return this.solicitudModel
      .findByIdAndUpdate(
        id,
        {
          adjunto: { s3_key: s3Key, tipo_mime: archivo.mimetype, nombre: archivo.originalname },
          estado: 'revision',
        },
        { new: true },
      )
      .select('-adjunto.contenido')
      .lean();
  }
```

- [ ] **Step 3: `servirAdjunto()` lee de S3 con fallback legacy**

Reemplazar:

```ts
  async servirAdjunto(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre: string }> {
    const solicitud = await this.solicitudModel.findById(id);
    if (!solicitud) throw new NotFoundException(`Solicitud ${id} no encontrada`);
    if (!solicitud.adjunto?.s3_key && !solicitud.adjunto?.contenido) {
      throw new NotFoundException('Esta solicitud no tiene adjunto');
    }
    if (solicitud.adjunto.s3_key) {
      const buffer = await this.s3Service.descargar(solicitud.adjunto.s3_key);
      return { buffer, tipo_mime: solicitud.adjunto.tipo_mime, nombre: solicitud.adjunto.nombre };
    }
    const raw = solicitud.adjunto.contenido as unknown;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    return { buffer, tipo_mime: solicitud.adjunto.tipo_mime, nombre: solicitud.adjunto.nombre };
  }
```

- [ ] **Step 4: `crearDocumentoDesde()` — leer buffer desde S3 si no hay Buffer legacy**

Reemplazar:

```ts
  private async crearDocumentoDesde(sol: SolicitudDocument): Promise<void> {
    if (!sol.adjunto?.s3_key && !sol.adjunto?.contenido) return;

    let buffer: Buffer;
    if (sol.adjunto.s3_key) {
      buffer = await this.s3Service.descargar(sol.adjunto.s3_key);
    } else {
      const raw = sol.adjunto.contenido as unknown;
      buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    }

    const archivo: ArchivoInput = {
      originalname: sol.adjunto.nombre,
      buffer,
      mimetype:     sol.adjunto.tipo_mime,
      size:         buffer.length,
    };
    if (sol.proyecto_id) {
      await this.docsProyecto.agregar(String(sol.proyecto_id), archivo, sol.nombre, sol.tipo);
    } else if (sol.centro_costo_id) {
      await this.docsCentro.agregar(String(sol.centro_costo_id), archivo, sol.nombre, sol.tipo);
    } else {
      await this.docsEmpresa.agregar(String(sol.empresa_id), archivo, sol.nombre, sol.tipo);
    }
  }
```

- [ ] **Step 5: Actualizar la condición en `cambiarEstado()` que decide si crear el documento**

Buscar (dentro de `cambiarEstado`):
```ts
      const solFull = await this.solicitudModel.findById(id);
      if (solFull?.adjunto?.contenido) {
```
Reemplazar por:
```ts
      const solFull = await this.solicitudModel.findById(id);
      if (solFull?.adjunto?.s3_key || solFull?.adjunto?.contenido) {
```

- [ ] **Step 6: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit
```

Expected: sin errores en todo el proyecto.

- [ ] **Step 7: Commit**

```bash
git add back4/src/solicitudes/solicitudes.service.ts
git commit -m "feat(back): adjunto de solicitudes se sube y sirve desde S3"
```

---

### Task 7: `vencerDocumento` en proyectos y centros-costos — propagar `s3_key`

**Files:**
- Modify: `back4/src/proyectos/proyectos.service.ts:184`
- Modify: `back4/src/centros-costos/centros-costos.service.ts:165` (aprox.)

**Interfaces:**
- Consumes: `CreateDocVencidoDto.s3_key?` (Task 3).

- [ ] **Step 1: `proyectos.service.ts`**

En `vencerDocumento`, dentro del `await this.documentosVencidosService.crear({...})`,
agregar `s3_key: doc.s3_key,` junto a `contenido: doc.contenido,`:

```ts
    await this.documentosVencidosService.crear({
      nombre_display:  doc.nombre_display,
      categoria:       doc.categoria,
      tipo_mime:       doc.tipo_mime,
      tamano_bytes:    doc.tamano_bytes,
      contenido:       doc.contenido,
      s3_key:          doc.s3_key,
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

- [ ] **Step 2: `centros-costos.service.ts`**

Mismo cambio en su propio `vencerDocumento`:

```ts
    await this.documentosVencidosService.crear({
      nombre_display: doc.nombre_display,
      categoria:      doc.categoria,
      tipo_mime:      doc.tipo_mime,
      tamano_bytes:   doc.tamano_bytes,
      contenido:      doc.contenido,
      s3_key:         doc.s3_key,
      origen_tipo:    'centro',
      empresa_id:     resolvedEmpresaId,
      centro_id:      centroId,
      empresa_nombre: empresaNombre,
      centro_nombre:  centroNombre,
      // ...resto de campos existentes sin cambios
    });
```

- [ ] **Step 3: `documentos-vencidos.service.ts` — `descargar()` con fallback**

Actualizar para leer de S3 cuando corresponda. Agregar import e inyectar
`S3Service`:

```ts
// back4/src/documentos-vencidos/documentos-vencidos.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DocumentoVencido, DocumentoVencidoDocument } from './documentos-vencidos.schema';
import { CreateDocVencidoDto } from './documentos-vencidos.dto';
import { S3Service } from '../common/s3/s3.service';

@Injectable()
export class DocumentosVencidosService {
  constructor(
    @InjectModel('DocumentoVencido') private readonly model: Model<DocumentoVencidoDocument>,
    private readonly s3Service: S3Service,
  ) {}

  // ...crear() y listarUltimos20() sin cambios...

  async descargar(id: string): Promise<{ buffer: Buffer; tipo_mime: string; nombre_display: string }> {
    const doc = await this.model.findById(id);
    if (!doc) throw new NotFoundException('Documento vencido no encontrado');
    if (doc.s3_key) {
      const buffer = await this.s3Service.descargar(doc.s3_key);
      return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
    }
    const raw = doc.contenido as unknown;
    const buffer = Buffer.isBuffer(raw)
      ? raw
      : Buffer.from((raw as { buffer: ArrayBuffer }).buffer);
    return { buffer, tipo_mime: doc.tipo_mime, nombre_display: doc.nombre_display };
  }
}
```

(dejar `crear()` y `listarUltimos20()` exactamente como están hoy — no se muestran
completos arriba para no repetir código sin cambios, pero el archivo final conserva
esos dos métodos intactos).

- [ ] **Step 4: Verificar compilación**

```bash
cd back4 && npx tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add back4/src/proyectos/proyectos.service.ts \
        back4/src/centros-costos/centros-costos.service.ts \
        back4/src/documentos-vencidos/documentos-vencidos.service.ts
git commit -m "feat(back): documentos vencidos referencian s3_key en vez de duplicar contenido"
```

---

### Task 8: Documentación + verificación end-to-end manual

**Files:**
- Modify: `back4/CLAUDE.md`

**Interfaces:** N/A (documentación + verificación manual).

- [ ] **Step 1: Actualizar la sección "Almacenamiento de archivos" en `back4/CLAUDE.md`**

Reemplazar toda la sección actual (que menciona filesystem/`uploads/`) por:

```markdown
## Almacenamiento de archivos

Los documentos (activos, centros de costo, proyectos, clientes, actividades y
adjuntos de solicitudes) se suben a Amazon S3, bucket
`sc-portal-clientes-archivos-390866253693-us-east-2-an` (región `us-east-2`).
Mongo solo guarda metadata + la key de S3 (`s3_key`) en cada colección `doc_*`.

Estructura de keys: `documentos/{origenTipo}/{entidadId}/{timestamp}_{rand}_{nombre}`,
donde `origenTipo` es `empresa | centro | activo | proyecto | actividad`. Para
adjuntos de solicitudes: `solicitudes/{solicitudId}/{timestamp}_{rand}_{nombre}`.

`clientes.logo` es la única excepción: sigue guardándose como `Buffer` en Mongo, no
pasa por S3.

**Documentos legacy:** los documentos subidos antes de esta migración no se
movieron a S3 — siguen teniendo `contenido: Buffer` en Mongo y sin `s3_key`.
`DocumentosHelper.servir()` sirve desde S3 si el doc tiene `s3_key`, o desde el
Buffer si no lo tiene. No hay migración automática de lo viejo.

**Borrado:** al eliminar un documento (papelera `doc_eliminados`) o marcarlo como
vencido (`documentos_vencidos`), solo se copia la referencia `s3_key` — el objeto en
S3 no se duplica ni se borra. Limitación conocida: no hay purga automática de
objetos huérfanos en S3 todavía.

**Config:** `AWS_REGION`, `S3_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY` en `.env` (ver `.env.example`).
```

Además, en la sección de **Variables de entorno (.env)**, agregar las 4 nuevas
variables al bloque de ejemplo existente.

- [ ] **Step 2: Levantar el servidor en modo dev**

```bash
cd back4 && npm run start:dev
```

Expected: arranca sin errores en `http://localhost:3000/api/v1`.

- [ ] **Step 3: Verificación manual end-to-end — subir, servir y eliminar un
  documento de `activos`**

Con un token JWT válido (login previo) y un `activoId` real de la base de datos de
desarrollo:

```bash
# subir
curl -s -X POST http://localhost:3000/api/v1/activos/<activoId>/documentos \
  -H "Authorization: Bearer <token>" \
  -F "archivo=@/ruta/a/un/archivo.pdf"

# listar y copiar el docId devuelto
curl -s http://localhost:3000/api/v1/activos/<activoId>/documentos \
  -H "Authorization: Bearer <token>"

# servir — debe devolver el PDF descargado desde S3
curl -s http://localhost:3000/api/v1/activos/<activoId>/documentos/<docId> \
  -H "Authorization: Bearer <token>" -o /tmp/descargado.pdf
diff /ruta/a/un/archivo.pdf /tmp/descargado.pdf   # debe no mostrar diferencias

# eliminar
curl -s -X DELETE http://localhost:3000/api/v1/activos/<activoId>/documentos/<docId> \
  -H "Authorization: Bearer <token>"
```

Expected en cada paso:
- La subida responde 201 con un objeto sin campo `contenido`.
- `diff` no reporta diferencias — confirma que el archivo servido desde S3 es
  idéntico al subido.
- En la consola de AWS (o `aws s3 ls s3://sc-portal-clientes-archivos-390866253693-us-east-2-an/documentos/activo/<activoId>/`)
  aparece el objeto subido mientras el documento existe en Mongo.
- El borrado responde 200 y el documento desaparece de `GET /documentos`.

- [ ] **Step 4: Verificación rápida de que lo legacy sigue funcionando**

Con un `docId` de un documento subido **antes** de este cambio (que todavía tiene
`contenido` en Mongo y no tiene `s3_key`), repetir la llamada de servir y confirmar
que el archivo se descarga igual que antes (sin tocar S3).

- [ ] **Step 5: Commit**

```bash
git add back4/CLAUDE.md
git commit -m "docs(back): actualizar CLAUDE.md con almacenamiento en S3"
```
