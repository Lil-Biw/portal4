# Permisos granulares por usuario + Roles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Permisos" button (usuarios-list) that opens a granular per-user action-permissions modal matching the approved mockup, remove the "Permiso por defecto" field from the user edit form, and add a super_admin-only "Roles" screen for managing permission presets.

**Architecture:** Backend gets a new `permisos: Mixed` field on `Usuario` plus a `PATCH /usuarios/:id/permisos` endpoint, and a new standalone `roles` CRUD module (5-file Nest pattern) whose documents are permission-object presets. Frontend gets a shared `PERM_SCHEMA` catalog + pure helper functions, a reusable `PermisosPanelComponent` (switches UI), and two feature components (`PermisosFormComponent`, `RolesManagerComponent`) wired into the existing `usuarios-page` modal shell.

**Tech Stack:** NestJS 10 + Mongoose 8 (back4), Angular 21 standalone + signals (front4), Vitest for frontend specs, ad-hoc `ts-node` integration scripts for backend verification (back4 has no jest/vitest).

**Spec:** `docs/superpowers/specs/2026-08-12-permisos-roles-usuarios-design.md`

## Global Constraints

- Coexistence: the existing `permisos` module/collection (ver/editar access per centro de costo) is untouched. This is a separate, new system.
- Storage: permisos live as a `permisos: Record<string, Record<string, boolean>>` field directly on `Usuario` — no separate collection for per-user permissions.
- Roles are presets only: applying a role copies its `permisos` object into the user's editor state at that moment (no live reference is stored); the `rol` enum field (`super_admin`/`admin_smartclarity`/`usuario`) is untouched.
- Out of scope: no enforcement of these granular permissions in any other module's guards/controllers. This plan delivers data model + management UI only.
- Backend has no unit-test framework (no jest/vitest configured). Verification follows the existing convention: ad-hoc `ts-node` scripts in `back4/scripts/test-*.ts` that spin up `NestFactory.createApplicationContext`, run against a temporary Mongo database (dropped at the end), and `process.exit(1)` on any failed check.
- Frontend has Vitest configured (`ng test`). New components get real specs using `TestBed` + `componentRef.setInput`, mirroring `front4/src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.spec.ts`.
- New frontend files use Angular's `@for`/`@if` control-flow syntax (not `*ngFor`/`*ngIf`). `usuarios-page.component.html` is an existing file that already uses `*ngIf`/`*ngFor` throughout — new blocks added to that specific file keep using `*ngIf` for internal consistency (per front4 CLAUDE.md: don't mix syntaxes within one file).
- All new/modified TypeScript avoids `any`.
- `PERM_SCHEMA` has 14 sections / 43 total rows. With `contextoCompleto = false` (target user `rol === 'usuario'`), 3 sections (`empresas`, `catalogos`, `noticias` — 8 rows) plus 1 row (`usuarios.crearAdmin`) are excluded, leaving 34 applicable rows. These numbers (43 / 34 / 9 excluded) are asserted directly in specs — if `PERM_SCHEMA` changes later, those specs must be updated too.

---

### Task 1: Roles backend module (schema/dto/service/controller/module)

**Files:**
- Create: `back4/src/roles/roles.schema.ts`
- Create: `back4/src/roles/roles.dto.ts`
- Create: `back4/src/roles/roles.service.ts`
- Create: `back4/src/roles/roles.controller.ts`
- Create: `back4/src/roles/roles.module.ts`
- Modify: `back4/src/app.module.ts`

**Interfaces:**
- Produces: `RolesService` with `create(dto: CreateRolDto)`, `findAll()`, `findOne(id: string)`, `update(id: string, dto: UpdateRolDto)`, `remove(id: string)`. Mongoose model token: `'Rol'`.
- Produces: HTTP surface `GET/POST /roles`, `PUT/DELETE /roles/:id`.
- Consumed by: Task 3 (integration test script), and indirectly by the frontend `RolesService` (Task 6).

- [ ] **Step 1: Create the schema**

`back4/src/roles/roles.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes } from 'mongoose';

export type RolDocument = Rol & Document;

@Schema({ collection: 'roles', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class Rol {
  @Prop({ required: true, trim: true, unique: true }) nombre: string;
  @Prop({ type: SchemaTypes.Mixed, default: {} }) permisos: Record<string, Record<string, boolean>>;
}

export const RolSchema = SchemaFactory.createForClass(Rol);
```

- [ ] **Step 2: Create the DTOs**

`back4/src/roles/roles.dto.ts`:

```ts
import { IsString, MinLength, IsObject } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateRolDto {
  @IsString() @MinLength(2) nombre: string;
  @IsObject() permisos: Record<string, Record<string, boolean>>;
}

export class UpdateRolDto extends PartialType(CreateRolDto) {}
```

- [ ] **Step 3: Create the service**

`back4/src/roles/roles.service.ts`:

```ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RolDocument } from './roles.schema';
import { CreateRolDto, UpdateRolDto } from './roles.dto';

@Injectable()
export class RolesService {
  constructor(@InjectModel('Rol') private rolModel: Model<RolDocument>) {}

  async create(dto: CreateRolDto) {
    const existe = await this.rolModel.findOne({ nombre: dto.nombre });
    if (existe) throw new ConflictException(`Ya existe un rol llamado "${dto.nombre}"`);
    return this.rolModel.create(dto);
  }

  async findAll() {
    return this.rolModel.find().sort({ nombre: 1 }).lean();
  }

  async findOne(id: string) {
    const rol = await this.rolModel.findById(id).lean();
    if (!rol) throw new NotFoundException(`Rol ${id} no encontrado`);
    return rol;
  }

  async update(id: string, dto: UpdateRolDto) {
    const rol = await this.rolModel
      .findByIdAndUpdate(id, dto, { new: true, runValidators: true })
      .lean();
    if (!rol) throw new NotFoundException(`Rol ${id} no encontrado`);
    return rol;
  }

  async remove(id: string) {
    const rol = await this.rolModel.findByIdAndDelete(id).lean();
    if (!rol) throw new NotFoundException(`Rol ${id} no encontrado`);
    return { message: 'Rol eliminado', id };
  }
}
```

- [ ] **Step 4: Create the controller**

`back4/src/roles/roles.controller.ts`:

```ts
import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRolDto, UpdateRolDto } from './roles.dto';
import { Roles } from '../common/guards/guards';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Roles('super_admin', 'admin_smartclarity')
  findAll() {
    return this.rolesService.findAll();
  }

  @Post()
  @Roles('super_admin')
  create(@Body() dto: CreateRolDto) {
    return this.rolesService.create(dto);
  }

  @Put(':id')
  @Roles('super_admin')
  update(@Param('id') id: string, @Body() dto: UpdateRolDto) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin')
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
```

- [ ] **Step 5: Create the module**

`back4/src/roles/roles.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolSchema } from './roles.schema';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Rol', schema: RolSchema }])],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}
```

- [ ] **Step 6: Register the module in `app.module.ts`**

In `back4/src/app.module.ts`, add the import and register it in the `imports` array (near `PermisosModule`):

```ts
import { RolesModule } from './roles/roles.module';
```

```ts
    PermisosModule,
    RolesModule,
```

- [ ] **Step 7: Verify it compiles**

Run: `cd back4 && npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add back4/src/roles back4/src/app.module.ts
git commit -m "feat(back4): módulo roles (presets de permisos)"
```

---

### Task 2: `permisos` field on Usuario + PATCH endpoint

**Files:**
- Modify: `back4/src/usuarios/usuarios.schema.ts`
- Modify: `back4/src/usuarios/usuarios.dto.ts`
- Modify: `back4/src/usuarios/usuarios.service.ts`
- Modify: `back4/src/usuarios/usuarios.controller.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (independent field on a different collection).
- Produces: `UsuariosService.actualizarPermisos(id: string, dto: ActualizarPermisosDto): Promise<UsuarioDocument>` and `PATCH /usuarios/:id/permisos` (guard: `@Roles('super_admin', 'admin_smartclarity')`, same as `PUT /usuarios/:id`).
- Consumed by: Task 3 (integration test script), frontend `UsuariosService.actualizarPermisos` (Task 6).

- [ ] **Step 1: Add the `permisos` field to the schema**

In `back4/src/usuarios/usuarios.schema.ts`, add this line right after `centros_asignados`:

```ts
  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'CentroCosto' }], default: [] }) centros_asignados: Types.ObjectId[];
  @Prop({ type: SchemaTypes.Mixed, default: {} }) permisos: Record<string, Record<string, boolean>>;
```

- [ ] **Step 2: Add `ActualizarPermisosDto`**

In `back4/src/usuarios/usuarios.dto.ts`, add `IsObject` to the existing `class-validator` import line:

```ts
import {
  IsString, IsEmail, IsOptional, IsBoolean,
  IsEnum, IsMongoId, IsArray, MinLength, IsObject,
} from 'class-validator';
```

Append this new class at the end of the file:

```ts
export class ActualizarPermisosDto {
  @IsObject() permisos: Record<string, Record<string, boolean>>;
}
```

- [ ] **Step 3: Add `actualizarPermisos` to the service**

In `back4/src/usuarios/usuarios.dto.ts` import line inside `usuarios.service.ts`, add `ActualizarPermisosDto`:

```ts
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  CambiarPasswordDto,
  SuscripcionesDto,
  ActualizarPermisosDto,
} from './usuarios.dto';
```

Add this method to `UsuariosService` (near `actualizarSuscripciones`):

```ts
  async actualizarPermisos(id: string, dto: ActualizarPermisosDto) {
    const usuario = await this.usuarioModel
      .findByIdAndUpdate(id, { permisos: dto.permisos }, { new: true, runValidators: true })
      .lean();
    if (!usuario) throw new NotFoundException(`Usuario ${id} no encontrado`);
    return usuario;
  }
```

- [ ] **Step 4: Add the controller endpoint**

In `back4/src/usuarios/usuarios.controller.ts`, add `ActualizarPermisosDto` to the DTO import:

```ts
import {
  CreateUsuarioDto,
  UpdateUsuarioDto,
  CambiarPasswordDto,
  SuscripcionesDto,
  ActualizarPermisosDto,
} from './usuarios.dto';
```

Add this method (near `actualizarSuscripciones`):

```ts
  @Patch(':id/permisos')
  @Roles('super_admin', 'admin_smartclarity')
  actualizarPermisos(@Param('id') id: string, @Body() dto: ActualizarPermisosDto) {
    return this.usuariosService.actualizarPermisos(id, dto);
  }
```

- [ ] **Step 5: Verify it compiles**

Run: `cd back4 && npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add back4/src/usuarios
git commit -m "feat(back4): campo permisos en Usuario + PATCH /usuarios/:id/permisos"
```

---

### Task 3: Backend integration test script + seed script

**Files:**
- Create: `back4/scripts/test-permisos-roles.ts`
- Create: `back4/scripts/seed-roles.js`
- Modify: `back4/package.json`

**Interfaces:**
- Consumes: `RolesService` (Task 1), `UsuariosService.actualizarPermisos` (Task 2).

- [ ] **Step 1: Write the integration test script**

`back4/scripts/test-permisos-roles.ts`:

```ts
// Prueba end-to-end de roles (presets de permisos) y permisos granulares por usuario.
// npm run test:permisos-roles   (usa ts-node, igual que test-desuscripcion-admin.ts)
//
// - Corre contra una base de datos TEMPORAL (portal4_test_permisos_roles) derivada
//   del MONGODB_URI del .env; se borra al final. No toca datos reales.
// - Verifica: CRUD de roles (crear/listar/actualizar/eliminar, nombre único),
//   y que UsuariosService.actualizarPermisos persista el objeto `permisos`
//   del usuario tal cual se le pasa.
import 'dotenv/config';

const TEST_DB = 'portal4_test_permisos_roles';

function uriConDb(uri: string, db: string): string {
  try {
    const u = new URL(uri);
    u.pathname = `/${db}`;
    return u.toString();
  } catch {
    const [main, query] = uri.split('?');
    const sinDb = main.replace(/\/[^/]*$/, '');
    return `${sinDb}/${db}${query ? `?${query}` : ''}`;
  }
}

async function main() {
  const baseUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';
  process.env.MONGODB_URI = uriConDb(baseUri, TEST_DB);
  console.log(`Base de datos de prueba: ${TEST_DB}`);

  const { NestFactory } = await import('@nestjs/core');
  const { Types } = await import('mongoose');
  const { getConnectionToken } = await import('@nestjs/mongoose');
  const { AppModule } = await import('../src/app.module');
  const { RolesService } = await import('../src/roles/roles.service');
  const { UsuariosService } = await import('../src/usuarios/usuarios.service');
  const { ConflictException, NotFoundException } = await import('@nestjs/common');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const conn: any = app.get(getConnectionToken());
  const db = conn.db;

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  const rolesService: any = app.get(RolesService);
  const usuariosService: any = app.get(UsuariosService);

  // ── Roles: crear, listar, actualizar, eliminar ────────────────────────────
  console.log('\nRoles:');

  const admin = await rolesService.create({
    nombre: 'Administrador',
    permisos: { actividades: { crear: true, editar: true, eliminar: true } },
  });
  check(admin.nombre === 'Administrador', 'crea el rol "Administrador"');

  const usuarioRol = await rolesService.create({ nombre: 'Usuario', permisos: {} });
  check(usuarioRol.nombre === 'Usuario', 'crea el rol "Usuario"');

  let nombreDuplicadoRechazado = false;
  try {
    await rolesService.create({ nombre: 'Administrador', permisos: {} });
  } catch (e) {
    nombreDuplicadoRechazado = e instanceof ConflictException;
  }
  check(nombreDuplicadoRechazado, 'rechaza un nombre de rol duplicado con ConflictException');

  const listado = await rolesService.findAll();
  check(listado.length === 2, `findAll devuelve los 2 roles creados (${listado.length}/2)`);

  const actualizado = await rolesService.update(String(admin._id), {
    permisos: { actividades: { crear: true, editar: true, eliminar: true }, usuarios: { crear: true } },
  });
  check(
    actualizado.permisos.usuarios?.crear === true,
    'update() persiste el nuevo objeto de permisos del rol',
  );

  await rolesService.remove(String(usuarioRol._id));
  let rolEliminadoNoEncontrado = false;
  try {
    await rolesService.findOne(String(usuarioRol._id));
  } catch (e) {
    rolEliminadoNoEncontrado = e instanceof NotFoundException;
  }
  check(rolEliminadoNoEncontrado, 'remove() elimina el rol (findOne posterior lanza NotFoundException)');

  // ── Permisos granulares por usuario ────────────────────────────────────────
  console.log('\nPermisos por usuario:');

  const usuarioId = new Types.ObjectId();
  await db.collection('usuarios').insertOne({
    _id: usuarioId,
    nombre: 'Usuario Test Permisos',
    email: 'permisos-test@example.com',
    password_hash: 'x',
    rol: 'usuario',
    activo: true,
    permisos: {},
  });

  const permisosNuevos = {
    actividades: { crear: true, editar: false, eliminar: false },
    docCentro: { subir: true },
  };
  const usuarioActualizado = await usuariosService.actualizarPermisos(String(usuarioId), {
    permisos: permisosNuevos,
  });
  check(
    JSON.stringify(usuarioActualizado.permisos) === JSON.stringify(permisosNuevos),
    'actualizarPermisos() persiste el objeto permisos tal cual se envía',
  );

  const usuarioReleido = await db.collection('usuarios').findOne({ _id: usuarioId });
  check(
    JSON.stringify(usuarioReleido.permisos) === JSON.stringify(permisosNuevos),
    'el objeto permisos queda persistido en la base de datos',
  );

  let usuarioInexistenteRechazado = false;
  try {
    await usuariosService.actualizarPermisos(String(new Types.ObjectId()), { permisos: {} });
  } catch (e) {
    usuarioInexistenteRechazado = e instanceof NotFoundException;
  }
  check(usuarioInexistenteRechazado, 'actualizarPermisos() sobre un usuario inexistente lanza NotFoundException');

  // ── Limpieza ────────────────────────────────────────────────────────────
  await db.dropDatabase();
  await app.close();
  console.log(`\nBase ${TEST_DB} eliminada.`);

  if (fallas > 0) {
    console.error(`\n${fallas} verificación(es) fallaron.`);
    process.exit(1);
  }
  console.log('Todas las verificaciones pasaron ✅');
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Add the npm scripts**

In `back4/package.json`, add to `"scripts"` (near `test:desuscripcion`):

```json
    "test:permisos-roles": "npx -y ts-node scripts/test-permisos-roles.ts",
    "seed:roles": "node scripts/seed-roles.js"
```

- [ ] **Step 3: Run the integration script and confirm it passes**

Run: `cd back4 && npm run test:permisos-roles`
Expected: every line prefixed `✔`, ending with `Todas las verificaciones pasaron ✅` and exit code 0. If any `✘ FALLA:` line appears, fix Task 1/2 code before continuing (this is the red→green check for the backend work, given there's no jest/vitest here).

- [ ] **Step 4: Write the seed script**

`back4/scripts/seed-roles.js`:

```js
/* Seed de roles base (presets de permisos) para portal-clientes-api.
   Crea "Administrador" (todos los permisos del catálogo en true) y "Usuario"
   (todos en false) si no existen. Es idempotente: si el rol ya existe por
   nombre, actualiza su objeto `permisos` en vez de duplicarlo.

   El catálogo de secciones/claves está duplicado aquí a propósito, en JS
   plano, porque el backend no valida el shape de `permisos` campo por campo
   (ver docs/superpowers/specs/2026-08-12-permisos-roles-usuarios-design.md) —
   la fuente de verdad real del catálogo vive en
   front4/src/app/shared/models/permisos.model.ts (PERM_SCHEMA). Si agregan
   una sección o clave ahí, actualicen también esta lista para que el rol
   "Administrador" siga representando "todos los permisos".

   Uso: node scripts/seed-roles.js
*/

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO = process.env.MONGODB_URI || 'mongodb://localhost:27017/portal_clientes';

const CATALOGO = {
  empresas: ['crear', 'editar', 'eliminar'],
  docEmpresa: ['subir', 'editarCategoria', 'vencer', 'eliminar'],
  centros: ['crear', 'editar', 'eliminar'],
  docCentro: ['subir', 'editarCategoria', 'vencer', 'eliminar'],
  proyectos: ['crear', 'editar', 'eliminar'],
  docProyecto: ['subir', 'editarCategoria', 'vencer', 'eliminar'],
  actividades: ['crear', 'editar', 'eliminar'],
  docActividad: ['subir', 'eliminar'],
  activos: ['crear', 'editar', 'eliminar'],
  docActivo: ['subir', 'eliminar'],
  catalogos: ['crear', 'editar', 'eliminar'],
  solicitudes: ['crear', 'cambiarEstado', 'eliminar'],
  usuarios: ['crear', 'editar', 'eliminar', 'crearAdmin'],
  noticias: ['crear', 'eliminar'],
};

function permisosCon(valor) {
  const permisos = {};
  for (const [seccion, claves] of Object.entries(CATALOGO)) {
    permisos[seccion] = {};
    for (const clave of claves) permisos[seccion][clave] = valor;
  }
  return permisos;
}

async function upsertRol(coll, nombre, permisos) {
  await coll.updateOne(
    { nombre },
    { $set: { nombre, permisos }, $setOnInsert: { creado_en: new Date() } },
    { upsert: true },
  );
}

async function main() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection;
  const coll = db.collection('roles');

  try {
    await upsertRol(coll, 'Administrador', permisosCon(true));
    console.log('✔ Rol "Administrador" (todos los permisos en true)');

    await upsertRol(coll, 'Usuario', permisosCon(false));
    console.log('✔ Rol "Usuario" (todos los permisos en false)');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 5: Run the seed script against the dev database and confirm it works**

Run: `cd back4 && npm run seed:roles`
Expected: prints the two `✔` lines with no error. (This writes to your real dev `MONGODB_URI` database — confirm `.env` points at a dev DB, not production, before running.)

- [ ] **Step 6: Commit**

```bash
git add back4/scripts/test-permisos-roles.ts back4/scripts/seed-roles.js back4/package.json
git commit -m "test(back4): script de verificación + seed de roles base (Administrador/Usuario)"
```

---

### Task 4: Frontend permisos model (PERM_SCHEMA + pure helpers)

**Files:**
- Create: `front4/src/app/shared/models/permisos.model.ts`
- Create: `front4/src/app/shared/models/permisos.model.spec.ts`
- Modify: `front4/src/app/shared/models/usuario.model.ts`

**Interfaces:**
- Produces: `PermisoRow`, `PermisoSeccion`, `PermisosUsuario`, `Rol`, `CreateRolDto`, `UpdateRolDto` types; `PERM_SCHEMA: PermisoSeccion[]`; `filaAplica(seccion, row, contextoCompleto): boolean`; `contarPermisosActivos(valores, contextoCompleto): { activos: number; total: number }`.
- Consumed by: Tasks 5, 6, 7, 8, 10.

- [ ] **Step 1: Write the failing spec**

`front4/src/app/shared/models/permisos.model.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PERM_SCHEMA, filaAplica, contarPermisosActivos, PermisosUsuario } from './permisos.model';

describe('filaAplica', () => {
  it('permite todas las filas cuando contextoCompleto es true', () => {
    const seccionInterna = PERM_SCHEMA.find((s) => s.key === 'empresas')!;
    expect(filaAplica(seccionInterna, seccionInterna.rows[0], true)).toBe(true);
  });

  it('deshabilita las filas de una sección soloInterno cuando contextoCompleto es false', () => {
    const seccionInterna = PERM_SCHEMA.find((s) => s.key === 'empresas')!;
    expect(filaAplica(seccionInterna, seccionInterna.rows[0], false)).toBe(false);
  });

  it('deshabilita una fila soloAdmin dentro de una sección normal cuando contextoCompleto es false', () => {
    const seccionUsuarios = PERM_SCHEMA.find((s) => s.key === 'usuarios')!;
    const filaCrearAdmin = seccionUsuarios.rows.find((r) => r.key === 'crearAdmin')!;
    expect(filaAplica(seccionUsuarios, filaCrearAdmin, false)).toBe(false);
  });

  it('permite una fila normal de una sección no interna cuando contextoCompleto es false', () => {
    const seccionUsuarios = PERM_SCHEMA.find((s) => s.key === 'usuarios')!;
    const filaCrear = seccionUsuarios.rows.find((r) => r.key === 'crear')!;
    expect(filaAplica(seccionUsuarios, filaCrear, false)).toBe(true);
  });
});

describe('contarPermisosActivos', () => {
  it('con contextoCompleto=true cuenta las 43 filas totales del catálogo', () => {
    const { total } = contarPermisosActivos({}, true);
    expect(total).toBe(43);
  });

  it('con contextoCompleto=false excluye secciones soloInterno y filas soloAdmin (34 filas)', () => {
    const { total } = contarPermisosActivos({}, false);
    expect(total).toBe(34);
  });

  it('cuenta correctamente los activos cuando todo está en true', () => {
    const valores: PermisosUsuario = {};
    for (const seccion of PERM_SCHEMA) {
      valores[seccion.key] = {};
      for (const row of seccion.rows) valores[seccion.key][row.key] = true;
    }
    expect(contarPermisosActivos(valores, true)).toEqual({ activos: 43, total: 43 });
  });

  it('no cuenta como activa una clave ausente en el objeto de valores', () => {
    expect(contarPermisosActivos({ actividades: { crear: true } }, true).activos).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd front4 && npx ng test --watch=false` (corre toda la suite; no hay forma de filtrar un solo spec con este builder)
Expected: FAIL — `permisos.model.ts` does not exist yet.

- [ ] **Step 3: Write `permisos.model.ts`**

`front4/src/app/shared/models/permisos.model.ts`:

```ts
export interface PermisoRow {
  key: string;
  label: string;
  hint?: string;
  soloAdmin?: boolean;
}

export interface PermisoSeccion {
  key: string;
  titulo: string;
  soloInterno?: boolean;
  rows: PermisoRow[];
}

export type PermisosUsuario = Record<string, Record<string, boolean>>;

export interface Rol {
  _id: string;
  nombre: string;
  permisos: PermisosUsuario;
  creado_en?: string;
  actualizado_en?: string;
}

export interface CreateRolDto {
  nombre: string;
  permisos: PermisosUsuario;
}

export interface UpdateRolDto {
  nombre?: string;
  permisos?: PermisosUsuario;
}

export const PERM_SCHEMA: PermisoSeccion[] = [
  { key: 'empresas', titulo: 'Empresas', soloInterno: true, rows: [
    { key: 'crear', label: 'Crear empresa', hint: 'Alta de nuevas empresas cliente' },
    { key: 'editar', label: 'Editar empresa', hint: 'Datos generales, score smartclarity, configuración de gráfico' },
    { key: 'eliminar', label: 'Eliminar empresa', hint: 'Baja de una empresa' },
  ] },
  { key: 'docEmpresa', titulo: 'Documentos de empresa', rows: [
    { key: 'subir', label: 'Subir documento', hint: 'Adjuntar archivos a la ficha de la empresa' },
    { key: 'editarCategoria', label: 'Editar categoría', hint: 'Reclasificar un documento ya subido' },
    { key: 'vencer', label: 'Marcar como vencido', hint: 'Forzar el estado antes de la fecha de vencimiento' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'centros', titulo: 'Centros de costo', rows: [
    { key: 'crear', label: 'Crear centro' },
    { key: 'editar', label: 'Editar centro', hint: 'Datos y score smartclarity' },
    { key: 'eliminar', label: 'Eliminar centro' },
  ] },
  { key: 'docCentro', titulo: 'Documentos de centro', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'editarCategoria', label: 'Editar categoría' },
    { key: 'vencer', label: 'Marcar como vencido' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'proyectos', titulo: 'Proyectos', rows: [
    { key: 'crear', label: 'Crear proyecto' },
    { key: 'editar', label: 'Editar proyecto' },
    { key: 'eliminar', label: 'Eliminar proyecto' },
  ] },
  { key: 'docProyecto', titulo: 'Documentos de proyecto', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'editarCategoria', label: 'Editar categoría' },
    { key: 'vencer', label: 'Marcar como vencido' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'actividades', titulo: 'Actividades', rows: [
    { key: 'crear', label: 'Crear actividad', hint: 'Ej: diferenciar sus propias actividades de las nuestras' },
    { key: 'editar', label: 'Editar actividad' },
    { key: 'eliminar', label: 'Eliminar actividad' },
  ] },
  { key: 'docActividad', titulo: 'Documentos de actividad', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'activos', titulo: 'Activos', rows: [
    { key: 'crear', label: 'Crear activo', hint: 'Ej: agregar activos propios, separados de los nuestros' },
    { key: 'editar', label: 'Editar activo' },
    { key: 'eliminar', label: 'Eliminar activo' },
  ] },
  { key: 'docActivo', titulo: 'Documentos de activo', rows: [
    { key: 'subir', label: 'Subir documento' },
    { key: 'eliminar', label: 'Eliminar documento' },
  ] },
  { key: 'catalogos', titulo: 'Catálogos (tipos de actividad, activo, proyecto)', soloInterno: true, rows: [
    { key: 'crear', label: 'Crear tipo', hint: 'Ícono y color — es catálogo compartido entre todas las empresas' },
    { key: 'editar', label: 'Editar tipo' },
    { key: 'eliminar', label: 'Eliminar tipo' },
  ] },
  { key: 'solicitudes', titulo: 'Solicitudes', rows: [
    { key: 'crear', label: 'Crear solicitud' },
    { key: 'cambiarEstado', label: 'Cambiar estado', hint: 'Aprobar, rechazar, poner en revisión' },
    { key: 'eliminar', label: 'Eliminar solicitud' },
  ] },
  { key: 'usuarios', titulo: 'Usuarios', rows: [
    { key: 'crear', label: 'Crear usuario', hint: 'Ej: sumar gente de su propia empresa sin tener que llamarnos' },
    { key: 'editar', label: 'Editar usuario' },
    { key: 'eliminar', label: 'Eliminar usuario' },
    { key: 'crearAdmin', label: 'Crear administrador', hint: '⚠ crea otra cuenta con este mismo nivel de acceso', soloAdmin: true },
  ] },
  { key: 'noticias', titulo: 'Noticias', soloInterno: true, rows: [
    { key: 'crear', label: 'Publicar noticia' },
    { key: 'eliminar', label: 'Eliminar noticia' },
  ] },
];

export function filaAplica(seccion: PermisoSeccion, row: PermisoRow, contextoCompleto: boolean): boolean {
  if (contextoCompleto) return true;
  if (seccion.soloInterno) return false;
  if (row.soloAdmin) return false;
  return true;
}

export function contarPermisosActivos(
  valores: PermisosUsuario,
  contextoCompleto: boolean,
): { activos: number; total: number } {
  let activos = 0;
  let total = 0;
  for (const seccion of PERM_SCHEMA) {
    for (const row of seccion.rows) {
      if (!filaAplica(seccion, row, contextoCompleto)) continue;
      total++;
      if (valores?.[seccion.key]?.[row.key]) activos++;
    }
  }
  return { activos, total };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd front4 && npx ng test --watch=false` (corre toda la suite; no hay forma de filtrar un solo spec con este builder)
Expected: PASS (all 8 tests).

- [ ] **Step 5: Add `permisos` to the `Usuario` interface**

In `front4/src/app/shared/models/usuario.model.ts`, add the import at the top:

```ts
import { PermisosUsuario } from './permisos.model';
```

Add the field to the `Usuario` interface (after `centros_asignados: string[];`):

```ts
  permisos?: PermisosUsuario;
```

- [ ] **Step 6: Commit**

```bash
git add front4/src/app/shared/models/permisos.model.ts front4/src/app/shared/models/permisos.model.spec.ts front4/src/app/shared/models/usuario.model.ts
git commit -m "feat(front4): catálogo PERM_SCHEMA + helpers de permisos"
```

---

### Task 5: `PermisosPanelComponent` (shared, reusable switches UI)

**Files:**
- Create: `front4/src/app/shared/components/permisos-panel/permisos-panel.component.ts`
- Create: `front4/src/app/shared/components/permisos-panel/permisos-panel.component.html`
- Create: `front4/src/app/shared/components/permisos-panel/permisos-panel.component.spec.ts`

**Interfaces:**
- Consumes: `PERM_SCHEMA`, `filaAplica`, `PermisosUsuario` from Task 4.
- Produces: `<app-permisos-panel [valores] [contextoCompleto] (valoresChange)>`. `@Input() valores: PermisosUsuario`, `@Input() contextoCompleto: boolean` (default `true`), `@Output() valoresChange: EventEmitter<PermisosUsuario>`.
- Consumed by: Tasks 7, 8.

- [ ] **Step 1: Write the failing spec**

`front4/src/app/shared/components/permisos-panel/permisos-panel.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PermisosPanelComponent } from './permisos-panel.component';

describe('PermisosPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PermisosPanelComponent] }).compileComponents();
  });

  it('renderiza las 14 secciones del catálogo', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pf-seccion').length).toBe(14);
  });

  it('marca "solo interno" en las secciones internas', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.pf-seccion-nota').length).toBe(3);
  });

  it('con contextoCompleto=false deshabilita los switches de secciones soloInterno y filas soloAdmin', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    fixture.componentRef.setInput('contextoCompleto', false);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const switches = el.querySelectorAll<HTMLButtonElement>('.pf-switch');
    const deshabilitados = Array.from(switches).filter((s) => s.disabled);
    expect(deshabilitados.length).toBe(9);
  });

  it('refleja el estado activo de un permiso en aria-pressed', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    fixture.componentRef.setInput('valores', { actividades: { crear: true } });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const switches = Array.from(el.querySelectorAll<HTMLButtonElement>('.pf-switch'));
    const activos = switches.filter((s) => s.getAttribute('aria-pressed') === 'true');
    expect(activos.length).toBe(1);
  });

  it('al hacer click en un switch emite valoresChange con el nuevo estado', () => {
    const fixture = TestBed.createComponent(PermisosPanelComponent);
    let emitido: unknown = null;
    fixture.componentInstance.valoresChange.subscribe((v) => (emitido = v));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('.pf-switch') as HTMLButtonElement).click();
    expect(emitido).toEqual({ empresas: { crear: true } });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd front4 && npx ng test --watch=false` (corre toda la suite; no hay forma de filtrar un solo spec con este builder)
Expected: FAIL — component does not exist yet.

- [ ] **Step 3: Write the component**

`front4/src/app/shared/components/permisos-panel/permisos-panel.component.ts`:

```ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PERM_SCHEMA, PermisoRow, PermisoSeccion, PermisosUsuario, filaAplica } from '../../models/permisos.model';

@Component({
  selector: 'app-permisos-panel',
  standalone: true,
  imports: [],
  templateUrl: './permisos-panel.component.html',
  styles: [`
    .pf-seccion { display: flex; flex-direction: column; gap: .7rem; }
    .pf-seccion + .pf-seccion { margin-top: 1.4rem; }
    .pf-seccion-titulo {
      margin: 0;
      font-size: .7rem; font-weight: 700;
      letter-spacing: .08em; text-transform: uppercase;
      color: #0075a8;
      display: flex; align-items: center; gap: .6rem;
    }
    .pf-seccion-titulo::after { content: ""; flex: 1; height: 1px; background: rgba(0,149,214,.18); }
    .pf-seccion-nota {
      font-size: .68rem; font-weight: 700; letter-spacing: .02em;
      color: #9ca3af; text-transform: none;
      padding: .05rem .5rem; border: 1px dashed #d1d5db; border-radius: 999px;
    }

    .perm-panel {
      border: 1px solid rgba(34,33,33,.1);
      border-radius: 10px;
      background: #f8fafc;
      overflow: hidden;
    }
    .perm-row { display: flex; align-items: center; gap: 1rem; padding: .68rem .9rem; }
    .perm-row + .perm-row { border-top: 1px solid rgba(34,33,33,.07); }
    .perm-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .1rem; }
    .perm-row-label { font-size: .86rem; font-weight: 600; color: #1f2937; }
    .perm-row-hint { font-size: .76rem; color: #6b7280; line-height: 1.4; }
    .perm-row--disabled .perm-row-label { color: #9ca3af; }
    .perm-row--disabled .perm-row-hint { color: #c1c7d0; }

    .pf-switch {
      position: relative; flex-shrink: 0;
      width: 40px; height: 22px; border-radius: 999px;
      border: none; padding: 0; cursor: pointer;
      background: #dfe3e7;
      transition: background .16s;
    }
    .pf-switch::after {
      content: ""; position: absolute; top: 2px; left: 2px;
      width: 18px; height: 18px; border-radius: 999px;
      background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.25);
      transition: transform .16s;
    }
    .pf-switch[aria-pressed="true"] { background: #0095d6; }
    .pf-switch[aria-pressed="true"]::after { transform: translateX(18px); }
    .pf-switch:disabled { cursor: not-allowed; opacity: .55; }
    .pf-switch:focus-visible { outline: 2px solid #0095d6; outline-offset: 2px; }
  `],
})
export class PermisosPanelComponent {
  @Input() valores: PermisosUsuario = {};
  @Input() contextoCompleto = true;
  @Output() valoresChange = new EventEmitter<PermisosUsuario>();

  readonly schema = PERM_SCHEMA;

  aplica(seccion: PermisoSeccion, row: PermisoRow): boolean {
    return filaAplica(seccion, row, this.contextoCompleto);
  }

  activo(seccionKey: string, rowKey: string): boolean {
    return !!this.valores?.[seccionKey]?.[rowKey];
  }

  toggle(seccionKey: string, rowKey: string): void {
    const seccionActual = this.valores[seccionKey] ?? {};
    const siguiente: PermisosUsuario = {
      ...this.valores,
      [seccionKey]: { ...seccionActual, [rowKey]: !this.activo(seccionKey, rowKey) },
    };
    this.valoresChange.emit(siguiente);
  }
}
```

`front4/src/app/shared/components/permisos-panel/permisos-panel.component.html`:

```html
@for (seccion of schema; track seccion.key) {
  <div class="pf-seccion">
    <h3 class="pf-seccion-titulo">
      {{ seccion.titulo }}
      @if (seccion.soloInterno) {
        <span class="pf-seccion-nota">solo interno</span>
      }
    </h3>
    <div class="perm-panel">
      @for (row of seccion.rows; track row.key) {
        <div class="perm-row" [class.perm-row--disabled]="!aplica(seccion, row)">
          <div class="perm-row-text">
            <span class="perm-row-label">{{ row.label }}</span>
            @if (row.hint) {
              <span class="perm-row-hint">{{ row.hint }}</span>
            }
          </div>
          <button
            type="button"
            class="pf-switch"
            [attr.aria-pressed]="activo(seccion.key, row.key)"
            [attr.aria-label]="row.label"
            [disabled]="!aplica(seccion, row)"
            (click)="toggle(seccion.key, row.key)"
          ></button>
        </div>
      }
    </div>
  </div>
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd front4 && npx ng test --watch=false` (corre toda la suite; no hay forma de filtrar un solo spec con este builder)
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/shared/components/permisos-panel
git commit -m "feat(front4): PermisosPanelComponent (switches de permisos reutilizable)"
```

---

### Task 6: `RolesService` (frontend) + `UsuariosService.actualizarPermisos`

**Files:**
- Create: `front4/src/app/features/usuarios/roles.service.ts`
- Modify: `front4/src/app/features/usuarios/usuarios.service.ts`

**Interfaces:**
- Consumes: `Rol`, `CreateRolDto`, `UpdateRolDto`, `PermisosUsuario` from Task 4. Backend endpoints from Task 1 (`/roles`) and Task 2 (`/usuarios/:id/permisos`).
- Produces: `RolesService` with signals `roles`, `status`, `loading` and methods `cargar()`, `crear(dto)`, `actualizar(id, dto)`, `eliminar(id)`, `clearStatus()`. `UsuariosService.actualizarPermisos(id: string, permisos: PermisosUsuario): void`.
- Consumed by: Tasks 7, 8, 10. No spec for this task — matches the existing convention that feature services (`UsuariosService`, `ClientesService`, etc.) aren't unit-tested in this codebase; only pure-logic files and components get specs.

- [ ] **Step 1: Create `RolesService`**

`front4/src/app/features/usuarios/roles.service.ts`:

```ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from '../../core/services/api.service';
import { Rol, CreateRolDto, UpdateRolDto } from '../../shared/models/permisos.model';
import { Status } from '../../shared/models/status.model';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(ApiService);

  readonly roles   = signal<Rol[]>([]);
  readonly status  = signal<Status | null>(null);
  readonly loading = signal(false);

  cargar(): void {
    this.loading.set(true);
    this.http.get<{ data: Rol[] } | Rol[]>(this.api.url('/roles')).subscribe({
      next: (res) => { this.roles.set(Array.isArray(res) ? res : res.data); this.loading.set(false); },
      error: (err) => { this.setError(err); this.loading.set(false); },
    });
  }

  crear(dto: CreateRolDto): void {
    this.http.post<Rol>(this.api.url('/roles'), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Rol creado' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  actualizar(id: string, dto: UpdateRolDto): void {
    this.http.put<Rol>(this.api.url(`/roles/${id}`), dto).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Rol actualizado' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  eliminar(id: string): void {
    this.http.delete(this.api.url(`/roles/${id}`)).subscribe({
      next: () => { this.status.set({ type: 'ok', text: 'Rol eliminado' }); this.cargar(); },
      error: (err) => this.setError(err),
    });
  }

  clearStatus(): void { this.status.set(null); }

  private setError(err: { error?: { message?: string } }): void {
    const msg = err?.error?.message;
    this.status.set({ type: 'error', text: Array.isArray(msg) ? msg.join('. ') : (msg ?? 'Error inesperado') });
  }
}
```

- [ ] **Step 2: Add `actualizarPermisos` to `UsuariosService`**

In `front4/src/app/features/usuarios/usuarios.service.ts`, add `PermisosUsuario` to the import:

```ts
import { PermisosUsuario } from '../../shared/models/permisos.model';
```

Add this method (near `actualizarSuscripciones`):

```ts
  actualizarPermisos(id: string, permisos: PermisosUsuario): void {
    this.http.patch<Usuario>(this.api.url(`/usuarios/${id}/permisos`), { permisos }).subscribe({
      next: (usuario) => {
        this.status.set({ type: 'ok', text: 'Permisos actualizados' });
        this.usuarios.update((lista) => lista.map((u) => (u._id === usuario._id ? usuario : u)));
      },
      error: (err) => this.setError(err),
    });
  }
```

- [ ] **Step 3: Verify the project still type-checks**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/usuarios/roles.service.ts front4/src/app/features/usuarios/usuarios.service.ts
git commit -m "feat(front4): RolesService + UsuariosService.actualizarPermisos"
```

---

### Task 7: `PermisosFormComponent`

**Files:**
- Create: `front4/src/app/features/usuarios/components/permisos-form/permisos-form.component.ts`
- Create: `front4/src/app/features/usuarios/components/permisos-form/permisos-form.component.html`
- Create: `front4/src/app/features/usuarios/components/permisos-form/permisos-form.component.spec.ts`

**Interfaces:**
- Consumes: `PermisosPanelComponent` (Task 5), `contarPermisosActivos`, `PermisosUsuario`, `Rol` (Task 4), `Usuario`, `RolUsuario` (`shared/models/usuario.model.ts`).
- Produces: `<app-permisos-form [usuario] [roles] (guardado) (cancelado)>`. `@Input() usuario: Usuario | null`, `@Input() roles: Rol[]`, `@Output() guardado: EventEmitter<PermisosUsuario>`, `@Output() cancelado: EventEmitter<void>`.
- Consumed by: Task 10.

- [ ] **Step 1: Write the failing spec**

`front4/src/app/features/usuarios/components/permisos-form/permisos-form.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PermisosFormComponent } from './permisos-form.component';
import { Usuario } from '../../../../shared/models/usuario.model';
import { Rol } from '../../../../shared/models/permisos.model';

function usuario(over: Partial<Usuario> = {}): Usuario {
  return {
    _id: 'u1', cliente_id: 'c1', nombre: 'Jorge Muñoz', email: 'jorge@example.com',
    rol: 'usuario', permiso_acceso: 'ver', centros_asignados: [], activo: true, ...over,
  };
}

describe('PermisosFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PermisosFormComponent] }).compileComponents();
  });

  it('muestra el nombre, el chip de rol y el email del usuario', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ nombre: 'Camila Rojas', rol: 'admin_smartclarity', email: 'camila@eclariti.com' }));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Camila Rojas');
    expect(el.textContent).toContain('Admin SmartClarity');
    expect(el.textContent).toContain('camila@eclariti.com');
  });

  it('con un usuario rol=usuario, el contador excluye las secciones internas (34 filas)', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ rol: 'usuario' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.contador.total).toBe(34);
  });

  it('con un usuario admin_smartclarity, el contador incluye todo el catálogo (43 filas)', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ rol: 'admin_smartclarity' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.contador.total).toBe(43);
  });

  it('parte de los permisos existentes del usuario', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ permisos: { actividades: { crear: true } } }));
    fixture.detectChanges();
    expect(fixture.componentInstance.contador.activos).toBe(1);
  });

  it('aplicarRol reemplaza los valores actuales por el preset del rol elegido', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    const rol: Rol = { _id: 'r1', nombre: 'Administrador', permisos: { actividades: { crear: true, editar: true } } };
    fixture.componentRef.setInput('usuario', usuario());
    fixture.componentRef.setInput('roles', [rol]);
    fixture.detectChanges();
    fixture.componentInstance.aplicarRol('r1');
    expect(fixture.componentInstance.valores).toEqual({ actividades: { crear: true, editar: true } });
  });

  it('al hacer click en Guardar permisos emite guardado con los valores actuales', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario({ permisos: { actividades: { crear: true } } }));
    fixture.detectChanges();
    let emitido: unknown = null;
    fixture.componentInstance.guardado.subscribe((v) => (emitido = v));
    const el = fixture.nativeElement as HTMLElement;
    const guardarBtn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Guardar permisos')) as HTMLButtonElement;
    guardarBtn.click();
    expect(emitido).toEqual({ actividades: { crear: true } });
  });

  it('al hacer click en Cancelar emite cancelado', () => {
    const fixture = TestBed.createComponent(PermisosFormComponent);
    fixture.componentRef.setInput('usuario', usuario());
    fixture.detectChanges();
    let emitido = false;
    fixture.componentInstance.cancelado.subscribe(() => (emitido = true));
    const el = fixture.nativeElement as HTMLElement;
    const cancelarBtn = Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Cancelar')) as HTMLButtonElement;
    cancelarBtn.click();
    expect(emitido).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd front4 && npx ng test --watch=false` (corre toda la suite; no hay forma de filtrar un solo spec con este builder)
Expected: FAIL — component does not exist yet.

- [ ] **Step 3: Write the component**

`front4/src/app/features/usuarios/components/permisos-form/permisos-form.component.ts`:

```ts
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PermisosPanelComponent } from '../../../../shared/components/permisos-panel/permisos-panel.component';
import { Usuario, RolUsuario } from '../../../../shared/models/usuario.model';
import { PermisosUsuario, Rol, contarPermisosActivos } from '../../../../shared/models/permisos.model';

@Component({
  selector: 'app-permisos-form',
  standalone: true,
  imports: [FormsModule, PermisosPanelComponent],
  templateUrl: './permisos-form.component.html',
  styles: [`
    .pfm-header { display: flex; align-items: center; gap: .85rem; margin-bottom: 1.1rem; }
    .pfm-avatar {
      width: 40px; height: 40px; border-radius: 999px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: .9rem; color: #fff;
    }
    .pfm-avatar-usuario { background: #6b7280; }
    .pfm-avatar-admin   { background: #0095d6; }
    .pfm-avatar-super   { background: #f59e0b; }
    .pfm-identity { display: flex; flex-direction: column; gap: .15rem; min-width: 0; flex: 1; }
    .pfm-identity-top { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .pfm-identity-top h3 { margin: 0; font-size: 1rem; font-weight: 700; color: #111827; }
    .pfm-role-chip {
      font-size: .68rem; font-weight: 700; letter-spacing: .03em;
      padding: .14rem .55rem; border-radius: 999px;
      background: rgba(0,149,214,.12); color: #0075a8;
    }
    .pfm-identity-sub { font-size: .78rem; color: #6b7280; }

    .pfm-rol-preset {
      display: flex; align-items: center; gap: .6rem;
      padding: .6rem .8rem; margin-bottom: 1.1rem;
      background: rgba(0,149,214,.06); border-radius: 10px;
      font-size: .82rem; font-weight: 600; color: #374151;
    }
    .pfm-rol-preset select {
      flex: 1; padding: .4rem .6rem; border-radius: 7px;
      border: 1px solid rgba(34,33,33,.18); font-family: inherit; font-size: .84rem;
      background: #fff; color: #1f2937;
    }

    .pfm-footer {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      margin-top: 1.4rem; padding-top: .9rem;
      border-top: 1px solid rgba(34,33,33,.1);
    }
    .pfm-footer-contador { font-size: .82rem; color: #374151; }
    .pfm-footer-contador strong { font-variant-numeric: tabular-nums; color: #111827; }
    .pfm-footer-actions { display: flex; gap: .6rem; }
  `],
})
export class PermisosFormComponent implements OnChanges {
  @Input() usuario: Usuario | null = null;
  @Input() roles: Rol[] = [];
  @Output() guardado = new EventEmitter<PermisosUsuario>();
  @Output() cancelado = new EventEmitter<void>();

  valores: PermisosUsuario = {};
  rolSeleccionadoId = '';

  ngOnChanges(): void {
    this.valores = structuredClone(this.usuario?.permisos ?? {});
    this.rolSeleccionadoId = '';
  }

  get contextoCompleto(): boolean {
    return this.usuario?.rol !== 'usuario';
  }

  get contador(): { activos: number; total: number } {
    return contarPermisosActivos(this.valores, this.contextoCompleto);
  }

  onValoresChange(v: PermisosUsuario): void {
    this.valores = v;
  }

  aplicarRol(rolId: string): void {
    this.rolSeleccionadoId = rolId;
    const rol = this.roles.find((r) => r._id === rolId);
    if (!rol) return;
    this.valores = structuredClone(rol.permisos);
  }

  iniciales(nombre: string): string {
    const partes = nombre.trim().split(/\s+/);
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.slice(0, 2).toUpperCase();
  }

  rolClase(rol: RolUsuario): string {
    if (rol === 'super_admin') return 'super';
    if (rol === 'admin_smartclarity') return 'admin';
    return 'usuario';
  }

  rolLabel(rol: RolUsuario): string {
    if (rol === 'super_admin') return 'Super Admin';
    if (rol === 'admin_smartclarity') return 'Admin SmartClarity';
    return 'Usuario';
  }

  submit(): void {
    this.guardado.emit(this.valores);
  }
}
```

`front4/src/app/features/usuarios/components/permisos-form/permisos-form.component.html`:

```html
@if (usuario) {
  <div class="pfm-header">
    <div class="pfm-avatar" [class]="'pfm-avatar-' + rolClase(usuario.rol)">{{ iniciales(usuario.nombre) }}</div>
    <div class="pfm-identity">
      <div class="pfm-identity-top">
        <h3>{{ usuario.nombre }}</h3>
        <span class="pfm-role-chip">{{ rolLabel(usuario.rol) }}</span>
      </div>
      <div class="pfm-identity-sub">{{ usuario.email }}</div>
    </div>
  </div>

  @if (roles.length > 0) {
    <div class="pfm-rol-preset">
      <label for="pfm-rol-select">Aplicar rol como plantilla</label>
      <select id="pfm-rol-select" [ngModel]="rolSeleccionadoId" (ngModelChange)="aplicarRol($event)" name="rolPreset">
        <option value="">— Elegir rol —</option>
        @for (r of roles; track r._id) {
          <option [value]="r._id">{{ r.nombre }}</option>
        }
      </select>
    </div>
  }

  <app-permisos-panel
    [valores]="valores"
    [contextoCompleto]="contextoCompleto"
    (valoresChange)="onValoresChange($event)"
  ></app-permisos-panel>

  <div class="pfm-footer">
    <div class="pfm-footer-contador"><strong>{{ contador.activos }}/{{ contador.total }}</strong> permisos activos</div>
    <div class="pfm-footer-actions">
      <button type="button" class="btn-ghost" (click)="cancelado.emit()">Cancelar</button>
      <button type="button" class="btn-primary" (click)="submit()">Guardar permisos</button>
    </div>
  </div>
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd front4 && npx ng test --watch=false` (corre toda la suite; no hay forma de filtrar un solo spec con este builder)
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/usuarios/components/permisos-form
git commit -m "feat(front4): PermisosFormComponent (modal de permisos por usuario)"
```

---

### Task 8: `RolesManagerComponent`

**Files:**
- Create: `front4/src/app/features/usuarios/components/roles-manager/roles-manager.component.ts`
- Create: `front4/src/app/features/usuarios/components/roles-manager/roles-manager.component.html`
- Create: `front4/src/app/features/usuarios/components/roles-manager/roles-manager.component.spec.ts`

**Interfaces:**
- Consumes: `PermisosPanelComponent` (Task 5), `contarPermisosActivos`, `Rol`, `CreateRolDto`, `UpdateRolDto`, `PermisosUsuario` (Task 4).
- Produces: `<app-roles-manager [roles] (crear) (editar) (eliminar)>`. `@Input() roles: Rol[]`, `@Output() crear: EventEmitter<CreateRolDto>`, `@Output() editar: EventEmitter<{ id: string; dto: UpdateRolDto }>`, `@Output() eliminar: EventEmitter<string>`.
- Consumed by: Task 10.

- [ ] **Step 1: Write the failing spec**

`front4/src/app/features/usuarios/components/roles-manager/roles-manager.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { RolesManagerComponent } from './roles-manager.component';
import { Rol } from '../../../../shared/models/permisos.model';

function rol(over: Partial<Rol> = {}): Rol {
  return { _id: 'r1', nombre: 'Administrador', permisos: {}, ...over };
}

describe('RolesManagerComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RolesManagerComponent] }).compileComponents();
  });

  it('lista los roles recibidos con su contador de permisos activos', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.componentRef.setInput('roles', [rol({ nombre: 'Administrador', permisos: { actividades: { crear: true } } })]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Administrador');
    expect(el.textContent).toContain('1/43 permisos activos');
  });

  it('muestra el mensaje vacío cuando no hay roles', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Sin roles creados todavía.');
  });

  it('abrirNuevo pasa a la vista editar con el formulario vacío', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    fixture.componentInstance.abrirNuevo();
    expect(fixture.componentInstance.vista()).toBe('editar');
    expect(fixture.componentInstance.nombreForm).toBe('');
    expect(fixture.componentInstance.rolEditandoId()).toBeNull();
  });

  it('abrirEditar precarga nombre y permisos del rol', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    fixture.componentInstance.abrirEditar(rol({ _id: 'r2', nombre: 'Usuario auditor', permisos: { docCentro: { subir: true } } }));
    expect(fixture.componentInstance.vista()).toBe('editar');
    expect(fixture.componentInstance.nombreForm).toBe('Usuario auditor');
    expect(fixture.componentInstance.valoresForm).toEqual({ docCentro: { subir: true } });
    expect(fixture.componentInstance.rolEditandoId()).toBe('r2');
  });

  it('guardar sobre un rol existente emite editar con id y dto, y vuelve a la lista', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    let emitido: unknown = null;
    fixture.componentInstance.editar.subscribe((v) => (emitido = v));
    fixture.componentInstance.abrirEditar(rol({ _id: 'r2', nombre: 'Usuario auditor', permisos: {} }));
    fixture.componentInstance.nombreForm = 'Usuario auditor senior';
    fixture.componentInstance.guardar();
    expect(emitido).toEqual({ id: 'r2', dto: { nombre: 'Usuario auditor senior', permisos: {} } });
    expect(fixture.componentInstance.vista()).toBe('lista');
  });

  it('guardar sin rol seleccionado emite crear con el dto', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.detectChanges();
    let emitido: unknown = null;
    fixture.componentInstance.crear.subscribe((v) => (emitido = v));
    fixture.componentInstance.abrirNuevo();
    fixture.componentInstance.nombreForm = 'Usuario básico';
    fixture.componentInstance.guardar();
    expect(emitido).toEqual({ nombre: 'Usuario básico', permisos: {} });
  });

  it('click en Eliminar emite el id del rol', () => {
    const fixture = TestBed.createComponent(RolesManagerComponent);
    fixture.componentRef.setInput('roles', [rol({ _id: 'r9' })]);
    fixture.detectChanges();
    let emitido: unknown = null;
    fixture.componentInstance.eliminar.subscribe((v) => (emitido = v));
    const el = fixture.nativeElement as HTMLElement;
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Eliminar')) as HTMLButtonElement).click();
    expect(emitido).toBe('r9');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd front4 && npx ng test --watch=false` (corre toda la suite; no hay forma de filtrar un solo spec con este builder)
Expected: FAIL — component does not exist yet.

- [ ] **Step 3: Write the component**

`front4/src/app/features/usuarios/components/roles-manager/roles-manager.component.ts`:

```ts
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PermisosPanelComponent } from '../../../../shared/components/permisos-panel/permisos-panel.component';
import { CreateRolDto, PermisosUsuario, Rol, UpdateRolDto, contarPermisosActivos } from '../../../../shared/models/permisos.model';

type Vista = 'lista' | 'editar';

@Component({
  selector: 'app-roles-manager',
  standalone: true,
  imports: [FormsModule, PermisosPanelComponent],
  templateUrl: './roles-manager.component.html',
  styles: [`
    .rm-lista { display: flex; flex-direction: column; gap: .5rem; }
    .rm-row {
      display: flex; align-items: center; gap: .75rem;
      padding: .7rem .9rem; border: 1px solid rgba(34,33,33,.1); border-radius: 10px;
    }
    .rm-row-info { flex: 1; min-width: 0; }
    .rm-row-nombre { font-size: .9rem; font-weight: 700; color: #1f2937; }
    .rm-row-contador { font-size: .78rem; color: #6b7280; }
    .rm-row-acciones { display: flex; gap: .4rem; }
    .rm-nuevo { margin-top: .4rem; }
    .rm-empty { font-size: .85rem; color: #9ca3af; text-align: center; padding: 1rem 0; }

    .rm-nombre-field { display: flex; flex-direction: column; gap: .3rem; margin-bottom: 1.1rem; }
    .rm-nombre-field label { font-size: .78rem; font-weight: 600; color: #374151; }
    .rm-nombre-field input {
      padding: .55rem .75rem; border-radius: 8px; border: 1px solid rgba(34,33,33,.2);
      font-size: .9rem; font-family: inherit;
    }
    .rm-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: .6rem;
      margin-top: 1.2rem; padding-top: .9rem; border-top: 1px solid rgba(34,33,33,.1);
    }
  `],
})
export class RolesManagerComponent {
  @Input() roles: Rol[] = [];
  @Output() crear = new EventEmitter<CreateRolDto>();
  @Output() editar = new EventEmitter<{ id: string; dto: UpdateRolDto }>();
  @Output() eliminar = new EventEmitter<string>();

  vista = signal<Vista>('lista');
  rolEditandoId = signal<string | null>(null);
  nombreForm = '';
  valoresForm: PermisosUsuario = {};

  contadorDe(rol: Rol): { activos: number; total: number } {
    return contarPermisosActivos(rol.permisos, true);
  }

  abrirNuevo(): void {
    this.rolEditandoId.set(null);
    this.nombreForm = '';
    this.valoresForm = {};
    this.vista.set('editar');
  }

  abrirEditar(rol: Rol): void {
    this.rolEditandoId.set(rol._id);
    this.nombreForm = rol.nombre;
    this.valoresForm = structuredClone(rol.permisos);
    this.vista.set('editar');
  }

  volver(): void {
    this.vista.set('lista');
  }

  onValoresChange(v: PermisosUsuario): void {
    this.valoresForm = v;
  }

  guardar(): void {
    const dto = { nombre: this.nombreForm, permisos: this.valoresForm };
    const id = this.rolEditandoId();
    if (id) this.editar.emit({ id, dto });
    else this.crear.emit(dto);
    this.vista.set('lista');
  }
}
```

`front4/src/app/features/usuarios/components/roles-manager/roles-manager.component.html`:

```html
@if (vista() === 'lista') {
  <div class="rm-lista">
    @for (rol of roles; track rol._id) {
      <div class="rm-row">
        <div class="rm-row-info">
          <div class="rm-row-nombre">{{ rol.nombre }}</div>
          <div class="rm-row-contador">{{ contadorDe(rol).activos }}/{{ contadorDe(rol).total }} permisos activos</div>
        </div>
        <div class="rm-row-acciones">
          <button type="button" class="btn-ghost btn-sm" (click)="abrirEditar(rol)">Editar</button>
          <button type="button" class="btn-danger btn-sm" (click)="eliminar.emit(rol._id)">Eliminar</button>
        </div>
      </div>
    }
    @if (roles.length === 0) {
      <p class="rm-empty">Sin roles creados todavía.</p>
    }
  </div>
  <button type="button" class="btn-primary rm-nuevo" (click)="abrirNuevo()">Nuevo rol</button>
}

@if (vista() === 'editar') {
  <div class="rm-nombre-field">
    <label for="rm-nombre">Nombre del rol</label>
    <input id="rm-nombre" type="text" [(ngModel)]="nombreForm" name="nombreForm" placeholder="Ej: Usuario auditor" />
  </div>

  <app-permisos-panel
    [valores]="valoresForm"
    [contextoCompleto]="true"
    (valoresChange)="onValoresChange($event)"
  ></app-permisos-panel>

  <div class="rm-footer">
    <button type="button" class="btn-ghost" (click)="volver()">Cancelar</button>
    <button type="button" class="btn-primary" [disabled]="!nombreForm.trim()" (click)="guardar()">Guardar rol</button>
  </div>
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd front4 && npx ng test --watch=false` (corre toda la suite; no hay forma de filtrar un solo spec con este builder)
Expected: PASS (all 7 tests).

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/usuarios/components/roles-manager
git commit -m "feat(front4): RolesManagerComponent (CRUD de roles, solo super_admin)"
```

---

### Task 9: Wire the "Permisos" button + remove "Permiso por defecto"

**Files:**
- Modify: `front4/src/app/features/usuarios/components/usuarios-list/usuarios-list.component.ts`
- Modify: `front4/src/app/features/usuarios/components/usuarios-list/usuarios-list.component.html`
- Modify: `front4/src/app/features/usuarios/components/usuario-form/usuario-form.component.html`

**Interfaces:**
- Produces: `UsuariosListComponent` gets `@Output() permisos = new EventEmitter<Usuario>();`.
- Consumed by: Task 10.

- [ ] **Step 1: Add the output to `UsuariosListComponent`**

In `front4/src/app/features/usuarios/components/usuarios-list/usuarios-list.component.ts`, add next to the other outputs:

```ts
  @Output() editado        = new EventEmitter<Usuario>();
  @Output() eliminado      = new EventEmitter<string>();
  @Output() suscripciones  = new EventEmitter<Usuario>();
  @Output() permisos       = new EventEmitter<Usuario>();
```

- [ ] **Step 2: Add the "Permisos" button to the template**

In `front4/src/app/features/usuarios/components/usuarios-list/usuarios-list.component.html`, insert this button between the "Editar" button and the "Eliminar" button:

```html
          <button class="btn-icon-label" (click)="editado.emit(u)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            <span>Editar</span>
          </button>
          <button class="btn-icon-label" (click)="permisos.emit(u)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Permisos</span>
          </button>
          <button class="btn-icon-label danger" (click)="eliminado.emit(u._id)">
```

(This replaces the existing `<button class="btn-icon-label danger" (click)="eliminado.emit(u._id)">` line — the new button is inserted immediately before it, the "Eliminar" button and everything below it stays as-is.)

- [ ] **Step 3: Remove "Permiso por defecto" from `usuario-form`**

In `front4/src/app/features/usuarios/components/usuario-form/usuario-form.component.html`, delete this block entirely:

```html
  <label class="field" *ngIf="isEdit">
    <span>Permiso por defecto</span>
    <select [(ngModel)]="form.permiso_acceso" name="permiso_acceso">
      <option value="ver">Ver</option>
      <option value="editar">Editar</option>
    </select>
  </label>
```

- [ ] **Step 4: Run the existing frontend test suite to confirm nothing broke**

Run: `cd front4 && npx ng test --watch=false`
Expected: all existing specs still PASS (no spec covers these two files today, so this is a regression check for the rest of the suite).

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/features/usuarios/components/usuarios-list front4/src/app/features/usuarios/components/usuario-form
git commit -m "feat(front4): botón Permisos en usuarios-list; quita Permiso por defecto del form de edición"
```

---

### Task 10: Wire `usuarios-page` (modals, Roles button, handlers)

**Files:**
- Modify: `front4/src/app/features/usuarios/pages/usuarios-page.component.ts`
- Modify: `front4/src/app/features/usuarios/pages/usuarios-page.component.html`

**Interfaces:**
- Consumes: `RolesService` (Task 6), `PermisosFormComponent` (Task 7), `RolesManagerComponent` (Task 8), `permisos` output on `UsuariosListComponent` (Task 9).

- [ ] **Step 1: Update `usuarios-page.component.ts` imports and injections**

Add these imports:

```ts
import { RolesService } from '../roles.service';
import { PermisosFormComponent } from '../components/permisos-form/permisos-form.component';
import { RolesManagerComponent } from '../components/roles-manager/roles-manager.component';
import { PermisosUsuario, CreateRolDto, UpdateRolDto } from '../../../shared/models/permisos.model';
```

Add `PermisosFormComponent` and `RolesManagerComponent` to the `@Component` `imports` array (alongside `UsuarioFormComponent`, `UsuariosListComponent`, `SuscripcionesFormComponent`).

Add the service injection, next to the other injected services:

```ts
  protected readonly rolesService = inject(RolesService);
```

- [ ] **Step 2: Extend `ModalMode` and the auto-close effect**

Change:

```ts
type ModalMode = 'crear-admin' | 'crear-usuario' | 'editar' | 'suscripciones' | 'buscar' | null;
```

to:

```ts
type ModalMode = 'crear-admin' | 'crear-usuario' | 'editar' | 'suscripciones' | 'buscar' | 'permisos' | 'roles' | null;
```

Update the constructor's effect so the permisos modal also auto-closes on success:

```ts
  constructor() {
    effect(() => {
      if (this.service.status()?.type === 'ok' && (this.modal() === 'suscripciones' || this.modal() === 'permisos')) {
        this.cerrar();
      }
    });
  }
```

- [ ] **Step 3: Load roles on init**

In `ngOnInit()`, add:

```ts
  ngOnInit(): void {
    this.service.cargar();
    this.clientesService.cargar();
    this.centrosService.cargar();
    this.proyectosService.cargar();
    this.rolesService.cargar();
  }
```

- [ ] **Step 4: Add the handler methods**

Add these protected methods (near `abrirSuscripciones`/`guardarSuscripciones`):

```ts
  protected abrirPermisos(usuario: Usuario): void {
    this.service.seleccionado.set(usuario);
    this.service.clearStatus();
    this.modal.set('permisos');
  }

  protected guardarPermisos(permisos: PermisosUsuario): void {
    const id = this.service.seleccionado()?._id;
    if (!id) return;
    this.service.actualizarPermisos(id, permisos);
  }

  protected abrirRoles(): void {
    this.rolesService.clearStatus();
    this.modal.set('roles');
  }

  protected crearRol(dto: CreateRolDto): void {
    this.rolesService.crear(dto);
  }

  protected actualizarRol(evento: { id: string; dto: UpdateRolDto }): void {
    this.rolesService.actualizar(evento.id, evento.dto);
  }

  protected eliminarRol(id: string): void {
    this.rolesService.eliminar(id);
  }
```

- [ ] **Step 5: Add the "Roles" button (super_admin only)**

In `front4/src/app/features/usuarios/pages/usuarios-page.component.html`, inside `.header-actions`, add this button next to the "Crear admin" one (also gated on `esSuperAdmin()`):

```html
    @if (esSuperAdmin()) {
      <button class="btn-ghost" (click)="abrirCrearAdmin()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><line x1="19" y1="8" x2="23" y2="8"/><line x1="21" y1="6" x2="21" y2="10"/></svg>
        Crear admin
      </button>
      <button class="btn-ghost" (click)="abrirRoles()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M12 2 3 7l9 5 9-5-9-5Z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>
        Roles
      </button>
    }
```

- [ ] **Step 6: Bind `(permisos)` on both `<app-usuarios-list>` usages**

There are two usages in this file (main list and "buscar" list). Add `(permisos)="abrirPermisos($event)"` to both, e.g.:

```html
    <app-usuarios-list
      [usuarios]="grupo.usuarios"
      [usuarioActualId]="usuarioActualId()"
      (editado)="abrirEditar($event)"
      (eliminado)="eliminar($event)"
      (suscripciones)="abrirSuscripciones($event)"
      (permisos)="abrirPermisos($event)"
    >
    </app-usuarios-list>
```

and

```html
      <app-usuarios-list
        [usuarios]="usuariosFiltrados()"
        [usuarioActualId]="usuarioActualId()"
        (editado)="editarDesdeBuscar($event)"
        (eliminado)="eliminar($event)"
        (suscripciones)="abrirSuscripciones($event)"
        (permisos)="abrirPermisos($event)"
      >
      </app-usuarios-list>
```

- [ ] **Step 7: Widen the modal for `permisos`/`roles` and add the two new `ng-container` blocks**

Change the modal width binding:

```html
  <div class="modal" [class.modal-ancho]="modal() === 'suscripciones' || modal() === 'permisos' || modal() === 'roles'" (click)="$event.stopPropagation()">
```

Add these two blocks after the "Suscripciones de notificaciones" `ng-container` (before the closing `</div>` of `.modal`):

```html
    <!-- Permisos -->
    <ng-container *ngIf="modal() === 'permisos'">
      <div class="modal-header">
        <h3>Permisos</h3>
        <button class="modal-close" (click)="cerrar()">&#x2715;</button>
      </div>
      <app-status-banner [status]="service.status()"></app-status-banner>
      <app-permisos-form
        [usuario]="service.seleccionado()"
        [roles]="rolesService.roles()"
        (guardado)="guardarPermisos($event)"
        (cancelado)="cerrar()"
      >
      </app-permisos-form>
    </ng-container>

    <!-- Roles -->
    <ng-container *ngIf="modal() === 'roles'">
      <div class="modal-header">
        <h3>Roles</h3>
        <button class="modal-close" (click)="cerrar()">&#x2715;</button>
      </div>
      <app-status-banner [status]="rolesService.status()"></app-status-banner>
      <app-roles-manager
        [roles]="rolesService.roles()"
        (crear)="crearRol($event)"
        (editar)="actualizarRol($event)"
        (eliminar)="eliminarRol($event)"
      >
      </app-roles-manager>
    </ng-container>
```

- [ ] **Step 8: Run the frontend test suite and type-check**

Run: `cd front4 && npx ng test --watch=false && npx tsc --noEmit -p tsconfig.app.json`
Expected: all specs PASS, no type errors.

- [ ] **Step 9: Manual smoke test in the browser**

Run: `cd back4 && npm run start:dev` (terminal 1), `cd front4 && npm start` (terminal 2), then in the browser at `http://localhost:4200/usuarios`:
- Click "Permisos" on a user row → modal opens with the right header (avatar/nombre/chip), sections, switches, and footer counter.
- Toggle a switch, click "Guardar permisos" → modal closes, no console errors.
- Log in as `super_admin` → confirm the "Roles" button is visible; log in as `admin_smartclarity` → confirm it is hidden.
- Open "Roles", create a role, then open "Permisos" on a user and confirm the new role appears in "Aplicar rol" and fills the switches correctly.
- Open "Editar" on a user → confirm "Permiso por defecto" no longer appears.

- [ ] **Step 10: Commit**

```bash
git add front4/src/app/features/usuarios/pages/usuarios-page.component.ts front4/src/app/features/usuarios/pages/usuarios-page.component.html
git commit -m "feat(front4): integra Permisos y Roles en la página de usuarios"
```

---

## Self-Review Notes

- **Spec coverage:** botón Permisos (Task 9/10) · quitar Permiso por defecto (Task 9) · roles como presets + botón Roles solo super_admin (Tasks 1, 6, 8, 10) · campo `permisos` en Usuario + endpoint (Task 2) · seed de roles base (Task 3) · fuera de alcance (enforcement en otros guards) — no se toca en ningún task, confirmado.
- **Type consistency checked:** `PermisosUsuario` (Task 4) used identically in `PermisosPanelComponent` (5), `RolesService`/`UsuariosService` (6), `PermisosFormComponent` (7), `RolesManagerComponent` (8). `Rol._id`/`Rol.nombre`/`Rol.permisos` used consistently across Tasks 6–8, 10. `CreateRolDto`/`UpdateRolDto` shape (`{ nombre, permisos }` / `{ nombre?, permisos? }`) matches between Task 4 (frontend interfaces), Task 8 (`RolesManagerComponent.guardar()`), and Task 1 (backend DTOs — validated independently via class-validator, not shared types, since front/back are separate TS projects).
- **No placeholders:** every step has literal file contents, no "TBD"/"similar to Task N".
