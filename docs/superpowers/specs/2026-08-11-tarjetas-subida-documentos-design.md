# Tarjetas al subir documentos (Documentos admin/consumidor) — Diseño

**Fecha:** 2026-08-11
**Rama:** feat/documentos-busqueda-cascada

## Resumen

En el módulo Documentos (admin y consumidor), el modo "Subir archivo" del panel de carga hoy sube **un archivo a la vez**: se elige el archivo, se escribe un nombre y un tipo de documento a mano, y se hace clic en "Confirmar subida". El progreso se muestra en una burbuja flotante aparte (`UploadBubbleComponent`).

Se reemplaza ese flujo por el mismo patrón que ya usan Activos y Actividades: se pueden soltar/seleccionar **varios archivos a la vez**, cada uno sube automáticamente sin paso de confirmación, y aparece como una tarjeta (cuadrado) bajo el recuadro de arrastre mientras sube. La novedad respecto al patrón existente es que cada tarjeta muestra, **debajo**, su tipo de documento — adivinado automáticamente por el nombre del archivo (reutilizando `detectarCategoriaDocumento`, ya usada hoy) y editable con un selector por si la detección se equivoca. Las tarjetas no tienen apuro: quedan visibles indefinidamente (con su "×" para borrar por error) hasta que el usuario cierra el proceso con un botón "Terminar" — el mismo botón que hoy dice "↑ Subir" para abrir el panel.

La lista de documentos ya subidos (filas, con categoría/fecha/acciones) **no cambia**. Las tarjetas son exclusivamente para el proceso de carga en curso.

El modo "Adjuntar link" no cambia — sigue siendo un link a la vez, con sus campos de Nombre/Tipo y su botón "Confirmar subida" tal como hoy.

## Componentes involucrados

```
upload-queue-state.ts            (extender: categoria, docUrl, kind, nuevos métodos)
document-card-list.component.ts  (extender: mostrarCategoria, categoriaChange, reintentar)
upload-document-form.component.ts (extender: multi-archivo, ocultar campos en modo archivo)
documentos-admin-page.component.*     (reescribir el flujo de subida de archivo)
documentos-consumidor-page.component.* (ídem)
```

`document-card-list` y su modelo `DocumentoTarjeta` ya se usan en Activos/Actividades — todo lo nuevo se agrega como `@Input`/`@Output` opcionales con default que preserva el comportamiento actual (`mostrarCategoria = false` por defecto), así que esas dos features no cambian en nada.

## 1. `upload-queue-state.ts`

Extiende el modelo existente (ya trackea subiendo/listo/error con progreso — se reutiliza tal cual como fuente de datos de las tarjetas, no se crea un array paralelo):

```ts
export type UploadEstado = 'subiendo' | 'listo' | 'error';
export type UploadKind = 'archivo' | 'link';

export interface UploadItem {
  id: string;
  nombre: string;
  progreso: number;
  estado: UploadEstado;
  errorMsg?: string;
  kind: UploadKind;       // nuevo — separa qué se renderiza en tarjetas vs. en la burbuja
  categoria?: string;     // nuevo — tipo de documento, editable mientras subiendo/listo
  docUrl?: string;        // nuevo — se completa en marcarListo; hace falta para eliminar/cambiar categoría después de subido
}
```

Nuevos métodos en `createUploadQueue()`:
- `agregar(nombre: string, kind: UploadKind, categoria?: string): string` — firma extendida (compatible: `kind`/`categoria` con defaults en el call site).
- `marcarListo(id: string, docUrl: string): void` — ahora también guarda `docUrl`.
- `actualizarCategoria(id: string, categoria: string): void` — actualiza el campo local (se llama al cambiar el selector de una tarjeta).
- `quitar(id: string): void` — saca un item puntual del array (para el "×" de una tarjeta; `limpiar()` existente sigue sirviendo para vaciar todo al cerrar el panel).

## 2. `upload-document-form.component.ts`

**Multi-archivo:** `onDrop`/`onFileSelected` hoy solo toman `files?.[0]`. Se cambian para iterar todos los archivos del evento y emitir `archivoChange` una vez por archivo (mismo tipo de evento — `EventEmitter<File | null>` — solo se dispara más de una vez). Se agrega el atributo `multiple` al `<input type="file">`. Efecto colateral positivo y sin riesgo: Activos/Actividades, que ya escuchan `archivoChange`, ganan la posibilidad de soltar varios archivos de una vez sin cambiar su código.

**Ocultar campos en modo archivo:** hoy `mostrarTipoDocumento`/`mostrarNombre` controlan los campos tanto en modo archivo como en modo link. Se agrega `@Input() mostrarCamposArchivo = true`: en modo `'archivo'`, los campos Nombre/Tipo y los botones Confirmar/Cancelar quedan condicionados a `mostrarCamposArchivo` (Documentos los pone en `false`); en modo `'link'` siguen condicionados a `mostrarTipoDocumento`/`mostrarNombre` como hoy, sin cambios. Los demás consumidores (Activos/Actividades, que ya usan `mostrarTipoDocumento=false`) no se ven afectados.

## 3. `document-card-list.component.ts`

Nuevos `@Input`/`@Output`, todos con default que no altera el comportamiento actual:

- `@Input() mostrarCategoria = false`
- `@Input() categorias: readonly string[] = []`
- `@Output() categoriaChange = new EventEmitter<{ id: string; categoria: string }>()`
- `@Output() reintentar = new EventEmitter<string>()`

`DocumentoTarjeta` (`shared/models/documento-tarjeta.model.ts`) agrega `categoria?: string` (opcional, no rompe los usos actuales).

**Template:** cuando `mostrarCategoria` es `true`, cada tarjeta muestra debajo del nombre un `<select>` chico con `categorias`, bindeado a `doc.categoria`, visible mientras `estado` es `'subiendo'` o `'listo'` (no en `'pendiente'`/`'error'`, que no tienen categoría asignada todavía). Al cambiar, emite `categoriaChange` con `{ id, categoria }`.

Cuando `estado === 'error'`, además de la "×" ya existente, se agrega un botón "↻" que emite `reintentar` con el `id` (sin esto se perdería la funcionalidad de reintentar subida que ya existe hoy vía la burbuja).

La "×" (ya existente, sin cambios de comportamiento) sigue emitiendo `eliminar`; quien la escucha decide qué hacer según el estado del doc (ver más abajo) — el componente no necesita saberlo.

## 4. Documentos admin/consumidor — flujo de archivo

Aplica igual a `documentos-admin-page.component.ts`/`.html` y `documentos-consumidor-page.component.ts`/`.html` (mismo patrón, cada uno con su propio `panels[docTipo]`).

**Botón "Subir"/"Terminar":** el botón que hoy dice "↑ Subir" y llama a `toggleUpload(tipo)` cambia su texto e ícono según `panels[tipo].showUpload`: `false` → "↑ Subir", `true` → "✓ Terminar". Mismo handler (`toggleUpload`), sin lógica nueva — es un cambio de template. Al cerrar, `uploadQueue.limpiar()` se suma a lo que `toggleUpload` ya hace hoy al colapsar el panel; si algún archivo seguía `'subiendo'` en ese momento, la llamada HTTP en curso sigue su curso en segundo plano (no se cancela) y el documento terminará apareciendo en la lista de filas al refrescar, simplemente sin la tarjeta de confirmación visible.

**Al soltar/seleccionar archivos** (nuevo handler, reemplaza a `onArchivoChange` para el modo archivo): por cada `File` recibido (ahora puede dispararse varias veces por el cambio del punto 2) —
1. `categoria = detectarCategoriaDocumento(file.name) ?? 'Otros'`
2. `id = uploadQueue.agregar(file.name, 'archivo', categoria)`
3. Llama a `service.subir(file, tipo, empresaId, centroId, proyectoId, undefined, categoria)` de inmediato (mismo método que ya usa `ejecutarSubida` hoy) — sin esperar ninguna acción del usuario.
4. En progreso: `uploadQueue.actualizarProgreso(id, ...)` (igual que hoy).
5. Al terminar OK: `uploadQueue.marcarListo(id, docUrlDeLaRespuesta)`.
6. Al fallar: `uploadQueue.marcarError(id, mensaje)` (igual que hoy; se guarda también el `ctx` para reintentar, reutilizando `retryContext`/`reintentarSubida` ya existentes).

**Tarjetas:** se renderiza `<app-document-card-list [documentos]="tarjetasDeArchivo(tipo)" [mostrarCategoria]="true" [categorias]="categorias" (categoriaChange)="..." (eliminar)="..." (reintentar)="reintentarSubida($event)">` debajo del dropzone, donde `tarjetasDeArchivo(tipo)` filtra `uploadQueue.items()` a `kind === 'archivo'` y los mapea a `DocumentoTarjeta` (`id`, `nombre`, `tipoContenido: 'archivo'`, `estado`, `categoria`).

- `(categoriaChange)`: `uploadQueue.actualizarCategoria(id, categoria)`; si el item ya está `'listo'` (tiene `docUrl`), además llama a `service.actualizarCategoria(docUrl, categoria, tipo)` (mismo método que ya usa hoy el "Cambiar categoría" de la fila) para persistir el cambio.
- `(eliminar)`: si el item está `'listo'`, llama a `service.eliminar(docUrl, tipo, ...)` (borra el documento real, igual que la fila) y en el `next` hace `uploadQueue.quitar(id)`; si está `'error'`, solo `uploadQueue.quitar(id)` (nunca llegó a crearse nada del lado servidor).

**Burbuja de subida (`UploadBubbleComponent`):** se mantiene, pero pasa a mostrar solo los items `kind === 'link'` de la cola (filtro en el template donde se usa `<app-upload-bubble [items]="...">` — se le pasa `uploadQueue.items().filter(i => i.kind === 'link')` en vez de `uploadQueue.items()`). El modo link no cambia de flujo (sigue con Nombre/Tipo/Confirmar), así que sigue teniendo sentido mostrarlo en la burbuja como hoy; `agregar()` en el modo link pasa `kind: 'link'`.

## Fuera de alcance

- No se toca el modo "Adjuntar link" (campos, botón Confirmar, burbuja para ese tipo de item).
- No se toca la lista de documentos ya subidos (filas) en ninguna vista.
- No se toca `document-card-list` ni `DocumentoTarjeta` de forma que afecte a Activos/Actividades — todo lo nuevo es opt-in con default que reproduce el comportamiento actual.
- No se cambia el backend ni los endpoints existentes (`subir`, `eliminar`, `actualizarCategoria` ya soportan todo lo necesario).

## Testing

- Tests unitarios de `upload-queue-state.ts` para los métodos nuevos (`actualizarCategoria`, `quitar`, `marcarListo` con `docUrl`, `agregar` con `kind`/`categoria`).
- Tests de `document-card-list.component.spec.ts` para `mostrarCategoria` (selector visible/oculto según estado, emisión de `categoriaChange`) y `reintentar` (botón visible solo en error, emisión con el id correcto) — sin tocar los tests existentes, que deben seguir pasando sin `mostrarCategoria`.
- Tests de `upload-document-form.component.spec.ts` para multi-archivo (soltar/seleccionar varios dispara `archivoChange` una vez por archivo) y para `mostrarCamposArchivo` (oculta campos/botones en modo archivo, no afecta modo link).
- Verificación manual en navegador: soltar 2-3 archivos juntos en Documentos (admin y consumidor), confirmar que suben en paralelo, que el tipo se puede corregir mientras sube, que "×" borra correctamente según el estado, que "Terminar" cierra el panel y la lista de filas ya muestra los nuevos documentos, y que el modo link sigue funcionando igual que hoy.
