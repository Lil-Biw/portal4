# portal-clientes-api — Backend NestJS

API REST para el Portal de Clientes ECLARITI. NestJS + Mongoose + MongoDB.

## Comandos

```bash
npm run start:dev   # Desarrollo con hot-reload → http://localhost:3000/api/v1
npm run build       # Compilar TypeScript → dist/
npm run start:prod  # Producción: node dist/main
```

## Variables de entorno (.env)

```
MONGODB_URI=mongodb://localhost:27017/portal_clientes
JWT_SECRET=<generar con: openssl rand -hex 64>
PORT=3000
CORS_ORIGIN=http://localhost:4200
MAIL_USER=<cuenta gmail>
MAIL_PASS=<contraseña de app gmail>
NODE_ENV=development
```

> NUNCA commitear `.env`. JWT_SECRET debe ser un secreto de al menos 64 caracteres
> aleatorios. Sin fallback en código fuente — si la variable no existe, el arranque
> debe fallar con error explícito.

## Base de datos

- **Motor:** MongoDB local en `portal_clientes`
- **ORM:** Mongoose con decoradores `@Schema`, `@Prop`
- **Colecciones activas:** `clientes`, `centros_costos`, `proyectos`, `solicitudes`, `mantenciones`, `tipos_mantencion`, `usuarios`, `permisos`
- **Timestamps personalizados:** todos los schemas usan `{ createdAt: 'creado_en', updatedAt: 'actualizado_en' }`

## Almacenamiento de archivos

Todo bajo `back4/uploads/` (filesystem local, efímero en producción):

| Ruta | Contenido |
|------|-----------|
| `uploads/logos/{clienteId}/logo.*` | Logos de empresas (organizados por ObjectId) |
| `uploads/solicitudes/{solicitudId}/adjunto.*` | Adjuntos de solicitudes (organizados por ObjectId) |
| `uploads/{empresa}/{tipo}/{centro}/documentos/` | Documentos organizados por nombre (frágil si se renombra) |

Los archivos se sirven estáticamente como `/uploads/...` solo en `NODE_ENV !== 'production'`.

## Estructura de carpetas

```
src/
├── main.ts                        # Bootstrap: ValidationPipe global, CORS, prefijo /api/v1
├── app.module.ts                  # Registro de todos los módulos de negocio
├── common/
│   └── guards/guards.ts           # JwtAuthGuard + RolesGuard + PermisosGuard — ACTIVOS en app.module.ts
├── auth/                          # Módulo de autenticación (JWT) — registrado en app.module.ts
│
├── clientes/                      # Módulo de referencia — seguir este patrón
├── centros-costos/
├── proyectos/
├── usuarios/
├── permisos/
├── solicitudes/
├── documentos/
├── mantenciones/
└── tipos-mantencion/
```

## Patrón de módulo (seguir clientes/ como referencia)

Cada módulo tiene exactamente 5 archivos:

```
<nombre>/
├── <nombre>.schema.ts     ← @Schema + @Prop + SchemaFactory + índices
├── <nombre>.dto.ts        ← CreateDto + UpdateDto (PartialType) + class-validator
├── <nombre>.service.ts    ← Lógica de negocio, NotFoundException, .lean()
├── <nombre>.controller.ts ← @Controller, @Get/@Post/@Put/@Delete, @Query/@Param/@Body
└── <nombre>.module.ts     ← MongooseModule.forFeature, exports: [Service]
```

### Schema

```ts
@Schema({ collection: 'nombre_plural', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Entidad {
  @Prop({ required: true, trim: true }) campo: string;
  @Prop({ default: true }) activo: boolean;
}
export const EntidadSchema = SchemaFactory.createForClass(Entidad);
EntidadSchema.index({ campo_consultado: 1 });  // siempre indexar FKs
```

### DTO

```ts
export class CreateEntidadDto {
  @IsString() @MinLength(2) nombre: string;
  @IsMongoId() @IsOptional() relacion_id?: string;
}
export class UpdateEntidadDto extends PartialType(CreateEntidadDto) {}
```

- **Siempre usar `PartialType`** para el DTO de update (nunca definir campos opcionales manualmente).
- `@IsMongoId()` para todos los campos que son ObjectId.
- `class-validator` activo globalmente (whitelist + forbidNonWhitelisted + transform).

### Service

```ts
async findAll(page = 1, limit = 20) {
  const filter = { activo: true };
  const [data, total] = await Promise.all([
    this.model.find(filter).skip((page - 1) * limit).limit(limit).lean(),
    this.model.countDocuments(filter),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) };
}
```

- **Siempre `.lean()`** en queries de lectura → retorna POJOs, no documentos Mongoose.
- **`NotFoundException`** cuando `findById` retorna `null`.
- **`ConflictException`** para duplicados (RUT único, código único por centro, etc.).
- **`runValidators: true`** en `findByIdAndUpdate` cuando se actualiza (clientes, proyectos).
- Los `create()` de la mayoría de módulos retornan el documento Mongoose sin `.lean()`. Excepción: mantenciones hace re-query con `findById(...).populate('tipo_id').lean()`.

### Controller

```ts
@Controller('entidades')
export class EntidadController {
  @Get()    findAll(@Query('page') page = '1') { ... }
  @Get(':id') findOne(@Param('id') id: string) { ... }
  @Post()   create(@Body() dto: CreateDto) { ... }
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdateDto) { ... }
  @Delete(':id') remove(@Param('id') id: string) { ... }
}
```

- **Verbo `@Put`** para actualizar (todos los módulos excepto solicitudes que usa `@Patch`).
- Los query params siempre vienen como `string`; convertir con `+page`, `+limit`.
- Subida de archivos: `@UseInterceptors(FileInterceptor('campo', { storage: memoryStorage() }))` directamente en el método.

### Module

```ts
@Module({
  imports: [MongooseModule.forFeature([{ name: 'Entidad', schema: EntidadSchema }])],
  controllers: [EntidadController],
  providers: [EntidadService],
  exports: [EntidadService],   // exportar si otros módulos necesitan el service
})
```

- **NO registrar schemas de otros módulos** — importar el módulo que exporta el service.
- Excepción: `ProyectosModule` registra `CentroCostoSchema` directamente para inyectar el model en su service (validación de pertenencia).

## Respuestas paginadas vs. array plano

| Módulo | `findAll` devuelve |
|--------|-------------------|
| clientes, centros-costos, proyectos, usuarios | `{ data, total, page, pages }` |
| solicitudes, mantenciones, tipos-mantencion, permisos | `array plano` |

El frontend de `CentrosService.cargar()` maneja ambos formatos:
```ts
this.centros.set(Array.isArray(res) ? res : res.data);
```

## Populate

Solo `mantenciones` hace populate. `findAll`, `findOne`, `update` y `create` populan `tipo_id` con el documento completo de `TipoMantencion`. El resto de módulos no popula — devuelve ObjectIds tal cual.

## Soft delete vs. Hard delete

| Módulo | Estrategia |
|--------|-----------|
| clientes, centros-costos, usuarios | Soft delete (`activo: false`) |
| proyectos | Soft delete (cambio de `estado` a `'cerrado'`) |
| solicitudes, mantenciones, tipos-mantencion | Hard delete (`findByIdAndDelete`) |

## Módulo solicitudes — diferencias intencionales

- FK de cliente se llama **`empresa_id`** (no `cliente_id`). Consistente con el frontend.
- `GET /solicitudes` requiere `empresa_id` como query param obligatorio.
- Usa `@Patch` para update y `@Put` para `cambiarEstado` — el frontend usa los mismos verbos.

## Módulo documentos — patrón diferente

No tiene schema de Mongoose. Gestiona archivos en filesystem y sincroniza metadata en los subdocumentos de centros-costos y proyectos.

Endpoints (no siguen convención REST estándar):
- `POST   /documentos/upload`
- `GET    /documentos/listar?tipo=&empresa_nombre=&centro_nombre=&proyecto_nombre=`
- `DELETE /documentos/eliminar/:filename?tipo=&...`

**ADVERTENCIA — path traversal:** Los parámetros `empresa_nombre`, `centro_nombre`, `proyecto_nombre` y `filename` se usan sin sanitizar en `path.join()`. Antes de escribir cualquier lógica nueva en este módulo, verificar que la ruta resultante quede dentro de `baseDir` con `path.resolve()`.

**Riesgo adicional:** si se renombra una empresa o centro, los documentos quedan huérfanos porque la ruta usa el nombre, no el ID.

## Autenticación

`AuthModule` está registrado en `app.module.ts`. `JwtAuthGuard` y `RolesGuard` están activos como guards globales vía `APP_GUARD`.

**Problemas de seguridad conocidos (ver `PORTAL4_problemas.md` en la raíz del repo):**
- ✅ ~~`GET /usuarios` sin `@Roles()`~~ — **SOLUCIONADO**: ahora filtra por `cliente_id` cuando no es super_admin
- ⚠️ **Cross-tenant leak** en documentos de centros/proyectos/mantenciones — `centroId` no se valida contra `empresaId` en el servicio (ver §1.1)
- ⚠️ Sin rate limiting en `POST /auth/login` (ver §1.3)
- ✅ ~~Path traversal en módulo documentos~~ — **OBSOLETO**: módulo filesystem eliminado, documentos en MongoDB
- ✅ ~~`getImagen()` en noticias sin `@Public()`~~ — **SOLUCIONADO**: endpoint marcado como público; las imágenes ya cargan sin JWT
- ⚠️ `notificarRechazoSolicitud` no notifica a super_admins (ver §2.2)
- ⚠️ FK `@IsOptional` en DTOs de centros/proyectos con `!` en servicio (ver §3.1)

## Convenciones

- **Sin `any`** en código de producción — usar `Record<string, unknown>` o tipos explícitos.
- **Nombres de tokens de Mongoose:** siempre string (`'Cliente'`, `'CentroCosto'`) — nunca la clase directa.
- **Índices:** declarar explícitamente con `Schema.index()` para todas las FKs consultadas frecuentemente.
- **Errores del backend:** `class-validator` genera arrays de mensajes — el frontend los une con `. `.

## Dependencias entre módulos

```
DocumentosModule  → CentrosCostosModule, ProyectosModule
ProyectosModule   → CentrosCostosModule (schema directo, no el módulo)
UsuariosModule    → PermisosModule
MantencionesModule → TiposMantencionModule (solo schema en mismo módulo)
```

## Guía para el agente IA

1. **Agregar entidad nueva:** copiar estructura de `clientes/` exactamente. Registrar en `app.module.ts`. Usar `PartialType` en el UpdateDto.

2. **Agregar campo a schema existente:** actualizar schema → DTO → service si necesita conversión de tipo (ej. string → ObjectId). Considerar si necesita índice.

3. **NO agregar `any`** — siempre tipar correctamente.

4. **NO re-registrar schemas** de otros módulos — importar el módulo que exporta el service.

5. **Archivos subidos:** usar `storage: memoryStorage()` en el interceptor del controller. El service maneja la escritura a disco.

6. **Populate:** solo cuando el frontend necesita el objeto completo, no solo el ID. Siempre encadenar `.lean()` después.
