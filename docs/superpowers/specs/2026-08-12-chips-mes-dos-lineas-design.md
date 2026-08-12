# Chips de dos líneas en vista mes, semana y día — Actividades

## Contexto

En la vista mes del calendario de actividades (`/actividades` admin y `/mis-actividades`
consumidor), cada recuadro de color ("chip") muestra hoy una sola línea truncada con
ellipsis: `{{ hora }} {{ nombre }}`. El usuario adjuntó una captura donde el día 13
muestra un chip de ejemplo con dos líneas — nombre arriba, hora + tipo abajo — y pidió
que todos los chips del mes muestren un mínimo de 2 líneas de información, siguiendo
ese formato.

## Diseño aprobado

**Contenido del chip** (línea 1 / línea 2):
- Línea 1: `a.nombre` (negrita, tamaño actual ~.67rem). **Solo en el calendario admin**
  (`actividades-page.component`), se antepone el nombre de la empresa:
  `"Empresa — Nombre actividad"` (vía nuevo método `empresaDeActividad(a)`, resuelto
  desde `centro_costo_id` → centro → `cliente_id`). En el calendario consumidor
  (`mis-actividades-page.component`) NO se antepone empresa: el contexto ya está
  acotado a una sola empresa (filtro por `ConsumidorContextService`), así que
  repetirla en cada chip sería ruido redundante; además ese componente no tiene
  `ClientesService` inyectado.
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

## Extensión — vista semana y día

El mismo patrón línea1/línea2 (`.cal-event-chip-titulo` / `.cal-event-chip-meta`) se
extiende a los demás elementos "recuadro de color" del calendario, reutilizando las
mismas clases CSS en vez de duplicarlas:

- **`.cal-event-chip`** en la franja "Todo el día" de Semana (actividades de un solo
  día sin hora, admin y consumidor): antes texto plano de una línea (`a.nombre`),
  ahora línea 1 = empresa + nombre (solo admin) y línea 2 = tipo.
- **`.cal-time-block`** (grilla horaria de Semana y Día, admin y consumidor): antes
  `hora` + `nombre` en una sola línea inline (spans `.cal-time-block-hora` /
  `.cal-time-block-nombre`, sin `display:block`, uno al lado del otro). Ahora línea 1
  = empresa + nombre (solo admin), línea 2 = hora + tipo — mismas clases
  `.cal-event-chip-titulo` / `.cal-event-chip-meta` que el resto. Los bloques muy
  cortos (actividades de 30 min, altura mínima ~24px) pueden recortar la línea 2 por
  `overflow:hidden`, igual que el recorte por ancho en los demás chips.

**Fuera de alcance (decisión explícita):** la barra multi-día de la franja "Todo el
día" de Semana (`.cal-week-bar`) se deja sin cambios — es intencionalmente compacta
(18px de alto fijo, una fila por barra, con lógica de apilado en
`barrasMultiDiaPorSemana`) y aplicarle el mismo patrón de dos líneas requeriría
recalcular esa altura de fila; no es un "recuadro" equivalente a los chips normales.
La lista "Todo el día" del panel izquierdo en vista Día (`.cal-day-item`, con ícono)
tampoco cambia — no es un recuadro de color, es una fila de lista.

## Alcance

Archivos a tocar (front4 únicamente, sin cambios de backend/modelo):
- `features/actividades/pages/actividades-page.component.html` (admin)
- `features/actividades/pages/actividades-page.component.ts` (admin) — cap 3→2,
  nuevo método `empresaDeActividad(a)`
- `features/actividades/pages/mis-actividades-page.component.html` (consumidor)
- `features/actividades/pages/mis-actividades-page.component.ts` (consumidor) — cap 3→2
- `features/actividades/pages/actividades-page.component.css` (compartido por ambas
  páginas vía `styleUrl`) — estilos de `.cal-event-chip`/`.cal-time-block`, clases
  compartidas `.cal-event-chip-titulo` / `.cal-event-chip-meta`, altura de `.cal-cell`

Tooltip `[title]` se mantiene en todos los elementos como fallback accesible con el
texto completo (empresa + nombre + hora), por si el truncado corta información.

## Testing

Cambio puramente visual/CSS+template. Verificación manual en el navegador (dev server)
con actividades que tengan y no tengan hora, y con más de 2 actividades el mismo día
para confirmar que "+N más" se actualiza correctamente.
