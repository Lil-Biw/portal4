# Lupa "Ver documentos" en el resumen del wizard de actividades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar una tercera lupa "Ver documentos" a la fila Documentos del paso 4 (Resumen) del wizard de crear/editar actividad, que abra un mini-modal de solo lectura con los nombres de los documentos adjuntos.

**Architecture:** Extensión directa del patrón ya existente para las lupas de "Activos" y "Notificaciones" en `actividades-page.component.ts/.html/.css`: ampliar el signal `modalLupa` con un tercer valor `'docs'`, agregar un computed `resumenDocumentosLista`, y replicar el markup del botón y del mini-modal.

**Tech Stack:** Angular 21 standalone, signals, control flow `@if`/`@for`.

## Global Constraints

- Sin `any` — todo tipado (spec, sección "Diseño").
- Solo se tocan `actividades-page.component.ts`, `.html`, `.css` (spec, sección "Alcance"). No tocar `mis-actividades-page`, backend, ni modelos.
- La lupa es de solo lectura, sin acciones de descarga/eliminación (spec, sección "Comportamiento").
- La lupa no debe mostrarse si la lista de documentos está vacía, igual que las lupas de Activos/Notificaciones (spec, sección "Comportamiento").
- Reusar exactamente el markup/estilos inline del botón lupa existente (SVG, mismos estilos) para mantener consistencia visual.

Spec de referencia: `docs/superpowers/specs/2026-08-10-lupa-documentos-resumen-actividad-design.md`

---

### Task 1: Agregar lupa "Ver documentos" al resumen del wizard

**Files:**
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.ts` (signal `modalLupa`, nuevo computed `resumenDocumentosLista`)
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html` (fila "Documentos" del resumen, nuevo mini-modal)
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.css` (nueva clase `.lupa-item--amber`)

**Interfaces:**
- Consumes: `this.editingId(): string | null` (ya existente), `this.service.documentosActividad(): DocActividad[]` (signal en `ActividadesService`, campo `nombre_display: string`), `this.docsPendientes: { file?: File; linkUrl?: string; nombre: string }[]` (ya existente).
- Produces: `protected resumenDocumentosLista: Signal<string[]>` (computed) — lista de nombres a mostrar en el mini-modal. No es consumido por ninguna otra tarea (es la única tarea del plan).

No hay tests unitarios existentes para este wizard (confirmado en la spec, sección "Testing"); la verificación es manual vía `ng serve`. Por eso este task no sigue el ciclo red/green de TDD sino edición + verificación manual en navegador.

- [ ] **Step 1: Extender el signal `modalLupa` y agregar el computed `resumenDocumentosLista`**

En `actividades-page.component.ts`, localizar la línea:

```ts
protected modalLupa          = signal<'activos' | 'notif' | null>(null);
```

Reemplazar por:

```ts
protected modalLupa          = signal<'activos' | 'notif' | 'docs' | null>(null);
```

Localizar el computed `resumenActivosLista` (justo antes está bien como referencia de ubicación) y agregar, junto a `resumenNotifLista`, el nuevo computed:

```ts
protected resumenDocumentosLista = computed(() => {
  if (this.editingId()) {
    return this.service.documentosActividad().map(d => d.nombre_display);
  }
  return this.docsPendientes.map(d => d.nombre);
});
```

- [ ] **Step 2: Agregar el botón lupa en la fila "Documentos" del resumen**

En `actividades-page.component.html`, ubicar el bloque:

```html
<div class="wz-resumen-row">
  <span class="wz-resumen-label">Documentos</span>
  <span class="wz-resumen-value">{{ resumenDocumentosTexto }}</span>
</div>
```

Reemplazar por:

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

- [ ] **Step 3: Agregar el tercer mini-modal**

En el mismo archivo, justo después del bloque `@if (modalLupa() === 'notif') { ... }` (mini-modal de notificaciones) y antes del `</div>` que cierra el modal principal, agregar:

```html
<!-- Mini-modal lupa documentos -->
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

- [ ] **Step 4: Agregar el estilo `.lupa-item--amber`**

En `actividades-page.component.css`, junto a las reglas existentes:

```css
.lupa-item--blue  { color: #0369a1; background: #f0f9ff; }
.lupa-item--green { color: #15803d; background: #f0fdf4; }
```

Agregar:

```css
.lupa-item--amber { color: #b45309; background: #fffbeb; }
```

- [ ] **Step 5: Verificar compilación**

Run: `cd front4 && npx tsc --noEmit -p tsconfig.app.json`
Expected: sin errores nuevos relacionados a `actividades-page.component.ts` (el `computed` y el tipo del signal deben compilar sin `any` ni errores de tipo).

Si el proyecto no tiene ese script exacto, usar `npm run build` como alternativa y confirmar que no aparecen errores en `actividades-page.component.*`.

- [ ] **Step 6: Verificación manual en navegador — modo crear**

1. `cd front4 && npm start`
2. Ir a `/actividades`, abrir "Crear actividad".
3. Completar paso 1 y 2 mínimamente, en paso 3 adjuntar al menos 1 documento (archivo o link) a la lista pendiente.
4. Avanzar a paso 4 (Resumen).
5. Confirmar que la fila "Documentos" ahora muestra el ícono de lupa.
6. Hacer clic en la lupa y confirmar que el mini-modal lista el/los nombre(s) del/los documento(s) agregados en el paso 3, con el estilo ámbar.
7. Cerrar el mini-modal con la "✕" y con clic fuera (overlay), confirmar que ambos cierran correctamente.

- [ ] **Step 7: Verificación manual en navegador — modo editar**

1. Editar una actividad existente que ya tenga documentos adjuntos (o adjuntar uno nuevo y guardar, luego reabrir en modo editar).
2. Ir directo a paso 4 (Resumen) — o navegar los pasos hasta llegar ahí.
3. Confirmar que la lupa de Documentos aparece y que el mini-modal lista los `nombre_display` de los documentos ya persistidos (`service.documentosActividad()`).

- [ ] **Step 8: Verificación manual — caso sin documentos**

1. Crear una actividad nueva sin adjuntar documentos en el paso 3.
2. Llegar al paso 4 y confirmar que la fila "Documentos" muestra "Sin documentos" **sin** el ícono de lupa (igual que el comportamiento ya existente de Activos/Notificaciones cuando están vacíos).

- [ ] **Step 9: Commit**

```bash
git add front4/src/app/features/actividades/pages/actividades-page.component.ts \
        front4/src/app/features/actividades/pages/actividades-page.component.html \
        front4/src/app/features/actividades/pages/actividades-page.component.css
git commit -m "feat(front): agregar lupa de documentos al resumen del wizard de actividades"
```
