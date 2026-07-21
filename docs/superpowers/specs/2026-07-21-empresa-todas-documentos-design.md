# Selector de Empresa "Todas" en Documentos (admin) — Design

## Contexto

En `documentos-admin-page` (vista admin de Documentos), la Tarjeta A tiene 3 selects
en cascada: Empresa → Centro de costos → Proyecto. Centro y Proyecto ya soportan un
valor `'todos'` (además de `''` = "Ninguno" y una lista de opciones individuales) que
agrega documentos de todos los centros/proyectos **de la empresa seleccionada**.

El select de Empresa hoy solo tiene `<option value="">Todas</option>` seguido de la
lista de empresas — pero ese `value=""` en realidad se trata en todo el componente
como "ninguna empresa elegida" (limpia todo, deshabilita Centro, muestra el placeholder
"Selecciona una empresa..."). Nunca implementó agregación real; la etiqueta "Todas" es
enteramente engañosa.

**Pedido:** que "Todas" en el select de Empresa muestre de verdad la documentación
agregada a nivel empresa de todas las empresas, y que se combine correctamente con
Centro/Proyecto en "Todos":

| Empresa | Centro | Resultado |
|---|---|---|
| X (específica) | Todos | centros de X — **ya funciona hoy, sin cambios** |
| Todas | (sin elegir) | documentos a nivel empresa de **todas** las empresas |
| Todas | Todos | todos los centros de todas las empresas |
| Todas | Todos → Proyecto Todos | todos los proyectos de todas las empresas |

## Decisiones de alcance (confirmadas con el usuario)

1. **Subir se deshabilita** cuando Empresa = "Todas" (no hay una empresa destino única).
   Eliminar/vencer un documento puntual de una lista agregada **sí sigue funcionando**,
   resolviendo la empresa (y centro/proyecto) real por fila.
2. **Vencidos y Solicitudes quedan fuera de alcance.** Si Empresa = "Todas", esas dos
   pestañas muestran un mensaje pidiendo elegir una empresa específica — no se llama al
   backend con un `empresa_id` inválido (ambos endpoints exigen un id real, no soportan
   "todas").
3. **Sin selección individual de centro/proyecto cruzando empresas.** Con Empresa =
   "Todas", los selects de Centro y Proyecto solo ofrecen la opción "Todos" (no listan
   items sueltos de otras empresas). Si se quiere apuntar a un centro/proyecto puntual,
   primero hay que elegir su empresa específica — ya funciona así hoy. Esto evita tener
   que resolver "a qué empresa pertenece este item suelto" en cada acción (subir,
   solicitudes, notificaciones) para un caso que no se pidió.

## Arquitectura

El endpoint `GET /documentos/busqueda-total?nivel=empresa` (backend `documentos-busqueda`,
ya existe, ya lo consume la pestaña "Todos" de esta misma página) devuelve, sin filtrar,
el árbol completo de todas las empresas activas con sus centros y proyectos anidados
(`NodoBusqueda[]`, cada nodo con su `.documentos` propio). **No requiere cambios de
backend.**

Cuando el usuario elige Empresa = "Todas":

1. Se pide ese árbol **una sola vez**, sin `categorias`/`nombre` (filtro server-side),
   y se guarda en un signal nuevo del frontend: `DocumentosService.documentosTodasEmpresas`.
2. Los 3 niveles (empresa/centro/proyecto) se **derivan de ese mismo árbol en el
   cliente** — no hay una llamada HTTP nueva al cambiar Centro o Proyecto a "Todos"
   dentro del modo "Todas".
3. El filtro de categoría/nombre (`panels[tipo]`) sigue aplicándose **en el cliente**,
   exactamente como ya ocurre hoy para una empresa específica — no se reutiliza el
   signal `busquedaCascada`/`buscarCascada` existente (ese pertenece a la pestaña
   "Todos", que tiene su propio ciclo de filtro server-side vía `panels['todos']`);
   mezclar ambos crearía acoplamiento entre dos features no relacionadas.

Este es un signal **separado** de `busquedaCascada` para no acoplar esta feature con
la pestaña "Todos" existente (evita que cambiar el filtro de una afecte a la otra).

## Cambios — `DocumentosService`

- Nuevo signal: `documentosTodasEmpresas = signal<NodoBusqueda[]>([])`.
- Nuevo método: `cargarTodasEmpresas(): void` — GET a `/documentos/busqueda-total?nivel=empresa`
  (sin query params de filtro), reutiliza el `mapearNodo()` privado ya existente (agrega
  `url` a cada documento del árbol, igual que `buscarCascada`), y hace
  `this.documentosTodasEmpresas.set(arbol.map(n => this.mapearNodo(n)))`.
- `DocumentoItem` no cambia de forma; los badges de la vista agregada leen
  `empresa_nombre`/`centro_nombre` directamente de los nodos del árbol (`NodoBusqueda`),
  no de `DocumentoItem`.

## Cambios — `DocumentosAdminPageComponent`

### Selects (Tarjeta A)

- Select de Empresa: `<option value="">Ninguna</option>` + `<option value="todos">Todas</option>`
  antes de la lista de empresas — mismo patrón textual que ya usan Centro y Proyecto.
- Select de Centro: cuando `selectedEmpresaId === 'todos'`, ocultar el `@for` de items
  individuales (dejar solo "Ninguno"/"Todos"), igual que Proyecto ya hace hoy cuando
  `selectedCentroId === 'todos'`.
- Select de Proyecto: sin cambios — su regla actual (solo lista individual cuando
  `selectedCentroId` es una id real) ya cubre el caso, porque con Empresa = "Todas" el
  Centro nunca podrá ser una id real (ver punto anterior).

### `onEmpresaChange()`

Cuando `selectedEmpresaId === 'todos'`: limpiar selección de centro/proyecto (igual que
hoy), y en vez de `service.cargarEmpresa(id)` llamar a `service.cargarTodasEmpresas()`.
Además: no llamar a `solicitudesService.cargar(...)` (requiere un id real) — limpiar el
listado de solicitudes en su lugar.

### `onCentroChange()` / `onProyectoChange()`

Cuando `selectedEmpresaId === 'todos'` y `selectedCentroId === 'todos'` (resp.
`selectedProyectoId === 'todos'`): no llamar a los forkJoin existentes
(`cargarTodosCentros`/`cargarTodosProyectos`, que asumen una sola empresa) — el dato ya
está disponible en `service.documentosTodasEmpresas()`, no hace falta pedir nada.

### Vistas derivadas (nuevos getters, computados sobre `service.documentosTodasEmpresas()`)

- `docsEmpresaTodas(): { doc: DocumentoItem; empresaId: string; empresaNombre: string }[]`
  — flatMap de `documentos` propios de cada nodo raíz del árbol.
- `docsPorCentroTodas(): { centroId: string; nombre: string; empresaId: string; empresaNombre: string; docs: DocumentoItem[] }[]`
  — flatMap de `.centros` de cada empresa.
- `docsPorProyectoTodas(): { proyectoId: string; nombre: string; empresaId: string; empresaNombre: string; centroNombre: string; docs: DocumentoItem[] }[]`
  — flatMap de `.centros[].proyectos`.

Cada uno filtra por `panels[tipo].busqueda`/`filtrosCategorias`, igual que
`docsFiltrados`/`filteredDocsPorCentro`/`filteredDocsPorProyecto` ya hacen. En plantilla,
el bloque `@if`/`@else` existente para cada tab (empresa/centro/proyecto) se ramifica
una vez más: si `selectedEmpresaId === 'todos'` usa estos getters nuevos; si no, usa
exactamente el código/getter que ya existe hoy (sin tocarlo).

### Badges

En la rama "Todas", el tag ya no dice genérico "Empresa"/"Centro · X" — usa el nombre
real: `Empresa · {{ empresaNombre }}` / `Centro · {{ nombre }} ({{ empresaNombre }})` /
`Proyecto · {{ nombre }} ({{ empresaNombre }} · {{ centroNombre }})`, con los mismos
3 colores ya unificados (azul/verde/naranja) del trabajo anterior en esta misma página.

### Subir

`puedeGestionarDocumento` (línea ~358) agrega la condición de que, en el tab empresa,
`selectedEmpresaId` no sea `'todos'` (además de no ser `''`, cerrando de paso un bug
latente donde el botón "Subir" aparecía sin ninguna empresa elegida).

### Eliminar / Vencer por fila

- Nuevo método `eliminarEnTodasEmpresas(docUrl: string, empresaId: string): void` —
  llama a `service.eliminar(docUrl, 'empresa', empresaId, undefined, undefined, () => this.service.cargarTodasEmpresas())`.
  Análogo para centro/proyecto agregados cuando la fila viene del árbol "Todas"
  (reutiliza `centroId`/`proyectoId` de esa fila, recarga con `cargarTodasEmpresas()`
  al terminar).
- `abrirModalVencer(...)` ya acepta `centroIdReal`/`proyectoIdReal`/`empresaIdReal`/`tipoReal`
  — se le pasan los valores reales de la fila agregada (mismo patrón que ya usan las
  vistas "todos los centros"/"todos los proyectos" de una sola empresa hoy).
- `confirmarVencer()` ya tiene un branch `onSuccess` por caso; se agrega uno más:
  cuando la fila viene del árbol "Todas", `onSuccess = () => this.service.cargarTodasEmpresas()`.

### Solicitudes / Vencidos con Empresa = "Todas"

- Pestaña Solicitudes: si `selectedEmpresaId === 'todos'`, se oculta el listado normal y
  se muestra un mensaje ("Selecciona una empresa específica para ver sus solicitudes")
  en su lugar; el botón "Crear solicitud" se deshabilita.
- Pestaña Vencidos (`activarTabVencidosAdmin`): si `selectedEmpresaId === 'todos'`, se
  deshabilita/oculta el tab (mismo mensaje que Solicitudes) en vez de llamar
  `cargarVencidosAdmin()`.

## Fuera de alcance

- Backend: sin cambios (el endpoint ya soporta esto).
- `documentos-consumidor-page`: no tiene selector de empresa (el usuario ya está atado
  a una), esta feature no la toca.
- Selección individual de centro/proyecto cruzando empresas distintas.
- Vencidos y Solicitudes agregados a nivel de todas las empresas.

## Testing

- Actualizar/agregar specs de `DocumentosService` para `cargarTodasEmpresas()` (mismo
  patrón que el test ya existente de `buscarCascada`, pero verificando que no se manden
  `categorias`/`nombre`).
- Verificación manual en navegador (login super_admin, Documentos → Empresa: Todas →
  probar las 4 combinaciones de la tabla de arriba, subir deshabilitado, eliminar/vencer
  de una fila agregada, Solicitudes/Vencidos muestran el mensaje).
