---
name: reestructuracion-documentos
description: Mover documentos binarios de arrays embebidos en entidades a colecciones separadas por entidad, para evitar el límite de 16MB por documento de MongoDB
metadata:
  type: project
---

# Reestructuración de almacenamiento de documentos

## Problema

Todas las entidades (centros_costos, clientes, activos, proyectos, actividades) guardan documentos como subdocumentos embebidos con `contenido: Buffer` directamente en el mismo documento de MongoDB. MongoDB tiene un límite de 16MB por documento. Cuando se acumulan varios archivos en una entidad, el documento supera ese límite y arroja error.

## Solución

Colecciones separadas por entidad (Opción A). Cada documento vive en su propia colección con un FK a la entidad padre. Las entidades dejan de tener el campo `documentos[]` embebido. Las colecciones de destino para documentos eliminados y vencidos se mantienen separadas.

## Colecciones nuevas

### 5 colecciones de documentos activos

| Colección | FK | Entidad origen |
|---|---|---|
| `doc_centro_costo` | `centro_costo_id` | centros_costos |
| `doc_cliente` | `cliente_id` | clientes |
| `doc_activo` | `activo_id` | activos |
| `doc_proyecto` | `proyecto_id` | proyectos |
| `doc_actividad` | `actividad_id` | actividades |

Cada schema tiene los mismos campos:

```ts
@Schema({ collection: 'doc_<entidad>', timestamps: { createdAt: 'creado_en' } })
class Doc<Entidad> {
  @Prop({ type: Types.ObjectId, ref: '<Entidad>', required: true }) <entidad>_id: Types.ObjectId;
  @Prop({ required: true }) nombre: string;           // nombre único generado (timestamp_rand_original)
  @Prop({ required: true }) nombre_display: string;   // nombre visible al usuario
  @Prop({ required: true }) tipo_mime: string;
  @Prop({ required: true }) tamano_bytes: number;
  @Prop({ type: Buffer, required: true }) contenido: Buffer;
  @Prop() categoria?: string;
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) subido_por?: Types.ObjectId;
  @Prop({ default: Date.now }) subido_en: Date;
}
// Índice en el FK para queries eficientes
Doc<Entidad>Schema.index({ <entidad>_id: 1 });
```

Archivos creados (co-ubicados con la entidad):
- `centros-costos/doc-centro-costo.schema.ts`
- `clientes/doc-cliente.schema.ts`
- `activos/doc-activo.schema.ts`
- `proyectos/doc-proyecto.schema.ts`
- `actividades/doc-actividad.schema.ts`

### 1 colección de documentos eliminados

```ts
@Schema({ collection: 'doc_eliminados', timestamps: { createdAt: 'eliminado_en' } })
class DocEliminado {
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
```

Archivo: `common/schemas/doc-eliminado.schema.ts`

## Cambios en entidades existentes

Eliminar de los schemas:

| Archivo | Qué se elimina |
|---|---|
| `centros-costos/centros-costos.schema.ts` | clase `Documento` + `@Prop documentos[]` |
| `clientes/clientes.schema.ts` | clase `DocumentoEmpresa` + `@Prop documentos[]` |
| `activos/activos.schema.ts` | interface `DocActivo` + `@Prop documentos[]` |
| `proyectos/proyectos.schema.ts` | clase `Documento` + `@Prop documentos[]` |
| `actividades/actividades.schema.ts` | interface `DocActividad` + `@Prop documentos[]` |

También se eliminan todas las llamadas `.select('-documentos.contenido')` de los servicios, ya que no existe más el campo embebido.

## DocumentosHelper actualizado

El helper deja de usar `$push`/`$pull` en el modelo de la entidad. Pasa a operar sobre el modelo de documentos separado:

```ts
export class DocumentosHelper {
  constructor(
    private readonly entidadModel: Model<any>,  // para verificar existencia
    private readonly docModel: Model<any>,       // colección doc_*
    private readonly fkField: string,            // 'centro_costo_id', 'cliente_id', etc.
    private readonly docEliminadoModel: Model<any>,
    private readonly origenTipo: string,         // 'empresa' | 'centro' | 'activo' | 'proyecto' | 'actividad'
    private readonly entidad: string,
  ) {}
}
```

### Flujo agregar

1. Verificar que la entidad existe (`entidadModel.findById`)
2. Crear el documento en `docModel.create({ [fkField]: entidadId, ...campos })`
3. Retornar el documento creado sin el campo `contenido`

### Flujo listar

```ts
docModel.find({ [fkField]: entidadId }).select('-contenido').lean()
```

### Flujo servir (descarga)

```ts
docModel.findOne({ _id: docId, [fkField]: entidadId })
// retorna { buffer, tipo_mime, nombre_display }
```

### Flujo eliminar → mueve a doc_eliminados

1. Leer documento: `docModel.findOne({ _id: docId, [fkField]: entidadId })`
2. Crear en `docEliminadoModel.create({ origen_tipo, entidad_id, ...camposDoc })`
3. Borrar de origen: `docModel.deleteOne({ _id: docId })`

### Flujo vencer → mueve a documentos_vencidos (sin cambio de lógica)

El servicio de centros/proyectos sigue llamando a `documentosVencidosService.crear()`, pero ahora lee el documento de `docModel` en lugar del array embebido de la entidad.

## Módulos — cambios

Cada módulo registra su nuevo schema de documentos en `MongooseModule.forFeature`:

```ts
// ejemplo centros-costos.module.ts
MongooseModule.forFeature([
  { name: 'CentroCosto', schema: CentroCostoSchema },
  { name: 'DocCentroCosto', schema: DocCentroCostoSchema },  // NUEVO
])
```

El schema `DocEliminado` se registra en un módulo compartido o directamente en cada módulo que lo inyecte.

## Endpoints del backend — sin cambio

Todas las URLs existentes quedan idénticas. Solo cambia la implementación interna.

| Método | URL | Comportamiento |
|---|---|---|
| `POST` | `/empresas/:id/documentos` | sube a `doc_cliente` |
| `GET` | `/empresas/:id/documentos` | lista de `doc_cliente` |
| `GET` | `/empresas/:id/documentos/:docId` | sirve de `doc_cliente` |
| `DELETE` | `/empresas/:id/documentos/:docId` | mueve a `doc_eliminados` |
| idem para `/centros/`, `/proyectos/`, `/activos/`, `/actividades/` | | |

## Impacto en el frontend

**Empresa, Centro, Proyecto:** cero cambios. `DocumentosService` ya hace llamadas separadas a `/documentos`.

**Activos y Actividades:** el frontend lee `activoEditando?.documentos` del objeto de entidad. Al quitar el array embebido, esa propiedad queda vacía. Se agrega una llamada `GET /activos/:id/documentos` al cargar el activo para edición en `activos-page.component.ts` y equivalente en `actividades-page.component.ts`.

## Activos y actividades — migración de lógica inline

Actualmente `activos.service.ts` y `actividades.service.ts` tienen métodos `subirDocumento`/`eliminarDocumento`/`getDocumento` propios con `$push`/`$pull`. Se reemplazan por `DocumentosHelper` con el mismo patrón que los demás módulos.

Diferencia a resolver: activos/actividades usan `nombre` (string) como ID de documento en los endpoints actuales (`/documentos/:nombre`). Se estandariza a `_id` (ObjectId) para consistencia con el resto.

## Dato sobre datos existentes

Si hay documentos embebidos en MongoDB al momento de desplegar, quedan huérfanos (la app los ignora pero siguen en disco). Se puede hacer una migración con un script `scripts/migrate-docs-to-collections.js` que lea cada entidad y mueva sus documentos a las nuevas colecciones.
