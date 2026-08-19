# tofix — Frontend

Problemas verificados contra el código el 2026-07-06 (rama `feat/restructuracion-rutas`).
Incluye la revisión de seguridad previa + revisión senior de flujos, lógica y código repetido.

Leyenda: 🟠 alto · 🟡 medio/bajo · 🔵 limpieza

---

## Seguridad

### 🟡 1. JWT en `localStorage`

`features/auth/auth.service.ts` guarda `auth_token`/`auth_user` en `localStorage` (expuesto a XSS).
**Fix a largo plazo:** cookie `httpOnly; SameSite=Strict` gestionada por el backend.

### 🟡 2. Modo admin/consumidor manipulable desde DevTools

`profile/profile.service.ts` persiste el modo en `localStorage`. Las rutas están protegidas por
guards que consultan el rol real (seguro), pero la UI que dependa solo de `profile.mode()` puede
engañarse.
**Fix:** derivar el modo del rol; `localStorage` solo como preferencia de arranque.

---

## Bugs y desalineamientos

### 🟠 3. `EstadoSolicitud` incluye `'vencido'` que el backend no acepta — botón de adjuntar roto

`solicitudes.service.ts:6` + `estadosDestino()`/chips en documentos-admin. El enum del backend
no incluye `vencido` → `cambiarEstado(id, 'vencido')` fallaría la validación de Mongoose.

Efecto concreto: `documentos-consumidor-page.component.html:648` muestra el botón **"Adjuntar
fuera de plazo"** cuando `s.estado === 'vencido'`. Como ninguna solicitud puede llegar realmente a
ese estado hoy (el backend nunca lo asigna), la rama es código muerto — pero si el estado llegara a
existir, el botón fallaría siempre: `SolicitudesService.adjuntarArchivo()` en el backend solo acepta
`['pendiente', 'rechazado']`, así que el intento de adjuntar devolvería 400.
**Fix:** alinear con el backend (ver `back4/tofix.md` §9) — agregar el estado en schema/DTO y en la
whitelist de `adjuntarArchivo`, o eliminar la rama y el botón del frontend.

### 🟡 4. Descarga de documentos con error silencioso

`documentos.service.ts` → `descargar()` tiene `error: () => {}`. Si el backend responde 500
(p. ej. un vencido de empresa sin `s3_key`, bug del back), el usuario hace clic y no pasa nada.
**Fix:** setear un `Status` de error visible.

### 🟡 4a. Modal de tipo (actividad/proyecto/activo): `effect()` de cierre-en-éxito reacciona a cualquier operación del service, no solo al guardado

Detectado en la revisión final de icono/color para `tipos-activo` (2026-08-03) — el mismo patrón existe **byte-a-byte** en `actividades-page.component.ts`, `proyectos-page.component.ts` y `activos-page.component.ts`. El `effect()` que cierra el sub-formulario de tipo cuando `tiposService.status()?.type === 'ok'` se dispara también cuando el `status` pasa a `'ok'` por un `eliminar()` de **otro** tipo, no solo por el `crear()`/`actualizar()` que el usuario está editando en ese momento.

Secuencia concreta: click "Editar" en tipo A (`showTipoForm=true`, `editingTipoId=A`, campos cargados) → click "Eliminar" en tipo B → `status` pasa a `'ok'` → el effect resetea `editingTipoId` a `null` y el botón pasa a "Crear tipo", mientras `tipoForm` sigue con los valores de A. Un click posterior crea un **duplicado** de A en vez de actualizarlo.

**Fix:** gatear el effect con un flag propio del guardado en curso (no solo `status().type === 'ok'`), en los tres módulos a la vez para no divergir el patrón.

Adicionalmente, `cerrarTipoForm()` no limpia `tipoForm` tras un `crear()` exitoso — al abrir "Nuevo tipo" de nuevo los campos quedan con los valores del alta anterior (mismo comportamiento en los tres módulos, no es regresión de esta rama).

### 🟡 4b. `tipos-activo`: al editar el nombre de un tipo legacy sin `icono`, se pierde su ícono derivado del color

`abrirEditarTipo` en `activos-page.component.ts` preselecciona `'herramienta'` para cualquier tipo sin campo `icono` (documentos creados antes de 2026-08-03). Si se edita solo el nombre de un tipo que hoy renderiza como `camara`/`servidor`/etc. (vía `clavePorColor`), al guardar se persiste `icono: 'herramienta'` y cambia su apariencia. Impacto real hoy: bajo — todos los tipos sembrados usan colores fuera de la paleta legacy de 6 colores, así que ya caen todos en el ícono genérico `computador` por defecto. Sin acción requerida salvo aviso si en el futuro se detectan tipos con colores de esa paleta.

### 🟡 4c. Adjuntar archivo a una solicitud: sin mensaje de "archivo muy grande" ni bloqueo de doble envío

`features/solicitudes/solicitudes.service.ts` → `adjuntar()` no distingue `err.status === 413`
como sí lo hacen `documentos-admin-page`/`documentos-consumidor-page` (que muestran "El archivo
supera el límite de 20MB.") — un adjunto de solicitud demasiado grande muestra el mensaje crudo que
devuelva Nest/Multer. Además, `confirmarAdjunto()` en `documentos-consumidor-page.component.ts` no
deshabilita el botón mientras la petición está en curso: clics repetidos disparan varios
`POST /adjuntar` seguidos (cada uno reemplaza y borra en S3 el anterior).
**Fix:** replicar el chequeo de 413 y agregar un signal `enviandoAdjunto` que deshabilite el botón
"Confirmar" durante la subida.

---

## Rendimiento y flujos

### 🟠 5. N+1 requests en la vista "todos" de documentos

`documentos.service.ts` → `cargarTodosCentros()`/`cargarTodosProyectos()` hacen **un GET por cada
centro/proyecto** (forkJoin). `inicio-page` y `mi-ficha-page` disparan ambos al cargar: con 10 centros
y 30 proyectos son 40+ requests por visita al dashboard.
**Fix:** endpoint agregado en el backend (`GET /empresas/:id/documentos?scope=centros|proyectos`) y
dejar un solo request; mientras tanto, cachear por empresa.

### 🟡 6. Métodos ordinarios llamados desde templates

Se recalculan en cada ciclo de change detection:
- `documentos-admin/consumidor`: `docsFiltrados(tipo)`, `filteredDocsPorCentro()`, `filteredDocsPorProyecto()`, `solicitudesTabActual()`
- `mis-proyectos-page`: `scoreDeProyecto(id)` (con `@let`, pero se re-evalúa igual por ciclo)

**Fix:** convertir a `computed` (los filtros de panel deben pasar a signals para que reaccionen).

---

## Código repetido

### 🟠 7. Duplicación masiva entre `documentos-admin-page` y `documentos-consumidor-page`

~250 líneas prácticamente idénticas en ambos componentes: `PanelState` + `emptyPanel`, `toggleUpload`,
`toggleFilter`, `onFileSelected`, `onDrop` (cuerpo duplicado también entre sí), `confirmarSubida`,
`reintentarSubida`, `cerrarUploadBubble`, `ejecutarSubida`, `docsFiltrados`, `filteredDocsPorCentro/Proyecto`,
`eliminar`, `formatFecha`, `estadoChipStyle`, `estadoLabel`, `cargarVencidos*`, `docTipoActual`,
`puedeGestionarDocumento`, `centroSeleccionado`/`proyectoSeleccionado`.
Ya divergieron: admin filtra por `filtrosCategorias: string[]`, consumidor por `categoriaFiltro: string`.
**Fix:** extraer una clase base o composables (`createDocPanelState()`, `createDocUpload(service, queue)`)
en `features/documentos/` y dejar en cada page solo lo específico del modo.

### 🟠 8. Triple bloque de "selección de destinatarios" en documentos-admin

`notifSolicitud*`, `notifRechazo*`, `notifVencer*`: 3 copias de 5 signals + 2 computed + 6 métodos
toggle + el armado del payload `notificacion` (~150 líneas). Es el mismo widget con otro prefijo.
**Fix:** factory `createNotifSelection(usuarios, admins)` (mismo patrón que `createUploadQueue`) y
un helper `buildNotificacion(sel)` para el payload.

### 🟡 9. Utilidades re-implementadas por componente en vez de usar `shared/utils`

- `formatFecha()` copiada en documentos-admin, documentos-consumidor, mi-ficha, mi-proyecto-detalle, proyectos-list.
- `centroIdsPorEmpresa` computed copiado en 6 archivos (topbar, inicio, mi-ficha, actividades×2, mis-activos).
- `estadoChipStyle`/`estadoLabel` duplicados en ambas páginas de documentos, existiendo ya
  `colorEstadoSolicitud()`/`estadoStyleFn()` en `shared/utils.ts`.

**Fix:** mover a `shared/utils.ts` (`formatMesAnio()`, `centroIdsDeEmpresa(centros, empresaId)`) y
unificar los estilos de estado en una sola fuente.

---

## 🔵 Limpieza / código muerto

- **`app.html` (344 líneas) y `app.css` son el placeholder del CLI de Angular** — `app.ts` usa
  template inline; ambos archivos están muertos. Borrar.
- `solicitudesAdmin` computed en `documentos-admin-page.component.ts:157` no se usa en ningún
  template ni método — código muerto.
- `DocumentosService.cargar(tipo, ...)` es un wrapper de compatibilidad legacy (el propio comentario
  lo dice); migrar los callers a `cargarEmpresa/cargarCentro/cargarProyecto` y eliminarlo.
- `estadosDestino`/`estadoChipStyle`/`estadoLabel` reconstruyen sus mapas en cada llamada — sacarlos a `const`.
- `topbar.component.ts`: `seleccionar(null as never)` para limpiar la empresa — cambiar la firma del
  context a `Cliente | null`; y `navegarNotificacion` usa el hack `navigateByUrl('/', skipLocationChange)`
  para forzar re-navegación (usar `onSameUrlNavigation: 'reload'` o `runGuardsAndResolvers`).
- `detectarCategoriaDocumento(file.name)!` — aserción no nula sobre función que retorna `string | null`.
- `ayuda-page` sigue con contenido hardcodeado (placeholder).
- El nombre `portal3` en `package.json`/`angular.json` es legacy — no renombrar sin actualizar `vercel.json`.
