# Diseño: Activos, Eclarity y campo activo en mantenciones

**Fecha:** 2026-05-26  
**Proyecto:** PORTAL4 (Angular 21 + NestJS + MongoDB)

---

## Alcance

Tres cambios independientes sobre el portal:

1. **Sidebar Eclarity** — nueva pestaña de acceso rápido a `https://app.clarityenergy.cl/loginv5/` en ambos modos.
2. **Entidad Activos** — módulo completo (backend + frontend), CRUD en admin, lista read-only en consumidor como 5to recuadro en el detalle de centro de costos.
3. **Activo en mantenciones** — campo opcional `activo_id` en el form de crear/editar mantencion, con selector dependiente del centro seleccionado.

---

## Parte 1 — Sidebar Eclarity

### Comportamiento
- Aparece como último ítem en ambos menús: admin y consumidor.
- Al hacer clic abre `https://app.clarityenergy.cl/loginv5/` en nueva pestaña (`target="_blank" rel="noopener"`).
- Es un enlace externo, no una ruta Angular — no usa `routerLink`.

### Ícono
- Archivo: `/logotipo_eclarity.png` (ya en `front4/public/`).
- Se renderiza como `<img src="/logotipo_eclarity.png" width="16" height="16" style="object-fit:contain">` dentro del span `.icon`.

### Cambios en `sidebar.component.ts`
- Extender `NavItem` con `external?: boolean; href?: string`.
- En el template, usar `@if (item.external)` para renderizar `<a [href]="item.href" target="_blank">` en lugar del `<a routerLink>` estándar.
- Agregar ítem `{ label: 'Eclarity', href: 'https://app.clarityenergy.cl/loginv5/', external: true, icon: 'eclarity' }` al final de `adminItems` y `consumidorItems`.
- Agregar caso `eclarity` en `getIcon()` que retorna el `<img>` sanitizado.

---

## Parte 2 — Entidad Activos

### Backend: `back4/src/activos/`

**Schema** (`activos.schema.ts`):
```
colección: activos
campos:
  nombre:          string, requerido, trim
  tipo_activo:     string, requerido, trim
  centro_costo_id: ObjectId → CentroCosto, requerido
  descripcion:     string, opcional, trim
  activo:          boolean, default true (soft delete)
timestamps: creado_en / actualizado_en
índice: { centro_costo_id: 1, activo: 1 }
```

**DTO** (`activos.dto.ts`):
- `CreateActivoDto`: `@IsString @MinLength(2) nombre`, `@IsString @MinLength(2) tipo_activo`, `@IsMongoId() centro_costo_id`, `@IsString @IsOptional() descripcion`.
- `UpdateActivoDto extends PartialType(CreateActivoDto)`.

**Service** (`activos.service.ts`):
- `findAll(centroCostoId?: string)` — devuelve array plano (sin paginación). Si `centroCostoId`, filtra por `{ centro_costo_id, activo: true }`, si no, devuelve todos activos.
- `findOne(id)`, `create(dto)`, `update(id, dto)`, `remove(id)` — soft delete en `remove` (`{ activo: false }`).
- `.lean()` en todas las queries de lectura.

**Controller** (`activos.controller.ts`):
- `GET /activos?centro_costo_id=` → `findAll(centro_costo_id?)`
- `GET /activos/:id` → `findOne`
- `POST /activos` → `create`
- `PUT /activos/:id` → `update`
- `DELETE /activos/:id` → `remove` (soft delete)

**Module** (`activos.module.ts`): registra schema, exporta service. Registrado en `app.module.ts`.

---

### Frontend: `front4/src/app/features/activos/`

**`activos.service.ts`**:
- Signals: `activos = signal<Activo[]>([])`, `seleccionado = signal<Activo | null>(null)`, `status = signal<Status | null>(null)`, `loading = signal(false)`.
- `cargar(centroCostoId?: string)` — GET con query param opcional.
- `crear`, `actualizar`, `eliminar` (soft delete vía DELETE).
- Respuesta: array plano (no paginado).

**Modelo** en `shared/models/activo.model.ts`:
```ts
export interface Activo {
  _id: string;
  nombre: string;
  tipo_activo: string;
  centro_costo_id: string;
  descripcion?: string;
  activo: boolean;
}
export interface CreateActivoDto { nombre: string; tipo_activo: string; centro_costo_id: string; descripcion?: string; }
export type UpdateActivoDto = Partial<CreateActivoDto>;
```

**`activos-form/activos-form.component.ts`** (dumb):
- `@Input() initial: Activo | null` — para editar.
- `@Input() centroFijo: CentroCosto | null` — cuando se abre desde un centro específico, el campo centro queda fijo y oculto.
- `@Input() centros: CentroCosto[]` — lista para el selector cuando no hay `centroFijo`.
- `@Output() submitted = new EventEmitter<CreateActivoDto>()`.
- Campos: nombre, tipo_activo, descripcion. El `centro_costo_id` se toma de `centroFijo` si existe, o se muestra como selector si no.

**`activos-list/activos-list.component.ts`** (dumb):
- `@Input() activos: Activo[]`, `@Input() mostrarAcciones = true`.
- `@Output() editado`, `@Output() eliminado`.
- Tabla simple: nombre, tipo_activo, descripcion.

**`activos-page.component.ts`** (admin, smart):
- Ruta: `/activos`.
- Modal para crear/editar/buscar, igual que `centros-page`.
- Inyecta `ActivosService` + `CentrosService`.
- Agrega ítem `{ label: 'Activos', route: '/activos' }` al sidebar admin (sin icono — modo admin no usa iconos).

### Parte 2c — Botón "Agregar activo" en centros admin

En la vista admin de centros (`centros-list.component.html`), cada fila/card de centro tiene actualmente botones de editar y eliminar. Se agrega un botón **"+ Activo"** junto a ellos.

Al hacer clic:
- Emite un nuevo `@Output() agregarActivo = new EventEmitter<CentroCosto>()` en `CentrosListComponent`.
- `CentrosPageComponent` recibe ese evento, guarda el centro como `centroParaActivo = signal<CentroCosto | null>(null)`, y abre un modal de creación de activo.

**Modal de activo en centros-page:**
- Se agrega a `centros-page.component.html` un modal adicional (junto a los modales de crear/editar/buscar centro ya existentes).
- El modal muestra un título "Nuevo activo — {centro.nombre}" y renderiza `<app-activos-form>` con `[centroFijo]="centroParaActivo()"`.
- Al enviar el form, llama `activosService.crear(dto)` y cierra el modal cuando el status es `ok` (patrón modal existente con `effect`).
- Al abrir el modal se llama `activosService.clearStatus()`.

`CentrosPageComponent` inyecta `ActivosService` para este flujo.

**Vista consumidor**: no tiene página propia. Se embebe en `mis-centros-page` como recuadro 5 (ver Parte 2b).

---

### Parte 2b — Recuadro 5 "ACTIVOS" en mis-centros (consumidor)

En `mis-centros-page.component.ts`:
- Inyectar `ActivosService`.
- Al seleccionar un centro (`seleccionarCentro(c)`), llamar `activosService.cargar(asId(c._id))`.
- Al volver a la lista, no es necesario limpiar (se recargan al seleccionar otro centro).

En `mis-centros-page.component.html`, en la vista detalle, agregar un nuevo card a ancho completo debajo de los recuadros de Documentos y Solicitudes:

```
<!-- Recuadro 5: Activos del centro -->
<div class="card" style="margin-top:1rem">
  <h3>Activos del centro</h3>
  @if (activosService.activos().length === 0) { Sin activos registrados }
  @else { lista: nombre | tipo | descripcion }
</div>
```

La vista es read-only (sin botones de editar/eliminar).

---

## Parte 3 — Activo en mantenciones

### Backend
- En `mantenciones.schema.ts`: agregar `@Prop({ type: Types.ObjectId, ref: 'Activo' }) activo_id?: Types.ObjectId`.
- En `mantenciones.dto.ts`: agregar `@IsMongoId() @IsOptional() activo_id?: string` en `CreateMantencionDto`.
- El campo es opcional — no rompe mantenciones existentes.
- `MantencionesModule` no necesita importar `ActivosModule` (solo guarda el ObjectId, no hace populate).

### Frontend
En `mantenciones-page.component.ts`:

- Inyectar `ActivosService`.
- Agregar `activo_id: string` al `MantencionForm` y `emptyForm()`.
- Computed `activosParaCentro`: filtra `activosService.activos()` por `centro_costo_id === form().centro_costo_id`. Se actualiza automáticamente al cambiar el centro.
- Al cambiar `centro_costo_id` en el form, resetear `activo_id` a `''`.
- En `ngOnInit`, llamar `activosService.cargar()` para cargar todos los activos (sin filtro — el filtrado es client-side vía computed).

En `mantenciones-page.component.html`, en el formulario de crear/editar mantencion, agregar después del selector de centro:

```html
@if (form().centro_costo_id && activosParaCentro().length > 0) {
  <div class="field">
    <label>Activo (opcional)</label>
    <select [(ngModel)]="form().activo_id" name="activo_id">
      <option value="">— Sin activo —</option>
      @for (a of activosParaCentro(); track a._id) {
        <option [value]="a._id">{{ a.nombre }}</option>
      }
    </select>
  </div>
}
```

El campo no se muestra si no hay centro seleccionado o si ese centro no tiene activos.

---

## Modelo de datos final (Activo)

```
activos
├── _id
├── nombre         string requerido
├── tipo_activo    string requerido
├── centro_costo_id  ObjectId → centros_costos
├── descripcion    string opcional
├── activo         boolean (soft delete)
├── creado_en
└── actualizado_en

mantenciones (campo agregado)
└── activo_id      ObjectId → activos (opcional)
```

---

## Archivos a crear/modificar

### Backend (nuevos)
- `back4/src/activos/activos.schema.ts`
- `back4/src/activos/activos.dto.ts`
- `back4/src/activos/activos.service.ts`
- `back4/src/activos/activos.controller.ts`
- `back4/src/activos/activos.module.ts`

### Backend (modificados)
- `back4/src/mantenciones/mantenciones.schema.ts` — agregar `activo_id`
- `back4/src/mantenciones/mantenciones.dto.ts` — agregar `activo_id`
- `back4/src/app.module.ts` — registrar `ActivosModule`

### Frontend (nuevos)
- `front4/src/app/shared/models/activo.model.ts`
- `front4/src/app/features/activos/activos.service.ts`
- `front4/src/app/features/activos/components/activos-form/activos-form.component.ts`
- `front4/src/app/features/activos/components/activos-list/activos-list.component.ts`
- `front4/src/app/features/activos/pages/activos-page.component.ts`
- `front4/src/app/features/activos/pages/activos-page.component.html`

### Frontend (modificados)
- `front4/src/app/layout/sidebar/sidebar.component.ts` — Eclarity + Activos (admin)
- `front4/src/app/app.routes.ts` — ruta `/activos`
- `front4/src/app/features/centros/components/centros-list/centros-list.component.html` — botón "+ Activo"
- `front4/src/app/features/centros/components/centros-list/centros-list.component.ts` — @Output agregarActivo
- `front4/src/app/features/centros/pages/centros-page.component.html` — modal nuevo activo
- `front4/src/app/features/centros/pages/centros-page.component.ts` — centroParaActivo + ActivosService
- `front4/src/app/features/centros/pages/mis-centros-page.component.html` — recuadro 5
- `front4/src/app/features/centros/pages/mis-centros-page.component.ts` — inyectar ActivosService
- `front4/src/app/features/mantenciones/pages/mantenciones-page.component.ts` — activo_id + computed
- `front4/src/app/features/mantenciones/pages/mantenciones-page.component.html` — selector activo
- `front4/src/app/shared/models/mantencion.model.ts` — agregar activo_id
