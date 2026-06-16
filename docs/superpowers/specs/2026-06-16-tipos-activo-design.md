# Tipos de Activo — Spec

**Fecha:** 2026-06-16
**Rama:** feat/restructuracion-rutas

## Resumen

Añadir un catálogo predefinido de tipos de activo (`TipoActivo`) con nombre y color, gestionable solo por `super_admin`. El campo `tipo_activo` (string libre) en la entidad `Activo` se reemplaza por una FK `tipo_activo_id` que referencia `TipoActivo`. El formulario de activo pasa de texto libre a un `<select>` con los tipos predefinidos.

El patrón es idéntico al de `TipoActividad` en el módulo de actividades.

---

## Backend

### Nuevo módulo `tipos-activo`

Cinco archivos siguiendo el patrón estándar del proyecto:

**`tipos-activo.schema.ts`**
- Colección: `tipos_activo`
- Campos: `nombre` (string, required, trim), `color` (string, required, default `'#0095d6'`)
- Timestamps: `creado_en` / `actualizado_en`
- Índice: ninguno adicional requerido

**`tipos-activo.dto.ts`**
- `CreateTipoActivoDto`: `nombre` (@IsString, @MinLength(2)), `color` (@IsString, @IsOptional con default)
- `UpdateTipoActivoDto extends PartialType(CreateTipoActivoDto)`

**`tipos-activo.service.ts`**
- `findAll()`: array plano (sin paginación, igual que `tipos-mantencion`)
- `create(dto)`, `update(id, dto)`, `remove(id)`
- Hard delete (igual que `tipos-mantencion`)

**`tipos-activo.controller.ts`**
- `GET /tipos-activo` — sin restricción de rol (todos los roles necesitan listar)
- `POST /tipos-activo` — `@Roles('super_admin')`
- `PUT /tipos-activo/:id` — `@Roles('super_admin')`
- `DELETE /tipos-activo/:id` — `@Roles('super_admin')`

**`tipos-activo.module.ts`**
- Registrar en `app.module.ts`

### Cambios en módulo `activos`

**`activos.schema.ts`**
- Eliminar `@Prop({ required: true, trim: true }) tipo_activo: string`
- Añadir `@Prop({ type: Types.ObjectId, ref: 'TipoActivo', required: true }) tipo_activo_id: Types.ObjectId`

**`activos.dto.ts`**
- `tipo_activo: string` → `tipo_activo_id: string` con `@IsMongoId()`

**`activos.service.ts`**
- Añadir `.populate('tipo_activo_id')` en `findAll` y `findOne`
- Actualizar referencias a `tipo_activo` por `tipo_activo_id` en create/update

**`activos.module.ts`**
- Importar `TiposActivoModule` (para populate)

### Script de migración

`back4/scripts/migrate-tipos-activo.js`:
1. Leer todos los activos existentes con campo `tipo_activo` (string)
2. Extraer nombres únicos
3. Crear un `TipoActivo` por cada nombre único (color default)
4. Actualizar cada activo: `tipo_activo_id = id_del_tipo_creado`, eliminar `tipo_activo`

---

## Frontend

### Modelo (`shared/models/activo.model.ts`)

```ts
export interface TipoActivo {
  _id: string;
  nombre: string;
  color: string;
}
export interface CreateTipoActivoDto { nombre: string; color: string; }
export type UpdateTipoActivoDto = Partial<CreateTipoActivoDto>;
```

`Activo.tipo_activo: string` → `Activo.tipo_activo_id: string | TipoActivo`
`CreateActivoDto.tipo_activo: string` → `CreateActivoDto.tipo_activo_id: string`

### Nuevo service (`features/activos/tipos-activo.service.ts`)

Signals: `tipos = signal<TipoActivo[]>([])`, `loading`, `status`.
Métodos: `cargar()`, `crear(dto)`, `actualizar(id, dto)`, `eliminar(id)`.
Patrón idéntico a `TiposActividadService`.

### `activos-page.component`

**Header:**
- Botón "Tipos" visible solo para `super_admin` (computed `puedeGestionarTipos` usando `AuthService`), junto a los botones existentes "Buscar" y "+ Crear".

**Panel inline de tipos** (mismo patrón que actividades-page):
- Signals: `showTipos`, `showTipoForm`, `editingTipoId`, `tipoForm = signal<{nombre,color}>`
- Métodos: `toggleTipos()`, `abrirNuevoTipo()`, `abrirEditarTipo(t)`, `cerrarTipoForm()`, `guardarTipo()`, `eliminarTipo(id)`

**`ngOnInit`:** añadir `tiposService.cargar()`

**Imports:** añadir `TiposActivoService`, `AuthService`

### `activos-form.component`

- Añadir `@Input() tipos: TipoActivo[] = []`
- Campo `tipo_activo` (text input) → `<select>` sobre `tipos`
- Form interno: `tipo_activo_id: string` en lugar de `tipo_activo: string`
- El DTO emitido en `submitted` usa `tipo_activo_id`

### `activos-list.component`

- Añadir `@Input() tipos: TipoActivo[] = []`
- Resolver nombre del tipo: `tipos.find(t => t._id === asId(activo.tipo_activo_id))?.nombre`
- Mostrar punto de color del tipo (igual al chip de color en actividades)

### `activosFiltrados` (activos-page)

El filtro por texto busca en `nombre` del activo y en el nombre del tipo resuelto desde `tiposService.tipos()`.

---

## Flujo de datos

```
TiposActivoService.cargar() → GET /tipos-activo → tipos[]
                                                      ↓
activos-page → [tipos] → activos-form (select) → tipo_activo_id
                       → activos-list (display nombre+color)
```

---

## Consideraciones

- Activos sin migrar (campo `tipo_activo` legacy) no se contemplan en el frontend. El script de migración debe ejecutarse antes de desplegar.
- El color del tipo se muestra en la lista de activos como indicador visual (punto coloreado), no como fondo completo.
- Si no hay tipos creados, el select del form mostrará vacío y el form no podrá guardarse (campo requerido).
