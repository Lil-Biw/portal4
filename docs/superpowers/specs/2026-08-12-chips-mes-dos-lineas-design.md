# Chips de dos líneas en vista mes — Actividades

## Contexto

En la vista mes del calendario de actividades (`/actividades` admin y `/mis-actividades`
consumidor), cada recuadro de color ("chip") muestra hoy una sola línea truncada con
ellipsis: `{{ hora }} {{ nombre }}`. El usuario adjuntó una captura donde el día 13
muestra un chip de ejemplo con dos líneas — nombre arriba, hora + tipo abajo — y pidió
que todos los chips del mes muestren un mínimo de 2 líneas de información, siguiendo
ese formato.

## Diseño aprobado

**Contenido del chip** (línea 1 / línea 2):
- Línea 1: `a.nombre` (negrita, tamaño actual ~.67rem)
- Línea 2: `rangoHora(a)` (si `a.hora` está seteada) + `tipoDeActividad(a)?.nombre`,
  tamaño menor (~.6rem), peso más liviano. Como `tipo_id` es obligatorio en el modelo,
  la línea 2 nunca queda vacía.

Cada línea trunca de forma independiente con ellipsis (sin wrap), para que la altura
del chip sea predecible.

**Cupo por día**: baja de 3 a 2 actividades visibles + botón "+N más" (antes: 3 + más).
Afecta `primerasActividadesEnDia()` (`slice(0, 3)` → `slice(0, 2)`) y las condiciones
`length > 3` / `- 3` en ambos templates.

**Altura de celda**: `.cal-cell` crece de 168px fijos a ~156px (día-num + 2 chips de
dos líneas + gap + botón "+N más" + padding), recalculado y ajustado visualmente en
el navegador durante la implementación — el valor exacto puede variar unos px respecto
a esta estimación.

## Alcance

Archivos a tocar (front4 únicamente, sin cambios de backend/modelo):
- `features/actividades/pages/actividades-page.component.html` (admin)
- `features/actividades/pages/actividades-page.component.ts` (admin) — cap 3→2
- `features/actividades/pages/mis-actividades-page.component.html` (consumidor)
- `features/actividades/pages/mis-actividades-page.component.ts` (consumidor) — cap 3→2
- `features/actividades/pages/actividades-page.component.css` (compartido por ambas
  páginas vía `styleUrl`) — estilos de `.cal-event-chip`, nuevas clases
  `.cal-event-chip-titulo` / `.cal-event-chip-meta`, altura de `.cal-cell`

Fuera de alcance: vista semana/día (sus chips y bloques horarios no cambian), tooltip
`[title]` (se mantiene con el texto concatenado actual como fallback accesible).

## Testing

Cambio puramente visual/CSS+template. Verificación manual en el navegador (dev server)
con actividades que tengan y no tengan hora, y con más de 2 actividades el mismo día
para confirmar que "+N más" se actualiza correctamente.
