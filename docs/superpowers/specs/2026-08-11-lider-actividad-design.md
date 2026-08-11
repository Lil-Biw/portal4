# Líder de actividad — diseño

**Fecha:** 2026-08-11
**Estado:** Aprobado, pendiente de plan de implementación

## Contexto

Hoy `Actividad` solo registra quién la creó (`creado_por` / `creado_por_nombre` / `creado_por_email`, ver `docs/superpowers/plans/2026-07-31-tag-creador-actividad.md`). El creador es quien la agenda, pero no necesariamente quien la lidera. Se pide agregar un campo "líder de actividad", elegible en el paso 1 del wizard de creación/edición, restringido a usuarios con perfil administrador.

## Decisiones

- **Elegibles:** usuarios con `rol === 'admin_smartclarity'` o `rol === 'super_admin'`.
- **Obligatoriedad:** opcional. Una actividad puede quedar sin líder asignado.
- **Modelo de datos:** snapshot fijo (mismo patrón que `creado_por`), no referencia viva con `populate()`. Se copian `lider_nombre`/`lider_email` al momento de guardar. A diferencia de `creado_por` (que sale del JWT y nunca se reescribe), `lider_id` sí puede reasignarse editando la actividad — cada vez que se guarda con un `lider_id` distinto, el snapshot se recalcula.
- **Visibilidad:** se muestra en los mismos lugares donde hoy aparece "creado por" — popover de día y modal de detalle, en ambas vistas (admin y consumidor) — más una fila en el resumen del paso 4 del wizard.

## Backend

### Schema — `back4/src/actividades/actividades.schema.ts`

Agregar junto a los campos de autoría (después de `creado_por_email`, línea 21):

```ts
@Prop({ type: Types.ObjectId, ref: 'Usuario' }) lider_id?: Types.ObjectId;
@Prop() lider_nombre?: string;
@Prop() lider_email?: string;
```

No lleva índice: no se filtra por líder en ninguna consulta existente.

### DTO — `back4/src/actividades/actividades.dto.ts`

En `CreateActividadDto` (heredado automáticamente por `UpdateActividadDto extends PartialType(...)`):

```ts
@IsOptional() @IsString() lider_id?: string;
```

**No se usa `@IsMongoId()`** a propósito: `@IsOptional()` en `class-validator` solo omite la validación cuando el valor es `undefined`/`null`, no cuando es `''` — y se necesita poder enviar `lider_id: ''` para "quitar" el líder de una actividad ya creada (ver `resolverLider` abajo). Con `@IsMongoId()` el `ValidationPipe` global rechazaría ese `''` con 400 antes de llegar al service. En su lugar, la validación de formato de ObjectId y de existencia/rol del usuario se hace enteramente en `resolverLider()`.

### Service — `back4/src/actividades/actividades.service.ts`

Nuevo método privado, calcado de `resolverAutoria` (línea 166) pero con validación de rol:

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

Requiere importar `BadRequestException` desde `@nestjs/common` (línea 1).

**`create()`** (línea 181): junto a `const autoria = await this.resolverAutoria(creadoPorId);`, agregar:
```ts
const lider = await this.resolverLider(actividadData.lider_id);
```
e incluir `...lider` en el objeto pasado a `new this.actividadModel({ ... })` (línea 184-192). `actividadData` ya trae `lider_id` como string por el spread del DTO — como se sobrescribe con `...lider`, no hace falta excluirlo explícitamente, pero para evitar ambigüedad se desestructura fuera igual que `notificacion`/`documentos_nombres` (línea 182):
```ts
const { notificacion, documentos_nombres, lider_id: _liderIdRaw, ...actividadData } = dto;
```

**`update()`** (línea 309): junto al resto de conversiones de FKs (línea 312 en adelante), agregar:
```ts
if (dto.lider_id !== undefined) {
  const lider = await this.resolverLider(dto.lider_id);
  Object.assign(payload, lider);
}
```
(`payload` ya excluye `lider_id` crudo porque `dto.lider_id !== undefined` solo agrega los campos resueltos vía `Object.assign`; el `lider_id` original de `updateData` queda sobrescrito por las mismas keys).

No se toca ningún `.populate()` existente — `lider_id` no se popula porque es snapshot fijo, igual que `creado_por`.

## Frontend

### Modelo — `front4/src/app/shared/models/actividad.model.ts`

En `Actividad`, junto a `creado_por_nombre`/`creado_por_email` (líneas 37-38):
```ts
lider_id?: string;
lider_nombre?: string;
lider_email?: string;
```

En los DTOs de create/update, agregar `lider_id?: string`.

### Formulario — `front4/src/app/features/actividades/pages/actividades-page.component.ts`

`ActividadForm` (líneas 23-33) y `emptyForm()` (líneas 35-45): agregar `lider_id: string` (default `''`).

Nuevo computed, junto a `adminsParaEmpresa`/`superAdminsLista` (líneas 146-156):
```ts
protected lideresDisponibles = computed(() =>
  this.usuariosService.usuarios()
    .filter(u => u.rol === 'admin_smartclarity' || u.rol === 'super_admin')
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
);
```

Nuevo signal `liderDropdownOpen = signal(false)` y computed `liderSeleccionado = computed(() => this.lideresDisponibles().find(u => u._id === this.form().lider_id))`, análogos a `tipoDropdownOpen`/`tipoSeleccionado`.

`abrirEditar()` ya copia todos los campos del `Actividad` recibido al `form` — al agregar `lider_id` al `ActividadForm`/`emptyForm`, queda precargado sin cambios adicionales (mismo mecanismo que hoy usa `tipo_id`).

### Paso 1 — `actividades-page.component.html`

Dentro de "Datos de la actividad" (línea 601-672), agregar un nuevo `field` después del bloque "Tipo" (después de línea 644, antes de cerrar el `field-row` o en su propia fila — usa una fila propia para no apretar el layout junto a Tipo):

```html
<div class="field">
  <label>Líder de actividad (opcional)</label>
  <div style="position:relative">
    @if (liderDropdownOpen()) {
      <div style="position:fixed;inset:0;z-index:10" (click)="liderDropdownOpen.set(false)"></div>
    }
    <button type="button" class="tipo-select-btn" (click)="liderDropdownOpen.update(v => !v)">
      @if (liderSeleccionado()) {
        <span>{{ liderSeleccionado()!.nombre }}</span>
        <span class="wz-badge">{{ liderSeleccionado()!.rol === 'super_admin' ? 'Super admin' : 'Admin' }}</span>
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
        <button type="button" class="tipo-option" (click)="patchForm('lider_id', ''); liderDropdownOpen.set(false)">
          Sin líder asignado
        </button>
        @for (u of lideresDisponibles(); track u._id) {
          <button type="button" class="tipo-option"
            [class.tipo-option--selected]="form().lider_id === u._id"
            (click)="patchForm('lider_id', u._id); liderDropdownOpen.set(false)">
            {{ u.nombre }}
          </button>
        }
      </div>
    }
  </div>
</div>
```

Reutiliza las clases CSS existentes `tipo-select-btn` / `tipo-dropdown` / `tipo-option` / `tipo-option--selected` (ya definidas para el selector de Tipo) — no se agrega CSS nuevo.

### Paso 4 — Resumen

Junto a la fila "Tipo" (línea 916-919), agregar:
```html
@if (liderSeleccionado()) {
  <div class="wz-resumen-row">
    <span class="wz-resumen-label">Líder</span>
    <span class="wz-resumen-value">{{ liderSeleccionado()!.nombre }}</span>
  </div>
}
```

### Mostrar el líder junto al creador

En los 4 puntos donde hoy se muestra `.creado-por-tag`, agregar una etiqueta análoga para el líder (solo si `lider_nombre` existe), reutilizando la misma clase visual (`.creado-por-tag`, sin crear una clase nueva ya que el tratamiento es idéntico):

- `actividades-page.component.html:294-297` (popover día, admin)
- `actividades-page.component.html:477-480` (modal detalle, admin)
- `mis-actividades-page.component.html:268-271` (popover día, consumidor)
- `mis-actividades-page.component.html:385-388` (modal detalle, consumidor)

Patrón (ejemplo para el popover admin, línea 294):
```html
@if (det.a.creado_por_nombre) {
  <span class="cal-day-field-label">Creado por</span>
  <span class="cal-day-field-value creado-por-tag">{{ det.a.creado_por_nombre }} ({{ det.a.creado_por_email }})</span>
}
@if (det.a.lider_nombre) {
  <span class="cal-day-field-label">Líder</span>
  <span class="cal-day-field-value creado-por-tag">{{ det.a.lider_nombre }} ({{ det.a.lider_email }})</span>
}
```

Repetir el mismo patrón `@if (X.lider_nombre) { ... }` en los otros 3 puntos, usando la variable de contexto local de cada bloque (`det.a` en los popovers admin/consumidor, `actividadDetalle()!` en los modales).

## Fuera de alcance

- No se agrega filtro por líder en listados/calendario.
- No se notifica por correo al líder asignado (el sistema de notificaciones ya existente sigue basado en centro/destinatarios elegidos en el paso 2, sin cambios).
- No se restringe la edición de actividades a que solo el líder pueda modificarlas — sigue rigiendo `@Roles('super_admin', 'admin_smartclarity')` sin cambios de permisos.

## Testing

Siguiendo el patrón del repo (sin Jest, scripts standalone con `ts-node` contra `MONGODB_URI`), agregar `back4/scripts/test-lider-actividad.ts` calcado de `back4/scripts/test-creado-por-actividad.ts`, cubriendo:
1. Crear actividad con `lider_id` de un `admin_smartclarity` válido → snapshot correcto.
2. Crear actividad con `lider_id` de un usuario con `rol: 'usuario'` → rechazado con `BadRequestException`.
3. Crear actividad sin `lider_id` → actividad queda sin líder, sin error.
4. Editar actividad para reasignar `lider_id` a otro admin → snapshot se actualiza.
5. Editar actividad enviando `lider_id: ''` → snapshot se limpia (líder queda `null`).
