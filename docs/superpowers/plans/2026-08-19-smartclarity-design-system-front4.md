# Smartclarity Design System en front4 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin todo front4 (Angular 21 standalone, portal de clientes) con los tokens de color/tipografía/spacing/radii/shadows del Smartclarity Design System, sin tocar layout ni lógica de negocio.

**Architecture:** Se reemplaza el bloque `:root` de `front4/src/styles.css` por los tokens de marca (ver Global Constraints) y se recorren ~70 archivos (componentes `.ts` con `styles:` inline, `.html` con `style=""` inline, `.css`) reemplazando valores hex/rgba hardcodeados por `var(--token)` equivalentes. No hay librería de componentes de por medio — todo es CSS/inline styles. Los íconos del sidebar/topbar (ya son SVG estilo Lucide) solo ajustan `stroke-width` de 2 a 1.75.

**Tech Stack:** Angular 21 standalone, CSS custom properties (`:root` vars), Google Fonts (Space Grotesk + DM Sans), sin Angular Material ni librería de íconos.

**Spec:** `docs/superpowers/specs/2026-08-19-smartclarity-design-system-front4-design.md`

## Global Constraints

Estas reglas aplican a **todas** las tareas de este plan salvo que una tarea indique una excepción puntual.

### Tokens nuevos que se agregan en la Tarea 1 (no estaban en el spec original, se agregaron durante la auditoría de código con aprobación del usuario)

```css
--revision:     #B45309;  --revision-bg:  #FEF3C7;  /* ámbar del estado "Revisión" del score documental */
--rechazado:    #9D174D;  --rechazado-bg: #FCE7F3;  /* fucsia/rosa del estado "Rechazados" del score documental */
--overlay:      rgba(11, 15, 20, .45);              /* fondo de backdrop de modales, basado en --fg-1 */
```

Nota de nombres: el token `--revision` se reusa también donde aparece el mismo hex `#fef3c7`/`#b45309` aunque en ese archivo el estado se llame distinto (ver Tarea 3, `estadoStyleFn`) — el token nombra el color, no obliga a que el label de negocio coincida.

### Tabla de mapeo estándar (aplicar mecánicamente salvo excepción listada)

| Valor(es) actuales | Token |
|---|---|
| `#0095d6`, `#0095D6` | `--sc-cyan` |
| `#0075a8` | `--sc-cyan-pressed` |
| `rgba(0,149,214,.04-.06)` | `--sc-cyan-tint-6` |
| `rgba(0,149,214,.10-.18)` | `--sc-cyan-tint-12` |
| `#16a34a`, `#15803d`, `#10b981`, `#22c55e`, `#059669` | `--ok` |
| `rgba(22,163,74/34,197,94/16,185,129, .06-.15)`, `#dcfce7` | `--ok-bg` |
| `#ef4444`, `#dc2626`, `#f87171`, `#E5484D` | `--danger` |
| `rgba(239,68,68,.06-.15)`, `#fee2e2`, `#fef2f2`, `#fecaca` | `--danger-bg` |
| `#f59e0b`, `#eab308`, `#d97706`, `#F5A524` | `--warn` |
| `rgba(245,158,11,.10-.15)` | `--warn-bg` |
| `#111827`, `#0f172a` | `--fg-1` |
| `#1f2937`, `#1a2733` | `--fg-2` |
| `#374151` (uso "fuerte"/heading secundario) | `--fg-2` |
| `#374151`, `#6b7280`, `#64748b`, `#8697a3` (uso "secundario"/muted) | `--fg-4` |
| `#9ca3af` | `--fg-5` |
| `#fff`, `#ffffff` | `--bg-0` |
| `#f9fafb`, `#f8fafc`, `#fafafa` | `--bg-1` |
| `#f3f4f6`, `#f0f4f8`, `#eef2f5` | `--bg-2` |
| `rgba(34,33,33,.06-.08)`, `#e5e7eb` | `--border-subtle` |
| `rgba(34,33,33,.1-.2)`, `#d1d5db`, `#e2e8f0`, `#cfd6dc` (como borde, no como texto) | `--border-default` |
| `rgba(34,33,33,.2+)`, `#8697a3` (como borde) | `--border-strong` |
| `rgba(0,0,0,.05-.07)` "0 1px..." | `--shadow-1` |
| `rgba(0,0,0,.07-.1)`/`rgba(15,23,42,.07-.12)` blur ≤16px | `--shadow-2` |
| ídem, blur >16px | `--shadow-3` |
| `rgba(15,23,42,.16-.18)` "0 8px+..." | `--shadow-4` |
| `rgba(0,149,214,.12-.35)` (focus ring) | `--shadow-focus` |
| Radios sueltos 6px / 7-10px / 12-16px / 20-24px / 999px | `--radius-sm` / `--radius-md` / `--radius-lg` / `--radius-xl` / `--radius-pill` |
| Backdrop de modal (`position:fixed;inset:0` o selector `.overlay`/`.modal-overlay`/`.backdrop`) — `rgba(15,23,42,.45)`, `rgba(0,0,0,.25-.65)` | `--overlay` |

### Excepciones confirmadas — NO tokenizar, dejar el valor literal

1. **`#7c3aed` / `rgba(124,58,237,*)`** — identidad visual del modo consumidor (sidebar, topbar, selects, badges de estado `cierre_pendiente`/`finalizado`). Aparece en 9+ archivos, en todos se deja igual.
2. **Gradientes de login** — `login-admin-page.component.css` (`#000000→#0a1628→#0d2347`, botón `#000`/`#1a1a1a`) y `login-consumidor-page.component.css` (`#003d6b→#0095d6→#00bcd4`, solo el segmento `#0095d6` del gradiente se cambia a `--sc-cyan` porque es literalmente el cyan de marca; `#003d6b` y `#00bcd4` quedan literales).
3. **Índigo `#6366f1`** — stat "Actividades" en `resumen-page`, ícono "Primeros pasos" en `ayuda-page`.
4. **Teal `#0d9488`** — `ESTADO_BADGE_STYLE.finalizado_facturado` en centros/proyectos.
5. **Sistema de badges categóricos de `documentos`** (`estadoChipStyle`/`contextoTagStyle` en `documentos-admin-page`/`documentos-consumidor-page`) — su 4º estado "revisión" (`#dbeafe`/`#1e40af`) y toda la paleta índigo/teal/fucsia/rosa/piedra de categorías de archivo.
6. **`estadoStyleFn()` en `shared/utils.ts`, caso `revision`** (`#dbeafe`/`#1e40af`) — mismo azul-índigo que el punto 5, misma excepción.
7. **Paletas configurables por tipo:** `proyectos-icons.ts` (`COLORES_PROYECTO`), `actividades-icons.ts` (`COLORES_ACTIVIDAD`), `activos-icons.ts` (`COLORES_ACTIVO`) y los colores default de sus `*-icono.component.ts` (`#0095d6`, `#4E9AC7`); `AVATAR_COLORS` en `clientes-list.component.ts`; `docTipoInfo()` (colores por tipo MIME) en `mis-centros-page`/`mi-proyecto-detalle-page`.
8. **Serie "Promedio" del spider-chart** (`rgba(34,197,94,.15)`/`#22c55e`) — distingue una 2ª serie de datos, no un estado.
9. Blancos/negros translúcidos aislados sin patrón claro (ej. `rgba(255,255,255,.35)` en un spinner) — se dejan como valores directos.

### Verificación (todas las tareas)

- `npm start` en `front4/`, revisar en el navegador las páginas tocadas por la tarea, en **modo admin y modo consumidor** cuando aplique.
- Al terminar cada tarea, correr un grep de verificación (dado en cada tarea) para confirmar que no quedaron los valores hex viejos sin reemplazar (fuera de las excepciones listadas arriba).
- `npm test` (Vitest) como red de seguridad — no debe romper ningún test existente.
- Commit al final de cada tarea.

---

### Task 1: Tokens globales y clases base (`front4/src/styles.css`)

**Files:**
- Modify: `front4/src/styles.css`

**Interfaces:**
- Produces: todas las variables CSS (`--sc-cyan`, `--fg-*`, `--bg-*`, `--border-*`, `--warn*`, `--danger*`, `--ok*`, `--info*`, `--revision*`, `--rechazado*`, `--overlay`, `--radius-*`, `--shadow-*`, `--space-*`, `--font-display`, `--font-body`) que consumen todas las tareas siguientes. Las clases `.btn-primary`, `.btn-success`, `.btn-ghost`, `.btn-danger`, `.card`, `.field input/select/textarea`, `.estado-chip`, `.tag-empresa`, `.tag-centro`, `.grupo-empresa`, `.grupo-centro`, `.dash-card`, `.panel`, `.pct-badge` quedan reesqueletizadas — cualquier componente que ya las use hereda el cambio sin tocar su propio archivo.

- [ ] **Step 1: Reemplazar el bloque `:root` completo**

Reemplazar (líneas 1-12 del archivo actual):

```css
*, *::before, *::after { box-sizing: border-box; }

:root {
  --accent:      #0095d6;
  --accent-dark: #0075a8;
  --bg:          #f0f4f8;
  --ink-900:     #1f2937;
  --ink-600:     #374151;
  --ink-500:     #6b7280;
  --ink-400:     #9ca3af;
  font-family: system-ui, -apple-system, sans-serif;
}
```

por:

```css
@import url("https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap");

*, *::before, *::after { box-sizing: border-box; }

:root {
  /* ---------- Brand ---------- */
  --sc-cyan:          #00AEEF;
  --sc-cyan-hover:    #0095CC;
  --sc-cyan-pressed:  #007FB0;
  --sc-cyan-tint-6:   #E5F7FD;
  --sc-cyan-tint-12:  #CCEFFB;
  --sc-gray-brand:    #939498;

  /* ---------- Ink (foreground) ---------- */
  --fg-1: #0B0F14;
  --fg-2: #2A323B;
  --fg-3: #525C66;
  --fg-4: #7A8590;
  --fg-5: #A6AFB8;
  --fg-inverse: #FFFFFF;

  /* ---------- Surface (background) ---------- */
  --bg-0: #FFFFFF;
  --bg-1: #F8FAFB;
  --bg-2: #EEF2F5;
  --bg-3: #E4E8EC;
  --bg-dark: #0B0F14;
  --bg-dark-2: #151A21;

  /* ---------- Border / divider ---------- */
  --border-subtle: #E4E8EC;
  --border-default: #CFD6DC;
  --border-strong: #8C97A0;

  /* ---------- Semantic ---------- */
  --warn: #F5A524;       --warn-bg: #FEF6E4;
  --danger: #E5484D;     --danger-bg: #FDECEC;
  --ok: #2EAE6E;         --ok-bg: #E7F6EE;
  --info: #00AEEF;       --info-bg: #E5F7FD;
  --revision: #B45309;   --revision-bg: #FEF3C7;
  --rechazado: #9D174D;  --rechazado-bg: #FCE7F3;
  --overlay: rgba(11, 15, 20, .45);

  /* ---------- Type families ---------- */
  --font-display: "Space Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-body:    "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif;

  /* ---------- Radii ---------- */
  --radius-xs: 4px; --radius-sm: 6px; --radius-md: 10px;
  --radius-lg: 16px; --radius-xl: 24px; --radius-pill: 999px;

  /* ---------- Elevation ---------- */
  --shadow-1: 0 1px 2px rgba(11, 15, 20, .06);
  --shadow-2: 0 4px 12px rgba(11, 15, 20, .08);
  --shadow-3: 0 8px 24px rgba(11, 15, 20, .10);
  --shadow-4: 0 16px 40px rgba(11, 15, 20, .12);
  --shadow-focus: 0 0 0 3px rgba(0, 174, 239, .35);

  /* ---------- Spacing (4px base) ---------- */
  --space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-5:20px;
  --space-6:24px; --space-8:32px; --space-10:40px; --space-12:48px;

  font-family: var(--font-body);
}

body { font-family: var(--font-body); }
h1, h2, h3, h4, h5, h6 { font-family: var(--font-display); }
```

- [ ] **Step 2: Reesqueletizar `body` y clases base**

Reemplazar la línea `body { margin: 0; background: var(--bg); color: var(--ink-900); }` por:

```css
body { margin: 0; background: var(--bg-1); color: var(--fg-1); }
```

- [ ] **Step 3: Reesqueletizar `.field input/select/textarea`**

Reemplazar el bloque `.field input, .field select, .field textarea { ... }` (líneas ~32-42 actuales) por:

```css
.field input,
.field select,
.field textarea {
  padding: .6rem .75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-default);
  font-family: inherit;
  font-size: .9rem;
  background: var(--bg-0);
  transition: border-color .15s, box-shadow .15s;
}
```

y el bloque `:focus` por:

```css
.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: var(--sc-cyan);
  box-shadow: var(--shadow-focus);
  background: var(--bg-0);
}
```

- [ ] **Step 4: Reesqueletizar botones**

Reemplazar todo el bloque `/* ── Buttons ── */` (`.btn-primary`, `.btn-success`, `.btn-ghost`, `.btn-danger` y sus `:hover`) por:

```css
/* ── Buttons ────────────────────────────────────────── */
.btn-primary {
  padding: .6rem 1.2rem;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--sc-cyan);
  color: var(--fg-inverse);
  font-weight: 700;
  font-size: .875rem;
  cursor: pointer;
  transition: background .15s;
}
.btn-primary:hover { background: var(--sc-cyan-hover); }
.btn-primary:active { background: var(--sc-cyan-pressed); }

.btn-success {
  padding: .6rem 1.2rem;
  border-radius: var(--radius-pill);
  border: none;
  background: var(--ok);
  color: var(--fg-inverse);
  font-weight: 700;
  font-size: .875rem;
  cursor: pointer;
  transition: background .15s;
}
.btn-success:hover { filter: brightness(.92); }

.btn-ghost {
  padding: .55rem 1rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--fg-3);
  font-weight: 600;
  font-size: .875rem;
  cursor: pointer;
  transition: all .15s;
}
.btn-ghost:hover { border-color: var(--border-strong); background: var(--bg-1); }
.btn-ghost.btn-sm { padding: .4rem .75rem; font-size: .8rem; }

.btn-danger {
  padding: .4rem .75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--danger);
  background: var(--danger-bg);
  color: var(--danger);
  font-size: .8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all .15s;
}
.btn-danger:hover { filter: brightness(.95); }
```

- [ ] **Step 5: Reesqueletizar `.card`, `.list`, `.grupos`, `.tag-*`, `.estado-chip`, `.empresa-select`, dashboard cards, `.pct-badge`**

Aplicar la tabla de mapeo estándar (Global Constraints) a todo el resto del archivo:
- `.card`: `border-radius:14px` → `var(--radius-lg)`; `box-shadow: 0 1px 3px rgba(0,0,0,.06)` → `var(--shadow-1)`; `background:#fff` → `var(--bg-0)`.
- `.list .card:hover`: `box-shadow` → `var(--shadow-2)`; `border-color: rgba(34,33,33,.2)` → `var(--border-strong)`.
- `.list .card.selected`: `border-color: var(--accent)` → `var(--sc-cyan)`; `box-shadow: 0 0 0 2px rgba(0,149,214,.15)` → `var(--shadow-focus)`.
- `.empty`, `.card-main .rut/.email`: `var(--ink-400)`/`var(--ink-500)` → `var(--fg-5)`/`var(--fg-4)`.
- `.grupo-empresa`, `.grupo-header`, `.grupo-label`, `.grupo-count`: `rgba(0,149,214,X)` → `--sc-cyan-tint-6`/`--sc-cyan-tint-12` según opacidad; `#0075a8`/`#0095d6` → `--sc-cyan-pressed`/`--sc-cyan`.
- `.grupo-centro`, `.grupo-header--centro`, `.grupo-label--centro`: `rgba(16,185,129,X)` → `--ok-bg` (nueva regla: opacidad baja de verde también es `--ok-bg`); `#047857`/`#10b981` → `--ok`.
- `.tag-empresa`/`.tag-centro`: mismo mapeo cyan/ok que arriba; `border-radius` → `var(--radius-pill)`.
- `.estado-chip`: `background: rgba(34,33,33,.07)` → `var(--bg-2)`.
- `.empresa-select`: `border-radius:8px` → `var(--radius-sm)`; `border: 1px solid rgba(34,33,33,.2)` → `var(--border-default)`; `color:#374151` → `var(--fg-2)`; `:focus border-color:#0095d6` → `var(--sc-cyan)`.
- `.dash-card`, `.panel`: `background:#fff` → `var(--bg-0)`; `border: 1px solid rgba(34,33,33,.08)` → `var(--border-subtle)`; `border-radius:16px` → `var(--radius-lg)`; `h2 color:#111827` → `var(--fg-1)`.
- `.pct-badge`: sin color propio (solo estructura), no requiere cambio de color aquí (el color se define inline donde se usa el componente).
- Scrollbars (`.scroll-area`, `.dash-card .card-body`, `.panel .panel-body`): `rgba(0,0,0,.13)`/`rgba(0,0,0,.15)` → dejar igual (son de scrollbar-color/thumb, sin token de marca equivalente exacto; opcionalmente usar `var(--border-strong)` si se quiere consistencia — usar `var(--border-strong)`).

- [ ] **Step 6: Verificar en navegador**

`npm start`, abrir `/empresa` (admin) y `/inicio` (consumidor). Confirmar: botones cyan sólido con hover más oscuro, cards con sombra sutil, inputs con borde gris claro y foco cyan, tags empresa/centro en cyan/verde. Tipografía de headings debe verse con Space Grotesk (más geométrica) y el resto con DM Sans.

- [ ] **Step 7: Grep de verificación**

```bash
grep -n "var(--accent\|var(--ink-\|var(--bg)" front4/src/styles.css
```
Debe devolver vacío (todas las referencias viejas fueron reemplazadas).

- [ ] **Step 8: Commit**

```bash
git add front4/src/styles.css
git commit -m "feat(front4): tokens y clases base del Smartclarity Design System"
```

---

### Task 2: Layout (topbar, sidebar, main-layout)

**Files:**
- Modify: `front4/src/app/layout/sidebar/sidebar.component.ts`
- Modify: `front4/src/app/layout/topbar/topbar.component.ts`
- Modify: `front4/src/app/layout/topbar/topbar.component.html`
- Modify: `front4/src/app/layout/main-layout/main-layout.component.ts`

**Interfaces:**
- Consumes: tokens de la Tarea 1.
- Produces: sin cambios de interfaz pública (mismos `@Input`, mismos nombres de método `getIcon()`, `getNotifIcon()`).

- [ ] **Step 1: Sidebar — recolorear el panel oscuro y estados de menú**

En `sidebar.component.ts`, dentro de `styles: [...]`, reemplazar:
- `.sidebar { background: #18222e; ... }` → `background: var(--bg-dark);`
- `.brand-header { border-bottom: 1px solid rgba(255,255,255,.07); }` → dejar igual (blanco translúcido sobre fondo oscuro, sin token equivalente — excepción tipo #9).
- `.brand-name { color: #e2eaf2; }` → `color: var(--fg-inverse);`
- `.brand-sub`, `.empresa-sub` `{ color: #8aa4b8; }` → `color: rgba(255,255,255,.55);` (gris-claro sobre oscuro, sin token — mantener como valor directo).
- `a.item { color: #8aa4b8; }` → `color: rgba(255,255,255,.55);`
- `a.item:hover { background: rgba(255,255,255,.06); color: #c8daea; }` → `color: rgba(255,255,255,.8);` (mantener rgba de fondo igual, es hover sutil sobre oscuro).
- `a.item.active { background: rgba(77,184,240,.15); color: #4db8f0; }` → `background: var(--sc-cyan-tint-12); color: var(--sc-cyan);` — **ojo:** `--sc-cyan-tint-12` es `#CCEFFB`, un cyan sólido claro pensado para fondos blancos; sobre el sidebar oscuro usar en su lugar `background: rgba(0,174,239,.18); color: var(--sc-cyan);` (mantener el rgba porque el tint sólido no funciona sobre fondo oscuro).
- `.sidebar.consumidor a.item.active` (morado) → **no tocar**, es la excepción #1.
- `.sub-item`, `.sub-item--project`, `.sub-icon` (morado `rgba(124,58,237,*)`/`#a78bfa`/`#c4b5fd`) → **no tocar**, excepción #1.
- `.eclariti-link { border-top: 1px solid rgba(255,255,255,.07); }` → dejar igual.
- `.eclariti-text { color: #a78bfa; }` → **no tocar** (es parte de la identidad del link footer, mismo morado — excepción #1, ya que no hay instrucción de cambiarlo y es consistente con el resto del morado de marca del footer).

- [ ] **Step 2: Sidebar — bajar stroke-width de íconos a 1.75**

En el objeto `ICONS` (líneas ~26-40), reemplazar cada `stroke-width="2"` por `stroke-width="1.75"` (14 ocurrencias: home, dashboard, user, users, building, hierarchy, folder, calendar, wrench, file, monitor, megaphone, bell, help — no aplica a `eclarity` que es una `<img>`, ni a `bolt` que usa `fill="currentColor" stroke="none"`).

En `BUILDING_ICON` (línea ~42), cambiar:
```ts
const BUILDING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="9" width="7" height="12"/><path d="M10 3h4v4h-4z"/></svg>`;
```
por:
```ts
const BUILDING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18"/><rect x="14" y="9" width="7" height="12"/><path d="M10 3h4v4h-4z"/></svg>`;
```
(cambio de color fijo a `currentColor` para heredar el color del contenedor `.empresa-icon`, que ya define `color` implícitamente vía su texto — agregar `color: var(--fg-5);` a la regla `.empresa-icon` en los estilos para que el ícono se vea gris consistente).

- [ ] **Step 3: Topbar — recolorear**

En `topbar.component.ts`, dentro de `styles: [...]`:
- `.topbar { background: rgba(18,26,36,.85); border-bottom: 1px solid rgba(255,255,255,.06); box-shadow: 0 1px 8px rgba(0,0,0,.18); }` → `background: rgba(11,15,20,.85);` (mismo patrón, actualizado al rgb de `--bg-dark` = `11,15,20`); dejar el resto igual (translúcidos sin token).
- `.empresa-select { border: 1px solid rgba(124,58,237,.4); color:#e2eaf2; background: rgba(255,255,255,.08); }` → el border morado **no se toca** (excepción #1); `color` → `var(--fg-inverse)`.
- `.empresa-select:focus { border-color:#7c3aed; }` → **no tocar** (excepción #1).
- `.empresa-select option { background:#18222e; color:#e2eaf2; }` → `background: var(--bg-dark); color: var(--fg-inverse);`
- `.mode-chip { background:#0095d6; }` → `background: var(--sc-cyan);`
- `.topbar.consumidor .mode-chip { background:#7c3aed; }` → **no tocar** (excepción #1).
- `.topbar.admin .mode-chip { background:#2d3f52; color:#8aa4b8; }` → `background: var(--bg-dark-2); color: rgba(255,255,255,.55);`
- `.toggle-btn { color:#c8daea; }` → `color: rgba(255,255,255,.8);`
- `.notif-btn { color: #8aa4b8; }` / `:hover { color: #c8daea; }` → `rgba(255,255,255,.55)` / `rgba(255,255,255,.8)`.
- `.notif-badge { background: #ef4444; }` → `background: var(--danger);`
- `.notif-dropdown { background:#fff; border:1px solid rgba(34,33,33,.1); box-shadow: 0 8px 30px rgba(15,23,42,.15); }` → `background: var(--bg-0); border: 1px solid var(--border-default); box-shadow: var(--shadow-3);`
- `.notif-header { color:#374151; border-bottom:1px solid rgba(34,33,33,.08); background:#f9fafb; }` → `color: var(--fg-2); border-bottom-color: var(--border-subtle); background: var(--bg-1);`
- `.notif-item { border-bottom:1px solid rgba(34,33,33,.05); }` `:hover { background:#f0f9ff; }` → `border-bottom-color: var(--border-subtle);` `background: var(--sc-cyan-tint-6);`
- `.notif-titulo { color:#1f2937; }` → `var(--fg-2)`; `.notif-detalle { color:#6b7280; }` → `var(--fg-4)`; `.notif-empty { color:#9ca3af; }` → `var(--fg-5)`.

En el mismo archivo, bajar `stroke-width="2"` a `"1.75"` en `BELL_SVG` y en ambos `NOTIF_ICONS` (calendar, file).

En los métodos que arman `Notificacion[]` (`color: tipo?.color ?? '#0095d6'` y `color: s.estado === 'rechazado' ? '#ef4444' : '#0095d6'`), reemplazar los fallbacks literales `'#0095d6'` → no se puede usar `var()` dentro de un string TS consumido como color de dato (no CSS) — dejar el fallback como `'#00AEEF'` (el hex exacto del nuevo `--sc-cyan`) y `'#ef4444'` → `'#E5484D'` (hex exacto de `--danger`).

- [ ] **Step 4: Topbar HTML — badges y botones inline**

En `topbar.component.html`:
- L36: `background:#ef4444;color:#fff` → `background:var(--danger);color:var(--fg-inverse)`
- L53: `color:#dc2626` → `color:var(--danger)`
- L80: `color:#e2eaf2;border-color:rgba(255,255,255,.25)` → `color:var(--fg-inverse);border-color:rgba(255,255,255,.25)` (borde translúcido se mantiene)
- L88: `color:#dc2626;border-color:#dc2626` → `color:var(--danger);border-color:var(--danger)`

- [ ] **Step 5: Main-layout — fondo de shell**

En `main-layout.component.ts`, `.layout { background:#e9ecf0; }` y `.content { background:#e9ecf0; }` → `background: var(--bg-1);`

- [ ] **Step 6: Verificar en navegador**

`npm start`. Revisar sidebar y topbar en modo **admin** (acento cyan) y modo **consumidor** (acento morado intacto). Confirmar que los íconos se ven ligeramente más finos (1.75 vs 2) pero sin distorsión, que el badge de notificaciones es rojo `--danger`, y que el dropdown de notificaciones tiene fondo blanco con sombra suave.

- [ ] **Step 7: Grep de verificación**

```bash
grep -n "#18222e\|#0095d6\|#e9ecf0\|#8aa4b8\|#c8daea\|#e2eaf2\|#2d3f52\|stroke-width=\"2\"" \
  front4/src/app/layout/sidebar/sidebar.component.ts \
  front4/src/app/layout/topbar/topbar.component.ts \
  front4/src/app/layout/topbar/topbar.component.html \
  front4/src/app/layout/main-layout/main-layout.component.ts
```
Cada resultado debe ser una excepción documentada (morado, translúcidos sin token) — si aparece algo no explicado, corregirlo.

- [ ] **Step 8: `npm test` y commit**

```bash
cd front4 && npm test
git add src/app/layout
git commit -m "feat(front4): reskin de layout (sidebar/topbar) + íconos stroke-width 1.75"
```

---

### Task 3: `shared/utils.ts` + `shared/components/*`

**Files:**
- Modify: `front4/src/app/shared/utils.ts`
- Modify: `front4/src/app/shared/components/stat-chip/stat-chip.component.ts`
- Modify: `front4/src/app/shared/components/status-banner/status-banner.component.ts`
- Modify: `front4/src/app/shared/components/crud-toolbar/crud-toolbar.component.ts`
- Modify: `front4/src/app/shared/components/spider-chart/spider-chart.component.ts`
- Modify: `front4/src/app/shared/components/image-upload/image-upload.component.ts`
- Modify: `front4/src/app/shared/components/permisos-panel/permisos-panel.component.ts`
- Modify: `front4/src/app/shared/components/donut-arc/donut-arc.component.ts`
- Modify: `front4/src/app/shared/components/upload-bubble/upload-bubble.component.ts`
- Modify: `front4/src/app/shared/components/upload-document-form/upload-document-form.component.ts`
- Modify: `front4/src/app/shared/components/document-card-list/document-card-list.component.ts`

**Interfaces:**
- Consumes: tokens de la Tarea 1.
- Produces: `estadoStyleFn(estado): string`, `colorEstadoSolicitud(estado): string`, `porcentajeColorFn(pct): string`, `scoreChipVariantFn(pct)` (sin cambio de firma) — consumidos por dashboard (Tarea 4), centros/proyectos (Tareas 6-7), documentos (Tarea 8).

**Nota sobre la decisión del spec "aplanar barra de progreso a cyan sólido":** el spec (basado en `front4/CLAUDE.md`, que describe un "degradado azul→verde") asumía un `linear-gradient` real en la barra del score documental. Al revisar el código (`donut-arc.component.ts`, y el gauge SVG inline de `inicio-page`/`mi-ficha-page`) no existe tal gradiente — es un arco de color sólido por umbral (`porcentajeColorFn`: rojo <50%, ámbar 50-75%, verde ≥75%), ya tokenizado abajo. Forzarlo a cyan sólido eliminaría la señal roja/ámbar/verde de riesgo, algo que el spec no pretendía y que excede "reskin, sin tocar lógica" — por eso este plan preserva los 3 colores por umbral en vez de aplanar a cyan.

- [ ] **Step 1: `shared/utils.ts` — funciones de color de estado**

`colorEstadoSolicitud()` (todos los 5 estados mapean limpio, sin excepción):
```ts
export function colorEstadoSolicitud(estado: string): string {
  const map: Record<string, string> = {
    pendiente: '#00AEEF', revision: '#F5A524', aprobado: '#2EAE6E',
    rechazado: '#E5484D', vencido:  '#A6AFB8',
  };
  return map[estado] ?? '#A6AFB8';
}
```
(Es un valor de dato consumido fuera de CSS — usar el hex exacto del token, no `var()`.)

`estadoStyleFn()` — aplica excepción #6 solo al caso `revision`; los otros 4 casos tokenizan (reusando `--revision`/`--revision-bg` para el hex de `pendiente`, que coincide con el ámbar de "Revisión" del score documental — ver nota de Global Constraints):
```ts
export function estadoStyleFn(estado: string): string {
  const map: Record<string, string> = {
    pendiente: 'background:var(--revision-bg);color:var(--revision)',
    revision:  'background:#dbeafe;color:#1e40af', // excepción — ver Global Constraints #6
    aprobado:  'background:var(--ok-bg);color:var(--ok)',
    rechazado: 'background:var(--danger-bg);color:var(--danger)',
    vencido:   'background:var(--bg-2);color:var(--fg-2)',
  };
  return map[estado] ?? 'background:var(--bg-2);color:var(--fg-2)';
}
```

`porcentajeColorFn()`:
```ts
export function porcentajeColorFn(pct: number): string {
  if (pct >= 75) return '#2EAE6E';
  if (pct >= 50) return '#F5A524';
  return '#E5484D';
}
```

- [ ] **Step 2: `stat-chip.component.ts`**

```ts
styles: [`
  .chip { padding:.2rem .55rem; border-radius:var(--radius-pill); font-size:.7rem; font-weight:700; display:inline-block; }
  .ok      { background:var(--ok-bg);      color:var(--ok); }
  .warning { background:var(--warn-bg);    color:var(--warn); }
  .danger  { background:var(--danger-bg);  color:var(--danger); }
  .neutral { background:var(--bg-2);       color:var(--fg-3); }
`],
```

- [ ] **Step 3: `status-banner.component.ts`**

```ts
styles: [`
  .banner {
    padding: .75rem 1rem;
    border-radius: var(--radius-sm);
    background: var(--ok-bg);
    color: var(--ok);
    border: 1px solid var(--ok);
    font-size: .875rem;
  }
  .banner.error {
    background: var(--danger-bg);
    color: var(--danger);
    border-color: var(--danger);
  }
`],
```

- [ ] **Step 4: `crud-toolbar.component.ts`**

Reemplazar:
```ts
.toolbar { ... border-bottom:1px solid rgba(34,33,33,.1); }
.title { ... color:#1f2937; }
.btn { ... border:1px solid rgba(34,33,33,.2); ... color:#374151; }
.btn:hover { border-color:rgba(34,33,33,.4); background:rgba(255,255,255,.5); }
.btn.active { background:var(--accent,#0095d6); color:#fff; border-color:var(--accent,#0095d6); }
```
por:
```ts
.toolbar { ... border-bottom:1px solid var(--border-subtle); }
.title { ... color:var(--fg-1); }
.btn { ... border:1px solid var(--border-default); ... color:var(--fg-2); }
.btn:hover { border-color:var(--border-strong); background:var(--bg-1); }
.btn.active { background:var(--sc-cyan); color:var(--fg-inverse); border-color:var(--sc-cyan); }
```

- [ ] **Step 5: `spider-chart.component.ts`**

En el template inline:
- Placeholder "sin evaluación": `border:2px dashed #e5e7eb` → `var(--border-subtle)`; `stroke="#d1d5db"` → `var(--fg-5)` (usar `stroke="currentColor"` + `style="color:var(--fg-5)"` en el `<svg>`, ya que atributos SVG no evalúan `var()` en `stroke` directamente salvo que el valor sea `currentColor`); `color:#9ca3af` → `var(--fg-5)`.
- Grid/ejes: `stroke="rgba(34,33,33,.1)"` → mantener como `rgba(11,15,20,.08)` (equivalente a `--border-subtle` en formato rgba, ya que atributos SVG no resuelven `var()` fuera de `currentColor`); `stroke="rgba(34,33,33,.12)"` → `rgba(11,15,20,.1)`.
- Polígono de datos: `fill="rgba(0,149,214,.18)"` → `rgba(0,174,239,.18)`; `stroke="#0095d6"` → `#00AEEF`; `fill="#0095d6"` (dots) → `#00AEEF`.
- Polígono "Promedio" (`rgba(34,197,94,.15)`/`#22c55e`) → **no tocar**, excepción #8.
- Labels de texto: `fill="#374151"` → `#2A323B`; `fill="#0095d6"` → `#00AEEF`.
- Leyenda inferior: `stroke="#0095d6"` → `#00AEEF`; `color:#374151` → `#2A323B`; `color:#9ca3af` → `#A6AFB8`; `stroke="#22c55e"` → **no tocar** (excepción #8).

(Nota: los atributos SVG `fill`/`stroke` en este componente están escritos como strings literales en el template, no leen custom properties salvo `currentColor` — por eso aquí se reemplaza por el **valor hex exacto** del token en vez de `var(--token)`.)

- [ ] **Step 6: Resto de `shared/components` — aplicar tabla estándar**

- `image-upload.component.ts`: `#9ca3af→var(--fg-5)`, `rgba(34,33,33,.12)→var(--border-default)`, `#f9fafb→var(--bg-1)`, `#6b7280→var(--fg-3)`, `#e5e7eb→var(--border-subtle)`, `#fff→var(--bg-0)`, `#0095d6→var(--sc-cyan)`, `rgba(0,149,214,.35)→rgba(0,174,239,.35)`, `rgba(0,149,214,.06)→var(--sc-cyan-tint-6)`.
- `permisos-panel.component.ts`: `#0075a8→var(--sc-cyan-pressed)`, `#82c3e0→var(--sc-cyan-tint-12)`, `rgba(34,33,33,.1)→var(--border-default)`, `rgba(34,33,33,.07)→var(--border-subtle)`, `#f8fafc→var(--bg-1)`, `#1f2937→var(--fg-1)`, `#6b7280→var(--fg-3)`, `#9ca3af→var(--fg-5)`, `#c1c7d0→var(--fg-5)`, `#dfe3e7→var(--bg-3)`, `#fff→var(--bg-0)`, `rgba(0,0,0,.25)→var(--shadow-1)`.
- `donut-arc.component.ts`: `#e5e7eb→var(--border-subtle)`, `#dc2626→var(--danger)`, `#9ca3af→var(--fg-5)` (el color dinámico principal viene de `porcentajeColorFn()`, ya tokenizado en el Step 1).
- `upload-bubble.component.ts`: `#fff→var(--bg-0)`, `rgba(15,23,42,.16)→var(--shadow-4)`, `rgba(15,23,42,.08)→var(--shadow-2)`, `rgba(0,149,214,.06/.15/.12/.14)→var(--sc-cyan-tint-6)`/`var(--sc-cyan-tint-12)` según opacidad, `#0075a8→var(--sc-cyan-pressed)`, `#0095d6→var(--sc-cyan)`, `rgba(0,0,0,.13/.15)→var(--border-strong)` (scrollbar), `rgba(16,185,129,.14)→var(--ok-bg)`, `#10b981→var(--ok)`, `rgba(239,68,68,.12/.06/.3)→var(--danger-bg)`, `#ef4444→var(--danger)`.
- `upload-document-form.component.ts`: `#bfdbfe/#93c5fd→var(--sc-cyan-tint-12)`, `#f0f9ff→var(--sc-cyan-tint-6)`, `#fef9c3/#fde68a→var(--warn-bg)`, `#92400e→var(--warn)`, `#d1d5db→var(--border-default)`, `#fff→var(--bg-0)`, `#374151→var(--fg-2)`, `#6b7280→var(--fg-3)`, `#0095d6→var(--sc-cyan)`, `#f87171/#fef2f2→var(--danger-bg)`, `#dc2626→var(--danger)`.
- `document-card-list.component.ts`: `#fff→var(--bg-0)`, `#d7e6ee/#eef2f5→var(--border-subtle)`, `rgba(0,0,0,.05)→var(--shadow-1)`, `#f1c3bb/#fef8f7/#c0392b/#a94442/#fdecea→var(--danger)`/`var(--danger-bg)` según fondo/texto, `#1a2733→var(--fg-1)`, `#0075a8→var(--sc-cyan-pressed)`, `#e2e8f0→var(--border-default)`, `#fbfcfd→var(--bg-1)`, `#5b7484/#8697a3→var(--fg-3)`, `#0095d6→var(--sc-cyan)`, `#9ca3af→var(--fg-4)`.

- [ ] **Step 7: Verificar en navegador**

`npm start`. Los stat-chip/status-banner se usan en varias páginas de features — revisar al menos uno (ej. `/empresa`, cualquier fila con badge de estado). `spider-chart` se ve en `/mi-ficha` (consumidor) — confirmar que el polígono de datos sigue en cyan y el de "Promedio" en verde.

- [ ] **Step 8: `npm test` y commit**

```bash
cd front4 && npm test
git add src/app/shared
git commit -m "feat(front4): reskin de shared/utils.ts y shared/components"
```

---

### Task 4: Dashboard (`features/dashboard/pages/*`)

**Files:**
- Modify: `front4/src/app/features/dashboard/pages/inicio-page.component.ts`
- Modify: `front4/src/app/features/dashboard/pages/inicio-page.component.html`
- Modify: `front4/src/app/features/dashboard/pages/mi-ficha-page.component.html`
- Modify: `front4/src/app/features/dashboard/pages/resumen-page.component.ts`
- Modify: `front4/src/app/features/dashboard/pages/resumen-page.component.html`

**Interfaces:**
- Consumes: tokens de Tarea 1; `estadoStyleFn`, `porcentajeColorFn`, `scoreChipVariantFn` de Tarea 3 (ya tokenizadas, no requieren cambio en las páginas que las consumen).

- [ ] **Step 1: `inicio-page.component.ts`**

- `tareaColor()`: `'#ef4444'` (rechazado) → `'#E5484D'`; `'#0095d6'` (default) → `'#00AEEF'`.
- `actividadColorTipo()` fallback ×2: `'#9ca3af'` → `'#A6AFB8'`.
- `noticiaIconConfig()`: `novedades` `#dbeafe/#1d4ed8` → **dejar igual** (es un azul-índigo de sección de noticias, mismo criterio que la excepción #5/#6, no forma parte de ok/warn/danger/cyan); `normativas` `#fef3c7/#b45309` → `'#FEF3C7'/'#B45309'` (mismo hex que `--revision`, pero se deja como valor directo porque esta función retorna un objeto de estilo de dato, no CSS — usar los hex exactos); `anuncios` `#dcfce7/#15803d` → `'#E7F6EE'/'#2EAE6E'`; default `#f1f5f9/#64748b` → `'#EEF2F5'/'#7A8590'`.

- [ ] **Step 2: `inicio-page.component.html` — tarjetas de centro y "5 recuadros" del score**

Recuadros de estado (aparecen dos veces: resumen compacto por centro L67-86, y score grande L128-147) — aplicar exactamente:
```
background:#dcfce7 / color:#15803d  →  background:var(--ok-bg)        / color:var(--ok)          (Aprobados)
background:#fef3c7 / color:#b45309  →  background:var(--revision-bg)  / color:var(--revision)     (Revisión)
background:#f0f9ff / color:#0369a1  →  background:var(--info-bg)     / color:var(--info)          (Pendiente)
background:#fee2e2 / color:#dc2626  →  background:var(--danger-bg)   / color:var(--danger)         (Vencidos)
background:#fce7f3 / color:#9d174d  →  background:var(--rechazado-bg)/ color:var(--rechazado)      (Rechazados)
```

Resto del archivo (aplicar tabla estándar):
- `#1f2937→var(--fg-2)`, `#374151→var(--fg-2)`, `#6b7280→var(--fg-4)`, `#9ca3af→var(--fg-5)`.
- `rgba(34,33,33,.12)→var(--border-default)` (border tarjeta centro).
- Hover tarjeta centro `rgba(0,149,214,.18)`/`rgba(0,149,214,.35)` → `rgba(0,174,239,.18)`/`var(--sc-cyan)` (son valores dentro de `[style]` bindings, no clases CSS — usar hex exacto del nuevo cyan).
- `#e5e7eb` (stroke track gauge) → `var(--border-subtle)`.
- Hover/leave tarjeta score `onmouseenter`/`onmouseleave` inline JS: `rgba(0,149,214,.18)` → `rgba(0,174,239,.18)`; `rgba(0,0,0,.06)` → `rgba(11,15,20,.06)`.
- `#0095d6` (links "Ver todo") → `var(--sc-cyan)`.
- `rgba(34,33,33,.07)` (borde ítem) → `var(--border-subtle)`.
- `rgba(0,149,214,.04)` (hover bg ítem) → `var(--sc-cyan-tint-6)`.
- `#fff`/`#ef4444` (badge "N acciones") → `var(--fg-inverse)`/`var(--danger)`.
- `#f3f4f6` (bg bloque fecha) → `var(--bg-2)`.
- Badges rechazado/vencido/pendiente L229-241 (`#dc2626`/`#fee2e2`, `#b45309`/`#fef3c7`, `#0369a1`/`#e0f2fe`) → **este es el "3er sistema" detectado en la auditoría, inconsistente con el semáforo de arriba.** Alcance de este plan es reskin, no unificar lógica de negocio — tokenizar 1:1 preservando el significado actual: `#dc2626/#fee2e2→var(--danger)/var(--danger-bg)`, `#b45309/#fef3c7→var(--revision)/var(--revision-bg)`, `#0369a1/#e0f2fe→var(--info)/var(--info-bg)`.

- [ ] **Step 3: `mi-ficha-page.component.html`**

Aplicar tabla estándar (`#1f2937→fg-2`, `#6b7280→fg-4`, `#9ca3af→fg-5`, `rgba(34,33,33,.08)→border-subtle`, `#fff→bg-0`, `#0095d6→sc-cyan`, `rgba(34,33,33,.07)→border-subtle`, `#e5e7eb→border-subtle`, `1.5px dashed #d1d5db→border-default`).

"5 recuadros" del score (L165-183) — mismo mapeo exacto que el Step 2 (Aprobados/Revisión/Pendiente/Vencidos/Rechazados → ok/revision/info/danger/rechazado).

Badge "Activa" (`#dcfce7/#15803d`) → `var(--ok-bg)`/`var(--ok)`. Badge actividad reciente `esPasada` (`#dcfce7/#15803d` vs `#fef3c7/#b45309`) → `var(--ok-bg)`/`var(--ok)` vs `var(--revision-bg)`/`var(--revision)` (mismo criterio: reusa el token ámbar por color, aunque aquí el label sea "pasada" no "revisión").

`[style]="estadoStyle(...)"` (L98,248) — este binding llama a `estadoStyleFn()` de `shared/utils.ts`, ya tokenizada en la Tarea 3; no requiere cambio aquí.

Ícono archivo dinámico (`#ef4444` pdf / `#0095d6` otro) → `var(--danger)` / `var(--sc-cyan)`.

- [ ] **Step 4: `resumen-page.component.ts` (bloque `styles:`)**

Aplicar tabla estándar: `#111827→fg-1`, `#6b7280→fg-4`, `#fff→bg-0`, `rgba(34,33,33,.08)→border-subtle`, `rgba(0,149,214,.1)/#0095d6→sc-cyan-tint-6/sc-cyan` (`.stat-badge.blue`), `rgba(22,163,74,.1)/#16a34a→ok-bg/ok` (`.stat-badge.green`), `rgba(245,158,11,.12)/#d97706→warn-bg/warn` (`.stat-badge.amber`), `rgba(0,0,0,.13/.15)→border-strong` (scrollbar), `#0095d6→sc-cyan` (`.ver-todo`), `#fafafa/rgba(34,33,33,.06)→bg-1/border-subtle` (`.aten-item`), `#9ca3af→fg-5`, `#f3f4f6/#6b7280→bg-2/fg-4` (`.badge-gray`), `rgba(245,158,11,.12)/#d97706→warn-bg/warn` (`.badge-orange`), `rgba(239,68,68,.1)/#dc2626→danger-bg/danger` (`.badge-red`), `rgba(22,163,74,.1)/#16a34a→ok-bg/ok` (`.badge-green`), `#f3f4f6→bg-2` (`.score-track`), `#f59e0b/#6b7280→warn/fg-4` (`BADGE` map), `#0095d6→sc-cyan` (`colorTipo()` fallback), `#6b7280→fg-4` (`noticiaColor()` fallback).

**Excepción:** `rgba(99,102,241,.1)`/`#6366f1` (`.stat-badge.purple`) — **no tocar**, es el índigo decorativo (excepción #3).

- [ ] **Step 5: `resumen-page.component.html`**

`rgba(0,149,214,.1)/#0095d6→sc-cyan-tint-6/sc-cyan` (centros), `rgba(22,163,74,.1)/#16a34a→ok-bg/ok` (proyectos y override "Al día"), `rgba(245,158,11,.1)/#d97706→warn-bg/warn` (documentos). **Excepción:** `rgba(99,102,241,.1)/#6366f1` (actividades) — no tocar.

- [ ] **Step 6: Verificar en navegador**

`npm start` → `/inicio` (consumidor) y `/resumen` (admin). Confirmar que los 5 recuadros de score muestran: verde/ámbar/celeste-cyan/rojo/fucsia en ese orden, y que el stat-badge morado de "Actividades" en resumen sigue morado/índigo (no cambió).

- [ ] **Step 7: Grep de verificación**

```bash
grep -n "#dcfce7\|#fef3c7\|#f0f9ff\|#fee2e2\|#fce7f3\|#0095d6\|#16a34a\|#d97706\|#6b7280\|#9ca3af" \
  front4/src/app/features/dashboard/pages/*.ts front4/src/app/features/dashboard/pages/*.html
```
Cada match restante debe ser una excepción documentada (índigo `#6366f1`/`rgba(99,102,241,*)`, o los `noticiaIconConfig()` de sección que se dejaron como hex directo por ser datos, no CSS).

- [ ] **Step 8: `npm test` y commit**

```bash
cd front4 && npm test
git add src/app/features/dashboard
git commit -m "feat(front4): reskin de dashboard (inicio/mi-ficha/resumen)"
```

---

### Task 5: Auth (login admin/consumidor, cambiar/recuperar contraseña)

**Files:**
- Modify: `front4/src/app/features/auth/pages/login-admin-page.component.css`
- Modify: `front4/src/app/features/auth/pages/login-consumidor-page.component.css`
- Modify: `front4/src/app/features/auth/pages/cambiar-password-page.component.ts`
- Modify: `front4/src/app/features/auth/pages/olvide-password-page.component.ts`
- Modify: `front4/src/app/features/auth/pages/restablecer-password-page.component.ts`

**Interfaces:**
- Consumes: tokens de Tarea 1. Sin cambios de interfaz.

- [ ] **Step 1: `login-admin-page.component.css`**

**Excepción (no tocar):** gradiente `.panel-brand` (`#000000→#0a1628→#0d2347`), `.btn-submit` (`#000`/hover `#1a1a1a`) — identidad oscura del login admin.

Tokenizar el resto:
- `.feature-dot { background:#0095d6; }` → `var(--sc-cyan)`.
- `.panel-form { background:#f8fafc; }` → `var(--bg-1)`.
- `.form-box { background:#fff; border:1px solid rgba(34,33,33,.1); box-shadow: 0 4px 32px rgba(15,23,42,.07); }` → `background:var(--bg-0); border:1px solid var(--border-default); box-shadow: var(--shadow-3);`
- `.role-badge { background: rgba(0,0,0,.06); color:#374151; }` → `background: var(--bg-2); color: var(--fg-2);`
- `.form-title, input { color:#0f172a; }` → `var(--fg-1)`.
- `.form-subtitle { color:#6b7280; }` → `var(--fg-4)`.
- `.field label { color:#374151; }` → `var(--fg-2)`.
- `.forgot { color:#0095d6; }` → `var(--sc-cyan)`.
- input `border-color:#e2e8f0` → `var(--border-subtle)`.
- input `:focus { border-color:#0095d6; box-shadow: 0 0 0 3px rgba(0,149,214,.12); }` → `border-color: var(--sc-cyan); box-shadow: var(--shadow-focus);`
- `.toggle-pass { color:#9ca3af; } :hover { color:#374151; }` → `var(--fg-5)` / `var(--fg-2)`.
- `.error-banner { background:#fef2f2; border-color:#fecaca; color:#dc2626; }` → `background:var(--danger-bg); border-color:var(--danger); color:var(--danger);`
- `.form-footer { color:#9ca3af; }` `a { color:#0095d6; }` → `var(--fg-5)` / `var(--sc-cyan)`.

- [ ] **Step 2: `login-consumidor-page.component.css`**

Gradiente `.panel-brand`: `#003d6b→#0095d6→#00bcd4` → cambiar **solo** el segmento medio a `var(--sc-cyan)`: `linear-gradient(..., #003d6b, var(--sc-cyan), #00bcd4)` (los extremos `#003d6b`/`#00bcd4` quedan literales — excepción).

Resto (idéntico patrón a login-admin):
- `.panel-form { background:#f8fafc; }` → `var(--bg-1)`.
- `.form-box { background:#fff; border:1px solid rgba(34,33,33,.1); box-shadow: 0 4px 32px rgba(15,23,42,.07); }` → `var(--bg-0)` / `var(--border-default)` / `var(--shadow-3)`.
- `.role-badge { background: rgba(0,149,214,.1); color:#0095d6; }` → `var(--sc-cyan-tint-6)` / `var(--sc-cyan)`.
- `.form-title, input { color:#0f172a; }` → `var(--fg-1)`.
- `.form-subtitle, .check-label { color:#6b7280; }` → `var(--fg-4)`.
- `.field label { color:#374151; }` → `var(--fg-2)`.
- `.forgot, accent-color, .form-footer a { color:#0095d6; }` → `var(--sc-cyan)`.
- input `border-color:#e2e8f0` → `var(--border-subtle)`; `:focus` → `var(--sc-cyan)` / `var(--shadow-focus)`.
- `.toggle-pass, .divider span, .form-footer { color:#9ca3af; }` → `var(--fg-5)`.
- `.error-banner` → igual que login-admin.
- `.btn-submit { background: linear-gradient(#0095d6, #0369a1); color:#fff; }` → `background: linear-gradient(var(--sc-cyan), var(--sc-cyan-pressed)); color: var(--fg-inverse);`
- `.btn-soporte { border-color: rgba(0,149,214,.3); background: rgba(0,149,214,.04); color:#0095d6; }` → `border-color: var(--sc-cyan); background: var(--sc-cyan-tint-6); color: var(--sc-cyan);`

- [ ] **Step 3: `cambiar-password-page.component.ts`, `olvide-password-page.component.ts`, `restablecer-password-page.component.ts`**

Mismo patrón en los tres (bloque `styles:` inline):
- `.wrapper { background:#f9fafb; }` → `var(--bg-1)`.
- `.card { background:#fff; box-shadow: 0 4px 24px rgba(15,23,42,.1); }` → `var(--bg-0)` / `var(--shadow-3)`.
- `h2 { color:#1f2937; }` → `var(--fg-2)`.
- `p.sub`, hints `{ color:#6b7280; }` → `var(--fg-4)`.
- `label { color:#374151; }` → `var(--fg-2)`.
- input `border-color:#d1d5db` → `var(--border-default)`.
- input `:focus`, `.volver { color:#0095d6; }` → `var(--sc-cyan)`.
- `.error { color:#dc2626; }` → `var(--danger)`.
- `.ok { color:#16a34a; }` → `var(--ok)`.
- hint pequeño `#9ca3af` → `var(--fg-5)`.

- [ ] **Step 4: Verificar en navegador**

`npm start` → navegar a `/login` (o la ruta de login admin) y a la de login consumidor sin sesión activa. Confirmar que el panel de marca sigue oscuro/degradado (admin) y azul-a-cyan (consumidor) sin romperse, y que el formulario (fondo blanco, focus cyan) se ve reskineado.

- [ ] **Step 5: Grep de verificación**

```bash
grep -n "#0095d6\|#374151\|#6b7280\|#9ca3af\|#dc2626\|#16a34a\|#0f172a\|#d1d5db" \
  front4/src/app/features/auth/pages/*.css front4/src/app/features/auth/pages/*.ts
```
Sin matches salvo los ya documentados como excepción (gradientes oscuros).

- [ ] **Step 6: `npm test` y commit**

```bash
cd front4 && npm test
git add src/app/features/auth
git commit -m "feat(front4): reskin de auth (login admin/consumidor, contraseña)"
```

---

### Task 6: Features — clientes, centros

**Files:**
- Modify: `front4/src/app/features/clientes/components/cliente-form/cliente-form.component.html`
- Modify: `front4/src/app/features/clientes/components/clientes-list/clientes-list.component.ts`
- Modify: `front4/src/app/features/clientes/components/clientes-list/clientes-list.component.html`
- Modify: `front4/src/app/features/clientes/pages/clientes-page.component.ts`
- Modify: `front4/src/app/features/clientes/pages/clientes-page.component.html`
- Modify: `front4/src/app/features/centros/components/centro-form/centro-form.component.html`
- Modify: `front4/src/app/features/centros/components/centros-list/centros-list.component.ts`
- Modify: `front4/src/app/features/centros/pages/centros-page.component.ts`
- Modify: `front4/src/app/features/centros/pages/centros-page.component.html`
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.ts`
- Modify: `front4/src/app/features/centros/pages/mis-centros-page.component.html`

**Interfaces:**
- Consumes: tokens de Tarea 1; `estadoStyleFn`/`porcentajeColorFn` de Tarea 3 donde aplique.

- [ ] **Step 1: Clientes — aplicar tabla estándar**

- `clientes-page.component.html`: `#374151→fg-2`, `#dc2626/#fef2f2/#fecaca→danger/danger-bg`, `#d1d5db→border-default`, `#f9fafb→bg-1`, `rgba(34,33,33,.08)→border-subtle`, `#1f2937→fg-2`, `#6b7280→fg-4`, `#dcfce7/#15803d→ok-bg/ok`, `#f3f4f6→bg-2`, `#0095d6/#fff→sc-cyan/fg-inverse`.
- `clientes-page.component.ts`: `#111827→fg-1`, `#6b7280→fg-4`, `#fff→bg-0`, `rgba(34,33,33,.2)→border-strong`, `#0095d6→sc-cyan`. Overlay de modal `rgba(15,23,42,.45)` → `var(--overlay)`. Sombra `rgba(15,23,42,.18)` → `var(--shadow-4)`.
- `clientes-list.component.ts`: `#fff/rgba(0,0,0,.07)→bg-0/border-subtle`, `rgba(0,0,0,.05)→shadow-1`, `#111827→fg-1`, `#6b7280→fg-4`, `#9ca3af→fg-5`, `#0095d6/rgba(0,149,214,.04)→sc-cyan/sc-cyan-tint-6`, `#dc2626/rgba(220,38,38,.06/.25)→danger/danger-bg`. `getScoreColor()`: `#16a34a/#0095d6/#f59e0b→'#2EAE6E'/'#00AEEF'/'#F5A524'` (hex exacto, es un valor de dato retornado por función, no CSS).
- `cliente-form.component.html`: `#fff` (spinner) → `var(--fg-inverse)`. `rgba(255,255,255,.35)` (spinner translúcido) → **dejar igual** (excepción #9, sin patrón claro de token).

- [ ] **Step 2: Centros — aplicar tabla estándar**

- `centros-page.*`: mismo patrón que `clientes-page.*` (Step 1).
- `centros-list.component.ts`: `#0075a8→sc-cyan-pressed`, `#0095d6/rgba(0,149,214,.06)→sc-cyan/sc-cyan-tint-6`, `#f87171/#ef4444/rgba(239,68,68,.08)→danger/danger-bg`. `getScoreColor()` (si existe función local análoga): `#16a34a/#0095d6/#dc2626→'#2EAE6E'/'#00AEEF'/'#E5484D'`.
- `centro-form.component.html`: tabs `#0095d6/#6b7280→sc-cyan/fg-4`; `var(--color-danger,#dc3545)` → `var(--danger)` (reemplazar el fallback y el nombre de variable).
- `mis-centros-page.component.ts`, función `ESTADO_BADGE_STYLE`: `#dc2626→danger`, `#6b7280→fg-4`, `#64748b→fg-3`, `#16a34a→ok`, `#d97706→warn`. **Excepciones (no tocar):** `#7c3aed` (morado, `cierre_pendiente`), `#0d9488` (teal, `finalizado_facturado`). `docTipoInfo()` — **no tocar** (excepción #7, colores por tipo MIME).
- `mis-centros-page.component.html`: aplicar tabla estándar a fg-2/fg-4/fg-5/border-*. "5 recuadros" del score documental: mismo mapeo exacto de la Tarea 4 Step 2 (ok/revision/info/danger/rechazado).

- [ ] **Step 3: Verificar en navegador**

`npm start` → `/empresa` y `/centros` (admin), `/mis-centros` (consumidor). Confirmar badges de estado (incluye que el morado de `cierre_pendiente` y el teal de `finalizado_facturado` siguen intactos), y el score documental con los 5 colores correctos.

- [ ] **Step 4: Grep de verificación**

```bash
grep -n "#0095d6\|#0075a8\|#dc2626\|#16a34a\|#374151\|#6b7280\|#9ca3af\|#1f2937\|#111827" \
  front4/src/app/features/clientes/**/*.ts front4/src/app/features/clientes/**/*.html \
  front4/src/app/features/centros/**/*.ts front4/src/app/features/centros/**/*.html
```
Cada match restante debe ser excepción documentada (`#7c3aed`, `#0d9488`, `docTipoInfo`, colores de `getScoreColor` ya en hex nuevo).

- [ ] **Step 5: `npm test` y commit**

```bash
cd front4 && npm test
git add src/app/features/clientes src/app/features/centros
git commit -m "feat(front4): reskin de clientes y centros"
```

---

### Task 7: Features — proyectos, usuarios

**Files:**
- Modify: `front4/src/app/features/proyectos/components/proyecto-form/proyecto-form.component.ts`
- Modify: `front4/src/app/features/proyectos/components/proyecto-icono/proyecto-icono.component.ts`
- Modify: `front4/src/app/features/proyectos/components/proyectos-list/proyectos-list.component.ts`
- Modify: `front4/src/app/features/proyectos/pages/mi-proyecto-detalle-page.component.ts`
- Modify: `front4/src/app/features/proyectos/pages/mi-proyecto-detalle-page.component.html`
- Modify: `front4/src/app/features/proyectos/pages/mis-proyectos-page.component.ts`
- Modify: `front4/src/app/features/proyectos/pages/mis-proyectos-page.component.html`
- Modify: `front4/src/app/features/proyectos/pages/proyectos-page.component.ts`
- Modify: `front4/src/app/features/usuarios/components/permisos-form/permisos-form.component.ts`
- Modify: `front4/src/app/features/usuarios/components/roles-manager/roles-manager.component.ts`
- Modify: `front4/src/app/features/usuarios/components/suscripciones-form/suscripciones-form.component.ts`
- Modify: `front4/src/app/features/usuarios/components/usuario-form/usuario-form.component.html`
- Modify: `front4/src/app/features/usuarios/components/usuarios-list/usuarios-list.component.ts`
- Modify: `front4/src/app/features/usuarios/pages/usuarios-page.component.ts`

**Interfaces:**
- Consumes: tokens de Tarea 1.

- [ ] **Step 1: Proyectos**

- `proyecto-icono.component.ts`: color default `#0095d6` → `'#00AEEF'` (valor de dato, no CSS). `proyectos-icons.ts` (`COLORES_PROYECTO`) — **no tocar** (excepción #7).
- `proyecto-form.component.ts`: `#0075a8→sc-cyan-pressed`, `rgba(0,149,214,.06-.18)→sc-cyan-tint-6/12`, `#6b7280→fg-4`, `rgba(34,33,33,.1/.15/.18)→border-default/border-strong`, `#f8fafc→bg-1`, `#1f2937/#374151→fg-2`, `rgba(15,23,42,.12)→shadow-3`, `#f0f9ff→sc-cyan-tint-6`.
- `proyectos-list.component.ts`, `mi-proyecto-detalle-page.*`, `mis-proyectos-page.*`, `proyectos-page.*`: mismo `ESTADO_BADGE_STYLE` que centros (Tarea 6 Step 2) — `#dc2626→danger`, `#6b7280→fg-4`, `#64748b→fg-3`, `#16a34a→ok`, `#d97706→warn`. **Excepciones:** `#7c3aed` (morado), `#0d9488` (teal). Overlays de modal `rgba(15,23,42,.45)` → `var(--overlay)`. `#0095d6→sc-cyan`.
- `mis-proyectos-page.component.html`, `mi-proyecto-detalle-page.component.html`: "5 recuadros" del score documental — mismo mapeo exacto de Tarea 4 Step 2. `docTipoInfo()` en `mi-proyecto-detalle-page.component.ts` — no tocar (excepción #7).

- [ ] **Step 2: Usuarios**

- `roles-manager.component.ts`: `rgba(34,33,33,.1/.2)→border-default/border-strong`, `#1f2937→fg-2`, `#6b7280→fg-4`, `#9ca3af→fg-5`, `#374151→fg-2`.
- `permisos-form.component.ts`: avatares `#6b7280/#0095d6/#f59e0b→fg-4(bg)/sc-cyan/warn`, `#111827→fg-1`, `rgba(0,149,214,.12)/#0075a8→sc-cyan-tint-12/sc-cyan-pressed`, `rgba(34,33,33,.07)→border-subtle`, `#f3f4f6/#9ca3af→bg-2/fg-5`.
- `usuario-form.component.html`: `#9ca3af→fg-5`, `#374151→fg-2`, `rgba(34,33,33,.15)→border-default`.
- `suscripciones-form.component.ts`: `rgba(0,149,214,.06/.12/.3)→sc-cyan-tint-6/12`, `#0075a8/#0095d6→sc-cyan-pressed/sc-cyan`, `rgba(34,33,33,.015/.04)→bg-1`.
- `usuarios-list.component.ts`: avatares `#0095d6/#f59e0b→sc-cyan/warn`, badges `rgba(107,114,128,.1)/#4b5563→bg-2/fg-3`, `rgba(0,149,214,.1)/#0075a8→sc-cyan-tint-12/sc-cyan-pressed`, `rgba(245,158,11,.12)/#b45309→warn-bg/warn` (nota: aquí `#b45309` cumple rol de "ámbar genérico de warn", no del token `--revision` — usar `--warn` porque el contexto es un badge de warn, no el score de revisión), `rgba(239,68,68,.08)/#ef4444→danger-bg/danger`.
- `usuarios-page.component.ts`: overlay `rgba(15,23,42,.45)→var(--overlay)`, `rgba(15,23,42,.18)→shadow-4`, `#0095d6→sc-cyan`.

- [ ] **Step 3: Verificar en navegador**

`npm start` → `/proyectos` (admin), `/mis-proyectos` y detalle de un proyecto (consumidor), `/usuarios` (admin). Confirmar badges de estado de proyecto (morado/teal intactos), score documental del detalle de proyecto, y avatares/badges de usuarios.

- [ ] **Step 4: Grep de verificación**

```bash
grep -n "rgba(15,23,42,\.45)\|#0095d6\|#0075a8\|#dc2626\|#16a34a\|#f59e0b\|#374151\|#6b7280\|#9ca3af" \
  front4/src/app/features/proyectos/**/*.ts front4/src/app/features/proyectos/**/*.html \
  front4/src/app/features/usuarios/**/*.ts front4/src/app/features/usuarios/**/*.html
```

- [ ] **Step 5: `npm test` y commit**

```bash
cd front4 && npm test
git add src/app/features/proyectos src/app/features/usuarios
git commit -m "feat(front4): reskin de proyectos y usuarios"
```

---

### Task 8: Features — documentos, actividades

**Files:**
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.ts`
- Modify: `front4/src/app/features/documentos/pages/documentos-admin-page.component.html`
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.ts`
- Modify: `front4/src/app/features/documentos/pages/documentos-consumidor-page.component.html`
- Modify: `front4/src/app/features/actividades/components/actividad-icono/actividad-icono.component.ts`
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.css`
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.ts`
- Modify: `front4/src/app/features/actividades/pages/actividades-page.component.html`
- Modify: `front4/src/app/features/actividades/pages/mis-actividades-page.component.ts`
- Modify: `front4/src/app/features/actividades/pages/mis-actividades-page.component.html`

**Interfaces:**
- Consumes: tokens de Tarea 1. `actividades-page.component.css` es compartido por `mis-actividades-page` (mismo archivo, verificar en el `@Component` de ambas si comparten `styleUrl`).

- [ ] **Step 1: Documentos — `estadoChipStyle`/`contextoTagStyle` (parcial)**

En `documentos-admin-page.component.ts` (y su copia en `documentos-consumidor-page.component.ts`):
- `aprobado`: `#dcfce7/#14532d→var(--ok-bg)/var(--ok)`.
- `rechazado`: `#fee2e2/#7f1d1d→var(--danger-bg)/var(--danger)`.
- `pendiente`: `#fef3c7/#92400e→var(--warn-bg)/var(--warn)` (aquí sí es el warn genérico, no `--revision` — es un estado de solicitud de documento, distinto del score documental).
- `vencido`: `#f3f4f6/#374151→var(--bg-2)/var(--fg-2)`.
- Tags de contexto (proyecto/centro/empresa): `#d97706→var(--warn)`, `#059669→var(--ok)`, `#0095d6→var(--sc-cyan)`.
- **Excepción (no tocar):** estado `revision` (`#dbeafe/#1e40af`), toda la paleta categórica de archivo (índigo/teal/fucsia/rosa/piedra), `#7c3aed` (morado).

- [ ] **Step 2: Documentos — plantillas `.html` (admin y consumidor)**

Aplicar tabla estándar (patrones de alta frecuencia, reemplazar todas las ocurrencias):
`#0095d6→var(--sc-cyan)`, `#e5e7eb→var(--border-subtle)`, `#6b7280→var(--fg-4)`, `#9ca3af→var(--fg-5)`, `#374151→var(--fg-2)`, `#1f2937→var(--fg-2)`, `#f9fafb→var(--bg-1)`, `#f3f4f6→var(--bg-2)`, `#fff→var(--bg-0)`.

Tabs por estado: `#dc2626→var(--danger)`, `#16a34a→var(--ok)`, `#059669→var(--ok)`, `#d97706→var(--warn)`.

Overlays `rgba(15,23,42,.45)` → `var(--overlay)`.

**Excepción (no tocar):** `#7c3aed` (morado).

- [ ] **Step 3: Actividades — íconos e ícono default**

`actividad-icono.component.ts`: color default `#4E9AC7` → **no tocar** (excepción #7, es fallback de paleta configurable). `actividades-icons.ts` (`COLORES_ACTIVIDAD`) — no tocar (excepción #7).

- [ ] **Step 4: `actividades-page.component.css`**

Aplicar tabla estándar: `#1f2937/#374151→fg-2`, `#6b7280→fg-4`, `#9ca3af→fg-5`, `#111827→fg-1`, `#d1d5db→border-default`, `#e5e7eb→border-subtle`, `#f3f4f6/#f8fafc/#f9fafb→bg-1/bg-2`, `#fff→bg-0`, `#0095d6→sc-cyan`, `#0075a8→sc-cyan-pressed`, `rgba(0,149,214,.04-.18)→sc-cyan-tint-6/12`, `rgba(34,33,33,.06-.2)→border-subtle/default/strong` según opacidad.

Wizard "completado": `#dcfce7/#16a34a/#15803d→ok-bg/ok`. Estado intermedio: `#fffbeb/#b45309→warn-bg/warn` (nota: es un estado de progreso del wizard, no el score documental — usar `--warn`, no `--revision`). `#f0f9ff/#0369a1→sc-cyan-tint-6/sc-cyan`. Error: `#ef4444/#fef2f2→danger/danger-bg`.

Overlays `rgba(15,23,42,.45)`/`rgba(0,0,0,.45)` → `var(--overlay)`.

- [ ] **Step 5: `.ts`/`.html` de `actividades-page` y `mis-actividades-page`**

Fallback `#9ca3af→var(--fg-5)`. Color dinámico de tipo (`t.color`, `#4E9AC7` default) — **no tocar** (excepción #7).

- [ ] **Step 6: Verificar en navegador**

`npm start` → `/documentos` (admin y consumidor — confirmar que la vista consumidor NO muestra el tag de "quién subió" y que los estados de documento se ven con los colores correctos), `/actividades` (admin) y `/mis-actividades` (consumidor — abrir el wizard de crear actividad y confirmar el paso "completado" en verde).

- [ ] **Step 7: Grep de verificación**

```bash
grep -n "rgba(15,23,42,\.45)\|#0095d6\|#dc2626\|#16a34a\|#d97706\|#6b7280\|#9ca3af\|#1f2937" \
  front4/src/app/features/documentos/**/*.ts front4/src/app/features/documentos/**/*.html \
  front4/src/app/features/actividades/**/*.ts front4/src/app/features/actividades/**/*.html front4/src/app/features/actividades/**/*.css
```

- [ ] **Step 8: `npm test` y commit**

```bash
cd front4 && npm test
git add src/app/features/documentos src/app/features/actividades
git commit -m "feat(front4): reskin de documentos y actividades"
```

---

### Task 9: Features — activos, noticias, ayuda

**Files:**
- Modify: `front4/src/app/features/activos/components/activo-icono/activo-icono.component.ts`
- Modify: `front4/src/app/features/activos/components/activo-revisar-modal/activo-revisar-modal.component.ts`
- Modify: `front4/src/app/features/activos/components/activos-form/activos-form.component.ts`
- Modify: `front4/src/app/features/activos/components/activos-list/activos-list.component.ts`
- Modify: `front4/src/app/features/activos/components/activos-list/activos-list.component.html`
- Modify: `front4/src/app/features/activos/pages/activos-page.component.ts`
- Modify: `front4/src/app/features/activos/pages/activos-page.component.html`
- Modify: `front4/src/app/features/activos/pages/mis-activos-page.component.ts`
- Modify: `front4/src/app/features/noticias/pages/noticias-admin-page.component.css`
- Modify: `front4/src/app/features/noticias/pages/noticias-admin-page.component.ts`
- Modify: `front4/src/app/features/noticias/pages/noticias-consumidor-page.component.ts`
- Modify: `front4/src/app/features/ayuda/pages/ayuda-page.component.ts`

**Interfaces:**
- Consumes: tokens de Tarea 1.

- [ ] **Step 1: Activos**

`activo-icono.component.ts`: color default `#0095d6` → **no tocar** (excepción #7). `activos-icons.ts` (`COLORES_ACTIVO`) — no tocar.

`activos-page.component.ts`: `#1f2937→fg-2`, overlay `rgba(15,23,42,.45)→var(--overlay)`, `#fff→bg-0`, `rgba(15,23,42,.18)→shadow-4`, `#6b7280→fg-4`, `rgba(34,33,33,.2)→border-strong`, `#0095d6→sc-cyan`, `#374151→fg-2`, `#9ca3af→fg-5`, `rgba(34,33,33,.06)→border-subtle`, `rgba(34,33,33,.15)→border-default`, `rgba(15,23,42,.12)→shadow-3`, `#f0f9ff→sc-cyan-tint-6`.

`activos-page.component.html`: `#374151/#6b7280→fg-2/fg-4`, `#e5e7eb→border-subtle`.

`mis-activos-page.component.ts`, `activos-form.component.ts`: mismo patrón fg/bg/border/cyan que arriba.

`activo-revisar-modal.component.ts`: `#1f2937/#6b7280→fg-2/fg-4`, `#f3f4f6/#e5e7eb→bg-2`, `#dbeafe/#0095d6→sc-cyan-tint-12/sc-cyan` (tab activo — aquí SÍ se tokeniza porque no es el 4º estado de documentos, es un tab genérico), overlays `rgba(15,23,42,.5/.65)→var(--overlay)`, `#d1d5db→border-default`.

`activos-list.component.ts`: `#fff/rgba(34,33,33,.08/.06)→bg-0/border-subtle`, `#f9fafb→bg-1`, `#1f2937/#9ca3af→fg-2/fg-5`.

- [ ] **Step 2: Noticias**

`noticias-admin-page.component.css`: `#e5e7eb→border-subtle`, `#6b7280/#374151→fg-4/fg-2`, `var(--tab-color,#0095d6)→var(--sc-cyan)` (eliminar variable custom local, usar el token de marca directo), `#9ca3af→fg-5`, `#1f2937→fg-2`, `rgba(34,33,33,.1)→border-default`, `rgba(15,23,42,.05/.1)→shadow-1/shadow-2`, dropzone `color-mix(...#0095d6...)` → reemplazar el hex dentro del `color-mix()` por `#00AEEF` (mantener la función `color-mix`, solo actualizar el hex de entrada), `rgba(107,114,128,.25/.06)/#6b7280→border-default/bg-2/fg-4` (btn-edit), `rgba(239,68,68,.3/.06)/#ef4444→danger/danger-bg` (btn-delete). Overlay `rgba(0,0,0,.35)→var(--overlay)`.

`noticias-admin-page.component.ts`: fallback `#0095d6→'#00AEEF'`.

`noticias-consumidor-page.component.ts`: patrón fg-2/fg-4/fg-5; `var(--sec-color,#0095d6)→var(--sc-cyan)` (mismo criterio que arriba, eliminar variable custom local).

- [ ] **Step 3: Ayuda**

`ayuda-page.component.ts`: `#1f2937/#6b7280→fg-2/fg-4`. Ícono "Documentos" `rgba(236,253,245,1)/#059669→ok-bg/ok`. Banner soporte `linear-gradient(#0095d6→#0369a1)/#fff→linear-gradient(var(--sc-cyan), var(--sc-cyan-pressed))/var(--fg-inverse)`. **Excepciones (no tocar):** ícono "Primeros pasos" `#6366f1` (índigo), ícono "Calendarizar" `#7c3aed` (morado).

- [ ] **Step 4: Verificar en navegador**

`npm start` → `/activos` (admin y consumidor), `/noticias` (admin y consumidor), `/ayuda`. Confirmar modal de revisión de activo, dropzone de noticias, y que los íconos de ayuda mantienen su índigo/morado donde corresponde.

- [ ] **Step 5: Grep de verificación**

```bash
grep -n "rgba(15,23,42,\.45\|\.5\|\.65)\|#0095d6\|#374151\|#6b7280\|#9ca3af\|#1f2937\|var(--tab-color\|var(--sec-color" \
  front4/src/app/features/activos/**/*.ts front4/src/app/features/activos/**/*.html \
  front4/src/app/features/noticias/**/*.ts front4/src/app/features/noticias/**/*.css \
  front4/src/app/features/ayuda/**/*.ts
```

- [ ] **Step 6: `npm test` y commit**

```bash
cd front4 && npm test
git add src/app/features/activos src/app/features/noticias src/app/features/ayuda
git commit -m "feat(front4): reskin de activos, noticias y ayuda"
```

---

## Verificación final (tras completar las 9 tareas)

- [ ] Recorrido completo en navegador de las 21 rutas listadas en `front4/CLAUDE.md` (tabla "Rutas"), alternando modo admin/consumidor donde aplique.
- [ ] `npm test` una vez más sobre el estado final.
- [ ] Grep global de humo (no debe haber literales de marca vieja fuera de las excepciones documentadas):

```bash
grep -rn "#0095d6\|#0075a8" front4/src/app --include="*.ts" --include="*.html" --include="*.css" | grep -v "0075a8) → sc-cyan-pressed\|excepción"
```

- [ ] Confirmar que las 9 excepciones de Global Constraints siguen visualmente intactas (morado modo consumidor, gradientes de login, índigo, teal, badges categóricos de documentos, paletas configurables por tipo, serie "Promedio" del spider-chart).
