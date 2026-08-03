# Ícono y color personalizados en tipos de proyecto

## Contexto

`TipoProyecto` (colección `tipos_proyecto`) es una entidad plenamente análoga a
`TipoActividad` — mismo patrón CRUD (`super_admin` únicamente), mismo modal de
gestión embebido en la página feature (`proyectos-page.component`), mismo
componente de ícono derivado del color (`proyecto-icono.component.ts` +
`proyectos-icons.ts`). A diferencia de `TipoActividad`, `TipoProyecto` está
todavía en el estado "pre-cambio": solo tiene `nombre` + `color` (sin `icono`,
sin validación de formato hex), y el selector de color en el formulario ofrece
6 swatches fijos que ya traen su ícono pegado — exactamente el mismo problema
que resolvimos en `docs/superpowers/specs/2026-07-31-icono-color-tipos-actividad-design.md`.

Esta spec replica esa solución en `tipos-proyecto`, reutilizando el mismo
catálogo de 12 íconos ya diseñado (decisión explícita: no se diseñan íconos
nuevos para proyecto, se reutilizan los mismos).

**Peculiaridad de este módulo**: existe un catálogo cerrado inicial de 11 tipos
oficiales ECLARITI (A–K, en `tipos-proyecto.catalogo.ts`) que se siembra
**solo si la colección está vacía** en el primer arranque
(`TiposProyectoService.onModuleInit`). A partir de ahí, los tipos se
administran 100% por UI — no hay resincronización forzada en arranques
posteriores (confirmado leyendo el código real del service, no solo el
comentario del archivo de catálogo). Esos 11 tipos no tienen `icono` hoy y no
se migran — igual que cualquier tipo de actividad creado antes del cambio
análogo, caen al fallback derivado del color hasta que un admin los edite.

**Diferencia de alcance vs. actividades**: `TipoProyecto` no tiene vista
consumidor — todos los usos del ícono están en el lado admin (`proyectos-page`,
`proyecto-form`, `proyectos-list`). No aplica ninguna sección de "vista
consumidor" en este cambio.

## Alcance

- Se agrega un campo `icono` real y persistido a `TipoProyecto`, independiente
  de `color`, reutilizando el mismo catálogo cerrado de 12 claves ya usado en
  `TipoActividad`.
- El color deja de estar limitado a 6 valores fijos: pasa a ser libre (selector
  nativo + hex), con validación de formato hex en el backend — mismo criterio
  que actividades.
- No se migran los 11 tipos ya sembrados (catálogo A–K) — quedan sin `icono`
  hasta que se editen manualmente.
- No se toca `tipos-proyecto.catalogo.ts` ni la lógica de siembra inicial.
- Se corrige de paso un bug ya conocido (ver "Fix incluido" más abajo) en el
  mismo archivo que se está tocando de todas formas.

## Modelo de datos (backend)

`back4/src/tipos-proyecto/tipos-proyecto.schema.ts`:

```ts
@Schema({ collection: 'tipos_proyecto', timestamps: { createdAt: 'creado_en', updatedAt: 'actualizado_en' } })
export class TipoProyecto {
  @Prop({ required: true, trim: true }) nombre: string;
  @Prop({ required: true, default: '#0095d6', match: /^#[0-9A-Fa-f]{6}$/ }) color: string;
  @Prop({ required: true, default: 'calendario' }) icono: string;
}
```

`back4/src/tipos-proyecto/tipos-proyecto.dto.ts` — mismo catálogo cerrado,
mismo orden, que el ya definido en `back4/src/tipos-actividad/tipos-actividad.dto.ts`
(duplicado deliberadamente: cada módulo es autocontenido, siguiendo el patrón
ya establecido en el repo de no cruzar imports entre módulos hermanos):

```ts
const ICONOS_VALIDOS = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;

export class CreateTipoProyectoDto {
  @IsString() @MinLength(2) nombre: string;
  @IsString() @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsString() @IsOptional() @IsIn(ICONOS_VALIDOS) icono?: string;
}
export class UpdateTipoProyectoDto extends PartialType(CreateTipoProyectoDto) {}
```

`tipos-proyecto.service.ts`/`.controller.ts` no cambian — ya pasan el DTO
completo al modelo sin lógica intermedia, igual que en actividades.

## Catálogo de íconos

Catálogo **seleccionable** en el formulario: se reutiliza el mismo catálogo
de 12 claves ya implementado para actividades (mismos SVG, sin cambios de
diseño): `calendario, check, llave, alerta, reunion, documento, herramienta,
camion, electricidad, extintor, casco, limpieza`.

Catálogo **renderizable** (no seleccionable, solo para compatibilidad hacia
atrás): los 6 íconos viejos de proyecto (`carpeta, objetivo, cohete, bandera,
maletin, grafico`) — ver "Frontend — resolución de ícono" para el porqué.

## Frontend — resolución de ícono (compatibilidad hacia atrás)

**Corrección importante encontrada al planificar** (no estaba prevista en la
primera versión de esta spec): en actividades, los 6 íconos viejos
(`calendario, check, llave, alerta, reunion, documento`) eran un subconjunto
exacto de los 12 nuevos, así que el fallback por color siempre resolvía a una
clave válida del catálogo nuevo. En proyecto, los 6 íconos viejos (`carpeta,
objetivo, cohete, bandera, maletin, grafico`) **no están** en el catálogo de
12 que se reutiliza de actividades — son un set totalmente distinto. Si el
switch del componente solo tuviera los 12 casos nuevos, los 11 tipos ya
sembrados (que hoy caen todos al fallback `clavePorColorProyecto`, que a su
vez casi siempre devuelve `'carpeta'` porque ninguno de sus colores hex
personalizados coincide exactamente con los 6 swatches fijos) pasarían a
mostrar el ícono genérico de `@default` en vez de `carpeta` — una regresión
visual para todos los tipos existentes, justo lo que esta feature busca
evitar.

Por eso el `@switch` de `proyecto-icono.component.ts` mantiene los 6 casos
viejos (sin cambios, para preservar el aspecto actual de los tipos sin
`icono`) y además agrega los 12 casos nuevos — 18 en total. Pero el catálogo
**seleccionable en el formulario** (grilla de íconos) sigue siendo solo el de
12 reutilizado — los 6 viejos no aparecen como opción elegible, solo se
siguen renderizando por compatibilidad hacia atrás vía el fallback de color.

`front4/src/app/features/proyectos/proyectos-icons.ts` — se mantiene
`ColorProyecto`/`COLORES_PROYECTO`/`clavePorColorProyecto` sin ningún cambio
(sigue devolviendo uno de los 6 íconos viejos), se agrega:

```ts
export const ICONOS_PROYECTO = [
  'calendario', 'check', 'llave', 'alerta', 'reunion', 'documento',
  'herramienta', 'camion', 'electricidad', 'extintor', 'casco', 'limpieza',
] as const;
export type IconoProyecto = typeof ICONOS_PROYECTO[number];

export function resolverIconoProyecto(icono?: string, color?: string): string {
  if (icono && (ICONOS_PROYECTO as readonly string[]).includes(icono)) {
    return icono;
  }
  return clavePorColorProyecto(color ?? '');
}
```

El tipo de retorno es `string` (no `IconoProyecto`) porque la rama de
fallback puede devolver una de las 6 claves viejas, que están fuera del
catálogo de 12 — forzar el tipo angosto ahí sería una aserción falsa.

`front4/src/app/features/proyectos/components/proyecto-icono/proyecto-icono.component.ts`
agrega `@Input() icono?: string` y calcula
`clave = resolverIconoProyecto(this.icono, this.color)`. El `@switch` interno
mantiene los 5 casos explícitos ya existentes (`carpeta, objetivo, cohete,
bandera, maletin`), agrega un 6to caso explícito `grafico` (hoy es el
`@default` implícito — se hace explícito, mismo criterio que se usó con
`documento` en actividades), y agrega los 12 casos nuevos reutilizados de
`actividad-icono.component.ts` (mismo dibujo SVG, sin rediseñar nada) — 18
`@case` en total. `color` sigue controlando `fill`/`stroke` igual que hoy.

`front4/src/app/shared/models/proyecto.model.ts`:

```ts
export interface TipoProyecto {
  _id: string;
  nombre: string;
  color: string;
  icono?: string;
}
export interface CreateTipoProyectoDto { nombre: string; color?: string; icono?: string; }
export type UpdateTipoProyectoDto = Partial<CreateTipoProyectoDto>;
```

## Frontend — formulario de creación/edición

El modal "Tipos de proyecto" (dentro de `proyectos-page.component.ts`/`.html`)
recibe el mismo cambio que el de actividades, con una diferencia de sintaxis:
**este archivo usa `*ngIf`/`*ngFor`** (no la sintaxis nueva `@if`/`@for` que sí
usa `actividades-page.component.html`) — los edits respetan la convención ya
presente en el archivo, sin mezclar sintaxis ni hacer un refactor no
relacionado.

1. **Nombre** — sin cambios.
2. **Selector de ícono** — grilla de 12 botones (`*ngFor="let clave of iconosProyecto"`),
   cada uno `<app-proyecto-icono [icono]="clave" [color]="tipoForm().color" [size]="22">`,
   con el mismo resaltado del botón activo que ya usan los swatches hoy.
3. **Selector de color** — reemplaza los 6 swatches por `<input type="color">`
   nativo + `<input type="text">` de hex, ambos leyendo/escribiendo
   `tipoForm().color` — mismo patrón exacto que actividades.
4. `TipoForm` pasa a `{ nombre, color, icono }`, con
   `emptyTipoForm() = { nombre: '', color: '#0095d6', icono: 'calendario' }`.
   `abrirEditarTipo` carga `icono: t.icono ?? ''` (sin forzar re-selección en
   tipos viejos). `guardarTipo` envía `icono: f.icono || undefined`.
5. El listado de tipos ya creados (columna derecha) pasa a
   `<app-proyecto-icono [icono]="t.icono" [color]="t.color">`.

## Fix incluido: cierre del modal solo en éxito

`guardarTipo()` en `proyectos-page.component.ts` hoy llama a
`this.cerrarTipoForm()` de forma síncrona, inmediatamente después de disparar
la petición HTTP — el mismo bug que se encontró y corrigió en la revisión
final de la feature de actividades (`docs/superpowers/plans/2026-07-31-icono-color-tipos-actividad.md`,
fix commit `6a91840`). Antes, el color siempre era uno de 6 swatches válidos,
así que un 400 nunca era alcanzable en la práctica; con el color ahora libre,
un hex mal formado sí puede llegar a la API y producir un 400 real, cerrando
el modal y perdiendo lo tecleado.

Se aplica el mismo fix ya validado: reemplazar el cierre síncrono por un
`effect()` que cierra el formulario solo cuando `tiposService.status()?.type
=== 'ok'` **y** el formulario de tipo está abierto (mismo guard usado en
actividades, para no reaccionar a un `status: 'ok'` producido por
`eliminarTipo()` de un tipo distinto mientras se edita otro — ver el hallazgo
de la revisión final de esa feature).

## Dónde se muestra el ícono

4 lugares, todos ya muestran el color hoy — se les agrega `[icono]`:

- `proyectos-page.component.html` — combo de filtro por tipo (dropdown de
  opciones, `*ngFor`).
- `proyectos-page.component.html` — listado de "Tipos creados" del modal.
- `proyecto-form.component.html` — combobox de selección de tipo al crear/editar
  un proyecto.
- `proyectos-list.component.html` — tarjeta de cada proyecto en el listado
  (este archivo ya usa `@if`/`@for`, se respeta esa sintaxis).

No hay vista consumidor que mostrar — `TipoProyecto`/su ícono no se usa en
ningún componente fuera de estos 4 (confirmado por grep: `mis-proyectos-page`
y `mi-proyecto-detalle-page` no referencian `tipo_proyecto`/`TipoProyecto`).

## Casos borde

- Tipo de proyecto de los 11 sembrados (A–K) sin `icono`: cae al fallback
  derivado del color (`clavePorColorProyecto`), igual que hoy — sin cambio
  visual hasta que se edite.
- `icono` con clave desconocida: mismo fallback que "sin ícono".
- Color inválido enviado directo a la API: rechazado con 400 por `@Matches`.

## Testing

- Frontend: nuevo `front4/src/app/features/proyectos/proyectos-icons.spec.ts`
  con los mismos 4 casos que `actividades-icons.spec.ts` (ícono válido,
  ausente, desconocido, sin color reconocido), adaptado a
  `resolverIconoProyecto`.
- Backend: sin script dedicado — misma razón que actividades (validación
  puramente declarativa, sin lógica de negocio nueva). Se verifica con
  `nest build`.
- Manual: crear un tipo de proyecto nuevo eligiendo ícono y color por
  separado; confirmar que se ve en el selector, en el listado del modal, en el
  combo de filtro, en el combobox del form de proyecto, y en la tarjeta de un
  proyecto que use ese tipo; editar un tipo existente (incluyendo uno de los
  11 sembrados) y confirmar que carga bien y guarda los cambios; escribir un
  hex inválido y confirmar que el modal NO se cierra y el error se ve con los
  datos tecleados intactos (verificación del fix incluido).

## Fuera de alcance

- Diseño de íconos nuevos específicos para proyecto — se reutiliza el
  catálogo de actividades tal cual.
- Migración de los 11 tipos ya sembrados.
- Cambios a `tipos-proyecto.catalogo.ts` o a la lógica de siembra inicial.
- Vista consumidor — no existe para `TipoProyecto`.
