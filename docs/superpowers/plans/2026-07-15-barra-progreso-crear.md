# Barra de progreso al crear solicitud/actividad Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar una barra de progreso indeterminada dentro del botón "Crear solicitud"
(documentos, admin) y del botón "Guardar" del wizard de actividades mientras el POST de
creación está en curso.

**Architecture:** Una única clase CSS reutilizable `.btn-loading` en `src/styles.css`
(barra animada vía `::after` + `@keyframes`), aplicada con `[class.btn-loading]` en los
dos botones existentes. Sin componente Angular nuevo, sin cambios de servicio.

**Tech Stack:** Angular 21 standalone, CSS puro (sin librerías de animación).

## Global Constraints

- No crear componentes Angular nuevos — la barra es CSS-only (spec:
  `docs/superpowers/specs/2026-07-15-barra-progreso-crear-design.md`).
- No modificar `SolicitudesService` ni `ActividadesService` — ambos ya manejan
  correctamente el reset de sus flags de loading en error.
- No reemplazar el texto actual de los botones ("Creando...", "Guardando...",
  "Subiendo..."); la barra es un indicador adicional.
- Estilos van en `src/styles.css` (global), no en CSS de componente, siguiendo la
  convención del proyecto para clases de botón compartidas (`.btn-primary`, etc.).

---

### Task 1: Clase CSS `.btn-loading` en styles.css

**Files:**
- Modify: `src/styles.css:102` (justo después del bloque `.btn-danger`, antes de la
  sección `/* ── Scroll area ── */` en la línea 104)

**Interfaces:**
- Produces: clase CSS `.btn-loading`, aplicable a cualquier `<button>` con
  `[class.btn-loading]="condicion"`. No requiere JS ni inputs — es puro CSS activado
  por la presencia de la clase.

- [ ] **Step 1: Agregar la clase y el keyframe en `src/styles.css`**

Insertar después de la línea 102 (`.btn-danger:hover { background: rgba(239,68,68,.12); }`)
y antes de la línea 104 (`/* ── Scroll area ─────────────────────────────────────── */`):

```css

/* ── Botón con progreso indeterminado ─────────────────── */
.btn-loading {
  position: relative;
  overflow: hidden;
}
.btn-loading::after {
  content: '';
  position: absolute;
  left: -40%;
  bottom: 0;
  height: 3px;
  width: 40%;
  background: rgba(255, 255, 255, .85);
  border-radius: 2px;
  animation: btn-loading-sweep 1.1s ease-in-out infinite;
}
@keyframes btn-loading-sweep {
  0%   { left: -40%; }
  100% { left: 100%; }
}
```

- [ ] **Step 2: Verificar que no rompe el layout de botones existentes**

Run: `npm run build`
Expected: build termina sin errores (el cambio es CSS puro, no debería afectar la
compilación de Angular).

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat(front): agregar clase .btn-loading para barra de progreso indeterminada"
```

---

### Task 2: Aplicar `.btn-loading` al botón "Crear solicitud"

**Files:**
- Modify: `src/app/features/documentos/pages/documentos-admin-page.component.html:691`

**Interfaces:**
- Consumes: clase `.btn-loading` (Task 1); signal `creandoSolicitud()` ya existente en
  `documentos-admin-page.component.ts:79`.

- [ ] **Step 1: Agregar el class binding al botón**

En `src/app/features/documentos/pages/documentos-admin-page.component.html:691`, el
botón actual es:

```html
<button class="btn-primary" style="font-size:.8rem;padding:.45rem .9rem" (click)="crearSolicitud()" [disabled]="!solicitudForm.nombre || creandoSolicitud()">{{ creandoSolicitud() ? 'Creando...' : 'Crear solicitud' }}</button>
```

Reemplazar por:

```html
<button class="btn-primary" [class.btn-loading]="creandoSolicitud()" style="font-size:.8rem;padding:.45rem .9rem" (click)="crearSolicitud()" [disabled]="!solicitudForm.nombre || creandoSolicitud()">{{ creandoSolicitud() ? 'Creando...' : 'Crear solicitud' }}</button>
```

- [ ] **Step 2: Verificar manualmente en el navegador**

Run: `npm start`

En `http://localhost:4200`, entrar como admin a Documentos → Solicitudes → "Crear
solicitud", completar el nombre y hacer click en "Crear solicitud".
Expected: mientras el POST está en curso, el botón muestra "Creando..." con una barra
clara animada deslizándose de izquierda a derecha en el borde inferior; al terminar
(éxito o error) la barra desaparece.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/documentos/pages/documentos-admin-page.component.html
git commit -m "feat(front): barra de progreso en boton Crear solicitud"
```

---

### Task 3: Aplicar `.btn-loading` al botón "Guardar" del wizard de actividades

**Files:**
- Modify: `src/app/features/actividades/pages/actividades-page.component.html:834-839`

**Interfaces:**
- Consumes: clase `.btn-loading` (Task 1); signal `service.saving()` (de
  `ActividadesService`, ya inyectado como `service` en el componente) y campo
  `subiendoDocs` (booleano plano en `actividades-page.component.ts:403`), ambos ya
  usados en el `[disabled]` de este mismo botón.

- [ ] **Step 1: Agregar el class binding al botón**

En `src/app/features/actividades/pages/actividades-page.component.html:834-839`, el
bloque actual es:

```html
            <button class="btn-primary" (click)="guardar()" [disabled]="service.saving() || subiendoDocs"
              style="background:#22c55e;border-color:#22c55e">
              @if (subiendoDocs) { Subiendo... }
              @else if (service.saving()) { Guardando... }
              @else { Guardar ✓ }
            </button>
```

Reemplazar por:

```html
            <button class="btn-primary" [class.btn-loading]="service.saving() || subiendoDocs" (click)="guardar()" [disabled]="service.saving() || subiendoDocs"
              style="background:#22c55e;border-color:#22c55e">
              @if (subiendoDocs) { Subiendo... }
              @else if (service.saving()) { Guardando... }
              @else { Guardar ✓ }
            </button>
```

- [ ] **Step 2: Verificar manualmente en el navegador**

Con `npm start` corriendo, entrar como admin a Actividades → "Nueva actividad",
completar el wizard hasta el paso 4 y hacer click en "Guardar ✓".
Expected: mientras `service.saving()` es `true`, el botón (verde) muestra "Guardando..."
con la barra clara animada en el borde inferior; si hay documentos pendientes, al pasar
a `subiendoDocs` la barra sigue visible mostrando "Subiendo...". Al terminar, el modal
se cierra y la barra ya no es visible.

- [ ] **Step 3: Commit**

```bash
git add src/app/features/actividades/pages/actividades-page.component.html
git commit -m "feat(front): barra de progreso en boton Guardar del wizard de actividades"
```
