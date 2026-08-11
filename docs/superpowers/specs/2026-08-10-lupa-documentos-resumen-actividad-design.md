# Lupa "Ver documentos" en el resumen del wizard de actividades

## Contexto

En el wizard admin de crear/editar actividad (`front4/src/app/features/actividades/pages/actividades-page.component.*`), el paso 4 (Resumen) muestra tres filas: Activos, Notificaciones y Documentos. Las dos primeras tienen un botón lupa que abre un mini-modal (`lupa-overlay`/`lupa-box`) con la lista de nombres correspondiente. La fila "Documentos" solo muestra un texto agregado (p. ej. "3 archivos") sin forma de ver el detalle.

## Objetivo

Agregar una tercera lupa "Ver documentos" a la fila Documentos del resumen, consistente en estilo y comportamiento con las lupas existentes de Activos y Notificaciones: un mini-modal de solo lectura con la lista de nombres de los documentos adjuntos.

## Alcance

Solo `actividades-page.component.ts`, `.html` y `.css` (wizard admin). No afecta `mis-actividades-page` (consumidor, solo lectura, sin este wizard), backend, ni modelos.

## Diseño

### 1. `actividades-page.component.ts`

- Extender el tipo del signal existente:
  ```ts
  protected modalLupa = signal<'activos' | 'notif' | 'docs' | null>(null);
  ```
- Agregar un nuevo computed `resumenDocumentosLista`, replicando la misma rama condicional que ya usa el getter `resumenDocumentosTexto`:
  ```ts
  protected resumenDocumentosLista = computed(() => {
    if (this.editingId()) {
      return this.service.documentosActividad().map(d => d.nombre_display);
    }
    return this.docsPendientes.map(d => d.nombre);
  });
  ```

### 2. `actividades-page.component.html`

- En la fila "Documentos" del resumen (paso 4, junto a `{{ resumenDocumentosTexto }}`), agregar un botón lupa con el mismo markup (SVG lupa, mismos estilos inline) que los de Activos/Notificaciones, condicionado a que la lista no esté vacía:
  ```html
  <div class="wz-resumen-row">
    <span class="wz-resumen-label">Documentos</span>
    <span class="wz-resumen-value">{{ resumenDocumentosTexto }}</span>
    @if (resumenDocumentosLista().length > 0) {
      <button type="button" (click)="modalLupa.set('docs')"
        style="margin-left:auto;background:none;border:none;cursor:pointer;padding:0;color:#9ca3af;display:flex;align-items:center;flex-shrink:0"
        title="Ver documentos">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </button>
    }
  </div>
  ```
- Agregar el tercer mini-modal, junto a los de `'activos'` y `'notif'`:
  ```html
  @if (modalLupa() === 'docs') {
    <div class="lupa-overlay" (click)="$event.stopPropagation(); modalLupa.set(null)">
      <div class="lupa-box" (click)="$event.stopPropagation()">
        <div class="lupa-header">
          <span class="lupa-title">Documentos adjuntos</span>
          <button class="lupa-close" (click)="modalLupa.set(null)">✕</button>
        </div>
        <div class="lupa-body">
          @for (nombre of resumenDocumentosLista(); track nombre) {
            <div class="lupa-item lupa-item--amber">· {{ nombre }}</div>
          }
        </div>
      </div>
    </div>
  }
  ```

### 3. `actividades-page.component.css`

- Agregar la variante de color, siguiendo el patrón de `--blue`/`--green`:
  ```css
  .lupa-item--amber { color: #b45309; background: #fffbeb; }
  ```

## Comportamiento

- **Modo crear** (`!editingId()`): la lupa lista los nombres de `docsPendientes` (documentos aún no subidos, agregados en el paso 3).
- **Modo editar** (`editingId()`): la lupa lista `nombre_display` de `service.documentosActividad()` (documentos ya persistidos).
- Es de solo lectura, igual que las lupas de Activos y Notificaciones — no incluye acciones de descarga/eliminación (esas ya existen en el paso 3).
- La lupa no se muestra si no hay documentos (lista vacía), igual que el patrón ya usado en la lupa de Activos (`form().activo_ids.length > 0`) y Notificaciones (`resumenNotifLista().length > 0`).

## Testing

Cambio puramente de UI en un componente sin tests unitarios existentes para el wizard. Verificación manual:
1. Crear una actividad nueva, adjuntar 1+ documentos en el paso 3, llegar al paso 4 y confirmar que aparece la lupa de Documentos y que el mini-modal lista los nombres correctos.
2. Editar una actividad existente con documentos ya subidos, ir al paso 4, confirmar que la lupa lista `nombre_display` de los documentos persistidos.
3. Confirmar que si no hay documentos, la lupa no se muestra (igual que Activos/Notificaciones cuando están vacíos).
