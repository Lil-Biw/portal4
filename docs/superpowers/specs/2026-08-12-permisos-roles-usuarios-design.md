# Permisos granulares por usuario + Roles (presets)

**Fecha:** 2026-08-12
**Estado:** Implementado (modelo de datos + UI + enforcement en backend, ver
adenda al final del documento — el enforcement se agregó el mismo día, más
tarde de lo que dice la sección "Fuera de alcance" más abajo).

## Contexto

Hoy `Usuarios` tiene un módulo `permisos` (colección `permisos`) que asigna acceso `ver`/`editar`
**por centro de costo**, para acotar qué centros ve cada usuario. Es un control de *alcance de
datos*, no de *acciones*.

Se pidió un sistema nuevo y distinto: permisos de **acción por módulo** (crear/editar/eliminar
actividad, subir documento, etc.), con un modal por usuario (mockup ya validado visualmente:
https://claude.ai/code/artifact/afce0d5f-2b46-4da0-90b3-f796e19e4dd9) y un sistema de **roles**
como plantillas de esos permisos, editable solo por `super_admin`.

## Decisiones (confirmadas con el usuario)

1. **Coexistencia**: el módulo `permisos` actual (acceso por centro de costo) no se toca. El
   nuevo sistema de permisos de acción es independiente.
2. **Almacenamiento**: los permisos de acción se guardan como campo `permisos` directo en el
   documento `Usuario` (no colección aparte).
3. **Roles = presets, no reemplazo del campo `rol`**: el enum `rol` (`super_admin` /
   `admin_smartclarity` / `usuario`) sigue existiendo tal cual, controla login/guards/modo
   admin-consumidor. Los roles nuevos (`Administrador`, `Usuario`, `Usuario auditor`, ...) son
   solo plantillas que rellenan el objeto `permisos` de un usuario — no hay vínculo vivo ni se
   guarda qué rol se aplicó.

## Fuera de alcance (explícito, ver adenda — esto ya NO aplica)

- ~~**No se conecta el enforcement** de estos permisos a los guards de los demás módulos
  (actividades, documentos, centros, etc.). Esta entrega es modelo de datos + UI de gestión
  únicamente. Cablear cada endpoint de la app a estos permisos es una iniciativa aparte,
  significativamente más grande (toca todos los controllers).~~ **Implementado el mismo día
  (adenda más abajo)**: se agregó `PermisoAccionGuard` + `@RequiereAccion()` y se cableó en
  todos los controllers relevantes.
- No se reemplaza `RolesGuard`/`PermisosGuard` existentes ni el enum `rol` — esto sigue vigente,
  `rol` sigue controlando login/modo admin-consumidor y `super_admin` sigue con bypass total.
- `@RequierePermiso`/`permiso_acceso` no se usan en ningún guard activo hoy (verificado por
  grep) — se puede dejar de editar sin riesgo de romper autorización. (Esto sigue sin cambios;
  es un sistema distinto al de esta adenda.)

## Adenda 2026-08-12 (tarde) — Enforcement real

Se detectó en uso real que sacarle permisos a un `admin_smartclarity` desde el modal no
bloqueaba nada (seguía pudiendo crear/editar/eliminar igual, porque `@Roles()` seguía siendo
lo único que gateaba cada endpoint). Se decidió, con el usuario, conectar el catálogo de
verdad:

- **Semántica:** para cada acción del catálogo (`PERM_SCHEMA`), `permisos.<seccion>.<accion>`
  pasa a ser la única fuente de verdad — reemplaza al `@Roles()` que tenía antes ese endpoint
  puntual, para **los tres roles por igual** (incluyendo `usuario`: si se le otorga
  `actividades.crear`, puede crear actividades aunque su rol antes no se lo permitiera).
  `super_admin` sigue con bypass total incondicional (mismo criterio que el resto de los guards).
- **Guard nuevo:** `PermisoAccionGuard` + decorador `@RequiereAccion(seccion, accion)` en
  `common/guards/guards.ts`, registrado como `APP_GUARD` global en `app.module.ts` (después de
  `RolesGuard`/`PermisosGuard`). Si el endpoint no tiene `@RequiereAccion()`, no hace nada (ese
  endpoint se sigue rigiendo solo por `@Roles()`, sin cambios).
- **Qué se convirtió:** los endpoints de crear/editar/eliminar/subir/vencer/editarCategoria de
  `empresas`+`docEmpresa`, `centros`+`docCentro`, `proyectos`+`docProyecto`,
  `actividades`+`docActividad`, `activos`+`docActivo`, `catalogos` (tipos-actividad/activo/
  proyecto), `solicitudes` (crear/cambiarEstado/eliminar), `usuarios` (crear/editar/eliminar) y
  `noticias`. Los endpoints de solo lectura (`GET`) no se tocaron — el catálogo no modela "ver".
- **Caso especial `usuarios.crearAdmin`:** `UsuariosController.create()`/`update()` ya no
  hardcodean "si sos `admin_smartclarity`, forzar rol a 'usuario'" — ahora chequean
  `permisos.usuarios.crearAdmin === true` (el guard deja `req.user.permisos` cacheado tras
  resolverlo, para no repetir la consulta a Mongo).
- **Migración de cuentas existentes:** `back4/scripts/migrate-backfill-permisos-existentes.js`
  — rellena `permisos` para cuentas `admin_smartclarity`/`usuario` que nunca pasaron por el
  modal (campo vacío), con el equivalente EXACTO de lo que su rol permitía antes del guard
  nuevo (no el preset "Administrador" completo, que les daría más de lo que tenían). Sin este
  backfill, cualquier cuenta sin `permisos` configurado quedaba bloqueada de golpe en todo.
  Ya se corrió una vez contra la base real (`test`) el 2026-08-12.
- **Test de regresión:** `back4/scripts/test-permisos-seguridad.ts` (sección 7) cubre: acción
  bloqueada por permiso en false, acción de `usuario` habilitada por permiso pese al rol,
  default-deny para cuentas sin permisos configurados.

## Modelo de datos

### `PERM_SCHEMA` (catálogo de permisos, vive en frontend)

Constante compartida `front4/src/app/shared/models/permisos.model.ts`, portada 1:1 desde el
mockup — 14 secciones (`empresas`, `docEmpresa`, `centros`, `docCentro`, `proyectos`,
`docProyecto`, `actividades`, `docActividad`, `activos`, `docActivo`, `catalogos`,
`solicitudes`, `usuarios`, `noticias`), cada una con filas `{ key, label, hint?, soloAdmin? }`.
Secciones con `soloInterno: true` y filas con `soloAdmin: true` no aplican a usuarios con
`rol === 'usuario'` (cliente) — se ocultan/deshabilitan en el modal, igual que en el mockup.

El backend **no** valida el catálogo campo por campo (evita duplicar el catálogo en dos
lenguajes); solo valida que `permisos` sea un objeto.

```ts
export interface PermisoRow { key: string; label: string; hint?: string; soloAdmin?: boolean; }
export interface PermisoSeccion { key: string; titulo: string; soloInterno?: boolean; rows: PermisoRow[]; }
export type PermisosUsuario = Record<string, Record<string, boolean>>;
export interface Rol { _id: string; nombre: string; permisos: PermisosUsuario; }
```

### `Usuario` (back4/src/usuarios/usuarios.schema.ts)

```ts
@Prop({ type: SchemaTypes.Mixed, default: {} }) permisos: Record<string, Record<string, boolean>>;
```

### `Roles` (colección nueva `roles`, back4/src/roles/)

Módulo estándar de 5 archivos, siguiendo el patrón de `clientes/`:

```ts
@Schema({ collection: 'roles', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Rol {
  @Prop({ required: true, trim: true, unique: true }) nombre: string;
  @Prop({ type: SchemaTypes.Mixed, default: {} }) permisos: Record<string, Record<string, boolean>>;
}
```

`CreateRolDto` / `UpdateRolDto` (`PartialType`): `@IsString() @MinLength(2) nombre`,
`@IsObject() permisos`.

## Endpoints nuevos

| Método | Ruta | Guard |
|---|---|---|
| `PATCH` | `/usuarios/:id/permisos` | `@Roles('super_admin','admin_smartclarity')` — mismo criterio que `update` |
| `GET` | `/roles` | `@Roles('super_admin','admin_smartclarity')` — lo necesita el modal de permisos para el selector "Aplicar rol" |
| `POST` | `/roles` | `@Roles('super_admin')` |
| `PUT` | `/roles/:id` | `@Roles('super_admin')` |
| `DELETE` | `/roles/:id` | `@Roles('super_admin')` |

`PATCH /usuarios/:id/permisos` body: `{ permisos: Record<string, Record<string, boolean>> }`,
DTO con `@IsObject() permisos`. Sigue el patrón de `actualizarSuscripciones` (mismo verbo PATCH,
mismo estilo de sub-recurso).

## Frontend

### Componentes nuevos

- **`shared/components/permisos-panel/`** (dumb): renderiza secciones + switches a partir de
  `PERM_SCHEMA` + un objeto de valores + un predicado opcional de "aplica" (para deshabilitar
  filas soloInterno/soloAdmin). `@Input schema`, `@Input valores`, `@Input aplicaFn?`,
  `@Output valoresChange`. Reutilizado por los dos modales de abajo — evita duplicar el render
  de switches.
- **`features/usuarios/components/permisos-modal/`**: modal por usuario, recreación fiel del
  mockup (header avatar + nombre + chip de rol + cerrar; body = `permisos-panel`; footer con
  contador "X/Y permisos activos" + Cancelar/Guardar). Incluye selector **"Aplicar rol"** que
  rellena los switches en memoria con el preset elegido (no autoguarda). `aplicaFn` deshabilita
  filas `soloInterno`/`soloAdmin` cuando el usuario objetivo tiene `rol === 'usuario'`.
- **`features/usuarios/components/roles-modal/`** (solo super_admin): lista de roles + crear/
  editar/eliminar. Editar un rol reutiliza `permisos-panel` sin restricciones de sección (un rol
  es una plantilla abstracta).

### Servicios

- `UsuariosService`: nuevo método `actualizarPermisos(id, permisos: PermisosUsuario)` → `PATCH
  /usuarios/:id/permisos`, mismo patrón que `actualizarSuscripciones`.
- `RolesService` nuevo (`features/usuarios/roles.service.ts`): patrón estándar de feature
  service — signals `roles/status/loading` + `cargar/crear/actualizar/eliminar`.

### Wiring

- `usuarios-list.component.html`: botón "Permisos" entre Editar y Eliminar, mismo criterio de
  visibilidad que Editar (`esAdmin(u)`), emite `permisos.emit(u)`.
- `usuarios-page.component.ts`: nuevo `ModalMode` `'permisos'` y `'roles'`. `abrirPermisos(u)` /
  `guardarPermisos(permisos)` siguiendo el patrón de `abrirSuscripciones`/`guardarSuscripciones`.
  Botón "Roles" en `header-actions`, `*ngIf="esSuperAdmin()"`, abre `modal='roles'`.
- `usuario-form.component.html`: se elimina el bloque `<label class="field" *ngIf="isEdit">
  Permiso por defecto ...</label>` (líneas 29-35 actuales). El campo `permiso_acceso` se
  mantiene en el modelo/DTO (se sigue seteando automático al crear, en `usuarios.service.ts`),
  solo deja de ser editable desde este form.

## Seed

`back4/scripts/seed-roles.js` (mismo patrón que los demás scripts en `back4/scripts/`): crea dos
roles base al iniciar —
- **"Administrador"**: todas las claves del `PERM_SCHEMA` en `true`.
- **"Usuario"**: todas las claves en `false`.

Roles como "Usuario auditor"/"Usuario administrador" (mencionados como ejemplo) no se
precargan — se crean desde la UI de Roles.

## Comportamiento notable

- Aplicar un rol en el modal de permisos es una plantilla de un solo uso: copia valores al
  momento de elegirlo, no queda vínculo vivo. Editar el rol después no afecta retroactivamente
  a usuarios que ya lo aplicaron.
- No se persiste qué rol se aplicó a un usuario — solo el objeto `permisos` resultante.
