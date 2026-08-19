# Tag "creado por" en actividades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Al crear una actividad, guardar y mostrar (en admin y consumidor) el nombre y correo de quién la creó, para poder identificarlo y contactarlo ante consultas o reclamos.

**Architecture:** Snapshot fijo en el schema de `Actividad` (no referencia viva): al crear, el controller extrae el id del usuario autenticado del JWT (`req.user.sub`) y el service busca su nombre/correo en la colección `usuarios` para copiarlos al documento. El frontend solo lee esos dos campos ya guardados — no hace falta `populate` ni lookup adicional. Se muestra en los 4 puntos donde hoy se ve el detalle de una actividad seleccionada (admin: vista Día + modal; consumidor: vista Día + modal).

**Tech Stack:** NestJS 10 + Mongoose 8 (back4), Angular 21 standalone + signals (front4). Sin framework de test unitario en back4 (no hay Jest configurado) — la verificación backend sigue el patrón existente del repo: script standalone con `ts-node` contra una base de datos temporal (ver `back4/scripts/test-recordatorios.ts`).

## Global Constraints

- Los 3 campos nuevos (`creado_por`, `creado_por_nombre`, `creado_por_email`) son **opcionales** — actividades creadas antes de este cambio no los tienen y no deben romper nada.
- Es un **snapshot fijo**, no una referencia resuelta en vivo: si el usuario cambia de nombre/correo o es desactivado después, el tag de la actividad no cambia.
- Solo se registra quién **creó** la actividad — no se agrega tracking de quién la modificó después (fuera de alcance).
- No se agrega búsqueda/filtro por creador — el dato solo se muestra en el detalle de cada actividad (fuera de alcance).
- El tag debe verse tanto en la vista **admin** como en la vista **consumidor** ("Mis actividades").
- El creador nunca viene del body del request (`CreateActividadDto` no lo incluye) — siempre sale de `req.user.sub` (JWT), para que no se pueda falsificar desde el frontend.
- Spec de referencia: `docs/superpowers/specs/2026-07-31-tag-creador-actividad-design.md`.

---

## File Structure

- Modify `back4/src/actividades/actividades.schema.ts` — 3 props nuevas.
- Modify `back4/src/actividades/actividades.service.ts` — nuevo método privado `resolverAutoria`, usado en `create()`.
- Modify `back4/src/actividades/actividades.controller.ts` — `ActividadesController.create` extrae `req.user.sub`.
- Create `back4/scripts/test-creado-por-actividad.ts` — script de verificación end-to-end (sigue el patrón de `test-recordatorios.ts`).
- Modify `back4/package.json` — nuevo script `test:creado-por-actividad`.
- Modify `front4/src/app/shared/models/actividad.model.ts` — 2 campos nuevos en `Actividad`.
- Modify `front4/src/app/features/actividades/pages/actividades-page.component.html` — tag en vista Día y modal (admin).
- Modify `front4/src/app/features/actividades/pages/mis-actividades-page.component.html` — tag en vista Día y modal (consumidor).

---

### Task 1: Backend — persistir el creador al crear una actividad

**Files:**
- Modify: `back4/src/actividades/actividades.schema.ts`
- Modify: `back4/src/actividades/actividades.service.ts:144` (método `create`)
- Modify: `back4/src/actividades/actividades.controller.ts:33-37` (método `create` de `ActividadesController`)
- Create: `back4/scripts/test-creado-por-actividad.ts`
- Modify: `back4/package.json`

**Interfaces:**
- Produces: `Actividad.creado_por?: Types.ObjectId`, `Actividad.creado_por_nombre?: string`, `Actividad.creado_por_email?: string` — usados por el frontend en las Tasks 2 y 3 (llegan tal cual en cualquier `GET` de actividad, sin `populate`).
- Produces: `ActividadesService.create(dto: CreateActividadDto, creadoPorId?: string): Promise<any>` — nueva firma con segundo parámetro opcional.

- [ ] **Step 1: Agregar los 3 campos al schema**

En `back4/src/actividades/actividades.schema.ts`, agregar después de `hora_termino`:

```ts
  @Prop({ type: Types.ObjectId, ref: 'Usuario' }) creado_por?: Types.ObjectId;
  @Prop() creado_por_nombre?: string;
  @Prop() creado_por_email?: string;
```

- [ ] **Step 2: Agregar `resolverAutoria` y usarlo en `create()`**

En `back4/src/actividades/actividades.service.ts`, agregar este método privado justo antes de `async create(...)`:

```ts
  private async resolverAutoria(creadoPorId?: string): Promise<{
    creado_por?: Types.ObjectId;
    creado_por_nombre?: string;
    creado_por_email?: string;
  }> {
    if (!creadoPorId) return {};
    const usuario = await this.usuarioModel.findById(creadoPorId).select('nombre email').lean();
    if (!usuario) return {};
    return {
      creado_por: new Types.ObjectId(creadoPorId),
      creado_por_nombre: usuario.nombre,
      creado_por_email: usuario.email,
    };
  }
```

Modificar la firma y el cuerpo de `create` (reemplazar el método completo):

```ts
  async create(dto: CreateActividadDto, creadoPorId?: string): Promise<any> {
    const { notificacion, documentos_nombres, ...actividadData } = dto;
    const autoria = await this.resolverAutoria(creadoPorId);
    const a = await new this.actividadModel({
      ...actividadData,
      ...autoria,
      tipo_id: new Types.ObjectId(actividadData.tipo_id),
      centro_costo_id: new Types.ObjectId(actividadData.centro_costo_id),
      activo_ids: (actividadData.activo_ids ?? []).map(id => new Types.ObjectId(id)),
      fecha: new Date(actividadData.fecha),
      fecha_termino: actividadData.fecha_termino ? new Date(actividadData.fecha_termino) : undefined,
    }).save();

    const result = await this.actividadModel.findById(a._id).populate('tipo_id').lean();

    const dias_recordatorio = actividadData.dias_recordatorio ?? [];
    await this.recordatoriosService.sincronizar(
      'actividad', a._id, dias_recordatorio, a.fecha_termino ?? a.fecha,
    );

    if (actividadData.centro_costo_id) {
      await this.notificarUsuariosCentro(actividadData.centro_costo_id, result!, notificacion, documentos_nombres);
    }

    return { ...result, dias_recordatorio };
  }
```

(El único cambio real respecto al método actual es agregar `const autoria = await this.resolverAutoria(creadoPorId);` y `...autoria,` dentro del objeto que arma `new this.actividadModel(...)`, más el segundo parámetro `creadoPorId?: string` en la firma.)

- [ ] **Step 3: Wire del controller — extraer `req.user.sub`**

En `back4/src/actividades/actividades.controller.ts`, reemplazar el método `create` de `ActividadesController` (líneas 33-37):

```ts
  @Post()
  @Roles('super_admin', 'admin_smartclarity')
  create(
    @Param('centroId') centroId: string,
    @Body() dto: CreateActividadDto,
    @Req() req: Request,
  ) {
    const creadoPorId = (req as any)?.user?.sub as string | undefined;
    return this.service.create({ ...dto, centro_costo_id: centroId }, creadoPorId);
  }
```

`Req` y `Request` ya están importados en este archivo (líneas 3 y 6) — no hace falta agregar imports.

- [ ] **Step 4: Escribir el script de verificación**

Crear `back4/scripts/test-creado-por-actividad.ts`:

```ts
// Prueba del tag "creado por" en actividades: verifica que ActividadesController.create
// persista nombre/correo del usuario autenticado como snapshot fijo (creado_por_nombre,
// creado_por_email), y que la creación no falle si no hay usuario o no se encuentra.
// npm run test:creado-por-actividad   (usa ts-node; tsx no sirve aquí porque no emite
// la metadata de decoradores que necesitan los schemas de Nest)
//
// Corre contra una base de datos TEMPORAL (portal4_test_creado_por_actividad) derivada
// del MONGODB_URI del .env; se borra al final. No toca datos reales.
import 'dotenv/config';

const TEST_DB = 'portal4_test_creado_por_actividad';

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
  const usuarioId = oid();
  await db.collection('clientes').insertOne({ _id: empresaId, razon_social: 'Empresa Test Creador' });
  await db.collection('centros_costos').insertOne({ _id: centroId, nombre: 'Centro Test', cliente_id: empresaId, codigo: 'C-TEST' });
  await db.collection('tipos_actividad').insertOne({ _id: tipoId, nombre: 'Tipo Test', color: '#4E9AC7' });
  await db.collection('usuarios').insertOne({
    _id: usuarioId, nombre: 'Admin Creador', email: 'admin-creador@example.com',
    password_hash: 'x', rol: 'admin_smartclarity', activo: true,
  });

  const controller: any = app.get(ActividadesController);

  const dtoBase = {
    nombre: 'Actividad de prueba',
    tipo_id: tipoId.toString(),
    fecha: new Date(Date.now() + 86_400_000).toISOString(),
    notificacion: { notificar: false },
  };

  let fallas = 0;
  const check = (ok: boolean, msg: string) => {
    console.log(`  ${ok ? '✔' : '✘ FALLA:'} ${msg}`);
    if (!ok) fallas++;
  };

  // Caso 1: usuario autenticado válido → guarda snapshot
  const conCreador = await controller.create(
    centroId.toString(),
    { ...dtoBase },
    { user: { sub: usuarioId.toString() } } as any,
  );
  check(conCreador.creado_por_nombre === 'Admin Creador', 'guarda creado_por_nombre del usuario autenticado');
  check(conCreador.creado_por_email === 'admin-creador@example.com', 'guarda creado_por_email del usuario autenticado');
  check(String(conCreador.creado_por) === usuarioId.toString(), 'guarda la referencia creado_por');

  // Caso 2: sin usuario autenticado (req sin user) → crea igual, sin campos de autoría
  const sinCreador = await controller.create(
    centroId.toString(),
    { ...dtoBase },
    { user: undefined } as any,
  );
  check(!sinCreador.creado_por_nombre, 'sin req.user no guarda creado_por_nombre');
  check(!!sinCreador._id, 'la actividad se crea igual sin req.user');

  // Caso 3: creadoPorId que no matchea ningún usuario → crea igual, sin campos de autoría
  const idInexistente = oid().toString();
  const creadorInexistente = await controller.create(
    centroId.toString(),
    { ...dtoBase },
    { user: { sub: idInexistente } } as any,
  );
  check(!creadorInexistente.creado_por_nombre, 'con un id de usuario inexistente no guarda creado_por_nombre');
  check(!!creadorInexistente._id, 'la actividad se crea igual con un id de usuario inexistente');

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

- [ ] **Step 5: Registrar el script en `package.json` y correrlo para verificar que falla antes del fix**

Antes de aplicar los Steps 1-3 (o revirtiéndolos temporalmente), correr el script para confirmar que las verificaciones del Caso 1 (`guarda creado_por_nombre...`, `guarda creado_por_email...`, `guarda la referencia creado_por`) fallan — porque el schema/service/controller aún no persisten esos campos.

En `back4/package.json`, agregar dentro de `"scripts"` (junto a `test:recordatorios`):

```json
    "test:creado-por-actividad": "npx -y ts-node scripts/test-creado-por-actividad.ts",
```

Run: `cd back4 && npm run test:creado-por-actividad`
Expected (con Steps 1-3 aún NO aplicados): las 3 verificaciones del Caso 1 muestran `✘ FALLA` porque `creado_por_nombre`/`creado_por_email`/`creado_por` no existen en el resultado.

- [ ] **Step 6: Aplicar Steps 1-3 (si se revirtieron para el Step 5) y correr el script de nuevo**

Run: `cd back4 && npm run test:creado-por-actividad`
Expected: `Todas las verificaciones pasaron ✅`, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add back4/src/actividades/actividades.schema.ts back4/src/actividades/actividades.service.ts back4/src/actividades/actividades.controller.ts back4/scripts/test-creado-por-actividad.ts back4/package.json
git commit -m "feat(back): registrar creador (nombre/correo) al crear una actividad"
```

---

### Task 2: Frontend — modelo + mostrar el tag en la vista admin

**Files:**
- Modify: `front4/src/app/shared/models/actividad.model.ts:22-38` (interfaz `Actividad`)
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html:290-293` (vista Día)
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html:460-469` (modal resumen)

**Interfaces:**
- Consumes: `creado_por_nombre?: string`, `creado_por_email?: string` ya devueltos por la API (Task 1).
- Produces: `Actividad.creado_por_nombre?: string`, `Actividad.creado_por_email?: string` en el modelo del frontend — usados también por Task 3.

- [ ] **Step 1: Agregar los campos al modelo**

En `front4/src/app/shared/models/actividad.model.ts`, en la interfaz `Actividad`, agregar antes de `creado_en?: string;`:

```ts
  creado_por_nombre?: string;
  creado_por_email?: string;
```

- [ ] **Step 2: Mostrar el tag en la vista Día (admin)**

En `front4/src/app/features/actividades/pages/actividades-page.component.html`, dentro de `.cal-day-detail-fields`, insertar justo después del bloque de "Centro de costos" (después de la línea que cierra en `</div>` en la línea 293) y antes del `@if (det.a.descripcion)`:

```html
                <div class="cal-day-field">
                  <span class="cal-day-field-label">Centro de costos</span>
                  <span class="cal-day-field-value">{{ det.centro?.nombre ?? '—' }}</span>
                </div>
                @if (det.a.creado_por_nombre) {
                  <div class="cal-day-field">
                    <span class="cal-day-field-label">Creado por</span>
                    <span class="cal-day-field-value">{{ det.a.creado_por_nombre }} ({{ det.a.creado_por_email }})</span>
                  </div>
                }
                @if (det.a.descripcion) {
```

- [ ] **Step 3: Mostrar el tag en el modal de resumen (admin)**

En el mismo archivo, dentro del bloque `<!-- Modal de resumen (clic en Mes/Semana) -->`, después del segundo `.actividad-detalle-grid` (Empresa / Centro de costos, que cierra en la línea 469) y antes de `<!-- Descripción -->`:

```html
        <!-- Empresa -->
        <div class="actividad-detalle-grid">
          <div class="actividad-detalle-box-field">
            <p class="actividad-detalle-field-label">Empresa</p>
            <p class="actividad-detalle-field-value">{{ det.empresa?.razon_social ?? '—' }}</p>
          </div>
          <div class="actividad-detalle-box-field">
            <p class="actividad-detalle-field-label">Centro de costos</p>
            <p class="actividad-detalle-field-value">{{ det.centro?.nombre ?? '—' }}</p>
          </div>
        </div>

        @if (det.a.creado_por_nombre) {
          <div class="actividad-detalle-section">
            <p class="actividad-detalle-section-label">Creado por</p>
            <p class="actividad-detalle-descripcion">{{ det.a.creado_por_nombre }} ({{ det.a.creado_por_email }})</p>
          </div>
        }

        <!-- Descripción -->
```

- [ ] **Step 4: Verificación manual en el navegador**

Run: `cd back4 && npm run start:dev` (en una terminal) y `cd front4 && npm start` (en otra).

En el navegador, loguearse como `super_admin` o `admin_smartclarity`, ir a Actividades (modo admin), crear una actividad nueva en cualquier centro. Confirmar:
- En la vista Día, al seleccionar la actividad recién creada, aparece la fila "Creado por: {tu nombre} ({tu correo})".
- Al hacer clic en el mismo evento desde la vista Mes o Semana, el modal de resumen también muestra "Creado por: {tu nombre} ({tu correo})".
- Al abrir una actividad creada antes de este cambio (si existe alguna de prueba), no aparece la fila "Creado por" y el resto del panel se ve igual que antes (sin espacios vacíos ni errores en consola).

Expected: los 3 puntos se cumplen, sin errores en la consola del navegador.

- [ ] **Step 5: Commit**

```bash
git add front4/src/app/shared/models/actividad.model.ts front4/src/app/features/actividades/pages/actividades-page.component.html
git commit -m "feat(front): mostrar tag \"creado por\" en el detalle de actividades (admin)"
```

---

### Task 3: Frontend — mostrar el tag en la vista consumidor

**Files:**
- Modify: `front4/src/app/features/actividades/pages/mis-actividades-page.component.html:264-267` (vista Día)
- Modify: `front4/src/app/features/actividades/pages/mis-actividades-page.component.html:366-377` (modal detalle)

**Interfaces:**
- Consumes: `Actividad.creado_por_nombre?: string`, `Actividad.creado_por_email?: string` del modelo (Task 2).

- [ ] **Step 1: Mostrar el tag en la vista Día (consumidor)**

En `front4/src/app/features/actividades/pages/mis-actividades-page.component.html`, dentro de `.cal-day-detail-fields`, insertar justo después del bloque de "Centro de costos" y antes del `@if (det.descripcion)`:

```html
              <div class="cal-day-field">
                <span class="cal-day-field-label">Centro de costos</span>
                <span class="cal-day-field-value">{{ centroNombre(det) }}</span>
              </div>
              @if (det.creado_por_nombre) {
                <div class="cal-day-field">
                  <span class="cal-day-field-label">Creado por</span>
                  <span class="cal-day-field-value">{{ det.creado_por_nombre }} ({{ det.creado_por_email }})</span>
                </div>
              }
              @if (det.descripcion) {
```

- [ ] **Step 2: Mostrar el tag en el modal de detalle (consumidor)**

En el mismo archivo, dentro de `<!-- Modal de detalle de actividad -->`, después del `.actividad-detalle-grid` de Fecha/Tipo y antes de `<!-- Descripción -->`:

```html
      <!-- Datos principales -->
      <div class="actividad-detalle-grid">
        <div class="actividad-detalle-box-field">
          <p class="actividad-detalle-field-label">Fecha</p>
          <p class="actividad-detalle-field-value">
            {{ actividadDetalle()!.fecha | slice:0:10 }}{{ actividadDetalle()!.fecha_termino ? ' – ' + (actividadDetalle()!.fecha_termino | slice:0:10) : '' }}{{ actividadDetalle()!.hora ? ' · ' + rangoHora(actividadDetalle()!) + ' hrs' : '' }}
          </p>
        </div>
        <div class="actividad-detalle-box-field">
          <p class="actividad-detalle-field-label">Tipo</p>
          <p class="actividad-detalle-field-value">{{ tipoDeActividad(actividadDetalle()!)?.nombre ?? '—' }}</p>
        </div>
      </div>

      @if (actividadDetalle()!.creado_por_nombre) {
        <div class="actividad-detalle-section">
          <p class="actividad-detalle-section-label">Creado por</p>
          <p class="actividad-detalle-descripcion">{{ actividadDetalle()!.creado_por_nombre }} ({{ actividadDetalle()!.creado_por_email }})</p>
        </div>
      }

      <!-- Descripción -->
```

- [ ] **Step 3: Verificación manual en el navegador**

Con backend y frontend corriendo (Task 2, Step 4), loguearse como un usuario `usuario` (consumidor) de la misma empresa del centro donde se creó la actividad de prueba en la Task 2. Ir a "Mis actividades". Confirmar:
- En la vista Día, al seleccionar esa actividad, aparece "Creado por: {nombre del admin que la creó} ({su correo})".
- Al hacer clic en el mismo evento desde vista Mes/Semana, el modal también muestra el tag.
- Una actividad antigua (sin el campo) no muestra la fila ni rompe el modal.

Expected: los 3 puntos se cumplen, sin errores en la consola del navegador.

- [ ] **Step 4: Commit**

```bash
git add front4/src/app/features/actividades/pages/mis-actividades-page.component.html
git commit -m "feat(front): mostrar tag \"creado por\" en el detalle de actividades (consumidor)"
```
