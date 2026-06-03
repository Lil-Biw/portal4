# portal-clientes-api — Backend NestJS (actualizado 2026-06-02)

API REST para el Portal de Clientes ECLARITI. NestJS 10 + Mongoose + MongoDB Atlas.

## Comandos

```bash
npm run start:dev   # Desarrollo con hot-reload → http://localhost:3000/api/v1
npm run build       # nest build → dist/
npm run start:prod  # node dist/main
```

## Variables de entorno (.env)

```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/portal_clientes
JWT_SECRET=<mínimo 64 chars — openssl rand -hex 64>
PORT=3000
CORS_ORIGIN=http://localhost:4200
NODE_ENV=development
MAIL_USER=<cuenta gmail>
MAIL_PASS=<contraseña de app gmail, NO la contraseña de cuenta>
PORTAL_URL=http://localhost:4200
```

> NUNCA commitear `.env`. El arranque falla con error explícito si faltan variables críticas.

## Almacenamiento de archivos

**Todos los archivos se almacenan como Buffers embebidos en MongoDB.** No existe directorio `uploads/` ni filesystem local.

| Entidad | Campo | Límite |
|---------|-------|--------|
| Cliente | `logo.contenido: Buffer` | ~16MB (límite doc MongoDB) |
| Cliente, CentroCosto, Proyecto | `documentos[].contenido: Buffer` | ~16MB/doc |
| Solicitud | `adjunto.contenido: Buffer` | ~16MB |
| Mantencion | `documentos[].contenido: Buffer` | ~16MB/doc |
| Noticia | `imagen_data: Buffer` | ~16MB |

Los archivos se sirven con endpoints GET dedicados (ej: `GET /clientes/:id/logo`).

## Base de datos

- **Motor:** MongoDB Atlas (producción) / local (desarrollo)
- **ORM:** Mongoose con decoradores `@Schema`, `@Prop`
- **Timestamps:** todos los schemas usan `{ createdAt: 'creado_en', updatedAt: 'actualizado_en' }`
- **Colecciones:** `clientes`, `centros_costos`, `proyectos`, `solicitudes`, `mantenciones`, `tipos_mantencion`, `activos`, `noticias`, `usuarios`, `permisos`

## Estructura de carpetas

```
src/
├── main.ts                                 # Bootstrap: ValidationPipe global, CORS, prefijo /api/v1
├── app.module.ts                           # Registro de todos los módulos + APP_GUARD globales
├── common/
│   ├── guards/guards.ts                    # JwtAuthGuard, RolesGuard, PermisosGuard, EmpresaAccessGuard
│   └── helpers/documentos.helper.ts        # Helper CRUD subdocumentos embebidos (usado por clientes, centros, proyectos)
├── auth/                                   # JWT login (POST /auth/login — @Public)
├── usuarios/
├── clientes/
├── centros-costos/                         # Tiene 2 controllers: centros-costos + centros-costos-admin
├── proyectos/                              # Tiene 3 controllers: proyectos + proyectos-admin + proyectos-empresa
├── solicitudes/
├── mantenciones/                           # Tiene 3 controllers: mantenciones + mantenciones-admin + mantenciones-empresa
├── tipos-mantencion/
├── activos/                                # CRUD activos por centro (tiene 2 controllers: activos + activos-admin)
├── noticias/
├── permisos/
└── mail/                                   # SMTP Gmail + templates HTML en src/mail/templates/
```

## Guards globales (app.module.ts)

```typescript
{ provide: APP_GUARD, useClass: JwtAuthGuard }    // Valida JWT (excepto @Public())
{ provide: APP_GUARD, useClass: RolesGuard }       // Valida @Roles()
{ provide: APP_GUARD, useClass: PermisosGuard }    // Valida @RequierePermiso()
```

**Guards opcionales en controllers:**
- `EmpresaAccessGuard` → valida que `user.cliente_id === :empresaId` del route param

**Decoradores disponibles:**
```typescript
@Public()                               // Exenta de JWT
@Roles('super_admin', 'admin_cliente')  // Filtra por rol
@RequierePermiso('ver' | 'editar')      // Filtra por permiso_acceso
```

## Autenticación

- **JWT payload:** `{ sub: usuario_id, email, rol, cliente_id }`
- **Expiración:** 8 horas
- **bcrypt:** SALT_ROUNDS = 10
- **Roles:** `super_admin`, `admin_cliente`, `usuario`
- **Login:** `POST /api/v1/auth/login` (@Public) → `{ access_token, usuario: { id, nombre, email, rol, cliente_id, debe_cambiar_password } }`

## Patrón de módulo

Cada módulo tiene 5 archivos base:

```
<nombre>/
├── <nombre>.schema.ts     ← @Schema + @Prop + SchemaFactory + índices
├── <nombre>.dto.ts        ← CreateDto + UpdateDto (PartialType) + class-validator
├── <nombre>.service.ts    ← Lógica de negocio, NotFoundException, .lean()
├── <nombre>.controller.ts ← @Controller, verbos HTTP, guards de ruta
└── <nombre>.module.ts     ← MongooseModule.forFeature, exports: [Service]
```

Módulos con múltiples controllers (por contexto de acceso):
- `centros-costos/`: controller principal + admin controller
- `proyectos/`: controller nested (`/empresas/:id/centros/:id/proyectos`) + admin + empresa-wide
- `mantenciones/`: controller nested + admin + empresa-wide
- `activos/`: controller nested + admin

### Schema

```typescript
@Schema({ collection: 'nombre_plural', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Entidad {
  @Prop({ required: true, trim: true }) campo: string;
  @Prop({ default: true }) activo: boolean;
}
export const EntidadSchema = SchemaFactory.createForClass(Entidad);
EntidadSchema.index({ campo_consultado: 1 });  // siempre indexar FKs
```

### DTO

```typescript
export class CreateEntidadDto {
  @IsString() @MinLength(2) nombre: string;
  @IsMongoId() @IsOptional() relacion_id?: string;
}
export class UpdateEntidadDto extends PartialType(CreateEntidadDto) {}
```

### Service

```typescript
async findAll(page = 1, limit = 20) {
  const [data, total] = await Promise.all([
    this.model.find({ activo: true }).skip((page - 1) * limit).limit(limit).lean(),
    this.model.countDocuments({ activo: true }),
  ]);
  return { data, total, page, pages: Math.ceil(total / limit) };
}
```

- **Siempre `.lean()`** en queries de lectura
- **`NotFoundException`** cuando `findById` retorna `null`
- **`ConflictException`** para duplicados
- **`runValidators: true`** en `findByIdAndUpdate`

## Respuestas: paginado vs array plano

| Módulo | Respuesta |
|--------|-----------|
| clientes, centros-costos, proyectos, usuarios | `{ data, total, page, pages }` |
| solicitudes, mantenciones, tipos-mantencion, activos, permisos | array plano |

## Populate

Solo `mantenciones` y `permisos` hacen populate:

```typescript
// Mantenciones: siempre popula tipo_id (findAll, findOne, create, update)
.populate('tipo_id')

// Permisos: según el contexto de consulta
.populate('centro_costo_id', 'codigo nombre')
.populate('usuario_id', 'nombre email')
```

## Soft delete vs Hard delete

| Módulo | Estrategia |
|--------|-----------|
| clientes, centros-costos, usuarios | Soft delete (`activo: false`) |
| proyectos | Soft delete (`estado: 'cerrado'`) |
| solicitudes, mantenciones, tipos-mantencion, activos | Hard delete |
| noticias | Hard delete |

## Solicitudes — diferencias intencionales

- FK de cliente se llama **`empresa_id`** (no `cliente_id`)
- El `empresa_id` viene del **route param** `/empresas/:empresaId/solicitudes`, no del body
- `CreateSolicitudDto` tiene `empresa_id` como `@IsOptional()` — el service lo inyecta desde el route param
- Usa `@Patch` para update y `@Put` para `cambiarEstado`
- Adjunto solo permite adjuntar en estados: `pendiente`, `rechazado`, `vencido`
- Tipos MIME permitidos: PDF, JPEG, PNG, WEBP, DOC, DOCX, XLS, XLSX

## Activos

Módulo CRUD para activos físicos de los centros de costos:
- **Schema:** `{ nombre, tipo_activo, centro_costo_id (FK), descripcion?, activo }`
- **Rutas:** `/empresas/:empresaId/centros/:centroId/activos`
- Soft delete NO implementado (hard delete)

## Mail

- **SMTP:** Gmail (host: smtp.gmail.com, port: 465, secure: true)
- **Credenciales:** `MAIL_USER` + `MAIL_PASS` (contraseña de app, no la de cuenta)
- **Templates:** `src/mail/templates/` (HTML para mantencion, solicitud, rechazo, noticia, usuario)
- Los errores de envío se loguean pero no bloquean la respuesta (async silencioso)

**Eventos que disparan email:**
| Evento | Destinatarios |
|--------|---------------|
| Nueva solicitud | admin_cliente + usuarios asignados al centro + super_admins |
| Rechazo solicitud | admin_cliente + usuarios asignados (⚠️ NO super_admins — inconsistencia con crear) |
| Nueva mantención | Usuarios del centro |
| Nueva noticia | Todos los usuarios activos |
| Nuevo usuario | El usuario creado (con su password temporal) |

## Scripts

```bash
node scripts/create-superadmin.js   # Crea super_admin en MongoDB (env: ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI)
node scripts/test-mail.js           # Verifica conexión SMTP y envía email de prueba
node scripts/seed-test-data.js      # Popula BD con datos de prueba
```

## Vercel vs EC2

El proyecto soporta ambos despliegues:

**Vercel:** usa `api/index.ts` como handler serverless. El handler bootstrapea NestJS lazy (isBootstrapped check) y maneja CORS manualmente.

**EC2:** usa `main.ts` directamente via PM2.

Diferencia importante: `api/index.ts` maneja CORS manualmente; `main.ts` usa `app.enableCors()` de NestJS. Ambos leen `CORS_ORIGIN` del env.

## Dependencias entre módulos

```
SolicitudesModule  → importa schemas de CentroCosto, Usuario, Permiso
DocumentosHelper   ← usado por ClientesModule, CentrosCostosModule, ProyectosModule
ProyectosModule    → registra CentroCostoSchema directamente (validación de pertenencia)
UsuariosModule     → importa PermisosModule
MantencionesModule → importa TiposMantencionModule + MailModule
NoticiasModule     → importa UsuarioSchema (para notificar a todos)
```

## Problemas de seguridad conocidos

| Severidad | Problema |
|-----------|----------|
| CRÍTICO | Cross-tenant data leak — centroId no valida contra empresaId del JWT en docs |
| ALTO | Sin rate limiting en `POST /auth/login` |
| MEDIO | JWT en localStorage del frontend (vulnerable a XSS) |
| MEDIO | Modo admin/consumidor manipulable desde DevTools |
| ⚠️ | `notificarRechazoSolicitud` no notifica a super_admins |

## Guía para el agente IA

1. **Agregar entidad nueva:** copiar estructura de `clientes/` exactamente. Registrar en `app.module.ts`. Usar `PartialType` en el UpdateDto.

2. **Múltiples controllers por módulo:** si la entidad necesita rutas admin (`/entidades`) y rutas nested (`/empresas/:id/entidades`), crear 2 controllers separados — ver patrón de `mantenciones/`.

3. **Archivos/uploads:** usar `storage: memoryStorage()` en el FileInterceptor del controller. El service guarda el `req.file.buffer` como Buffer en MongoDB.

4. **NO agregar `any`** — siempre tipar correctamente.

5. **NO re-registrar schemas** de otros módulos — importar el módulo que exporta el service. Excepción: `ProyectosModule` registra `CentroCostoSchema` directamente (único caso válido).

6. **Populate:** solo cuando el frontend necesita el objeto completo. Siempre `.lean()` después.
