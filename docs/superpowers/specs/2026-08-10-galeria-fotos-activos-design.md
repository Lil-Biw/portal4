# Galería de fotos en el modal de revisión de activos

## Contexto

El modal `activo-revisar-modal.component.ts` muestra, apiladas en una sola columna, las secciones **Documentos del activo**, **Descripción** e **Historial de actividades**. Todos los documentos (PDF, imágenes, etc.) se listan igual, con el mismo ícono genérico de archivo — no hay preview de imágenes.

Se agrega una columna nueva a la derecha del modal, "Galería de fotos", que muestra como miniaturas scrolleables solo los documentos del activo cuyo `tipo_mime` es una imagen. Alcance confirmado con el usuario: **solo el modal principal del activo** — el sub-modal "Detalle de actividad" (que tiene su propia lista de "Documentos de la actividad") no lleva galería.

Mockup aprobado: layout de dos columnas, izquierda igual que hoy (Documentos/Descripción/Historial), derecha una columna fija de ancho `268px` con scroll propio e independiente, mismo lenguaje visual (`sec-label`, bordes suaves `rgba(34,33,33,.08)`, radios de 8-10px) ya usado en el resto del componente.

## Por qué no se usa un endpoint público

El logo de cliente y las imágenes de noticias se sirven vía endpoints `@Public()` y se pintan con `<img src>` directo. Los documentos de activos, en cambio, están protegidos por `JwtAuthGuard` + `EmpresaAccessGuard` (`GET /empresas/:empresaId/centros/:centroId/activos/:activoId/documentos/:docId`) porque son archivos propios de cada empresa cliente. Se mantiene esa protección: no se agrega ninguna variante pública del endpoint. Esto obliga a cargar las miniaturas vía blob autenticado (`HttpClient` + interceptor JWT) en vez de una URL directa en `src`.

## Frontend (`front4/src/app/features/activos/`)

### `activo-revisar-modal.component.ts`

- Nuevo `computed` `imagenesActivo()`: filtra `documentosActivo()` (input ya existente) por `doc.tipo_mime?.startsWith('image/')`.
- Nuevo `@Input() imagenesCargadas: Map<string, { url: string; estado: 'cargando' | 'lista' | 'error' }>` (estado vive en el padre, ver más abajo — el modal solo lee).
- `effect()` sobre `imagenesActivo()`: por cada imagen que todavía no tenga entrada en `imagenesCargadas`, emite `@Output() cargarImagenActivo` con `{ docId }`, que el padre resuelve igual que `descargarActivoDoc` hoy — el modal no llama a `HttpClient` directamente, sigue el patrón actual donde toda llamada HTTP la hace el componente página (`mis-activos-page.component.ts` / `activos-page.component.ts`), no el modal.
- El padre (`mis-activos-page.component.ts`, `activos-page.component.ts`) agrega un método `onCargarImagenActivo`, análogo a `onDescargarActivoDoc`, que llama a un nuevo método del service `activos.service.ts`:

```ts
obtenerImagenDocumento(activoId: string, centroId: string, docId: string): Observable<Blob> {
  const { empresaId } = this.resolverIds(centroId);
  const url = this.api.url(`/empresas/${empresaId}/centros/${centroId}/activos/${activoId}/documentos/${docId}`);
  return this.http.get(url, { responseType: 'blob' });
}
```

  Devuelve el `Observable<Blob>` en vez de disparar la descarga (a diferencia de `triggerDownload`, que crea el `<a download>` y lo revoca al toque). El padre mantiene el estado de las miniaturas en un `signal<Map<string, { url: string; estado: 'cargando' | 'lista' | 'error' }>>` propio, y lo pasa al modal como `@Input() imagenesActivo: Map<...>` (o `input<Map<...>>()` con la nueva API de signals). El padre se suscribe al `Observable<Blob>`, arma el `ObjectURL` con `URL.createObjectURL(blob)` y actualiza ese map — el modal solo lee el `@Input`, nunca escribe en él directamente. Así el modal se mantiene "tonto" (sin llamadas HTTP ni estado propio de red), igual que ya es hoy para `descargarActivoDoc`.
- **Miniatura**: `<img [src]="urlDeLaImagen(doc._id)">` con `object-fit: cover`, `aspect-ratio: 4/3`. Mientras `estado === 'cargando'` se muestra un placeholder (bloque gris con pulso o spinner simple, sin librería nueva). Si `estado === 'error'`, ícono de "no disponible" (mismo SVG genérico de archivo que ya existe, con opacidad reducida) — no hay reintento automático.
- **Click en miniatura**: reutiliza el mismo `ObjectURL` ya cargado → `window.open(url, '_blank')`. No dispara un segundo fetch.
- **Badge de formato**: mapeo `tipo_mime → etiqueta corta` (`image/jpeg` → `JPG`, `image/png` → `PNG`, `image/webp` → `WEBP`, `image/gif` → `GIF`). Se agrega como función local al componente (mapa pequeño de 4-5 entradas); no se extrae `extFromMime` de `documentos.service.ts` a un helper compartido — es una tabla distinta (mime→ext de archivo vs. mime→etiqueta corta de imagen) y extraerla no aporta reuso real hoy.
- **Revocación de memoria**: como el map de miniaturas vive en el padre, es el padre quien revoca — al cerrar el modal (mismo punto donde hoy se limpia `activoRevisando`), recorre `imagenesCargadas` y llama `URL.revokeObjectURL(url)` por cada entrada con `estado === 'lista'`, y limpia el map.
- **Columna condicional**: si `imagenesActivo().length === 0`, no se renderiza `.gallery-col` ni se aplica el grid de dos columnas — `.modal-body` vuelve a una sola columna (comportamiento actual, sin cambios visuales para activos sin fotos).

### Layout (estilos inline del componente)

```css
.modal-body { display: grid; grid-template-columns: 1fr; }
.modal-body:has(.gallery-col) { grid-template-columns: 1fr 268px; }
.gallery-col { border-left: 1px solid var(--border, #e5e7eb); display: flex; flex-direction: column; min-height: 0; }
.gallery-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: .65rem; }
```

(`:has()` evita un `[class.two-cols]` extra en el template; si el proyecto necesita soportar navegadores sin `:has()` se resuelve con un `@if`/binding de clase en su lugar — a decidir en el plan si aplica).

### Contenedores padre (`activos-page.component.ts`, `mis-activos-page.component.ts`)

- Agregan el nuevo método `onCargarImagenActivo` y lo conectan al `@Output()` del modal, igual que ya hacen con `onDescargarActivoDoc`.
- El wrapper `.modal` de ambas páginas necesita más ancho para dar lugar a la columna nueva sin apretar el contenido izquierdo (hoy piensa en una sola columna). Ajustar `max-width` del `.modal` (valor exacto a definir en el plan, mirando cómo se ve con la columna de 268px + el contenido actual).

## Manejo de errores

- Fetch de una miniatura falla (403/404/500/red) → esa miniatura pasa a `estado: 'error'`, muestra el ícono de "no disponible"; el resto de la galería y el modal siguen funcionando normalmente.
- Ningún error de imagen bloquea la carga de Documentos/Descripción/Historial (son independientes).

## Testing

El modal no tiene tests automatizados hoy (ni unitarios ni e2e). Verificación manual en navegador:

1. Activo con varias fotos de distintos formatos → aparecen todas las miniaturas con su badge correcto, scroll de la columna funciona independiente del resto del modal.
2. Activo sin ninguna imagen entre sus documentos → no aparece la columna, el modal se ve igual que hoy.
3. Click en una miniatura → abre pestaña nueva con la imagen a tamaño completo.
4. Cerrar el modal y reabrirlo → no quedan `ObjectURL` colgados (verificable en devtools, memoria no crece de forma indefinida al abrir/cerrar repetidamente).
5. Simular un fetch de imagen fallido (p. ej. cortando red en devtools) → esa miniatura muestra el ícono de error sin romper el resto.

## Fuera de alcance

- Sub-modal "Detalle de actividad": no lleva galería (decisión confirmada con el usuario).
- No se genera thumbnail reducido en el backend ni se agrega endpoint nuevo: se reutiliza el endpoint de descarga existente y se escala la imagen completa por CSS (decisión explícita del usuario: "lo más rápido sería reducirla").
- No se contempla layout responsive/mobile: el uso está pensado para oficina, en pantallas de escritorio.
- No se agrega lightbox propio (zoom, navegación entre fotos dentro del modal, etc.) — el click abre la imagen en una pestaña nueva del navegador, nada más.
- No se extrae un helper compartido de mime→extensión entre este componente y `documentos.service.ts`.
