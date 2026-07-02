# Almacenamiento de documentos en S3

## Contexto

Hoy todos los archivos subidos por usuarios (documentos de activos, centros de costo,
proyectos, clientes y actividades, adjuntos de solicitudes, y el logo de cliente) se
guardan como `Buffer` en un campo `contenido` dentro del documento de Mongo
correspondiente. Esto no escala bien (documentos grandes infladan la colección y el
oplog, no hay CDN/streaming eficiente) y no es el patrón recomendado para archivos
binarios de tamaño variable.

Este spec cubre mover el almacenamiento de esos archivos a Amazon S3, manteniendo
Mongo solo para la metadata.

## Alcance

**Se mueven a S3** (todo lo que pasa por `DocumentosHelper` o patrón equivalente):

- `doc_activo`, `doc_centro_costo`, `doc_proyecto`, `doc_cliente`, `doc_actividad`
  (vía `DocumentosHelper`, usado por activos, centros-costos, proyectos, clientes y
  actividades)
- `solicitudes.adjunto` (subdocumento embebido)
- `doc_eliminados` (papelera) — solo referencia la key, no duplica el objeto
- `documentos_vencidos` — solo referencia la key

**Fuera de alcance** (queda igual, Buffer en Mongo):

- `clientes.logo` — se mantiene persistido en Mongo tal como está hoy. No se toca.

**Fuera de alcance (explícito):**

- Migración de documentos ya existentes en Mongo (sus Buffers no se mueven a S3).
  El sistema debe seguir sirviéndolos desde Mongo indefinidamente.

## Bucket y región

- Bucket: `sc-portal-clientes-archivos-390866253693-us-east-2-an`
- Región: `us-east-2`
- Credenciales: SDK usa el default credential provider chain de AWS
  (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` en `.env` para desarrollo local, o rol
  IAM en producción si aplica). No se hardcodean credenciales en código.

## SDK

`@aws-sdk/client-s3` (AWS SDK para JavaScript v3). Es el estándar actual,
modular (tree-shakable) y con soporte activo; v2 está en mantenimiento.

## Estructura de keys en S3

Por tipo de entidad + ID, para no depender de nombres que pueden cambiar:

```
documentos/{origenTipo}/{entidadId}/{timestamp}_{rand}_{nombreOriginal}
```

donde `origenTipo` es uno de `empresa | centro | activo | proyecto | actividad`
(mismos valores que ya usa `DocEliminado.origen_tipo`).

Para el adjunto de solicitudes:

```
solicitudes/{solicitudId}/{timestamp}_{rand}_{nombreOriginal}
```

## Cambios de schema

En cada schema `doc_activo`, `doc_centro_costo`, `doc_proyecto`, `doc_cliente`,
`doc_actividad`, `doc_eliminados`, `documentos_vencidos`, y en el subdocumento
`adjunto` de `solicitudes`:

- `contenido: Buffer` pasa de **required** a **opcional** (se mantiene el campo para
  poder seguir leyendo documentos antiguos, pero ya no se escribe para nada nuevo).
- Se agrega `s3_key?: string` — presente únicamente en documentos subidos después de
  este cambio.

`tipo_mime`, `tamano_bytes`, `nombre`, `nombre_display`, etc. no cambian.

## Nuevo módulo: `S3Service`

`back4/src/common/s3/s3.service.ts`, `NestJS` `@Injectable()`, expone:

- `subir(key: string, buffer: Buffer, mimetype: string): Promise<void>` —
  `PutObjectCommand`.
- `descargar(key: string): Promise<Buffer>` — `GetObjectCommand`, junta el stream a
  Buffer (el volumen de archivos de este portal no justifica streaming HTTP directo
  todavía; se puede optimizar después si hace falta).
- `eliminar(key: string): Promise<void>` — reservado para uso futuro (hoy `eliminar()`
  de documentos no borra el objeto S3, ver más abajo). Se implementa igual para no
  dejar el servicio incompleto, aunque `DocumentosHelper.eliminar()` no lo invoque
  todavía.

Se registra en un `S3Module` (`common/s3/s3.module.ts`), importado donde se necesite
(`DocumentosModule`-equivalentes: activos, centros-costos, proyectos, clientes,
actividades, solicitudes).

## Cambios en `DocumentosHelper`

Constructor recibe además una instancia de `S3Service` y el `origenTipo` (ya lo
recibe) se usa para construir la key.

- **`agregar()`**: en vez de guardar `contenido: archivo.buffer`, primero llama a
  `s3Service.subir(key, archivo.buffer, archivo.mimetype)`. Si falla, se propaga el
  error y **no** se crea el documento en Mongo (nunca queda un doc sin archivo real).
  Si tiene éxito, se guarda `s3_key` en vez de `contenido`.
- **`servir()`**: si el doc tiene `s3_key`, descarga desde S3 con
  `s3Service.descargar()`. Si no tiene `s3_key` (documento legacy), sirve `contenido`
  como hoy.
- **`eliminar()`**: la copia a `doc_eliminados` incluye `s3_key` si existe (no se
  duplica el objeto en S3, no se borra tampoco — sin purga automática por ahora, es
  una limitación conocida y aceptada).

Mismo patrón aplicado directamente en `solicitudes.service.ts` para
`solicitudes.adjunto` (no usa `DocumentosHelper`, tiene su propio código de
subir/servir adjunto).

## Manejo de errores

- Si S3 no está disponible o las credenciales son inválidas al subir, el endpoint de
  subida responde con error (5xx) y no se persiste nada en Mongo — comportamiento
  "todo o nada", igual de estricto que ahora.
- Si un `s3_key` referenciado en Mongo ya no existe en S3 (borrado manual fuera de la
  app), `servir()` debe devolver `NotFoundException`, no un 500.

## Configuración (`.env`)

Nuevas variables:

```
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=<credencial IAM con permisos s3:PutObject/GetObject sobre el bucket>
AWS_SECRET_ACCESS_KEY=<...>
S3_BUCKET_NAME=sc-portal-clientes-archivos-390866253693-us-east-2-an
```

Se documentan en `back4/CLAUDE.md` (sección "Almacenamiento de archivos", que hoy
está desactualizada y menciona filesystem — se corrige para reflejar S3 + Mongo
legacy).

## Testing

- Unit tests de `S3Service` mockeando el cliente `@aws-sdk/client-s3`
  (`aws-sdk-client-mock` o mock manual).
- Unit tests de `DocumentosHelper.agregar()`/`servir()`/`eliminar()` con `S3Service`
  mockeado, cubriendo: subida exitosa, fallo de subida (no crea doc), servir con
  `s3_key`, servir legacy con `contenido`, servir `s3_key` inexistente en S3
  (`NotFoundException`).
- No se requieren credenciales reales de AWS para correr los tests.

## No incluido en este spec

- Migración de datos existentes (Buffers ya en Mongo permanecen ahí).
- Borrado real de objetos S3 al eliminar documentos o purgar la papelera.
- URLs firmadas / acceso directo del frontend a S3 (se mantiene proxy vía backend).
- Cambios al frontend — los endpoints y contratos de API no cambian.
