# Rediseño de subida de documentos: tarjetas + auto-subida

**Fecha:** 2026-08-10
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Al crear una actividad (paso 3 del wizard), los usuarios seleccionan un
archivo pero olvidan tocar el botón "Adjuntar", que es un paso separado y no
obvio. El resultado: el archivo queda seleccionado en el formulario pero
nunca se sube, y el documento se pierde silenciosamente.

## Alcance

El flujo de subida vive en un componente compartido,
`front4/src/app/shared/components/upload-document-form/`, reutilizado por
**actividades, activos, documentos y solicitudes**. Este rediseño se aplica
a los cuatro lugares por igual — no es específico de actividades.

## Diseño visual y de interacción

### Auto-subida (elimina el botón "Adjuntar")

- Seleccionar un archivo (clic o drag-and-drop) dispara la subida
  inmediatamente. No existe más un botón de confirmación intermedio.
- Mientras la subida está en curso, aparece una tarjeta en estado "subiendo…"
  con spinner.

### Tarjetas en vez de lista de filas

Cada documento subido se muestra como una tarjeta individual (no una fila de
lista), dentro del propio recuadro de arrastrar (dropzone). Las tarjetas se
acomodan en una grilla que envuelve (`flex-wrap`).

- **Ancho de tarjeta:** ~150px. Suficiente para que nombres largos entren
  casi completos en 3 líneas.
- **Nombre:** centrado, máximo 3 líneas (`-webkit-line-clamp: 3`), con
  `title="{{nombre completo}}"` para ver el nombre íntegro al pasar el mouse
  si quedó truncado.
- **Sin ícono de tipo de archivo** — se probó con ícono por tipo (📄/📎/🖼) y
  se descartó a pedido explícito; la tarjeta es solo nombre + acciones.
- **Cruz de eliminar:** esquina superior derecha, dibujada con CSS (dos
  líneas cruzadas, no un glifo de texto), posicionada **dentro** del padding
  de la tarjeta — no debe sobresalir del borde. Motivo: en una iteración
  anterior la cruz se centraba sobre el borde (mitad adentro, mitad afuera) y
  el contenedor padre recortaba la mitad que sobresalía, dejándola cortada.
  Mantenerla 100% dentro del padding evita ese problema sin importar qué
  contenedor la envuelva.
- **Acciones (fila inferior, dentro de la tarjeta):** dos botones solo-ícono,
  separados por un borde superior sutil — descargar (⬇) y renombrar (✎). Sin
  etiquetas de texto.

### Eliminar

- Clic en la cruz elimina directo, **sin diálogo de confirmación**.
- Mientras la petición DELETE está en curso, la tarjeta se atenúa (opacity
  reducida) y el nombre se reemplaza por "Eliminando…" con un spinner
  pequeño. Al confirmar el servidor, la tarjeta desaparece de la grilla.

### Renombrar (inline, sin modal)

- Clic en el ícono ✎ reemplaza el bloque de nombre por un `<input>` dentro de
  la misma tarjeta (no agrega espacio nuevo ni abre un diálogo).
- El input contiene **solo el nombre sin extensión** (ej. `informe_final`),
  preseleccionado para sobreescribir directo. La extensión original
  (`.pdf`, `.jpg`, etc.) no es editable — se vuelve a concatenar sola al
  guardar. Esto evita que alguien cambie o borre la extensión por accidente
  y rompa el archivo.
- `Enter` confirma y guarda el nuevo nombre. `Esc` cancela y vuelve al
  nombre anterior sin guardar.

### Error de subida

No se boceteó explícitamente; se define acá para no dejar el caso sin
comportamiento: si la subida falla, la tarjeta queda con borde rojo y el
texto "Error al subir". La cruz de la tarjeta se reutiliza (sin agregar un
control nuevo) para descartar la tarjeta fallida; el usuario reintenta
seleccionando el archivo de nuevo desde el dropzone.

### Caso especial: creación de actividad nueva

Cuando se está creando una actividad todavía sin `_id` (paso 3 del wizard,
antes de guardar), no existe `actividadId` para hacer el POST real al
servidor. Hoy esto se resuelve encolando los archivos localmente
(`docsPendientes`) y subiéndolos secuencialmente recién cuando se crea la
actividad (`subirDocsPendientesSecuencial`, ver
`actividades-page.component.ts` líneas 429-554).

Ese mecanismo de cola se mantiene sin cambios funcionales, pero se re-viste
visualmente: la tarjeta aparece igual que las demás (mismo tamaño, mismas
acciones visibles donde aplique) con una etiqueta discreta **"pendiente"**
que indica que la subida real todavía no ocurrió. Al guardar la actividad,
las tarjetas pendientes se suben en secuencia y la etiqueta desaparece.

## Backend

No existe endpoint de renombrar en ningún lugar del sistema hoy
(`grep -rn "renombrar|rename"` no devuelve resultados en `back4/src` ni
`front4/src`). Hay que agregarlo:

- **`DocumentosHelper`** (`back4/src/common/helpers/documentos.helper.ts`):
  agregar un método `renombrar()` que actualice `nombre_display`, siguiendo
  el mismo patrón que el método existente `actualizarCategoria` (líneas
  155-166), que hace un `findOneAndUpdate` equivalente sobre `categoria`.
- **Rutas nuevas:** cada controlador que ya expone
  `GET/POST/DELETE :parentId/documentos/:docId` (actividades, activos,
  proyectos, centros) necesita una ruta adicional, ej.
  `PUT :parentId/documentos/:docId/nombre`, que llame al nuevo método del
  helper.
- **Solicitudes:** falta confirmar si los documentos de solicitudes pasan
  por el mismo `DocumentosHelper` compartido o por un mecanismo aparte. Se
  investiga al armar el plan de implementación, antes de tocar código.

## Frontend — servicios

Cada servicio de feature que ya tiene `subirDocumento`/`eliminarDocumento`
(ej. `actividades.service.ts` líneas 108-183, y sus equivalentes en
activos/documentos/solicitudes) necesita un método nuevo
`renombrarDocumento(id, nuevoNombre)` que llame a la ruta PUT nueva.

## Fuera de alcance

- No se rediseña el resto del modal/wizard de actividades, solo el bloque
  de subida de documentos (paso 3) y sus equivalentes en los otros 3
  lugares.
- No se agrega selección/subida múltiple simultánea más allá de lo que ya
  soporta el dropzone actual.
- No se agrega confirmación de borrado (decisión explícita del usuario:
  borrado directo).
