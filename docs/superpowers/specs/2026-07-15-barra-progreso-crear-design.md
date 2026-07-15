# Barra de progreso al crear solicitud/actividad

## Contexto

Hoy, al crear una solicitud (`documentos-admin-page.component.ts`) o una actividad
(`actividades-page.component.ts`, paso 4 del wizard), el único feedback visual mientras
el POST está en vuelo es deshabilitar el botón y cambiar su texto a "Creando…"/
"Guardando…"/"Subiendo…". No hay ningún indicador animado.

Nota: se sospechaba un bug donde `creandoSolicitud` no se reseteaba en error, pero al
revisar el código actual (`documentos-admin-page.component.ts:166-172`) ya existe un
`effect()` que lo resetea cuando `solicitudesService.status()?.type === 'error'`. No
hace falta ningún fix — se descarta ese punto del alcance.

## Objetivo

Agregar una barra de progreso **indeterminada** (sin porcentaje real, ya que ambas
operaciones son un único POST JSON sin progreso medible) dentro del botón "Crear
solicitud" / "Guardar" mientras la operación está en curso.

Fuera de alcance: progreso por archivo en la subida secuencial de documentos pendientes
del wizard de actividades (ya cubierto visualmente por el texto "Subiendo…"; no se pide
in esta iteración un indicador tipo upload-bubble ahí).

## Diseño

### 1. Clase CSS reutilizable `.btn-loading` (`src/styles.css`)

CSS-only, sin componente Angular nuevo (no requiere inputs/outputs, solo un class
binding condicional) — consistente con la convención "estilos globales en styles.css
si son cortos".

- Barra fina (`height: 2-3px`) anclada al borde inferior del botón vía `::after`,
  con `overflow: hidden` en el botón para contener la animación.
- Keyframes de desplazamiento infinito izquierda→derecha (efecto "indeterminate" tipo
  Material/YouTube), hereda el color del botón (`currentColor` o variable) para que
  funcione igual en `.btn-primary` (azul, solicitudes) y en el botón verde del wizard
  de actividades (`background:#22c55e`).
- Se activa solo agregando la clase `btn-loading` vía `[class.btn-loading]`; no requiere
  JS adicional más allá del binding.

### 2. Aplicación en los dos botones existentes

- `documentos-admin-page.component.html`, botón "Crear solicitud":
  añadir `[class.btn-loading]="creandoSolicitud()"` junto al `[disabled]` existente.
- `actividades-page.component.html`, botón "Guardar" del wizard (paso 4):
  añadir `[class.btn-loading]="service.saving() || subiendoDocs"` junto al `[disabled]`
  existente. Cubre tanto la fase de creación de la actividad (`service.saving()`) como
  la fase secundaria de subida de documentos pendientes (`subiendoDocs`).

No se toca el texto actual del botón ("Creando...", "Guardando...", "Subiendo...") —
la barra es un indicador adicional, no un reemplazo.

Ningún servicio requiere cambios: `SolicitudesService` no se toca (el reset en error ya
existe en el componente) y `ActividadesService.saving` ya se resetea correctamente en
`setError()` (línea 25-28 de `actividades.service.ts`).

## Testing

- Verificación manual: iniciar `npm start`, crear una solicitud y una actividad,
  observar la barra animada en el botón mientras el POST está en vuelo.
- No se requieren tests unitarios: es un cambio de CSS puro + dos class bindings.
