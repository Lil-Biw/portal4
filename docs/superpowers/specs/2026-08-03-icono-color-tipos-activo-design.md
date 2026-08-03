# Ícono y color personalizables en tipos de activo

## Contexto

`tipos-actividad` y `tipos-proyecto` ya migraron de un selector de color simple (o swatches fijos) a un esquema de `icono` (catálogo cerrado de 12 claves) + `color` (hex libre validado). `tipos-activo` es el tercer y último módulo hermano pendiente de esta migración: hoy `TipoActivo` solo tiene `color` sin validar, y su selector en el frontend en realidad es una grilla de 6 swatches de color fijos donde cada color trae un ícono pegado 1:1 (sin color libre, sin ícono independiente).

Esta spec replica el patrón exacto ya validado en los dos módulos anteriores (ver `2026-07-31-icono-color-tipos-actividad-design.md` y `2026-08-03-icono-color-tipos-proyecto-design.md`), sin introducir decisiones de diseño nuevas salvo el ícono por defecto.

## Backend (`back4/src/tipos-activo/`)

### Schema (`tipos-activo.schema.ts`)

```ts
@Prop({ required: true, default: '#0095d6', match: /^#[0-9A-Fa-f]{6}$/ }) color: string;
@Prop({ required: true, default: 'herramienta' }) icono: string;
```

Sin backfill/migración: los documentos existentes simplemente no tienen `icono` en Mongo hasta que se editen; el frontend resuelve el fallback visual (ver más abajo).

### DTO (`tipos-activo.dto.ts`)

```ts
export const ICONOS_VALIDOS = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export class CreateTipoActivoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsString() @IsOptional() @IsIn(ICONOS_VALIDOS) icono?: string;
}
export class UpdateTipoActivoDto extends PartialType(CreateTipoActivoDto) {}
```

Mismo catálogo de 12 claves duplicado tal cual está en `tipos-actividad.dto.ts` y `tipos-proyecto.dto.ts` — decisión ya tomada en los specs previos: cada módulo hermano es autocontenido, sin imports cruzados entre ellos.

Ni el service ni el controller de `tipos-activo` cambian: ya pasan el DTO completo al modelo.

## Frontend

### Modelo (`shared/models/activo.model.ts`)

Agregar `icono?: string` a `TipoActivo`, `CreateTipoActivoDto` y `UpdateTipoActivoDto`.

### Catálogo y resolución (`activos-icons.ts`)

```ts
export const ICONOS_ACTIVO = ['calendario','check','llave','alerta','reunion','documento',
  'herramienta','camion','electricidad','extintor','casco','limpieza'] as const;

export function resolverIconoActivo(icono?: string, color?: string): string {
  if (icono && (ICONOS_ACTIVO as readonly string[]).includes(icono)) return icono;
  return clavePorColor(color ?? ''); // fallback legacy existente, sin tocar
}
```

Mismo patrón que `resolverIconoActividad`/`resolverIconoProyecto`: si `icono` viene y es válido se usa tal cual (ignora el color); si no viene o es desconocido, cae al fallback legacy por color (`clavePorColor`, tabla fija ya existente de 6 colores → ícono).

### Componente de ícono (`activo-icono.component.ts`)

- Agregar `@Input() icono?: string`.
- Ampliar el `@switch` de 5 a **17 `@case`**: se preservan los 5 legacy (`camara, caja-registradora, servidor, red, generador`) — no son subconjunto del catálogo nuevo de 12, así que deben mantenerse para no romper el render de tipos ya sembrados sin `icono` — más los 12 nuevos del catálogo.
- La clave a dibujar se calcula con `resolverIconoActivo(this.icono, this.color)`.
- Los 5 legacy **no** aparecen como opción elegible en la grilla del formulario (ver siguiente sección); solo se siguen dibujando por compatibilidad hacia atrás vía el fallback de color.

### Formulario de tipo (`activos-page.component.ts` / `.html`)

Reemplaza el selector actual de 6 swatches fijos (`coloresActivo`) por el patrón exacto de actividad/proyecto:

```html
<p>Ícono</p>
<div style="display:flex;gap:.5rem;flex-wrap:wrap">
  @for (clave of iconosActivo; track clave) {
    <button type="button"
      [title]="clave"
      (click)="patchTipoForm('icono', clave)"
      [style.box-shadow]="tipoForm().icono === clave ? '0 0 0 3px ' + tipoForm().color : 'none'"
      [style.transform]="tipoForm().icono === clave ? 'scale(1.12)' : 'scale(1)'"
      style="padding:0;border:none;background:none;cursor:pointer;border-radius:12px;transition:transform .12s,box-shadow .12s;">
      <app-activo-icono [icono]="clave" [color]="tipoForm().color" [size]="22"></app-activo-icono>
    </button>
  }
</div>
<p>Color</p>
<div style="display:flex;align-items:center;gap:.5rem">
  <input type="color" [ngModel]="tipoForm().color" (ngModelChange)="patchTipoForm('color', $event)" />
  <input type="text" [ngModel]="tipoForm().color" (ngModelChange)="patchTipoForm('color', $event)" placeholder="#0095d6" />
</div>
```

`TipoForm` interno pasa de `{ nombre, color }` a `{ nombre, color, icono }`, con default `{ nombre: '', color: '#0095d6', icono: 'herramienta' }`.

**Fix de cierre de modal**: igual que en los dos módulos previos, el modal debe cerrarse solo cuando `status()?.type === 'ok'` (vía `effect()`), no de forma síncrona al disparar el submit. Antes el color siempre era uno de 6 swatches válidos (nunca fallaba); con color libre, un hex mal formado puede producir un 400 real del backend que antes era imposible.

### Puntos de renderizado a actualizar (propagar `[icono]`)

- Listado "Tipos creados" dentro del modal de gestión (`activos-page.component.html`).
- `activos-list.component.html` (fila de cada activo en el listado).
- `mis-centros-page.component.html` (listado de activos en vista consumidor de centro).
- `activo-revisar-modal.component.ts`.
- Combobox de selección de tipo en `activos-form.component.ts` — verificar si ya usa `<app-activo-icono>`; si no, agregarlo.

## Fuera de alcance

- No hay migración/backfill de documentos existentes en Mongo.
- No se introduce un componente `icon-picker` genérico compartido entre módulos (decisión ya tomada: cada feature mantiene su propia copia inline, igual que actividad y proyecto).
- No se agregan íconos nuevos al catálogo de 12 ni se cambia la librería de renderizado (SVG inline a mano, sin dependencias externas).
