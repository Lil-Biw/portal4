# Burbuja de progreso de carga de documentos

## Problema

Al subir documentos en `/documentos` (admin y consumidor), no hay ninguna señal visual de que un archivo se está subiendo hasta que aparece el banner de estado (`status-banner`) al terminar. Además, el estado se guarda en un único signal por tipo de documento (`empresa | centro | proyecto`), no por archivo, así que si el usuario sube dos archivos seguidos, la respuesta HTTP que llega después sobrescribe el estado de la que llegó antes — el usuario ve la notificación del segundo archivo, y segundos después "aparece tarde" la del primero.

## Alcance

Se implementa únicamente en `DocumentosAdminPageComponent` y `DocumentosConsumidorPageComponent`. El componente de burbuja es genérico y reutilizable, para que Activos/Actividades/Solicitudes puedan adoptarlo después sin duplicar la UI.

La burbuja es **local a la página**, no un overlay global de la app: si el usuario navega a otra sección mientras sube un archivo, deja de ver la burbuja (igual que hoy pierde de vista el banner).

## Diseño

### 1. Progreso real por bytes

`DocumentosService.subir()` (hoy en `documentos.service.ts:170-213`) hace `http.post(url, form).subscribe(...)` sin reportar progreso. Se cambia a:

```ts
subir(...): Observable<HttpEvent<Documento>> {
  return this.http.post<Documento>(url, form, {
    reportProgress: true,
    observe: 'events',
  });
}
```

El método deja de suscribirse internamente — devuelve el observable de eventos para que el llamador (la página) actualice el progreso de su propia cola.

### 2. Cola de subidas por página

Cada página (`documentos-admin-page.component.ts`, `documentos-consumidor-page.component.ts`) mantiene:

```ts
interface UploadItem {
  id: string;           // uuid local
  nombre: string;
  progreso: number;     // 0-100
  estado: 'subiendo' | 'listo' | 'error';
  errorMsg?: string;
}

uploadQueue = signal<UploadItem[]>([]);
```

`confirmarSubida(tipo)` ya no llama a `service.subir(...).subscribe({ next: () => setStatus('ok') })`. En su lugar:

1. Agrega un nuevo `UploadItem` al final de `uploadQueue` (nunca sobrescribe uno existente — esto es lo que corrige el bug de notificaciones cruzadas).
2. Se suscribe al observable de eventos de `service.subir(...)`:
   - `HttpEventType.UploadProgress` → calcula `Math.round(100 * event.loaded / event.total)` y actualiza el `progreso` de ese item.
   - `HttpResponse` → marca el item como `listo`.
   - `error` → marca el item como `error` con el mensaje del backend (mismo patrón que `setError()` ya usado en el resto de los services).

El `status-banner` actual atado a `uploadStatus()` se elimina de la vista de subida — la burbuja pasa a ser la única fuente de verdad sobre el resultado de cada subida.

### 3. Componente `UploadBubbleComponent` (nuevo, en `shared/components/upload-bubble/`)

Standalone, puramente presentacional:

```ts
@Input() items: UploadItem[] = [];
@Output() cerrar = new EventEmitter<void>();
@Output() reintentar = new EventEmitter<string>(); // id del item
```

- Card flotante `position: fixed; right: 1.5rem; bottom: 1.5rem`, estilo visual consistente con el resto de la app (paleta `--accent`/`--ok`/`--danger` de `styles.css`, radios de 14px, sombra suave).
- Encabezado con título "Subiendo documentos", contador de items, y botón de cierre (✕).
- Lista de filas, una por `UploadItem`:
  - **Subiendo**: ícono circular tipo anillo de progreso con el `%` en el centro + barra de progreso lineal bajo el nombre del archivo.
  - **Listo**: ícono de check verde + "Subido correctamente".
  - **Error**: ícono de X roja + mensaje de error + botón "Reintentar" que emite `reintentar` con el id del item; la página vuelve a llamar `service.subir()` para ese archivo y resetea su estado a `subiendo`.
- La burbuja **permanece visible hasta que el usuario la cierra manualmente** con el botón ✕ (sin auto-ocultado). Cerrar limpia `uploadQueue` en la página.
- Solo se renderiza (`@if (uploadQueue().length > 0)`) cuando hay al menos un item en la cola.

Mockup visual aprobado: burbuja anclada abajo-derecha, ver referencia en la conversación (artifact `upload-bubble-mockup.html`).

### 4. Manejo de errores

Reutiliza el mismo patrón que ya usan los services (`private setError(err)`): al fallar la subida se extrae `err?.error?.message` del backend y se guarda en `errorMsg` del item, sin texto genérico hardcodeado salvo fallback si el backend no da mensaje.

## Fuera de alcance

- Subida múltiple de archivos en un mismo input (`<input type="file" multiple>`) — hoy cada input solo maneja un archivo; no se cambia ese comportamiento, solo cómo se reporta el progreso de cada subida individual que el usuario dispare en secuencia.
- Burbuja global compartida entre páginas (activos, actividades, solicitudes) — se deja preparado el componente para reutilizarlo, pero la integración en esas páginas no es parte de este trabajo.
- Persistencia de la cola entre navegaciones o recarga de página.
