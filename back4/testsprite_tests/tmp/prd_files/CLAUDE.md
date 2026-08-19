# portal-clientes-api — Backend NestJS

API REST del Portal de Clientes ECLARITI. NestJS 10 + Mongoose 8 + MongoDB Atlas + Amazon S3.
Prefijo global: `/api/v1`.

## Comandos

```bash
npm run start:dev      # Desarrollo con hot-reload → http://localhost:3000/api/v1
npm run build          # nest build → dist/
npm run start:prod     # node dist/main
# OJO: preview:mails y test:mails apuntan a scripts inexistentes (ver tofix.md)
```

## Variables de entorno (.env)

Ver `.env.example`. Resumen:

```
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/portal_clientes
JWT_SECRET=<mínimo 64 chars — openssl rand -hex 64>
PORT=3000
CORS_ORIGIN=http://localhost:4200        # varias URLs separadas por coma
NODE_ENV=development
MAIL_USER=<cuenta gmail>
MAIL_PASS=<contraseña de app gmail, NO la de la cuenta>
PORTAL_URL=http://localhost:4200         # links en emails
AWS_REGION=us-east-2
S3_BUCKET_NAME=sc-portal-clientes-archivos-390866253693-us-east-2-an
AWS_ACCESS_KEY_ID=<access key IAM con permisos sobre el bucket>
AWS_SECRET_ACCESS_KEY=<secret key correspondiente>
```

> NUNCA commitear `.env`. Sin fallbacks de secretos en código fuente.

## Almacenamiento de archivos (S3)

Los documentos (clientes, centros, activos, proyectos, actividades y adjuntos de
solicitudes) se suben a S3. Mongo guarda solo metadata + `s3_key` en las colecciones
`doc_cliente`, `doc_centro_costo`, `doc_proyecto`, `doc_activo`, `doc_actividad`.

- **Keys:** `documentos/{origenTipo}/{entidadId}/{timestamp}_{rand}_{nombre}` con
  `origenTipo ∈ empresa | centro | activo | proyecto | actividad`. Adjuntos de
  solicitudes: `solicitudes/{solicitudId}/{timestamp}_{rand}_{nombre}`.
- **Excepciones (siguen como Buffer en Mongo):** `clientes.logo` y `noticias.imagen_data`.
- **Documentos legacy:** los subidos antes de la migración conservan `contenido: Buffer`
  y no tienen `s3_key`. `DocumentosHelper.servir()` sirve desde S3 si hay `s3_key`, si no
  desde el Buffer. No hay migración automática.
- **Borrado/vencimiento:** al mover a papelera (`doc_eliminados`) o marcar vencido
  (`documentos_vencidos`) solo se copia la referencia `s3_key` — el objeto en S3 no se
  duplica ni se borra (no hay purga de huérfanos, ver `tofix.md`).
- **Subida:** `OPCIONES_SUBIDA` (`common/constants/upload.constants.ts`) =
  `memoryStorage()` + límite 20MB. Si falla el guardado de metadata, el helper hace
  rollback del objeto en S3.

## Base de datos

- **Motor:** MongoDB Atlas (producción) / local (desarrollo)
- **Timestamps:** todos los schemas usan `{ createdAt: 'creado_en', updatedAt: 'actualizado_en' }` (colecciones `doc_*` y `permisos` solo `creado_en`)
- **Colecciones:** `clientes`, `centros_costos`, `proyectos`, `solicitudes`, `actividades`,
  `tipos_actividad`, `activos`, `tipos_activo`, `tipos_proyecto`, `noticias`, `usuarios`,
  `permisos`, `documentos_vencidos`, `doc_cliente`, `doc_centro_costo`, `doc_proyecto`,
  `doc_activo`, `doc_actividad`, `doc_eliminados`

## Estructura de carpetas

```
src/
├── main.ts                    # Bootstrap: prefijo /api/v1, ValidationPipe global, CORS
├── app.module.ts              # Registro de módulos + APP_GUARD globales
├── common/
│   ├── guards/guards.ts       # JwtAuthGuard, RolesGuard, PermisosGuard, EmpresaAccessGuard
│   ├── helpers/               # documentos.helper, notificar-documento.helper, send-file.helper
│   ├── s3/                    # S3Module + S3Service (subir/descargar/eliminar)
│   ├── constants/             # upload.constants.ts (OPCIONES_SUBIDA, 20MB)
│   ├── dto/                   # notificacion-opciones.dto.ts
│   └── schemas/               # doc-eliminado.schema.ts (papelera)
├── auth/                      # POST /auth/login (@Public), JWT 8h
├── clientes/                  # Empresas (rutas /clientes y alias /empresas)
├── usuarios/
├── permisos/
├── centros-costos/            # Controllers nested (/empresas/:id/centros) + admin
├── proyectos/                 # Controllers nested + admin + empresa-wide
├── solicitudes/
├── actividades/               # Controllers nested + empresa-wide + admin
├── tipos-actividad/
├── activos/                   # Activos físicos por centro
├── tipos-activo/
├── tipos-proyecto/            # CRUD normal. Se siembra el catálogo oficial (A–K, en
│                              #   tipos-proyecto.catalogo.ts) solo si la colección está vacía
│                              #   (primer arranque) — después se administra libre desde la UI
├── noticias/
├── documentos-vencidos/       # GET/gestión de documentos marcados vencidos
└── mail/                      # SMTP Gmail + templates TS en src/mail/templates/
```

## Autenticación y guards

- **JWT payload:** `{ sub: usuario_id, email, rol, cliente_id }` · expira en 8h · bcrypt SALT_ROUNDS=10
- **Roles:** `super_admin`, `admin_smartclarity`, `usuario`
- **Login:** `POST /api/v1/auth/login` (@Public)

Guards globales (`app.module.ts` vía `APP_GUARD`): `JwtAuthGuard` → `RolesGuard` → `PermisosGuard`.

```typescript
@Public()                                  // Exenta de JWT
@Roles('super_admin', 'admin_smartclarity') // Filtra por rol
@RequierePermiso('ver' | 'editar')          // Filtra por permiso_acceso
@UseGuards(EmpresaAccessGuard)              // user.cliente_id === :empresaId del route param
                                            // (super_admin y admin_smartclarity pasan siempre)
```

`admin_smartclarity` tiene restricciones aplicadas en controllers: solo puede crear/asignar
usuarios con rol `usuario`.

## Patrón de módulo

Cada módulo tiene 5 archivos base:

```
<nombre>/
├── <nombre>.schema.ts     ← @Schema + @Prop + SchemaFactory + índices (siempre indexar FKs)
├── <nombre>.dto.ts        ← CreateDto + UpdateDto (PartialType) + class-validator
├── <nombre>.service.ts    ← Lógica de negocio, NotFoundException, .lean()
├── <nombre>.controller.ts ← @Controller, verbos HTTP, guards de ruta
└── <nombre>.module.ts     ← MongooseModule.forFeature, exports: [Service]
```

Módulos con múltiples controllers por contexto de acceso (nested vs admin):
`centros-costos`, `proyectos`, `actividades`, `activos`.

### Reglas clave

- **Siempre `.lean()`** en queries de lectura → POJOs, no documentos Mongoose.
- **`NotFoundException`** cuando `findById` retorna `null`; **`ConflictException`** para duplicados.
- **`runValidators: true`** en `findByIdAndUpdate`.
- **Siempre `PartialType`** para el UpdateDto; `@IsMongoId()` para ObjectIds.
- `class-validator` global con `whitelist + forbidNonWhitelisted + transform`.
- Query params llegan como `string`; convertir con `+page`, `+limit`.
- **Verbo `@Put`** para actualizar (excepto solicitudes que usa `@Patch` y `@Put` para `cambiarEstado`).
- **Tokens de Mongoose siempre string** (`'Cliente'`, `'CentroCosto'`), nunca la clase.
- **NO re-registrar schemas de otros módulos** — importar el módulo que exporta el service.
  Excepción tolerada: registrar un schema directo cuando solo se necesita el model para
  validación (ej. `ProyectosModule` registra `CentroCostoSchema`).
- **Sin `any`** en código de producción.

## Respuestas: paginado vs array plano

| Módulo | Respuesta |
|--------|-----------|
| clientes, centros-costos, proyectos, usuarios | `{ data, total, page, pages }` |
| solicitudes, actividades, tipos-*, activos, permisos, noticias | array plano |

## Soft delete vs hard delete

| Módulo | Estrategia |
|--------|-----------|
| clientes, centros-costos, usuarios | Soft delete (`activo: false`) |
| proyectos | Soft delete (`estado: 'cerrado'`) |
| solicitudes, actividades, tipos-*, activos, noticias | Hard delete |
| documentos (doc_*) | Papelera: se mueven a `doc_eliminados` con su `s3_key` |

## Solicitudes — diferencias intencionales

- FK de cliente se llama **`empresa_id`** (no `cliente_id`); viene del route param
  `/empresas/:empresaId/solicitudes` (en el DTO es `@IsOptional()`, el service lo inyecta).
- Estados: `pendiente → revision → aprobado | rechazado` (enum del schema).
- Adjuntar archivo solo en estados `pendiente` y `rechazado`. El adjunto se sube a S3.
- MIME permitidos: PDF, JPEG, PNG, WEBP, DOC, DOCX, XLS, XLSX.

## Mail

- **SMTP:** Gmail (smtp.gmail.com:465, secure) con `MAIL_USER` + `MAIL_PASS` (contraseña de app).
- **Templates TS** en `src/mail/templates/`: nueva-actividad, nueva-noticia, nueva-solicitud,
  nuevo-documento, nuevo-usuario, solicitud-rechazada, solicitud-completada, documento-vencido,
  proyecto-por-vencer, proyecto-cerrado (+ html-escape, logo, jerarquia).
- **`jerarquia.ts`:** todo correo con contexto de empresa/centro/proyecto recibe un
  `jerarquia: ContextoJerarquico` (`{ empresa, centro?, proyecto? }`) en vez de un string
  plano — `tituloJerarquia()` arma la etiqueta principal (la entidad más específica) y
  `breadcrumbJerarquiaHtml()` agrega debajo la ruta completa (`Empresa → Centro → Proyecto`).
- Envíos fire-and-forget: errores se loguean, no bloquean la respuesta HTTP.
- Varias notificaciones aceptan `NotificacionOpcionesDto` desde el frontend
  (ej. `notificar_super_admins`) para decidir destinatarios; siempre se deduplica por email.

| Evento | Destinatarios |
|--------|---------------|
| Nueva solicitud / rechazo / completada | Usuarios de la empresa (admin o asignados al centro) + super_admins según opciones |
| Nueva actividad | Usuarios del centro |
| Documento subido / vencido | Admins según opciones del helper `notificar-documento` |
| Proyecto próximo a vencer | Admins con la empresa o el proyecto en sus suscripciones puntuales (el toggle `notificar_todas_empresas` NO aplica a recordatorios), según `Proyecto.dias_recordatorio` vs días restantes a `fecha_fin` |
| Proyecto cerrado | Admins suscritos al proyecto/empresa (mismo criterio que "Documento subido"; aquí el toggle global sí aplica) |
| Actividad próxima | Admins con la empresa o el centro en sus suscripciones puntuales (el toggle global NO aplica a recordatorios), según `Actividad.dias_recordatorio` vs días restantes a `fecha` |
| Nueva noticia | Todos los usuarios activos (sin filtro de empresa — ver tofix.md) |
| Nuevo usuario | El usuario creado (password temporal) |

## Tareas programadas

Dos disparadores para la misma lógica, según el despliegue:

- **Vercel (serverless):** no hay proceso persistente, así que `src/tareas/` expone
  endpoints `@Public()` protegidos por `Authorization: Bearer <CRON_SECRET>`,
  disparados por **Vercel Cron Jobs** (`vercel.json` → `crons`).
- **EC2/Railway (proceso persistente):** `TareasService` (`@nestjs/schedule`) corre
  ambos recordatorios **cada hora en punto**, solo si `CRON_INTERNO=true` en el `.env`
  (así una entidad creada hoy que ya cruzó un umbral se avisa el mismo día, y el
  auto-cierre ocurre en la primera corrida tras la medianoche chilena).
  Habilitarlo en **una sola instancia** (con PM2 cluster o réplicas se duplicarían
  los envíos) y dejarlo apagado en Vercel. Los endpoints HTTP siguen disponibles
  para pruebas manuales.

Qué hace cada tarea:

- `POST /tareas/recordatorios-proyectos` → `ProyectosService.enviarRecordatoriosVencimiento()`.
  Recorre proyectos no cerrados/cancelados con `fecha_fin`, calcula días restantes contra
  la fecha actual **de Chile** (`hoyUtcChile()` — con fecha UTC a secas, una corrida entre
  ~21:00 y medianoche de Chile adelantaría los avisos un día) y notifica a los admins
  suscritos según `Proyecto.dias_recordatorio` (subconjunto de `[30, 15, 7, 3, 1, 0]`;
  0 = el día de término; se configura al crear/editar el proyecto).
- `POST /tareas/recordatorios-actividades` → `ActividadesService.enviarRecordatoriosVencimiento()`.
  Mismo patrón sobre `Actividad.fecha` (sin filtro de estado, las actividades no tienen uno),
  scope de suscripción por `empresas_suscritas`/`centros_suscritos` (no hay array puntual por
  actividad) y `Actividad.dias_recordatorio` (0 = el día de la actividad; se configura en el
  paso Notificaciones del wizard).

**Idempotencia y catch-up:** cada entidad guarda `ultimo_recordatorio_dias` (el umbral
ya notificado). En cada corrida se toma el umbral marcado más cercano ya cruzado
(`min(dias_recordatorio ≥ días restantes)`) y se avisa solo si difiere del guardado:
las corridas horarias no reenvían, y si el proceso estuvo caído un día marcado
el aviso se recupera en la siguiente corrida. El auto-cierre de proyectos vencidos ya
era idempotente (el estado pasa a `cerrado` y la query lo excluye).

**Destinatarios de recordatorios:** SOLO admins con la empresa/centro/proyecto en sus
listas puntuales (`empresas_suscritas`/`centros_suscritos`/`proyectos_suscritos`).
El toggle `notificar_todas_empresas` (default `true`) NO cuenta para recordatorios —
si contara, todo admin sin configurar recibiría todos los avisos. Sí sigue contando
para notificaciones de eventos (documentos, cierre de proyecto, solicitudes).

## Scripts

```bash
node scripts/create-superadmin.js    # Crea super_admin (env: ADMIN_EMAIL, ADMIN_PASSWORD, MONGODB_URI)
node scripts/test-mail.js            # Verifica SMTP
node scripts/seed-test-data.js       # Datos de prueba
node scripts/seed-demo-data.js       # Datos de demo
node scripts/migrate-tipos-activo.js # Migración puntual de tipos de activo
node scripts/migrate-dias-recordatorio.js # Puntual: dias_recordatorio default en proyectos/actividades existentes (correr justo DESPUÉS de desplegar el cambio)
npx tsx scripts/test-s3.ts           # Verifica credenciales/bucket S3
npm run test:recordatorios           # Prueba e2e de los crons de recordatorio (DB temporal, sin enviar correos)
```

## Vercel vs EC2

- **Vercel:** handler serverless `api/index.ts` (bootstrap lazy + CORS manual). Configurado en `vercel.json`.
- **EC2:** `main.ts` directo vía PM2 (`app.enableCors()` de NestJS).
- Ambos leen `CORS_ORIGIN` del env. Ver `../DEPLOY.md`.

## Guía para el agente IA

1. **Entidad nueva:** copiar estructura de `clientes/`. Registrar en `app.module.ts`. `PartialType` en UpdateDto.
2. **Rutas admin + nested:** crear controllers separados en el mismo módulo — ver `actividades/`.
3. **Campo nuevo en schema:** actualizar schema → DTO → service si necesita conversión (string → ObjectId). Evaluar índice.
4. **Archivos/uploads:** `FileInterceptor('archivo', OPCIONES_SUBIDA)` en el controller; el service delega en `DocumentosHelper` (S3 + colección `doc_*`).
5. **Populate:** solo cuando el frontend necesita el objeto completo (hoy: actividades popula `tipo_id`/`activo_ids`; permisos popula centro y usuario). Siempre `.lean()` después.
6. **Problemas pendientes:** revisar `tofix.md` antes de tocar seguridad/documentos.
