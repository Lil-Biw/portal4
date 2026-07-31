# Ícono y color personalizados en tipos de actividad

## Contexto

Hoy `TipoActividad` tiene un campo `color` (string libre, sin validación de
formato, default `#4E9AC7`), pero el "ícono" no es un dato real: se deriva
determinísticamente del color elegido mediante una tabla fija de 6
combinaciones (`COLORES_ACTIVIDAD` / `clavePorColorActividad` en
`front4/src/app/features/actividades/actividades-icons.ts`). El formulario de
creación/edición (modal "Tipos de Actividad" dentro de
`actividades-page.component`) solo ofrece 6 swatches — cada uno ya trae su
ícono pegado — no hay forma de elegir ícono y color por separado, ni de usar
un color fuera de esas 6 opciones.

Este mismo patrón (ícono derivado 1:1 del color, sin campo propio) está
duplicado en `activos` y `proyectos`, pero esta spec solo toca `actividades`.

## Alcance

- Se agrega un campo `icono` real y persistido a `TipoActividad`, independiente
  de `color`.
- El color deja de estar limitado a 6 valores fijos: pasa a ser libre (selector
  nativo + hex), con validación de formato hex en el backend.
- El catálogo de íconos elegibles pasa de 5 (implícitos) a 12 (explícitos).
- Aplica solo al formulario de creación/edición de tipos de actividad y a
  dónde se muestra ese ícono (calendario y detalle de actividades, admin y
  consumidor). No toca `activos` ni `proyectos` — quedan con su patrón actual.
- Sin backfill: los tipos de actividad creados antes de este cambio no tienen
  `icono`; se resuelven con el mismo fallback que usan hoy (derivar desde
  `color`), sin necesidad de migración.

## Modelo de datos (backend)

`back4/src/tipos-actividad/tipos-actividad.schema.ts`:

```ts
@Schema({ collection: 'tipos_actividad', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoActividad {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#4E9AC7', match: /^#[0-9A-Fa-f]{6}$/ }) color: string;
  @Prop({ required: true, default: 'calendario' }) icono: string;
  @Prop({ trim: true }) descripcion?: string;
}
```

`icono` es `required` con `default: 'calendario'` — todo tipo **nuevo** siempre
tiene un ícono explícito; solo los tipos preexistentes (creados antes de esta
migración de schema) carecen del campo en su documento de Mongo.

`back4/src/tipos-actividad/tipos-actividad.dto.ts`:

```ts
const ICONOS_VALIDOS = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export class CreateTipoActividadDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsString() @IsOptional() @IsIn(ICONOS_VALIDOS) icono?: string;
  @IsString() @IsOptional() descripcion?: string;
}
export class UpdateTipoActividadDto extends PartialType(CreateTipoActividadDto) {}
```

`ICONOS_VALIDOS` se exporta desde el DTO para que el catálogo de claves viva
en un solo lugar del backend (evita que el frontend y el backend diverjan en
qué claves son válidas — aunque no se comparte literalmente el array entre
proyectos, ambos deben mantenerse sincronizados manualmente al agregar un
ícono nuevo).

`tipos-actividad.service.ts` y `tipos-actividad.controller.ts` no cambian:
ya pasan el DTO completo al modelo sin lógica intermedia — `icono` fluye igual
que `color` hoy.

## Catálogo de íconos

12 claves, 5 ya existentes como SVG (el switch actual del componente) + 1 que
pasa de fallback implícito a opción explícita + 6 nuevas:

| Clave | Ícono | Uso típico |
|---|---|---|
| `calendario` | calendario | genérico (default) |
| `check` | check | completado / inspección |
| `llave` | llave inglesa | mantenimiento |
| `alerta` | alerta / triángulo | incidente |
| `reunion` | personas | reunión / capacitación |
| `documento` | documento | inspección / registro |
| `herramienta` | destornillador + llave | reparación |
| `camion` | camión | transporte / logística |
| `electricidad` | rayo | eléctrico |
| `extintor` | extintor | seguridad contra incendios |
| `casco` | casco de seguridad | EPP / seguridad |
| `limpieza` | escoba | aseo |

No se agrega ninguna librería de íconos externa (lucide/feather/material-icons
/fontawesome) — el repo no usa ninguna hoy y los 3 módulos con patrón análogo
(`activos`, `proyectos`, `actividades`) usan SVG inline a mano; introducir una
dependencia nueva para 12 íconos sería inconsistente con el resto del código y
no aporta valor proporcional.

## Frontend — resolución de ícono (compatibilidad hacia atrás)

Nueva función pura en `front4/src/app/features/actividades/actividades-icons.ts`,
junto a la `clavePorColorActividad` ya existente (que no se borra: sigue siendo
el fallback):

```ts
export const ICONOS_ACTIVIDAD = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;
export type IconoActividad = typeof ICONOS_ACTIVIDAD[number];

export function resolverIconoActividad(icono?: string, color?: string): IconoActividad {
  if (icono && (ICONOS_ACTIVIDAD as readonly string[]).includes(icono)) {
    return icono as IconoActividad;
  }
  return clavePorColorActividad(color);
}
```

- Si `icono` viene y es una clave válida del catálogo → se usa tal cual
  (independiente del color).
- Si `icono` no viene (tipo creado antes de este cambio) o viene con una clave
  desconocida → cae al comportamiento actual: derivar desde `color` con la
  tabla de 6 combinaciones ya existente.

`front4/src/app/features/actividades/components/actividad-icono/actividad-icono.component.ts`
agrega `@Input() icono?: string` y calcula
`clave = resolverIconoActividad(this.icono, this.color)` en vez de llamar
directo a `clavePorColorActividad`. El `@switch` interno pasa de 5 a 12 `@case`
(los 6 SVG nuevos se dibujan a mano, mismo estilo/trazo que los 5 actuales).
`color` sigue controlando el `fill`/`stroke` del SVG exactamente igual que hoy
— no cambia esa parte.

`front4/src/app/shared/models/actividad.model.ts`:

```ts
export interface TipoActividad {
  _id: string;
  nombre: string;
  color: string;
  icono?: string;
  descripcion?: string;
  creado_en?: string;
  actualizado_en?: string;
}
export interface CreateTipoActividadDto { nombre: string; color?: string; icono?: string; descripcion?: string; }
export interface UpdateTipoActividadDto { nombre?: string; color?: string; icono?: string; descripcion?: string; }
```

## Frontend — formulario de creación/edición

El modal "Tipos de Actividad" (`actividades-page.component.ts`/`.html`) pasa de
3 a 4 bloques:

1. **Nombre** — sin cambios.
2. **Selector de ícono** — grilla de 12 botones, uno por clave de
   `ICONOS_ACTIVIDAD`. Cada botón renderiza
   `<app-actividad-icono [icono]="clave" [color]="form.color" [size]="22">` —
   se tiñe en vivo con el color que esté elegido en ese momento en el form, para
   previsualizar la combinación final. El botón de la clave seleccionada se
   resalta con el mismo estilo de "activo" que hoy usan los swatches de color.
   `patchTipoForm('icono', clave)` al hacer clic.
3. **Selector de color** — reemplaza los 6 swatches fijos por
   `<input type="color">` nativo sincronizado con un `<input type="text">` de
   hex (cambiar uno actualiza el otro vía un setter compartido en el
   componente). Default `#4E9AC7`. Sin picker de librería externa.
4. **Descripción** — sin cambios.

`TipoForm` interno pasa a `{ nombre, color, icono, descripcion }`, con
`emptyTipoForm() = { nombre: '', color: '#4E9AC7', icono: 'calendario', descripcion: '' }`.

El listado de tipos ya creados (columna derecha del mismo modal) pasa de
`<app-actividad-icono [color]="t.color">` a
`<app-actividad-icono [icono]="t.icono" [color]="t.color">`. "Editar" precarga
el form con `t.icono` y `t.color` tal cual vienen del tipo (si `t.icono` es
`undefined` porque es un tipo viejo, el selector de ícono simplemente no
resalta ningún botón hasta que el admin elija uno explícitamente — no se le
fuerza a re-elegir para poder guardar otros cambios, ya que `icono` sigue
siendo opcional en `UpdateTipoActividadDto`).

## Frontend — dónde se muestra el ícono (calendario y detalle)

Aplica a `actividades-page.component.html` (admin) y
`mis-actividades-page.component.html` (consumidor):

- **Chips de vista Mes/Semana**: se antepone
  `<app-actividad-icono [icono]="tipo?.icono" [color]="colorDeActividad(a)" [size]="12">`
  junto al nombre de la actividad dentro del chip (hoy solo tienen
  `[style.background]`, que se mantiene igual — el ícono se agrega, no
  reemplaza el color de fondo).
- **Panel de detalle vista Día**: admin ya renderiza el ícono aquí (solo le
  falta pasar `[icono]`); consumidor hoy tiene un punto de color plano
  (`cal-day-item-dot` / clase equivalente) que se reemplaza por
  `<app-actividad-icono [icono]="..." [color]="..." [size]="18">`.
- **Modal resumen/detalle** (clic en evento en vista Mes/Semana): el punto de
  color (`actividad-detalle-dot`) se reemplaza por el mismo componente de
  ícono, en admin y consumidor.

**Fuera de esto**: las **barras multi-día** (franjas de pocos píxeles de alto
para actividades que abarcan varios días) se mantienen solo con color, sin
ícono — no hay espacio legible para un SVG en una barra tan delgada.

## Casos borde

- Tipo de actividad creado antes de este cambio (sin `icono` en su documento
  de Mongo): `resolverIconoActividad(undefined, color)` cae a
  `clavePorColorActividad(color)` — se ve exactamente igual que hoy, sin
  romper nada.
- `icono` con una clave que ya no existe en el catálogo (por ejemplo si en el
  futuro se elimina una clave): mismo fallback que "sin icono", no revienta.
- Color con formato inválido enviado directo a la API (bypaseando el input
  nativo del navegador, que siempre emite `#rrggbb`): rechazado por el
  `@Matches` del DTO con 400, igual que cualquier otro campo mal formado en
  este repo.

## Testing

- Frontend: nuevo `front4/src/app/features/actividades/actividades-icons.spec.ts`
  (no existía) con tests de `resolverIconoActividad` — casos: ícono válido
  presente (se usa tal cual, ignorando el color), ícono ausente (cae a
  `clavePorColorActividad`), ícono con clave desconocida (cae al mismo
  fallback que si viniera ausente).
- Backend: no amerita script `ts-node` dedicado — a diferencia de la feature
  de "creado por", acá no hay lógica condicional de negocio, solo validación
  declarativa (`class-validator` + `match` de Mongoose). Se verifica con
  `tsc`/`ng build` y verificación manual.
- Manual: crear un tipo de actividad nuevo eligiendo ícono y color por
  separado; confirmar que se ve correcto en el selector, en el listado del
  modal, y en calendario/detalle (mes, semana, día, modal) tanto en admin como
  en "Mis actividades"; editar un tipo existente y confirmar que el cambio se
  refleja; abrir una actividad con un tipo antiguo sin `icono` y confirmar que
  no se rompe (usa el fallback derivado del color).

## Fuera de alcance

- `activos` y `proyectos` — mismo patrón de ícono-derivado-de-color, pero no
  se tocan en esta spec.
- Subida de íconos custom (SVG/imagen propia) — se eligió catálogo predefinido.
- Backfill de `icono` para tipos de actividad ya existentes.
- Ícono en las barras multi-día del calendario (solo color, por espacio).
