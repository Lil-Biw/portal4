# Líder de actividad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un campo opcional "líder de actividad" a `Actividad`, elegible en el paso 1 del wizard solo entre usuarios con rol `admin_smartclarity`/`super_admin`, guardado como snapshot fijo (nombre/email copiados, sin `populate()`), y mostrado en los mismos lugares donde hoy aparece "creado por".

**Architecture:** Sigue exactamente el patrón ya usado para `creado_por` (`back4/src/actividades/actividades.schema.ts`): tres campos nuevos (`lider_id`, `lider_nombre`, `lider_email`) resueltos por un método privado del service (`resolverLider`) análogo a `resolverAutoria`, pero con validación de rol y soporte para reasignar/limpiar en `update()`. En el frontend, el wizard gana un selector single-select con el mismo look del dropdown de "Tipo".

**Tech Stack:** NestJS 10 + Mongoose 8 (back4), Angular 21 standalone + signals (front4). Testing backend: scripts standalone `ts-node` contra una base de datos temporal (no hay Jest en este repo). Testing frontend: sin infra de tests automatizados para esta feature — verificación manual en navegador (sigue la convención ya usada para "creado por").

## Global Constraints

- Elegibles a líder: `rol === 'admin_smartclarity'` o `rol === 'super_admin'` únicamente (spec `docs/superpowers/specs/2026-08-11-lider-actividad-design.md`).
- El campo es opcional — una actividad puede no tener líder.
- Modelo de datos: snapshot fijo (`lider_id`/`lider_nombre`/`lider_email`), sin `populate()`. Se recalcula cada vez que se guarda con un `lider_id` distinto.
- `lider_id: ''` enviado explícitamente en un `update()` significa "quitar el líder" — debe distinguirse de `lider_id` ausente ("no tocar el líder").
- No usar `@IsMongoId()` en el DTO para `lider_id` (rompería el caso `''` con el `ValidationPipe` global) — la validación de formato/existencia/rol vive en `resolverLider()`.
- Sin `any` en código de producción. Sin nuevos índices (no se filtra por líder en ninguna consulta).

---

## Backend

### Task 1: Schema + DTO — campos `lider_id`/`lider_nombre`/`lider_email`

**Files:**
- Modify: `back4/src/actividades/actividades.schema.ts:19-21`
- Modify: `back4/src/actividades/actividades.dto.ts:10-11`

**Interfaces:**
- Produces: `Actividad.lider_id?: Types.ObjectId`, `Actividad.lider_nombre?: string`, `Actividad.lider_email?: string` (schema); `CreateActividadDto.lider_id?: string` (heredado por `UpdateActividadDto`).

- [ ] **Step 1: Agregar los campos al schema**

En `back4/src/actividades/actividades.schema.ts`, después de la línea 21 (`@Prop() creado_por_email?: string;`):

```ts
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) lider_id?: Types.ObjectId;
  @Prop() lider_nombre?: string;
  @Prop() lider_email?: string;
```

- [ ] **Step 2: Agregar el campo al DTO**

En `back4/src/actividades/actividades.dto.ts`, después de la línea 10 (`@IsMongoId() @IsOptional() centro_costo_id?: string;`):

```ts
  // No usar @IsMongoId(): @IsOptional() no salta la validación para '' (solo para
  // undefined/null), y '' es el valor que el frontend manda para "quitar el líder".
  // El formato de ObjectId y la existencia/rol del usuario se validan en
  // ActividadesService.resolverLider().
  @IsOptional() @IsString() lider_id?: string;
```

- [ ] **Step 3: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: compila sin errores (el build de Nest no falla porque `lider_id` es un campo opcional nuevo, no usado todavía por ningún consumidor).

- [ ] **Step 4: Commit**

```bash
cd back4
git add src/actividades/actividades.schema.ts src/actividades/actividades.dto.ts
git commit -m "feat(back4): agregar campos lider_id/lider_nombre/lider_email a Actividad"
```

---

### Task 2: Service — `resolverLider()` y wiring en `create()`/`update()`

**Files:**
- Modify: `back4/src/actividades/actividades.service.ts:1` (import)
- Modify: `back4/src/actividades/actividades.service.ts:166-179` (nuevo método después de `resolverAutoria`)
- Modify: `back4/src/actividades/actividades.service.ts:181-206` (`create()`)
- Modify: `back4/src/actividades/actividades.service.ts:309-332` (`update()`)

**Interfaces:**
- Consumes: `this.usuarioModel` (ya inyectado en el constructor, línea 23) — `Model<{ nombre: string; email: string; rol: string; ... }>`.
- Produces: `private resolverLider(liderId?: string): Promise<{ lider_id?: Types.ObjectId | null; lider_nombre?: string | null; lider_email?: string | null }>`, usado por `create()` y `update()`.

- [ ] **Step 1: Importar `BadRequestException`**

En `back4/src/actividades/actividades.service.ts:1`, cambiar:

```ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
```

por:

```ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
```

- [ ] **Step 2: Agregar `resolverLider()` después de `resolverAutoria` (línea 179)**

```ts
  private async resolverLider(liderId?: string): Promise<{
    lider_id?: Types.ObjectId | null;
    lider_nombre?: string | null;
    lider_email?: string | null;
  }> {
    if (liderId === '') {
      return { lider_id: null, lider_nombre: null, lider_email: null };
    }
    if (!liderId || !Types.ObjectId.isValid(liderId)) return {};
    const usuario = await this.usuarioModel.findById(liderId).select('nombre email rol').lean();
    if (!usuario) {
      throw new BadRequestException('El usuario seleccionado como líder no existe.');
    }
    if (usuario.rol !== 'admin_smartclarity' && usuario.rol !== 'super_admin') {
      throw new BadRequestException('El líder de actividad debe ser un administrador.');
    }
    return {
      lider_id: new Types.ObjectId(liderId),
      lider_nombre: usuario.nombre,
      lider_email: usuario.email,
    };
  }
```

- [ ] **Step 3: Wirear en `create()`**

En `create()` (línea 181-206), agregar la resolución del líder junto a la de autoría y sumarla al spread del documento:

```ts
  async create(dto: CreateActividadDto, creadoPorId?: string): Promise<any> {
    const { notificacion, documentos_nombres, ...actividadData } = dto;
    const autoria = await this.resolverAutoria(creadoPorId);
    const lider = await this.resolverLider(dto.lider_id);
    const a = await new this.actividadModel({
      ...actividadData,
      ...autoria,
      ...lider,
      tipo_id: new Types.ObjectId(actividadData.tipo_id),
      centro_costo_id: new Types.ObjectId(actividadData.centro_costo_id),
      activo_ids: (actividadData.activo_ids ?? []).map(id => new Types.ObjectId(id)),
      fecha: new Date(actividadData.fecha),
      fecha_termino: actividadData.fecha_termino ? new Date(actividadData.fecha_termino) : undefined,
    }).save();
```

(El resto de `create()` no cambia.) `...lider` va después de `...actividadData` a propósito: `actividadData` todavía trae el `lider_id` crudo (string) porque no se desestructura aparte; el spread de `lider` lo pisa con el `ObjectId`/`null` resuelto (o lo deja intacto si `resolverLider` devolvió `{}` por no venir `lider_id`).

- [ ] **Step 4: Wirear en `update()`**

En `update()` (línea 309-332), agregar junto al resto de conversiones de FKs (después de la línea que procesa `activo_ids`, antes de `findByIdAndUpdate`):

```ts
    if (dto.activo_ids !== undefined) {
      payload['activo_ids'] = dto.activo_ids.map(aid => new Types.ObjectId(aid));
    }
    if (dto.lider_id !== undefined) {
      Object.assign(payload, await this.resolverLider(dto.lider_id));
    }
```

El resto de `update()` no cambia. `payload` ya trae `lider_id` crudo desde `{ ...updateData }`; `Object.assign` lo pisa con el resultado resuelto (incluyendo `null` cuando `dto.lider_id === ''`, lo que limpia el líder al persistir).

- [ ] **Step 5: Verificar que compila**

Run: `cd back4 && npm run build`
Expected: compila sin errores.

- [ ] **Step 6: Commit**

```bash
cd back4
git add src/actividades/actividades.service.ts
git commit -m "feat(back4): resolver y validar lider_id en ActividadesService"
```

---

### Task 3: Script de integración `test-lider-actividad.ts`

**Files:**
- Create: `back4/scripts/test-lider-actividad.ts`
- Modify: `back4/package.json:16` (nuevo script)

**Interfaces:**
- Consumes: `ActividadesController.create(centroId, dto, req)` y `ActividadesController.update(actividadId, dto)` (sin cambios de firma — ver `back4/src/actividades/actividades.controller.ts:39-52`).

- [ ] **Step 1: Escribir el script de prueba**

Crear `back4/scripts/test-lider-actividad.ts`:

```ts
// Prueba del campo "líder de actividad": verifica que ActividadesService.resolverLider
// guarde nombre/correo del admin elegido como snapshot fijo (lider_nombre, lider_email),
// rechace usuarios sin rol admin, y permita reasignar o limpiar el líder al editar.
// npm run test:lider-actividad   (usa ts-node; tsx no sirve aquí porque no emite
// la metadata de decoradores que necesitan los schemas de Nest)
//
// Corre contra una base de datos TEMPORAL (portal4_test_lider_actividad) derivada
// del MONGODB_URI del .env; se borra al final. No toca datos reales.
import 'dotenv/config';

const TEST_DB = 'portal4_test_lider_actividad';

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
  const { ActividadesController } = await import('../src/actividades/actividades.controller');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const conn: any = app.get(getConnectionToken());
  const db = conn.db;
  const oid = () => new Types.ObjectId();

  const empresaId = oid();
  const centroId = oid();
  const tipoId = oid();
  const adminId = oid();
  const superAdminId = oid();
  const usuarioId = oid();
  await db.collection('clientes').insertOne({ _id: empresaId, razon_social: 'Empresa Test Líder' });
  await db.collection('centros_costos').insertOne({ _id: centroId, nombre: 'Centro Test', cliente_id: empresaId, codigo: 'C-TEST' });
  await db.collection('tipos_actividad').insertOne({ _id: tipoId, nombre: 'Tipo Test', color: '#4E9AC7' });
  await db.collection('usuarios').insertOne({
    _id: adminId, nombre: 'Admin Líder', email: 'admin-lider@example.com',
    password_hash: 'x', rol: 'admin_smartclarity', activo: true,
  });
  await db.collection('usuarios').insertOne({
    _id: superAdminId, nombre: 'Super Admin Líder', email: 'super-lider@example.com',
    password_hash: 'x', rol: 'super_admin', activo: true,
  });
  await db.collection('usuarios').insertOne({
    _id: usuarioId, nombre: 'Usuario Común', email: 'usuario-comun@example.com',
    password_hash: 'x', rol: 'usuario', activo: true,
  });

  const controller: any = app.get(ActividadesController);

  const dtoBase = {
    nombre: 'Actividad de prueba',
    tipo_id: tipoId.toString(),
    fecha: new Date(Date.now() + 86_400_000).toISOString(),
    notificacion: { notificar: false },
  };
  const reqSinUsuario = { user: undefined } as any;

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  // Caso 1: lider_id de un admin_smartclarity válido → guarda snapshot
  const conLider = await controller.create(
    centroId.toString(),
    { ...dtoBase, lider_id: adminId.toString() },
    reqSinUsuario,
  );
  check(conLider.lider_nombre === 'Admin Líder', 'guarda lider_nombre del admin elegido');
  check(conLider.lider_email === 'admin-lider@example.com', 'guarda lider_email del admin elegido');
  check(String(conLider.lider_id) === adminId.toString(), 'guarda la referencia lider_id');

  // Caso 2: lider_id de un usuario con rol 'usuario' → rechazado
  let error2: any = null;
  try {
    await controller.create(centroId.toString(), { ...dtoBase, lider_id: usuarioId.toString() }, reqSinUsuario);
  } catch (err: any) {
    error2 = err;
  }
  check(!!error2, 'rechaza un lider_id cuyo usuario no es admin');
  check(error2?.status === 400, 'el rechazo es un BadRequestException (400)');

  // Caso 3: sin lider_id → actividad se crea sin líder, sin error
  const sinLider = await controller.create(centroId.toString(), { ...dtoBase }, reqSinUsuario);
  check(!sinLider.lider_nombre, 'sin lider_id no guarda lider_nombre');
  check(!!sinLider._id, 'la actividad se crea igual sin lider_id');

  // Caso 4: editar para reasignar el líder a otro admin → snapshot se actualiza
  const reasignada = await controller.update(String(conLider._id), { lider_id: superAdminId.toString() });
  check(reasignada.lider_nombre === 'Super Admin Líder', 'reasigna el líder y actualiza el nombre');
  check(reasignada.lider_email === 'super-lider@example.com', 'reasigna el líder y actualiza el correo');
  check(String(reasignada.lider_id) === superAdminId.toString(), 'reasigna la referencia lider_id');

  // Caso 5: editar enviando lider_id: '' → limpia el líder
  const limpiada = await controller.update(String(conLider._id), { lider_id: '' });
  check(!limpiada.lider_nombre, "lider_id vacío limpia lider_nombre");
  check(!limpiada.lider_email, "lider_id vacío limpia lider_email");
  check(!limpiada.lider_id, "lider_id vacío limpia la referencia lider_id");

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

- [ ] **Step 2: Agregar el script a `package.json`**

En `back4/package.json:16`, después de `"test:creado-por-actividad": "npx -y ts-node scripts/test-creado-por-actividad.ts",`:

```json
    "test:lider-actividad": "npx -y ts-node scripts/test-lider-actividad.ts",
```

- [ ] **Step 3: Correr el script**

Run: `cd back4 && npm run test:lider-actividad`
Expected: todas las líneas con `✔`, termina con `Todas las verificaciones pasaron ✅` y exit code 0. Si algo falla, revisar `resolverLider()` (Task 2) antes de continuar — no seguir a las tareas de frontend con este script en rojo.

- [ ] **Step 4: Commit**

```bash
cd back4
git add scripts/test-lider-actividad.ts package.json
git commit -m "test(back4): agregar script de integración para lider_id en actividades"
```

---

## Frontend

### Task 4: Modelo — `actividad.model.ts`

**Files:**
- Modify: `front4/src/app/shared/models/actividad.model.ts:23-41` (`Actividad`)
- Modify: `front4/src/app/shared/models/actividad.model.ts:50-64` (`CreateActividadDto`)
- Modify: `front4/src/app/shared/models/actividad.model.ts:66-78` (`UpdateActividadDto`)

**Interfaces:**
- Produces: `Actividad.lider_id?: string`, `Actividad.lider_nombre?: string`, `Actividad.lider_email?: string`; `CreateActividadDto.lider_id?: string`; `UpdateActividadDto.lider_id?: string`.

- [ ] **Step 1: Agregar campos a `Actividad`**

En `front4/src/app/shared/models/actividad.model.ts`, después de la línea 38 (`creado_por_email?: string;`):

```ts
  lider_id?: string;
  lider_nombre?: string;
  lider_email?: string;
```

- [ ] **Step 2: Agregar `lider_id` a `CreateActividadDto`**

Después de la línea 55 (`activo_ids?: string[];` dentro de `CreateActividadDto`):

```ts
  lider_id?: string;
```

- [ ] **Step 3: Agregar `lider_id` a `UpdateActividadDto`**

Después de la línea 71 (`activo_ids?: string[];` dentro de `UpdateActividadDto`):

```ts
  lider_id?: string;
```

- [ ] **Step 4: Verificar que compila**

Run: `cd front4 && npm run build`
Expected: compila sin errores (los campos nuevos son opcionales, no rompen consumidores existentes).

- [ ] **Step 5: Commit**

```bash
cd front4
git add src/app/shared/models/actividad.model.ts
git commit -m "feat(front4): agregar lider_id/lider_nombre/lider_email al modelo de Actividad"
```

---

### Task 5: Componente — form, computed y wiring de `lider_id`

**Files:**
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.ts`

**Interfaces:**
- Consumes: `this.usuariosService.usuarios()` (signal ya inyectado, línea 63) — `Usuario[]` con campo `rol: RolUsuario`.
- Produces: `protected lideresDisponibles: Signal<Usuario[]>`, `protected liderDropdownOpen: WritableSignal<boolean>`, `protected liderSeleccionado: Signal<Usuario | null>`, `seleccionarLider(liderId: string): void` — usados por el HTML de las Tasks 6 y 7.

- [ ] **Step 1: Agregar `lider_id` a `ActividadForm` y `emptyForm()`**

En `actividades-page.component.ts:23-45`, la interfaz queda:

```ts
interface ActividadForm {
  nombre: string;
  descripcion: string;
  tipo_id: string;
  empresa_id: string;
  centro_costo_id: string;
  activo_ids: string[];
  fecha: string;
  fecha_termino: string;
  hora: string;
  hora_termino: string;
  lider_id: string;
}
```

y `emptyForm()`:

```ts
function emptyForm(fecha = ''): ActividadForm {
  return { nombre: '', descripcion: '', tipo_id: '', empresa_id: '', centro_costo_id: '', activo_ids: [], fecha, fecha_termino: '', hora: '', hora_termino: '', lider_id: '' };
}
```

- [ ] **Step 2: Agregar `lideresDisponibles` junto a `superAdminsLista` (línea 154-156)**

```ts
  protected superAdminsLista = computed(() =>
    this.usuariosService.usuarios().filter(u => u.rol === 'super_admin')
  );

  protected lideresDisponibles = computed(() =>
    this.usuariosService.usuarios()
      .filter(u => u.rol === 'admin_smartclarity' || u.rol === 'super_admin')
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  );
```

- [ ] **Step 3: Agregar signal, computed y método del dropdown junto a los de `tipo` (línea 230-239)**

```ts
  protected tipoDropdownOpen   = signal(false);
  protected liderDropdownOpen  = signal(false);

  protected tipoSeleccionado = computed(() =>
    this.tiposService.tipos().find(t => t._id === this.form().tipo_id) ?? null
  );

  protected liderSeleccionado = computed(() =>
    this.lideresDisponibles().find(u => u._id === this.form().lider_id) ?? null
  );

  seleccionarTipo(tipoId: string): void {
    this.patchForm('tipo_id', tipoId);
    this.tipoDropdownOpen.set(false);
  }

  seleccionarLider(liderId: string): void {
    this.patchForm('lider_id', liderId);
    this.liderDropdownOpen.set(false);
  }
```

- [ ] **Step 4: Precargar `lider_id` en `abrirEditar()` (línea 686-697)**

```ts
    this.form.set({
      nombre:          a.nombre,
      descripcion:     a.descripcion ?? '',
      tipo_id:         asId(typeof a.tipo_id === 'object' ? (a.tipo_id as TipoActividad)._id : a.tipo_id),
      empresa_id:      centro ? asId(centro.cliente_id) : '',
      centro_costo_id: centroId,
      activo_ids:      (a.activo_ids ?? []).map(x => asId(typeof x === 'object' ? (x as { _id: string })._id : x)),
      fecha:           a.fecha.slice(0, 10),
      fecha_termino:   a.fecha_termino ? a.fecha_termino.slice(0, 10) : '',
      hora:            a.hora ?? '',
      hora_termino:    a.hora_termino ?? '',
      lider_id:        a.lider_id ?? '',
    });
```

- [ ] **Step 5: Incluir `lider_id` en el DTO de `guardar()` (línea 766-782)**

```ts
    const dto = {
      nombre:          f.nombre.trim(),
      descripcion:     f.descripcion.trim() || undefined,
      tipo_id:         f.tipo_id,
      centro_costo_id: f.centro_costo_id,
      activo_ids:      f.activo_ids.length > 0 ? f.activo_ids : undefined,
      fecha:           f.fecha,
      fecha_termino:   f.fecha_termino || null,
      hora:            f.hora || undefined,
      hora_termino:    f.hora && f.hora_termino ? f.hora_termino : undefined,
      lider_id:        f.lider_id,
      dias_recordatorio: this.diasRecordatorio(),
      // Los docs pendientes se suben tras crear; se mandan los nombres para el correo
      documentos_nombres: !id && this.docsPendientes.length > 0
        ? this.docsPendientes.map(d => d.nombre)
        : undefined,
      notificacion,
    };
```

**Importante:** a diferencia de `descripcion`/`hora` (que usan `|| undefined` para omitir el campo del body cuando están vacíos), `lider_id` se manda siempre tal cual (`f.lider_id`, incluso `''`). Es intencional: al editar una actividad con líder ya asignado, mandar `''` es lo único que le indica al backend "quitar el líder" (ver Task 2, Step 4 — `dto.lider_id !== undefined` es la condición que dispara el recálculo). Si se convirtiera `''` a `undefined` aquí, el backend interpretaría "no tocar el líder" y nunca se podría limpiar desde el wizard.

- [ ] **Step 6: Verificar que compila**

Run: `cd front4 && npm run build`
Expected: compila sin errores.

- [ ] **Step 7: Commit**

```bash
cd front4
git add src/app/features/actividades/pages/actividades-page.component.ts
git commit -m "feat(front4): wiring de lider_id en el form del wizard de actividades"
```

---

### Task 6: Paso 1 — selector de líder

**Files:**
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html:645-646`

**Interfaces:**
- Consumes: `liderDropdownOpen`, `liderSeleccionado`, `lideresDisponibles`, `seleccionarLider(id)`, `patchForm` (Task 5).

- [ ] **Step 1: Insertar el selector como una fila propia, entre el bloque "Tipo" y el bloque "Fecha inicio"**

En `actividades-page.component.html`, entre la línea 645 (`</div>` que cierra el `field-row` de Nombre/Tipo) y la línea 646 (`<div class="field-row">` de Fecha inicio/Hora inicio), insertar:

```html
          <div class="field-row">
            <div class="field">
              <label>Líder de actividad (opcional)</label>
              <div style="position:relative">
                @if (liderDropdownOpen()) {
                  <div style="position:fixed;inset:0;z-index:10" (click)="liderDropdownOpen.set(false)"></div>
                }
                <button type="button" class="tipo-select-btn" (click)="liderDropdownOpen.update(v => !v)">
                  @if (liderSeleccionado()) {
                    <span>{{ liderSeleccionado()!.nombre }}</span>
                  } @else {
                    <span style="color:#9ca3af">Sin líder asignado</span>
                  }
                  <svg style="margin-left:auto;flex-shrink:0;width:14px;height:14px;color:#6b7280;transition:transform .15s"
                    [style.transform]="liderDropdownOpen() ? 'rotate(180deg)' : 'rotate(0)'"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                @if (liderDropdownOpen()) {
                  <div class="tipo-dropdown">
                    <button type="button" class="tipo-option" (click)="seleccionarLider('')">
                      Sin líder asignado
                    </button>
                    @for (u of lideresDisponibles(); track u._id) {
                      <button type="button" class="tipo-option"
                        [class.tipo-option--selected]="form().lider_id === u._id"
                        (click)="seleccionarLider(u._id)">
                        {{ u.nombre }} <span style="color:#9ca3af;font-size:.78rem">({{ u.rol === 'super_admin' ? 'Super admin' : 'Admin' }})</span>
                      </button>
                    }
                    @if (lideresDisponibles().length === 0) {
                      <p style="margin:0;padding:.5rem .75rem;font-size:.82rem;color:#9ca3af">Sin administradores disponibles</p>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
```

Reutiliza `tipo-select-btn`/`tipo-dropdown`/`tipo-option`/`tipo-option--selected` — clases ya definidas en el CSS del componente para el selector de "Tipo"; no se agrega CSS nuevo.

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npm run build`
Expected: compila sin errores de template (Angular type-checks los templates en el build).

- [ ] **Step 3: Commit**

```bash
cd front4
git add src/app/features/actividades/pages/actividades-page.component.html
git commit -m "feat(front4): selector de líder de actividad en el paso 1 del wizard"
```

---

### Task 7: Paso 4 — fila "Líder" en el resumen

**Files:**
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html:919-920`

**Interfaces:**
- Consumes: `liderSeleccionado` (Task 5).

- [ ] **Step 1: Insertar la fila después de "Tipo" (línea 916-919), antes de "Fecha" (línea 920)**

```html
            <div class="wz-resumen-row">
              <span class="wz-resumen-label">Tipo</span>
              <span class="wz-resumen-value">{{ resumenTipoNombre() }}</span>
            </div>
            @if (liderSeleccionado()) {
              <div class="wz-resumen-row">
                <span class="wz-resumen-label">Líder</span>
                <span class="wz-resumen-value">{{ liderSeleccionado()!.nombre }}</span>
              </div>
            }
            <div class="wz-resumen-row">
              <span class="wz-resumen-label">Fecha</span>
              <span class="wz-resumen-value">{{ form().fecha }}</span>
            </div>
```

- [ ] **Step 2: Verificar que compila**

Run: `cd front4 && npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
cd front4
git add src/app/features/actividades/pages/actividades-page.component.html
git commit -m "feat(front4): mostrar el líder en el resumen del paso 4 del wizard"
```

---

### Task 8: Mostrar el líder junto a "creado por" (4 puntos, 2 archivos)

**Files:**
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html:294-299` (popover día, admin)
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html:477-482` (modal detalle, admin)
- Modify: `front4/src/app/features/actividades/pages/mis-actividades-page.component.html:268-273` (popover día, consumidor)
- Modify: `front4/src/app/features/actividades/pages/mis-actividades-page.component.html:385-390` (modal detalle, consumidor)

**Interfaces:**
- Consumes: `Actividad.lider_nombre`/`lider_email` (Task 4) — expuestos en cada archivo bajo la variable de contexto local de ese bloque (`det.a` en los popovers/modal admin, `det` en el popover consumidor, `actividadDetalle()!` en el modal consumidor).

- [ ] **Step 1: Popover día — admin (`actividades-page.component.html:294-299`)**

Después del bloque `@if (det.a.creado_por_nombre) { ... }`:

```html
                @if (det.a.creado_por_nombre) {
                  <div class="cal-day-field">
                    <span class="cal-day-field-label">Creado por</span>
                    <span class="cal-day-field-value creado-por-tag">{{ det.a.creado_por_nombre }} ({{ det.a.creado_por_email }})</span>
                  </div>
                }
                @if (det.a.lider_nombre) {
                  <div class="cal-day-field">
                    <span class="cal-day-field-label">Líder</span>
                    <span class="cal-day-field-value creado-por-tag">{{ det.a.lider_nombre }} ({{ det.a.lider_email }})</span>
                  </div>
                }
```

- [ ] **Step 2: Modal detalle — admin (`actividades-page.component.html:477-482`)**

Después del bloque `@if (det.a.creado_por_nombre) { ... }`:

```html
        @if (det.a.creado_por_nombre) {
          <div class="actividad-detalle-section">
            <p class="actividad-detalle-section-label">Creado por</p>
            <p class="actividad-detalle-descripcion creado-por-tag">{{ det.a.creado_por_nombre }} ({{ det.a.creado_por_email }})</p>
          </div>
        }

        @if (det.a.lider_nombre) {
          <div class="actividad-detalle-section">
            <p class="actividad-detalle-section-label">Líder</p>
            <p class="actividad-detalle-descripcion creado-por-tag">{{ det.a.lider_nombre }} ({{ det.a.lider_email }})</p>
          </div>
        }
```

- [ ] **Step 3: Popover día — consumidor (`mis-actividades-page.component.html:268-273`)**

Después del bloque `@if (det.creado_por_nombre) { ... }`:

```html
              @if (det.creado_por_nombre) {
                <div class="cal-day-field">
                  <span class="cal-day-field-label">Creado por</span>
                  <span class="cal-day-field-value creado-por-tag">{{ det.creado_por_nombre }} ({{ det.creado_por_email }})</span>
                </div>
              }
              @if (det.lider_nombre) {
                <div class="cal-day-field">
                  <span class="cal-day-field-label">Líder</span>
                  <span class="cal-day-field-value creado-por-tag">{{ det.lider_nombre }} ({{ det.lider_email }})</span>
                </div>
              }
```

- [ ] **Step 4: Modal detalle — consumidor (`mis-actividades-page.component.html:385-390`)**

Después del bloque `@if (actividadDetalle()!.creado_por_nombre) { ... }`:

```html
      @if (actividadDetalle()!.creado_por_nombre) {
        <div class="actividad-detalle-section">
          <p class="actividad-detalle-section-label">Creado por</p>
          <p class="actividad-detalle-descripcion creado-por-tag">{{ actividadDetalle()!.creado_por_nombre }} ({{ actividadDetalle()!.creado_por_email }})</p>
        </div>
      }

      @if (actividadDetalle()!.lider_nombre) {
        <div class="actividad-detalle-section">
          <p class="actividad-detalle-section-label">Líder</p>
          <p class="actividad-detalle-descripcion creado-por-tag">{{ actividadDetalle()!.lider_nombre }} ({{ actividadDetalle()!.lider_email }})</p>
        </div>
      }
```

- [ ] **Step 5: Verificar que compila**

Run: `cd front4 && npm run build`
Expected: compila sin errores.

- [ ] **Step 6: Commit**

```bash
cd front4
git add src/app/features/actividades/pages/actividades-page.component.html src/app/features/actividades/pages/mis-actividades-page.component.html
git commit -m "feat(front4): mostrar el líder de actividad junto a 'creado por' en listados y detalle"
```

---

### Task 9: Verificación manual en navegador

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Levantar backend y frontend**

Run: `cd back4 && npm run start:dev` (dejar corriendo)
Run: `cd front4 && npm start` (dejar corriendo, en otra terminal)

- [ ] **Step 2: Probar el flujo de creación**

En el navegador, modo admin → Actividades → "Nueva actividad": en el paso 1, abrir el selector "Líder de actividad", confirmar que solo aparecen usuarios `admin_smartclarity`/`super_admin` (no aparecen usuarios con rol `usuario`), elegir uno. Avanzar hasta el paso 4 y confirmar que la fila "Líder" muestra el nombre elegido. Guardar.

- [ ] **Step 3: Confirmar que se muestra en listados y detalle**

Abrir el día/actividad recién creada en el calendario (vista Mes o Semana) y confirmar que el popover y el modal de detalle muestran "Líder: <nombre> (<email>)" junto a "Creado por". Repetir en modo consumidor (`/mis-actividades`) para la misma actividad, si el usuario de prueba tiene acceso a esa empresa.

- [ ] **Step 4: Probar reasignar y limpiar el líder**

Editar la actividad creada, cambiar el líder por otro admin, guardar, y confirmar que el detalle muestra el nuevo nombre. Editar de nuevo, elegir "Sin líder asignado", guardar, y confirmar que la sección "Líder" desaparece del popover/modal (sin quedar con datos viejos).

- [ ] **Step 5: Confirmar que sigue funcionando sin líder**

Crear una actividad nueva sin tocar el selector de líder (dejarlo en "Sin líder asignado") y confirmar que se crea sin errores y sin sección "Líder" en el detalle.
