# Tarjetas de documentos — modales más anchos y lista → grilla — Diseño

**Fecha:** 2026-08-11
**Rama:** feat/documentos-busqueda-cascada

## Resumen

Tres cambios de UI relacionados con cómo se muestran documentos adjuntos:

1. Ensanchar el modal "Editar activo" para que quepan 3 tarjetas de documento por fila (hoy caben 2).
2. Ensanchar el wizard de actividades para que quepan 4 tarjetas de documento por fila.
3. En el módulo Documentos (admin y consumidor), reemplazar la lista de filas anchas de documentos ya subidos por una grilla de tarjetas que se ajusta al ancho disponible (sin número fijo de columnas), preservando toda la información y acciones que hoy tienen las filas.

Los cambios 1 y 2 son ajustes de CSS acotados. El cambio 3 es el grueso del trabajo: el HTML de fila está duplicado 8 veces en `documentos-admin-page.component.html` y 5 veces en `documentos-consumidor-page.component.html` (una variante por nivel de jerarquía — todos/empresa/centro/proyecto — más una variante para "vencidos"), así que se extrae una tarjeta compartida en vez de duplicar el nuevo layout otras 13 veces.

## 1. Modal "Editar activo" (activos)

`activos-page.component.ts` define el modal contenedor: `.modal { max-width: 860px; }` (línea 52). Dentro, `activos-form.component.ts` divide el contenido en `.form-dos-col { grid-template-columns: 1fr 1fr; gap: 1.25rem 2rem; }` (línea 22-27) — formulario a la izquierda, `.col-docs` con `<app-document-card-list>` a la derecha.

Las tarjetas del `document-card-list` compartido son de 150px + gap `.7rem` (`.dcl-grid`/`.dcl-card`, `document-card-list.component.ts` líneas 20-27) — ese componente **no cambia**, solo el espacio que se le da.

**Cambio:** aumentar `.modal { max-width }` y ajustar `.form-dos-col` para que la columna derecha tenga ancho suficiente para 3 tarjetas (`150×3 + gap×2 ≈ 473px` + padding interno de tarjeta). La columna izquierda (formulario) no necesita crecer en la misma proporción — se usa una razón de grid asimétrica (ej. `minmax(300px, 360px) 1fr`) en vez de `1fr 1fr`, para no desperdiciar ancho en el formulario. Valor final de `max-width` y de la razón de grid se ajustan visualmente durante la implementación (objetivo: 3 tarjetas por fila, no un pixel exacto).

## 2. Wizard de actividades

`actividades-page.component.css`: `.modal-box--wizard { max-width: 560px; }` (línea 676-682), de una sola columna (no hay split como en activos). El paso de documentos (`actividades-page.component.html` líneas 848-871, sección `.wz-seccion`) usa el mismo `<app-document-card-list>` a ancho completo.

**Cambio:** aumentar `.modal-box--wizard { max-width }` lo necesario para que el contenido interno (ancho modal − padding) quepan 4 tarjetas (`150×4 + gap×3 ≈ 634px` + padding). Mismo criterio que el punto 1: ajuste visual durante implementación, apuntando a 4 por fila.

Los anchos de los puntos 1 y 2 son intencionalmente distintos entre sí (activos parte de un modal más ancho de por sí, por el formulario a la izquierda).

## 3. Documentos: de filas a grilla de tarjetas

### 3.1 Estado actual

`documentos-admin-page.component.html` tiene 8 bloques de renderizado casi idénticos (uno por combinación de vista): `filasTodos()` (470-541), `docsFiltrados(docTipo)` (585-658), `docsEmpresaTodas()` (671-737), `filteredDocsPorCentro()→item.docs` (746-822), `docsCentroTodas()` (835-903), `filteredDocsPorProyecto()→item.docs` (911-990), `docsProyectoTodas()` (1003-1075), y `documentosVencidos()` (1092-1136, layout distinto, solo botón Abrir/Descargar). `documentos-consumidor-page.component.html` tiene 5 equivalentes con menos acciones (sin cambiar categoría, sin marcar vencido; algunos sin eliminar).

Cada fila hoy muestra: chip de categoría, nombre (`nombre_display`), chip "🔗 Link" si aplica, chips de Empresa/Centro/Proyecto (según cuáles apliquen al bloque), "Subido: fecha", nombre de quien subió, y hasta 4 acciones: Descargar/Abrir enlace, Cambiar categoría (menú desplegable), Marcar vencido (solo si `puedeVencer()`), Eliminar.

El modelo `DocumentoTarjeta` (`shared/models/documento-tarjeta.model.ts`) que usa `document-card-list` es de otro dominio (estado de una subida en curso: pendiente/subiendo/error) y no tiene campos de categoría, jerarquía ni fecha — no se reutiliza ese componente para esto; es un componente nuevo.

### 3.2 Componente nuevo: `DocumentoCardComponent`

Vive en `features/documentos/components/documento-card/` (uso exclusivo del feature Documentos, no en `shared/` — ver convención del proyecto).

Presentacional puro (dumb component). Reemplaza el `<div>` de fila dentro de cada `@for` existente; cada página sigue iterando su propio array (no se unifican los 13 shapes de datos en un modelo común — eso obligaría a tocar los services). El template de cada bloque pasa sus campos por `@Input` y sigue llamando a su handler existente vía `@Output`.

**Inputs:**
- `nombre: string`, `categoria: string`, `tipoContenido: 'archivo' | 'link'`
- `fechaSubida: string` (ya formateada, vía `formatFechaHora` existente)
- `subidoPor?: string`
- `badges?: { label: string }[]` — chips secundarios (Empresa/Centro/Proyecto según el bloque; vacío si no aplica)
- `vencidoEn?: string` — solo el bloque de vencidos
- `categorias?: string[]`, `categoriaActual?: string` — para el menú de cambiar categoría
- `mostrarCambiarCategoria = false`, `mostrarMarcarVencido = false`, `mostrarEliminar = false`

**Outputs:** `abrir` (descargar/abrir link), `cambiarCategoria(nuevaCategoria: string)`, `marcarVencido`, `eliminar`

**Layout visual** (adaptado de `.dcl-card` pero más ancho, ~170-190px, para que quepan nombre + chip de categoría):
- Icono + nombre arriba (line-clamp igual que hoy).
- Chip de categoría visible siempre (pedido explícito).
- Chips secundarios (empresa/centro/proyecto, fecha, quién subió) en texto pequeño, más compactos que las badges actuales de fila.
- Fila de acciones abajo: Descargar/Abrir enlace y Eliminar como iconos (igual que `document-card-list` hoy). Cambiar categoría y Marcar vencido se agrupan en un botón "⋮" que abre el mismo menú desplegable que ya existe hoy (se reutiliza el patrón de `toggleCategoriaMenu`, solo cambia el punto de anclaje visual).

### 3.3 Grilla contenedora

Cada uno de los 13 bloques reemplaza su wrapper de lista (hoy `<div style="border:...">` con filas apiladas) por un contenedor `flex-wrap` (mismo patrón que `.dcl-grid`: `display:flex; flex-wrap:wrap; gap:.7rem`), sin `grid-template-columns` fijo — la cantidad de tarjetas por fila es la que quepa en el ancho disponible, igual que pediste.

### 3.4 Alcance de la migración

Se migran los 8 bloques de admin y los 5 de consumidor. Cada bloque mantiene su propio handler existente (`eliminarEnTodos`, `eliminar`, `eliminarEnTodasEmpresas`, etc.) conectado al nuevo `(eliminar)` del componente — no se tocan los services ni la lógica de negocio, solo el markup de presentación.

## Fuera de alcance

- No se cambia el modelo de datos del backend ni los endpoints de documentos.
- No se toca `document-card-list` (usado por activos/actividades) ni su modelo `DocumentoTarjeta`.
- No se unifica la lógica de los 13 bloques en un solo `@for` genérico — cada uno conserva su array y sus handlers actuales; solo se comparte la tarjeta de presentación.

## Testing

- Verificación visual manual en navegador: modal de activos con 3+ documentos (3 por fila), wizard de actividades con 4+ documentos (4 por fila), módulo Documentos con suficientes documentos para ver el wrap en distintos anchos de ventana.
- Confirmar que las 13 vistas migradas conservan sus acciones actuales (probar Descargar, Cambiar categoría, Marcar vencido, Eliminar donde correspondía antes) y que consumidor sigue sin ver acciones de admin.
